/** Durable creation intent in Workbench's existing private receipt owner. */
import { createHash } from "node:crypto";
import { and, eq } from "@agent-native/core/db/schema";
import { getDb } from "./db/index.mjs";
import { receipts } from "./db/schema.mjs";

const REQUEST_FIELDS = ["operationId", "parentRef", "childName",
  "acceptedPlanSha256", "expectedPolicyRevision"];
const AUTHORITY_FIELDS = ["actorId", "collectionId", "deviceId", "policyRevision",
  "member", "capabilities", "creatableParents"];
const NAMESPACE_FIELDS = ["parentRef", "namespaceKey", "childKey", "stageId",
  "continuityId", "exclusiveControl"];
const PORT_BINDING_FIELDS = ["actorId", "collectionId", "deviceId", "policyRevision",
  "operationId", "parentRef", "childName", "acceptedPlanSha256"];
const PORT_NAMESPACE_FIELDS = ["namespaceKey", "childKey", "stageId", "continuityId"];
const PORT_SNAPSHOT_FIELDS = ["binding", "phase", "namespace"];
const CREATION_PHASES = new Set(["preparing", "prepared", "publishing", "published", "failed"]);
const EFFECT_PHASES = new Map([
  ["prepare-stage", "preparing"],
  ["publish", "publishing"],
  ["recover-publication", "publishing"],
]);
const TRANSITIONS = new Map([
  ["prepared", "preparing"],
  ["publishing", "prepared"],
  ["published", "publishing"],
]);
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const CHILD_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const FAILURE_CODE = /^[a-z][a-z0-9-]{0,63}$/;

class RefusedTransaction extends Error {
  constructor(decision) {
    super(decision.output.code);
    this.decision = decision;
  }
}

const clone = (value) => structuredClone(value);
const sha256 = (value) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const exactFields = (value, fields) => value !== null && typeof value === "object"
  && !Array.isArray(value) && Object.keys(value).length === fields.length
  && fields.every((field) => Object.hasOwn(value, field));
const exactInteger = (value) => Number.isSafeInteger(value) && value >= 1;
const matches = (pattern, value) => {
  if (typeof value !== "string") return false;
  const match = pattern.exec(value);
  return match !== null && match[0] === value;
};
const exactStringArray = (value) => Array.isArray(value) && value.length <= 128
  && value.every((item) => matches(ID, item))
  && new Set(value).size === value.length;

function decision(code, fields = {}) {
  return { output: { code, ...fields }, effects: [], recordChanges: {} };
}

function recovery(reason = "creation-continuity-unavailable") {
  return decision("recovery-required", { reason });
}

function portRefusal(code, reason, phase = null) {
  return Object.freeze({ code, reason, phase });
}

function normalizeRequest(value) {
  if (!exactFields(value, REQUEST_FIELDS)
    || !matches(ID, value.operationId)
    || !matches(ID, value.parentRef)
    || !matches(CHILD_NAME, value.childName)
    || value.childName.endsWith(".")
    || !matches(DIGEST, value.acceptedPlanSha256)
    || !exactInteger(value.expectedPolicyRevision)) return null;
  return Object.fromEntries(REQUEST_FIELDS.map((field) => [field, value[field]]));
}

function normalizeAuthority(value) {
  if (!exactFields(value, AUTHORITY_FIELDS)
    || !matches(ID, value.actorId)
    || !matches(ID, value.collectionId)
    || !matches(ID, value.deviceId)
    || !exactInteger(value.policyRevision)
    || typeof value.member !== "boolean"
    || !exactStringArray(value.capabilities)
    || !exactStringArray(value.creatableParents)) return null;
  return {
    actorId: value.actorId,
    collectionId: value.collectionId,
    deviceId: value.deviceId,
    policyRevision: value.policyRevision,
    member: value.member,
    capabilities: [...value.capabilities].sort(),
    creatableParents: [...value.creatableParents].sort(),
  };
}

function normalizeNamespace(value, parentRef) {
  if (!exactFields(value, NAMESPACE_FIELDS)
    || value.parentRef !== parentRef
    || !matches(ID, value.namespaceKey)
    || !matches(ID, value.childKey)
    || !matches(ID, value.stageId)
    || !matches(ID, value.continuityId)
    || value.exclusiveControl !== true) return null;
  return Object.fromEntries(NAMESPACE_FIELDS.map((field) => [field, value[field]]));
}

function normalizePortBinding(value) {
  if (!exactFields(value, PORT_BINDING_FIELDS)) return null;
  const request = normalizeRequest({
    operationId: value.operationId,
    parentRef: value.parentRef,
    childName: value.childName,
    acceptedPlanSha256: value.acceptedPlanSha256,
    expectedPolicyRevision: value.policyRevision,
  });
  if (!request || !matches(ID, value.actorId) || !matches(ID, value.collectionId)
    || !matches(ID, value.deviceId)) return null;
  return Object.fromEntries(PORT_BINDING_FIELDS.map((field) => [field, value[field]]));
}

function normalizePortNamespace(value) {
  if (!exactFields(value, PORT_NAMESPACE_FIELDS)
    || PORT_NAMESPACE_FIELDS.some((field) => !matches(ID, value[field]))) return null;
  return Object.fromEntries(PORT_NAMESPACE_FIELDS.map((field) => [field, value[field]]));
}

function normalizePortSnapshot(value) {
  if (!exactFields(value, PORT_SNAPSHOT_FIELDS)
    || !["preparing", "prepared", "publishing", "published"].includes(value.phase)) return null;
  const binding = normalizePortBinding(value.binding);
  const namespace = normalizePortNamespace(value.namespace);
  return binding && namespace ? freezeSnapshot(binding, value.phase, namespace) : null;
}

function freezeSnapshot(binding, phase, namespace) {
  return Object.freeze({
    binding: Object.freeze(clone(binding)),
    phase,
    namespace: Object.freeze(clone(namespace)),
  });
}

function requestDigest(request) {
  return sha256(REQUEST_FIELDS.map((field) => request[field]));
}

function receiptKey(authority, operationId) {
  return `create:${sha256([
    authority.actorId, authority.collectionId, authority.deviceId, operationId,
  ]).slice(7)}`;
}

function authorityRefusal(authority, request) {
  if (authority.policyRevision !== request.expectedPolicyRevision) {
    return decision("stale-policy");
  }
  if (!authority.member || !authority.capabilities.includes("create-child")
    || !authority.creatableParents.includes(request.parentRef)) {
    return decision("denied");
  }
  return null;
}

function readRefusal(authority) {
  return authority.member ? null : decision("denied");
}

function sameOperationScope(current, initial) {
  return ["actorId", "collectionId", "deviceId"]
    .every((field) => current[field] === initial[field]);
}

function outputFor(record, replayed) {
  if (record.phase === "failed") {
    return decision("creation-failed", {
      operationId: record.request.operationId,
      phase: record.phase,
      failureCode: record.failureCode,
      replayed,
    });
  }
  return decision(record.phase, {
    operationId: record.request.operationId,
    phase: record.phase,
    parentRef: record.request.parentRef,
    childName: record.request.childName,
    acceptedPlanSha256: record.request.acceptedPlanSha256,
    replayed,
  });
}

function parseCreationReceipt(row) {
  if (!row || row.operation !== "create" || !matches(DIGEST, row.requestDigest)
    || !matches(ID, row.creationNamespaceKey)
    || !matches(ID, row.creationChildKey)
    || !CREATION_PHASES.has(row.creationPhase)) return null;
  let record;
  try { record = JSON.parse(row.record); } catch { return null; }
  const request = normalizeRequest(record?.request);
  const namespace = normalizeNamespace(record?.namespace, request?.parentRef);
  if (!request || !namespace || record.schemaVersion !== 1 || record.kind !== "creation"
    || record.actorId !== row.actorId || record.collectionId !== row.collectionId
    || record.deviceId !== row.deviceId || record.operationId !== row.operationId
    || record.requestDigest !== row.requestDigest
    || record.requestDigest !== requestDigest(request)
    || record.phase !== row.creationPhase
    || namespace.namespaceKey !== row.creationNamespaceKey
    || namespace.childKey !== row.creationChildKey
    || (record.failureCode !== null && !matches(FAILURE_CODE, record.failureCode))) return null;
  return { ...record, request, namespace };
}

function sameNamespace(current, stored) {
  return NAMESPACE_FIELDS.every((field) => current[field] === stored[field]);
}

function portNamespaceFor(namespace) {
  return Object.fromEntries(PORT_NAMESPACE_FIELDS.map((field) => [field, namespace[field]]));
}

function portBindingFor(record) {
  return {
    actorId: record.actorId,
    collectionId: record.collectionId,
    deviceId: record.deviceId,
    policyRevision: record.request.expectedPolicyRevision,
    operationId: record.request.operationId,
    parentRef: record.request.parentRef,
    childName: record.request.childName,
    acceptedPlanSha256: record.request.acceptedPlanSha256,
  };
}

function snapshotFor(record) {
  return freezeSnapshot(portBindingFor(record), record.phase, portNamespaceFor(record.namespace));
}

function samePortValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function portFailureFor(value, phase = null) {
  const output = value?.output;
  if (!output || typeof output.code !== "string") {
    return portRefusal("recovery-required", "creation-receipt-unavailable", phase);
  }
  const reason = {
    "invalid-input": "invalid-creation-request",
    "stale-policy": "creation-policy-changed",
    denied: "creation-effect-not-authorized",
    "retry-state": "creation-authority-changed",
    "operation-conflict": "creation-request-changed",
    "target-reserved": "creation-target-reserved",
    "receipt-unavailable": "creation-receipt-unavailable",
    "stale-phase": "creation-phase-changed",
    "creation-failed": output.failureCode ?? "creation-receipt-failed",
  }[output.code] ?? output.reason ?? "creation-receipt-unavailable";
  return portRefusal(output.code, reason, output.phase ?? phase);
}

function normalizePortRefusal(value) {
  if (!exactFields(value, ["code", "reason", "phase"])
    || !matches(FAILURE_CODE, value.code)
    || !matches(FAILURE_CODE, value.reason)
    || (value.phase !== null && !CREATION_PHASES.has(value.phase))) return null;
  return portRefusal(value.code, value.reason, value.phase);
}

function isUniqueConstraint(error) {
  for (let current = error; current; current = current.cause) {
    if (["SQLITE_CONSTRAINT", "SQLITE_CONSTRAINT_UNIQUE", "23505"].includes(current.code)) return true;
    if (/unique constraint|duplicate key/i.test(String(current.message))) return true;
  }
  return false;
}

function isConcurrentWrite(error) {
  for (let current = error; current; current = current.cause) {
    if (["SQLITE_BUSY", "SQLITE_BUSY_SNAPSHOT", "40001", "40P01"].includes(current.code)) {
      return true;
    }
  }
  return false;
}

/**
 * Safe production default. A host must install a resolver backed by an exclusive
 * namespace owner before any creation intent can be admitted.
 */
export async function unconfiguredCreationNamespace() {
  return null;
}

/** Safe default: no receipt mutation or private snapshot leaves an unowned scope. */
export const unconfiguredCreationHost = Object.freeze({
  async withCreationScope() {
    return null;
  },
});

/**
 * Persist creation intent without exposing a filesystem effect API.
 *
 * resolveFacts binds authenticated identity and the current explicit create-child
 * grant. resolveNamespace is trusted host configuration: callers cannot submit a
 * namespace, continuity token or stage identity in request JSON.
 */
export function createCreationReceiptStore({
  resolveFacts,
  resolveNamespace = unconfiguredCreationNamespace,
  creationHost = unconfiguredCreationHost,
} = {}) {
  if (typeof resolveFacts !== "function" || typeof resolveNamespace !== "function"
    || typeof creationHost?.withCreationScope !== "function") {
    throw new TypeError("creation receipt store requires trusted resolvers");
  }

  async function resolveAuthority(request) {
    try {
      const value = normalizeAuthority(await resolveFacts(clone(request)));
      return value ?? recovery("creation-authority-unavailable");
    } catch {
      return recovery("creation-authority-unavailable");
    }
  }

  async function reauthorize(request, initial) {
    const current = await resolveAuthority(request);
    if (current.output) throw new RefusedTransaction(current);
    const refused = authorityRefusal(current, request);
    if (refused) throw new RefusedTransaction(refused);
    if (JSON.stringify(current) !== JSON.stringify(initial)) {
      throw new RefusedTransaction(decision("retry-state"));
    }
  }

  async function reauthorizeRead(request, initial) {
    const current = await resolveAuthority(request);
    if (current.output) throw new RefusedTransaction(current);
    const refused = readRefusal(current);
    if (refused) throw new RefusedTransaction(refused);
    if (!sameOperationScope(current, initial)) {
      throw new RefusedTransaction(decision("retry-state"));
    }
  }

  async function resolveContinuity(request, authority) {
    try {
      const value = await resolveNamespace(clone(request), clone(authority));
      return normalizeNamespace(value, request.parentRef)
        ?? recovery("creation-continuity-unavailable");
    } catch {
      return recovery("creation-continuity-unavailable");
    }
  }


  async function revalidateContinuity(request, authority, initial) {
    const current = await resolveContinuity(request, authority);
    if (current.output) throw new RefusedTransaction(current);
    if (!sameNamespace(current, initial)) {
      throw new RefusedTransaction(recovery("creation-continuity-lost"));
    }
  }

  async function withHostScope(authority, callback, hostRefusal) {
    const scope = Object.freeze({
      collectionId: authority.collectionId,
      deviceId: authority.deviceId,
    });
    const completed = Object.freeze({});
    let active = true;
    let attempts = 0;
    let settled = false;
    let value;
    let callbackError;
    const entryPromises = [];
    const enter = (guard) => {
      attempts++;
      const entryPromise = (async () => {
        if (!active || attempts !== 1 || typeof guard?.executeOnce !== "function") {
          throw new Error("creation host scope callback is invalid");
        }
        const assertScopeLive = () => {
          if (!active || attempts !== 1) {
            throw new Error("creation host scope expired");
          }
        };
        try {
          value = await callback(guard, assertScopeLive);
          return completed;
        } catch (error) {
          callbackError = error;
          throw error;
        } finally {
          settled = true;
        }
      })();
      entryPromises.push(entryPromise);
      entryPromise.catch(() => {});
      return entryPromise;
    };
    try {
      const result = await creationHost.withCreationScope(scope, enter);
      active = false;
      await Promise.allSettled(entryPromises);
      if (attempts !== 1 || !settled || result !== completed) return hostRefusal();
      return value;
    } catch (error) {
      active = false;
      await Promise.allSettled(entryPromises);
      if (attempts === 1 && settled && error === callbackError) throw error;
      return hostRefusal();
    }
  }

  async function loadOperation(tx, key) {
    const [row] = await tx.select().from(receipts).where(eq(receipts.receiptKey, key));
    if (!row) return null;
    const record = parseCreationReceipt(row);
    if (!record) throw new RefusedTransaction(recovery("creation-receipt-invalid"));
    return { row, record };
  }

  async function reservedByAnother(tx, authority, namespace, key) {
    const [owner] = await tx.select().from(receipts).where(and(
      eq(receipts.collectionId, authority.collectionId),
      eq(receipts.deviceId, authority.deviceId),
      eq(receipts.creationNamespaceKey, namespace.namespaceKey),
      eq(receipts.creationChildKey, namespace.childKey),
    ));
    return Boolean(owner && owner.receiptKey !== key);
  }

  async function inspectConstraint(authority, request, namespace, key, digest, mode, transition) {
    try {
      return await getDb().transaction(async (tx) => {
        const existing = await loadOperation(tx, key);
        if (existing) {
          await reauthorizeRead(request, authority);
          if (existing.record.requestDigest !== digest) return decision("operation-conflict");
          if (mode === "read" || mode === "prepare" || existing.record.phase === "published"
            || existing.record.phase === "failed") return outputFor(existing.record, true);
          if (existing.record.phase !== transition.expectedPhase) {
            return decision("stale-phase", { phase: existing.record.phase });
          }
          return decision("retry-state");
        }
        if (mode === "read" || mode === "transition") {
          await reauthorizeRead(request, authority);
          return decision("retry-state");
        }
        await reauthorize(request, authority);
        if (namespace && await reservedByAnother(tx, authority, namespace, key)) {
          return decision("target-reserved");
        }
        return decision("retry-state");
      });
    } catch (error) {
      if (error instanceof RefusedTransaction) return error.decision;
      throw error;
    }
  }

  async function runResolved(mode, request, transition, authority, assertScopeLive) {
    const key = receiptKey(authority, request.operationId);
    const digest = requestDigest(request);
    let namespace = null;
    try {
      return await getDb().transaction(async (tx) => {
        const existing = await loadOperation(tx, key);
        if (existing) {
          await reauthorizeRead(request, authority);
          if (existing.record.requestDigest !== digest) return decision("operation-conflict");
          if (mode === "read" || mode === "prepare" || existing.record.phase === "published"
            || existing.record.phase === "failed") {
            return outputFor(existing.record, true);
          }
        } else if (mode !== "prepare") {
          return decision("receipt-unavailable");
        }

        const refused = authorityRefusal(authority, request);
        if (refused) throw new RefusedTransaction(refused);
        namespace = await resolveContinuity(request, authority);
        if (namespace.output) throw new RefusedTransaction(namespace);
        await reauthorize(request, authority);

        if (!existing) {
          if (await reservedByAnother(tx, authority, namespace, key)) {
            throw new RefusedTransaction(decision("target-reserved"));
          }
          const record = {
            schemaVersion: 1,
            kind: "creation",
            actorId: authority.actorId,
            collectionId: authority.collectionId,
            deviceId: authority.deviceId,
            operationId: request.operationId,
            requestDigest: digest,
            request,
            namespace,
            phase: "preparing",
            failureCode: null,
          };
          assertScopeLive();
          await tx.insert(receipts).values({
            receiptKey: key,
            actorId: authority.actorId,
            collectionId: authority.collectionId,
            deviceId: authority.deviceId,
            operation: "create",
            operationId: request.operationId,
            requestDigest: digest,
            creationNamespaceKey: namespace.namespaceKey,
            creationChildKey: namespace.childKey,
            creationPhase: record.phase,
            record: JSON.stringify(record),
          });
          await reauthorize(request, authority);
          await revalidateContinuity(request, authority, namespace);
          await reauthorize(request, authority);
          assertScopeLive();
          return outputFor(record, false);
        }

        if (!sameNamespace(namespace, existing.record.namespace)) {
          throw new RefusedTransaction(recovery("creation-continuity-lost"));
        }
        if (existing.record.phase !== transition.expectedPhase) {
          throw new RefusedTransaction(decision("stale-phase", {
            phase: existing.record.phase,
          }));
        }
        const record = {
          ...existing.record,
          phase: transition.nextPhase,
          failureCode: transition.failureCode,
        };
        assertScopeLive();
        const updated = await tx.update(receipts).set({
          creationPhase: record.phase,
          record: JSON.stringify(record),
        }).where(and(
          eq(receipts.receiptKey, key),
          eq(receipts.creationPhase, transition.expectedPhase),
        )).returning({ receiptKey: receipts.receiptKey });
        if (updated.length !== 1) throw new RefusedTransaction(decision("stale-phase"));
        await reauthorize(request, authority);
        await revalidateContinuity(request, authority, namespace);
        await reauthorize(request, authority);
        assertScopeLive();
        return outputFor(record, false);
      });
    } catch (error) {
      if (error instanceof RefusedTransaction) return error.decision;
      if (isUniqueConstraint(error) || isConcurrentWrite(error)) {
        return inspectConstraint(authority, request, namespace, key, digest, mode, transition);
      }
      throw error;
    }
  }

  async function run(mode, originalRequest, transition = null) {
    const request = normalizeRequest(originalRequest);
    if (!request) return decision("invalid-input");
    if (transition && (!exactFields(transition, ["expectedPhase", "nextPhase", "failureCode"])
      || !CREATION_PHASES.has(transition.expectedPhase)
      || !CREATION_PHASES.has(transition.nextPhase)
      || (transition.nextPhase === "failed"
        ? !matches(FAILURE_CODE, transition.failureCode)
        : transition.failureCode !== null)
      || (transition.nextPhase !== "failed"
        && TRANSITIONS.get(transition.nextPhase) !== transition.expectedPhase))) {
      return decision("invalid-input");
    }
    const authority = await resolveAuthority(request);
    if (authority.output) return authority;
    const unreadable = readRefusal(authority);
    if (unreadable) return unreadable;
    if (mode === "read") {
      return runResolved(mode, request, transition, authority, () => {});
    }
    return withHostScope(
      authority,
      (_guard, assertScopeLive) => runResolved(
        mode, request, transition, authority, assertScopeLive,
      ),
      () => recovery("creation-host-unavailable"),
    );
  }

  function requestForBinding(binding) {
    return {
      operationId: binding.operationId,
      parentRef: binding.parentRef,
      childName: binding.childName,
      acceptedPlanSha256: binding.acceptedPlanSha256,
      expectedPolicyRevision: binding.policyRevision,
    };
  }

  function bindingMatchesAuthority(binding, authority) {
    return binding.actorId === authority.actorId
      && binding.collectionId === authority.collectionId
      && binding.deviceId === authority.deviceId
      && binding.policyRevision === authority.policyRevision;
  }

  async function inspectPortSnapshot(binding, namespace, authority) {
    const request = requestForBinding(binding);
    try {
      await reauthorize(request, authority);
      if (!bindingMatchesAuthority(binding, authority)) {
        return portRefusal("denied", "creation-binding-changed");
      }
      const currentNamespace = await resolveContinuity(request, authority);
      if (currentNamespace.output) return portFailureFor(currentNamespace);
      if (!samePortValue(portNamespaceFor(currentNamespace), namespace)) {
        return portRefusal("recovery-required", "creation-continuity-lost");
      }
      const key = receiptKey(authority, request.operationId);
      const loaded = await getDb().transaction((tx) => loadOperation(tx, key));
      if (!loaded) return null;
      const { record } = loaded;
      if (record.requestDigest !== requestDigest(request)) {
        return portRefusal("operation-conflict", "creation-request-changed");
      }
      if (!samePortValue(portBindingFor(record), binding)) {
        return portRefusal("recovery-required", "creation-receipt-invalid");
      }
      if (!sameNamespace(currentNamespace, record.namespace)) {
        return portRefusal("recovery-required", "creation-continuity-lost");
      }
      if (record.phase === "failed") {
        return portRefusal(
          "creation-failed", record.failureCode ?? "creation-receipt-failed", "failed",
        );
      }
      return snapshotFor(record);
    } catch (error) {
      if (error instanceof RefusedTransaction) return portFailureFor(error.decision);
      return portRefusal("recovery-required", "creation-receipt-unavailable");
    }
  }

  async function withPortScope(bindingValue, namespaceValue, callback, phase = null) {
    const binding = normalizePortBinding(bindingValue);
    const namespace = normalizePortNamespace(namespaceValue);
    if (!binding || !namespace) {
      return portRefusal("invalid-input", "creation-port-claim-invalid", phase);
    }
    const request = requestForBinding(binding);
    const authority = await resolveAuthority(request);
    if (authority.output) return portFailureFor(authority, phase);
    const refused = authorityRefusal(authority, request);
    if (refused) return portFailureFor(refused, phase);
    if (!bindingMatchesAuthority(binding, authority)) {
      return portRefusal("denied", "creation-binding-changed", phase);
    }
    try {
      return await withHostScope(
        authority,
        (guard, assertScopeLive) => callback({
          assertScopeLive, authority, binding, guard, namespace, request,
        }),
        () => portRefusal("recovery-required", "creation-host-unavailable", phase),
      );
    } catch {
      return portRefusal("recovery-required", "creation-receipt-unavailable", phase);
    }
  }

  async function portLoad(binding, namespace) {
    return withPortScope(
      binding,
      namespace,
      ({ authority, binding: exactBinding, namespace: exactNamespace }) =>
        inspectPortSnapshot(exactBinding, exactNamespace, authority),
    );
  }

  async function portPrepare(binding, namespace) {
    return withPortScope(binding, namespace, async ({
      assertScopeLive, authority, binding: exactBinding, namespace: exactNamespace, request,
    }) => {
      const existing = await inspectPortSnapshot(exactBinding, exactNamespace, authority);
      if (existing !== null) return existing;
      const result = await runResolved(
        "prepare", request, null, authority, assertScopeLive,
      );
      if (result.output.code !== "preparing") return portFailureFor(result);
      return inspectPortSnapshot(exactBinding, exactNamespace, authority);
    });
  }

  async function portTransition(
    bindingValue, snapshotValue, namespaceValue, expectedPhase, nextPhase,
  ) {
    const snapshot = normalizePortSnapshot(snapshotValue);
    const binding = normalizePortBinding(bindingValue);
    const namespace = normalizePortNamespace(namespaceValue);
    if (!snapshot || !binding || !namespace
      || snapshot.phase !== expectedPhase
      || TRANSITIONS.get(nextPhase) !== expectedPhase
      || !samePortValue(snapshot.binding, binding)
      || !samePortValue(snapshot.namespace, namespace)) {
      return portRefusal("stale-phase", "creation-phase-invalid", snapshot?.phase ?? null);
    }
    return withPortScope(binding, namespace, async ({
      assertScopeLive, authority, request,
    }) => {
      const current = await inspectPortSnapshot(binding, namespace, authority);
      if (!samePortValue(current, snapshot)) {
        return normalizePortRefusal(current)
          ?? portRefusal("stale-phase", "creation-phase-changed", snapshot.phase);
      }
      const transition = { expectedPhase, nextPhase, failureCode: null };
      const result = await runResolved(
        "transition", request, transition, authority, assertScopeLive,
      );
      if (result.output.code !== nextPhase) return portFailureFor(result, snapshot.phase);
      return inspectPortSnapshot(binding, namespace, authority);
    }, snapshot.phase);
  }

  async function executeGuarded(
    guard, expectedAdmission, execute, phase, assertScopeLive,
  ) {
    const completed = Object.freeze({});
    const calls = [];
    let active = true;
    let attempts = 0;
    let settled = false;
    let callbackError;
    let value;
    const invoke = () => {
      attempts++;
      const call = (async () => {
        if (!active || attempts !== 1) {
          throw new Error("creation effect callback is invalid");
        }
        try {
          assertScopeLive();
          value = await execute();
          return completed;
        } catch (error) {
          callbackError = error;
          throw error;
        } finally {
          settled = true;
        }
      })();
      calls.push(call);
      call.catch(() => {});
      return call;
    };
    let result;
    try {
      result = await guard.executeOnce(clone(expectedAdmission), invoke);
    } catch {
      active = false;
      await Promise.allSettled(calls);
      return portRefusal("recovery-required", "creation-effect-uncertain", phase);
    }
    active = false;
    await Promise.allSettled(calls);
    if (attempts === 0) {
      return normalizePortRefusal(result)
        ?? portRefusal("recovery-required", "creation-effect-uncertain", phase);
    }
    if (attempts !== 1 || !settled || callbackError || result !== completed) {
      return portRefusal("recovery-required", "creation-effect-uncertain", phase);
    }
    return value;
  }

  async function portAdmitAndExecute(
    bindingValue, snapshotValue, namespaceValue, effect, execute,
  ) {
    const snapshot = normalizePortSnapshot(snapshotValue);
    const binding = normalizePortBinding(bindingValue);
    const namespace = normalizePortNamespace(namespaceValue);
    const expectedPhase = EFFECT_PHASES.get(effect);
    if (!snapshot || !binding || !namespace || typeof execute !== "function"
      || expectedPhase !== snapshot.phase
      || !samePortValue(snapshot.binding, binding)
      || !samePortValue(snapshot.namespace, namespace)) {
      return portRefusal(
        "denied", "creation-effect-not-authorized", snapshot?.phase ?? null,
      );
    }
    return withPortScope(binding, namespace, async ({
      assertScopeLive, authority, guard, request,
    }) => {
      const current = await inspectPortSnapshot(binding, namespace, authority);
      if (!samePortValue(current, snapshot)) {
        return normalizePortRefusal(current)
          ?? portRefusal("denied", "creation-effect-not-authorized", snapshot.phase);
      }
      try {
        await reauthorize(request, authority);
        await revalidateContinuity(request, authority, {
          parentRef: request.parentRef,
          ...namespace,
          exclusiveControl: true,
        });
      } catch (error) {
        return error instanceof RefusedTransaction
          ? portFailureFor(error.decision, snapshot.phase)
          : portRefusal("recovery-required", "creation-effect-uncertain", snapshot.phase);
      }
      const expectedAdmission = Object.freeze({
        binding: snapshot.binding,
        snapshot,
        namespace: snapshot.namespace,
        effect,
      });
      return executeGuarded(
        guard, expectedAdmission, execute, snapshot.phase, assertScopeLive,
      );
    }, snapshot.phase);
  }

  const move = (request, expectedPhase, nextPhase) => run("transition", request, {
    expectedPhase, nextPhase, failureCode: null,
  });
  const effectPort = Object.freeze({
    load: portLoad,
    prepare: portPrepare,
    transition: portTransition,
    admitAndExecute: portAdmitAndExecute,
  });
  return Object.freeze({
    prepare: (request) => run("prepare", request),
    read: (request) => run("read", request),
    markPrepared: (request) => move(request, "preparing", "prepared"),
    markPublishing: (request) => move(request, "prepared", "publishing"),
    markPublished: (request) => move(request, "publishing", "published"),
    fail: (request, expectedPhase, failureCode) => run("transition", request, {
      expectedPhase, nextPhase: "failed", failureCode,
    }),
    effectPort,
  });
}
