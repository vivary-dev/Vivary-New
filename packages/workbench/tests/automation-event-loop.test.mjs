import assert from "node:assert/strict";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";
import { pathToFileURL } from "node:url";

// Vivary #110. Every finished automation run emits automation.run.finished, so an event automation subscribed to it
// can start itself, or another such automation, again. Core's package entries do not export these modules, so load
// the installed, patched files by path.
const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-automation-event-loop-"));
const database = `file:${path.join(caseRoot, "automations.sqlite")}`;
for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"]) {
  delete process.env[name]; // guard:allow-env-credential - Removes provider key names. No value is read.
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
const [{ initTriggerDispatcher, refreshEventSubscriptions }, { defineAutomation },
  { listSubscriptions, subscribe, unsubscribe }, { finishAutomationRun, listAutomationRuns, startAutomationRun },
  { resourceDeleteByPath }, { getThread }] = await Promise.all([
  load("triggers/dispatcher.js"),
  load("automations/service.js"),
  load("event-bus/index.js"),
  load("jobs/run-history.js"),
  load("resources/store.js"),
  load("chat-threads/store.js"),
]);

const owner = "owner@example.test";
const appId = "workbench";
const FAIL = "This run must fail.";
const engineRuns = [];
// The engine is injected through the dispatcher's dependencies, so a run never reaches a real provider. A run whose
// instructions carry FAIL throws, which records a failed run.
const engine = {
  name: "fake", label: "Fake", defaultModel: "fake-model", supportedModels: ["fake-model"],
  capabilities: { thinking: false, promptCaching: false, vision: false, computerUse: false, parallelToolCalls: false },
  async *stream(options) {
    const messages = JSON.stringify(options.messages);
    engineRuns.push(/\[Automation Trigger: ([^\]]+)\]/.exec(messages)?.[1] ?? "unknown");
    if (messages.includes(FAIL)) throw new Error("The fake engine failed this run.");
    yield { type: "assistant-content", parts: [{ type: "text", text: "Event handled." }] };
    yield { type: "stop", reason: "end_turn" };
  },
};
const dispatcherDeps = { appId, engine, model: "fake-model", getActions: () => ({}), getSystemPrompt: async () => "" };
await initTriggerDispatcher(dispatcherDeps);

after(async () => {
  globalThis.setTimeout = originalSetTimeout;
  await rm(caseRoot, { recursive: true, force: true });
});

beforeEach(() => {
  engineRuns.length = 0;
});

// The network is closed, so a run that resolves its own engine cannot reach a provider.
const realFetch = globalThis.fetch;
const fetchedUrls = [];
globalThis.fetch = async input => {
  fetchedUrls.push(String(input?.url ?? input));
  throw new Error("The test closed the network.");
};
after(() => {
  globalThis.fetch = realFetch;
});

// A loop of finished runs never goes quiet. Past the cap, this listener drops every listener for the event, which ends
// such a loop and lets the case fail instead of running until the process is killed.
function capRunFinishedEvents(cap = 30) {
  let seen = 0;
  const id = subscribe("automation.run.finished", () => {
    seen += 1;
    if (seen <= cap) return;
    for (const subscription of listSubscriptions("automation.run.finished")) unsubscribe(subscription.id);
  });
  return () => unsubscribe(id);
}

// These automations subscribe to the event that every finished history row emits, so they exist only inside their
// own case.
async function withRunFinishedAutomations(automations, run) {
  for (const [name, body] of Object.entries(automations)) {
    await defineAutomation({ userEmail: owner, appId }, {
      scope: "personal", name, body, triggerType: "event", event: "automation.run.finished",
    });
  }
  await refreshEventSubscriptions();
  const removeCap = capRunFinishedEvents();
  try {
    await run();
  } finally {
    removeCap();
    for (const name of Object.keys(automations)) await resourceDeleteByPath(owner, `jobs/${name}.md`);
    await refreshEventSubscriptions();
  }
}

// A scheduled or manual run records its history row this way, and its finish emits the event once.
async function finishRunOf(name) {
  const id = await startAutomationRun({ owner, automation: name, path: `jobs/${name}.md`, appId });
  await finishAutomationRun(id, "success");
}
const finishOutsideRun = () => finishRunOf("outside");

const runsOf = name => listAutomationRuns({ owners: [owner], automation: name, appId, limit: 100 });
// Wait until every automation has a finished row and no row is added or finished for a quiet window.
async function settledRuns(names, { quietMs = 500, capMs = 10_000 } = {}) {
  const deadline = Date.now() + capMs;
  let snapshot = "";
  let changedAt = Date.now();
  for (;;) {
    const runs = await Promise.all(names.map(runsOf));
    const next = JSON.stringify(runs.map(list => list.map(run => run.status)));
    if (next !== snapshot) [snapshot, changedAt] = [next, Date.now()];
    const finished = runs.every(list => list.length > 0 && list.every(run => run.status !== "running"));
    if ((finished && Date.now() - changedAt >= quietMs) || Date.now() > deadline) return runs;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
const statuses = runs => runs.map(list => list.map(run => run.status));

test("a self-subscribed automation that finishes twice is not started by its own runs", async () => {
  await withRunFinishedAutomations({ "self-subscribed": "Summarize the finished run in one sentence." }, async () => {
    await finishRunOf("self-subscribed");
    await finishRunOf("self-subscribed");
    assert.deepEqual(statuses(await settledRuns(["self-subscribed"])), [["success", "success"]],
      "only the two finished runs, and neither started another");
  });
  assert.deepEqual(engineRuns, [], "no model run");
});

test("a self-subscribed automation runs once for each outside run", async () => {
  await withRunFinishedAutomations({ "self-after-outside": "Summarize the finished run in one sentence." }, async () => {
    await finishOutsideRun();
    assert.deepEqual(statuses(await settledRuns(["self-after-outside"])), [["success"]],
      "one outside run starts one run, and that run's own finish starts nothing");
    await finishOutsideRun();
    assert.deepEqual(statuses(await settledRuns(["self-after-outside"])), [["success", "success"]],
      "a second outside run starts one more run, and its finish starts nothing either");
  });
  assert.deepEqual(engineRuns, ["self-after-outside", "self-after-outside"], "two model runs");
});

test("two automations subscribed to automation.run.finished do not start each other", async () => {
  await withRunFinishedAutomations({
    "pair-a": "Summarize the finished run in one sentence.",
    "pair-b": "Summarize the finished run in one sentence.",
  }, async () => {
    await finishOutsideRun();
    assert.deepEqual(statuses(await settledRuns(["pair-a", "pair-b"])), [["success"], ["success"]],
      "one outside run starts each automation once");
  });
  assert.deepEqual(engineRuns.toSorted(), ["pair-a", "pair-b"], "two model runs");
});

test("two failing automations subscribed to automation.run.finished do not start each other", async () => {
  await withRunFinishedAutomations({ "failing-a": FAIL, "failing-b": FAIL }, async () => {
    await finishOutsideRun();
    assert.deepEqual(statuses(await settledRuns(["failing-a", "failing-b"])), [["error"], ["error"]],
      "one outside run starts each automation once, and each failed run starts nothing");
  });
  assert.deepEqual(engineRuns.toSorted(), ["failing-a", "failing-b"], "two model runs");
});

test("two automations without a usable credential do not trade failed runs", async () => {
  // Without an injected engine, a run resolves its own engine and credential as a scheduled run does. No provider key
  // is set and the network is closed, so each run fails.
  const { engine: _engine, model: _model, ...keylessDeps } = dispatcherDeps;
  await initTriggerDispatcher(keylessDeps);
  try {
    await withRunFinishedAutomations({
      "keyless-a": "Summarize the finished run in one sentence.",
      "keyless-b": "Summarize the finished run in one sentence.",
    }, async () => {
      await finishOutsideRun();
      const runs = await settledRuns(["keyless-a", "keyless-b"]);
      assert.deepEqual(statuses(runs), [["error"], ["error"]],
        "one outside run starts each automation once, and each failed run starts nothing");
      for (const [run] of runs) {
        const thread = JSON.parse((await getThread(run.threadId)).threadData);
        assert.equal(thread.messages.at(-1).message.metadata.custom.runError.errorCode, "missing_credentials",
          `${run.automation} failed for want of a credential`);
      }
    });
  } finally {
    await initTriggerDispatcher(dispatcherDeps);
  }
  assert.deepEqual(engineRuns, [], "the fake engine was not used");
  assert.deepEqual(fetchedUrls, [], "no run reached the network");
});
