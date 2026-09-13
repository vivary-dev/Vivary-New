import { useState } from "react";
import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { Button } from "@agent-native/toolkit/ui";
import { IconSquare } from "@tabler/icons-react";
import type { VivaryCodeHostState, VivaryCodeState } from "../../../server/local-code-agent";

export function CodeRunControl() {
  const status = useActionQuery<VivaryCodeHostState>("vivary-code-state", { scope: "host" }, {
    refetchInterval: 1000, retry: false,
  });
  const stop = useActionMutation<VivaryCodeState>("vivary-code-stop");
  const [error, setError] = useState<string>();
  const active = status.data?.activeRun;

  async function stopRun() {
    if (!active) return;
    setError(undefined);
    try {
      await stop.mutateAsync({ runId: active.id, projectId: active.projectId ?? undefined });
      await status.refetch();
    } catch (failure) {
      setError(actionErrorMessage(failure) ?? "The agent could not stop. Try again.");
    }
  }

  if (!active && !status.error) return null;
  return <section aria-label="Active coding run" className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
    {active ? <>
      <span className="min-w-0 flex-1 truncate" role="status">Agent working: {active.title}</span>
      <Button variant="outline" size="sm" disabled={stop.isPending} onClick={() => void stopRun()} aria-label="Stop active run">
        <IconSquare size={14} />{stop.isPending ? "Stopping…" : "Stop"}
      </Button>
      {error && <span className="basis-full text-destructive" role="alert">{error}</span>}
    </> : <>
      <span role="status">Agent status could not be loaded.</span>
      <Button variant="ghost" size="sm" onClick={() => void status.refetch()}>Retry</Button>
    </>}
  </section>;
}
