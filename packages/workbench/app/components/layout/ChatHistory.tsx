import { useChatThreads } from "@agent-native/core/client/agent-chat";
import { ChatHistoryList } from "@agent-native/toolkit/chat-history";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import type { VivaryChatIdentity as ChatIdentity } from "@/lib/chat-scope";

export function ChatHistory({ identity }: { identity: ChatIdentity }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const {
    threads,
    activeThreadId,
    switchThread,
    pinThread,
    archiveThread,
    renameThread,
    refreshThreads,
    isLoading,
    threadsLoadError,
  } = useChatThreads(undefined, identity.storageKey, identity.scope, {
    autoCreate: false,
    restoreActiveThread: false,
    isolateHistoryByScope: true,
    includeExternal: false,
  });
  const visibleThreads = threads
    .filter((thread) => thread.messageCount > 0 && !thread.archivedAt)
    .sort(
      (a, b) =>
        (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || b.updatedAt - a.updatedAt,
    )
    .slice(0, 15);
  const routeThread =
    new URLSearchParams(location.search).get("runtime") === "native"
      ? new URLSearchParams(location.search).get("thread")
      : null;

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

  function openThread(threadId: string) {
    switchThread(threadId);
    navigate(`/?runtime=native&history=unassigned&thread=${encodeURIComponent(threadId)}`);
  }

  async function archive(threadId: string) {
    setError(undefined);
    if (!(await archiveThread(threadId))) {
      setError("The conversation could not be archived. Try again.");
      return;
    }
    if (threadId === routeThread || threadId === activeThreadId)
      navigate("/");
  }

  async function rename(threadId: string, title: string) {
    setError(undefined);
    if (!(await renameThread(threadId, title)))
      setError("The conversation could not be renamed. Try again.");
  }

  async function togglePin(threadId: string) {
    setError(undefined);
    const thread = visibleThreads.find((item) => item.id === threadId);
    if (thread && !(await pinThread(threadId, !thread.pinnedAt))) {
      setError("The conversation could not be pinned. Try again.");
    }
  }

  return (
    <section className="vivary-chat-history" aria-label="Chat history">
      <ChatHistoryList
        items={visibleThreads.map((thread) => ({
          id: thread.id,
          title: thread.title || thread.preview || "Untitled chat",
          titleText: thread.title || thread.preview || "Untitled chat",
          pinned: Boolean(thread.pinnedAt),
        }))}
        activeId={routeThread ?? activeThreadId}
        onSelect={openThread}
        onTogglePin={(threadId) => void togglePin(threadId)}
        onRename={(threadId, title) => void rename(threadId, title)}
        onDelete={(threadId) => void archive(threadId)}
        renameMaxLength={160}
        loading={isLoading}
        loadingLabel={
          <div className="vivary-history-skeleton" role="status">
            <span className="sr-only">Opening chat history</span>
            <span />
            <span />
            <span />
          </div>
        }
        error={
          threadsLoadError ? (
            <div>
              <p>Chat history could not be loaded.</p>
              <Button variant="ghost" size="sm" onClick={refreshThreads}>
                Try again
              </Button>
            </div>
          ) : undefined
        }
        emptyLabel="No conversations yet."
        variant="rail"
        className="an-chat-history-rail"
        labels={{
          options: (item) => `Options for ${item.titleText}`,
          renameInput: (item) => `Rename ${item.titleText}`,
          rename: "Rename",
          pin: "Pin",
          unpin: "Unpin",
          delete: "Archive",
        }}
      />
      {error && (
        <p className="px-2 py-2 text-xs text-destructive" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
