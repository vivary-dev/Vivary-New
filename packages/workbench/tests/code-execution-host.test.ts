import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

import { CLEANUP_TIMEOUT_MS, executeVivaryCodeWorker, linuxProcStatIsLiveGroupMember, linuxWorkerGroupHasLiveMember,
  STARTUP_TIMEOUT_MS, TERMINATION_GRACE_MS, VivaryCodeWorkerCleanupError, waitForLinuxWorkerGroupExit, windowsWorkerStoppedCleanly,
} from "../server/code-execution-host.ts";
import { isVivaryCodeWorkerRequest } from "../server/code-execution-protocol.ts";
import { credentialFingerprints } from "../server/credential-redaction.ts";
import { isCredentialName } from "../server/local-runtime-setup.ts";

const request = {
  type: "vivary:code-worker:start", runId: "vivary-local-code-test",
  prompt: "Read the project note.", ownerEmail: "owner@local.vivary.test", redaction: credentialFingerprints(),
};
// Issue #121. node:test starts the next test without waiting for the body of one that timed out, and that body can
// still hold its fixture as cwd. Every test restores this cwd rather than the one it started in.
const originalCwd = process.cwd();

test("worker protocol has bounded input and no path or credential fields", () => {
  assert.equal(isVivaryCodeWorkerRequest(request), true);
  for (const patch of [
    { runId: "../another-run" }, { prompt: "" }, { prompt: "x".repeat(64_001) },
    { permissionMode: "plan" }, { permissionMode: "full-auto" }, { cwd: "/another-project" }, { apiKey: "not-a-real-key" }, { orgId: "org/other" },
  ]) assert.equal(isVivaryCodeWorkerRequest({ ...request, ...patch }), false);
});

// Issue #121. The calling test's timeout bounds this wait through its signal, so a slow worker start on a loaded
// host is not a failure.
async function waitForPids(file: string, signal: AbortSignal): Promise<{ worker: number; descendant: number }> {
  for (;;) {
    try { return JSON.parse(await readFile(file, "utf8")); } catch { await delay(25, undefined, { signal }); }
  }
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

// Issue #121. On a Linux kernel, reading the `stat` file of a process reaped after the scan opened it fails with
// ESRCH. That process is gone. Any other read error must still fail the stop.
test("Linux group scan counts a process reaped mid-read as gone and refuses other read errors", async () => {
  const procWithStatError = (code: string) => ({
    list: async () => ["self", "42", "43"],
    stat: async (pid: string) => {
      if (pid === "42") throw Object.assign(new Error(`reading /proc/42/stat failed with ${code}`), { code });
      return `${pid} (unrelated) S 1 999 999 0`;
    },
  });
  for (const code of ["ENOENT", "ESRCH"]) {
    assert.equal(await linuxWorkerGroupHasLiveMember(12345, procWithStatError(code)), false, code);
  }
  await assert.rejects(linuxWorkerGroupHasLiveMember(12345, procWithStatError("EACCES")), VivaryCodeWorkerCleanupError);
});

// Issue #121. Each scan advances the mocked clock by a second, so these cases take milliseconds.
test("Linux worker cleanup accepts a group that empties after more than 3 seconds", async t => {
  t.mock.timers.enable({ apis: ["Date"] });
  let scans = 0;
  await waitForLinuxWorkerGroupExit(12345, async () => {
    t.mock.timers.tick(1_000);
    return ++scans <= 5;
  });
  assert.equal(scans, 7, "five scans with live members, then two empty scans");
});

test("Linux worker cleanup trusts an empty scan that finished after the deadline", async t => {
  t.mock.timers.enable({ apis: ["Date"] });
  for (const scanMs of [600, 1_500]) {
    await waitForLinuxWorkerGroupExit(12345, async () => {
      t.mock.timers.tick(scanMs);
      return false;
    }, 1_000);
  }
});

test("Linux worker cleanup refuses a group that stays live for the whole budget", async t => {
  t.mock.timers.enable({ apis: ["Date"] });
  let scans = 0;
  await assert.rejects(waitForLinuxWorkerGroupExit(12345, async () => {
    t.mock.timers.tick(1_000);
    scans++;
    return true;
  }), VivaryCodeWorkerCleanupError);
  assert.equal(scans, CLEANUP_TIMEOUT_MS / 1_000, "every scan inside the budget ran");
});

test("only a Windows worker that exited before its run was sent counts as stopped", () => {
  const cases = [
    { platform: "win32", workerExited: true, runSent: false, clean: true },
    { platform: "win32", workerExited: true, runSent: true, clean: false },
    { platform: "win32", workerExited: false, runSent: false, clean: false },
    { platform: "linux", workerExited: true, runSent: false, clean: false },
  ] as const;
  for (const { clean, ...worker } of cases) assert.equal(windowsWorkerStoppedCleanly(worker), clean, JSON.stringify(worker));
});

// The abort case waits out the grace, and either case can spend the whole cleanup budget. A true cleanup failure
// then reports its own error instead of a test timeout.
test("native-complete and aborted workers stop descendants before settling", {
  timeout: TERMINATION_GRACE_MS + CLEANUP_TIMEOUT_MS + 10_000, skip: process.platform === "win32",
}, async t => {
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
  let controller: AbortController | undefined;
  let execution: Promise<void> | undefined;
  try {
    process.chdir(fixture);
    for (const mode of ["complete", "abort"]) {
      await rm(pids, { force: true });
      controller = new AbortController();
      execution = executeVivaryCodeWorker({
        runId: request.runId, prompt: mode, ownerEmail: request.ownerEmail, signal: controller.signal,
      });
      const identities = await waitForPids(pids, t.signal);
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
    // A wait that the test's timeout ended leaves the detached worker and its descendant running until this stop.
    controller?.abort();
    await execution?.catch(() => undefined);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("the coding worker starts without any credential-shaped name in its environment", { timeout: 12_000 }, async () => {
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

test("a worker that reports ready after a stop request never receives its run", { timeout: 12_000 }, async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-late-ready-"));
  const server = path.join(fixture, ".output", "server");
  const loaded = path.join(fixture, "loaded.json");
  const received = path.join(fixture, "received-run.txt");
  const readySent = path.join(fixture, "ready-sent.txt");
  await mkdir(server, { recursive: true });
  // Issue #117. This worker reports ready only once the host has asked it to stop, like a worker that loads too slowly.
  // It exits after 8 seconds even when the host never stops it, so it cannot outlive the test by more than 8 seconds.
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
import { writeFileSync } from "node:fs";
setTimeout(() => process.exit(0), 8_000).unref();
process.on("message", message => {
  if (message.type === "vivary:code-worker:start") {
    writeFileSync(${JSON.stringify(received)}, "received");
    process.exit(0);
  }
  if (message.type === "vivary:code-worker:abort") {
    writeFileSync(${JSON.stringify(readySent)}, "sent");
    process.send({ type: "vivary:code-worker:ready" });
    setTimeout(() => process.exit(0), 500);
  }
});
writeFileSync(${JSON.stringify(loaded)}, JSON.stringify({ worker: process.pid }));
`);
  try {
    process.chdir(fixture);
    for (const stop of ["startup deadline", "abort"] as const) await t.test(stop, async t => {
      await rm(loaded, { force: true });
      await rm(received, { force: true });
      await rm(readySent, { force: true });
      const controller = new AbortController();
      try {
        if (stop === "startup deadline") t.mock.timers.enable({ apis: ["setTimeout"] });
        const outcome = executeVivaryCodeWorker({ runId: request.runId, prompt: "start late", ownerEmail: request.ownerEmail,
          signal: controller.signal }).then(() => null, (error: unknown) => error);
        const { worker } = await waitForPids(loaded, t.signal);
        if (stop === "startup deadline") {
          t.mock.timers.tick(STARTUP_TIMEOUT_MS);
          t.mock.timers.reset();
        } else {
          controller.abort();
        }
        const error = await outcome;
        await assert.doesNotReject(readFile(readySent), "the worker never sent its late ready");
        assert.equal(await isAlive(worker), false, "the worker was still running after its run settled");
        await assert.rejects(readFile(received), { code: "ENOENT" }, "the worker received its run after the stop request");
        assert.ok(error instanceof Error);
        if (stop === "startup deadline") assert.equal(error.message, `The coding worker did not start within ${STARTUP_TIMEOUT_MS / 1_000} seconds.`);
        else assert.equal(error.name, "AbortError");
      } finally {
        const pid = await readFile(loaded, "utf8").then(text => Number(JSON.parse(text).worker), () => 0);
        if (pid && await isAlive(pid)) {
          try { process.kill(pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
        }
      }
    });
  } finally {
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("worker relays native approvals and remains active beyond the former turn deadline", { timeout: 12_000 }, async t => {
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
  let requestArrived: () => void = () => undefined;
  const arrived = new Promise<void>(resolve => { requestArrived = resolve; });
  const received: string[] = [], resolved: string[] = [];
  let finished = false;
  const controller = new AbortController();
  let execution: Promise<void> | undefined;
  try {
    process.chdir(fixture);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    execution = executeVivaryCodeWorker({ runId: request.runId, prompt: "wait for action", ownerEmail: request.ownerEmail,
      signal: controller.signal, permissionMode: "normal",
      onRequest: action => {
        received.push(action.requestId);
        requestArrived();
        return new Promise(resolve => { resolveRequest = resolve; });
      },
      onRequestResolved: id => { resolved.push(id); },
    });
    // Issue #121. The rejection handler keeps a stopped run from replacing this test's own failure.
    void execution.then(() => { finished = true; }, () => undefined);
    // Wait for the request itself, however long the worker takes to start. A run that ends first fails the test, and
    // the test's timeout ends the wait so that `finally` runs.
    await Promise.race([arrived, execution, once(t.signal, "abort")]);
    assert.ok(resolveRequest, "the approval request arrived before the test timed out");
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
    // Restore cwd before anything that waits, since a stop can take the grace plus the cleanup budget.
    process.chdir(originalCwd);
    t.mock.timers.reset();
    controller.abort();
    await execution?.catch(() => undefined);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("a synchronous native-request handler failure stops the worker without escaping IPC", { timeout: 8_000 }, async () => {
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

// Issue #121. Runs the Windows cleanup branch on any host. Only the platform name changes, so the fork, the worker,
// and its exit are real.
async function asWindows<T>(run: () => Promise<T>): Promise<T> {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  assert.ok(platform, "process.platform is an own property");
  Object.defineProperty(process, "platform", { ...platform, value: "win32" });
  try { return await run(); } finally { Object.defineProperty(process, "platform", platform); }
}

test("a Windows worker that exits before it receives its run stops cleanly", { timeout: 12_000 }, async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-early-exit-"));
  const server = path.join(fixture, ".output", "server");
  await mkdir(server, { recursive: true });
  // Like a worker that crashes while it loads, before the host sends its run.
  await writeFile(path.join(server, "vivary-code-worker.mjs"), "process.exit(1);\n");
  try {
    process.chdir(fixture);
    const error = await asWindows(() => executeVivaryCodeWorker({ runId: request.runId, prompt: "never sent",
      ownerEmail: request.ownerEmail, signal: new AbortController().signal }).then(() => null, (failure: unknown) => failure));
    assert.ok(error instanceof Error, "the run reports that its worker ended");
    assert.equal(error instanceof VivaryCodeWorkerCleanupError, false, "a worker that started nothing needs no cleanup");
    assert.match(error.message, /^The coding worker (ended before completing its run|connection closed)\.$/);
  } finally {
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("a Windows worker that reports ready after an abort and then exits stops cleanly", { timeout: 12_000 }, async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-windows-late-ready-"));
  const server = path.join(fixture, ".output", "server");
  const loaded = path.join(fixture, "loaded.json");
  await mkdir(server, { recursive: true });
  // The host withholds the run from a ready that arrives after the abort, so this worker started nothing.
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
import { writeFileSync } from "node:fs";
process.on("message", message => {
  if (message.type !== "vivary:code-worker:abort") return;
  process.send({ type: "vivary:code-worker:ready" });
  setTimeout(() => process.exit(0), 500);
});
writeFileSync(${JSON.stringify(loaded)}, JSON.stringify({ worker: process.pid }));
`);
  try {
    process.chdir(fixture);
    const controller = new AbortController();
    const error = await asWindows(async () => {
      const outcome = executeVivaryCodeWorker({ runId: request.runId, prompt: "start late", ownerEmail: request.ownerEmail,
        signal: controller.signal }).then(() => null, (failure: unknown) => failure);
      await waitForPids(loaded, t.signal);
      controller.abort();
      return outcome;
    });
    assert.ok(error instanceof Error);
    assert.equal(error.name, "AbortError", "a run the host withheld needs no cleanup");
  } finally {
    process.chdir(originalCwd);
    const pid = await readFile(loaded, "utf8").then(text => Number(JSON.parse(text).worker), () => 0);
    if (pid && await isAlive(pid)) {
      try { process.kill(pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    }
    await rm(fixture, { recursive: true, force: true });
  }
});

test("a cleanup failure names its step and does not refuse the next run", { timeout: 12_000 }, async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-cleanup-failure-"));
  const server = path.join(fixture, ".output", "server");
  await mkdir(server, { recursive: true });
  await writeFile(path.join(server, "vivary-code-worker.mjs"), `
process.on("message", message => {
  if (message.type !== "vivary:code-worker:start") return;
  if (message.prompt === "exit after its run") process.exit(0);
  process.send({ type: "vivary:code-worker:done", runId: message.runId });
});
process.send({ type: "vivary:code-worker:ready" });
`);
  try {
    process.chdir(fixture);
    // On Windows, cleanup cannot reach the descendants of a worker that exited after it received its run.
    const failure = await asWindows(() => executeVivaryCodeWorker({ runId: request.runId, prompt: "exit after its run",
      ownerEmail: request.ownerEmail, signal: new AbortController().signal }).then(() => null, (error: unknown) => error));
    await executeVivaryCodeWorker({ runId: request.runId, prompt: "complete", ownerEmail: request.ownerEmail,
      signal: new AbortController().signal });
    assert.ok(failure instanceof VivaryCodeWorkerCleanupError);
    assert.equal(failure.cause?.step, "worker-exited");
  } finally {
    process.chdir(originalCwd);
    await rm(fixture, { recursive: true, force: true });
  }
});
