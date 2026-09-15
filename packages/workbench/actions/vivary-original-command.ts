import { defineAction } from "@agent-native/core/action";
import { originalCommandSchema, runOriginalCommand } from "../server/original-runtime";

export default defineAction({
  description: "Run one bounded original Vivary command in an authorized registered project. Decide and control evaluate submitted evidence; they do not authorize or start agent work.",
  schema: originalCommandSchema,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
  run: (input, context) => runOriginalCommand(input, context),
});
