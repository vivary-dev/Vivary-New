import type { CodePermissionMode } from "./code-permissions";
import { execFile, fork, type ChildProcess, type ForkOptions, type SpawnOptions } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { isVivaryCodeWorkerRequest, type VivaryCodeWorkerRequest, isCodexActionRequest, type CodexActionRequest } from "./code-execution-protocol";
import { credentialFingerprints } from "./credential-redaction.ts";
import { codingRuntimeEnvironment } from "./local-runtime-setup.ts";

export const STARTUP_TIMEOUT_MS = 15_000;
export const TERMINATION_GRACE_MS = 5_000;
// Issue #121. One budget for the whole stop, from its first step. The tree was already sent SIGKILL or
// `taskkill /F`, so a longer wait costs only Stop latency, while a false failure refuses every later run.
export const CLEANUP_TIMEOUT_MS = 15_000;
// On Windows `taskkill` gets the budget less this reserve, so a late `taskkill` success still leaves the exit wait
// this long to observe the worker's exit.
export const CLEANUP_EXIT_RESERVE_MS = 3_000;
// The `taskkill` bound for the other modules that call `hardStopWorkerTree`.
const TASKKILL_TIMEOUT_MS = 3_000;

/**
 * The cleanup step that failed and what it threw. `worker-exited` means a Windows worker exited after it was sent its
 * run. `taskkill` cannot reach that worker's descendants, so it never ran.
 */
export type CleanupFailure = { step: "taskkill" | "exit" | "group" | "worker-exited"; error: unknown };

export class VivaryCodeWorkerCleanupError extends Error {
  declare cause?: CleanupFailure;

  constructor(cause?: CleanupFailure) {
    super("The coding process could not be stopped completely. Stop the remaining coding processes before resuming Vivary.",
      cause && { cause });
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
  permissionMode?: CodePermissionMode;
  onRequest?: (request: CodexActionRequest) => Promise<Record<string, unknown>>;
  onRequestResolved?: (requestId: string) => void;
  ownerEmail: string;
  orgId?: string;
  signal: AbortSignal;
}): Promise<void> {
  if (input.signal.aborted) throw aborted();
  const request: VivaryCodeWorkerRequest = {
    type: "vivary:code-worker:start", runId: input.runId, prompt: input.prompt,
    model: input.model, permissionMode: input.permissionMode, ownerEmail: input.ownerEmail, orgId: input.orgId,
    // The worker redacts transcript events with fingerprints of the values the host holds now.
    redaction: credentialFingerprints(),
  };
  if (!isVivaryCodeWorkerRequest(request)) throw new Error("The coding worker received an invalid run request.");
  // startVivary pins cwd to the Workbench package, including relocated desktop builds.
  const entry = path.join(process.cwd(), ".output", "server", "vivary-code-worker.mjs");
  await access(entry).catch(() => { throw new Error("Rebuild Vivary to include the coding worker."); });
  if (input.signal.aborted) throw aborted();

  return new Promise((resolve, reject) => {
    // The worker needs no credential. Claude Code and native Codex get no host MCP servers, and runs are stored in files.
    const environment = codingRuntimeEnvironment(process.env);
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
    // `sent` turns true when ready arrives, even when the host then withholds the run.
    let runSent = false;
    let cleanup: Promise<void> | null = null;
    let grace: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let workerExited = false;
    let resolveExit: () => void;
    const exited = new Promise<void>(done => { resolveExit = done; });

    const finish = (error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupDeadline);
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
        const deadline = Date.now() + CLEANUP_TIMEOUT_MS;
        let step: CleanupFailure["step"] = process.platform !== "win32" ? "group"
          : workerExited ? "worker-exited" : "taskkill";
        try {
          if (!windowsWorkerStoppedCleanly({ platform: process.platform, workerExited, runSent })) {
            await hardStopWorkerTree(child, workerExited, CLEANUP_TIMEOUT_MS - CLEANUP_EXIT_RESERVE_MS);
            if (process.platform === "linux" && child.pid) {
              // The worker leads its own process group, so the group scan also sees the worker.
              await waitForLinuxWorkerGroupExit(child.pid, undefined, deadline - Date.now());
            } else {
              step = "exit";
              await new Promise<void>((resolveStop, rejectStop) => {
                void exited.then(resolveStop);
                // A starved host can run this timer before the poll phase delivers an exit that already
                // happened, so the verdict waits one more turn and reads the exit the host observed.
                exitTimer = setTimeout(() => setImmediate(() => {
                  if (workerExited) resolveStop();
                  else rejectStop(new VivaryCodeWorkerCleanupError());
                }), Math.max(0, deadline - Date.now()));
              });
            }
          }
          finish(failure);
        } catch (error) {
          finish(new VivaryCodeWorkerCleanupError({ step, error }));
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
        clearTimeout(startupDeadline);
        // A ready that arrives after the deadline or an abort must not start the run the host is stopping.
        if (failure) return;
        // A failed write did not deliver the run, so it clears `runSent`. That helps only when the failure is reported
        // before the worker's exit, because `stopTree` reads `runSent` when it starts.
        try {
          runSent = true;
          child.send(request, error => {
            if (!error) return;
            runSent = false;
            requestStop(new Error("The coding worker could not receive its run."));
          });
        } catch {
          runSent = false;
          requestStop(new Error("The coding worker connection closed."));
        }
        return;
      }
      if (!("runId" in message) || message.runId !== input.runId) return;
      if (message.type === "vivary:code-worker:request" && "request" in message && isCodexActionRequest(message.request)) {
        const action = message.request;
        Promise.resolve().then(() => input.onRequest?.(action)).then(result => {
          if (!settled && !cleanup && child.connected) child.send({ type: "vivary:code-worker:response", requestId: action.requestId, result: result ?? { decision: "decline" } }, () => undefined);
        }).catch(() => requestStop(new Error("The Codex approval request could not be handled.")));
        return;
      }
      if (message.type === "vivary:code-worker:resolved" && "requestId" in message && typeof message.requestId === "string") {
        input.onRequestResolved?.(message.requestId);
        return;
      }
      if (message.type !== "vivary:code-worker:done" && message.type !== "vivary:code-worker:failed") return;
      reported = true;
      if (message.type === "vivary:code-worker:failed") failure ??= new Error("The Native coding executor failed.");
      stopTree();
    };
    const startupDeadline = setTimeout(() => requestStop(
      new Error(`The coding worker did not start within ${STARTUP_TIMEOUT_MS / 1_000} seconds.`)), STARTUP_TIMEOUT_MS);
    child.on("message", onMessage);
    child.on("error", onError);
    child.once("exit", onExit);
    child.once("disconnect", onDisconnect);
    input.signal.addEventListener("abort", onAbort, { once: true });
    if (input.signal.aborted) onAbort();
  });
}

/**
 * Issue #121. `taskkill /T` needs a live parent, so Windows cannot stop the tree of a worker that already exited.
 * The worker starts processes only after it receives its run, so a worker that exited before the host sent its run
 * has started nothing and needs no cleanup.
 */
export function windowsWorkerStoppedCleanly(worker: {
  platform: NodeJS.Platform; workerExited: boolean; runSent: boolean;
}): boolean {
  return worker.platform === "win32" && worker.workerExited && !worker.runSent;
}

export async function hardStopWorkerTree(
  child: ChildProcess, workerExited: boolean, taskkillTimeoutMs = TASKKILL_TIMEOUT_MS,
): Promise<void> {
  if (!child.pid) return;
  if (process.platform === "win32") {
    if (workerExited) throw new VivaryCodeWorkerCleanupError();
    // guard:allow-env-credential - Windows system directory selects the fixed taskkill executable.
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    const taskkill = path.join(systemRoot, "System32", "taskkill.exe");
    await new Promise<void>((resolve, reject) => {
      execFile(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true, shell: false, timeout: taskkillTimeoutMs, maxBuffer: 16 * 1024,
      }, error => { if (error) reject(error); else resolve(); });
    });
    return;
  }
  try { process.kill(-child.pid, "SIGKILL"); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
  }
}

// Tests pass their own reader to produce read errors that a Linux kernel shows only in a race.
const linuxProc = {
  list: () => readdir("/proc"),
  stat: (pid: string) => readFile(`/proc/${pid}/stat`, "utf8"),
};

export async function linuxWorkerGroupHasLiveMember(groupId: number, proc = linuxProc): Promise<boolean> {
  let entries: string[];
  try { entries = await proc.list(); }
  catch { throw new VivaryCodeWorkerCleanupError(); }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    let raw: string;
    try { raw = await proc.stat(entry); }
    catch (error) {
      // ENOENT is a process that exited before the open. ESRCH is one reaped between the open and the read, which a
      // Linux kernel reports and gVisor does not. Neither is a live member. Any other error fails closed.
      if (error && typeof error === "object" && "code" in error && (error.code === "ENOENT" || error.code === "ESRCH")) continue;
      throw new VivaryCodeWorkerCleanupError();
    }
    if (linuxProcStatIsLiveGroupMember(raw, groupId)) return true;
  }
  return false;
}

export function linuxProcStatIsLiveGroupMember(raw: string, groupId: number): boolean {
  const end = raw.lastIndexOf(")");
  const fields = end < 0 ? [] : raw.slice(end + 2).trim().split(/\s+/);
  const state = fields[0];
  const processGroup = Number(fields[2]);
  // Kernel threads can have process group zero. They cannot be in our positive group.
  if (fields.length < 3 || !state || !Number.isSafeInteger(processGroup) || processGroup < 0) {
    throw new VivaryCodeWorkerCleanupError();
  }
  return processGroup === groupId && state !== "Z" && state !== "X";
}

export async function waitForLinuxWorkerGroupExit(
  groupId: number, inspect = linuxWorkerGroupHasLiveMember, timeoutMs = CLEANUP_TIMEOUT_MS,
): Promise<void> {
  if (!Number.isSafeInteger(groupId) || groupId < 1) throw new VivaryCodeWorkerCleanupError();
  const deadline = Date.now() + timeoutMs;
  let emptyObservations = 0;
  for (;;) {
    const live = await scanBefore(deadline, () => inspect(groupId));
    // Issue #121. At the deadline the last completed scan decides, not the clock. The group was sent SIGKILL
    // before this wait, so an empty scan is trusted even when no time is left for a second one.
    if (live === undefined) {
      if (emptyObservations > 0) return;
      throw new VivaryCodeWorkerCleanupError();
    }
    emptyObservations = live ? 0 : emptyObservations + 1;
    // /proc traversal is not atomic. A second empty scan catches a group
    // member that appeared after the first scan passed its PID.
    if (emptyObservations === 2) return;
    if (live) await delay(Math.min(20, Math.max(1, deadline - Date.now())));
  }
}

/** The scan's result, or undefined when the deadline passes before the scan finishes. */
function scanBefore(deadline: number, scan: () => Promise<boolean>): Promise<boolean | undefined> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), remaining);
    void scan().then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}
