import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const temporary = await mkdtemp(path.join(os.tmpdir(), "vivary-native-archive-"));
const database = "file:" + path.join(temporary, "archive.sqlite");
Object.assign(process.env, {
  APP_NAME: "VivaryNativeArchiveTest", AGENT_USER_EMAIL: "owner@example.test",
  DATABASE_URL: database, DATABASE_URL_UNPOOLED: database,
  VIVARYNATIVEARCHIVETEST_DATABASE_URL: database,
  VIVARYNATIVEARCHIVETEST_DATABASE_URL_UNPOOLED: database,
});
const { withMigrationRuntime, closeDbExec } = await import("@agent-native/core/db");
const { createThread, getThread, listThreads, setThreadArchived, updateThreadData, ensureChatThreadTables } = await import(
  new URL("../../chat-threads/store.js", import.meta.resolve("@agent-native/core/client/agent-chat")),
);
const { createVivaryChatIdentity } = await import("../server/chat-identity.ts");
const { listArchivedNativeChats, restoreArchivedNativeChat } = await import("../server/native-archive.ts");
const owner = "owner@example.test";
const orgId = "org1";

function repositoryWith(text) {
  return { headId: text + "-user", messages: [{
    message: { id: text + "-user", role: "user", content: [{ type: "text", text }] }, parentId: null,
  }] };
}

test("a project's archived Native chats are listed and restored with history and scope", async t => {
  t.after(async () => { await closeDbExec(); await rm(temporary, { recursive: true, force: true }); });
  await withMigrationRuntime(() => ensureChatThreadTables());
  const p1 = createVivaryChatIdentity(owner, orgId, { kind: "project", projectId: "p1", label: "P1" });
  const p2 = createVivaryChatIdentity(owner, orgId, { kind: "project", projectId: "p2", label: "P2" });
  for (const [id, title, identity] of [["kept", "Kept", p1], ["gone", "Gone", p1], ["later", "Later", p1],
    ["other", "Other", p2]]) {
    await createThread(owner, { id, orgId, scope: identity.scope });
    await updateThreadData(id, JSON.stringify(repositoryWith(title)), title, title, 1);
  }
  assert.deepEqual(await listArchivedNativeChats(p1, owner, orgId), []);
  const before = await getThread("gone");
  for (const id of ["gone", "other", "later"]) {
    assert.equal(await setThreadArchived(id, true, { ownerEmail: owner }), true);
    await delay(5);
  }

  const archived = await listArchivedNativeChats(p1, owner, orgId);
  assert.deepEqual(archived.map(chat => [chat.id, chat.title]), [["later", "Later"], ["gone", "Gone"]]);
  assert.ok(archived.every(chat => Number.isInteger(chat.archivedAt) && chat.archivedAt > 0));
  assert.deepEqual(await listArchivedNativeChats(p1, "other@example.test", orgId), []);
  for (const [identity, threadId, actor, actorOrg] of [[p1, "other", owner, orgId], [p1, "missing", owner, orgId],
    [p1, "gone", "other@example.test", orgId], [p1, "gone", owner, "another-org"], [p2, "gone", owner, orgId]]) {
    await assert.rejects(restoreArchivedNativeChat(identity, threadId, actor, actorOrg), { statusCode: 404 });
  }
  assert.notEqual((await getThread("gone")).archivedAt, null);

  await restoreArchivedNativeChat(p1, "gone", owner, orgId);
  await restoreArchivedNativeChat(p1, "gone", owner, orgId);
  assert.deepEqual((await listArchivedNativeChats(p1, owner, orgId)).map(chat => chat.id), ["later"]);
  const after = await getThread("gone");
  assert.equal(after.archivedAt, null);
  assert.deepEqual(after.scope, before.scope);
  assert.equal(after.threadData, before.threadData);
  assert.equal(after.title, "Gone");
  assert.deepEqual((await listThreads(owner, { scope: p1.scope, orgId })).map(chat => chat.id).sort(), ["gone", "kept"]);
  assert.notEqual((await getThread("other")).archivedAt, null);
});
