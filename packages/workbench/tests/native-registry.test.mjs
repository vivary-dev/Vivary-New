import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const proofRoot = process.argv[2];
if (!path.isAbsolute(proofRoot ?? "") || process.platform !== "linux") {
  throw new Error("this physical integration proof requires an absolute Linux proof directory");
}
const entryFile = process.argv[3] ?? fileURLToPath(new URL("../../core/vivary_core/root_provider_stdio.py", import.meta.url));
if (!path.isAbsolute(entryFile)) throw new Error("provider entry must be an absolute trusted source path");
const python = await realpath(process.argv[4] ?? "/usr/bin/python3");
const { parseStrictJson, evaluateRegistryOperation } = await import("../../../scripts/registry_contract_model.mjs");
const { startRootProvider } = await import("../server/root-provider.mjs");
async function fixture() {
  const root = await mkdtemp(path.join(proofRoot, "case-"));
  const scope = path.join(root, "projects");
  await mkdir(scope);
  const locations = {};
  for (const ref of ["location-a", "location-b"]) {
    locations[ref] = path.join(scope, ref);
    await mkdir(locations[ref]);
    await writeFile(path.join(locations[ref], "document.txt"), ref + " original\n");
  }
  await mkdir(path.join(root, "private"));
  const config = { deviceId: "device-fixture", scope,
    statePath: path.join(root, "private", "roots.json"), locations };
  return { root, config, start: () => startRootProvider({ python, entryFile, config, parseStrictJson }) };
}

test("real custody uses durable application IDs and refuses restart or replacement", async () => {
  const fixtureRoot = await fixture();
  let provider;
  try {
    provider = await fixtureRoot.start();
    assert.deepEqual(provider.readiness(), { status: "ready" });
    const first = await provider.observe("location-a");
    assert.equal(first.code, "observed");
    assert.match(first.rootId, /^root_[a-f0-9]{32}$/);
    assert.equal((await provider.observe("location-a")).rootId, first.rootId);
    const second = await provider.observe("location-b");
    assert.notEqual(second.rootId, first.rootId);
    assert.equal((await provider.observe("not-granted")).code, "identity-unverified");
    const saved = await readFile(fixtureRoot.config.statePath, "utf8");
    assert.ok(!saved.includes(fixtureRoot.config.scope));
    assert.ok(!saved.includes(first.contentRevision));
    await provider.close();
    assert.deepEqual(provider.readiness(), { status: "unavailable" });
    assert.equal((await provider.observe("location-a")).code, "identity-unverified");
    provider = await fixtureRoot.start();
    assert.equal((await provider.observe("location-a")).code, "identity-unverified");
    assert.equal(await readFile(fixtureRoot.config.statePath, "utf8"), saved);
  } finally { await provider?.close(); await rm(fixtureRoot.root, { recursive: true }); }
});

test("strict Python wire rejects duplicate fields, reordered sequences and path authority", async () => {
  const f = await fixture();
  try {
    const init = JSON.stringify({ version: 1, sequence: 0, operation: "initialize", config: f.config }) + "\n";
    for (const message of [
      '{"version":1,"sequence":1,"sequence":1,"operation":"observe","locationRef":"location-a"}\n',
      '{"version":1,"sequence":2,"operation":"observe","locationRef":"location-a"}\n',
      '{"version":1,"sequence":1,"operation":"observe","locationRef":"location-a","path":"/"}\n',
      '{"version":1,"sequence":true,"operation":"observe","locationRef":"location-a"}\n',
      " ".repeat(17000) + "\n",
    ]) {
      const child = spawnSync(python, ["-I", "-B", "-u", entryFile], {
        env: { LANG: "C.UTF-8" }, input: init + message, timeout: 5000, maxBuffer: 32768,
      });
      assert.equal(child.status, 1);
      assert.equal(child.stderr.length, 0);
      assert.deepEqual(child.stdout.toString().trim().split("\n").map(JSON.parse),
        [{ version: 1, sequence: 0, code: "ready" }]);
    }
    assert.deepEqual(await readdir(path.join(f.root, "private")), ["roots.json.lock"]);
  } finally { await rm(f.root, { recursive: true }); }
});

test("Node wire closes a lying, noisy or stalled provider within its deadline", async () => {
  const f = await fixture();
  try {
    for (const script of [
      'import sys; sys.stdin.readline(); print("{\\"version\\":1,\\"sequence\\":0,\\"code\\":\\"ready\\",\\"code\\":\\"ready\\"}", flush=True)',
      'import sys; sys.stdin.readline(); print("x" * 17000, flush=True)',
      'import sys; sys.stdin.readline(); print("unexpected", file=sys.stderr, flush=True)',
      'import sys; sys.stdin.readline(); sys.stdout.buffer.write(b"\\xff\\n"); sys.stdout.buffer.flush()',
      'import time; time.sleep(5)',
    ]) {
      const wrong = path.join(f.root, "wrong.py");
      await writeFile(wrong, script);
      const started = Date.now();
      await assert.rejects(startRootProvider({ python, entryFile: wrong, config: f.config,
        parseStrictJson, timeoutMs: 300 }), /root provider unavailable/);
      assert.ok(Date.now() - started < 2500);
    }
  } finally { await rm(f.root, { recursive: true }); }
});

test("a response cannot change its request locator or sequence", async () => {
  const f = await fixture();
  try {
    for (const response of [
      { version: 1, sequence: 2, code: "identity-unverified" },
      { version: 1, sequence: 1, code: "observed", rootId: "root_" + "a".repeat(32),
        locationRef: "location-b", contentRevision: "content" },
      { version: 1, sequence: 1, code: "ready" },
    ]) {
      const wrong = path.join(f.root, "wrong-reply.py");
      await writeFile(wrong, 'import sys, json\nsys.stdin.readline()\n'
        + 'print(json.dumps({"version":1,"sequence":0,"code":"ready"}), flush=True)\n'
        + 'sys.stdin.readline()\nprint(' + JSON.stringify(JSON.stringify(response)) + ', flush=True)\n');
      const provider = await startRootProvider({ python, entryFile: wrong, config: f.config, parseStrictJson });
      try {
        assert.equal((await provider.observe("location-a")).code, "identity-unverified");
        assert.deepEqual(provider.readiness(), { status: "unavailable" });
      } finally { await provider.close(); }
    }
  } finally { await rm(f.root, { recursive: true }); }
});

test("an unverified VCS inventory blocks siblings; simultaneous requests cannot steal responses", async () => {
  const f = await fixture();
  const separate = await fixture();
  let provider;
  try {
    const initialized = spawnSync("/usr/bin/git", ["init", "-q", f.config.locations["location-a"]],
      { env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", HOME: f.root }, timeout: 5000 });
    assert.equal(initialized.status, 0);
    provider = await f.start();
    assert.equal((await provider.observe("location-a")).code, "identity-unverified");
    assert.equal((await provider.observe("location-b")).code, "identity-unverified");
    await provider.close();
    provider = await separate.start();
    const first = provider.observe("location-b");
    assert.equal((await provider.observe("location-b")).code, "identity-unverified");
    assert.equal((await first).code, "observed");
  } finally {
    await provider?.close();
    await rm(f.root, { recursive: true });
    await rm(separate.root, { recursive: true });
  }
});

test("native auth, current native app roles, physical roots and SQLite compose", async () => {
  const { withMigrationRuntime, runMigrations, closeDbExec } = await import("@agent-native/core/db");
  const { ORG_MIGRATIONS, organizations, orgMembers, setAppMemberRole } = await import("@agent-native/core/org");
  const { addSession, removeSession, awaitBootstrap } = await import("@agent-native/core/server");
  const { H3, toNodeHandler } = await import("h3");
  const { and, eq } = await import("@agent-native/core/db/schema");
  const { getDb } = await import("../server/db/index.mjs");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const tables = await import("../server/db/schema.mjs");
  const { createNativeRegistry, mountNativeRegistry } = await import("../server/native-registry.mjs");
  const f = await fixture();
  let provider;
  let server;
  const email = "actor@example.test";
  const token = randomUUID();
  const grant = { orgId: "org-fixture", collectionId: "collection-fixture", policyRevision: 1,
    locationRefs: ["location-a", "location-b"] };
  const context = { userEmail: email, orgId: grant.orgId, caller: "frontend", appId: "workbench" };
  const request = (patch = {}) => ({ operationId: "operation-a", expectedPolicyRevision: 1,
    expectedRegistryRevision: 0, locationRef: "location-a", displayName: "First real project",
    contentIdentity: null, attachProjectId: null, ...patch });
  const setRole = (role) => setAppMemberRole({ appId: "workbench", orgId: grant.orgId,
    email, role, updatedBy: email });
  const snapshot = async () => ({ projects: await getDb().select().from(tables.projects),
    bindings: await getDb().select().from(tables.bindings),
    receipts: await getDb().select().from(tables.receipts),
    revisions: await getDb().select().from(tables.revisions) });
  try {
    await withMigrationRuntime(async () => {
      await runMigrations(ORG_MIGRATIONS, { table: "native_org_proof_migrations" })();
      await migrateRegistry();
      await addSession(token, email);
    });
    await getDb().insert(organizations).values({ id: grant.orgId, name: "Fixture organization",
      createdBy: email, createdAt: Date.now() });
    await getDb().insert(orgMembers).values({ id: "member-fixture", orgId: grant.orgId,
      email, role: "owner", joinedAt: Date.now() });
    provider = await f.start();
    const runtime = createNativeRegistry({ provider, grant, evaluate: evaluateRegistryOperation });
    await assert.rejects(runtime.registration.run(request(), context), { statusCode: 403 });
    assert.equal((await snapshot()).projects.length, 0, "native org owner is not an assigned app capability");
    await setRole("project-registrar");
    const nitro = { h3: new H3() };
    assert.equal(mountNativeRegistry(nitro).status, "unconfigured");
    assert.equal(mountNativeRegistry(nitro, { provider, grant, evaluate: evaluateRegistryOperation,
      parseStrictJson }).status, "configured");
    await awaitBootstrap(nitro);
    server = createServer(toNodeHandler(nitro.h3));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const call = async (body, identity = true) => {
      const response = await fetch(origin + "/_agent-native/actions/vivary-register-project", {
        method: "POST", headers: { "content-type": "application/json",
          ...(identity ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      const text = await response.text();
      return { status: response.status, body: JSON.parse(text) };
    };
    const one = await call(request());
    assert.equal(one.status, 200);
    assert.equal(one.body.code, "registered");
    const beforeReplay = await snapshot();
    const replay = await call(request());
    assert.deepEqual(replay.body, { ...one.body, replayed: true });
    assert.deepEqual(await snapshot(), beforeReplay);
    const duplicate = await call(request({ operationId: "operation-duplicate", expectedRegistryRevision: 1 }));
    assert.equal(duplicate.body.code, "already-registered");
    const two = await call(request({ operationId: "operation-b", locationRef: "location-b",
      expectedRegistryRevision: 2, displayName: "Second real project" }));
    assert.equal(two.body.code, "registered");
    const registered = await snapshot();
    assert.equal(registered.projects.length, 2);
    assert.equal(new Set(registered.bindings.map((row) => row.rootId)).size, 2);
    assert.ok(registered.bindings.every((row) => /^root_[0-9a-f]{32}$/.test(row.rootId)
      && row.vcsKind === "none" && row.repositoryId === null));
    for (const [ref, location] of Object.entries(f.config.locations)) {
      assert.deepEqual(await readdir(location), ["document.txt"]);
      assert.equal(await readFile(path.join(location, "document.txt"), "utf8"), ref + " original\n");
    }
    await setRole(null);
    assert.equal((await call(request())).status, 403);
    assert.deepEqual(await snapshot(), registered);
    await setRole("project-registrar");
    let removed = false;
    const revoking = createNativeRegistry({ provider: { ...provider, observe: async (ref) => {
      const observed = await provider.observe(ref);
      if (!removed) { removed = true; await setRole(null); }
      return observed;
    } }, grant, evaluate: evaluateRegistryOperation });
    assert.equal((await revoking.registration.run(request(), context)).code, "denied");
    assert.deepEqual(await snapshot(), registered);
    await setRole("project-registrar");
    await getDb().delete(orgMembers).where(and(eq(orgMembers.orgId, grant.orgId), eq(orgMembers.email, email)));
    await assert.rejects(runtime.registration.run(request(), context), { statusCode: 403 });
    assert.deepEqual(await snapshot(), registered);
    await getDb().insert(orgMembers).values({ id: "member-fixture", orgId: grant.orgId,
      email, role: "member", joinedAt: Date.now() });
    await rename(f.config.locations["location-a"], path.join(f.config.scope, "moved"));
    await mkdir(f.config.locations["location-a"]);
    assert.equal((await runtime.registration.run(request(), context)).code, "identity-unverified");
    assert.deepEqual(await snapshot(), registered);
    await provider.close();
    provider = await f.start();
    const restarted = createNativeRegistry({ provider, grant, evaluate: evaluateRegistryOperation });
    assert.equal((await restarted.registration.run(request(), context)).code, "identity-unverified");
    assert.deepEqual(await snapshot(), registered);
    await removeSession(token);
    const unauthenticated = await call(request());
    assert.equal(unauthenticated.status, 404, "known native exception adapter returns fallthrough for unauthenticated requests");
    assert.deepEqual(await snapshot(), registered);
  } finally {
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    await provider?.close();
    closeDbExec();
    await rm(f.root, { recursive: true });
  }
});
