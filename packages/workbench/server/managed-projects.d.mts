import type { ActionRunContext } from "@agent-native/core/action";

export type ManagedProjectFile = {
  path: string;
  content: string;
  bytes: number;
  sha256: string;
};

export type ManagedProjectPreview = {
  code: "preview";
  plan: {
    schema: "vivary.thin-init-plan/v1";
    target: string;
    preset: string;
    adapters: string[];
    active_context: string | null;
    files: ManagedProjectFile[];
    content_sha256: string;
    plan_sha256: string;
  };
};

export function previewManagedProject(
  context: ActionRunContext | undefined,
  input: { name: string },
  dependencies?: Record<string, unknown>,
): Promise<ManagedProjectPreview>;

export function createManagedProject(
  context: ActionRunContext | undefined,
  input: { name: string; displayName?: string; acceptedPlanSha256: string },
  dependencies?: Record<string, unknown>,
): Promise<
  | { code: "plan-changed" }
  | {
      code: "created" | "already-created";
      target: string;
      planSha256: string;
      registration: Record<string, unknown>;
    }
>;
