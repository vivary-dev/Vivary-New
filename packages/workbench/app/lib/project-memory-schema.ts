import { z } from "zod";

import { projectFileIdSchema, projectFilePathSchema, projectFileVersionSchema } from "./project-file-schema.ts";

// A line break or control character would split a frontmatter line or the
// heading, so the one-line fields refuse them.
const singleLine = (value: string) => !/[\u0000-\u001f\u007f]/.test(value);

/** The fact's title. It also names the file once, when the fact is first saved. */
export const factTitleSchema = z.string().trim().min(1).max(120)
  .refine(singleLine, "Use one line for the title.")
  .refine(value => !value.startsWith("#"), "Start the title with a word, not #.");

/** The confirmed statement. Markdown is allowed. The cap keeps one fact from crowding out the rest. */
export const factTextSchema = z.string().trim().min(1).max(2_000);

/**
 * Where the fact came from. Tropo keeps a double-quoted frontmatter value
 * verbatim without unescaping, so quotation marks and backslashes are
 * refused instead of escaped.
 */
export const factSourceSchema = z.string().trim().min(1).max(200)
  .refine(singleLine, "Use one line for the source.")
  .refine(value => !/["\\]/.test(value), "Remove quotation marks and backslashes from the source.");

export const projectMemoryInputSchema = z.strictObject({ projectId: projectFileIdSchema });

export const projectMemoryWriteInputSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    projectId: projectFileIdSchema,
    operation: z.literal("remember"),
    title: factTitleSchema,
    text: factTextSchema,
    source: factSourceSchema,
  }),
  z.strictObject({
    projectId: projectFileIdSchema,
    operation: z.literal("correct"),
    path: projectFilePathSchema,
    expectedVersion: projectFileVersionSchema,
    title: factTitleSchema,
    text: factTextSchema,
    source: factSourceSchema,
  }),
  z.strictObject({
    projectId: projectFileIdSchema,
    operation: z.literal("forget"),
    path: projectFilePathSchema,
    expectedVersion: projectFileVersionSchema,
  }),
]);
export type ProjectMemoryWriteInput = z.infer<typeof projectMemoryWriteInputSchema>;

export const WORKSPACE_ROLES = ["law", "map", "record", "memory", "boundary"] as const;
export type WorkspaceRole = typeof WORKSPACE_ROLES[number];
export type WorkspaceRoles = Readonly<Record<WorkspaceRole, readonly string[]>>;

/** Which memory folders the workspace's ignore rules make private, and whether a root .gitignore supplied rules. */
export type MemoryPrivacy = { policy: "gitignore" | "none"; private: readonly string[] };

/**
 * The original engine's answer for one project, read through the creator
 * bridge. It depends only on `.vivary/workspace.toml` and ignore-rule bytes.
 * `memory` is always the effective list: the role's paths, or the engine's default.
 */
export type WorkspaceContextPaths =
  | { status: "thin"; roles: WorkspaceRoles; state: string; memory: readonly string[];
      memoryAssigned: boolean; privacy: MemoryPrivacy }
  | { status: "plain"; memory: readonly string[]; privacy: MemoryPrivacy }
  | { status: "invalid"; message: string };

/** The engine's answer, or why Vivary could not ask for it. */
export type MemorySettings = WorkspaceContextPaths | { status: "unavailable"; message: string };

/** Why a memory folder is not used. A closed set, so every refusal has fixed wording. */
export type LocationProblem = "reserved" | "boundary" | "private" | "not-folder" | "linked" | "blocked";

export type MemoryLocation =
  | { path: string; status: "ready" }
  | { path: string; status: "absent" }
  | { path: string; status: "refused"; problem: LocationProblem };

/** One fact as read from its owning file. `path` is its identity. */
export type MemoryFact = {
  path: string;
  title: string;
  text: string;
  /** null when the file has no usable source. Note check reports it. */
  source: string | null;
  /** YYYY-MM-DD, or null when missing or malformed. */
  confirmed: string | null;
  version: string;
  updatedAt: string;
};

export type SkippedFactFile = { path: string; reason: "linked" | "too-large" | "binary" | "unsupported" };

/** The latest message that loaded this project's context in this app session. It is not stored. */
export type ProjectContextLastLoad = {
  at: string;
  surface: "code" | "full-chat";
  factCount: number;
  revision: string;
};

export type ProjectMemoryView = {
  project: { id: string; label: string };
  settings: MemorySettings;
  /** One row per effective memory folder, in role order. Empty when settings are unavailable. */
  locations: readonly MemoryLocation[];
  /** The folder a new fact is saved in, or null when no folder can take one. */
  writeLocation: string | null;
  /** Every readable fact, newest confirmation first. */
  facts: readonly MemoryFact[];
  skipped: readonly SkippedFactFile[];
  /** True when a folder held more files than one read lists. */
  truncated: boolean;
  /** The exact block the next message receives. Runs use the same renderer. */
  preview: string;
  lastLoad: ProjectContextLastLoad | null;
};

export type ProjectMemoryWriteResult =
  | { code: "remembered" | "corrected"; fact: MemoryFact }
  | { code: "forgotten"; path: string }
  | {
      code: "conflict";
      /** `exists`: a fact file with this title's name exists. Correct that fact instead. */
      reason: "exists" | "changed" | "renamed-or-deleted" | "project-changed";
      path: string;
      current?: MemoryFact;
    }
  | { code: "unavailable"; reason: LocationProblem | "settings" | "title" | "not-a-fact"; message: string };

export const LOCATION_PROBLEM_TEXT: Readonly<Record<LocationProblem, string>> = {
  reserved: "This folder belongs to Vivary private, runtime, or semantic-search data, or to Git. Choose another memory folder.",
  boundary: "This folder is inside a boundary path. Choose a memory folder that can be versioned.",
  private: "This project's .gitignore rules ignore this folder, so Vivary does not load or save facts here.",
  "not-folder": "This path is a file. Vivary keeps one file per fact, so the memory path must be a folder.",
  linked: "This path goes through a link. Vivary does not follow links for memory.",
  blocked: "This path has a name Vivary hides, such as one containing secret or credential.",
};

export const EFFECTIVE_WHEN_TEXT =
  "Code and Full chat read this project's instructions, state, and facts when each message starts. "
  + "A change applies to your next message, including in open conversations. "
  + "A reply already in progress keeps what it started with.";

/** Shown before every forget. */
export function forgetDisclosure(path: string): string {
  return `Forget removes ${path}. Agents stop receiving it from your next message. `
    + "Earlier conversation transcripts, Codex thread history, Git history and other file versions, "
    + "and backups may still contain it. Vivary does not erase those.";
}
