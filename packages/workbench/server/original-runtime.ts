import { execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { ActionContractError, fail, isActionContractError, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { adoptionPrivacyRequest } from "../shared/project-adoption";
import { workspacePatternChoices, workspacePreset as preset } from "../shared/workspace-patterns.ts";
import { projectReadBudgetSchema, projectReadKSchema, projectReadQuerySchema, READ_BOUNDS, type ProjectRef } from "../app/lib/project-read-schema.ts";
import { parseStrictJson } from "../../../scripts/registry_contract_model.mjs";
import { requireVivaryCodeUser } from "./local-code-agent";
import { resolveLocalProjectWorkspace, type LocalProjectWorkspace } from "./project-services.mjs";
import { resolveOriginalRuntime } from "./original-runtime-location.mjs";

const requestDocument = z.string().min(1).max(65_536);
// tropo and ozone read their one positional right after the verb and refuse a
// `--` terminator, so a value that looks like an option cannot be passed safely.
const notOptionLike = (value: string) => !value.startsWith("-");
const optionLikeMessage = { message: "The text must not start with a dash." };
const commandSchema = z.discriminatedUnion("verb", [
  z.object({ verb: z.literal("create"), preset: preset.default("coding") }).strict(),
  z.object({ verb: z.literal("adopt"), preset: preset.optional(),
    patternChoices: workspacePatternChoices.optional() }).strict(),
  z.object({ verb: z.literal("pattern-state") }).strict(),
  z.object({ verb: z.literal("decide"), request: requestDocument }).strict(),
  z.object({ verb: z.literal("review") }).strict(),
  z.object({ verb: z.literal("impact"), nodeId: z.string().trim().min(1).max(256).refine(notOptionLike, optionLikeMessage) }).strict(),
  z.object({ verb: z.literal("control"), request: requestDocument }).strict(),
]);

export const originalCommandSchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  command: commandSchema,
}).strict();
export type OriginalCommand = z.infer<typeof commandSchema>;

const planHash = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const adoptionExecutionSchema = z.discriminatedUnion("verb", [
  z.strictObject({ verb: z.literal("adopt-prepare-privacy"), preset: preset.optional(),
    planHash, requestId: z.string().uuid(), privacyRequest: adoptionPrivacyRequest }),
  z.strictObject({ verb: z.literal("adopt-apply"), preset: preset.optional(),
    patternChoices: workspacePatternChoices.optional(),
    planHash, requestId: z.string().uuid() }),
  z.strictObject({ verb: z.literal("adopt-recovery-preview"), transactionHash: planHash, requestId: z.string().uuid() }),
  z.strictObject({ verb: z.literal("adopt-recover"), transactionHash: planHash, planHash, requestId: z.string().uuid() }),
]);
type AdoptionExecution = z.infer<typeof adoptionExecutionSchema>;

// Project reads have no action schema of their own: `project-read.ts` is the
// only caller, and find and check always use the privacy-filtered front door.
const projectReadCommandSchema = z.discriminatedUnion("verb", [
  z.strictObject({ verb: z.literal("doctor") }),
  z.strictObject({ verb: z.literal("capabilities"), preset }),
  z.strictObject({ verb: z.literal("find"), query: projectReadQuerySchema, k: projectReadKSchema, budget: projectReadBudgetSchema }),
  z.strictObject({ verb: z.literal("check") }),
  z.strictObject({ verb: z.literal("logs"), failedOnly: z.boolean() }),
]);
export type ProjectReadCommand = z.infer<typeof projectReadCommandSchema>;
// A Native tool call may run these reads and none of the owner's commands.
const projectReadVerbs: ReadonlySet<string> = new Set(projectReadCommandSchema.options.map(option => option.shape.verb.value));
// The tool gate compares verbs, so no owner command may share a verb with a project read.
const ownerVerbsAreNotReads: [Extract<OriginalCommand["verb"] | AdoptionExecution["verb"], ProjectReadCommand["verb"]>] extends [never]
  ? true : never = true;
void ownerVerbsAreNotReads;
type RuntimeCommand = OriginalCommand | AdoptionExecution | ProjectReadCommand;
const workspaceFields = ["root", "actorId", "projectId", "bindingId", "rootId", "locationRef",
  "bindingRevision", "policyRevision", "verificationKind"] as const;
export function sameOriginalWorkspace(left: LocalProjectWorkspace, right: LocalProjectWorkspace): boolean {
  return workspaceFields.every(field => left[field] === right[field]);
}


const TIMEOUT_MS = 30_000;
const QUEUE_WAIT_MS = 30_000;
const OUTPUT_BYTES = 256 * 1024;
const CHILD_RECEIPT_BYTES = 64 * 1024;
const STALE_RUN_MS = 10 * 60_000;

/**
 * Failures after the project resolved in which the original command produced
 * no report. The runner throws them, and createProjectReadRunner returns them
 * as values.
 */
export const ORIGINAL_RUN_FAILURES = {
  queueTimeout: "vivary_original_queue_timeout",
  timeout: "vivary_original_timeout",
  outputLimit: "vivary_original_output_limit",
  runtimeUnavailable: "vivary_original_runtime_unavailable",
  dataUnavailable: "vivary_original_data_unavailable",
  receiptPath: "vivary_original_receipt_path",
} as const;
export type OriginalRunFailure = typeof ORIGINAL_RUN_FAILURES[keyof typeof ORIGINAL_RUN_FAILURES];
const runFailures = new Set<string>(Object.values(ORIGINAL_RUN_FAILURES));
export function isOriginalRunFailure(error: unknown): error is ActionContractError & { errorCode: OriginalRunFailure } {
  return isActionContractError(error) && runFailures.has(error.errorCode);
}

type AccessMode = "read" | "write";
// One row per command. A write changes one project's files, so it runs alone
// within that project. `receipt` says who records the command: its component,
// in a private file the app appends after the command settles, or the app
// itself. `logs` reads the shared log and records nothing. A governed command
// or a write fails without its component's receipt.
type CommandPolicy = { access: AccessMode } & (
  | { receipt: "component" | "app"; required: boolean }
  | { receipt: "reads-log" });
const commandPolicy: Record<RuntimeCommand["verb"], CommandPolicy> = {
  create: { access: "read", receipt: "component", required: false },
  adopt: { access: "read", receipt: "component", required: false },
  "pattern-state": { access: "read", receipt: "component", required: false },
  decide: { access: "read", receipt: "app", required: true },
  review: { access: "read", receipt: "component", required: false },
  impact: { access: "read", receipt: "component", required: false },
  control: { access: "write", receipt: "component", required: true },
  "adopt-prepare-privacy": { access: "write", receipt: "component", required: true },
  "adopt-apply": { access: "write", receipt: "component", required: true },
  "adopt-recovery-preview": { access: "read", receipt: "component", required: false },
  "adopt-recover": { access: "write", receipt: "component", required: true },
  doctor: { access: "read", receipt: "app", required: false },
  capabilities: { access: "read", receipt: "component", required: false },
  find: { access: "read", receipt: "app", required: false },
  check: { access: "read", receipt: "app", required: false },
  logs: { access: "read", receipt: "reads-log" },
};

export function originalCommandArguments(command: RuntimeCommand, root: string, controlRequestPath?: string) {
  switch (command.verb) {
    case "create": return { args: ["create", root, "--preset", command.preset, "--json", "--no-wizard", "--dry-run"], stdin: "" };
    case "adopt": return { args: ["adopt", root, "--json",
      ...(command.patternChoices ? ["--pattern-choices", "-"] : []),
      ...(command.preset ? ["--preset", command.preset] : [])],
      stdin: command.patternChoices ? JSON.stringify(command.patternChoices) : "" };
    case "pattern-state": return { args: ["adopt", root, "--json", "--pattern-state"], stdin: "" };
    case "adopt-prepare-privacy": return { args: ["adopt", root, "--json", "--yes", "--prepare-privacy",
      "--plan", command.planHash, "--request-id", command.requestId, "--privacy-request", "-",
      ...(command.preset ? ["--preset", command.preset] : [])], stdin: JSON.stringify(command.privacyRequest) };
    case "adopt-apply": return { args: ["adopt", root, "--json", "--yes", "--plan", command.planHash,
      "--request-id", command.requestId,
      ...(command.patternChoices ? ["--pattern-choices", "-"] : []),
      ...(command.preset ? ["--preset", command.preset] : [])],
      stdin: command.patternChoices ? JSON.stringify(command.patternChoices) : "" };
    case "adopt-recovery-preview": return { args: ["adopt", root, "--json", "--recover", command.transactionHash, "--request-id", command.requestId], stdin: "" };
    case "adopt-recover": return { args: ["adopt", root, "--json", "--recover", command.transactionHash,
      "--yes", "--plan", command.planHash, "--request-id", command.requestId], stdin: "" };
    case "doctor": return { args: ["doctor", "--root", root, "--public", "--json"], stdin: "" };
    case "capabilities": return { args: ["capabilities", "--preset", command.preset, "--json"], stdin: "" };
    case "check": return { args: ["check", "--root", root, "--public", "--json"], stdin: "" };
    case "find": return { args: ["find", command.query, "--root", root, "--public", "--json",
      "--k", String(command.k), "--budget", String(command.budget)], stdin: "" };
    // The receipt log comes only from VIVARY_RECEIPT_LOG, never from an argument.
    case "logs": return { args: ["logs", "--json", "--tail", String(READ_BOUNDS.items),
      ...(command.failedOnly ? ["--failed"] : [])], stdin: "" };
    case "decide": return { args: ["decide", "--governed", "--json", "--strict", "-"], stdin: command.request };
    case "review": return { args: ["review", "--root", root, "--json", "--pack", "structure"], stdin: "" };
    case "impact": return { args: ["impact", command.nodeId, "--root", root, "--json"], stdin: "" };
    case "control": {
      if (!controlRequestPath) throw new Error("A private control request file is required.");
      return { args: ["control", "--governed", "--json", "--strict", controlRequestPath], stdin: "" };
    }
  }
}

/** `receiptLog` is where the child may write or read receipts. A child given none writes none. */
export function originalChildEnvironment(environment: NodeJS.ProcessEnv, receiptLog: string | undefined, projectRoot?: string): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const name of ["PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "HOME", "USERPROFILE", "TEMP", "TMP", "LANG", "LC_ALL", "TZ"]) {
    if (environment[name]) child[name] = environment[name];
  }
  child.PATH = (environment.PATH ?? "").split(path.delimiter)
    .filter(directory => path.isAbsolute(directory) && (!projectRoot || !containsPath(projectRoot, directory)))
    .join(path.delimiter);
  child.PYTHONNOUSERSITE = "1";
  if (receiptLog) child.VIVARY_RECEIPT_LOG = receiptLog;
  return child;
}

function containsPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function commandError(message: string, errorCode: string, statusCode = 409): never {
  return fail(message, { errorCode, statusCode });
}

const receiptDirectoryError = () => commandError("Vivary's command receipt directory must stay in application data.",
  ORIGINAL_RUN_FAILURES.receiptPath);
const receiptFileError = () => commandError("Vivary's command receipt must be a private application file.",
  ORIGINAL_RUN_FAILURES.receiptPath);

async function requireReceiptFile(receiptLog: string): Promise<void> {
  const receipt = await lstat(receiptLog)
    .catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? null : receiptFileError());
  if (receipt && (!receipt.isFile() || receipt.nlink !== 1)) receiptFileError();
}

async function appendReceipts(receiptLog: string, lines: string): Promise<void> {
  try {
    const receipt = await open(receiptLog,
      constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
      // Windows has no O_NOFOLLOW, so the opened file must be the path's own regular file.
      const [opened, named] = await Promise.all([receipt.stat(), lstat(receiptLog)]);
      if (!named.isFile() || opened.nlink !== 1 || opened.ino !== named.ino || opened.dev !== named.dev) receiptFileError();
      await receipt.appendFile(lines, "utf8");
    } finally { await receipt.close(); }
  } catch (error) {
    if (isActionContractError(error)) throw error;
    receiptFileError();
  }
}

// Only the app appends to the shared log. Windows emulates append with a
// seek, so two children appending to one file at once could overwrite each
// other's line.
async function componentReceipts(childLog: string): Promise<string> {
  const info = await lstat(childLog).catch(() => null);
  if (!info?.isFile() || info.nlink !== 1 || info.size === 0 || info.size > CHILD_RECEIPT_BYTES) return "";
  const lines = await readFile(childLog, "utf8").catch(receiptFileError);
  return lines.endsWith("\n") ? lines : lines + "\n";
}

// A crash leaves its private folder behind, sometimes with a receipt the app
// never appended. Old folders have their receipt appended once and are
// removed. A folder whose receipt cannot be read or appended stays for a later
// sweep, and a command another request just started keeps its folder.
async function sweepStaleRuns(receiptDir: string, receiptLog: string): Promise<void> {
  const swept = commandHost.sweptDirectories ??= new Set<string>();
  if (swept.has(receiptDir)) return;
  swept.add(receiptDir);
  let logged: string | undefined;
  for (const name of await readdir(receiptDir).catch(() => [])) {
    const entry = path.join(receiptDir, name);
    // `request-` folders come from builds that kept control's request apart. They hold no receipt.
    const info = /^(run|request)-/.test(name) ? await lstat(entry).catch(() => null) : null;
    if (!info?.isDirectory() || Date.now() - info.mtimeMs <= STALE_RUN_MS) continue;
    const lines = await componentReceipts(path.join(entry, "receipts.jsonl")).catch(() => null);
    if (lines === null) continue;
    if (lines) {
      // A crash or a failed delete after the append leaves a receipt the log already holds.
      logged ??= await readFile(receiptLog, "utf8").catch(() => "");
      if (!logged.includes(lines) && !await appendReceipts(receiptLog, lines).then(() => true, () => false)) continue;
    }
    await rm(entry, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
  }
}

type Settled = { durationMs: number } & ({ exitCode: number | null } | { failure: string });

// Everything one command does with receipts, driven by its policy row.
async function openReceipts(command: RuntimeCommand, receiptDir: string, pythonVersion: string) {
  const policy = commandPolicy[command.verb];
  const receiptLog = path.join(receiptDir, "receipts.jsonl");
  const required = policy.receipt !== "reads-log" && policy.required;
  // `logs` reads the shared log, and a required receipt must be writable before its command runs.
  if (policy.receipt === "reads-log" || required) await requireReceiptFile(receiptLog);
  // A component's private folder holds its receipt, and control's request file.
  const privateDir = policy.receipt !== "component" ? undefined
    : await mkdtemp(path.join(receiptDir, "run-")).catch(() => required ? receiptDirectoryError() : undefined);
  const componentLog = privateDir ? path.join(privateDir, "receipts.jsonl") : undefined;
  // Exo refuses stdin when receipts are enabled, so control reads its request
  // from a file in its private folder. Control is required, so the folder exists.
  const request = command.verb === "control" && privateDir
    ? { file: path.join(privateDir, "request.json"), text: command.request } : undefined;
  // Control's request exists only while its admitted child can read it.
  const dropRequest = () => request
    ? rm(request.file, { force: true, maxRetries: 3 }).then(() => undefined, () => undefined) : Promise.resolve();
  let appended = false;
  return {
    requestFile: request?.file,
    stageRequest: async () => {
      if (request) await writeFile(request.file, request.text, { encoding: "utf8", mode: 0o600, flag: "wx" });
    },
    dropRequest,
    childLog: policy.receipt === "reads-log" ? receiptLog : componentLog,
    settle: async (settled: Settled) => {
      if (policy.receipt === "reads-log") return;
      const recorded = (async () => {
        const component = componentLog ? await componentReceipts(componentLog) : "";
        const succeeded = "exitCode" in settled && settled.exitCode === 0;
        // A governed command or a write that finished without its component's receipt fails once the app records it.
        const missing = required && policy.receipt === "component" && succeeded && !component;
        const failure = "failure" in settled ? settled.failure : missing ? ORIGINAL_RUN_FAILURES.receiptPath : undefined;
        // The app records every command whose component wrote no receipt.
        const app = policy.receipt === "app" || !component ? JSON.stringify({
          schema: "vivary.run_receipt.v1", timestamp: new Date().toISOString(),
          tool: "vivary-workbench", command: command.verb, exit_code: "exitCode" in settled ? settled.exitCode : null,
          ok: succeeded && !missing, duration_ms: settled.durationMs, python: pythonVersion, platform: process.platform,
          receipt_source: "app", ...(failure ? { error_type: failure } : {}),
        }) + "\n" : "";
        await appendReceipts(receiptLog, component + app);
        appended = true;
        if (componentLog && component) await rm(componentLog, { force: true, maxRetries: 3 }).catch(() => undefined);
        if (missing) commandError("The command finished but did not record its receipt.", ORIGINAL_RUN_FAILURES.receiptPath);
      })();
      await (required ? recorded : recorded.catch(() => undefined));
    },
    // Cleanup never decides a command's outcome. A receipt the app did not
    // append keeps its folder for a later sweep.
    dispose: async () => {
      await dropRequest();
      if (!privateDir || (!appended && await lstat(componentLog!).then(() => true, () => false))) return;
      await rm(privateDir, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined);
    },
  };
}

async function validateGovernedRequest(command: RuntimeCommand, workspace: LocalProjectWorkspace): Promise<void> {
  if (command.verb !== "decide" && command.verb !== "control") return;
  try {
    if (await realpath(workspace.root) !== workspace.root) throw new Error("project root changed");
    const object = (value: unknown) => z.record(z.string(), z.unknown()).parse(value);
    const request = object(parseStrictJson(command.request));
    const actor = (value: unknown) => z.object({ kind: z.literal("human"), id: z.literal(workspace.actorId) }).strict().parse(value);
    const paths = async (value: unknown) => {
      for (const entry of z.array(z.string()).min(1).parse(value)) {
        if (!path.isAbsolute(entry)) throw new Error("foreign scope");
        const rawComponents = entry.slice(path.parse(entry).root.length).split(/[\\/]/);
        if (rawComponents.some(component => component === "." || component === "..")
          || !containsPath(workspace.root, entry)) throw new Error("foreign scope");
        const relative = path.relative(workspace.root, entry);
        const components = relative === "" ? [] : relative.split(path.sep);
        let current = workspace.root;
        for (let index = 0; index < components.length; index += 1) {
          current = path.join(current, components[index]);
          let info;
          try { info = await lstat(current); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
            throw error;
          }
          if (info.isSymbolicLink() || (index < components.length - 1 && !info.isDirectory())) {
            throw new Error("scope crosses a link or non-directory");
          }
          if (!containsPath(workspace.root, await realpath(current))) throw new Error("foreign resolved scope");
        }
      }
    };
    const scope = async (value: unknown) => {
      const entry = object(value);
      if (entry.project !== workspace.projectId) throw new Error("foreign project");
      await paths(entry.paths);
    };
    const contributor = (value: unknown, optional = false) => {
      if (value !== "contributor" && !(optional && value === undefined)) throw new Error("unsupported authority");
    };
    const capsule = async (value: unknown) => paths(object(object(value).task).scope);
    if (command.verb === "decide") {
      actor(request.actor);
      contributor(request.authority_class);
      await scope(request.scope);
      await capsule(request.capsule);
    } else {
      const input = object(request.input);
      const state = object(request.state);
      if (state.claims !== undefined) {
        for (const value of z.array(z.unknown()).parse(state.claims)) {
          const claim = object(value);
          await scope(claim.scope);
          contributor(claim.authority_class);
        }
      }
      if (request.operation === "claim") {
        actor(input.actor); await scope(input.scope); contributor(input.authority_class, true);
      } else if (request.operation === "release") {
        actor(input.actor);
      } else if (request.operation === "handoff") {
        actor(input.from_actor); contributor(input.to_authority_class, true); await capsule(input.capsule);
      } else if (request.operation === "record_execution") {
        await capsule(input.capsule);
      }
    }
  } catch {
    commandError("Use the signed-in project actor, contributor authority, and direct paths inside the selected project. Linked or parent-relative paths are not accepted.", "vivary_original_request_identity", 400);
  }
}

type ActiveCommand = { stop: (error: Error) => void; settled: Promise<void> };
type Waiter = { projectId: string; mode: AccessMode; ceiling: number; start: () => void; refuse: (error: Error) => void };
type ProjectAccess = { reads: number; writing: boolean };
type CommandHost = {
  closing: boolean; active: Set<ActiveCommand>; shutdown: Promise<void> | null;
  running: number; projects: Map<string, ProjectAccess>; waiting: Waiter[]; sweptDirectories?: Set<string>;
  /** Commands registered before their request is staged, until their receipt is recorded and their private folder is gone. */
  recording?: Set<Promise<void>>;
};
// Action source and Nitro's bundled lifecycle plugin share the same process owner.
const commandHostKey = Symbol.for("vivary.workbench.original-commands");
const commandProcess = globalThis as typeof globalThis & { [commandHostKey]?: CommandHost };
const commandHost: CommandHost = commandProcess[commandHostKey] ??= {
  closing: false, active: new Set<ActiveCommand>(), shutdown: null, running: 0, projects: new Map(), waiting: [],
};
const closingError = () => new Error("Vivary is closing. New original commands cannot start.");

// Codex's read/write tool lock, keyed by project. Waiters start in arrival
// order within a project, so a waiting write holds back the reads behind it.
function admitWaiting(): void {
  const blocked = new Set<string>();
  for (const waiter of [...commandHost.waiting]) {
    if (commandHost.running >= waiter.ceiling) return;
    const access = commandHost.projects.get(waiter.projectId);
    if (blocked.has(waiter.projectId) || (waiter.mode === "write" ? access : access?.writing)) {
      blocked.add(waiter.projectId);
      continue;
    }
    const index = commandHost.waiting.indexOf(waiter);
    if (index < 0) continue;
    commandHost.waiting.splice(index, 1);
    const held = access ?? { reads: 0, writing: false };
    if (waiter.mode === "write") held.writing = true; else held.reads += 1;
    commandHost.projects.set(waiter.projectId, held);
    commandHost.running += 1;
    waiter.start();
  }
}

function acquireProject(projectId: string, mode: AccessMode, ceiling: number, signal?: AbortSignal): Promise<() => void> {
  signal?.throwIfAborted();
  if (commandHost.closing) throw closingError();
  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const access = commandHost.projects.get(projectId)!;
      if (mode === "write") access.writing = false; else access.reads -= 1;
      if (!access.writing && access.reads === 0) commandHost.projects.delete(projectId);
      commandHost.running -= 1;
      admitWaiting();
    };
    const settle = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); };
    const waiter: Waiter = {
      projectId, mode, ceiling,
      start: () => { settle(); resolve(release); },
      refuse: error => { settle(); reject(error); },
    };
    const leave = (error: Error) => {
      const index = commandHost.waiting.indexOf(waiter);
      if (index < 0) return;
      commandHost.waiting.splice(index, 1);
      waiter.refuse(error);
      admitWaiting();
    };
    const timer = setTimeout(() => leave(new ActionContractError(
      "Earlier original Vivary commands are still running. Try again when they finish.",
      { errorCode: ORIGINAL_RUN_FAILURES.queueTimeout, statusCode: 503 })), QUEUE_WAIT_MS);
    const cancel = () => leave(new Error("The original Vivary command was cancelled."));
    signal?.addEventListener("abort", cancel, { once: true });
    commandHost.waiting.push(waiter);
    admitWaiting();
  });
}

export function shutdownOriginalCommands(): Promise<void> {
  commandHost.closing = true;
  for (const waiter of commandHost.waiting.splice(0)) waiter.refuse(closingError());
  if (!commandHost.shutdown) {
    const active = [...commandHost.active];
    for (const command of active) command.stop(new Error("Vivary is closing. The original command was stopped."));
    // A stopped command records its receipt after its child exits, so shutdown waits for that receipt.
    // A command still re-checking its project cannot start a child now, so shutdown does not wait for it.
    commandHost.shutdown = Promise.allSettled([...active.map(command => command.settled), ...commandHost.recording ?? []])
      .then(() => undefined);
  }
  return commandHost.shutdown;
}

export function runOriginalProcess(executable: string, args: string[], stdin: string, cwd: string, environment: NodeJS.ProcessEnv, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (commandHost.closing) throw closingError();
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd, env: environment, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    let treeStopped: Promise<void> = Promise.resolve();
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      if (!child.pid) return;
      if (process.platform === "win32") {
        // guard:allow-env-credential - Windows system directory locates its process cleanup utility.
        const taskkill = path.join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? "C:/Windows", "System32", "taskkill.exe");
        treeStopped = new Promise<void>(done => {
          execFile(taskkill, ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 5_000 }, killError => {
            if (killError && child.exitCode === null && child.signalCode === null) {
              failure = new Error("The command could not be stopped. Check the local runtime before retrying.");
            }
            done();
          });
        });
      } else {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch (killError) {
          if (!(killError && typeof killError === "object" && "code" in killError && killError.code === "ESRCH")) {
            failure = new Error("The command could not be stopped. Check the local runtime before retrying.");
          }
        }
      }
    };
    let markSettled!: () => void;
    const active: ActiveCommand = { stop, settled: new Promise<void>(done => { markSettled = done; }) };
    commandHost.active.add(active);
    const timer = setTimeout(() => stop(new ActionContractError("The original Vivary command exceeded its 30-second limit.",
      { errorCode: ORIGINAL_RUN_FAILURES.timeout, statusCode: 504 })), TIMEOUT_MS);
    const abort = () => stop(new Error("The original Vivary command was cancelled."));
    signal?.addEventListener("abort", abort, { once: true });
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > OUTPUT_BYTES) stop(new ActionContractError("The original Vivary command exceeded its output limit.",
        { errorCode: ORIGINAL_RUN_FAILURES.outputLimit, statusCode: 413 }));
      else target.push(chunk);
    };
    child.stdout.on("data", collect(output));
    child.stderr.on("data", collect(errors));
    // Without IPC or ChildProcess.kill, a child error means the spawn failed.
    child.on("error", () => { failure ??= new ActionContractError("The bundled Vivary runtime could not start. Reinstall Vivary, then try again.",
      { errorCode: ORIGINAL_RUN_FAILURES.runtimeUnavailable, statusCode: 503 }); });
    child.stdin.on("error", error => { if ((error as NodeJS.ErrnoException).code !== "EPIPE") stop(error); });
    child.on("close", async (exitCode, exitSignal) => {
      clearTimeout(timer);
      await treeStopped;
      signal?.removeEventListener("abort", abort);
      commandHost.active.delete(active);
      markSettled();
      if (failure) reject(failure);
      else resolve({ exitCode, stdout: Buffer.concat(output).toString("utf8"), stderr: Buffer.concat(errors).toString("utf8"), signal: exitSignal });
    });
    child.stdin.end(stdin);
  });
}

type Dependencies = {
  resolveWorkspace: (context: ActionRunContext | undefined, projectId: string) => Promise<LocalProjectWorkspace>;
  environment: () => NodeJS.ProcessEnv;
  execute: typeof runOriginalProcess;
  /** Concurrent original children. Callers past it wait, they are never refused. */
  parallelism: number;
};

const runtimeDependencies: Dependencies = {
  resolveWorkspace: resolveLocalProjectWorkspace, environment: () => process.env, execute: runOriginalProcess,
  // The floor lets the Details panel's sections run together on a one or two core machine.
  parallelism: Math.max(4, availableParallelism()),
};

// Resolution and the run are separate steps, so a project read can still name
// its project when the run fails.
function createRuntimeCommandRunner(dependencies: Dependencies) {
  const resolve = async (context: ActionRunContext | undefined, projectId: string, expectedWorkspace?: LocalProjectWorkspace) => {
    requireVivaryCodeUser(context);
    const workspace = await dependencies.resolveWorkspace(context, projectId);
    if (expectedWorkspace && !sameOriginalWorkspace(workspace, expectedWorkspace)) {
      commandError("The reviewed project changed. Prepare a new preview.", "vivary_original_project_changed");
    }
    return workspace;
  };
  const execute = async (workspace: LocalProjectWorkspace, command: RuntimeCommand, context?: ActionRunContext) => {
    // A command that arrives after shutdown began touches no files.
    if (commandHost.closing) throw closingError();
    if (context?.caller === "tool" && !projectReadVerbs.has(command.verb)) {
      commandError("A Native tool call can only read project reports.", "vivary_original_tool_caller", 403);
    }
    const policy = commandPolicy[command.verb];
    const { projectId } = workspace;
    const environment = dependencies.environment();
    const runtime = await resolveOriginalRuntime(environment.VIVARY_ORIGINAL_RUNTIME).catch(() => commandError(
      "The bundled Vivary runtime is unavailable on this host. Reinstall Vivary, then try again.",
      ORIGINAL_RUN_FAILURES.runtimeUnavailable, 503));
    if (!environment.VIVARY_DATA_DIR || !path.isAbsolute(environment.VIVARY_DATA_DIR)) {
      commandError("Vivary application data is not configured.", ORIGINAL_RUN_FAILURES.dataUnavailable);
    }
    const dataDir = await realpath(environment.VIVARY_DATA_DIR).catch(() => commandError(
      "Vivary application data is unavailable on this host.", ORIGINAL_RUN_FAILURES.dataUnavailable));
    if (containsPath(workspace.root, dataDir)) {
      commandError("Choose a project that does not contain Vivary's private application data.", "vivary_original_data_in_project");
    }
    const receiptDir = path.join(dataDir, "original-runtime");
    await mkdir(receiptDir, { recursive: true, mode: 0o700 }).catch(receiptDirectoryError);
    if (await realpath(receiptDir).catch(receiptDirectoryError) !== receiptDir) receiptDirectoryError();
    await sweepStaleRuns(receiptDir, path.join(receiptDir, "receipts.jsonl"));
    if ("request" in command && Buffer.byteLength(command.request, "utf8") > 65_536) {
      commandError("The command input exceeds its allowed format or size.", "vivary_original_input", 400);
    }
    await validateGovernedRequest(command, workspace);
    const receipts = await openReceipts(command, receiptDir, runtime.version);
    const recorded = Promise.withResolvers<void>();
    // Shutdown waits for a started command until its receipt is recorded and its private folder is gone.
    const record = async (settled: Settled) => {
      try { await receipts.settle(settled); } finally { await receipts.dispose(); recorded.resolve(); }
    };
    try {
      const invocation = originalCommandArguments(command, workspace.root, receipts.requestFile);
      if (invocation.args.some(value => value.includes(String.fromCharCode(0)))) {
        commandError("The command input exceeds its allowed format or size.", "vivary_original_input", 400);
      }
      const release = await acquireProject(projectId, policy.access, dependencies.parallelism, context?.signal);
      let current: LocalProjectWorkspace;
      let result: Awaited<ReturnType<typeof runOriginalProcess>>;
      let started: number | undefined;
      let ended: number | undefined;
      let durationMs = 0;
      try {
        current = await dependencies.resolveWorkspace(context, projectId);
        if (!current || !sameOriginalWorkspace(current, workspace)) {
          commandError("The selected project changed before the command could start. Try again.", "vivary_original_project_changed");
        }
        await validateGovernedRequest(command, current);
        // Shutdown or a cancel may arrive while an admitted command re-checks its project.
        if (commandHost.closing) throw closingError();
        context?.signal?.throwIfAborted();
        // From here shutdown waits for this command, so its request file is gone before shutdown resolves.
        (commandHost.recording ??= new Set()).add(recorded.promise);
        void recorded.promise.then(() => commandHost.recording?.delete(recorded.promise));
        try {
          await receipts.stageRequest();
          if (commandHost.closing) throw closingError();
          context?.signal?.throwIfAborted();
          const startedAt = performance.now();
          // The executor throws here, before any child exists, when it refuses to start one. Such a run records nothing.
          const running = dependencies.execute(runtime.executable, ["-I", "-X", "utf8", "-B", "-m", "vivary_cli", ...invocation.args], invocation.stdin, dataDir,
            originalChildEnvironment(environment, receipts.childLog, current.root), context?.signal);
          started = startedAt;
          try { result = await running; } finally { ended = performance.now(); }
          durationMs = Math.round(ended - started);
        } finally { await receipts.dropRequest(); }
      } catch (error) {
        // A command whose child started is recorded when it fails or is stopped.
        if (started !== undefined) {
          await record({ failure: isActionContractError(error) ? error.errorCode : "stopped",
            durationMs: Math.round((ended ?? performance.now()) - started) }).catch(() => undefined);
        }
        throw error;
      } finally { release(); }
      await record({ exitCode: result.exitCode, durationMs });
      const after = await dependencies.resolveWorkspace(context, projectId);
      if (!sameOriginalWorkspace(after, current)) {
        commandError("The project changed while the command ran. Refresh the project before continuing.", "vivary_original_project_changed");
      }
      return { workspace: after, dataDir, output: { verb: command.verb, projectId, pythonVersion: runtime.version,
        ...(command.verb === "decide" || command.verb === "control" ? { evaluationKind: "caller-provided-evidence" as const } : {}), ...result } };
    } finally {
      await receipts.dispose();
      recorded.resolve();
    }
  };
  return { resolve, execute };
}

export function createOriginalCommandRunner(dependencies: Dependencies = runtimeDependencies) {
  const runner = createRuntimeCommandRunner(dependencies);
  return async (input: z.input<typeof originalCommandSchema>, context?: ActionRunContext) => {
    const { projectId, command } = originalCommandSchema.parse(input);
    return (await runner.execute(await runner.resolve(context, projectId), command, context)).output;
  };
}

/** Internal owner-approved operation. The public original-command schema remains read-only for adoption. */
export function createAdoptionCommandRunner(dependencies: Dependencies = runtimeDependencies) {
  const runner = createRuntimeCommandRunner(dependencies);
  return async (command: AdoptionExecution, workspace: LocalProjectWorkspace, context?: ActionRunContext) => {
    const parsed = adoptionExecutionSchema.parse(command);
    return (await runner.execute(await runner.resolve(context, workspace.projectId, workspace), parsed, context)).output;
  };
}

export type ProjectReadRun = { project: ProjectRef } & (
  | { failure: OriginalRunFailure }
  | { exitCode: number | null; stdout: string; stderr: string;
      /** Server-only: used to redact output, never serialized. */
      hostPaths: { root: string; dataDir: string } });

/** Run one project read. Access refusals throw, and a run failure is a value. */
export function createProjectReadRunner(dependencies: Dependencies = runtimeDependencies) {
  const runner = createRuntimeCommandRunner(dependencies);
  return async (projectId: string, command: ProjectReadCommand, context?: ActionRunContext): Promise<ProjectReadRun> => {
    const parsed = projectReadCommandSchema.parse(command);
    const workspace = await runner.resolve(context, projectId);
    const project = { id: workspace.projectId, label: workspace.label };
    try {
      const { workspace: after, dataDir, output } = await runner.execute(workspace, parsed, context);
      return { project, exitCode: output.exitCode, stdout: output.stdout, stderr: output.stderr,
        hostPaths: { root: after.root, dataDir } };
    } catch (error) {
      if (!isOriginalRunFailure(error)) throw error;
      return { project, failure: error.errorCode };
    }
  };
}

export const runOriginalCommand = createOriginalCommandRunner();
export const runAdoptionCommand = createAdoptionCommandRunner();
export const runProjectRead = createProjectReadRunner();
