import { AgentChatSurface } from "@agent-native/core/client/agent-chat";
import { Skeleton } from "@agent-native/toolkit/ui";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useVivaryChatIdentity } from "@/components/layout/use-vivary-chat-identity";
import { useProjects } from "../projects/ProjectContext";

export default function NativeConversation() {
  const [params] = useSearchParams();
  const unassigned = params.get("history") === "unassigned";
  const query = useVivaryChatIdentity(unassigned ? "unassigned" : "project");
  const { workspaceAvailable, checking } = useProjects();
  if (!query.identity) {
    if (checking || query.waiting) return <div className="flex h-full min-h-0 flex-col gap-4 p-4" role="status">
      <span className="sr-only">Opening the conversation</span><Skeleton className="h-9 w-48" />
      <Skeleton className="min-h-0 flex-1" /><Skeleton className="h-24 w-full" />
    </div>;
    return <div className="panel-empty" role="alert"><h1>Conversation could not open</h1>
      <p>Vivary could not verify this conversation's project. Its history is preserved.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Retry history</Button></div>;
  }
  const identity = query.identity;
  return <section aria-label="Native chat" className="h-full min-h-0 w-full">
    <AgentChatSurface key={identity.storageKey} mode="page" className="h-full min-h-0"
      storageKey={identity.storageKey} scope={identity.scope} isolateHistoryByScope
      agentChatSurface="app" chatOnly codeAccess={{ enabled: false }}
      composerDisabled={!unassigned && !workspaceAvailable}
      composerDisabledPlaceholder="Reconnect this project before continuing. Saved history remains available."
      showHeader={false} showTabBar={false} threadUrlSync />
  </section>;
}
