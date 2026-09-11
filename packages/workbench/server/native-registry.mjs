/** Native request authentication, current app capability and private root custody. */
import { createHash, randomUUID } from "node:crypto";
import { defineAppRoles, getOrgContext } from "@agent-native/core/org";
import { getSession } from "@agent-native/core/server";
import { z } from "zod";
import { createRegistryActions } from "./registry-actions.mjs";
import { mountRegistryHttp } from "./registry-http.mjs";

const access = defineAppRoles({ appId: "workbench",
  roles: ["project-registrar", "project-mutator"] });
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const grantSchema = z.strictObject({ orgId: identifier, collectionId: identifier,
  policyRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  locationRefs: z.array(identifier).min(1).max(16)
    .refine((refs) => new Set(refs).size === refs.length),
});
const noVcs = () => ({ kind: "none", repositoryId: null, checkoutId: null, mutationOwner: null });
const actorId = (context) => "actor_" + createHash("sha256")
  .update(context.orgId + "\0" + context.userEmail.trim().toLowerCase()).digest("hex");

/**
 * An immutable installation grant references native org membership; it is not a
 * second member roster. Changing this root scope requires a new owner. Native
 * role removal takes effect at every resolver boundary in the current owner.
 */
export function createNativeRegistry({ provider, grant, evaluate, deriveMutationKeys }) {
  const scope = grantSchema.parse(grant);
  if (typeof provider?.observe !== "function" || !identifier.safeParse(provider.deviceId).success
    || !Array.isArray(provider.locationRefs)
    || scope.locationRefs.some((ref) => !provider.locationRefs.includes(ref))
    || typeof evaluate !== "function") throw new TypeError("invalid native registry installation");
  async function authorized(operation, context) {
    if (!["register", "admit-mutation", "quarantine-mutation"].includes(operation)
      || context.appId !== "workbench" || !["frontend", "http"].includes(context.caller)
      || context.orgId !== scope.orgId) return false;
    const role = await access.resolve({ userEmail: context.userEmail, orgId: context.orgId });
    if (role.status !== "assigned") return false;
    return operation === "register"
      ? ["project-registrar", "project-mutator"].includes(role.role)
      : role.role === "project-mutator";
  }
  async function facts(operation, request, context, selectedBinding) {
    const quarantine = operation === "quarantine-mutation";
    const locationRef = operation === "register" ? request.locationRef
      : quarantine ? "unverified" : selectedBinding?.locationRef ?? "unverified";
    const root = { rootId: "unverified", locationRef,
      exists: !quarantine, isDirectory: !quarantine, identityVerified: false,
      contentRevision: "unverified", vcs: noVcs() };
    const currentActorId = actorId(context);
    const result = { actorId: currentActorId, collectionId: scope.collectionId,
      deviceId: provider.deviceId, member: false, capabilities: [], rootAccess: [],
      policyRevision: scope.policyRevision, root, overlapSafe: false };
    if (!await authorized(operation, context)) return result;
    if (operation === "register" && !scope.locationRefs.includes(locationRef)) return result;
    result.member = true;
    result.capabilities = operation === "register" ? ["register-project"] : ["mutate-project"];
    if (!quarantine) result.rootAccess = [root.rootId];
    if (request.expectedPolicyRevision !== scope.policyRevision) return result;
    if (quarantine) return result;
    const selectedInScope = operation === "register" || selectedBinding !== null && selectedBinding !== undefined
        && selectedBinding.actorId === currentActorId
        && selectedBinding.collectionId === scope.collectionId
        && selectedBinding.deviceId === provider.deviceId
        && selectedBinding.bindingId === request.bindingId && scope.locationRefs.includes(locationRef);
    if (!selectedInScope) return result;
    const observed = await provider.observe(locationRef);
    // Custody work crosses an async boundary. Read the actual native membership
    // and explicit assignment again before returning any verified root fact.
    if (!await authorized(operation, context)) {
      result.member = false;
      result.capabilities = [];
      return result;
    }
    if (observed.code === "observed") {
      Object.assign(root, { rootId: observed.rootId, contentRevision: observed.contentRevision,
        identityVerified: true, vcs: { ...observed.vcs } });
      result.rootAccess = [root.rootId];
      result.overlapSafe = true;
    }
    return result;
  }
  const entries = createRegistryActions({ authorizeContext: authorized, resolveFacts: facts,
    allocateIds: () => ({ projectId: "project_" + randomUUID().replaceAll("-", ""),
      bindingId: "binding_" + randomUUID().replaceAll("-", "") }), evaluate, deriveMutationKeys });
  async function readScope(context) {
    if (!context || typeof context !== "object" || Array.isArray(context)) return null;
    const identity = Object.fromEntries(["userEmail", "orgId", "appId", "caller"]
      .map((key) => [key, context[key]]));
    if (Object.values(identity).some((value) => typeof value !== "string" || value.length === 0)) return null;
    Object.freeze(identity);
    const deviceId = provider.deviceId;
    if (!await authorized("register", identity)) return null;
    return Object.freeze({ actorId: actorId(identity), collectionId: scope.collectionId,
      deviceId, policyRevision: scope.policyRevision,
      locationRefs: Object.freeze([...scope.locationRefs]) });
  }
  return Object.freeze({ registration: entries.register,
    mutationAdmission: entries.mutationAdmission,
    mutationQuarantine: entries.mutationQuarantine, readScope });
}

/** Shared native request auth callbacks for registration and the scoped catalog. */
export function createNativeRegistryAuth() {
  return Object.freeze({
    getOwnerFromEvent: async (event) => {
      const session = await getSession(event);
      if (!session?.email) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
      return session.email;
    },
    resolveOrgId: async (event) => {
      const context = await getOrgContext(event);
      if (!context.orgId) throw Object.assign(new Error("Organization required"), { statusCode: 403 });
      return context.orgId;
    },
  });
}

/** No configuration means no registration route; the shell remains usable. */
export function mountNativeRegistry(nitroApp, configuration) {
  if (configuration === undefined || configuration === null) {
    return Object.freeze({ status: "unconfigured" });
  }
  const runtime = createNativeRegistry(configuration);
  mountRegistryHttp(nitroApp, { registration: runtime.registration,
    parseStrictJson: configuration.parseStrictJson, ...createNativeRegistryAuth() });
  return Object.freeze({ status: "configured" });
}
