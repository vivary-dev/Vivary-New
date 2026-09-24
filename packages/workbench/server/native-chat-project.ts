import { fail, type ActionRunContext } from "@agent-native/core/action";
import type { AgentChatPluginOptions, RequestRunContext } from "@agent-native/core/server";
import {
  getRequestOrgId,
  getRequestRunContext,
} from "@agent-native/core/server";
import { createError } from "h3";
import { createVivaryChatIdentity } from "./chat-identity";
import {
  matchChatProject,
  resolveLocalProjectWorkspace,
} from "./project-services.mjs";

const PROJECT_SCOPE_PREFIX = "vivary-project-chat-v2:";

type PrepareRequestDetails = Parameters<
  NonNullable<AgentChatPluginOptions["prepareRequest"]>
>[0];

type NativeChatProjectDependencies = {
  getScope: () => RequestRunContext["chatScope"];
  getOrgId: () => string | undefined;
  matchChatProject: (
    context: ActionRunContext,
    scopeId: string,
  ) => Promise<{ projectId: string; context: ActionRunContext } | null>;
  resolveProjectWorkspace: (
    context: ActionRunContext,
    projectId: string,
  ) => Promise<unknown>;
};

const defaultDependencies: NativeChatProjectDependencies = {
  getScope: () => getRequestRunContext()?.chatScope,
  getOrgId: getRequestOrgId,
  matchChatProject,
  resolveProjectWorkspace: resolveLocalProjectWorkspace,
};

function projectConversationError(statusCode: number, statusMessage: string): Error {
  return createError({ statusCode, statusMessage });
}

function projectScopeId(scope: RequestRunContext["chatScope"]): string | null {
  if (!scope?.id.startsWith(PROJECT_SCOPE_PREFIX)) return null;
  if (scope.type !== "workspace-app") {
    throw projectConversationError(403, "Project conversation access is unavailable.");
  }
  return scope.id;
}

function preserveAuthorizationError(error: unknown): void {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return;
  if (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 503) {
    throw error;
  }
}

type ChatScopeMatch =
  | { kind: "not-project" }
  | { kind: "personal" }
  | { kind: "project"; projectId: string; ownerContext: ActionRunContext };

// Matches the pinned scope to the owner's current catalog. Native consumed
// the request body before either caller runs and already normalized its scope.
// The context keeps the caller that asked: the send guard runs inside an HTTP
// request, and a tool call stays a tool call.
async function matchChatScope(
  dependencies: NativeChatProjectDependencies,
  identity: { owner: string | null | undefined; orgId: string | null | undefined; caller: "http" | "tool";
    signal?: AbortSignal },
): Promise<ChatScopeMatch> {
  const requestedScopeId = projectScopeId(dependencies.getScope());
  if (!requestedScopeId) return { kind: "not-project" };

  const ownerEmail = identity.owner?.trim().toLowerCase();
  const orgId = identity.orgId;
  if (!ownerEmail || !orgId) {
    throw projectConversationError(403, "Project conversation access is unavailable.");
  }

  const personal = createVivaryChatIdentity(ownerEmail, orgId, {
    kind: "project",
    projectId: null,
    label: "Personal workspace",
  });
  if (requestedScopeId === personal.scope.id) return { kind: "personal" };

  const context: ActionRunContext = {
    caller: identity.caller,
    userEmail: ownerEmail,
    orgId,
    appId: "workbench",
    ...(identity.signal ? { signal: identity.signal } : {}),
  };
  let match: { projectId: string; context: ActionRunContext } | null;
  try {
    match = await dependencies.matchChatProject(context, requestedScopeId);
  } catch (error) {
    preserveAuthorizationError(error);
    throw projectConversationError(409, "Project conversation access is unavailable.");
  }
  if (!match) {
    throw projectConversationError(403, "Project conversation access is unavailable.");
  }
  return { kind: "project", projectId: match.projectId, ownerContext: match.context };
}

/**
 * Revalidate v2 project-scoped Native sends before any model or attachment work.
 * Other scopes retain Agent-Native's existing behavior, including legacy v1 chats.
 */
export function createVivaryNativeChatProjectGuard(
  dependencies: NativeChatProjectDependencies = defaultDependencies,
): (details: PrepareRequestDetails) => Promise<void> {
  return async details => {
    const match = await matchChatScope(dependencies,
      { owner: details.ownerEmail, orgId: dependencies.getOrgId(), caller: "http" });
    if (match.kind !== "project") return;
    try {
      await dependencies.resolveProjectWorkspace(match.ownerContext, match.projectId);
    } catch (error) {
      preserveAuthorizationError(error);
      throw projectConversationError(
        409,
        "This project folder is unavailable. Reconnect it from Projects.",
      );
    }
  };
}

export const prepareVivaryNativeChatProject =
  createVivaryNativeChatProjectGuard();

/**
 * The project a Native tool call acts on comes only from its chat's pinned
 * scope, never from tool input. The returned context is the one project
 * services admitted for that project. It stays a tool call.
 */
export function createVivaryNativeChatProjectResolver(
  dependencies: NativeChatProjectDependencies = defaultDependencies,
): (context: ActionRunContext | undefined) => Promise<{ projectId: string; ownerContext: ActionRunContext }> {
  return async context => {
    const match = context?.caller === "tool"
      ? await matchChatScope(dependencies,
        { owner: context.userEmail, orgId: context.orgId, caller: "tool", signal: context.signal })
      : { kind: "not-project" as const };
    if (match.kind !== "project") {
      fail("Open this chat from a project to use project tools.", {
        errorCode: "vivary_project_read_scope",
        statusCode: 409,
      });
    }
    return { projectId: match.projectId, ownerContext: match.ownerContext };
  };
}

export const resolveNativeChatProject = createVivaryNativeChatProjectResolver();
