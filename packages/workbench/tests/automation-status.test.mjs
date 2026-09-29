import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

// Issue #115. Settings > Agent > Automations is Core's page, so these cases load the installed, patched Core files
// by path. The list actions run against a disposable SQLite database, and the Details dialog is bundled and rendered.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKBENCH = path.resolve(HERE, "..");
const CORE = path.dirname(realpathSync(path.join(WORKBENCH, "node_modules", "@agent-native", "core", "package.json")));
const CLIENT = path.join(CORE, "dist", "client");

const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-automation-status-"));
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

const load = relative => import(pathToFileURL(path.join(CORE, "dist", relative)).href);
const [{ defineAutomation, updateAutomation }, { recordAutomationSchedulerHealth }, { resourceGetByPath, resourcePut },
  { buildJobResourceContent, patchJobFrontmatterFields }, { INTERRUPTED_RUN_MESSAGE }, listAutomations,
  listRecurringJobs, { getDbExec }] = await Promise.all([
  load("automations/service.js"),
  load("jobs/scheduler-health.js"),
  load("resources/store.js"),
  load("jobs/frontmatter.js"),
  load("jobs/run-history.js"),
  load("triggers/actions/list-automations.js"),
  load("jobs/actions/list-recurring-jobs.js"),
  load("db/client.js"),
]);

const owner = "owner@example.test";
const appId = "status-app";
const actor = { userEmail: owner, appId };
const ctx = { userEmail: owner, appId };
// Heartbeat times are whole milliseconds, as the scheduler writes them.
const checkedAt = Date.now() - 42_000;
const iso = ms => new Date(ms).toISOString();

async function patchStored(name, fields) {
  const resource = await resourceGetByPath(owner, `jobs/${name}.md`);
  await resourcePut(owner, resource.path, patchJobFrontmatterFields(resource.content, fields));
}

await defineAutomation(actor, { scope: "personal", name: "hourly", body: "Summarize the project.",
  triggerType: "schedule", schedule: "0 * * * *", timezone: "UTC" });
// A skip the scheduler recorded after its last heartbeat is newer, so it is the last check.
await defineAutomation(actor, { scope: "personal", name: "skipped-later", body: "Summarize the project.",
  triggerType: "schedule", schedule: "0 * * * *", timezone: "UTC" });
await patchStored("skipped-later", { lastCheck: iso(checkedAt + 60_000) });
// The scheduler never checks an event automation. Its last check is the dispatcher's own skip time.
await defineAutomation(actor, { scope: "personal", name: "on-event", body: "Summarize the event.",
  triggerType: "event", event: "test.event.fired" });
await patchStored("on-event", { lastCheck: iso(checkedAt - 60_000) });
await defineAutomation(actor, { scope: "personal", name: "paused", body: "Summarize the project.",
  triggerType: "schedule", schedule: "0 * * * *", timezone: "UTC" });
await updateAutomation(actor, { scope: "personal", name: "paused", enabled: false });
// Pause keeps the stored next run, which then falls into the past.
await patchStored("paused", { nextRun: iso(Date.now() - 3 * 60 * 60_000) });

// Legacy recurring jobs have no trigger type. Settings lists them through list-recurring-jobs.
await resourcePut(owner, "jobs/legacy.md", buildJobResourceContent(
  { schedule: "*/5 * * * *", enabled: true, appId }, "Check the build."));
await resourcePut(owner, "jobs/legacy-paused.md", buildJobResourceContent(
  { schedule: "*/5 * * * *", enabled: false, appId }, "Check the build."));
// Paused before the heartbeat and resumed after it, in the case on created times.
await defineAutomation(actor, { scope: "personal", name: "resumed", body: "Summarize the project.",
  triggerType: "schedule", schedule: "0 * * * *", timezone: "UTC" });
await updateAutomation(actor, { scope: "personal", name: "resumed", enabled: false });
// Every definition above predates the heartbeats, as one the scheduler has checked does.
await getDbExec().execute({ sql: "UPDATE resources SET created_at = ? WHERE owner = ?",
  args: [checkedAt - 60 * 60_000, owner] });

// The first case lists on a fresh database, before any heartbeat. The others record the heartbeats first.
let recorded;
const heartbeats = () => {
  recorded ??= (async () => {
    await recordAutomationSchedulerHealth({ appId, checkedAt, runtime: "recurring-jobs" });
    // Another app's scheduler on the same database is not this app's last check.
    await recordAutomationSchedulerHealth({ appId: "other-app", checkedAt: checkedAt + 120_000, runtime: "recurring-jobs" });
  })();
  return recorded;
};

after(async () => {
  await esbuild.stop();
  await rm(caseRoot, { recursive: true, force: true });
});

const byName = rows => Object.fromEntries(rows.map(row => [row.name, row]));
const listBoth = async () => ({
  automations: byName(await listAutomations.default.run({ scope: "personal" }, ctx)),
  jobs: byName(await listRecurringJobs.default.run({ scope: "personal" }, ctx)),
});

test("on a fresh database, a list before any heartbeat keeps each stored value", async () => {
  const { automations, jobs } = await listBoth();
  assert.equal(automations.hourly.lastCheck, null, "no check is recorded yet");
  assert.equal(automations["skipped-later"].lastCheck, iso(checkedAt + 60_000), "a recorded skip is kept");
  assert.equal(jobs.legacy.lastCheck, null);
});

test("LAST CHECKED shows the scheduler's last check for an enabled scheduled automation", async () => {
  await heartbeats();
  const rows = byName(await listAutomations.default.run({ scope: "personal" }, ctx));
  assert.equal(rows.hourly.lastCheck, iso(checkedAt), "the heartbeat of this app's scheduler");
  assert.equal(rows["skipped-later"].lastCheck, iso(checkedAt + 60_000), "a later recorded skip wins");
  assert.equal(rows["on-event"].lastCheck, iso(checkedAt - 60_000), "an event automation keeps its own check");
  assert.equal(rows.paused.lastCheck, null, "the scheduler does not check a paused automation");
});

test("LAST CHECKED shows the scheduler's last check for an enabled legacy recurring job", async () => {
  await heartbeats();
  const rows = byName(await listRecurringJobs.default.run({ scope: "personal" }, ctx));
  assert.equal(rows.legacy.lastCheck, iso(checkedAt));
  assert.equal(rows["legacy-paused"].lastCheck, null);
});

test("a failed scheduler health read is logged, and each list falls back to the stored value", async () => {
  await heartbeats();
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.map(String).join(" ")); };
  // The health table was created by the heartbeats, so moving it away makes the read itself fail.
  await getDbExec().execute({ sql: "ALTER TABLE automation_scheduler_health RENAME TO automation_scheduler_health_moved", args: [] });
  let lists;
  try {
    lists = await listBoth();
  } finally {
    await getDbExec().execute({ sql: "ALTER TABLE automation_scheduler_health_moved RENAME TO automation_scheduler_health", args: [] });
    console.warn = originalWarn;
  }
  assert.equal(lists.automations.hourly.lastCheck, null, "the stored value, not an error");
  assert.equal(lists.automations["skipped-later"].lastCheck, iso(checkedAt + 60_000));
  assert.equal(lists.jobs.legacy.lastCheck, null);
  assert.equal(warnings.filter(line => /scheduler's last check/.test(line)).length, 2, "each list logged the failure");
});

test("LAST CHECKED ignores a heartbeat whose check failed", async () => {
  await heartbeats();
  await recordAutomationSchedulerHealth({ appId, checkedAt: checkedAt + 30_000, runtime: "recurring-jobs",
    error: "The scheduler could not reach the database." });
  let lists;
  try {
    lists = await listBoth();
  } finally {
    await recordAutomationSchedulerHealth({ appId, checkedAt, runtime: "recurring-jobs" });
  }
  assert.equal(lists.automations.hourly.lastCheck, null, "a failed check is not a check");
  assert.equal(lists.jobs.legacy.lastCheck, null);
  assert.equal((await listBoth()).automations.hourly.lastCheck, iso(checkedAt), "the next good check counts again");
});

test("LAST CHECKED ignores a heartbeat from before the entry was created", async () => {
  await heartbeats();
  await defineAutomation(actor, { scope: "personal", name: "created-later", body: "Summarize the project.",
    triggerType: "schedule", schedule: "0 * * * *", timezone: "UTC" });
  await resourcePut(owner, "jobs/legacy-later.md", buildJobResourceContent(
    { schedule: "*/5 * * * *", enabled: true, appId }, "Check the build."));
  await updateAutomation(actor, { scope: "personal", name: "resumed", enabled: true });
  const { automations, jobs } = await listBoth();
  assert.equal(automations["created-later"].lastCheck, null, "a check from before the automation existed did not check it");
  assert.equal(jobs["legacy-later"].lastCheck, null, "a check from before the job existed did not check it");
  assert.equal(automations.hourly.lastCheck, iso(checkedAt), "an older automation still shows the check");
  // Resuming keeps the created time, so a resumed automation shows the last check, which read it while it was paused.
  assert.equal(automations.resumed.lastCheck, iso(checkedAt));
});

test("a paused automation lists no next run, although its stored next run is in the past", async () => {
  const stored = await resourceGetByPath(owner, "jobs/paused.md");
  assert.match(stored.content, /nextRun: /, "the stale value is still stored");
  const rows = byName(await listAutomations.default.run({ scope: "personal" }, ctx));
  assert.equal(rows.paused.enabled, false);
  assert.equal(rows.paused.nextRun, null);
  assert.ok(Date.parse(rows.hourly.nextRun) > Date.now(), "an enabled automation lists a future run");
});

// Only the run list's data hook, the translation hook, the chat event helper, and the dialog frame are stubbed.
// They are matched by the file they resolve to. The dialog frame is Radix, which renders into a portal.
const stubs = new Map([
  [path.join(CLIENT, "agent-page", "use-jobs.js"), `
    export function useAutomationRuns() { return { data: globalThis.__automationRuns, isLoading: false, error: null }; }`],
  [path.join(CLIENT, "i18n.js"), `
    export function useT() { return (key, options) => options?.defaultValue ?? key; }`],
  [path.join(CLIENT, "agent-chat.js"), `
    export function requestAgentChatThreadOpen(detail) { globalThis.__openRequests.push(detail); }`],
  [path.join(CLIENT, "components", "ui", "dialog.js"), `
    export const Dialog = ({ open, children }) => (open ? <div role="dialog">{children}</div> : null);
    export const DialogContent = ({ children }) => <div>{children}</div>;
    export const DialogHeader = ({ children }) => <div>{children}</div>;
    export const DialogTitle = ({ children }) => <h2>{children}</h2>;
    export const DialogDescription = ({ children }) => <p>{children}</p>;`],
]);

const proofSource = String.raw`
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AutomationDetailsDialog } from "@proof/details";

export async function renderDetails(runs) {
  globalThis.__automationRuns = runs;
  globalThis.__openRequests = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<AutomationDetailsDialog open name="digest" triggerSummary="Every hour"
      fields={[{ label: "Last checked", value: "now" }]} condition={null} instructions="Summarize the project."
      mcpTools={[]} lastError={null} scope="personal" formatTimestamp={ms => new Date(ms).toISOString()}
      onClose={() => {}} />);
  });
  const snapshot = {
    text: host.textContent,
    buttons: [...host.querySelectorAll("button")].map(button => button.textContent),
    rows: host.querySelectorAll("li").length,
  };
  await act(async () => { root.unmount(); });
  host.remove();
  return snapshot;
}
`;

async function buildProof() {
  const result = await esbuild.build({
    stdin: { contents: proofSource, resolveDir: HERE, sourcefile: "automation-details-proof.tsx", loader: "tsx" },
    absWorkingDir: WORKBENCH,
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "node22",
    jsx: "automatic",
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{
      name: "automation-details-proof",
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === "@proof/details") return { path: path.join(CLIENT, "agent-page", "AutomationDetailsDialog.js") };
          if (args.path.startsWith(".") && args.importer.startsWith(CORE)) {
            const target = path.resolve(path.dirname(args.importer), args.path);
            if (stubs.has(target)) return { path: target, namespace: "stub" };
          }
          return undefined;
        });
        build.onLoad({ filter: /.*/, namespace: "stub" }, args => (
          { contents: stubs.get(args.path), loader: "tsx", resolveDir: WORKBENCH }));
      },
    }],
  });
  return result.outputFiles[0].text;
}

function installDom() {
  const linkedom = createRequire(path.join(CORE, "package.json"))("linkedom");
  const view = linkedom.parseHTML("<!doctype html><html><body></body></html>");
  // React schedules through MessageChannel. Open ports keep Node alive, so the proof closes them.
  const channels = [];
  class TrackedMessageChannel extends MessageChannel {
    constructor() { super(); channels.push(this); }
  }
  const values = { window: view, self: view, document: view.document, navigator: view.navigator,
    HTMLElement: view.HTMLElement, Element: view.Element, Node: view.Node, Event: view.Event,
    CustomEvent: view.CustomEvent, EventTarget: view.EventTarget, MessageChannel: TrackedMessageChannel,
    IS_REACT_ACT_ENVIRONMENT: true };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => { for (const channel of channels) { channel.port1.close(); channel.port2.close(); } };
}

test("past runs offer no Open thread control, because Settings cannot open a run thread", async t => {
  const proof = await import(`data:text/javascript;base64,${Buffer.from(await buildProof()).toString("base64")}`);
  const closeChannels = installDom();
  t.after(() => closeChannels());
  const startedAt = Date.now() - 10 * 60_000;
  const run = (id, status, error) => ({ id, status, error, threadId: `thread-${id}`, runId: `run-${id}`,
    startedAt, finishedAt: startedAt + 3_000, errorCode: null, automation: "digest" });
  const details = await proof.renderDetails([
    run("done", "success", null),
    run("cut", "interrupted", INTERRUPTED_RUN_MESSAGE),
    run("failed", "error", "The tool failed. No delivery was confirmed."),
  ]);
  assert.equal(details.rows, 3, "every past run is listed");
  for (const status of ["success", "interrupted", "error"]) assert.match(details.text, new RegExp(status));
  assert.match(details.text, /The run stopped before it recorded a result/, "an interrupted run shows its message");
  assert.deepEqual(details.buttons.filter(label => /open thread/i.test(label)), [], "no run offers Open thread");
});
