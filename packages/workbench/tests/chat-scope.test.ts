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
