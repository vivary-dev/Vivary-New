import { fail, type ActionRunContext } from "@agent-native/core/action";
import type { AgentChatPluginOptions, RequestRunContext } from "@agent-native/core/server";
import {
  getRequestOrgId,
  getRequestRunContext,
} from "@agent-native/core/server";
import { createError } from "h3";
import { createVivaryChatIdentity } from "./chat-identity";
import {
  admitChatProject,
  getLocalProjectAccess,
  resolveLocalProjectWorkspace,
} from "./project-services.mjs";

const PROJECT_SCOPE_PREFIX = "vivary-project-chat-v2:";

type PrepareRequestDetails = Parameters<
  NonNullable<AgentChatPluginOptions["prepareRequest"]>
>[0];

type ProjectCatalogRecord = {
  projectId: string;
  displayName: string;
};

type ChatProjectRecord = { projectId: string; displayName: string };

type NativeChatProjectDependencies = {
  getScope: () => RequestRunContext["chatScope"];
  getOrgId: () => string | undefined;
  getProjectAccess: (context: ActionRunContext) => Promise<unknown>;
  resolveProjectWorkspace: (
    context: ActionRunContext,
    projectId: string,
  ) => Promise<unknown>;
  admitChatProject: (
    context: ActionRunContext,
    isChatProject: (project: ChatProjectRecord) => boolean,
  ) => Promise<{ projectId: string; context: ActionRunContext } | null>;
};

const defaultDependencies: NativeChatProjectDependencies = {
  getScope: () => getRequestRunContext()?.chatScope,
  getOrgId: getRequestOrgId,
  getProjectAccess: getLocalProjectAccess,
  resolveProjectWorkspace: resolveLocalProjectWorkspace,
  admitChatProject,
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

function catalogProjects(value: unknown): ProjectCatalogRecord[] | null {
  if (!value || typeof value !== "object" || !("code" in value) || value.code !== "catalog"
      || !("projects" in value) || !Array.isArray(value.projects)) {
    return null;
  }
  const records: ProjectCatalogRecord[] = [];
  for (const project of value.projects) {
    if (!project || typeof project !== "object"
        || !("projectId" in project) || typeof project.projectId !== "string"
        || !("displayName" in project) || typeof project.displayName !== "string") {
      return null;
    }
    records.push({ projectId: project.projectId, displayName: project.displayName });
  }
  return records;
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
// The send guard reads the catalog as the owner's HTTP request. A tool call
// asks project services to admit it for the one matching project, and stays
// a tool call.
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
  const isChatProject = (project: ChatProjectRecord) => createVivaryChatIdentity(ownerEmail, orgId, {
    kind: "project",
    projectId: project.projectId,
    label: project.displayName,
  }).scope.id === requestedScopeId;
  let match: { projectId: string; context: ActionRunContext } | null;
  try {
    if (identity.caller === "tool") {
      match = await dependencies.admitChatProject(context, isChatProject);
    } else {
      const projects = catalogProjects(await dependencies.getProjectAccess(context));
      if (!projects) {
        throw projectConversationError(403, "Project conversation access is unavailable.");
      }
      const project = projects.find(isChatProject);
      match = project ? { projectId: project.projectId, context } : null;
    }
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
