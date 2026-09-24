import { createHash } from "node:crypto";

/**
 * The scope id of one project's Native conversations. It excludes labels,
 * paths, and grant revisions, so renaming a project keeps its chats.
 */
export function projectChatScopeId(ownerEmail, orgId, projectId) {
  const key = createHash("sha256")
    .update(JSON.stringify([ownerEmail.trim().toLowerCase(), orgId, projectId])).digest("hex");
  return `vivary-project-chat-v2:${key}`;
}
