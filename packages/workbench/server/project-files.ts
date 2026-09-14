import { createHash, randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import {
  link,
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import type { ActionRunContext } from "@agent-native/core/action";

import type {
  ProjectFile,
  ProjectFileBlockedReason,
  ProjectFileIdentity,
  ProjectFileRenameResult,
  ProjectFilesResult,
  ProjectFileSaveResult,
  ProjectFileSummary,
} from "../app/lib/project-file-schema.ts";
import { resolveLocalProjectWorkspace } from "./project-services.mjs";

const MAX_FILE_BYTES = 256 * 1024;
const MAX_LISTED_FILES = 400;
const MAX_SCANNED_ENTRIES = 4_000;
const MAX_SCAN_DEPTH = 8;
const SKIPPED_DIRECTORIES = new Set([
  ".aws", ".azure", ".git", ".gnupg", ".next", ".ssh", ".turbo", ".vercel",
  "build", "coverage", "dist", "node_modules", "out", "vendor",
]);
const SECRET_EXTENSIONS = new Set([".cer", ".crt", ".der", ".key", ".p12", ".pfx", ".pem"]);
const EDITABLE_EXTENSIONS = new Map<string, ProjectFile["kind"]>([
  [".md", "markdown"], [".mdx", "markdown"], [".txt", "text"],
  [".toml", "toml"],
  [".c", "source"], [".cc", "source"], [".cpp", "source"], [".css", "source"],
  [".go", "source"], [".h", "source"], [".html", "source"], [".java", "source"],
  [".js", "source"], [".json", "source"], [".jsonc", "source"], [".jsx", "source"],
  [".kt", "source"], [".mjs", "source"], [".cjs", "source"], [".py", "source"],
  [".rs", "source"], [".scss", "source"], [".sh", "source"], [".ps1", "source"],
  [".ts", "source"], [".tsx", "source"], [".xml", "source"], [".yaml", "source"], [".yml", "source"],
]);

type Workspace = Readonly<{
  root: string;
  label: string;
  projectId?: string;
  bindingId?: string;
  bindingRevision?: number;
  policyRevision?: number;
  rootId?: string;
}>;

type Resolver = (context: ActionRunContext | undefined, projectId: string) => Promise<Workspace | undefined>;

class ProjectFileBoundaryError extends Error {
  constructor(readonly code: "invalid-path" | "blocked-path") {
    super(code === "invalid-path" ? "Choose a file inside the selected project." : "This file is not available in Vivary.");
  }
}

function projectIdentity(workspace: Workspace): ProjectFileIdentity {
  if (!workspace.projectId || !workspace.bindingId || !workspace.rootId
    || !workspace.bindingRevision || !workspace.policyRevision) {
    throw new Error("The selected project binding is incomplete.");
  }
  return {
    projectId: workspace.projectId,
    label: workspace.label,
    rootId: workspace.rootId,
    bindingId: workspace.bindingId,
    bindingRevision: workspace.bindingRevision,
    policyRevision: workspace.policyRevision,
  };
}

function sameProject(left: ProjectFileIdentity, right: ProjectFileIdentity): boolean {
  return left.projectId === right.projectId && left.rootId === right.rootId
    && left.bindingId === right.bindingId && left.bindingRevision === right.bindingRevision
    && left.policyRevision === right.policyRevision;
}

function isSecretName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === ".env" || lower.startsWith(".env.") || lower === ".npmrc"
    || lower === ".netrc" || lower === ".pypirc" || lower === "credentials"
    || lower === "credentials.json" || lower === "id_ed25519" || lower === "id_rsa"
    || lower.includes("credential") || lower.includes("secret")
    || SECRET_EXTENSIONS.has(path.extname(lower));
}

function relativeParts(requestedPath: string): string[] {
  if (!requestedPath || requestedPath.includes("\\") || path.posix.isAbsolute(requestedPath)) {
    throw new ProjectFileBoundaryError("invalid-path");
  }
  const parts = requestedPath.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || isSecretName(part))
    || parts.some(part => SKIPPED_DIRECTORIES.has(part))) {
    throw new ProjectFileBoundaryError("blocked-path");
  }
  return parts;
}

function portablePath(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

function contained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function resolvePathWithoutLinks(root: string, requestedPath: string, allowMissingLeaf = false): Promise<string> {
  const parts = relativeParts(requestedPath);
  let candidate = root;
  for (let index = 0; index < parts.length; index += 1) {
    candidate = path.join(candidate, parts[index]);
    let entry: Stats;
    try {
      entry = await lstat(candidate);
    } catch (error) {
      if (allowMissingLeaf && index === parts.length - 1 && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
    if (entry.isSymbolicLink()) throw new ProjectFileBoundaryError("blocked-path");
    if (index < parts.length - 1 && !entry.isDirectory()) throw new ProjectFileBoundaryError("invalid-path");
  }
  const canonical = await realpath(candidate);
  if (!contained(root, canonical)) throw new ProjectFileBoundaryError("blocked-path");
  return canonical;
}

function kindFor(filePath: string): ProjectFile["kind"] | null {
  return EDITABLE_EXTENSIONS.get(path.extname(filePath).toLowerCase()) ?? null;
}

function versionFor(project: ProjectFileIdentity, filePath: string, info: Stats, bytes: Buffer): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(project)).update("\0").update(filePath).update("\0")
    .update(String(info.dev)).update(":").update(String(info.ino)).update(":")
    .update(String(info.birthtimeMs)).update(":").update(String(info.mtimeMs)).update(":")
    .update(String(info.size)).update("\0").update(bytes).digest("hex");
  return `pf_${digest}`;
}

function decodeText(bytes: Buffer): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function readEditableFile(root: string, requestedPath: string, project: ProjectFileIdentity): Promise<ProjectFile | null> {
  let absolute: string;
  try {
    absolute = await resolvePathWithoutLinks(root, requestedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const info = await lstat(absolute);
  if (!info.isFile()) throw new ProjectFileBoundaryError("blocked-path");
  if (info.nlink !== 1) return null;
  const kind = kindFor(absolute);
  if (!kind || info.size > MAX_FILE_BYTES) return null;
  const bytes = await readFile(absolute);
  const content = decodeText(bytes);
  if (content === null) return null;
  return {
    access: "editable",
    path: portablePath(root, absolute),
    name: path.basename(absolute),
    sizeBytes: bytes.length,
    updatedAt: info.mtime.toISOString(),
    kind,
    content,
    version: versionFor(project, portablePath(root, absolute), info, bytes),
  };
}

async function blockedReason(root: string, requestedPath: string): Promise<ProjectFileBlockedReason> {
  const absolute = await resolvePathWithoutLinks(root, requestedPath);
  const info = await lstat(absolute);
  if (!info.isFile() || info.nlink !== 1) return "linked";
  if (!kindFor(absolute)) return "unsupported";
  if (info.size > MAX_FILE_BYTES) return "too-large";
  const bytes = await readFile(absolute);
  return decodeText(bytes) === null ? "binary" : "unsupported";
}

async function listFiles(root: string): Promise<{ files: ProjectFileSummary[]; truncated: boolean }> {
  const files: ProjectFileSummary[] = [];
  const pending = [{ directory: root, depth: 0 }];
  let scanned = 0;
  while (pending.length && files.length < MAX_LISTED_FILES) {
    const next = pending.shift();
    if (!next) break;
    const entries = await readdir(next.directory, { withFileTypes: true });
    for (const entry of entries) {
      scanned += 1;
      if (scanned > MAX_SCANNED_ENTRIES) return { files, truncated: true };
      if (entry.isSymbolicLink() || isSecretName(entry.name)) continue;
      if (entry.isDirectory()) {
        if (next.depth < MAX_SCAN_DEPTH && !SKIPPED_DIRECTORIES.has(entry.name)) {
          const child = path.join(next.directory, entry.name);
          const canonical = await realpath(child);
          if (contained(root, canonical)) pending.push({ directory: canonical, depth: next.depth + 1 });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const absolute = path.join(next.directory, entry.name);
      const info = await lstat(absolute);
      const common = { path: portablePath(root, absolute), name: entry.name,
        sizeBytes: info.size, updatedAt: info.mtime.toISOString() };
      const kind = kindFor(absolute);
      if (info.nlink !== 1) files.push({ ...common, access: "blocked", kind: "unknown", reason: "linked" });
      else if (!kind) files.push({ ...common, access: "blocked", kind: "unknown", reason: "unsupported" });
      else if (info.size > MAX_FILE_BYTES) files.push({ ...common, access: "blocked", kind: "unknown", reason: "too-large" });
      else {
        const content = decodeText(await readFile(absolute));
        files.push(content === null
          ? { ...common, access: "blocked", kind: "unknown", reason: "binary" }
          : { ...common, access: "editable", kind });
      }
      if (files.length >= MAX_LISTED_FILES) break;
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { files, truncated: pending.length > 0 };
}

async function writeTemporarySibling(target: string, content: string, mode: number): Promise<string> {
  const bytes = Buffer.from(content, "utf8");
  if (bytes.length > MAX_FILE_BYTES) throw new Error("Project files are limited to 256 KB.");
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.vivary-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", mode & 0o777);
  try {
    await handle.chmod(mode & 0o777);
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  await handle.close();
  return temporary;
}

const mutationTails = new Map<string, Promise<void>>();

async function serializeMutation<T>(project: ProjectFileIdentity, operation: () => Promise<T>): Promise<T> {
  const key = `${project.rootId}:${project.bindingId}`;
  const previous = mutationTails.get(key) ?? Promise.resolve();
  let release = () => {};
  const turn = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => turn);
  mutationTails.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (mutationTails.get(key) === tail) mutationTails.delete(key);
  }
}

export function createProjectFileService(resolveWorkspace: Resolver = resolveLocalProjectWorkspace) {
  const resolve = async (context: ActionRunContext | undefined, projectId: string) => {
    const workspace = await resolveWorkspace(context, projectId);
    if (!workspace) throw new Error("The selected project folder is unavailable.");
    return { workspace, project: projectIdentity(workspace) };
  };

  return {
    async get(context: ActionRunContext | undefined, projectId: string, requestedPath?: string): Promise<ProjectFilesResult> {
      const { workspace, project } = await resolve(context, projectId);
      if (!requestedPath) {
        const listing = await listFiles(workspace.root);
        return { code: "listing", project, ...listing };
      }
      try {
        const file = await readEditableFile(workspace.root, requestedPath, project);
        if (file) return { code: "file", project, file };
        return { code: "blocked", path: requestedPath, reason: await blockedReason(workspace.root, requestedPath) };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw Object.assign(new Error("The requested project file was not found."), { statusCode: 404 });
        }
        throw error;
      }
    },

    async save(context: ActionRunContext | undefined, input: {
      projectId: string; path: string; expectedVersion: string; content: string;
    }): Promise<ProjectFileSaveResult> {
      const initial = await resolve(context, input.projectId);
      return serializeMutation(initial.project, async () => {
        const lockedScope = await resolve(context, input.projectId);
        if (!sameProject(initial.project, lockedScope.project)) {
          return { code: "conflict", operation: "save", reason: "project-changed", path: input.path };
        }
        const current = await readEditableFile(lockedScope.workspace.root, input.path, lockedScope.project);
        if (!current) return { code: "conflict", operation: "save", reason: "renamed-or-deleted", path: input.path };
        if (current.version !== input.expectedVersion) {
          return { code: "conflict", operation: "save", reason: "changed", path: input.path, current };
        }
        const target = await resolvePathWithoutLinks(lockedScope.workspace.root, input.path);
        const targetInfo = await lstat(target);
        const temporary = await writeTemporarySibling(target, input.content, targetInfo.mode);
        try {
          const finalScope = await resolve(context, input.projectId);
          if (!sameProject(lockedScope.project, finalScope.project)) {
            return { code: "conflict", operation: "save", reason: "project-changed", path: input.path };
          }
          const finalCurrent = await readEditableFile(finalScope.workspace.root, input.path, finalScope.project);
          if (!finalCurrent) return { code: "conflict", operation: "save", reason: "renamed-or-deleted", path: input.path };
          if (finalCurrent.version !== input.expectedVersion) {
            return { code: "conflict", operation: "save", reason: "changed", path: input.path, current: finalCurrent };
          }
          await rename(temporary, target);
          const saved = await readEditableFile(finalScope.workspace.root, input.path, finalScope.project);
          if (!saved) throw new Error("The saved project file could not be verified.");
          return { code: "saved", project: finalScope.project, file: saved };
        } finally {
          await unlink(temporary).catch(() => undefined);
        }
      });
    },

    async rename(context: ActionRunContext | undefined, input: {
      projectId: string; path: string; name: string; expectedVersion: string;
    }): Promise<ProjectFileRenameResult> {
      if (input.name === "." || input.name === ".." || input.name.includes("/") || input.name.includes("\\")
        || isSecretName(input.name) || SKIPPED_DIRECTORIES.has(input.name)) {
        throw new ProjectFileBoundaryError("invalid-path");
      }
      const initial = await resolve(context, input.projectId);
      return serializeMutation(initial.project, async () => {
        const lockedScope = await resolve(context, input.projectId);
        const targetPath = path.posix.join(path.posix.dirname(input.path), input.name);
        if (!sameProject(initial.project, lockedScope.project)) {
          return { code: "conflict", operation: "rename", reason: "project-changed", path: input.path, targetPath };
        }
        const current = await readEditableFile(lockedScope.workspace.root, input.path, lockedScope.project);
        if (!current) return { code: "conflict", operation: "rename", reason: "renamed-or-deleted", path: input.path, targetPath };
        if (current.version !== input.expectedVersion) {
          return { code: "conflict", operation: "rename", reason: "changed", path: input.path, targetPath, current };
        }
        if (!kindFor(input.name)) throw new ProjectFileBoundaryError("blocked-path");
        const source = await resolvePathWithoutLinks(lockedScope.workspace.root, input.path);
        const target = await resolvePathWithoutLinks(lockedScope.workspace.root, targetPath, true);
        const finalScope = await resolve(context, input.projectId);
        if (!sameProject(lockedScope.project, finalScope.project)) {
          return { code: "conflict", operation: "rename", reason: "project-changed", path: input.path, targetPath };
        }
        const finalCurrent = await readEditableFile(finalScope.workspace.root, input.path, finalScope.project);
        if (!finalCurrent) return { code: "conflict", operation: "rename", reason: "renamed-or-deleted", path: input.path, targetPath };
        if (finalCurrent.version !== input.expectedVersion) {
          return { code: "conflict", operation: "rename", reason: "changed", path: input.path, targetPath, current: finalCurrent };
        }
        try {
          await link(source, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            return { code: "conflict", operation: "rename", reason: "target-exists", path: input.path, targetPath };
          }
          throw error;
        }
        try {
          await unlink(source);
        } catch (error) {
          try {
            await unlink(target);
          } catch {
            throw new AggregateError([error], "The exclusive rename could not restore its source.");
          }
          throw error;
        }
        const renamed = await readEditableFile(finalScope.workspace.root, targetPath, finalScope.project);
        if (!renamed) throw new Error("The renamed project file could not be verified.");
        return { code: "renamed", project: finalScope.project, previousPath: input.path, file: renamed };
      });
    },
  };
}

export const projectFileService = createProjectFileService();
