import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const TEST_FILE = fileURLToPath(import.meta.url);
const CASE_NAMES = Object.freeze([
  "default composition and strict requests stay unavailable",
  "one exact preparation stores self-contained 04b-compatible intent",
  "matching replay concurrency reordered JSON and changed request conflict",
  "malformed key digest JSON and every redundant field conflict refuse",
  "fresh identity runtime authority and registrar-only mismatches refuse",
  "grant revocation before and during admission prevents Native effects",
  "early retained double and substituted host callbacks permanently close admission",
  "interruption collision lost Native reply mismatched return and candidate failure recover",
  "settlement uncertainty and failed quarantine never reopen admission",
  "foreign incarnations refuse reserved candidate prepared and pending old CAS",
  "Native deletion and scope mutation make prepared replay unusable",
  "cancel before create versus create and after uncertain create is conservative",
  "registration creation and runtime preparation namespaces remain isolated",
]);
const SNAPSHOT_TABLES = Object.freeze([
  "agent_harness_sessions", "agent_run_events", "agent_runs", "chat_threads",
  "vivary_registry_bindings", "vivary_registry_projects", "vivary_registry_receipts",
  "vivary_registry_revisions",
]);
const SCHEMA_INITIALIZATION_TABLES = Object.freeze([
  ...SNAPSHOT_TABLES, "agent_run_outcome_daily", "agent_tool_ledger",
].sort());
const EXPECTED_RUN_STORE_SHA256 =
  "bc4ea216790fa919169d12df8367073b16c363a96e4af6bb4208e15f479d90ba";

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
const canonicalDigest = value => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const jsonDigest = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
const boundedDiagnostic = value => String(value ?? "")
  .replace(/^PREPARATION_STATE_WITNESS .*$/gm, "PREPARATION_STATE_WITNESS [omitted]")
  .slice(-8 * 1024);

function assertWorkerEvidence(stdout) {
  const lines = stdout.split(/\r?\n/);
  const starts = lines.filter(line => line.startsWith("START ")).map(line => line.slice(6));
  const passes = lines.filter(line => line.startsWith("PASS ")
    && line !== "PASS runtime preparation worker cleanup").map(line => line.slice(5));
  assert.deepEqual(starts, [...CASE_NAMES]);
  assert.deepEqual(passes, starts);
  assert.equal(lines.filter(line => line === "PASS runtime preparation worker cleanup").length, 1);
  const evidence = lines.filter(line => line.startsWith("PREPARATION_STATE_WITNESS "));
  assert.equal(evidence.length, 1);
  assert.ok(Buffer.byteLength(evidence[0], "utf8") <= 1024 * 1024);
  const witness = JSON.parse(evidence[0].slice("PREPARATION_STATE_WITNESS ".length));
  assert.equal(witness.schemaVersion, 1);
  assert.equal(witness.caseCount, CASE_NAMES.length);
  assert.deepEqual(witness.tableNames, [...SNAPSHOT_TABLES]);
  assert.equal(witness.schemaInitialization.runStoreSha256, EXPECTED_RUN_STORE_SHA256);
  assert.equal(witness.schemaInitialization.privateSeam,
    "@agent-native/core/dist/agent/run-store.js#ensureRunTables");
  assert.deepEqual(Object.keys(witness.schemaInitialization.tables).sort(),
    [...SCHEMA_INITIALIZATION_TABLES]);
  assert.ok(Object.values(witness.schemaInitialization.tables)
    .every(table => Array.isArray(table.columns) && table.columns.length > 0
      && table.rowCount === 0));
  assert.deepEqual(witness.cases.map(item => item.name), [...CASE_NAMES]);
  for (const [snapshotHash, snapshot] of Object.entries(witness.snapshots)) {
    assert.match(snapshotHash, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(snapshot.tables).sort(), [...SNAPSHOT_TABLES]);
    assert.equal(canonicalDigest(snapshot), snapshotHash);
    for (const tableName of SNAPSHOT_TABLES) {
      const table = snapshot.tables[tableName];
      assert.ok(Array.isArray(table.columns) && table.columns.length > 0);
      assert.deepEqual(table.columns, [...new Set(table.columns)].sort());
      assert.ok(Array.isArray(table.rows));
      assert.equal(table.rowCount, table.rows.length);
      assert.equal(table.sha256,
        canonicalDigest({ columns: table.columns, rows: table.rows }));
    }
  }
  for (const item of witness.cases) {
    assert.ok(witness.snapshots[item.before]);
    assert.ok(witness.snapshots[item.after]);
    assert.ok(item.result !== undefined);
    assert.ok(Array.isArray(item.phases));
    assert.ok(Array.isArray(item.observations));
    const observationLabels = new Set();
    for (const observation of item.observations) {
      assert.equal(typeof observation.label, "string");
      assert.ok(observation.label.length > 0 && !observationLabels.has(observation.label));
      observationLabels.add(observation.label);
      assert.ok(witness.snapshots[observation.before]);
      assert.ok(witness.snapshots[observation.after]);
      assert.ok(observation.result !== undefined);
      assert.deepEqual(Object.keys(observation.metrics).sort(),
        ["createThreadCalls", "getThreadCalls", "guardCalls", "scopeCalls"]);
      assert.ok(Object.values(observation.metrics)
        .every(value => Number.isInteger(value) && value >= 0));
    }
    for (const field of ["createThreadCalls", "getThreadCalls", "scopeCalls", "guardCalls"]) {
      assert.ok(Number.isInteger(item[field]) && item[field] >= 0);
    }
  }
  assert.equal(lines.filter(line => line ===
    "WORKER_CLEANUP databaseClosed=true pendingCallbacks=0 globalsRestored=true").length, 1);
}

async function worker() {
  register(new URL("./native-http-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential - Reviewed package manifest path.
  });
  const { closeDbExec, getDbExec, withMigrationRuntime } =
    await import("@agent-native/core/db");
  const { ensureAgentHarnessSessionTables } = await import("@agent-native/core/agent/harness");
  const { createThread: nativeCreateThread, getThread: nativeGetThread } =
    await import("@vivary-test/core-server");
  const corePackageJson = await realpath(process.env.VIVARY_TEST_CORE_PACKAGE_JSON); // guard:allow-env-credential - Reviewed package manifest path.
  const corePackageRoot = path.dirname(corePackageJson);
  const runStorePath = await realpath(path.join(corePackageRoot, "dist", "agent", "run-store.js"));
  assert.equal(path.dirname(path.dirname(runStorePath)), path.join(corePackageRoot, "dist"));
  const runStoreSha256 = createHash("sha256").update(await readFile(runStorePath)).digest("hex");
  assert.equal(runStoreSha256, EXPECTED_RUN_STORE_SHA256,
    "fixture-only private Native run-store seam must match reviewed Core 0.176.5 bytes");
  const { ensureRunTables } = await import(pathToFileURL(runStorePath).href);
  const { createProjectRuntimePreparationService } =
    await import("../server/project-runtime-preparation.mjs");
  const { createRuntimePreparationReceiptPort } =
    await import("../server/runtime-preparation-receipts.mjs");
  const { createCreationReceiptStore } = await import("../server/creation-receipts.mjs");
  const { createRegistryStore } = await import("../server/registry-store.mjs");
  const { getDb } = await import("../server/db/index.mjs");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const { evaluateRegistryOperation } = await import("../../../scripts/registry_contract_model.mjs");

  const context = Object.freeze({ userEmail: "runtime-preparation@example.test",
    orgId: "runtime-preparation-org", appId: "workbench", caller: "private-fixture" });
  const BASE_SCOPE_KEY = "scope_runtime_preparation_v1";
  const identityFields = Object.freeze([
    "ownerEmail", "orgId", "actorId", "collectionId", "deviceId", "projectId", "bindingId",
    "bindingRevision", "rootId", "contentRevision", "locationRef", "policyRevision", "harnessName",
    "runtimeVersion", "executionLocation", "authorityContract", "runtimeConfigurationRevision",
  ]);
  const identity = (patch = {}) => Object.freeze({
    ownerEmail: context.userEmail,
    orgId: context.orgId,
    actorId: "runtime-preparation-actor",
    collectionId: "runtime-preparation-collection",
    deviceId: "runtime-preparation-device",
    projectId: "runtime-preparation-project",
    bindingId: "runtime-preparation-binding",
    bindingRevision: 4,
    rootId: "synthetic-runtime-root",
    contentRevision: "synthetic-content-1",
    locationRef: "primary",
    policyRevision: 7,
    harnessName: "synthetic-harness",
    runtimeVersion: "synthetic-v1",
    executionLocation: "synthetic-habitat",
    authorityContract: "runtime-preparation-v1",
    runtimeConfigurationRevision: 3,
    ...patch,
  });
  const request = (patch = {}) => ({
    schemaVersion: 1,
    operationId: "prepare-operation",
    scopeKey: BASE_SCOPE_KEY,
    projectId: "runtime-preparation-project",
    expectedBindingRevision: 4,
    expectedPolicyRevision: 7,
    role: "developer",
    ...patch,
  });
  const cancelRequest = item => ({ schemaVersion: 1, operationId: item.operationId,
    scopeKey: item.scopeKey, projectId: item.projectId,
    expectedBindingRevision: item.expectedBindingRevision,
    expectedPolicyRevision: item.expectedPolicyRevision });
  const bindingDigest = value => jsonDigest(Object.fromEntries(
    identityFields.map(field => [field, value[field]]),
  ));
  const directIntent = (item, issuerIncarnationId, identityValue = identity()) => Object.freeze({
    request: Object.freeze({ ...item }),
    identity: identityValue,
    bindingIdentityDigest: bindingDigest(identityValue),
    roleContractRevision: 11,
    preparationAuthorityRevision: 13,
    issuerIncarnationId,
  });

  let metrics;
  const pendingCallbacks = new Set();
  const trackPending = promise => {
    pendingCallbacks.add(promise);
    promise.finally(() => pendingCallbacks.delete(promise)).catch(() => {});
    return promise;
  };
  const deferred = () => {
    let resolve;
    const promise = new Promise(accept => { resolve = accept; });
    return Object.freeze({ promise, resolve });
  };

  function allocator(prefix) {
    const counts = new Map();
    const allocateId = async kind => {
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      return `${prefix}_${kind}_${count}`;
    };
    return { allocateId, id: kind => `${prefix}_${kind}_1` };
  }

  function hostFixture(mode = "normal") {
    let retainedOuter = null;
    let retainedInner = null;
    const guard = Object.freeze({
      async executeOnce(_admission, invoke) {
        metrics.guardCalls += 1;
        if (mode === "guard-refuse") return { code: "denied" };
        if (mode === "guard-early") {
          retainedInner = invoke;
          return {};
        }
        if (mode === "guard-retained-after") retainedInner = invoke;
        const first = await invoke();
        if (mode === "guard-double") await invoke().catch(() => undefined);
        return mode === "guard-substitute" ? {} : first;
      },
    });
    const host = Object.freeze({
      async withCreationScope(scope, enter) {
        metrics.scopeCalls += 1;
        assert.deepEqual(Object.keys(scope).sort(), ["collectionId", "deviceId"]);
        if (mode === "outer-refuse") return { code: "denied" };
        if (mode === "outer-early") {
          retainedOuter = enter;
          return {};
        }
        if (mode === "outer-retained-after") retainedOuter = enter;
        const first = await enter(guard);
        if (mode === "outer-double") await enter(guard).catch(() => undefined);
        return mode === "outer-substitute" ? {} : first;
      },
    });
    return Object.freeze({ host, async drain() {
      if (retainedOuter) await trackPending(Promise.resolve().then(() => retainedOuter(guard))).catch(() => undefined);
      if (retainedInner) await trackPending(Promise.resolve().then(() => retainedInner())).catch(() => undefined);
    } });
  }

  function portProxy(base, overrides = {}) {
    return Object.freeze(Object.fromEntries([
      "read", "reserve", "beginThreadCreation", "recordThreadCandidate", "verifySettlement",
      "quarantine", "cancelBeforeCreation",
    ].map(name => [name, overrides[name] ?? ((...args) => base[name](...args))])));
  }

  function composition({ prefix, hostMode = "normal", hostFixtureValue = null,
    facts = { scopeKey: BASE_SCOPE_KEY, identity: identity() },
    authority = { roles: ["developer", "planner", "qa"], roleContractRevision: 11,
      preparationAuthorityRevision: 13 },
    resolveFactsEffect = null, resolveAuthorityEffect = null, receiptPort = null,
    createThreadEffect = null, getThreadEffect = null } = {}) {
    const ids = allocator(prefix);
    const host = hostFixtureValue ?? hostFixture(hostMode);
    const basePort = createRuntimePreparationReceiptPort({ db: getDb() });
    const selectedPort = receiptPort?.(basePort) ?? basePort;
    let factCalls = 0;
    let authorityCalls = 0;
    const service = createProjectRuntimePreparationService({
      resolveFacts: async (item, suppliedContext) => {
        factCalls += 1;
        assert.deepEqual(suppliedContext, context);
        return structuredClone(resolveFactsEffect
          ? await resolveFactsEffect(factCalls, item, facts)
          : facts);
      },
      resolvePreparationAuthority: async (item, suppliedContext, suppliedFacts) => {
        authorityCalls += 1;
        assert.deepEqual(suppliedContext, context);
        return structuredClone(resolveAuthorityEffect
          ? await resolveAuthorityEffect(authorityCalls, item, suppliedFacts, authority)
          : authority);
      },
      preparationHost: host.host,
      receiptPort: selectedPort,
      allocateId: ids.allocateId,
      createThread: async (...args) => {
        metrics.createThreadCalls += 1;
        return createThreadEffect ? createThreadEffect(...args) : nativeCreateThread(...args);
      },
      getThread: async (...args) => {
        metrics.getThreadCalls += 1;
        return getThreadEffect ? getThreadEffect(...args) : nativeGetThread(...args);
      },
    });
    return { service, basePort, port: selectedPort, ids, host, facts,
      counts: () => ({ factCalls, authorityCalls }) };
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

  async function clearFixture() {
    for (const table of ["agent_run_events", "agent_runs", "agent_harness_sessions", "chat_threads",
      "vivary_registry_receipts", "vivary_registry_bindings", "vivary_registry_projects",
      "vivary_registry_revisions"]) {
      await getDbExec().execute({ sql: `DELETE FROM ${table}`, args: [] });
    }
  }

  async function receiptRows() {
    const result = await getDbExec().execute({ sql: `SELECT * FROM vivary_registry_receipts
      ORDER BY operation, operation_id, receipt_key`, args: [] });
    return result.rows.map(row => Object.fromEntries(Object.entries(row)));
  }

  async function runtimeRecords() {
    return (await receiptRows()).filter(row => row.operation === "runtime-prepare").map(row => {
      try { return JSON.parse(String(row.record)); } catch { return { phase: "invalid" }; }
    });
  }

  async function seedReserved(prefix, item, identityValue = identity()) {
    const port = createRuntimePreparationReceiptPort({ db: getDb() });
    const issuerIncarnationId = `${prefix}_issuer-incarnation_1`;
    const intent = directIntent(item, issuerIncarnationId, identityValue);
    const reserved = await port.reserve(intent, {
      preparationId: `${prefix}_preparation_seed`,
      nativeThreadId: `${prefix}_native_thread_seed`,
    });
    assert.equal(reserved.code, "created");
    return { port, intent, record: reserved.record, issuerIncarnationId };
  }

  async function exactRuntimeRow(operationId) {
    const result = await getDbExec().execute({ sql: `SELECT * FROM vivary_registry_receipts
      WHERE operation = 'runtime-prepare' AND operation_id = ?`, args: [operationId] });
    assert.equal(result.rows.length, 1);
    return result.rows[0];
  }

  async function replaceRuntimeRecord(operationId, mutate) {
    const row = await exactRuntimeRow(operationId);
    const record = JSON.parse(String(row.record));
    mutate(record);
    await getDbExec().execute({ sql: `UPDATE vivary_registry_receipts SET record = ?
      WHERE operation = 'runtime-prepare' AND operation_id = ?`,
    args: [JSON.stringify(record), operationId] });
  }

  async function countRows(table) {
    const result = await getDbExec().execute({ sql: `SELECT COUNT(*) AS count FROM ${table}`, args: [] });
    return Number(result.rows[0]?.count ?? 0);
  }

  const witness = { schemaVersion: 1, caseCount: CASE_NAMES.length,
    tableNames: [...SNAPSHOT_TABLES], schemaInitialization: null, snapshots: {}, cases: [] };
  const remember = state => {
    const hash = canonicalDigest(state);
    witness.snapshots[hash] ??= state;
    return hash;
  };
  async function check(name, run) {
    assert.equal(name, CASE_NAMES[witness.cases.length]);
    await clearFixture();
    metrics = { createThreadCalls: 0, getThreadCalls: 0, scopeCalls: 0, guardCalls: 0 };
    process.stdout.write(`START ${name}\n`);
    const before = remember(await snapshot());
    const observations = [];
    const metricFields = ["createThreadCalls", "getThreadCalls", "scopeCalls", "guardCalls"];
    const metricBaseline = () => Object.freeze(Object.fromEntries(
      metricFields.map(field => [field, metrics[field]]),
    ));
    const metricDeltaFrom = baseline => Object.fromEntries(
      metricFields.map(field => [field, metrics[field] - baseline[field]]),
    );
    const assertMetricDeltaFrom = (baseline, expected, label) => {
      const delta = metricDeltaFrom(baseline);
      for (const [field, value] of Object.entries(expected)) {
        assert.ok(metricFields.includes(field), `${label} unknown metric ${field}`);
        assert.equal(delta[field], value, `${label} ${field}`);
      }
      return delta;
    };
    const metricTools = Object.freeze({
      baseline: metricBaseline,
      deltaFrom: metricDeltaFrom,
      assertDeltaFrom: assertMetricDeltaFrom,
    });
    const beginObservation = async label => {
      assert.equal(typeof label, "string");
      assert.ok(label.length > 0 && !observations.some(item => item.label === label));
      const observationBefore = remember(await snapshot());
      const metricsBefore = metricBaseline();
      let complete = false;
      return async result => {
        assert.equal(complete, false);
        complete = true;
        const metricDelta = metricDeltaFrom(metricsBefore);
        const observation = { label, before: observationBefore,
          after: remember(await snapshot()), result: canonicalValue(result), metrics: metricDelta };
        observations.push(observation);
        return observation;
      };
    };
    const result = await run(beginObservation, metricTools);
    assert.equal(pendingCallbacks.size, 0);
    const phases = (await runtimeRecords()).map(record => record.phase).sort();
    const after = remember(await snapshot());
    witness.cases.push({ name, before, after, result: canonicalValue(result), phases, observations,
      ...metrics });
    process.stdout.write(`PASS ${name}\n`);
  }

  try {
    await withMigrationRuntime(async () => {
      await migrateRegistry();
      assert.equal(await nativeGetThread("synthetic-missing"), null,
        "missing Native read initializes chat schema without creating a thread");
      await ensureAgentHarnessSessionTables();
      await ensureRunTables();
    });
    const initializedTables = {};
    for (const name of SCHEMA_INITIALIZATION_TABLES) {
      const info = await getDbExec().execute({ sql: `PRAGMA table_info(${name})`, args: [] });
      const columns = info.rows.map(row => String(row.name)).sort();
      assert.ok(columns.length > 0, `missing initialized fixture table ${name}`);
      initializedTables[name] = { columns, rowCount: await countRows(name) };
    }
    assert.ok(Object.values(initializedTables).every(table => table.rowCount === 0));
    witness.schemaInitialization = {
      privateSeam: "@agent-native/core/dist/agent/run-store.js#ensureRunTables",
      runStoreSha256,
      tables: initializedTables,
    };

    await check(CASE_NAMES[0], async () => {
      const unavailable = createProjectRuntimePreparationService();
      assert.deepEqual(await unavailable.prepare(request(), context), { code: "unavailable" });
      assert.deepEqual(await unavailable.cancelPreparation(cancelRequest(request()), context),
        { code: "unavailable" });
      const invalid = [
        { ...request(), extra: true },
        { ...request(), operationId: "bad\ud800" },
        { ...request(), expectedBindingRevision: Number.NaN },
        { ...request(), expectedPolicyRevision: Number.MAX_SAFE_INTEGER + 1 },
        { ...request(), role: "registrar" },
        { ...request(), schemaVersion: 2 },
      ];
      for (const item of invalid) {
        assert.deepEqual(await unavailable.prepare(item, context), { code: "invalid-input" });
      }
      assert.deepEqual(await unavailable.cancelPreparation({ ...cancelRequest(request()), extra: true }, context),
        { code: "invalid-input" });
      const emptyTrustedFields = ["ownerEmail", "rootId", "contentRevision"];
      for (const field of emptyTrustedFields) {
        const item = request({ operationId: `empty_${field}` });
        const emptyIdentity = identity({ [field]: "" });
        const composed = composition({ prefix: `empty_${field}`,
          facts: { scopeKey: BASE_SCOPE_KEY, identity: emptyIdentity } });
        assert.deepEqual(await composed.service.prepare(item, context),
          { code: "unavailable" }, `${field} service refusal`);
        const port = createRuntimePreparationReceiptPort({ db: getDb() });
        assert.deepEqual(await port.reserve(
          directIntent(item, `empty_${field}_issuer`, emptyIdentity),
          { preparationId: `empty_${field}_preparation`,
            nativeThreadId: `empty_${field}_thread` },
        ), { code: "invalid" }, `${field} receipt refusal`);
      }
      assert.equal(await countRows("chat_threads"), 0);
      assert.equal(await countRows("vivary_registry_receipts"), 0);
      return { prepare: "unavailable", invalidRequests: invalid.length + 1,
        emptyTrustedFields };
    });

    await check(CASE_NAMES[1], async () => {
      const item = request({ operationId: "exact-preparation" });
      const stableHost = hostFixture("normal");
      const mutableHost = { withCreationScope: stableHost.host.withCreationScope };
      let mutablePort;
      const composed = composition({ prefix: "exact",
        hostFixtureValue: { host: mutableHost, drain: stableHost.drain },
        receiptPort: base => {
          mutablePort = { ...base };
          return mutablePort;
        } });
      mutableHost.withCreationScope = async () => { throw new Error("mutated host method"); };
      for (const method of ["read", "reserve", "beginThreadCreation", "recordThreadCandidate",
        "verifySettlement", "quarantine", "cancelBeforeCreation"]) {
        mutablePort[method] = async () => { throw new Error(`mutated ${method} method`); };
      }
      const result = await composed.service.prepare(item, context);
      assert.deepEqual(result, { code: "prepared", preparationId: "exact_preparation_1", replayed: false });
      assert.equal(metrics.createThreadCalls, 1);
      assert.equal(metrics.scopeCalls, 1);
      assert.equal(metrics.guardCalls, 1);
      assert.equal(await countRows("chat_threads"), 1);
      assert.equal(await countRows("agent_harness_sessions"), 0);
      assert.equal(await countRows("agent_runs"), 0);
      assert.equal(await countRows("agent_run_events"), 0);
      const row = await exactRuntimeRow(item.operationId);
      assert.equal(row.creation_namespace_key, null);
      assert.equal(row.creation_child_key, null);
      assert.equal(row.creation_phase, null);
      const record = JSON.parse(String(row.record));
      assert.equal(record.phase, "thread-prepared");
      assert.deepEqual(record.request, item);
      assert.deepEqual(Object.keys(record.identity), [...identityFields]);
      assert.equal(record.bindingIdentityDigest, bindingDigest(identity()));
      assert.equal(record.requestDigest, jsonDigest([
        [1, item.operationId, item.scopeKey, item.projectId, item.expectedBindingRevision,
          item.expectedPolicyRevision, item.role],
        identity(), item.role, 11, 13,
      ]));
      assert.deepEqual(record.settlement, { schemaVersion: 1, attemptId: "exact_thread-attempt_1",
        issuerIncarnationId: "exact_issuer-incarnation_1",
        authorityContract: "runtime-preparation-v1", runtimeConfigurationRevision: 3 });
      const thread = await nativeGetThread(record.nativeThreadId);
      assert.equal(thread.visibility, "private");
      assert.deepEqual(thread.scope,
        { type: "vivary-project-runtime-v1", id: record.bindingIdentityDigest });
      return { result, identityDigest: record.bindingIdentityDigest,
        requestDigest: record.requestDigest, phase: record.phase, dependencyMethodsCaptured: true };
    });

    await check(CASE_NAMES[2], async () => {
      const item = request({ operationId: "replay-concurrent" });
      const composed = composition({ prefix: "replay" });
      const [first, concurrent] = await Promise.all([
        composed.service.prepare(item, context), composed.service.prepare({ ...item }, context),
      ]);
      assert.ok([first.code, concurrent.code].includes("prepared"));
      assert.ok([first.code, concurrent.code].includes("recovery-required"));
      const replay = await composed.service.prepare(item, context);
      assert.deepEqual(replay,
        { code: "prepared", preparationId: "replay_preparation_1", replayed: true });
      const reordered = { role: item.role, expectedPolicyRevision: item.expectedPolicyRevision,
        projectId: item.projectId, operationId: item.operationId, schemaVersion: 1,
        expectedBindingRevision: item.expectedBindingRevision, scopeKey: item.scopeKey };
      assert.deepEqual(await composed.service.prepare(reordered, context), replay);
      assert.deepEqual(await composed.service.prepare({ ...item, role: "qa" }, context),
        { code: "operation-conflict" });
      const changedScopeComposition = composition({ prefix: "scope",
        facts: { scopeKey: "scope_changed", identity: identity() } });
      assert.deepEqual(await changedScopeComposition.service.prepare(item, context),
        { code: "stale-claim" });
      assert.equal(metrics.createThreadCalls, 1);
      assert.equal(await countRows("chat_threads"), 1);
      return { first: first.code, concurrent: concurrent.code, replayed: replay.replayed,
        reordered: true, changedRole: "operation-conflict", changedScope: "stale-claim" };
    });

    await check(CASE_NAMES[3], async (beginObservation, metricTools) => {
      const failures = [];
      async function corrupt(label, mutation, rowSql = null) {
        await clearFixture();
        const setupBaseline = metricTools.baseline();
        const prefix = `invalid_${label}`;
        const item = request({ operationId: `invalid_${label}` });
        await seedReserved(prefix, item);
        if (rowSql) {
          await getDbExec().execute({ sql: rowSql.sql, args: rowSql.args(item) });
        } else {
          await replaceRuntimeRecord(item.operationId, mutation);
        }
        const composed = composition({ prefix });
        const setupMetrics = metricTools.deltaFrom(setupBaseline);
        const refusalBaseline = metricTools.baseline();
        const completeObservation = await beginObservation(label);
        const result = await composed.service.prepare(item, context);
        assert.deepEqual(result, { code: "recovery-required" }, label);
        metricTools.assertDeltaFrom(refusalBaseline, { createThreadCalls: 0 },
          `${label} refusal effect count`);
        failures.push(label);
        const observation = await completeObservation({ result: result.code,
          setupNativeEffects: setupMetrics.createThreadCalls,
          refusalNativeEffects: metricTools.deltaFrom(refusalBaseline).createThreadCalls });
        assert.equal(observation.before, observation.after, `${label} refusal state mutation`);
        assert.equal(observation.metrics.createThreadCalls, 0, `${label} refusal adapter calls`);
      }
      await corrupt("json", null, { sql: `UPDATE vivary_registry_receipts SET record = '{'
        WHERE operation = 'runtime-prepare' AND operation_id = ?`, args: item => [item.operationId] });
      await corrupt("row_digest", null, { sql: `UPDATE vivary_registry_receipts SET request_digest = ?
        WHERE operation = 'runtime-prepare' AND operation_id = ?`,
      args: item => ["0".repeat(64), item.operationId] });
      await corrupt("row_key", null, { sql: `UPDATE vivary_registry_receipts SET receipt_key = ?
        WHERE operation = 'runtime-prepare' AND operation_id = ?`,
      args: item => [`runtime-prepare:v1:${"f".repeat(64)}`, item.operationId] });
      for (const [label, column, value] of [
        ["row_operation", "operation", "register"],
        ["row_operation_id", "operation_id", "conflicting_operation"],
        ["creation_namespace", "creation_namespace_key", "unexpected_namespace"],
        ["creation_child", "creation_child_key", "unexpected_child"],
        ["creation_phase", "creation_phase", "preparing"],
      ]) {
        await corrupt(label, null, { sql: `UPDATE vivary_registry_receipts SET ${column} = ?
          WHERE operation = 'runtime-prepare' AND operation_id = ?`,
        args: item => [value, item.operationId] });
      }
      const recordMutations = [
        ["equal_ids", value => { value.nativeThreadId = value.preparationId; }],
        ["record_operation", value => { value.operationId = "conflicting_operation"; }],
        ["request_operation", value => { value.request.operationId = "conflicting_operation"; }],
        ["record_role", value => { value.role = "qa"; }],
        ["request_role", value => { value.request.role = "qa"; }],
        ["request_project", value => { value.request.projectId = "conflicting_project"; }],
        ["identity_project", value => { value.identity.projectId = "conflicting_project"; }],
        ["request_binding", value => { value.request.expectedBindingRevision += 1; }],
        ["identity_binding", value => { value.identity.bindingRevision += 1; }],
        ["request_policy", value => { value.request.expectedPolicyRevision += 1; }],
        ["identity_policy", value => { value.identity.policyRevision += 1; }],
        ["record_digest", value => { value.requestDigest = "1".repeat(64); }],
        ["identity_digest", value => { value.bindingIdentityDigest = "2".repeat(64); }],
        ["phase_fields", value => { value.attemptId = "unexpected_attempt"; }],
      ];
      for (const [label, mutation] of recordMutations) await corrupt(label, mutation);
      async function corruptSettlement(label, mutation) {
        await clearFixture();
        const setupBaseline = metricTools.baseline();
        const prefix = `invalid_${label}`;
        const item = request({ operationId: `invalid_${label}` });
        const composed = composition({ prefix });
        assert.equal((await composed.service.prepare(item, context)).code, "prepared");
        const setupMetrics = metricTools.assertDeltaFrom(setupBaseline,
          { createThreadCalls: 1 }, `${label} setup effect count`);
        await replaceRuntimeRecord(item.operationId, mutation);
        const refusalBaseline = metricTools.baseline();
        const completeObservation = await beginObservation(label);
        const result = await composed.service.prepare(item, context);
        assert.deepEqual(result, { code: "recovery-required" }, label);
        metricTools.assertDeltaFrom(refusalBaseline, { createThreadCalls: 0 },
          `${label} refusal effect count`);
        failures.push(label);
        const observation = await completeObservation({ result: result.code,
          setupNativeEffects: setupMetrics.createThreadCalls,
          refusalNativeEffects: metricTools.deltaFrom(refusalBaseline).createThreadCalls });
        assert.equal(observation.before, observation.after, `${label} refusal state mutation`);
        assert.equal(observation.metrics.createThreadCalls, 0, `${label} refusal adapter calls`);
      }
      for (const [label, mutation] of [
        ["settlement_schema", value => { value.settlement.schemaVersion = 2; }],
        ["settlement_attempt", value => { value.settlement.attemptId = "conflicting_attempt"; }],
        ["settlement_issuer", value => { value.settlement.issuerIncarnationId = "conflicting_issuer"; }],
        ["settlement_contract", value => { value.settlement.authorityContract = "conflicting_contract"; }],
        ["settlement_configuration", value => { value.settlement.runtimeConfigurationRevision += 1; }],
      ]) await corruptSettlement(label, mutation);
      for (const [column, label] of [["actor_id", "row_actor"],
        ["collection_id", "row_collection"], ["device_id", "row_device"]]) {
        await corrupt(label, null, { sql: `UPDATE vivary_registry_receipts SET ${column} = ?
          WHERE operation = 'runtime-prepare' AND operation_id = ?`,
        args: item => [`conflicting_${label}`, item.operationId] });
      }
      assert.equal(metrics.createThreadCalls, 5, "corrupt receipt case total createThreadCalls");
      return { refused: failures.length, fields: failures, setupNativeEffects: 5,
        refusalNativeEffects: 0 };
    });

    await check(CASE_NAMES[4], async () => {
      const mismatches = [
        ["owner", { ownerEmail: "changed-owner@example.test" }, BASE_SCOPE_KEY],
        ["org", { orgId: "changed-org" }, BASE_SCOPE_KEY],
        ["actor", { actorId: "changed-actor" }, "changed-actor-scope"],
        ["collection", { collectionId: "changed-collection" }, "changed-collection-scope"],
        ["device", { deviceId: "changed-device" }, "changed-device-scope"],
        ["project", { projectId: "changed-project" }, BASE_SCOPE_KEY],
        ["root", { rootId: "changed-root" }, BASE_SCOPE_KEY],
        ["content", { contentRevision: "changed-content" }, BASE_SCOPE_KEY],
        ["binding", { bindingId: "changed-binding" }, BASE_SCOPE_KEY],
        ["binding_revision", { bindingRevision: 5 }, BASE_SCOPE_KEY],
        ["policy", { policyRevision: 8 }, BASE_SCOPE_KEY],
        ["runtime", { runtimeVersion: "synthetic-v2" }, BASE_SCOPE_KEY],
        ["harness", { harnessName: "changed-harness" }, BASE_SCOPE_KEY],
        ["location", { locationRef: "alternate" }, BASE_SCOPE_KEY],
        ["execution", { executionLocation: "changed-habitat" }, BASE_SCOPE_KEY],
        ["contract", { authorityContract: "runtime-preparation-v2" }, BASE_SCOPE_KEY],
        ["configuration", { runtimeConfigurationRevision: 4 }, BASE_SCOPE_KEY],
      ];
      for (const [label, identityPatch, scopeKey] of mismatches) {
        const prefix = `fresh_${label}`;
        const item = request({ operationId: `fresh_${label}` });
        await seedReserved(prefix, item);
        const composed = composition({ prefix,
          facts: { scopeKey, identity: identity(identityPatch) } });
        assert.deepEqual(await composed.service.prepare(item, context),
          { code: "stale-claim" }, label);
      }
      for (const [label, authorityPatch] of [
        ["role_contract", { roleContractRevision: 12 }],
        ["preparation_authority", { preparationAuthorityRevision: 14 }],
      ]) {
        const prefix = `fresh_${label}`;
        const item = request({ operationId: `fresh_${label}` });
        await seedReserved(prefix, item);
        const composed = composition({ prefix, authority: { roles: ["developer"],
          roleContractRevision: 11, preparationAuthorityRevision: 13, ...authorityPatch } });
        assert.deepEqual(await composed.service.prepare(item, context),
          { code: "stale-claim" }, label);
      }
      const registrarItem = request({ operationId: "registrar-only" });
      const registrar = composition({ prefix: "registrar", authority: { roles: [],
        roleContractRevision: 11, preparationAuthorityRevision: 13 } });
      assert.deepEqual(await registrar.service.prepare(registrarItem, context), { code: "denied" });
      assert.equal(metrics.createThreadCalls, 0);
      return { identityMismatches: mismatches.map(([name]) => name),
        authorityMismatches: ["role_contract", "preparation_authority"],
        registrarOnly: "denied" };
    });

    await check(CASE_NAMES[5], async () => {
      const deniedBefore = composition({ prefix: "revoke_before", authority: { roles: [],
        roleContractRevision: 11, preparationAuthorityRevision: 13 } });
      assert.deepEqual(await deniedBefore.service.prepare(
        request({ operationId: "revoke-before" }), context), { code: "denied" });

      const revokedAtEntry = composition({ prefix: "revoke_entry",
        resolveAuthorityEffect: (call, _item, _facts, current) =>
          call >= 2 ? { ...current, roles: [] } : current });
      assert.deepEqual(await revokedAtEntry.service.prepare(
        request({ operationId: "revoke-entry" }), context), { code: "denied" });

      const revokedBeforeEffect = composition({ prefix: "revoke_effect",
        resolveAuthorityEffect: (call, _item, _facts, current) =>
          call >= 4 ? { ...current, roles: [] } : current });
      assert.deepEqual(await revokedBeforeEffect.service.prepare(
        request({ operationId: "revoke-effect" }), context), { code: "denied" });
      const effectRecord = (await runtimeRecords())
        .find(record => record.operationId === "revoke-effect");
      assert.equal(effectRecord.phase, "quarantined");
      assert.equal(effectRecord.quarantineReason, "effect-uncertain");

      const rootChanged = composition({ prefix: "revoke_root",
        resolveFactsEffect: (call, _item, current) => call >= 4
          ? { ...current, identity: identity({ contentRevision: "revoked-content" }) }
          : current });
      assert.deepEqual(await rootChanged.service.prepare(
        request({ operationId: "revoke-root" }), context), { code: "stale-claim" });

      const guarded = composition({ prefix: "guard_refusal", hostMode: "guard-refuse" });
      assert.deepEqual(await guarded.service.prepare(
        request({ operationId: "guard-refusal" }), context), { code: "denied" });
      assert.equal(metrics.createThreadCalls, 0);
      return { deniedBefore: true, revokedAtEntry: true, revokedBeforeEffect: true,
        rootChanged: true, guardRefused: true };
    });

    await check(CASE_NAMES[6], async (beginObservation, metricTools) => {
      const modes = ["outer-early", "guard-early", "outer-double", "guard-double",
        "guard-substitute", "outer-substitute"];
      const results = {};
      for (const mode of modes) {
        await clearFixture();
        const scenarioBaseline = metricTools.baseline();
        const completeObservation = await beginObservation(mode);
        const item = request({ operationId: `host_${mode.replaceAll("-", "_")}` });
        const composed = composition({ prefix: `host_${mode.replaceAll("-", "_")}`, hostMode: mode });
        const result = await composed.service.prepare(item, context);
        assert.deepEqual(result, { code: "recovery-required" }, mode);
        const postResultBaseline = metricTools.baseline();
        assert.deepEqual(await composed.service.prepare(item, context),
          { code: "recovery-required" }, `${mode} must permanently close admission`);
        metricTools.assertDeltaFrom(postResultBaseline, { createThreadCalls: 0 },
          `${mode} recovery replay`);
        await composed.host.drain();
        metricTools.assertDeltaFrom(postResultBaseline, { createThreadCalls: 0 },
          `${mode} retained callback must not perform a later effect`);
        const records = await runtimeRecords();
        if (["outer-double", "guard-double", "guard-substitute", "outer-substitute"].includes(mode)) {
          assert.equal(records.length, 1);
          assert.equal(records[0].phase, "quarantined");
          assert.equal(records[0].quarantineReason, "host-invalid");
        } else {
          assert.equal(records.length, 0);
        }
        results[mode] = { createCalls: metricTools.deltaFrom(scenarioBaseline).createThreadCalls,
          phases: records.map(record => record.phase) };
        await completeObservation(results[mode]);
      }
      for (const mode of ["outer-retained-after", "guard-retained-after"]) {
        await clearFixture();
        const scenarioBaseline = metricTools.baseline();
        const completeObservation = await beginObservation(mode);
        const item = request({ operationId: `host_${mode.replaceAll("-", "_")}` });
        const composed = composition({ prefix: `host_${mode.replaceAll("-", "_")}`, hostMode: mode });
        const result = await composed.service.prepare(item, context);
        assert.equal(result.code, "prepared", mode);
        const postResultBaseline = metricTools.baseline();
        await composed.host.drain();
        metricTools.assertDeltaFrom(postResultBaseline, { createThreadCalls: 0 },
          `${mode} late callback must not perform another effect`);
        const replay = await composed.service.prepare(item, context);
        assert.equal(replay.code, "prepared");
        assert.equal(replay.replayed, true);
        const records = await runtimeRecords();
        assert.equal(records.length, 1);
        assert.equal(records[0].phase, "thread-prepared");
        results[mode] = { createCalls: metricTools.deltaFrom(scenarioBaseline).createThreadCalls,
          lateCallbackRejected: true, replayed: true,
          phases: records.map(record => record.phase) };
        await completeObservation(results[mode]);
      }
      return results;
    });

    await check(CASE_NAMES[7], async (beginObservation, metricTools) => {
      const results = {};

      await clearFixture();
      const completeReservedObservation = await beginObservation("reserved-interruption");
      let interrupt = true;
      const resumable = composition({ prefix: "reserved_interrupt", receiptPort: base => portProxy(base, {
        beginThreadCreation: (...args) => {
          if (interrupt) {
            interrupt = false;
            return Promise.resolve({ code: "unavailable" });
          }
          return base.beginThreadCreation(...args);
        },
      }) });
      const resumableItem = request({ operationId: "reserved-interrupt" });
      assert.deepEqual(await resumable.service.prepare(resumableItem, context),
        { code: "recovery-required" });
      assert.equal((await runtimeRecords())[0].phase, "reserved");
      const resumed = await resumable.service.prepare(resumableItem, context);
      assert.equal(resumed.code, "prepared");
      results.reservedInterruption = { first: "recovery-required", second: resumed.code };
      await completeReservedObservation(results.reservedInterruption);

      async function uncertainScenario(label, options, before = null) {
        await clearFixture();
        const completeObservation = await beginObservation(label);
        const prefix = `effect_${label}`;
        const item = request({ operationId: `effect_${label}` });
        const composed = composition({ prefix, ...options });
        if (before) await before(composed, item);
        const result = await composed.service.prepare(item, context);
        assert.deepEqual(result, { code: "recovery-required" }, label);
        const records = await runtimeRecords();
        assert.equal(records.length, 1);
        assert.equal(records[0].phase, "quarantined");
        assert.equal(records[0].quarantineReason, "effect-uncertain");
        results[label] = { threadRows: await countRows("chat_threads"), phase: records[0].phase };
        await completeObservation(results[label]);
      }

      await uncertainScenario("before_native", {
        createThreadEffect: async () => { throw new Error("fixture crash before Native call"); },
      });
      await uncertainScenario("lost_native_reply", {
        createThreadEffect: async (...args) => {
          await nativeCreateThread(...args);
          throw new Error("fixture lost successful Native reply");
        },
      });

      await clearFixture();
      const earlyReturnBaseline = metricTools.baseline();
      const completeEarlyReturnObservation = await beginObservation("early_after_native_write");
      const nativeWriteComplete = deferred();
      const allowHostReturn = deferred();
      const releaseNativeReply = deferred();
      let hostCallback;
      const delayedHost = Object.freeze({
        host: Object.freeze({
          async withCreationScope(scope, enter) {
            metrics.scopeCalls += 1;
            assert.deepEqual(Object.keys(scope).sort(), ["collectionId", "deviceId"]);
            const guard = Object.freeze({
              async executeOnce(_admission, invoke) {
                metrics.guardCalls += 1;
                return invoke();
              },
            });
            hostCallback = trackPending(Promise.resolve().then(() => enter(guard)));
            await nativeWriteComplete.promise;
            await allowHostReturn.promise;
            return {};
          },
        }),
        async drain() { if (hostCallback) await hostCallback.catch(() => undefined); },
      });
      const delayedItem = request({ operationId: "effect_early_after_native_write" });
      const delayed = composition({
        prefix: "effect_early_after_native_write",
        hostFixtureValue: delayedHost,
        createThreadEffect: async (...args) => {
          const thread = await nativeCreateThread(...args);
          nativeWriteComplete.resolve();
          await releaseNativeReply.promise;
          return thread;
        },
      });
      const pendingPrepare = delayed.service.prepare(delayedItem, context);
      await nativeWriteComplete.promise;
      const creatingRecord = (await runtimeRecords())[0];
      assert.equal(creatingRecord.phase, "creating-thread");
      assert.equal(await countRows("chat_threads"), 1);
      metricTools.assertDeltaFrom(earlyReturnBaseline, { createThreadCalls: 1 },
        "early return after Native write");
      allowHostReturn.resolve();
      assert.deepEqual(await pendingPrepare, { code: "recovery-required" });
      const quarantinedBeforeReply = (await runtimeRecords())[0];
      assert.equal(quarantinedBeforeReply.phase, "quarantined");
      assert.equal(quarantinedBeforeReply.quarantineReason, "host-invalid");
      assert.equal(quarantinedBeforeReply.settlement, null);
      releaseNativeReply.resolve();
      await delayed.host.drain();
      const quarantinedAfterReply = (await runtimeRecords())[0];
      assert.equal(quarantinedAfterReply.phase, "quarantined");
      assert.equal(quarantinedAfterReply.quarantineReason, "host-invalid");
      assert.equal(quarantinedAfterReply.settlement, null);
      assert.equal(await countRows("chat_threads"), 1);
      metricTools.assertDeltaFrom(earlyReturnBaseline, { createThreadCalls: 1 },
        "late Native reply");
      assert.deepEqual(await delayed.service.prepare(delayedItem, context),
        { code: "recovery-required" });
      metricTools.assertDeltaFrom(earlyReturnBaseline, { createThreadCalls: 1 },
        "early-return replay");
      results.earlyAfterNativeWrite = {
        phases: [creatingRecord.phase, quarantinedBeforeReply.phase, quarantinedAfterReply.phase],
        adapterAttempts: 1,
        threadRows: 1,
        lateSuccessfulReplyIgnored: true,
        replay: "recovery-required",
      };
      await completeEarlyReturnObservation(results.earlyAfterNativeWrite);

      await uncertainScenario("id_collision", {}, async composed => {
        await nativeCreateThread(context.userEmail, { id: composed.ids.id("native-thread"),
          title: "preexisting collision", scope: { type: "foreign", id: "foreign" },
          orgId: context.orgId });
      });
      await uncertainScenario("mismatched_return", {
        createThreadEffect: async (...args) => ({ ...await nativeCreateThread(...args), id: "wrong_thread" }),
      });
      await uncertainScenario("candidate_failure", {
        receiptPort: base => portProxy(base, {
          recordThreadCandidate: async () => ({ code: "unavailable" }),
        }),
      });
      await uncertainScenario("candidate_lost_reply", {
        receiptPort: base => portProxy(base, {
          recordThreadCandidate: async (...args) => {
            await base.recordThreadCandidate(...args);
            throw new Error("fixture lost candidate write reply");
          },
        }),
      });
      return results;
    });

    await check(CASE_NAMES[8], async (beginObservation, metricTools) => {
      const results = {};
      for (const mode of ["settlement_failure", "settlement_lost_reply"]) {
        await clearFixture();
        const completeObservation = await beginObservation(mode);
        const item = request({ operationId: mode });
        const composed = composition({ prefix: mode, receiptPort: base => portProxy(base, {
          verifySettlement: mode === "settlement_failure"
            ? async () => ({ code: "unavailable" })
            : async (...args) => {
              await base.verifySettlement(...args);
              throw new Error("fixture lost settlement reply");
            },
        }) });
        assert.deepEqual(await composed.service.prepare(item, context),
          { code: "recovery-required" });
        const [record] = await runtimeRecords();
        assert.equal(record.phase, "quarantined");
        assert.equal(record.quarantineReason, "settlement-uncertain");
        results[mode] = record.phase;
        await completeObservation(results[mode]);
      }

      await clearFixture();
      const failedQuarantineBaseline = metricTools.baseline();
      const completeFailedQuarantineObservation = await beginObservation("failed-quarantine");
      let reserveObserved;
      const reserveSeen = new Promise(resolve => { reserveObserved = resolve; });
      let releaseBegin;
      const beginRelease = new Promise(resolve => { releaseBegin = resolve; });
      let factsBObserved;
      const factsBSeen = new Promise(resolve => { factsBObserved = resolve; });
      let releaseFactsB;
      const factsBRelease = new Promise(resolve => { releaseFactsB = resolve; });
      let hostPending;
      const earlyAfterReserve = Object.freeze({
        host: Object.freeze({
          async withCreationScope(_scope, enter) {
            metrics.scopeCalls += 1;
            const guard = Object.freeze({
              async executeOnce(_admission, invoke) {
                metrics.guardCalls += 1;
                return invoke();
              },
            });
            hostPending = trackPending(enter(guard));
            hostPending.catch(() => {});
            await reserveSeen;
            return {};
          },
        }),
        async drain() {
          releaseBegin();
          await hostPending.catch(() => undefined);
        },
      });
      const composed = composition({ prefix: "failed_quarantine", hostFixtureValue: earlyAfterReserve,
        resolveFactsEffect: async (_call, requestValue, current) => {
          if (requestValue.operationId === "gate-waiting-b") {
            factsBObserved();
            await factsBRelease;
          }
          return current;
        },
        receiptPort: base => portProxy(base, {
          reserve: async (...args) => {
            const result = await base.reserve(...args);
            reserveObserved();
            return result;
          },
          beginThreadCreation: async () => {
            await beginRelease;
            return { code: "unavailable" };
          },
          quarantine: async () => ({ code: "unavailable" }),
        }) });
      const item = request({ operationId: "failed-quarantine-reserved" });
      const waitingItem = request({ operationId: "gate-waiting-b" });
      const waitingPromise = composed.service.prepare(waitingItem, context);
      await factsBSeen;
      assert.deepEqual(await composed.service.prepare(item, context), { code: "recovery-required" });
      assert.equal((await runtimeRecords())[0].phase, "reserved");
      releaseFactsB();
      assert.deepEqual(await waitingPromise, { code: "recovery-required" });
      assert.deepEqual(await composed.service.prepare(item, context), { code: "recovery-required" });
      assert.deepEqual(await composed.service.prepare(waitingItem, context), { code: "recovery-required" });
      metricTools.assertDeltaFrom(failedQuarantineBaseline,
        { createThreadCalls: 0, scopeCalls: 1 }, "failed quarantine");
      await earlyAfterReserve.drain();
      assert.equal((await runtimeRecords())[0].phase, "reserved");
      results.failedQuarantine = { durablePhase: "reserved", replay: "recovery-required",
        waitingOperation: "recovery-required", waitingHostAdmissions: 0,
        admissionReopened: false };
      await completeFailedQuarantineObservation(results.failedQuarantine);

      await clearFixture();
      const completeFinalReadObservation = await beginObservation("closure-during-final-read");
      let closeNextScope = false;
      const closingHost = {
        host: {
          async withCreationScope(_scope, enter) {
            metrics.scopeCalls += 1;
            if (closeNextScope) return {};
            return enter({
              async executeOnce(_admission, invoke) {
                metrics.guardCalls += 1;
                return invoke();
              },
            });
          },
        },
        async drain() {},
      };
      let finalReadObserved;
      const finalReadSeen = new Promise(resolve => { finalReadObserved = resolve; });
      let releaseFinalRead;
      const finalReadRelease = new Promise(resolve => { releaseFinalRead = resolve; });
      let preparedThreadReads = 0;
      const finalReadComposition = composition({ prefix: "gate_final_read",
        hostFixtureValue: closingHost,
        getThreadEffect: async (...args) => {
          preparedThreadReads += 1;
          if (preparedThreadReads === 2) {
            finalReadObserved();
            await finalReadRelease;
          }
          return nativeGetThread(...args);
        } });
      const finalReadItem = request({ operationId: "gate-final-read-b" });
      const finalReadPromise = finalReadComposition.service.prepare(finalReadItem, context);
      await finalReadSeen;
      closeNextScope = true;
      const invalidatingItem = request({ operationId: "gate-final-read-a" });
      assert.deepEqual(await finalReadComposition.service.prepare(invalidatingItem, context),
        { code: "recovery-required" });
      releaseFinalRead();
      assert.deepEqual(await finalReadPromise, { code: "recovery-required" });
      const [preparedAfterClosure] = await runtimeRecords();
      assert.equal(preparedAfterClosure.operationId, finalReadItem.operationId);
      assert.equal(preparedAfterClosure.phase, "thread-prepared");
      assert.deepEqual(await finalReadComposition.service.prepare(finalReadItem, context),
        { code: "recovery-required" });
      results.closureDuringFinalRead = { durablePhase: preparedAfterClosure.phase,
        returned: "recovery-required", additionalNativeEffects: 0 };
      await completeFinalReadObservation(results.closureDuringFinalRead);
      return results;
    });

    await check(CASE_NAMES[9], async (beginObservation, metricTools) => {
      const results = {};
      for (const phase of ["reserved", "thread-candidate", "thread-prepared"]) {
        await clearFixture();
        const completeObservation = await beginObservation(phase);
        const oldPrefix = `foreign_old_${phase}`;
        const item = request({ operationId: `foreign_${phase}` });
        const seeded = await seedReserved(oldPrefix, item);
        if (phase !== "reserved") {
          const creating = await seeded.port.beginThreadCreation(seeded.intent,
            `${oldPrefix}_attempt`);
          assert.equal(creating.code, "changed");
          const candidate = await seeded.port.recordThreadCandidate(seeded.intent,
            `${oldPrefix}_attempt`);
          assert.equal(candidate.code, "changed");
          if (phase === "thread-prepared") {
            assert.equal((await seeded.port.verifySettlement(seeded.intent,
              `${oldPrefix}_attempt`)).code, "changed");
          }
        }
        const restarted = composition({ prefix: `foreign_new_${phase}` });
        assert.deepEqual(await restarted.service.prepare(item, context),
          { code: "recovery-required" });
        const [record] = await runtimeRecords();
        assert.equal(record.phase, "quarantined");
        assert.equal(record.quarantineReason, "foreign-incarnation");
        results[phase] = record.phase;
        const observation = await completeObservation(results[phase]);
        assert.equal(observation.metrics.createThreadCalls, 0,
          `${phase} foreign-incarnation refusal adapter calls`);
      }

      await clearFixture();
      const pendingBaseline = metricTools.baseline();
      const completePendingObservation = await beginObservation("pending-old-cas");
      const item = request({ operationId: "foreign-pending-cas" });
      const old = await seedReserved("foreign_pending_old", item);
      assert.equal((await old.port.beginThreadCreation(old.intent, "foreign_pending_attempt")).code,
        "changed");
      const restarted = composition({ prefix: "foreign_pending_new" });
      assert.deepEqual(await restarted.service.prepare(item, context),
        { code: "recovery-required" });
      const lateCandidate = await old.port.recordThreadCandidate(old.intent, "foreign_pending_attempt");
      assert.equal(lateCandidate.code, "phase");
      const [record] = await runtimeRecords();
      assert.equal(record.phase, "quarantined");
      assert.equal(record.quarantineReason, "foreign-incarnation");
      results.pendingOldCas = { result: lateCandidate.code, durablePhase: record.phase };
      await completePendingObservation(results.pendingOldCas);
      metricTools.assertDeltaFrom(pendingBaseline, { createThreadCalls: 0 },
        "pending old CAS");
      assert.equal(metrics.createThreadCalls, 0,
        "foreign-incarnation case total createThreadCalls");
      return results;
    });

    await check(CASE_NAMES[10], async () => {
      const composed = composition({ prefix: "native_replay" });
      const deletedItem = request({ operationId: "native-deleted" });
      const deletedPrepared = await composed.service.prepare(deletedItem, context);
      assert.equal(deletedPrepared.code, "prepared");
      const deletedRecord = (await runtimeRecords()).find(record => record.operationId === "native-deleted");
      await getDbExec().execute({ sql: "DELETE FROM chat_threads WHERE id = ?",
        args: [deletedRecord.nativeThreadId] });
      assert.deepEqual(await composed.service.prepare(deletedItem, context),
        { code: "recovery-required" });

      const changedItem = request({ operationId: "native-scope-changed" });
      const changedPrepared = await composed.service.prepare(changedItem, context);
      assert.equal(changedPrepared.code, "prepared");
      const changedRecord = (await runtimeRecords())
        .find(record => record.operationId === "native-scope-changed");
      await getDbExec().execute({ sql: "UPDATE chat_threads SET scope_id = ? WHERE id = ?",
        args: ["mutated-scope", changedRecord.nativeThreadId] });
      assert.deepEqual(await composed.service.prepare(changedItem, context),
        { code: "recovery-required" });
      const final = await runtimeRecords();
      for (const operationId of ["native-deleted", "native-scope-changed"]) {
        const record = final.find(candidate => candidate.operationId === operationId);
        assert.equal(record.phase, "quarantined");
        assert.equal(record.quarantineReason, "settlement-uncertain");
      }
      assert.equal(metrics.createThreadCalls, 2);
      return { deletionReplay: "recovery-required", scopeMutationReplay: "recovery-required",
        phases: final.map(record => record.phase) };
    });

    await check(CASE_NAMES[11], async beginObservation => {
      const results = {};
      await clearFixture();
      const completeMissingObservation = await beginObservation("missing");
      const missingItem = request({ operationId: "cancel-missing" });
      const missing = composition({ prefix: "cancel_missing" });
      assert.deepEqual(await missing.service.cancelPreparation(cancelRequest(missingItem), context),
        { code: "cancelled-before-create" });
      assert.equal((await runtimeRecords()).length, 0);
      results.missing = "cancelled-before-create";
      await completeMissingObservation(results.missing);

      await clearFixture();
      const completeReservedObservation = await beginObservation("reserved");
      const reservedItem = request({ operationId: "cancel-reserved" });
      await seedReserved("cancel_reserved", reservedItem);
      const reserved = composition({ prefix: "cancel_reserved" });
      assert.deepEqual(await reserved.service.cancelPreparation(cancelRequest(reservedItem), context),
        { code: "cancelled-before-create" });
      assert.equal((await runtimeRecords())[0].phase, "cancelled-before-create");
      assert.deepEqual(await reserved.service.prepare(reservedItem, context),
        { code: "cancelled-before-create" });
      results.cancelFirst = "cancelled-before-create";
      await completeReservedObservation(results.cancelFirst);

      await clearFixture();
      const completePreparedObservation = await beginObservation("prepared");
      const preparedItem = request({ operationId: "cancel-prepared" });
      const prepared = composition({ prefix: "cancel_prepared" });
      assert.equal((await prepared.service.prepare(preparedItem, context)).code, "prepared");
      assert.deepEqual(await prepared.service.cancelPreparation(cancelRequest(preparedItem), context),
        { code: "already-prepared" });
      assert.equal((await runtimeRecords())[0].phase, "thread-prepared");
      results.createFirst = "already-prepared";
      await completePreparedObservation(results.createFirst);

      await clearFixture();
      const completeRaceObservation = await beginObservation("cancel-versus-create");
      let markEntered;
      const entered = new Promise(resolve => { markEntered = resolve; });
      let releaseGuard;
      const guardRelease = new Promise(resolve => { releaseGuard = resolve; });
      const raceHost = {
        host: {
          async withCreationScope(_scope, enter) {
            metrics.scopeCalls += 1;
            return enter({
              async executeOnce(_admission, invoke) {
                metrics.guardCalls += 1;
                markEntered();
                await guardRelease;
                return invoke();
              },
            });
          },
        },
        async drain() {},
      };
      const raceItem = request({ operationId: "cancel-versus-create" });
      const race = composition({ prefix: "cancel_race", hostFixtureValue: raceHost });
      const createPromise = race.service.prepare(raceItem, context);
      await entered;
      const cancellationLost = await race.service.cancelPreparation(cancelRequest(raceItem), context);
      releaseGuard();
      const creationWon = await createPromise;
      assert.deepEqual(cancellationLost, { code: "recovery-required" });
      assert.equal(creationWon.code, "prepared");
      assert.equal((await runtimeRecords())[0].phase, "thread-prepared");
      results.versusCreate = { cancellation: cancellationLost.code, creation: creationWon.code };
      await completeRaceObservation(results.versusCreate);

      await clearFixture();
      const completeUncertainObservation = await beginObservation("uncertain-create");
      const uncertainItem = request({ operationId: "cancel-uncertain" });
      const uncertain = composition({ prefix: "cancel_uncertain",
        createThreadEffect: async (...args) => {
          await nativeCreateThread(...args);
          throw new Error("fixture lost successful Native reply");
        } });
      assert.deepEqual(await uncertain.service.prepare(uncertainItem, context),
        { code: "recovery-required" });
      assert.deepEqual(await uncertain.service.cancelPreparation(cancelRequest(uncertainItem), context),
        { code: "recovery-required" });
      assert.equal((await runtimeRecords())[0].phase, "quarantined");
      results.afterUncertainCreate = "recovery-required";
      await completeUncertainObservation(results.afterUncertainCreate);
      return results;
    });

    await check(CASE_NAMES[12], async () => {
      const sharedOperationId = "shared-namespace-operation";
      const preparation = composition({ prefix: "namespace" });
      assert.equal((await preparation.service.prepare(
        request({ operationId: sharedOperationId }), context)).code, "prepared");

      const creationRequest = { operationId: sharedOperationId, parentRef: "parent-a",
        childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
        expectedPolicyRevision: 7 };
      const creationAuthority = { actorId: identity().actorId,
        collectionId: identity().collectionId, deviceId: identity().deviceId,
        policyRevision: 7, member: true, capabilities: ["create-child"],
        creatableParents: ["parent-a"] };
      const creationHost = hostFixture("normal");
      const creation = createCreationReceiptStore({
        resolveFacts: async () => creationAuthority,
        resolveNamespace: async () => ({ parentRef: "parent-a", namespaceKey: "namespace-a",
          childKey: "child-example", stageId: "stage-a", continuityId: "continuity-a",
          exclusiveControl: true }),
        creationHost: creationHost.host,
      });
      assert.equal((await creation.prepare(creationRequest)).output.code, "preparing");
      assert.equal((await creation.read(creationRequest)).output.code, "preparing");

      const fixture = JSON.parse(await readFile(new URL(
        "../../../docs/product/multi-project/fixtures/project-registry.json", import.meta.url,
      ), "utf8"));
      const registryFactFields = ["actorId", "collectionId", "deviceId", "member", "capabilities",
        "rootAccess", "policyRevision", "root", "overlapSafe"];
      const registryFacts = Object.fromEntries(registryFactFields
        .map(key => [key, fixture.inputs.register.trusted[key]]));
      Object.assign(registryFacts, { actorId: identity().actorId,
        collectionId: identity().collectionId, deviceId: identity().deviceId });
      const registry = createRegistryStore({ resolveFacts: async () => registryFacts,
        allocateIds: async () => ({ projectId: "namespace-project", bindingId: "namespace-binding" }),
        evaluate: evaluateRegistryOperation });
      const registrationRequest = { ...fixture.inputs.register.request,
        operationId: sharedOperationId, expectedRegistryRevision: 0 };
      const registered = await registry.register(registrationRequest);
      assert.equal(registered.output.code, "registered");
      const replayedRegistration = await registry.register(registrationRequest);
      assert.equal(replayedRegistration.output.code, "registered");
      assert.equal(replayedRegistration.output.replayed, true);

      const rows = await receiptRows();
      assert.deepEqual(rows.map(row => row.operation).sort(),
        ["create", "register", "runtime-prepare"]);
      assert.ok(rows.every(row => row.operation_id === sharedOperationId));
      const runtimeRow = rows.find(row => row.operation === "runtime-prepare");
      const registrationRow = rows.find(row => row.operation === "register");
      const creationRow = rows.find(row => row.operation === "create");
      for (const row of [runtimeRow, registrationRow]) {
        assert.equal(row.creation_namespace_key, null);
        assert.equal(row.creation_child_key, null);
        assert.equal(row.creation_phase, null);
      }
      assert.equal(creationRow.creation_phase, "preparing");
      assert.ok(creationRow.creation_namespace_key);
      assert.ok(creationRow.creation_child_key);
      return { operations: rows.map(row => row.operation).sort(), repeatedOperationId: true,
        registrationReplay: true, creationRead: "preparing", nullCreationColumns: true };
    });
  } finally {
    await Promise.allSettled([...pendingCallbacks]);
    await clearFixture().catch(() => undefined);
    await closeDbExec();
  }
  assert.equal(pendingCallbacks.size, 0);
  assert.equal(witness.cases.length, CASE_NAMES.length);
  const witnessLine = `PREPARATION_STATE_WITNESS ${canonicalJson(witness)}`;
  assert.ok(Buffer.byteLength(witnessLine, "utf8") <= 900 * 1024);
  process.stdout.write(`${witnessLine}\n`);
  process.stdout.write("WORKER_CLEANUP databaseClosed=true pendingCallbacks=0 globalsRestored=true\n");
  process.stdout.write("PASS runtime preparation worker cleanup\n");
}

if (process.env.VIVARY_RUNTIME_PREPARATION_WORKER === "1") { // guard:allow-env-credential - Test child mode flag.
  try { await worker(); }
  catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  }
} else {
  test("project runtime preparation records one exact Native thread intent", async () => {
    const configured = process.env.VIVARY_REGISTRY_PROOF_ROOT; // guard:allow-env-credential - Disposable proof directory.
    assert.ok(configured && path.isAbsolute(configured), "explicit absolute proof root required");
    const proofRoot = await realpath(configured);
    const caseRoot = await mkdtemp(path.join(proofRoot, "runtime-preparation-"));
    assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
    const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
      "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"];
    const env = Object.fromEntries(retained.filter(key => process.env[key]) // guard:allow-env-credential - Fixed OS launch paths.
      .map(key => [key, process.env[key]])); // guard:allow-env-credential - Fixed OS launch paths.
    Object.assign(env, { VIVARY_RUNTIME_PREPARATION_WORKER: "1",
      VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential - Reviewed package manifest path.
      NODE_ENV: "test", DATABASE_URL: `file:${path.join(caseRoot, "registry.sqlite")}`,
      AGENT_NATIVE_DISABLED_PLUGINS: "agent-chat,auth,context-xray,core-routes,integrations,observational-memory,onboarding,org,resources,sentry,terminal" });
    try {
      const result = spawnSync(process.execPath, ["--max-old-space-size=192", TEST_FILE], {
        cwd: caseRoot, env, windowsHide: true, encoding: "utf8", timeout: 90_000,
        maxBuffer: 1024 * 1024,
      });
      const diagnostic = `stdout tail:\n${boundedDiagnostic(result.stdout)}\n`
        + `stderr tail:\n${boundedDiagnostic(result.stderr)}`;
      assert.equal(result.error, undefined, `${result.error?.message ?? ""}\n${diagnostic}`);
      assert.equal(result.signal, null, diagnostic);
      assert.equal(result.status, 0, diagnostic);
      assertWorkerEvidence(result.stdout);
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      process.stdout.write("WORKER_NATURAL_EXIT code=0 signal=none timeoutMs=90000\n");
    } finally {
      assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
      await rm(caseRoot, { recursive: true, force: true });
    }
  });
}
