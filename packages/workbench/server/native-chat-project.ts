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

// Project services refuse with a 401, 403, or 503 and a fixed sentence.
function accessRefusal(error: unknown): { statusCode: 401 | 403 | 503; message: string } | null {
  if (!(error instanceof Error) || !("statusCode" in error)) return null;
  const { statusCode } = error;
  return statusCode === 401 || statusCode === 403 || statusCode === 503 ? { statusCode, message: error.message } : null;
}

// The send guard is the HTTP boundary: an error must leave it as an h3 error,
// or h3 answers 500. A refusal keeps its status and sentence, and anything
// else is the caller's 409.
function conversationError(error: unknown, fallback: string): Error {
  const refusal = accessRefusal(error);
  return refusal ? createError({ statusCode: refusal.statusCode, statusMessage: refusal.message, cause: error })
    : projectConversationError(409, fallback);
}

// Project services classify the scope Native pinned to this request. Native
// consumed the request body before either caller runs. The context keeps the
// caller that asked: the send guard runs inside an HTTP request, and a tool
// call stays a tool call.
async function matchChatScope(
  dependencies: NativeChatProjectDependencies,
  identity: { owner: string | null | undefined; orgId: string | null | undefined; caller: "http" | "tool";
    signal?: AbortSignal },
): Promise<ChatScopeMatch> {
  const context: ActionRunContext = {
    caller: identity.caller,
    userEmail: identity.owner?.trim().toLowerCase(),
    orgId: identity.orgId,
    appId: "workbench",
    ...(identity.signal ? { signal: identity.signal } : {}),
  };
  return dependencies.matchChatProject(context);
}

/**
 * Revalidate v2 project-scoped Native sends before any model or attachment work.
 * Other scopes retain Agent-Native's existing behavior, including legacy v1 chats.
 */
export function createVivaryNativeChatProjectGuard(
  dependencies: NativeChatProjectDependencies = defaultDependencies,
): (details: PrepareRequestDetails) => Promise<void> {
  return async details => {
    let match: ChatScopeMatch;
    try {
      match = await matchChatScope(dependencies,
        { owner: details.ownerEmail, orgId: dependencies.getOrgId(), caller: "http" });
    } catch (error) {
      throw conversationError(error, "Project conversation access is unavailable.");
    }
    if (match.kind !== "project") return;
    try {
      await dependencies.resolveProjectWorkspace(match.context, match.projectId);
    } catch (error) {
      throw conversationError(error, "This project folder is unavailable. Reconnect it from Projects.");
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
    let match: ChatScopeMatch = { kind: "not-project" };
    try {
      if (context?.caller === "tool") {
        match = await matchChatScope(dependencies,
          { owner: context.userEmail, orgId: context.orgId, caller: "tool", signal: context.signal });
      }
    } catch (error) {
      // A tool call reports a refusal the way its other refusals do.
      const refusal = accessRefusal(error);
      fail(refusal?.message ?? "Project conversation access is unavailable.", {
        errorCode: "vivary_project_read_access",
        statusCode: refusal?.statusCode ?? 409,
      });
    }
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
