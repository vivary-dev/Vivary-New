import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

// Issue #101. OpenRouter ends a failed stream with an in-stream error chunk. The owner must see the
// provider's message and code, with no held credential, instead of "Engine stream error". The
// provider is a loopback fake that speaks OpenRouter's chat completions stream. Every value is
// random and generated for this run. A failed comparison masks the generated values.
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-native-stream-errors-"));
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
const [audit, runs] = await Promise.all([load("audit/redact.js"), load("agent/run-manager.js")]);
const { createAISDKEngine } = await import("@agent-native/core/agent/engine");
const { loadActionsFromStaticRegistry, runAgentLoop, runWithRequestContext } = await import("@agent-native/core/server");
const { heldCredentialHoldback, redactCredentials, refreshHeldCredentials } = await import("../server/credential-redaction.ts");

audit.setTextRedactor?.(redactCredentials, { holdback: () => heldCredentialHoldback?.() ?? 256 });
const generated: string[] = [];
const synthetic = (length = 40) => {
  const value = randomBytes(length * 2).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, length - 2) + "4k";
  generated.push(value);
  return value;
};
const masked = (text: string) => generated.reduce((out, value) => out.split(value).join("<generated>"), text);
function assertText(actual: string, expected: string, label = "") {
  if (actual !== expected) assert.fail(`${label} ${masked(actual)} !== ${masked(expected)}`);
}
function assertHidden(text: string, values: string[], label: string) {
  const shown = values.filter(value => text.includes(value)).length;
  assert.equal(shown, 0, `${label} showed ${shown} generated value(s)`);
}

const METADATA_MARKER = "upstream-metadata-marker";
const userTurn = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

async function fakeOpenRouter(message: string) {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    request.resume();
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (data: unknown) => response.write(`data: ${JSON.stringify(data)}\n\n`);
    chunk({ id: "gen-probe", object: "chat.completion.chunk", created: 0, model: "probe/model",
      choices: [{ index: 0, delta: { role: "assistant", content: "Partial" }, finish_reason: null }] });
    chunk({ error: { code: 502, message, metadata: { provider_name: "Probe", raw: METADATA_MARKER } } });
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const engine = createAISDKEngine("openrouter", { apiKey: synthetic(), baseUrl: `http://127.0.0.1:${port}/api/v1`,
    allowEnvFallback: false });
  return { engine, requests, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

// The AI SDK logs the raw provider error. Vivary's server plugin redacts that log, and this file
// does not load the plugin, so the log is kept off the test output.
async function withoutErrorLog<T>(run: () => Promise<T>): Promise<T> {
  const log = console.error;
  console.error = () => undefined;
  try {
    return await run();
  } finally {
    console.error = log;
  }
}

async function runToEnd(runFn: (send: (event: Record<string, unknown>) => void, signal: AbortSignal) => Promise<void>) {
  const runId = `run-${randomUUID()}`;
  let finished: Promise<unknown> | undefined;
  runs.startRun(runId, `thread-${randomUUID()}`, runFn, async () => undefined, { waitUntil: (promise: Promise<unknown>) => { finished = promise; } });
  await finished?.catch(() => undefined);
  return runs.getRun(runId).events.map((entry: { event: Record<string, unknown> }) => entry.event) as Array<Record<string, unknown>>;
}

test("an in-stream provider error ends the stream with the provider's message and code", async () => {
  const provider = await fakeOpenRouter("Provider returned error");
  try {
    const events = await withoutErrorLog(async () => {
      const seen: Array<Record<string, unknown>> = [];
      for await (const event of provider.engine.stream({ model: "probe/model", systemPrompt: "", tools: [],
        messages: userTurn, abortSignal: new AbortController().signal })) {
        seen.push(event as Record<string, unknown>);
      }
      return seen;
    });
    const stop = events.at(-1);
    assert.deepEqual({ type: stop?.type, reason: stop?.reason, error: stop?.error, errorCode: stop?.errorCode },
      { type: "stop", reason: "error", error: "Provider returned error (code 502)", errorCode: "provider_stream_error" });
    assert.deepEqual(provider.requests, ["POST /api/v1/chat/completions"]);
  } finally {
    await provider.close();
  }
});

test("the run's error event carries the provider's message and code once, with held values as placeholders", async () => {
  const held = synthetic();
  await refreshHeldCredentials({ environment: () => ({ VIVARY_PROBE_TOKEN: held }), mcpConfig: () => null, storedSecrets: async () => [] });
  const provider = await fakeOpenRouter(`Provider returned error for ${held}`);
  try {
    const shown = await withoutErrorLog(() => runToEnd(async (send, signal) => {
      await runWithRequestContext({ userEmail: "owner@example.test", orgId: "org-a", run: {} }, () => runAgentLoop({
        engine: provider.engine, model: "probe/model", systemPrompt: "", tools: [], actions: loadActionsFromStaticRegistry({}),
        messages: userTurn, signal, send }));
    }));
    const text = JSON.stringify(shown);
    assertHidden(text, [held], "run events");
    assert.equal(text.includes(METADATA_MARKER), false, "provider metadata stays out of the run");
    const error = shown.find(event => event.type === "error");
    assertText(String(error?.error), "Provider returned error for [redacted VIVARY_PROBE_TOKEN] (code 502)", "error text");
    assert.equal(error?.errorCode, "provider_stream_error");
    // A transient-looking code in the message must not buy silent retries that hide it.
    assert.deepEqual(provider.requests, ["POST /api/v1/chat/completions"]);
  } finally {
    await provider.close();
  }
});
