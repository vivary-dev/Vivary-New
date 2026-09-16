import type { ChatThreadScope } from "@agent-native/core/client/chat";

const VIVARY_ORG_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Existing organization chats retain this identity; never infer a project for them. */
export function vivaryChatScope(orgId: string): ChatThreadScope | null {
  if (!VIVARY_ORG_ID.test(orgId)) return null;
  return { type: "workspace-app", id: `vivary-workbench-chat-v1:${orgId}`, label: "Vivary" };
}

export type VivaryChatIdentity = {
  scope: ChatThreadScope;
  storageKey: string;
} & (
  | { kind: "project"; projectId: string | null }
  | { kind: "unassigned"; projectId: null }
);
