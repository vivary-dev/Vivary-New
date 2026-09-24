import assert from "node:assert/strict";
import test from "node:test";
import type { ActionRunContext } from "@agent-native/core/action";
import { runWithRequestContext, type AgentChatPluginOptions, type RequestRunContext } from "@agent-native/core/server";
import { createVivaryChatIdentity } from "../server/chat-identity";
import { createVivaryNativeChatProjectGuard, prepareVivaryNativeChatProject } from "../server/native-chat-project";

type PrepareDetails = Parameters<
  NonNullable<AgentChatPluginOptions["prepareRequest"]>
>[0];

const ownerEmail = "owner@example.test";
const orgId = "org-a";
const project = {
  projectId: "project-a",
  displayName: "Project A",
  bindingRevision: 1,
  status: "available",
};

function details(): PrepareDetails {
  return {
    event: {},
    ownerEmail,
    message: "Continue.",
    attachments: [],
    references: [],
    mode: "act",
  };
}

function projectScope(projectId: string | null, label = "Project A") {
  return createVivaryChatIdentity(ownerEmail, orgId, {
    kind: "project",
    projectId,
    label,
  }).scope;
}

// The one project in the catalog, matched by its chat scope id as project services do.
async function matchCatalog(context: ActionRunContext, scopeId: string) {
  return scopeId === projectScope(project.projectId).id ? { projectId: project.projectId, context } : null;
}

function guardFor(
  scope: RequestRunContext["chatScope"],
  overrides: Partial<{
    getOrgId: () => string | undefined;
    matchChatProject: (context: ActionRunContext, scopeId: string) =>
      Promise<{ projectId: string; context: ActionRunContext } | null>;
    resolveProjectWorkspace: (
      context: ActionRunContext,
      projectId: string,
    ) => Promise<unknown>;
  }> = {},
) {
  return createVivaryNativeChatProjectGuard({
    getScope: () => scope,
    getOrgId: overrides.getOrgId ?? (() => orgId),
    // Project services read the request's pinned scope themselves.
    matchChatProject: context => (overrides.matchChatProject ?? matchCatalog)(context, scope?.id ?? ""),
    resolveProjectWorkspace: overrides.resolveProjectWorkspace
      ?? (async () => ({ projectId: project.projectId })),
  });
}

test("preserves legacy, unscoped, and unrelated Native chat behavior", async () => {
  let projectReads = 0;
  const passThrough = async (scope: RequestRunContext["chatScope"]) => {
    const guard = guardFor(scope, {
      matchChatProject: async (context, scopeId) => {
        projectReads += 1;
        return matchCatalog(context, scopeId);
      },
    });
    await guard(details());
  };

  await passThrough(undefined);
  await passThrough({
    type: "workspace-app",
    id: `${"vivary-workbench-chat-v1"}:${orgId}`,
  });
  await passThrough({ type: "workspace-app", id: "another-app:scope" });
  assert.equal(projectReads, 0);
});

test("accepts Personal only through its explicit actor and organization identity", async () => {
  let projectReads = 0;
  await guardFor(projectScope(null), {
    matchChatProject: async (context, scopeId) => {
      projectReads += 1;
      return matchCatalog(context, scopeId);
    },
  })(details());
  assert.equal(projectReads, 0);

  await assert.rejects(
    guardFor(projectScope(null), { getOrgId: () => "org-b" })(details()),
    { statusCode: 403 },
  );
});

test("matches a v2 scope against the current catalog and reopens its workspace", async () => {
  let receivedContext: ActionRunContext | null = null;
  let resolvedProjectId: string | null = null;
  const guard = guardFor(projectScope(project.projectId), {
    matchChatProject: async (context, scopeId) => {
      receivedContext = context;
      return matchCatalog(context, scopeId);
    },
    resolveProjectWorkspace: async (context, projectId) => {
      assert.deepEqual(context, receivedContext);
      resolvedProjectId = projectId;
      return { projectId };
    },
  });

  await guard({ ...details(), ownerEmail: " OWNER@example.test " });
  assert.deepEqual(receivedContext, {
    caller: "http",
    userEmail: ownerEmail,
    orgId,
    appId: "workbench",
  });
  assert.equal(resolvedProjectId, project.projectId);
});

test("rejects forged v2 ids and wrong scope types before workspace resolution", async () => {
  let workspaceReads = 0;
  const forged = {
    type: "workspace-app",
    id: `vivary-project-chat-v2:${"0".repeat(64)}`,
  };
  const wrongType = {
    ...projectScope(project.projectId),
    type: "desktop-app",
  };
  for (const scope of [forged, wrongType]) {
    await assert.rejects(
      guardFor(scope, {
        resolveProjectWorkspace: async () => {
          workspaceReads += 1;
          return {};
        },
      })(details()),
      { statusCode: 403 },
    );
  }
  assert.equal(workspaceReads, 0);
});

test("fails closed when project access is revoked or its folder is missing", async () => {
  const revoked = Object.assign(new Error("revoked"), { statusCode: 403 });
  await assert.rejects(
    guardFor(projectScope(project.projectId), {
      resolveProjectWorkspace: async () => {
        throw revoked;
      },
    })(details()),
    error => error === revoked,
  );

  await assert.rejects(
    guardFor(projectScope(project.projectId), {
      resolveProjectWorkspace: async () => {
        throw new Error("missing");
      },
    })(details()),
    {
      statusCode: 409,
      statusMessage: "This project folder is unavailable. Reconnect it from Projects.",
    },
  );
});


test("uses Native's parsed scope after its HTTP body has been consumed", async () => {
  let bodyReads = 0;
  const event = { get req() { bodyReads += 1; throw new Error("The request body was already consumed."); } };
  await runWithRequestContext({ userEmail: ownerEmail, orgId, run: { chatScope: projectScope(null) } },
    () => prepareVivaryNativeChatProject({ ...details(), event }));
  assert.equal(bodyReads, 0);
});
