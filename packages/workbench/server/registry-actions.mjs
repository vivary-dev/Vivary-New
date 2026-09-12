/** Internal action composition; no automatic discovery or public transport. */
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { createRegistryStore } from "./registry-store.mjs";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const revision = (minimum) => z.number().int().min(minimum).max(Number.MAX_SAFE_INTEGER);
const resourceKey = z.string().regex(/^[A-Za-z0-9_-]{1,128}:(?:root|checkout|repository):[A-Za-z0-9_-]{1,128}$/);
const displayName = z.string().refine((value) => value.isWellFormed()
  && Array.from(value).length >= 1 && Array.from(value).length <= 200);
const contentIdentity = z.strictObject({
  algorithm: z.literal("sha256"), manifestDigest: z.string().regex(/^[0-9a-f]{64}$/),
}).nullable();
const commonRequest = { operationId: identifier, expectedPolicyRevision: revision(1) };
const registerInput = z.strictObject({
  ...commonRequest, expectedRegistryRevision: revision(0), locationRef: identifier,
  displayName, contentIdentity, attachProjectId: identifier.nullable(),
});
const exportInput = z.strictObject({ ...commonRequest, projectId: identifier });
const mutationInput = z.strictObject({
  ...commonRequest, expectedRegistryRevision: revision(0), bindingId: identifier,
  expectedBindingRevision: revision(1), expectedContentRevision: identifier,
  requestedVcsOwner: z.enum(["git", "jj"]).nullable(),
});
const quarantineInput = z.strictObject({
  operationId: identifier, bindingId: identifier, fence: revision(1),
  expectedPolicyRevision: revision(1), expectedRegistryRevision: revision(0),
});
const refusal = z.strictObject({ code: z.enum([
  "invalid-input", "denied", "stale-policy", "root-unavailable", "not-directory",
  "identity-unverified", "attachment-required", "ambiguous-ownership", "retry-state",
  "allocation-conflict", "operation-conflict", "reconciliation-required",
  "superseded-operation", "binding-unavailable",
]) });
const registerOutput = z.union([refusal, z.strictObject({
  code: z.literal("stale-binding"),
}), z.strictObject({
  code: z.enum(["registered", "already-registered"]), projectId: identifier,
  bindingId: identifier, bindingRevision: revision(1), replayed: z.boolean(),
})]);
const exportOutput = z.union([refusal, z.strictObject({
  code: z.literal("exported"), project: z.strictObject({
    schemaVersion: z.literal(1), projectId: identifier, displayName, contentIdentity,
  }),
})]);
const mutationOutput = z.union([z.strictObject({ code: z.enum([
  "invalid-input", "denied", "stale-policy", "root-unavailable", "not-directory",
  "identity-unverified", "ambiguous-ownership", "retry-state", "operation-conflict",
  "reconciliation-required", "binding-unavailable", "stale-binding", "root-replaced",
  "content-conflict", "read-only", "busy", "stale-fence",
  ]) }), z.strictObject({
  code: z.literal("admitted"), bindingId: identifier,
  keys: z.array(resourceKey).min(1).max(2)
    .refine((keys) => keys.every((key, index) => index === 0 || keys[index - 1] < key)),
  fence: revision(1), ownerOperationId: identifier,
})]);
const quarantineOutput = z.union([z.strictObject({ code: z.enum([
  "admission-unavailable", "denied", "stale-policy", "stale-fence", "invalid-input",
  "retry-state", "reconciliation-required",
]) }), z.strictObject({
  code: z.literal("quarantined"), bindingId: identifier, ownerOperationId: identifier,
  fence: revision(1), replayed: z.boolean(),
})]);

function contextSnapshot(context, actionName) {
  if (!context || typeof context !== "object" || Array.isArray(context)
    || typeof context.userEmail !== "string" || context.userEmail.length === 0
    || typeof context.orgId !== "string" || context.orgId.length === 0
    || typeof context.caller !== "string" || context.caller.length === 0) return undefined;
  const snapshot = { userEmail: context.userEmail, orgId: context.orgId,
    caller: context.caller, actionName };
  for (const field of ["appId", "threadId", "runId", "turnId"]) {
    if (typeof context[field] === "string") snapshot[field] = context[field];
  }
  return Object.freeze(snapshot);
}

/**
 * Trusted application code installs all callbacks. authorizeContext must return
 * exactly true for the authenticated native context. resolveFacts constructs the
 * current policy/root facts; request JSON never supplies authority. Each store
 * receives its own immutable context, with no shared current-user slot.
 */
export function createRegistryActions({
  authorizeContext, resolveFacts, allocateIds, evaluate, deriveMutationKeys,
}) {
  if ([authorizeContext, resolveFacts, allocateIds, evaluate]
    .some((value) => typeof value !== "function")) {
    throw new TypeError("registry actions require trusted authorization, facts, allocation and evaluator");
  }

  function action(operation, schema, outputSchema) {
    const actionName = operation === "register" ? "vivary-register-project"
      : operation === "export" ? "vivary-export-project"
        : operation === "admit-mutation" ? "vivary-admit-project-mutation"
          : "vivary-quarantine-project-mutation";
    const native = defineAction({
      description: operation === "register"
        ? "Register an authorized existing project without changing project files."
        : operation === "export" ? "Export the authorized portable project record."
          : operation === "admit-mutation"
            ? "Reserve the verified project mutation owner without changing project or VCS files."
            : "Mark an exact historical mutation admission uncertain without releasing its keys.",
      schema, outputSchema, outputErrorStrategy: "strict",
      http: false, agentTool: false, mcpTool: false, toolCallable: false,
      readOnly: operation === "export",
      audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
      authorize: async (_request, context) => context !== undefined
        && await authorizeContext(operation, context) === true,
      run: async (request, context) => {
        const store = createRegistryStore({
          resolveFacts: (currentOperation, currentRequest, selectedBinding) =>
            resolveFacts(currentOperation, currentRequest, context, selectedBinding),
          allocateIds: () => allocateIds(context), evaluate, deriveMutationKeys,
        });
        const decision = operation === "register" ? await store.register(request)
          : operation === "export" ? await store.exportProject(request)
            : operation === "admit-mutation" ? await store.admitMutation(request)
              : await store.quarantineMutation(request);
        return decision.output;
      },
    });
    return Object.freeze({
      ...native,
      run: async (request, context) => {
        // Core deliberately coerces gateway string arguments. R1 forbids that
        // at this boundary, so validate with the SAME schema before native run.
        const parsed = schema.safeParse(request);
        if (!parsed.success) {
          const error = new Error("Invalid registry action request");
          error.name = "RegistryActionInputError";
          error.statusCode = 400;
          throw error;
        }
        return native.run(parsed.data, contextSnapshot(context, actionName));
      },
    });
  }

  return Object.freeze({
    register: action("register", registerInput, registerOutput),
    exportProject: action("export", exportInput, exportOutput),
    mutationAdmission: action("admit-mutation", mutationInput, mutationOutput),
    mutationQuarantine: action("quarantine-mutation", quarantineInput, quarantineOutput),
  });
}
