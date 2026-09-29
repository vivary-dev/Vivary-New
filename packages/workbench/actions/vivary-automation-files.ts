import { defineAction, fail, type ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import { listAutomationFilesForReview, reviewAutomationFile } from "../server/automation-file-review.ts";

// Issue #109. Only a signed-in person reviews a file an automation run wrote, never an agent, so no chat, MCP client,
// or run can accept instructions on the owner's behalf. `updatedAt` and `runId` name the version the list showed.
const reviewed = {
  id: z.string().min(1).max(200),
  updatedAt: z.number().int().nonnegative(),
  runId: z.string().max(300).nullable(),
};
export default defineAction({
  description: "List, accept, or delete the instruction and memory files that automation runs wrote and that wait for "
    + "the owner's review.",
  schema: z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("list") }).strict(),
    z.object({ operation: z.literal("accept"), ...reviewed }).strict(),
    z.object({ operation: z.literal("delete"), ...reviewed }).strict(),
  ]),
  requiresAuth: true, agentTool: false, mcpTool: false, toolCallable: false,
  run: async (input, ctx?: ActionRunContext) => {
    const userEmail = ctx?.userEmail;
    if (!userEmail) fail("Sign in again to review automation files.", { statusCode: 401 });
    const viewer = { userEmail, orgId: ctx?.orgId ?? null };
    if (input.operation === "list") return { files: await listAutomationFilesForReview(viewer) };
    await reviewAutomationFile(viewer, input);
    return input.operation === "accept" ? { accepted: true } : { deleted: true };
  },
});
