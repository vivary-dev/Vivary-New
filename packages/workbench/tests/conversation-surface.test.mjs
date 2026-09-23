import assert from "node:assert/strict";
import test from "node:test";
import { conversationSurfaceStateKey, requestedConversationSurface, restoredConversationSurface } from "../app/lib/conversation-surface.ts";

test("bare root restores the last Native or Code surface while explicit routes win", () => {
  assert.equal(restoredConversationSurface(requestedConversationSurface(new URLSearchParams()), "native"), "native");
  assert.equal(restoredConversationSurface(requestedConversationSurface(new URLSearchParams()), "code"), "code");
  assert.equal(restoredConversationSurface(requestedConversationSurface(new URLSearchParams("runtime=code")), "native"), "code");
  assert.equal(restoredConversationSurface(requestedConversationSurface(new URLSearchParams("run=new")), "native"), "code");
  assert.equal(restoredConversationSurface(requestedConversationSurface(new URLSearchParams("runtime=native")), "code"), "native");
  assert.equal(restoredConversationSurface(requestedConversationSurface(new URLSearchParams()), null), null);
});


test("active surface keys stay separate by organization and project", () => {
  assert.notEqual(conversationSurfaceStateKey("org-a", "project-a"),
    conversationSurfaceStateKey("org-a", "project-b"));
  assert.notEqual(conversationSurfaceStateKey("org-a", "project-a"),
    conversationSurfaceStateKey("org-b", "project-a"));
  assert.notEqual(conversationSurfaceStateKey("org-a", null),
    conversationSurfaceStateKey("org-a", "project-a"));
});
