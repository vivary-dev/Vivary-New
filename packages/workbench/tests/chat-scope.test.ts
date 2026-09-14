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
