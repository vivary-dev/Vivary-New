/** Private admission of one controlled synthetic Native first start. */
import { createHash } from "node:crypto";

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
const PREPARATION_RECORD_FIELDS = Object.freeze([
  "schemaVersion", "preparationId", "operationId", "request", "requestDigest", "identity",
  "bindingIdentityDigest", "role", "roleContractRevision", "preparationAuthorityRevision",
  "nativeThreadId", "issuerIncarnationId", "attemptId", "phase", "settlement", "quarantineReason",
]);
const PREPARATION_SETTLEMENT_FIELDS = Object.freeze([
  "schemaVersion", "attemptId", "issuerIncarnationId", "authorityContract",
  "runtimeConfigurationRevision",
]);
const START_GRANT_FIELDS = Object.freeze(["roles", "startAuthorityRevision"]);
const CONFIGURATION_FIELDS = Object.freeze([
  "schemaVersion", "kind", "harnessName", "runtimeVersion", "fixtureRevision", "turnInputDigest",
]);
const PROFILE_FIELDS = Object.freeze(["configuration", "adapter"]);
const ADAPTER_FIELDS = Object.freeze(["name", "label", "description", "capabilities", "createSession"]);
const CAPABILITY_FIELDS = Object.freeze(["sandbox", "resumable", "approvals", "hostTools", "fileEvents"]);
const PORT_METHODS = Object.freeze([
  "read", "reserve", "beginStart", "recordReferenceCandidate", "verifySettlement", "quarantine",
]);
const DEPENDENCY_FIELDS = Object.freeze([
  "preparationService", "startHost", "resolveStartAuthority", "receiptPort", "allocateId",
  "syntheticProfile", "startAgentHarnessRun", "getThread", "getAgentHarnessSession",
  "getAgentHarnessBackgroundRun", "observeSettlement",
]);
const REFERENCE_FIELDS = Object.freeze([
  "schemaVersion", "referenceRevision", "bindingIdentityDigest", "nativeThreadId",
  "nativeSessionId", "nativeRunId", "harnessName",
]);
const EVIDENCE_FIELDS = Object.freeze([
  "schemaVersion", "nativeThreadId", "nativeSessionId", "nativeRunId", "harnessName",
  "runRowDigest", "runEventsDigest",
]);
const OBSERVER_INPUT_FIELDS = Object.freeze([
  "schemaVersion", "reference", "identity", "providerSessionId",
]);
const ROLES = new Set(["planner", "developer", "qa"]);
const REFUSAL_CODES = new Set([
  "invalid-input", "unavailable", "denied", "stale-claim", "ambiguous-binding",
  "operation-conflict", "cancelled-before-create", "recovery-required",
]);
const AUTHORITY_REFUSALS = new Set(["denied", "stale-claim", "ambiguous-binding", "unavailable"]);
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const TURN_INPUT = "Vivary synthetic first-start proof.";
const TURN_INPUT_DIGEST = createHash("sha256").update(TURN_INPUT, "utf8").digest("hex");
const INNER_COMPLETION = Object.freeze({});
const OUTER_COMPLETION = Object.freeze({});
const INVALID_HOST_CALLBACK = Object.freeze(new Error("runtime start host callback is invalid"));
const CLOSED_ADMISSION = Object.freeze(new Error("runtime start admission is closed"));

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
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

function normalizeRequest(value) {
  if (!exactObject(value, REQUEST_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.preparationId) || !identifier(value.preparationOperationId)
    || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision)) return null;
  return Object.freeze(Object.fromEntries(REQUEST_FIELDS.map(field => [field, value[field]])));
}

function normalizePreparationRequest(value) {
  if (!exactObject(value, PREPARATION_REQUEST_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.operationId) || !identifier(value.scopeKey) || !identifier(value.projectId)
    || !positiveRevision(value.expectedBindingRevision)
    || !positiveRevision(value.expectedPolicyRevision) || !ROLES.has(value.role)) return null;
  return Object.freeze(Object.fromEntries(PREPARATION_REQUEST_FIELDS.map(field => [field, value[field]])));
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

function normalizeConfiguration(value) {
  if (!exactObject(value, CONFIGURATION_FIELDS) || value.schemaVersion !== 1
    || value.kind !== "synthetic-native-adapter" || !identifier(value.harnessName)
    || !version(value.runtimeVersion) || !version(value.fixtureRevision)
    || value.turnInputDigest !== TURN_INPUT_DIGEST) return null;
  return Object.freeze(Object.fromEntries(CONFIGURATION_FIELDS.map(field => [field, value[field]])));
}

function normalizeGrant(value) {
  if (!exactObject(value, START_GRANT_FIELDS) || !Array.isArray(value.roles)
    || value.roles.length > ROLES.size || value.roles.some(role => !ROLES.has(role))
    || new Set(value.roles).size !== value.roles.length
    || !positiveRevision(value.startAuthorityRevision)) return null;
  return Object.freeze({ roles: Object.freeze([...value.roles].sort()),
    startAuthorityRevision: value.startAuthorityRevision });
}

function normalizeReference(value) {
  if (!exactObject(value, REFERENCE_FIELDS) || value.schemaVersion !== 1
    || value.referenceRevision !== 1 || !DIGEST.test(value.bindingIdentityDigest ?? "")
    || !identifier(value.nativeThreadId) || !identifier(value.nativeSessionId)
    || !identifier(value.nativeRunId) || !identifier(value.harnessName)) return null;
  return Object.freeze(Object.fromEntries(REFERENCE_FIELDS.map(field => [field, value[field]])));
}

function normalizeEvidence(value, reference) {
  if (!exactObject(value, EVIDENCE_FIELDS) || value.schemaVersion !== 1
    || value.nativeThreadId !== reference.nativeThreadId
    || value.nativeSessionId !== reference.nativeSessionId
    || value.nativeRunId !== reference.nativeRunId || value.harnessName !== reference.harnessName
    || !DIGEST.test(value.runRowDigest ?? "") || !DIGEST.test(value.runEventsDigest ?? "")) return null;
  return Object.freeze(Object.fromEntries(EVIDENCE_FIELDS.map(field => [field, value[field]])));
}

function normalizePrepared(value) {
  if (!exactObject(value, PREPARATION_RECORD_FIELDS) || value.schemaVersion !== 1
    || !identifier(value.preparationId) || !identifier(value.operationId)
    || !DIGEST.test(value.requestDigest ?? "") || !DIGEST.test(value.bindingIdentityDigest ?? "")
    || !ROLES.has(value.role) || !positiveRevision(value.roleContractRevision)
    || !positiveRevision(value.preparationAuthorityRevision) || !identifier(value.nativeThreadId)
    || !identifier(value.issuerIncarnationId) || !identifier(value.attemptId)
    || value.phase !== "thread-prepared" || value.quarantineReason !== null) return null;
  const request = normalizePreparationRequest(value.request);
  const identity = normalizeIdentity(value.identity);
  if (!request || !identity || value.preparationId === value.nativeThreadId
    || value.operationId !== request.operationId || value.role !== request.role
    || request.projectId !== identity.projectId
    || request.expectedBindingRevision !== identity.bindingRevision
    || request.expectedPolicyRevision !== identity.policyRevision
    || value.bindingIdentityDigest !== sha256(identity)
    || value.requestDigest !== sha256([[1, request.operationId, request.scopeKey, request.projectId,
      request.expectedBindingRevision, request.expectedPolicyRevision, request.role], identity,
    request.role, value.roleContractRevision, value.preparationAuthorityRevision])
    || !exactObject(value.settlement, PREPARATION_SETTLEMENT_FIELDS)
    || value.settlement.schemaVersion !== 1 || value.settlement.attemptId !== value.attemptId
    || value.settlement.issuerIncarnationId !== value.issuerIncarnationId
    || value.settlement.authorityContract !== identity.authorityContract
    || value.settlement.runtimeConfigurationRevision !== identity.runtimeConfigurationRevision) return null;
  return Object.freeze({ ...clone(value), request, identity,
    settlement: Object.freeze(clone(value.settlement)) });
}

function preparationMatchesLookup(prepared, lookup) {
  return prepared.preparationId === lookup.preparationId
    && prepared.operationId === lookup.preparationOperationId
    && prepared.request.scopeKey === lookup.scopeKey && prepared.request.projectId === lookup.projectId
    && prepared.request.expectedBindingRevision === lookup.expectedBindingRevision
    && prepared.request.expectedPolicyRevision === lookup.expectedPolicyRevision;
}

function parseDependencies(dependencies) {
  if (dependencies === undefined) return null;
  if (!exactObject(dependencies, DEPENDENCY_FIELDS)
    || typeof dependencies.preparationService?.withPreparedForStart !== "function"
    || typeof dependencies.startHost?.withCreationScope !== "function"
    || typeof dependencies.resolveStartAuthority !== "function"
    || PORT_METHODS.some(method => typeof dependencies.receiptPort?.[method] !== "function")
    || typeof dependencies.allocateId !== "function"
    || typeof dependencies.startAgentHarnessRun !== "function"
    || typeof dependencies.getThread !== "function"
    || typeof dependencies.getAgentHarnessSession !== "function"
    || typeof dependencies.getAgentHarnessBackgroundRun !== "function"
    || typeof dependencies.observeSettlement !== "function"
    || !exactObject(dependencies.syntheticProfile, PROFILE_FIELDS)) {
    throw new TypeError("runtime start requires exact trusted dependencies");
  }
  const descriptor = normalizeConfiguration(dependencies.syntheticProfile.configuration);
  const adapter = dependencies.syntheticProfile.adapter;
  if (!descriptor || !exactObject(adapter, ADAPTER_FIELDS) || adapter.name !== descriptor.harnessName
    || !safeText(adapter.label) || !safeText(adapter.description)
    || !exactObject(adapter.capabilities, CAPABILITY_FIELDS)
    || CAPABILITY_FIELDS.some(field => typeof adapter.capabilities[field] !== "boolean")
    || typeof adapter.createSession !== "function") {
    throw new TypeError("runtime start requires one exact synthetic profile");
  }
  const receiptPort = Object.freeze(Object.fromEntries(PORT_METHODS.map(method => [
    method, dependencies.receiptPort[method].bind(dependencies.receiptPort),
  ])));
  const frozenAdapter = Object.freeze({
    name: adapter.name, label: adapter.label, description: adapter.description,
    capabilities: Object.freeze(Object.fromEntries(CAPABILITY_FIELDS.map(field => [
      field, adapter.capabilities[field],
    ]))), createSession: adapter.createSession.bind(adapter),
  });
  return Object.freeze({
    preparationService: Object.freeze({ withPreparedForStart:
      dependencies.preparationService.withPreparedForStart.bind(dependencies.preparationService) }),
    startHost: Object.freeze({ withCreationScope:
      dependencies.startHost.withCreationScope.bind(dependencies.startHost) }),
    resolveStartAuthority: dependencies.resolveStartAuthority.bind(dependencies),
    receiptPort, allocateId: dependencies.allocateId.bind(dependencies),
    syntheticProfile: Object.freeze({ configuration: descriptor, adapter: frozenAdapter }),
    startAgentHarnessRun: dependencies.startAgentHarnessRun.bind(dependencies),
    getThread: dependencies.getThread.bind(dependencies),
    getAgentHarnessSession: dependencies.getAgentHarnessSession.bind(dependencies),
    getAgentHarnessBackgroundRun: dependencies.getAgentHarnessBackgroundRun.bind(dependencies),
    observeSettlement: dependencies.observeSettlement.bind(dependencies),
  });
}

function exactThread(thread, prepared) {
  return Boolean(thread) && thread.id === prepared.nativeThreadId
    && thread.ownerEmail === prepared.identity.ownerEmail && thread.orgId === prepared.identity.orgId
    && thread.title === "Project session" && thread.visibility === "private"
    && exactObject(thread.scope, ["type", "id"])
    && thread.scope.type === "vivary-project-runtime-v1"
    && thread.scope.id === prepared.bindingIdentityDigest;
}

function exactSession(session, reference, identity, providerSessionId) {
  return Boolean(session) && session.id === reference.nativeSessionId
    && session.threadId === reference.nativeThreadId && session.runId === reference.nativeRunId
    && session.harnessName === reference.harnessName && session.ownerEmail === identity.ownerEmail
    && session.orgId === identity.orgId && safeText(session.providerSessionId)
    && (providerSessionId === null || session.providerSessionId === providerSessionId);
}

function exactRun(run, reference) {
  return Boolean(run) && run.id === reference.nativeRunId && run.kind === "harness"
    && run.source === "agent-harness" && exactObject(run.sourceRecord, ["type", "id", "threadId", "name"])
    && run.sourceRecord.type === "agent-harness-session"
    && run.sourceRecord.id === reference.nativeSessionId
    && run.sourceRecord.threadId === reference.nativeThreadId
    && run.sourceRecord.name === reference.harnessName;
}

function referenceFromRecord(record) {
  return normalizeReference({ schemaVersion: 1, referenceRevision: 1,
    bindingIdentityDigest: record.bindingIdentityDigest, nativeThreadId: record.nativeThreadId,
    nativeSessionId: record.nativeSessionId, nativeRunId: record.nativeRunId,
    harnessName: record.adapterConfiguration.harnessName });
}

function intentFromPrepared(lookup, prepared, grant, descriptor, issuerIncarnationId) {
  const preparationRequestDigest = sha256([[1, prepared.request.operationId,
    prepared.request.scopeKey, prepared.request.projectId, prepared.request.expectedBindingRevision,
    prepared.request.expectedPolicyRevision, prepared.request.role], prepared.identity,
  prepared.role, prepared.roleContractRevision, prepared.preparationAuthorityRevision]);
  const adapterConfigurationDigest = sha256([1, "synthetic-native-adapter", descriptor.harnessName,
    descriptor.runtimeVersion, descriptor.fixtureRevision, descriptor.turnInputDigest]);
  return Object.freeze({ request: lookup, preparationRequest: prepared.request,
    preparationRequestDigest, preparationIssuerIncarnationId: prepared.settlement.issuerIncarnationId,
    preparationAttemptId: prepared.settlement.attemptId, identity: prepared.identity,
    bindingIdentityDigest: prepared.bindingIdentityDigest, role: prepared.role,
    roleContractRevision: prepared.roleContractRevision,
    preparationAuthorityRevision: prepared.preparationAuthorityRevision,
    startAuthorityRevision: grant.startAuthorityRevision, adapterConfiguration: descriptor,
    adapterConfigurationDigest, nativeThreadId: prepared.nativeThreadId, issuerIncarnationId });
}

function requestDigest(intent) {
  return sha256([[1, intent.request.preparationId, intent.request.preparationOperationId,
    intent.request.scopeKey, intent.request.projectId, intent.request.expectedBindingRevision,
    intent.request.expectedPolicyRevision], intent.preparationRequestDigest,
  intent.preparationIssuerIncarnationId, intent.preparationAttemptId, intent.identity, intent.role,
  intent.roleContractRevision, intent.preparationAuthorityRevision, intent.startAuthorityRevision,
  intent.adapterConfigurationDigest, intent.nativeThreadId]);
}

function normalizePortResult(value) {
  return value !== null && typeof value === "object" && typeof value.code === "string" ? value : null;
}

function explicitHostRefusal(value) {
  return exactObject(value, ["code"])
    && ["denied", "stale-claim", "recovery-required"].includes(value.code)
    ? Object.freeze({ kind: "refused", code: value.code }) : null;
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
      } finally { callbackSettled = true; }
    })();
    promise.catch(() => {});
    return promise;
  };
  let result;
  let hostError;
  let rejected = false;
  try { result = await guard.executeOnce(clone(admission), invoke); }
  catch (error) { rejected = true; hostError = error; }
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
      } finally { callbackSettled = true; }
    })();
    promise.catch(() => {});
    return promise;
  };
  let result;
  let hostError;
  let rejected = false;
  try { result = await host.withCreationScope(Object.freeze(clone(scope)), enter); }
  catch (error) { rejected = true; hostError = error; }
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

/** The returned service has no route, action, or production composition. */
export function createProjectRuntimeStartService(dependencies) {
  const configuration = parseDependencies(dependencies);
  let admissionOpen = true;
  const activeOperations = new Set();
  const blockedOperations = new Set();

  const allocate = async kind => {
    if (!configuration) return null;
    let allocated;
    try { allocated = await configuration.allocateId(kind); } catch { return null; }
    return identifier(allocated) ? allocated : null;
  };
  const issuerPromise = configuration ? allocate("start-issuer-incarnation") : Promise.resolve(null);
  issuerPromise.catch(() => {});

  const assertAdmission = () => {
    if (!admissionOpen) throw CLOSED_ADMISSION;
  };
  const checkpoint = (lease, innerLive) => {
    assertAdmission();
    lease.assertLive();
    innerLive?.();
  };

  async function resolveAuthority(prepared, authenticatedContext, lease, innerLive, expected = null) {
    checkpoint(lease, innerLive);
    let raw;
    try {
      raw = await configuration.resolveStartAuthority(deepFreeze({ identity: clone(prepared.identity),
        role: prepared.role, preparationId: prepared.preparationId,
        nativeThreadId: prepared.nativeThreadId }), authenticatedContext);
    } catch { raw = null; }
    checkpoint(lease, innerLive);
    const grant = normalizeGrant(raw);
    if (!grant) return refused("unavailable");
    if (!grant.roles.includes(prepared.role)) return refused("denied");
    if (expected && !same(grant, expected)) return refused("stale-claim");
    return Object.freeze({ code: "authorized", grant });
  }

  async function revalidatePreparation(lease, expected, innerLive) {
    checkpoint(lease, innerLive);
    let raw;
    try { raw = await lease.revalidate(); } catch (error) {
      assertAdmission();
      innerLive?.();
      if (AUTHORITY_REFUSALS.has(error?.code)) return refused(error.code);
      if (["cancelled-before-create", "recovery-required"].includes(error?.code)) return refused(error.code);
      return recovery();
    }
    checkpoint(lease, innerLive);
    const prepared = normalizePrepared(raw);
    if (!prepared || !same(prepared, expected)) return refused("stale-claim");
    return Object.freeze({ code: "prepared", prepared });
  }

  async function readNativeEvidence(record, lease, innerLive, providerSessionId = null) {
    checkpoint(lease, innerLive);
    const reference = referenceFromRecord(record);
    if (!reference) return null;
    let thread;
    let session;
    let run;
    try { thread = await configuration.getThread(reference.nativeThreadId); }
    catch { checkpoint(lease, innerLive); return null; }
    checkpoint(lease, innerLive);
    try { session = await configuration.getAgentHarnessSession(reference.nativeSessionId); }
    catch { checkpoint(lease, innerLive); return null; }
    checkpoint(lease, innerLive);
    try {
      run = await configuration.getAgentHarnessBackgroundRun(reference.nativeRunId,
        Object.freeze({ ownerEmail: record.identity.ownerEmail, orgId: record.identity.orgId }));
    } catch { checkpoint(lease, innerLive); return null; }
    checkpoint(lease, innerLive);
    if (!exactThread(thread, record) || !exactSession(session, reference, record.identity, providerSessionId)
      || !exactRun(run, reference)) return null;
    const observerInput = deepFreeze({ schemaVersion: 1, reference: clone(reference),
      identity: clone(record.identity), providerSessionId: session.providerSessionId });
    if (!exactObject(observerInput, OBSERVER_INPUT_FIELDS)) return null;
    let observed;
    try { observed = await configuration.observeSettlement(observerInput); }
    catch { checkpoint(lease, innerLive); return null; }
    checkpoint(lease, innerLive);
    const evidence = normalizeEvidence(observed, reference);
    if (!evidence) return null;
    const nativeEvidenceDigest = sha256([1, evidence.nativeThreadId, evidence.nativeSessionId,
      evidence.nativeRunId, evidence.harnessName, evidence.runRowDigest, evidence.runEventsDigest]);
    return Object.freeze({ reference, evidence, nativeEvidenceDigest });
  }

  async function quarantineBestEffort(intent, reason) {
    if (!intent) return;
    try { await configuration.receiptPort.quarantine(intent, reason); } catch { /* best effort */ }
  }

  const operationKeyFor = intent => `${intent.identity.actorId}:${intent.identity.collectionId}:`
    + `${intent.identity.deviceId}:${intent.request.preparationId}`;

  async function failAfterStarting(intent, reason, code = "recovery-required") {
    blockedOperations.add(operationKeyFor(intent));
    await quarantineBestEffort(intent, reason);
    return REFUSAL_CODES.has(code) ? refused(code) : recovery();
  }

  async function executeInsideAdmission({ lookup, authenticatedContext, lease, prepared,
    grant, intent, innerLive, working }) {
    let effectEntered = false;
    let attemptId = null;
    try {
      checkpoint(lease, innerLive);
      const currentPreparation = await revalidatePreparation(lease, prepared, innerLive);
      if (currentPreparation.code !== "prepared") return Object.freeze({ kind: "refused",
        code: currentPreparation.code, intent });
      const currentAuthority = await resolveAuthority(prepared, authenticatedContext,
        lease, innerLive, grant);
      if (currentAuthority.code !== "authorized") return Object.freeze({ kind: "refused",
        code: currentAuthority.code, intent });

      let loaded;
      try { loaded = normalizePortResult(await configuration.receiptPort.read(intent)); }
      catch { loaded = null; }
      checkpoint(lease, innerLive);
      if (!loaded || ["invalid", "unavailable"].includes(loaded.code)) {
        return Object.freeze({ kind: "recovery", intent });
      }
      if (loaded.code === "conflict") return Object.freeze({ kind: "conflict", intent });
      if (loaded.code === "missing") {
        const nativeSessionId = await allocate("native-session");
        checkpoint(lease, innerLive);
        const nativeRunId = await allocate("native-run");
        checkpoint(lease, innerLive);
        if (!nativeSessionId || !nativeRunId
          || new Set([lookup.preparationId, prepared.nativeThreadId,
            nativeSessionId, nativeRunId]).size !== 4) {
          return Object.freeze({ kind: "recovery", intent });
        }
        try { loaded = normalizePortResult(await configuration.receiptPort.reserve(intent,
          Object.freeze({ nativeSessionId, nativeRunId }))); } catch { loaded = null; }
        checkpoint(lease, innerLive);
      }
      if (!loaded || ["invalid", "unavailable", "lost"].includes(loaded.code)) {
        return Object.freeze({ kind: "recovery", intent });
      }
      if (loaded.code === "conflict") return Object.freeze({ kind: "conflict", intent });
      const record = loaded.record;
      if (!record || record.issuerIncarnationId !== intent.issuerIncarnationId) {
        await quarantineBestEffort(intent, "foreign-incarnation");
        checkpoint(lease, innerLive);
        return Object.freeze({ kind: "recovery", intent });
      }
      if (record.phase === "reference-verified") {
        working.postStarting = true;
        const verified = await readNativeEvidence(record, lease, innerLive);
        if (!verified || verified.nativeEvidenceDigest !== record.nativeEvidenceDigest) {
          return Object.freeze({ kind: "uncertain", code: "recovery-required", intent });
        }
        return Object.freeze({ kind: "verified", intent, record, native: verified, replayed: true });
      }
      if (["starting", "reference-candidate"].includes(record.phase)) {
        working.postStarting = true;
        return Object.freeze({ kind: "uncertain", code: "recovery-required", intent,
          attemptId: record.attemptId });
      }
      if (record.phase !== "reserved" || record.attemptId !== null) {
        return Object.freeze({ kind: "recovery", intent });
      }
      if (new Set([lookup.preparationId, record.nativeThreadId,
        record.nativeSessionId, record.nativeRunId]).size !== 4
        || record.nativeThreadId !== prepared.nativeThreadId) {
        return Object.freeze({ kind: "recovery", intent });
      }

      let exactPreparedThread;
      let sessionCollision;
      let runCollision;
      try { exactPreparedThread = await configuration.getThread(record.nativeThreadId); }
      catch { exactPreparedThread = null; }
      checkpoint(lease, innerLive);
      try { sessionCollision = await configuration.getAgentHarnessSession(record.nativeSessionId); }
      catch { checkpoint(lease, innerLive); return Object.freeze({ kind: "recovery", intent }); }
      checkpoint(lease, innerLive);
      try { runCollision = await configuration.getAgentHarnessBackgroundRun(record.nativeRunId,
        Object.freeze({ ownerEmail: prepared.identity.ownerEmail, orgId: prepared.identity.orgId })); }
      catch { checkpoint(lease, innerLive); return Object.freeze({ kind: "recovery", intent }); }
      checkpoint(lease, innerLive);
      if (!exactThread(exactPreparedThread, prepared) || sessionCollision !== null
        || runCollision !== null) return Object.freeze({ kind: "recovery", intent });

      attemptId = await allocate("start-attempt");
      checkpoint(lease, innerLive);
      if (!attemptId) return Object.freeze({ kind: "recovery", intent });
      let starting;
      try { starting = normalizePortResult(await configuration.receiptPort.beginStart(intent, attemptId)); }
      catch { starting = null; }
      checkpoint(lease, innerLive);
      if (!starting || starting.code !== "changed") {
        return Object.freeze({ kind: "recovery", intent });
      }
      effectEntered = true;
      working.postStarting = true;

      const justBeforePreparation = await revalidatePreparation(lease, prepared, innerLive);
      if (justBeforePreparation.code !== "prepared") return Object.freeze({ kind: "uncertain",
        code: justBeforePreparation.code, intent, attemptId });
      const justBeforeAuthority = await resolveAuthority(prepared, authenticatedContext,
        lease, innerLive, grant);
      if (justBeforeAuthority.code !== "authorized") return Object.freeze({ kind: "uncertain",
        code: justBeforeAuthority.code, intent, attemptId });

      let createCalls = 0;
      let createdSession = null;
      const trackedAdapter = Object.freeze({ ...configuration.syntheticProfile.adapter,
        async createSession(options) {
          createCalls += 1;
          checkpoint(lease, innerLive);
          if (createCalls !== 1 || options?.sessionId !== record.nativeSessionId
            || options?.threadId !== record.nativeThreadId || options?.runId !== record.nativeRunId
            || options?.ownerEmail !== prepared.identity.ownerEmail
            || options?.orgId !== prepared.identity.orgId) throw INVALID_HOST_CALLBACK;
          createdSession = await configuration.syntheticProfile.adapter.createSession(options);
          checkpoint(lease, innerLive);
          if (!createdSession || !identifier(createdSession.id)
            || typeof createdSession.streamTurn !== "function") throw INVALID_HOST_CALLBACK;
          return createdSession;
        } });
      let waitUntilCalls = 0;
      let completionPromise = null;
      const waitUntil = promise => {
        waitUntilCalls += 1;
        if (waitUntilCalls !== 1 || !(promise instanceof Promise)) throw INVALID_HOST_CALLBACK;
        completionPromise = promise;
        promise.catch(() => {});
      };
      checkpoint(lease, innerLive);
      let activeRun;
      try {
        activeRun = configuration.startAgentHarnessRun({ runId: record.nativeRunId,
          threadId: record.nativeThreadId, adapter: trackedAdapter, input: { prompt: TURN_INPUT },
          createSession: { sessionId: record.nativeSessionId }, ownerEmail: prepared.identity.ownerEmail,
          orgId: prepared.identity.orgId, detachOnComplete: true,
          runOptions: { recoverChunkBoundaries: false, useHostedSoftTimeoutDefault: false, waitUntil } });
      } catch {
        return Object.freeze({ kind: "uncertain", code: "recovery-required", intent, attemptId });
      }
      if (!activeRun || activeRun.runId !== record.nativeRunId
        || activeRun.threadId !== record.nativeThreadId || waitUntilCalls !== 1 || !completionPromise) {
        return Object.freeze({ kind: "uncertain", code: "recovery-required", intent, attemptId });
      }
      try { await completionPromise; } catch {
        checkpoint(lease, innerLive);
        return Object.freeze({ kind: "uncertain", code: "recovery-required", intent, attemptId });
      }
      checkpoint(lease, innerLive);
      if (createCalls !== 1 || !createdSession) {
        return Object.freeze({ kind: "uncertain", code: "recovery-required", intent, attemptId });
      }
      const native = await readNativeEvidence(starting.record, lease, innerLive, createdSession.id);
      if (!native) return Object.freeze({ kind: "uncertain", code: "recovery-required", intent, attemptId });
      const afterEffectPreparation = await revalidatePreparation(lease, prepared, innerLive);
      if (afterEffectPreparation.code !== "prepared") return Object.freeze({ kind: "uncertain",
        code: afterEffectPreparation.code, intent, attemptId });
      const afterEffectAuthority = await resolveAuthority(prepared, authenticatedContext,
        lease, innerLive, grant);
      if (afterEffectAuthority.code !== "authorized") return Object.freeze({ kind: "uncertain",
        code: afterEffectAuthority.code, intent, attemptId });
      checkpoint(lease, innerLive);
      let candidate;
      try { candidate = normalizePortResult(await configuration.receiptPort.recordReferenceCandidate(
        intent, attemptId, native.nativeEvidenceDigest)); } catch { candidate = null; }
      checkpoint(lease, innerLive);
      if (!candidate || candidate.code !== "changed") {
        return Object.freeze({ kind: "uncertain", code: "recovery-required", intent, attemptId });
      }
      return Object.freeze({ kind: "candidate", intent, record: candidate.record, native, attemptId });
    } catch {
      return Object.freeze({ kind: effectEntered ? "uncertain" : "recovery",
        code: "recovery-required", intent, attemptId });
    }
  }

  async function finishVerified(outcome, authenticatedContext, lease, prepared, grant, replayed) {
    try {
      assertAdmission();
      lease.assertLive();
      const freshPreparation = await revalidatePreparation(lease, prepared);
      if (freshPreparation.code !== "prepared") {
        return await failAfterStarting(outcome.intent, "authority-changed", freshPreparation.code);
      }
      const freshAuthority = await resolveAuthority(prepared, authenticatedContext,
        lease, undefined, grant);
      if (freshAuthority.code !== "authorized") {
        return await failAfterStarting(outcome.intent, "authority-changed", freshAuthority.code);
      }
      const native = await readNativeEvidence(outcome.record, lease);
      if (!native || native.nativeEvidenceDigest !== outcome.record.nativeEvidenceDigest
        || (outcome.native && native.nativeEvidenceDigest !== outcome.native.nativeEvidenceDigest)) {
        return await failAfterStarting(outcome.intent, "effect-uncertain");
      }
      if (!replayed) {
        assertAdmission();
        lease.assertLive();
        let settlement;
        try { settlement = normalizePortResult(await configuration.receiptPort.verifySettlement(
          outcome.intent, outcome.attemptId)); } catch { settlement = null; }
        assertAdmission();
        lease.assertLive();
        if (!settlement || settlement.code !== "changed") {
          return await failAfterStarting(outcome.intent, "settlement-uncertain");
        }
      }
      let loaded;
      try { loaded = normalizePortResult(await configuration.receiptPort.read(outcome.intent)); }
      catch { loaded = null; }
      assertAdmission();
      lease.assertLive();
      if (!loaded || loaded.code !== "ok" || loaded.record.phase !== "reference-verified"
        || loaded.record.issuerIncarnationId !== outcome.intent.issuerIncarnationId
        || loaded.record.nativeEvidenceDigest !== native.nativeEvidenceDigest) {
        return await failAfterStarting(outcome.intent, "settlement-uncertain");
      }
      const finalNative = await readNativeEvidence(loaded.record, lease);
      if (!finalNative || finalNative.nativeEvidenceDigest !== native.nativeEvidenceDigest) {
        return await failAfterStarting(outcome.intent, "effect-uncertain");
      }
      const finalAuthority = await resolveAuthority(prepared, authenticatedContext,
        lease, undefined, grant);
      if (finalAuthority.code !== "authorized") {
        return await failAfterStarting(outcome.intent, "authority-changed", finalAuthority.code);
      }
      assertAdmission();
      lease.assertLive();
      return Object.freeze({ code: "started", preparationId: prepared.preparationId,
        reference: finalNative.reference, replayed, evidenceKind: "synthetic-native-start" });
    } catch (error) {
      return await failAfterStarting(outcome.intent,
        error === CLOSED_ADMISSION ? "host-invalid" : "authority-changed");
    }
  }

  async function consumeStart(lookup, authenticatedContext, issuerIncarnationId, lease, working) {
    assertAdmission();
    lease.assertLive();
    const prepared = normalizePrepared(lease.prepared);
    if (!prepared || !preparationMatchesLookup(prepared, lookup)) return refused("stale-claim");
    const descriptor = configuration.syntheticProfile.configuration;
    if (descriptor.harnessName !== prepared.identity.harnessName
      || descriptor.runtimeVersion !== prepared.identity.runtimeVersion) return refused("unavailable");
    const authorized = await resolveAuthority(prepared, authenticatedContext, lease);
    if (authorized.code !== "authorized") return refused(authorized.code);
    const grant = authorized.grant;
    const intent = intentFromPrepared(lookup, prepared, grant, descriptor, issuerIncarnationId);
    const operationKey = operationKeyFor(intent);
    working.intent = intent;
    working.operationKey = operationKey;
    if (blockedOperations.has(operationKey)) return recovery();
    if (activeOperations.has(operationKey)) return recovery();
    activeOperations.add(operationKey);
    try {
      const admission = Object.freeze({ schemaVersion: 1, operation: "runtime-start",
        operationId: lookup.preparationId, requestDigest: requestDigest(intent),
        collectionId: prepared.identity.collectionId, deviceId: prepared.identity.deviceId });
      const observed = await observeHost(configuration.startHost,
        Object.freeze({ collectionId: prepared.identity.collectionId,
          deviceId: prepared.identity.deviceId }), admission,
        innerLive => executeInsideAdmission({ lookup, authenticatedContext, lease,
          prepared, grant, intent, innerLive, working }));
      if (!observed.valid) {
        admissionOpen = false;
        await quarantineBestEffort(intent, "host-invalid");
        return recovery();
      }
      assertAdmission();
      lease.assertLive();
      if (!admissionOpen) return recovery();
      const outcome = observed.outcome;
      if (!outcome || outcome.kind === "callback-error") {
        return working.postStarting
          ? await failAfterStarting(intent, "effect-uncertain") : recovery();
      }
      if (outcome.kind === "refused") return refused(outcome.code);
      if (outcome.kind === "conflict") return refused("operation-conflict");
      if (outcome.kind === "recovery") return recovery();
      if (outcome.kind === "uncertain") {
        return await failAfterStarting(intent, AUTHORITY_REFUSALS.has(outcome.code)
          ? "authority-changed" : "effect-uncertain", outcome.code);
      }
      if (outcome.kind === "verified") {
        return await finishVerified(outcome, authenticatedContext, lease, prepared, grant, true);
      }
      if (outcome.kind === "candidate") {
        return await finishVerified(outcome, authenticatedContext, lease, prepared, grant, false);
      }
      return working.postStarting
        ? await failAfterStarting(intent, "effect-uncertain") : recovery();
    } catch (error) {
      if (!working.postStarting) throw error;
      return await failAfterStarting(intent,
        error === CLOSED_ADMISSION ? "host-invalid" : "effect-uncertain");
    } finally { activeOperations.delete(operationKey); }
  }

  async function start(originalRequest, authenticatedContext) {
    const request = normalizeRequest(originalRequest);
    if (!request) return refused("invalid-input");
    if (!configuration) return refused("unavailable");
    if (!admissionOpen) return recovery();
    const issuerIncarnationId = await issuerPromise;
    if (!issuerIncarnationId) return refused("unavailable");
    if (!admissionOpen) return recovery();
    const working = { intent: null, operationKey: null, postStarting: false,
      callbackOutput: null };
    let result;
    try {
      result = await configuration.preparationService.withPreparedForStart(request,
        authenticatedContext, async lease => {
          working.callbackOutput = await consumeStart(request, authenticatedContext,
            issuerIncarnationId, lease, working);
          return working.callbackOutput;
        });
    } catch { result = null; }
    if (!admissionOpen) {
      if (working.postStarting && working.intent) {
        return await failAfterStarting(working.intent, "host-invalid");
      }
      return recovery();
    }
    if (working.callbackOutput?.code === "started"
      && (!result || result.code !== "started")) {
      return await failAfterStarting(working.intent, "authority-changed", result?.code);
    }
    if (exactObject(result, ["code"]) && REFUSAL_CODES.has(result.code)) return refused(result.code);
    if (!exactObject(result, ["code", "preparationId", "reference", "replayed", "evidenceKind"])
      || result.code !== "started" || result.preparationId !== request.preparationId
      || typeof result.replayed !== "boolean" || result.evidenceKind !== "synthetic-native-start"
      || !normalizeReference(result.reference)) {
      return working.postStarting && working.intent
        ? await failAfterStarting(working.intent, "settlement-uncertain") : recovery();
    }
    if (!admissionOpen) return recovery();
    return Object.freeze({ ...result, reference: normalizeReference(result.reference) });
  }

  async function resolveReference(originalLookup, authenticatedContext, expectedIdentity) {
    const lookup = normalizeRequest(originalLookup);
    const expected = normalizeIdentity(expectedIdentity);
    if (!lookup || !expected) return refused("invalid-input");
    if (!configuration) return refused("unavailable");
    if (!admissionOpen) return recovery();
    const issuerIncarnationId = await issuerPromise;
    if (!issuerIncarnationId) return refused("unavailable");
    if (!admissionOpen) return recovery();
    const working = { intent: null, postStarting: false, callbackReference: null };
    let result;
    try {
      result = await configuration.preparationService.withPreparedForStart(lookup,
        authenticatedContext, async lease => {
          assertAdmission();
          lease.assertLive();
          const prepared = normalizePrepared(lease.prepared);
          if (!prepared || !preparationMatchesLookup(prepared, lookup)
            || !same(prepared.identity, expected)) return refused("stale-claim");
          const descriptor = configuration.syntheticProfile.configuration;
          if (descriptor.harnessName !== prepared.identity.harnessName
            || descriptor.runtimeVersion !== prepared.identity.runtimeVersion) return refused("unavailable");
          const authority = await resolveAuthority(prepared, authenticatedContext, lease);
          if (authority.code !== "authorized") return refused(authority.code);
          const intent = intentFromPrepared(lookup, prepared, authority.grant,
            descriptor, issuerIncarnationId);
          working.intent = intent;
          if (blockedOperations.has(operationKeyFor(intent))) return recovery();
          let loaded;
          try { loaded = normalizePortResult(await configuration.receiptPort.read(intent)); }
          catch { loaded = null; }
          assertAdmission();
          lease.assertLive();
          if (!loaded || loaded.code !== "ok") return recovery();
          if (["starting", "reference-candidate"].includes(loaded.record.phase)) {
            working.postStarting = true;
            return await failAfterStarting(intent, "effect-uncertain");
          }
          if (loaded.record.phase !== "reference-verified"
            || loaded.record.issuerIncarnationId !== issuerIncarnationId) return recovery();
          working.postStarting = true;
          const native = await readNativeEvidence(loaded.record, lease);
          if (!native || native.nativeEvidenceDigest !== loaded.record.nativeEvidenceDigest) {
            return await failAfterStarting(intent, "effect-uncertain");
          }
          const freshPreparation = await revalidatePreparation(lease, prepared);
          if (freshPreparation.code !== "prepared") {
            return await failAfterStarting(intent, "authority-changed", freshPreparation.code);
          }
          const freshAuthority = await resolveAuthority(prepared, authenticatedContext,
            lease, undefined, authority.grant);
          if (freshAuthority.code !== "authorized") {
            return await failAfterStarting(intent, "authority-changed", freshAuthority.code);
          }
          assertAdmission();
          lease.assertLive();
          working.callbackReference = native.reference;
          return working.callbackReference;
        });
    } catch { result = null; }
    if (!admissionOpen) {
      if (working.postStarting && working.intent) {
        return await failAfterStarting(working.intent, "host-invalid");
      }
      return recovery();
    }
    const reference = normalizeReference(result);
    if (reference) return reference;
    if (working.callbackReference && working.intent) {
      return await failAfterStarting(working.intent, "authority-changed", result?.code);
    }
    return exactObject(result, ["code"]) && REFUSAL_CODES.has(result.code)
      ? refused(result.code) : recovery();
  }

  return Object.freeze({ start, resolveReference });
}
