import assert from "node:assert/strict";
import { fork } from "node:child_process";
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
Object.assign(process.env, {
  APP_NAME: "Vivary",
  NODE_ENV: "production",
  DATABASE_URL: database,
  DATABASE_URL_UNPOOLED: database,
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
  { parseJobResource, patchJobFrontmatterFields }] = await Promise.all([
  load("jobs/scheduler.js"),
  load("jobs/run-history.js"),
  load("automations/service.js"),
  load("db/client.js"),
  load("resources/store.js"),
  load("jobs/frontmatter.js"),
]);
const { INTERRUPTED_RUN_ERROR_CODE, INTERRUPTED_RUN_MESSAGE, getAutomationRun, listAutomationRuns } = runHistory;

const owner = "owner@example.test";
const children = new Set();

after(async () => {
  for (const child of children) child.kill("SIGKILL");
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
