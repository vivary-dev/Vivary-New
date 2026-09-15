import { defineAction } from "@agent-native/core/action";
import { originalCommandSchema, runOriginalCommand } from "../server/original-runtime";

export default defineAction({
  description: "Preview or evaluate one bounded original Vivary command in an authorized registered project. Create is always dry-run and adopt is preview-only; decide and control evaluate submitted evidence without authorizing agent work.",
  schema: originalCommandSchema,
  requiresAuth: true,
  agentTool: false,
  mcpTool: false,
  toolCallable: false,
  audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
  run: (input, context) => runOriginalCommand(input, context),
});
