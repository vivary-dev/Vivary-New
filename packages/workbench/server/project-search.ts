import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import type { ActionRunContext } from "@agent-native/core/action";

import type { ProjectFileIdentity } from "../app/lib/project-file-schema.ts";
import type {
  ProjectSearchFileMatch,
  ProjectSearchInput,
  ProjectSearchResult,
  ProjectSearchTextMatch,
  ProjectSearchTruncation,
} from "../app/lib/project-search-schema.ts";
import {
  MAX_FILE_BYTES,
  SKIPPED_DIRECTORIES,
  contained,
  decodeText,
  isSecretName,
  kindFor,
  portablePath,
  projectIdentity,
  readBoundedFile,
  sameProject,
  type Resolver,
} from "./project-files.ts";
import { resolveLocalProjectWorkspace } from "./project-services.mjs";

// Bounded exact search over one authorized project. No index, no shell, no
// binary: the walk applies the same skip list, secret filter, and text
// sniffing as the project file surface, and every request stops at explicit
// caps so the panel can page with `continueAfter` instead of waiting.
export type ProjectSearchLimits = Readonly<{
  maxScannedEntries: number;
  maxReadFiles: number;
  maxMatches: number;
  maxFileMatches: number;
  maxLineLength: number;
  maxDepth: number;
  timeBudgetMs: number;
  excerptLength: number;
}>;

export const DEFAULT_PROJECT_SEARCH_LIMITS: ProjectSearchLimits = Object.freeze({
  maxScannedEntries: 50_000,
  maxReadFiles: 2_000,
  maxMatches: 200,
  maxFileMatches: 20,
  maxLineLength: 2_000,
  maxDepth: 16,
  timeBudgetMs: 1_500,
  excerptLength: 160,
});

type Matcher = (line: string) => number;

function literalMatcher(query: string): Matcher {
  const needle = query.toLowerCase();
  return line => line.toLowerCase().indexOf(needle);
}

function regexMatcher(query: string): Matcher | string {
  try {
    const pattern = new RegExp(query, "u");
    return line => pattern.exec(line)?.index ?? -1;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid regular expression";
  }
}

function excerptFor(line: string, column: number, length: number): string {
  if (line.length <= length) return line;
  const start = Math.max(0, Math.min(column - Math.floor(length / 4), line.length - length));
  const slice = line.slice(start, start + length);
  return (start > 0 ? "…" : "") + slice + (start + length < line.length ? "…" : "");
}

// Traversal order is depth-first with entries sorted by name, so a project
// path's position is its segment-wise comparison; `after` resumes past it.
function compareSegments(left: string[], right: string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return left.length - right.length;
}

function precedesCursor(segments: string[], after: string[] | null): boolean {
  return after !== null && compareSegments(segments, after) <= 0;
}

function subtreePrecedesCursor(segments: string[], after: string[] | null): boolean {
  if (after === null) return false;
  const prefix = after.slice(0, segments.length);
  return compareSegments(segments, prefix) < 0;
}

export function createProjectSearchService(
  resolveWorkspace: Resolver = resolveLocalProjectWorkspace,
  limits: Partial<ProjectSearchLimits> = {},
) {
  const bounds: ProjectSearchLimits = { ...DEFAULT_PROJECT_SEARCH_LIMITS, ...limits };

  const resolve = async (context: ActionRunContext | undefined, projectId: string) => {
    const workspace = await resolveWorkspace(context, projectId);
    if (!workspace) throw new Error("The selected project folder is unavailable.");
    return { workspace, project: projectIdentity(workspace) };
  };

  async function walk(root: string, input: ProjectSearchInput, project: ProjectFileIdentity, matcher: Matcher | null) {
    const started = performance.now();
    const after = input.after ? input.after.split("/") : null;
    const files: ProjectSearchFileMatch[] = [];
    const matches: ProjectSearchTextMatch[] = [];
    let scannedEntries = 0;
    let readFiles = 0;
    let truncated: ProjectSearchTruncation | null = null;
    let lastVisited: string | null = null;
    const pending: Array<{ directory: string; segments: string[] }> = [{ directory: root, segments: [] }];

    const stop = (reason: ProjectSearchTruncation) => { truncated = reason; };
    const outOfTime = () => lastVisited !== null && performance.now() - started >= bounds.timeBudgetMs;

    walk: while (pending.length && truncated === null) {
      const current = pending.shift();
      if (!current) break;
      let entries;
      try {
        entries = await readdir(current.directory, { withFileTypes: true });
      } catch (error) {
        if (current.directory === root) throw error;
        continue;
      }
      entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
      const children: typeof pending = [];
      for (const entry of entries) {
        scannedEntries += 1;
        if (scannedEntries > bounds.maxScannedEntries) { stop("entries"); break walk; }
        if (entry.isSymbolicLink() || isSecretName(entry.name)) continue;
        const segments = [...current.segments, entry.name];
        const absolute = path.join(current.directory, entry.name);
        if (entry.isDirectory()) {
          if (current.segments.length >= bounds.maxDepth || SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
          if (subtreePrecedesCursor(segments, after)) continue;
          let canonical: string;
          try { canonical = await realpath(absolute); } catch { continue; }
          if (contained(root, canonical)) children.push({ directory: canonical, segments });
          continue;
        }
        if (!entry.isFile() || precedesCursor(segments, after)) continue;
        const relative = segments.join("/");

        if (input.mode === "filename") {
          // Names need no stat: the directory entry already says this is a
          // regular file, and nothing is read. That keeps a 20,000-file tree
          // under the time budget on slow filesystems.
          if (relative.toLowerCase().includes(input.query.toLowerCase())) {
            files.push({ path: relative, name: entry.name });
          }
          lastVisited = relative;
          if (files.length >= bounds.maxMatches) { stop("matches"); break walk; }
          if (outOfTime()) { stop("time"); break walk; }
          continue;
        }

        let info;
        try { info = await lstat(absolute); } catch { continue; }
        if (!info.isFile() || info.nlink !== 1) continue;
        if (!kindFor(absolute) || info.size > MAX_FILE_BYTES) { lastVisited = relative; continue; }
        if (readFiles >= bounds.maxReadFiles) { stop("files"); break walk; }
        readFiles += 1;
        const bytes = await readBoundedFile(absolute);
        const content = bytes.length > MAX_FILE_BYTES ? null : decodeText(bytes);
        lastVisited = relative;
        if (content !== null && matcher) {
          const lines = content.split("\n");
          let fileMatches = 0;
          for (let index = 0; index < lines.length && fileMatches < bounds.maxFileMatches; index += 1) {
            const line = lines[index].endsWith("\r") ? lines[index].slice(0, -1) : lines[index];
            if (line.length > bounds.maxLineLength) continue;
            const column = matcher(line);
            if (column < 0) continue;
            fileMatches += 1;
            matches.push({ path: relative, line: index + 1, column: column + 1,
              excerpt: excerptFor(line, column, bounds.excerptLength) });
          }
        }
        if (matches.length >= bounds.maxMatches) { stop("matches"); break walk; }
        if (outOfTime()) { stop("time"); break walk; }
      }
      // Depth-first: the directories found here are visited before siblings
      // queued by earlier directories.
      pending.unshift(...children);
    }

    const result: ProjectSearchResult = {
      code: "results",
      project,
      query: input.query,
      mode: input.mode,
      files,
      matches,
      scannedEntries,
      readFiles,
      truncated,
      continueAfter: truncated === null ? null : lastVisited,
      elapsedMs: Math.round(performance.now() - started),
    };
    return result;
  }

  return {
    limits: bounds,

    async search(context: ActionRunContext | undefined, input: ProjectSearchInput): Promise<ProjectSearchResult> {
      const { workspace, project } = await resolve(context, input.projectId);
      let matcher: Matcher | null = null;
      if (input.mode === "text") matcher = literalMatcher(input.query);
      else if (input.mode === "regex") {
        const built = regexMatcher(input.query);
        if (typeof built === "string") {
          return { code: "invalid-pattern", project, query: input.query, mode: "regex", reason: built };
        }
        matcher = built;
      }
      const result = await walk(workspace.root, input, project, matcher);
      const finalScope = await resolve(context, input.projectId);
      if (!sameProject(project, finalScope.project)) {
        throw new Error("The selected project changed while it was being searched.");
      }
      return result;
    },
  };
}

export const projectSearchService = createProjectSearchService();
