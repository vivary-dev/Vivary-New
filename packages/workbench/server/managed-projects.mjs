import { spawn } from "node:child_process";
import { access, lstat, mkdir, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { connectLocalProjectFolder, getLocalProjectAccess } from "./project-services.mjs";
import { resolveOriginalRuntime } from "./original-runtime-location.mjs";

const projectName = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
  .refine(value => !value.endsWith("."));
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const BRIDGE_FILE = "managed_project_workspace.py";
const MAX_OUTPUT_BYTES = 512 * 1024;
const CREATOR_TIMEOUT_MS = 30_000;
const activeTargets = new Set();
const WINDOWS_RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

/** True for a file or folder name Windows reserves for a device, with or without an extension. */
export function isWindowsReservedName(name) {
  return WINDOWS_RESERVED_NAME.test(name);
}

async function runCreator(request, dependencies = {}) {
  const start = dependencies.spawn ?? spawn;
  // guard:allow-env-credential - Launcher-selected runtime directory, not a credential.
  const runtimeDirectory = dependencies.runtimeDirectory ?? process.env.VIVARY_ORIGINAL_RUNTIME;
  const bundled = runtimeDirectory ? await resolveOriginalRuntime(runtimeDirectory) : null;
  // guard:allow-env-credential - Development-selected Python executable, not a credential.
  const executable = bundled?.executable ?? dependencies.python ?? process.env.VIVARY_PYTHON ?? "python3";
  const bridge = bundled ? path.join(bundled.root, "bridge", BRIDGE_FILE)
    : dependencies.bridge ?? path.join(process.cwd(), "server", BRIDGE_FILE);
  if (!path.isAbsolute(bridge) || path.basename(bridge) !== BRIDGE_FILE) {
    throw new Error("The workspace creator bridge path is invalid.");
  }
  try {
    await (dependencies.access ?? access)(bridge);
  } catch {
    console.error(`[vivary-managed-projects] bridge-unavailable executable=${path.basename(executable)} bridge=${bridge}`);
    throw new Error("The original workspace creator is unavailable in this Vivary runtime.");
  }
  return new Promise((resolve, reject) => {
    const child = start(executable, ["-I", "-X", "utf8", "-B", bridge], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    const output = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(reject, new Error("The workspace creator timed out."));
    }, dependencies.timeoutMs ?? CREATOR_TIMEOUT_MS);
    child.stdout.on("data", chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(reject, new Error("The workspace preview is too large."));
      } else {
        output.push(chunk);
      }
    });
    child.on("error", error => finish(reject, error));
    child.on("close", code => {
      if (settled) return;
      try {
        const value = JSON.parse(Buffer.concat(output).toString("utf8"));
        if (code === 0) finish(resolve, value);
        else finish(reject, new Error(value?.message ?? "The workspace creator refused this project."));
      } catch {
        console.error(`[vivary-managed-projects] unreadable-result executable=${path.basename(executable)} bridge=${bridge} exit=${code ?? "unknown"}`);
        finish(reject, new Error("The workspace creator is unavailable (unreadable-result)."));
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

export function managedProjectDataDirectory(dependencies = {}) {
  // guard:allow-env-credential - Private application data directory from the trusted launcher, not a user credential.
  return dependencies.dataDir ?? process.env.VIVARY_DATA_DIR;
}

async function managedTarget(context, name, createParent, dependencies = {}) {
  const childName = projectName.parse(name);
  if (isWindowsReservedName(childName)) {
    throw new Error("Choose a project name that is valid on Windows.");
  }
  const getAccess = dependencies.getAccess ?? getLocalProjectAccess;
  if ((await getAccess(context)).code !== "catalog") {
    throw Object.assign(new Error("Project access is unavailable."), { statusCode: 403 });
  }
  const dataDir = managedProjectDataDirectory(dependencies);
  if (!dataDir || !path.isAbsolute(dataDir)) {
    throw new Error("The managed project directory is not configured.");
  }
  const canonicalDataDir = await (dependencies.realpath ?? realpath)(dataDir);
  const parent = path.join(canonicalDataDir, "projects");
  if (createParent) {
    try {
      await (dependencies.mkdir ?? mkdir)(parent, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  if (createParent) {
    const info = await (dependencies.lstat ?? lstat)(parent);
    if (!info.isDirectory() || info.isSymbolicLink()
      || await (dependencies.realpath ?? realpath)(parent) !== parent) {
      throw new Error("The managed Projects directory is unavailable.");
    }
  }
  let entries = [];
  try {
    entries = await (dependencies.readdir ?? readdir)(parent);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (entries.some(entry => entry.toLocaleLowerCase("en-US") === childName.toLocaleLowerCase("en-US")
    && entry !== childName)) {
    throw new Error("A project with this name already exists with different capitalization.");
  }
  const target = path.join(parent, childName);
  if (path.dirname(target) !== parent) throw new Error("Choose a simple project name.");
  return { childName, parent, target };
}

export async function installedPatternCatalog(context, dependencies = {}) {
  const getAccess = dependencies.getAccess ?? getLocalProjectAccess;
  if ((await getAccess(context)).code !== "catalog") {
    throw Object.assign(new Error("Project access is unavailable."), { statusCode: 403 });
  }
  return runCreator({ operation: "catalog" }, dependencies);
}

const workspaceRelativePath = z.string().min(1).max(512).refine(value =>
  !value.startsWith("/") && !value.includes("\\") && !/^[A-Za-z]:/.test(value)
  && value.split("/").every(part => part && part !== "." && part !== ".."));
const rolePaths = z.array(workspaceRelativePath).max(64);
const memoryPrivacy = {
  protected: rolePaths,
  privacy_policy: z.enum(["gitignore", "none"]),
  private: rolePaths,
  private_files: z.array(workspaceRelativePath).max(4_000),
  ignore_files: z.array(workspaceRelativePath).max(4_000),
  private_candidates: z.array(workspaceRelativePath).max(16),
  // At most 200 checked files for each of at most 64 memory folders.
  checked_files: z.array(workspaceRelativePath).max(12_800),
};
// The creator's answer is parsed here, so project memory can trust its shape.
const workspaceContextAnswer = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("thin"),
    roles: z.strictObject({ law: rolePaths, map: rolePaths, record: rolePaths, memory: rolePaths, boundary: rolePaths }),
    state: workspaceRelativePath,
    memory: rolePaths.min(1),
    memory_assigned: z.boolean(),
    ...memoryPrivacy,
  }),
  z.strictObject({
    status: z.literal("plain"), roles: z.null(), state: z.null(),
    memory: rolePaths.min(1), memory_assigned: z.literal(false), ...memoryPrivacy,
  }),
  z.strictObject({ status: z.literal("invalid"), message: z.string().max(2_000) }),
]);

/**
 * The engine's context paths for one project root that project services
 * already admitted. This function does not authorize. `candidates` are
 * workspace-relative files about to be created, checked against the ignore
 * rules. It throws when the bridge is unavailable or its answer does not
 * parse, and the caller reports that as unavailable settings.
 */
export async function readWorkspaceContext(root, candidates = [], dependencies = {}) {
  const request = { operation: "context", target: root, ...(candidates.length > 0 ? { candidates } : {}) };
  const result = await (dependencies.runCreator ?? runCreator)(request, dependencies);
  if (result?.code !== "context") throw new Error("The workspace settings reader is unavailable.");
  const answer = workspaceContextAnswer.parse(result.context);
  if (answer.status === "invalid") return answer;
  const privacy = { policy: answer.privacy_policy, private: answer.private,
    privateFiles: answer.private_files, ignoreFiles: answer.ignore_files,
    privateCandidates: answer.private_candidates, checkedFiles: answer.checked_files };
  return answer.status === "thin"
    ? { status: "thin", roles: answer.roles, state: answer.state, memory: answer.memory,
      memoryAssigned: answer.memory_assigned, protected: answer.protected, privacy }
    : { status: "plain", memory: answer.memory, protected: answer.protected, privacy };
}

export async function previewManagedProject(context, input, dependencies = {}) {
  const { target } = await managedTarget(context, input.name, false, dependencies);
  return runCreator({ operation: "plan", target,
    patternChoices: input.patternChoices ?? [],
    preset: input.preset ?? "coding" }, dependencies);
}

export async function createManagedProject(context, input, dependencies = {}) {
  const acceptedPlanSha256 = digest.parse(input.acceptedPlanSha256);
  const { childName, parent, target } = await managedTarget(context, input.name, true, dependencies);
  const targetKey = target.toLocaleLowerCase("en-US");
  if (activeTargets.has(targetKey)) {
    throw Object.assign(new Error("This project is already being created. Retry when it finishes."), {
      statusCode: 409,
    });
  }
  activeTargets.add(targetKey);
  try {
    const execute = dependencies.runCreator ?? runCreator;
    const result = await execute({
      operation: "apply",
      target,
      acceptedPlanSha256,
      patternChoices: input.patternChoices ?? [],
      preset: input.preset ?? "coding",
    }, dependencies);
    if (!["created", "already-created"].includes(result.code)) return result;
    const canonicalTarget = await (dependencies.realpath ?? realpath)(target);
    const info = await (dependencies.lstat ?? lstat)(target);
    if (!info.isDirectory() || info.isSymbolicLink() || canonicalTarget !== target
      || path.dirname(canonicalTarget) !== parent) {
      throw new Error("The created project left the managed Projects directory.");
    }
    const connectFolder = dependencies.connectFolder ?? connectLocalProjectFolder;
    const registration = await connectFolder(
      context,
      target,
      input.displayName ?? childName,
    );
    return { ...result, registration };
  } finally {
    activeTargets.delete(targetKey);
  }
}
