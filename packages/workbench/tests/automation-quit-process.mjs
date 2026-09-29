// One Vivary server process for automation-quit.test.mjs. The stop is process state, so each quit, hard kill, and
// second process in that test is a separate child. This file loads the installed, patched Core by path against the
// parent's disposable database, plays one role, and reports over IPC. Usage: node <file> <role> <appId>.
import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [role, appId] = process.argv.slice(2);
// A one-second soft timeout makes a run reach a boundary that ends its turn, as a long run does.
if (role === "soft-cut") process.env.AGENT_RUN_SOFT_TIMEOUT_MS = "1000"; // guard:allow-env-mutation - A test-only timeout in a disposable child.
const owner = "owner@example.test";
const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [scheduler, { claimAutomationRun, startAutomationRun }, { getDbExec }, { getRun }, { withThreadDataLock },
  { initTriggerDispatcher }, { runAutomationWebhookTaskInProcess, webhookTaskBelongsToApp },
  { setInProcessIntegrationTaskRunner }, { emit }] = await Promise.all([
  load("jobs/scheduler.js"),
  load("jobs/run-history.js"),
  load("db/client.js"),
  load("agent/run-manager.js"),
  load("chat-threads/store.js"),
  load("triggers/dispatcher.js"),
  load("integrations/automation-webhook-task.js"),
  load("integrations/integration-durable-dispatch.js"),
  load("event-bus/index.js"),
]);

const gate = () => {
  let open;
  const promise = new Promise(resolve => { open = resolve; });
  return { promise, open };
};
// The engine reports each run it starts by the automation name in the prompt, and by the event id for a trigger run.
// A cooperative run ends when its abort signal fires, as a real provider request does. A stubborn run never ends, like
// a tool call that ignores the signal. A finishing run completes and then holds its thread save, and a soft-cut run
// waits after its abort, so a quit can land in each window.
const starts = new Map();
const started = key => {
  if (!starts.has(key)) starts.set(key, gate());
  return starts.get(key);
};
const runKey = prompt => {
  const name = prompt.match(/(?:Recurring Job|Manual Automation Run|Automation Trigger): ([a-z-]+)/)?.[1] ?? "unknown";
  const eventId = prompt.match(/Event ID: ([a-z0-9-]+)/)?.[1];
  return eventId ? `${name}:${eventId}` : name;
};
const threadSave = gate();
const threadHeld = gate();
const aborted = gate();
const afterAbort = gate();
const historyOf = async name => (await getDbExec().execute({
  sql: "SELECT id, run_id, thread_id FROM automation_runs WHERE app_id = ? AND automation = ? ORDER BY started_at DESC",
  args: [appId, name],
})).rows[0];
const engine = mode => ({
  name: "fake", label: "Fake", defaultModel: "fake-model", supportedModels: ["fake-model"],
  capabilities: { thinking: false, promptCaching: false, vision: false, computerUse: false, parallelToolCalls: false },
  async *stream(options) {
    const key = runKey(JSON.stringify(options.messages));
    started(key).open(Date.now());
    if (mode === "stubborn") await new Promise(() => {});
    if (mode === "finishing") {
      // Hold this run's thread save, which its completion callback waits for.
      const history = await historyOf(key);
      void withThreadDataLock(history.thread_id, () => threadSave.promise);
      threadHeld.open(history.run_id);
      yield { type: "assistant-content", parts: [{ type: "text", text: "Done." }] };
      yield { type: "stop", reason: "end_turn" };
      return;
    }
    await new Promise(resolve => {
      if (options.abortSignal?.aborted) resolve();
      options.abortSignal?.addEventListener("abort", resolve, { once: true });
    });
    if (mode === "soft-cut") {
      aborted.open();
      await afterAbort.promise;
    }
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  },
});
const deps = (mode, extra = {}) => ({ appId, engine: engine(mode), model: "fake-model", getActions: () => ({}),
  getSystemPrompt: async () => "", ...extra });
// Event runs need a key for the condition check, even without a condition. A synthetic value, never sent anywhere.
const triggerDeps = mode => deps(mode, { apiKey: "synthetic-condition-key" });
const registerWebhookRunner = () => setInProcessIntegrationTaskRunner(runAutomationWebhookTaskInProcess,
  { platforms: ["automation-webhook"], appId, acceptsTask: webhookTaskBelongsToApp });

const within = (promise, ms, what) => Promise.race([promise, new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`${what} did not happen within ${ms} ms`)), ms).unref();
})]);
const until = async (check, ms, what) => {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`${what} did not happen within ${ms} ms`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const leaseRow = async () => {
  const { rows } = await getDbExec().execute({
    sql: "SELECT lease_owner, lease_expires_at, last_checked_at, last_dispatched_at, updated_at FROM automation_scheduler_health WHERE id = ?",
    args: [`${appId}:global`],
  });
  const row = rows?.[0];
  return row ? {
    leaseOwner: row.lease_owner ?? null,
    leaseExpiresAt: row.lease_expires_at == null ? null : Number(row.lease_expires_at),
    lastCheckedAt: row.last_checked_at == null ? null : Number(row.last_checked_at),
    lastDispatchedAt: row.last_dispatched_at == null ? null : Number(row.last_dispatched_at),
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
  const cooperative = deps("cooperative");
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
} else if (role === "trigger-quit") {
  // An event run and a webhook call A are in flight, and call B waits behind A, when the owner quits. The process
  // then exits as soon as the stop returns, as the CLI host does, so only writes the stop waited for are kept.
  await initTriggerDispatcher(triggerDeps("cooperative"));
  registerWebhookRunner();
  emit("test.event.fired", { data: { id: "evt-watch" } }, { owner, eventId: "evt-watch" });
  void runAutomationWebhookTaskInProcess("task-a", { appId });
  await within(Promise.all([started("watcher:evt-watch").promise, started("hook:evt-a").promise]), 30_000,
    "the event run and webhook call A starting");
  await report({ ready: true });
  await scheduler.stopRecurringJobs({ timeoutMs: 10_000 });
  process.exit(0);
} else if (role === "event-quit") {
  // Only an event run is in flight when the owner quits, so no other work holds the stop open for its write.
  await initTriggerDispatcher(triggerDeps("cooperative"));
  emit("test.event.fired", { data: { id: "evt-solo" } }, { owner, eventId: "evt-solo" });
  await within(started("solo:evt-solo").promise, 30_000, "the event run starting");
  await report({ ready: true });
  await scheduler.stopRecurringJobs({ timeoutMs: 10_000 });
  process.exit(0);
} else if (role === "late") {
  // Work that arrives while the process stops: a sweep scanning when the stop begins, then an event, a direct Run
  // now, a Run now whose row was claimed before the stop, and a queued webhook call.
  await initTriggerDispatcher(triggerDeps("cooperative"));
  registerWebhookRunner();
  const cooperative = deps("cooperative");
  const claimedId = await queueRunNow("late-claimed");
  const claimed = await claimAutomationRun(claimedId);
  const sweep = scheduler.processRecurringJobs(cooperative);
  const first = scheduler.stopRecurringJobs({ timeoutMs: 10_000 });
  const second = scheduler.stopRecurringJobs({ timeoutMs: 1 });
  await first;
  await sweep;
  emit("test.event.fired", { data: { id: "evt-late" } }, { owner, eventId: "evt-late" });
  const runNow = await scheduler.runJobNow(owner, "late-job", cooperative);
  const claimedRun = await scheduler.runJobNow(owner, "late-claimed", cooperative, { historyId: claimedId });
  const webhook = await runAutomationWebhookTaskInProcess("task-late", { appId });
  // An event handler is not awaited by its emitter. Give a dispatch time to write before reading.
  await new Promise(resolve => setTimeout(resolve, 1_000));
  await report({ sameStop: first === second, claimed, claimedId, runNow, claimedRun, webhook,
    starts: [...starts.keys()], lease: await leaseRow() });
  process.exit(0);
} else if (role === "setup") {
  // The stop begins while a scheduled run is still preparing, before it reaches the run manager.
  const systemPrompt = gate();
  const preparing = gate();
  const sweep = scheduler.processRecurringJobs(deps("cooperative", {
    getSystemPrompt: () => { preparing.open(); return systemPrompt.promise.then(() => ""); },
  }));
  await within(preparing.promise, 30_000, "the run preparing");
  const stop = scheduler.stopRecurringJobs({ timeoutMs: 3_000 });
  systemPrompt.open();
  const quitAt = Date.now();
  await stop;
  const elapsedMs = Date.now() - quitAt;
  // A run that reached the model is never aborted here, so do not wait on its sweep for long.
  await Promise.race([sweep.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000).unref())]);
  await report({ elapsedMs, starts: [...starts.keys()], lease: await leaseRow() });
  process.exit(0);
} else if (role === "finishing") {
  // The stop begins after a run completed, while its completion callback waits for the thread save.
  const sweep = scheduler.processRecurringJobs(deps("finishing"));
  const runId = await within(threadHeld.promise, 30_000, "the run finishing");
  await until(() => getRun(runId)?.status === "completed", 10_000, "the run completing");
  const stop = scheduler.stopRecurringJobs({ timeoutMs: 10_000 });
  threadSave.open();
  await stop;
  await sweep.catch(() => {});
  await report({ runId });
  process.exit(0);
} else if (role === "soft-cut") {
  // The stop begins after a soft-timeout boundary ended the run's turn, before its engine call returned.
  const sweep = scheduler.processRecurringJobs(deps("soft-cut"));
  await within(aborted.promise, 30_000, "the soft-timeout boundary");
  const { run_id: runId } = await historyOf("soft");
  const statusAtQuit = getRun(runId)?.status;
  const stop = scheduler.stopRecurringJobs({ timeoutMs: 10_000 });
  afterAbort.open();
  await stop;
  await sweep.catch(() => {});
  await report({ runId, statusAtQuit });
  process.exit(0);
} else if (role === "hold") {
  // A process that holds the scheduler lease in a long run, until the parent ends it.
  const sweep = scheduler.processRecurringJobs(deps("cooperative"));
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
  await scheduler.processRecurringJobs(deps("cooperative"));
  if (stopExported) await scheduler.stopRecurringJobs({ timeoutMs: 2_000 });
  await report({ stopExported });
  process.exit(0);
} else if (role === "stubborn") {
  // A run that ignores its abort signal holds the stop only until the bound.
  void scheduler.processRecurringJobs(deps("stubborn")).catch(() => {});
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
