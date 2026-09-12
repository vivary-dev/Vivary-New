import type { ChatThreadScope } from "@agent-native/core/client/chat";

const VIVARY_CHAT_SCOPE_TYPE = "workspace-app";
const VIVARY_CHAT_SCOPE_PREFIX = "vivary-workbench-chat-v1";
const VIVARY_CHAT_SCOPE_LABEL = "Vivary";
const VIVARY_ORG_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function vivaryChatScope(orgId: string): ChatThreadScope | null {
  if (!VIVARY_ORG_ID.test(orgId)) return null;

  return {
    type: VIVARY_CHAT_SCOPE_TYPE,
    id: `${VIVARY_CHAT_SCOPE_PREFIX}:${orgId}`,
    label: VIVARY_CHAT_SCOPE_LABEL,
  };
}
