import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { createConnection } from "node:net";
import { hostname } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fail, type ActionRunContext } from "@agent-native/core/action";
import { projectPreviewInput, projectPreviewResult, type ProjectPreviewInput,
  type ProjectPreviewResult, type ProjectPreviewScript } from "../shared/project-preview";
import { hardStopWorkerTree } from "./code-execution-host";
import { sameOriginalWorkspace } from "./original-runtime";
import { resolveLocalProjectWorkspace, type LocalProjectWorkspace } from "./project-services.mjs";

type Identity = { ownerEmail: string; orgId: string };
type Launcher = { manager: "npm" | "pnpm" | "bun"; executable: string; prefix: string[] };
type Review = Extract<ProjectPreviewResult, { code: "review" }>;
type Prepared = { review: Review; launcher: Launcher };
type LaunchResult = Extract<ProjectPreviewResult, { code: "starting" | "ready" | "unavailable" | "stopped" }>;
type Entry = {
  identity: Identity;
  workspace: LocalProjectWorkspace;
  review: Review;
  requestId: string;
  launchId: string;
  pid: number | null;
  child: ChildProcess | null;
  state: "starting" | "ready" | "unavailable" | "stopped";
  checkedAt?: string;
  embedding: "blocked" | "unknown";
  reason?: string;
  logTail: string;
  stopPromise?: Promise<void>;
  exitCleanup?: Promise<boolean>;
};
type HostState = {
  current: Map<string, Entry>;
  byRequest: Map<string, Entry>;
  pending: Map<string, { requestId: string; script: ProjectPreviewScript; url: string;
    digest: string; promise: Promise<ProjectPreviewResult> }>;
  closing: boolean;
  shutdown: Promise<void> | null;
};
function newHostState(): HostState {
  return { current: new Map(), byRequest: new Map(), pending: new Map(),
    closing: false, shutdown: null };
}
const hostKey = Symbol.for("vivary.workbench.project-preview-host");
const globals = globalThis as typeof globalThis & { [hostKey]?: HostState };
const productionState = globals[hostKey] ??= newHostState();

const PACKAGE_MAX_BYTES = 65_536;
const SCRIPT_MAX_LENGTH = 4096;
const LOG_TAIL_BYTES = 4096;
const READY_DEADLINE_MS = 8_000;
const PROBE_TIMEOUT_MS = 900;
const SCRIPTS = ["dev", "start", "preview"] as const;

function refuse(message: string, statusCode = 409): never {
  return fail(message, { statusCode, errorCode: "vivary_project_preview_refused" });
}
function identity(context: ActionRunContext | undefined, mode: string | undefined): Identity {
  const ownerEmail = context?.userEmail?.trim().toLowerCase();
  if (!ownerEmail || !context?.orgId || !["http", "frontend"].includes(context.caller)
    || (mode !== "local" && mode !== "private-proxy")) {
    return fail("Only the authenticated local workspace owner can control previews.",
      { statusCode: 403, errorCode: "vivary_project_preview_access" });
  }
  return { ownerEmail, orgId: context.orgId };
}
function keyFor(owner: Identity, projectId: string): string {
  return JSON.stringify([owner.ownerEmail, owner.orgId, projectId]);
}
function requestKey(key: string, requestId: string): string {
  return key + ":" + requestId;
}
function sha256(value: string | Uint8Array): string {
  return "sha256:" + createHash("sha256").update(value).digest("hex");
}
function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep)
    && !path.isAbsolute(relative));
}
function checkedUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { return refuse("Use a host-local HTTP preview address.", 400); }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1"
    || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535
    || url.username || url.password || url.search || url.hash
    || url.pathname.startsWith("/_agent-native")) {
    return refuse("Use a numeric host-local HTTP preview address with an explicit port.", 400);
  }
  // guard:allow-env-credential - APP_URL identifies Vivary's own local origin, not a credential.
  const appUrl = process.env.APP_URL;
  let appOrigin: string | null = null;
  if (appUrl) {
    try { appOrigin = new URL(appUrl).origin; }
    catch { /* An invalid app URL is handled by startup configuration. */ }
  }
  if (appOrigin === url.origin
    || (process.env.HOST === "127.0.0.1" && process.env.PORT === url.port)) {
    refuse("Choose a preview port separate from Vivary.", 400);
  }
  return url;
}
async function readPackage(root: string): Promise<{ bytes: Uint8Array; scripts: Partial<Record<ProjectPreviewScript, string>>;
  manager: Launcher["manager"] } | null> {
  const file = path.join(root, "package.json");
  let info;
  try { info = await lstat(file); } catch { return null; }
  if (!info.isFile() || info.isSymbolicLink() || info.size > PACKAGE_MAX_BYTES) return null;
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  let bytes: Buffer;
  try {
    const held = await handle.stat();
    if (!held.isFile() || held.size > PACKAGE_MAX_BYTES) return null;
    const buffer = Buffer.alloc(PACKAGE_MAX_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > PACKAGE_MAX_BYTES) return null;
    bytes = buffer.subarray(0, bytesRead);
  } finally { await handle.close(); }
  let document: unknown;
  try { document = JSON.parse(bytes.toString("utf8")); } catch { return null; }
  if (!document || typeof document !== "object" || Array.isArray(document)) return null;
  const value = document as Record<string, unknown>;
  const rawScripts = value.scripts;
  if (!rawScripts || typeof rawScripts !== "object" || Array.isArray(rawScripts)) return null;
  const scripts: Partial<Record<ProjectPreviewScript, string>> = {};
  for (const name of SCRIPTS) {
    const entries = rawScripts as Record<string, unknown>;
    const text = entries[name];
    // Package-manager pre/post hooks would execute additional unreviewed commands.
    if (entries["pre" + name] !== undefined || entries["post" + name] !== undefined) continue;
    if (typeof text === "string" && text.trim() && text.length <= SCRIPT_MAX_LENGTH
      && !text.includes("\0")) scripts[name] = text;
  }
  const declared = value.packageManager;
  let manager: Launcher["manager"] = "npm";
  if (typeof declared === "string") {
    const name = declared.split("@", 1)[0];
    if (name !== "npm" && name !== "pnpm" && name !== "bun") return null;
    manager = name;
  } else {
    try { await lstat(path.join(root, "pnpm-lock.yaml")); manager = "pnpm"; } catch {
      try { await lstat(path.join(root, "bun.lock")); manager = "bun"; } catch { /* npm fallback */ }
    }
  }
  return { bytes, scripts, manager };
}
async function isFile(candidate: string): Promise<boolean> {
  try { return (await stat(candidate)).isFile(); } catch { return false; }
}
async function resolveLauncher(manager: Launcher["manager"], root: string): Promise<Launcher | null> {
  // guard:allow-env-credential - PATH locates existing package managers; project-owned entries are excluded.
  const rawPath = process.env.PATH ?? process.env.Path ?? "";
  const dirs = [...new Set([path.dirname(process.execPath), ...rawPath.split(path.delimiter)]
    .filter(dir => path.isAbsolute(dir) && !inside(root, dir)))];
  for (const dir of dirs) {
    const candidates = process.platform === "win32"
      ? [path.join(dir, manager + ".exe"),
          path.join(dir, manager + ".cjs"),
          path.join(dir, "node_modules", manager, "bin", manager === "npm" ? "npm-cli.js" : "pnpm.cjs"),
          path.join(dir, "node_modules", manager, "dist", "pnpm.cjs"),
          path.join(dir, "node_modules", "corepack", "dist", "pnpm.js")]
      : [path.join(dir, manager)];
    for (const candidate of candidates) {
      let resolved: string;
      try { resolved = await realpath(candidate); } catch { continue; }
      if (inside(root, resolved) || !await isFile(resolved)) continue;
      const normalized = resolved.replaceAll("\\", "/").toLowerCase();
      const knownJs = manager === "npm"
        ? normalized.endsWith("/npm/bin/npm-cli.js")
        : manager === "pnpm" && (normalized.endsWith("/pnpm/bin/pnpm.cjs")
          || normalized.endsWith("/pnpm/dist/pnpm.cjs")
          || normalized.endsWith("/corepack/dist/pnpm.js"));
      if (knownJs) return { manager, executable: process.execPath, prefix: [resolved] };
      if (manager === "bun" && process.platform === "win32"
        && normalized.endsWith("/bun.exe")) {
        return { manager, executable: resolved, prefix: [] };
      }
      if (manager === "bun" && process.platform !== "win32") {
        let handle;
        try { handle = await open(resolved, "r"); } catch { continue; }
        const first = Buffer.alloc(4);
        try { await handle.read(first, 0, 4, 0); } finally { await handle.close(); }
        if ((first[0] === 0x7f && first.toString("ascii", 1) === "ELF")
          || [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(first.readUInt32BE(0))) {
          return { manager, executable: resolved, prefix: [] };
        }
      }
    }
  }
  return null;
}

function childEnvironment(url: URL, launcher: Launcher, root: string): NodeJS.ProcessEnv {
  const source = process.env;
  const env: NodeJS.ProcessEnv = {};
  for (const name of ["SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC",
    "PATHEXT", "HOME", "USERPROFILE", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (source[name]) env[name] = source[name];
  }
  // guard:allow-env-credential - Only executable search paths pass to the project process.
  env.PATH = [...new Set([path.dirname(process.execPath),
    ...(source.PATH ?? source.Path ?? "").split(path.delimiter)]
    .filter(dir => path.isAbsolute(dir) && !inside(root, dir)))].join(path.delimiter);
  env.HOST = "127.0.0.1";
  env.PORT = url.port;
  env.COREPACK_ENABLE_NETWORK = "0";
  env.COREPACK_ENABLE_AUTO_PIN = "0";
  env.COREPACK_ENABLE_DOWNLOAD_PROMPT = "0";
  env.npm_config_manage_package_manager_versions = "false";
  if (launcher.executable === process.execPath) env.ELECTRON_RUN_AS_NODE = "1";
  return env;
}
function commandText(launcher: Launcher, script: ProjectPreviewScript): string {
  return launcher.manager + " run " + script;
}
async function reviewFor(workspace: LocalProjectWorkspace, script: ProjectPreviewScript,
  rawUrl: string, resolver: typeof resolveLauncher, host: string): Promise<Prepared> {
  const url = checkedUrl(rawUrl);
  const project = await readPackage(workspace.root);
  if (!project || !project.scripts[script]) {
    return refuse("This project has no supported package script for that preview.");
  }
  const launcher = await resolver(project.manager, workspace.root);
  if (!launcher) return refuse("The project's package manager is not installed as a safe executable.");
  const scriptText = project.scripts[script];
  const command = commandText(launcher, script);
  const manifestDigest = sha256(JSON.stringify({
    schema: "vivary.project-preview-manifest.v1",
    workspace: {
      root: workspace.root, actorId: workspace.actorId, projectId: workspace.projectId,
      bindingId: workspace.bindingId, bindingRevision: workspace.bindingRevision,
      policyRevision: workspace.policyRevision, rootId: workspace.rootId,
      locationRef: workspace.locationRef, verificationKind: workspace.verificationKind,
    },
    packageHash: sha256(project.bytes),
    manager: project.manager, executable: launcher.executable, prefix: launcher.prefix,
    script, scriptText, url: url.href, envPolicy: "preview-scrubbed-v1",
  }));
  return { review: { code: "review", projectId: workspace.projectId, host, folder: workspace.root,
    script, scriptText, command,
    launcher: [launcher.executable, ...launcher.prefix].join(" "),
    url: url.href, manifestDigest }, launcher };
}
function appendLog(entry: Entry, chunk: Buffer): void {
  const next = entry.logTail + chunk.toString("utf8");
  entry.logTail = next.slice(-LOG_TAIL_BYTES);
}
function snapshot(entry: Entry, staleBinding: boolean): LaunchResult {
  const common = {
    projectId: entry.workspace.projectId, host: entry.review.host, folder: entry.workspace.root,
    script: entry.review.script, scriptText: entry.review.scriptText,
    command: entry.review.command, launcher: entry.review.launcher,
    url: entry.review.url, manifestDigest: entry.review.manifestDigest,
    requestId: entry.requestId, launchId: entry.launchId, pid: entry.pid, staleBinding,
  };
  switch (entry.state) {
    case "starting": return { code: "starting", ...common };
    case "ready": return { code: "ready", ...common,
      checkedAt: entry.checkedAt ?? new Date().toISOString(), embedding: entry.embedding };
    case "unavailable": return { code: "unavailable", ...common,
      reason: entry.reason ?? "The preview process is unavailable.",
      ...(entry.logTail ? { logTail: entry.logTail } : {}) };
    case "stopped": return { code: "stopped", ...common };
  }
}
type Probe = { reachable: boolean; embedding: "blocked" | "unknown"; reason?: string };
async function probeUrl(url: URL): Promise<Probe> {
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "manual",
      credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (response.status === 405) {
      await response.body?.cancel();
      response = await fetch(url, { method: "GET", redirect: "manual",
        credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    }
    const status = response.status;
    const frame = response.headers.get("x-frame-options")?.trim().toLowerCase() ?? "";
    const csp = response.headers.get("content-security-policy")?.toLowerCase() ?? "";
    const blocked = frame === "deny" || frame === "sameorigin"
      || /(?:^|;)\s*frame-ancestors\s+(?:'none'|'self')(?:\s*;|\s*$)/.test(csp);
    await response.body?.cancel();
    if (status >= 300 && status < 400) return { reachable: false, embedding: "unknown",
      reason: "The page redirects, so its preview destination is unverified." };
    if (status >= 400) return { reachable: false, embedding: blocked ? "blocked" : "unknown",
      reason: "The preview page returned HTTP " + status + "." };
    return { reachable: true, embedding: blocked ? "blocked" : "unknown" };
  } catch {
    return { reachable: false, embedding: "unknown",
      reason: "The host-local preview address did not respond." };
  }
}
async function portOccupied(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (occupied: boolean) => { socket.destroy(); resolve(occupied); };
    socket.setTimeout(500, () => done(true));
    socket.once("connect", () => done(true));
    socket.once("error", error => done(!(error && "code" in error && error.code === "ECONNREFUSED")));
  });
}
async function waitReady(entry: Entry, probe: typeof probeUrl): Promise<void> {
  const deadline = Date.now() + READY_DEADLINE_MS;
  const url = new URL(entry.review.url);
  while (entry.state === "starting" && Date.now() < deadline) {
    const result = await probe(url);
    if (entry.state !== "starting") return;
    if (result.reachable) {
      entry.state = "ready";
      entry.checkedAt = new Date().toISOString();
      entry.embedding = result.embedding;
      return;
    }
    await delay(180);
  }
  if (entry.state === "starting") {
    entry.state = "unavailable";
    entry.reason = "The approved command started but the preview URL did not become ready.";
  }
}
async function stopOwned(entry: Entry): Promise<void> {
  entry.stopPromise ??= (async () => {
    const child = entry.child;
    try {
      if (entry.exitCleanup && !await entry.exitCleanup) {
        throw new Error("The exited preview command's process tree could not be verified.");
      }
      if (child?.pid) {
        const workerExited = child.exitCode !== null || child.signalCode !== null;
        const exited = workerExited ? Promise.resolve()
          : new Promise<void>(resolve => child.once("exit", () => resolve()));
        await hardStopWorkerTree(child, workerExited);
        if (child.exitCode === null && child.signalCode === null) {
          await Promise.race([
            exited,
            delay(3_000).then(() => { throw new Error("The owned preview process did not exit."); }),
          ]);
        }
      }
      entry.child = null;
      const port = Number(new URL(entry.review.url).port);
      for (let attempt = 0; attempt < 8 && await portOccupied(port); attempt++) await delay(100);
      if (await portOccupied(port)) throw new Error("The preview port still responds after cleanup.");
      entry.state = "stopped";
    } catch {
      entry.state = "unavailable";
      entry.reason = "The owned preview process could not be stopped completely.";
      throw new Error(entry.reason);
    }
  })();
  return entry.stopPromise;
}

type Dependencies = {
  resolveWorkspace: typeof resolveLocalProjectWorkspace;
  resolveLauncher: typeof resolveLauncher;
  spawn: typeof spawn;
  probe: typeof probeUrl;
  portOccupied: typeof portOccupied;
  mode: () => string | undefined;
  host: () => string;
};
const defaults: Dependencies = {
  resolveWorkspace: resolveLocalProjectWorkspace,
  resolveLauncher,
  spawn,
  probe: probeUrl,
  portOccupied,
  mode: () => process.env.VIVARY_ACCESS_MODE, // guard:allow-env-credential - Deployment access mode, not a user credential.
  host: hostname,
};
export function createProjectPreviewService(
  dependencies: Partial<Dependencies> = {}, state: HostState = newHostState(),
) {
  const deps = { ...defaults, ...dependencies };
  async function bindingStale(entry: Entry, context?: ActionRunContext): Promise<boolean> {
    try {
      const current = await deps.resolveWorkspace(context, entry.workspace.projectId);
      return !sameOriginalWorkspace(current, entry.workspace);
    } catch { return true; }
  }
  async function run(raw: ProjectPreviewInput, context?: ActionRunContext): Promise<ProjectPreviewResult> {
    const input = projectPreviewInput.parse(raw);
    const owner = identity(context, deps.mode());
    const host = deps.host();
    const key = keyFor(owner, input.projectId);
    if (input.operation === "discover") {
      const workspace = await deps.resolveWorkspace(context, input.projectId);
      const pkg = await readPackage(workspace.root);
      if (!pkg) return projectPreviewResult.parse({ code: "unsupported", projectId: input.projectId,
        host, reason: "No supported package.json script was found in this project." });
      const scripts = SCRIPTS.flatMap(script => pkg.scripts[script]
        ? [{ script, scriptText: pkg.scripts[script] }] : []);
      if (scripts.length === 0) return { code: "unsupported", projectId: input.projectId,
        host, reason: "This project has no dev, start, or preview package script." };
      return { code: "discovered", projectId: input.projectId, host,
        folder: workspace.root, scripts };
    }
    if (input.operation === "inspect") {
      await deps.resolveWorkspace(context, input.projectId);
      const url = checkedUrl(input.url);
      const observation = await deps.probe(url);
      return { code: "checked", projectId: input.projectId, host,
        url: url.href, ...observation };
    }
    if (input.operation === "review") {
      const workspace = await deps.resolveWorkspace(context, input.projectId);
      return (await reviewFor(workspace, input.script, input.url, deps.resolveLauncher, host)).review;
    }
    if (input.operation === "status") {
      const entry = state.current.get(key);
      if (!entry) return { code: "idle", projectId: input.projectId, host };
      const staleBinding = await bindingStale(entry, context);
      if ((entry.state === "ready" || entry.state === "unavailable")
        && entry.child?.exitCode === null && entry.child.signalCode === null) {
        const observation = await deps.probe(new URL(entry.review.url));
        if (entry.stopPromise || !entry.child || entry.child.exitCode !== null || entry.child.signalCode !== null) {
          return snapshot(entry, staleBinding);
        }
        if (observation.reachable) {
          entry.state = "ready";
          entry.embedding = observation.embedding;
          entry.checkedAt = new Date().toISOString();
        } else {
          entry.state = "unavailable";
          entry.reason = observation.reason ?? "The preview URL no longer responds.";
        }
      }
      return snapshot(entry, staleBinding);
    }
    if (input.operation === "stop") {
      const entry = [...state.byRequest.values()].find(candidate =>
        candidate.identity.ownerEmail === owner.ownerEmail
        && candidate.identity.orgId === owner.orgId
        && candidate.workspace.projectId === input.projectId
        && candidate.launchId === input.launchId);
      if (!entry) return refuse("That preview launch is not owned by this project.");
      await stopOwned(entry);
      return snapshot(entry, await bindingStale(entry, context));
    }
    if (state.closing) return refuse("The preview host is shutting down.");
    const requestedUrl = checkedUrl(input.url).href;
    const prior = state.byRequest.get(requestKey(key, input.requestId));
    if (prior) {
      if (prior.review.manifestDigest !== input.acceptedManifestDigest
        || prior.review.script !== input.script || prior.review.url !== requestedUrl) {
        return refuse("That request ID belongs to a different reviewed preview.");
      }
      return snapshot(prior, await bindingStale(prior, context));
    }
    const pending = state.pending.get(key);
    if (pending) {
      if (pending.requestId !== input.requestId || pending.script !== input.script
        || pending.url !== requestedUrl || pending.digest !== input.acceptedManifestDigest) {
        return refuse("A different preview request is already starting for this project.");
      }
      return pending.promise;
    }
    const existing = state.current.get(key);
    if (existing && existing.state !== "stopped"
      && (existing.exitCleanup || (existing.child?.exitCode === null && existing.child.signalCode === null))) {
      return refuse("Stop this project's existing owned preview before starting another.");
    }
    const promise = (async (): Promise<ProjectPreviewResult> => {
      const workspace = await deps.resolveWorkspace(context, input.projectId);
      const prepared = await reviewFor(workspace, input.script, requestedUrl, deps.resolveLauncher, host);
      const reviewed = prepared.review;
      if (reviewed.manifestDigest !== input.acceptedManifestDigest) {
        return refuse("The project script, launcher, address, or folder changed. Review it again.");
      }
      const current = await deps.resolveWorkspace(context, input.projectId);
      if (!sameOriginalWorkspace(current, workspace)) {
        return refuse("The reviewed project folder changed. Review it again.");
      }
      const url = new URL(reviewed.url);
      if (await deps.portOccupied(Number(url.port))) {
        return refuse("That host-local preview port is already in use. Choose another address.");
      }
      const final = await reviewFor(current, input.script, requestedUrl, deps.resolveLauncher, host);
      if (final.review.manifestDigest !== reviewed.manifestDigest) {
        return refuse("The reviewed package contents or launcher changed. Review it again.");
      }
      const last = await deps.resolveWorkspace(context, input.projectId);
      if (!sameOriginalWorkspace(last, current)) {
        return refuse("The reviewed project folder changed before launch. Review it again.");
      }
      if (state.closing) return refuse("The preview host is shutting down.");
      const launcher = final.launcher;
      const child = deps.spawn(launcher.executable, [...launcher.prefix, "run", input.script], {
        cwd: last.root, env: childEnvironment(url, launcher, last.root),
        detached: process.platform !== "win32", windowsHide: true, shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const entry: Entry = {
        identity: owner, workspace: last, review: reviewed,
        requestId: input.requestId, launchId: randomUUID(), pid: child.pid ?? null,
        child, state: "starting", embedding: "unknown", logTail: "",
      };
      state.current.set(key, entry);
      state.byRequest.set(requestKey(key, input.requestId), entry);
      for (const stream of [child.stdout, child.stderr]) {
        stream?.on("data", (chunk: Buffer) => appendLog(entry, chunk));
      }
      child.once("error", () => {
        if (entry.state !== "stopped") {
          entry.state = "unavailable";
          entry.reason = "The approved preview command could not start.";
        }
      });
      child.once("exit", () => {
        if (entry.state !== "stopped") {
          entry.state = "unavailable";
          entry.reason = "The preview process exited.";
        }
        // Clean the live owned group at exit. A later Stop must never signal a saved PID.
        if (!entry.stopPromise) {
          entry.exitCleanup = hardStopWorkerTree(child, true).then(() => true, () => {
            entry.reason = "The preview command exited before its process tree could be stopped.";
            return false;
          });
        }
        entry.child = null;
      });
      await waitReady(entry, deps.probe);
      return snapshot(entry, false);
    })();
    state.pending.set(key, { requestId: input.requestId, script: input.script,
      url: requestedUrl, digest: input.acceptedManifestDigest, promise });
    try { return await promise; } finally { state.pending.delete(key); }
  }
  function shutdown(): Promise<void> {
    state.closing = true;
    state.shutdown ??= Promise.allSettled([...state.current.values()].map(stopOwned)).then(results => {
      if (results.some(result => result.status === "rejected")) {
        throw new Error("An owned preview process could not be stopped.");
      }
    });
    return state.shutdown;
  }
  return { run, shutdown };
}
const production = createProjectPreviewService({}, productionState);
export const projectPreviewService = production.run;
export const shutdownProjectPreviews = production.shutdown;
