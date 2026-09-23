import { AgentChatSurface } from "@agent-native/core/client/agent-chat";
import { Skeleton } from "@agent-native/toolkit/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { readClientAppState } from "@agent-native/core/client/hooks";
import { Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useVivaryChatIdentity } from "@/components/layout/use-vivary-chat-identity";
import { resolveNativeHistoryKind } from "@/lib/native-history-route";
import { useNativeChatDraft } from "@/lib/chat-draft";
import { useAppStateWriter } from "@/lib/native-state";
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
  return <DraftedConversation key={query.identity.storageKey} identity={query.identity} unassigned={unassigned}
    workspaceAvailable={workspaceAvailable} />;
}

function DraftedConversation({ identity, unassigned, workspaceAvailable }: {
  identity: NonNullable<ReturnType<typeof useVivaryChatIdentity>["identity"]>;
  unassigned: boolean;
  workspaceAvailable: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const selectedThread = params.get("thread");
  const selectionKey = "vivary-chat-selection-v1:" + btoa(identity.storageKey)
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const queryClient = useQueryClient();
  const selection = useQuery({
    queryKey: ["vivary-chat-selection", selectionKey],
    queryFn: ({ signal }) => readClientAppState(selectionKey, { signal }),
    retry: false, staleTime: Infinity,
  });
  const { ready: selectionWriterReady, writeAppState } = useAppStateWriter();
  const [selectionSaveError, setSelectionSaveError] = useState(false);
  const latestThread = useRef<string | null>(null);
  const savingThread = useRef(false);
  const saveLatestThread = useCallback(async () => {
    if (savingThread.current || !selectionWriterReady) return;
    savingThread.current = true;
    try {
      while (latestThread.current) {
        const threadId = latestThread.current;
        const value = { storageKey: identity.storageKey, threadId };
        await writeAppState(selectionKey, value, { keepalive: true });
        queryClient.setQueryData(["vivary-chat-selection", selectionKey], value);
        setSelectionSaveError(false);
        if (latestThread.current === threadId) break;
      }
    } catch {
      setSelectionSaveError(true);
    } finally {
      savingThread.current = false;
    }
  }, [identity.storageKey, queryClient, selectionKey, selectionWriterReady, writeAppState]);
  useEffect(() => {
    if (selectedThread || !selection.isSuccess || !selection.data) return;
    const saved = selection.data as { storageKey?: unknown; threadId?: unknown };
    const thread = saved.storageKey === identity.storageKey ? saved.threadId : null;
    if (typeof thread !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(thread)) return;
    setParams(current => { const next = new URLSearchParams(current); next.set("thread", thread); return next; }, { replace: true });
  }, [selectedThread, selection.isSuccess, selection.data, setParams]);
  useEffect(() => {
    if (!selectedThread) return;
    latestThread.current = selectedThread;
    void saveLatestThread();
  }, [selectedThread, saveLatestThread]);
  const draft = useNativeChatDraft({ kind: identity.kind, projectId: identity.projectId });
  const [restoreReview, setRestoreReview] = useState<string | null>(null);
  useEffect(() => { setRestoreReview(null); }, [selectedThread]);
  const error = selectedThread ? draft.statusForThread(selectedThread) : null;
  if (!selectedThread && selection.isPending) return <OpeningConversation />;
  if (!selectedThread && selection.isError) return <div className="panel-empty" role="alert">
    <h1>Conversation could not open</h1>
    <p>Vivary could not load your last conversation. Its history is preserved.</p>
    <Button variant="outline" onClick={() => void selection.refetch()}>Retry history</Button>
  </div>;
  return <section aria-label="Native chat" className="h-full min-h-0 w-full">
    {selectionSaveError && <div className="local-agent-notice" role="alert">
      <span>Your conversation selection could not be saved.</span>
      <Button variant="outline" size="sm" onClick={() => void saveLatestThread()}>Retry selection</Button>
    </div>}
    {!error && selectedThread && draft.hasDraftForThread(selectedThread) && <div className="local-agent-notice">
      <span>Draft saved for this conversation.</span>
      <Button variant="ghost" size="sm" onClick={() => void draft.discard(selectedThread)}>Discard draft</Button>
    </div>}
    {error && selectedThread && <div className="local-agent-notice" role="alert">
      <span>{error}</span>
      <Button variant="outline" size="sm" onClick={() => draft.retry(selectedThread)}>{draft.hasConflictForThread(selectedThread)
        ? "Reload saved draft" : "Retry draft"}</Button>
      {draft.hasPendingForThread(selectedThread) && (restoreReview === selectedThread
        ? <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" aria-label="I checked this conversation and queued follow-ups"
            onChange={event => { if (event.target.checked) setRestoreReview(selectedThread + ":checked");
              else setRestoreReview(selectedThread); }} />
          I checked this conversation and queued follow-ups. The message could still appear later, so sending this draft again could duplicate it.
        </label>
        : restoreReview === selectedThread + ":checked"
          ? <Button variant="outline" size="sm" onClick={() => {
            setRestoreReview(null);
            void draft.restorePending(selectedThread);
          }}>Restore draft for editing</Button>
          : <Button variant="outline" size="sm" onClick={() => setRestoreReview(selectedThread)}>
            Review before restoring
          </Button>)}
      <Button variant="ghost" size="sm" onClick={() => void draft.discard(selectedThread)}>Discard draft</Button>
    </div>}
    <AgentChatSurface key={identity.storageKey} mode="page" className="h-full min-h-0"
      storageKey={identity.storageKey} scope={identity.scope} isolateHistoryByScope
      contextNamespace={`vivary-native:${identity.storageKey}`}
      agentChatSurface="app" chatOnly codeAccess={{ enabled: false }}
      hostComposerDraft={draft.hostComposerDraft}
      composerDisabled={!unassigned && !workspaceAvailable}
      composerDisabledPlaceholder="Reconnect this project before continuing. Saved history remains available."
      showHeader={false} showTabBar={false} threadUrlSync />
  </section>;
}
