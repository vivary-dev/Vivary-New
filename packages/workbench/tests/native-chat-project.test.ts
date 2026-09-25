import assert from "node:assert/strict";
import test from "node:test";
import type { ActionRunContext } from "@agent-native/core/action";
import { runWithRequestContext, type AgentChatPluginOptions } from "@agent-native/core/server";
import { projectChatScopeId } from "../server/chat-project-scope.mjs";
import { createVivaryNativeChatProjectGuard, prepareVivaryNativeChatProject } from "../server/native-chat-project";
import type { ChatScopeMatch } from "../server/project-services.mjs";

type PrepareDetails = Parameters<
  NonNullable<AgentChatPluginOptions["prepareRequest"]>
>[0];

const ownerEmail = "owner@example.test";
const orgId = "org-a";

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

// Project services classify the request's scope. The guard only acts on the
// classification, so these tests hand it one and count workspace reads.
function guardFor(
  match: ChatScopeMatch | Error,
  resolveProjectWorkspace: (context: ActionRunContext, projectId: string) => Promise<unknown> = async () => ({}),
) {
  const asked: ActionRunContext[] = [];
  const guard = createVivaryNativeChatProjectGuard({
    getOrgId: () => orgId,
    matchChatProject: async context => {
      asked.push(context);
      if (match instanceof Error) throw match;
      return match;
    },
    resolveProjectWorkspace,
  });
  return { guard, asked };
}

test("a chat outside any project, and Personal, pass without a workspace read", async () => {
  for (const match of [{ kind: "not-project" }, { kind: "personal" }] satisfies ChatScopeMatch[]) {
    let workspaceReads = 0;
    const { guard } = guardFor(match, async () => { workspaceReads += 1; return {}; });
    await guard(details());
    assert.equal(workspaceReads, 0, match.kind);
  }
});

test("a project chat reopens its workspace with the context project services returned", async () => {
  const projectContext: ActionRunContext = { caller: "http", userEmail: ownerEmail, orgId, appId: "workbench" };
  let resolved: [ActionRunContext, string] | null = null;
  const { guard, asked } = guardFor({ kind: "project", projectId: "project-a", context: projectContext },
    async (context, projectId) => { resolved = [context, projectId]; return {}; });
  await guard({ ...details(), ownerEmail: " OWNER@example.test " });
  assert.deepEqual(asked, [{ caller: "http", userEmail: ownerEmail, orgId, appId: "workbench" }]);
  assert.deepEqual(resolved, [projectContext, "project-a"]);
});

test("a refused classification stops before any workspace read", async () => {
  const refused = Object.assign(new Error("refused"), { statusCode: 403 });
  let workspaceReads = 0;
  const count = async () => { workspaceReads += 1; return {}; };
  await assert.rejects(guardFor(refused, count).guard(details()), error => error === refused);
  await assert.rejects(guardFor(new Error("catalog"), count).guard(details()), { statusCode: 409 });
  assert.equal(workspaceReads, 0);
});

test("fails closed when project access is revoked or its folder is missing", async () => {
  const project: ChatScopeMatch = { kind: "project", projectId: "project-a",
    context: { caller: "http", userEmail: ownerEmail, orgId, appId: "workbench" } };
  const revoked = Object.assign(new Error("revoked"), { statusCode: 403 });
  await assert.rejects(
    guardFor(project, async () => { throw revoked; }).guard(details()),
    error => error === revoked,
  );
  await assert.rejects(
    guardFor(project, async () => { throw new Error("missing"); }).guard(details()),
    {
      statusCode: 409,
      statusMessage: "This project folder is unavailable. Reconnect it from Projects.",
    },
  );
});

test("uses Native's parsed scope after its HTTP body has been consumed", async () => {
  let bodyReads = 0;
  const event = { get req() { bodyReads += 1; throw new Error("The request body was already consumed."); } };
  const personal = { type: "workspace-app" as const, id: projectChatScopeId(ownerEmail, orgId, null) };
  await runWithRequestContext({ userEmail: ownerEmail, orgId, run: { chatScope: personal } },
    () => prepareVivaryNativeChatProject({ ...details(), event }));
  assert.equal(bodyReads, 0);
});
