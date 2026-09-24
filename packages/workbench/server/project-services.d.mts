import type { ActionRunContext } from "@agent-native/core/action";
import type { CatalogResult, RegistrationResult } from "../app/lib/project-catalog-schema";

export type LocalProjectWorkspace = Readonly<{
  root: string;
  actorId: string;
  label: string;
  projectId: string;
  bindingId: string;
  bindingRevision: number;
  policyRevision: number;
  rootId: string;
  locationRef: string;
  verificationKind: "local-stat-revalidated-v1";
}>;

export type LocalProjectHistory = Readonly<Pick<
  LocalProjectWorkspace,
  "label" | "projectId" | "bindingId" | "rootId" | "bindingRevision"
>>;

/**
 * A Native tool call's context after the chat resolver matched its pinned
 * scope. Project services admit it only for that project.
 */
export type ChatProjectContext = ActionRunContext & { chatProjectId: string };

export function getLocalProjectAccess(context: ActionRunContext | undefined): Promise<CatalogResult>;
export function connectLocalProjectFolder(
  context: ActionRunContext | undefined,
  folder: string,
  displayName?: string,
): Promise<RegistrationResult & { locationRef: string; displayName: string }>;
export function resolveLocalProjectHistory(
  context: ActionRunContext | undefined,
  projectId: string,
): Promise<LocalProjectHistory>;
export function resolveLocalProjectWorkspace(
  context: ActionRunContext | undefined,
  projectId: string,
): Promise<LocalProjectWorkspace>;
