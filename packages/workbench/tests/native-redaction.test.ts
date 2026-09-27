import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

import { z } from "zod";

// Issue #97. Native chat surfaces in the patched Core, with Vivary's redactor registered as the
// Nitro plugin registers it. Every value is random and generated for this run. A failed
// comparison masks the generated values before it reports text.
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-native-redaction-"));
const database = `file:${path.join(caseRoot, "native.sqlite")}`;
Object.assign(process.env, { APP_NAME: "Vivary", NODE_ENV: "production", DATABASE_URL: database, DATABASE_URL_UNPOOLED: database });

// A finished run schedules a five-minute in-memory cleanup. Unref long timers so this file can exit.
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
  const timer = originalSetTimeout(handler, delay, ...args);
  if ((delay ?? 0) >= 60_000) timer.unref();
  return timer;
}) as typeof setTimeout;
after(async () => {
  globalThis.setTimeout = originalSetTimeout;
  await rm(caseRoot, { recursive: true, force: true });
});

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = (relative: string) => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [audit, runs, credentialProvider, threads, automationRuns] = await Promise.all([
  load("audit/redact.js"), load("agent/run-manager.js"), load("server/credential-provider.js"),
  load("chat-threads/store.js"), load("jobs/run-history.js"),
]);
const { defineAction } = await import("@agent-native/core/action");
const { getDbExec } = await import("@agent-native/core/db");
const { MCP_ACTION_RESULT_MARKER } = await import("@agent-native/core/mcp-client");
const { actionsToEngineTools, loadActionsFromStaticRegistry, runAgentLoop, runWithRequestContext } = await import("@agent-native/core/server");
const { redactCredentials, refreshHeldCredentials } = await import("../server/credential-redaction.ts");
type AgentEngine = import("@agent-native/core/agent/engine").AgentEngine;

audit.setTextRedactor?.(redactCredentials);
const owner = "owner@example.test";
const generated: string[] = [];
const synthetic = (length = 40) => {
  const value = randomBytes(length * 2).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, length - 2) + "4k";
  generated.push(value);
  return value;
};
const masked = (text: string) => generated.reduce((out, value) => out.split(value).join("<generated>"), text);
function assertMatch(text: string, pattern: RegExp, label = "") {
  if (!pattern.test(text)) assert.fail(`${label} ${masked(text).slice(0, 2_000)} does not match ${pattern}`);
}
function assertHidden(text: string, values: string[], label: string) {
  const shown = values.filter(value => text.includes(value)).length;
  assert.equal(shown, 0, `${label} showed ${shown} generated value(s)`);
}
function assertText(actual: string, expected: string, label = "") {
  if (actual !== expected) assert.fail(`${label} ${masked(actual)} !== ${masked(expected)}`);
}
async function holding(values: Record<string, string>) {
  assert.equal(typeof audit.setTextRedactor, "function", "Core has no text redactor hook");
  await refreshHeldCredentials({ environment: () => values, mcpConfig: () => null, storedSecrets: async () => [] });
}
async function rows(sql: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  return (await getDbExec().execute({ sql, args })).rows as Record<string, unknown>[];
}

test("a tool result, an MCP result, and a tool error reach the model and the screen with placeholders", async () => {
  const [held, keyValue] = [synthetic(), synthetic(48)];
  await holding({ VIVARY_PROBE_TOKEN: held });
  const probe = (run: () => Promise<unknown>) => ({ default: defineAction({ description: "Read the probe.", schema: z.object({}),
    agentTool: true, http: false, readOnly: true, dedupe: false, run }) });
  const actions = loadActionsFromStaticRegistry({
    "probe-read": probe(async () => ({ contents: `token ${held}\nOPENROUTER_API_KEY=${keyValue}` })),
    "probe-mcp": probe(async () => ({ [MCP_ACTION_RESULT_MARKER]: true, text: `mcp ${held}` })),
    "probe-fail": probe(async () => { throw new Error(`could not use ${held}`); }),
  });
  const requests: string[] = [];
  const engine: AgentEngine = { name: "fake", label: "Fake", defaultModel: "fake-model", supportedModels: ["fake-model"],
    capabilities: { thinking: false, promptCaching: false, vision: false, computerUse: false, parallelToolCalls: false },
    async *stream(options) {
      requests.push(JSON.stringify(options.messages));
      if (requests.length === 1) {
        const calls = ["probe-read", "probe-mcp", "probe-fail"].map((name, index) =>
          ({ type: "tool-call" as const, id: `call-${index}`, name, input: {} }));
        for (const call of calls) yield call;
        yield { type: "assistant-content", parts: calls };
        yield { type: "stop", reason: "tool_use" };
      } else {
        yield { type: "assistant-content", parts: [{ type: "text", text: "Done." }] };
        yield { type: "stop", reason: "end_turn" };
      }
    } };
  const events: Array<{ type: string; id?: string; result?: string }> = [];
  await runWithRequestContext({ userEmail: owner, orgId: "org-a", run: {} }, () => runAgentLoop({ engine, model: "fake-model",
    systemPrompt: "", tools: actionsToEngineTools(actions), actions, signal: new AbortController().signal,
    messages: [{ role: "user", content: [{ type: "text", text: "Read the probe." }] }],
    send: event => { events.push(event as { type: string; id?: string; result?: string }); } }));
  assert.equal(requests.length, 2);
  assertHidden(requests[1] + JSON.stringify(events), [held, keyValue], "model input and events");
  // Read-only tools run as one parallel batch, so results are matched by call id.
  const result = (id: string) => events.find(event => event.type === "tool_done" && event.id === id)?.result ?? "";
  const results = ["call-0", "call-1", "call-2"].map(result);
  assertMatch(results[0], /token \[redacted VIVARY_PROBE_TOKEN\]\\nOPENROUTER_API_KEY=\[redacted credential\]/);
  assertMatch(results[1], /mcp \[redacted VIVARY_PROBE_TOKEN\]/);
  assertMatch(results[2], /could not use \[redacted VIVARY_PROBE_TOKEN\]/);
  assert.equal(requests[1].match(/\[redacted VIVARY_PROBE_TOKEN\]/g)?.length, 3, "the model reads each result with its placeholder");
});

async function runToEnd(runFn: (send: (event: Record<string, unknown>) => void, signal: AbortSignal) => Promise<void>,
  whileRunning?: (runId: string) => void) {
  const runId = `run-${randomUUID()}`;
  let finished: Promise<unknown> | undefined;
  runs.startRun(runId, `thread-${randomUUID()}`, runFn, async () => undefined, { waitUntil: (promise: Promise<unknown>) => { finished = promise; } });
  whileRunning?.(runId);
  await finished?.catch(() => undefined);
  const shown = runs.getRun(runId).events.map((entry: { event: Record<string, unknown> }) => entry.event) as Array<Record<string, unknown>>;
  const stored = (await rows("SELECT event_data FROM agent_run_events WHERE run_id = ? ORDER BY seq", [runId]))
    .map(row => String(row.event_data));
  return { shown, stored: stored.join("\n") };
}

test("run events are shown and stored with placeholders, and a value split across deltas is redacted whole", async () => {
  const [held, token] = [synthetic(), `ghp_${synthetic(36)}`];
  await holding({ VIVARY_PROBE_TOKEN: held });
  const { shown, stored } = await runToEnd(async send => {
    send({ type: "text", text: `Here is the key: ${held.slice(0, 7)}` });
    send({ type: "text", text: held.slice(7, 25) });
    send({ type: "text", text: `${held.slice(25)} and a pattern ${token.slice(0, 10)}` });
    send({ type: "text", text: `${token.slice(10)}.\n` });
    send({ type: "thinking", text: `Thinking about ${held}` });
    send({ type: "tool_start", tool: "probe", id: "tool-1", input: { note: held } });
    send({ type: "tool_done", tool: "probe", id: "tool-1", input: {}, result: `result ${held}` });
    send({ type: "text", text: `Final ${held.slice(0, 20)}` });
    send({ type: "text", text: held.slice(20) });
    send({ type: "done" });
  });
  assertHidden(JSON.stringify(shown) + stored, [held, token], "run events");
  const text = shown.filter(event => event.type === "text").map(event => String(event.text)).join("");
  assertText(text, "Here is the key: [redacted VIVARY_PROBE_TOKEN] and a pattern [redacted credential].\nFinal [redacted VIVARY_PROBE_TOKEN]");
  assertMatch(stored, /result \[redacted VIVARY_PROBE_TOKEN\]/);
  assertText(shown.filter(event => event.type === "thinking").map(event => String(event.text)).join(""),
    "Thinking about [redacted VIVARY_PROBE_TOKEN]");
});

test("a provider error is shown and stored with placeholders", async () => {
  const held = synthetic();
  await holding({ OPENROUTER_API_KEY: held });
  const { shown, stored } = await runToEnd(async send => {
    send({ type: "text", text: "Working" });
    throw new Error(`401 Unauthorized: the key ${held} was rejected`);
  });
  assertHidden(JSON.stringify(shown) + stored, [held], "error events");
  const error = shown.find(event => event.type === "error");
  assertText(String(error?.error), "401 Unauthorized: the key [redacted OPENROUTER_API_KEY] was rejected");
  assertText(shown.filter(event => event.type === "text").map(event => String(event.text)).join(""), "Working");

  await runWithRequestContext({ userEmail: owner }, () => credentialProvider.recordProviderCredentialAuthFailure({
    key: "OPENROUTER_API_KEY", value: held, status: 401, code: "http_401", message: `401 Unauthorized: the key ${held} was rejected` }));
  const settings = (await rows("SELECT value FROM settings")).map(row => String(row.value)).filter(value => value.includes("http_401"));
  assert.equal(settings.length, 1, "the rejected key is recorded once");
  assertHidden(settings[0], [held], "stored provider failure");
  assertMatch(settings[0], /the key \[redacted OPENROUTER_API_KEY\] was rejected/);
});

test("text kept back when a run is stopped is still shown", async () => {
  await holding({});
  const { shown } = await runToEnd(async (send, signal) => {
    send({ type: "text", text: "partial answer" });
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
  }, runId => { setImmediate(() => runs.abortRun(runId)); });
  assertText(shown.filter(event => event.type === "text").map(event => String(event.text)).join(""), "partial answer");
});

test("a saved thread and an automation run error keep placeholders only", async () => {
  const [held, token] = [synthetic(), `sk-proj-${synthetic(48)}`];
  await holding({ VIVARY_PROBE_TOKEN: held });
  const threadId = `thread-${randomUUID()}`;
  await threads.createThread(owner, { id: threadId, title: "Probe" });
  const message = (id: string, role: string, text: string, parentId: string | null) =>
    ({ parentId, message: { id, role, content: [{ type: "text", text }], createdAt: new Date().toISOString(), metadata: {} } });
  const repository = { headId: "m2", messages: [message("m1", "user", `my key is ${held}`, null),
    message("m2", "assistant", `and a pattern ${token}`, "m1")] };
  await threads.updateThreadData(threadId, JSON.stringify(repository), `Key ${held}`, `my key is ${held}`, 2);
  const [saved] = await rows("SELECT thread_data, title, preview FROM chat_threads WHERE id = ?", [threadId]);
  const savedText = `${saved.thread_data}\n${saved.title}\n${saved.preview}`;
  assertHidden(savedText, [held, token], "saved thread");
  assertMatch(String(saved.thread_data), /my key is \[redacted VIVARY_PROBE_TOKEN\]/);
  assertMatch(String(saved.thread_data), /and a pattern \[redacted credential\]/);

  const runId = await automationRuns.startAutomationRun({ owner, automation: "probe", path: "jobs/probe.md" });
  await automationRuns.finishAutomationRun(runId, "error", `step failed with ${held}`, "probe_failed");
  const run = await automationRuns.getAutomationRun(runId);
  assertText(String(run?.error), "step failed with [redacted VIVARY_PROBE_TOKEN]");
});
