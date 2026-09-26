import assert from "node:assert/strict";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";
import { pathToFileURL } from "node:url";

// The packaged app runs as a production server with no app URL and no A2A_SECRET, so Core cannot
// dispatch Run now back to itself over HTTP. The maintained Core patch lets the server that owns the
// recurring-jobs timer run the queued row in its own process. Core's package entries do not export
// these modules, so load the installed, patched files by path.
const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-automation-run-now-"));
const database = `file:${path.join(caseRoot, "automations.sqlite")}`;
for (const name of ["DEPLOY_PRIME_URL", "DEPLOY_URL", "URL", "APP_URL", "BETTER_AUTH_URL", "A2A_SECRET"]) {
  delete process.env[name]; // guard:allow-env-credential - Removes fixed app URL and signing names. No value is read.
}
Object.assign(process.env, {
  APP_NAME: "Vivary",
  NODE_ENV: "production",
  DATABASE_URL: database,
  DATABASE_URL_UNPOOLED: database,
});

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [runNow, runHistory, { defineAutomation }, { getDbExec }] = await Promise.all([
  load("jobs/run-now.js"),
  load("jobs/run-history.js"),
  load("automations/service.js"),
  load("db/client.js"),
]);
const { queueAutomationRunNow, redispatchUnclaimedAutomationRuns, setInProcessAutomationRunner } = runNow;
const { getAutomationRun, startAutomationRun } = runHistory;

const owner = "owner@example.test";
const appId = "workbench";
const runNowInput = { userEmail: owner, appId, scope: "personal", name: "digest" };

after(async () => {
  setInProcessAutomationRunner?.(null);
  await rm(caseRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  await getDbExec().execute({ sql: "DELETE FROM automation_runs", args: [] }).catch(() => {});
  setInProcessAutomationRunner?.(null);
});

await defineAutomation({ userEmail: owner, appId }, {
  scope: "personal",
  name: "digest",
  body: "Summarize the project in one sentence.",
  triggerType: "schedule",
  schedule: "0 * * * *",
  timezone: "UTC",
});

const queuedRow = async (startedAgoMs, claimedAgoMs = null) => {
  const id = await startAutomationRun({ owner, automation: "digest", path: "jobs/digest.md", scope: "personal", appId, dispatchPending: true });
  await getDbExec().execute({
    sql: "UPDATE automation_runs SET started_at = ?, claimed_at = ? WHERE id = ?",
    args: [Date.now() - startedAgoMs, claimedAgoMs === null ? null : Date.now() - claimedAgoMs, id],
  });
  return id;
};

test("Run now queues the row and hands it to the in-process runner without an app URL", async () => {
  assert.equal(typeof setInProcessAutomationRunner, "function", "Core exports setInProcessAutomationRunner");
  let deliver;
  const delivered = new Promise(resolve => { deliver = resolve; });
  setInProcessAutomationRunner(async id => deliver(id));

  const queued = await queueAutomationRunNow(runNowInput);
  assert.equal(queued.queued, true);
  assert.equal(queued.automationRunId, queued.runId);
  assert.equal(await delivered, queued.runId, "the runner receives the queued run id");
  const row = await getAutomationRun(queued.runId);
  assert.equal(row.status, "running");
  assert.equal(row.automation, "digest");
});

test("without a runner, Run now still needs a self-dispatch URL in production", async () => {
  await assert.rejects(queueAutomationRunNow(runNowInput), /Self-dispatch requires/);
});

test("with a runner, the sweep runs recent unclaimed rows and ends old ones instead of running them late", async () => {
  assert.equal(typeof setInProcessAutomationRunner, "function", "Core exports setInProcessAutomationRunner");
  const received = [];
  setInProcessAutomationRunner(async id => { received.push(id); });
  const hour = 60 * 60_000;
  const recent = await queuedRow(60_000);
  const neverStarted = await queuedRow(hour);
  const stoppedMidRun = await queuedRow(hour, hour - 60_000);

  assert.equal(await redispatchUnclaimedAutomationRuns({ appId }), 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, [recent], "only the recent row reaches the runner");

  const expired = await getAutomationRun(neverStarted);
  assert.equal(expired.status, "error");
  assert.ok(expired.finishedAt);
  assert.match(expired.error, /^Run now did not start within \d+ minutes/);
  assert.match(expired.error, /No delivery was confirmed\.$/);
  assert.equal(expired.errorCode, "automation_run_not_started");

  const interrupted = await getAutomationRun(stoppedMidRun);
  assert.equal(interrupted.status, "error");
  assert.match(interrupted.error, /^The run stopped before it recorded a result/);
  assert.doesNotMatch(interrupted.error, /serverless/);
  assert.equal((await getAutomationRun(recent)).status, "running");
});
