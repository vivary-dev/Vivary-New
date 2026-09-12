import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  requireVivaryCodeUser,
  sendVivaryCodeMessage,
  VIVARY_CODE_MODELS,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "Start or continue the signed-in user's local Vivary code run.",
  schema: z.object({
    message: z.string().trim().min(1).max(8_000),
    model: z.enum(VIVARY_CODE_MODELS).optional(),
    runId: z.string().trim().min(1).max(128).optional(),
  }),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ message, model, runId }, ctx?: ActionRunContext) =>
    sendVivaryCodeMessage({
      ownerEmail: requireVivaryCodeUser(ctx),
      message,
      model,
      runId,
    }),
});
