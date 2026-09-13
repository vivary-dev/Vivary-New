import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

import { executeVivaryCodeWorker } from "../server/code-execution-host.ts";
import { isVivaryCodeWorkerRequest } from "../server/code-execution-protocol.ts";

const request = {
  type: "vivary:code-worker:start", runId: "vivary-local-code-test",
  prompt: "Read the project note.", ownerEmail: "owner@local.vivary.test",
};

test("worker protocol has bounded input and no path or credential fields", () => {
  assert.equal(isVivaryCodeWorkerRequest(request), true);
  for (const patch of [
    { runId: "../another-run" }, { prompt: "" }, { prompt: "x".repeat(64_001) },
    { cwd: "/another-project" }, { apiKey: "not-a-real-key" }, { orgId: "org/other" },
  ]) assert.equal(isVivaryCodeWorkerRequest({ ...request, ...patch }), false);
});

async function waitForPids(file: string): Promise<{ worker: number; descendant: number }> {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { return JSON.parse(await readFile(file, "utf8")); } catch { await delay(25); }
  }
  throw new Error("The disposable worker did not become ready.");
}

async function isAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      const status = await readFile(`/proc/${pid}/status`, "utf8");
      if (/^State:\s+Z/m.test(status)) return false;
    }
    return true;
  } catch { return false; }
}

test("native-complete and aborted workers stop descendants before settling", { timeout: 12_000, skip: process.platform === "win32" }, async () => {
  const originalCwd = process.cwd();
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-worker-"));
  const server = path.join(fixture, ".output", "server");
  const pids = path.join(fixture, "pids.json");
  await mkdir(server, { recursive: true });
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
process.on("SIGTERM", () => {});
process.on("message", message => {
  if (message.type !== "vivary:code-worker:start") return;
  const descendant = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: "ignore" });
  writeFileSync(${JSON.stringify(pids)}, JSON.stringify({ worker: process.pid, descendant: descendant.pid }));
  if (message.prompt === "complete") setTimeout(() => process.send({type:"vivary:code-worker:done",runId:message.runId}), 80);
});
process.send({type:"vivary:code-worker:ready"});
`);
  try {
    process.chdir(fixture);
    for (const mode of ["complete", "abort"]) {
      await rm(pids, { force: true });
      const controller = new AbortController();
      const execution = executeVivaryCodeWorker({
        runId: request.runId, prompt: mode, ownerEmail: request.ownerEmail, signal: controller.signal,
      });
      const identities = await waitForPids(pids);
      if (mode === "abort") {
        controller.abort();
        await assert.rejects(execution, { name: "AbortError" });
      } else {
        await execution;
      }
      assert.equal(await isAlive(identities.worker), false);
      assert.equal(await isAlive(identities.descendant), false);
    }
    const canceled = new AbortController();
    canceled.abort();
    await assert.rejects(executeVivaryCodeWorker({
      runId: request.runId, prompt: "complete", ownerEmail: request.ownerEmail, signal: canceled.signal,
    }), { name: "AbortError" });
  } finally {
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});
