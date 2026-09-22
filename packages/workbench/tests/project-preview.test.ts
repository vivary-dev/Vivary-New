import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { ActionRunContext } from "@agent-native/core/action";

import { projectPreviewResult } from "../shared/project-preview.ts";
import { createProjectPreviewService } from "../server/project-preview.ts";

const owner = { userEmail: "owner@local.vivary.test", orgId: "local", caller: "frontend" } satisfies ActionRunContext;
const workspace = (root: string, projectId: string) => ({
  root, label: projectId, projectId, actorId: "actor", bindingId: "binding-" + projectId,
  bindingRevision: 1, policyRevision: 1, rootId: "root-" + projectId,
  locationRef: "location", verificationKind: "local-stat-revalidated-v1" as const,
});
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}
async function fixture(root: string): Promise<void> {
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    name: "vivary-preview-fixture", private: true,
    scripts: { dev: "node server.mjs" },
  }));
  await writeFile(path.join(root, "server.mjs"),
    "import { createServer } from 'node:http';\n" +
    "createServer((_req, res) => {\n" +
    "  res.setHeader('X-Frame-Options', 'DENY');\n" +
    "  res.end(process.env.VIVARY_TEST_SECRET ? 'leaked' : 'clean');\n" + // guard:allow-env-credential - Synthetic fixture sentinel used to prove child env stripping.
    "}).listen(Number(process.env.PORT), process.env.HOST);\n");
}

test("reviewed package preview runs under its project owner, reports readiness, and stops after rebind",
  { timeout: 25_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "vivary-project-preview-"));
    const second = await mkdtemp(path.join(tmpdir(), "vivary-project-preview-second-"));
    const projects = new Map([["alpha", workspace(root, "alpha")], ["beta", workspace(second, "beta")]]);
    const service = createProjectPreviewService({
      mode: () => "local",
      resolveWorkspace: async (_context, projectId) => {
        const value = projects.get(projectId);
        if (!value) throw new Error("Project binding unavailable");
        return value;
      },
    });
    const prior = process.env.VIVARY_TEST_SECRET; // guard:allow-env-credential - Synthetic test sentinel, restored in cleanup.
    process.env.VIVARY_TEST_SECRET = "do-not-inherit"; // guard:allow-env-credential - Synthetic test sentinel to verify child isolation.
    try {
      await fixture(root);
      await fixture(second);
      const port = await freePort();
      const url = "http://127.0.0.1:" + port + "/";
      const discovered = projectPreviewResult.parse(await service.run(
        { operation: "discover", projectId: "alpha" }, owner));
      assert.equal(discovered.code, "discovered");
      if (discovered.code !== "discovered") return;
      assert.deepEqual(discovered.scripts, [{ script: "dev", scriptText: "node server.mjs" }]);
      const reviewed = projectPreviewResult.parse(await service.run(
        { operation: "review", projectId: "alpha", script: "dev", url }, owner));
      assert.equal(reviewed.code, "review");
      if (reviewed.code !== "review") return;
      assert.match(reviewed.command, /run dev/);
      const requestId = "d4390ca5-803b-4a0e-9dc4-14cd38724376";
      const input = { operation: "start" as const, projectId: "alpha", script: "dev" as const,
        url, requestId, acceptedManifestDigest: reviewed.manifestDigest };
      const started = projectPreviewResult.parse(await service.run(input, owner));
      assert.equal(started.code, "ready");
      if (started.code !== "ready") return;
      assert.ok(started.pid && started.pid > 0);
      assert.equal(started.embedding, "blocked");
      assert.equal((await fetch(url)).status, 200);
      assert.equal(await (await fetch(url)).text(), "clean");
      assert.equal(projectPreviewResult.parse(await service.run(input, owner)).code, "ready");
      await assert.rejects(service.run({
        ...input, acceptedManifestDigest: "sha256:" + "a".repeat(64),
      }, owner), /different reviewed preview/);
      const inspected = projectPreviewResult.parse(await service.run(
        { operation: "inspect", projectId: "alpha", url }, owner));
      assert.equal(inspected.code, "checked");
      if (inspected.code === "checked") {
        assert.equal(inspected.reachable, true);
        assert.equal(inspected.embedding, "blocked");
      }
      const occupiedReview = projectPreviewResult.parse(await service.run(
        { operation: "review", projectId: "beta", script: "dev", url }, owner));
      assert.equal(occupiedReview.code, "review");
      if (occupiedReview.code !== "review") return;
      await assert.rejects(service.run({
        operation: "start", projectId: "beta", script: "dev", url,
        requestId: "30eaa9d9-d111-436d-9c03-574df167d589",
        acceptedManifestDigest: occupiedReview.manifestDigest,
      }, owner), /already in use/);
      const betaUrl = "http://127.0.0.1:" + await freePort() + "/";
      const betaReview = projectPreviewResult.parse(await service.run(
        { operation: "review", projectId: "beta", script: "dev", url: betaUrl }, owner));
      assert.equal(betaReview.code, "review");
      if (betaReview.code !== "review") return;
      const beta = projectPreviewResult.parse(await service.run({
        operation: "start", projectId: "beta", script: "dev", url: betaUrl,
        requestId: "6db87a2f-8dd1-40db-86cd-82837e7c41e2",
        acceptedManifestDigest: betaReview.manifestDigest,
      }, owner));
      assert.equal(beta.code, "ready");
      assert.equal(await (await fetch(betaUrl)).text(), "clean");
      await assert.rejects(service.run(
        { operation: "stop", projectId: "alpha", launchId: started.launchId },
        { ...owner, userEmail: "other@local.vivary.test" }), /not owned/);
      projects.delete("alpha");
      const stale = projectPreviewResult.parse(await service.run(
        { operation: "status", projectId: "alpha" }, owner));
      assert.equal(stale.code, "ready");
      if (stale.code === "ready") assert.equal(stale.staleBinding, true);
      const stopped = projectPreviewResult.parse(await service.run(
        { operation: "stop", projectId: "alpha", launchId: started.launchId }, owner));
      assert.equal(stopped.code, "stopped");
      if (stopped.code === "stopped") assert.equal(stopped.staleBinding, true);
      assert.equal(projectPreviewResult.parse(await service.run(
        { operation: "stop", projectId: "alpha", launchId: started.launchId }, owner)).code, "stopped");
      await assert.rejects(fetch(url));
      assert.equal(await (await fetch(betaUrl)).text(), "clean");
      projects.set("alpha", workspace(root, "alpha"));
      const replacement = projectPreviewResult.parse(await service.run({
        ...input, requestId: "4942581d-5504-4fca-a1b5-6e9e19276d16",
      }, owner));
      assert.equal(replacement.code, "ready");
      if (replacement.code === "ready") {
        assert.notEqual(replacement.launchId, started.launchId);
        assert.equal(projectPreviewResult.parse(await service.run(
          { operation: "stop", projectId: "alpha", launchId: started.launchId }, owner)).code, "stopped");
        assert.equal(await (await fetch(url)).text(), "clean");
        await service.run({ operation: "stop", projectId: "alpha", launchId: replacement.launchId }, owner);
      }
      await service.shutdown();
      await assert.rejects(fetch(betaUrl));
    } finally {
      await service.shutdown();
      if (prior === undefined) delete process.env.VIVARY_TEST_SECRET; // guard:allow-env-credential - Restore synthetic test sentinel.
      else process.env.VIVARY_TEST_SECRET = prior; // guard:allow-env-credential - Restore synthetic test sentinel.
      await rm(root, { recursive: true, force: true });
      await rm(second, { recursive: true, force: true });
    }
  });

test("shutdown blocks an in-flight reviewed start before it spawns",
  { timeout: 12_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "vivary-preview-shutdown-"));
    await fixture(root);
    const project = workspace(root, "shutdown");
    let hold = false;
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const service = createProjectPreviewService({
      mode: () => "local",
      resolveWorkspace: async () => {
        if (hold) { entered?.(); await gate; }
        return project;
      },
    });
    try {
      const url = "http://127.0.0.1:" + await freePort() + "/";
      const reviewed = projectPreviewResult.parse(await service.run(
        { operation: "review", projectId: "shutdown", script: "dev", url }, owner));
      assert.equal(reviewed.code, "review");
      if (reviewed.code !== "review") return;
      hold = true;
      const starting = service.run({
        operation: "start", projectId: "shutdown", script: "dev", url,
        requestId: "4afba4c8-8052-41ee-b190-e5c9b3370f7d",
        acceptedManifestDigest: reviewed.manifestDigest,
      }, owner);
      await waiting;
      await service.shutdown();
      release?.();
      await assert.rejects(starting, /shutting down/);
      await assert.rejects(fetch(url));
      assert.equal((await service.run({ operation: "status", projectId: "shutdown" }, owner)).code, "idle");
    } finally {
      release?.();
      await service.shutdown();
      await rm(root, { recursive: true, force: true });
    }
  });

test("the complete package manifest is checked after the port probe",
  { timeout: 12_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "vivary-preview-manifest-"));
    await fixture(root);
    const project = workspace(root, "manifest");
    let alterOnPortCheck = false;
    const service = createProjectPreviewService({
      mode: () => "local",
      resolveWorkspace: async () => project,
      portOccupied: async () => {
        if (alterOnPortCheck) await writeFile(path.join(root, "package.json"), JSON.stringify({
          name: "changed-after-review", private: true, scripts: { dev: "node server.mjs" },
        }));
        return false;
      },
    });
    try {
      const url = "http://127.0.0.1:" + await freePort() + "/";
      const reviewed = projectPreviewResult.parse(await service.run(
        { operation: "review", projectId: "manifest", script: "dev", url }, owner));
      assert.equal(reviewed.code, "review");
      if (reviewed.code !== "review") return;
      alterOnPortCheck = true;
      await assert.rejects(service.run({
        operation: "start", projectId: "manifest", script: "dev", url,
        requestId: "7b739814-1369-4736-8843-54f54e576482",
        acceptedManifestDigest: reviewed.manifestDigest,
      }, owner), /package contents or launcher changed/);
      assert.equal((await service.run({ operation: "status", projectId: "manifest" }, owner)).code, "idle");
      await assert.rejects(fetch(url));
    } finally {
      await service.shutdown();
      await rm(root, { recursive: true, force: true });
    }
  });

test("status rechecks a live preview URL and recovers when it responds again",
  { timeout: 12_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "vivary-preview-status-"));
    await fixture(root);
    const project = workspace(root, "status");
    let reachable = true;
    let heldProbe: Promise<void> | undefined;
    let enteredProbe = () => {};
    let releaseProbe = () => {};
    const service = createProjectPreviewService({
      mode: () => "local",
      resolveWorkspace: async () => project,
      probe: async () => {
        if (heldProbe) { enteredProbe(); await heldProbe; }
        return reachable
          ? { reachable: true, embedding: "unknown" }
          : { reachable: false, embedding: "unknown", reason: "The fixture stopped responding." };
      },
    });
    try {
      const url = "http://127.0.0.1:" + await freePort() + "/";
      const reviewed = projectPreviewResult.parse(await service.run(
        { operation: "review", projectId: "status", script: "dev", url }, owner));
      assert.equal(reviewed.code, "review");
      if (reviewed.code !== "review") return;
      const started = projectPreviewResult.parse(await service.run({
        operation: "start", projectId: "status", script: "dev", url,
        requestId: "c4548bcb-759b-4785-9aac-b11472ad4f84",
        acceptedManifestDigest: reviewed.manifestDigest,
      }, owner));
      assert.equal(started.code, "ready");
      reachable = false;
      const unavailable = projectPreviewResult.parse(await service.run(
        { operation: "status", projectId: "status" }, owner));
      assert.equal(unavailable.code, "unavailable");
      if (unavailable.code === "unavailable") assert.match(unavailable.reason, /stopped responding/);
      reachable = true;
      assert.equal((await service.run({ operation: "status", projectId: "status" }, owner)).code, "ready");
      if (started.code !== "ready") return;
      const entered = new Promise<void>(resolve => { enteredProbe = resolve; });
      heldProbe = new Promise<void>(resolve => { releaseProbe = resolve; });
      const checking = service.run({ operation: "status", projectId: "status" }, owner);
      await entered;
      await service.run({ operation: "stop", projectId: "status", launchId: started.launchId }, owner);
      releaseProbe();
      assert.equal((await checking).code, "stopped", "a delayed status probe cannot revive a stopped command");
    } finally {
      releaseProbe();
      await service.shutdown();
      await rm(root, { recursive: true, force: true });
    }
  });


test("a launcher exit cleans its background server before a later Stop",
  { timeout: 15_000, skip: process.platform === "win32" }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "vivary-preview-launcher-exit-"));
    const project = workspace(root, "exiting");
    const service = createProjectPreviewService({
      mode: () => "local", resolveWorkspace: async () => project,
    });
    let launchPid: number | null = null;
    try {
      await writeFile(path.join(root, "package.json"), JSON.stringify({
        name: "vivary-preview-exit-fixture", private: true, scripts: { dev: "node manager.mjs" },
      }));
      await writeFile(path.join(root, "server.mjs"),
        "import { createServer } from 'node:http';\n" +
        "createServer((_req, res) => res.end('owned')).listen(Number(process.env.PORT), process.env.HOST, () => process.send('ready'));\n");
      await writeFile(path.join(root, "manager.mjs"),
        "import { fork } from 'node:child_process';\n" +
        "import { writeFileSync } from 'node:fs';\n" +
        "const child = fork('./server.mjs', [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });\n" +
        "child.once('message', () => { writeFileSync('server-was-ready', 'yes'); setTimeout(() => process.exit(0), 200); });\n");
      const url = "http://127.0.0.1:" + await freePort() + "/";
      const review = await service.run({ operation: "review", projectId: project.projectId, script: "dev", url }, owner);
      assert.equal(review.code, "review");
      if (review.code !== "review") return;
      const started = await service.run({ operation: "start", projectId: project.projectId, script: "dev", url,
        requestId: "e8755927-609f-4d85-8ea1-e7c3e9ba3125", acceptedManifestDigest: review.manifestDigest }, owner);
      assert.ok("launchId" in started);
      if (!("launchId" in started)) return;
      launchPid = started.pid;
      assert.equal(await readFile(path.join(root, "server-was-ready"), "utf8"), "yes");
      let status = await service.run({ operation: "status", projectId: project.projectId }, owner);
      for (let n = 0; n < 30 && status.code !== "unavailable"; n++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        status = await service.run({ operation: "status", projectId: project.projectId }, owner);
      }
      assert.equal(status.code, "unavailable");
      await assert.rejects(fetch(url, { signal: AbortSignal.timeout(1000) }));
      const stopped = await service.run({ operation: "stop", projectId: project.projectId, launchId: started.launchId }, owner);
      assert.equal(stopped.code, "stopped");
      await service.shutdown();
      launchPid = null;
    } finally {
      try { await service.shutdown(); }
      finally {
        // The regression fixture owns this process group even when cleanup under test fails.
        if (launchPid) { try { process.kill(-launchPid, "SIGKILL"); } catch { /* Already gone. */ } }
        await rm(root, { recursive: true, force: true });
      }
    }
  });
