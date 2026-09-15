import { execFile, spawn } from "node:child_process";
import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fail, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { requireVivaryCodeUser } from "./local-code-agent";
import { resolveLocalProjectWorkspace, type LocalProjectWorkspace } from "./project-services.mjs";
import { resolveOriginalRuntime } from "./original-runtime-location.mjs";

const preset = z.enum(["coding", "second-brain", "knowledge-work", "writing"]);
const requestDocument = z.string().min(1).max(65_536);
const commandSchema = z.discriminatedUnion("verb", [
  z.object({ verb: z.literal("create"), preset: preset.default("coding"), apply: z.boolean().default(false) }).strict(),
  z.object({ verb: z.literal("adopt"), preset: preset.optional(), approvedPlanHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict(),
  z.object({ verb: z.literal("doctor") }).strict(),
  z.object({ verb: z.literal("capabilities"), preset: preset.default("coding") }).strict(),
  z.object({ verb: z.literal("check") }).strict(),
  z.object({ verb: z.literal("find"), query: z.string().trim().min(1).max(4_000), budget: z.number().int().min(1).max(16_000).default(2_000) }).strict(),
  z.object({ verb: z.literal("decide"), request: requestDocument }).strict(),
  z.object({ verb: z.literal("review") }).strict(),
  z.object({ verb: z.literal("impact"), nodeId: z.string().trim().min(1).max(256) }).strict(),
  z.object({ verb: z.literal("control"), request: requestDocument }).strict(),
]);

export const originalCommandSchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  command: commandSchema,
}).strict();
export type OriginalCommand = z.infer<typeof commandSchema>;

const TIMEOUT_MS = 30_000;
const OUTPUT_BYTES = 256 * 1024;

export function originalCommandArguments(command: OriginalCommand, root: string) {
  switch (command.verb) {
    case "create": return { args: ["create", root, "--preset", command.preset, "--json", "--no-wizard", ...(command.apply ? [] : ["--dry-run"])], stdin: "" };
    case "adopt": return { args: ["adopt", root, "--json", ...(command.preset ? ["--preset", command.preset] : []), ...(command.approvedPlanHash ? ["--yes", "--plan", command.approvedPlanHash] : [])], stdin: "" };
    case "doctor": return { args: ["doctor", root, "--json"], stdin: "" };
    case "capabilities": return { args: ["capabilities", "--preset", command.preset, "--json"], stdin: "" };
    case "check": return { args: ["check", "--root", root, "--json"], stdin: "" };
    case "find": return { args: ["find", "--root", root, "--json", "--mode", "text", "--budget", String(command.budget), "--", command.query], stdin: "" };
    case "decide": return { args: ["decide", "--governed", "--json", "--strict", "-"], stdin: command.request };
    case "review": return { args: ["review", "--root", root, "--json", "--pack", "structure"], stdin: "" };
    case "impact": return { args: ["impact", "--root", root, "--json", "--", command.nodeId], stdin: "" };
    case "control": return { args: ["control", "--governed", "--json", "--strict", "-"], stdin: command.request };
  }
}

export function originalChildEnvironment(environment: NodeJS.ProcessEnv, receiptLog: string, projectRoot?: string): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const name of ["PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "HOME", "USERPROFILE", "TEMP", "TMP", "LANG", "LC_ALL", "TZ"]) {
    if (environment[name]) child[name] = environment[name];
  }
  child.PATH = (environment.PATH ?? "").split(path.delimiter)
    .filter(directory => path.isAbsolute(directory) && (!projectRoot || !containsPath(projectRoot, directory)))
    .join(path.delimiter);
  child.PYTHONNOUSERSITE = "1";
  child.VIVARY_RECEIPT_LOG = receiptLog;
  return child;
}

function containsPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function commandError(message: string, errorCode: string, statusCode = 409): never {
  return fail(message, { errorCode, statusCode });
}


type ActiveCommand = { stop: (error: Error) => void; settled: Promise<void> };
type CommandHost = { closing: boolean; active: Set<ActiveCommand>; shutdown: Promise<void> | null };
// Action source and Nitro's bundled lifecycle plugin share the same process owner.
const commandHostKey = Symbol.for("vivary.workbench.original-commands");
const commandProcess = globalThis as typeof globalThis & { [commandHostKey]?: CommandHost };
const commandHost = commandProcess[commandHostKey] ??= { closing: false, active: new Set<ActiveCommand>(), shutdown: null };

export function shutdownOriginalCommands(): Promise<void> {
  commandHost.closing = true;
  if (!commandHost.shutdown) {
    const active = [...commandHost.active];
    for (const command of active) command.stop(new Error("Vivary is closing. The original command was stopped."));
    commandHost.shutdown = Promise.all(active.map(command => command.settled)).then(() => undefined);
  }
  return commandHost.shutdown;
}

export function runOriginalProcess(executable: string, args: string[], stdin: string, cwd: string, environment: NodeJS.ProcessEnv, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (commandHost.closing) throw new Error("Vivary is closing. New original commands cannot start.");
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
    const timer = setTimeout(() => stop(new Error("The original Vivary command exceeded its 30-second limit.")), TIMEOUT_MS);
    const abort = () => stop(new Error("The original Vivary command was cancelled."));
    signal?.addEventListener("abort", abort, { once: true });
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > OUTPUT_BYTES) stop(new Error("The original Vivary command exceeded its output limit."));
      else target.push(chunk);
    };
    child.stdout.on("data", collect(output));
    child.stderr.on("data", collect(errors));
    child.on("error", error => { failure ??= error; });
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
};

export function createOriginalCommandRunner(dependencies: Dependencies = {
  resolveWorkspace: resolveLocalProjectWorkspace, environment: () => process.env, execute: runOriginalProcess,
}) {
  return async (input: z.input<typeof originalCommandSchema>, context?: ActionRunContext) => {
    requireVivaryCodeUser(context);
    const { projectId, command } = originalCommandSchema.parse(input);
    const workspace = await dependencies.resolveWorkspace(context, projectId);
    const environment = dependencies.environment();
    const runtime = await resolveOriginalRuntime(environment.VIVARY_ORIGINAL_RUNTIME);
    if (!environment.VIVARY_DATA_DIR || !path.isAbsolute(environment.VIVARY_DATA_DIR)) {
      commandError("Vivary application data is not configured.", "vivary_original_data_unavailable");
    }
    const dataDir = await realpath(environment.VIVARY_DATA_DIR);
    if (containsPath(workspace.root, dataDir)) {
      commandError("Choose a project that does not contain Vivary's private application data.", "vivary_original_data_in_project");
    }
    const receiptDir = path.join(dataDir, "original-runtime");
    await mkdir(receiptDir, { recursive: true, mode: 0o700 });
    if (await realpath(receiptDir) !== receiptDir) {
      commandError("Vivary's command receipt directory must stay in application data.", "vivary_original_receipt_path");
    }
    const receiptLog = path.join(receiptDir, "receipts.jsonl");
    try {
      const receipt = await lstat(receiptLog);
      if (!receipt.isFile() || receipt.nlink !== 1) {
        commandError("Vivary's command receipt must be a private application file.", "vivary_original_receipt_path");
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
    const invocation = originalCommandArguments(command, workspace.root);
    if (invocation.args.some(value => value.includes(String.fromCharCode(0))) || Buffer.byteLength(invocation.stdin, "utf8") > 65_536) {
      commandError("The command input exceeds its allowed format or size.", "vivary_original_input", 400);
    }
    const current = await dependencies.resolveWorkspace(context, projectId);
    const fields = ["root", "projectId", "bindingId", "rootId", "bindingRevision", "policyRevision"] as const;
    if (!current || fields.some(field => current[field] !== workspace[field])) {
      commandError("The selected project changed before the command could start. Try again.", "vivary_original_project_changed");
    }
    const result = await dependencies.execute(runtime.executable, ["-I", "-B", "-m", "vivary_cli", ...invocation.args], invocation.stdin, dataDir,
      originalChildEnvironment(environment, receiptLog, current.root), context?.signal);
    const after = await dependencies.resolveWorkspace(context, projectId);
    if (fields.some(field => after[field] !== current[field])) {
      commandError("The project changed while the command ran. Refresh the project before continuing.", "vivary_original_project_changed");
    }
    return { verb: command.verb, projectId, pythonVersion: runtime.version, ...result };
  };
}

export const runOriginalCommand = createOriginalCommandRunner();
