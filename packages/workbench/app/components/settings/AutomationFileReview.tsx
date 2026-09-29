import { useCallback, useEffect, useState } from "react";
import { actionErrorMessage } from "@agent-native/core/client/hooks";
import { Button } from "@agent-native/toolkit/ui";

import { useNativeActionCaller } from "../../lib/native-actions";
import type { AutomationFileForReview, AutomationFileScope } from "../../../server/automation-file-review";

const scopeLabels: Record<AutomationFileScope, string> = {
  personal: "Personal",
  organization: "Organization",
  "app-default": "App default",
};

// Issue #109. An instruction, skill, or memory file that an automation run wrote waits here, and no chat or run loads
// it until the owner accepts it. The text shows as plain text, so a planted link or image does nothing.
export function AutomationFileReview() {
  const { call, ready } = useNativeActionCaller();
  const [files, setFiles] = useState<AutomationFileForReview[]>();
  const [loadError, setLoadError] = useState<string>();
  const [reviewError, setReviewError] = useState<string>();
  const [viewing, setViewing] = useState<string>();
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await call<{ files: AutomationFileForReview[] }>("vivary-automation-files", { operation: "list" });
      setFiles(result.files);
      setLoadError(undefined);
    } catch (failure) {
      setLoadError(actionErrorMessage(failure) ?? "The files could not be loaded. Try again.");
    }
  }, [call]);
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function review(file: AutomationFileForReview, operation: "accept" | "delete") {
    if (working) return;
    if (operation === "delete" && !window.confirm(
      `Delete ${file.path}? This removes the whole file, including anything that was in it before the run.`)) return;
    setWorking(true);
    setReviewError(undefined);
    try {
      await call("vivary-automation-files", { operation, id: file.id, updatedAt: file.updatedAt, runId: file.runId });
    } catch (failure) {
      setReviewError(actionErrorMessage(failure) ?? "The file could not be changed. Reload the list.");
    } finally {
      await load();
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Automation files</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Instruction, skill, and memory files that an automation run wrote wait here. Chats and automation runs do
          not load them until you accept them. Read each file before you accept it.
        </p>
      </div>
      {loadError && (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{loadError}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
        </div>
      )}
      {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}
      {!files ? (!loadError && <p role="status" className="text-sm text-muted-foreground">Loading files…</p>)
        : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files from automation runs are waiting for review.</p>
        ) : (
          <ul aria-label="Files waiting for review" className="space-y-4">
            {files.map(file => (
              <li key={file.id} className="space-y-3 rounded-md border p-4">
                <h3 className="break-all font-mono text-sm font-medium">{file.path}</h3>
                <p className="text-sm text-muted-foreground">
                  {scopeLabels[file.scope]}. {file.automation
                    ? `Written by the ${file.automation} automation`
                    : "Written by an automation run"} on {new Date(file.writtenAt).toLocaleString()}, run{" "}
                  {file.runId ?? "not recorded"}.
                </p>
                {file.changedAfterRun && <p className="text-sm">Changed after the run.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" aria-expanded={viewing === file.id}
                    onClick={() => setViewing(viewing === file.id ? undefined : file.id)}>
                    {viewing === file.id ? "Hide" : "View"}
                  </Button>
                  <Button size="sm" disabled={!file.canReview || working} onClick={() => void review(file, "accept")}>
                    Accept
                  </Button>
                  <Button variant="destructive" size="sm" disabled={!file.canReview || working}
                    onClick={() => void review(file, "delete")}>
                    Delete
                  </Button>
                </div>
                {!file.canReview && file.reviewNote && <p className="text-sm text-muted-foreground">{file.reviewNote}</p>}
                {viewing === file.id && (
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                    {file.content}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
