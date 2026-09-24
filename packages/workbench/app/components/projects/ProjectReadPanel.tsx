import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@agent-native/toolkit/ui";
import { Link, useSearchParams } from "react-router";
import { useNativeActionCaller, type NativeActionCaller } from "@/lib/native-actions";
import { projectFileHref } from "@/lib/project-file-location";
import type { Bounded, Omission, ProjectReadOwnerInput, ProjectReadReport, ProjectReadResult } from "@/lib/project-read-schema";
import type { WorkspacePreset } from "../../../shared/workspace-patterns.ts";

type ReadState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ProjectReadResult }
  | { kind: "error"; message: string };
type Request = Omit<ProjectReadOwnerInput, "projectId">;
type Report<Operation extends ProjectReadReport["operation"]> = Extract<ProjectReadReport, { operation: Operation }>;
const STATUS = { installed: "Installed", "not-installed": "Not installed", incompatible: "Incompatible",
  "probe-failed": "Could not be checked" } as const;

// Each section owns its request, so several sections can run at once and a
// response for an older request or another project is dropped.
function useProjectRead(call: NativeActionCaller, projectId: string) {
  const [state, setState] = useState<ReadState>({ kind: "idle" });
  const request = useRef(0);
  useEffect(() => { request.current += 1; setState({ kind: "idle" }); }, [projectId]);
  useEffect(() => () => { request.current += 1; }, []);
  async function run(input: Request) {
    const current = ++request.current;
    setState({ kind: "running" });
    try {
      const result = await call<ProjectReadResult>("vivary-project-read-owner", { projectId, ...input });
      if (request.current === current) setState({ kind: "done", result });
    } catch (error) {
      if (request.current === current) {
        setState({ kind: "error", message: error instanceof Error ? error.message : "The report could not be read. Try again." });
      }
    }
  }
  return { state, run };
}

function reportOf<Operation extends ProjectReadReport["operation"]>(state: ReadState, operation: Operation): Report<Operation> | null {
  return state.kind === "done" && state.result.status === "reported" && state.result.report.operation === operation
    ? state.result.report as Report<Operation> : null;
}

// "Errors", or "Showing 40 of 80 errors" when the list was capped.
function heading(noun: string, list: Bounded<unknown>): string {
  const plural = `${noun}s`;
  if (list.items.length >= list.total) return plural[0].toUpperCase() + plural.slice(1);
  return `Showing ${list.items.length} of ${list.total} ${plural}`;
}

function privateExcluded(omissions: Omission[]): string | null {
  const count = omissions.filter(omission => omission.kind === "privacy_excluded")
    .reduce((sum, omission) => sum + omission.count, 0);
  return count > 0 ? `${count} private file${count === 1 ? "" : "s"} excluded` : null;
}

function Outcome({ state, running }: { state: ReadState; running: string }) {
  if (state.kind === "running") return <p role="status">{running}</p>;
  if (state.kind === "error") return <p role="alert">{state.message}</p>;
  if (state.kind === "done" && state.result.status === "unavailable") return <p role="alert">{state.result.message}</p>;
  return null;
}

function Section({ title, state, hook, children }: { title: string; state: ReadState; hook?: string; children: ReactNode }) {
  return <div className="project-read-section" role="group" aria-label={title} aria-busy={state.kind === "running"}
    data-agent-native={hook}>
    <dt>{title}</dt>
    <dd>{children}</dd>
  </div>;
}

export function ProjectReadPanel({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { call, ready } = useNativeActionCaller();
  const [params] = useSearchParams();
  const ids = useId();
  const health = useProjectRead(call, projectId);
  const check = useProjectRead(call, projectId);
  const find = useProjectRead(call, projectId);
  const capabilities = useProjectRead(call, projectId);
  const receipts = useProjectRead(call, projectId);
  const [question, setQuestion] = useState("");
  const [preset, setPreset] = useState<WorkspacePreset>("coding");
  const [failedOnly, setFailedOnly] = useState(false);
  useEffect(() => { setQuestion(""); }, [projectId]);

  const blocked = (state: ReadState) => disabled || !ready || state.kind === "running";
  // Links open only inside the project this panel shows.
  const source = (state: ReadState, path: string, line?: number | null) =>
    state.kind === "done" && state.result.project.id === projectId
      ? <Link to={projectFileHref(projectId, path, params.toString(), line)}>{line ? `${path}:${line}` : path}</Link>
      : <span>{line ? `${path}:${line}` : path}</span>;

  const doctor = reportOf(health.state, "doctor");
  const notes = reportOf(check.state, "check");
  const context = reportOf(find.state, "find");
  const features = reportOf(capabilities.state, "capabilities");
  const log = reportOf(receipts.state, "receipts");
  const query = question.trim();

  return <>
    <Section title="Project health" state={health.state} hook="project-health">
      {health.state.kind === "idle" && <p>Not checked yet. Doctor validates this project's workspace files and typed notes on this host.</p>}
      <Outcome state={health.state} running="Checking project health…" />
      {doctor && <>
        <p data-agent-native="project-health-status" data-health={doctor.ok ? "ok" : "failed"}>
          <strong>{doctor.ok ? "Healthy" : "Needs attention"}</strong>
          {" · "}{doctor.graph.nodes} typed note{doctor.graph.nodes === 1 ? "" : "s"}, {doctor.graph.edges} link{doctor.graph.edges === 1 ? "" : "s"}
          {doctor.graph.broken > 0 && `, ${doctor.graph.broken} broken`}
        </p>
        {doctor.errors.total > 0 && <>
          <p className="project-read-heading">{heading("error", doctor.errors)}</p>
          <ul data-agent-native="project-health-errors">{doctor.errors.items.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        </>}
        {doctor.warnings.total > 0 && <>
          <p className="project-read-heading">{heading("warning", doctor.warnings)}</p>
          <ul data-agent-native="project-health-warnings">{doctor.warnings.items.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        </>}
        {doctor.errors.total === 0 && doctor.warnings.total === 0 && <p>No findings.</p>}
      </>}
      <Button size="sm" variant="outline" disabled={blocked(health.state)} onClick={() => void health.run({ operation: "doctor" })}
        data-agent-native="project-health-check">
        {health.state.kind === "idle" ? "Check project health" : "Check again"}
      </Button>
    </Section>

    <Section title="Note check" state={check.state}>
      {check.state.kind === "idle" && <p>Not checked yet. Check validates typed notes and skips files that Git or the workspace marks private.</p>}
      <Outcome state={check.state} running="Checking notes…" />
      {notes && <>
        <p><strong>{notes.errorCount > 0 ? "Needs attention" : "No errors"}</strong>
          {" · "}{notes.checked} note{notes.checked === 1 ? "" : "s"} checked, {notes.errorCount} error{notes.errorCount === 1 ? "" : "s"},
          {" "}{notes.warningCount} warning{notes.warningCount === 1 ? "" : "s"}</p>
        {notes.findings.total > 0 && <>
          <p className="project-read-heading">{heading("finding", notes.findings)}</p>
          <ul>{notes.findings.items.map((finding, index) => <li key={index}>
            {source(check.state, finding.path, finding.line)}{" "}
            <span className="project-read-muted">{finding.level} {finding.code}: {finding.message}</span>
          </li>)}</ul>
        </>}
        {privateExcluded(notes.omissions) && <p className="project-read-muted">{privateExcluded(notes.omissions)}</p>}
        {!notes.complete && <p className="project-read-muted">The check stopped at its limits. Some notes were not read.</p>}
      </>}
      <Button size="sm" variant="outline" disabled={blocked(check.state)} onClick={() => void check.run({ operation: "check" })}>
        {check.state.kind === "idle" ? "Check notes" : "Check again"}
      </Button>
    </Section>

    <Section title="Find context" state={find.state}>
      <form className="project-read-form" onSubmit={event => {
        event.preventDefault();
        if (query && !query.startsWith("-")) void find.run({ operation: "find", query });
      }}>
        <label htmlFor={`${ids}-question`} className="sr-only">Question about this project</label>
        <input id={`${ids}-question`} type="search" value={question} maxLength={4_000} placeholder="Ask about this project"
          autoComplete="off" onChange={event => setQuestion(event.target.value)} />
        <Button type="submit" size="sm" variant="outline" disabled={blocked(find.state) || !query || query.startsWith("-")}>Find</Button>
      </form>
      {query.startsWith("-") && <p className="project-read-muted">Start the question with a word, not a dash.</p>}
      <Outcome state={find.state} running="Finding context…" />
      {context && <>
        {context.results.total === 0 ? <p>No matching context.</p> : <>
          <p className="project-read-heading">{heading("result", context.results)}</p>
          <ul>{context.results.items.map((result, index) => <li key={index}>
            {source(find.state, result.path)} <span className="project-read-muted">{result.reason}</span>
            {result.snippet && <span className="project-read-snippet">{result.snippet}</span>}
          </li>)}</ul>
        </>}
        {privateExcluded(context.omissions) && <p className="project-read-muted">{privateExcluded(context.omissions)}</p>}
      </>}
    </Section>

    <Section title="Optional features" state={capabilities.state}>
      <div className="project-read-form">
        <label htmlFor={`${ids}-preset`}>Preset</label>
        <select id={`${ids}-preset`} value={preset} onChange={event => setPreset(event.target.value as WorkspacePreset)}>
          <option value="coding">Coding</option>
          <option value="second-brain">Second brain</option>
          <option value="knowledge-work">Knowledge work</option>
          <option value="writing">Writing</option>
        </select>
        <Button size="sm" variant="outline" disabled={blocked(capabilities.state)}
          onClick={() => void capabilities.run({ operation: "capabilities", preset })}>Show features</Button>
      </div>
      <Outcome state={capabilities.state} running="Reading optional features…" />
      {features && <ul>{features.capabilities.items.map(feature => <li key={feature.id}>
        <strong>{feature.label}</strong>{" · "}{STATUS[feature.installStatus]}
        {feature.isDefault && " · Default"}{feature.requiresApproval && " · Needs approval"}
        {feature.network === true ? " · Uses the network" : typeof feature.network === "string" ? ` · Network: ${feature.network}` : ""}
        {feature.missing.length > 0 && <span className="project-read-muted"> Needs {feature.missing.join(", ")}</span>}
      </li>)}</ul>}
    </Section>

    <Section title="Command receipts" state={receipts.state}>
      <p className="project-read-muted">All projects on this host</p>
      <div className="project-read-form">
        <label className="project-read-check"><input type="checkbox" checked={failedOnly}
          onChange={event => setFailedOnly(event.target.checked)} /> Failed commands only</label>
        <Button size="sm" variant="outline" disabled={blocked(receipts.state)}
          onClick={() => void receipts.run({ operation: "receipts", failedOnly })}>Show receipts</Button>
      </div>
      <Outcome state={receipts.state} running="Reading receipts…" />
      {log && (!log.logPresent ? <p>No command receipts yet.</p> : log.records.total === 0 ? <p>No matching receipts.</p> : <>
        <p className="project-read-heading">{log.failed} of {log.total} recent command{log.total === 1 ? "" : "s"} failed</p>
        <ul>{log.records.items.map((record, index) => <li key={index}>
          {record.ok ? "OK" : "Failed"} · {record.tool} {record.command}
          <span className="project-read-muted"> {record.timestamp}</span>
        </li>)}</ul>
      </>)}
    </Section>
  </>;
}
