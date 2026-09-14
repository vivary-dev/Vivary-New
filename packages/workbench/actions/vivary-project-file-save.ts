import { defineAction, type ActionRunContext } from "@agent-native/core/action";

import { projectFileSaveInputSchema } from "../app/lib/project-file-schema.ts";
import { projectFileService } from "../server/project-files.ts";

export default defineAction({
  description: "Save one bounded text file after checking its project and exact prior version.",
  schema: projectFileSaveInputSchema,
  readOnly: false,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: (input, context?: ActionRunContext) => projectFileService.save(context, input),
});
