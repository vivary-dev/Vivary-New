import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  createCodeAgentRunRecord,
  getCodeAgentRunRecord,
  listCodeAgentTranscriptEvents,
} from "@agent-native/core/code-agents";

import { CLEANUP_TIMEOUT_MS, STARTUP_TIMEOUT_MS, TERMINATION_GRACE_MS } from "../server/code-execution-host.ts";

// Issue #121. The code host keeps process-global state and loads persisted refusals once, when it first initializes, so
// this file runs in its own process like local-code-approval-restart.test.ts, and its tests run in order. Every record,
// process name, and address here is synthetic. The fakes are shell scripts and the targets are Linux process groups.
const linuxOnly = { skip: process.platform !== "linux" };
const WORKER_TEST_TIMEOUT_MS = STARTUP_TIMEOUT_MS + TERMINATION_GRACE_MS + CLEANUP_TIMEOUT_MS + 10_000;
const OWNER = "owner@example.test";
const OWNER_CONTEXT = { caller: "frontend", userEmail: OWNER } as const;
const SYSTEM_ROW = "4\t0\t\tSystem\r\n";

const fixture = await mkdtemp(path.join(os.tmpdir(), "vivary-code-cleanup-"));
const projectRoot = path.join(fixture, "project");
const bin = path.join(fixture, "bin");
const scanner = path.join(fixture, "System32", "WindowsPowerShell", "v1.0");
const scanRows = path.join(fixture, "scan-rows.txt");
const scanFails = path.join(fixture, "scan-fails");
const leaveChild = path.join(fixture, "leave-child");
const workerRecord = path.join(fixture, "worker.txt");
await mkdir(path.join(fixture, ".output", "server"), { recursive: true });
await mkdir(projectRoot);
await mkdir(bin);
await mkdir(scanner, { recursive: true });
await writeFile(path.join(bin, "claude"), `#!/usr/bin/env node
if (JSON.stringify(process.argv.slice(2)) !== '["auth","status","--json"]') process.exit(2);
process.stdout.write('{"loggedIn":true}');
`, { mode: 0o755 });
// The runtime lookup adds `.exe` while the platform reads as Windows.
await copyFile(path.join(bin, "claude"), path.join(bin, "claude.exe"));
// A run whose prompt asks for it exits after it receives its run, like a worker that died on its own.
await writeFile(path.join(fixture, ".output", "server", "vivary-code-worker.mjs"), `
import { writeFileSync } from "node:fs";
process.on("message", message => {
  if (message.type !== "vivary:code-worker:start") return;
  if (message.prompt === "exit after its run") {
    writeFileSync(${JSON.stringify(workerRecord)}, process.pid + "\\t" + Date.now());
    process.exit(0);
  }
  process.send({ type: "vivary:code-worker:done", runId: message.runId });
});
process.send({ type: "vivary:code-worker:ready" });
`);
// Answers the Windows process scan from a file, and names a child of the worker created while it ran.
await writeFile(path.join(scanner, "powershell.exe"), `#!/bin/sh
[ -f ${JSON.stringify(scanFails)} ] && exit 1
cat ${JSON.stringify(scanRows)}
if [ -f ${JSON.stringify(leaveChild)} ]; then
  printf '4242\\t%s\\tcodex.exe\\r\\n' "$(cat ${JSON.stringify(workerRecord)})"
fi
`, { mode: 0o755 });
await writeFile(scanRows, SYSTEM_ROW);

const saved = new Map<string, string | undefined>();
function useSetting(name: string, value: string): void {
  // guard:allow-env-credential - Saves a synthetic test setting's previous value, restored after this file.
  saved.set(name, process.env[name]);
  // guard:allow-env-credential - Isolated synthetic test configuration, restored after this file.
  process.env[name] = value;
}
useSetting("AGENT_NATIVE_CODE_AGENTS_HOME", path.join(fixture, "runs"));
useSetting("DATABASE_URL", "file:" + path.join(fixture, "state.sqlite"));
useSetting("VIVARY_LOCAL_AGENT_WORKSPACE", projectRoot);
useSetting("VIVARY_ACCESS_MODE", "local");
// guard:allow-env-credential - The fake runtime directory goes first on the existing search path.
useSetting("PATH", bin + path.delimiter + (process.env.PATH ?? ""));
useSetting("SystemRoot", fixture);
const originalCwd = process.cwd();
process.chdir(fixture);
after(async () => {
  process.chdir(originalCwd);
  for (const [name, value] of saved) {
    // guard:allow-env-credential - Restores a synthetic test setting, or its absence.
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  await rm(fixture, { recursive: true, force: true });
});

const workspace = { root: projectRoot, label: "Cleanup project" };
const runMetadata = { app: "vivary-workbench-local-code", engine: "claude-cli", model: "sonnet", ownerEmail: OWNER,
  workspaceRoot: projectRoot };

function seedRun(id: string, metadata: Record<string, unknown>) {
  return createCodeAgentRunRecord({ id, goalId: "vivary-local-code", title: `Leftovers from ${id}`, status: "errored",
    phase: "cleanup-unverified", cwd: projectRoot, metadata: { ...runMetadata, ...metadata } });
}

function seedRefusal(id: string, target: unknown, refusedAt = new Date().toISOString()) {
  return seedRun(id, { cleanupRefusal: { target, remaining: [], hidden: false, scan: "done", step: "group", refusedAt,
    checkedAt: refusedAt } });
}

async function bootId(): Promise<string> {
  return (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
}

/** A PID that no process uses as a group id now: a short process that already exited and was reaped. */
async function emptiedGroup(): Promise<number> {
  const child = spawn("true", [], { detached: true, stdio: "ignore" });
  await once(child, "exit");
  return child.pid!;
}

function metadataOf(id: string): Record<string, unknown> {
  return getCodeAgentRunRecord(id)?.metadata ?? {};
}

function lastStatus(id: string): string | undefined {
  return listCodeAgentTranscriptEvents(id).findLast(event => event.kind === "status")?.message;
}

function hostSlots(): { activeRuns: Map<string, { execution: Promise<void> | null }> } {
  return Reflect.get(globalThis, Symbol.for("vivary.workbench.code-host"));
}

async function waitFor<T>(read: () => T | undefined, signal: AbortSignal): Promise<T> {
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    await delay(20, undefined, { signal });
  }
}

// Runs the Windows cleanup branch on this host. Only the platform name changes.
async function asWindows<T>(run: () => Promise<T>): Promise<T> {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  assert.ok(platform, "process.platform is an own property");
  Object.defineProperty(process, "platform", { ...platform, value: "win32" });
  try { return await run(); } finally { Object.defineProperty(process, "platform", platform); }
}

// Both seeded before the host first initializes: an older refusal whose group is already empty, and a marker from
// before part B that names nothing.
const emptied = linuxOnly.skip ? 0 : await emptiedGroup();
if (!linuxOnly.skip) {
  seedRefusal("emptied-at-start", { platform: "linux", groupId: emptied, bootId: await bootId() }, "2026-09-28T10:00:00.000Z");
  seedRun("legacy-marker", { cleanupUnverified: true });
}
const agent = await import("../server/local-code-agent.ts");

function send(message: string) {
  return agent.sendVivaryCodeMessage({ ownerEmail: OWNER, message, engine: "claude-cli", model: "sonnet", workspace });
}

async function sendAndSettle(message: string): Promise<string> {
  const state = await send(message);
  const runId = state.run!.id;
  // A fixture run can finish before the send returns, so the run's own transcript shows that it started.
  assert.ok(listCodeAgentTranscriptEvents(runId).some(event => event.kind === "user" && event.message === message));
  await hostSlots().activeRuns.get(runId)?.execution;
  return runId;
}

async function continueAnyway() {
  const { default: cleanupAction } = await import("../actions/vivary-code-cleanup.ts");
  return cleanupAction.run({ decision: "continue" }, OWNER_CONTEXT);
}

test("host start lifts a refusal whose group already emptied without a send, and keeps one it cannot check", {
  ...linuxOnly, timeout: 10_000,
}, async t => {
  await agent.initializeVivaryCodeAgent();
  const lift = await waitFor(() => metadataOf("emptied-at-start").cleanupLifted, t.signal);
  assert.equal((lift as { how?: string }).how, "rechecked");
  assert.equal("cleanupRefusal" in metadataOf("emptied-at-start"), false);
  assert.equal(lastStatus("emptied-at-start"), "The leftover coding processes are gone. Vivary accepts new messages again.");

  const host = await agent.getVivaryCodeHostState(OWNER);
  assert.deepEqual(host.cleanup, {
    heading: "Vivary could not confirm that an earlier run's coding processes stopped",
    instruction: "This run ended before Vivary recorded which processes it started. End any codex, claude, or node "
      + "processes left from it in your process list, then choose Continue anyway.",
    remaining: [], canEnd: false, checking: false,
    run: { id: "legacy-marker", title: "Leftovers from legacy-marker", projectId: null },
  });
  assert.equal((await agent.getVivaryCodeHostState("someone-else@example.test")).cleanup?.run, null,
    "another user sees the refusal but not the run");
  await assert.rejects(send("Start while refused"), (error: Error & { errorCode?: string; statusCode?: number }) => {
    assert.equal(error.errorCode, "vivary_code_cleanup_required");
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /^Vivary could not confirm that an earlier run's coding processes stopped\. /);
    return true;
  });
});

test("Continue anyway lifts a refusal Vivary cannot check, records who chose it, and the next send starts", {
  ...linuxOnly, timeout: WORKER_TEST_TIMEOUT_MS,
}, async () => {
  const state = await continueAnyway();
  assert.equal(state.cleanup, null);
  const metadata = metadataOf("legacy-marker");
  assert.equal("cleanupUnverified" in metadata, false);
  assert.equal("cleanupRefusal" in metadata, false);
  const lift = metadata.cleanupLifted as Record<string, unknown>;
  assert.equal(typeof lift.confirmedAt, "string");
  assert.deepEqual({ ...lift, confirmedAt: "" }, { how: "owner-confirmed", confirmedAt: "", by: OWNER, remaining: [],
    hidden: false, scan: "not-recorded" });
  assert.equal(lastStatus("legacy-marker"),
    "You chose to continue. Vivary could not check whether this run's coding processes stopped. "
    + "Vivary accepts new messages again.");
  const runId = await sendAndSettle("Start after continuing");
  assert.notEqual(getCodeAgentRunRecord(runId)?.status, "errored");
});

test("a live process group keeps refusing by name, and a send after it stops lifts the refusal", {
  ...linuxOnly, timeout: WORKER_TEST_TIMEOUT_MS,
}, async () => {
  const sleeper = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  const groupId = sleeper.pid!;
  const exited = once(sleeper, "exit");
  try {
    const seeded = seedRefusal("live-group", { platform: "linux", groupId, bootId: await bootId() });
    await agent.recheckVivaryCodeCleanup();
    const host = await agent.getVivaryCodeHostState(OWNER);
    assert.equal(host.cleanup?.heading, "Coding processes from an earlier run are still running");
    assert.deepEqual(host.cleanup?.remaining, [{ pid: groupId, name: "sleep" }]);
    assert.equal(host.cleanup?.canEnd, true);
    const refusal = metadataOf("live-group").cleanupRefusal as { remaining: { pid: number; name: string; start: number }[] };
    assert.deepEqual(refusal.remaining.map(({ pid, name }) => ({ pid, name })), [{ pid: groupId, name: "sleep" }]);
    assert.equal(getCodeAgentRunRecord("live-group")?.updatedAt, seeded.updatedAt, "a check keeps the history order");
    await assert.rejects(send("Start beside the leftover"), (error: Error & { errorCode?: string }) => {
      assert.equal(error.errorCode, "vivary_code_cleanup_required");
      assert.ok(error.message.startsWith(`Coding processes from an earlier run are still running: sleep (PID ${groupId}). `),
        error.message);
      return true;
    });
    process.kill(-groupId, "SIGKILL");
    await exited;
    const runId = await sendAndSettle("Start after it stopped");
    assert.notEqual(getCodeAgentRunRecord(runId)?.status, "errored");
    assert.equal((metadataOf("live-group").cleanupLifted as { how?: string }).how, "rechecked");
    assert.equal(lastStatus("live-group"), "The leftover coding processes are gone. Vivary accepts new messages again.");
  } finally {
    if (sleeper.exitCode === null && sleeper.signalCode === null) process.kill(-groupId, "SIGKILL");
  }
});

test("a Windows target refuses by name, lifts once the scan misses it, and falls back to Continue anyway", {
  ...linuxOnly, timeout: 20_000,
}, async () => {
  const tracked = (pid: number) => ({ platform: "win32", tracked: [{ pid, createdFrom: 1_000, createdTo: 7_000,
    childrenTo: 9_000 }] });
  await writeFile(scanRows, `${SYSTEM_ROW}4120\t880\t2000\tcodex.exe\r\n`);
  seedRefusal("windows-leftover", tracked(4120));
  await agent.recheckVivaryCodeCleanup();
  const host = await agent.getVivaryCodeHostState(OWNER);
  assert.deepEqual(host.cleanup?.remaining, [{ pid: 4120, name: "codex.exe" }]);
  assert.equal(host.cleanup?.canEnd, true);
  await assert.rejects(send("Start beside the leftover"), /still running: codex\.exe \(PID 4120\)\. /);
  await writeFile(scanRows, SYSTEM_ROW);
  await agent.recheckVivaryCodeCleanup();
  assert.equal((metadataOf("windows-leftover").cleanupLifted as { how?: string }).how, "rechecked");
  assert.equal((await agent.getVivaryCodeHostState(OWNER)).cleanup, null);

  seedRefusal("windows-unscanned", tracked(4121));
  await writeFile(scanFails, "");
  try {
    await agent.recheckVivaryCodeCleanup();
    const unscanned = await agent.getVivaryCodeHostState(OWNER);
    assert.equal(unscanned.cleanup?.heading, "Vivary could not confirm that an earlier run's coding processes stopped");
    assert.equal(unscanned.cleanup?.instruction, "Vivary could not list the processes. Check Task Manager for codex, "
      + "claude, or node processes from that run and end them, then choose Continue anyway.");
    assert.equal(unscanned.cleanup?.canEnd, false);
    assert.equal((metadataOf("windows-unscanned").cleanupRefusal as { scan?: string }).scan, "unavailable");
    assert.equal((await continueAnyway()).cleanup, null);
    const lift = metadataOf("windows-unscanned").cleanupLifted as Record<string, unknown>;
    assert.equal(lift.how, "owner-confirmed");
    assert.equal(lift.scan, "unavailable");
  } finally {
    await rm(scanFails, { force: true });
  }
});

test("a Windows run whose worker exits after its run records a refusal that names the leftover", {
  ...linuxOnly, timeout: WORKER_TEST_TIMEOUT_MS,
}, async () => {
  await writeFile(leaveChild, "");
  try {
    const runId = await asWindows(() => sendAndSettle("exit after its run"));
    const record = getCodeAgentRunRecord(runId);
    assert.equal(record?.status, "errored");
    assert.equal(record?.phase, "cleanup-unverified");
    assert.equal("cleanupUnverified" in (record?.metadata ?? {}), false);
    const refusal = record?.metadata?.cleanupRefusal as { remaining: { pid: number; name: string }[]; scan: string;
      step: string; target: { platform: string } };
    assert.deepEqual(refusal.remaining.map(({ pid, name }) => ({ pid, name })), [{ pid: 4242, name: "codex.exe" }]);
    assert.equal(refusal.scan, "done");
    assert.equal(refusal.step, "worker-exited");
    assert.equal(refusal.target.platform, "win32");
    assert.equal(lastStatus(runId), "The coding process could not be stopped completely. Still running: codex.exe "
      + "(PID 4242). Choose End them at the top of Vivary to stop these processes. Vivary ends only the processes "
      + "listed here and then checks again.");
    assert.deepEqual((await agent.getVivaryCodeHostState(OWNER)).cleanup?.remaining, [{ pid: 4242, name: "codex.exe" }]);
    await rm(leaveChild);
    await agent.recheckVivaryCodeCleanup();
    assert.equal((metadataOf(runId).cleanupLifted as { how?: string }).how, "rechecked");
  } finally {
    await rm(leaveChild, { force: true });
  }
});

test("shutdown refuses new sends with its own reason, and a check does not lift it", linuxOnly, async () => {
  await agent.shutdownVivaryCodeAgent();
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(send("Start while shutting down"), { errorCode: "vivary_code_host_closing",
      message: "The coding host is shutting down." });
    await agent.recheckVivaryCodeCleanup();
  }
});
