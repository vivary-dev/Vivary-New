import { isCodeAgentRunActive, useChatThreads } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { ChatHistoryList, useChatHistoryRailController } from "@agent-native/toolkit/chat-history";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@agent-native/toolkit/ui";
import { IconArchive, IconChevronDown, IconDots, IconPlus } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { VivaryCodeState } from "../../../server/local-code-agent";
import { codeDraftSelectionKey } from "../../../shared/code-draft";
import { useChatDraftList } from "@/lib/chat-draft";
import type { VivaryChatIdentity } from "@/lib/chat-scope";
import { useNativeActionCaller } from "@/lib/native-actions";
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
  const { call } = useNativeActionCaller();
  const creationGeneration = useRef(0);
  const latestLocationKey = useRef(location.key);
  latestLocationKey.current = location.key;
  const creatingNative = useRef(false);
  useEffect(() => () => { creationGeneration.current++; }, [identity.storageKey]);
  const params = new URLSearchParams(location.search);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [failedAction, setFailedAction] = useState<{ message: string; retry: () => Promise<boolean> }>();
  const native = useChatThreads(undefined, identity.storageKey, identity.scope, {
    autoCreate: false, restoreActiveThread: false, isolateHistoryByScope: true, includeExternal: false,
  });
  const state = useActionQuery<VivaryCodeState>("vivary-code-state", { projectId: projectId ?? undefined }, {
    enabled: historyAvailable, refetchInterval: 1000,
    placeholderData: previous => previous?.projectId === projectId ? previous : undefined,
  });
  const code = historyAvailable && state.data?.projectId === projectId ? state.data : undefined;
  const draftList = useChatDraftList({ kind: identity.kind, projectId: identity.projectId },
    identity.storageKey, historyAvailable);
  const codeDraftList = useChatDraftList({ kind: "code", projectId },
    identity.storageKey + ":code", historyAvailable);
  const recentCodeRunIds = new Set(code?.runs.map(run => run.id));
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
      titleText: thread.title || thread.preview || "Untitled conversation",
      subtitle: "Native chat", timestamp: undefined, updatedAt: thread.updatedAt, pinned: Boolean(thread.pinnedAt),
    })),
    ...(draftList.data?.drafts ?? []).filter(draft => !native.threads.some(thread =>
      thread.id === draft.threadId && thread.messageCount > 0)).map(draft => ({
      id: `native:${draft.threadId}`, title: draft.preview || (draft.status === "pending" ? "Review send" : "Unsent draft"),
      titleText: draft.preview || (draft.status === "pending" ? "Review send" : "Unsent draft"),
      subtitle: "Native chat", timestamp: draft.status === "pending" ? "Review send" : "Draft", updatedAt: draft.createdAt, pinned: false,
    })),
    ...(codeDraftList.data?.drafts ?? []).filter(draft => draft.run && !recentCodeRunIds.has(draft.run.id))
      .map(draft => ({ id: `code:${draft.run!.id}`, title: draft.run!.title, titleText: draft.run!.title,
        subtitle: draft.run!.engineLabel, timestamp: "Saved follow-up", updatedAt: Date.parse(draft.run!.updatedAt), pinned: false })),
    ...(codeDraftList.data?.drafts ?? []).filter(draft => !draft.run)
      .flatMap(draft => {
        const key = codeDraftSelectionKey(projectId, draft.threadId);
        return key ? [{ id: `code-draft:${key}`, title: draft.preview || (draft.status === "pending" ? "Review send" : "Unsent draft"),
          titleText: draft.preview || (draft.status === "pending" ? "Review send" : "Unsent draft"),
          subtitle: "Code conversation", timestamp: draft.status === "pending" ? "Review send" : "Draft", updatedAt: draft.createdAt, pinned: false }] : [];
      }),
  ].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  const isNative = params.get("runtime") === "native";
  const selected = isNative
    ? params.get("history") === "unassigned" ? null : `native:${params.get("thread") ?? native.activeThreadId}`
    : params.get("run") === "new" ? (params.get("draft") ? `code-draft:${params.get("draft")}` : null)
      : `code:${params.get("run") ?? code?.runs.find(isCodeAgentRunActive)?.id ?? code?.run?.id}`;
  function newCode() {
    creationGeneration.current++;
    setMenuOpen(false);
    navigate("/?run=new&draft=" + crypto.randomUUID());
  }
  async function newNative() {
    if (creatingNative.current) return;
    creatingNative.current = true;
    const generation = ++creationGeneration.current;
    const locationKey = location.key;
    const stillCurrent = () => generation === creationGeneration.current
      && latestLocationKey.current === locationKey;
    setMenuOpen(false);
    setError(undefined);
    try {
      const threadId = await native.createThread();
      if (!stillCurrent()) return;
      if (!threadId) throw new Error("No conversation ID was created.");
      const scope = { kind: identity.kind, projectId: identity.projectId, threadId };
      // An empty Native conversation has no server thread row. Record its exact
      // optimistic ID with the existing draft owner before opening the route.
      const initialized = await call<{ changed: boolean; record: { status: string } | null }>(
        "vivary-chat-draft", { operation: "change", ...scope, expected: null,
          next: { status: "cleared", text: "", submitId: null } });
      if (!stillCurrent()) return;
      if (!initialized.changed || initialized.record?.status !== "cleared") throw new Error("Draft initialization failed.");
      navigate(`/?runtime=native&history=project&thread=${encodeURIComponent(threadId)}`);
    } catch {
      if (stillCurrent()) setError("The conversation could not be saved. Try again.");
    } finally {
      creatingNative.current = false;
    }
  }
  const history = useChatHistoryRailController({ items: sessions,
    onNewChat: () => { if (isNative && params.get("history") !== "unassigned") void newNative(); else newCode(); },
    labels: { newChat: "New conversation", showMore: "More conversations", showLess: "Fewer conversations" },
  });
  const codeFailed = state.isError || code?.error || (state.data && !code);
  async function updateNative(action: () => Promise<boolean>, message: string) {
    setFailedAction(undefined);
    try {
      if (await action()) return;
    } catch {
      // Native restores its optimistic state; retain the action for retry.
    }
    setFailedAction({ message, retry: action });
  }
  async function archiveNative(threadId: string) {
    const archived = await native.archiveThread(threadId);
    const route = new URLSearchParams(window.location.search);
    if (archived && route.get("runtime") === "native" && route.get("history") !== "unassigned"
      && route.get("thread") === threadId) navigate("/");
    return archived;
  }
  function selectSession(id: string) {
    if (!sessions.some(item => item.id === id)) return;
    creationGeneration.current++;
    const [runtime, ...parts] = id.split(":");
    const recordId = parts.join(":");
    if (runtime === "native") {
      native.switchThread(recordId);
      navigate(`/?runtime=native&history=project&thread=${encodeURIComponent(recordId)}`);
    } else if (runtime === "code-draft") navigate(`/?run=new&draft=${encodeURIComponent(recordId)}`);
    else navigate(`/?run=${encodeURIComponent(recordId)}`);
  }
  const loading = checking || (state.isLoading && native.isLoading);
  return <section className="vivary-chat-history" aria-label="Project conversations">
    {failedAction && <div role="alert">
      <p>{failedAction.message}</p>
      <Button variant="ghost" size="sm" onClick={() => void updateNative(failedAction.retry, failedAction.message)}>Retry change</Button>
    </div>}
    {(error || codeFailed || native.threadsLoadError || draftList.isError || codeDraftList.isError) && <div role="alert">
      <p>{error ?? "Some conversations could not be loaded. Your history is preserved."}</p>
      <Button variant="ghost" size="sm" onClick={() => { setError(undefined); void state.refetch(); void draftList.refetch(); void codeDraftList.refetch(); refreshThreads(); }}>Retry history</Button>
    </div>}
    {loading || history.visibleItems.length === 0 ? <ChatHistoryList items={[]} onSelect={selectSession} variant="rail" className="an-chat-history-rail"
      loading={loading}
      loadingLabel={<div className="vivary-history-skeleton" role="status"><span className="sr-only">Opening conversations</span><span /><span /><span /></div>}
      emptyLabel="No conversations yet." /> : history.visibleItems.map(item => {
        const thread = native.threads.find(thread => item.id === `native:${thread.id}`);
        return <ChatHistoryList key={item.id} items={[item]} activeId={selected} onSelect={selectSession}
          variant="rail" className="an-chat-history-rail [&_.an-chat-history__list]:py-0"
          renameMaxLength={160}
          onRename={thread ? (_id, title) => void updateNative(() => native.renameThread(thread.id, title), "The conversation could not be renamed. Try again.") : undefined}
          onTogglePin={thread ? () => void updateNative(() => native.pinThread(thread.id, !thread.pinnedAt), "The conversation pin could not be changed. Try again.") : undefined}
          renderAdditionalRowActions={thread ? (_item, closeMenu) => <button type="button" role="menuitem" className="an-chat-history-row__menu-item" onClick={() => {
            closeMenu();
            void updateNative(() => archiveNative(thread.id), "The conversation could not be archived. Try again.");
          }}><IconArchive size={13} aria-hidden /><span>Archive</span></button> : undefined} />;
      })}
      <div className="an-chat-history-rail__footer">
        <Button variant="ghost" size="sm" className="an-chat-history-rail__new-chat" disabled={!workspaceAvailable} onClick={history.onNewChat}>
          <IconPlus size={14} aria-hidden />New conversation</Button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}><PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Choose conversation runtime" disabled={!workspaceAvailable}><IconChevronDown size={14} /></Button>
        </PopoverTrigger><PopoverContent className="w-60 p-2" align="start">
          <Button variant="ghost" className="w-full justify-start" onClick={newCode}>Code conversation</Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => void newNative()}>Native chat</Button>
        </PopoverContent></Popover>
        {history.canExpand && <Button variant="ghost" size="icon" aria-label={history.disclosureLabel} aria-expanded={history.expanded} onClick={history.toggleExpanded}><IconDots size={14} /></Button>}
      </div>
  </section>;
}
