import { useState } from "react";
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
        });
      }
      await status.refetch();
    } catch (failure) {
      setError(actionErrorMessage(failure) ?? (failure instanceof Error ? failure.message : "The request could not finish. Try again."));
      await status.refetch();
    } finally { setWorking(false); }
  }

  async function openConversation() {
    if (!current || !currentRunId) return;
    setError(undefined);
    if (!await selectProject(current.projectId)) {
      setError(pending || active ? "The project is unavailable. You can still deny or stop its work here." : "The project is unavailable. Its conversation history is retained.");
      return;
    }
    navigate("/?run=" + encodeURIComponent(currentRunId));
  }

  if (!current && !status.error) return null;
  return <section aria-label="Agent work" className="shrink-0 border-b px-4 py-3 text-sm">
    {pending ? <div className="flex flex-col gap-2" role="region" aria-label="Approve background work">
      <h2 className="font-semibold">Approval needed. The agent has not started.</h2>
      <p>{pending.workspaceLabel} · {pending.engineLabel} · {pending.model}</p>
      <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words font-sans">{pending.message}</pre>
      <p>{pending.engine === "codex-cli" ? "Codex can run commands and edit project files." : "Claude Code can read and edit project files."}
        {" "}This turn continues on this host if you leave or close the browser, for up to two minutes.
        You can stop it anywhere in Vivary. Closing the host interrupts it.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!ready || working} onClick={() => void decide("approve")}>Approve background work</Button>
        <Button size="sm" variant="outline" disabled={!ready || working} onClick={() => void decide("deny")}>Deny</Button>
        <Button size="sm" variant="ghost" onClick={() => void openConversation()}>Open conversation</Button>
      </div>
    </div> : active ? <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1" role="status">Agent working in the background in {projectLabel}: {active.title}</span>
      <Button variant="ghost" size="sm" onClick={() => void openConversation()}>Open conversation</Button>
      <Button variant="outline" size="sm" disabled={!ready || working} onClick={() => void decide("stop")} aria-label="Stop active run">
        {working ? "Stopping…" : "Stop"}
      </Button>
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
