import { useEffect, useRef, useState } from "react";
import { Button } from "@agent-native/toolkit/ui";
import { useNativeActionCaller } from "@/lib/native-actions";
import { summarizeDoctorOutput, type OriginalCommandOutput, type ProjectHealth as Health } from "@/lib/project-health";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; health: Health }
  | { kind: "error"; message: string };

// On-demand project health: the same `vivary doctor --json` the headless CLI
// runs, through the existing original-command action. Nothing runs until the
// user asks, because Doctor starts a Python child with a 30-second limit.
export function ProjectHealth({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { call, ready } = useNativeActionCaller();
  const [state, setState] = useState<State>({ kind: "idle" });
  const request = useRef(0);
  useEffect(() => { request.current += 1; setState({ kind: "idle" }); }, [projectId]);
  useEffect(() => () => { request.current += 1; }, []);

  async function check() {
    const current = ++request.current;
    setState({ kind: "running" });
    try {
      const output = await call<OriginalCommandOutput>("vivary-original-command", { projectId, command: { verb: "doctor" } });
      if (request.current === current) setState({ kind: "done", health: summarizeDoctorOutput(output) });
    } catch (error) {
      if (request.current === current) {
        setState({ kind: "error", message: error instanceof Error ? error.message : "Project health could not be checked. Try again." });
      }
    }
  }

  const running = state.kind === "running";
  const report = state.kind === "done" && state.health.kind === "report" ? state.health : null;
  return <section className="project-health" aria-label="Project health" aria-busy={running} data-agent-native="project-health">
    <dt>Project health</dt>
    <dd>
      {state.kind === "idle" && <p>Not checked yet. Doctor validates this project's workspace files and typed notes on this host.</p>}
      {running && <p role="status">Checking project health…</p>}
      {report && <>
        <p data-agent-native="project-health-status" data-health={report.ok ? "ok" : "failed"}>
          <strong>{report.ok ? "Healthy" : "Needs attention"}</strong>
          {" · "}{report.nodes} typed note{report.nodes === 1 ? "" : "s"}, {report.edges} link{report.edges === 1 ? "" : "s"}
          {report.broken > 0 && `, ${report.broken} broken`}
        </p>
        {report.errors.length > 0 && <>
          <p className="project-health-heading">Errors</p>
          <ul data-agent-native="project-health-errors">{report.errors.map(entry => <li key={entry}>{entry}</li>)}</ul>
        </>}
        {report.warnings.length > 0 && <>
          <p className="project-health-heading">Warnings</p>
          <ul data-agent-native="project-health-warnings">{report.warnings.map(entry => <li key={entry}>{entry}</li>)}</ul>
        </>}
        {report.errors.length === 0 && report.warnings.length === 0 && <p>No findings.</p>}
      </>}
      {state.kind === "done" && state.health.kind === "unreadable" && <p role="alert">{state.health.message}</p>}
      {state.kind === "error" && <p role="alert">{state.message}</p>}
      <Button size="sm" variant="outline" disabled={disabled || !ready || running} onClick={() => void check()}
        data-agent-native="project-health-check">
        {state.kind === "idle" ? "Check project health" : "Check again"}
      </Button>
    </dd>
  </section>;
}
