import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AgentConversation, normalizeCodeAgentTranscriptForConversation, type CodeAgentConversationTranscriptEvent } from "@agent-native/core/client/conversation";
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { Skeleton } from "@agent-native/toolkit/ui";
import { IconArrowUp, IconFileText, IconPlus, IconSquare } from "@tabler/icons-react";
import { Button } from "../components/ui/button";
import "../local-agent.css";

type RunSummary = { id: string; status: string; title: string; engineLabel: string; model: string };
type CodeState = {
  workspaceLabel: string;
  engineLabel: string;
  models: string[];
  defaultModel: string;
  runs: RunSummary[];
  run: (RunSummary & { events: CodeAgentConversationTranscriptEvent[] }) | null;
  error?: string;
};
type FileState = {
  files: { path: string; name: string; sizeBytes: number }[];
  file: { path: string; content: string } | null;
};

const example = "Read README.md, then create hello-vivary.txt containing a short greeting. Read the file back and tell me what you changed.";

export function meta() {
  return [{ title: "Agent | Vivary" }];
}

export default function LocalAgentRoute() {
  const [selectedRun, setSelectedRun] = useState<string>();
  const [newConversation, setNewConversation] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<string>();
  const [showFiles, setShowFiles] = useState(false);
  const [selectedModel, setSelectedModel] = useState("sonnet");
  const state = useActionQuery<CodeState>("vivary-code-state", { runId: selectedRun }, { refetchInterval: 1000 });
  const files = useActionQuery<FileState>("vivary-code-files", { path: selectedFile }, { refetchInterval: 1500 });
  const send = useActionMutation<CodeState>("vivary-code-send");
  const stop = useActionMutation<CodeState>("vivary-code-stop");
  const run = newConversation ? null : state.data?.run;
  const activeRun = state.data?.runs.find(item => ["running", "pending", "queued", "starting", "resuming"].includes(item.status));
  const active = !!activeRun;
  useEffect(() => {
    if (run?.engineLabel === "Claude Code" && run.model) setSelectedModel(run.model);
  }, [run?.id, run?.model]);
  useEffect(() => {
    if (activeRun && selectedRun !== activeRun.id) {
      setSelectedRun(activeRun.id);
      setNewConversation(false);
    }
  }, [activeRun?.id, selectedRun]);
  const messages = useMemo(() => normalizeCodeAgentTranscriptForConversation(run?.events ?? []), [run?.events]);
  const error = notice ?? state.data?.error ?? (state.error instanceof Error ? state.error.message : undefined);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || send.isPending || active) return;
    setNotice(undefined);
    try {
      const result = await send.mutateAsync({ message, runId: run?.id, model: selectedModel });
      if (result.error) { setNotice(result.error); return; }
      setSelectedRun(result.run?.id);
      setNewConversation(false);
      setDraft("");
      await state.refetch();
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "The agent could not start.");
    }
  }

  async function stopRun() {
    if (!activeRun) return;
    setNotice(undefined);
    try {
      const result = await stop.mutateAsync({ runId: activeRun.id });
      if (result.error) setNotice(result.error);
      await state.refetch();
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "The agent could not stop.");
    }
  }

  const composer = <form className="local-agent-composer" onSubmit={sendMessage}>
    <label className="sr-only" htmlFor="agent-message">Message the agent</label>
    <textarea id="agent-message" value={draft} onChange={event => setDraft(event.target.value)}
      placeholder="Ask the agent to work in this workspace…" maxLength={6000} rows={3}
      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
    <div className="local-agent-composer-bar">
      <label className="local-agent-model">
        <span className="sr-only">Model</span>
        <select aria-label="Model" value={selectedModel} disabled={active || send.isPending} onChange={event => setSelectedModel(event.target.value)}>
          {(state.data?.models ?? ["sonnet"]).map(model => <option value={model} key={model}>Claude {model[0].toUpperCase() + model.slice(1)}</option>)}
        </select>
      </label>
      {active ? <Button type="button" variant="outline" onClick={() => void stopRun()} disabled={stop.isPending}>
        <IconSquare size={14} /> Stop
      </Button> : <Button type="submit" disabled={!draft.trim() || send.isPending || !state.data}>
        <IconArrowUp size={16} /> {send.isPending ? "Starting…" : "Send"}
      </Button>}
    </div>
    <p className="local-agent-limits">File tools · 2 minutes per run</p>
  </form>;

  return <section className="local-agent-page" aria-label="Vivary agent">
    <header className="local-agent-header">
      <div><h1>Agent</h1><p>{state.data?.workspaceLabel ?? "Connecting to the workspace"}</p></div>
      <span className={"local-agent-status" + (active ? " is-active" : "")} role="status">
        {active ? "Working" : run?.status ?? (state.data ? "Idle" : "Connecting")}
      </span>
      <Button className="local-agent-files-toggle" variant="outline" size="sm" onClick={() => setShowFiles(!showFiles)}>
        {showFiles ? "Conversation" : "Files"}
      </Button>
    </header>
    <div className={"local-agent-layout" + (showFiles ? " is-viewing-files" : "")}>
      <div className="local-agent-chat">
        <div className="local-agent-session-bar">
          <select aria-label="Conversation" disabled={active || send.isPending} value={newConversation ? "" : run?.id ?? ""}
            onChange={event => { setSelectedRun(event.target.value || undefined); setNewConversation(!event.target.value); setNotice(undefined); }}>
            <option value="">New conversation</option>
            {(state.data?.runs ?? []).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <Button variant="ghost" size="sm" disabled={active || send.isPending} onClick={() => { setNewConversation(true); setSelectedModel(state.data?.defaultModel ?? "sonnet"); setDraft(""); setNotice(undefined); }}>
            <IconPlus size={16} /> New
          </Button>
        </div>
        {!run && !state.isLoading && <div className="local-agent-intro">
          <h2>Give it something to do.</h2>
          <p>Send a message. Follow the tool calls here, then open Files to inspect what changed.</p>
          <button type="button" onClick={() => setDraft(example)}>Try a file change</button>
        </div>}
        <AgentConversation messages={messages} loading={state.isLoading} streaming={active}
          error={error} className="local-agent-transcript" composer={composer}
          emptyTitle="" emptyDescription="" />
      </div>
      <aside className="local-agent-output" aria-label="Workspace files">
        <header><h2>Workspace files</h2><span>Updates from disk</span></header>
        <div className="local-agent-file-list">
          {files.isLoading ? <><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></> :
            (files.data?.files ?? []).map(file => <button type="button" key={file.path}
              className={selectedFile === file.path ? "is-selected" : ""} onClick={() => setSelectedFile(file.path)}>
              <IconFileText size={16} /><span>{file.path}</span>
            </button>)}
          {files.error && <p role="alert">Workspace files could not be read.</p>}
        </div>
        {files.data?.file ? <div className="local-agent-file-preview">
          <h3>{files.data.file.path}</h3><pre>{files.data.file.content}</pre>
        </div> : <div className="local-agent-file-empty">Choose a file to inspect its contents.</div>}
      </aside>
    </div>
  </section>;
}
