import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@agent-native/toolkit/ui";
import { useNativeActionCaller } from "@/lib/native-actions";
import { adoptionResult, adoptionPreset, type AdoptionInput, type AdoptionResult,
  type AdoptionPreset } from "../../../shared/project-adoption";

const operationLabel = { create: "Create", patch: "Append managed block", replace: "Replace managed adapter" };
const recoveryLabel = { "no-op": "Keep", restore: "Restore original", "delete-created": "Remove setup-created file" };

export function ProjectAdoption({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { call, ready } = useNativeActionCaller();
  const [state, setState] = useState<AdoptionResult>({ code: "idle" });
  const [preset, setPreset] = useState<AdoptionPreset>("auto");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string>();
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    setState({ code: "idle" });
    setMessage(undefined);
    setWorking(false);
    if (ready && !disabled) {
      void call<unknown>("vivary-project-adoption", { operation: "resume", projectId }).then(value => {
        if (request.current !== current) return;
        const result = adoptionResult.parse(value);
        setState(result);
        if ("preset" in result) setPreset(result.preset);
      }).catch(error => {
        if (request.current === current) setMessage(error instanceof Error ? error.message : "Setup status is unavailable.");
      });
    }
    return () => { request.current += 1; };
  }, [projectId, ready, disabled, call]);

  async function perform(input: AdoptionInput) {
    const current = ++request.current;
    setWorking(true);
    setMessage(undefined);
    if (input.operation === "apply" && state.code === "preview") {
      setState({ ...state, code: "pending", message: "Checking the approved setup request…" });
    }
    try {
      const result = adoptionResult.parse(await call<unknown>("vivary-project-adoption", input));
      if (request.current === current) setState(result);
    } catch (error) {
      if (request.current === current) {
        setMessage(error instanceof Error ? error.message : "The response was lost. Retry the same request to check its result.");
        try {
          const resumed = adoptionResult.parse(await call<unknown>("vivary-project-adoption", { operation: "resume", projectId }));
          if (request.current === current) setState(resumed);
        } catch { /* Keep the original request visible when its status is also unavailable. */ }
      }
    } finally {
      if (request.current === current) setWorking(false);
    }
  }

  const review = state.code === "preview" || state.code === "pending" || state.code === "recovery-preview" ? state : null;
  const pending = state.code === "pending" || state.code === "recovery-preview";
  const unavailable = disabled || !ready || working;
  const approval = review ? { projectId, operationId: review.operationId, acceptedPlanHash: review.planHash } : null;

  return <section className="project-adoption" aria-label="Vivary setup" aria-busy={working}>
    <h4>Vivary setup</h4>
    <p>Review the exact guidance files before authorizing changes to this folder. Preview and Cancel change no project files.</p>
    {!pending && <>
      <label htmlFor="adoption-preset">Workspace type</label>
      <select id="adoption-preset" value={preset} disabled={unavailable} onChange={event => {
        request.current += 1;
        setPreset(adoptionPreset.parse(event.target.value));
        setState({ code: "idle" });
        setMessage(undefined);
      }}>
        <option value="auto">Detect from folder</option>
        <option value="coding">Coding</option>
        <option value="second-brain">Second brain</option>
        <option value="knowledge-work">Knowledge work</option>
        <option value="writing">Writing</option>
      </select>
      <Button size="sm" variant="outline" disabled={unavailable}
        onClick={() => void perform({ operation: "preview", projectId, preset })}>
        {working ? "Preparing preview…" : state.code === "idle" ? "Preview Vivary setup" : "Refresh preview"}
      </Button>
    </>}
    {message && <p role="alert">{message}</p>}
    {state.code === "refused" && <p role="alert">{state.message}</p>}
    {state.code === "applied" && <div role="status">
      <p>{state.replayed ? "Setup confirmed. The previous request completed without repeating its writes." : "Vivary setup applied."}
        {" "}This project keeps its existing files and conversations.</p>
      <p><Link to="/files">Open files</Link>{" · "}<Link to="/">Open chat</Link></p>
    </div>}
    {state.code === "recovered" && <p role="status">Recovery finished. Review a new setup plan before applying again.</p>}
    {review && <div data-agent-native="adoption-preview">
      <p>Folder: <strong>{review.displayName}</strong><br /><code>{review.folder}</code></p>
      <p>Detected preset: <strong>{review.report.preset}</strong></p>
      <p role="status">{review.report.conflicts.length > 0 ? "Resolve these conflicts before applying setup."
        : review.report.content_plan.files.length === 0 ? "No setup changes are needed."
        : `${review.report.content_plan.files.length} proposed file changes.`}</p>
      {!review.report.request_replay.ready && review.report.content_plan.files.length > 0
        && <p role="alert">{review.report.request_replay.reason}</p>}
      {review.report.conflicts.length > 0 && <div>
        <h5>Conflicts</h5>
        <ul data-agent-native="adoption-conflicts">{review.report.conflicts.map(conflict => <li key={`${conflict.path}:${conflict.reason}`}>
          <code>{conflict.path}</code>: {conflict.reason}
        </li>)}</ul>
      </div>}
      {review.report.content_plan.files.map(file => <details key={file.path} data-agent-native="adoption-file" data-path={file.path}>
        <summary><span>{operationLabel[file.operation]} <code>{file.path}</code></span><span>{file.bytes} bytes</span></summary>
        <pre tabIndex={0} aria-label={`Proposed content for ${file.path}`}><code>{file.content}</code></pre>
      </details>)}
      {review.report.content_plan.kept.length > 0 && <div>
        <h5>Kept unchanged</h5>
        <ul data-agent-native="adoption-kept">{review.report.content_plan.kept.map(file => <li key={file.path}><code>{file.path}</code></li>)}</ul>
      </div>}
      <details className="project-adoption-plan">
        <summary>Plan details</summary>
        <p>{review.report.preset_reason}</p>
        <code data-agent-native="adoption-plan-hash">{review.report.plan_hash}</code>
      </details>
      {approval && state.code === "preview" && <div className="adoption-controls">
        <p>Confirm authorizes only these reviewed changes in this folder. Changed files require another preview.</p>
        <Button size="sm" disabled={unavailable || !review.report.request_replay.ready || review.report.conflicts.length > 0}
          onClick={() => void perform({ operation: "apply", ...approval })}>Confirm and apply</Button>
        <Button size="sm" variant="outline" disabled={unavailable}
          onClick={() => void perform({ operation: "cancel", ...approval })}>Cancel</Button>
      </div>}
      {approval && state.code === "pending" && <div className="adoption-controls">
        <p role="status">{state.message}</p>
        <Button size="sm" disabled={unavailable}
          onClick={() => void perform({ operation: "apply", ...approval })}>Retry approved request</Button>
        <Button size="sm" variant="outline" disabled={unavailable}
          onClick={() => void perform({ operation: "preview-recovery", ...approval })}>Review recovery</Button>
      </div>}
      {approval && state.code === "recovery-preview" && <div className="adoption-controls">
        <h5>Review recovery</h5>
        <p>Recovery restores only unchanged outputs of this incomplete request. Possible completed work cannot be rolled back.</p>
        <ul>{state.recovery.recovery_actions.map(action => <li key={action.path}>
          {recoveryLabel[action.operation]} <code>{action.path}</code>
        </li>)}</ul>
        <Button size="sm" disabled={unavailable} onClick={() => void perform({ operation: "recover", ...approval,
          acceptedRecoveryHash: state.recovery.recovery_plan_hash })}>Confirm recovery</Button>
        {!state.approved && <Button size="sm" variant="outline" disabled={unavailable}
          onClick={() => void perform({ operation: "apply", ...approval })}>Check original request</Button>}
      </div>}
    </div>}
  </section>;
}
