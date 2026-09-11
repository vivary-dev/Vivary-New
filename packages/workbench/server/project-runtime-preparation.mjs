/** Private project-session preparation. Production composition is unavailable. */
import { createHash } from "node:crypto";

const PREPARE_FIELDS = Object.freeze([
  "schemaVersion", "operationId", "scopeKey", "projectId", "expectedBindingRevision",
  "expectedPolicyRevision", "role",
]);
const CANCEL_FIELDS = Object.freeze([
  "schemaVersion", "operationId", "scopeKey", "projectId", "expectedBindingRevision",
  "expectedPolicyRevision",
]);
const START_LOOKUP_FIELDS = Object.freeze([
  "schemaVersion", "preparationId", "preparationOperationId", "scopeKey", "projectId",
  "expectedBindingRevision", "expectedPolicyRevision",
]);
const IDENTITY_FIELDS = Object.freeze([
  "ownerEmail", "orgId", "actorId", "collectionId", "deviceId", "projectId", "bindingId",
  "bindingRevision", "rootId", "contentRevision", "locationRef", "policyRevision", "harnessName",
  "runtimeVersion", "executionLocation", "authorityContract", "runtimeConfigurationRevision",
]);
const FACT_FIELDS = Object.freeze(["scopeKey", "identity"]);
const AUTHORITY_FIELDS = Object.freeze([
  "roles", "roleContractRevision", "preparationAuthorityRevision",
]);
const DEPENDENCY_FIELDS = Object.freeze([
  "resolveFacts", "resolvePreparationAuthority", "preparationHost", "receiptPort", "allocateId",
  "createThread", "getThread",
]);
const PORT_METHODS = Object.freeze([
  "read", "reserve", "beginThreadCreation", "recordThreadCandidate", "verifySettlement",
  "quarantine", "cancelBeforeCreation",
]);
const ROLES = new Set(["planner", "developer", "qa"]);
const REFUSAL_CODES = new Set(["denied", "stale-claim", "ambiguous-binding", "unavailable"]);
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const INNER_COMPLETION = Object.freeze({});
const OUTER_COMPLETION = Object.freeze({});
const INVALID_HOST_CALLBACK = Object.freeze(new Error("runtime preparation host callback is invalid"));
const INVALID_RECEIVING_HANDLE = Object.freeze(new Error("runtime preparation receiving handle is invalid"));

const clone = value => structuredClone(value);
const exactObject = (value, fields) => value !== null && typeof value === "object"
  && !Array.isArray(value) && Object.keys(value).length === fields.length
  && fields.every(field => Object.hasOwn(value, field));
const identifier = value => typeof value === "string" && value.isWellFormed() && ID.test(value);
const safeText = value => typeof value === "string" && value.length >= 1
  && value.length <= 512 && value.isWellFormed();
const version = value => typeof value === "string" && value.isWellFormed() && VERSION.test(value);
const positiveRevision = value => Number.isSafeInteger(value) && value > 0;
const sha256 = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const refused = code => Object.freeze({ code });
const recovery = () => refused("recovery-required");

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

function normalizePrepareRequest(value) {
  if (!exactObject(value, PREPARE_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.operationId) || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision) || !ROLES.has(value.role)) return null;
  return Object.freeze(Object.fromEntries(PREPARE_FIELDS.map(field => [field, value[field]])));
}

function normalizeCancelRequest(value) {
  if (!exactObject(value, CANCEL_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.operationId) || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision)) return null;
  return Object.freeze(Object.fromEntries(CANCEL_FIELDS.map(field => [field, value[field]])));
}

function normalizeStartLookup(value) {
  if (!exactObject(value, START_LOOKUP_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.preparationId) || !identifier(value.preparationOperationId)
    || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision)) return null;
  return Object.freeze(Object.fromEntries(START_LOOKUP_FIELDS.map(field => [field, value[field]])));
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
  return Object.freeze(Object.fromEntries(IDENTITY_FIELDS.map(field => [field, value[field]])));
}

function normalizeFacts(value) {
  if (!exactObject(value, FACT_FIELDS) || !identifier(value.scopeKey)) return null;
  const identity = normalizeIdentity(value.identity);
  return identity ? Object.freeze({ scopeKey: value.scopeKey, identity }) : null;
}

function normalizeAuthority(value) {
  if (!exactObject(value, AUTHORITY_FIELDS) || !Array.isArray(value.roles)
    || value.roles.length > ROLES.size || value.roles.some(role => !ROLES.has(role))
    || new Set(value.roles).size !== value.roles.length
    || !positiveRevision(value.roleContractRevision)
    || !positiveRevision(value.preparationAuthorityRevision)) return null;
  return Object.freeze({ roles: Object.freeze([...value.roles].sort()),
    roleContractRevision: value.roleContractRevision,
    preparationAuthorityRevision: value.preparationAuthorityRevision });
}

function normalizeRefusal(value) {
  return exactObject(value, ["code"]) && REFUSAL_CODES.has(value.code) ? refused(value.code) : null;
}

function parseDependencies(dependencies) {
  if (dependencies === undefined) return null;
  if (!exactObject(dependencies, DEPENDENCY_FIELDS)
    || typeof dependencies.resolveFacts !== "function"
    || typeof dependencies.resolvePreparationAuthority !== "function"
    || typeof dependencies.preparationHost?.withCreationScope !== "function"
    || PORT_METHODS.some(method => typeof dependencies.receiptPort?.[method] !== "function")
    || typeof dependencies.allocateId !== "function"
    || typeof dependencies.createThread !== "function"
    || typeof dependencies.getThread !== "function") {
    throw new TypeError("runtime preparation requires exact trusted dependencies");
  }
  const receiptPort = Object.freeze(Object.fromEntries(PORT_METHODS.map(method => [
    method, dependencies.receiptPort[method].bind(dependencies.receiptPort),
  ])));
  const preparationHost = Object.freeze({
    withCreationScope: dependencies.preparationHost.withCreationScope.bind(
      dependencies.preparationHost,
    ),
  });
  return Object.freeze({
    resolveFacts: dependencies.resolveFacts.bind(dependencies),
    resolvePreparationAuthority: dependencies.resolvePreparationAuthority.bind(dependencies),
    preparationHost,
    receiptPort,
    allocateId: dependencies.allocateId.bind(dependencies),
    createThread: dependencies.createThread.bind(dependencies),
    getThread: dependencies.getThread.bind(dependencies),
  });
}

function bindingDigest(identity) {
  const ordered = Object.fromEntries(IDENTITY_FIELDS.map(field => [field, identity[field]]));
  return sha256(ordered);
}

function requestTuple(request) {
  return [1, request.operationId, request.scopeKey, request.projectId,
    request.expectedBindingRevision, request.expectedPolicyRevision, request.role];
}

function intentDigest(request, identity, authority) {
  return sha256([requestTuple(request), identity, request.role,
    authority.roleContractRevision, authority.preparationAuthorityRevision]);
}

function sameIntent(left, right) {
  return left.bindingIdentityDigest === right.bindingIdentityDigest
    && left.roleContractRevision === right.roleContractRevision
    && left.preparationAuthorityRevision === right.preparationAuthorityRevision
    && same(left.request, right.request) && same(left.identity, right.identity);
}

function exactThread(thread, record) {
  return Boolean(thread)
    && thread.id === record.nativeThreadId
    && thread.ownerEmail === record.identity.ownerEmail
    && thread.orgId === record.identity.orgId
    && thread.title === "Project session"
    && thread.visibility === "private"
    && exactObject(thread.scope, ["type", "id"])
    && thread.scope.type === "vivary-project-runtime-v1"
    && thread.scope.id === record.bindingIdentityDigest;
}

function portResult(value) {
  return value !== null && typeof value === "object" && typeof value.code === "string" ? value : null;
}

function explicitHostRefusal(value) {
  return exactObject(value, ["code"])
    && ["denied", "stale-claim", "recovery-required"].includes(value.code)
    ? Object.freeze({ kind: "refused", code: value.code })
    : null;
}

async function observeGuard(guard, admission, execute, outerLive) {
  let open = true;
  let calls = 0;
  let callbackSettled = false;
  let callbackSucceeded = false;
  let callbackError;
  let callbackValue;
  const invoke = () => {
    calls += 1;
    const promise = (async () => {
      if (!open || !outerLive() || calls !== 1) throw INVALID_HOST_CALLBACK;
      try {
        callbackValue = await execute(() => {
          if (!open || !outerLive() || calls !== 1) throw INVALID_HOST_CALLBACK;
        });
        callbackSucceeded = true;
        return INNER_COMPLETION;
      } catch (error) {
        callbackError = error;
        throw error;
      } finally {
        callbackSettled = true;
      }
    })();
    promise.catch(() => {});
    return promise;
  };
  let result;
  let hostError;
  let rejected = false;
  try {
    result = await guard.executeOnce(clone(admission), invoke);
  } catch (error) {
    rejected = true;
    hostError = error;
  }
  const observed = Object.freeze({ calls, callbackSettled, callbackSucceeded,
    sentinelMatched: !rejected && result === INNER_COMPLETION });
  open = false;
  if (calls === 0 && !rejected) {
    const refusal = explicitHostRefusal(result);
    return refusal ? { valid: true, outcome: refusal, observed } : { valid: false, observed };
  }
  if (calls === 1 && callbackSettled && callbackSucceeded && !rejected
    && result === INNER_COMPLETION) return { valid: true, outcome: callbackValue, observed };
  if (calls === 1 && callbackSettled && !callbackSucceeded && rejected
    && hostError === callbackError) {
    return { valid: true, outcome: Object.freeze({ kind: "callback-error" }), observed };
  }
  return { valid: false, observed };
}

async function observeHost(host, scope, admission, execute) {
  let open = true;
  let calls = 0;
  let callbackSettled = false;
  let callbackSucceeded = false;
  let callbackError;
  let innerObservation;
  const enter = guard => {
    calls += 1;
    const promise = (async () => {
      if (!open || calls !== 1 || typeof guard?.executeOnce !== "function") {
        throw INVALID_HOST_CALLBACK;
      }
      const outerLive = () => open && calls === 1;
      try {
        innerObservation = await observeGuard(guard, admission,
          assertInnerLive => execute(() => {
            if (!outerLive()) throw INVALID_HOST_CALLBACK;
            assertInnerLive();
          }), outerLive);
        if (!innerObservation.valid) throw INVALID_HOST_CALLBACK;
        callbackSucceeded = true;
        return OUTER_COMPLETION;
      } catch (error) {
        callbackError = error;
        throw error;
      } finally {
        callbackSettled = true;
      }
    })();
    promise.catch(() => {});
    return promise;
  };
  let result;
  let hostError;
  let rejected = false;
  try {
    result = await host.withCreationScope(Object.freeze(clone(scope)), enter);
  } catch (error) {
    rejected = true;
    hostError = error;
  }
  const observed = Object.freeze({ calls, callbackSettled, callbackSucceeded,
    sentinelMatched: !rejected && result === OUTER_COMPLETION });
  open = false;
  if (calls === 0 && !rejected) {
    const refusal = explicitHostRefusal(result);
    return refusal ? { valid: true, outcome: refusal, observed } : { valid: false, observed };
  }
  const outerValid = calls === 1 && callbackSettled
    && ((callbackSucceeded && !rejected && result === OUTER_COMPLETION)
      || (!callbackSucceeded && rejected && hostError === callbackError));
  if (!outerValid || !innerObservation?.valid) return { valid: false, observed, innerObservation };
  return { valid: true, outcome: innerObservation.outcome, observed,
    innerObservation: innerObservation.observed };
}

/** The returned service has no route or action surface. */
export function createProjectRuntimePreparationService(dependencies) {
  const configuration = parseDependencies(dependencies);
  let admissionOpen = true;
  const activeOperations = new Set();
  let issuerPromise;
  if (configuration) {
    try {
      issuerPromise = Promise.resolve(configuration.allocateId("issuer-incarnation")).then(value => {
        if (!identifier(value)) throw new TypeError("invalid runtime preparation incarnation id");
        return value;
      });
      issuerPromise.catch(() => {});
    } catch (error) {
      issuerPromise = Promise.reject(error);
      issuerPromise.catch(() => {});
    }
  }

  async function allocate(kind) {
    try {
      const value = await configuration.allocateId(kind);
      return identifier(value) ? value : null;
    } catch { return null; }
  }

  async function resolveFacts(request, authenticatedContext) {
    let raw;
    try { raw = await configuration.resolveFacts(clone(request), clone(authenticatedContext)); }
    catch { return refused("unavailable"); }
    const refusal = normalizeRefusal(raw);
    if (refusal) return refusal;
    const facts = normalizeFacts(raw);
    if (!facts) return refused("unavailable");
    if (facts.scopeKey !== request.scopeKey
      || facts.identity.projectId !== request.projectId
      || facts.identity.bindingRevision !== request.expectedBindingRevision
      || facts.identity.policyRevision !== request.expectedPolicyRevision) return refused("stale-claim");
    return facts;
  }

  async function resolveIntent(request, authenticatedContext, issuerIncarnationId, expected = null) {
    const facts = await resolveFacts(request, authenticatedContext);
    if (facts.code) return facts;
    let rawAuthority;
    try {
      rawAuthority = await configuration.resolvePreparationAuthority(
        clone(request), clone(authenticatedContext), clone(facts),
      );
    } catch { return refused("unavailable"); }
    const authorityRefusal = normalizeRefusal(rawAuthority);
    if (authorityRefusal) return authorityRefusal;
    const authority = normalizeAuthority(rawAuthority);
    if (!authority) return refused("unavailable");
    if (!authority.roles.includes(request.role)) return refused("denied");
    const intent = Object.freeze({ request, identity: facts.identity,
      bindingIdentityDigest: bindingDigest(facts.identity),
      roleContractRevision: authority.roleContractRevision,
      preparationAuthorityRevision: authority.preparationAuthorityRevision,
      issuerIncarnationId });
    if (expected && !sameIntent(intent, expected)) return refused("stale-claim");
    return Object.freeze({ code: "authorized", facts, authority, intent,
      requestDigest: intentDigest(request, facts.identity, authority) });
  }

  async function quarantineBestEffort(intent, reason) {
    try { return portResult(await configuration.receiptPort.quarantine(intent, reason)); }
    catch { return null; }
  }

  async function readNativeThread(record) {
    try { return await configuration.getThread(record.nativeThreadId); }
    catch { return null; }
  }

  async function prepareInsideAdmission(request, authenticatedContext, issuerIncarnationId,
    expected, assertLive, working) {
    assertLive();
    const authorized = await resolveIntent(request, authenticatedContext, issuerIncarnationId, expected);
    assertLive();
    if (authorized.code !== "authorized") return Object.freeze({ kind: "refused", code: authorized.code });
    const { intent } = authorized;
    working.intent = intent;
    let loaded;
    try { loaded = portResult(await configuration.receiptPort.read(intent)); }
    catch { loaded = null; }
    assertLive();
    if (!loaded || ["invalid", "unavailable"].includes(loaded.code)) {
      return Object.freeze({ kind: "recovery", intent });
    }
    if (loaded.code === "conflict") {
      return same(loaded.record?.request, request)
        ? Object.freeze({ kind: "refused", code: "stale-claim", intent })
        : Object.freeze({ kind: "conflict", intent });
    }
    let record;
    if (loaded.code === "missing") {
      const preparationId = await allocate("preparation");
      const nativeThreadId = await allocate("native-thread");
      assertLive();
      if (!preparationId || !nativeThreadId || preparationId === nativeThreadId) {
        return Object.freeze({ kind: "recovery", intent });
      }
      let reserved;
      try {
        reserved = portResult(await configuration.receiptPort.reserve(intent,
          Object.freeze({ preparationId, nativeThreadId })));
      } catch { reserved = null; }
      assertLive();
      if (!reserved || !["created", "ok"].includes(reserved.code)) {
        return Object.freeze({ kind: reserved?.code === "conflict" ? "conflict" : "recovery", intent });
      }
      record = reserved.record;
    } else {
      record = loaded.record;
    }
    if (record.issuerIncarnationId !== issuerIncarnationId) {
      await quarantineBestEffort(intent, "foreign-incarnation");
      assertLive();
      return Object.freeze({ kind: "recovery", intent });
    }
    if (record.phase === "thread-prepared") {
      const thread = await readNativeThread(record);
      assertLive();
      if (!exactThread(thread, record)) {
        await quarantineBestEffort(intent, "settlement-uncertain");
        assertLive();
        return Object.freeze({ kind: "recovery", intent });
      }
      return Object.freeze({ kind: "prepared-replay", intent, record });
    }
    if (record.phase === "cancelled-before-create") {
      return Object.freeze({ kind: "cancelled", intent, record });
    }
    if (record.phase !== "reserved") return Object.freeze({ kind: "recovery", intent });

    const beforeCreation = await resolveIntent(request, authenticatedContext,
      issuerIncarnationId, intent);
    assertLive();
    if (beforeCreation.code !== "authorized") {
      return Object.freeze({ kind: "refused", code: beforeCreation.code, intent });
    }
    const attemptId = await allocate("thread-attempt");
    assertLive();
    if (!attemptId) return Object.freeze({ kind: "recovery", intent });
    let creating;
    try { creating = portResult(await configuration.receiptPort.beginThreadCreation(intent, attemptId)); }
    catch { creating = null; }
    assertLive();
    if (!creating || creating.code !== "changed") return Object.freeze({ kind: "recovery", intent });

    const beforeEffect = await resolveIntent(request, authenticatedContext,
      issuerIncarnationId, intent);
    assertLive();
    if (beforeEffect.code !== "authorized") {
      await quarantineBestEffort(intent, "effect-uncertain");
      assertLive();
      return Object.freeze({ kind: "refused", code: beforeEffect.code, intent });
    }
    let returnedThread;
    try {
      returnedThread = await configuration.createThread(intent.identity.ownerEmail, {
        id: creating.record.nativeThreadId,
        title: "Project session",
        scope: { type: "vivary-project-runtime-v1", id: intent.bindingIdentityDigest },
        orgId: intent.identity.orgId,
      });
    } catch {
      await quarantineBestEffort(intent, "effect-uncertain");
      assertLive();
      return Object.freeze({ kind: "recovery", intent });
    }
    assertLive();
    const storedThread = await readNativeThread(creating.record);
    assertLive();
    if (!exactThread(returnedThread, creating.record) || !exactThread(storedThread, creating.record)) {
      await quarantineBestEffort(intent, "effect-uncertain");
      assertLive();
      return Object.freeze({ kind: "recovery", intent });
    }
    const beforeCandidate = await resolveIntent(request, authenticatedContext,
      issuerIncarnationId, intent);
    assertLive();
    if (beforeCandidate.code !== "authorized") {
      await quarantineBestEffort(intent, "effect-uncertain");
      assertLive();
      return Object.freeze({ kind: "refused", code: beforeCandidate.code, intent });
    }
    let candidate;
    try {
      candidate = portResult(await configuration.receiptPort.recordThreadCandidate(intent, attemptId));
    } catch { candidate = null; }
    assertLive();
    if (!candidate || candidate.code !== "changed") {
      await quarantineBestEffort(intent, "effect-uncertain");
      assertLive();
      return Object.freeze({ kind: "recovery", intent });
    }
    return Object.freeze({ kind: "candidate", intent, record: candidate.record, attemptId });
  }

  async function finishPrepared(outcome, request, authenticatedContext, issuerIncarnationId, replayed) {
    if (!admissionOpen) return recovery();
    const current = await resolveIntent(request, authenticatedContext, issuerIncarnationId, outcome.intent);
    if (!admissionOpen) return recovery();
    if (current.code !== "authorized") return refused(current.code);
    let loaded;
    try { loaded = portResult(await configuration.receiptPort.read(outcome.intent)); }
    catch { loaded = null; }
    if (!admissionOpen) return recovery();
    if (!loaded || loaded.code !== "ok" || loaded.record.phase !== "thread-prepared"
      || loaded.record.issuerIncarnationId !== issuerIncarnationId) return recovery();
    const thread = await readNativeThread(loaded.record);
    if (!admissionOpen) return recovery();
    if (!exactThread(thread, loaded.record)) return recovery();
    return Object.freeze({ code: "prepared", preparationId: loaded.record.preparationId, replayed });
  }

  async function prepare(originalRequest, authenticatedContext) {
    const request = normalizePrepareRequest(originalRequest);
    if (!request) return refused("invalid-input");
    if (!configuration) return refused("unavailable");
    if (!admissionOpen) return recovery();
    let issuerIncarnationId;
    try { issuerIncarnationId = await issuerPromise; } catch { return refused("unavailable"); }
    if (!admissionOpen) return recovery();
    const initial = await resolveIntent(request, authenticatedContext, issuerIncarnationId);
    if (!admissionOpen) return recovery();
    if (initial.code !== "authorized") return refused(initial.code);
    const operationKey = `${initial.facts.identity.actorId}:${initial.facts.identity.collectionId}:`
      + `${initial.facts.identity.deviceId}:${request.operationId}`;
    if (activeOperations.has(operationKey)) return recovery();
    activeOperations.add(operationKey);
    const working = { intent: initial.intent };
    try {
      if (!admissionOpen) return recovery();
      const admission = Object.freeze({ schemaVersion: 1, operation: "runtime-prepare",
        operationId: request.operationId, requestDigest: initial.requestDigest,
        collectionId: initial.facts.identity.collectionId, deviceId: initial.facts.identity.deviceId });
      const observed = await observeHost(configuration.preparationHost,
        { collectionId: initial.facts.identity.collectionId, deviceId: initial.facts.identity.deviceId },
        admission,
        assertLive => prepareInsideAdmission(request, authenticatedContext, issuerIncarnationId,
          initial.intent, () => {
            assertLive();
            if (!admissionOpen) throw INVALID_HOST_CALLBACK;
          }, working));
      if (!admissionOpen && observed.valid) return recovery();
      if (!observed.valid) {
        admissionOpen = false;
        await quarantineBestEffort(working.intent, "host-invalid");
        return recovery();
      }
      if (!admissionOpen) return recovery();
      const outcome = observed.outcome;
      if (!outcome || outcome.kind === "callback-error") return recovery();
      if (outcome.kind === "refused") return refused(outcome.code);
      if (outcome.kind === "conflict") return refused("operation-conflict");
      if (outcome.kind === "recovery") return recovery();
      if (outcome.kind === "cancelled") return refused("cancelled-before-create");
      if (outcome.kind === "prepared-replay") {
        return finishPrepared(outcome, request, authenticatedContext, issuerIncarnationId, true);
      }
      if (outcome.kind !== "candidate") return recovery();
      if (!admissionOpen) return recovery();
      let settled;
      try {
        settled = portResult(await configuration.receiptPort.verifySettlement(
          outcome.intent, outcome.attemptId,
        ));
      } catch { settled = null; }
      if (!admissionOpen) return recovery();
      if (!settled || settled.code !== "changed") {
        await quarantineBestEffort(outcome.intent, "settlement-uncertain");
        return recovery();
      }
      return finishPrepared(outcome, request, authenticatedContext, issuerIncarnationId, false);
    } finally {
      activeOperations.delete(operationKey);
    }
  }

  async function cancelInsideAdmission(request, authenticatedContext, issuerIncarnationId,
    initialFacts, assertLive, working) {
    assertLive();
    const currentFacts = await resolveFacts(request, authenticatedContext);
    assertLive();
    if (currentFacts.code) return Object.freeze({ kind: "refused", code: currentFacts.code });
    if (!same(currentFacts, initialFacts)) return Object.freeze({ kind: "refused", code: "stale-claim" });
    const lookup = Object.freeze({ operationId: request.operationId, identity: currentFacts.identity });
    let loaded;
    try { loaded = portResult(await configuration.receiptPort.read(lookup)); }
    catch { loaded = null; }
    assertLive();
    if (!loaded || ["invalid", "unavailable", "conflict"].includes(loaded.code)) {
      return Object.freeze({ kind: "recovery" });
    }
    if (loaded.code === "missing") return Object.freeze({ kind: "cancelled" });
    const record = loaded.record;
    if (record.request.scopeKey !== request.scopeKey || record.request.projectId !== request.projectId
      || record.request.expectedBindingRevision !== request.expectedBindingRevision
      || record.request.expectedPolicyRevision !== request.expectedPolicyRevision) {
      return Object.freeze({ kind: "conflict" });
    }
    const reconstructed = normalizePrepareRequest(record.request);
    if (!reconstructed) return Object.freeze({ kind: "recovery" });
    const authorized = await resolveIntent(reconstructed, authenticatedContext, issuerIncarnationId);
    assertLive();
    if (authorized.code !== "authorized") return Object.freeze({ kind: "refused", code: authorized.code });
    working.intent = authorized.intent;
    if (!sameIntent(authorized.intent, {
      request: record.request,
      identity: record.identity,
      bindingIdentityDigest: record.bindingIdentityDigest,
      roleContractRevision: record.roleContractRevision,
      preparationAuthorityRevision: record.preparationAuthorityRevision,
    })) return Object.freeze({ kind: "refused", code: "stale-claim" });
    if (record.issuerIncarnationId !== issuerIncarnationId) {
      await quarantineBestEffort(authorized.intent, "foreign-incarnation");
      assertLive();
      return Object.freeze({ kind: "recovery" });
    }
    if (record.phase === "thread-prepared") {
      const thread = await readNativeThread(record);
      assertLive();
      return exactThread(thread, record)
        ? Object.freeze({ kind: "already-prepared" })
        : Object.freeze({ kind: "recovery" });
    }
    if (record.phase === "cancelled-before-create") return Object.freeze({ kind: "cancelled" });
    if (record.phase !== "reserved") return Object.freeze({ kind: "recovery" });
    let cancelled;
    try { cancelled = portResult(await configuration.receiptPort.cancelBeforeCreation(authorized.intent)); }
    catch { cancelled = null; }
    assertLive();
    return cancelled?.record?.phase === "cancelled-before-create"
      ? Object.freeze({ kind: "cancelled" })
      : Object.freeze({ kind: "recovery" });
  }

  async function cancelPreparation(originalRequest, authenticatedContext) {
    const request = normalizeCancelRequest(originalRequest);
    if (!request) return refused("invalid-input");
    if (!configuration) return refused("unavailable");
    if (!admissionOpen) return recovery();
    let issuerIncarnationId;
    try { issuerIncarnationId = await issuerPromise; } catch { return refused("unavailable"); }
    if (!admissionOpen) return recovery();
    const initialFacts = await resolveFacts(request, authenticatedContext);
    if (!admissionOpen) return recovery();
    if (initialFacts.code) return refused(initialFacts.code);
    const operationKey = `${initialFacts.identity.actorId}:${initialFacts.identity.collectionId}:`
      + `${initialFacts.identity.deviceId}:${request.operationId}`;
    if (activeOperations.has(operationKey)) return recovery();
    activeOperations.add(operationKey);
    const working = { intent: null };
    try {
      if (!admissionOpen) return recovery();
      const admission = Object.freeze({ schemaVersion: 1, operation: "runtime-cancel",
        operationId: request.operationId, collectionId: initialFacts.identity.collectionId,
        deviceId: initialFacts.identity.deviceId });
      const observed = await observeHost(configuration.preparationHost,
        { collectionId: initialFacts.identity.collectionId, deviceId: initialFacts.identity.deviceId },
        admission,
        assertLive => cancelInsideAdmission(request, authenticatedContext, issuerIncarnationId,
          initialFacts, () => {
            assertLive();
            if (!admissionOpen) throw INVALID_HOST_CALLBACK;
          }, working));
      if (!admissionOpen && observed.valid) return recovery();
      if (!observed.valid) {
        admissionOpen = false;
        if (working.intent) await quarantineBestEffort(working.intent, "host-invalid");
        return recovery();
      }
      if (!admissionOpen) return recovery();
      const outcome = observed.outcome;
      if (!outcome || outcome.kind === "callback-error" || outcome.kind === "recovery") return recovery();
      if (outcome.kind === "refused") return refused(outcome.code);
      if (outcome.kind === "conflict") return refused("operation-conflict");
      if (outcome.kind === "already-prepared") return refused("already-prepared");
      return outcome.kind === "cancelled" ? refused("cancelled-before-create") : recovery();
    } finally {
      activeOperations.delete(operationKey);
    }
  }

  async function validatePreparedForStart(lookup, authenticatedContext,
    issuerIncarnationId, assertLive, expectedRecord = null) {
    assertLive();
    const facts = await resolveFacts(lookup, authenticatedContext);
    assertLive();
    if (facts.code) return Object.freeze({ code: facts.code });
    const receiptLookup = Object.freeze({ operationId: lookup.preparationOperationId,
      identity: facts.identity });
    let loaded;
    try { loaded = portResult(await configuration.receiptPort.read(receiptLookup)); }
    catch { loaded = null; }
    assertLive();
    if (!loaded || ["invalid", "unavailable", "conflict"].includes(loaded.code)) return recovery();
    if (loaded.code === "missing") return recovery();
    const record = loaded.record;
    if (record.preparationId !== lookup.preparationId
      || record.operationId !== lookup.preparationOperationId
      || record.request.operationId !== lookup.preparationOperationId
      || record.request.scopeKey !== lookup.scopeKey
      || record.request.projectId !== lookup.projectId
      || record.request.expectedBindingRevision !== lookup.expectedBindingRevision
      || record.request.expectedPolicyRevision !== lookup.expectedPolicyRevision) {
      return refused("stale-claim");
    }
    const reconstructed = normalizePrepareRequest(record.request);
    if (!reconstructed) return recovery();
    const authorized = await resolveIntent(reconstructed, authenticatedContext, issuerIncarnationId);
    assertLive();
    if (authorized.code !== "authorized") return refused(authorized.code);
    if (!sameIntent(authorized.intent, {
      request: record.request,
      identity: record.identity,
      bindingIdentityDigest: record.bindingIdentityDigest,
      roleContractRevision: record.roleContractRevision,
      preparationAuthorityRevision: record.preparationAuthorityRevision,
    }) || record.requestDigest !== authorized.requestDigest) return refused("stale-claim");
    if (record.issuerIncarnationId !== issuerIncarnationId) {
      await quarantineBestEffort(authorized.intent, "foreign-incarnation");
      assertLive();
      return recovery();
    }
    if (record.phase === "cancelled-before-create") return refused("cancelled-before-create");
    if (record.phase !== "thread-prepared") return recovery();
    const thread = await readNativeThread(record);
    assertLive();
    if (!exactThread(thread, record)) return recovery();
    if (expectedRecord && !same(record, expectedRecord)) return refused("stale-claim");
    return Object.freeze({ code: "prepared", intent: authorized.intent,
      record: deepFreeze(clone(record)) });
  }

  async function withPreparedForStart(originalLookup, authenticatedContext, consume) {
    const lookup = normalizeStartLookup(originalLookup);
    if (!lookup || typeof consume !== "function") return refused("invalid-input");
    if (!configuration) return refused("unavailable");
    if (!admissionOpen) return recovery();
    let issuerIncarnationId;
    try { issuerIncarnationId = await issuerPromise; } catch { return refused("unavailable"); }
    if (!admissionOpen) return recovery();

    // Resolve once only to route the exact existing operation. Validation is
    // repeated under the operation token before the receiving handle is issued.
    const routingFacts = await resolveFacts(lookup, authenticatedContext);
    if (!admissionOpen) return recovery();
    if (routingFacts.code) return refused(routingFacts.code);
    const operationKey = `${routingFacts.identity.actorId}:${routingFacts.identity.collectionId}:`
      + `${routingFacts.identity.deviceId}:${lookup.preparationOperationId}`;
    if (activeOperations.has(operationKey)) return recovery();
    activeOperations.add(operationKey);
    let handleOpen = true;
    let expectedRecord = null;
    const assertLive = () => {
      if (!handleOpen || !admissionOpen || !activeOperations.has(operationKey)) {
        throw INVALID_RECEIVING_HANDLE;
      }
    };
    const revalidate = async () => {
      assertLive();
      const current = await validatePreparedForStart(lookup, authenticatedContext,
        issuerIncarnationId, assertLive, expectedRecord);
      assertLive();
      if (current.code !== "prepared") {
        handleOpen = false;
        throw Object.freeze({ kind: "runtime-preparation-refusal", code: current.code });
      }
      return current.record;
    };
    try {
      const initial = await validatePreparedForStart(lookup, authenticatedContext,
        issuerIncarnationId, assertLive);
      assertLive();
      if (initial.code !== "prepared") return refused(initial.code);
      const initialOperationKey = `${initial.intent.identity.actorId}:`
        + `${initial.intent.identity.collectionId}:${initial.intent.identity.deviceId}:`
        + `${initial.intent.request.operationId}`;
      if (initialOperationKey !== operationKey) return refused("stale-claim");
      expectedRecord = initial.record;
      const lease = Object.freeze({ prepared: deepFreeze(clone(initial.record)), revalidate, assertLive });
      let output;
      try { output = await consume(lease); }
      catch (error) {
        if (error?.kind === "runtime-preparation-refusal" && REFUSAL_CODES.has(error.code)) {
          return refused(error.code);
        }
        if (error?.kind === "runtime-preparation-refusal"
          && ["cancelled-before-create", "recovery-required"].includes(error.code)) {
          return refused(error.code);
        }
        return recovery();
      }
      assertLive();
      await revalidate();
      assertLive();
      return output;
    } catch (error) {
      if (error?.kind === "runtime-preparation-refusal"
        && (REFUSAL_CODES.has(error.code)
          || ["cancelled-before-create", "recovery-required"].includes(error.code))) {
        return refused(error.code);
      }
      return recovery();
    } finally {
      handleOpen = false;
      activeOperations.delete(operationKey);
    }
  }

  return Object.freeze({ prepare, cancelPreparation, withPreparedForStart });
}
