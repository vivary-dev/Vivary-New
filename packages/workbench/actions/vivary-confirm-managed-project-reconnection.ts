import { defineAction, fail } from "@agent-native/core/action";
import {
  managedProjectReconnectionConfirmInput,
  managedProjectReconnectionResultOutput,
} from "../shared/managed-project-reconnection";
import { confirmManagedProjectReconnection } from "../server/managed-project-reconnection.mjs";

export default defineAction({
  description: "Confirm the exact reviewed managed project identity replacement while preserving its project and chat history.",
  schema: managedProjectReconnectionConfirmInput,
  outputSchema: managedProjectReconnectionResultOutput,
  outputErrorStrategy: "strict",
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
  run: async (input, context) => {
    try {
      return await confirmManagedProjectReconnection(context, input);
    } catch (error) {
      fail(error instanceof Error ? error.message : "The project could not be reconnected.", {
        statusCode: typeof error === "object" && error !== null && "statusCode" in error
          && typeof error.statusCode === "number" ? error.statusCode : 409,
      });
    }
  },
});
