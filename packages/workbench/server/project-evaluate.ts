import { fail, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  AGENT_EVALUATE_OPERATIONS, AGENT_FORBIDDEN_EVIDENCE, PROJECT_EVALUATE_MAX_RESULT_CHARS, SERVER_OWNED_FIELDS,
  projectEvaluateOwnInputSchema, projectEvaluateToolInputSchema, projectRelativePath,
  type BoundaryRefusal, type EvaluateAs, type EvaluateOperation, type GovernedInput, type ProjectEvaluateOwnerInput,
  type ProjectEvaluateResult,
} from "../app/lib/project-evaluate-schema.ts";
import type { ProjectRef, UnavailableReason } from "../app/lib/project-read-schema.ts";
import { encodeEvidence, EvidenceCodecError } from "./governed-request.ts";
import { resolveNativeChatProject } from "./native-chat-project.ts";
import {
  ORIGINAL_RUN_FAILURES, runProjectEvaluate, type GovernedCommand, type OriginalRunFailure,
} from "./original-runtime.ts";

const NOTICE = "Evaluation only. Vivary did not save this result, and it does not authorize or start any work.";
const ACT_NOTICE = "A policy value, not permission to run.";
const FINGERPRINT_NOTICE = "Vivary copied the workspace fingerprint from the capsule, so a workspace match shows only that the capsule agrees with itself.";

const REFUSALS: Record<BoundaryRefusal, (field?: string) => string> = {
  server_owned_field: field => `Vivary sets ${field} itself. Remove ${field} and try again.`,
  agent_forbidden_evidence: field => `This project's agent cannot submit ${field}. Only the owner can provide ${field} as evidence.`,
  owner_only_operation: () => "Only the owner can run this operation, because it needs execution evidence Vivary cannot verify.",
  foreign_path: () => "Use paths inside this project, such as src/api. Absolute and parent-relative paths are not accepted.",
  unencodable_evidence: () => "The result has text that reads like a project path but is not one, so Vivary cannot return it safely.",
  result_too_large: () => "The result is larger than Vivary returns in one call.",
};

const UNAVAILABLE: Partial<Record<UnavailableReason, string>> = {
  timeout: "The original command exceeded its 30-second limit.",
  queue_timeout: "Earlier original commands are still running. Try again when they finish.",
  output_limit: "The original command produced more output than Vivary reads.",
  runtime_unavailable: "The bundled Vivary runtime is unavailable or could not start on this host.",
  app_data_unavailable: "Vivary's application data on this host is missing or unsafe to use, so the original command did not run.",
  unreadable_output: "The original command did not return a readable result.",
};

const RUN_FAILURES: Record<OriginalRunFailure, UnavailableReason> = {
  [ORIGINAL_RUN_FAILURES.queueTimeout]: "queue_timeout",
  [ORIGINAL_RUN_FAILURES.timeout]: "timeout",
  [ORIGINAL_RUN_FAILURES.outputLimit]: "output_limit",
  [ORIGINAL_RUN_FAILURES.runtimeUnavailable]: "runtime_unavailable",
  [ORIGINAL_RUN_FAILURES.dataUnavailable]: "app_data_unavailable",
  [ORIGINAL_RUN_FAILURES.receiptPath]: "app_data_unavailable",
};

// Strato and Exo each answer with a result or with their own refusal. A
// refusal is still an evaluation, and its reason codes pass through verbatim.
const reasonCodes = z.array(z.string());
const strato = z.union([
  z.looseObject({ schema: z.literal("vivary.strato-decision/v0"), decision: z.string(), reason_codes: reasonCodes }),
  z.looseObject({ schema: z.literal("vivary.strato-decision-refusal/v0"), reason_codes: reasonCodes }),
]);
const exo = z.union([
  z.looseObject({ schema: z.literal("vivary.exo-control-result/v0"), operation: z.string(), result: z.unknown() }),
  z.looseObject({ schema: z.literal("vivary.exo-control-refusal/v0"), reason_codes: reasonCodes }),
]);

type Reading = { refusedBy: "strato" | "exo" | null; act: boolean };
function read(stdout: string, operation: EvaluateOperation): Reading | null {
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { return null; }
  if (operation === "decide") {
    const parsed = strato.safeParse(value);
    if (!parsed.success) return null;
    return parsed.data.schema === "vivary.strato-decision-refusal/v0"
      ? { refusedBy: "strato", act: false } : { refusedBy: null, act: parsed.data.decision === "act" };
  }
  const parsed = exo.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.schema === "vivary.exo-control-refusal/v0") return { refusedBy: "exo", act: false };
  return parsed.data.operation === operation ? { refusedBy: null, act: false } : null;
}

const refused = (project: ProjectRef | null, operation: string, reason: BoundaryRefusal, field?: string): ProjectEvaluateResult =>
  ({ status: "refused", project, operation, reason, ...(field ? { field } : {}), message: REFUSALS[reason](field) });

const includes = (list: readonly string[], value: string) => list.includes(value);

// Refusals that name a field come before the strict schema, so an attempt to
// set a server-owned value is reported by name and never overwritten.
function boundary(raw: Record<string, unknown>, evaluateAs: EvaluateAs): GovernedInput | ProjectEvaluateResult {
  const operation = String(raw.operation);
  const owned = Object.keys(raw).find(key => includes(SERVER_OWNED_FIELDS, key));
  if (owned) return refused(null, operation, "server_owned_field", owned);
  if (evaluateAs === "agent") {
    const state = raw.state && typeof raw.state === "object" && !Array.isArray(raw.state) ? Object.keys(raw.state) : [];
    const evidence = [...Object.keys(raw), ...state].find(key => includes(AGENT_FORBIDDEN_EVIDENCE, key));
    if (evidence) return refused(null, operation, "agent_forbidden_evidence", evidence);
    if (!includes(AGENT_EVALUATE_OPERATIONS, operation)) return refused(null, operation, "owner_only_operation");
  }
  if (Array.isArray(raw.paths) && raw.paths.some(entry => typeof entry === "string" && !projectRelativePath.safeParse(entry).success)) {
    return refused(null, operation, "foreign_path", "paths");
  }
  const parsed = (evaluateAs === "agent" ? projectEvaluateToolInputSchema : projectEvaluateOwnInputSchema).safeParse(raw);
  if (!parsed.success) {
    fail(`This ${operation} input is not valid. ${z.prettifyError(parsed.error)}`, { errorCode: "vivary_evaluate_input", statusCode: 400 });
  }
  return parsed.data;
}

async function evaluate(run: typeof runProjectEvaluate, context: ActionRunContext | undefined, projectId: string,
  evaluateAs: EvaluateAs, raw: Record<string, unknown>): Promise<ProjectEvaluateResult> {
  const input = boundary(raw, evaluateAs);
  if ("status" in input) return input;
  const { operation } = input;
  const command = { verb: operation === "decide" ? "decide" : "control", evaluateAs, input } as GovernedCommand;
  const output = await run(projectId, command, context);
  if ("failure" in output) {
    const reason = RUN_FAILURES[output.failure];
    return { status: "unavailable", project: output.project, operation, reason, message: UNAVAILABLE[reason]! };
  }
  if ("refusal" in output) return refused(output.project, operation, output.refusal);
  const reading = read(output.stdout, operation);
  if (!reading) {
    return { status: "unavailable", project: output.project, operation, reason: "unreadable_output",
      message: UNAVAILABLE.unreadable_output! };
  }
  let encoded: unknown;
  try { encoded = encodeEvidence(JSON.parse(output.stdout), output.hostPaths); }
  catch (error) {
    if (error instanceof EvidenceCodecError) return refused(output.project, operation, error.reason);
    throw error;
  }
  const notice = [NOTICE, ...(operation === "decide" ? [FINGERPRINT_NOTICE] : []), ...(reading.act ? [ACT_NOTICE] : [])].join(" ");
  const agent = output.actor.kind === "agent";
  const result: ProjectEvaluateResult = {
    status: "evaluated", project: output.project, operation,
    evaluatedAs: { kind: output.actor.kind, id: output.actor.id, authorityClass: "contributor", role: agent ? "project-agent" : "owner" },
    persisted: false, evaluationKind: "caller-provided-evidence", notice, refusedBy: reading.refusedBy, output: encoded,
  };
  // Evidence is never cut, because a cut claim ledger or capsule would change what it proves.
  return JSON.stringify(result, null, 2).length > PROJECT_EVALUATE_MAX_RESULT_CHARS
    ? refused(output.project, operation, "result_too_large") : result;
}

/**
 * Decide and control behind the owner's Evaluate panel and the Native agent
 * tool. A tool call always evaluates as this project's agent, and the owner's
 * agent mode returns the same result for the same input and clock.
 */
export function createProjectEvaluate(dependencies: {
  run: typeof runProjectEvaluate;
  chatProject: (context: ActionRunContext | undefined) => Promise<{ projectId: string; projectContext: ActionRunContext }>;
} = { run: runProjectEvaluate, chatProject: resolveNativeChatProject }) {
  return {
    forOwner: (context: ActionRunContext | undefined, { projectId, evaluateAs, ...input }: ProjectEvaluateOwnerInput) =>
      evaluate(dependencies.run, context, projectId, evaluateAs, input),
    forChat: async (context: ActionRunContext | undefined, input: Record<string, unknown>) => {
      const { projectId, projectContext } = await dependencies.chatProject(context);
      return evaluate(dependencies.run, projectContext, projectId, "agent", input);
    },
  };
}

export const projectEvaluate = createProjectEvaluate();
