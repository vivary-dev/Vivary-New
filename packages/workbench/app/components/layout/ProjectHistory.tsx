import { isCodeAgentRunActive, useChatThreads } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { ChatHistoryList, useChatHistoryRailController } from "@agent-native/toolkit/chat-history";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@agent-native/toolkit/ui";
import { IconChevronDown, IconDots, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { VivaryCodeState } from "../../../server/local-code-agent";
import type { VivaryChatIdentity } from "@/lib/chat-scope";
import { useProjects } from "../projects/ProjectContext";
import { useVivaryChatIdentity } from "./use-vivary-chat-identity";
import { CodeHistory } from "./CodeHistory";

export function ProjectHistory() {
  const query = useVivaryChatIdentity();
  if (!query.identity) return <>
    <CodeHistory />
    {query.isError && <p role="alert">Native history could not be opened.
      <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>Retry history</Button></p>}
  </>;
  return <SessionHistory key={query.identity.storageKey} identity={query.identity} />;
}

function SessionHistory({ identity }: { identity: VivaryChatIdentity }) {
  const { activeProject, checking, workspaceAvailable, historyAvailable } = useProjects();
  const projectId = activeProject?.projectId ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string>();
  const native = useChatThreads(undefined, identity.storageKey, identity.scope, {
    autoCreate: false, restoreActiveThread: false, isolateHistoryByScope: true, includeExternal: false,
  });
  const state = useActionQuery<VivaryCodeState>("vivary-code-state", { projectId: projectId ?? undefined }, {
    enabled: historyAvailable, refetchInterval: 1000,
    placeholderData: previous => previous?.projectId === projectId ? previous : undefined,
  });
  const code = historyAvailable && state.data?.projectId === projectId ? state.data : undefined;
  const refreshThreads = native.refreshThreads;
  useEffect(() => {
    window.addEventListener("agent-chat:threads-updated", refreshThreads);
    window.addEventListener("agentNative.chatRunning", refreshThreads);
    window.addEventListener("focus", refreshThreads);
    return () => {
      window.removeEventListener("agent-chat:threads-updated", refreshThreads);
      window.removeEventListener("agentNative.chatRunning", refreshThreads);
      window.removeEventListener("focus", refreshThreads);
    };
  }, [refreshThreads]);
  const sessions = [
    ...(code?.runs ?? []).map(run => ({ id: `code:${run.id}`, title: run.title || "Untitled conversation",
      subtitle: run.engineLabel, timestamp: isCodeAgentRunActive(run) ? "Working" : undefined,
      updatedAt: Date.parse(run.updatedAt), pinned: false })),
    ...native.threads.filter(thread => thread.messageCount > 0 && !thread.archivedAt).map(thread => ({
      id: `native:${thread.id}`, title: thread.title || thread.preview || "Untitled conversation",
      subtitle: "Native chat", timestamp: undefined, updatedAt: thread.updatedAt, pinned: Boolean(thread.pinnedAt),
    })),
  ].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  const isNative = params.get("runtime") === "native";
  const selected = isNative
    ? params.get("history") === "unassigned" ? null : `native:${params.get("thread") ?? native.activeThreadId}`
    : params.get("run") === "new" ? null : `code:${params.get("run") ?? code?.runs.find(isCodeAgentRunActive)?.id ?? code?.run?.id}`;
  function newCode() {
    setMenuOpen(false);
    navigate("/?run=new&draft=" + crypto.randomUUID());
  }
  async function newNative() {
    setMenuOpen(false);
    setError(undefined);
    const threadId = await native.createThread();
    if (threadId) navigate(`/?runtime=native&thread=${encodeURIComponent(threadId)}`);
    else setError("The conversation could not be created. Try again.");
  }
  const history = useChatHistoryRailController({ items: sessions,
    onNewChat: () => { if (isNative && params.get("history") !== "unassigned") void newNative(); else newCode(); },
    labels: { newChat: "New conversation", showMore: "More conversations", showLess: "Fewer conversations" },
  });
  const codeFailed = state.isError || code?.error || (state.data && !code);
  return <section className="vivary-chat-history" aria-label="Project conversations">
    {(error || codeFailed || native.threadsLoadError) && <div role="alert">
      <p>{error ?? "Some conversations could not be loaded. Your history is preserved."}</p>
      <Button variant="ghost" size="sm" onClick={() => { setError(undefined); void state.refetch(); refreshThreads(); }}>Retry history</Button>
    </div>}
    <ChatHistoryList items={history.visibleItems} activeId={selected} variant="rail" className="an-chat-history-rail"
      onSelect={id => {
        const session = sessions.find(item => item.id === id);
        if (!session) return;
        const [runtime, ...parts] = id.split(":");
        const recordId = parts.join(":");
        if (runtime === "native") {
          native.switchThread(recordId);
          navigate(`/?runtime=native&thread=${encodeURIComponent(recordId)}`);
        } else navigate(`/?run=${encodeURIComponent(recordId)}`);
      }}
      loading={checking || (state.isLoading && native.isLoading)}
      loadingLabel={<div className="vivary-history-skeleton" role="status"><span className="sr-only">Opening conversations</span><span /><span /><span /></div>}
      emptyLabel="No conversations yet."
      footer={<div className="an-chat-history-rail__footer">
        <Button variant="ghost" size="sm" className="an-chat-history-rail__new-chat" disabled={!workspaceAvailable} onClick={history.onNewChat}>
          <IconPlus size={14} aria-hidden />New conversation</Button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}><PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Choose conversation runtime" disabled={!workspaceAvailable}><IconChevronDown size={14} /></Button>
        </PopoverTrigger><PopoverContent className="w-60 p-2" align="start">
          <Button variant="ghost" className="w-full justify-start" onClick={newCode}>Code conversation</Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => void newNative()}>Native chat</Button>
        </PopoverContent></Popover>
        {history.canExpand && <Button variant="ghost" size="icon" aria-label={history.disclosureLabel} aria-expanded={history.expanded} onClick={history.toggleExpanded}><IconDots size={14} /></Button>}
      </div>} />
  </section>;
}
