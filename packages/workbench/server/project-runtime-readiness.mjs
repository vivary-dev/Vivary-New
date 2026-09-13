/** Current read-only runtime facts for one authorized catalog claim. */
import { createHash } from "node:crypto";
import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "@agent-native/core/db/schema";
import {
  getAgentHarnessEntry,
  isAgentHarnessPackageInstalled,
  listAgentHarnesses,
} from "@agent-native/core/agent/harness";
import { getH3App, mountActionRoutes } from "@agent-native/core/server";
import { defineEventHandler } from "h3";
import { z } from "zod";
import {
  runtimeReadinessRequestSchema,
  runtimeReadinessResultSchema,
} from "../app/lib/runtime-readiness-schema.ts";
import { getDb } from "./db/index.mjs";
import { bindings, projects, revisions } from "./db/schema.mjs";

const ACTION_NAME = "vivary-project-runtime-readiness";
const ACTION_PATH = `/_agent-native/actions/${ACTION_NAME}`;
const EXPECTED_QUERY_KEYS = Object.freeze([
  "expectedBindingRevision",
  "expectedPolicyRevision",
  "projectId",
  "scopeKey",
]);
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const versionLabel = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const trustedValue = z.string().min(1).max(512).refine(value => value.isWellFormed());
const runtimeIdentitySchema = z.strictObject({
  harnessName: identifier,
  runtimeVersion: versionLabel,
  executionLocation: identifier,
  configurationRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  authorityContract: identifier,
});
const evidenceStateSchema = z.enum(["unknown", "available", "unavailable"]);
const runtimeEvidenceSchema = z.strictObject({
  evidenceKey: z.string().regex(/^[0-9a-f]{64}$/),
  authenticated: evidenceStateSchema,
  authorized: evidenceStateSchema,
  runnable: evidenceStateSchema,
  verified: evidenceStateSchema,
});
const refused = code => Object.freeze({ code });
const fingerprint = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unknown = () => Object.freeze({ state: "unknown" });
const observed = (state, ...evidence) => Object.freeze({ state, evidence: Object.freeze([...new Set(evidence)]) });

function contextSnapshot(context) {
  if (!context || typeof context !== "object") return undefined;
  return Object.freeze(Object.fromEntries(["userEmail", "orgId", "appId", "caller", "actionName"]
    .filter(key => typeof context[key] === "string").map(key => [key, context[key]])));
}

function parseRuntime(runtime) {
  if (runtime === undefined || runtime === null) return null;
  if (typeof runtime !== "object" || Array.isArray(runtime)) throw new TypeError("invalid runtime readiness configuration");
  const keys = Object.keys(runtime).sort();
  const expected = ["authorityContract", "configurationRevision", "executionLocation", "harnessName",
    "resolveEvidence", "runtimeVersion"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])
    || typeof runtime.resolveEvidence !== "function") throw new TypeError("invalid runtime readiness configuration");
  const identity = runtimeIdentitySchema.parse({ harnessName: runtime.harnessName,
    runtimeVersion: runtime.runtimeVersion, executionLocation: runtime.executionLocation,
    configurationRevision: runtime.configurationRevision, authorityContract: runtime.authorityContract });
  return Object.freeze({ ...identity, resolveEvidence: runtime.resolveEvidence });
}

function captureInstallation(runtime) {
  if (!runtime) return { entry: null, observation: unknown() };
  try {
    const listed = listAgentHarnesses();
    const entry = getAgentHarnessEntry(runtime.harnessName);
    if (!entry || !listed.includes(entry)) {
      return { entry: null, observation: observed("unavailable", "package-inventory") };
    }
    return { entry, observation: observed(
      isAgentHarnessPackageInstalled(entry) ? "available" : "unavailable", "package-inventory",
    ) };
  } catch {
    return { entry: null, observation: unknown() };
  }
}

function derive(raw, prerequisites, ownEvidence) {
  if (raw === "unknown") return unknown();
  if (raw === "unavailable") return observed("unavailable", ownEvidence);
  const unavailable = prerequisites.filter(value => value.state === "unavailable");
  if (unavailable.length > 0) {
    return observed("unavailable", ...unavailable.flatMap(value => value.evidence));
  }
  if (prerequisites.some(value => value.state === "unknown")) return unknown();
  return observed("available", ownEvidence);
}

function blockerCodes({ installed, configured, authenticated, authority, bound, runnable, verified }) {
  const blockers = [];
  if (installed.state === "unavailable") blockers.push("runtime-package-missing");
  if (configured.state !== "available") blockers.push("runtime-unconfigured");
  if (authenticated.state === "unknown") blockers.push("runtime-authentication-unknown");
  if (authenticated.state === "unavailable") blockers.push("runtime-authentication-unavailable");
  if (authority.state === "unknown") blockers.push("runtime-authority-unknown");
  if (authority.state === "unavailable") blockers.push("runtime-authority-unavailable");
  if (bound.state !== "available") blockers.push("binding-unavailable");
  if (runnable.state === "unknown") blockers.push("runtime-runnability-unknown");
  if (runnable.state === "unavailable") blockers.push("runtime-unavailable");
  if (verified.state === "unknown") blockers.push("verification-unknown");
  if (verified.state === "unavailable") blockers.push("runtime-unverified");
  return Object.freeze(blockers);
}

async function readBindingSnapshot(scope, projectId) {
  return getDb().transaction(async tx => {
    const [version] = await tx.select({ revision: revisions.revision }).from(revisions).where(and(
      eq(revisions.collectionId, scope.collectionId), eq(revisions.deviceId, scope.deviceId),
    ));
    const records = await tx.select({
      bindingId: bindings.bindingId,
      bindingRevision: bindings.bindingRevision,
      policyRevision: bindings.policyRevision,
      locationRef: bindings.locationRef,
      rootId: bindings.rootId,
    }).from(bindings).innerJoin(projects, eq(projects.projectId, bindings.projectId)).where(and(
      eq(bindings.projectId, projectId), eq(bindings.actorId, scope.actorId),
      eq(bindings.collectionId, scope.collectionId), eq(bindings.deviceId, scope.deviceId),
      inArray(bindings.locationRef, scope.locationRefs),
    )).limit(18);
    records.sort((left, right) => left.bindingId.localeCompare(right.bindingId));
    return Object.freeze({ registryRevision: version?.revision ?? 0, records: Object.freeze(records) });
  });
}

async function inspectBindings(provider, records) {
  const observations = new Map();
  for (const record of records) {
    try {
      const root = await provider.inspect(record.locationRef);
      const available = root?.code === "available" && root.verificationKind !== "local-stat-revalidated-v1"
        && root.locationRef === record.locationRef
        && trustedValue.safeParse(root.rootId).success && root.rootId === record.rootId
        && trustedValue.safeParse(root.contentRevision).success;
      observations.set(record.bindingId, available
        ? Object.freeze({ state: "available", rootId: root.rootId, contentRevision: root.contentRevision })
        : Object.freeze({ state: "unavailable" }));
    } catch {
      observations.set(record.bindingId, Object.freeze({ state: "unavailable" }));
    }
  }
  return observations;
}

function selectBinding(snapshot, observations, request) {
  if (snapshot.records.length > 16) return { code: "unavailable" };
  if (snapshot.records.length === 0) return { code: "denied" };
  // A catalog projection may collapse records for display. Runtime authority may
  // not choose between two authorized physical bindings, even if one root is
  // temporarily unavailable.
  if (snapshot.records.length > 1) return { code: "ambiguous-binding" };
  const exact = snapshot.records.filter(record => record.bindingRevision === request.expectedBindingRevision
    && record.policyRevision === request.expectedPolicyRevision);
  if (exact.length === 0) return { code: "stale-claim" };
  return { code: "selected", record: exact[0], root: observations.get(exact[0].bindingId) };
}

function sameSnapshot(left, right) {
  return left.registryRevision === right.registryRevision
    && JSON.stringify(left.records) === JSON.stringify(right.records);
}

function sameSelection(left, right) {
  return left.code === "selected" && right.code === "selected"
    && left.record.bindingId === right.record.bindingId
    && left.root.state === right.root.state
    && (left.root.state !== "available" || (left.root.rootId === right.root.rootId
      && left.root.contentRevision === right.root.contentRevision));
}

/** Trusted configuration may identify a runtime, but only bound evidence can strengthen it. */
export function createProjectRuntimeReadiness({ readScope, provider, runtime: suppliedRuntime }) {
  if (typeof readScope !== "function" || typeof provider?.inspect !== "function") {
    throw new TypeError("runtime readiness requires the current native scope and trusted root provider");
  }
  const runtime = parseRuntime(suppliedRuntime);
  const installation = captureInstallation(runtime);
  const configured = runtime && installation.entry
    ? observed("available", "trusted-configuration")
    : observed("unavailable", "trusted-configuration");

  async function read(request, context) {
    const owner = contextSnapshot(context);
    const scope = await readScope(owner);
    if (!scope) return refused("denied");
    if (fingerprint(scope) !== request.scopeKey || scope.policyRevision !== request.expectedPolicyRevision) {
      return refused("stale-claim");
    }

    const before = await readBindingSnapshot(scope, request.projectId);
    const rootsBefore = await inspectBindings(provider, before.records);
    const selectedBefore = selectBinding(before, rootsBefore, request);
    if (selectedBefore.code !== "selected") return refused(selectedBefore.code);

    let rawEvidence = Object.freeze({ authenticated: "unknown", authorized: "unknown",
      runnable: "unknown", verified: "unknown" });
    if (runtime && selectedBefore.root.state === "available") {
      const evidenceKey = fingerprint({ version: 1, runtime: {
        harnessName: runtime.harnessName,
        runtimeVersion: runtime.runtimeVersion,
        executionLocation: runtime.executionLocation,
        configurationRevision: runtime.configurationRevision,
        authorityContract: runtime.authorityContract,
      }, scope: { actorId: scope.actorId, collectionId: scope.collectionId, deviceId: scope.deviceId,
        policyRevision: scope.policyRevision }, projectId: request.projectId,
      bindingRevision: selectedBefore.record.bindingRevision, rootId: selectedBefore.root.rootId,
      contentRevision: selectedBefore.root.contentRevision });
      try {
        const evidence = runtimeEvidenceSchema.parse(await runtime.resolveEvidence(Object.freeze({
          evidenceKey, actorId: scope.actorId, collectionId: scope.collectionId, deviceId: scope.deviceId,
          projectId: request.projectId, rootId: selectedBefore.root.rootId,
          contentRevision: selectedBefore.root.contentRevision,
          bindingRevision: selectedBefore.record.bindingRevision, policyRevision: scope.policyRevision,
          harnessName: runtime.harnessName, runtimeVersion: runtime.runtimeVersion,
          executionLocation: runtime.executionLocation, configurationRevision: runtime.configurationRevision,
          authorityContract: runtime.authorityContract,
        })));
        rawEvidence = evidence.evidenceKey === evidenceKey
          ? Object.freeze({ authenticated: evidence.authenticated, authorized: evidence.authorized,
            runnable: evidence.runnable, verified: evidence.verified })
          : rawEvidence;
      } catch {
        rawEvidence = Object.freeze({ authenticated: "unavailable", authorized: "unavailable",
          runnable: "unavailable", verified: "unavailable" });
      }
    }

    const currentScope = await readScope(owner);
    if (!currentScope || fingerprint(currentScope) !== request.scopeKey
      || fingerprint(currentScope) !== fingerprint(scope)) return refused("denied");
    const after = await readBindingSnapshot(currentScope, request.projectId);
    if (!sameSnapshot(before, after)) return refused("stale-claim");
    const rootsAfter = await inspectBindings(provider, after.records);
    const selectedAfter = selectBinding(after, rootsAfter, request);
    if (selectedAfter.code !== "selected") return refused(selectedAfter.code);
    if (!sameSelection(selectedBefore, selectedAfter)) return refused("stale-claim");
    // This is a finite read observation across independent owners, not an
    // atomic filesystem/database snapshot or an execution grant. Finish every
    // provider observation first, then close over the registry and Native
    // authority without another callback or data read after that authority check.
    // A database change caused inside that final authority resolver is outside
    // this observation; detecting it would require another, no-longer-final read.
    const rootsFinal = await inspectBindings(provider, after.records);
    const selectedObserved = selectBinding(after, rootsFinal, request);
    if (selectedObserved.code !== "selected") return refused(selectedObserved.code);
    if (!sameSelection(selectedAfter, selectedObserved)) return refused("stale-claim");
    const finalSnapshot = await readBindingSnapshot(currentScope, request.projectId);
    if (!sameSnapshot(after, finalSnapshot)) return refused("stale-claim");
    const selectedFinal = selectBinding(finalSnapshot, rootsFinal, request);
    if (selectedFinal.code !== "selected") return refused(selectedFinal.code);
    if (!sameSelection(selectedObserved, selectedFinal)) return refused("stale-claim");
    const finalScope = await readScope(owner);
    if (!finalScope || fingerprint(finalScope) !== request.scopeKey
      || fingerprint(finalScope) !== fingerprint(scope)) return refused("denied");

    const bound = selectedFinal.root.state === "available"
      ? observed("available", "current-binding", "root-observation")
      : observed("unavailable", "current-binding", "root-observation");
    const authenticated = derive(rawEvidence.authenticated, [configured], "runtime-authentication");
    const authority = derive(rawEvidence.authorized, [configured, authenticated], "runtime-authority");
    const runnable = derive(rawEvidence.runnable,
      [installation.observation, configured, authenticated, authority, bound], "runtime-execution");
    const verified = derive(rawEvidence.verified, [runnable], "verification-receipt");
    const observations = Object.freeze({ installed: installation.observation, configured,
      authenticated, bound, runnable, verified });
    return Object.freeze({ code: "readiness", projectId: request.projectId, scopeKey: request.scopeKey,
      bindingRevision: selectedFinal.record.bindingRevision, policyRevision: finalScope.policyRevision,
      observations, blockers: blockerCodes({ ...observations, authority }) });
  }

  return defineAction({
    description: "Read current runtime readiness for one authorized project claim.",
    schema: runtimeReadinessRequestSchema,
    outputSchema: runtimeReadinessResultSchema,
    outputErrorStrategy: "strict",
    http: false,
    agentTool: false,
    mcpTool: false,
    toolCallable: false,
    readOnly: true,
    audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
    authorize: async (_input, context) => Boolean(await readScope(contextSnapshot(context))),
    run: async (request, context) => read(request, context),
  });
}

function hasExactQuery(requestUrl) {
  const keys = [...requestUrl.searchParams.keys()].sort();
  if (keys.length !== EXPECTED_QUERY_KEYS.length
    || keys.some((key, index) => key !== EXPECTED_QUERY_KEYS[index])) return false;
  const input = Object.fromEntries(EXPECTED_QUERY_KEYS.map(key => [key, requestUrl.searchParams.getAll(key)[0]]));
  return EXPECTED_QUERY_KEYS.every(key => requestUrl.searchParams.getAll(key).length === 1)
    && runtimeReadinessRequestSchema.safeParse(input).success;
}

/** Native authenticated GET transport. No app composition calls this by default. */
export function mountProjectRuntimeReadiness(nitroApp, { readiness, auth }) {
  if (!readiness?.schema || typeof readiness.run !== "function"
    || typeof auth?.getOwnerFromEvent !== "function" || typeof auth?.resolveOrgId !== "function") {
    throw new TypeError("runtime readiness mount requires its action and current native authentication");
  }
  getH3App(nitroApp).use(ACTION_PATH, defineEventHandler(event => {
    if (event.url.pathname !== "/") return Response.json({ error: "Not found" }, { status: 404 });
    if (event.req.method === "OPTIONS") return;
    if (event.req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
    if (!hasExactQuery(event.url)) return Response.json({ error: "Invalid readiness claims" }, { status: 400 });
  }));
  mountActionRoutes(nitroApp,
    { [ACTION_NAME]: { ...readiness, http: { method: "GET" }, requiresAuth: true } },
    { ...auth, appId: "workbench", allowDelegatedCaller: false });
}
