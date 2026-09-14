import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { resolveVivaryCodeProject } from "../server/code-project";

import {
  approveVivaryCodeMessage,
  requireVivaryCodeUser,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "Approve one exact pending Vivary coding request.",
  schema: z.object({
    projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
    runId: z.string().trim().min(1).max(128),
    requestId: z.string().uuid(),
  }).strict(),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ runId, requestId, projectId }, ctx?: ActionRunContext) => {
    const workspace = await resolveVivaryCodeProject(ctx, projectId);
    return approveVivaryCodeMessage({
      ownerEmail: requireVivaryCodeUser(ctx),
      orgId: ctx?.orgId ?? undefined,
      runId,
      requestId,
      workspace,
      revalidateWorkspace: projectId
        ? () => resolveVivaryCodeProject(ctx, projectId)
        : undefined,
    });
  },
});
