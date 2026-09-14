import { defineAction, type ActionRunContext } from "@agent-native/core/action";

import { projectFilesInputSchema } from "../app/lib/project-file-schema.ts";
import { projectFileService } from "../server/project-files.ts";

export default defineAction({
  description: "List or read bounded text files from one selected registered local project.",
  schema: projectFilesInputSchema,
  http: { method: "GET" },
  readOnly: true,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  run: ({ projectId, path }, context?: ActionRunContext) =>
    projectFileService.get(context, projectId, path),
});
