import { createHash } from "node:crypto";
import { vivaryChatScope, type VivaryChatIdentity } from "../app/lib/chat-scope";

/** Identity excludes mutable labels, paths and grant revisions. Native still owns access and messages. */
export function createVivaryChatIdentity(
  ownerEmail: string,
  orgId: string,
  target: { kind: "unassigned" } | { kind: "project"; projectId: string | null; label: string },
): VivaryChatIdentity {
  const owner = ownerEmail.trim().toLowerCase();
  const legacyScope = vivaryChatScope(orgId);
  if (!owner || !legacyScope) throw new Error("The conversation owner could not be verified.");
  if (target.kind === "unassigned") {
    return { kind: "unassigned", projectId: null, scope: legacyScope,
      storageKey: `vivary-workbench-chat-v1:${encodeURIComponent(JSON.stringify([owner, orgId]))}` };
  }
  if (target.projectId !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(target.projectId)) {
    throw new Error("Choose a registered project.");
  }
  const key = createHash("sha256").update(JSON.stringify([owner, orgId, target.projectId])).digest("hex");
  return { kind: "project", projectId: target.projectId,
    scope: { type: "workspace-app", id: `vivary-project-chat-v2:${key}`, label: target.label },
    storageKey: `vivary-project-chat-v2:${key}` };
}
