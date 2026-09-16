import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  requireVivaryCodeUser,
  stopVivaryCodeRun,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "Stop the local workspace owner's active local Vivary code run.",
  schema: z.object({
    projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
    runId: z.string().trim().min(1).max(128),
  }),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ runId, projectId }, ctx?: ActionRunContext) =>
    stopVivaryCodeRun({
      ownerEmail: requireVivaryCodeUser(ctx),
      orgId: ctx?.orgId ?? undefined,
      projectId,
      runId,
    }),
});
