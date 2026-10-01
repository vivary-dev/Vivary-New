import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";
import { pathToFileURL } from "node:url";

// An event automation's condition is checked by Core's trigger dispatcher, which calls Anthropic's API directly
// whatever provider runs the automation. Core's package entries do not export these modules, so load the installed,
// patched files by path.
const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-automation-event-condition-"));
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
const [{ initTriggerDispatcher, parseTriggerFrontmatter }, { defineAutomation }, { emit, registerEvent },
  { putSetting, deleteSetting }, { listAutomationRuns }, { resourceGetByPath }] = await Promise.all([
  load("triggers/dispatcher.js"),
  load("automations/service.js"),
  load("event-bus/index.js"),
  load("settings/store.js"),
  load("jobs/run-history.js"),
  load("resources/store.js"),
]);

const owner = "owner@example.test";
const appId = "workbench";
const engineCalls = [];
// The engine is injected through the dispatcher's dependencies, so a run never reaches a real provider.
const engine = {
  name: "fake", label: "Fake", defaultModel: "fake-model", supportedModels: ["fake-model"],
  capabilities: { thinking: false, promptCaching: false, vision: false, computerUse: false, parallelToolCalls: false },
  async *stream(options) {
    engineCalls.push(JSON.stringify(options.messages));
    yield { type: "assistant-content", parts: [{ type: "text", text: "Event handled." }] };
    yield { type: "stop", reason: "end_turn" };
  },
};

// One event per automation, so each event reaches only its own automation.
const eventFor = name => `vivary.test.${name}`;
const anyPayload = { "~standard": { version: 1, vendor: "vivary-test", validate: value => ({ value }) } };
for (const [name, condition] of [["openrouter-only", "The event is about billing."],
  ["rejected-key", "The event is about billing."], ["anthropic-condition", "The event is about billing."],
  ["no-condition", undefined]]) {
  registerEvent({ name: eventFor(name), description: `Test event for ${name}.`, payloadSchema: anyPayload });
  await defineAutomation({ userEmail: owner, appId }, {
    scope: "personal", name, body: "Summarize the event in one sentence.", triggerType: "event",
    event: eventFor(name), condition,
  });
}
await initTriggerDispatcher({ appId, engine, model: "fake-model", getActions: () => ({}), getSystemPrompt: async () => "" });

after(async () => {
  globalThis.setTimeout = originalSetTimeout;
  await rm(caseRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  await deleteSetting("agent-engine");
  engineCalls.length = 0;
});

const metaOf = async name => parseTriggerFrontmatter((await resourceGetByPath(owner, `jobs/${name}.md`))?.content ?? "").meta;
const runsOf = automation => listAutomationRuns({ owners: [owner], automation, appId, limit: 20 });
// The bus does not wait for its handlers, so wait for the automation to record an outcome.
async function fire(name, timeoutMs = 10_000) {
  emit(eventFor(name), { automation: name, topic: "billing" }, { owner });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const meta = await metaOf(name);
    if ((meta.lastStatus && meta.lastStatus !== "running") || Date.now() > deadline) return meta;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

const fakeKey = prefix => `${prefix}${randomBytes(24).toString("hex")}`;
async function withKeys(keys, run) {
  Object.assign(process.env, keys); // guard:allow-env-credential - Random fake keys for a disposable run.
  try {
    await run();
  } finally {
    for (const name of Object.keys(keys)) delete process.env[name]; // guard:allow-env-credential - Removes the fake keys set above.
  }
}

// The condition classifier calls Anthropic directly. Record the key each call sends, and answer without a network:
// "yes" for the accepted key, 401 for any other.
async function withAnthropicStub(acceptedKey, run) {
  const realFetch = globalThis.fetch;
  const sentKeys = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input);
    if (!url.startsWith("https://api.anthropic.com/")) return realFetch(input, init);
    const key = new Headers(init?.headers).get("x-api-key");
    sentKeys.push(key);
    return acceptedKey && key === acceptedKey
      ? Response.json({ content: [{ type: "text", text: "yes" }] })
      : Response.json({ error: { type: "authentication_error" } }, { status: 401 });
  };
  try {
    await run(sentKeys);
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("a condition with only an OpenRouter key sends nothing to Anthropic and records an error", async () => {
  await putSetting("agent-engine", { engine: "ai-sdk:openrouter" });
  await withKeys({ OPENROUTER_API_KEY: fakeKey("sk-or-v1-") }, () => withAnthropicStub(undefined, async sentKeys => {
    const meta = await fire("openrouter-only");
    assert.equal(sentKeys.length, 0, "no key was sent to Anthropic");
    assert.equal(meta.lastStatus, "error", "the automation's last status reads as an error");
  }));
  const runs = await runsOf("openrouter-only");
  assert.equal(runs.length, 1, "one history row");
  assert.equal(runs[0].status, "error");
  assert.equal(runs[0].errorCode, "automation_condition_key_missing");
  assert.match(runs[0].error, /Add an Anthropic key, or remove the condition\. The event did not start a run\.$/);
  assert.equal(engineCalls.length, 0, "no run started");
});

test("a condition whose Anthropic key is rejected records an error and starts no run", async () => {
  await withKeys({ ANTHROPIC_API_KEY: fakeKey("sk-ant-") }, () => withAnthropicStub(undefined, async sentKeys => {
    const meta = await fire("rejected-key");
    assert.equal(sentKeys.length, 1, "one condition check reached Anthropic");
    assert.equal(meta.lastStatus, "error", "the automation's last status reads as an error");
  }));
  const runs = await runsOf("rejected-key");
  assert.equal(runs.length, 1, "one history row");
  assert.equal(runs[0].errorCode, "automation_condition_key_rejected");
  assert.match(runs[0].error, /^Anthropic rejected the API key used to check this automation's condition \(HTTP 401\)\./);
  assert.match(runs[0].error, /The event did not start a run\.$/);
  assert.equal(engineCalls.length, 0, "no run started");
});

test("with OpenRouter active, a condition is checked with the Anthropic key and the run starts", async () => {
  await putSetting("agent-engine", { engine: "ai-sdk:openrouter" });
  const anthropicKey = fakeKey("sk-ant-");
  const openRouterKey = fakeKey("sk-or-v1-");
  await withKeys({ ANTHROPIC_API_KEY: anthropicKey, OPENROUTER_API_KEY: openRouterKey },
    () => withAnthropicStub(anthropicKey, async sentKeys => {
      const meta = await fire("anthropic-condition");
      assert.ok(!sentKeys.includes(openRouterKey), "the OpenRouter key never reached Anthropic");
      assert.ok(sentKeys.length === 1 && sentKeys[0] === anthropicKey, "one condition check sent the Anthropic key");
      assert.equal(meta.lastStatus, "success", `the run finished (${meta.lastError ?? "no error"})`);
    }));
  assert.equal(engineCalls.length, 1, "one model run");
});

test("an automation without a condition runs with no stored key", async () => {
  const meta = await fire("no-condition");
  assert.equal(meta.lastStatus, "success", `the event was not refused (${meta.lastError ?? "no error"})`);
  assert.equal(engineCalls.length, 1, "one model run");
});
