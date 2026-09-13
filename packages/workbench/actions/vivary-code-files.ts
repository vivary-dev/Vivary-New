import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";
import { resolveVivaryCodeProject } from "../server/code-project";

import {
  getVivaryCodeFiles,
  requireVivaryCodeUser,
} from "../server/local-code-agent.ts";

export default defineAction({
  description: "List or read small text files from the selected local Vivary project.",
  schema: z.object({
    projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
    path: z.string().trim().min(1).max(500).optional(),
  }),
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ path: requestedPath, projectId }, ctx?: ActionRunContext) => {
    requireVivaryCodeUser(ctx);
    return getVivaryCodeFiles(requestedPath, await resolveVivaryCodeProject(ctx, projectId));
  },
});
