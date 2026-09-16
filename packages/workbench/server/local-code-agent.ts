import { getCodePermissionMode, type CodePermissionMode } from "./code-permissions";
import { codexApprovalResponse, supportsCodexRequest, type CodexApprovalDecision } from "./codex-approval";
import type { CodexActionRequest } from "./code-execution-protocol";
import { lstat, realpath, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { fail, type ActionRunContext } from "@agent-native/core/action";
import {
  appendCodeAgentTranscriptEvent,
  createCodeAgentRunRecord,
  getCodeAgentRunRecord,
  isActiveCodeAgentRun,
  listCodeAgentRunRecords,
  listCodeAgentTranscriptEvents,
  updateCodeAgentRunRecord,
  type CodeAgentRunRecord,
  type CodeAgentTranscriptEvent,
} from "@agent-native/core/code-agents";

import { getCodexModels, type CodexModelCatalog } from "./codex-models";

import { executeVivaryCodeWorker, VivaryCodeWorkerCleanupError } from "./code-execution-host";
import { getVivaryRuntimeStatus, type VivaryCodeEngine, type VivaryRuntimeStatus } from "./local-runtime-setup.ts";

export const VIVARY_CODE_ENGINES = ["claude-cli", "codex-cli"] satisfies [VivaryCodeEngine, ...VivaryCodeEngine[]];
export const VIVARY_CODE_DEFAULT_ENGINE: VivaryCodeEngine = "claude-cli";

const VIVARY_CODE_GOAL_ID = "vivary-local-code";
const VIVARY_CODE_APP_MARKER = "vivary-workbench-local-code";
export type VivaryCodeModel = "sonnet" | "opus" | "fable";
export const VIVARY_CODE_MODELS = [
  "sonnet",
  "opus",
  "fable",
] satisfies [VivaryCodeModel, ...VivaryCodeModel[]];
export const VIVARY_CODE_DEFAULT_MODEL: VivaryCodeModel = "sonnet";
const MAX_RUNS = 20;
const MAX_TRANSCRIPT_EVENTS = 400;
const MAX_FOLLOW_UP_EVENTS = 24;
const MAX_FOLLOW_UP_CONTEXT_CHARS = 12_000;
const MAX_FOLLOW_UP_EVENT_CHARS = 3_000;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_LISTED_FILES = 200;
const MAX_SCANNED_ENTRIES = 2_000;
const MAX_SCAN_DEPTH = 6;
const SHUTDOWN_WAIT_MS = 10_000;
const ALLOWED_FILE_EXTENSIONS = new Set([".json", ".md", ".txt"]);

type ActiveRun = {
  controller: AbortController;
  ownerEmail: string;
  orgId?: string;
  execution: Promise<void> | null;
  stopReason: "shutdown" | "user" | null;
  workspace: VivaryCodeWorkspace;
  permissionMode: CodePermissionMode;
  requests: Map<string, { request: CodexActionRequest; resolve: (response: Record<string, unknown>) => void }>;
};

export type VivaryCodeRunSummary = Pick<
  CodeAgentRunRecord,
  "id" | "status" | "title" | "updatedAt"
> & {
  engine: VivaryCodeEngine;
  engineLabel: string;
  model: string;
};

export type VivaryCodeRunState = VivaryCodeRunSummary & {
  events: CodeAgentTranscriptEvent[];
};

export type VivaryCodeProjectHistory = Readonly<{
  label: string;
  projectId: string;
  bindingId: string;
  rootId: string;
  bindingRevision: number;
}>;

export type VivaryCodeWorkspace = Readonly<{
  root: string;
  label: string;
  projectId?: string;
  bindingId?: string;
  rootId?: string;
  bindingRevision?: number;
}>;

type VivaryCodeReadScope = VivaryCodeProjectHistory | VivaryCodeWorkspace;

export type VivaryCodePendingApproval = CodexActionRequest & {
  runId: string;
  title: string;
  projectId: string | null;
  workspaceLabel: string;
};

export type VivaryCodeRecentRun = Pick<CodeAgentRunRecord, "id" | "status" | "title" | "phase"> & {
  projectId: string | null;
};

export type VivaryCodeHostState = {
  activeRun: { id: string; title: string; projectId: string | null } | null;
  pendingApproval: VivaryCodePendingApproval | null;
  recentRun: VivaryCodeRecentRun | null;
  busy: boolean;
};

export type VivaryCodeState = VivaryCodeHostState & {
  projectId: string | null;
  workspaceLabel: string;
  engineLabel: string;
  models: readonly VivaryCodeModel[];
  defaultModel: VivaryCodeModel;
  defaultEngine: VivaryCodeEngine;
  runtime: VivaryRuntimeStatus;
  permissionMode: CodePermissionMode;
  engines: { engine: VivaryCodeEngine; label: string; models: string[]; configured: boolean; runtime: VivaryRuntimeStatus; modelCatalog: CodexModelCatalog | null }[];
  runs: VivaryCodeRunSummary[];
  run: VivaryCodeRunState | null;
  error?: string;
};

export type VivaryCodeFileSummary = {
  path: string;
  name: string;
  sizeBytes: number;
  updatedAt: string;
};

export type VivaryCodeFileState = {
  workspaceLabel: string;
  files: VivaryCodeFileSummary[];
  file: (VivaryCodeFileSummary & { content: string }) | null;
  truncated: boolean;
};

type CodeHostState = {
  activeRuns: Map<string, ActiveRun>;
  initialization: Promise<void> | null;
  closing: boolean;
  shutdown: Promise<void> | null;
};

// Nitro bundles plugins while Native loads action source modules. Both must own
// the same process-local controllers so shutdown can stop runs started by actions.
const codeHostKey = Symbol.for("vivary.workbench.code-host");
const hostProcess = globalThis as typeof globalThis & {
  [codeHostKey]?: CodeHostState;
};
const hostState = hostProcess[codeHostKey] ??= {
  activeRuns: new Map<string, ActiveRun>(),
  initialization: null,
  closing: false,
  shutdown: null,
};
const activeRuns = hostState.activeRuns;
export async function initializeVivaryCodeAgent(): Promise<void> {
  await resolveWorkspace();
  await ensureVivaryCodeHostInitialized();
}

export function shutdownVivaryCodeAgent(): Promise<void> {
  hostState.shutdown ??= stopActiveRunsForShutdown();
  return hostState.shutdown;
}

async function ensureVivaryCodeHostInitialized(): Promise<void> {
  // Production uses one supervised Node process, so persisted active records here
  // can only be leftovers from a prior host process.
  hostState.initialization ??= Promise.resolve().then(() => {
    for (const run of listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID)) {
      if (metadataString(run, "app") !== VIVARY_CODE_APP_MARKER) continue;
      if (run.metadata?.cleanupUnverified === true) hostState.closing = true;

      if (!isActiveCodeAgentRun(run)) continue;
      appendCodeAgentTranscriptEvent({
        runId: run.id,
        kind: "status",
        message: "The previous Vivary code host ended before this run finished.",
        metadata: {
          status: "paused",
          phase: "interrupted",
          reason: "host-restart",
        },
      });
      updateCodeAgentRunRecord(run.id, {
        status: "paused",
        phase: "interrupted",
        needsApproval: false,
        metadata: { pendingLaunch: undefined },
        progress: {
          label: "Interrupted",
          completed: 0,
          total: 1,
          failed: 0,
          percent: 0,
        },
      });
    }
  });
  await hostState.initialization;
}

async function stopActiveRunsForShutdown(): Promise<void> {
  hostState.closing = true;
  const executions: Promise<void>[] = [];
  for (const [runId, activeRun] of activeRuns) {
    if (activeRun.stopReason === null) {
      activeRun.stopReason = "shutdown";
      try {
        recordStoppingRun(
          runId,
          "The Vivary code host is shutting down.",
          "shutdown",
        );
      } finally {
        activeRun.controller.abort();
      }
    }
    if (activeRun.execution) executions.push(activeRun.execution);
  }
  if (executions.length === 0) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SHUTDOWN_WAIT_MS);
  });
  try {
    await Promise.race([Promise.allSettled(executions), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}


export function requireVivaryCodeUser(ctx?: ActionRunContext): string {
  const userEmail = ctx?.userEmail?.trim().toLowerCase();
  if (!userEmail) {
    fail("Vivary could not confirm access to this local workspace. Reload the app.", {
      errorCode: "vivary_code_auth_required",
      statusCode: 401,
    });
  }
  return userEmail;
}

export async function getVivaryCodeHostState(
  ownerEmail: string,
  orgId?: string,
): Promise<VivaryCodeHostState> {
  await ensureVivaryCodeHostInitialized();
  const runs = listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID);
  const owned = runs.filter(run => isOwnedIdentity(run, ownerEmail, orgId));
  const active = owned.find(run => activeRuns.has(run.id));
  const pending = active ? activeRuns.get(active.id)?.requests.values().next().value?.request : undefined;
  const recent = owned.find(run => !activeRuns.has(run.id));
  return {
    activeRun: active ? { id: active.id, title: active.title, projectId: metadataString(active, "projectId") } : null,
    pendingApproval: pending && active ? { ...pending, runId: active.id, title: active.title, projectId: metadataString(active, "projectId"), workspaceLabel: activeRuns.get(active.id)!.workspace.label } : null,
    recentRun: recent ? {
      id: recent.id,
      title: recent.title,
      status: recent.status,
      phase: recent.phase,
      projectId: metadataString(recent, "projectId"),
    } : null,
    busy: activeRuns.size > 0,
  };
}

export async function getVivaryCodeState(
  ownerEmail: string,
  runId?: string,
  selectedWorkspace?: VivaryCodeReadScope,
  orgId?: string,
  modelDiscoveryRoot?: string,
): Promise<VivaryCodeState> {
  const workspace = selectedWorkspace ?? await resolveWorkspace();
  await ensureVivaryCodeHostInitialized();
  const runs = ownedRuns(ownerEmail, orgId, workspace);
  const selected = runId
    ? requireOwnedRun(runId, ownerEmail, orgId, workspace)
    : runs[0] ?? null;

  const engines = await Promise.all(VIVARY_CODE_ENGINES.map(async engine => {
    const runtime = await getVivaryRuntimeStatus(engine);
    const discoveryRoot = "root" in workspace ? workspace.root : modelDiscoveryRoot;
    const modelCatalog = engine === "codex-cli" && runtime.status === "ready" && discoveryRoot
      ? await getCodexModels(discoveryRoot) : null;
    const models = engine === "claude-cli" ? [...VIVARY_CODE_MODELS]
      : modelCatalog?.status === "ready" ? modelCatalog.models.map(model => model.id) : [];
    if (selected && engine === "codex-cli" && engineFromRun(selected) === engine && !models.includes(modelFromRun(selected))) {
      models.push(modelFromRun(selected));
    }
    return { engine, label: engine === "claude-cli" ? "Claude Code" : "Codex", models, modelCatalog,
      configured: runtime.status === "ready" && (engine !== "codex-cli" || modelCatalog?.status === "ready"), runtime };
  }));
  const selectedEngine = selected ? engineFromRun(selected) : VIVARY_CODE_DEFAULT_ENGINE;
  const runtime = await getVivaryRuntimeStatus(selectedEngine);

  return {
    ...await getVivaryCodeHostState(ownerEmail, orgId),
    projectId: workspace.projectId ?? null,
    workspaceLabel: workspace.label,
    defaultEngine: VIVARY_CODE_DEFAULT_ENGINE,
    engines,
    runtime,
    permissionMode: await getCodePermissionMode(ownerEmail, orgId),
    engineLabel: selected ? engineLabelFromRun(selected) : "Claude Code",
    models: VIVARY_CODE_MODELS,
    defaultModel: VIVARY_CODE_DEFAULT_MODEL,
    runs: runs.slice(0, MAX_RUNS).map(toRunSummary),
    run: selected
      ? {
          ...toRunSummary(selected),
          events: dedupeAdjacentAssistantEvents(
            listCodeAgentTranscriptEvents(selected.id),
          ).slice(-MAX_TRANSCRIPT_EVENTS),
        }
      : null,
  };
}

export async function sendVivaryCodeMessage(input: {
  ownerEmail: string;
  orgId?: string;
  message: string;
  model?: string;
  engine?: VivaryCodeEngine;
  runId?: string;
  workspace?: VivaryCodeWorkspace;
  revalidateWorkspace?: () => Promise<VivaryCodeWorkspace | undefined>;
}): Promise<VivaryCodeState> {
  const workspace = input.workspace ?? await resolveWorkspace();
  await ensureVivaryCodeHostInitialized();
  assertCodeHostAvailable();

  const existing = input.runId ? requireOwnedRun(input.runId, input.ownerEmail, input.orgId, workspace) : null;
  const selectedEngine = existing ? engineFromRun(existing) : input.engine ?? VIVARY_CODE_DEFAULT_ENGINE;
  if (input.engine && input.engine !== selectedEngine) {
    fail("Start a new conversation to change coding runtimes.", { errorCode: "vivary_code_engine_changed", statusCode: 409 });
  }
  const runtime = await getVivaryRuntimeStatus(selectedEngine);
  if (runtime.status !== "ready") {
    fail(runtime.message, { errorCode: "vivary_code_runtime_unavailable", statusCode: 503 });
  }
  const catalog = selectedEngine === "codex-cli" ? await getCodexModels(workspace.root) : null;
  if (selectedEngine === "codex-cli" && catalog?.status !== "ready") {
    fail(catalog?.message ?? "Codex models are unavailable. Refresh Runtime settings.", { errorCode: "vivary_code_models_unavailable", statusCode: 503 });
  }
  const supportedModels = catalog?.status === "ready" ? catalog.models.map(model => model.id) : [];
  const recordedModel = existing ? modelFromRun(existing) : undefined;
  if (existing && input.model && input.model !== recordedModel) {
    fail("Start a new conversation to change its model.", { errorCode: "vivary_code_model_changed", statusCode: 409 });
  }
  const selectedModel = resolveVivaryCodeModel(selectedEngine,
    input.model ?? recordedModel ?? (catalog?.status === "ready" ? catalog.defaultModel : undefined),
    recordedModel ? [...supportedModels, recordedModel] : supportedModels);
  if (!existing && selectedEngine === "codex-cli" && selectedModel === "default") {
    fail("Choose a model reported by Codex before starting a conversation.", { errorCode: "vivary_code_model_unsupported", statusCode: 400 });
  }
  const permissionMode = await getCodePermissionMode(input.ownerEmail, input.orgId);
  if (input.revalidateWorkspace) {
    const current = await input.revalidateWorkspace();
    if (!current || !sameWorkspace(current, workspace)) {
      fail("The selected project changed while its runtime was checked. Select it again.", {
        errorCode: "vivary_code_project_changed", statusCode: 409,
      });
    }
  }

  // Claim the host slot synchronously after all runtime and project checks.
  assertCodeHostAvailable();
  const run = existing ?? createCodeAgentRunRecord({
    goalId: VIVARY_CODE_GOAL_ID,
    title: titleFromMessage(input.message),
    status: "queued",
    phase: "queued",
    needsApproval: false,
    permissionMode: "auto-edit",
    cwd: workspace.root,
    metadata: {
      app: VIVARY_CODE_APP_MARKER,
      engine: selectedEngine,
      model: selectedModel === "default" ? null : selectedModel,
      ownerEmail: input.ownerEmail,
      orgId: input.orgId,
      workspaceRoot: workspace.root,
      ...(workspace.projectId ? {
        projectId: workspace.projectId,
        bindingId: workspace.bindingId,
        rootId: workspace.rootId,
        bindingRevision: workspace.bindingRevision,
      } : {}),
      codexPermissionMode: permissionMode,
    },
  });

  const executionMessage = existing && !(selectedEngine === "codex-cli" && metadataString(run, "codexSessionId"))
    ? buildVivaryCodeFollowUpPrompt(listCodeAgentTranscriptEvents(run.id), input.message) : input.message;
  appendCodeAgentTranscriptEvent({ runId: run.id, kind: "user", message: input.message,
    metadata: { source: "vivary-workbench", permissionMode } });
  updateCodeAgentRunRecord(run.id, { status: "queued", phase: "queued", needsApproval: false,
    metadata: { pendingLaunch: undefined, codexPermissionMode: permissionMode } });
  startVivaryCodeRun({ runId: run.id, message: executionMessage, engine: selectedEngine, model: selectedModel,
    ownerEmail: input.ownerEmail, orgId: input.orgId, workspace, permissionMode });
  return getVivaryCodeState(input.ownerEmail, run.id, workspace, input.orgId);
}

export async function approveVivaryCodeMessage(input: {
  ownerEmail: string; orgId?: string; runId: string; requestId: string; workspace?: VivaryCodeWorkspace;
  revalidateWorkspace?: () => Promise<VivaryCodeWorkspace | undefined>;
  answers?: Record<string, string[]>; content?: Record<string, unknown>;
}): Promise<VivaryCodeState> {
  const workspace = input.workspace ?? await resolveWorkspace();
  requireOwnedRun(input.runId, input.ownerEmail, input.orgId, workspace);
  if (input.revalidateWorkspace && !sameWorkspace(await input.revalidateWorkspace() ?? { root: "", label: "" }, workspace)) {
    fail("The selected project changed. Review the request again.", { statusCode: 409 });
  }
  const active = activeRuns.get(input.runId);
  if (!active || !sameWorkspace(workspace, active.workspace)) fail("The project connection changed. Stop this turn and send a new message.", { errorCode: "vivary_code_approval_project_changed", statusCode: 409 });
  return resolveCodexRequest({ ...input, projectId: workspace.projectId }, { allow: true, answers: input.answers, content: input.content });
}

export async function denyVivaryCodeMessage(input: {
  ownerEmail: string; orgId?: string; runId: string; requestId: string; projectId?: string;
}): Promise<VivaryCodeState> {
  return resolveCodexRequest(input, { allow: false });
}

async function resolveCodexRequest(input: {
  ownerEmail: string; orgId?: string; runId: string; requestId: string; projectId?: string;
}, decision: CodexApprovalDecision): Promise<VivaryCodeState> {
  await ensureVivaryCodeHostInitialized();
  const active = activeRuns.get(input.runId);
  const pending = active?.requests.get(input.requestId);
  if (!active || !pending || active.stopReason || active.ownerEmail !== input.ownerEmail
      || active.orgId !== input.orgId || active.workspace.projectId !== input.projectId) {
    fail("This request is no longer current.", { errorCode: "vivary_code_approval_stale", statusCode: 409 });
  }
  let response: Record<string, unknown>;
  try { response = codexApprovalResponse(pending.request, decision); }
  catch (error) { fail(error instanceof Error ? error.message : "Check your response.", { statusCode: 400 }); }
  active.requests.delete(input.requestId);
  appendCodeAgentTranscriptEvent({ runId: input.runId, kind: "status", message: decision.allow ? "Codex request allowed." : "Codex request declined.",
    metadata: { requestId: input.requestId, method: pending.request.method } });
  updateCodeAgentRunRecord(input.runId, { needsApproval: active.requests.size > 0,
    status: active.requests.size ? "needs-approval" : "running", phase: active.requests.size ? "action-approval" : "running" });
  pending.resolve(response);
  return getVivaryCodeState(input.ownerEmail, input.runId, active.workspace, input.orgId);
}

function startVivaryCodeRun(input: {
  runId: string;
  message: string;
  engine: VivaryCodeEngine;
  model: string;
  ownerEmail: string;
  orgId?: string;
  workspace: VivaryCodeWorkspace;
  permissionMode: CodePermissionMode;
}): void {
  const controller = new AbortController();
  const activeRun: ActiveRun = {
    controller,
    execution: null,
    ownerEmail: input.ownerEmail,
    orgId: input.orgId,
    stopReason: null,
    workspace: input.workspace,
    permissionMode: input.permissionMode,
    requests: new Map(),
  };
  activeRuns.set(input.runId, activeRun);
  activeRun.execution = executeVivaryCodeRun({
    activeRun,
    message: input.message,
    model: input.model === "default" ? undefined : input.model,
    runId: input.runId,
  });
  void activeRun.execution.catch(() => undefined);
}

async function executeVivaryCodeRun(input: {
  activeRun: ActiveRun;
  message: string;
  model: string | undefined;
  runId: string;
}): Promise<void> {
  try {
    await executeVivaryCodeWorker({
      runId: input.runId,
      prompt: input.message,
      model: input.model,
      ownerEmail: input.activeRun.ownerEmail,
      orgId: input.activeRun.orgId,
      signal: input.activeRun.controller.signal,
      permissionMode: input.activeRun.permissionMode,
      onRequest: request => {
        if (!supportsCodexRequest(request)) throw new Error("Codex requested an unsupported interaction.");
        if (input.activeRun.controller.signal.aborted) throw new Error("This run is stopping.");
        return new Promise(resolve => {
          input.activeRun.requests.set(request.requestId, { request, resolve });
          updateCodeAgentRunRecord(input.runId, { status: "needs-approval", phase: "action-approval", needsApproval: true });
        });
      },
      onRequestResolved: requestId => {
        const pending = input.activeRun.requests.delete(requestId);
        if (pending && !input.activeRun.controller.signal.aborted && getCodeAgentRunRecord(input.runId)?.phase === "action-approval") updateCodeAgentRunRecord(input.runId, {
          status: input.activeRun.requests.size ? "needs-approval" : "running",
          phase: input.activeRun.requests.size ? "action-approval" : "running", needsApproval: input.activeRun.requests.size > 0 });
      },
    });
    if (input.activeRun.stopReason !== null) {
      recordPausedRun(input.runId, "The local code run stopped.", {
        phase: "paused",
        reason: input.activeRun.stopReason,
      });
    }
  } catch (error) {
    if (error instanceof VivaryCodeWorkerCleanupError) {
      hostState.closing = true;
      appendCodeAgentTranscriptEvent({ runId: input.runId, kind: "status", message: error.message,
        metadata: { status: "errored", phase: "cleanup-unverified" } });
      updateCodeAgentRunRecord(input.runId, { status: "errored", phase: "cleanup-unverified",
        metadata: { cleanupUnverified: true, executionError: error.message } });
      return;
    }
    if (input.activeRun.stopReason !== null) {
      recordPausedRun(input.runId, "The local code run stopped.", {
        phase: "paused",
        reason: input.activeRun.stopReason,
      });
      return;
    }
    const message = safeErrorMessage(error);
    appendCodeAgentTranscriptEvent({
      runId: input.runId,
      kind: "status",
      message: `The local code run failed: ${message}`,
      metadata: { status: "errored", phase: "error" },
    });
    updateCodeAgentRunRecord(input.runId, {
      status: "errored",
      phase: "error",
      metadata: {
        executionError: message,
        executionErroredAt: new Date().toISOString(),
      },
    });
  } finally {
    input.activeRun.requests.clear();
    activeRuns.delete(input.runId);
  }
}

export async function stopVivaryCodeRun(input: {
  ownerEmail: string;
  orgId?: string;
  runId: string;
  projectId?: string;
}): Promise<VivaryCodeState> {
  await ensureVivaryCodeHostInitialized();
  const record = listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).find(run =>
    run.id === input.runId && metadataString(run, "app") === VIVARY_CODE_APP_MARKER
    && metadataString(run, "ownerEmail") === input.ownerEmail
    && metadataString(run, "orgId") === (input.orgId ?? null)
    && metadataString(run, "projectId") === (input.projectId ?? null));
  if (!record) fail("Local Vivary code run not found.", { statusCode: 404 });
  // Cancellation uses the recorded owner and project. A missing folder must not prevent Stop.
  const workspace: VivaryCodeWorkspace = {
    root: record.cwd, label: path.basename(record.cwd),
    projectId: metadataString(record, "projectId") ?? undefined,
    bindingId: metadataString(record, "bindingId") ?? undefined,
    rootId: metadataString(record, "rootId") ?? undefined,
    bindingRevision: metadataNumber(record, "bindingRevision") ?? undefined,
  };

  const activeRun = activeRuns.get(input.runId);
  if (!activeRun || activeRun.ownerEmail !== input.ownerEmail) {
    fail("That local Vivary code run is not active.", {
      errorCode: "vivary_code_run_not_active",
      statusCode: 409,
    });
  }

  if (activeRun.stopReason === null) {
    activeRun.stopReason = "user";
    recordStoppingRun(
      input.runId,
      "Stop requested from the Vivary workbench.",
      "user",
    );
    activeRun.controller.abort();
  }

  return getVivaryCodeState(input.ownerEmail, input.runId, workspace, input.orgId);
}

export async function getVivaryCodeFiles(
  requestedPath?: string,
  selectedWorkspace?: VivaryCodeWorkspace,
): Promise<VivaryCodeFileState> {
  const workspace = selectedWorkspace ?? await resolveWorkspace();
  const files = await listWorkspaceFiles(workspace.root);
  if (!requestedPath) {
    return {
      workspaceLabel: workspace.label,
      files: files.items,
      file: null,
      truncated: files.truncated,
    };
  }

  const file = await readWorkspaceFile(workspace.root, requestedPath);
  return {
    workspaceLabel: workspace.label,
    files: files.items,
    file,
    truncated: files.truncated,
  };
}

function ownedRuns(ownerEmail: string, orgId: string | undefined, scope: VivaryCodeReadScope) {
  return listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).filter(
    (run) => isOwnedRun(run, ownerEmail, orgId, scope),
  );
}

function requireOwnedRun(
  runId: string,
  ownerEmail: string,
  orgId: string | undefined,
  scope: VivaryCodeReadScope,
): CodeAgentRunRecord {
  const run = listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).find(
    (candidate) =>
      candidate.id === runId && isOwnedRun(candidate, ownerEmail, orgId, scope),
  );
  if (!run) {
    fail("Local Vivary code run not found.", {
      errorCode: "vivary_code_run_not_found",
      statusCode: 404,
    });
  }
  return run;
}

export function isVivaryAppRun(
  run: Pick<CodeAgentRunRecord, "goalId" | "cwd" | "metadata">,
  workspace: VivaryCodeWorkspace,
): boolean {
  return (
    run.goalId === VIVARY_CODE_GOAL_ID &&
    run.cwd === workspace.root &&
    metadataString(run, "app") === VIVARY_CODE_APP_MARKER &&
    metadataString(run, "workspaceRoot") === workspace.root &&
    metadataString(run, "projectId") === (workspace.projectId ?? null) &&
    metadataString(run, "bindingId") === (workspace.bindingId ?? null) &&
    metadataString(run, "rootId") === (workspace.rootId ?? null) &&
    metadataNumber(run, "bindingRevision") === (workspace.bindingRevision ?? null)
  );
}

function isVivaryProjectHistoryRun(
  run: Pick<CodeAgentRunRecord, "goalId" | "metadata">,
  project: Pick<VivaryCodeProjectHistory, "projectId" | "bindingId">,
): boolean {
  return run.goalId === VIVARY_CODE_GOAL_ID
    && metadataString(run, "app") === VIVARY_CODE_APP_MARKER
    && metadataString(run, "projectId") === project.projectId
    && metadataString(run, "bindingId") === project.bindingId;
}

function isOwnedRun(
  run: CodeAgentRunRecord,
  ownerEmail: string,
  orgId: string | undefined,
  scope: VivaryCodeReadScope,
): boolean {
  // Reconnection changes the local root epoch, not the saved conversation.
  // Approval still checks the newly staged workspace tuple with sameWorkspace.
  const belongsToScope = "root" in scope
    ? scope.projectId && scope.bindingId
      ? run.cwd === scope.root
        && metadataString(run, "workspaceRoot") === scope.root
        && isVivaryProjectHistoryRun(run, {
          projectId: scope.projectId,
          bindingId: scope.bindingId,
        })
      : isVivaryAppRun(run, scope)
    : isVivaryProjectHistoryRun(run, scope);
  return belongsToScope && isOwnedIdentity(run, ownerEmail, orgId);
}

function isOwnedIdentity(
  run: CodeAgentRunRecord,
  ownerEmail: string,
  orgId?: string,
): boolean {
  return metadataString(run, "app") === VIVARY_CODE_APP_MARKER
    && metadataString(run, "ownerEmail") === ownerEmail
    && metadataString(run, "orgId") === (orgId ?? null);
}

function assertCodeHostAvailable(): void {
  if (hostState.closing) {
    fail("The coding host is stopping or requires process cleanup. Check the latest run before continuing.", {
      errorCode: "vivary_code_host_closing",
      statusCode: 503,
    });
  }
  if (activeRuns.size > 0) {
    fail("A Vivary coding request is active or waiting for approval. Open it, deny it, or stop it.", {
      errorCode: "vivary_code_run_active",
      statusCode: 409,
    });
  }
}

function sameWorkspace(left: VivaryCodeWorkspace, right: VivaryCodeWorkspace): boolean {
  const fields = ["root", "projectId", "bindingId", "rootId", "bindingRevision"] as const;
  return fields.every(field => left[field] === right[field]);
}

function metadataString(run: Pick<CodeAgentRunRecord, "metadata">, key: string): string | null {
  const value = run.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function metadataNumber(run: Pick<CodeAgentRunRecord, "metadata">, key: string): number | null {
  const value = run.metadata?.[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function toRunSummary(run: CodeAgentRunRecord): VivaryCodeRunSummary {
  return {
    id: run.id,
    status: activeRuns.has(run.id) && !isActiveCodeAgentRun(run) ? "running" : run.status,
    title: run.title,
    updatedAt: run.updatedAt,
    engine: engineFromRun(run),
    engineLabel: engineLabelFromRun(run),
    model: modelFromRun(run),
  };
}

function engineLabelFromRun(run: CodeAgentRunRecord): string {
  const engine = metadataString(run, "engine");
  if (engine === "claude-cli") return "Claude Code";
  if (engine === "codex-cli") return "Codex CLI";
  return "Local code agent";
}

function modelFromRun(run: CodeAgentRunRecord): string {
  return metadataString(run, "model")
    ?? (metadataString(run, "engine") === "claude-cli"
      ? VIVARY_CODE_DEFAULT_MODEL
      : "default");
}

function engineFromRun(run: CodeAgentRunRecord): VivaryCodeEngine {
  const engine = metadataString(run, "engine");
  if (engine === "claude-cli" || engine === "codex-cli") return engine;
  fail("This conversation uses an unsupported runtime. Start a new conversation.", {
    errorCode: "vivary_code_historical_engine", statusCode: 409,
  });
}

export function resolveVivaryCodeModel(engine: VivaryCodeEngine, requested?: string, codexModels: readonly string[] = []): string {
  if (engine === "codex-cli") {
    if (!requested || requested === "default") return "default";
    if (codexModels.includes(requested)) return requested;
  } else {
    if (!requested) return VIVARY_CODE_DEFAULT_MODEL;
    if (VIVARY_CODE_MODELS.some(model => model === requested)) return requested;
  }
  fail("Choose a model supported by the selected coding runtime.", {
    errorCode: "vivary_code_model_unsupported", statusCode: 400,
  });
}

function titleFromMessage(message: string): string {
  const firstLine = message.split(/\r?\n/, 1)[0]?.trim() || "Vivary code run";
  return firstLine.length <= 72 ? firstLine : `${firstLine.slice(0, 69)}...`;
}

function recordPausedRun(
  runId: string,
  message: string,
  metadata: Record<string, unknown>,
): void {
  appendCodeAgentTranscriptEvent({
    runId,
    kind: "status",
    message,
    metadata: { status: "paused", ...metadata },
  });
  updateCodeAgentRunRecord(runId, {
    status: "paused",
    phase: typeof metadata.phase === "string" ? metadata.phase : "paused",
    progress: {
      label: "Paused",
      completed: 0,
      total: 1,
      failed: 0,
      percent: 0,
    },
  });
}

function recordStoppingRun(
  runId: string,
  message: string,
  reason: "shutdown" | "user",
): void {
  appendCodeAgentTranscriptEvent({
    runId,
    kind: "status",
    message,
    metadata: { status: "running", phase: "stopping", reason },
  });
  updateCodeAgentRunRecord(runId, {
    status: "running",
    phase: "stopping",
    progress: {
      label: "Stopping",
      completed: 0,
      total: 1,
      percent: 0,
    },
  });
}

export function buildVivaryCodeFollowUpPrompt(
  events: CodeAgentTranscriptEvent[],
  currentMessage: string,
): string {
  const turns = dedupeAdjacentAssistantEvents(events)
    .flatMap((event) => {
      const message = event.message.trim();
      if (!message) return [];
      if (event.kind === "user") return [{ role: "User", message }];
      if (isAssistantEvent(event)) return [{ role: "Assistant", message }];
      return [];
    })
    .slice(-MAX_FOLLOW_UP_EVENTS);
  if (turns.length === 0) return currentMessage;

  const selected: string[] = [];
  let usedChars = 0;
  for (const turn of turns.reverse()) {
    const prefix = `${turn.role}: `;
    const remaining = MAX_FOLLOW_UP_CONTEXT_CHARS - usedChars - prefix.length;
    if (remaining <= 0) break;
    const message = turn.message.slice(
      0,
      Math.min(MAX_FOLLOW_UP_EVENT_CHARS, remaining),
    );
    const rendered = `${prefix}${message}`;
    selected.push(rendered);
    usedChars += rendered.length + 2;
  }

  return [
    "# Previous conversation",
    "This is quoted context from the same Vivary run.",
    "",
    ...selected.reverse(),
    "",
    "# Current request",
    currentMessage,
  ].join("\n");
}

function dedupeAdjacentAssistantEvents(
  events: CodeAgentTranscriptEvent[],
): CodeAgentTranscriptEvent[] {
  const result: CodeAgentTranscriptEvent[] = [];
  for (const event of events) {
    const previous = result.at(-1);
    if (
      previous &&
      isAssistantEvent(previous) &&
      isAssistantEvent(event) &&
      previous.metadata?.phase === event.metadata?.phase &&
      previous.metadata?.itemId === event.metadata?.itemId &&
      previous.message.trim() === event.message.trim()
    ) {
      result[result.length - 1] = event;
      continue;
    }
    result.push(event);
  }
  return result;
}

function isAssistantEvent(event: CodeAgentTranscriptEvent): boolean {
  return event.kind === "system" && event.metadata?.role === "assistant";
}

async function resolveWorkspace(): Promise<VivaryCodeWorkspace> {
  // guard:allow-env-credential - Deployment-level filesystem path for the private preview.
  const configured = process.env.VIVARY_LOCAL_AGENT_WORKSPACE?.trim();
  if (!configured || !path.isAbsolute(configured)) {
    fail("The local Vivary code workspace is not configured.", {
      errorCode: "vivary_code_workspace_unavailable",
      statusCode: 503,
    });
  }

  let root: string;
  try {
    root = await realpath(configured);
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) {
      throw new Error("Configured workspace is not a directory.");
    }
  } catch {
    fail("The configured local Vivary code workspace is unavailable.", {
      errorCode: "vivary_code_workspace_unavailable",
      statusCode: 503,
    });
  }

  return { root, label: path.basename(root) };
}

async function listWorkspaceFiles(
  workspaceRoot: string,
): Promise<{ items: VivaryCodeFileSummary[]; truncated: boolean }> {
  const items: VivaryCodeFileSummary[] = [];
  const pending = [{ directory: workspaceRoot, depth: 0 }];
  let scanned = 0;

  while (pending.length > 0 && items.length < MAX_LISTED_FILES) {
    const next = pending.shift();
    if (!next) break;
    const entries = await readdir(next.directory, { withFileTypes: true });
    for (const entry of entries) {
      scanned += 1;
      if (scanned > MAX_SCANNED_ENTRIES) {
        return { items, truncated: true };
      }
      if (entry.isSymbolicLink()) continue;

      const absolutePath = path.join(next.directory, entry.name);
      if (entry.isDirectory()) {
        if (next.depth < MAX_SCAN_DEPTH) {
          const directoryRoot = await realpath(absolutePath);
          assertContained(workspaceRoot, directoryRoot);
          pending.push({ directory: directoryRoot, depth: next.depth + 1 });
        }
        continue;
      }
      if (!entry.isFile() || !isAllowedFile(absolutePath)) continue;

      const fileStat = await stat(absolutePath);
      if (fileStat.size > MAX_FILE_BYTES) continue;
      items.push({
        path: toPortableRelativePath(workspaceRoot, absolutePath),
        name: entry.name,
        sizeBytes: fileStat.size,
        updatedAt: fileStat.mtime.toISOString(),
      });
      if (items.length >= MAX_LISTED_FILES) break;
    }
  }

  items.sort((left, right) => left.path.localeCompare(right.path));
  return { items, truncated: pending.length > 0 };
}

async function readWorkspaceFile(
  workspaceRoot: string,
  requestedPath: string,
): Promise<VivaryCodeFileSummary & { content: string }> {
  if (path.isAbsolute(requestedPath)) {
    rejectFilePath();
  }
  const candidate = path.resolve(workspaceRoot, requestedPath);
  assertContained(workspaceRoot, candidate);
  if (!isAllowedFile(candidate)) {
    fail("Vivary can display only .md, .txt, and .json files here.", {
      errorCode: "vivary_code_file_type_blocked",
      statusCode: 400,
    });
  }

  let requestedStat: Awaited<ReturnType<typeof lstat>>;
  try {
    requestedStat = await lstat(candidate);
  } catch {
    fail("The requested workspace file was not found.", {
      errorCode: "vivary_code_file_not_found",
      statusCode: 404,
    });
  }
  if (requestedStat.isSymbolicLink()) rejectFilePath();

  const canonical = await realpath(candidate);
  assertContained(workspaceRoot, canonical);

  const fileStat = await stat(canonical);
  if (!fileStat.isFile()) rejectFilePath();
  if (fileStat.size > MAX_FILE_BYTES) {
    fail("The requested workspace file is larger than 64 KB.", {
      errorCode: "vivary_code_file_too_large",
      statusCode: 413,
    });
  }

  return {
    path: toPortableRelativePath(workspaceRoot, canonical),
    name: path.basename(canonical),
    sizeBytes: fileStat.size,
    updatedAt: fileStat.mtime.toISOString(),
    content: await readFile(canonical, "utf8"),
  };
}

function assertContained(workspaceRoot: string, candidate: string): void {
  const relative = path.relative(workspaceRoot, candidate);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    return;
  }
  rejectFilePath();
}

function rejectFilePath(): never {
  fail("The requested path is outside the local Vivary workspace.", {
    errorCode: "vivary_code_file_path_blocked",
    statusCode: 400,
  });
}

function isAllowedFile(filePath: string): boolean {
  return ALLOWED_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function toPortableRelativePath(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join("/");
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Unknown local code agent error.";
}
