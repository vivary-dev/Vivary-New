import { useCallback, useEffect, useState } from "react";
import { Button } from "@agent-native/toolkit/ui";

import { useNativeActionCaller } from "../../lib/native-actions";
import type { AutomationFile } from "../../../actions/vivary-automation-files";

// Issue #109. The owner's instruction, skill, and memory files that automation runs wrote wait here, and no chat or
// run loads one until the owner accepts it. The text shows as plain text, so a planted link or image does nothing.
export function AutomationFileReview() {
  const { call, ready } = useNativeActionCaller();
  const [files, setFiles] = useState<AutomationFile[]>([]);
  const load = useCallback(async () => {
    setFiles((await call<{ files: AutomationFile[] }>("vivary-automation-files", { operation: "list" })).files);
  }, [call]);
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);
  async function review(file: AutomationFile, operation: "accept" | "delete") {
    // A refused review changes nothing, and the reloaded list shows the file as it is now.
    await call("vivary-automation-files", { operation, id: file.id, updatedAt: file.updatedAt }).catch(() => undefined);
    await load();
  }
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Automation files</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Instruction, skill, and memory files that automation runs wrote wait here. Chats and automation runs do not
          load a file until you accept it. Delete removes the whole file.
        </p>
      </div>
      <ul aria-label="Files waiting for review" className="space-y-4">
        {files.map(file => (
          <li key={file.id} className="space-y-3 rounded-md border p-4">
            <h3 className="break-all font-mono text-sm font-medium">{file.path}</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
              {file.content}
            </pre>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void review(file, "accept")}>Accept</Button>
              <Button variant="destructive" size="sm" onClick={() => void review(file, "delete")}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
