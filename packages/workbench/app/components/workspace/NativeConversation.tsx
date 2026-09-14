import { AgentChatSurface } from "@agent-native/core/client/agent-chat";
import { useSession } from "@agent-native/core/client/hooks";
import { useOrg } from "@agent-native/core/client/org";
import { Skeleton } from "@agent-native/toolkit/ui";
import { Button } from "@/components/ui/button";
import { useVivaryChatIdentity } from "@/components/layout/use-vivary-chat-identity";

export function meta() {
  return [{ title: "Chat | Vivary" }];
}

export default function ChatRoute() {
  const identity = useVivaryChatIdentity();
  const { status } = useSession();
  const orgQuery = useOrg();

  if (!identity) {
    if (status === "loading" || status === "signing-out" || orgQuery.isPending) {
      return <div className="flex h-full min-h-0 flex-col gap-4 p-4" role="status">
        <span className="sr-only">Opening the conversation</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="min-h-0 flex-1" />
        <Skeleton className="h-24 w-full" />
      </div>;
    }
    return <div className="panel-empty" role="alert">
      <h1>Conversation could not open</h1>
      <p>Vivary could not load this workspace. Your saved conversations are preserved.</p>
      <Button variant="outline" onClick={() => void orgQuery.refetch()}>Try again</Button>
    </div>;
  }

  return <section aria-label="Agent chat" className="h-full min-h-0 w-full">
    <AgentChatSurface
      key={identity.storageKey}
      mode="page"
      className="h-full min-h-0"
      storageKey={identity.storageKey}
      scope={identity.scope}
      isolateHistoryByScope
      agentChatSurface="app"
      chatOnly
      codeAccess={{ enabled: false }}
      showHeader={false}
      showTabBar={false}
      threadUrlSync
    />
  </section>;
}
