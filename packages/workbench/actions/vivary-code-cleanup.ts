import { defineAction, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import {
  requireVivaryCodeUser,
  resolveVivaryCodeCleanup,
} from "../server/local-code-agent.ts";

// Issue #121. Only a signed-in person decides, never an agent, so no run can lift the refusal its own leftovers caused.
export default defineAction({
  description: "Continue past coding processes that outlived an earlier run, on the local workspace owner's word.",
  schema: z.object({ decision: z.enum(["continue"]) }).strict(),
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: async ({ decision }, ctx?: ActionRunContext) =>
    resolveVivaryCodeCleanup({
      ownerEmail: requireVivaryCodeUser(ctx),
      orgId: ctx?.orgId ?? undefined,
      decision,
    }),
});
