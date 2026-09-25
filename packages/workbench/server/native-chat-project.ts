import { fail, type ActionRunContext } from "@agent-native/core/action";
import type { AgentChatPluginOptions } from "@agent-native/core/server";
import { getRequestOrgId } from "@agent-native/core/server";
import { createError } from "h3";
import {
  matchChatProject,
  resolveLocalProjectWorkspace,
  type ChatScopeMatch,
} from "./project-services.mjs";

type PrepareRequestDetails = Parameters<
  NonNullable<AgentChatPluginOptions["prepareRequest"]>
>[0];

type NativeChatProjectDependencies = {
  getOrgId: () => string | undefined;
  /** Classifies the chat scope of the current request. See project services. */
  matchChatProject: (context: ActionRunContext) => Promise<ChatScopeMatch>;
  resolveProjectWorkspace: (
    context: ActionRunContext,
    projectId: string,
  ) => Promise<unknown>;
};

const defaultDependencies: NativeChatProjectDependencies = {
  getOrgId: getRequestOrgId,
  matchChatProject,
  resolveProjectWorkspace: resolveLocalProjectWorkspace,
};

function projectConversationError(statusCode: number, statusMessage: string): Error {
  return createError({ statusCode, statusMessage });
}

function preserveAuthorizationError(error: unknown): void {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return;
  if (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 503) {
    throw error;
  }
}

// Project services classify the scope Native pinned to this request. Native
// consumed the request body before either caller runs. The context keeps the
// caller that asked: the send guard runs inside an HTTP request, and a tool
// call stays a tool call.
async function matchChatScope(
  dependencies: NativeChatProjectDependencies,
  identity: { owner: string | null | undefined; orgId: string | null | undefined; caller: "http" | "tool";
    signal?: AbortSignal },
): Promise<Exclude<ChatScopeMatch, { kind: "unmatched" }>> {
  const context: ActionRunContext = {
    caller: identity.caller,
    userEmail: identity.owner?.trim().toLowerCase(),
    orgId: identity.orgId,
    appId: "workbench",
    ...(identity.signal ? { signal: identity.signal } : {}),
  };
  let match: ChatScopeMatch;
  try {
    match = await dependencies.matchChatProject(context);
  } catch (error) {
    preserveAuthorizationError(error);
    throw projectConversationError(409, "Project conversation access is unavailable.");
  }
  if (match.kind === "unmatched") {
    throw projectConversationError(403, "Project conversation access is unavailable.");
  }
  return match;
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
      await dependencies.resolveProjectWorkspace(match.context, match.projectId);
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
): (context: ActionRunContext | undefined) => Promise<{ projectId: string; projectContext: ActionRunContext }> {
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
    return { projectId: match.projectId, projectContext: match.context };
  };
}

export const resolveNativeChatProject = createVivaryNativeChatProjectResolver();
