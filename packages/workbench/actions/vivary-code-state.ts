import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  getVivaryCodeState,
  requireVivaryCodeUser,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "Read the signed-in user's local Vivary code runs and transcript.",
  schema: z.object({
    runId: z.string().trim().min(1).max(128).optional(),
  }),
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ runId }, ctx?: ActionRunContext) =>
    getVivaryCodeState(requireVivaryCodeUser(ctx), runId),
});
