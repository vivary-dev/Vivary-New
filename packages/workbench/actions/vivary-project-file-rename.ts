import { defineAction, type ActionRunContext } from "@agent-native/core/action";

import { projectFileRenameInputSchema } from "../app/lib/project-file-schema.ts";
import { projectFileService } from "../server/project-files.ts";

export default defineAction({
  description: "Rename one bounded text file within its current project directory after an exact version check.",
  schema: projectFileRenameInputSchema,
  readOnly: false,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: (input, context?: ActionRunContext) => projectFileService.rename(context, input),
});
