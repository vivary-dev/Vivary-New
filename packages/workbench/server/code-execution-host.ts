import { execFile, fork, type ChildProcess, type ForkOptions, type SpawnOptions } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import { isVivaryCodeWorkerRequest, type VivaryCodeWorkerRequest } from "./code-execution-protocol";

const RUN_TIMEOUT_MS = 120_000;
const TERMINATION_GRACE_MS = 1_000;
const EXIT_TIMEOUT_MS = 3_000;
let cleanupBlocked = false;

export class VivaryCodeWorkerCleanupError extends Error {
  constructor() {
    super("The coding process could not be stopped completely. Stop the remaining coding processes before resuming Vivary.");
    this.name = "VivaryCodeWorkerCleanupError";
  }
}

function aborted(message = "The coding run was stopped."): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export async function executeVivaryCodeWorker(input: {
  runId: string;
  prompt: string;
  model?: string;
  ownerEmail: string;
  orgId?: string;
  signal: AbortSignal;
}): Promise<void> {
  if (cleanupBlocked) throw new VivaryCodeWorkerCleanupError();
  if (input.signal.aborted) throw aborted();
  const request: VivaryCodeWorkerRequest = {
    type: "vivary:code-worker:start", runId: input.runId, prompt: input.prompt,
    model: input.model, ownerEmail: input.ownerEmail, orgId: input.orgId,
  };
  if (!isVivaryCodeWorkerRequest(request)) throw new Error("The coding worker received an invalid run request.");
  // startVivary pins cwd to the Workbench package, including relocated desktop builds.
  const entry = path.join(process.cwd(), ".output", "server", "vivary-code-worker.mjs");
  await access(entry).catch(() => { throw new Error("Rebuild Vivary to include the coding worker."); });
  if (input.signal.aborted) throw aborted();

  return new Promise((resolve, reject) => {
    const environment = { ...process.env };
    delete environment.VIVARY_DESKTOP_HOST;
    delete environment.VIVARY_STANDALONE_HOST;
    const forkOptions: ForkOptions & Pick<SpawnOptions, "windowsHide"> = {
      cwd: process.cwd(), execPath: process.execPath,
      execArgv: ["--max-old-space-size=512"],
      env: environment, detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true,
    };
    const child = fork(entry, [], forkOptions);
    let failure: Error | null = null;
    let reported = false;
    let settled = false;
    let sent = false;
    let cleanup: Promise<void> | null = null;
    let grace: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let workerExited = false;
    let resolveExit: () => void;
    const exited = new Promise<void>(done => { resolveExit = done; });

    const finish = (error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(grace);
      clearTimeout(exitTimer);
      input.signal.removeEventListener("abort", onAbort);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
      child.off("disconnect", onDisconnect);
      if (child.connected) {
        try { child.disconnect(); } catch { /* The child may already be exiting. */ }
      }
      if (error) reject(error);
      else resolve();
    };
    const stopTree = () => {
      cleanup ??= (async () => {
        try {
          await hardStopWorkerTree(child, workerExited);
          await Promise.race([
            exited,
            new Promise<never>((_resolve, rejectExit) => {
              exitTimer = setTimeout(() => rejectExit(new VivaryCodeWorkerCleanupError()), EXIT_TIMEOUT_MS);
            }),
          ]);
          finish(failure);
        } catch {
          cleanupBlocked = true;
          finish(new VivaryCodeWorkerCleanupError());
        }
      })();
    };
    const requestStop = (reason: Error) => {
      failure ??= reason;
      if (cleanup) return;
      try {
        if (child.connected) child.send({ type: "vivary:code-worker:abort" }, () => undefined);
      } catch { /* Hard termination still follows a closed IPC channel. */ }
      grace ??= setTimeout(stopTree, TERMINATION_GRACE_MS);
    };
    const onAbort = () => requestStop(aborted());
    const onError = () => {
      failure ??= new Error("The coding worker could not start.");
      if (!child.pid) { resolveExit(); finish(failure); }
      else stopTree();
    };
    const onExit = () => {
      workerExited = true;
      resolveExit();
      failure ??= reported ? null : new Error("The coding worker ended before completing its run.");
      stopTree();
    };
    const onDisconnect = () => {
      if (!cleanup) requestStop(new Error("The coding worker connection closed."));
    };
    const onMessage = (message: unknown) => {
      if (!message || typeof message !== "object" || !("type" in message)) return;
      if (message.type === "vivary:code-worker:ready" && !sent) {
        sent = true;
        try {
          child.send(request, error => { if (error) requestStop(new Error("The coding worker could not receive its run.")); });
        } catch { requestStop(new Error("The coding worker connection closed.")); }
        return;
      }
      if (!("runId" in message) || message.runId !== input.runId) return;
      if (message.type !== "vivary:code-worker:done" && message.type !== "vivary:code-worker:failed") return;
      reported = true;
      if (message.type === "vivary:code-worker:failed") failure ??= new Error("The Native coding executor failed.");
      stopTree();
    };
    const deadline = setTimeout(() => requestStop(aborted("The coding run reached its 120 second limit.")), RUN_TIMEOUT_MS);
    child.on("message", onMessage);
    child.on("error", onError);
    child.once("exit", onExit);
    child.once("disconnect", onDisconnect);
    input.signal.addEventListener("abort", onAbort, { once: true });
    if (input.signal.aborted) onAbort();
  });
}

export async function hardStopWorkerTree(child: ChildProcess, workerExited: boolean): Promise<void> {
  if (!child.pid) return;
  if (process.platform === "win32") {
    if (workerExited) throw new VivaryCodeWorkerCleanupError();
    // guard:allow-env-credential - Windows system directory selects the fixed taskkill executable.
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    const taskkill = path.join(systemRoot, "System32", "taskkill.exe");
    await new Promise<void>((resolve, reject) => {
      execFile(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true, shell: false, timeout: EXIT_TIMEOUT_MS, maxBuffer: 16 * 1024,
      }, error => { if (error) reject(error); else resolve(); });
    });
    return;
  }
  try { process.kill(-child.pid, "SIGKILL"); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
  }
}
