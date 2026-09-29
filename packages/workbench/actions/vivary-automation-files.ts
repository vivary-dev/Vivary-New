import { defineAction, fail, type ActionRunContext } from "@agent-native/core/action";
import {
  isPendingRunReview,
  resourceAcceptRunReviewIfCurrent,
  resourceDeleteIfCurrent,
  resourceGet,
  resourceList,
} from "@agent-native/core/resources/store";
import { z } from "zod";

export type AutomationFile = { id: string; path: string; content: string; updatedAt: number };

// Issue #109. An instruction or memory file an automation run wrote waits in Core's resource store with a pending
// review mark, and no chat or run loads it. A run cannot write shared or organization instruction files, so every
// waiting file is its owner's personal file. Only the signed-in owner accepts or deletes one, never an agent, so no
// chat, MCP client, or run can call this action. `updatedAt` names the version the list showed.
const reviewed = { id: z.string().min(1).max(200), updatedAt: z.number().int().nonnegative() };
export default defineAction({
  description: "List, accept, or delete the owner's instruction and memory files that automation runs wrote and that "
    + "wait for review.",
  schema: z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("list") }).strict(),
    z.object({ operation: z.literal("accept"), ...reviewed }).strict(),
    z.object({ operation: z.literal("delete"), ...reviewed }).strict(),
  ]),
  requiresAuth: true, agentTool: false, mcpTool: false, toolCallable: false,
  run: async (input, ctx?: ActionRunContext) => {
    const owner = ctx?.userEmail;
    if (!owner) fail("Sign in again to review automation files.", { statusCode: 401 });
    if (input.operation === "list") {
      // Agent scratch rows too, because a run can write an instruction file as scratch.
      const waiting = (await resourceList(owner, undefined, { includeAgentScratch: true })).filter(isPendingRunReview);
      const files: AutomationFile[] = [];
      for (const row of waiting) {
        const resource = await resourceGet(row.id);
        if (resource) files.push({ id: resource.id, path: resource.path, content: resource.content, updatedAt: resource.updatedAt });
      }
      return { files: files.sort((a, b) => a.path.localeCompare(b.path)) };
    }
    const resource = await resourceGet(input.id);
    if (!resource || resource.owner !== owner || !isPendingRunReview(resource)) {
      fail("This file is no longer waiting for review. Reload the list.", { statusCode: 404 });
    }
    // Both change the file only while it has the update time the list showed, so a write since then changes nothing.
    const done = input.operation === "accept"
      ? await resourceAcceptRunReviewIfCurrent({ id: resource.id, updatedAt: input.updatedAt, acceptedBy: owner })
      : await resourceDeleteIfCurrent({ ...resource, updatedAt: input.updatedAt });
    if (!done) fail("This file changed. Reload the list.", { statusCode: 409 });
    return input.operation === "accept" ? { accepted: true } : { deleted: true };
  },
});
