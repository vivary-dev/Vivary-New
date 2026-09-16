import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const temporary = await mkdtemp(path.join(os.tmpdir(), "vivary-thread-save-"));
const database = "file:" + path.join(temporary, "threads.sqlite");
Object.assign(process.env, {
  APP_NAME: "VivaryThreadSaveTest",
  DATABASE_URL: database, DATABASE_URL_UNPOOLED: database,
  VIVARYTHREADSAVETEST_DATABASE_URL: database,
  VIVARYTHREADSAVETEST_DATABASE_URL_UNPOOLED: database,
});
const { withMigrationRuntime, closeDbExec } = await import("@agent-native/core/db");
const { createThread, ensureChatThreadTables, getThread, updateThreadData } = await import(
  new URL("../../chat-threads/store.js", import.meta.resolve("@agent-native/core/client/agent-chat")),
);
const user = { message: { id: "user", role: "user", content: [{ type: "text", text: "Question" }] }, parentId: null };
const answer = id => ({ message: { id, role: "assistant", content: [{ type: "text", text: id }] }, parentId: "user" });
const repo = (headId, messages = [user, answer("a"), answer("b"), answer("c")]) => ({ headId, messages });
const write = (id, snapshot, options) => updateThreadData(id, JSON.stringify(snapshot), "Thread", "Preview", snapshot.messages.length, options);

test("SQLite saves enforce observed head revisions during real write conflicts", async t => {
  t.after(async () => { await closeDbExec(); await rm(temporary, { recursive: true, force: true }); });
  await withMigrationRuntime(() => ensureChatThreadTables());
  const thread = await createThread("owner@example.test");
  const first = await write(thread.id, repo("user", [user]));
  const completed = await write(thread.id, repo("a", [user, answer("a")]));
  const delayed = await write(thread.id, repo("user", [user]), { expectedHeadRevision: first.headRevision });
  assert.equal(delayed.headApplied, false);
  assert.equal(delayed.headId, "a");
  assert.equal(delayed.headRevision, completed.headRevision);
  let stored = JSON.parse((await getThread(thread.id)).threadData);
  assert.equal(stored.headId, "a");
  assert.equal(stored.messages.some(entry => entry.message.id === "a"), true);

  const results = await Promise.all([
    write(thread.id, repo("b"), { expectedHeadRevision: completed.headRevision }),
    write(thread.id, repo("c"), { expectedHeadRevision: completed.headRevision }),
  ]);
  assert.equal(results.filter(result => result.headApplied).length, 1);
  stored = JSON.parse((await getThread(thread.id)).threadData);
  assert.equal(stored.headId, results.find(result => result.headApplied).headId);
  assert.equal(stored._vivaryHeadRevision, completed.headRevision + 1);
  assert.deepEqual(new Set(stored.messages.map(entry => entry.message.id)), new Set(["user", "a", "b", "c"]));

  const selected = await write(thread.id, repo("a"), { expectedHeadRevision: stored._vivaryHeadRevision });
  assert.equal(selected.headApplied, true);
  assert.equal(selected.headId, "a");
  const oldFullSnapshot = await write(thread.id, repo("b"), { expectedHeadRevision: completed.headRevision });
  assert.equal(oldFullSnapshot.headApplied, false);
  assert.equal(oldFullSnapshot.headId, "a");
  assert.equal(oldFullSnapshot.headRevision, selected.headRevision);

  const beforeInvalid = (await getThread(thread.id)).threadData;
  for (const malformed of ["not json", "null", "[]", JSON.stringify({ headId: "user" })]) {
    await assert.rejects(updateThreadData(thread.id, malformed, "Invalid", "", 0,
      { expectedHeadRevision: selected.headRevision }));
    assert.equal((await getThread(thread.id)).threadData, beforeInvalid);
  }

  const legacyClient = await write(thread.id, repo("user"), { expectedHeadRevision: -1 });
  assert.equal(legacyClient.headApplied, false);
  assert.equal(legacyClient.headId, "a");
});
