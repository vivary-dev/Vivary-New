import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  AssistantChat,
  ChatHistoryList,
  buildRepositoryFromCodeAgentTranscript,
  isCodeAgentRunActive,
  type AssistantChatHandle,
  type AssistantChatProps,
} from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, readClientAppState, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useAppStateWriter } from "@/lib/native-state";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger, Skeleton } from "@agent-native/toolkit/ui";
import { IconFileText, IconHistory, IconLayoutSidebarRight, IconPlus, IconSettings, IconSquare } from "@tabler/icons-react";
import type { VivaryCodeFileState, VivaryCodeRunState, VivaryCodeState } from "../../server/local-code-agent";
import { createLocalCodeChatAdapter } from "../lib/local-code-chat-adapter";
import { useProjects } from "../components/projects/ProjectContext";
import "@agent-native/toolkit/chat-history.css";
import "../local-agent.css";

type ModelChoice = { engine: VivaryCodeState["defaultEngine"]; model: string };
const conversationSelectionSchema = z.object({
  key: z.string().min(1).max(128),
  runId: z.string().min(1).max(128).nullable(),
  choice: z.object({ engine: z.enum(["claude-cli", "codex-cli"]), model: z.string().min(1).max(200) }).optional(),
});
type ConversationSelection = z.infer<typeof conversationSelectionSchema>;
const SELECTION_PREFIX = "vivary-code-selection-v1:";
const example = "Read README.md, then create hello-vivary.txt containing a short greeting. Read the file back and tell me what you changed.";

export function meta() {
  return [{ title: "Agent | Vivary" }];
}

export default function LocalAgentRoute() {
  const { activeProject, catalog, checking, workspaceAvailable, refresh, selectProject } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { ready: stateWriterReady, retrySession, sessionStatus, writeAppState } = useAppStateWriter();
  const previousScope = useRef<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const projectId = activeProject?.projectId ?? null;
  const projectScope = [catalog?.scopeKey, projectId ?? "personal"].join(":");
  const selectionKey = SELECTION_PREFIX + projectScope;
  const selection = useQuery({
    queryKey: [selectionKey], enabled: workspaceAvailable && !checking,
    staleTime: Infinity, retry: false,
    queryFn: async ({ signal }) => {
      const parsed = conversationSelectionSchema.safeParse(await readClientAppState(selectionKey, { signal }));
      return parsed.success ? parsed.data : null;
    },
  });
  const saveSelection = useMutation({
    scope: { id: SELECTION_PREFIX },
    mutationFn: ({ key, value }: { key: string; value: ConversationSelection | null }) =>
      writeAppState(key, value, { keepalive: true }),
  });
  const save = saveSelection.mutate;
  const changingScope = previousScope.current !== null && previousScope.current !== projectScope;
  const departingUrl = workspaceAvailable && changingScope && (searchParams.has("run") || searchParams.has("draft"));

  useEffect(() => {
    if (checking || !workspaceAvailable) return;
    if (departingUrl) {
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete("run"); next.delete("draft");
        return next;
      }, { replace: true });
      return;
    }
    previousScope.current = projectScope;
  }, [projectScope, checking, workspaceAvailable, departingUrl, setSearchParams]);

  const setSelection = useCallback<Dispatch<SetStateAction<ConversationSelection | null>>>(update => {
    const previous = queryClient.getQueryData<ConversationSelection | null>([selectionKey]) ?? null;
    const next = typeof update === "function" ? update(previous) : update;
    if (next === previous) return;
    queryClient.setQueryData([selectionKey], next);
    if (stateWriterReady) save({ key: selectionKey, value: next });
  }, [queryClient, selectionKey, save, stateWriterReady]);

  async function openActiveConversation(active: NonNullable<VivaryCodeState["activeRun"]>) {
    if (active.projectId !== projectId && !await selectProject(active.projectId)) return false;
    const key = SELECTION_PREFIX + [catalog?.scopeKey, active.projectId ?? "personal"].join(":");
    const next = { key: active.id, runId: active.id };
    await queryClient.cancelQueries({ queryKey: [key], exact: true });
    queryClient.setQueryData([key], next);
    if (stateWriterReady) save({ key, value: next });
    if (mounted.current) setSearchParams({ run: active.id }, { replace: true });
    return true;
  }

  if (checking || sessionStatus === "loading" || departingUrl || (workspaceAvailable && selection.isPending)) {
    return <div className="local-agent-chat-skeleton" aria-busy="true">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-auto h-28 w-full" />
    </div>;
  }
  if (!stateWriterReady) return <section className="local-agent-page" aria-label="Vivary agent">
    <div className="local-agent-notice" role="alert">
      <span>{sessionStatus === "signing-out"
        ? "Signing out. Conversation selection is no longer being saved."
        : sessionStatus === "unauthenticated"
          ? "Sign in before using the Vivary agent."
          : "Your Native session could not be verified."}</span>
      {(sessionStatus === "unavailable" || sessionStatus === "authenticated")
        && <Button variant="ghost" size="sm" onClick={retrySession}>Retry session</Button>}
    </div>
  </section>;
  if (!workspaceAvailable) return <section className="local-agent-page" aria-label="Vivary agent">
    <div className="local-agent-notice" role="alert">
      <span>This workspace is unavailable. Refresh the project list or choose another project.</span>
      <Button variant="ghost" size="sm" onClick={() => void refresh()}>Refresh projects</Button>
    </div>
  </section>;
  if (selection.isError) return <section className="local-agent-page" aria-label="Vivary agent">
    <div className="local-agent-notice" role="alert">
      <span>Your conversation selection could not be loaded.</span>
      <Button variant="ghost" size="sm" onClick={() => void selection.refetch()}>Retry</Button>
    </div>
  </section>;

  return <>
    {saveSelection.isError && <div className="local-agent-notice" role="alert">
      <span>Your conversation selection could not be saved.</span>
      <Button variant="ghost" size="sm" onClick={() => { if (saveSelection.variables) save(saveSelection.variables); }}>Retry</Button>
    </div>}
    <ProjectCodeWorkspace key={projectScope} projectId={projectId}
      projectLabel={activeProject?.displayName} onOpenActive={openActiveConversation}
      selection={selection.data ?? null} setSelection={setSelection} />
  </>;
}

function ProjectCodeWorkspace({ projectId, projectLabel, selection, setSelection, onOpenActive }: {
  projectId: string | null;
  projectLabel?: string;
  selection: ConversationSelection | null;
  setSelection: Dispatch<SetStateAction<ConversationSelection | null>>;
  onOpenActive: (active: NonNullable<VivaryCodeState["activeRun"]>) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRun = searchParams.get("run");
  const requestedDraft = searchParams.get("draft");
  const requestKey = requestedRun === "new" ? "new:" + requestedDraft : requestedRun;
  const handledRequest = useRef<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [notice, setNotice] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<string>();
  const [showFiles, setShowFiles] = useState(false);
  const filesToggle = useRef<HTMLButtonElement>(null);
  const [streaming, setStreaming] = useState(false);
  const mounted = useRef(false);
  const currentSelection = useRef(selection);
  currentSelection.current = selection;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const state = useActionQuery<VivaryCodeState>("vivary-code-state", { projectId: projectId ?? undefined }, {
    refetchInterval: 1000,
    placeholderData: previous => previous?.projectId === projectId ? previous : undefined,
  });
  const codeState = state.data?.projectId === projectId ? state.data : undefined;
  const runToLoad = requestedRun === "new" ? null : requestedRun ?? selection?.runId;
  const selectedState = useActionQuery<VivaryCodeState>("vivary-code-state", { projectId: projectId ?? undefined, runId: runToLoad ?? undefined }, {
    enabled: !!runToLoad && runToLoad !== codeState?.run?.id,
    refetchInterval: 1000,
  });
  const selectedRun = selectedState.data?.projectId === projectId ? selectedState.data.run : null;
  const files = useActionQuery<VivaryCodeFileState>("vivary-code-files", { projectId: projectId ?? undefined, path: selectedFile }, { refetchInterval: 1500, placeholderData: previous => previous });
  const stop = useActionMutation<VivaryCodeState>("vivary-code-stop");
  const run = selection?.runId === codeState?.run?.id ? codeState?.run
    : selection?.runId === selectedRun?.id ? selectedRun : null;
  const activeRun = codeState?.activeRun;
  const error = notice ?? codeState?.error
    ?? (selectedState.isError && selection?.runId !== codeState?.run?.id ? "This conversation could not be loaded. Choose a conversation from history or retry." : undefined)
    ?? (state.data && !codeState ? "The project changed. Refresh this workspace before continuing." : undefined)
    ?? actionErrorMessage(state.error)
    ?? (state.error ? "The workspace could not be loaded." : undefined);

  const showInUrl = useCallback((next: ConversationSelection) => {
    if (!mounted.current) return;
    handledRequest.current = next.runId ?? "new:" + next.key;
    setSearchParams(current => {
      const params = new URLSearchParams(current);
      params.set("run", next.runId ?? "new");
      if (next.runId) params.delete("draft");
      else params.set("draft", next.key);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!codeState) return;
    if (requestKey && handledRequest.current !== requestKey) {
      if (requestedRun === "new") {
        handledRequest.current = requestKey;
        setNotice(undefined);
        const key = requestedDraft && /^[A-Za-z0-9_-]{1,128}$/.test(requestedDraft)
          ? requestedDraft : crypto.randomUUID();
        if (selection?.key !== key) setSelection({ key, runId: null });
        if (requestedDraft !== key) showInUrl({ key, runId: null });
        return;
      }
      if (requestedRun && (selection?.runId === requestedRun || selectedRun?.id === requestedRun || codeState.runs.some(item => item.id === requestedRun))) {
        handledRequest.current = requestKey;
        setNotice(undefined);
        if (selection?.runId !== requestedRun) setSelection({ key: requestedRun, runId: requestedRun });
        return;
      }
      if (selectedState.isPending || selectedState.isFetching) return;
      handledRequest.current = requestKey;
      setNotice("This conversation is not available in the selected workspace.");
      if (selection) {
        showInUrl(selection);
        return;
      }
    }
    if (selection) {
      if (!requestedRun) showInUrl(selection);
      return;
    }
    const current = codeState.runs.find(isCodeAgentRunActive) ?? codeState.run;
    const next = { key: current?.id ?? crypto.randomUUID(), runId: current?.id ?? null };
    setSelection(next);
    showInUrl(next);
  }, [selection, codeState, selectedRun, selectedState.isPending, selectedState.isFetching, setSelection, requestKey, requestedRun, requestedDraft, showInUrl]);

  const selectConversation = (runId: string) => {
    const next = { key: runId, runId };
    setSelection(next);
    showInUrl(next);
    setNotice(undefined);
    setHistoryOpen(false);
    setShowFiles(false);
  };
  const newConversation = () => {
    const next = { key: crypto.randomUUID(), runId: null };
    setSelection(next);
    showInUrl(next);
    setNotice(undefined);
    setShowFiles(false);
  };
  const onStarted = useCallback((key: string, runId: string) => {
    setSelection(current => current?.key === key ? { ...current, runId } : current);
    if (currentSelection.current?.key === key) showInUrl({ key, runId });
  }, [setSelection, showInUrl]);
  const closeFiles = () => {
    setShowFiles(false);
    filesToggle.current?.focus();
  };

  async function stopRun() {
    if (!activeRun) return false;
    setNotice(undefined);
    try {
      const result = await stop.mutateAsync({ projectId: activeRun.projectId ?? undefined, runId: activeRun.id });
      if (result.error) throw new Error(result.error);
      await state.refetch();
      return true;
    } catch (failure) {
      setNotice(actionErrorMessage(failure) ?? (failure instanceof Error ? failure.message : "The agent could not stop."));
      return false;
    }
  }

  const history = (codeState?.runs ?? [])
    .filter(item => item.title.toLowerCase().includes(historySearch.trim().toLowerCase()))
    .map(item => ({
      id: item.id,
      title: item.title,
      subtitle: item.engineLabel + (item.model ? " · " + item.model : ""),
      timestamp: isCodeAgentRunActive(item) ? "Working" : item.status,
    }));

  return <section className="local-agent-page" aria-label="Vivary agent">
    <header className="local-agent-header">
      <div className="local-agent-heading">
        <h1>{run?.title ?? "Agent"}</h1>
        <p>{codeState?.workspaceLabel ?? projectLabel ?? "Connecting to the workspace"}</p>
      </div>
      <div className="local-agent-header-actions">
        {activeRun && <Badge variant="secondary" role="status" title={activeRun.title}>Working{activeRun.projectId !== projectId ? " in another project" : ""}</Badge>}
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Conversation history"><IconHistory size={18} /></Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="local-agent-history">
            <ChatHistoryList items={history} activeId={selection?.runId}
              onSelect={selectConversation} searchValue={historySearch}
              onSearchChange={setHistorySearch} searchPlaceholder="Search conversations"
              loading={state.isLoading}
              loadingLabel={<div className="p-3 space-y-3"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" /></div>}
              error={state.error ? "Conversations could not be loaded." : undefined}
              emptyLabel="Your conversations will appear here." emptySearchLabel="No matching conversations." />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" aria-label="New conversation" onClick={newConversation}
          disabled={!codeState || (streaming && !selection?.runId)}><IconPlus size={18} /></Button>
        <Button variant="ghost" size="icon" aria-label="Runtime settings" onClick={() => navigate("/settings/runtimes")}><IconSettings size={18} /></Button>
        <Button ref={filesToggle} variant={showFiles ? "secondary" : "ghost"} size="icon" aria-label="Workspace files"
          aria-pressed={showFiles} onClick={() => setShowFiles(value => !value)}><IconLayoutSidebarRight size={18} /></Button>
      </div>
    </header>
    {error && <div className="local-agent-notice" role="alert">
      <span>{error}</span><Button variant="ghost" size="sm" onClick={() => { void state.refetch(); if (selection?.runId) void selectedState.refetch(); }}>Retry</Button>
    </div>}
    {activeRun && activeRun.id !== selection?.runId && <div className="local-agent-notice" role="status">
      <span>An agent is working in another conversation.</span>
      <Button variant="ghost" size="sm" onClick={() => {
        if (activeRun.projectId === projectId) selectConversation(activeRun.id);
        else void onOpenActive(activeRun).then(opened => {
          if (!opened) setNotice("The active conversation's project could not be opened. You can still stop the agent here.");
        });
      }}>Open conversation</Button>
    </div>}
    <div className={"local-agent-layout" + (showFiles ? " is-viewing-files" : "")}>
      <div className="local-agent-chat">
        {selection && codeState ? <LocalCodeConversation key={selection.key}
          projectId={projectId} selection={selection} run={run ?? null} state={codeState}
          active={codeState.busy} streaming={streaming} onStreaming={setStreaming}
          onStarted={runId => onStarted(selection.key, runId)}
          onChoice={choice => setSelection(current => current ? { ...current, choice } : current)}
          onSettled={() => { void state.refetch(); void files.refetch(); }}
          onStop={stopRun} stopping={stop.isPending}
          onSettings={() => navigate("/settings/runtimes")} /> :
          <div className="local-agent-chat-skeleton" aria-busy="true">
            <Skeleton className="h-8 w-48 self-end" /><Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" /><Skeleton className="mt-auto h-28 w-full" />
          </div>}
      </div>
      <aside className="local-agent-output" aria-label="Workspace files" aria-hidden={!showFiles}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeFiles();
          }
        }}>
        <header><h2>Workspace files</h2><Button variant="ghost" size="sm" onClick={closeFiles}>Close</Button></header>
        <div className="local-agent-file-list">
          {files.isLoading ? <><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></> :
            (files.data?.files ?? []).map(file => <Button variant={selectedFile === file.path ? "secondary" : "ghost"} type="button" key={file.path}
              className="local-agent-file-row" onClick={() => setSelectedFile(file.path)}>
              <IconFileText size={16} /><span>{file.path}</span>
            </Button>)}
          {files.error && <p role="alert">Workspace files could not be read.</p>}
          {!files.isLoading && !files.error && files.data?.files.length === 0 && <p>No readable files in this workspace yet.</p>}
          {files.data?.truncated && <p>The first files are shown. Ask the agent about a specific path.</p>}
        </div>
        {files.data?.file && files.data.file.path === selectedFile ? <div className="local-agent-file-preview">
          <h3>{files.data.file.path}</h3><pre>{files.data.file.content}</pre>
        </div> : <div className="local-agent-file-empty">Choose a file to inspect its contents.</div>}
      </aside>
    </div>
  </section>;
}

type LocalCodeConversationProps = {
  projectId: string | null;
  selection: ConversationSelection;
  run: VivaryCodeRunState | null;
  state: VivaryCodeState;
  active: boolean;
  streaming: boolean;
  stopping: boolean;
  onStarted: (runId: string) => void;
  onChoice: (choice: ModelChoice) => void;
  onStreaming: (streaming: boolean) => void;
  onSettled: () => void;
  onStop: () => Promise<boolean>;
  onSettings: () => void;
};

function LocalCodeConversation(props: LocalCodeConversationProps) {
  const chatRef = useRef<AssistantChatHandle>(null);
  const latest = useRef(props);
  latest.current = props;
  const runIdRef = useRef(props.selection.runId);
  runIdRef.current = props.selection.runId;
  const adapterOwnsMessages = useRef(false);
  const [choice, setChoice] = useState(props.selection.choice ?? {
    engine: props.run?.engine ?? props.state.defaultEngine,
    model: props.run?.model ?? props.state.defaultModel,
  });
  useEffect(() => {
    if (props.run && !props.selection.choice) setChoice({ engine: props.run.engine, model: props.run.model });
  }, [props.run?.id, props.run?.engine, props.run?.model, props.selection.choice]);

  const createAdapter = useCallback<NonNullable<AssistantChatProps["createAdapter"]>>(context =>
    createLocalCodeChatAdapter({
      context, runIdRef, projectId: props.projectId,
      engines: () => latest.current.state.engines,
      onStarted: runId => latest.current.onStarted(runId),
      onStreaming: value => {
        if (value) adapterOwnsMessages.current = true;
        latest.current.onStreaming(value);
      },
      onSettled: () => latest.current.onSettled(),
    }), [props.projectId]);
  const loadHistoryRepository = useCallback<NonNullable<AssistantChatProps["loadHistoryRepository"]>>(async () => {
    // Canonical replay uses different message IDs. Import only while history owns
    // this view; replacing live IDs invalidates mounted assistant-ui bindings.
    if (adapterOwnsMessages.current) return null;
    return buildRepositoryFromCodeAgentTranscript(latest.current.run?.events ?? []);
  }, []);
  const availableModels = useMemo(() => props.state.engines
    .filter(engine => !props.selection.runId || engine.engine === choice.engine)
    .map(engine => ({ ...engine, models: [...engine.models] })),
  [props.state.engines, props.selection.runId, choice.engine]);
  const selectedEngine = props.state.engines.find(engine => engine.engine === choice.engine);
  const runtime = selectedEngine?.runtime;
  const events = props.run?.events ?? [];
  const stoppedByUser = props.run?.status === "paused"
    && events.findLast(event => event.kind === "status")?.metadata?.reason === "user";
  const runtimeReady = runtime?.status === "ready";
  const disabled = props.active || props.streaming || !runtimeReady;

  return <AssistantChat ref={chatRef}
    tabId={"vivary-code:" + (props.projectId ? "project:" + props.projectId + ":" : "") + props.selection.key}
    showHeader={false} className="local-agent-transcript"
    createAdapter={createAdapter} loadHistoryRepository={loadHistoryRepository}
    isThreadStateLoading={!!props.selection.runId && !props.run && !props.streaming}
    historyReloadKey={events.length + ":" + (events.at(-1)?.id ?? "") + ":" + (props.run?.status ?? "")}
    externalStreaming={!!props.run && isCodeAgentRunActive(props.run)}
    externalUserStopped={stoppedByUser}
    onStop={async () => {
      await props.onStop();
      // Code polling settles this response. Skip Native's unrelated global SSE abort.
      return false;
    }}
    composerDisabled={disabled}
    composerDisabledPlaceholder={!runtimeReady ? "Connect a runtime in Settings to start." : "The agent is working. Stop it before sending another message."}
    selectedEngine={choice.engine} selectedModel={choice.model} defaultModel={props.state.defaultModel}
    availableModels={availableModels} onModelChange={(model, engine) => {
      const selected = props.state.engines.find(item => item.engine === engine);
      if (selected && (!props.selection.runId || selected.engine === props.run?.engine)) {
        const choice = { engine: selected.engine, model };
        setChoice(choice);
        props.onChoice(choice);
      }
    }}
    providerStatusChecksEnabled={false}
    onConnectProvider={props.onSettings} onConnectLocalRuntime={props.onSettings}
    plusMenuMode="hidden" dynamicSuggestions={false} suggestions={[]}
    composerPlaceholder="Ask the agent to work in this workspace…"
    emptyStateAddon={<div className="local-agent-intro">
      <h2>What are we working on?</h2>
      <p>Read files, make changes, and inspect the results in your workspace.</p>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => chatRef.current?.prefillMessage(example)}>Try a file change</Button>
    </div>}
    composerSlot={!runtimeReady ? <div className="local-agent-runtime-setup" role="status">
      <div><h3>Set up {selectedEngine?.label ?? "a runtime"}</h3><p>{runtime?.message ?? "Choose a local runtime in Settings."}</p></div>
      <Button variant="outline" size="sm" onClick={props.onSettings}>Open runtime settings</Button>
    </div> : undefined}
    composerExtraActionButton={props.active && !props.streaming ?
      <Button variant="outline" size="sm" disabled={props.stopping} onClick={() => void props.onStop()} aria-label="Stop response">
        <IconSquare size={14} /> Stop
      </Button> : undefined}
    threadFooterSlot={<p className="local-agent-limits">{choice.engine === "codex-cli" ? "Codex can run commands and edit files." : "Claude Code uses file tools."} Each run has a two-minute work limit.</p>}
  />;
}
