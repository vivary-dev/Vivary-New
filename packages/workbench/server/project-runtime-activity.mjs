/** Read-only Native activity for one exact authorized project binding. */
import { createHash } from "node:crypto";
import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "@agent-native/core/db/schema";
import {
  getAgentHarnessBackgroundRun,
  getAgentHarnessSession,
  listAgentHarnessBackgroundTranscriptEvents,
} from "@agent-native/core/agent/harness";
import { getH3App, getThread, mountActionRoutes } from "@agent-native/core/server";
import { defineEventHandler } from "h3";
import { z } from "zod";
import {
  runtimeActivityItemSchema,
  runtimeActivityRequestSchema,
  runtimeActivityResultSchema,
} from "../app/lib/runtime-activity-schema.ts";
import { getDb } from "./db/index.mjs";
import { bindings, projects, revisions } from "./db/schema.mjs";

const ACTION_NAME = "vivary-project-runtime-activity";
const ACTION_PATH = `/_agent-native/actions/${ACTION_NAME}`;
const EXPECTED_QUERY_KEYS = Object.freeze([
  "expectedBindingRevision", "expectedPolicyRevision", "projectId", "scopeKey",
]);
const MAX_FIXTURE_EVENTS = 256;
const MAX_FIXTURE_BYTES = 512 * 1024;
const MAX_ITEMS = 128;
const MAX_ITEM_BYTES = 8 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const trustedString = z.string().min(1).max(512).refine(value => value.isWellFormed());
const versionLabel = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const positiveRevision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const runtimeSchema = z.strictObject({
  harnessName: identifier,
  runtimeVersion: versionLabel,
  executionLocation: identifier,
  configurationRevision: positiveRevision,
  authorityContract: identifier,
});
const referenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  referenceRevision: positiveRevision,
  bindingIdentityDigest: z.string().regex(/^[0-9a-f]{64}$/),
  nativeThreadId: identifier,
  nativeSessionId: identifier,
  nativeRunId: identifier,
  harnessName: identifier,
});
const fixtureBudgetSchema = z.strictObject({
  eventCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  encodedBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
const refused = code => Object.freeze({ code });
const digest = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

function contextSnapshot(context) {
  if (!context || typeof context !== "object") return undefined;
  return Object.freeze(Object.fromEntries(["userEmail", "orgId", "appId", "caller", "actionName"]
    .filter(key => typeof context[key] === "string").map(key => [key, context[key]])));
}

function parseConfiguration(supplied) {
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) return null;
  const keys = Object.keys(supplied).sort();
  const expected = ["authorityContract", "configurationRevision", "executionLocation", "harnessName",
    "resolveReference", "runtimeVersion", "verifyFixtureBudget"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])
    || typeof supplied.resolveReference !== "function" || typeof supplied.verifyFixtureBudget !== "function") {
    throw new TypeError("invalid runtime activity configuration");
  }
  const runtime = runtimeSchema.parse({ harnessName: supplied.harnessName,
    runtimeVersion: supplied.runtimeVersion, executionLocation: supplied.executionLocation,
    configurationRevision: supplied.configurationRevision,
    authorityContract: supplied.authorityContract });
  return Object.freeze({ ...runtime, resolveReference: supplied.resolveReference,
    verifyFixtureBudget: supplied.verifyFixtureBudget });
}

function sameConfiguration(left, right) {
  return Boolean(left && right)
    && left.harnessName === right.harnessName
    && left.runtimeVersion === right.runtimeVersion
    && left.executionLocation === right.executionLocation
    && left.configurationRevision === right.configurationRevision
    && left.authorityContract === right.authorityContract
    && left.resolveReference === right.resolveReference
    && left.verifyFixtureBudget === right.verifyFixtureBudget;
}

async function readBindingSnapshot(scope, projectId) {
  return getDb().transaction(async tx => {
    const [version] = await tx.select({ revision: revisions.revision }).from(revisions).where(and(
      eq(revisions.collectionId, scope.collectionId), eq(revisions.deviceId, scope.deviceId),
    ));
    const records = await tx.select({ bindingId: bindings.bindingId,
      bindingRevision: bindings.bindingRevision, policyRevision: bindings.policyRevision,
      locationRef: bindings.locationRef, rootId: bindings.rootId,
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
      observations.set(record.bindingId, root?.code === "available" && root.locationRef === record.locationRef
        && trustedString.safeParse(root.rootId).success && root.rootId === record.rootId
        && trustedString.safeParse(root.contentRevision).success
        ? Object.freeze({ state: "available", rootId: root.rootId,
          contentRevision: root.contentRevision })
        : Object.freeze({ state: "unavailable" }));
    } catch { observations.set(record.bindingId, Object.freeze({ state: "unavailable" })); }
  }
  return observations;
}

function selectBinding(snapshot, observations, request) {
  if (snapshot.records.length > 16) return { code: "unavailable" };
  if (snapshot.records.length === 0) return { code: "denied" };
  if (snapshot.records.length > 1) return { code: "ambiguous-binding" };
  const record = snapshot.records[0];
  if (record.bindingRevision !== request.expectedBindingRevision
    || record.policyRevision !== request.expectedPolicyRevision) return { code: "stale-claim" };
  return { code: "selected", record, root: observations.get(record.bindingId) };
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

function canonicalIdentity({ owner, scope, projectId, selected, runtime }) {
  if (!trustedString.safeParse(owner?.userEmail).success || !trustedString.safeParse(owner?.orgId).success
    || selected.root.state !== "available") return null;
  return Object.freeze({
    ownerEmail: owner.userEmail,
    orgId: owner.orgId,
    actorId: scope.actorId,
    collectionId: scope.collectionId,
    deviceId: scope.deviceId,
    projectId,
    bindingId: selected.record.bindingId,
    bindingRevision: selected.record.bindingRevision,
    rootId: selected.root.rootId,
    contentRevision: selected.root.contentRevision,
    locationRef: selected.record.locationRef,
    policyRevision: scope.policyRevision,
    harnessName: runtime.harnessName,
    runtimeVersion: runtime.runtimeVersion,
    executionLocation: runtime.executionLocation,
    authorityContract: runtime.authorityContract,
    runtimeConfigurationRevision: runtime.configurationRevision,
  });
}

function nativeIdentity(reference, owner, thread, session, run) {
  if (!thread || thread.id !== reference.nativeThreadId || thread.ownerEmail !== owner.userEmail
    || thread.orgId !== owner.orgId || thread.scope?.type !== "vivary-project-runtime-v1"
    || thread.scope.id !== reference.bindingIdentityDigest) return null;
  if (!session || session.id !== reference.nativeSessionId || session.ownerEmail !== owner.userEmail
    || session.orgId !== owner.orgId || session.threadId !== reference.nativeThreadId
    || session.runId !== reference.nativeRunId || session.harnessName !== reference.harnessName) return null;
  if (!run || run.id !== reference.nativeRunId || run.kind !== "harness" || run.source !== "agent-harness"
    || run.sourceRecord?.type !== "agent-harness-session" || run.sourceRecord.id !== reference.nativeSessionId
    || run.sourceRecord.threadId !== reference.nativeThreadId
    || run.sourceRecord.name !== reference.harnessName) return null;
  return Object.freeze({ thread: { id: thread.id, ownerEmail: thread.ownerEmail, orgId: thread.orgId,
    scope: thread.scope }, session: { id: session.id, ownerEmail: session.ownerEmail, orgId: session.orgId,
    threadId: session.threadId, runId: session.runId, harnessName: session.harnessName },
  run: { id: run.id, kind: run.kind, source: run.source, sourceRecord: run.sourceRecord } });
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const picked = Object.fromEntries(["type", "tool", "input", "result", "errorCode", "reason"]
    .filter(key => Object.hasOwn(metadata, key)).map(key => [key, metadata[key]]));
  return Object.keys(picked).length > 0 ? picked : undefined;
}

function projectEvents(events, reference) {
  const items = [];
  for (const event of events) {
    if (!event || event.schemaVersion !== 1 || event.runId !== reference.nativeRunId
      || event.source !== "agent-harness" || event.sourceRecord?.type !== "agent-harness-run-event") return null;
    const metadata = safeMetadata(event.metadata);
    let parsed;
    try {
      parsed = runtimeActivityItemSchema.safeParse({ id: event.id, runId: event.runId,
        kind: event.kind, message: event.message, createdAt: event.createdAt,
        ...(metadata ? { metadata } : {}) });
    } catch { return null; }
    if (!parsed.success) return null;
    let encodedBytes;
    try { encodedBytes = Buffer.byteLength(JSON.stringify(parsed.data), "utf8"); }
    catch { return null; }
    if (encodedBytes > MAX_ITEM_BYTES) return { tooLarge: true };
    items.push(Object.freeze(parsed.data));
    if (items.length > MAX_ITEMS) return { tooLarge: true };
  }
  return { items: Object.freeze(items) };
}

/** Trusted fixture composition is required. The default reads no Native activity. */
export function createProjectRuntimeActivity({ readScope, provider, runtime: suppliedRuntime }) {
  if (typeof readScope !== "function" || typeof provider?.inspect !== "function") {
    throw new TypeError("runtime activity requires the current native scope and trusted root provider");
  }
  const runtime = parseConfiguration(suppliedRuntime);

  async function read(request, context) {
    if (!runtime) return refused("unavailable");
    const owner = contextSnapshot(context);
    const scope = await readScope(owner);
    if (!scope) return refused("denied");
    if (digest(scope) !== request.scopeKey || scope.policyRevision !== request.expectedPolicyRevision) {
      return refused("stale-claim");
    }
    const before = await readBindingSnapshot(scope, request.projectId);
    const rootsBefore = await inspectBindings(provider, before.records);
    const selectedBefore = selectBinding(before, rootsBefore, request);
    if (selectedBefore.code !== "selected") return refused(selectedBefore.code);
    const identityBefore = canonicalIdentity({ owner, scope, projectId: request.projectId,
      selected: selectedBefore, runtime });
    if (!identityBefore) return refused("unavailable");

    let referenceBefore;
    try { referenceBefore = referenceSchema.parse(await runtime.resolveReference(identityBefore)); }
    catch { return refused("unavailable"); }
    if (referenceBefore.bindingIdentityDigest !== digest(identityBefore)
      || referenceBefore.harnessName !== runtime.harnessName) return refused("unavailable");
    const nativeScope = { ownerEmail: identityBefore.ownerEmail, orgId: identityBefore.orgId };
    const threadBefore = await getThread(referenceBefore.nativeThreadId);
    const sessionBefore = await getAgentHarnessSession(referenceBefore.nativeSessionId);
    const runBefore = await getAgentHarnessBackgroundRun(referenceBefore.nativeRunId, nativeScope);
    const nativeBefore = nativeIdentity(referenceBefore, owner, threadBefore, sessionBefore, runBefore);
    if (!nativeBefore) return refused("unavailable");

    let budget;
    try { budget = fixtureBudgetSchema.parse(await runtime.verifyFixtureBudget(Object.freeze({
      nativeRunId: referenceBefore.nativeRunId, nativeSessionId: referenceBefore.nativeSessionId,
      referenceRevision: referenceBefore.referenceRevision,
    }))); } catch { return refused("unavailable"); }
    if (budget.eventCount > MAX_FIXTURE_EVENTS || budget.encodedBytes > MAX_FIXTURE_BYTES) {
      return refused("activity-too-large");
    }
    const events = await listAgentHarnessBackgroundTranscriptEvents(referenceBefore.nativeRunId, nativeScope);
    const projected = projectEvents(events, referenceBefore);
    if (!projected) return refused("unavailable");
    if (projected.tooLarge) return refused("activity-too-large");

    const threadAfter = await getThread(referenceBefore.nativeThreadId);
    const sessionAfter = await getAgentHarnessSession(referenceBefore.nativeSessionId);
    const runAfter = await getAgentHarnessBackgroundRun(referenceBefore.nativeRunId, nativeScope);
    let currentRuntime;
    try { currentRuntime = parseConfiguration(suppliedRuntime); }
    catch { return refused("stale-claim"); }
    if (!sameConfiguration(runtime, currentRuntime)) return refused("stale-claim");
    let referenceAfter;
    try { referenceAfter = referenceSchema.parse(await runtime.resolveReference(identityBefore)); }
    catch { return refused("unavailable"); }
    const nativeAfter = nativeIdentity(referenceAfter, owner, threadAfter, sessionAfter, runAfter);
    if (!nativeAfter || JSON.stringify(referenceAfter) !== JSON.stringify(referenceBefore)
      || JSON.stringify(nativeAfter) !== JSON.stringify(nativeBefore)) return refused("stale-claim");

    const rootAfter = await inspectBindings(provider, before.records);
    try { currentRuntime = parseConfiguration(suppliedRuntime); }
    catch { return refused("stale-claim"); }
    if (!sameConfiguration(runtime, currentRuntime)) return refused("stale-claim");
    const selectedAfter = selectBinding(before, rootAfter, request);
    if (!sameSelection(selectedBefore, selectedAfter)) return refused("stale-claim");
    const identityAfter = canonicalIdentity({ owner, scope, projectId: request.projectId,
      selected: selectedAfter, runtime });
    if (!identityAfter || digest(identityAfter) !== referenceAfter.bindingIdentityDigest
      || JSON.stringify(identityAfter) !== JSON.stringify(identityBefore)) return refused("stale-claim");
    const finalSnapshot = await readBindingSnapshot(scope, request.projectId);
    if (!sameSnapshot(before, finalSnapshot)) return refused("stale-claim");
    const selectedFinal = selectBinding(finalSnapshot, rootAfter, request);
    if (!sameSelection(selectedAfter, selectedFinal)) return refused("stale-claim");
    const finalScope = await readScope(owner);
    if (!finalScope || digest(finalScope) !== request.scopeKey || digest(finalScope) !== digest(scope)) {
      return refused("denied");
    }
    try { currentRuntime = parseConfiguration(suppliedRuntime); }
    catch { return refused("stale-claim"); }
    if (!sameConfiguration(runtime, currentRuntime)) return refused("stale-claim");

    const projectRuntimeScope = Object.freeze({ type: nativeAfter.thread.scope.type,
      id: nativeAfter.thread.scope.id });
    const response = Object.freeze({ code: "activity", projectId: request.projectId,
      scopeKey: request.scopeKey, bindingRevision: selectedFinal.record.bindingRevision,
      policyRevision: finalScope.policyRevision, referenceRevision: referenceAfter.referenceRevision,
      nativeThreadId: nativeAfter.thread.id, nativeScope: projectRuntimeScope,
      nativeRunId: referenceAfter.nativeRunId, items: projected.items });
    if (Buffer.byteLength(JSON.stringify(response), "utf8") > MAX_RESPONSE_BYTES) {
      return refused("activity-too-large");
    }
    return response;
  }

  return defineAction({ description: "Read Native run activity for one authorized project claim.",
    schema: runtimeActivityRequestSchema, outputSchema: runtimeActivityResultSchema,
    outputErrorStrategy: "strict", http: false, agentTool: false, mcpTool: false,
    toolCallable: false, readOnly: true,
    audit: { recordInputs: false, target: () => ({ visibility: "private" }) },
    authorize: async (_input, context) => Boolean(await readScope(contextSnapshot(context))),
    run: async (request, context) => read(request, context) });
}

function hasExactQuery(requestUrl) {
  const keys = [...requestUrl.searchParams.keys()].sort();
  if (keys.length !== EXPECTED_QUERY_KEYS.length
    || keys.some((key, index) => key !== EXPECTED_QUERY_KEYS[index])) return false;
  const input = Object.fromEntries(EXPECTED_QUERY_KEYS.map(key => [key, requestUrl.searchParams.getAll(key)[0]]));
  return EXPECTED_QUERY_KEYS.every(key => requestUrl.searchParams.getAll(key).length === 1)
    && runtimeActivityRequestSchema.safeParse(input).success;
}

/** Native authenticated GET transport. Production does not mount this action. */
export function mountProjectRuntimeActivity(nitroApp, { activity, auth }) {
  if (!activity?.schema || typeof activity.run !== "function"
    || typeof auth?.getOwnerFromEvent !== "function" || typeof auth?.resolveOrgId !== "function") {
    throw new TypeError("runtime activity mount requires its action and current native authentication");
  }
  getH3App(nitroApp).use(ACTION_PATH, defineEventHandler(event => {
    if (event.url.pathname !== "/") return Response.json({ error: "Not found" }, { status: 404 });
    if (event.req.method === "OPTIONS") return;
    if (event.req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
    if (!hasExactQuery(event.url)) return Response.json({ error: "Invalid activity claims" }, { status: 400 });
  }));
  mountActionRoutes(nitroApp,
    { [ACTION_NAME]: { ...activity, http: { method: "GET" }, requiresAuth: true } },
    { ...auth, appId: "workbench", allowDelegatedCaller: false });
}
