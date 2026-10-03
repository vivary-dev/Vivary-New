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
const i18nStub = `
  export function useT() { return (key, options) => options?.defaultValue ?? key; }
  export function useFormatters() { return { formatDate: value => new Date(value).toISOString() }; }`;
const dialogStub = `
  export const Dialog = ({ open, onOpenChange, children }) => (open ? <div role="dialog">
    <button type="button" onClick={() => onOpenChange(false)}>Close</button>{children}</div> : null);
  export const DialogContent = ({ children }) => <div>{children}</div>;
  export const DialogHeader = ({ children }) => <div>{children}</div>;
  export const DialogFooter = ({ children }) => <div>{children}</div>;
  export const DialogTitle = ({ children }) => <h2>{children}</h2>;
  export const DialogDescription = ({ children }) => <p>{children}</p>;`;
const stubs = new Map([
  [path.join(CLIENT, "agent-page", "use-jobs.js"), `
    export function useAutomationRuns() { return { data: globalThis.__automationRuns, isLoading: false, error: null }; }
    export const firstLoading = () => false;
    export const loadFailed = () => false;`],
  [path.join(CLIENT, "i18n.js"), i18nStub],
  [path.join(CLIENT, "agent-chat.js"), `
    export function requestAgentChatThreadOpen(detail) { globalThis.__openRequests.push(detail); }`],
  [path.join(CLIENT, "components", "ui", "dialog.js"), dialogStub],
]);

const proofSource = String.raw`
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AutomationDetailsDialog } from "@proof/entry";

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

async function buildProof({ source, sourcefile, entry, stubs }) {
  const result = await esbuild.build({
    stdin: { contents: source, resolveDir: HERE, sourcefile, loader: "tsx" },
    absWorkingDir: WORKBENCH,
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    target: "node22",
    jsx: "automatic",
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{
      name: "core-client-proof",
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === "@proof/entry") return { path: entry };
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
  return { code: result.outputFiles[0].text,
    inputs: Object.keys(result.metafile.inputs).map(input => path.resolve(WORKBENCH, input)) };
}

const importProof = code => import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

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
  const replaced = Object.keys(values).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => {
    for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
    for (const [name, descriptor] of replaced) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

test("past runs offer no Open thread control, because Settings cannot open a run thread", async t => {
  const { code } = await buildProof({ source: proofSource, sourcefile: "automation-details-proof.tsx",
    entry: path.join(CLIENT, "agent-page", "AutomationDetailsDialog.js"), stubs });
  const proof = await importProof(code);
  const restoreDom = installDom();
  t.after(restoreDom);
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

// Issue #141. Details must show what the automation list holds now, and the list must refresh while the tab is open.
// use-action.js is replaced so the real use-jobs.js hooks run on real React Query, answered by a fake transport.
const jobsTabStubs = new Map([
  [path.join(CLIENT, "use-action.js"), `
    import { useMutation, useQuery } from "@tanstack/react-query";
    export function useActionQuery(actionName, params, options) {
      return useQuery({ queryKey: ["action", actionName, params], retry: false,
        queryFn: async () => globalThis.__proofTransport(actionName, params), ...options });
    }
    export function useActionMutation(actionName, options) {
      const { method, skipActionQueryInvalidation, timeoutMs, ...rest } = options ?? {};
      return useMutation({ ...rest, mutationFn: async variables => globalThis.__proofTransport(actionName, variables) });
    }`],
  [path.join(CLIENT, "i18n.js"), i18nStub],
  [path.join(CLIENT, "components", "ui", "dialog.js"), dialogStub],
  [path.join(CLIENT, "components", "ui", "popover.js"), `
    export const Popover = ({ children }) => <div>{children}</div>;
    export const PopoverTrigger = ({ children }) => children;
    export const PopoverContent = ({ children }) => <div>{children}</div>;`],
  [path.join(CLIENT, "AgentAskPopover.js"), `export function AgentAskPopover() { return null; }`],
  [path.join(CLIENT, "settings", "AutomationsSection.js"), `export function automationCreationContext() { return ""; }`],
  [path.join(CLIENT, "agent-page", "AutomationScheduleDialog.js"), `export function AutomationScheduleDialog() { return null; }`],
]);

const jobsTabSource = String.raw`
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, environmentManager, focusManager, onlineManager, timeoutManager }
  from "@tanstack/react-query";
import { AgentJobsTab } from "@proof/entry";

const settle = () => act(async () => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise(resolve => setTimeout(resolve, 0));
});

export async function mountJobsTab(rows) {
  const calls = new Map();
  globalThis.__proofTransport = (action, params) => {
    const key = params.scope ? action + " " + params.scope : action;
    calls.set(key, (calls.get(key) ?? 0) + 1);
    if (rows.failing?.includes(key)) {
      const failure = new Error("The server did not answer.");
      if (!rows.hold) throw failure;
      return new Promise((resolve, reject) => { rows.release = () => reject(failure); });
    }
    if (action === "manage-automation" || action === "manage-recurring-job") {
      const lists = action === "manage-automation" ? rows : rows.jobs;
      lists[params.scope] = lists[params.scope].map(row => (row.name === params.name
        ? { ...row, enabled: params.enabled } : row));
      return {};
    }
    if (action === "list-automations") return rows[params.scope];
    if (action === "list-recurring-jobs") return rows.jobs?.[params.scope] ?? [];
    if (action === "list-automation-runs") return rows.runs ?? [];
    if (action === "get-scheduled-trigger-status") return { available: true };
    return [];
  };
  // Core's house client turns off refetch on window focus, so a hook that wants it must ask for it.
  const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<QueryClientProvider client={client}><AgentJobsTab hideHeader /></QueryClientProvider>);
  });
  await settle();
  return {
    calls: (action, scope) => calls.get(action + " " + scope) ?? 0,
    text: () => host.textContent,
    controls: label => [...host.querySelectorAll("button")].filter(button => button.textContent.trim() === label).length,
    pastRuns: () => host.querySelector('[role="dialog"]')?.querySelectorAll("li").length ?? 0,
    dialogText: () => host.querySelector('[role="dialog"]')?.textContent ?? "",
    detailsAboveFields() {
      const text = host.querySelector('[role="dialog"]')?.textContent ?? "";
      const fields = host.querySelector('[role="dialog"] dl');
      return fields ? text.slice(0, text.indexOf(fields.textContent)) : text;
    },
    belowPastRuns() {
      const text = host.querySelector('[role="dialog"]')?.textContent ?? "";
      return text.slice(text.lastIndexOf("Past runs"));
    },
    switchState(index) {
      const control = host.querySelectorAll('[role="switch"]')[index];
      return { checked: control.getAttribute("aria-checked"), disabled: control.hasAttribute("disabled") };
    },
    async toggle(index) {
      await act(async () => { host.querySelectorAll('[role="switch"]')[index].click(); });
      await settle();
    },
    async click(label, nth) {
      const button = [...host.querySelectorAll("button")].filter(button => button.textContent.trim() === label).at(nth);
      await act(async () => { button.click(); });
      await settle();
    },
    async release() {
      await act(async () => { rows.release(); });
      await settle();
    },
    section(index) {
      const section = host.querySelectorAll("section")[index];
      const text = section.textContent;
      const firstRow = section.querySelector("article");
      return { text, rows: section.querySelectorAll("article").length,
        aboveRows: firstRow ? text.slice(0, text.indexOf(firstRow.textContent)) : text };
    },
    async closeDetails() {
      const close = host.querySelector('[role="dialog"] button');
      await act(async () => { close.click(); });
      await settle();
    },
    async age(action, params) {
      await act(async () => {
        client.setQueryData(["action", action, params], data => data, { updatedAt: Date.now() - 60_000 });
      });
    },
    async focus(focused) {
      await act(async () => { focusManager.setFocused(focused); });
      await settle();
    },
    async online(online) {
      await act(async () => { onlineManager.setOnline(online); });
      await settle();
    },
    async openDetails(label = "Details", nth = 0) {
      const details = [...host.querySelectorAll("button")].filter(button => button.textContent.trim() === label)[nth];
      await act(async () => { details.click(); });
      await settle();
    },
    details() {
      const dialog = host.querySelector('[role="dialog"]');
      return dialog && Object.fromEntries([...dialog.querySelectorAll("dt")]
        .map(term => [term.textContent, term.nextElementSibling?.textContent]));
    },
    async setList(scope, list) {
      await act(async () => { client.setQueryData(["action", "list-automations", { scope }], list); });
      await settle();
    },
    async unmount() {
      await act(async () => { root.unmount(); });
      client.clear();
      host.remove();
    },
  };
}

export function resetFocus() {
  focusManager.setFocused(undefined);
}

export function resetOnline() {
  onlineManager.setOnline(true);
}

export function recordTimers() {
  const wasServer = environmentManager.isServer();
  const intervals = new Set();
  // Timeouts never run, so the five minute cache timer cannot keep node --test alive.
  const recording = {
    setTimeout: () => ({}),
    clearTimeout: () => {},
    setInterval: (callback, ms) => {
      const timer = { callback, ms };
      intervals.add(timer);
      return timer;
    },
    clearInterval: timer => { intervals.delete(timer); },
  };
  // The bundle loads before the DOM, so React Query took this process for a server and starts no timers.
  environmentManager.setIsServer(() => false);
  timeoutManager.setTimeoutProvider(recording);
  return {
    intervals: () => [...intervals].map(timer => timer.ms),
    async fire(maxMs) {
      const due = [...intervals].filter(timer => timer.ms <= maxMs);
      await act(async () => { for (const timer of due) timer.callback(); });
      await settle();
    },
    restore() {
      // Setting the same provider first clears React Query's development warning about switching after use.
      timeoutManager.setTimeoutProvider(recording);
      timeoutManager.setTimeoutProvider({ setTimeout, clearTimeout, setInterval, clearInterval });
      environmentManager.setIsServer(() => wasServer);
    },
  };
}
`;

let jobsTab;
const jobsTabProof = () => {
  jobsTab ??= (async () => {
    const { code, inputs } = await buildProof({ source: jobsTabSource, sourcefile: "automation-jobs-tab-proof.tsx",
      entry: path.join(CLIENT, "agent-page", "AgentJobsTab.js"), stubs: jobsTabStubs });
    for (const file of ["AgentJobsTab.js", "AutomationDetailsDialog.js", "use-jobs.js"]) {
      assert.ok(inputs.includes(path.join(CLIENT, "agent-page", file)), `the proof bundles Core's real ${file}`);
    }
    return importProof(code);
  })();
  return jobsTab;
};

const tick = Date.UTC(2026, 8, 29, 14, 16, 40);
const listed = { id: "res-digest", name: "digest", scope: "personal", enabled: true, canUpdate: true,
  triggerType: "schedule", schedule: "* * * * *", scheduleDescription: "Every minute", timezone: "UTC",
  body: "Summarize the project.", mcpTools: [], lastError: null, createdBy: owner, model: null };
const beforeTick = { ...listed, lastCheck: iso(tick), nextRun: iso(tick + 20_000), lastRun: null, lastStatus: null };
const afterTick = { ...listed, lastCheck: iso(tick + 60_000), nextRun: iso(tick + 80_000),
  lastRun: iso(tick + 20_000), lastStatus: "success" };
const pastRun = { id: "run-1", status: "success", error: null, threadId: "thread-1", runId: "run-1",
  startedAt: tick + 20_000, finishedAt: tick + 23_000, errorCode: null, automation: "digest" };
const legacyJob = { ...afterTick, id: "res-legacy", name: "legacy", instructions: "Check the build." };
const everyList = () => ({ personal: [afterTick],
  organization: [{ ...afterTick, id: "res-shared", name: "shared", scope: "organization" }],
  jobs: { personal: [legacyJob],
    organization: [{ ...legacyJob, id: "res-organization-legacy", name: "organization-legacy", scope: "organization" }] } });

const sectionNote = /Could not refresh automations\. The values shown may be out of date\./;
const detailsNote = /Could not refresh\. These values may be out of date\./;
const runsNote = /Could not refresh run history\./;

function assertDetailsShow(shown, row, where) {
  assert.equal(shown?.["Last checked"], row.lastCheck, `${where} shows the LAST CHECKED the list now holds`);
  assert.equal(shown?.["Next run"], row.nextRun, `${where} shows the NEXT RUN the list now holds`);
  assert.equal(shown?.["Last run"], row.lastRun, `${where} shows the LAST RUN the list now holds`);
  assert.equal(shown?.["Last status"], row.lastStatus, `${where} shows the LAST STATUS the list now holds`);
}

test("an open Details dialog follows the automation list when the list changes", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  const rows = { personal: [beforeTick], organization: [] };
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails();
    assert.equal(tab.details()?.["Last checked"], beforeTick.lastCheck, "Details opens on the list's LAST CHECKED");
    rows.personal = [afterTick];
    await tab.setList("personal", [afterTick]);
    assertDetailsShow(tab.details(), afterTick, "an open Details dialog");
  } finally {
    await tab.unmount();
  }
});

test("opening Details fetches the automation list again", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  const rows = { personal: [beforeTick], organization: [] };
  const tab = await proof.mountJobsTab(rows);
  try {
    const fetched = tab.calls("list-automations", "personal");
    rows.personal = [afterTick];
    await tab.openDetails();
    assert.ok(tab.calls("list-automations", "personal") > fetched,
      "opening Details fetches the personal automation list again");
    assertDetailsShow(tab.details(), afterTick, "Details opened after the list changed");
  } finally {
    await tab.unmount();
  }
});

test("the automation list refreshes while the Automations tab stays open", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = { personal: [beforeTick], organization: [] };
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails();
    const fetched = tab.calls("list-automations", "personal");
    const fetchedJobs = tab.calls("list-recurring-jobs", "personal");
    rows.personal = [afterTick];
    // The scheduler heartbeat moves every 60 seconds, so a 30 second refresh keeps LAST CHECKED within half a tick.
    await timers.fire(30_000);
    assert.ok(tab.calls("list-automations", "personal") > fetched,
      "a timer of 30 seconds or less fetches the personal automation list again while the tab stays open");
    assert.ok(tab.calls("list-recurring-jobs", "personal") > fetchedJobs,
      "a timer of 30 seconds or less fetches the personal recurring job list again too");
    assertDetailsShow(tab.details(), afterTick, "an open Details dialog after a timed refresh");
    assert.deepEqual([...new Set(timers.intervals())], [30_000], "every refresh interval is exactly 30 seconds");
  } finally {
    await tab.unmount();
  }
  assert.deepEqual(timers.intervals(), [], "no refresh interval outlives the tab");
});

test("Details stays on the automation it opened when both scopes hold its name", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  const personalDigest = { ...beforeTick, id: "res-personal-digest" };
  const organizationDigest = { ...beforeTick, id: "res-organization-digest", scope: "organization",
    lastCheck: iso(tick + 120_000) };
  const rows = { personal: [personalDigest], organization: [organizationDigest] };
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails("Details", 2);
    const other = { ...beforeTick, id: "res-other", name: "other" };
    const organizationAfter = { ...organizationDigest, lastCheck: iso(tick + 180_000) };
    rows.personal = [other, personalDigest];
    rows.organization = [organizationAfter];
    await tab.setList("personal", rows.personal);
    await tab.setList("organization", rows.organization);
    const shown = tab.details();
    assert.equal(shown?.Scope, "Organization", "Details still shows the organization digest");
    assert.equal(shown?.["Last checked"], organizationAfter.lastCheck,
      "Details shows the organization digest's LAST CHECKED");
    assert.ok(tab.calls("list-automation-runs", "organization") > 0, "Past runs asks for the organization scope");
    assert.equal(tab.calls("list-automation-runs", "personal"), 0, "Past runs never asks for the personal digest");
  } finally {
    await tab.unmount();
  }
});

test("a closed Details dialog stays closed and fetches no past runs", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const tab = await proof.mountJobsTab({ personal: [beforeTick], organization: [] });
  try {
    await tab.openDetails();
    assert.ok(tab.details(), "Details opens");
    await tab.closeDetails();
    assert.equal(tab.details(), null, "Close closes Details");
    const fetchedRuns = tab.calls("list-automation-runs", "personal");
    await timers.fire(30_000);
    assert.equal(tab.details(), null, "the timed refresh leaves Details closed");
    assert.equal(tab.calls("list-automation-runs", "personal"), fetchedRuns,
      "the timed refresh fetches no past runs after Close");
  } finally {
    await tab.unmount();
  }
});

test("a failed list refresh keeps the rows and the Details values and notes it until a success", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = { personal: [afterTick], organization: [] };
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails();
    const later = { ...afterTick, lastCheck: iso(tick + 120_000) };
    rows.personal = [later];
    rows.failing = ["list-automations personal"];
    const fetched = tab.calls("list-automations", "personal");
    await timers.fire(30_000);
    assert.ok(tab.calls("list-automations", "personal") > fetched, "the timed refresh asks for the list again");
    assert.doesNotMatch(tab.text(), /Could not load all automations/, "a failed refresh after an answer is no load error");
    assert.match(tab.text(), sectionNote, "the section notes that its values may be out of date");
    assert.equal(tab.controls("Details"), 2, "the automation's row stays listed");
    assertDetailsShow(tab.details(), afterTick, "an open Details dialog after a failed refresh");
    assert.match(tab.dialogText(), detailsNote, "Details notes that its values may be out of date");
    assert.doesNotMatch(tab.dialogText(), runsNote, "a failed list refresh leaves Past runs without a note");
    rows.failing = [];
    await timers.fire(30_000);
    assert.doesNotMatch(tab.text(), sectionNote, "the next successful refresh clears the section note");
    assert.doesNotMatch(tab.dialogText(), detailsNote, "the next successful refresh clears the Details note");
    assert.equal(tab.details()?.["Last checked"], later.lastCheck, "the next successful refresh shows the new values");
  } finally {
    await tab.unmount();
  }
});

test("a failed refresh of each list notes it in its section and in Details only for its own list", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = everyList();
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails("Details", 6);
    for (const [list, failed, other] of [["list-recurring-jobs personal", 0, 1], ["list-automations personal", 0, 1],
      ["list-recurring-jobs organization", 1, 0], ["list-automations organization", 1, 0]]) {
      rows.failing = [list];
      await timers.fire(30_000);
      assert.match(tab.section(failed).aboveRows, sectionNote, `a failed ${list} refresh notes it above the rows`);
      assert.equal(tab.section(failed).rows, 2, `a failed ${list} refresh keeps its section's rows`);
      assert.doesNotMatch(tab.section(other).text, sectionNote, `a failed ${list} refresh leaves the other section alone`);
      if (list === "list-automations organization") {
        assert.match(tab.dialogText(), detailsNote, "Details on an organization automation notes its own list");
      } else {
        assert.doesNotMatch(tab.dialogText(), detailsNote, `Details on an organization automation ignores ${list}`);
      }
      rows.failing = [];
      await timers.fire(30_000);
      assert.doesNotMatch(tab.text(), sectionNote, `the next successful refresh clears the note for ${list}`);
    }
  } finally {
    await tab.unmount();
  }
});

test("Details on a recurring job notes its own list, and an automation's Details ignores the job lists", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = everyList();
  const tab = await proof.mountJobsTab(rows);
  try {
    for (const [entry, nth, list] of [["a personal recurring job", 0, "list-recurring-jobs personal"],
      ["an organization recurring job", 4, "list-recurring-jobs organization"]]) {
      await tab.openDetails("Details", nth);
      rows.failing = [list];
      await timers.fire(30_000);
      assert.match(tab.detailsAboveFields(), detailsNote, `Details on ${entry} notes ${list} above its fields`);
      rows.failing = [];
      await timers.fire(30_000);
      await tab.closeDetails();
    }
    await tab.openDetails("Details", 2);
    rows.failing = ["list-recurring-jobs personal", "list-recurring-jobs organization"];
    await timers.fire(30_000);
    assert.doesNotMatch(tab.dialogText(), detailsNote, "Details on an automation ignores failed recurring job lists");
  } finally {
    await tab.unmount();
  }
});

test("a failed runs refresh keeps the past runs and notes it under Past runs until a success", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = { personal: [afterTick], organization: [], runs: [pastRun] };
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails();
    assert.equal(tab.pastRuns(), 1, "Past runs lists the run");
    rows.failing = ["list-automation-runs personal"];
    const fetched = tab.calls("list-automation-runs", "personal");
    await timers.fire(30_000);
    assert.ok(tab.calls("list-automation-runs", "personal") > fetched, "the timed refresh asks for the runs again");
    assert.equal(tab.pastRuns(), 1, "a failed refresh keeps the run listed");
    assert.match(tab.belowPastRuns(), runsNote, "the Past runs note sits under the Past runs heading");
    assert.doesNotMatch(tab.detailsAboveFields(), runsNote, "the Past runs note stays out of the space above the fields");
    assert.doesNotMatch(tab.dialogText(), detailsNote, "a failed runs refresh leaves the Details fields without a note");
    assert.doesNotMatch(tab.text(), /Could not load run history/, "a failed refresh after an answer is no load error");
    rows.failing = [];
    await timers.fire(30_000);
    assert.doesNotMatch(tab.dialogText(), runsNote, "the next successful runs refresh clears the Past runs note");
  } finally {
    await tab.unmount();
  }
});

test("each list and Past runs that fail their first load show their load errors and no refresh note", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  for (const [list, section] of [["list-recurring-jobs personal", 0], ["list-automations personal", 0],
    ["list-recurring-jobs organization", 1], ["list-automations organization", 1]]) {
    const tab = await proof.mountJobsTab({ ...everyList(), failing: [list] });
    try {
      assert.match(tab.section(section).text, /Could not load all automations/,
        `a failed first load of ${list} shows the load error`);
      assert.doesNotMatch(tab.text(), sectionNote, `a failed first load of ${list} shows no refresh note`);
    } finally {
      await tab.unmount();
    }
  }
  const tab = await proof.mountJobsTab({ ...everyList(), failing: ["list-automation-runs personal"] });
  try {
    await tab.openDetails("Details", 2);
    assert.match(tab.dialogText(), /Could not load run history/, "a failed first runs load shows the runs load error");
    assert.doesNotMatch(tab.dialogText(), runsNote, "a failed first runs load shows no refresh note");
  } finally {
    await tab.unmount();
  }
});

test("the timed refresh keeps fetching and noting failures while the browser reports no network", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    proof.resetOnline();
    timers.restore();
    restoreDom();
  });
  const rows = { ...everyList(), runs: [pastRun] };
  const tab = await proof.mountJobsTab(rows);
  const watched = [["list-automations", "personal"], ["list-recurring-jobs", "personal"],
    ["list-automations", "organization"], ["list-recurring-jobs", "organization"], ["list-automation-runs", "personal"]];
  try {
    await tab.openDetails("Details", 2);
    await tab.online(false);
    const fetched = watched.map(([action, scope]) => tab.calls(action, scope));
    await timers.fire(30_000);
    watched.forEach(([action, scope], index) => {
      assert.ok(tab.calls(action, scope) > fetched[index], `the timer fetches ${action} ${scope} with no network`);
    });
    rows.failing = ["list-automations personal", "list-automation-runs personal", "list-automations organization",
      "list-recurring-jobs organization"];
    await timers.fire(30_000);
    assert.match(tab.section(0).aboveRows, sectionNote, "a failed list refresh with no network shows the section note");
    assert.match(tab.section(1).aboveRows, sectionNote,
      "failed organization list refreshes with no network show the organization section's note");
    assert.match(tab.dialogText(), detailsNote, "a failed list refresh with no network shows the Details note");
    assert.match(tab.dialogText(), runsNote, "a failed runs refresh with no network shows the Past runs note");
  } finally {
    await tab.unmount();
  }
});

test("a list that never loaded keeps its load error while a timed retry runs", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = { personal: [], organization: [], failing: ["list-automations personal"] };
  const tab = await proof.mountJobsTab(rows);
  const loadError = /Could not load all automations/;
  try {
    assert.match(tab.section(0).text, loadError, "a failed first load shows the load error");
    rows.hold = true;
    await timers.fire(30_000);
    assert.match(tab.section(0).text, loadError, "the load error stays while a timed retry is in flight");
    assert.doesNotMatch(tab.section(0).text, /Loading/, "a timed retry of a list that never loaded shows no Loading");
    rows.hold = false;
    await tab.release();
    assert.match(tab.section(0).text, loadError, "the load error stays after the retry fails");
    assert.doesNotMatch(tab.section(0).text, /Loading/, "a failed retry shows no Loading");
    rows.personal = [afterTick];
    rows.failing = [];
    await timers.fire(30_000);
    assert.doesNotMatch(tab.section(0).text, loadError, "a successful retry clears the load error");
    assert.equal(tab.section(0).rows, 1, "a successful retry lists the automation");
  } finally {
    await tab.unmount();
  }
});

test("Past runs that never loaded keep their load error while a timed retry runs", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const rows = { personal: [afterTick], organization: [], failing: ["list-automation-runs personal"] };
  const tab = await proof.mountJobsTab(rows);
  const loadError = /Could not load run history/;
  try {
    await tab.openDetails();
    assert.match(tab.belowPastRuns(), loadError, "a failed first runs load shows the load error");
    rows.hold = true;
    await timers.fire(30_000);
    assert.match(tab.belowPastRuns(), loadError, "the runs load error stays while a timed retry is in flight");
    assert.doesNotMatch(tab.belowPastRuns(), /Loading/, "a timed retry of runs that never loaded shows no Loading");
    rows.hold = false;
    await tab.release();
    assert.match(tab.belowPastRuns(), loadError, "the runs load error stays after the retry fails");
    assert.doesNotMatch(tab.belowPastRuns(), /Loading/, "a failed runs retry shows no Loading");
    rows.runs = [pastRun];
    rows.failing = [];
    await timers.fire(30_000);
    assert.doesNotMatch(tab.belowPastRuns(), loadError, "a successful retry clears the runs load error");
    assert.equal(tab.pastRuns(), 1, "a successful retry lists the run");
  } finally {
    await tab.unmount();
  }
});

test("a change from the page is sent at once with no network, and a refused one rolls back", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    proof.resetOnline();
    timers.restore();
    restoreDom();
  });
  const rows = everyList();
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.online(false);
    for (const [entry, index, action] of [["a recurring job", 0, "manage-recurring-job"],
      ["an automation", 1, "manage-automation"]]) {
      const sent = tab.calls(action, "personal");
      await tab.toggle(index);
      assert.equal(tab.calls(action, "personal"), sent + 1, `pausing ${entry} with no network sends the change at once`);
      assert.deepEqual(tab.switchState(index), { checked: "false", disabled: false },
        `the switch shows ${entry} paused and is free again once the change settles`);
      await timers.fire(30_000);
      assert.equal(tab.switchState(index).checked, "false", `a refresh after the change keeps ${entry} paused`);
    }
    rows.failing = ["manage-automation personal"];
    const sent = tab.calls("manage-automation", "personal");
    await tab.toggle(1);
    assert.equal(tab.calls("manage-automation", "personal"), sent + 1, "resuming with no network sends the change at once");
    assert.deepEqual(tab.switchState(1), { checked: "false", disabled: false }, "a refused change rolls the switch back");
    assert.match(tab.text(), /The server did not answer\./, "a refused change shows its error on the page");
    rows.failing = [];
    const ran = tab.calls("run-automation-now", "personal");
    await tab.click("Run now", 2);
    await tab.click("Run now", -1);
    assert.equal(tab.calls("run-automation-now", "personal"), ran + 1, "Run now with no network sends the run at once");
    assert.equal(tab.dialogText(), "", "the Run now dialog closes once the run is sent");
  } finally {
    await tab.unmount();
  }
});

test("a return of the network refetches the automation data that went stale", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    proof.resetOnline();
    timers.restore();
    restoreDom();
  });
  const tab = await proof.mountJobsTab(everyList());
  const watched = [["list-automations", { scope: "personal" }], ["list-recurring-jobs", { scope: "personal" }],
    ["list-automations", { scope: "organization" }], ["list-recurring-jobs", { scope: "organization" }],
    ["list-automation-runs", { scope: "personal", name: "digest" }]];
  try {
    await tab.openDetails("Details", 2);
    await tab.online(false);
    const fetched = watched.map(([action, { scope }]) => tab.calls(action, scope));
    for (const [action, params] of watched) await tab.age(action, params);
    await tab.online(true);
    watched.forEach(([action, { scope }], index) => {
      assert.ok(tab.calls(action, scope) > fetched[index], `a return of the network fetches ${action} ${scope} again`);
    });
  } finally {
    await tab.unmount();
  }
});

test("a return to a hidden window refetches the automation data that went stale", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    proof.resetFocus();
    timers.restore();
    restoreDom();
  });
  const tab = await proof.mountJobsTab({ personal: [beforeTick], organization: [] });
  const watched = [["list-automations", { scope: "personal" }], ["list-recurring-jobs", { scope: "personal" }],
    ["list-automations", { scope: "organization" }], ["list-recurring-jobs", { scope: "organization" }],
    ["list-automation-runs", { scope: "personal", name: "digest" }]];
  try {
    await tab.openDetails();
    await tab.focus(false);
    const fetched = watched.map(([action, { scope }]) => tab.calls(action, scope));
    await timers.fire(30_000);
    assert.deepEqual(watched.map(([action, { scope }]) => tab.calls(action, scope)), fetched,
      "the timed refresh skips a hidden window");
    for (const [action, params] of watched) await tab.age(action, params);
    await tab.focus(true);
    watched.forEach(([action, { scope }], index) => {
      assert.ok(tab.calls(action, scope) > fetched[index], `a return to the window fetches ${action} ${scope} again`);
    });
  } finally {
    await tab.unmount();
  }
});

test("every Details control opens Details on its automation", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  const failed = { ...beforeTick, lastError: "The tool failed. No delivery was confirmed." };
  const tab = await proof.mountJobsTab({ personal: [failed], organization: [] });
  try {
    for (const [control, label, nth] of [["the Manage menu item", "Details", 0], ["the hidden row button", "Details", 1],
      ["the View details link", "View details", 0]]) {
      assert.equal(tab.details(), null, `Details is closed before ${control}`);
      const fetched = tab.calls("list-automations", "personal");
      await tab.openDetails(label, nth);
      assert.ok(tab.calls("list-automations", "personal") > fetched, `${control} fetches the automation list again`);
      assert.equal(tab.details()?.["Last checked"], failed.lastCheck, `${control} opens Details on its automation`);
      await tab.closeDetails();
    }
  } finally {
    await tab.unmount();
  }
});

test("opening Details fetches only the list that holds the entry", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  const job = { ...beforeTick, id: "res-legacy", name: "legacy", instructions: "Check the build." };
  const organizationJob = { ...job, id: "res-organization-legacy", name: "organization-legacy",
    scope: "organization", lastCheck: iso(tick + 60_000) };
  const shared = { ...beforeTick, id: "res-shared", name: "shared", scope: "organization",
    lastCheck: iso(tick + 120_000) };
  const tab = await proof.mountJobsTab({ personal: [], organization: [shared],
    jobs: { personal: [job], organization: [organizationJob] } });
  const lists = [["list-recurring-jobs", "personal"], ["list-automations", "personal"],
    ["list-recurring-jobs", "organization"], ["list-automations", "organization"]];
  const fetches = () => lists.map(([action, scope]) => tab.calls(action, scope));
  try {
    for (const [entry, row, action, scope, nth] of [
      ["a personal recurring job", job, "list-recurring-jobs", "personal", 0],
      ["an organization recurring job", organizationJob, "list-recurring-jobs", "organization", 2],
      ["an organization automation", shared, "list-automations", "organization", 4]]) {
      const fetched = fetches();
      await tab.openDetails("Details", nth);
      const now = fetches();
      assert.deepEqual(lists.filter((_, index) => now[index] > fetched[index]).map(list => list.join(" ")),
        [`${action} ${scope}`], `opening Details on ${entry} fetches ${action} ${scope} again and no other list`);
      assert.equal(tab.details()?.["Last checked"], row.lastCheck, `Details shows ${entry}`);
      await tab.closeDetails();
    }
  } finally {
    await tab.unmount();
  }
});

test("past runs refresh while Details stays open", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  const timers = proof.recordTimers();
  t.after(() => {
    timers.restore();
    restoreDom();
  });
  const tab = await proof.mountJobsTab({ personal: [beforeTick], organization: [] });
  try {
    await tab.openDetails();
    const fetched = tab.calls("list-automation-runs", "personal");
    await timers.fire(30_000);
    assert.ok(tab.calls("list-automation-runs", "personal") > fetched,
      "a timer of 30 seconds or less fetches the open automation's past runs again, so they keep up with LAST RUN");
  } finally {
    await tab.unmount();
  }
});

test("Details closes when its automation leaves the list", async t => {
  const proof = await jobsTabProof();
  const restoreDom = installDom();
  t.after(restoreDom);
  const rows = { personal: [beforeTick], organization: [] };
  const tab = await proof.mountJobsTab(rows);
  try {
    await tab.openDetails();
    assert.ok(tab.details(), "Details opens");
    rows.personal = [];
    await tab.setList("personal", []);
    assert.equal(tab.details(), null, "Details closes once the list no longer holds its automation");
    rows.personal = [beforeTick];
    await tab.setList("personal", [beforeTick]);
    assert.equal(tab.details(), null, "Details stays closed when the same automation returns to the list");
  } finally {
    await tab.unmount();
  }
});
