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
// Issue #121. A check after a stop gives a Linux group this long to empty, which also gives a slow stop one more second.
const CLEANUP_CHECK_MS = 1_000;
// Bounds a stuck PowerShell. One start plus one CIM query took under a second on a Windows laptop.
const WINDOWS_SCAN_TIMEOUT_MS = 10_000;
// The worker's Windows identity comes from the host clock around `fork`, which creates the process before it returns.
const WORKER_CREATED_BEFORE_MS = 1_000;
const WORKER_CREATED_AFTER_MS = 5_000;
// A dead parent starts nothing, so a process created this long after the worker's observed exit is not its child.
const WORKER_CHILDREN_AFTER_EXIT_MS = 1_000;
const MAX_TRACKED_PROCESSES = 200;

/**
 * The cleanup step that failed and what it threw. `worker-exited` means a Windows worker exited after it was sent its
 * run. `taskkill` cannot reach that worker's descendants, so it never ran.
 */
export type CleanupFailure = { step: "taskkill" | "exit" | "group" | "worker-exited"; error: unknown };

/**
 * A process that outlived a stop. `name` is the Linux `comm` or the Windows image name, never a command line. `start`
 * tells it apart from a later process that reuses its PID: the Windows creation time in Unix milliseconds, or the Linux
 * start time in clock ticks after boot. Only equality with a value from the same host means anything.
 */
export type LeftoverProcess = { pid: number; name: string; start: number };

/**
 * One Windows process, or the worker, by PID and creation time, so a reused PID never matches. Times are Unix
 * milliseconds. A process read from a scan has createdFrom === createdTo. `childrenTo` is set when the worker's exit was
 * observed, because a dead parent starts nothing.
 */
export type WindowsProcessIdentity = { pid: number; createdFrom: number; createdTo: number; childrenTo: number | null };

/** What a later check needs to find the same processes again, including after a Vivary restart. */
export type CleanupTarget =
  | { platform: "linux"; groupId: number; bootId: string | null }
  | { platform: "win32"; tracked: WindowsProcessIdentity[] };

/**
 * One observation of a target. `hidden` is Linux only: the kernel reports a group member that Vivary could not read,
 * for example under `hidepid=1`. A Windows `target` also tracks every process the scan found.
 */
export type CleanupCheck =
  | { result: "clean" }
  | { result: "remaining"; remaining: LeftoverProcess[]; hidden: boolean; target: CleanupTarget }
  | { result: "unavailable" };

/** A failed stop's target, null on a platform Vivary cannot check, and the one check taken right after the failure. */
export type WorkerLeftovers = { target: CleanupTarget | null; check: Exclude<CleanupCheck, { result: "clean" }> };

/** One scan of a Linux process group. */
export type LinuxGroupObservation = { members: LeftoverProcess[]; hidden: boolean };

export class VivaryCodeWorkerCleanupError extends Error {
  declare cause?: CleanupFailure;
  /** Set on the error a run settles with. */
  readonly leftovers?: WorkerLeftovers;
  /** Set when the Linux group wait ran out of time, from its last completed scan. */
  readonly observation?: LinuxGroupObservation;

  constructor(cause?: CleanupFailure, details: { leftovers?: WorkerLeftovers; observation?: LinuxGroupObservation } = {}) {
    super("The coding process could not be stopped completely. Stop the remaining coding processes before resuming Vivary.",
      cause && { cause });
    this.name = "VivaryCodeWorkerCleanupError";
    this.leftovers = details.leftovers;
    this.observation = details.observation;
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
    const startedAt = Date.now();
    const child = fork(entry, [], forkOptions);
    let exitedAt: number | null = null;
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
    // Issue #121. One fresh check after a failed stop. When it finds nothing left, the stop did finish.
    const failedStopOutcome = async (cause: CleanupFailure): Promise<Error | null> => {
      let target: CleanupTarget | null = null;
      let check: CleanupCheck = { result: "unavailable" };
      try {
        target = await workerCleanupTarget(child.pid, startedAt, exitedAt);
        if (target) check = await checkWorkerCleanup(target);
      } catch { /* An unexpected failure leaves the check unavailable, which still refuses later runs. */ }
      return check.result === "clean" ? failure
        : new VivaryCodeWorkerCleanupError(cause, { leftovers: { target, check } });
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
          finish(await failedStopOutcome({ step, error }));
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
      exitedAt = Date.now();
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

function errorCode(error: unknown): unknown {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

/** Reads `/proc` and signals a process group. Tests pass their own to produce errors a kernel shows only in a race. */
type LinuxProcReader = {
  signalGroup: (groupId: number) => void;
  list: () => Promise<string[]>;
  stat: (pid: string) => Promise<string>;
};

const linuxProc: LinuxProcReader = {
  signalGroup: groupId => { process.kill(-groupId, 0); },
  list: () => readdir("/proc"),
  stat: pid => readFile(`/proc/${pid}/stat`, "utf8"),
};

/**
 * Issue #121. The live members of a process group, by PID, `comm` name, and start time. Only `stat` is read, never
 * `cmdline`, `environ`, or `status`, because arguments and environments can carry secrets. The kernel's answer to
 * signal 0 decides whether the group exists, so a member that `/proc` cannot show is reported as `hidden`, never as
 * gone.
 */
export async function scanLinuxWorkerGroup(groupId: number, proc = linuxProc): Promise<LinuxGroupObservation> {
  try { proc.signalGroup(groupId); } catch (error) {
    // ESRCH means no process, zombies included, has this group id. EPERM means one exists that we may not signal.
    if (errorCode(error) === "ESRCH") return { members: [], hidden: false };
    if (errorCode(error) !== "EPERM") throw new VivaryCodeWorkerCleanupError();
  }
  let entries: string[];
  try { entries = await proc.list(); }
  catch { throw new VivaryCodeWorkerCleanupError(); }
  const members: LeftoverProcess[] = [];
  let zombie = false;
  let unreadable = false;
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    let raw: string;
    try { raw = await proc.stat(entry); }
    catch (error) {
      // ENOENT is a process that exited before the open. ESRCH is one reaped between the open and the read, which a
      // Linux kernel reports and gVisor does not. EACCES and EPERM are another user's entry under `hidepid=1`, which
      // could be a member. Any other error fails closed.
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ESRCH") continue;
      if (code === "EACCES" || code === "EPERM") { unreadable = true; continue; }
      throw new VivaryCodeWorkerCleanupError();
    }
    const stat = readLinuxProcStat(raw);
    if (stat.processGroup !== groupId) continue;
    if (stat.state === "Z" || stat.state === "X") zombie = true;
    else members.push({ pid: Number(entry), name: stat.name, start: stat.start });
  }
  // The group exists. A visible zombie explains that only when no entry was unreadable.
  return { members, hidden: members.length === 0 && (!zombie || unreadable) };
}

/** The fields of a `/proc/<pid>/stat` line that the group scan uses. The `comm` name may itself hold `)` and spaces. */
export function readLinuxProcStat(raw: string): { name: string; state: string; processGroup: number; start: number } {
  const open = raw.indexOf("(");
  const close = raw.lastIndexOf(")");
  const fields = open < 0 || close < open ? [] : raw.slice(close + 2).trim().split(/\s+/);
  // The fields after `comm` start at field 3, so the group is field 5 and the start time is field 22.
  const state = fields[0];
  const processGroup = Number(fields[2]);
  const start = Number(fields[19]);
  // Kernel threads can have process group zero. They cannot be in our positive group.
  if (!state || !Number.isSafeInteger(processGroup) || processGroup < 0 || !Number.isSafeInteger(start) || start < 0) {
    throw new VivaryCodeWorkerCleanupError();
  }
  return { name: raw.slice(open + 1, close), state, processGroup, start };
}

export async function waitForLinuxWorkerGroupExit(
  groupId: number, inspect: (groupId: number) => Promise<LinuxGroupObservation> = scanLinuxWorkerGroup,
  timeoutMs = CLEANUP_TIMEOUT_MS,
): Promise<void> {
  if (!Number.isSafeInteger(groupId) || groupId < 1) throw new VivaryCodeWorkerCleanupError();
  const deadline = Date.now() + timeoutMs;
  let emptyObservations = 0;
  let lastLive: LinuxGroupObservation | undefined;
  for (;;) {
    const observation = await scanBefore(deadline, () => inspect(groupId));
    // Issue #121. At the deadline the last completed scan decides, not the clock. The group was sent SIGKILL
    // before this wait, so an empty scan is trusted even when no time is left for a second one.
    if (observation === undefined) {
      if (emptyObservations > 0) return;
      throw new VivaryCodeWorkerCleanupError(undefined, { observation: lastLive });
    }
    const live = observation.members.length > 0 || observation.hidden;
    if (live) lastLive = observation;
    emptyObservations = live ? 0 : emptyObservations + 1;
    // /proc traversal is not atomic. A second empty scan catches a group
    // member that appeared after the first scan passed its PID.
    if (emptyObservations === 2) return;
    if (live) await delay(Math.min(20, Math.max(1, deadline - Date.now())));
  }
}

/** The scan's result, or undefined when the deadline passes before the scan finishes. */
function scanBefore<T>(deadline: number, scan: () => Promise<T>): Promise<T | undefined> {
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

/** One row of the Windows process scan. `created` is null for the System and Idle processes. */
export type WindowsProcessRow = { pid: number; parentPid: number; created: number | null; name: string };

// The query names four properties, so WMI never returns a command line, a path, or an owner to Vivary. Creation
// times become Unix milliseconds, which compare exactly as numbers. Windows file names cannot hold a tab.
const WINDOWS_PROCESS_SCAN = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
  + "Get-CimInstance -Query 'SELECT ProcessId,ParentProcessId,Name,CreationDate FROM Win32_Process' | "
  + "ForEach-Object { @($_.ProcessId, $_.ParentProcessId, "
  + "$(if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() }), $_.Name) -join [char]9 }";

function windowsSystem32(): string {
  // guard:allow-env-credential - Windows system directory selects fixed system executables.
  return path.join(process.env.SystemRoot || "C:\\Windows", "System32");
}

/** Issue #121. Every process on this Windows host by PID, parent PID, creation time, and image name. */
export async function scanWindowsProcesses(): Promise<WindowsProcessRow[]> {
  const powershell = path.join(windowsSystem32(), "WindowsPowerShell", "v1.0", "powershell.exe");
  const output = await new Promise<string>((resolve, reject) => {
    execFile(powershell, ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_PROCESS_SCAN], {
      windowsHide: true, shell: false, timeout: WINDOWS_SCAN_TIMEOUT_MS, maxBuffer: 1024 * 1024, encoding: "utf8",
    }, (error, stdout) => { if (error) reject(error); else resolve(stdout); });
  });
  const rows = parseWindowsProcessRows(output);
  if (!rows) throw new Error("The Windows process scan printed output Vivary cannot read.");
  return rows;
}

/** Null when any line is not a row or no row was printed, so a broken scan never reads as an empty one. */
export function parseWindowsProcessRows(text: string): WindowsProcessRow[] | null {
  const rows: WindowsProcessRow[] = [];
  // PowerShell can start UTF-8 output with a byte order mark.
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line) continue;
    const match = /^(\d+)\t(\d+)\t(\d*)\t(.+)$/.exec(line);
    if (!match) return null;
    rows.push({ pid: Number(match[1]), parentPid: Number(match[2]), created: match[3] ? Number(match[3]) : null,
      name: match[4] });
  }
  return rows.length ? rows : null;
}

/**
 * Issue #121. The rows that are tracked processes or descend from one, by parent PID and creation time. A row created
 * before its parent, or whose parent PID now belongs to a process older than the row, is the child of a process that
 * reused the PID. The returned `tracked` adds each row found, so a grandchild stays traceable after its parent exits.
 */
export function windowsLeftovers(rows: readonly WindowsProcessRow[], tracked: readonly WindowsProcessIdentity[]): {
  remaining: LeftoverProcess[]; tracked: WindowsProcessIdentity[];
} {
  const timed = rows.filter((row): row is WindowsProcessRow & { created: number } => row.created !== null);
  const holds = (identity: WindowsProcessIdentity, row: { pid: number; created: number }) =>
    row.pid === identity.pid && row.created >= identity.createdFrom && row.created <= identity.createdTo;
  const childOf = (identity: WindowsProcessIdentity, row: WindowsProcessRow & { created: number }) =>
    row.parentPid === identity.pid && row.created >= identity.createdFrom
      && (identity.childrenTo === null || row.created <= identity.childrenTo)
      && !timed.some(other => other.pid === identity.pid && !holds(identity, other) && other.created <= row.created);
  const found = new Map(timed.filter(row => tracked.some(identity => holds(identity, row) || childOf(identity, row)))
    .map(row => [row.pid, row]));
  for (let grew = true; grew;) {
    grew = false;
    for (const row of timed) {
      const parent = found.get(row.parentPid);
      if (found.has(row.pid) || !parent || row.created < parent.created) continue;
      found.set(row.pid, row);
      grew = true;
    }
  }
  const remaining = [...found.values()].map(({ pid, name, created }) => ({ pid, name, start: created }));
  const added = remaining.filter(({ pid, start }) => !tracked.some(identity =>
    identity.pid === pid && identity.createdFrom === start && identity.createdTo === start))
    .map(({ pid, start }) => ({ pid, createdFrom: start, createdTo: start, childrenTo: null }));
  return { remaining, tracked: [...tracked, ...added].slice(0, MAX_TRACKED_PROCESSES) };
}

/** The target that finds a stopped worker's processes again, or null on a platform Vivary cannot check. */
async function workerCleanupTarget(
  pid: number | undefined, startedAt: number, exitedAt: number | null,
): Promise<CleanupTarget | null> {
  if (!pid) return null;
  // The worker leads its own process group on Linux, so the group id is its PID.
  if (process.platform === "linux") return { platform: "linux", groupId: pid, bootId: await readBootId() };
  if (process.platform !== "win32") return null;
  return { platform: "win32", tracked: [{ pid, createdFrom: startedAt - WORKER_CREATED_BEFORE_MS,
    createdTo: startedAt + WORKER_CREATED_AFTER_MS,
    childrenTo: exitedAt === null ? null : exitedAt + WORKER_CHILDREN_AFTER_EXIT_MS }] };
}

function readBootId(): Promise<string | null> {
  return readFile("/proc/sys/kernel/random/boot_id", "utf8").then(text => text.trim() || null, () => null);
}

/** What a check reads. Tests pass their own. */
type CleanupIo = {
  bootId: () => Promise<string | null>;
  proc: LinuxProcReader;
  windowsProcesses: () => Promise<WindowsProcessRow[]>;
};

const cleanupIo: CleanupIo = { bootId: readBootId, proc: linuxProc, windowsProcesses: scanWindowsProcesses };

/**
 * Issue #121. Whether a stopped worker's processes are gone. A check only reads and never acts on a process. A Linux
 * group gets up to a second to empty. A read or scan that fails is `unavailable`, never `clean`.
 */
export async function checkWorkerCleanup(target: CleanupTarget, io: CleanupIo = cleanupIo): Promise<CleanupCheck> {
  if (target.platform === "win32") {
    let rows: WindowsProcessRow[];
    try { rows = await io.windowsProcesses(); } catch { return { result: "unavailable" }; }
    const { remaining, tracked } = windowsLeftovers(rows, target.tracked);
    return remaining.length === 0 ? { result: "clean" }
      : { result: "remaining", remaining, hidden: false, target: { platform: "win32", tracked } };
  }
  // A reboot ended every process, and after one an unrelated group can hold the same small id.
  const bootId = await io.bootId();
  if (target.bootId && bootId && target.bootId !== bootId) return { result: "clean" };
  try {
    await waitForLinuxWorkerGroupExit(target.groupId, groupId => scanLinuxWorkerGroup(groupId, io.proc),
      CLEANUP_CHECK_MS);
    return { result: "clean" };
  } catch (error) {
    const observation = error instanceof VivaryCodeWorkerCleanupError ? error.observation : undefined;
    return observation ? { result: "remaining", remaining: observation.members, hidden: observation.hidden, target }
      : { result: "unavailable" };
  }
}
