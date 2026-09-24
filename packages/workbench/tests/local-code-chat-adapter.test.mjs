import assert from "node:assert/strict";
import test from "node:test";
import { createLocalCodeChatAdapter } from "../app/lib/local-code-chat-adapter.ts";

function adapterForTest(rejections, actions, engine = "codex-cli") {
  return createLocalCodeChatAdapter({
    context: { engineRef: { current: engine }, modelRef: { current: "fixture-model" } },
    call: async (...args) => { actions.push(args); throw new Error("No owner action expected"); },
    projectId: "project-one",
    draftThreadId: "original-draft-id",
    runIdRef: { current: null },
    engines: () => [{ engine: "codex-cli", models: ["fixture-model"] }],
    onKnownRejected: async submitId => { rejections.push(submitId); },
    onStarted: () => {},
    onStreaming: () => {},
    onSettled: () => {},
  });
}

test("Code local validation restores a known rejected draft before any owner action", async () => {
  const rejections = [], actions = [];
  const adapter = adapterForTest(rejections, actions);
  const input = {
    messages: [{ role: "user", content: [{ type: "text", text: "x".repeat(8_001) }] }],
    runConfig: { custom: { agentNativeQueuedMessageId: "submit-one" } },
    abortSignal: new AbortController().signal,
  };
  await assert.rejects(async () => {
    for await (const _ of adapter.run(input)) {}
  }, /under 8,000 characters/);
  assert.deepEqual(rejections, ["submit-one"]);
  assert.deepEqual(actions, []);
});

test("Code unavailable runtime rejection retains the original submit identity", async () => {
  const rejections = [], actions = [];
  const adapter = adapterForTest(rejections, actions, "missing-runtime");
  await assert.rejects(async () => {
    for await (const _ of adapter.run({
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
      runConfig: { custom: { agentNativeQueuedMessageId: "submit-two" } },
      abortSignal: new AbortController().signal,
    })) {}
  }, /available runtime/);
  assert.deepEqual(rejections, ["submit-two"]);
  assert.deepEqual(actions, []);
});

test("an uncertain Code owner failure keeps its pending submission for reconciliation", async () => {
  const rejections = [], actions = [];
  const adapter = adapterForTest(rejections, actions);
  await assert.rejects(async () => {
    for await (const _ of adapter.run({
      messages: [{ role: "user", content: [{ type: "text", text: "send to owner" }] }],
      runConfig: { custom: { agentNativeQueuedMessageId: "submit-uncertain" } },
      abortSignal: new AbortController().signal,
    })) {}
  }, /No owner action expected/);
  assert.equal(actions.length, 1);
  assert.equal(actions[0][0], "vivary-code-send");
  assert.deepEqual(rejections, []);
});
