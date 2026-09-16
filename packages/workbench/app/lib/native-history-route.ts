import { agentNativePath } from "@agent-native/core/client/api-path";
import type { ChatThreadScope } from "@agent-native/core/client/chat";

export async function resolveNativeHistoryKind(
  threadId: string,
  legacyScope: ChatThreadScope,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<"project" | "unassigned"> {
  const params = new URLSearchParams({ scopeType: legacyScope.type, scopeId: legacyScope.id });
  const response = await request(
    `${agentNativePath(`/_agent-native/agent-chat/threads/${encodeURIComponent(threadId)}`)}?${params}`,
    { signal },
  );
  if (response.ok) return "unassigned";
  if (response.status === 404) return "project";
  throw new Error("The conversation's history could not be verified. Try again.");
}
