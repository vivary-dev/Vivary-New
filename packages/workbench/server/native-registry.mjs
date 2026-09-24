/** Native membership and app roles authorize the retained registry. */
import { createHash, randomUUID } from "node:crypto";
import { defineAppRoles, getOrgContext } from "@agent-native/core/org";
import { getSession } from "@agent-native/core/server";
import { z } from "zod";
import { createRegistryActions } from "./registry-actions.mjs";
import { mountRegistryHttp } from "./registry-http.mjs";

const LOCAL = "local-stat-revalidated-v1";
const access = defineAppRoles({ appId: "workbench",
  roles: ["project-registrar", "project-mutator"] });
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const grantSchema = z.strictObject({ orgId: identifier, collectionId: identifier,
  policyRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  locationRefs: z.array(identifier).min(1).max(16)
    .refine(refs => new Set(refs).size === refs.length),
});
const localGrantSchema = grantSchema.extend({
  locationRefs: z.array(identifier).max(16).refine(refs => new Set(refs).size === refs.length),
});
const noVcs = () => ({ kind: "none", repositoryId: null, checkoutId: null, mutationOwner: null });
const actorId = context => "actor_" + createHash("sha256")
  .update(context.orgId + "\0" + context.userEmail.trim().toLowerCase()).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function createNativeRegistry({ provider, grant, resolveGrant, evaluate, deriveMutationKeys }) {
  const local = provider?.verificationKind === LOCAL;
  const fixedScope = resolveGrant ? null : grantSchema.parse(grant);
  if (typeof provider?.observe !== "function" || !identifier.safeParse(provider.deviceId).success
    || !Array.isArray(provider.locationRefs)
    || (fixedScope && fixedScope.locationRefs.some(ref => !provider.locationRefs.includes(ref)))
    || (resolveGrant !== undefined && (!local || typeof resolveGrant !== "function"))
    || typeof evaluate !== "function") throw new TypeError("invalid native registry installation");

  async function currentScope(context) {
    const value = fixedScope ?? await resolveGrant(context);
    if (!value) return null;
    const scope = (local ? localGrantSchema : grantSchema).parse(value);
    return scope.locationRefs.every(ref => provider.locationRefs.includes(ref)) ? scope : null;
  }
  // A Native tool call may read the scope. Only the owner's own requests change it.
  async function authorizedScope(operation, context) {
    const callers = operation === "read" ? ["frontend", "http", "tool"] : ["frontend", "http"];
    if (!context || !["read", "register", "admit-mutation", "quarantine-mutation"].includes(operation)
      || context.appId !== "workbench" || !callers.includes(context.caller)
      || typeof context.userEmail !== "string" || !context.userEmail
      || (local && !["read", "register"].includes(operation))) return null;
    const scope = await currentScope(context);
    if (!scope || context.orgId !== scope.orgId) return null;
    const role = await access.resolve({ userEmail: context.userEmail, orgId: context.orgId });
    if (role.status !== "assigned") return null;
    const allowed = operation === "read" || operation === "register"
      ? ["project-registrar", "project-mutator"].includes(role.role)
      : role.role === "project-mutator";
    return allowed ? scope : null;
  }
  const authorized = async (operation, context) => Boolean(await authorizedScope(operation, context));

  async function facts(operation, request, context, selectedBinding) {
    const scope = await authorizedScope(operation, context);
    const quarantine = operation === "quarantine-mutation";
    const locationRef = operation === "register" ? request.locationRef
      : quarantine ? "unverified" : selectedBinding?.locationRef ?? "unverified";
    const root = { rootId: "unverified", locationRef,
      exists: !quarantine, isDirectory: !quarantine, identityVerified: false,
      contentRevision: local ? null : "unverified",
      vcs: local ? { kind: "unobserved", repositoryId: null, checkoutId: null, mutationOwner: null } : noVcs(),
      ...(local ? { verificationKind: LOCAL } : {}) };
    const currentActorId = actorId(context);
    const result = { actorId: currentActorId, collectionId: scope?.collectionId ?? fixedScope?.collectionId ?? "unverified",
      deviceId: provider.deviceId, member: false, capabilities: [], rootAccess: [],
      policyRevision: scope?.policyRevision ?? fixedScope?.policyRevision ?? 1, root, overlapSafe: false };
    if (!scope) return result;
    if (operation === "register" && !scope.locationRefs.includes(locationRef)) return result;
    result.member = true;
    result.capabilities = operation === "register" ? ["register-project"] : ["mutate-project"];
    if (!quarantine) result.rootAccess = [root.rootId];
    if (request.expectedPolicyRevision !== scope.policyRevision || quarantine) return result;
    const selectedInScope = operation === "register" || selectedBinding !== null && selectedBinding !== undefined
      && selectedBinding.actorId === currentActorId
      && selectedBinding.collectionId === scope.collectionId
      && selectedBinding.deviceId === provider.deviceId
      && selectedBinding.bindingId === request.bindingId && scope.locationRefs.includes(locationRef);
    if (!selectedInScope) return result;
    const observed = await provider.observe(locationRef);
    if (!same(await authorizedScope(operation, context), scope)) {
      result.member = false;
      result.capabilities = [];
      return result;
    }
    if (observed.code === "observed"
      && (local ? observed.verificationKind === LOCAL && observed.contentRevision === null
        : observed.verificationKind !== LOCAL)) {
      Object.assign(root, { rootId: observed.rootId, contentRevision: observed.contentRevision,
        identityVerified: true, vcs: { ...observed.vcs } });
      result.rootAccess = [root.rootId];
      result.overlapSafe = local ? observed.overlapSafe === true : true;
    }
    return result;
  }
  const entries = createRegistryActions({ authorizeContext: authorized, resolveFacts: facts,
    allocateIds: () => ({ projectId: "project_" + randomUUID().replaceAll("-", ""),
      bindingId: "binding_" + randomUUID().replaceAll("-", "") }), evaluate, deriveMutationKeys });

  async function readScope(context) {
    if (!context || typeof context !== "object" || Array.isArray(context)) return null;
    const identity = Object.fromEntries(["userEmail", "orgId", "appId", "caller"]
      .map(key => [key, context[key]]));
    if (Object.values(identity).some(value => typeof value !== "string" || value.length === 0)) return null;
    Object.freeze(identity);
    const scope = await authorizedScope("read", identity);
    if (!scope) return null;
    return Object.freeze({ actorId: actorId(identity), collectionId: scope.collectionId,
      deviceId: provider.deviceId, policyRevision: scope.policyRevision,
      locationRefs: Object.freeze([...scope.locationRefs]) });
  }
  return Object.freeze({ registration: entries.register,
    mutationAdmission: entries.mutationAdmission, mutationQuarantine: entries.mutationQuarantine, readScope });
}

export function createNativeRegistryAuth() {
  return Object.freeze({
    getOwnerFromEvent: async event => {
      const session = await getSession(event);
      if (!session?.email) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
      return session.email;
    },
    resolveOrgId: async event => {
      const context = await getOrgContext(event);
      if (!context.orgId) throw Object.assign(new Error("Organization required"), { statusCode: 403 });
      return context.orgId;
    },
  });
}

export function mountNativeRegistry(nitroApp, configuration) {
  if (configuration === undefined || configuration === null) return Object.freeze({ status: "unconfigured" });
  const runtime = createNativeRegistry(configuration);
  mountRegistryHttp(nitroApp, { registration: runtime.registration,
    parseStrictJson: configuration.parseStrictJson, ...createNativeRegistryAuth() });
  return Object.freeze({ status: "configured" });
}
