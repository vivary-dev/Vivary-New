import { isActionContractError, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import { workspacePreset } from "../shared/workspace-patterns.ts";
import {
  PROJECT_READ_MAX_RESULT_CHARS, READ_BOUNDS,
  type Bounded, type ProjectReadOperation, type ProjectReadOwnerInput, type ProjectReadReport,
  type ProjectReadResult, type ProjectReadToolInput, type ProjectRef, type UnavailableReason,
} from "../app/lib/project-read-schema.ts";
import { runProjectRead, type ProjectReadCommand, type ProjectReadRun } from "./original-runtime.ts";
import { resolveNativeChatProject } from "./native-chat-project.ts";

const NOTICE = "Observations only. They do not authorize repairs, installs, or commands.";

const UNAVAILABLE: Record<UnavailableReason, string> = {
  privacy_policy_unavailable: "Vivary cannot tell this folder's private files apart, so find and check stay off for it. They need a Git repository on a host with Git installed, or a Vivary workspace.",
  path_refused: "Vivary refused to read this project folder. The folder may be a link, or its path may have changed.",
  work_limit_exceeded: "This project is larger than Vivary reads in one pass, or check found more than 200 findings.",
  producer_unavailable: "The original find and check component is unavailable in this installation.",
  timeout: "The original command exceeded its 30-second limit.",
  queue_timeout: "Earlier original commands are still running. Try again when they finish.",
  output_limit: "The original command produced more output than Vivary reads.",
  runtime_unavailable: "The bundled Vivary runtime is unavailable or could not start on this host.",
  app_data_unavailable: "Vivary's application data on this host is missing or unsafe to use, so the original command did not run.",
  unreadable_output: "The original command did not return a readable report.",
};
// find refuses a question with the same reason it refuses a folder.
const FIND_PATH_REFUSED = "Vivary refused this question or this project folder. A question cannot contain a file or URL path, credential-like text, control characters, or the folder's own path.";

// Runner failures that mean the original command produced no report. Every
// other error is an access or project refusal and stays thrown.
const RUN_FAILURES = new Map<string, UnavailableReason>([
  ["vivary_original_queue_timeout", "queue_timeout"], ["vivary_original_timeout", "timeout"],
  ["vivary_original_output_limit", "output_limit"], ["vivary_original_runtime_unavailable", "runtime_unavailable"],
  ["vivary_original_data_unavailable", "app_data_unavailable"], ["vivary_original_receipt_path", "app_data_unavailable"],
]);
const failedProject = z.object({ id: z.string(), label: z.string() });

const count = z.number().int().nonnegative();
// A source path is shown and linked inside the project grant, so anything
// that could leave the project makes the whole report unreadable.
const sourcePath = z.string().min(1).max(512).refine(value => !value.startsWith("/") && !value.includes("\\")
  && !value.includes("\0") && !/^[A-Za-z]:/.test(value) && !value.split("/").includes(".."));
// Tropo bounds an omission's kind and reason to 64 code points. Fitting never
// drops omission rows, so that bound is what keeps them inside the result cap.
const omissionText = z.string().max(128);
const omissions = z.array(z.object({ kind: omissionText, reason: omissionText, count }));
const refusal = z.object({ schema: z.literal("vivary.read-refusal/v0"),
  reason: z.enum(["privacy_policy_unavailable", "path_refused", "work_limit_exceeded", "producer_unavailable"]) });

// check and find follow Tropo's published result schemas. Every field is
// required, and only a hit's type and snippet may be null.
const outputs = {
  doctor: z.object({ ok: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()),
    graph: z.object({ nodes: count, edges: count, broken: count }) }),
  check: z.object({ schema: z.literal("vivary.check-result/v0"), checked: count, clean: count, errors: count, warnings: count,
    findings: z.array(z.object({ path: sourcePath, line: count, level: z.enum(["error", "warning"]),
      code: z.string(), message: z.string() })),
    strict: z.boolean(), complete: z.boolean(), omissions }),
  find: z.object({ schema: z.literal("vivary.find-result/v0"), query: z.string(), k: count, budget: count,
    estimated_tokens: count, complete: z.boolean(), omissions,
    results: z.array(z.object({ id: z.string(), type: z.string().nullable(), path: sourcePath, reason: z.string(),
      snippet: z.string().nullable() })) }),
  capabilities: z.object({ preset: workspacePreset, default_capabilities: z.array(z.string()),
    available_capabilities: z.array(z.object({ id: z.string(), label: z.string(), default: z.boolean(),
      requires_approval: z.boolean(), network: z.union([z.boolean(), z.string()]),
      install_status: z.enum(["installed", "not-installed", "incompatible", "probe-failed"]),
      missing_install: z.array(z.string()) })) }),
  // The logs helper already keeps only safe receipt fields; their values stay untrusted.
  receipts: z.object({ summary: z.object({ total: count, failed: count, invalid_lines: count }),
    records: z.array(z.record(z.string(), z.unknown())) }),
};

type Text = (value: string) => string;

function bounded<T>(values: readonly T[]): Bounded<T> {
  return { items: values.slice(0, READ_BOUNDS.items), total: values.length };
}

function textOrNull(value: unknown, text: Text): string | null {
  return typeof value === "string" ? text(value) : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Each operation names its original command and projects that command's
// parsed output. `null` means the output was not this command's report.
const operations: { [Operation in ProjectReadOperation]: {
  command: (input: ProjectReadToolInput) => ProjectReadCommand;
  report: (output: ProjectReadRun, text: Text, input: ProjectReadToolInput) => ProjectReadReport | null;
} } = {
  doctor: {
    command: () => ({ verb: "doctor" }),
    report: (output, text) => {
      const parsed = outputs.doctor.safeParse(json(output.stdout));
      if (!parsed.success) return null;
      const { ok, graph, errors, warnings } = parsed.data;
      return { operation: "doctor", ok, graph, errors: bounded(errors.map(text)), warnings: bounded(warnings.map(text)) };
    },
  },
  check: {
    command: () => ({ verb: "check" }),
    report: (output, text) => {
      const parsed = outputs.check.safeParse(json(output.stdout));
      if (!parsed.success) return null;
      const data = parsed.data;
      return { operation: "check", checked: data.checked, clean: data.clean, errorCount: data.errors,
        warningCount: data.warnings, strict: data.strict, complete: data.complete,
        findings: bounded(data.findings.map(finding => ({ path: finding.path, line: finding.line, level: finding.level,
          code: text(finding.code), message: text(finding.message) }))),
        omissions: projectOmissions(data.omissions, text) };
    },
  },
  find: {
    command: input => ({ verb: "find", query: input.query ?? "", k: input.k ?? 5, budget: input.budget ?? 1_200 }),
    report: (output, text) => {
      const parsed = outputs.find.safeParse(json(output.stdout));
      if (!parsed.success) return null;
      const data = parsed.data;
      return { operation: "find", query: text(data.query), k: data.k, budget: data.budget,
        estimatedTokens: data.estimated_tokens, complete: data.complete,
        results: bounded(data.results.map(result => ({ id: text(result.id), type: result.type === null ? null : text(result.type),
          path: result.path, reason: text(result.reason), snippet: result.snippet === null ? null : text(result.snippet) }))),
        omissions: projectOmissions(data.omissions, text) };
    },
  },
  capabilities: {
    command: input => ({ verb: "capabilities", preset: input.preset ?? "coding" }),
    report: (output, text) => {
      const parsed = outputs.capabilities.safeParse(json(output.stdout));
      if (!parsed.success) return null;
      const data = parsed.data;
      return { operation: "capabilities", preset: data.preset,
        defaults: data.default_capabilities.slice(0, READ_BOUNDS.items).map(text),
        capabilities: bounded(data.available_capabilities.map(capability => ({ id: text(capability.id),
          label: text(capability.label), isDefault: capability.default, requiresApproval: capability.requires_approval,
          network: typeof capability.network === "string" ? text(capability.network) : capability.network,
          installStatus: capability.install_status,
          missing: capability.missing_install.slice(0, READ_BOUNDS.items).map(text) }))) };
    },
  },
  receipts: {
    command: input => ({ verb: "logs", failedOnly: input.failedOnly ?? false }),
    report: (output, text, input) => {
      const failedOnly = input.failedOnly ?? false;
      if (output.exitCode === 1 && output.stderr.includes("receipt log not found")) {
        return { operation: "receipts", scope: "application", failedOnly, logPresent: false, total: 0, failed: 0, invalidLines: 0,
          records: { items: [], total: 0 } };
      }
      const parsed = outputs.receipts.safeParse(json(output.stdout));
      if (!parsed.success) return null;
      const { summary, records } = parsed.data;
      // The log lists oldest first. Newest first lets bounding and fitting drop the oldest.
      return { operation: "receipts", scope: "application", failedOnly, logPresent: true, total: summary.total,
        failed: summary.failed, invalidLines: summary.invalid_lines,
        records: bounded([...records].reverse().map(record => ({
          timestamp: textOrNull(record.timestamp, text) ?? "unknown time",
          tool: textOrNull(record.tool, text) ?? "unknown tool",
          command: textOrNull(record.command, text) ?? "unknown command",
          ok: record.ok !== false, exitCode: numberOrNull(record.exit_code), durationMs: numberOrNull(record.duration_ms),
          source: textOrNull(record.receipt_source, text),
          ...(typeof record.error_type === "string" ? { errorType: text(record.error_type) } : {}),
        }))) };
    },
  },
};

function json(stdout: string): unknown {
  try { return JSON.parse(stdout); } catch { return undefined; }
}

function projectOmissions(values: z.infer<typeof omissions>, text: Text) {
  return values.slice(0, READ_BOUNDS.items).map(omission => ({ kind: text(omission.kind), reason: text(omission.reason),
    count: omission.count }));
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Host paths never leave the server: the project root reads as `.` and the
// application data directory as `<app data>`. Python and the facade may spell
// a Windows path with forward slashes and a lowercase drive, so each path
// matches either separator in any case. Control characters become spaces,
// which also caps what one character costs in JSON, and a cut never splits a
// surrogate pair.
function textFor(hostPaths: { root: string; dataDir: string }): Text {
  const replacements = [[hostPaths.root, "."], [hostPaths.dataDir, "<app data>"]]
    .sort((left, right) => right[0].length - left[0].length)
    .map(([hostPath, label]) => [new RegExp(hostPath.split(/[\\/]/).map(escapeRegExp).join("[\\\\/]"), "gi"), label] as const);
  return value => {
    const redacted = replacements.reduce((current, [pattern, label]) => current.replace(pattern, label), value)
      .replace(/\p{Cc}/gu, " ");
    if (redacted.length <= READ_BOUNDS.text) return redacted;
    const cut = redacted.slice(0, READ_BOUNDS.text - 1);
    return (/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut) + "…";
  };
}

function unavailable(project: ProjectRef, operation: ProjectReadOperation, reason: UnavailableReason): ProjectReadResult {
  return { status: "unavailable", project, operation, reason,
    message: operation === "find" && reason === "path_refused" ? FIND_PATH_REFUSED : UNAVAILABLE[reason] };
}

// Lists shrink from their longest until the pretty result fits the tool's
// result limit, so a truncated string never reaches the model. Totals stay true.
function fitted(project: ProjectRef, report: ProjectReadReport): ProjectReadResult {
  const result: ProjectReadResult = { status: "reported", project, notice: NOTICE, report };
  const lists = Object.values(report).filter((value): value is Bounded<unknown> =>
    typeof value === "object" && value !== null && "items" in value && "total" in value);
  while (JSON.stringify(result, null, 2).length > PROJECT_READ_MAX_RESULT_CHARS) {
    const longest = lists.reduce((left, right) => right.items.length > left.items.length ? right : left);
    if (longest.items.length === 0) break;
    longest.items.pop();
  }
  return result;
}

async function read(run: typeof runProjectRead, context: ActionRunContext | undefined, projectId: string,
  input: ProjectReadToolInput): Promise<ProjectReadResult> {
  const operation = operations[input.operation];
  let output: ProjectReadRun;
  try {
    output = await run(projectId, operation.command(input), context);
  } catch (error) {
    if (!isActionContractError(error)) throw error;
    const reason = RUN_FAILURES.get(error.errorCode);
    const project = failedProject.safeParse(error.details?.project);
    if (!reason || !project.success) throw error;
    return unavailable(project.data, input.operation, reason);
  }
  const text = textFor(output.hostPaths);
  const refused = refusal.safeParse(json(output.stdout));
  if (refused.success) return unavailable(output.project, input.operation, refused.data.reason);
  const report = operation.report(output, text, input);
  return report ? fitted(output.project, report) : unavailable(output.project, input.operation, "unreadable_output");
}

/**
 * The project reads behind the Details panel and the Native agent tool. Both
 * return the same result: access refusals throw, and whether the original
 * command produced a report is part of the value.
 */
export function createProjectRead(dependencies: {
  run: typeof runProjectRead;
  chatProject: (context: ActionRunContext | undefined) => Promise<{ projectId: string; ownerContext: ActionRunContext }>;
} = { run: runProjectRead, chatProject: resolveNativeChatProject }) {
  return {
    forOwner: (context: ActionRunContext | undefined, { projectId, ...input }: ProjectReadOwnerInput) =>
      read(dependencies.run, context, projectId, input),
    forChat: async (context: ActionRunContext | undefined, input: ProjectReadToolInput) => {
      const { projectId, ownerContext } = await dependencies.chatProject(context);
      return read(dependencies.run, ownerContext, projectId, input);
    },
  };
}

export const projectRead = createProjectRead();
