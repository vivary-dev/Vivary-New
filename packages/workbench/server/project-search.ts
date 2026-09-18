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

// A scanner returns, per line, the 0-based column of the first match or -1.
type Scanner = (lines: string[]) => number[];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Literal text is matched with a case-insensitive pattern over the original
// line, so the reported column stays an offset into that line (lowercasing
// can change a string's length).
function literalScanner(query: string): Scanner {
  const pattern = new RegExp(escapeRegExp(query), "iu");
  return lines => lines.map(line => pattern.exec(line)?.index ?? -1);
}

function regexScanner(query: string): Scanner | string {
  try {
    const pattern = new RegExp(query, "u");
    return lines => lines.map(line => pattern.exec(line)?.index ?? -1);
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

// Traversal is depth-first with every directory's entries in name order and
// each directory visited at its own sorted position, so a project path's
// place in the walk is its segment-wise comparison. `after` resumes past it.
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
  return compareSegments(segments, after.slice(0, segments.length)) < 0;
}

const byName = (left: { name: string }, right: { name: string }) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

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

  async function walk(root: string, input: ProjectSearchInput, project: ProjectFileIdentity, scanner: Scanner | null) {
    const started = performance.now();
    const after = input.after ? input.after.split("/") : null;
    const files: ProjectSearchFileMatch[] = [];
    const matches: ProjectSearchTextMatch[] = [];
    let scannedEntries = 0;
    let readFiles = 0;
    let truncated: ProjectSearchTruncation | null = null;
    // The last entry fully handled on this page. A truncation never advances
    // it past the entry that tripped the limit, so the next page starts there.
    let lastExamined: string | null = null;

    const stop = (reason: ProjectSearchTruncation) => { truncated = reason; };
    // Time is checked between filesystem operations; a single read or readdir
    // is not interrupted. Progress is guaranteed because the budget only
    // applies once at least one entry has been handled.
    const outOfTime = () => lastExamined !== null && performance.now() - started >= bounds.timeBudgetMs;
    const countEntry = (): boolean => {
      scannedEntries += 1;
      if (scannedEntries > bounds.maxScannedEntries) { stop("entries"); return false; }
      return true;
    };

    async function scanFile(absolute: string, relative: string): Promise<void> {
      if (!kindFor(absolute)) return;
      let info;
      try { info = await lstat(absolute); } catch { return; }
      if (!info.isFile() || info.nlink !== 1 || info.size > MAX_FILE_BYTES) return;
      if (readFiles >= bounds.maxReadFiles) { stop("files"); return; }
      readFiles += 1;
      const bytes = await readBoundedFile(absolute);
      const content = bytes.length > MAX_FILE_BYTES ? null : decodeText(bytes);
      if (content === null || !scanner) return;
      const lines = content.split("\n").map(line => line.endsWith("\r") ? line.slice(0, -1) : line);
      const columns = scanner(lines.map(line => line.length > bounds.maxLineLength ? "" : line));
      const found: ProjectSearchTextMatch[] = [];
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (column < 0) continue;
        if (found.length === bounds.maxFileMatches) { found[found.length - 1].more = true; break; }
        found.push({ path: relative, line: index + 1, column: column + 1,
          excerpt: excerptFor(lines[index], column, bounds.excerptLength) });
      }
      const room = bounds.maxMatches - matches.length;
      if (found.length > room) {
        // Keep the page cap exact. A file that would overflow it is left for
        // the next page, unless it is the page's only file with results, in
        // which case its first `room` matches are returned and flagged.
        if (matches.length === 0) {
          const kept = found.slice(0, room);
          kept[kept.length - 1].more = true;
          matches.push(...kept);
          lastExamined = relative;
        }
        stop("matches");
        return;
      }
      matches.push(...found);
      lastExamined = relative;
      if (matches.length >= bounds.maxMatches) stop("matches");
    }

    async function visit(directory: string, segments: string[]): Promise<void> {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (segments.length === 0) throw error;
        return;
      }
      entries.sort(byName);
      if (outOfTime()) { stop("time"); return; }
      for (const entry of entries) {
        if (truncated !== null) return;
        if (entry.isSymbolicLink() || isSecretName(entry.name)) continue;
        const childSegments = [...segments, entry.name];
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (segments.length >= bounds.maxDepth || SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
          if (subtreePrecedesCursor(childSegments, after)) continue;
          if (!countEntry()) return;
          let canonical: string;
          try { canonical = await realpath(absolute); } catch { continue; }
          if (!contained(root, canonical)) continue;
          await visit(canonical, childSegments);
          if (truncated !== null) return;
          // Only files advance the cursor: a directory path sorts before its
          // own contents, so using it would re-admit them on the next page.
          if (outOfTime()) { stop("time"); return; }
          continue;
        }
        if (!entry.isFile() || precedesCursor(childSegments, after)) continue;
        if (!countEntry()) return;
        const relative = childSegments.join("/");
        if (input.mode === "filename") {
          // Names need no stat: the directory entry already says this is a
          // regular file, and nothing is read.
          if (relative.toLowerCase().includes(input.query.toLowerCase())) {
            files.push({ path: relative, name: entry.name });
          }
          lastExamined = relative;
          if (files.length >= bounds.maxMatches) { stop("matches"); return; }
        } else {
          await scanFile(absolute, relative);
          if (truncated !== null) return;
          lastExamined = relative;
        }
        if (outOfTime()) { stop("time"); return; }
      }
    }

    await visit(root, []);

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
      continueAfter: truncated === null ? null : lastExamined,
      elapsedMs: Math.round(performance.now() - started),
    };
    return result;
  }

  return {
    limits: bounds,

    async search(context: ActionRunContext | undefined, input: ProjectSearchInput): Promise<ProjectSearchResult> {
      const { workspace, project } = await resolve(context, input.projectId);
      let scanner: Scanner | null = null;
      if (input.mode === "text") scanner = literalScanner(input.query);
      else if (input.mode === "regex") {
        const built = regexScanner(input.query);
        if (typeof built === "string") {
          return { code: "invalid-pattern", project, query: input.query, mode: "regex", reason: built };
        }
        scanner = built;
      }
      const result = await walk(workspace.root, input, project, scanner);
      const finalScope = await resolve(context, input.projectId);
      if (!sameProject(project, finalScope.project)) {
        throw new Error("The selected project changed while it was being searched.");
      }
      return result;
    },
  };
}

export const projectSearchService = createProjectSearchService();
