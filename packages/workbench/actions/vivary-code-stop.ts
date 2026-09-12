import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  requireVivaryCodeUser,
  stopVivaryCodeRun,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "Stop the signed-in user's active local Vivary code run.",
  schema: z.object({
    runId: z.string().trim().min(1).max(128),
  }),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ runId }, ctx?: ActionRunContext) =>
    stopVivaryCodeRun({
      ownerEmail: requireVivaryCodeUser(ctx),
      runId,
    }),
});
