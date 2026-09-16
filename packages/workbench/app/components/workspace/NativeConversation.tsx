import { AgentChatSurface } from "@agent-native/core/client/agent-chat";
import { Skeleton } from "@agent-native/toolkit/ui";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useVivaryChatIdentity } from "@/components/layout/use-vivary-chat-identity";
import { resolveNativeHistoryKind } from "@/lib/native-history-route";
import { useProjects } from "../projects/ProjectContext";

export default function NativeConversation() {
  const [params] = useSearchParams();
  const history = params.get("history");
  if (history !== "project" && history !== "unassigned") return <ResolveHistory params={params} />;
  return <ScopedConversation unassigned={history === "unassigned"} />;
}

function OpeningConversation() {
  return <div className="flex h-full min-h-0 flex-col gap-4 p-4" role="status">
    <span className="sr-only">Opening the conversation</span><Skeleton className="h-9 w-48" />
    <Skeleton className="min-h-0 flex-1" /><Skeleton className="h-24 w-full" />
  </div>;
}

function ResolveHistory({ params }: { params: URLSearchParams }) {
  const threadId = params.get("thread");
  const legacy = useVivaryChatIdentity("unassigned");
  const identity = legacy.identity;
  const probe = useQuery({
    queryKey: ["native-history-route", identity?.storageKey, threadId],
    queryFn: ({ signal }) => {
      if (!threadId || !identity) throw new Error("The conversation owner could not be verified.");
      return resolveNativeHistoryKind(threadId, identity.scope, signal);
    },
    enabled: Boolean(threadId && identity), retry: false,
  });
  const kind = threadId ? probe.data : "project";
  if (kind && (!threadId || identity)) {
    const next = new URLSearchParams(params);
    next.set("history", kind);
    return <Navigate to={{ search: next.toString() }} replace />;
  }
  if (legacy.isError || probe.isError || (!identity && !legacy.waiting)) return <div className="panel-empty" role="alert">
    <h1>Conversation could not open</h1>
    <p>Vivary could not verify this conversation's history. Its messages are preserved.</p>
    <Button variant="outline" onClick={() => { void legacy.refetch(); void probe.refetch(); }}>Retry history</Button>
  </div>;
  return <OpeningConversation />;
}

function ScopedConversation({ unassigned }: { unassigned: boolean }) {
  const query = useVivaryChatIdentity(unassigned ? "unassigned" : "project");
  const { workspaceAvailable, checking } = useProjects();
  if (!query.identity) {
    if (checking || query.waiting) return <OpeningConversation />;
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
