import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

// Issue #103. A Native turn records the provider's reported cost, including 0. A model with no price
// and no reported cost records an unknown cost, never a guess. The provider is a loopback fake that
// speaks OpenRouter's chat completions stream and reports usage in its last chunk, as OpenRouter does.
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-native-usage-cost-"));
const database = `file:${path.join(caseRoot, "usage.sqlite")}`;
Object.assign(process.env, { APP_NAME: "Vivary", NODE_ENV: "production", DATABASE_URL: database, DATABASE_URL_UNPOOLED: database });
after(() => rm(caseRoot, { recursive: true, force: true }));

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = (relative: string) => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [agent, store, metrics] = await Promise.all([load("agent/production-agent.js"), load("usage/store.js"),
  load("usage/metrics-store.js")]);
const { createAISDKEngine } = await import("@agent-native/core/agent/engine");
const { getDbExec } = await import("@agent-native/core/db");
const { loadActionsFromStaticRegistry, runAgentLoop, runWithRequestContext } = await import("@agent-native/core/server");

const INPUT_TOKENS = 1_000;
const OUTPUT_TOKENS = 200;
// At Sonnet's $3 input and $15 output per million tokens, 1,000 and 200 tokens cost 60 centicents.
const SONNET_CENTICENTS = 60;
const userTurn = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

const chunkOf = (fields: Record<string, unknown>) => ({ id: "gen-probe", object: "chat.completion.chunk", created: 0,
  model: "probe/model", ...fields });
const chunks = (cost?: number) => [
  chunkOf({ choices: [{ index: 0, delta: { role: "assistant", content: "Hello" }, finish_reason: null }] }),
  chunkOf({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
  chunkOf({ choices: [], usage: { prompt_tokens: INPUT_TOKENS, completion_tokens: OUTPUT_TOKENS,
    total_tokens: INPUT_TOKENS + OUTPUT_TOKENS, ...(cost === undefined ? {} : { cost }) } }),
];

async function fakeOpenRouter(cost?: number) {
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { "content-type": "text/event-stream" });
    for (const chunk of chunks(cost)) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const engine = createAISDKEngine("openrouter", { apiKey: randomBytes(24).toString("hex"),
    baseUrl: `http://127.0.0.1:${port}/api/v1`, allowEnvFallback: false });
  return { engine, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

async function usageEvent(cost?: number) {
  const provider = await fakeOpenRouter(cost);
  try {
    for await (const event of provider.engine.stream({ model: "probe/model", systemPrompt: "", tools: [], messages: userTurn,
      abortSignal: new AbortController().signal })) {
      if (event.type === "usage") return event as Record<string, unknown>;
    }
    return undefined;
  } finally {
    await provider.close();
  }
}

// One main chat turn: the agent loop's usage events go into the turn's usage, which the chat
// handler records when the turn ends.
async function recordTurn(model: string, cost?: number) {
  const owner = `owner-${randomUUID()}@example.test`;
  const runId = `run-${randomUUID()}`;
  const turn = agent.createTurnUsage(model);
  const provider = await fakeOpenRouter(cost);
  try {
    await runWithRequestContext({ userEmail: owner, run: {} }, () => runAgentLoop({ engine: provider.engine, model,
      systemPrompt: "", tools: [], actions: loadActionsFromStaticRegistry({}), messages: userTurn,
      signal: new AbortController().signal, send: () => undefined, onUsage: turn.add }));
  } finally {
    await provider.close();
  }
  await store.recordUsage({ ownerEmail: owner, ...turn.usageRecord(), label: "chat", runId });
  const { rows } = await getDbExec().execute({
    sql: "SELECT input_tokens, output_tokens, cost_cents_x100, cost_source FROM token_usage WHERE run_id = ?", args: [runId] });
  return rows.map(row => ({ tokens: Number(row.input_tokens) + Number(row.output_tokens),
    centicents: Number(row.cost_cents_x100), source: String(row.cost_source) }));
}

test("the engine's usage event carries the cost the provider reports", async t => {
  await t.test("a reported cost of 0", async () => {
    const event = await usageEvent(0);
    assert.deepEqual({ inputTokens: event?.inputTokens, outputTokens: event?.outputTokens, costUsd: event?.costUsd },
      { inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS, costUsd: 0 });
  });
  await t.test("a reported positive cost", async () => {
    assert.equal((await usageEvent(0.0123))?.costUsd, 0.0123);
  });
  await t.test("no reported cost", async () => {
    const event = await usageEvent();
    assert.equal(event?.inputTokens, INPUT_TOKENS);
    assert.equal("costUsd" in (event ?? {}), false);
  });
});

const turns: Array<{ name: string; model: string; cost?: number; row: { centicents: number; source: string } }> = [
  { name: "a stream that reports a cost of 0 records $0", model: "probe/free-model", cost: 0,
    row: { centicents: 0, source: "reported" } },
  { name: "a stream that reports a positive cost records it", model: "probe/paid-model", cost: 0.0123,
    row: { centicents: 123, source: "reported" } },
  { name: "a reported cost wins over the price table", model: "anthropic/claude-sonnet-5", cost: 0.0123,
    row: { centicents: 123, source: "reported" } },
  { name: "a model with no price and no reported cost records an unknown cost", model: "probe/unpriced-model",
    row: { centicents: 0, source: "unavailable" } },
  { name: "a priced model with no reported cost keeps its table price", model: "anthropic/claude-sonnet-5",
    row: { centicents: SONNET_CENTICENTS, source: "estimated" } },
];

test("a main chat turn records its cost", async t => {
  for (const turn of turns) {
    await t.test(turn.name, async () => {
      assert.deepEqual(await recordTurn(turn.model, turn.cost), [{ tokens: INPUT_TOKENS + OUTPUT_TOKENS, ...turn.row }]);
    });
  }
});

// Traces and integration budgets price tokens with calculateCost too.
test("the price table has no catch-all price and still prices Sonnet", () => {
  assert.deepEqual({
    unpriced: store.calculateCost(INPUT_TOKENS, OUTPUT_TOKENS, "probe/unpriced-model"),
    sonnet: store.calculateCost(INPUT_TOKENS, OUTPUT_TOKENS, "claude-sonnet-5"),
    routedSonnet: store.calculateCost(INPUT_TOKENS, OUTPUT_TOKENS, "anthropic/claude-sonnet-5"),
  }, { unpriced: 0, sonnet: SONNET_CENTICENTS, routedSonnet: SONNET_CENTICENTS });
});

test("the Usage tab's metrics count the calls whose cost is unknown", async () => {
  const owner = `owner-${randomUUID()}@example.test`;
  const call = { ownerEmail: owner, inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS, label: "chat" };
  await store.recordUsage({ ...call, model: "probe/free-model", costCentsX100: 0, costSource: "reported" });
  await store.recordUsage({ ...call, model: "probe/unpriced-model" });
  await store.recordUsage({ ...call, model: "anthropic/claude-sonnet-5" });
  const usage = await metrics.listAppUsageMetrics({ scope: "me", sinceDays: 30 }, { ownerEmail: owner, orgId: null, app: "vivary" });
  const figure = (value: { costCents: number; calls: number; unknownCostCalls?: number }) =>
    ({ costCents: value.costCents, calls: value.calls, unknownCostCalls: value.unknownCostCalls });
  const known = { costCents: SONNET_CENTICENTS / 100, calls: 3, unknownCostCalls: 1 };
  assert.deepEqual({
    totals: figure(usage.totals),
    currentDay: figure(usage.currentDay),
    daily: usage.daily.map(figure),
    byLabel: usage.byLabel.map(figure),
    byModel: Object.fromEntries(usage.byModel.map((row: { key: string; costCents: number; calls: number }) => [row.key, figure(row)])),
    recent: Object.fromEntries(usage.recent.map((row: { model: string; costSource?: string }) => [row.model, row.costSource])),
  }, {
    totals: known,
    currentDay: known,
    daily: [known],
    byLabel: [known],
    byModel: {
      "anthropic/claude-sonnet-5": { costCents: SONNET_CENTICENTS / 100, calls: 1, unknownCostCalls: 0 },
      "probe/free-model": { costCents: 0, calls: 1, unknownCostCalls: 0 },
      "probe/unpriced-model": { costCents: 0, calls: 1, unknownCostCalls: 1 },
    },
    recent: { "anthropic/claude-sonnet-5": "estimated", "probe/free-model": "reported", "probe/unpriced-model": "unavailable" },
  });
});
