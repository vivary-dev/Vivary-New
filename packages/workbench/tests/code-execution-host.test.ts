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
    { permissionMode: "plan" }, { permissionMode: "full-auto" }, { cwd: "/another-project" }, { apiKey: "not-a-real-key" }, { orgId: "org/other" },
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


test("worker relays native approvals and remains active beyond the former turn deadline", { timeout: 12_000 }, async t => {
  const originalCwd = process.cwd();
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-request-"));
  const server = path.join(fixture, ".output", "server");
  await mkdir(server, { recursive: true });
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
import {writeFileSync} from "node:fs";
let runId;
process.on("message", message => {
 if(message.type === "vivary:code-worker:start") {
  runId=message.runId;
  const request={requestId:"native-id",method:"item/commandExecution/requestApproval",params:{command:"read fixture"}};
  process.send({type:"vivary:code-worker:request",runId:"foreign-run",request});
  process.send({type:"vivary:code-worker:request",runId,request});
 }
 if(message.type === "vivary:code-worker:response") {
  writeFileSync("response.json",JSON.stringify(message));
  process.send({type:"vivary:code-worker:resolved",runId,requestId:message.requestId});
  process.send({type:"vivary:code-worker:done",runId});
 }
 if(message.type === "vivary:code-worker:abort") writeFileSync("aborted.txt","aborted");
});
process.send({type:"vivary:code-worker:ready"});
`);
  let resolveRequest: ((value: Record<string, unknown>) => void) | undefined;
  const received: string[] = [], resolved: string[] = [];
  let finished = false;
  const controller = new AbortController();
  let execution: Promise<void> | undefined;
  try {
    process.chdir(fixture);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    execution = executeVivaryCodeWorker({ runId: request.runId, prompt: "wait for action", ownerEmail: request.ownerEmail,
      signal: controller.signal, permissionMode: "normal",
      onRequest: action => { received.push(action.requestId); return new Promise(resolve => { resolveRequest = resolve; }); },
      onRequestResolved: id => { resolved.push(id); },
    });
    void execution.then(() => { finished = true; });
    for (let attempt = 0; !resolveRequest && attempt < 100; attempt++) await delay(20);
    assert.ok(resolveRequest);
    t.mock.timers.tick(120_001);
    await delay(20);
    assert.equal(finished, false);
    await assert.rejects(readFile(path.join(fixture, "aborted.txt")), { code: "ENOENT" });
    assert.deepEqual(received, ["native-id"]);
    t.mock.timers.reset();
    resolveRequest({ decision: "decline" });
    await execution;
    assert.deepEqual(resolved, ["native-id"]);
    assert.deepEqual(JSON.parse(await readFile(path.join(fixture, "response.json"), "utf8")),
      { type: "vivary:code-worker:response", requestId: "native-id", result: { decision: "decline" } });
  } finally {
    t.mock.timers.reset();
    controller.abort();
    await execution?.catch(() => undefined);
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("a synchronous native-request handler failure stops the worker without escaping IPC", { timeout: 8_000 }, async () => {
  const originalCwd = process.cwd();
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-request-error-"));
  const server = path.join(fixture, ".output", "server");
  await mkdir(server, { recursive: true });
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
process.on("message", message => {
 if(message.type === "vivary:code-worker:start") process.send({type:"vivary:code-worker:request",runId:message.runId,
 request:{requestId:"native-id",method:"unsupported",params:{}}});
});
process.send({type:"vivary:code-worker:ready"});
`);
  try {
    process.chdir(fixture);
    await assert.rejects(executeVivaryCodeWorker({ runId: request.runId, prompt: "invalid interaction", ownerEmail: request.ownerEmail,
      signal: new AbortController().signal, onRequest: () => { throw new Error("Unsupported native method"); } }),
      /approval request could not be handled/);
  } finally {
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});
