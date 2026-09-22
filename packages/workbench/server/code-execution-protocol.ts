import { isCodePermissionMode, type CodePermissionMode } from "./code-permissions";

export type VivaryCodeWorkerRequest = {
  type: "vivary:code-worker:start";
  runId: string;
  prompt: string;
  model?: string;
  permissionMode?: CodePermissionMode;
  ownerEmail: string;
  orgId?: string;
};

export function isVivaryCodeWorkerRequest(value: unknown): value is VivaryCodeWorkerRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.some(key => !["type", "runId", "prompt", "model", "permissionMode", "ownerEmail", "orgId"].includes(key))) return false;
  return "type" in value && value.type === "vivary:code-worker:start"
    && "runId" in value && typeof value.runId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value.runId)
    && "prompt" in value && typeof value.prompt === "string" && value.prompt.length > 0 && value.prompt.length <= 64_000
    && "ownerEmail" in value && typeof value.ownerEmail === "string" && value.ownerEmail.length > 0 && value.ownerEmail.length <= 320
    && (!("permissionMode" in value) || value.permissionMode === undefined || isCodePermissionMode(value.permissionMode))
    && (!("model" in value) || value.model === undefined || typeof value.model === "string" && value.model.length <= 128)
    && (!("orgId" in value) || value.orgId === undefined || typeof value.orgId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value.orgId));
}

export type CodexActionRequest = { requestId: string; method: string; params: Record<string, unknown> };
export function isCodexActionRequest(value: unknown): value is CodexActionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "requestId" in value && typeof value.requestId === "string" && value.requestId.length <= 128
    && "method" in value && typeof value.method === "string" && value.method.length <= 128
    && "params" in value && !!value.params && typeof value.params === "object" && !Array.isArray(value.params);
}
