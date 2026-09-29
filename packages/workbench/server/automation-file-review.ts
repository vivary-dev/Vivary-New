import { fail } from "@agent-native/core/action";
import { getDbExec } from "@agent-native/core/db";
import {
  SHARED_OWNER,
  isPendingRunReview,
  organizationResourceOwner,
  resourceAcceptRunReviewIfCurrent,
  resourceDeleteIfCurrent,
  resourceGet,
  resourceList,
  resourceRunReview,
  type Resource,
} from "@agent-native/core/resources/store";

// Issue #109. An instruction or memory file that an automation run wrote waits in Core's resource store with a
// pending review mark, and no chat or run loads it. Settings > Automation files lists those files for the owner, who
// accepts or deletes each one. The rules for who may review a file mirror who may edit it in Core's Resources routes.

export type AutomationFileViewer = { userEmail: string; orgId: string | null };
export type AutomationFileScope = "personal" | "organization" | "app-default";
export type AutomationFileForReview = {
  id: string;
  path: string;
  scope: AutomationFileScope;
  runId: string | null;
  automation: string | null;
  writtenAt: number;
  updatedAt: number;
  /** An edit after the run's write, which the owner reviews along with the run's text. */
  changedAfterRun: boolean;
  content: string;
  canReview: boolean;
  reviewNote?: string;
};
export type AutomationFileReviewInput = {
  operation: "accept" | "delete";
  id: string;
  /** The update time the list showed, so a write since then refuses the review. */
  updatedAt: number;
  /** The run whose write the list showed. */
  runId: string | null;
};

const ORGANIZATION_REVIEW_NOTE = "Only organization owners and admins can review organization files.";
const CHANGED = "This file changed. Reload the list.";
const GONE = "This file is no longer waiting for review. Reload the list.";

type ReviewAccess = { scope: AutomationFileScope; canReview: boolean; reviewNote?: string };

// The same query as Core's getOrgRoleForEmail, which its package entries do not export.
async function organizationRole(orgId: string, email: string): Promise<string | null> {
  try {
    const { rows } = await getDbExec().execute({
      sql: "SELECT role FROM org_members WHERE org_id = ? AND LOWER(email) = ? LIMIT 1",
      args: [orgId, email.toLowerCase()],
    });
    const role = rows[0]?.role;
    return typeof role === "string" ? role : null;
  } catch {
    // No organization tables means no membership, as in Core.
    return null;
  }
}

/**
 * Who sees and reviews a row, or null when the viewer may not see it. A personal file is its owner's. An organization
 * file is visible to its members, and an app default file to everyone signed in. Either takes an organization owner or
 * admin to review, and with no active organization anyone may review the app default, as Core's assertCanEditShared
 * lets anyone edit it.
 */
function reviewAccess(owner: string, viewer: AutomationFileViewer, role: string | null): ReviewAccess | null {
  if (owner === viewer.userEmail) return { scope: "personal", canReview: true };
  const manager = role === "owner" || role === "admin";
  if (viewer.orgId && owner === organizationResourceOwner(viewer.orgId)) {
    return manager ? { scope: "organization", canReview: true }
      : { scope: "organization", canReview: false, reviewNote: ORGANIZATION_REVIEW_NOTE };
  }
  if (owner === SHARED_OWNER) {
    return !viewer.orgId || manager ? { scope: "app-default", canReview: true }
      : { scope: "app-default", canReview: false, reviewNote: ORGANIZATION_REVIEW_NOTE };
  }
  return null;
}

function viewerOwners(viewer: AutomationFileViewer): string[] {
  return [viewer.userEmail, ...(viewer.orgId ? [organizationResourceOwner(viewer.orgId)] : []), SHARED_OWNER];
}

export async function listAutomationFilesForReview(viewer: AutomationFileViewer): Promise<AutomationFileForReview[]> {
  const role = viewer.orgId ? await organizationRole(viewer.orgId, viewer.userEmail) : null;
  // Agent scratch rows are listed too: a run can write an instruction file as scratch, and the owner decides on it.
  const rows = (await Promise.all(viewerOwners(viewer).map(owner =>
    resourceList(owner, undefined, { includeAgentScratch: true, orgId: viewer.orgId })))).flat();
  const files: AutomationFileForReview[] = [];
  for (const row of rows.filter(isPendingRunReview)) {
    const access = reviewAccess(row.owner, viewer, role);
    const resource = access ? await resourceGet(row.id, { orgId: viewer.orgId }) : null;
    const review = resourceRunReview(resource);
    if (!access || !resource || !review) continue;
    files.push({
      id: resource.id,
      path: resource.path,
      scope: access.scope,
      runId: review.runId ?? null,
      automation: review.automation ?? null,
      writtenAt: review.writtenAt,
      updatedAt: resource.updatedAt,
      changedAfterRun: resource.updatedAt > review.writtenAt,
      content: resource.content,
      canReview: access.canReview,
      ...(access.reviewNote ? { reviewNote: access.reviewNote } : {}),
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path) || a.scope.localeCompare(b.scope));
}

/**
 * Accept or delete one listed file. Both act only on the version the list showed: the store's accept compares the
 * update time and the run, and the delete compares the whole row with that update time, so a write in between
 * refuses the review and changes nothing.
 */
export async function reviewAutomationFile(viewer: AutomationFileViewer, input: AutomationFileReviewInput): Promise<void> {
  const resource: Resource | null = await resourceGet(input.id, { orgId: viewer.orgId });
  const role = viewer.orgId ? await organizationRole(viewer.orgId, viewer.userEmail) : null;
  const access = resource && isPendingRunReview(resource) ? reviewAccess(resource.owner, viewer, role) : null;
  if (!resource || !access) fail(GONE, { statusCode: 404 });
  if (!access.canReview) fail(access.reviewNote ?? ORGANIZATION_REVIEW_NOTE, { statusCode: 403 });
  if (input.operation === "accept") {
    const accepted = await resourceAcceptRunReviewIfCurrent({
      id: resource.id, owner: resource.owner, path: resource.path,
      updatedAt: input.updatedAt, runId: input.runId, acceptedBy: viewer.userEmail,
    });
    if (!accepted) fail(CHANGED, { statusCode: 409 });
    return;
  }
  if ((resourceRunReview(resource)?.runId ?? null) !== input.runId) fail(CHANGED, { statusCode: 409 });
  if (!(await resourceDeleteIfCurrent({ ...resource, updatedAt: input.updatedAt }))) fail(CHANGED, { statusCode: 409 });
}
