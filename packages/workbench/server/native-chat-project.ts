import type { ActionRunContext } from "@agent-native/core/action";
import type { AgentChatPluginOptions, RequestRunContext } from "@agent-native/core/server";
import {
  getRequestOrgId,
  getRequestRunContext,
} from "@agent-native/core/server";
import { createError } from "h3";
import { createVivaryChatIdentity } from "./chat-identity";
import {
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

type NativeChatProjectDependencies = {
  getScope: () => RequestRunContext["chatScope"];
  getOrgId: () => string | undefined;
  getProjectAccess: (context: ActionRunContext) => Promise<unknown>;
  resolveProjectWorkspace: (
    context: ActionRunContext,
    projectId: string,
  ) => Promise<unknown>;
};

const defaultDependencies: NativeChatProjectDependencies = {
  getScope: () => getRequestRunContext()?.chatScope,
  getOrgId: getRequestOrgId,
  getProjectAccess: getLocalProjectAccess,
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

/**
 * Revalidate v2 project-scoped Native sends before any model or attachment work.
 * Other scopes retain Agent-Native's existing behavior, including legacy v1 chats.
 */
export function createVivaryNativeChatProjectGuard(
  dependencies: NativeChatProjectDependencies = defaultDependencies,
): (details: PrepareRequestDetails) => Promise<void> {
  return async details => {
    // Native consumed the body before this hook and already normalized its scope.
    const requestedScopeId = projectScopeId(dependencies.getScope());
    if (!requestedScopeId) return;

    const ownerEmail = details.ownerEmail?.trim().toLowerCase();
    const orgId = dependencies.getOrgId();
    if (!ownerEmail || !orgId) {
      throw projectConversationError(403, "Project conversation access is unavailable.");
    }

    const personal = createVivaryChatIdentity(ownerEmail, orgId, {
      kind: "project",
      projectId: null,
      label: "Personal workspace",
    });
    if (requestedScopeId === personal.scope.id) return;

    const context: ActionRunContext = {
      caller: "http",
      userEmail: ownerEmail,
      orgId,
      appId: "workbench",
    };
    let projects: ProjectCatalogRecord[] | null;
    try {
      projects = catalogProjects(await dependencies.getProjectAccess(context));
    } catch (error) {
      preserveAuthorizationError(error);
      throw projectConversationError(409, "Project conversation access is unavailable.");
    }
    if (!projects) {
      throw projectConversationError(403, "Project conversation access is unavailable.");
    }

    const project = projects.find(candidate =>
      createVivaryChatIdentity(ownerEmail, orgId, {
        kind: "project",
        projectId: candidate.projectId,
        label: candidate.displayName,
      }).scope.id === requestedScopeId,
    );
    if (!project) {
      throw projectConversationError(403, "Project conversation access is unavailable.");
    }

    try {
      await dependencies.resolveProjectWorkspace(context, project.projectId);
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
