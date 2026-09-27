import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

import { executeVivaryCodeWorker, linuxProcStatIsLiveGroupMember, waitForLinuxWorkerGroupExit,
  VivaryCodeWorkerCleanupError } from "../server/code-execution-host.ts";
import { isVivaryCodeWorkerRequest } from "../server/code-execution-protocol.ts";
import { credentialFingerprints } from "../server/credential-redaction.ts";
import { isCredentialName } from "../server/local-runtime-setup.ts";

const request = {
  type: "vivary:code-worker:start", runId: "vivary-local-code-test",
  prompt: "Read the project note.", ownerEmail: "owner@local.vivary.test", redaction: credentialFingerprints(),
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

test("Linux worker cleanup waits until every observed group member has stopped", async () => {
  const observations = [true, false, true, false, false];
  const checked: number[] = [];
  await waitForLinuxWorkerGroupExit(12345, async groupId => {
    checked.push(groupId);
    return observations.shift() ?? false;
  });
  assert.deepEqual(checked, [12345, 12345, 12345, 12345, 12345]);
});

test("Linux group observation ignores valid kernel pgrp zero and refuses malformed state", async () => {
  assert.equal(linuxProcStatIsLiveGroupMember("42 (kernel worker) S 2 0 0 0", 12345), false);
  assert.equal(linuxProcStatIsLiveGroupMember("43 (child) S 2 12345 0 0", 12345), true);
  assert.equal(linuxProcStatIsLiveGroupMember("43 (child) Z 2 12345 0 0", 12345), false);
  assert.throws(() => linuxProcStatIsLiveGroupMember("malformed", 12345), VivaryCodeWorkerCleanupError);
  await assert.rejects(waitForLinuxWorkerGroupExit(
    12345, () => new Promise<boolean>(() => {}), 10), VivaryCodeWorkerCleanupError);
});

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

test("the coding worker starts without any credential-shaped name in its environment", { timeout: 12_000 }, async () => {
  const originalCwd = process.cwd();
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-worker-environment-"));
  const server = path.join(fixture, ".output", "server");
  const names = path.join(fixture, "names.json");
  await mkdir(server, { recursive: true });
  // Issue #98. On Linux a child reads its parent's start environment, as a command in a coding run could.
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const readParent = "const entries = require('node:fs').readFileSync('/proc/' + process.ppid + '/environ', 'utf8');"
  + "process.stdout.write(JSON.stringify(entries.split(String.fromCharCode(0)).filter(Boolean)"
  + ".map(entry => entry.slice(0, entry.indexOf('=')))));";
writeFileSync(${JSON.stringify(names)}, process.platform === "linux"
  ? execFileSync(process.execPath, ["-e", readParent], { encoding: "utf8", env: {} })
  : JSON.stringify(Object.keys(process.env)));
process.on("message", message => {
  if (message.type === "vivary:code-worker:start") process.send({ type: "vivary:code-worker:done", runId: message.runId });
});
process.send({ type: "vivary:code-worker:ready" });
`);
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  const credentialName = `VIVARY_PROBE_${suffix}_TOKEN`;
  const controlName = `VIVARY_PROBE_${suffix}_SETTING`;
  const seeded = Object.fromEntries(["BETTER_AUTH_SECRET", "DATABASE_URL", "OPENROUTER_API_KEY", credentialName,
    controlName, "VIVARY_DESKTOP_HOST", "VIVARY_STANDALONE_HOST"].map(name => [name, randomBytes(24).toString("hex")]));
  const previous = { ...process.env };
  try {
    Object.assign(process.env, seeded);
    process.chdir(fixture);
    await executeVivaryCodeWorker({ runId: request.runId, prompt: "report the start environment",
      ownerEmail: request.ownerEmail, signal: new AbortController().signal });
    const started: string[] = JSON.parse(await readFile(names, "utf8"));
    assert.ok(started.includes(controlName), "an ordinary setting reaches the worker");
    assert.deepEqual(started.filter(name => isCredentialName(name.toUpperCase())), [],
      "credential-shaped names in the worker's start environment");
    assert.deepEqual(started.filter(name => name === "VIVARY_DESKTOP_HOST" || name === "VIVARY_STANDALONE_HOST"), []);
  } finally {
    for (const name of Object.keys(seeded)) {
      // guard:allow-env-credential - Removes a random test setting seeded above.
      if (previous[name] === undefined) delete process.env[name];
      else Object.assign(process.env, { [name]: previous[name] });
    }
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
