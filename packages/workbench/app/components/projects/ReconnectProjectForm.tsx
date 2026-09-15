import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@agent-native/toolkit/ui";
import { Button } from "@/components/ui/button";
import { useNativeActionCaller } from "@/lib/native-actions";
import type {
  ManagedProjectReconnectionPreview,
  ManagedProjectReconnectionResult,
} from "../../../shared/managed-project-reconnection";

type State =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "preview"; preview: ManagedProjectReconnectionPreview }
  | { kind: "confirming"; preview: ManagedProjectReconnectionPreview }
  | { kind: "uncertain"; preview: ManagedProjectReconnectionPreview; message: string }
  | { kind: "error"; message: string }
  | { kind: "complete" };

export function ReconnectProjectForm({ projectId, disabled, onReconnected }: {
  projectId: string;
  disabled: boolean;
  onReconnected: () => Promise<void>;
}) {
  const { call, ready } = useNativeActionCaller();
  const [state, setState] = useState<State>({ kind: "closed" });
  const request = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => {
    if (state.kind === "preview" || state.kind === "error") heading.current?.focus();
  }, [state.kind]);

  async function review() {
    const current = ++request.current;
    setState({ kind: "loading" });
    try {
      const preview = await call<ManagedProjectReconnectionPreview>(
        "vivary-preview-managed-project-reconnection", { projectId },
      );
      if (request.current === current) setState({ kind: "preview", preview });
    } catch (error) {
      if (request.current === current) setState({ kind: "error", message: error instanceof Error
        ? error.message : "The saved folder could not be checked. Try reviewing it again." });
    }
  }

  async function reconnect(preview: ManagedProjectReconnectionPreview) {
    const current = ++request.current;
    setState({ kind: "confirming", preview });
    try {
      await call<ManagedProjectReconnectionResult>("vivary-confirm-managed-project-reconnection", {
        projectId, operationId: preview.operationId, acceptedPlanSha256: preview.planSha256,
      });
    } catch (error) {
      if (request.current === current) setState({ kind: "uncertain", preview, message: error instanceof Error
        ? error.message : "The result is uncertain. Retry this reconnection to check it safely." });
      return;
    }
    if (request.current !== current) return;
    setState({ kind: "complete" });
    // Refresh availability without selecting a project the user may have left.
    await onReconnected();
  }

  function cancel() {
    request.current += 1;
    setState({ kind: "closed" });
    requestAnimationFrame(() => trigger.current?.focus());
  }

  const working = state.kind === "loading" || state.kind === "confirming";
  const unavailable = disabled || !ready || working;
  const preview = "preview" in state ? state.preview : null;
  return <div className="project-reconnection">
    {state.kind === "closed" ? <Button ref={trigger} size="sm" variant="outline"
      className="project-reconnection-trigger" disabled={disabled || !ready}
      onClick={() => void review()}>Review connection</Button> : <section
      aria-label="Review project connection" aria-busy={working}>
      <h3 ref={heading} tabIndex={-1}>Reconnect this project</h3>
      {state.kind === "loading" && <div className="project-list-skeleton" role="status">
        <span className="sr-only">Checking the saved project folder</span>
        <Skeleton className="h-4 w-full" /><Skeleton className="h-16 w-full" />
      </div>}
      {preview && <>
        <p className="project-reconnection-folder">{preview.folderName}</p>
        <p>In Vivary's managed Projects folder on this host.</p>
        <p>The folder's identity has changed since it was connected. Reconnect only if you recognize this project.</p>
        <p>Reconnecting restores file and agent access. Your saved conversations stay with this project.
          Files stay unchanged, and no agent starts.</p>
      </>}
      {(state.kind === "error" || state.kind === "uncertain") && <p role="alert">{state.message}</p>}
      {state.kind === "uncertain" && <p>Retry checks the same request. Review again if the folder or access changed.</p>}
      {state.kind === "complete" && <p role="status">Project reconnected. Refresh the project list if it still shows unavailable.</p>}
      <div className="project-form-actions">
        {preview && <Button size="sm" disabled={unavailable} onClick={() => void reconnect(preview)}>
          {state.kind === "confirming" ? "Reconnecting…" : state.kind === "uncertain" ? "Retry reconnect" : "Reconnect project"}
        </Button>}
        {(state.kind === "error" || state.kind === "uncertain") && <Button size="sm" variant="outline"
          disabled={unavailable} onClick={() => void review()}>Review again</Button>}
        {state.kind === "complete" && <Button size="sm" variant="outline" disabled={disabled}
          onClick={() => void onReconnected()}>Refresh projects</Button>}
        <Button size="sm" variant="ghost" disabled={state.kind === "confirming"} onClick={cancel}>
          {state.kind === "complete" ? "Close" : "Cancel"}
        </Button>
      </div>
    </section>}
  </div>;
}
