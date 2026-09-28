import { CodexRequestFields, requestTitle, object } from "./CodexRequestFields";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { actionErrorMessage, useActionQuery } from "@agent-native/core/client/hooks";
import { Button } from "@agent-native/toolkit/ui";
import { useNativeActionCaller } from "../../lib/native-actions";
import { useProjects } from "../projects/ProjectContext";
import type { VivaryCodeHostState } from "../../../server/local-code-agent";

export function CodeRunControl() {
  const status = useActionQuery<VivaryCodeHostState>("vivary-code-state", { scope: "host" }, {
    refetchInterval: 1000, retry: false,
  });
  const { call, ready, retrySession } = useNativeActionCaller();
  const { selectProject, catalog } = useProjects();
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();
  const active = status.data?.activeRun;
  const pending = status.data?.pendingApproval;
  const recent = status.data?.recentRun;
  const cleanup = status.data?.cleanup;
  // Issue #121. Which cleanup choice is running, and whether End them left processes running.
  const [resolving, setResolving] = useState<"end" | "continue" | null>(null);
  const [endLeftSome, setEndLeftSome] = useState(false);
  useEffect(() => { if (!cleanup) setEndLeftSome(false); }, [cleanup]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [content, setContent] = useState<Record<string, unknown>>({});
  useEffect(() => {
    setAnswers({}); setError(undefined);
    const fields = object(object(pending?.params.requestedSchema).properties);
    const values: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(fields)) {
      const field = object(raw);
      if (field.default != null) values[key] = field.default;
      else if (field.type === "boolean") values[key] = false;
      else if (field.type === "array") values[key] = [];
    }
    setContent(values);
  }, [pending?.requestId]);
  const current = pending ?? active;
  const currentRunId = pending?.runId ?? active?.id ?? recent?.id;
  const projectLabel = current?.projectId
    ? catalog?.projects.find(project => project.projectId === current.projectId)?.displayName ?? "Unavailable project"
    : "Personal workspace";

  async function decide(decision: "approve" | "deny" | "stop") {
    if (!current || working) return;
    setWorking(true);
    setError(undefined);
    try {
      if (decision === "stop" && active) {
        await call("vivary-code-stop", { runId: active.id, projectId: active.projectId ?? undefined });
      } else if (pending && decision !== "stop") {
        await call(decision === "approve" ? "vivary-code-approve" : "vivary-code-deny", {
          runId: pending.runId, requestId: pending.requestId, projectId: pending.projectId ?? undefined,
          ...(decision === "approve" ? { answers, content } : {}),
        });
      }
      await status.refetch();
    } catch (failure) {
      setError(actionErrorMessage(failure) ?? (failure instanceof Error ? failure.message : "The request could not finish. Try again."));
      await status.refetch();
    } finally { setWorking(false); }
  }

  // Issue #121. The buttons keep focus while a choice or a check runs, so they ignore clicks instead of disabling.
  async function resolveCleanup(decision: "end" | "continue") {
    if (!ready || resolving || !cleanup || cleanup.checking) return;
    setResolving(decision);
    setError(undefined);
    try {
      // The version names the list on screen, so the server refuses a choice about a list that changed since.
      const next = await call<VivaryCodeHostState>("vivary-code-cleanup", { decision, version: cleanup.version });
      if (!next.cleanup) {
        // The strip closes, so focus moves to the page instead of being lost.
        document.getElementById("workbench-content")?.focus();
      } else if (decision === "end") {
        setEndLeftSome(true);
        setError("Some coding processes are still running after End them. Stop them yourself, or choose Continue anyway.");
      }
      await status.refetch();
    } catch (failure) {
      setError(actionErrorMessage(failure) ?? (failure instanceof Error ? failure.message : "The request could not finish. Try again."));
      await status.refetch();
    } finally { setResolving(null); }
  }

  async function openConversation(target = current && currentRunId ? { id: currentRunId, projectId: current.projectId } : null) {
    if (!target) return;
    setError(undefined);
    if (!await selectProject(target.projectId)) {
      setError(pending || active ? "The project is unavailable. You can still deny or stop its work here." : "The project is unavailable. Its conversation history is retained.");
      return;
    }
    navigate("/?run=" + encodeURIComponent(target.id));
  }

  if (!current && !cleanup && !status.error) return null;
  const cleanupHeld = !ready || resolving !== null || cleanup?.checking === true;
  return <section aria-label="Agent work" className="shrink-0 border-b px-4 py-3 text-sm">
    {pending ? <div className="flex max-h-[60vh] flex-col gap-3 overflow-auto rounded-lg bg-black/5 p-3 dark:bg-black/20" role="region" aria-label="Codex request">
      <h2 className="font-semibold">{requestTitle(pending.method)}</h2>
      <p className="text-xs text-muted-foreground">{pending.workspaceLabel} · Codex</p>
      <CodexRequestFields key={pending.requestId} request={pending} answers={answers} content={content} setAnswers={setAnswers} setContent={setContent} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!ready || working} onClick={() => void decide("approve")}>{pending.method.includes("requestApproval") ? "Allow once" : "Continue"}</Button>
        <Button size="sm" variant="outline" disabled={!ready || working} onClick={() => void decide("deny")}>Decline</Button>
        <Button size="sm" variant="outline" disabled={!ready || working} onClick={() => void decide("stop")}>Stop</Button>
        <Button size="sm" variant="ghost" onClick={() => void openConversation()}>Open conversation</Button>
      </div>
    </div> : active ? <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1" role="status">Agent working in the background in {projectLabel}: {active.title}</span>
      <Button variant="ghost" size="sm" onClick={() => void openConversation()}>Open conversation</Button>
      <Button variant="outline" size="sm" disabled={!ready || working} onClick={() => void decide("stop")} aria-label="Stop active run">
        {working ? "Stopping…" : "Stop"}
      </Button>
    </div> : cleanup ? <div className="flex flex-col gap-2" role="region" aria-label="Leftover coding processes">
      <h2 className="font-semibold">{cleanup.heading}</h2>
      {cleanup.remaining.length > 0 && <ul className="max-h-32 overflow-auto break-words">
        {cleanup.remaining.map(leftover => <li key={leftover.pid}>{leftover.name} (PID {leftover.pid})</li>)}
      </ul>}
      <p className="break-words text-xs text-muted-foreground">{withCommands(cleanup.instruction)}</p>
      <div className="flex flex-wrap items-center gap-2">
        {cleanup.canEnd && <Button size="sm" aria-disabled={cleanupHeld || undefined} onClick={() => void resolveCleanup("end")}>
          {resolving === "end" ? "Ending…" : cleanup.checking ? "Checking…" : "End them"}
        </Button>}
        {(!cleanup.canEnd || endLeftSome) && <Button size="sm" variant="outline" aria-disabled={cleanupHeld || undefined}
          onClick={() => void resolveCleanup("continue")}>{resolving === "continue" ? "Continuing…" : "Continue anyway"}</Button>}
        {cleanup.run && <Button variant="ghost" size="sm" onClick={() => void openConversation(cleanup.run)}>Open conversation</Button>}
      </div>
    </div> : recent ? <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1" role="status">{recent.phase === "approval-denied"
        ? "Request denied. No agent work started" : recent.phase === "interrupted"
          ? "Agent work was interrupted" : recent.status === "completed"
            ? "Agent work completed" : recent.status === "errored"
              ? "Agent work failed" : "Agent work stopped"} in {projectLabel}: {recent.title}</span>
      <Button variant="ghost" size="sm" onClick={() => void openConversation()}>Open conversation</Button>
    </div> : <div className="flex items-center gap-2">
      <span role="status">Agent status could not be loaded.</span>
      <Button variant="ghost" size="sm" onClick={() => void status.refetch()}>Retry</Button>
    </div>}
    {!ready && <Button size="sm" variant="outline" onClick={retrySession}>Retry session</Button>}
    {error && <p className="mt-2 text-destructive" role="alert">{error}</p>}
  </section>;
}

/** Issue #121. The server marks commands with backticks. Code spans wrap anywhere, so a long command stays on screen. */
function withCommands(text: string) {
  return text.split("`").map((part, index) => index % 2 ? <code key={index} className="break-all">{part}</code> : part);
}
