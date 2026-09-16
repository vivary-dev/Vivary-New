import { defineAction, fail } from "@agent-native/core/action";
import {
  managedProjectReconnectionPreviewInput,
  managedProjectReconnectionPreviewOutput,
} from "../shared/managed-project-reconnection";
import { previewManagedProjectReconnection } from "../server/managed-project-reconnection.mjs";

export default defineAction({
  description: "Review the changed identity of a recorded managed project folder before reconnection.",
  schema: managedProjectReconnectionPreviewInput,
  outputSchema: managedProjectReconnectionPreviewOutput,
  outputErrorStrategy: "strict",
  requiresAuth: true,
  readOnly: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
  run: async (input, context) => {
    try {
      return await previewManagedProjectReconnection(context, input);
    } catch (error) {
      fail(error instanceof Error ? error.message : "The project cannot be reviewed.", {
        statusCode: typeof error === "object" && error !== null && "statusCode" in error
          && typeof error.statusCode === "number" ? error.statusCode : 409,
      });
    }
  },
});
