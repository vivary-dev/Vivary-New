import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Issue #114. A normal quit must end in-flight automation runs as interrupted and release the scheduler lease, and a
// hard kill must keep the lease expiry as the fallback. The stop is process state, so each quitting or killed process
// is a child that runs automation-quit-process.mjs against this file's disposable database. This process plays the
// next launch. Core's package entries do not export the runner internals, so load the installed, patched files by path.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHILD = path.join(HERE, "automation-quit-process.mjs");
const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-automation-quit-"));
const database = `file:${path.join(caseRoot, "automations.sqlite")}`;
for (const name of ["DEPLOY_PRIME_URL", "DEPLOY_URL", "URL", "APP_URL", "BETTER_AUTH_URL", "A2A_SECRET",
  "AGENT_BACKGROUND_RUN_HARD_TIMEOUT_MS"]) {
  delete process.env[name]; // guard:allow-env-credential - Removes app URL, signing, and timeout names. No value is read.
}
// A webhook automation's token is stored as an encrypted app secret, which needs a key in production. The children
// inherit this random, disposable value.
Object.assign(process.env, {
  APP_NAME: "Vivary",
  NODE_ENV: "production",
  DATABASE_URL: database,
  DATABASE_URL_UNPOOLED: database,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
});

// A finished run schedules a five-minute in-memory cleanup. Unref long timers so this file can exit.
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (handler, delay, ...args) => {
  const timer = originalSetTimeout(handler, delay, ...args);
  if ((delay ?? 0) >= 60_000) timer.unref();
  return timer;
};

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [scheduler, runHistory, { defineAutomation }, { getDbExec }, { resourceGetByPath, resourcePut },
  { parseJobResource, patchJobFrontmatterFields }, { initTriggerDispatcher }, webhookTask,
  { setInProcessIntegrationTaskRunner }, { insertPendingTask }, { retryStuckPendingTasks }] = await Promise.all([
  load("jobs/scheduler.js"),
  load("jobs/run-history.js"),
  load("automations/service.js"),
  load("db/client.js"),
  load("resources/store.js"),
  load("jobs/frontmatter.js"),
  load("triggers/dispatcher.js"),
  load("integrations/automation-webhook-task.js"),
  load("integrations/integration-durable-dispatch.js"),
  load("integrations/pending-tasks-store.js"),
  load("integrations/pending-tasks-retry-job.js"),
]);
const { INTERRUPTED_RUN_ERROR_CODE, INTERRUPTED_RUN_MESSAGE, getAutomationRun, listAutomationRuns } = runHistory;

const owner = "owner@example.test";
const children = new Set();

after(async () => {
  for (const child of children) child.kill("SIGKILL");
  setInProcessIntegrationTaskRunner(null);
  globalThis.setTimeout = originalSetTimeout;
  await rm(caseRoot, { recursive: true, force: true });
});

const defineScheduled = (appId, name, schedule = "* * * * *") => defineAutomation({ userEmail: owner, appId }, {
  scope: "personal", name, body: "Summarize the project in one sentence.", triggerType: "schedule", schedule,
  timezone: "UTC",
});
const stored = async name => parseJobResource((await resourceGetByPath(owner, `jobs/${name}.md`)).content).meta;
const makeDue = async name => {
  const resource = await resourceGetByPath(owner, `jobs/${name}.md`);
  await resourcePut(owner, resource.path, patchJobFrontmatterFields(resource.content,
    { nextRun: new Date(Date.now() - 60_000).toISOString() }));
};
const runsOf = (appId, automation) => listAutomationRuns({ owners: [owner], automation, appId, limit: 20 });
const leaseRow = async appId => {
  const { rows } = await getDbExec().execute({
    sql: "SELECT lease_owner, lease_expires_at, last_checked_at FROM automation_scheduler_health WHERE id = ?",
    args: [`${appId}:global`],
  });
  const row = rows?.[0];
  return row ? {
    leaseOwner: row.lease_owner ?? null,
    leaseExpiresAt: row.lease_expires_at == null ? null : Number(row.lease_expires_at),
    lastCheckedAt: row.last_checked_at == null ? null : Number(row.last_checked_at),
  } : null;
};

// Start one child process and resolve with its first report.
function spawnChild(role, appId) {
  const child = fork(CHILD, [role, appId], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  children.add(child);
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  const exited = new Promise(resolve => child.once("exit", () => { children.delete(child); resolve(); }));
  const report = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${role} sent no report within 60 s. ${stderr.slice(-2000)}`)), 60_000);
    child.once("message", message => { clearTimeout(timer); resolve(message); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`${role} exited ${code} without a report. ${stderr.slice(-2000)}`)); });
  });
  return { child, report, exited };
}

// A quick engine for this process, the next launch.
const quickEngine = {
  name: "fake", label: "Fake", defaultModel: "fake-model", supportedModels: ["fake-model"],
  capabilities: { thinking: false, promptCaching: false, vision: false, computerUse: false, parallelToolCalls: false },
  async *stream() {
    yield { type: "assistant-content", parts: [{ type: "text", text: "Done." }] };
    yield { type: "stop", reason: "end_turn" };
  },
};
const nextLaunch = appId => ({ appId, engine: quickEngine, model: "fake-model", getActions: () => ({}),
  getSystemPrompt: async () => "" });

// The quit scenario: a scheduled run of "nightly" and a Run now of "manual" are in flight when the child quits.
await defineScheduled("quit-app", "nightly");
await defineScheduled("quit-app", "second");
await defineScheduled("quit-app", "manual", "0 0 1 1 *");
await makeDue("nightly");
const manualNextRun = (await stored("manual")).nextRun;
let quitting;
const quit = () => {
  quitting ??= (async () => {
    const { report, exited } = spawnChild("quit", "quit-app");
    const result = await report;
    await exited;
    return result;
  })();
  return quitting;
};

test("a quit during a scheduled run marks it interrupted with the honest message", async () => {
  const result = await quit();
  const [row] = await runsOf("quit-app", "nightly");
  assert.equal(row.status, "interrupted", "the run reads interrupted");
  assert.ok(row.finishedAt, "the run has a finish time");
  assert.equal(row.error, INTERRUPTED_RUN_MESSAGE, "the message appears once, whole");
  assert.equal(row.errorCode, INTERRUPTED_RUN_ERROR_CODE);
  const meta = await stored("nightly");
  assert.equal(meta.lastStatus, "error", "the automation is no longer running");
  assert.equal(meta.lastError, INTERRUPTED_RUN_MESSAGE);
  assert.ok(Date.parse(meta.nextRun) > result.quitAt, "the next run is after the quit");
  assert.deepEqual(result.outcomes, ["fulfilled", "fulfilled"]);
  assert.ok(result.settledAt.sweep <= result.stoppedAt && result.settledAt.manual <= result.stoppedAt,
    "the stop waited for both runs to record their outcome");
  assert.ok(result.stoppedAt - result.quitAt < 10_000, "the runs settled inside the bound");
});

test("a quit releases the scheduler lease", async () => {
  await quit();
  const lease = await leaseRow("quit-app");
  assert.equal(lease.leaseOwner, null, "no process holds the lease");
  assert.equal(lease.leaseExpiresAt, null);
});

test("a Run now interrupted by a quit keeps its schedule", async () => {
  const result = await quit();
  const row = await getAutomationRun(result.manualId);
  assert.equal(row.status, "interrupted");
  assert.equal(row.error, INTERRUPTED_RUN_MESSAGE);
  assert.equal(row.errorCode, INTERRUPTED_RUN_ERROR_CODE);
  const meta = await stored("manual");
  assert.equal(meta.lastStatus, "error");
  assert.equal(meta.lastError, INTERRUPTED_RUN_MESSAGE);
  assert.equal(meta.nextRun, manualNextRun, "Run now does not move the next scheduled run");
});

test("after the stop, a timer tick and a Run now delivery start nothing", async () => {
  const result = await quit();
  assert.equal(result.stopExported, true, "Core exports stopRecurringJobs");
  assert.deepEqual(result.leaseAfter, result.leaseBefore, "the tick took no lease and wrote no heartbeat");
  assert.equal(result.runsAfter, result.runsBefore, "the tick started no run");
  assert.deepEqual(result.late, { skipped: true });
  const late = await getAutomationRun(result.lateId);
  assert.equal(late.claimedAt, null, "the queued row is left for the next launch");
  assert.equal(late.status, "running");
});

test("the next launch schedules at its first tick", async () => {
  await quit();
  await makeDue("nightly");
  await makeDue("second");
  await scheduler.processRecurringJobs(nextLaunch("quit-app"));
  const [second] = await runsOf("quit-app", "second");
  assert.equal(second?.status, "success", "the next launch ran a due automation at its first tick");
  const [nightly] = await runsOf("quit-app", "nightly");
  assert.equal(nightly.status, "success", "the interrupted automation runs again when it is due");
});

test("a hard kill keeps the lease until it expires", async () => {
  await defineScheduled("kill-app", "held");
  await defineScheduled("kill-app", "held-second");
  await makeDue("held");
  const { child, report, exited } = spawnChild("hold", "kill-app");
  const { running, lease: held } = await report;
  assert.equal(running, "held");
  assert.ok(held.leaseOwner, "the child holds the lease");
  child.kill("SIGKILL");
  await exited;

  const lease = await leaseRow("kill-app");
  assert.equal(lease.leaseOwner, held.leaseOwner, "the lease still names the killed process");
  assert.equal(lease.leaseExpiresAt, held.leaseExpiresAt);
  const remainingMs = lease.leaseExpiresAt - Date.now();
  assert.ok(remainingMs > 9 * 60_000 && remainingMs <= 10 * 60_000, `the lease expires about 10 minutes out (${remainingMs} ms)`);

  await makeDue("held-second");
  await scheduler.processRecurringJobs(nextLaunch("kill-app"));
  assert.equal((await leaseRow("kill-app")).lastCheckedAt, lease.lastCheckedAt, "the next launch did not scan");
  assert.deepEqual(await runsOf("kill-app", "held-second"), [], "nothing ran while the old lease holds");

  const [row] = await runsOf("kill-app", "held");
  assert.equal(row.status, "running", "the killed run reads running until the liveness ceiling");
  assert.equal(row.finishedAt, null);
  await getDbExec().execute({ sql: "UPDATE automation_runs SET started_at = ? WHERE id = ?",
    args: [Date.now() - 16 * 60_000, row.id] });
  const aged = await getAutomationRun(row.id);
  assert.equal(aged.status, "interrupted", "past the ceiling it reads interrupted");
  assert.equal(aged.error, INTERRUPTED_RUN_MESSAGE);
});

test("a stop in one process leaves another process's lease alone", async () => {
  await defineScheduled("shared-app", "busy");
  await makeDue("busy");
  const holder = spawnChild("hold", "shared-app");
  const { lease: held } = await holder.report;
  assert.ok(held.leaseOwner, "the first process holds the lease");
  const stopper = spawnChild("stop-only", "shared-app");
  const { stopExported } = await stopper.report;
  await stopper.exited;
  assert.equal(stopExported, true, "Core exports stopRecurringJobs");
  const lease = await leaseRow("shared-app");
  assert.equal(lease.leaseOwner, held.leaseOwner, "the lease still names the first process");
  assert.ok(lease.leaseExpiresAt >= held.leaseExpiresAt);
  holder.child.kill("SIGKILL");
  await holder.exited;
});

test("the stop returns at its bound when a run ignores its abort", async () => {
  await defineScheduled("stubborn-app", "stuck");
  await makeDue("stuck");
  const { report, exited } = spawnChild("stubborn", "stubborn-app");
  const result = await report;
  await exited;
  assert.equal(result.stopExported, true, "Core exports stopRecurringJobs");
  assert.ok(result.elapsedMs >= 950 && result.elapsedMs < 3_000, `the stop returned at its 1-second bound (${result.elapsedMs} ms)`);
  assert.deepEqual(result.statuses, ["running"], "a run that did not settle is left for the fallback");
  assert.ok(result.lease.leaseOwner, "its sweep still held the lease, which then expires as after a hard kill");
});

// Trigger runs at quit: an event run and webhook call A are in flight and call B waits behind A. The child exits as
// soon as the stop returns, as the CLI host does, so a write the stop did not wait for is lost.
const PLATFORM = "automation-webhook";
const defineTrigger = (appId, name, fields) => defineAutomation({ userEmail: owner, appId },
  { scope: "personal", name, body: "Summarize the event in one sentence.", ...fields });
const queueWebhookCall = async (name, eventId, id) => {
  const resource = await resourceGetByPath(owner, `jobs/${name}.md`);
  await insertPendingTask({ id, platform: PLATFORM, externalThreadId: `${resource.owner}:${resource.path}`,
    ownerEmail: owner, orgId: null, externalEventKey: `${resource.id}:${eventId}`,
    payload: JSON.stringify({ kind: "automation-webhook", automationId: resource.id, owner: resource.owner,
      path: resource.path, eventId, payload: { id: eventId } }) });
};
const taskRow = async id => (await getDbExec().execute({
  sql: "SELECT id, status, attempts, payload, error_message, created_at, updated_at FROM integration_pending_tasks WHERE id = ?",
  args: [id],
})).rows[0];
const webhookPayload = row => JSON.parse(row.payload);
let triggerQuitting;
const triggerQuit = () => {
  triggerQuitting ??= (async () => {
    await defineTrigger("trigger-app", "hook", { triggerType: "webhook" });
    await defineTrigger("trigger-app", "watcher", { triggerType: "event", event: "test.event.fired" });
    await queueWebhookCall("hook", "evt-a", "task-a");
    await queueWebhookCall("hook", "evt-b", "task-b");
    const { report, exited } = spawnChild("trigger-quit", "trigger-app");
    await report;
    await exited;
  })();
  return triggerQuitting;
};

test("a quit ends an event run as interrupted and records it before the stop returns", async () => {
  await triggerQuit();
  const runs = await runsOf("trigger-app", "watcher");
  assert.deepEqual(runs.map(run => run.status), ["interrupted"], "one run, interrupted");
  assert.equal(runs[0].error, INTERRUPTED_RUN_MESSAGE);
  assert.equal(runs[0].errorCode, INTERRUPTED_RUN_ERROR_CODE);
  const meta = await stored("watcher");
  assert.equal(meta.lastStatus, "error", "the dispatcher recorded the outcome before the process exited");
  assert.match(meta.lastError ?? "", /^The run stopped before it recorded a result/);
});

test("a quit returns an interrupted webhook call and the call behind it to the queue", async () => {
  await triggerQuit();
  const a = await taskRow("task-a");
  const b = await taskRow("task-b");
  assert.equal(a.status, "pending", "the interrupted call is queued again");
  assert.equal(Number(a.attempts), 0, "the quit did not spend an attempt");
  assert.equal(webhookPayload(a).eventId, "evt-a", "its payload is kept");
  assert.equal(a.error_message, INTERRUPTED_RUN_MESSAGE);
  assert.equal(b.status, "pending", "the call behind it was not started");
  assert.equal(Number(b.attempts), 0);
  assert.equal(webhookPayload(b).eventId, "evt-b");
  assert.equal(b.error_message, null);
  const runs = await runsOf("trigger-app", "hook");
  assert.deepEqual(runs.map(run => run.status), ["interrupted"], "one history row, for call A only");

  // The next launch: the retry sweep delivers both calls, A then B, once each.
  const calls = [];
  const triggerEngine = { ...quickEngine, async *stream(options) {
    calls.push(JSON.stringify(options.messages).match(/Event ID: ([a-z0-9-]+)/)?.[1]);
    yield* quickEngine.stream(options);
  } };
  await initTriggerDispatcher({ ...nextLaunch("trigger-app"), engine: triggerEngine, apiKey: "synthetic-condition-key" });
  setInProcessIntegrationTaskRunner(webhookTask.runAutomationWebhookTaskInProcess, { platforms: [PLATFORM],
    appId: "trigger-app", acceptsTask: webhookTask.webhookTaskBelongsToApp,
    expireTask: webhookTask.expireAutomationWebhookTask, maxTaskAgeMs: webhookTask.AUTOMATION_WEBHOOK_MAX_TASK_AGE_MS });
  const agedAt = Date.now() - 90_000;
  for (const [id, at] of [["task-a", agedAt - 1], ["task-b", agedAt]]) {
    await getDbExec().execute({ sql: "UPDATE integration_pending_tasks SET created_at = ?, updated_at = ? WHERE id = ?",
      args: [at, at, id] });
  }
  assert.equal((await retryStuckPendingTasks()).selected, 2, "both calls are due 90 seconds after the quit");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && (await taskRow("task-b")).status !== "completed") {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal((await taskRow("task-a")).status, "completed");
  assert.equal((await taskRow("task-b")).status, "completed");
  assert.deepEqual(calls, ["evt-a", "evt-b"], "A ran, then B, once each");
  assert.deepEqual((await runsOf("trigger-app", "hook")).map(run => run.status), ["success", "success", "interrupted"]);
  assert.equal((await retryStuckPendingTasks()).selected, 0, "a finished call is not delivered again");
  assert.equal(calls.length, 2);
});

// Work that arrives while the process stops starts no run and writes nothing.
let lateStopping;
const lateStop = () => {
  lateStopping ??= (async () => {
    await defineScheduled("late-app", "late-job");
    await defineScheduled("late-app", "late-claimed", "0 0 1 1 *");
    await defineTrigger("late-app", "late-watcher", { triggerType: "event", event: "test.event.fired" });
    await defineTrigger("late-app", "late-hook", { triggerType: "webhook" });
    await queueWebhookCall("late-hook", "evt-late", "task-late");
    await makeDue("late-job");
    const before = { job: await stored("late-job"), claimed: await stored("late-claimed"),
      task: await taskRow("task-late") };
    const { report, exited } = spawnChild("late", "late-app");
    const result = await report;
    await exited;
    return { before, result };
  })();
  return lateStopping;
};

test("a sweep scanning when the stop begins starts nothing, and a second stop returns the first", async () => {
  const { before, result } = await lateStop();
  assert.equal(result.sameStop, true, "a second call returns the first stop");
  assert.equal(result.lease.leaseOwner, null, "the sweep released the lease");
  assert.equal(result.lease.lastDispatchedAt, null, "the sweep dispatched nothing");
  const meta = await stored("late-job");
  assert.equal(meta.nextRun, before.job.nextRun, "the job is still due for the next launch");
  assert.equal(meta.lastStatus, undefined);
});

test("after the stop, an event, a Run now, and a webhook call start no run", async () => {
  const { before, result } = await lateStop();
  assert.deepEqual(result.starts, [], "no run reached the model");
  assert.deepEqual(await runsOf("late-app", "late-watcher"), [], "the event wrote no run");
  assert.equal((await stored("late-watcher")).lastStatus, undefined, "the event automation was not marked running");
  assert.equal(result.runNow.status, "skipped");
  assert.deepEqual(await runsOf("late-app", "late-job"), [], "Run now wrote no run");
  assert.equal((await stored("late-job")).lastStatus, undefined, "Run now did not mark the job running");
  assert.equal(result.webhook, "skipped");
  const task = await taskRow("task-late");
  assert.equal(task.status, "pending", "the webhook call stays queued");
  assert.equal(Number(task.attempts), 0, "it was not claimed");
  assert.equal(task.updated_at, before.task.updated_at);
  assert.deepEqual(await runsOf("late-app", "late-hook"), []);
});

test("a Run now claimed before the stop reads interrupted without starting", async () => {
  const { before, result } = await lateStop();
  assert.equal(result.claimed, true);
  assert.equal(result.claimedRun.status, "skipped");
  const row = await getAutomationRun(result.claimedId);
  assert.equal(row.status, "interrupted");
  assert.equal(row.error, INTERRUPTED_RUN_MESSAGE);
  assert.equal(row.errorCode, INTERRUPTED_RUN_ERROR_CODE);
  assert.equal(row.threadId, null, "no run thread was made");
  const meta = await stored("late-claimed");
  assert.equal(meta.lastStatus, undefined, "the automation was not marked running");
  assert.equal(meta.nextRun, before.claimed.nextRun);
});

test("a run still preparing when the stop begins is interrupted before the model", async () => {
  await defineScheduled("setup-app", "slow-setup");
  await makeDue("slow-setup");
  const { report, exited } = spawnChild("setup", "setup-app");
  const result = await report;
  await exited;
  assert.deepEqual(result.starts, [], "the run never reached the model");
  assert.ok(result.elapsedMs < 3_000, `the stop waited for the run, not its bound (${result.elapsedMs} ms)`);
  const [row] = await runsOf("setup-app", "slow-setup");
  assert.equal(row.status, "interrupted");
  assert.equal(row.error, INTERRUPTED_RUN_MESSAGE);
  assert.equal((await stored("slow-setup")).lastStatus, "error");
  assert.equal(result.lease.leaseOwner, null);
});

test("Vivary's shutdown owner stops automations within the Code host's wait", async () => {
  const lifecycle = await readFile(path.join(HERE, "..", "server", "plugins", "02-local-code-lifecycle.ts"), "utf8");
  assert.match(lifecycle, /import \{ stopRecurringJobs \} from "@agent-native\/core\/jobs";/);
  const stopLocalWork = lifecycle.slice(lifecycle.indexOf("const stopLocalWork"), lifecycle.indexOf("]);"));
  assert.match(stopLocalWork, /stopRecurringJobs\(\{ timeoutMs: 10_000 \}\)/, "stopLocalWork stops automations");
  const codeHost = await readFile(path.join(HERE, "..", "server", "local-code-agent.ts"), "utf8");
  assert.match(codeHost, /const SHUTDOWN_WAIT_MS = 10_000;/, "the bound matches the Code host's shutdown wait");
  const jobs = await import("@agent-native/core/jobs");
  assert.equal(typeof jobs.stopRecurringJobs, "function", "the package entry exports the stop");
  assert.equal(jobs.stopRecurringJobs, scheduler.stopRecurringJobs, "the package entry shares the scheduler's module");
});
