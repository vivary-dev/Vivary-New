import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const temporary = await mkdtemp(path.join(os.tmpdir(), "vivary-chat-draft-"));
const database = "file:" + path.join(temporary, "draft.sqlite");
Object.assign(process.env, {
  APP_NAME: "VivaryChatDraftTest", AGENT_USER_EMAIL: "owner@example.test",
  DATABASE_URL: database, DATABASE_URL_UNPOOLED: database,
  VIVARYCHATDRAFTTEST_DATABASE_URL: database,
  VIVARYCHATDRAFTTEST_DATABASE_URL_UNPOOLED: database,
});
const { withMigrationRuntime, closeDbExec } = await import("@agent-native/core/db");
const { createThread, updateThreadData, ensureChatThreadTables } = await import(
  new URL("../../chat-threads/store.js", import.meta.resolve("@agent-native/core/client/agent-chat")),
);
const { createVivaryChatIdentity } = await import("../server/chat-identity.ts");
const { assertChatDraftThread, changeChatDraft, chatDraftKey, chatDraftNextSchema,
  createCodeDraftIdentity, readChatDraft,
  reconcileChatDraft, savedThreadHasSubmit } = await import("../server/chat-draft.ts");
const { draftObservation, applyReconciledDraft } = await import("../app/lib/chat-draft.ts");
const owner = "owner@example.test";
const orgId = "org1";
const identity = createVivaryChatIdentity(owner, orgId, { kind: "project", projectId: "p1", label: "P" });

test("Native draft CAS retains pending evidence and a tombstone across stale writes", async t => {
  t.after(async () => { await closeDbExec(); await rm(temporary, { recursive: true, force: true }); });
  await withMigrationRuntime(() => ensureChatThreadTables());
  const threadId = "draft-thread-1";
  assert.equal(await assertChatDraftThread(identity, threadId, owner, orgId), null);
  const otherIdentity = createVivaryChatIdentity(owner, orgId, { kind: "project", projectId: "p2", label: "Other" });
  assert.notEqual(chatDraftKey(identity, threadId), chatDraftKey(otherIdentity, threadId));
  const codeIdentity = createCodeDraftIdentity(owner, orgId, "p1");
  assert.notEqual(chatDraftKey(identity, threadId), chatDraftKey(codeIdentity, threadId));
  assert.notEqual(chatDraftKey(codeIdentity, threadId),
    chatDraftKey(createCodeDraftIdentity(owner, orgId, "p2"), threadId));
  const first = await changeChatDraft(identity, threadId, null,
    { status: "draft", text: "Alpha", submitId: null });
  assert.equal(first.changed, true);
  const submitId = "29cf865b-641d-4415-a42d-df12113e6e0c";
  const firstPending = await changeChatDraft(identity, threadId, first.record,
    { status: "pending", text: "Alpha", submitId });
  assert.equal(firstPending.changed, true);
  assert.equal((await reconcileChatDraft(identity, threadId, owner, orgId)).saved, false);
  const restored = await changeChatDraft(identity, threadId, firstPending.record,
    { status: "draft", text: "Alpha", submitId: null });
  assert.equal(restored.changed, true);
  const pending = await changeChatDraft(identity, threadId, restored.record,
    { status: "pending", text: "Alpha", submitId });
  assert.equal(pending.changed, true);
  const staleEdit = await changeChatDraft(identity, threadId, first.record,
    { status: "draft", text: "Older", submitId: null });
  assert.equal(staleEdit.changed, false);
  assert.deepEqual(staleEdit.record, pending.record);
  assert.deepEqual(await reconcileChatDraft(identity, threadId, owner, orgId),
    { record: pending.record, saved: false });

  await createThread(owner, { id: threadId, orgId, scope: identity.scope });
  await assert.rejects(assertChatDraftThread(otherIdentity, threadId, owner, orgId), { statusCode: 404 });
  await assert.rejects(assertChatDraftThread(identity, threadId, "other@example.test", orgId), { statusCode: 404 });
  const repository = { headId: "user-1", messages: [{
    message: { id: "user-1", role: "user", content: [{ type: "text", text: "Alpha" }],
      metadata: { custom: { agentNativeQueuedMessageId: submitId } } },
    runConfig: { custom: { agentNativeQueuedMessageId: submitId } },
    parentId: null,
  }] };
  assert.equal(savedThreadHasSubmit(JSON.stringify(repository), submitId), true);
  assert.equal(savedThreadHasSubmit(JSON.stringify({ messages: [], queuedMessages: [{ id: submitId, text: "Alpha" }] }), submitId), true);
  await updateThreadData(threadId, JSON.stringify(repository), "Alpha", "Alpha", 1);
  const settled = await reconcileChatDraft(identity, threadId, owner, orgId);
  assert.equal(settled.saved, true);
  assert.equal(settled.record.status, "cleared");
  assert.equal(settled.record.text, "");
  assert.equal((await readChatDraft(identity, threadId)).revision, settled.record.revision);
  const delayedClear = await changeChatDraft(identity, threadId, pending.record,
    { status: "cleared", text: "", submitId: null });
  assert.equal(delayedClear.changed, false);
  const delayedEdit = await changeChatDraft(identity, threadId, first.record,
    { status: "draft", text: "Resurrect", submitId: null });
  assert.equal(delayedEdit.changed, false);
  assert.equal((await readChatDraft(identity, threadId)).status, "cleared");
});

test("draft states reject malformed pending and cleared values", () => {
  assert.equal(chatDraftNextSchema.safeParse({ status: "pending", text: "A", submitId: null }).success, false);
  assert.equal(chatDraftNextSchema.safeParse({ status: "cleared", text: "A", submitId: null }).success, false);
  assert.equal(savedThreadHasSubmit(JSON.stringify({ messages: [{ message: {
    role: "user", content: [{ type: "text", text: "Alpha" }] }, parentId: null }] }),
  "29cf865b-641d-4415-a42d-df12113e6e0c"), false);
});


test("late reconciliation cannot overwrite a newer draft or discard", async () => {
  const pending = { revision: "9f93cd89-54ad-469f-882a-530498a606a6",
    status: "pending", text: "Sent", submitId: "29cf865b-641d-4415-a42d-df12113e6e0c" };
  const newer = { revision: "d50e148d-6913-4715-9025-b553b0d92b89",
    status: "draft", text: "New text", submitId: null };
  const entry = { generation: 0, record: pending, text: "", reset: 1, error: null };
  const observed = draftObservation(entry);
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const arriving = delayed.then(result => applyReconciledDraft(entry, observed, result));
  entry.record = newer;
  entry.text = "New text";
  release({ record: { revision: "61eeb502-4113-4fa7-845c-08e434de6d46",
    status: "cleared", text: "", submitId: null }, saved: true });
  assert.equal(await arriving, false);
  assert.deepEqual(entry.record, newer);
  assert.equal(entry.text, "New text");

  const discardObservation = draftObservation(entry);
  entry.generation++;
  entry.record = { revision: "535c0746-2d58-4c15-8eb8-b130b26a2cd3",
    status: "cleared", text: "", submitId: null };
  assert.equal(applyReconciledDraft(entry, discardObservation,
    { record: pending, saved: false }), false);
  assert.equal(entry.record.status, "cleared");
});
