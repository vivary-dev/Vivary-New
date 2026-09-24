import type { ActionRunContext } from "@agent-native/core/action";
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
  privacy_policy_unavailable: "This folder is neither a Git repository nor a Vivary workspace, so Vivary cannot tell its private files apart. Find and check stay off for it.",
  path_refused: "The original command refused this project folder.",
  work_limit_exceeded: "This project is larger than the original command reads in one pass.",
  producer_unavailable: "The original find and check component is unavailable in this installation.",
  timeout: "The original command exceeded its 30-second limit.",
  queue_timeout: "Earlier original commands are still running. Try again when they finish.",
  output_limit: "The original command produced more output than Vivary reads.",
  runtime_unavailable: "The bundled Vivary runtime is unavailable on this host.",
  unreadable_output: "The original command did not return a readable report.",
};

const count = z.number().int().nonnegative();
// A source path is shown and linked inside the project grant, so anything
// that could leave the project makes the whole report unreadable.
const sourcePath = z.string().min(1).max(512).refine(value => !value.startsWith("/") && !value.includes("\\")
  && !value.includes("\0") && !/^[A-Za-z]:/.test(value) && !value.split("/").includes(".."));
const omissions = z.array(z.object({ kind: z.string(), reason: z.string(), count }));
const refusal = z.object({ schema: z.literal("vivary.read-refusal/v0"),
  reason: z.enum(["privacy_policy_unavailable", "path_refused", "work_limit_exceeded", "producer_unavailable"]) });

const outputs = {
  doctor: z.object({ ok: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()),
    graph: z.object({ nodes: count, edges: count, broken: count }) }),
  check: z.object({ schema: z.literal("vivary.check-result/v0"), checked: count, clean: count, errors: count, warnings: count,
    findings: z.array(z.object({ path: sourcePath, line: count.nullable(), level: z.enum(["error", "warning"]),
      code: z.string(), message: z.string() })),
    strict: z.boolean(), complete: z.boolean(), omissions }),
  find: z.object({ schema: z.literal("vivary.find-result/v0"), query: z.string(), k: count, budget: count,
    estimated_tokens: count, complete: z.boolean(), omissions,
    results: z.array(z.object({ id: z.string(), type: z.string().nullable(), path: sourcePath, reason: z.string(),
      snippet: z.string().optional() })) }),
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
  report: (output: Extract<ProjectReadRun, { outcome: "exited" }>, text: Text) => ProjectReadReport | null;
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
          path: result.path, reason: text(result.reason), snippet: text(result.snippet ?? "") }))),
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
    report: (output, text) => {
      if (output.exitCode === 1 && output.stderr.includes("receipt log not found")) {
        return { operation: "receipts", scope: "application", logPresent: false, total: 0, failed: 0, invalidLines: 0,
          records: { items: [], total: 0 } };
      }
      const parsed = outputs.receipts.safeParse(json(output.stdout));
      if (!parsed.success) return null;
      const { summary, records } = parsed.data;
      return { operation: "receipts", scope: "application", logPresent: true, total: summary.total,
        failed: summary.failed, invalidLines: summary.invalid_lines,
        records: bounded(records.map(record => ({
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

// Host paths never leave the server: the project root reads as `.` and the
// application data directory as `<app data>`.
function textFor(hostPaths: { root: string; dataDir: string }): Text {
  const replacements = [[hostPaths.root, "."], [hostPaths.dataDir, "<app data>"]]
    .sort((left, right) => right[0].length - left[0].length);
  return value => {
    const redacted = replacements.reduce((current, [path, label]) => current.split(path).join(label), value);
    return redacted.length > READ_BOUNDS.text ? redacted.slice(0, READ_BOUNDS.text - 1) + "…" : redacted;
  };
}

function unavailable(project: ProjectRef, operation: ProjectReadOperation, reason: UnavailableReason,
  detail?: string): ProjectReadResult {
  return { status: "unavailable", project, operation, reason,
    message: detail ? `${UNAVAILABLE[reason]} ${detail}` : UNAVAILABLE[reason] };
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
  const output = await run(projectId, operation.command(input), context);
  if (output.outcome === "failed") return unavailable(output.project, input.operation, output.reason);
  const text = textFor(output.hostPaths);
  const refused = refusal.safeParse(json(output.stdout));
  if (refused.success) return unavailable(output.project, input.operation, refused.data.reason);
  const report = operation.report(output, text);
  if (report) return fitted(output.project, report);
  // argparse errors and Python tracebacks both end with the line that names the problem.
  const detail = output.stderr.split(/\r?\n/).findLast(line => line.trim());
  return unavailable(output.project, input.operation, "unreadable_output", detail ? text(detail.trim()) : undefined);
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
