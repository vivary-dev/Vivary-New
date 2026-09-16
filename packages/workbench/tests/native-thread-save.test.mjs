import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../../agent/thread-data-builder.js", import.meta.resolve("@agent-native/core/client/agent-chat"));
const { mergeThreadDataForClientSave } = await import(moduleUrl);

const entry = (id, role, parentId, text) => ({
  message: { id, role, content: [{ type: "text", text }] },
  parentId,
});
const user = entry("user-1", "user", null, "Question");
const answer = entry("assistant-1", "assistant", "user-1", "Answer");
const sibling = entry("assistant-branch", "assistant", "user-1", "Other answer");
const voice = entry("voice-1", "user", "assistant-1", "Voice transcript");
const thread = (messages, headId, revision) => ({
  messages,
  headId,
  queuedMessages: [],
  ...(revision === undefined ? {} : { _vivaryHeadRevision: revision }),
});

test("a server save keeps every message and advances the server head revision", () => {
  const saved = mergeThreadDataForClientSave(thread([user], "user-1"), thread([user, answer], "assistant-1", 999));
  assert.deepEqual(saved.messages.map(item => item.message.id), ["user-1", "assistant-1"]);
  assert.equal(saved.headId, "assistant-1");
  assert.equal(saved._vivaryHeadRevision, 1);
});

test("legacy data defaults to revision zero and a content-only save keeps it", () => {
  const edited = entry("user-1", "user", null, "Edited question");
  const saved = mergeThreadDataForClientSave(thread([user], "user-1"), thread([edited], "user-1", 42), { expectedHeadRevision: 0 });
  assert.equal(saved.messages[0].message.content[0].text, "Edited question");
  assert.equal(saved._vivaryHeadRevision, 0);
});

test("a delayed client cannot replace a newer server head", () => {
  const saved = mergeThreadDataForClientSave(thread([user, answer], "assistant-1", 2), thread([user, sibling], "assistant-branch", 1), { expectedHeadRevision: 1 });
  assert.deepEqual(saved.messages.map(item => item.message.id), ["user-1", "assistant-1", "assistant-branch"]);
  assert.equal(saved.headId, "assistant-1");
  assert.equal(saved._vivaryHeadRevision, 2);
});

test("a current revision accepts an intentional earlier sibling and retains delayed descendants", () => {
  const branched = mergeThreadDataForClientSave(thread([user, answer, sibling], "assistant-branch", 2), thread([user, answer], "assistant-1"), { expectedHeadRevision: 2 });
  assert.equal(branched.headId, "assistant-1");
  assert.equal(branched._vivaryHeadRevision, 3);
  const withVoice = mergeThreadDataForClientSave(branched, thread([user, answer, voice], "voice-1"));
  assert.equal(withVoice.messages.some(item => item.message.id === "voice-1"), true);
});
