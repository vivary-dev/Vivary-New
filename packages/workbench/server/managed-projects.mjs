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
    const child = start(executable, ["-I", "-B", bridge], {
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

async function managedTarget(context, name, createParent, dependencies = {}) {
  const childName = projectName.parse(name);
  if (WINDOWS_RESERVED_NAME.test(childName)) {
    throw new Error("Choose a project name that is valid on Windows.");
  }
  const getAccess = dependencies.getAccess ?? getLocalProjectAccess;
  if ((await getAccess(context)).code !== "catalog") {
    throw Object.assign(new Error("Project access is unavailable."), { statusCode: 403 });
  }
  // guard:allow-env-credential - Private application data directory from the launcher.
  const dataDir = dependencies.dataDir ?? process.env.VIVARY_DATA_DIR;
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

export async function previewManagedProject(context, input, dependencies = {}) {
  const { target } = await managedTarget(context, input.name, false, dependencies);
  return runCreator({ operation: "plan", target }, dependencies);
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
