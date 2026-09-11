/** Durable provenance for one synthetic Native first start. */
import { createHash } from "node:crypto";
import { and, eq } from "@agent-native/core/db/schema";
import { receipts } from "./db/schema.mjs";

const OPERATION = "runtime-start";
const MAX_RECORD_BYTES = 16 * 1024;
const REQUEST_FIELDS = Object.freeze([
  "schemaVersion", "preparationId", "preparationOperationId", "scopeKey", "projectId",
  "expectedBindingRevision", "expectedPolicyRevision",
]);
const PREPARATION_REQUEST_FIELDS = Object.freeze([
  "schemaVersion", "operationId", "scopeKey", "projectId", "expectedBindingRevision",
  "expectedPolicyRevision", "role",
]);
const IDENTITY_FIELDS = Object.freeze([
  "ownerEmail", "orgId", "actorId", "collectionId", "deviceId", "projectId", "bindingId",
  "bindingRevision", "rootId", "contentRevision", "locationRef", "policyRevision", "harnessName",
  "runtimeVersion", "executionLocation", "authorityContract", "runtimeConfigurationRevision",
]);
const CONFIGURATION_FIELDS = Object.freeze([
  "schemaVersion", "kind", "harnessName", "runtimeVersion", "fixtureRevision", "turnInputDigest",
]);
const INTENT_FIELDS = Object.freeze([
  "request", "preparationRequest", "preparationRequestDigest",
  "preparationIssuerIncarnationId", "preparationAttemptId", "identity",
  "bindingIdentityDigest", "role", "roleContractRevision", "preparationAuthorityRevision",
  "startAuthorityRevision", "adapterConfiguration", "adapterConfigurationDigest",
  "nativeThreadId", "issuerIncarnationId",
]);
const RECORD_FIELDS = Object.freeze([
  "schemaVersion", "operationId", "request", "requestDigest", "preparationId",
  "preparationRequest", "preparationRequestDigest", "preparationIssuerIncarnationId",
  "preparationAttemptId", "identity", "bindingIdentityDigest", "role", "roleContractRevision",
  "preparationAuthorityRevision", "startAuthorityRevision", "adapterConfiguration",
  "adapterConfigurationDigest", "nativeThreadId", "nativeSessionId", "nativeRunId",
  "allocationDigest", "issuerIncarnationId", "attemptId", "phase", "nativeEvidenceDigest",
  "settlement", "quarantineReason",
]);
const ROW_FIELDS = Object.freeze([
  "receiptKey", "actorId", "collectionId", "deviceId", "operation", "operationId", "requestDigest",
  "creationNamespaceKey", "creationChildKey", "creationPhase", "record",
]);
const SETTLEMENT_FIELDS = Object.freeze([
  "schemaVersion", "attemptId", "issuerIncarnationId", "preparationIssuerIncarnationId",
  "startAuthorityRevision", "adapterConfigurationDigest", "nativeEvidenceDigest",
  "referenceRevision", "evidenceKind",
]);
const ROLES = new Set(["planner", "developer", "qa"]);
const PHASES = new Set([
  "reserved", "starting", "reference-candidate", "reference-verified", "quarantined",
]);
const QUARANTINE_REASONS = new Set([
  "host-invalid", "effect-uncertain", "settlement-uncertain", "foreign-incarnation",
  "authority-changed",
]);
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const TURN_INPUT = "Vivary synthetic first-start proof.";
const TURN_INPUT_DIGEST = createHash("sha256").update(TURN_INPUT, "utf8").digest("hex");

const clone = value => structuredClone(value);
const exactObject = (value, fields) => value !== null && typeof value === "object"
  && !Array.isArray(value) && Object.keys(value).length === fields.length
  && fields.every(field => Object.hasOwn(value, field));
const identifier = value => typeof value === "string" && value.isWellFormed() && ID.test(value);
const safeText = value => typeof value === "string" && value.length >= 1
  && value.length <= 512 && value.isWellFormed();
const version = value => typeof value === "string" && value.isWellFormed() && VERSION.test(value);
const positiveRevision = value => Number.isSafeInteger(value) && value > 0;
const digest = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function normalizeRequest(value) {
  if (!exactObject(value, REQUEST_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.preparationId) || !identifier(value.preparationOperationId)
    || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision)) return null;
  return Object.fromEntries(REQUEST_FIELDS.map(field => [field, value[field]]));
}

function normalizePreparationRequest(value) {
  if (!exactObject(value, PREPARATION_REQUEST_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.operationId) || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision) || !ROLES.has(value.role)) return null;
  return Object.fromEntries(PREPARATION_REQUEST_FIELDS.map(field => [field, value[field]]));
}

function normalizeIdentity(value) {
  if (!exactObject(value, IDENTITY_FIELDS) || !safeText(value.ownerEmail)
    || !identifier(value.orgId) || !identifier(value.actorId) || !identifier(value.collectionId)
    || !identifier(value.deviceId) || !identifier(value.projectId) || !identifier(value.bindingId)
    || !positiveRevision(value.bindingRevision) || !safeText(value.rootId)
    || !safeText(value.contentRevision) || !identifier(value.locationRef)
    || !positiveRevision(value.policyRevision) || !identifier(value.harnessName)
    || !version(value.runtimeVersion) || !identifier(value.executionLocation)
    || !identifier(value.authorityContract)
    || !positiveRevision(value.runtimeConfigurationRevision)) return null;
  return Object.fromEntries(IDENTITY_FIELDS.map(field => [field, value[field]]));
}

function normalizeConfiguration(value) {
  if (!exactObject(value, CONFIGURATION_FIELDS) || value.schemaVersion !== 1
    || value.kind !== "synthetic-native-adapter" || !identifier(value.harnessName)
    || !version(value.runtimeVersion) || !version(value.fixtureRevision)
    || value.turnInputDigest !== TURN_INPUT_DIGEST) return null;
  return Object.fromEntries(CONFIGURATION_FIELDS.map(field => [field, value[field]]));
}

const bindingIdentityDigest = identity => digest(
  Object.fromEntries(IDENTITY_FIELDS.map(field => [field, identity[field]])),
);
const preparationTuple = request => [1, request.operationId, request.scopeKey, request.projectId,
  request.expectedBindingRevision, request.expectedPolicyRevision, request.role];
const preparationDigest = (request, identity, roleContractRevision, authorityRevision) => digest([
  preparationTuple(request), identity, request.role, roleContractRevision, authorityRevision,
]);
const requestTuple = request => [1, request.preparationId, request.preparationOperationId,
  request.scopeKey, request.projectId, request.expectedBindingRevision, request.expectedPolicyRevision];
const configurationTuple = configuration => [1, "synthetic-native-adapter",
  configuration.harnessName, configuration.runtimeVersion, configuration.fixtureRevision,
  configuration.turnInputDigest];
const configurationDigest = configuration => digest(configurationTuple(configuration));
const startRequestDigest = intent => digest([
  requestTuple(intent.request), intent.preparationRequestDigest,
  intent.preparationIssuerIncarnationId, intent.preparationAttemptId, intent.identity, intent.role,
  intent.roleContractRevision, intent.preparationAuthorityRevision, intent.startAuthorityRevision,
  intent.adapterConfigurationDigest, intent.nativeThreadId,
]);
const startAllocationDigest = record => digest([
  1, record.requestDigest, record.issuerIncarnationId, record.preparationId,
  record.nativeThreadId, record.nativeSessionId, record.nativeRunId,
]);
const receiptKey = (identity, preparationId) => `runtime-start:v1:${digest([
  identity.actorId, identity.collectionId, identity.deviceId, OPERATION, preparationId,
])}`;

function normalizeIntent(value) {
  if (!exactObject(value, INTENT_FIELDS)) return null;
  const request = normalizeRequest(value.request);
  const preparationRequest = normalizePreparationRequest(value.preparationRequest);
  const identity = normalizeIdentity(value.identity);
  const adapterConfiguration = normalizeConfiguration(value.adapterConfiguration);
  if (!request || !preparationRequest || !identity || !adapterConfiguration
    || !DIGEST.test(value.preparationRequestDigest ?? "")
    || !identifier(value.preparationIssuerIncarnationId)
    || !identifier(value.preparationAttemptId) || !DIGEST.test(value.bindingIdentityDigest ?? "")
    || !ROLES.has(value.role) || !positiveRevision(value.roleContractRevision)
    || !positiveRevision(value.preparationAuthorityRevision)
    || !positiveRevision(value.startAuthorityRevision)
    || !DIGEST.test(value.adapterConfigurationDigest ?? "")
    || !identifier(value.nativeThreadId) || !identifier(value.issuerIncarnationId)) return null;
  if (request.preparationId === value.nativeThreadId
    || request.preparationOperationId !== preparationRequest.operationId
    || request.scopeKey !== preparationRequest.scopeKey || request.projectId !== preparationRequest.projectId
    || request.expectedBindingRevision !== preparationRequest.expectedBindingRevision
    || request.expectedPolicyRevision !== preparationRequest.expectedPolicyRevision
    || request.projectId !== identity.projectId
    || request.expectedBindingRevision !== identity.bindingRevision
    || request.expectedPolicyRevision !== identity.policyRevision
    || value.role !== preparationRequest.role
    || value.bindingIdentityDigest !== bindingIdentityDigest(identity)
    || value.preparationRequestDigest !== preparationDigest(preparationRequest, identity,
      value.roleContractRevision, value.preparationAuthorityRevision)
    || adapterConfiguration.harnessName !== identity.harnessName
    || adapterConfiguration.runtimeVersion !== identity.runtimeVersion
    || value.adapterConfigurationDigest !== configurationDigest(adapterConfiguration)) return null;
  const normalized = {
    request: Object.freeze(request), preparationRequest: Object.freeze(preparationRequest),
    preparationRequestDigest: value.preparationRequestDigest,
    preparationIssuerIncarnationId: value.preparationIssuerIncarnationId,
    preparationAttemptId: value.preparationAttemptId, identity: Object.freeze(identity),
    bindingIdentityDigest: value.bindingIdentityDigest, role: value.role,
    roleContractRevision: value.roleContractRevision,
    preparationAuthorityRevision: value.preparationAuthorityRevision,
    startAuthorityRevision: value.startAuthorityRevision,
    adapterConfiguration: Object.freeze(adapterConfiguration),
    adapterConfigurationDigest: value.adapterConfigurationDigest,
    nativeThreadId: value.nativeThreadId, issuerIncarnationId: value.issuerIncarnationId,
  };
  return Object.freeze({ ...normalized, requestDigest: startRequestDigest(normalized),
    receiptKey: receiptKey(identity, request.preparationId) });
}

function normalizeSettlement(value, record) {
  if (!exactObject(value, SETTLEMENT_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.attemptId) || !identifier(value.issuerIncarnationId)
    || !identifier(value.preparationIssuerIncarnationId)
    || !positiveRevision(value.startAuthorityRevision)
    || !DIGEST.test(value.adapterConfigurationDigest ?? "")
    || !DIGEST.test(value.nativeEvidenceDigest ?? "") || value.referenceRevision !== 1
    || value.evidenceKind !== "synthetic-native-start") return null;
  for (const field of ["attemptId", "issuerIncarnationId", "preparationIssuerIncarnationId",
    "startAuthorityRevision", "adapterConfigurationDigest", "nativeEvidenceDigest"]) {
    if (value[field] !== record[field]) return null;
  }
  return Object.fromEntries(SETTLEMENT_FIELDS.map(field => [field, value[field]]));
}

function validPhaseFields(record) {
  if (!PHASES.has(record.phase)) return false;
  if (record.phase === "reserved") {
    return record.attemptId === null && record.nativeEvidenceDigest === null
      && record.settlement === null && record.quarantineReason === null;
  }
  if (record.phase === "starting") {
    return identifier(record.attemptId) && record.nativeEvidenceDigest === null
      && record.settlement === null && record.quarantineReason === null;
  }
  if (record.phase === "reference-candidate") {
    return identifier(record.attemptId) && DIGEST.test(record.nativeEvidenceDigest ?? "")
      && record.settlement === null && record.quarantineReason === null;
  }
  if (record.phase === "reference-verified") {
    return identifier(record.attemptId) && DIGEST.test(record.nativeEvidenceDigest ?? "")
      && record.quarantineReason === null && normalizeSettlement(record.settlement, record) !== null;
  }
  return (record.attemptId === null || identifier(record.attemptId))
    && (record.nativeEvidenceDigest === null
      || (identifier(record.attemptId) && DIGEST.test(record.nativeEvidenceDigest)))
    && record.settlement === null && QUARANTINE_REASONS.has(record.quarantineReason);
}

function parseRow(row) {
  if (!exactObject(row, ROW_FIELDS) || row.operation !== OPERATION
    || !identifier(row.actorId) || !identifier(row.collectionId) || !identifier(row.deviceId)
    || !identifier(row.operationId) || !DIGEST.test(row.requestDigest ?? "")
    || row.creationNamespaceKey !== null || row.creationChildKey !== null || row.creationPhase !== null
    || typeof row.record !== "string" || Buffer.byteLength(row.record, "utf8") > MAX_RECORD_BYTES) return null;
  let candidate;
  try { candidate = JSON.parse(row.record); } catch { return null; }
  if (!exactObject(candidate, RECORD_FIELDS) || candidate.schemaVersion !== 1
    || !identifier(candidate.operationId) || !identifier(candidate.preparationId)
    || !DIGEST.test(candidate.requestDigest ?? "")
    || !DIGEST.test(candidate.preparationRequestDigest ?? "")
    || !identifier(candidate.preparationIssuerIncarnationId)
    || !identifier(candidate.preparationAttemptId) || !DIGEST.test(candidate.bindingIdentityDigest ?? "")
    || !ROLES.has(candidate.role) || !positiveRevision(candidate.roleContractRevision)
    || !positiveRevision(candidate.preparationAuthorityRevision)
    || !positiveRevision(candidate.startAuthorityRevision)
    || !DIGEST.test(candidate.adapterConfigurationDigest ?? "")
    || !identifier(candidate.nativeThreadId) || !identifier(candidate.nativeSessionId)
    || !identifier(candidate.nativeRunId) || !DIGEST.test(candidate.allocationDigest ?? "")
    || !identifier(candidate.issuerIncarnationId) || !validPhaseFields(candidate)) return null;
  const request = normalizeRequest(candidate.request);
  const preparationRequest = normalizePreparationRequest(candidate.preparationRequest);
  const identity = normalizeIdentity(candidate.identity);
  const adapterConfiguration = normalizeConfiguration(candidate.adapterConfiguration);
  if (!request || !preparationRequest || !identity || !adapterConfiguration
    || new Set([candidate.preparationId, candidate.nativeThreadId,
      candidate.nativeSessionId, candidate.nativeRunId]).size !== 4
    || candidate.operationId !== candidate.preparationId
    || candidate.operationId !== request.preparationId
    || request.preparationOperationId !== preparationRequest.operationId
    || request.scopeKey !== preparationRequest.scopeKey || request.projectId !== preparationRequest.projectId
    || request.expectedBindingRevision !== preparationRequest.expectedBindingRevision
    || request.expectedPolicyRevision !== preparationRequest.expectedPolicyRevision
    || request.projectId !== identity.projectId || request.expectedBindingRevision !== identity.bindingRevision
    || request.expectedPolicyRevision !== identity.policyRevision || candidate.role !== preparationRequest.role
    || candidate.bindingIdentityDigest !== bindingIdentityDigest(identity)
    || candidate.preparationRequestDigest !== preparationDigest(preparationRequest, identity,
      candidate.roleContractRevision, candidate.preparationAuthorityRevision)
    || adapterConfiguration.harnessName !== identity.harnessName
    || adapterConfiguration.runtimeVersion !== identity.runtimeVersion
    || candidate.adapterConfigurationDigest !== configurationDigest(adapterConfiguration)) return null;
  const digestIntent = {
    request, preparationRequest, preparationRequestDigest: candidate.preparationRequestDigest,
    preparationIssuerIncarnationId: candidate.preparationIssuerIncarnationId,
    preparationAttemptId: candidate.preparationAttemptId, identity,
    bindingIdentityDigest: candidate.bindingIdentityDigest, role: candidate.role,
    roleContractRevision: candidate.roleContractRevision,
    preparationAuthorityRevision: candidate.preparationAuthorityRevision,
    startAuthorityRevision: candidate.startAuthorityRevision,
    adapterConfiguration, adapterConfigurationDigest: candidate.adapterConfigurationDigest,
    nativeThreadId: candidate.nativeThreadId,
  };
  if (candidate.requestDigest !== startRequestDigest(digestIntent)
    || candidate.allocationDigest !== startAllocationDigest(candidate)
    || row.receiptKey !== receiptKey(identity, candidate.preparationId)
    || row.actorId !== identity.actorId || row.collectionId !== identity.collectionId
    || row.deviceId !== identity.deviceId || row.operationId !== candidate.operationId
    || row.requestDigest !== candidate.requestDigest) return null;
  return Object.freeze({ ...candidate, request: Object.freeze(request),
    preparationRequest: Object.freeze(preparationRequest), identity: Object.freeze(identity),
    adapterConfiguration: Object.freeze(adapterConfiguration),
    settlement: candidate.settlement === null ? null : Object.freeze(clone(candidate.settlement)) });
}

function recordMatchesIntent(record, intent) {
  return record.requestDigest === intent.requestDigest
    && record.preparationRequestDigest === intent.preparationRequestDigest
    && record.preparationIssuerIncarnationId === intent.preparationIssuerIncarnationId
    && record.preparationAttemptId === intent.preparationAttemptId
    && record.bindingIdentityDigest === intent.bindingIdentityDigest && record.role === intent.role
    && record.roleContractRevision === intent.roleContractRevision
    && record.preparationAuthorityRevision === intent.preparationAuthorityRevision
    && record.startAuthorityRevision === intent.startAuthorityRevision
    && record.adapterConfigurationDigest === intent.adapterConfigurationDigest
    && record.nativeThreadId === intent.nativeThreadId
    && same(record.request, intent.request) && same(record.preparationRequest, intent.preparationRequest)
    && same(record.identity, intent.identity)
    && same(record.adapterConfiguration, intent.adapterConfiguration);
}

function rowForRecord(record) {
  return {
    receiptKey: receiptKey(record.identity, record.preparationId),
    actorId: record.identity.actorId, collectionId: record.identity.collectionId,
    deviceId: record.identity.deviceId, operation: OPERATION, operationId: record.operationId,
    requestDigest: record.requestDigest, creationNamespaceKey: null,
    creationChildKey: null, creationPhase: null, record: JSON.stringify(record),
  };
}

const validEncodedRecord = record => Buffer.byteLength(JSON.stringify(record), "utf8") <= MAX_RECORD_BYTES;
function isUniqueConstraint(error) {
  for (let current = error; current; current = current.cause) {
    if (["SQLITE_CONSTRAINT", "SQLITE_CONSTRAINT_UNIQUE", "23505"].includes(current.code)) return true;
    if (/unique constraint|duplicate key/i.test(String(current.message))) return true;
  }
  return false;
}

/** Exact-key, short-transaction port. It never acquires a host or calls Native. */
export function createRuntimeStartReceiptPort({ db } = {}) {
  if (!db || typeof db.transaction !== "function") {
    throw new TypeError("runtime start receipt port requires a Native database");
  }

  async function load(tx, intent) {
    const byKey = await tx.select().from(receipts).where(eq(receipts.receiptKey, intent.receiptKey));
    const byOperation = await tx.select().from(receipts).where(and(
      eq(receipts.actorId, intent.identity.actorId),
      eq(receipts.collectionId, intent.identity.collectionId),
      eq(receipts.deviceId, intent.identity.deviceId),
      eq(receipts.operation, OPERATION),
      eq(receipts.operationId, intent.request.preparationId),
    ));
    const rows = [...new Map([...byKey, ...byOperation].map(row => [row.receiptKey, row])).values()];
    if (rows.length === 0) return Object.freeze({ code: "missing" });
    if (rows.length !== 1) return Object.freeze({ code: "invalid" });
    const record = parseRow(rows[0]);
    if (!record) return Object.freeze({ code: "invalid" });
    if (!recordMatchesIntent(record, intent)) {
      return Object.freeze({ code: "conflict", record: clone(record) });
    }
    return Object.freeze({ code: "ok", row: rows[0], record: clone(record) });
  }

  async function read(value) {
    const intent = normalizeIntent(value);
    if (!intent) return Object.freeze({ code: "invalid" });
    try { return await db.transaction(tx => load(tx, intent)); }
    catch { return Object.freeze({ code: "unavailable" }); }
  }

  async function reserve(value, allocation) {
    const intent = normalizeIntent(value);
    if (!intent || !exactObject(allocation, ["nativeSessionId", "nativeRunId"])
      || !identifier(allocation.nativeSessionId) || !identifier(allocation.nativeRunId)
      || new Set([intent.request.preparationId, intent.nativeThreadId,
        allocation.nativeSessionId, allocation.nativeRunId]).size !== 4) {
      return Object.freeze({ code: "invalid" });
    }
    const record = {
      schemaVersion: 1, operationId: intent.request.preparationId,
      request: clone(intent.request), requestDigest: intent.requestDigest,
      preparationId: intent.request.preparationId,
      preparationRequest: clone(intent.preparationRequest),
      preparationRequestDigest: intent.preparationRequestDigest,
      preparationIssuerIncarnationId: intent.preparationIssuerIncarnationId,
      preparationAttemptId: intent.preparationAttemptId, identity: clone(intent.identity),
      bindingIdentityDigest: intent.bindingIdentityDigest, role: intent.role,
      roleContractRevision: intent.roleContractRevision,
      preparationAuthorityRevision: intent.preparationAuthorityRevision,
      startAuthorityRevision: intent.startAuthorityRevision,
      adapterConfiguration: clone(intent.adapterConfiguration),
      adapterConfigurationDigest: intent.adapterConfigurationDigest,
      nativeThreadId: intent.nativeThreadId, nativeSessionId: allocation.nativeSessionId,
      nativeRunId: allocation.nativeRunId, allocationDigest: null,
      issuerIncarnationId: intent.issuerIncarnationId, attemptId: null, phase: "reserved",
      nativeEvidenceDigest: null, settlement: null, quarantineReason: null,
    };
    record.allocationDigest = startAllocationDigest(record);
    if (!validEncodedRecord(record) || !parseRow(rowForRecord(record))) {
      return Object.freeze({ code: "invalid" });
    }
    try {
      return await db.transaction(async tx => {
        const existing = await load(tx, intent);
        if (existing.code !== "missing") return existing;
        await tx.insert(receipts).values(rowForRecord(record));
        return Object.freeze({ code: "created", record: clone(record) });
      });
    } catch (error) {
      if (!isUniqueConstraint(error)) return Object.freeze({ code: "unavailable" });
      return read(value);
    }
  }

  async function transition(value, allowed, transform) {
    const intent = normalizeIntent(value);
    if (!intent) return Object.freeze({ code: "invalid" });
    try {
      return await db.transaction(async tx => {
        const current = await load(tx, intent);
        if (current.code !== "ok") return current;
        if (current.record.issuerIncarnationId !== intent.issuerIncarnationId) {
          return Object.freeze({ code: "foreign", record: current.record });
        }
        if (!allowed(current.record)) return Object.freeze({ code: "phase", record: current.record });
        const next = transform(clone(current.record));
        if (!validEncodedRecord(next) || !parseRow(rowForRecord(next))) {
          return Object.freeze({ code: "invalid" });
        }
        const updated = await tx.update(receipts).set({ record: JSON.stringify(next) }).where(and(
          eq(receipts.receiptKey, current.row.receiptKey),
          eq(receipts.operation, OPERATION), eq(receipts.operationId, current.row.operationId),
          eq(receipts.requestDigest, current.row.requestDigest), eq(receipts.record, current.row.record),
        )).returning({ receiptKey: receipts.receiptKey });
        return updated.length === 1
          ? Object.freeze({ code: "changed", record: clone(next) })
          : Object.freeze({ code: "lost", record: current.record });
      });
    } catch { return Object.freeze({ code: "unavailable" }); }
  }

  const beginStart = (value, attemptId) => {
    if (!identifier(attemptId)) return Promise.resolve(Object.freeze({ code: "invalid" }));
    return transition(value, record => record.phase === "reserved" && record.attemptId === null,
      record => ({ ...record, attemptId, phase: "starting" }));
  };

  const recordReferenceCandidate = (value, attemptId, nativeEvidenceDigest) => {
    if (!identifier(attemptId) || !DIGEST.test(nativeEvidenceDigest ?? "")) {
      return Promise.resolve(Object.freeze({ code: "invalid" }));
    }
    return transition(value,
      record => record.phase === "starting" && record.attemptId === attemptId,
      record => ({ ...record, phase: "reference-candidate", nativeEvidenceDigest }));
  };

  const verifySettlement = (value, attemptId) => {
    if (!identifier(attemptId)) return Promise.resolve(Object.freeze({ code: "invalid" }));
    return transition(value,
      record => record.phase === "reference-candidate" && record.attemptId === attemptId,
      record => ({ ...record, phase: "reference-verified", settlement: {
        schemaVersion: 1, attemptId, issuerIncarnationId: record.issuerIncarnationId,
        preparationIssuerIncarnationId: record.preparationIssuerIncarnationId,
        startAuthorityRevision: record.startAuthorityRevision,
        adapterConfigurationDigest: record.adapterConfigurationDigest,
        nativeEvidenceDigest: record.nativeEvidenceDigest, referenceRevision: 1,
        evidenceKind: "synthetic-native-start",
      } }));
  };

  async function quarantine(value, reason) {
    const intent = normalizeIntent(value);
    if (!intent || !QUARANTINE_REASONS.has(reason)) return Object.freeze({ code: "invalid" });
    try {
      return await db.transaction(async tx => {
        const current = await load(tx, intent);
        if (current.code !== "ok") return current;
        if (current.record.phase === "quarantined") {
          return Object.freeze({ code: "phase", record: current.record });
        }
        const next = { ...clone(current.record), phase: "quarantined", settlement: null,
          quarantineReason: reason };
        if (!validEncodedRecord(next) || !parseRow(rowForRecord(next))) {
          return Object.freeze({ code: "invalid" });
        }
        const updated = await tx.update(receipts).set({ record: JSON.stringify(next) }).where(and(
          eq(receipts.receiptKey, current.row.receiptKey),
          eq(receipts.operation, OPERATION), eq(receipts.operationId, current.row.operationId),
          eq(receipts.requestDigest, current.row.requestDigest), eq(receipts.record, current.row.record),
        )).returning({ receiptKey: receipts.receiptKey });
        return updated.length === 1
          ? Object.freeze({ code: "changed", record: clone(next) })
          : Object.freeze({ code: "lost", record: current.record });
      });
    } catch { return Object.freeze({ code: "unavailable" }); }
  }

  return Object.freeze({ read, reserve, beginStart, recordReferenceCandidate,
    verifySettlement, quarantine });
}
