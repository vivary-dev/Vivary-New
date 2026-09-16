import assert from "node:assert/strict";
import test from "node:test";
import { vivaryChatScope } from "../app/lib/chat-scope.ts";

test("builds a deterministic organization-qualified scope", () => {
  assert.deepEqual(vivaryChatScope("org-a"), {
    type: "workspace-app",
    id: "vivary-workbench-chat-v1:org-a",
    label: "Vivary",
  });
  assert.deepEqual(vivaryChatScope("org-a"), vivaryChatScope("org-a"));
  assert.deepEqual([
    vivaryChatScope("a")?.id,
    vivaryChatScope("a-b")?.id,
    vivaryChatScope("a_b")?.id,
  ], [
    "vivary-workbench-chat-v1:a",
    "vivary-workbench-chat-v1:a-b",
    "vivary-workbench-chat-v1:a_b",
  ]);
});

test("bounds the scope and rejects invalid organization IDs", () => {
  const longest = vivaryChatScope("a".repeat(128));
  assert.equal(longest?.id.length, 153);
  for (const orgId of ["", "a b", "a:b", "a".repeat(129)]) {
    assert.equal(vivaryChatScope(orgId), null);
  }
});


test("project identities keep actor, organization and Personal separate", async () => {
  const { createVivaryChatIdentity } = await import("../server/chat-identity.ts");
  const identity = (owner: string, org: string, projectId: string | null) =>
    createVivaryChatIdentity(owner, org, { kind: "project", projectId, label: "A project" });
  const a = identity("owner@example.test", "org-a", "project-a");
  assert.deepEqual(a, identity(" OWNER@example.test ", "org-a", "project-a"));
  const alternatives = [identity("owner@example.test", "org-a", "project-b"),
    identity("owner@example.test", "org-a", null), identity("owner@example.test", "org-b", "project-a"),
    identity("other@example.test", "org-a", "project-a")];
  assert.equal(new Set([a, ...alternatives].map(value => value.scope.id)).size, 5);
  assert.equal(a.scope.id.includes("owner@example.test"), false);
  assert.equal(a.scope.id.length, 87);
  const renamed = createVivaryChatIdentity("owner@example.test", "org-a",
    { kind: "project", projectId: "project-a", label: "Renamed project" });
  assert.equal(renamed.scope.id, a.scope.id);
  assert.equal(renamed.storageKey, a.storageKey);
  const legacy = createVivaryChatIdentity("owner@example.test", "org-a", { kind: "unassigned" });
  assert.deepEqual(legacy.scope, vivaryChatScope("org-a"));
  assert.equal(legacy.storageKey, `vivary-workbench-chat-v1:${encodeURIComponent(JSON.stringify(["owner@example.test", "org-a"]))}`);
  for (const projectId of ["", "a:b", "a".repeat(129)]) {
    assert.throws(() => identity("owner@example.test", "org-a", projectId));
  }
});


test("legacy links probe the authenticated legacy scope before choosing history", async () => {
  const { resolveNativeHistoryKind } = await import("../app/lib/native-history-route.ts");
  const scope = vivaryChatScope("org-a")!;
  const controller = new AbortController();
  const result = await resolveNativeHistoryKind("old/thread", scope, controller.signal, async (input, init) => {
    const url = new URL(String(input), "https://vivary.test");
    assert.equal(url.pathname, "/_agent-native/agent-chat/threads/old%2Fthread");
    assert.equal(url.searchParams.get("scopeType"), "workspace-app");
    assert.equal(url.searchParams.get("scopeId"), scope.id);
    assert.equal(init?.signal, controller.signal);
    return new Response("{}", { status: 200 });
  });
  assert.equal(result, "unassigned");
  assert.equal(await resolveNativeHistoryKind("project-thread", scope, undefined,
    async () => new Response(null, { status: 404 })), "project");
});

test("failed legacy lookup never guesses the project scope", async () => {
  const { resolveNativeHistoryKind } = await import("../app/lib/native-history-route.ts");
  const scope = vivaryChatScope("org-a")!;
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(resolveNativeHistoryKind("thread", scope, undefined,
      async () => new Response(null, { status })), /could not be verified/);
  }
  await assert.rejects(resolveNativeHistoryKind("thread", scope, undefined,
    async () => { throw new Error("offline"); }), /offline/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(resolveNativeHistoryKind("thread", scope, controller.signal,
    async (_input, init) => { init?.signal?.throwIfAborted(); return new Response(); }), { name: "AbortError" });
});
