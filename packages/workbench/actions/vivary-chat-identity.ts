import { defineAction, fail, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { createVivaryChatIdentity } from "../server/chat-identity";
import { requireVivaryCodeUser } from "../server/local-code-agent";
import { resolveVivaryCodeProjectHistory } from "../server/code-project";

export default defineAction({
  description: "Resolve the current owner's project conversation identity without reading project files.",
  schema: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("project"), projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }).strict(),
    z.object({ kind: z.literal("unassigned") }).strict(),
  ]),
  http: { method: "GET" }, readOnly: true, requiresAuth: true,
  agentTool: false, mcpTool: false, toolCallable: false,
  run: async (input, ctx?: ActionRunContext) => {
    const owner = requireVivaryCodeUser(ctx);
    const orgId = ctx?.orgId;
    if (!orgId) fail("The conversation owner could not be verified.", { statusCode: 403 });
    if (input.kind === "unassigned") return createVivaryChatIdentity(owner, orgId, input);
    const project = await resolveVivaryCodeProjectHistory(ctx, input.projectId);
    return createVivaryChatIdentity(owner, orgId, { kind: "project",
      projectId: project?.projectId ?? null, label: project?.label ?? "Personal workspace" });
  },
});
