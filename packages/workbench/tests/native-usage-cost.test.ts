import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { z } from "zod";

// Issue #103. A Native turn records the provider's reported cost, including 0. A model with no price
// and no reported cost records an unknown cost, never a guess. The provider is a loopback fake that
// speaks OpenRouter's chat completions stream and reports usage in its last chunk, as OpenRouter does.
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-native-usage-cost-"));
const database = `file:${path.join(caseRoot, "usage.sqlite")}`;
Object.assign(process.env, { APP_NAME: "Vivary", NODE_ENV: "production", DATABASE_URL: database, DATABASE_URL_UNPOOLED: database });
after(() => rm(caseRoot, { recursive: true, force: true }));

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const coreUrl = (relative: string) => pathToFileURL(path.join(coreRoot, "dist", relative)).href;
const load = (relative: string) => import(coreUrl(relative));
const [agent, store, metrics, alerts, budgets, webhooks] = await Promise.all([load("agent/production-agent.js"),
  load("usage/store.js"), load("usage/metrics-store.js"), load("usage/alerts-store.js"),
  load("integrations/usage-budget-store.js"), load("integrations/webhook-handler.js")]);
const { defineAction } = await import("@agent-native/core/action");
const { createAISDKEngine } = await import("@agent-native/core/agent/engine");
const { getDbExec } = await import("@agent-native/core/db");
const { actionsToEngineTools, loadActionsFromStaticRegistry, runAgentLoop, runWithRequestContext } =
  await import("@agent-native/core/server");

const INPUT_TOKENS = 1_000;
const OUTPUT_TOKENS = 200;
// At Sonnet's $3 input and $15 output per million tokens, 1,000 and 200 tokens cost 60 centicents.
const SONNET_CENTICENTS = 60;
const userTurn = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];
const actions = loadActionsFromStaticRegistry({ "probe-read": { default: defineAction({ description: "Read the project.",
  schema: z.object({}), agentTool: true, http: false, readOnly: true, dedupe: false, run: async () => "read" }) } });

const chunkOf = (fields: Record<string, unknown>) => ({ id: "gen-probe", object: "chat.completion.chunk", created: 0,
  model: "probe/model", ...fields });
const usageChunk = (cost?: number) => chunkOf({ choices: [], usage: { prompt_tokens: INPUT_TOKENS,
  completion_tokens: OUTPUT_TOKENS, total_tokens: INPUT_TOKENS + OUTPUT_TOKENS, ...(cost === undefined ? {} : { cost }) } });
const send = (response: ServerResponse, chunk: Record<string, unknown>) => response.write(`data: ${JSON.stringify(chunk)}\n\n`);

// `Respond` answers the provider request with that index.
type Respond = (response: ServerResponse, index: number) => void;
const answer = (cost?: number): Respond => response => {
  send(response, chunkOf({ choices: [{ index: 0, delta: { role: "assistant", content: "Hello" }, finish_reason: null }] }));
  send(response, chunkOf({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }));
  send(response, usageChunk(cost));
  response.end("data: [DONE]\n\n");
};
const callTool = (cost?: number): Respond => response => {
  send(response, chunkOf({ choices: [{ index: 0, delta: { role: "assistant", content: null, tool_calls: [{ index: 0,
    id: "call-read", type: "function", function: { name: "probe-read", arguments: "{}" } }] }, finish_reason: null }] }));
  send(response, chunkOf({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }));
  send(response, usageChunk(cost));
  response.end("data: [DONE]\n\n");
};
// OpenRouter's in-stream error, as a free model returns it when it is rate limited.
const rateLimited: Respond = response => {
  send(response, { error: { code: 429, message: "Rate limit exceeded" } });
  response.end("data: [DONE]\n\n");
};
const holdReply: Respond = response => {
  send(response, chunkOf({ choices: [{ index: 0, delta: { role: "assistant", content: "Partial" }, finish_reason: null }] }));
};
// OpenRouter's in-stream error after streamed text, which the loop does not retry.
const cutByProviderError: Respond = response => {
  send(response, chunkOf({ choices: [{ index: 0, delta: { role: "assistant", content: "Partial" }, finish_reason: null }] }));
  send(response, { error: { code: 502, message: "Upstream provider failed" } });
  response.end("data: [DONE]\n\n");
};
const answerWithoutUsage: Respond = response => {
  send(response, chunkOf({ choices: [{ index: 0, delta: { role: "assistant", content: "Hello" }, finish_reason: null }] }));
  send(response, chunkOf({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }));
  response.end("data: [DONE]\n\n");
};

async function fakeOpenRouter(respond: Respond) {
  let requests = 0;
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { "content-type": "text/event-stream" });
    respond(response, requests++);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const engine = createAISDKEngine("openrouter", { apiKey: randomBytes(24).toString("hex"),
    baseUrl: `http://127.0.0.1:${port}/api/v1`, allowEnvFallback: false });
  const close = () => new Promise<void>(resolve => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
  return { engine, requests: () => requests, close };
}

async function usageEvent(cost?: number) {
  const provider = await fakeOpenRouter(answer(cost));
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
// handler records when the turn ends, also after a Stop or a thrown loop. `stopOnText` presses Stop
// at the turn's first streamed text. `throws` expects the loop to throw.
async function recordTurn(model: string, respond: Respond, { stopOnText = false, throws = false } = {}) {
  const owner = `owner-${randomUUID()}@example.test`;
  const runId = `run-${randomUUID()}`;
  const turn = agent.createTurnUsage(model);
  const provider = await fakeOpenRouter(respond);
  const stop = new AbortController();
  let threw = false;
  try {
    await runWithRequestContext({ userEmail: owner, run: {} }, () => runAgentLoop({ engine: provider.engine, model,
      systemPrompt: "", tools: actionsToEngineTools(actions), actions, messages: userTurn, signal: stop.signal,
      send: (event: { type: string }) => { if (stopOnText && event.type === "text") stop.abort(); },
      onUsage: turn.add, onModelCall: turn.startCall })).catch((error: unknown) => {
      if (stop.signal.aborted) return;
      if (!throws) throw error;
      threw = true;
    });
  } finally {
    await provider.close();
  }
  await store.recordUsage({ ownerEmail: owner, ...turn.usageRecord(), label: "chat", runId });
  const { rows } = await getDbExec().execute({
    sql: "SELECT input_tokens, output_tokens, cost_cents_x100, cost_source FROM token_usage WHERE run_id = ?", args: [runId] });
  return { requests: provider.requests(), threw, rows: rows.map(row => ({
    tokens: Number(row.input_tokens) + Number(row.output_tokens), centicents: Number(row.cost_cents_x100),
    source: String(row.cost_source) })) };
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

const turns: Array<{ name: string; model: string; respond: Respond; stopOnText?: boolean; throws?: boolean;
  requests?: number; row: { centicents: number; source: string } }> = [
  { name: "a stream that reports a cost of 0 records $0", model: "probe/free-model", respond: answer(0),
    row: { centicents: 0, source: "reported" } },
  { name: "a stream that reports a positive cost records it", model: "probe/paid-model", respond: answer(0.0123),
    row: { centicents: 123, source: "reported" } },
  { name: "a reported cost wins over the price table", model: "anthropic/claude-sonnet-5", respond: answer(0.0123),
    row: { centicents: 123, source: "reported" } },
  { name: "a model with no price and no reported cost records an unknown cost", model: "probe/unpriced-model",
    respond: answer(), row: { centicents: 0, source: "unavailable" } },
  { name: "a priced model with no reported cost keeps its table price", model: "anthropic/claude-sonnet-5",
    respond: answer(), row: { centicents: SONNET_CENTICENTS, source: "estimated" } },
  // The retry replaces the failed attempt, which costs nothing.
  { name: "a rate-limited attempt and a retry that reports a cost of 0 record $0", model: "probe/free-model",
    respond: (response, index) => (index === 0 ? rateLimited : answer(0))(response, index), requests: 2,
    row: { centicents: 0, source: "reported" } },
  // The stopped call reports no usage, so the reported cost of the first call is not the turn's cost.
  { name: "a turn stopped during its second call records no reported cost", model: "probe/paid-model",
    respond: (response, index) => (index === 0 ? callTool(0.0123) : holdReply)(response, index), stopOnText: true,
    requests: 2, row: { centicents: 0, source: "unavailable" } },
  // A call that ends with empty usage reports no cost, whether an error cut it off or its stream
  // carried no usage chunk.
  { name: "a turn whose second call a provider error cuts off records no reported cost", model: "probe/paid-model",
    respond: (response, index) => (index === 0 ? callTool(0.0123) : cutByProviderError)(response, index), throws: true,
    requests: 2, row: { centicents: 0, source: "unavailable" } },
  { name: "a turn whose second call reports no usage records no reported cost", model: "probe/paid-model",
    respond: (response, index) => (index === 0 ? callTool(0.0123) : answerWithoutUsage)(response, index), requests: 2,
    row: { centicents: 0, source: "unavailable" } },
];

test("a main chat turn records its cost", async t => {
  for (const turn of turns) {
    await t.test(turn.name, async () => {
      assert.deepEqual(await recordTurn(turn.model, turn.respond, { stopOnText: turn.stopOnText, throws: turn.throws }), {
        requests: turn.requests ?? 1, threw: turn.throws ?? false,
        rows: [{ tokens: INPUT_TOKENS + OUTPUT_TOKENS, ...turn.row }] });
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

const figure = (value: { costCents: number; calls: number; unknownCostCalls?: number }) =>
  ({ costCents: value.costCents, calls: value.calls, unknownCostCalls: value.unknownCostCalls });
const usageFor = (owner: string) =>
  metrics.listAppUsageMetrics({ scope: "me", sinceDays: 30 }, { ownerEmail: owner, orgId: null, app: "vivary" });

test("the Usage tab's metrics count the calls whose cost is unknown", async () => {
  const owner = `owner-${randomUUID()}@example.test`;
  const call = { ownerEmail: owner, inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS, label: "chat" };
  await store.recordUsage({ ...call, model: "probe/free-model", costCentsX100: 0, costSource: "reported" });
  await store.recordUsage({ ...call, model: "probe/unpriced-model" });
  await store.recordUsage({ ...call, model: "anthropic/claude-sonnet-5" });
  const usage = await usageFor(owner);
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

// The tab lists four models. Five priced models cost more than the unpriced one's known cost of 0.
test("the Usage tab's model list keeps a model whose cost is unknown", async () => {
  const owner = `owner-${randomUUID()}@example.test`;
  for (const model of ["probe/unpriced-model", "anthropic/claude-sonnet-5", "mistral-large-latest", "anthropic/claude-haiku-5",
    "openai/gpt-5.6-luna", "google/gemini-3.5-flash"]) {
    await store.recordUsage({ ownerEmail: owner, inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS, label: "chat", model });
  }
  const usage = await usageFor(owner);
  assert.deepEqual(usage.byModel.map((row: { key: string }) => row.key),
    ["probe/unpriced-model", "anthropic/claude-sonnet-5", "mistral-large-latest", "anthropic/claude-haiku-5"]);
});

// Rows written before this change hold the catch-all Sonnet price for models the table does not
// price. The table setup runs once per process, so a fresh copy of the store module stands in for
// the first start after an upgrade.
type OldRow = { model: string; centicents: number; source: string };
const insertOldRow = (owner: string, row: OldRow, index: number) => getDbExec().execute({
  sql: `INSERT INTO token_usage (id, owner_email, input_tokens, output_tokens, cost_cents_x100, cost_source, model, label,
    app, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'chat', 'Vivary', ?)`,
  args: [Date.now() * 1000 + index, owner, INPUT_TOKENS, OUTPUT_TOKENS, row.centicents, row.source, row.model, Date.now()],
});
const rowsOf = async (owner: string, order: "id" | "model"): Promise<OldRow[]> => (await getDbExec().execute({
  sql: `SELECT model, cost_cents_x100, cost_source FROM token_usage WHERE owner_email = ? ORDER BY ${order}`, args: [owner] }))
  .rows.map(row => ({ model: String(row.model), centicents: Number(row.cost_cents_x100), source: String(row.cost_source) }));
const startStore = async (start: string) => import(`${coreUrl("usage/store.js")}?start=${start}-${randomUUID()}`);

test("setup marks the old guesses for unpriced models unknown and keeps every other row", async () => {
  const owner = `owner-${randomUUID()}@example.test`;
  await store.ensureUsageTable();
  const oldRows = [
    { model: "stealth/space-bunny-alpha", centicents: 930, source: "estimated" },
    { model: "anthropic/claude-sonnet-5", centicents: SONNET_CENTICENTS, source: "estimated" },
    { model: "probe/free-model", centicents: 0, source: "reported" },
    { model: "probe/paid-model", centicents: 123, source: "reported" },
  ];
  for (const [index, row] of oldRows.entries()) await insertOldRow(owner, row, index);
  for (const start of ["first", "second"]) await (await startStore(start)).ensureUsageTable();
  const usage = await usageFor(owner);
  assert.deepEqual({
    rows: await rowsOf(owner, "id"),
    unknownModel: figure(usage.byModel.find((row: { key: string }) => row.key === "stealth/space-bunny-alpha")),
  }, {
    rows: [{ model: "stealth/space-bunny-alpha", centicents: 0, source: "unavailable" }, ...oldRows.slice(1)],
    unknownModel: { costCents: 0, calls: 1, unknownCostCalls: 1 },
  });
});

// A database can refuse the conversion, for example a role without UPDATE on the table. Setup logs the
// failure and finishes, so usage still records, and the next start converts the rows.
test("a failed conversion of old rows logs and still lets usage record", async () => {
  const owner = `owner-${randomUUID()}@example.test`;
  await store.ensureUsageTable();
  await insertOldRow(owner, { model: "stealth/space-bunny-alpha", centicents: 930, source: "estimated" }, 0);
  const trigger = `refuse_conversion_${randomBytes(4).toString("hex")}`;
  await getDbExec().execute(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON token_usage WHEN OLD.owner_email = '${owner}'
    BEGIN SELECT RAISE(ABORT, 'conversion refused'); END`);
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
  let recorded: string;
  try {
    recorded = await (await startStore("refused")).recordUsage({ ownerEmail: owner, inputTokens: INPUT_TOKENS,
      outputTokens: OUTPUT_TOKENS, label: "chat", model: "probe/free-model", costCentsX100: 0, costSource: "reported" })
      .then(() => "recorded", (error: Error) => error.message);
  } finally {
    console.warn = warn;
    await getDbExec().execute(`DROP TRIGGER ${trigger}`);
  }
  const afterRefusal = await rowsOf(owner, "model");
  await (await startStore("next")).ensureUsageTable();
  assert.deepEqual({ recorded, warned: warnings.some(line => line.includes("conversion refused")), afterRefusal,
    afterNextStart: await rowsOf(owner, "model") }, {
    recorded: "recorded",
    warned: true,
    afterRefusal: [{ model: "probe/free-model", centicents: 0, source: "reported" },
      { model: "stealth/space-bunny-alpha", centicents: 930, source: "estimated" }],
    afterNextStart: [{ model: "probe/free-model", centicents: 0, source: "reported" },
      { model: "stealth/space-bunny-alpha", centicents: 0, source: "unavailable" }],
  });
});

test("a cost alert counts the calls whose cost is unknown", async () => {
  const owner = `owner-${randomUUID()}@example.test`;
  const call = { ownerEmail: owner, inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS, label: "chat" };
  await store.recordUsage({ ...call, model: "probe/unpriced-model" });
  await store.recordUsage({ ...call, model: "anthropic/claude-sonnet-5" });
  const rules = await alerts.listUsageAlerts({ scope: "user", appId: "vivary" }, { ownerEmail: owner, orgId: null });
  const daily = rules.find((rule: { unit: string; period: string }) => rule.unit === "usd" && rule.period === "day");
  assert.deepEqual({ centicents: Math.round(daily.current * 10_000), unknownCostCalls: daily.unknownCostCalls },
    { centicents: SONNET_CENTICENTS, unknownCostCalls: 1 });
});

// An integration run reserves its estimate and settles at its cost. That is the provider's reported
// cost, the table price, or 0 when the run used no tokens. An unknown cost settles at the reservation,
// so a budget cap still fills. The usage has the shape `createTurnUsage` records for the run.
test("an integration budget settles a run at its reported cost, its table price, 0, or its reservation", async () => {
  const RESERVATION_MICROS = 5_000_000;
  const settle = async (usage: { model: string; inputTokens?: number; outputTokens?: number; costCentsX100?: number }) => {
    const access = { ownerEmail: `owner-${randomUUID()}@example.test`, orgId: null };
    const budget = await budgets.saveIntegrationUsageBudget({ subject: { type: "user", userEmail: access.ownerEmail },
      period: "day", limitMicros: 4 * RESERVATION_MICROS }, access);
    const reservation = { budgetId: budget.id, reservationId: `run-${randomUUID()}`, estimatedCostMicros: RESERVATION_MICROS };
    await budgets.reserveIntegrationUsageBudget(reservation, access);
    await webhooks.settleApplicableIntegrationBudgets([{ ...reservation, access }], { inputTokens: INPUT_TOKENS,
      outputTokens: OUTPUT_TOKENS, cacheReadTokens: 0, cacheWriteTokens: 0, ...usage });
    const snapshot = await budgets.getIntegrationBudgetSnapshot(budget.id, access);
    return { usedMicros: snapshot.usedMicros, reservedMicros: snapshot.reservedMicros };
  };
  const unpriced = "probe/unpriced-model";
  const sonnet = "anthropic/claude-sonnet-5";
  assert.deepEqual({
    reported: await settle({ model: unpriced, costCentsX100: 123 }),
    reportedFree: await settle({ model: unpriced, costCentsX100: 0 }),
    noTokens: await settle({ model: unpriced, inputTokens: 0, outputTokens: 0 }),
    unknown: await settle({ model: unpriced }),
    sonnet: await settle({ model: sonnet }),
    reportedSonnet: await settle({ model: sonnet, costCentsX100: 123 }),
  }, {
    // One centicent is 100 currency micros.
    reported: { usedMicros: 12_300, reservedMicros: 0 },
    reportedFree: { usedMicros: 0, reservedMicros: 0 },
    noTokens: { usedMicros: 0, reservedMicros: 0 },
    unknown: { usedMicros: RESERVATION_MICROS, reservedMicros: 0 },
    sonnet: { usedMicros: SONNET_CENTICENTS * 100, reservedMicros: 0 },
    reportedSonnet: { usedMicros: 12_300, reservedMicros: 0 },
  });
});
