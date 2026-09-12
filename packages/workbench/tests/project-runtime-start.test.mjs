import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire, register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";

const TEST_FILE = fileURLToPath(import.meta.url);
const CASE_NAMES = Object.freeze([
  "default composition strict lookup expected identity and separate start grant refuse",
  "receiving seam validates the exact prepared row and closes retained handles",
  "one actual synthetic Native start settles an exact reference replay and 04b resolver",
  "matching concurrency and changed operation or profile never start twice",
  "receipt key JSON digest phase and redundant-field corruption refuse",
  "authority and preparation changes before the effect produce zero Native starts",
  "session run and same-thread collisions prevent Native invocation",
  "adapter rejection identity mismatch and missing completion capture quarantine uncertainty",
  "candidate and settlement write uncertainty suppress replay and reference resolution",
  "early double retained and substituted host callbacks permanently close admission",
  "foreign start incarnation and mutated Native association require recovery",
  "register create prepare and runtime-start receipts keep isolated namespaces",
]);
const SNAPSHOT_TABLES = Object.freeze([
  "agent_harness_sessions", "agent_run_events", "agent_run_outcome_daily", "agent_runs",
  "agent_tool_ledger", "chat_threads", "vivary_registry_bindings", "vivary_registry_projects",
  "vivary_registry_receipts", "vivary_registry_revisions",
]);
const NATIVE_EFFECT_TABLES = Object.freeze([
  "chat_threads", "agent_harness_sessions", "agent_runs", "agent_run_events",
  "agent_run_outcome_daily", "agent_tool_ledger",
]);
const SORTED_NATIVE_EFFECT_TABLES = Object.freeze([...NATIVE_EFFECT_TABLES].sort());
const NO_NATIVE_EFFECT = "unchanged";
const ONE_SUCCESSFUL_NATIVE_START = Object.freeze({ chat_threads: 0,
  agent_harness_sessions: 1, agent_runs: 1, agent_run_events: 4,
  agent_run_outcome_daily: 0, agent_tool_ledger: 0 });
const ONE_FAILED_NATIVE_START_BEFORE_SESSION = Object.freeze({ chat_threads: 0,
  agent_harness_sessions: 0, agent_runs: 1, agent_run_events: 2,
  agent_run_outcome_daily: 0, agent_tool_ledger: 0 });
const ONE_NATIVE_START_WITHOUT_RUN_ROW = Object.freeze({ chat_threads: 0,
  agent_harness_sessions: 1, agent_runs: 0, agent_run_events: 4,
  agent_run_outcome_daily: 0, agent_tool_ledger: 0 });
const PREPARATION_CLOSES_DURING_ONE_FAILED_NATIVE_START = Object.freeze({ chat_threads: 1,
  agent_harness_sessions: 0, agent_runs: 1, agent_run_events: 2,
  agent_run_outcome_daily: 0, agent_tool_ledger: 0 });
const ONE_SUCCESS_AND_ONE_FAILED_NATIVE_START = Object.freeze({ chat_threads: 0,
  agent_harness_sessions: 1, agent_runs: 2, agent_run_events: 6,
  agent_run_outcome_daily: 0, agent_tool_ledger: 0 });
const NATIVE_EFFECT_MUTATIONS = new WeakMap();
const expectedNativeMutation = (table, key, field, value) => {
  const expected = Object.freeze(Object.fromEntries(
    NATIVE_EFFECT_TABLES.map(name => [name, 0])));
  NATIVE_EFFECT_MUTATIONS.set(expected, Object.freeze({ table, key, field, value }));
  return expected;
};
const NO_NATIVE_METRICS = Object.freeze({ runners: 0, adapterCreates: 0,
  adapterStreams: 0, adapterDetaches: 0 });
const ONE_SUCCESSFUL_NATIVE_METRICS = Object.freeze({ runners: 1, adapterCreates: 1,
  adapterStreams: 1, adapterDetaches: 1 });
const ONE_CREATE_ONLY_NATIVE_METRICS = Object.freeze({ runners: 1, adapterCreates: 1,
  adapterStreams: 0, adapterDetaches: 0 });
const TWO_RUN_NATIVE_METRICS = Object.freeze({ runners: 2, adapterCreates: 2,
  adapterStreams: 1, adapterDetaches: 1 });
const CORE_HASHES = Object.freeze({
  "dist/agent/run-store.js": "bc4ea216790fa919169d12df8367073b16c363a96e4af6bb4208e15f479d90ba",
  "dist/agent/run-manager.js": "7a792cc68028512a5d8be6a1604ae06402de371f4f4ccfa336f8f67bfbc578e2",
  "dist/agent/run-manager.d.ts": "a84e76888515e71ecf29b4a09b82a944abff5ce310af647b6aaed6b47a92c9c8",
  "dist/agent/harness/runner.js": "edee3d10fda576b628743cfa3f6fc9392842789a548b90bb643ace0dc3b75b19",
});
const TURN_INPUT = "Vivary synthetic first-start proof.";
const TURN_INPUT_DIGEST = createHash("sha256").update(TURN_INPUT, "utf8").digest("hex");
const WORKER_OUTPUT_LIMIT = 1024 * 1024;
const WORKER_FORWARD_LIMIT = WORKER_OUTPUT_LIMIT - 64 * 1024;
const PARTIAL_WITNESS_LIMIT = 900 * 1024;
const WITNESS_RAW_LIMIT = 8 * 1024 * 1024;

const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const canonicalValue = value => {
  if (typeof value === "bigint") return { $bigint: String(value) };
  if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("hex") };
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => lexicalCompare(left, right))
      .map(([key, entry]) => [key, canonicalValue(entry)]));
  }
  return value;
};
const canonicalJson = value => JSON.stringify(canonicalValue(value));
const boundedError = error => Object.freeze({
  name: String(error?.name ?? typeof error).slice(0, 128),
  message: String(error?.message ?? error).slice(0, 512),
  ...(typeof error?.kind === "string" ? { kind: error.kind.slice(0, 128) } : {}),
  ...(typeof error?.code === "string" ? { code: error.code.slice(0, 128) } : {}),
});
const canonicalDigest = value => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const jsonDigest = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
const boundedDiagnostic = value => String(value ?? "")
  .replace(/^RUNTIME_START_(?:STATE|PARTIAL)_WITNESS .*$/gm, "RUNTIME_START_WITNESS [omitted]")
  .slice(-8 * 1024);

function witnessEnvelope(value) {
  const raw = Buffer.from(canonicalJson(value), "utf8");
  assert.ok(raw.length <= WITNESS_RAW_LIMIT, "uncompressed witness exceeds 8 MiB");
  const compressed = gzipSync(raw);
  const envelope = { encoding: "gzip-base64", uncompressedBytes: raw.length,
    sha256: createHash("sha256").update(raw).digest("hex"), data: compressed.toString("base64") };
  const serialized = canonicalJson(envelope);
  assert.ok(Buffer.byteLength(serialized, "utf8") <= PARTIAL_WITNESS_LIMIT,
    "serialized witness envelope exceeds 900 KiB");
  return serialized;
}

function decodeWitnessEnvelope(serialized) {
  assert.ok(Buffer.byteLength(serialized, "utf8") <= PARTIAL_WITNESS_LIMIT);
  const envelope = JSON.parse(serialized);
  assert.deepEqual(Object.keys(envelope).sort(), ["data", "encoding", "sha256", "uncompressedBytes"]);
  assert.equal(envelope.encoding, "gzip-base64");
  assert.ok(Number.isSafeInteger(envelope.uncompressedBytes)
    && envelope.uncompressedBytes >= 0 && envelope.uncompressedBytes <= WITNESS_RAW_LIMIT);
  assert.match(envelope.sha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof envelope.data, "string");
  const compressed = Buffer.from(envelope.data, "base64");
  assert.equal(compressed.toString("base64"), envelope.data, "non-canonical witness base64");
  const raw = gunzipSync(compressed, { maxOutputLength: WITNESS_RAW_LIMIT });
  assert.equal(raw.length, envelope.uncompressedBytes);
  assert.equal(createHash("sha256").update(raw).digest("hex"), envelope.sha256);
  return JSON.parse(raw.toString("utf8"));
}

function assertWorkerEvidence(stdout) {
  const lines = stdout.split(/\r?\n/);
  const starts = lines.filter(line => line.startsWith("START ")).map(line => line.slice(6));
  const passes = lines.filter(line => line.startsWith("PASS ")
    && line !== "PASS runtime start worker cleanup").map(line => line.slice(5));
  assert.deepEqual(starts, [...CASE_NAMES]);
  assert.deepEqual(passes, starts);
  assert.equal(lines.filter(line => line === "PASS runtime start worker cleanup").length, 1);
  const timerLine = lines.find(line => line.startsWith("NATIVE_TIMER_CLEANUP "));
  const timerMatch = /^NATIVE_TIMER_CLEANUP finalizedRuns=(\d+) timersCleared=(\d+) pending=0 globalsRestored=true$/
    .exec(timerLine ?? "");
  assert.ok(timerMatch && Number(timerMatch[1]) > 0);
  assert.equal(Number(timerMatch[2]), Number(timerMatch[1]));
  const witnessLines = lines.filter(line => line.startsWith("RUNTIME_START_STATE_WITNESS "));
  assert.equal(witnessLines.length, 1);
  assert.ok(Buffer.byteLength(witnessLines[0], "utf8") <= 1024 * 1024);
  const witness = decodeWitnessEnvelope(witnessLines[0].slice("RUNTIME_START_STATE_WITNESS ".length));
  assert.equal(witness.schemaVersion, 2);
  assert.deepEqual(witness.caseNames, [...CASE_NAMES]);
  assert.deepEqual(witness.tableNames, [...SNAPSHOT_TABLES]);
  assert.deepEqual(witness.coreHashes, CORE_HASHES);
  assert.deepEqual(Object.keys(witness.nativeCleanup).sort(),
    ["completionOutcomes", "finalizedRuns", "timersCleared"]);
  assert.equal(witness.nativeCleanup.finalizedRuns, witness.nativeCleanup.timersCleared);
  assert.equal(Object.keys(witness.nativeCleanup.completionOutcomes).length,
    witness.nativeCleanup.finalizedRuns);
  assert.ok(Object.values(witness.nativeCleanup.completionOutcomes)
    .every(outcome => ["fulfilled", "rejected"].includes(outcome.status)));
  assert.deepEqual(Object.keys(witness.schemaInitialization.tables).sort(), [...SNAPSHOT_TABLES]);
  assert.ok(Object.values(witness.schemaInitialization.tables)
    .every(table => table.rowCount === 0 && table.columns.length > 0));
  assert.equal(witness.lockTimelines.length, 1);
  const [lockTimeline] = witness.lockTimelines;
  assert.deepEqual(Object.keys(lockTimeline).sort(),
    ["heldNanoseconds", "label", "lockedAtNanoseconds", "nativeInvokedAtNanoseconds",
      "nativeSettledAtNanoseconds", "releasedAtNanoseconds"]);
  assert.ok(BigInt(lockTimeline.lockedAtNanoseconds)
    <= BigInt(lockTimeline.nativeInvokedAtNanoseconds));
  assert.ok(BigInt(lockTimeline.nativeInvokedAtNanoseconds)
    < BigInt(lockTimeline.releasedAtNanoseconds));
  assert.ok(BigInt(lockTimeline.releasedAtNanoseconds)
    <= BigInt(lockTimeline.nativeSettledAtNanoseconds));
  assert.ok(BigInt(lockTimeline.heldNanoseconds) >= 200_000_000n);
  assert.deepEqual(witness.cases.map(item => item.name), [...CASE_NAMES]);
  assert.ok(Object.keys(witness.snapshots).length >= CASE_NAMES.length);
  for (const [hash, snapshot] of Object.entries(witness.snapshots)) {
    assert.equal(canonicalDigest(snapshot), hash);
    assert.deepEqual(Object.keys(snapshot.tables).sort(), [...SNAPSHOT_TABLES]);
    for (const table of Object.values(snapshot.tables)) {
      assert.deepEqual(table.columns, [...new Set(table.columns)].sort());
      assert.equal(table.rowCount, table.rows.length);
      assert.equal(table.sha256, canonicalDigest({ columns: table.columns, rows: table.rows }));
    }
  }
  for (const item of witness.cases) {
    assert.ok(witness.snapshots[item.before] && witness.snapshots[item.after]);
    assert.ok(Array.isArray(item.observations));
    assert.deepEqual(Object.keys(item.metrics).sort(),
      ["adapterCreates", "adapterDetaches", "adapterStreams", "guards", "observers", "runners", "scopes"]);
    for (const observation of item.observations) {
      assert.ok(witness.snapshots[observation.before] && witness.snapshots[observation.after]);
      assert.ok(observation.label && observation.result !== undefined);
      assert.ok(observation.expectedNativeEffect);
      assert.ok(Object.hasOwn(observation, "expectedNativeMutation"));
      assert.deepEqual(Object.keys(observation.metricDelta).sort(),
        ["adapterCreates", "adapterDetaches", "adapterStreams", "guards", "observers", "runners", "scopes"]);
      assert.deepEqual(Object.keys(observation.expectedMetrics).sort(),
        ["adapterCreates", "adapterDetaches", "adapterStreams", "runners"]);
      assert.deepEqual(Object.keys(observation.nativeDelta).sort(), SORTED_NATIVE_EFFECT_TABLES);
    }
  }
  assert.equal(lines.filter(line => line ===
    "WORKER_CLEANUP databaseClosed=true pendingCallbacks=0 globalsRestored=true").length, 1);
}

async function worker() {
  register(new URL("./native-http-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential - Reviewed package manifest path.
  });
  const { closeDbExec, getDbExec, withMigrationRuntime } = await import("@agent-native/core/db");
  const {
    ensureAgentHarnessSessionTables, getAgentHarnessBackgroundRun, getAgentHarnessSession,
    listAgentHarnessBackgroundTranscriptEvents, startAgentHarnessRun,
  } = await import("@agent-native/core/agent/harness");
  const { createThread: nativeCreateThread, getThread: nativeGetThread, setThreadScope } =
    await import("@vivary-test/core-server");
  const { createProjectRuntimePreparationService } =
    await import("../server/project-runtime-preparation.mjs");
  const { createRuntimePreparationReceiptPort } =
    await import("../server/runtime-preparation-receipts.mjs");
  const { createProjectRuntimeStartService } = await import("../server/project-runtime-start.mjs");
  const startServiceSource = await readFile(new URL("../server/project-runtime-start.mjs", import.meta.url), "utf8");
  const invalidHostCallbackMatch = /const INVALID_HOST_CALLBACK = Object\.freeze\(new Error\("([^"]+)"\)\);/.exec(startServiceSource);
  assert.ok(invalidHostCallbackMatch);
  const invalidHostCallbackMessage = invalidHostCallbackMatch[1];
  const { createRuntimeStartReceiptPort } = await import("../server/runtime-start-receipts.mjs");
  const { createProjectRuntimeActivity } = await import("../server/project-runtime-activity.mjs");
  const { createCreationReceiptStore } = await import("../server/creation-receipts.mjs");
  const { createRegistryStore } = await import("../server/registry-store.mjs");
  const { getDb } = await import("../server/db/index.mjs");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const tables = await import("../server/db/schema.mjs");
  const { evaluateRegistryOperation } = await import("../../../scripts/registry_contract_model.mjs");

  const corePackageJson = await realpath(process.env.VIVARY_TEST_CORE_PACKAGE_JSON); // guard:allow-env-credential - Reviewed package manifest path.
  const coreRoot = path.dirname(corePackageJson);
  const actualCoreHashes = {};
  for (const [relative, expected] of Object.entries(CORE_HASHES)) {
    const absolute = await realpath(path.join(coreRoot, ...relative.split("/")));
    assert.equal(path.relative(coreRoot, absolute).replaceAll("\\", "/"), relative);
    actualCoreHashes[relative] = createHash("sha256").update(await readFile(absolute)).digest("hex");
    assert.equal(actualCoreHashes[relative], expected, `reviewed Core input changed: ${relative}`);
  }
  const runStorePath = await realpath(path.join(coreRoot, "dist", "agent", "run-store.js"));
  const { cleanupOldRuns, ensureRunTables } = await import(pathToFileURL(runStorePath).href);

  const nativeRetentionMs = 5 * 60 * 1000;
  const originalSetTimeoutDescriptor = Object.getOwnPropertyDescriptor(globalThis, "setTimeout");
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const ownedTimers = new Map();
  const activeNativeRunIds = new Set();
  const nativeInvokedAtNanoseconds = new Map();
  const ownedNativeDrains = new Set();
  const nativeCompletionOutcomes = new Map();
  const nativeDrainFailures = [];
  const seenNativeCompletions = new WeakSet();
  let finalizedRuns = 0;
  let timersCleared = 0;
  Object.defineProperty(globalThis, "setTimeout", { ...originalSetTimeoutDescriptor,
    value(callback, delay, ...args) {
      const handle = Reflect.apply(originalSetTimeout, globalThis, [callback, delay, ...args]);
      if (activeNativeRunIds.size > 0 && delay === nativeRetentionMs) {
        ownedTimers.set(handle, Object.freeze([...activeNativeRunIds]));
      }
      return handle;
    } });
  const clearOwnedTimer = runId => {
    for (const [handle, candidates] of ownedTimers) {
      if (!candidates.includes(runId)) continue;
      Reflect.apply(originalClearTimeout, globalThis, [handle]);
      ownedTimers.delete(handle);
      timersCleared += 1;
      return 1;
    }
    return 0;
  };
  const ownNativeCompletion = (promise, runId) => {
    assert.ok(promise instanceof Promise);
    if (seenNativeCompletions.has(promise)) return;
    seenNativeCompletions.add(promise);
    let drain;
    drain = (async () => {
      let outcome;
      try {
        await promise;
        outcome = Object.freeze({ status: "fulfilled" });
      } catch (error) {
        outcome = Object.freeze({ status: "rejected",
          error: String(error?.message ?? error).slice(0, 512) });
      }
      nativeCompletionOutcomes.set(runId, outcome);
      finalizedRuns += 1;
      // The pinned run manager deduplicates cleanupOldRuns through one module-level
      // in-flight promise. Calling the same reviewed export after completion joins
      // its fire-and-forget sweep when still active, or performs a completed
      // happens-after sweep when it already settled.
      await cleanupOldRuns(24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
      const cleared = clearOwnedTimer(runId);
      if (cleared !== 1) throw new Error(`owned Native retention timer mismatch for ${runId}: ${cleared}`);
      activeNativeRunIds.delete(runId);
    })().finally(() => ownedNativeDrains.delete(drain));
    ownedNativeDrains.add(drain);
    drain.catch(error => nativeDrainFailures.push(error));
  };
  const drainOwnedNative = async () => {
    await Promise.allSettled([...ownedNativeDrains]);
    if (nativeDrainFailures.length > 0) {
      throw new AggregateError([...nativeDrainFailures], "owned Native cleanup failed");
    }
  };

  const context = Object.freeze({ userEmail: "runtime-start@example.test",
    orgId: "runtime-start-org", appId: "workbench", caller: "private-fixture" });
  const currentScope = Object.freeze({ actorId: "runtime-start-actor",
    collectionId: "runtime-start-collection", deviceId: "runtime-start-device",
    policyRevision: 7, locationRefs: Object.freeze(["primary"]) });
  const BASE_SCOPE_KEY = jsonDigest(currentScope);
  const identityFields = Object.freeze([
    "ownerEmail", "orgId", "actorId", "collectionId", "deviceId", "projectId", "bindingId",
    "bindingRevision", "rootId", "contentRevision", "locationRef", "policyRevision", "harnessName",
    "runtimeVersion", "executionLocation", "authorityContract", "runtimeConfigurationRevision",
  ]);
  const identity = (patch = {}) => Object.freeze({ ownerEmail: context.userEmail, orgId: context.orgId,
    actorId: "runtime-start-actor", collectionId: "runtime-start-collection",
    deviceId: "runtime-start-device", projectId: "runtime-start-project",
    bindingId: "runtime-start-binding", bindingRevision: 4, rootId: "synthetic-runtime-root",
    contentRevision: "synthetic-content-1", locationRef: "primary", policyRevision: 7,
    harnessName: "synthetic-harness", runtimeVersion: "synthetic-v1",
    executionLocation: "synthetic-habitat", authorityContract: "runtime-preparation-v1",
    runtimeConfigurationRevision: 3, ...patch });
  const prepareRequest = (operationId, patch = {}) => ({ schemaVersion: 1, operationId,
    scopeKey: BASE_SCOPE_KEY, projectId: "runtime-start-project", expectedBindingRevision: 4,
    expectedPolicyRevision: 7, role: "developer", ...patch });
  const startLookup = (operationId, preparationId, patch = {}) => ({ schemaVersion: 1,
    preparationId, preparationOperationId: operationId, scopeKey: BASE_SCOPE_KEY,
    projectId: "runtime-start-project", expectedBindingRevision: 4,
    expectedPolicyRevision: 7, ...patch });
  const profileConfiguration = (patch = {}) => ({ schemaVersion: 1,
    kind: "synthetic-native-adapter", harnessName: "synthetic-harness",
    runtimeVersion: "synthetic-v1", fixtureRevision: "fixture-v1",
    turnInputDigest: TURN_INPUT_DIGEST, ...patch });
  const bindingDigest = value => jsonDigest(Object.fromEntries(
    identityFields.map(field => [field, value[field]])));

  const pendingCallbacks = new Set();
  const unclaimedCallbackOutcomes = new Map();
  const trackPending = promise => {
    pendingCallbacks.add(promise);
    promise.then(() => pendingCallbacks.delete(promise),
      () => pendingCallbacks.delete(promise));
    return promise;
  };
  const trackHostCallback = promise => {
    trackPending(promise);
    promise.then(() => {
      unclaimedCallbackOutcomes.set(promise, Object.freeze({ status: "fulfilled" }));
    }, error => {
      unclaimedCallbackOutcomes.set(promise, Object.freeze({ status: "rejected", error }));
    });
    return promise;
  };
  const deferred = () => {
    let resolve;
    let settled = false;
    const promise = new Promise(accept => { resolve = value => { settled = true; accept(value); }; });
    return Object.freeze({ promise, resolve, get settled() { return settled; } });
  };
  const assertDeepFrozen = value => {
    if (value === null || typeof value !== "object") return;
    assert.equal(Object.isFrozen(value), true);
    for (const nested of Object.values(value)) assertDeepFrozen(nested);
  };
  function allocator(prefix, effect = null) {
    const counts = new Map();
    const allocateId = async kind => {
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      if (effect) return effect(kind, count);
      return `${prefix}_${kind}_${count}`;
    };
    return { allocateId, id: kind => `${prefix}_${kind}_1`,
      idAt: (kind, count) => `${prefix}_${kind}_${count}`,
      count: kind => counts.get(kind) ?? 0 };
  }

  let metrics;
  function hostFixture(mode = "normal", expectedOperation = "runtime-start") {
    let selectedMode = mode;
    let retainedOuter = null;
    let retainedInner = null;
    const ownedCallbacks = [];
    const current = () => typeof selectedMode === "string"
      ? Object.freeze({ kind: selectedMode }) : selectedMode;
    const ownCallback = promise => {
      ownedCallbacks.push(promise);
      trackHostCallback(promise);
      return promise;
    };
    const settle = async promise => {
      try { await promise; return Object.freeze({ status: "fulfilled" }); }
      catch (error) { return Object.freeze({ status: "rejected",
        error: String(error?.message ?? error).slice(0, 512) }); }
    };
    const guard = Object.freeze({
      async executeOnce(admission, invoke) {
        const behavior = current();
        metrics.guards += 1;
        assert.deepEqual(Object.keys(admission), ["schemaVersion", "operation", "operationId",
          "requestDigest", "collectionId", "deviceId"]);
        assert.equal(admission.schemaVersion, 1);
        assert.equal(admission.operation, expectedOperation);
        assert.match(admission.requestDigest, /^[0-9a-f]{64}$/);
        assert.equal(admission.collectionId, currentScope.collectionId);
        assert.equal(admission.deviceId, currentScope.deviceId);
        if (behavior.kind === "guard-refuse") return { code: "denied" };
        if (behavior.kind === "guard-early") { retainedInner = invoke; return {}; }
        if (behavior.kind === "guard-pending") {
          ownCallback(Promise.resolve().then(() => invoke()));
          await behavior.returnAfter.promise;
          return {};
        }
        if (behavior.kind === "guard-retained") retainedInner = invoke;
        const value = await invoke();
        if (behavior.kind === "guard-double") ownCallback(Promise.resolve().then(() => invoke()));
        return behavior.kind === "guard-substitute" ? {} : value;
      },
    });
    const host = Object.freeze({
      async withCreationScope(scope, enter) {
        const behavior = current();
        metrics.scopes += 1;
        assert.deepEqual(Object.keys(scope), ["collectionId", "deviceId"]);
        if (behavior.kind === "outer-refuse") return { code: "denied" };
        if (behavior.kind === "outer-early") { retainedOuter = enter; return {}; }
        if (behavior.kind === "outer-pending") {
          ownCallback(Promise.resolve().then(() => enter(guard)));
          await behavior.returnAfter.promise;
          return {};
        }
        if (behavior.kind === "outer-retained") retainedOuter = enter;
        const value = await enter(guard);
        if (behavior.kind === "outer-double") {
          ownCallback(Promise.resolve().then(() => enter(guard)));
        }
        return behavior.kind === "outer-substitute" ? {} : value;
      },
    });
    return Object.freeze({ host, setMode(next) { selectedMode = next; }, async drain() {
      const capturedOuter = retainedOuter;
      const capturedInner = retainedInner;
      retainedOuter = null;
      retainedInner = null;
      if (capturedOuter) ownCallback(Promise.resolve().then(() => capturedOuter(guard)));
      if (capturedInner) ownCallback(Promise.resolve().then(() => capturedInner()));
      const claimed = ownedCallbacks.splice(0);
      const results = await Promise.all(claimed.map(settle));
      for (const promise of claimed) unclaimedCallbackOutcomes.delete(promise);
      return Object.freeze(results);
    } });
  }

  function preparationPortProxy(base, overrides = {}) {
    return Object.freeze(Object.fromEntries(["read", "reserve", "beginThreadCreation",
      "recordThreadCandidate", "verifySettlement", "quarantine", "cancelBeforeCreation"]
      .map(name => [name, overrides[name] ?? ((...args) => base[name](...args))])));
  }
  function startPortProxy(base, overrides = {}) {
    return Object.freeze(Object.fromEntries(["read", "reserve", "beginStart",
      "recordReferenceCandidate", "verifySettlement", "quarantine"]
      .map(name => [name, overrides[name] ?? ((...args) => base[name](...args))])));
  }

  function preparationComposition(prefix, { factsValue = identity(), factsEffect = null,
    preparationAuthority = null, receiptPort = null, preparationHost = null,
    getThreadEffect = null } = {}) {
    const ids = allocator(`${prefix}_prep`);
    const basePort = createRuntimePreparationReceiptPort({ db: getDb() });
    const authority = preparationAuthority ?? { roles: ["developer", "planner", "qa"],
      roleContractRevision: 11, preparationAuthorityRevision: 13 };
    const host = preparationHost ?? hostFixture("normal", "runtime-prepare");
    const service = createProjectRuntimePreparationService({
      resolveFacts: async (_request, suppliedContext) => {
        assert.deepEqual(suppliedContext, context);
        return { scopeKey: BASE_SCOPE_KEY,
          identity: structuredClone(factsEffect ? await factsEffect() : factsValue) };
      },
      resolvePreparationAuthority: async (_request, suppliedContext) => {
        assert.deepEqual(suppliedContext, context);
        return structuredClone(authority);
      },
      preparationHost: host.host, receiptPort: receiptPort?.(basePort) ?? basePort,
      allocateId: ids.allocateId, createThread: nativeCreateThread,
      getThread: getThreadEffect ?? nativeGetThread,
    });
    return { service, basePort, ids, host, authority, factsValue };
  }

  async function createPrepared(prefix, options = {}) {
    const preparation = preparationComposition(prefix, options);
    const operationId = options.operationId ?? `${prefix}_prepare_operation`;
    const request = prepareRequest(operationId);
    const result = await preparation.service.prepare(request, context);
    assert.deepEqual(result, { code: "prepared", preparationId: preparation.ids.id("preparation"),
      replayed: false });
    return { ...preparation, operationId, request, preparationId: result.preparationId,
      lookup: startLookup(operationId, result.preparationId), identity: options.factsValue ?? identity() };
  }
  async function createPreparedOn(preparation, operationId) {
    const request = prepareRequest(operationId);
    const result = await preparation.service.prepare(request, context);
    assert.equal(result.code, "prepared");
    assert.equal(result.replayed, false);
    return { ...preparation, operationId, request, preparationId: result.preparationId,
      lookup: startLookup(operationId, result.preparationId), identity: identity() };
  }

  const adapterState = new Map();
  function syntheticAdapter(prefix, mode = "normal", hooks = {}) {
    return Object.freeze({ name: "synthetic-harness", label: "Synthetic Native proof",
      description: "Deterministic in-process adapter for the bounded first-start fixture.",
      capabilities: Object.freeze({ sandbox: false, resumable: true, approvals: false,
        hostTools: false, fileEvents: false }),
      async createSession(options) {
        metrics.adapterCreates += 1;
        hooks.createEntered?.resolve();
        if (hooks.createHold && (!hooks.createHoldWhen || hooks.createHoldWhen(options))) {
          await hooks.createHold.promise;
        }
        if (mode === "reject-before") throw new Error("synthetic create rejection");
        const providerId = mode === "wrong-provider-id" ? "bad\ud800"
          : `provider_${prefix}_${options.sessionId}`;
        const expectedEvents = Object.freeze([
          Object.freeze({ type: "activity", label: "Starting Synthetic Native proof", tool: "harness" }),
          Object.freeze({ type: "text", text: `synthetic output ${prefix}` }),
          Object.freeze({ type: "activity", label: "Synthetic bounded step", tool: "fixture" }),
          Object.freeze({ type: "done" }),
        ]);
        const state = { streamSettled: false, detachSettled: false,
          expectedEvents, options: canonicalValue(options) };
        adapterState.set(providerId, state);
        if (mode === "missing-reply") return undefined;
        const session = {
          id: providerId,
          streamTurn: async function* (input) {
            metrics.adapterStreams += 1;
            assert.equal(input.prompt, TURN_INPUT);
            hooks.streamEntered?.resolve();
            if (hooks.streamHold) await hooks.streamHold.promise;
            try {
              yield { type: "text-delta", text: `synthetic output ${prefix}` };
              yield { type: "activity", label: "Synthetic bounded step", tool: "fixture" };
              yield { type: "done", reason: "complete" };
            } finally { state.streamSettled = true; }
          },
          detach: async () => {
            metrics.adapterDetaches += 1;
            hooks.detachEntered?.resolve();
            if (hooks.detachHold) await hooks.detachHold.promise;
            state.detachSettled = true;
            return { fixtureRevision: "fixture-v1", providerId };
          },
          stop: async () => undefined,
        };
        if (mode === "reject-after") {
          adapterState.set(providerId, state);
          throw new Error("synthetic reply lost after controlled allocation");
        }
        return session;
      },
    });
  }

  async function settlementObserver(input) {
    metrics.observers += 1;
    // The completion promise precedes Native's fire-and-forget retention sweep.
    // Join that owned write before the observer proves durable rows and the
    // service revalidates its receipt on the same SQLite database.
    await cleanupOldRuns(24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
    assert.deepEqual(Object.keys(input), ["schemaVersion", "reference", "identity", "providerSessionId"]);
    assert.equal(Object.isFrozen(input), true);
    assert.equal(Object.isFrozen(input.reference), true);
    assert.equal(Object.isFrozen(input.identity), true);
    assert.equal(input.schemaVersion, 1);
    const reference = input.reference;
    const currentThread = await nativeGetThread(reference.nativeThreadId);
    const currentSession = await getAgentHarnessSession(reference.nativeSessionId);
    const currentRun = await getAgentHarnessBackgroundRun(reference.nativeRunId,
      { ownerEmail: input.identity.ownerEmail, orgId: input.identity.orgId });
    const transcript = await listAgentHarnessBackgroundTranscriptEvents(reference.nativeRunId,
      { ownerEmail: input.identity.ownerEmail, orgId: input.identity.orgId });
    assert.equal(currentThread?.id, reference.nativeThreadId);
    assert.equal(currentSession?.providerSessionId, input.providerSessionId);
    assert.equal(currentSession?.threadId, reference.nativeThreadId);
    assert.equal(currentSession?.runId, reference.nativeRunId);
    assert.equal(currentSession?.status, "idle");
    assert.equal(currentRun?.id, reference.nativeRunId);
    assert.equal(currentRun?.kind, "harness");
    assert.equal(currentRun?.source, "agent-harness");
    assert.deepEqual(currentRun?.sourceRecord, { type: "agent-harness-session",
      id: reference.nativeSessionId, threadId: reference.nativeThreadId,
      name: reference.harnessName });
    assert.equal(currentRun?.metadata?.harnessName, reference.harnessName);
    assert.equal(currentRun?.metadata?.sessionId, reference.nativeSessionId);
    assert.equal(currentRun?.metadata?.providerSessionId, input.providerSessionId);
    assert.equal(currentRun?.metadata?.threadId, reference.nativeThreadId);
    assert.equal(currentRun?.metadata?.runId, reference.nativeRunId);
    assert.equal(currentRun?.metadata?.status, "idle");
    const runResult = await getDbExec().execute({ sql: "SELECT * FROM agent_runs WHERE id = ?",
      args: [reference.nativeRunId] });
    assert.equal(runResult.rows.length, 1);
    const runRow = Object.fromEntries(Object.entries(runResult.rows[0]));
    assert.equal(runRow.id, reference.nativeRunId);
    assert.equal(runRow.thread_id, reference.nativeThreadId);
    assert.equal(runRow.status, "completed");
    assert.ok(Number(runRow.completed_at) >= Number(runRow.started_at));
    assert.equal(runRow.turn_id, reference.nativeRunId);
    assert.equal(runRow.abort_reason, null);
    assert.equal(runRow.error_code, null);
    assert.equal(runRow.error_detail, null);
    assert.equal(runRow.terminal_reason, "done");
    assert.equal(runRow.dispatch_mode, null);
    assert.equal(runRow.dispatch_payload, null);
    assert.equal(runRow.diag_stage, null);
    const eventsResult = await getDbExec().execute({
      sql: "SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY seq", args: [reference.nativeRunId] });
    const eventRows = eventsResult.rows.map(row => Object.fromEntries(Object.entries(row)));
    assert.equal(eventRows.length, 4);
    assert.deepEqual(eventRows.map(row => Number(row.seq)), [0, 1, 2, 3]);
    const parsedEvents = eventRows.map(row => JSON.parse(String(row.event_data)));
    const state = adapterState.get(input.providerSessionId);
    assert.ok(state);
    assert.deepEqual(parsedEvents, state.expectedEvents);
    assert.equal(state?.streamSettled, true);
    assert.equal(state?.detachSettled, true);
    const transcriptTimestamp = new Date(currentSession.updatedAt).toISOString();
    const transcriptShape = (event, seq) => {
      const id = `${reference.nativeRunId}:${seq}`;
      const summary = event.type === "text"
        ? { kind: "note", message: event.text, metadata: {} }
        : event.type === "done"
          ? { kind: "status", message: "Run completed", metadata: {} }
          : { kind: "status", message: event.label,
            metadata: event.tool ? { tool: event.tool } : {} };
      return { schemaVersion: 1, id, runId: reference.nativeRunId, kind: summary.kind,
        source: "agent-harness", sourceRecord: { type: "agent-harness-run-event", id, seq },
        message: summary.message, createdAt: transcriptTimestamp,
        metadata: { ...summary.metadata, seq, harnessName: reference.harnessName,
          sessionId: reference.nativeSessionId } };
    };
    assert.deepEqual(transcript, parsedEvents.map(transcriptShape));
    const runRowDigest = canonicalDigest(runRow);
    const runEventsDigest = canonicalDigest(eventRows);
    return { schemaVersion: 1, nativeThreadId: reference.nativeThreadId,
      nativeSessionId: reference.nativeSessionId, nativeRunId: reference.nativeRunId,
      harnessName: reference.harnessName, runRowDigest, runEventsDigest };
  }

  function startComposition(prefix, prepared, { hostMode = "normal", hostValue = null,
    startAuthority = null, resolveAuthorityEffect = null, receiptPort = null,
    adapterMode = "normal", adapter = null, descriptor = null, allocatorEffect = null,
    runnerEffect = null, observerEffect = null, preparationService = null,
    getThreadEffect = null, getSessionEffect = null, getRunEffect = null,
    expectedPreparationIds = null } = {}) {
    const ids = allocator(`${prefix}_start`, allocatorEffect);
    const basePort = createRuntimeStartReceiptPort({ db: getDb() });
    const host = hostValue ?? hostFixture(hostMode);
    const authority = startAuthority ?? { roles: ["developer", "planner", "qa"],
      startAuthorityRevision: 17 };
    let authorityCalls = 0;
    const service = createProjectRuntimeStartService({
      preparationService: preparationService ?? prepared.service,
      startHost: host.host,
      resolveStartAuthority: async (claim, suppliedContext) => {
        authorityCalls += 1;
        assert.deepEqual(suppliedContext, context);
        assertDeepFrozen(claim);
        if (expectedPreparationIds) assert.ok(expectedPreparationIds.includes(claim.preparationId));
        else assert.equal(claim.preparationId, prepared.preparationId);
        return structuredClone(resolveAuthorityEffect
          ? await resolveAuthorityEffect(authorityCalls, claim, authority) : authority);
      },
      receiptPort: receiptPort?.(basePort) ?? basePort, allocateId: ids.allocateId,
      syntheticProfile: { configuration: descriptor ?? profileConfiguration(),
        adapter: adapter ?? syntheticAdapter(prefix, adapterMode) },
      startAgentHarnessRun: options => {
        metrics.runners += 1;
        activeNativeRunIds.add(options.runId);
        let waitRegistered = false;
        const wrappedWaitUntil = options.runOptions.waitUntil;
        options.runOptions.waitUntil = promise => {
          waitRegistered = true;
          ownNativeCompletion(promise, options.runId);
          return wrappedWaitUntil(promise);
        };
        try {
          let active;
          if (runnerEffect) {
            active = runnerEffect(options, promise => {
              waitRegistered = true;
              ownNativeCompletion(promise, options.runId);
            });
          } else {
            nativeInvokedAtNanoseconds.set(options.runId, process.hrtime.bigint().toString());
            active = startAgentHarnessRun(options);
          }
          if (!waitRegistered) activeNativeRunIds.delete(options.runId);
          return active;
        } catch (error) {
          if (!waitRegistered) activeNativeRunIds.delete(options.runId);
          throw error;
        }
      },
      getThread: getThreadEffect ?? nativeGetThread,
      getAgentHarnessSession: getSessionEffect ?? getAgentHarnessSession,
      getAgentHarnessBackgroundRun: getRunEffect ?? getAgentHarnessBackgroundRun,
      observeSettlement: observerEffect ?? settlementObserver,
    });
    return { service, basePort, ids, host, authority, authorityCalls: () => authorityCalls };
  }

  async function snapshot() {
    const tables = {};
    for (const name of SNAPSHOT_TABLES) {
      const info = await getDbExec().execute({ sql: `PRAGMA table_info(${name})`, args: [] });
      const columns = info.rows.map(row => String(row.name)).sort();
      assert.ok(columns.length > 0, `missing fixture table ${name}`);
      const selected = await getDbExec().execute({ sql: `SELECT * FROM ${name}`, args: [] });
      const rows = selected.rows.map(row => Object.fromEntries(
        columns.map(column => [column, canonicalValue(row[column])]),
      )).sort((left, right) => lexicalCompare(canonicalJson(left), canonicalJson(right)));
      tables[name] = { columns, rows, rowCount: rows.length,
        sha256: canonicalDigest({ columns, rows }) };
    }
    return { schemaVersion: 1, tables };
  }
  const deltaBetween = (before, after) => Object.fromEntries(NATIVE_EFFECT_TABLES.map(name => {
    const beforeRows = new Map(before.tables[name].rows.map(row => [canonicalJson(row), row]));
    const afterRows = new Map(after.tables[name].rows.map(row => [canonicalJson(row), row]));
    const added = [...afterRows.keys()].filter(key => !beforeRows.has(key)).sort();
    const removed = [...beforeRows.keys()].filter(key => !afterRows.has(key)).sort();
    return [name, { rowCountDelta: after.tables[name].rowCount - before.tables[name].rowCount,
      addedRows: added.map(key => afterRows.get(key)),
      removedRows: removed.map(key => beforeRows.get(key)) }];
  }));
  const metricDeltaBetween = (before, after) => Object.fromEntries(Object.keys(before)
    .sort().map(key => [key, after[key] - before[key]]));
  const assertNativeEffect = (expected, before, after, label) => {
    assert.ok(expected, `missing Native effect expectation for ${label}`);
    if (expected === NO_NATIVE_EFFECT) {
      for (const name of NATIVE_EFFECT_TABLES) {
        assert.deepEqual(after.tables[name].rows, before.tables[name].rows,
          `${label} unexpectedly changed ${name}`);
      }
      return;
    }
    assert.deepEqual(Object.keys(expected).sort(), SORTED_NATIVE_EFFECT_TABLES,
      `${label} has an incomplete Native delta expectation`);
    const expectedMutation = NATIVE_EFFECT_MUTATIONS.get(expected) ?? null;
    for (const name of NATIVE_EFFECT_TABLES) {
      assert.equal(after.tables[name].rowCount - before.tables[name].rowCount, expected[name],
        `${label} row delta for ${name}`);
      const change = deltaBetween(before, after)[name];
      if (expectedMutation?.table === name) {
        assert.equal(change.removedRows.length, 1, `${label} replaces one ${name} row`);
        assert.equal(change.addedRows.length, 1, `${label} adds one replacement ${name} row`);
        const removed = change.removedRows[0];
        const added = change.addedRows[0];
        for (const [key, value] of Object.entries(expectedMutation.key)) {
          assert.equal(removed[key], value, `${label} original ${name}.${key}`);
          assert.equal(added[key], value, `${label} replacement ${name}.${key}`);
        }
        assert.equal(added[expectedMutation.field], expectedMutation.value,
          `${label} exact replacement ${name}.${expectedMutation.field}`);
        assert.deepEqual(Object.fromEntries(Object.entries(added)
          .filter(([field]) => field !== expectedMutation.field)),
        Object.fromEntries(Object.entries(removed)
          .filter(([field]) => field !== expectedMutation.field)),
        `${label} changed more than ${name}.${expectedMutation.field}`);
        const preserved = before.tables[name].rows
          .filter(row => canonicalJson(row) !== canonicalJson(removed));
        const exactAfter = [...preserved, added]
          .sort((left, right) => lexicalCompare(canonicalJson(left), canonicalJson(right)));
        assert.deepEqual(after.tables[name].rows, exactAfter,
          `${label} did not preserve all non-target ${name} rows`);
      } else {
        assert.deepEqual(change.removedRows, [], `${label} removed or replaced ${name} rows`);
        const preservedAndAdded = [...before.tables[name].rows, ...change.addedRows]
          .sort((left, right) => lexicalCompare(canonicalJson(left), canonicalJson(right)));
        assert.deepEqual(after.tables[name].rows, preservedAndAdded,
          `${label} did not preserve and append complete ${name} rows`);
      }
    }
    assertFullNativeRows(expected, before, after, label);
  };
  const assertFullNativeRows = (expected, before, after, label) => {
    if (NATIVE_EFFECT_MUTATIONS.has(expected)) return;
    const changes = deltaBetween(before, after);
    const addedSessions = changes.agent_harness_sessions.addedRows;
    const addedRuns = changes.agent_runs.addedRows;
    const addedEvents = changes.agent_run_events.addedRows;
    assert.equal(addedSessions.length, expected.agent_harness_sessions,
      `${label} complete session rows`);
    assert.equal(addedRuns.length, expected.agent_runs, `${label} complete run rows`);
    assert.equal(addedEvents.length, expected.agent_run_events, `${label} complete event rows`);
    for (const session of addedSessions) {
      assert.match(String(session.id), /_start_native-session_\d+$/);
      assert.equal(session.harness_name, "synthetic-harness");
      assert.match(String(session.thread_id), /_native-thread_\d+$/);
      assert.match(String(session.run_id), /_start_native-run_\d+$/);
      assert.equal(session.status, "idle");
      assert.equal(session.owner_email, context.userEmail);
      assert.equal(session.org_id, context.orgId);
      assert.equal(session.pending_approval, null);
      assert.equal(session.workspace_ref, null);
      assert.equal(session.stopped_at, null);
      assert.equal(session.resolved_approval_ids, "[]");
      assert.ok(Number(session.generation) >= 1);
      assert.ok(Number(session.created_at) > 0);
      assert.ok(Number(session.updated_at) >= Number(session.created_at));
      const prefix = String(session.run_id).replace(/_start_native-run_\d+$/, "");
      assert.equal(session.provider_session_id, `provider_${prefix}_${session.id}`);
      assert.deepEqual(JSON.parse(String(session.resume_state)),
        { fixtureRevision: "fixture-v1", providerId: session.provider_session_id });
    }
    for (const run of addedRuns) {
      assert.match(String(run.id), /_start_native-run_\d+$/);
      assert.match(String(run.thread_id), /_native-thread_\d+$/);
      assert.equal(run.turn_id, run.id);
      assert.ok(["completed", "errored", "running"].includes(run.status));
      assert.ok(Number(run.started_at) > 0);
      assert.ok(Number(run.heartbeat_at) >= Number(run.started_at));
      assert.ok(Number(run.last_progress_at) >= Number(run.started_at));
      assert.equal(run.abort_reason, null);
      assert.equal(run.dispatch_mode, null);
      assert.equal(run.dispatch_payload, null);
      assert.equal(run.diag_stage, null);
      assert.equal(run.peak_rss_mb, null);
      if (run.status === "completed") {
        assert.ok(Number(run.completed_at) >= Number(run.started_at));
        assert.equal(run.error_code, null);
        assert.equal(run.error_detail, null);
        assert.equal(run.terminal_reason, "done");
      }
    }
    const eventsByRun = new Map();
    for (const row of addedEvents) {
      const runId = String(row.run_id);
      const rows = eventsByRun.get(runId) ?? [];
      rows.push(row);
      eventsByRun.set(runId, rows);
    }
    for (const [runId, rows] of eventsByRun) {
      const ordered = [...rows].sort((left, right) => Number(left.seq) - Number(right.seq));
      assert.deepEqual(ordered.map(row => Number(row.seq)),
        ordered.length === 4 ? [0, 1, 2, 3] : [0, 1]);
      assert.ok(ordered.every(row => Number(row.event_at) > 0));
      const parsed = ordered.map(row => JSON.parse(String(row.event_data)));
      assert.deepEqual(parsed[0],
        { type: "activity", label: "Starting Synthetic Native proof", tool: "harness" });
      if (ordered.length === 4) {
        const prefix = runId.replace(/_start_native-run_\d+$/, "");
        assert.deepEqual(parsed, [parsed[0],
          { type: "text", text: `synthetic output ${prefix}` },
          { type: "activity", label: "Synthetic bounded step", tool: "fixture" },
          { type: "done" }]);
      } else {
        assert.equal(parsed[1]?.type, "error");
      }
    }
    assert.deepEqual(changes.agent_run_outcome_daily.addedRows, [],
      `${label} must not append outcome rollups`);
    assert.deepEqual(changes.agent_tool_ledger.addedRows, [],
      `${label} must not append tool ledger rows`);
  };
  const assertExpectedMetrics = (expected, before, after, label) => {
    assert.ok(expected, `missing metric expectation for ${label}`);
    assert.deepEqual(Object.keys(expected).sort(),
      ["adapterCreates", "adapterDetaches", "adapterStreams", "runners"],
      `${label} has an incomplete metric expectation`);
    const actual = metricDeltaBetween(before, after);
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(actual[name], value, `${label} metric delta for ${name}`);
    }
  };
  async function clearFixture() {
    for (const table of ["agent_run_events", "agent_runs", "agent_harness_sessions",
      "agent_run_outcome_daily", "agent_tool_ledger", "chat_threads", "vivary_registry_receipts",
      "vivary_registry_bindings", "vivary_registry_projects", "vivary_registry_revisions"]) {
      await getDbExec().execute({ sql: `DELETE FROM ${table}`, args: [] });
    }
    adapterState.clear();
  }
  async function receiptRows(operation = null) {
    const result = await getDbExec().execute({ sql: operation
      ? "SELECT * FROM vivary_registry_receipts WHERE operation = ? ORDER BY operation_id, receipt_key"
      : "SELECT * FROM vivary_registry_receipts ORDER BY operation, operation_id, receipt_key",
    args: operation ? [operation] : [] });
    return result.rows.map(row => Object.fromEntries(Object.entries(row)));
  }
  async function startRecord(preparationId) {
    const rows = (await receiptRows("runtime-start"))
      .filter(row => row.operation_id === preparationId);
    assert.equal(rows.length, 1);
    return { row: rows[0], record: JSON.parse(String(rows[0].record)) };
  }
  async function preparationRecord(operationId) {
    const rows = (await receiptRows("runtime-prepare"))
      .filter(row => row.operation_id === operationId);
    assert.equal(rows.length, 1);
    return { row: rows[0], record: JSON.parse(String(rows[0].record)) };
  }
  async function replaceStart(preparationId, mutateRow, mutateRecord) {
    const { row, record } = await startRecord(preparationId);
    const rawRecord = mutateRecord?.(record);
    const next = { ...row };
    mutateRow?.(next);
    await getDbExec().execute({ sql: `UPDATE vivary_registry_receipts SET receipt_key = ?,
      request_digest = ?, creation_namespace_key = ?, creation_child_key = ?, creation_phase = ?, record = ?
      WHERE operation = 'runtime-start' AND operation_id = ?`, args: [next.receipt_key,
    next.request_digest, next.creation_namespace_key, next.creation_child_key,
    next.creation_phase, typeof rawRecord === "string" ? rawRecord : JSON.stringify(record),
    preparationId] });
  }
  async function seedRunCollision(id, threadId) {
    const now = Date.now();
    await getDbExec().execute({ sql: `INSERT INTO agent_runs
      (id, thread_id, status, started_at, heartbeat_at, last_progress_at, turn_id)
      VALUES (?, ?, 'completed', ?, ?, ?, ?)`, args: [id, threadId, now, now, now, id] });
  }
  async function seedSessionCollision(id, threadId, runId) {
    await getDbExec().execute({ sql: `INSERT INTO agent_harness_sessions
      (id, harness_name, thread_id, run_id, provider_session_id, status, owner_email, org_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`, args: [id, "synthetic-harness", threadId,
    runId, `provider_collision_${id}`, context.userEmail, context.orgId, Date.now(), Date.now()] });
  }
  async function waitForCount(sql, args, expected, label) {
    for (let attempt = 0; attempt < 2_000; attempt += 1) {
      const result = await getDbExec().execute({ sql, args });
      if (Number(result.rows[0]?.count ?? -1) === expected) return;
      await new Promise(resolve => setImmediate(resolve));
    }
    throw new Error(`bounded SQL wait did not reach ${label}`);
  }
  async function installFixtureTrigger(name, definition) {
    assert.match(name, /^fixture_[a-z0-9_]+$/);
    await getDbExec().execute(`CREATE TRIGGER ${name} ${definition}`);
    let open = true;
    return async () => {
      if (!open) return;
      open = false;
      await getDbExec().execute(`DROP TRIGGER ${name}`);
    };
  }
  const fixtureWriteLocks = new Map();
  async function acquireFixtureWriteLock(id) {
    assert.match(id, /^[a-z0-9-]+$/);
    const databaseUrl = process.env.DATABASE_URL; // guard:allow-env-credential - Disposable fixture database only.
    assert.ok(databaseUrl?.startsWith("file:"));
    const databasePath = databaseUrl.slice("file:".length);
    const require = createRequire(corePackageJson);
    const sqliteEntry = require.resolve("better-sqlite3");
    const ownerSource = `
      const Database = require(process.argv[1]);
      const database = new Database(process.argv[2], { timeout: 1000 });
      let released = false;
      let lockedAtNanoseconds;
      const release = () => {
        if (released) return;
        released = true;
        try { database.exec("ROLLBACK"); } finally { database.close(); }
        const releasedAtNanoseconds = process.hrtime.bigint().toString();
        if (process.connected) {
          process.send({ type: "released", lockedAtNanoseconds, releasedAtNanoseconds },
            () => process.exit(0));
        } else process.exit(0);
      };
      database.exec("BEGIN IMMEDIATE");
      lockedAtNanoseconds = process.hrtime.bigint().toString();
      process.send({ type: "locked", lockedAtNanoseconds });
      setTimeout(release, 300);
      process.on("disconnect", release);
    `;
    const owner = spawn(process.execPath,
      ["--max-old-space-size=32", "-e", ownerSource, sqliteEntry, databasePath], {
        cwd: process.cwd(), env: process.env, windowsHide: true,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
    let stderr = "";
    owner.stderr.setEncoding("utf8");
    owner.stderr.on("data", chunk => { stderr = `${stderr}${chunk}`.slice(-2048); });
    let lockedAtNanoseconds = null;
    let releasedAtNanoseconds = null;
    const released = new Promise(resolve => {
      owner.on("message", message => {
        if (message?.type !== "released") return;
        releasedAtNanoseconds = message.releasedAtNanoseconds;
        resolve();
      });
    });
    const locked = new Promise((resolve, reject) => {
      const timer = Reflect.apply(originalSetTimeout, globalThis, [() => {
        reject(new Error(`bounded independent lock owner did not acquire ${id}`));
      }, 2_000]);
      owner.once("error", error => { Reflect.apply(originalClearTimeout, globalThis, [timer]); reject(error); });
      owner.once("exit", code => {
        if (code !== 0) {
          Reflect.apply(originalClearTimeout, globalThis, [timer]);
          reject(new Error(`independent lock owner exited ${code}: ${stderr}`));
        }
      });
      owner.on("message", message => {
        if (message?.type !== "locked") return;
        lockedAtNanoseconds = message.lockedAtNanoseconds;
        Reflect.apply(originalClearTimeout, globalThis, [timer]);
        resolve();
      });
    });
    const exited = new Promise((resolve, reject) => {
      owner.once("error", reject);
      owner.once("exit", (code, signal) => code === 0
        ? resolve() : reject(new Error(`independent lock owner exited ${code ?? signal}: ${stderr}`)));
    }).finally(() => fixtureWriteLocks.delete(owner));
    fixtureWriteLocks.set(owner, exited);
    try { await locked; }
    catch (error) { owner.kill(); await Promise.allSettled([exited]); throw error; }
    let open = true;
    return Object.freeze({ async release() {
      if (!open) return;
      open = false;
      await Promise.all([released, exited]);
    }, timeline(nativeInvoked, nativeSettled) {
      assert.match(lockedAtNanoseconds ?? "", /^\d+$/);
      assert.match(releasedAtNanoseconds ?? "", /^\d+$/);
      assert.match(nativeInvoked ?? "", /^\d+$/);
      assert.match(nativeSettled ?? "", /^\d+$/);
      const held = BigInt(releasedAtNanoseconds) - BigInt(lockedAtNanoseconds);
      assert.ok(held > 0n);
      return Object.freeze({ label: id, lockedAtNanoseconds, releasedAtNanoseconds,
        nativeInvokedAtNanoseconds: nativeInvoked,
        nativeSettledAtNanoseconds: nativeSettled,
        heldNanoseconds: held.toString() });
    } });
  }
  async function releaseFixtureWriteLocks() {
    const pending = [...fixtureWriteLocks.entries()];
    for (const [owner] of pending) {
      if (owner.connected) owner.send({ type: "release" });
    }
    return Promise.allSettled(pending.map(([owner, exited]) => {
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = Reflect.apply(originalSetTimeout, globalThis, [() => {
          owner.kill();
          reject(new Error("independent lock owner exceeded cleanup deadline"));
        }, 2_000]);
      });
      return Promise.race([exited, deadline])
        .finally(() => Reflect.apply(originalClearTimeout, globalThis, [timer]));
    }));
  }

  const witness = { schemaVersion: 2, caseNames: [...CASE_NAMES], tableNames: [...SNAPSHOT_TABLES],
    coreHashes: actualCoreHashes, schemaInitialization: null, lockTimelines: [],
    snapshots: {}, cases: [] };
  const remember = state => {
    const hash = canonicalDigest(state);
    witness.snapshots[hash] ??= state;
    return hash;
  };
  async function check(name, run) {
    assert.equal(name, CASE_NAMES[witness.cases.length]);
    await clearFixture();
    metrics = { adapterCreates: 0, adapterDetaches: 0, adapterStreams: 0,
      guards: 0, observers: 0, runners: 0, scopes: 0 };
    process.stdout.write(`START ${name}\n`);
    const before = remember(await snapshot());
    const observations = [];
    const observe = async (label, action, expectedNativeEffect, expectedMetrics, options = {}) => {
      if (options.drain !== false) await drainOwnedNative();
      const beforeState = await snapshot();
      const beforeMetrics = { ...metrics };
      const observationBefore = remember(beforeState);
      const result = await action();
      if (options.drain !== false) await drainOwnedNative();
      const afterState = await snapshot();
      assertNativeEffect(expectedNativeEffect, beforeState, afterState, label);
      assertExpectedMetrics(expectedMetrics, beforeMetrics, metrics, label);
      observations.push({ label, before: observationBefore, after: remember(afterState),
        result: canonicalValue(result), expectedNativeEffect: canonicalValue(expectedNativeEffect),
        expectedNativeMutation: canonicalValue(NATIVE_EFFECT_MUTATIONS.get(expectedNativeEffect) ?? null),
        expectedMetrics: canonicalValue(expectedMetrics),
        metricDelta: metricDeltaBetween(beforeMetrics, metrics),
        nativeDelta: deltaBetween(beforeState, afterState) });
      return result;
    };
    const resetScenario = async label => {
      await drainOwnedNative();
      const beforeState = await snapshot();
      const beforeMetrics = { ...metrics };
      await clearFixture();
      const afterState = await snapshot();
      observations.push({ label, before: remember(beforeState), after: remember(afterState),
        result: { code: "fixture-reset" }, expectedNativeEffect: "fixture-reset",
        expectedNativeMutation: null,
        expectedMetrics: NO_NATIVE_METRICS,
        metricDelta: metricDeltaBetween(beforeMetrics, metrics),
        nativeDelta: deltaBetween(beforeState, afterState) });
    };
    const capture = async label => {
      const state = await snapshot();
      observations.push({ label, before: remember(state), after: remember(state),
        result: { code: "fixture-checkpoint" }, expectedNativeEffect: "checkpoint",
        expectedNativeMutation: null,
        expectedMetrics: NO_NATIVE_METRICS,
        metricDelta: metricDeltaBetween(metrics, metrics), nativeDelta: deltaBetween(state, state) });
      return state;
    };
    let result;
    try {
      result = await run(observe, resetScenario, capture);
    } catch (error) {
      const partial = { name, before, after: null,
        result: { code: "incomplete", error: boundedError(error) },
        observations, metrics: { ...metrics }, captureErrors: [] };
      witness.cases.push(partial);
      try {
        const failureLine = `RUNTIME_START_CASE_FAILURE ${canonicalJson({ name, error: boundedError(error) })}`;
        assert.ok(Buffer.byteLength(failureLine, "utf8") <= 2048);
        process.stdout.write(`${failureLine}\n`);
      } catch (captureError) {
        partial.captureErrors.push({ step: "failure-line", ...boundedError(captureError) });
      }
      try { await drainOwnedNative(); }
      catch (captureError) { partial.captureErrors.push({ step: "drain", ...boundedError(captureError) }); }
      try { partial.after = remember(await snapshot()); }
      catch (captureError) { partial.captureErrors.push({ step: "snapshot", ...boundedError(captureError) }); }
      partial.metrics = { ...metrics };
      throw error;
    }
    await drainOwnedNative();
    assert.equal(pendingCallbacks.size, 0);
    assert.equal(unclaimedCallbackOutcomes.size, 0);
    witness.cases.push({ name, before, after: remember(await snapshot()),
      result: canonicalValue(result), observations, metrics: { ...metrics } });
    process.stdout.write(`PASS ${name}\n`);
  }

  let globalsRestored = false;
  try {
    await withMigrationRuntime(async () => {
      await migrateRegistry();
      assert.equal(await nativeGetThread("synthetic-missing"), null);
      await ensureAgentHarnessSessionTables();
      await ensureRunTables();
    });
    const initializedTables = {};
    for (const name of SNAPSHOT_TABLES) {
      const info = await getDbExec().execute({ sql: `PRAGMA table_info(${name})`, args: [] });
      const count = await getDbExec().execute({ sql: `SELECT COUNT(*) AS count FROM ${name}`, args: [] });
      initializedTables[name] = { columns: info.rows.map(row => String(row.name)).sort(),
        rowCount: Number(count.rows[0]?.count ?? 0) };
    }
    witness.schemaInitialization = { privateSeam:
      "@agent-native/core/dist/agent/run-store.js#ensureRunTables", tables: initializedTables };
    assert.ok(Object.values(initializedTables).every(table => table.rowCount === 0));

    await check(CASE_NAMES[0], async (observe, resetScenario, capture) => {
      const unavailable = createProjectRuntimeStartService();
      const lookup = startLookup("missing-operation", "missing-preparation");
      assert.deepEqual(await unavailable.start(lookup, context), { code: "unavailable" });
      assert.deepEqual(await unavailable.resolveReference(lookup, context, identity()),
        { code: "unavailable" });
      const prepared = await createPrepared("strict");
      assert.throws(() => startComposition("real-profile-unproved", prepared, {
        descriptor: profileConfiguration({ kind: "real-native-adapter" }),
      }), /one exact synthetic profile/);
      const composition = startComposition("strict", prepared, {
        startAuthority: { roles: ["planner"], startAuthorityRevision: 17 },
      });
      const invalid = [{ ...prepared.lookup, extra: true },
        { ...prepared.lookup, preparationId: "bad\ud800" },
        { ...prepared.lookup, expectedBindingRevision: 0 },
        { ...prepared.lookup, expectedPolicyRevision: Number.NaN }];
      for (const item of invalid) assert.deepEqual(await composition.service.start(item, context),
        { code: "invalid-input" });
      assert.deepEqual(await observe("separate grant denies prepared role",
        () => composition.service.start(prepared.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS), { code: "denied" });
      assert.equal(metrics.runners, 0);
      assert.deepEqual(await composition.service.resolveReference(prepared.lookup, context,
        { ...identity(), extra: true }), { code: "invalid-input" });
      return { invalidLookups: invalid.length, separateStartGrant: true, runners: metrics.runners };
    });

    await check(CASE_NAMES[1], async (observe, resetScenario, capture) => {
      const prepared = await createPrepared("receiving");
      let retained;
      const result = await observe("exact callback sees only the frozen prepared lease", () =>
        prepared.service.withPreparedForStart(prepared.lookup, context, async lease => {
          assert.deepEqual(Object.keys(lease), ["prepared", "revalidate", "assertLive"]);
          assert.equal(Object.isFrozen(lease), true);
          assert.equal(Object.isFrozen(lease.prepared), true);
          assert.equal(Object.isFrozen(lease.prepared.identity), true);
          retained = lease;
          assert.deepEqual(await lease.revalidate(), lease.prepared);
          lease.assertLive();
          return { code: "consumed-exact" };
        }), NO_NATIVE_EFFECT, NO_NATIVE_METRICS);
      assert.deepEqual(result, { code: "consumed-exact" });
      assert.throws(() => retained.assertLive());
      await assert.rejects(retained.revalidate());
      for (const [forged, code] of [[{ preparationId: "forged-preparation" }, "stale-claim"],
        [{ preparationOperationId: "forged-operation" }, "recovery-required"],
        [{ scopeKey: "forged-scope" }, "stale-claim"]]) {
        assert.deepEqual(await prepared.service.withPreparedForStart(
          { ...prepared.lookup, ...forged }, context, () => ({ code: "escaped" })), { code });
      }
      await resetScenario("before finish-token contention");
      let receiving = false;
      let factCalls = 0;
      const routed = await createPrepared("routing-switch", { factsEffect: async () => {
        if (!receiving) return identity();
        factCalls += 1;
        return factCalls === 1 ? identity({ actorId: "routing-actor-a" }) : identity();
      } });
      receiving = true;
      const switched = await observe("routing identity A cannot consume prepared identity B", () =>
        routed.service.withPreparedForStart(routed.lookup, context, () => ({ code: "escaped" })),
      NO_NATIVE_EFFECT, NO_NATIVE_METRICS);
      assert.deepEqual(switched, { code: "stale-claim" });
      assert.equal(factCalls, 3);
      return { retainedClosed: true, exactPrepared: true, routingSwitchRefused: true };
    });

    await check(CASE_NAMES[2], async (observe, resetScenario, capture) => {
      const prepared = await createPrepared("positive");
      const composition = startComposition("positive", prepared);
      const first = await observe("actual public runner persists one deterministic Native turn",
        () => composition.service.start(prepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS);
      assert.equal(first.code, "started");
      assert.equal(first.preparationId, prepared.preparationId);
      assert.equal(first.replayed, false);
      assert.equal(first.evidenceKind, "synthetic-native-start");
      assert.deepEqual(Object.keys(first.reference), ["schemaVersion", "referenceRevision",
        "bindingIdentityDigest", "nativeThreadId", "nativeSessionId", "nativeRunId", "harnessName"]);
      assert.equal(first.reference.bindingIdentityDigest, bindingDigest(identity()));
      assert.equal(metrics.runners, 1);
      const { row, record } = await startRecord(prepared.preparationId);
      assert.equal(record.phase, "reference-verified");
      assert.equal(record.settlement.evidenceKind, "synthetic-native-start");
      assert.equal(row.creation_namespace_key, null);
      assert.equal(row.creation_child_key, null);
      assert.equal(row.creation_phase, null);
      const replay = await observe("verified replay repeats fresh authority and evidence",
        () => composition.service.start(prepared.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS);
      assert.deepEqual(replay, { ...first, replayed: true });
      const resolved = await observe("exact identity resolver returns the bare 04b reference",
        () => composition.service.resolveReference(prepared.lookup, context, identity()),
      NO_NATIVE_EFFECT, NO_NATIVE_METRICS);
      assert.deepEqual(resolved, first.reference);
      await getDb().insert(tables.projects).values({ projectId: identity().projectId,
        schemaVersion: 1, displayName: "Runtime start fixture" });
      await getDb().insert(tables.bindings).values({ bindingId: identity().bindingId,
        projectId: identity().projectId, collectionId: identity().collectionId,
        actorId: identity().actorId, deviceId: identity().deviceId, rootId: identity().rootId,
        locationRef: identity().locationRef, bindingRevision: identity().bindingRevision,
        policyRevision: identity().policyRevision, vcsKind: "none" });
      await getDb().insert(tables.revisions).values({ scopeKey: "runtime-start-registry-revision",
        collectionId: identity().collectionId, deviceId: identity().deviceId, revision: 1 });
      const activity = createProjectRuntimeActivity({
        readScope: async () => structuredClone(currentScope),
        provider: { inspect: async locationRef => ({ code: "available", locationRef,
          rootId: identity().rootId, contentRevision: identity().contentRevision }) },
        runtime: { harnessName: identity().harnessName, runtimeVersion: identity().runtimeVersion,
          executionLocation: identity().executionLocation,
          configurationRevision: identity().runtimeConfigurationRevision,
          authorityContract: identity().authorityContract,
          resolveReference: expected => composition.service.resolveReference(
            prepared.lookup, context, expected),
          verifyFixtureBudget: async () => ({ eventCount: 16, encodedBytes: 4096 }) },
      });
      const activityResult = await observe("existing 04b reader consumes the bound reference",
        () => activity.run({ projectId: identity().projectId, scopeKey: BASE_SCOPE_KEY,
          expectedBindingRevision: String(identity().bindingRevision),
          expectedPolicyRevision: String(identity().policyRevision) }, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS);
      assert.equal(activityResult.code, "activity");
      assert.equal(activityResult.nativeRunId, first.reference.nativeRunId);
      assert.ok(JSON.stringify(activityResult.items).includes("synthetic output positive"));
      assert.equal(metrics.runners, 1);
      return { first, replay, resolved, activityCode: activityResult.code,
        runnerCalls: metrics.runners };
    });

    await check(CASE_NAMES[3], async (observe, resetScenario, capture) => {
      const prepared = await createPrepared("concurrent");
      const hold = deferred();
      let releaseCreate;
      const baseAdapter = syntheticAdapter("concurrent");
      const adapter = Object.freeze({ ...baseAdapter,
        async createSession(options) {
          releaseCreate = true;
          await trackPending(hold.promise);
          return baseAdapter.createSession(options);
        } });
      const composition = startComposition("concurrent", prepared, { adapter });
      const contention = await observe("active matching start cannot steal the prepared operation",
        async () => {
          const firstPromise = composition.service.start(prepared.lookup, context);
          while (!releaseCreate) await new Promise(resolve => setImmediate(resolve));
          await waitForCount("SELECT COUNT(*) AS count FROM agent_runs WHERE id = ?",
            [composition.ids.id("native-run")], 1, "the held run row");
          await waitForCount("SELECT COUNT(*) AS count FROM agent_run_events WHERE run_id = ?",
            [composition.ids.id("native-run")], 1, "the held starting event");
          await capture("while matching start holds the operation token");
          const second = await composition.service.start({ ...prepared.lookup }, context);
          assert.deepEqual(second, { code: "recovery-required" });
          hold.resolve();
          const first = await firstPromise;
          assert.equal(first.code, "started");
          return { first, second };
        }, ONE_SUCCESSFUL_NATIVE_START, ONE_SUCCESSFUL_NATIVE_METRICS);
      const { first, second } = contention;
      const changedLookup = { ...prepared.lookup, projectId: "other-project" };
      assert.ok(["stale-claim", "recovery-required"].includes(
        (await composition.service.start(changedLookup, context)).code));
      const changedProfile = startComposition("profile-change", prepared,
        { descriptor: profileConfiguration({ fixtureRevision: "fixture-v2" }) });
      assert.deepEqual(await observe("changed deterministic profile conflicts with the winner",
        () => changedProfile.service.start(prepared.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS),
      { code: "operation-conflict" });
      await resetScenario("before finish-token contention");
      const finishPrepared = await createPrepared("finish-held");
      const finishHold = deferred();
      let settlementEntered = false;
      const finishComposition = startComposition("finish-held", finishPrepared, {
        receiptPort: base => startPortProxy(base, {
          verifySettlement: async (...args) => {
            const settled = await base.verifySettlement(...args);
            settlementEntered = true;
            await trackPending(finishHold.promise);
            return settled;
          },
        }),
      });
      const finishOutcome = await observe("operation token remains held through verified finish",
        async () => {
          const finishing = finishComposition.service.start(finishPrepared.lookup, context);
          while (!settlementEntered) await new Promise(resolve => setImmediate(resolve));
          await capture("while verified finish holds the operation token");
          const finishContention = await finishComposition.service.start(
            { ...finishPrepared.lookup }, context);
          assert.deepEqual(finishContention, { code: "recovery-required" });
          finishHold.resolve();
          const finished = await finishing;
          assert.equal(finished.code, "started");
          return { finished, finishContention };
        }, ONE_SUCCESSFUL_NATIVE_START, ONE_SUCCESSFUL_NATIVE_METRICS);
      const finishContention = finishOutcome.finishContention;
      assert.equal(metrics.runners, 2);
      return { matchingContention: second.code, first: first.code,
        changedProfile: "operation-conflict", finishContention: finishContention.code };
    });

    await check(CASE_NAMES[4], async (observe, resetScenario, capture) => {
      const corruptions = [
        ["receipt-key", row => { row.receipt_key = `runtime-start:v1:${"0".repeat(64)}`; }],
        ["row-digest", row => { row.request_digest = "0".repeat(64); }],
        ["creation-column", row => { row.creation_phase = "starting"; }],
        ["invalid-json", null, () => "{"],
        ["phase-fields", null, record => { record.phase = "reserved"; }],
        ["allocation", null, record => { record.nativeRunId = "substituted-run"; }],
        ["preparation-link", null, record => { record.preparationAttemptId = "substituted-attempt"; }],
        ["identity", null, record => { record.identity.rootId = "substituted-root"; }],
        ["configuration", null, record => { record.adapterConfiguration.fixtureRevision = "other"; }],
        ["settlement", null, record => { record.settlement.nativeEvidenceDigest = "0".repeat(64); }],
      ];
      const results = [];
      for (const [name, mutateRow, mutateRecord] of corruptions) {
        await resetScenario(`before receipt corruption ${name}`);
        const prepared = await createPrepared(`corrupt_${name.replaceAll("-", "_")}`);
        const composition = startComposition(`corrupt_${name.replaceAll("-", "_")}`, prepared);
        const started = await observe(`establish verified receipt before ${name} corruption`,
          () => composition.service.start(prepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
          ONE_SUCCESSFUL_NATIVE_METRICS);
        assert.equal(started.code, "started");
        await replaceStart(prepared.preparationId, mutateRow, mutateRecord);
        const result = await observe(name,
          () => composition.service.resolveReference(prepared.lookup, context, identity()),
        NO_NATIVE_EFFECT, NO_NATIVE_METRICS);
        assert.deepEqual(result, { code: "recovery-required" });
        results.push(name);
      }
      const nativeCorruptions = [
        ["native-event-content", "agent_run_events", "event_data",
          JSON.stringify({ type: "text", text: "valid but incorrect synthetic output" }),
          reference => ({ run_id: reference.nativeRunId, seq: 1 }), async reference => {
          await getDbExec().execute({ sql: `UPDATE agent_run_events SET event_data = ?
            WHERE run_id = ? AND seq = 1`, args: [JSON.stringify({ type: "text",
            text: "valid but incorrect synthetic output" }), reference.nativeRunId] });
        }],
        ["native-terminal-reason", "agent_runs", "terminal_reason", "valid-but-incorrect",
          reference => ({ id: reference.nativeRunId }), async reference => {
          await getDbExec().execute({ sql: `UPDATE agent_runs SET terminal_reason = ?
            WHERE id = ?`, args: ["valid-but-incorrect", reference.nativeRunId] });
        }],
      ];
      for (const [name, table, field, value, target, mutate] of nativeCorruptions) {
        await resetScenario(`before ${name}`);
        const prepared = await createPrepared(`corrupt_${name.replaceAll("-", "_")}`);
        const composition = startComposition(`corrupt_${name.replaceAll("-", "_")}`, prepared);
        const started = await observe(`establish verified Native evidence before ${name}`,
          () => composition.service.start(prepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
          ONE_SUCCESSFUL_NATIVE_METRICS);
        assert.equal(started.code, "started");
        const result = await observe(name, async () => {
          await mutate(started.reference);
          return composition.service.resolveReference(prepared.lookup, context, identity());
        }, expectedNativeMutation(table, target(started.reference), field, value),
        NO_NATIVE_METRICS);
        assert.deepEqual(result, { code: "recovery-required" });
        const corruptedRecord = (await startRecord(prepared.preparationId)).record;
        assert.equal(corruptedRecord.phase, "quarantined");
        assert.equal(corruptedRecord.quarantineReason, "effect-uncertain");
        results.push(name);
      }
      return { corruptions: results };
    });

    await check(CASE_NAMES[5], async (observe, resetScenario, capture) => {
      const prepared = await createPrepared("authority-before");
      const denied = startComposition("authority-before", prepared, {
        resolveAuthorityEffect: async call => call >= 2
          ? { roles: ["planner"], startAuthorityRevision: 17 }
          : { roles: ["developer"], startAuthorityRevision: 17 },
      });
      assert.deepEqual(await observe("role revoked before reservation",
        () => denied.service.start(prepared.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS), { code: "denied" });
      assert.equal(metrics.runners, 0);
      const stalePrepared = await createPrepared("authority-revision");
      const changed = startComposition("authority-revision", stalePrepared, {
        resolveAuthorityEffect: async call => ({ roles: ["developer"],
          startAuthorityRevision: call >= 3 ? 18 : 17 }),
      });
      const result = await observe("authority revision changes immediately before Native invocation",
        () => changed.service.start(stalePrepared.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS);
      assert.deepEqual(result, { code: "stale-claim" });
      assert.equal(metrics.runners, 0);
      const wrongIdentity = await createPrepared("identity-change");
      assert.deepEqual(await wrongIdentity.service.withPreparedForStart(
        { ...wrongIdentity.lookup, expectedBindingRevision: 5 }, context, () => ({ code: "escaped" })),
      { code: "stale-claim" });
      return { roleRevoked: true, revisionChanged: true, runners: metrics.runners };
    });

    await check(CASE_NAMES[6], async (observe, resetScenario, capture) => {
      const outcomes = [];
      for (const kind of ["session", "run"]) {
        await resetScenario(`before ${kind} collision`);
        const prepared = await createPrepared(`collision_${kind}`);
        const composition = startComposition(`collision_${kind}`, prepared);
        const sessionId = composition.ids.id("native-session");
        const runId = composition.ids.id("native-run");
        if (kind === "session") await seedSessionCollision(sessionId,
          prepared.ids.id("native-thread"), "other-run");
        else await seedSessionCollision("existing-session-for-colliding-run",
          prepared.ids.id("native-thread"), runId);
        const result = await observe(`${kind} id collision`,
          () => composition.service.start(prepared.lookup, context), NO_NATIVE_EFFECT,
          NO_NATIVE_METRICS);
        assert.deepEqual(result, { code: "recovery-required" });
        outcomes.push(kind);
      }
      await resetScenario("before same-thread run collision");
      const prepared = await createPrepared("collision-thread-run");
      await seedRunCollision("competing-thread-run", prepared.ids.id("native-thread"));
      const before = await getDbExec().execute({
        sql: "SELECT COUNT(*) AS count FROM agent_runs WHERE thread_id = ?",
        args: [prepared.ids.id("native-thread")] });
      assert.equal(Number(before.rows[0].count), 1,
        "fixture proves the competing same-thread run exists before invocation");
      const composition = startComposition("collision-thread-run", prepared, {
        getRunEffect: async (runId, scope) => {
          const rows = await getDbExec().execute({
            sql: "SELECT id FROM agent_runs WHERE thread_id = ? LIMIT 2",
            args: [prepared.ids.id("native-thread")] });
          if (rows.rows.length > 0) return { collision: true };
          return getAgentHarnessBackgroundRun(runId, scope);
        },
      });
      assert.deepEqual(await observe("existing same-thread run blocks the fixture start",
        () => composition.service.start(prepared.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS),
      { code: "recovery-required" });
      assert.equal(metrics.runners, 0);
      return { collisionKinds: [...outcomes, "same-thread"], runners: metrics.runners };
    });

    await check(CASE_NAMES[7], async (observe, resetScenario, capture) => {
      const outcomes = [];
      for (const mode of ["reject-before", "reject-after", "missing-reply", "wrong-provider-id"]) {
        await resetScenario(`before adapter mode ${mode}`);
        const prepared = await createPrepared(`adapter_${mode.replaceAll("-", "_")}`);
        const composition = startComposition(`adapter_${mode.replaceAll("-", "_")}`,
          prepared, { adapterMode: mode });
        const result = await observe(mode, () => composition.service.start(prepared.lookup, context),
          ONE_FAILED_NATIVE_START_BEFORE_SESSION, ONE_CREATE_ONLY_NATIVE_METRICS);
        assert.deepEqual(result, { code: "recovery-required" });
        const { record } = await startRecord(prepared.preparationId);
        assert.equal(record.phase, "quarantined");
        assert.equal(record.quarantineReason, "effect-uncertain");
        outcomes.push(mode);
      }
      await resetScenario("before missing waitUntil capture");
      const prepared = await createPrepared("missing-wait-until");
      let fixtureCompletion = null;
      const composition = startComposition("missing-wait-until", prepared, {
        runnerEffect: (options, ownCompletion) => {
          const active = startAgentHarnessRun({ ...options,
            runOptions: { ...options.runOptions, waitUntil: promise => {
              fixtureCompletion = promise;
              ownCompletion(promise);
            } } });
          return active;
        },
      });
      const beforeMissing = await capture("before missing captured completion promise");
      const beforeMissingMetrics = { ...metrics };
      const missing = await composition.service.start(prepared.lookup, context);
      assert.deepEqual(missing, { code: "recovery-required" });
      assert.ok(fixtureCompletion instanceof Promise);
      await capture("missing captured completion promise returned while Native remained in flight");
      const quarantinedBeforeCompletion = (await startRecord(prepared.preparationId)).record;
      assert.equal(quarantinedBeforeCompletion.phase, "quarantined");
      assert.equal(quarantinedBeforeCompletion.quarantineReason, "effect-uncertain");
      assert.equal(quarantinedBeforeCompletion.nativeEvidenceDigest, null);
      assert.equal(quarantinedBeforeCompletion.settlement, null);
      await Promise.allSettled([fixtureCompletion]);
      await drainOwnedNative();
      const afterMissing = await capture("after fixture-owned missing completion settles");
      assertNativeEffect(ONE_FAILED_NATIVE_START_BEFORE_SESSION, beforeMissing, afterMissing,
        "late fixture completion after missing service capture");
      assertExpectedMetrics(ONE_CREATE_ONLY_NATIVE_METRICS, beforeMissingMetrics, metrics,
        "late fixture completion after missing service capture");
      assert.deepEqual(nativeCompletionOutcomes.get(quarantinedBeforeCompletion.nativeRunId),
        { status: "fulfilled" });
      const quarantinedAfterCompletion = (await startRecord(prepared.preparationId)).record;
      assert.deepEqual(quarantinedAfterCompletion, quarantinedBeforeCompletion);
      outcomes.push("missing-wait-until");

      const sqlFaults = [
        { name: "session-save", definition: `BEFORE INSERT ON agent_harness_sessions
          BEGIN SELECT RAISE(FAIL, 'fixture session save failure'); END`,
        expected: ONE_FAILED_NATIVE_START_BEFORE_SESSION,
        expectedMetrics: ONE_CREATE_ONLY_NATIVE_METRICS, sessionRows: 0, runRows: 1,
        eventRows: 2, runStatus: "errored" },
        { name: "run-insert", definition: `BEFORE INSERT ON agent_runs
          BEGIN SELECT RAISE(FAIL, 'fixture run insert failure'); END`,
        expected: ONE_NATIVE_START_WITHOUT_RUN_ROW,
        expectedMetrics: ONE_SUCCESSFUL_NATIVE_METRICS, sessionRows: 1, runRows: 0,
        eventRows: 4, runStatus: null },
        { name: "final-status", definition: `BEFORE UPDATE OF status ON agent_runs
          WHEN OLD.status = 'running' AND NEW.status != 'running'
          BEGIN SELECT RAISE(FAIL, 'fixture final status failure'); END`,
        expected: ONE_SUCCESSFUL_NATIVE_START,
        expectedMetrics: ONE_SUCCESSFUL_NATIVE_METRICS, sessionRows: 1, runRows: 1,
        eventRows: 4, runStatus: "running" },
      ];
      for (const fault of sqlFaults) {
        await resetScenario(`before Native ${fault.name} SQL fault`);
        const faultPrepared = await createPrepared(`native_${fault.name.replaceAll("-", "_")}`);
        const faultComposition = startComposition(`native_${fault.name.replaceAll("-", "_")}`,
          faultPrepared);
        const faultResult = await observe(`actual Native ${fault.name} SQL fault`, async () => {
          const drop = await installFixtureTrigger(`fixture_${fault.name.replaceAll("-", "_")}`,
            fault.definition);
          try { return await faultComposition.service.start(faultPrepared.lookup, context); }
          finally { await drop(); }
        }, fault.expected, fault.expectedMetrics);
        assert.deepEqual(faultResult, { code: "recovery-required" });
        const sessionCount = await getDbExec().execute({
          sql: "SELECT COUNT(*) AS count FROM agent_harness_sessions", args: [] });
        const runRows = await getDbExec().execute({
          sql: "SELECT status FROM agent_runs WHERE id = ?",
          args: [faultComposition.ids.id("native-run")] });
        const eventCount = await getDbExec().execute({
          sql: "SELECT COUNT(*) AS count FROM agent_run_events WHERE run_id = ?",
          args: [faultComposition.ids.id("native-run")] });
        assert.equal(Number(sessionCount.rows[0].count), fault.sessionRows);
        assert.equal(runRows.rows.length, fault.runRows);
        assert.equal(runRows.rows[0]?.status ?? null, fault.runStatus);
        assert.equal(Number(eventCount.rows[0].count), fault.eventRows);
        assert.equal((await startRecord(faultPrepared.preparationId)).record.phase, "quarantined");
        outcomes.push(`native-${fault.name}-fault`);
      }

      await resetScenario("before delayed Native SQL writes");
      const delayedWritePrepared = await createPrepared("native-write-delay");
      let writeLock = null;
      const delayedWrite = startComposition("native-write-delay", delayedWritePrepared, {
        resolveAuthorityEffect: async (call, _claim, authority) => {
          if (call === 3) writeLock = await acquireFixtureWriteLock("native-write-delay-lock");
          return authority;
        },
      });
      let delayedWriteResult;
      try {
        delayedWriteResult = await observe("actual Native run and session writes wait on DB lock",
          async () => {
            const pending = delayedWrite.service.start(delayedWritePrepared.lookup, context);
            const result = await pending;
            const nativeSettled = process.hrtime.bigint().toString();
            assert.ok(writeLock);
            await writeLock.release();
            const nativeRunId = delayedWrite.ids.id("native-run");
            const timeline = writeLock.timeline(
              nativeInvokedAtNanoseconds.get(nativeRunId), nativeSettled);
            assert.ok(BigInt(timeline.lockedAtNanoseconds)
              <= BigInt(timeline.nativeInvokedAtNanoseconds));
            assert.ok(BigInt(timeline.nativeInvokedAtNanoseconds)
              < BigInt(timeline.releasedAtNanoseconds));
            assert.ok(BigInt(timeline.releasedAtNanoseconds)
              <= BigInt(timeline.nativeSettledAtNanoseconds));
            assert.ok(BigInt(timeline.heldNanoseconds) >= 200_000_000n,
              "independent owner kept the bounded SQLite lock for its reviewed duration");
            witness.lockTimelines.push(timeline);
            return result;
          }, ONE_SUCCESSFUL_NATIVE_START, ONE_SUCCESSFUL_NATIVE_METRICS);
      } finally {
        await writeLock?.release();
      }
      assert.equal(delayedWriteResult.code, "started");
      outcomes.push("native-write-delay");

      for (const delayKind of ["create", "stream", "detach", "observer"]) {
        await resetScenario(`before delayed ${delayKind}`);
        const delayedPrepared = await createPrepared(`delay_${delayKind}`);
        const entered = deferred();
        const hold = deferred();
        const hooks = delayKind === "create" ? { createEntered: entered, createHold: hold }
          : delayKind === "stream" ? { streamEntered: entered, streamHold: hold }
            : delayKind === "detach" ? { detachEntered: entered, detachHold: hold } : {};
        const delayed = startComposition(`delay_${delayKind}`, delayedPrepared, {
          adapter: syntheticAdapter(`delay_${delayKind}`, "normal", hooks),
          observerEffect: delayKind === "observer" ? async input => {
            entered.resolve();
            await hold.promise;
            return settlementObserver(input);
          } : null,
        });
        const delayedResult = await observe(`delayed ${delayKind} remains owned`, async () => {
          const pending = delayed.service.start(delayedPrepared.lookup, context);
          await entered.promise;
          if (delayKind === "create") {
            await waitForCount("SELECT COUNT(*) AS count FROM agent_run_events WHERE run_id = ?",
              [delayed.ids.id("native-run")], 1, "delayed create starting event");
          }
          if (delayKind === "stream") {
            await waitForCount("SELECT COUNT(*) AS count FROM agent_harness_sessions WHERE id = ?",
              [delayed.ids.id("native-session")], 1, "delayed stream session");
          }
          if (delayKind === "detach") {
            await waitForCount("SELECT COUNT(*) AS count FROM agent_run_events WHERE run_id = ?",
              [delayed.ids.id("native-run")], 3, "delayed detach event prefix");
          }
          await capture(`while delayed ${delayKind} is pending`);
          hold.resolve();
          return pending;
        }, ONE_SUCCESSFUL_NATIVE_START, ONE_SUCCESSFUL_NATIVE_METRICS);
        assert.equal(delayedResult.code, "started");
        outcomes.push(`delayed-${delayKind}`);
      }

      const wrongAssociations = ["returned-run", "returned-thread", "thread-read",
        "session-read", "run-read"];
      for (const wrong of wrongAssociations) {
        await resetScenario(`before valid wrong ${wrong}`);
        const wrongPrepared = await createPrepared(`wrong_${wrong.replaceAll("-", "_")}`);
        const options = {};
        if (wrong === "returned-run" || wrong === "returned-thread") {
          options.runnerEffect = runnerOptions => {
            const active = startAgentHarnessRun(runnerOptions);
            return { ...active, [wrong === "returned-run" ? "runId" : "threadId"]:
              `valid_wrong_${wrong.replaceAll("-", "_")}` };
          };
        }
        if (wrong === "session-read") options.getSessionEffect = async id => {
          const value = await getAgentHarnessSession(id);
          return value ? { ...value, id: "valid_wrong_session" } : null;
        };
        if (wrong === "thread-read") {
          let threadReads = 0;
          options.getThreadEffect = async id => {
            threadReads += 1;
            const value = await nativeGetThread(id);
            return threadReads > 1 && value ? { ...value, id: "valid_wrong_thread" } : value;
          };
        }
        if (wrong === "run-read") options.getRunEffect = async (runId, scope) => {
          const value = await getAgentHarnessBackgroundRun(runId, scope);
          return value ? { ...value, id: "valid_wrong_run" } : null;
        };
        const wrongComposition = startComposition(`wrong_${wrong.replaceAll("-", "_")}`,
          wrongPrepared, options);
        const returnedIdentityMismatch = wrong === "returned-run" || wrong === "returned-thread";
        const wrongResult = await observe(`valid wrong ${wrong} identity refuses`,
          async () => {
            const result = await wrongComposition.service.start(wrongPrepared.lookup, context);
            const quarantined = (await startRecord(wrongPrepared.preparationId)).record;
            await drainOwnedNative();
            assert.deepEqual((await startRecord(wrongPrepared.preparationId)).record, quarantined);
            return result;
          }, returnedIdentityMismatch ? ONE_FAILED_NATIVE_START_BEFORE_SESSION : ONE_SUCCESSFUL_NATIVE_START,
          returnedIdentityMismatch ? ONE_CREATE_ONLY_NATIVE_METRICS : ONE_SUCCESSFUL_NATIVE_METRICS);
        assert.deepEqual(wrongResult, { code: "recovery-required" });
        assert.equal((await startRecord(wrongPrepared.preparationId)).record.phase, "quarantined");
        outcomes.push(`valid-wrong-${wrong}`);
      }
      return { uncertaintyModes: outcomes };
    });

    await check(CASE_NAMES[8], async (observe, resetScenario, capture) => {
      const candidatePrepared = await createPrepared("candidate-loss");
      const candidate = startComposition("candidate-loss", candidatePrepared, {
        receiptPort: base => startPortProxy(base, {
          recordReferenceCandidate: async (...args) => {
            await base.recordReferenceCandidate(...args);
            return { code: "unavailable" };
          },
        }),
      });
      assert.deepEqual(await observe("lost candidate reply after durable candidate",
        () => candidate.service.start(candidatePrepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS),
      { code: "recovery-required" });
      assert.equal((await startRecord(candidatePrepared.preparationId)).record.phase, "quarantined");
      assert.deepEqual(await candidate.service.resolveReference(candidatePrepared.lookup,
        context, identity()), { code: "recovery-required" });

      await resetScenario("before lost settlement reply");
      const settlementPrepared = await createPrepared("settlement-loss");
      const settlement = startComposition("settlement-loss", settlementPrepared, {
        receiptPort: base => startPortProxy(base, {
          verifySettlement: async (...args) => {
            await base.verifySettlement(...args);
            return { code: "unavailable" };
          },
        }),
      });
      assert.deepEqual(await observe("lost settlement reply quarantines the exact winner",
        () => settlement.service.start(settlementPrepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS),
      { code: "recovery-required" });
      const settledRecord = (await startRecord(settlementPrepared.preparationId)).record;
      assert.equal(settledRecord.phase, "quarantined");
      assert.equal(settledRecord.settlement, null);
      assert.deepEqual(await settlement.service.resolveReference(settlementPrepared.lookup,
        context, identity()), { code: "recovery-required" });

      await resetScenario("before unreadable settled winner");
      const readLossPrepared = await createPrepared("post-settlement-read-loss");
      let settlementCommitted = false;
      const readLoss = startComposition("post-settlement-read-loss", readLossPrepared, {
        receiptPort: base => startPortProxy(base, {
          read: (...args) => settlementCommitted ? { code: "unavailable" } : base.read(...args),
          verifySettlement: async (...args) => {
            const settled = await base.verifySettlement(...args);
            settlementCommitted = true;
            return settled;
          },
        }),
      });
      assert.deepEqual(await observe("successful settlement with unreadable winner quarantines and blocks",
        () => readLoss.service.start(readLossPrepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS),
      { code: "recovery-required" });
      const readLossRecord = (await startRecord(readLossPrepared.preparationId)).record;
      assert.equal(readLossRecord.phase, "quarantined");
      assert.equal(readLossRecord.quarantineReason, "settlement-uncertain");
      settlementCommitted = false;
      assert.deepEqual(await readLoss.service.start(readLossPrepared.lookup, context),
        { code: "recovery-required" });

      await resetScenario("before final receiving revalidation rejection");
      let rejectFinalReceivingValidation = false;
      const receivingPreparationPortTrace = [];
      const receivingPrepared = await createPrepared("receiving-final-reject", {
        factsEffect: async () => rejectFinalReceivingValidation
          ? identity({ rootId: "changed-after-start" }) : identity(),
        receiptPort: base => preparationPortProxy(base, {
          read: async (...args) => {
            const value = await base.read(...args);
            if (rejectFinalReceivingValidation) {
              receivingPreparationPortTrace.push({ operation: "read",
                result: canonicalValue(value) });
            }
            return value;
          },
        }),
      });
      const receivingTrace = [];
      const receivingPreparation = Object.freeze({
        ...receivingPrepared.service,
        async withPreparedForStart(lookup, suppliedContext, consume) {
          const wrappedConsume = async lease => {
            try {
              const value = await consume(lease);
              receivingTrace.push({ boundary: "consume", status: "returned",
                value: canonicalValue(value) });
              return value;
            } catch (error) {
              receivingTrace.push({ boundary: "consume", status: "threw",
                error: boundedError(error) });
              throw error;
            }
          };
          try {
            const value = await receivingPrepared.service.withPreparedForStart(
              lookup, suppliedContext, wrappedConsume);
            receivingTrace.push({ boundary: "receiving", status: "returned",
              value: canonicalValue(value) });
            return value;
          } catch (error) {
            receivingTrace.push({ boundary: "receiving", status: "threw",
              error: boundedError(error) });
            throw error;
          }
        },
      });
      const receivingReject = startComposition("receiving-final-reject", receivingPrepared, {
        preparationService: receivingPreparation,
        receiptPort: base => startPortProxy(base, {
          verifySettlement: async (...args) => {
            const settled = await base.verifySettlement(...args);
            rejectFinalReceivingValidation = true;
            return settled;
          },
        }),
      });
      const receivingResult = await observe("final receiving revalidation rejection quarantines the winner",
        () => receivingReject.service.start(receivingPrepared.lookup, context),
      ONE_SUCCESSFUL_NATIVE_START, ONE_SUCCESSFUL_NATIVE_METRICS);
      const receivingRejectedRecord = (await startRecord(receivingPrepared.preparationId)).record;
      const receivingDiagnostic = { trace: receivingTrace,
        preparationReceiptPort: receivingPreparationPortTrace,
        result: canonicalValue(receivingResult),
        receipt: canonicalValue(receivingRejectedRecord) };
      const receivingDiagnosticLine = `RUNTIME_START_RECEIVING_DIAGNOSTIC ${canonicalJson(receivingDiagnostic)}`;
      assert.ok(Buffer.byteLength(receivingDiagnosticLine, "utf8") <= 16 * 1024);
      process.stdout.write(`${receivingDiagnosticLine}\n`);
      assert.deepEqual(receivingResult, { code: "recovery-required" });
      assert.deepEqual(receivingTrace.map(item => ({ boundary: item.boundary,
        status: item.status, code: item.value?.code })), [
        { boundary: "consume", status: "returned", code: "started" },
        { boundary: "receiving", status: "returned", code: "recovery-required" },
      ]);
      assert.deepEqual(receivingPreparationPortTrace.map(item => item.result.code), ["conflict"]);
      assert.equal(receivingRejectedRecord.phase, "quarantined");
      assert.equal(receivingRejectedRecord.quarantineReason, "authority-changed");
      rejectFinalReceivingValidation = false;
      assert.deepEqual(await receivingReject.service.start(receivingPrepared.lookup, context),
        { code: "recovery-required" });
      return { candidateUncertain: true, settlementUncertain: true,
        postSettlementReadBlocked: true, receivingRevalidationBlocked: true };
    });

    await check(CASE_NAMES[9], async (observe, resetScenario, capture) => {
      const modes = ["guard-early", "guard-double", "guard-substitute", "guard-retained",
        "outer-early", "outer-double", "outer-substitute", "outer-retained"];
      const outcomes = [];
      for (const mode of modes) {
        await resetScenario(`before host mode ${mode}`);
        const prepared = await createPrepared(`host_${mode.replaceAll("-", "_")}`);
        const composition = startComposition(`host_${mode.replaceAll("-", "_")}`,
          prepared, { hostMode: mode });
        const expectedEffect = mode.endsWith("early") ? NO_NATIVE_EFFECT
          : ONE_SUCCESSFUL_NATIVE_START;
        const expectedMetrics = mode.endsWith("early") ? NO_NATIVE_METRICS
          : ONE_SUCCESSFUL_NATIVE_METRICS;
        const result = await observe(mode, () => composition.service.start(prepared.lookup, context),
          expectedEffect, expectedMetrics);
        if (mode.endsWith("retained")) assert.equal(result.code, "started");
        else assert.deepEqual(result, { code: "recovery-required" });
        const drainResults = await composition.host.drain();
        if (mode.endsWith("substitute")) assert.deepEqual(drainResults, []);
        else {
          assert.deepEqual(drainResults.map(item => item.status), ["rejected"]);
          assert.deepEqual(drainResults.map(item => item.error), [invalidHostCallbackMessage]);
        }
        if (!mode.endsWith("retained")) {
          assert.deepEqual(await composition.service.start(prepared.lookup, context),
            { code: "recovery-required" });
        }
        outcomes.push({ mode, code: result.code, drainResults });
      }

      for (const layer of ["guard", "outer"]) {
        await resetScenario(`before pending ${layer} host invalidation`);
        const prepared = await createPrepared(`pending_${layer}`);
        const returnAfter = deferred();
        const createEntered = deferred();
        const createHold = deferred();
        const host = hostFixture({ kind: `${layer}-pending`, returnAfter });
        const composition = startComposition(`pending_${layer}`, prepared, {
          hostValue: host,
          adapter: syntheticAdapter(`pending_${layer}`, "normal", { createEntered, createHold }),
        });
        let drainResults;
        const result = await observe(`${layer} host returns invalid while Native effect is pending`,
          async () => {
            const pending = composition.service.start(prepared.lookup, context);
            await createEntered.promise;
            await capture(`while ${layer} host Native create is pending`);
            returnAfter.resolve();
            const closed = await pending;
            createHold.resolve();
            drainResults = await host.drain();
            return closed;
        }, ONE_FAILED_NATIVE_START_BEFORE_SESSION, ONE_CREATE_ONLY_NATIVE_METRICS);
        assert.deepEqual(result, { code: "recovery-required" });
        assert.deepEqual(drainResults.map(item => item.status), ["fulfilled"]);
        const pendingRecord = (await startRecord(prepared.preparationId)).record;
        assert.equal(pendingRecord.phase, "quarantined");
        assert.equal(pendingRecord.quarantineReason, "host-invalid");
        outcomes.push({ mode: `${layer}-pending`, code: result.code, drainResults });
      }

      for (const layer of ["guard", "outer"]) {
        await resetScenario(`before failed quarantine after ${layer} substitution`);
        const prepared = await createPrepared(`failed_quarantine_${layer}`);
        const host = hostFixture(`${layer}-substitute`);
        const composition = startComposition(`failed_quarantine_${layer}`, prepared, {
          hostValue: host,
          receiptPort: base => startPortProxy(base, {
            quarantine: async () => ({ code: "unavailable" }),
          }),
        });
        const result = await observe(`${layer} substitution with failed quarantine stays blocked`,
          () => composition.service.start(prepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
          ONE_SUCCESSFUL_NATIVE_METRICS);
        assert.deepEqual(result, { code: "recovery-required" });
        assert.deepEqual(await host.drain(), []);
        const candidate = (await startRecord(prepared.preparationId)).record;
        assert.equal(candidate.phase, "reference-candidate");
        assert.match(candidate.nativeEvidenceDigest, /^[0-9a-f]{64}$/);
        assert.deepEqual(await composition.service.start(prepared.lookup, context),
          { code: "recovery-required" });
        outcomes.push({ mode: `${layer}-substitute-quarantine-unavailable`,
          code: result.code, retainedPhase: candidate.phase });
      }

      await resetScenario("before stale candidate CAS after host quarantine");
      const stalePrepared = await createPrepared("stale-candidate-cas");
      const candidateEntered = deferred();
      const candidateHold = deferred();
      const returnAfter = deferred();
      const staleHost = hostFixture({ kind: "outer-pending", returnAfter });
      const stale = startComposition("stale-candidate-cas", stalePrepared, {
        hostValue: staleHost,
        receiptPort: base => startPortProxy(base, {
          recordReferenceCandidate: async (...args) => {
            candidateEntered.resolve();
            await candidateHold.promise;
            return base.recordReferenceCandidate(...args);
          },
        }),
      });
      let staleDrain;
      const staleResult = await observe("stale candidate CAS cannot overwrite host quarantine",
        async () => {
          const pending = stale.service.start(stalePrepared.lookup, context);
          await candidateEntered.promise;
          await capture("while candidate CAS is held before its transaction");
          returnAfter.resolve();
          const closed = await pending;
          const quarantined = (await startRecord(stalePrepared.preparationId)).record;
          assert.equal(quarantined.phase, "quarantined");
          candidateHold.resolve();
          staleDrain = await staleHost.drain();
          return closed;
        }, ONE_SUCCESSFUL_NATIVE_START, ONE_SUCCESSFUL_NATIVE_METRICS);
      assert.deepEqual(staleResult, { code: "recovery-required" });
      assert.deepEqual(staleDrain.map(item => item.status), ["fulfilled"]);
      const staleRecord = (await startRecord(stalePrepared.preparationId)).record;
      assert.equal(staleRecord.phase, "quarantined");
      assert.equal(staleRecord.quarantineReason, "host-invalid");
      assert.equal(staleRecord.nativeEvidenceDigest, null);
      outcomes.push({ mode: "stale-candidate-cas", code: staleResult.code,
        drainResults: staleDrain });

      await resetScenario("before preparation service closes across operations");
      const preparationHost = hostFixture("normal", "runtime-prepare");
      const sharedPreparation = preparationComposition("cross-preparation", { preparationHost });
      const preparationA = await createPreparedOn(sharedPreparation,
        "cross_preparation_operation_a");
      const preparationCreateEntered = deferred();
      const preparationCreateHold = deferred();
      const preparationStart = startComposition("cross-preparation", preparationA, {
        preparationService: sharedPreparation.service,
        adapter: syntheticAdapter("cross-preparation", "normal", {
          createEntered: preparationCreateEntered, createHold: preparationCreateHold,
        }),
      });
      const preparationClose = await observe(
        "04c admission closure invalidates a paused 04d receiving lease",
        async () => {
          const pending = preparationStart.service.start(preparationA.lookup, context);
          await preparationCreateEntered.promise;
          await capture("while 04d holds the first 04c receiving lease");
          preparationHost.setMode("outer-substitute");
          const operationB = "cross_preparation_operation_b";
          const closeResult = await sharedPreparation.service.prepare(prepareRequest(operationB), context);
          assert.deepEqual(closeResult, { code: "recovery-required" });
          const closedPreparation = (await preparationRecord(operationB)).record;
          assert.equal(closedPreparation.phase, "quarantined");
          assert.equal(closedPreparation.quarantineReason, "host-invalid");
          preparationCreateHold.resolve();
          const startResult = await pending;
          assert.deepEqual(await preparationHost.drain(), []);
          return { closeResult, startResult };
        }, PREPARATION_CLOSES_DURING_ONE_FAILED_NATIVE_START, ONE_CREATE_ONLY_NATIVE_METRICS);
      assert.deepEqual(preparationClose, { closeResult: { code: "recovery-required" },
        startResult: { code: "recovery-required" } });
      const preparationStartRecord = (await startRecord(preparationA.preparationId)).record;
      assert.equal(preparationStartRecord.phase, "quarantined");
      assert.equal(preparationStartRecord.quarantineReason, "effect-uncertain");
      assert.deepEqual(await observe("04c closure leaves the exact 04d replay blocked",
        () => preparationStart.service.start(preparationA.lookup, context), NO_NATIVE_EFFECT,
        NO_NATIVE_METRICS), { code: "recovery-required" });
      assert.deepEqual((await startRecord(preparationA.preparationId)).record,
        preparationStartRecord);
      outcomes.push({ mode: "cross-04c-close", ...preparationClose });

      await resetScenario("before start service closes across operations");
      const sharedStartPreparation = preparationComposition("cross-start-preparation");
      const startA = await createPreparedOn(sharedStartPreparation, "cross_start_operation_a");
      const startB = await createPreparedOn(sharedStartPreparation, "cross_start_operation_b");
      const startHost = hostFixture("normal");
      const startCreateEntered = deferred();
      const startCreateHold = deferred();
      const sharedStart = startComposition("cross-start", startA, {
        preparationService: sharedStartPreparation.service,
        expectedPreparationIds: [startA.preparationId, startB.preparationId],
        hostValue: startHost,
        adapter: syntheticAdapter("cross-start", "normal", {
          createEntered: startCreateEntered, createHold: startCreateHold,
          createHoldWhen: options => options.sessionId === "cross-start_start_native-session_1",
        }),
      });
      const startClose = await observe("04d admission closure invalidates another paused operation",
        async () => {
          const pendingA = sharedStart.service.start(startA.lookup, context);
          await startCreateEntered.promise;
          await capture("while operation A Native create is pending");
          startHost.setMode("outer-substitute");
          const resultB = await sharedStart.service.start(startB.lookup, context);
          assert.deepEqual(resultB, { code: "recovery-required" });
          startCreateHold.resolve();
          const resultA = await pendingA;
          assert.deepEqual(await startHost.drain(), []);
          return { resultA, resultB };
        }, ONE_SUCCESS_AND_ONE_FAILED_NATIVE_START, TWO_RUN_NATIVE_METRICS);
      assert.deepEqual(startClose, { resultA: { code: "recovery-required" },
        resultB: { code: "recovery-required" } });
      for (const item of [startA, startB]) {
        const record = (await startRecord(item.preparationId)).record;
        assert.equal(record.phase, "quarantined");
        assert.equal(record.quarantineReason, "host-invalid");
      }
      outcomes.push({ mode: "cross-04d-close", ...startClose });
      return { hostModes: outcomes };
    });

    await check(CASE_NAMES[10], async (observe, resetScenario, capture) => {
      const prepared = await createPrepared("foreign");
      const first = startComposition("foreign-a", prepared);
      const started = await observe("establish first-incarnation verified reference",
        () => first.service.start(prepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS);
      assert.equal(started.code, "started");
      const second = startComposition("foreign-b", prepared);
      assert.deepEqual(await observe("new service incarnation refuses and quarantines old verified receipt",
        () => second.service.start(prepared.lookup, context), NO_NATIVE_EFFECT, NO_NATIVE_METRICS),
      { code: "recovery-required" });
      const foreignRecord = (await startRecord(prepared.preparationId)).record;
      assert.equal(foreignRecord.phase, "quarantined");
      assert.equal(foreignRecord.quarantineReason, "foreign-incarnation");

      await resetScenario("before mutated Native association");
      const mutated = await createPrepared("mutated-native");
      const composition = startComposition("mutated-native", mutated);
      const result = await observe("establish reference before Native thread mutation",
        () => composition.service.start(mutated.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS);
      assert.equal(result.code, "started");
      await setThreadScope(result.reference.nativeThreadId,
        { type: "vivary-project-runtime-v1", id: "0".repeat(64) });
      assert.deepEqual(await observe("mutated exact Native thread suppresses resolver",
        () => composition.service.resolveReference(mutated.lookup, context, identity()),
      NO_NATIVE_EFFECT, NO_NATIVE_METRICS),
      { code: "recovery-required" });
      return { foreignQuarantined: true, mutatedNativeSuppressed: true };
    });

    await check(CASE_NAMES[11], async (observe, resetScenario, capture) => {
      const prepared = await createPrepared("namespace",
        { operationId: "namespace_prep_preparation_1" });
      const start = startComposition("namespace", prepared);
      assert.equal((await observe("establish runtime-start namespace row",
        () => start.service.start(prepared.lookup, context), ONE_SUCCESSFUL_NATIVE_START,
        ONE_SUCCESSFUL_NATIVE_METRICS)).code,
      "started");
      const sharedOperationId = prepared.preparationId;
      const creationRequest = { operationId: sharedOperationId, parentRef: "parent-a",
        childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
        expectedPolicyRevision: 7 };
      const creationAuthority = { actorId: identity().actorId,
        collectionId: identity().collectionId, deviceId: identity().deviceId,
        policyRevision: 7, member: true, capabilities: ["create-child"],
        creatableParents: ["parent-a"] };
      const creationHost = hostFixture("normal", "create");
      const createStore = createCreationReceiptStore({
        resolveFacts: async () => creationAuthority,
        resolveNamespace: async () => ({ parentRef: "parent-a", namespaceKey: "namespace-a",
          childKey: "child-example", stageId: "stage-a", continuityId: "continuity-a",
          exclusiveControl: true }),
        creationHost: creationHost.host,
      });
      assert.equal((await createStore.prepare(creationRequest)).output.code, "preparing");
      assert.equal((await createStore.read(creationRequest)).output.code, "preparing");
      assert.deepEqual(await creationHost.drain(), []);
      const fixture = JSON.parse(await readFile(new URL("../../../docs/product/multi-project/fixtures/project-registry.json",
        import.meta.url), "utf8"));
      const registryFacts = Object.fromEntries(["actorId", "collectionId", "deviceId", "member",
        "capabilities", "rootAccess", "policyRevision", "root", "overlapSafe"]
        .map(key => [key, fixture.inputs.register.trusted[key]]));
      Object.assign(registryFacts, { actorId: identity().actorId,
        collectionId: identity().collectionId, deviceId: identity().deviceId });
      const registry = createRegistryStore({ resolveFacts: async () => registryFacts,
        allocateIds: async () => ({ projectId: "namespace-project", bindingId: "namespace-binding" }),
        evaluate: evaluateRegistryOperation });
      const registrationRequest = { ...fixture.inputs.register.request,
        operationId: sharedOperationId, expectedRegistryRevision: 0 };
      assert.equal((await registry.register(registrationRequest)).output.code, "registered");
      const rows = await observe("all four namespaces coexist at the same operation id",
        () => receiptRows(), NO_NATIVE_EFFECT, NO_NATIVE_METRICS);
      assert.deepEqual(rows.map(row => row.operation).sort(),
        ["create", "register", "runtime-prepare", "runtime-start"]);
      assert.ok(rows.every(row => row.operation_id === sharedOperationId));
      const startRow = rows.find(row => row.operation === "runtime-start");
      assert.equal(startRow.creation_namespace_key, null);
      assert.equal(startRow.creation_child_key, null);
      assert.equal(startRow.creation_phase, null);
      return { operations: rows.map(row => row.operation).sort(), isolated: true };
    });
  } finally {
    const cleanupFailures = [];
    const callbackResults = await Promise.allSettled([...pendingCallbacks]);
    cleanupFailures.push(...callbackResults.filter(result => result.status === "rejected")
      .map(result => result.reason));
    for (const outcome of unclaimedCallbackOutcomes.values()) {
      cleanupFailures.push(outcome.status === "rejected" ? outcome.error
        : new Error("fulfilled host callback was never drained by its owner"));
    }
    try { await drainOwnedNative(); } catch (error) { cleanupFailures.push(error); }
    for (const handle of ownedTimers.keys()) {
      cleanupFailures.push(new Error("owned Native retention timer survived its completion drain"));
      Reflect.apply(originalClearTimeout, globalThis, [handle]);
      ownedTimers.delete(handle);
      timersCleared += 1;
    }
    Object.defineProperty(globalThis, "setTimeout", originalSetTimeoutDescriptor);
    globalsRestored = globalThis.setTimeout === originalSetTimeout;
    const lockResults = await releaseFixtureWriteLocks();
    cleanupFailures.push(...lockResults.filter(result => result.status === "rejected")
      .map(result => result.reason));
    try { await clearFixture(); } catch (error) { cleanupFailures.push(error); }
    try { await closeDbExec(); } catch (error) { cleanupFailures.push(error); }
    witness.nativeCleanup = { finalizedRuns, timersCleared,
      completionOutcomes: Object.fromEntries([...nativeCompletionOutcomes.entries()]
        .sort(([left], [right]) => lexicalCompare(left, right))) };
    const completedCases = witness.cases.filter(item => item.result?.code !== "incomplete").length;
    if (completedCases !== CASE_NAMES.length || cleanupFailures.length > 0) {
      try {
        const partialLine = `RUNTIME_START_PARTIAL_WITNESS ${witnessEnvelope({
          incomplete: true, completedCases, expectedCases: CASE_NAMES.length,
          cleanupFailures: cleanupFailures.map(boundedError), witness,
        })}`;
        assert.ok(Buffer.byteLength(partialLine, "utf8") <= PARTIAL_WITNESS_LIMIT);
        process.stdout.write(`${partialLine}\n`);
      } catch (exportError) {
        try {
          const failureLine = `RUNTIME_START_PARTIAL_EXPORT_FAILURE ${canonicalJson(boundedError(exportError))}`;
          assert.ok(Buffer.byteLength(failureLine, "utf8") <= 2048);
          process.stdout.write(`${failureLine}\n`);
        } catch {
          // Optional diagnostics must preserve the original case or cleanup failure.
        }
      }
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, "runtime start worker cleanup failed");
    }
  }
  assert.equal(pendingCallbacks.size, 0);
  assert.equal(unclaimedCallbackOutcomes.size, 0);
  assert.equal(ownedTimers.size, 0);
  assert.deepEqual(nativeDrainFailures, []);
  assert.equal(activeNativeRunIds.size, 0);
  assert.equal(globalsRestored, true);
  assert.equal(witness.cases.length, CASE_NAMES.length);
  const witnessLine = `RUNTIME_START_STATE_WITNESS ${witnessEnvelope(witness)}`;
  assert.ok(Buffer.byteLength(witnessLine, "utf8") <= PARTIAL_WITNESS_LIMIT);
  process.stdout.write(`${witnessLine}\n`);
  process.stdout.write(`NATIVE_TIMER_CLEANUP finalizedRuns=${finalizedRuns} timersCleared=${timersCleared} pending=0 globalsRestored=true\n`);
  process.stdout.write("WORKER_CLEANUP databaseClosed=true pendingCallbacks=0 globalsRestored=true\n");
  process.stdout.write("PASS runtime start worker cleanup\n");
}

if (process.env.VIVARY_RUNTIME_START_WORKER === "1") { // guard:allow-env-credential - Test child mode flag.
  try { await worker(); }
  catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  }
} else {
  test("project runtime start admits one bounded actual Native synthetic turn", async () => {
    const configured = process.env.VIVARY_REGISTRY_PROOF_ROOT; // guard:allow-env-credential - Disposable proof directory.
    assert.ok(configured && path.isAbsolute(configured), "explicit absolute proof root required");
    const proofRoot = await realpath(configured);
    const caseRoot = await mkdtemp(path.join(proofRoot, "runtime-start-"));
    assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
    const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
      "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"];
    const env = Object.fromEntries(retained.filter(key => process.env[key]) // guard:allow-env-credential - Fixed OS launch paths.
      .map(key => [key, process.env[key]])); // guard:allow-env-credential - Fixed OS launch paths.
    Object.assign(env, { VIVARY_RUNTIME_START_WORKER: "1",
      VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential - Reviewed package manifest path.
      NODE_ENV: "test", DATABASE_URL: `file:${path.join(caseRoot, "registry.sqlite")}`,
      AGENT_NATIVE_DISABLED_PLUGINS: "agent-chat,auth,context-xray,core-routes,integrations,observational-memory,onboarding,org,resources,sentry,terminal" });
    try {
      const result = spawnSync(process.execPath, ["--max-old-space-size=192", TEST_FILE], {
        cwd: caseRoot, env, windowsHide: true, encoding: "utf8", timeout: 120_000,
        maxBuffer: WORKER_OUTPUT_LIMIT,
      });
      const capturedStdout = result.stdout ?? "";
      const capturedStderr = result.stderr ?? "";
      const diagnostic = `stdout tail:\n${boundedDiagnostic(result.stdout)}\n`
        + `stderr tail:\n${boundedDiagnostic(result.stderr)}`;
      // One pipe keeps TAP stderr comments out of a chunked witness record.
      const forwardedOutput = capturedStderr
        ? `WORKER_STDERR_BEGIN\n${capturedStderr}${capturedStderr.endsWith("\n") ? "" : "\n"}`
          + `WORKER_STDERR_END\n${capturedStdout}`
        : capturedStdout;
      assert.ok(Buffer.byteLength(forwardedOutput, "utf8") <= WORKER_FORWARD_LIMIT,
      `combined worker output exceeded the forwarding limit reserved for diagnostics\n${diagnostic}`);
      process.stdout.write(forwardedOutput);
      assert.equal(result.error, undefined, `${result.error?.message ?? ""}\n${diagnostic}`);
      assert.equal(result.signal, null, diagnostic);
      assert.equal(result.status, 0, diagnostic);
      assertWorkerEvidence(result.stdout);
      process.stdout.write("WORKER_NATURAL_EXIT code=0 signal=none timeoutMs=120000\n");
    } finally {
      assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
      await rm(caseRoot, { recursive: true, force: true });
    }
  });
}
