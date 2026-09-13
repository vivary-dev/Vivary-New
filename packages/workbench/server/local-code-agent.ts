import { lstat, realpath, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { fail, type ActionRunContext } from "@agent-native/core/action";
import {
  appendCodeAgentTranscriptEvent,
  createCodeAgentRunRecord,
  isActiveCodeAgentRun,
  listCodeAgentRunRecords,
  listCodeAgentTranscriptEvents,
  updateCodeAgentRunRecord,
  type CodeAgentRunRecord,
  type CodeAgentTranscriptEvent,
} from "@agent-native/core/code-agents";

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
const RUN_TIMEOUT_MS = 120_000;
const SHUTDOWN_WAIT_MS = 10_000;
const ALLOWED_FILE_EXTENSIONS = new Set([".json", ".md", ".txt"]);

type ActiveRun = {
  controller: AbortController;
  ownerEmail: string;
  orgId?: string;
  execution: Promise<void> | null;
  stopReason: "shutdown" | "timeout" | "user" | null;
  timeout: ReturnType<typeof setTimeout>;
};

export type VivaryCodeRunSummary = Pick<
  CodeAgentRunRecord,
  "id" | "status" | "title"
> & {
  engine: VivaryCodeEngine;
  engineLabel: string;
  model: string;
};

export type VivaryCodeRunState = VivaryCodeRunSummary & {
  events: CodeAgentTranscriptEvent[];
};

export type VivaryCodeWorkspace = Readonly<{
  root: string;
  label: string;
  projectId?: string;
  bindingId?: string;
  rootId?: string;
  bindingRevision?: number;
}>;

export type VivaryCodeHostState = {
  activeRun: { id: string; title: string; projectId: string | null } | null;
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
  engines: { engine: VivaryCodeEngine; label: string; models: string[]; configured: boolean; runtime: VivaryRuntimeStatus }[];
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

export async function getVivaryCodeHostState(ownerEmail: string): Promise<VivaryCodeHostState> {
  await ensureVivaryCodeHostInitialized();
  const active = listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).find(run =>
    activeRuns.has(run.id) && metadataString(run, "app") === VIVARY_CODE_APP_MARKER
    && metadataString(run, "ownerEmail") === ownerEmail);
  return {
    activeRun: active ? { id: active.id, title: active.title, projectId: metadataString(active, "projectId") } : null,
    busy: activeRuns.size > 0,
  };
}

export async function getVivaryCodeState(
  ownerEmail: string,
  runId?: string,
  selectedWorkspace?: VivaryCodeWorkspace,
): Promise<VivaryCodeState> {
  const workspace = selectedWorkspace ?? await resolveWorkspace();
  await ensureVivaryCodeHostInitialized();
  const runs = ownedRuns(ownerEmail, workspace);
  const selected = runId
    ? requireOwnedRun(runId, ownerEmail, workspace)
    : runs[0] ?? null;

  const engines = await Promise.all(VIVARY_CODE_ENGINES.map(async engine => {
    const runtime = await getVivaryRuntimeStatus(engine);
    return { engine, label: engine === "claude-cli" ? "Claude Code" : "Codex",
      models: engine === "claude-cli" ? [...VIVARY_CODE_MODELS] : ["default"],
      configured: runtime.status === "ready", runtime };
  }));
  const selectedEngine = selected ? engineFromRun(selected) : VIVARY_CODE_DEFAULT_ENGINE;
  const runtime = await getVivaryRuntimeStatus(selectedEngine);

  return {
    ...await getVivaryCodeHostState(ownerEmail),
    projectId: workspace.projectId ?? null,
    workspaceLabel: workspace.label,
    defaultEngine: VIVARY_CODE_DEFAULT_ENGINE,
    engines,
    runtime,
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
  if (hostState.closing) {
    fail("The coding host is stopping or requires process cleanup. Check the latest run before continuing.", {
      errorCode: "vivary_code_host_closing",
      statusCode: 503,
    });
  }
  if (activeRuns.size > 0) {
    fail("A local Vivary code run is already active. Wait for it or stop it.", {
      errorCode: "vivary_code_run_active",
      statusCode: 409,
    });
  }
  const existing = input.runId ? requireOwnedRun(input.runId, input.ownerEmail, workspace) : null;
  const selectedEngine = existing ? engineFromRun(existing) : input.engine ?? VIVARY_CODE_DEFAULT_ENGINE;
  if (input.engine && input.engine !== selectedEngine) {
    fail("Start a new conversation to change coding runtimes.", { errorCode: "vivary_code_engine_changed", statusCode: 409 });
  }
  const selectedModel = resolveVivaryCodeModel(selectedEngine, input.model ?? (existing ? modelFromRun(existing) : undefined));
  const runtime = await getVivaryRuntimeStatus(selectedEngine);
  if (runtime.status !== "ready") {
    fail(runtime.message, { errorCode: "vivary_code_runtime_unavailable", statusCode: 503 });
  }
  if (input.revalidateWorkspace) {
    const current = await input.revalidateWorkspace();
    const fields = ["root", "projectId", "bindingId", "rootId", "bindingRevision"] as const;
    if (!current || fields.some(field => current[field] !== workspace[field])) {
      fail("The selected project changed while its runtime was checked. Select it again.", {
        errorCode: "vivary_code_project_changed", statusCode: 409,
      });
    }
  }
  // Readiness is asynchronous. Recheck admission before creating a run.
  if (hostState.closing || activeRuns.size > 0) {
    fail("The coding runtime is busy or shutting down. Wait for it or stop the active run.", {
      errorCode: "vivary_code_run_active", statusCode: 409,
    });
  }
  const run = existing ?? createCodeAgentRunRecord({
        goalId: VIVARY_CODE_GOAL_ID,
        title: titleFromMessage(input.message),
        status: "queued",
        phase: "queued",
        permissionMode: "auto-edit",
        cwd: workspace.root,
        metadata: {
          app: VIVARY_CODE_APP_MARKER,
          engine: selectedEngine,
          model: selectedEngine === "claude-cli" ? selectedModel : null,
          ownerEmail: input.ownerEmail,
          orgId: input.orgId,
          workspaceRoot: workspace.root,
          ...(workspace.projectId ? {
            projectId: workspace.projectId,
            bindingId: workspace.bindingId,
            rootId: workspace.rootId,
            bindingRevision: workspace.bindingRevision,
          } : {}),
        },
      });

  if (existing) {
    updateCodeAgentRunRecord(run.id, { status: "queued", phase: "queued",
      metadata: { model: selectedEngine === "claude-cli" ? selectedModel : null } });
  }

  const executionMessage = input.runId
    ? buildVivaryCodeFollowUpPrompt(
        listCodeAgentTranscriptEvents(run.id),
        input.message,
      )
    : input.message;

  appendCodeAgentTranscriptEvent({
    runId: run.id,
    kind: "user",
    message: input.message,
    metadata: { source: "vivary-workbench" },
  });

  const controller = new AbortController();
  const activeRun: ActiveRun = {
    controller,
    execution: null,
    ownerEmail: input.ownerEmail,
    orgId: input.orgId,
    stopReason: null,
    timeout: setTimeout(() => {
      if (activeRun.stopReason !== null) return;
      activeRun.stopReason = "timeout";
      recordStoppingRun(
        run.id,
        "The local code run reached its 120 second limit and is stopping.",
        "timeout",
      );
      controller.abort();
    }, RUN_TIMEOUT_MS),
  };
  activeRuns.set(run.id, activeRun);

  activeRun.execution = executeVivaryCodeRun({
    activeRun,
    message: executionMessage,
    model: selectedEngine === "claude-cli" ? selectedModel : undefined,
    runId: run.id,
  });
  void activeRun.execution.catch(() => undefined);

  return getVivaryCodeState(input.ownerEmail, run.id, workspace);
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
    });
    if (input.activeRun.stopReason !== null) {
      const timedOut = input.activeRun.stopReason === "timeout";
      recordPausedRun(input.runId, timedOut
        ? "The local code run stopped after reaching its 120 second limit."
        : "The local code run stopped.", {
        phase: timedOut ? "timeout" : "paused",
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
      const timedOut = input.activeRun.stopReason === "timeout";
      recordPausedRun(input.runId, timedOut
        ? "The local code run stopped after reaching its 120 second limit."
        : "The local code run stopped.", {
        phase: timedOut ? "timeout" : "paused",
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
    clearTimeout(input.activeRun.timeout);
    activeRuns.delete(input.runId);
  }
}

export async function stopVivaryCodeRun(input: {
  ownerEmail: string;
  runId: string;
  projectId?: string;
}): Promise<VivaryCodeState> {
  await ensureVivaryCodeHostInitialized();
  const record = listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).find(run =>
    run.id === input.runId && metadataString(run, "app") === VIVARY_CODE_APP_MARKER
    && metadataString(run, "ownerEmail") === input.ownerEmail
    && metadataString(run, "projectId") === (input.projectId ?? null));
  if (!record) fail("Local Vivary code run not found.", { statusCode: 404 });
  // Cancellation uses the recorded owner and project. A missing folder must not prevent Stop.
  const workspace: VivaryCodeWorkspace = {
    root: record.cwd, label: path.basename(record.cwd),
    projectId: metadataString(record, "projectId") ?? undefined,
    bindingId: metadataString(record, "bindingId") ?? undefined,
    rootId: metadataString(record, "rootId") ?? undefined,
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

  return getVivaryCodeState(input.ownerEmail, input.runId, workspace);
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

function ownedRuns(ownerEmail: string, workspace: VivaryCodeWorkspace) {
  return listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).filter(
    (run) => isOwnedRun(run, ownerEmail, workspace),
  );
}

function requireOwnedRun(
  runId: string,
  ownerEmail: string,
  workspace: VivaryCodeWorkspace,
): CodeAgentRunRecord {
  const run = listCodeAgentRunRecords(VIVARY_CODE_GOAL_ID).find(
    (candidate) =>
      candidate.id === runId && isOwnedRun(candidate, ownerEmail, workspace),
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
    metadataString(run, "rootId") === (workspace.rootId ?? null)
  );
}

function isOwnedRun(
  run: CodeAgentRunRecord,
  ownerEmail: string,
  workspace: VivaryCodeWorkspace,
): boolean {
  return (
    isVivaryAppRun(run, workspace) &&
    metadataString(run, "ownerEmail") === ownerEmail
  );
}

function metadataString(run: Pick<CodeAgentRunRecord, "metadata">, key: string): string | null {
  const value = run.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function toRunSummary(run: CodeAgentRunRecord): VivaryCodeRunSummary {
  return {
    id: run.id,
    status: activeRuns.has(run.id) && !isActiveCodeAgentRun(run) ? "running" : run.status,
    title: run.title,
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
  if (metadataString(run, "engine") === "codex-cli") return "default";
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

export function resolveVivaryCodeModel(engine: VivaryCodeEngine, requested?: string): string {
  if (engine === "codex-cli") {
    if (!requested || requested === "default") return "default";
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
  reason: "shutdown" | "timeout" | "user",
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
