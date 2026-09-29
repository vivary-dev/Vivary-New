// One Vivary server process for automation-quit.test.mjs. The stop is process state, so each quit, hard kill, and
// second process in that test is a separate child. This file loads the installed, patched Core by path against the
// parent's disposable database, plays one role, and reports over IPC. Usage: node <file> <role> <appId>.
import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [role, appId] = process.argv.slice(2);
const owner = "owner@example.test";
const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [scheduler, { startAutomationRun }, { getDbExec }] = await Promise.all([
  load("jobs/scheduler.js"),
  load("jobs/run-history.js"),
  load("db/client.js"),
]);

// The engine reports each run it starts by the automation name in the prompt. A cooperative run ends when its abort
// signal fires, as a real provider request does. A stubborn run never ends, like a tool call that ignores the signal.
const starts = new Map();
const started = name => {
  if (!starts.has(name)) {
    let resolve;
    starts.set(name, { promise: new Promise(done => { resolve = done; }), resolve });
  }
  return starts.get(name);
};
const engine = stubborn => ({
  name: "fake", label: "Fake", defaultModel: "fake-model", supportedModels: ["fake-model"],
  capabilities: { thinking: false, promptCaching: false, vision: false, computerUse: false, parallelToolCalls: false },
  async *stream(options) {
    const prompt = JSON.stringify(options.messages);
    const name = prompt.match(/(?:Recurring Job|Manual Automation Run): ([a-z-]+)/)?.[1] ?? "unknown";
    started(name).resolve(Date.now());
    if (stubborn) await new Promise(() => {});
    await new Promise(resolve => {
      if (options.abortSignal?.aborted) resolve();
      options.abortSignal?.addEventListener("abort", resolve, { once: true });
    });
    const aborted = new Error("The operation was aborted.");
    aborted.name = "AbortError";
    throw aborted;
  },
});
const deps = stubborn => ({ appId, engine: engine(stubborn), model: "fake-model", getActions: () => ({}),
  getSystemPrompt: async () => "" });

const within = (promise, ms, what) => Promise.race([promise, new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`${what} did not happen within ${ms} ms`)), ms).unref();
})]);
const leaseRow = async () => {
  const { rows } = await getDbExec().execute({
    sql: "SELECT lease_owner, lease_expires_at, last_checked_at, updated_at FROM automation_scheduler_health WHERE id = ?",
    args: [`${appId}:global`],
  });
  const row = rows?.[0];
  return row ? {
    leaseOwner: row.lease_owner ?? null,
    leaseExpiresAt: row.lease_expires_at == null ? null : Number(row.lease_expires_at),
    lastCheckedAt: row.last_checked_at == null ? null : Number(row.last_checked_at),
    updatedAt: Number(row.updated_at),
  } : null;
};
const runCount = async () => Number((await getDbExec().execute({
  sql: "SELECT COUNT(*) AS n FROM automation_runs WHERE app_id = ?", args: [appId],
})).rows[0].n);
const queueRunNow = name => startAutomationRun({ owner, automation: name, path: `jobs/${name}.md`, scope: "personal",
  appId, dispatchPending: true });
const stopExported = typeof scheduler.stopRecurringJobs === "function";
const report = message => new Promise(resolve => process.send(message, resolve));

if (role === "quit") {
  // A scheduled run and a Run now are in flight when the owner quits.
  const cooperative = deps(false);
  const manualId = await queueRunNow("manual");
  const settledAt = {};
  const manual = scheduler.runQueuedAutomation(manualId, cooperative).finally(() => { settledAt.manual = Date.now(); });
  const sweep = scheduler.processRecurringJobs(cooperative).finally(() => { settledAt.sweep = Date.now(); });
  await within(Promise.all([started("nightly").promise, started("manual").promise]), 30_000, "both runs starting");
  if (!stopExported) {
    // Today a normal quit does nothing for automations, and the desktop ends the process 15 seconds later.
    await report({ stopExported, manualId });
    process.exit(0);
  }
  const quitAt = Date.now();
  await scheduler.stopRecurringJobs({ timeoutMs: 10_000 });
  const stoppedAt = Date.now();
  const outcomes = await Promise.allSettled([sweep, manual]);
  // After the stop, a timer tick and a Run now delivery start nothing.
  const leaseBefore = await leaseRow();
  const runsBefore = await runCount();
  await scheduler.processRecurringJobs(cooperative);
  const leaseAfter = await leaseRow();
  const runsAfter = await runCount();
  const lateId = await queueRunNow("manual");
  const late = await scheduler.runQueuedAutomation(lateId, cooperative);
  await report({ stopExported, manualId, lateId, late, quitAt, stoppedAt, settledAt,
    outcomes: outcomes.map(outcome => outcome.status), leaseBefore, leaseAfter, runsBefore, runsAfter });
  process.exit(0);
} else if (role === "hold") {
  // A process that holds the scheduler lease in a long run, until the parent ends it.
  const sweep = scheduler.processRecurringJobs(deps(false));
  void sweep.catch(() => {});
  const name = await within(new Promise(resolve => {
    const poll = setInterval(() => {
      const first = [...starts.keys()][0];
      if (first) { clearInterval(poll); resolve(first); }
    }, 20);
  }), 30_000, "a run starting");
  await report({ running: name, lease: await leaseRow() });
} else if (role === "stop-only") {
  // A second process on the same database: its tick finds the lease taken, then it quits.
  await scheduler.processRecurringJobs(deps(false));
  if (stopExported) await scheduler.stopRecurringJobs({ timeoutMs: 2_000 });
  await report({ stopExported });
  process.exit(0);
} else if (role === "stubborn") {
  // A run that ignores its abort signal holds the stop only until the bound.
  void scheduler.processRecurringJobs(deps(true)).catch(() => {});
  await within(started("stuck").promise, 30_000, "the run starting");
  if (!stopExported) {
    await report({ stopExported });
    process.exit(0);
  }
  const quitAt = Date.now();
  await scheduler.stopRecurringJobs({ timeoutMs: 1_000 });
  const elapsedMs = Date.now() - quitAt;
  const { rows } = await getDbExec().execute({
    sql: "SELECT status FROM automation_runs WHERE app_id = ? AND automation = 'stuck'", args: [appId],
  });
  await report({ stopExported, elapsedMs, statuses: rows.map(row => row.status), lease: await leaseRow() });
  process.exit(0);
} else {
  throw new Error(`Unknown role ${role}`);
}
