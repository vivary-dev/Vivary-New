import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  getVivaryCodeFiles,
  requireVivaryCodeUser,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "List or read small text files from the fixed local Vivary workspace.",
  schema: z.object({
    path: z.string().trim().min(1).max(500).optional(),
  }),
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ path: requestedPath }, ctx?: ActionRunContext) => {
    requireVivaryCodeUser(ctx);
    return getVivaryCodeFiles(requestedPath);
  },
});
