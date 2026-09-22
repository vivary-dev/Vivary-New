import { useEffect, useRef, useState } from "react";
import { Button } from "@agent-native/toolkit/ui";
import { useNativeActionCaller } from "@/lib/native-actions";
import { summarizeAdoptionOutput, type AdoptionPreview } from "@/lib/project-adoption";
import type { OriginalCommandOutput } from "@/lib/project-health";

type State = { kind: "idle" | "running" } | AdoptionPreview;
const operationLabel = { create: "Create", patch: "Append managed block", replace: "Replace managed adapter" };

export function ProjectAdoption({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { call, ready } = useNativeActionCaller();
  const [state, setState] = useState<State>({ kind: "idle" });
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);

  async function preview() {
    const current = ++request.current;
    setState({ kind: "running" });
    try {
      const output = await call<OriginalCommandOutput>("vivary-original-command", { projectId, command: { verb: "adopt" } });
      if (request.current === current) setState(summarizeAdoptionOutput(output));
    } catch (error) {
      if (request.current === current) setState({ kind: "unreadable",
        message: error instanceof Error ? error.message : "The setup preview could not be prepared. Try again." });
    }
  }

  return <section className="project-adoption" aria-label="Vivary setup preview" aria-busy={state.kind === "running"}>
    <h4>Vivary setup</h4>
    <p>Review the guidance files Vivary would add or update in this folder. Previewing changes no project files.</p>
    <Button size="sm" variant="outline" disabled={disabled || !ready || state.kind === "running"} onClick={() => void preview()}>
      {state.kind === "running" ? "Preparing preview…" : state.kind === "idle" ? "Preview Vivary setup" : "Refresh preview"}
    </Button>
    {state.kind === "unreadable" && <p role="alert">{state.message}</p>}
    {state.kind === "report" && <div data-agent-native="adoption-preview">
      <p role="status">{state.conflicts.length > 0 ? "Resolve the conflicts below before setting up Vivary."
        : state.files.length === 0 ? "No setup changes are needed." : `${state.files.length} proposed file changes.`}
        {" "}This is a preview. Applying setup to an existing folder is not available here yet.</p>
      <p>Detected preset: <strong>{state.preset}</strong></p>
      {state.conflicts.length > 0 && <div>
        <h5>Conflicts</h5>
        <ul data-agent-native="adoption-conflicts">{state.conflicts.map(conflict => <li key={`${conflict.path}:${conflict.reason}`}>
          <code>{conflict.path}</code>: {conflict.reason}
        </li>)}</ul>
      </div>}
      {state.files.map(file => <details key={file.path} data-agent-native="adoption-file" data-path={file.path}>
        <summary><span>{operationLabel[file.operation]} <code>{file.path}</code></span><span>{file.bytes} bytes</span></summary>
        <pre tabIndex={0} aria-label={`Proposed content for ${file.path}`}><code>{file.content}</code></pre>
      </details>)}
      {state.kept.length > 0 && <div>
        <h5>Kept unchanged</h5>
        <ul data-agent-native="adoption-kept">{state.kept.map(file => <li key={file.path}><code>{file.path}</code></li>)}</ul>
      </div>}
      <details className="project-adoption-plan">
        <summary>Plan details</summary>
        <p>{state.presetReason}</p>
        <code data-agent-native="adoption-plan-hash">{state.planHash}</code>
      </details>
    </div>}
  </section>;
}
