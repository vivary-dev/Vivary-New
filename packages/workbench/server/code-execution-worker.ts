import { execFile } from "node:child_process";
import path from "node:path";

import { executeCodeAgentRun, getCodeAgentRunRecord } from "@agent-native/core/code-agents";
import { runWithRequestContext } from "@agent-native/core/server";

import { isVivaryCodeWorkerRequest } from "./code-execution-protocol";

const controller = new AbortController();
let started = false;

function reply(message: { type: string; runId?: string }) {
  if (!process.connected || !process.send) return;
  try { process.send(message, () => undefined); } catch {
    // Parent teardown may close IPC before the final status reaches it.
  }
}

async function receive(message: unknown) {
  if (message && typeof message === "object" && "type" in message && message.type === "vivary:code-worker:abort") {
    controller.abort();
    return;
  }
  if (started || !isVivaryCodeWorkerRequest(message)) return;
  started = true;
  const record = getCodeAgentRunRecord(message.runId);
  if (!record || record.metadata?.ownerEmail !== message.ownerEmail ||
      record.metadata?.app !== "vivary-workbench-local-code" ||
      !["claude-cli", "codex-cli"].includes(String(record.metadata?.engine))) {
    reply({ type: "vivary:code-worker:failed", runId: message.runId });
    return;
  }
  try {
    await runWithRequestContext({ userEmail: message.ownerEmail, orgId: message.orgId }, () =>
      executeCodeAgentRun({
        runId: message.runId,
        prompt: message.prompt,
        model: message.model,
        appendUserEvent: false,
        streamToolOutputToStdout: false,
        signal: controller.signal,
      }));
    reply({ type: "vivary:code-worker:done", runId: message.runId });
  } catch {
    reply({ type: "vivary:code-worker:failed", runId: message.runId });
  }
  // Keep the ancestor alive until the parent has stopped the owned process tree.
}

// This file is a separate Nitro entry, never imported by the HTTP application.
if (process.connected && process.send) {
  process.on("message", message => { void receive(message); });
  process.on("SIGTERM", () => controller.abort());
  process.on("SIGINT", () => controller.abort());
  process.once("disconnect", () => {
    controller.abort();
    setTimeout(() => {
      if (process.platform === "win32") {
        // guard:allow-env-credential - OS directory selects the fixed emergency tree-stop command.
        const systemRoot = process.env.SystemRoot || "C:\\Windows";
        execFile(path.join(systemRoot, "System32", "taskkill.exe"), ["/PID", String(process.pid), "/T", "/F"], {
          windowsHide: true, shell: false, timeout: 3_000, maxBuffer: 16 * 1024,
        }, () => process.exit(1));
      } else {
        try { process.kill(-process.pid, "SIGKILL"); } catch { process.exit(1); }
      }
    }, 1_000);
  });
  reply({ type: "vivary:code-worker:ready" });
}
