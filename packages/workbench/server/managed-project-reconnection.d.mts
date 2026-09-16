import type { ActionRunContext } from "@agent-native/core/action";
import type {
  ManagedProjectReconnectionPreview,
  ManagedProjectReconnectionResult,
} from "../shared/managed-project-reconnection";

export function previewManagedProjectReconnection(
  context: ActionRunContext | undefined,
  input: { projectId: string },
): Promise<ManagedProjectReconnectionPreview>;

export function confirmManagedProjectReconnection(
  context: ActionRunContext | undefined,
  input: {
    projectId: string;
    operationId: string;
    acceptedPlanSha256: string;
  },
): Promise<ManagedProjectReconnectionResult>;
