import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createRequire, register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const TEST_FILE = fileURLToPath(import.meta.url);
const NATIVE_TABLE_NAMES = Object.freeze([
  "agent_harness_sessions", "agent_run_events", "agent_runs", "chat_threads",
  "organizations", "org_members", "sessions", "settings",
  "app_member_roles", "vivary_registry_bindings", "vivary_registry_projects",
  "vivary_registry_receipts", "vivary_registry_revisions",
].sort());
const REFUSAL_VARIANTS = Object.freeze([
  "unconfigured", "unauthenticated", "revoked-role", "duplicate-query", "foreign-query", "noncanonical-revision",
  "wrong-route", "wrong-method", "project-substitution", "missing-reference", "array-reference", "extra-reference-field",
  "zero-reference-revision", "wrong-identity", "wrong-thread", "wrong-session", "wrong-run", "wrong-harness",
  "stale-scopeKey", "stale-expectedBindingRevision", "stale-expectedPolicyRevision", "wrong-runtime",
  "thread-scope", "session-org", "foreign-owner", "thread-association", "reference-drift", "session-drift",
  "runtime-runtimeVersion", "runtime-executionLocation", "runtime-authorityContract", "root-drift", "root-prechanged",
  "registry-drift", "authority-drift", "fixture-count-exact", "fixture-count-over", "fixture-bytes-exact",
  "fixture-bytes-over", "item-count-over", "item-bytes-over", "response-bytes-over", "ambiguous-binding",
]);
const INJECTION_CONTRACTS = Object.freeze({
  "session-drift": { label: "replace-session-harness", table: "agent_harness_sessions" },
  "registry-drift": { label: "advance-registry-revision", table: "vivary_registry_revisions" },
  "authority-drift": { label: "revoke-current-authority", table: "app_member_roles" },
});
const ACCEPTED_NATIVE_READ_NAMES = Object.freeze([
  "exact-reference", "item-count-boundary", "item-bytes-boundary", "response-bytes-boundary",
]);

function assertWorkerEvidence(stdout, expectedCases) {
  const lines = stdout.split(/\r?\n/);
  const starts = lines.filter(line => line.startsWith("START ")).map(line => line.slice(6));
  const passes = lines.filter(line => line.startsWith("PASS ")
    && line !== "PASS runtime activity worker cleanup").map(line => line.slice(5));
  assert.equal(starts.length, expectedCases);
  assert.deepEqual(passes, starts);
  assert.equal(lines.filter(line => line === "PASS runtime activity worker cleanup").length, 1);
  const timerEvidence = lines.filter(line => line.startsWith("NATIVE_TIMER_CLEANUP "));
  assert.equal(timerEvidence.length, 1);
  const timerMatch = /^NATIVE_TIMER_CLEANUP seededRuns=(\d+) finalizedRuns=(\d+) timersCleared=(\d+) pending=0 globalsRestored=true$/
    .exec(timerEvidence[0]);
  assert.ok(timerMatch && Number(timerMatch[1]) > 0);
  assert.equal(Number(timerMatch[2]), Number(timerMatch[1]));
  assert.equal(Number(timerMatch[3]), Number(timerMatch[1]));
  const stateEvidence = lines.filter(line => line.startsWith("NATIVE_STATE_WITNESS "));
  assert.equal(stateEvidence.length, 1);
  assert.ok(Buffer.byteLength(stateEvidence[0], "utf8") <= 1024 * 1024);
  const witness = JSON.parse(stateEvidence[0].slice("NATIVE_STATE_WITNESS ".length));
  assert.equal(witness.schemaVersion, 2);
  assert.deepEqual(witness.requiredTableNames, [...NATIVE_TABLE_NAMES]);
  assert.deepEqual(witness.reads.map(read => read.name), [...ACCEPTED_NATIVE_READ_NAMES]);
  assert.ok(witness.snapshots && Object.keys(witness.snapshots).length > 0);
  const witnessedTables = new Set(Object.values(witness.snapshots).flatMap(snapshot => Object.keys(snapshot.tables)));
  for (const name of NATIVE_TABLE_NAMES) assert.ok(witnessedTables.has(name), `missing table witness: ${name}`);
  for (const [snapshotHash, snapshot] of Object.entries(witness.snapshots)) {
    assert.match(snapshotHash, /^[0-9a-f]{64}$/);
    assert.deepEqual(snapshot.tables.settings.columns, ["key", "updated_at", "value"]);
    for (const tableName of Object.keys(snapshot.tables)) {
      const table = snapshot.tables[tableName];
      assert.ok(Array.isArray(table.columns) && table.columns.length > 0);
      assert.deepEqual(table.columns, [...new Set(table.columns)].sort());
      assert.ok(Number.isInteger(table.rowCount) && table.rowCount >= 0);
      assert.match(table.sha256, /^[0-9a-f]{64}$/);
    }
  }
  for (const read of witness.reads) {
    assert.match(read.before, /^[0-9a-f]{64}$/);
    assert.equal(read.after, read.before);
    assert.equal(read.same, true);
    assert.ok(witness.snapshots[read.before]);
  }
  assert.deepEqual(witness.refusals.map(item => item.variant), [...REFUSAL_VARIANTS]);
  for (const refusal of witness.refusals) {
    assert.ok(starts.includes(refusal.caseName));
    assert.match(refusal.requestDigest, /^[0-9a-f]{64}$/);
    assert.match(refusal.responseBodyHash, /^[0-9a-f]{64}$/);
    assert.ok(witness.snapshots[refusal.before] && witness.snapshots[refusal.after]);
    assert.equal(refusal.disclosure, refusal.responseCode ? "code-only" : "exact-transport-error");
    const injectionContract = INJECTION_CONTRACTS[refusal.variant];
    if (!injectionContract) {
      assert.equal(refusal.injections.length, 0);
      assert.equal(refusal.before, refusal.after);
    } else {
      assert.equal(refusal.injections.length, 1);
      const injection = refusal.injections[0];
      assert.equal(injection.label, injectionContract.label);
      assert.equal(injection.allowedTable, injectionContract.table);
      assert.equal(refusal.before, injection.before);
      assert.equal(refusal.after, injection.after);
      assert.notEqual(injection.before, injection.after);
      assert.ok(witness.snapshots[injection.before] && witness.snapshots[injection.after]);
      assert.equal(injection.changedRows.length, 1);
      assert.equal(injection.allowedIdentityDigest, refusal.expectedInjectionIdentityDigest);
      assert.equal(injection.changedRows[0].identityDigest, refusal.expectedInjectionIdentityDigest);
      assert.ok(injection.changedRows[0].changedColumns.every(name => injection.allowedColumns.includes(name)));
    }
    assert.equal(refusal.actionSegmentsUnchanged, true);
    if (refusal.beforeNativeAccess) {
      assert.equal(refusal.counters.resolveReference, 0);
      assert.equal(refusal.counters.verifyFixtureBudget, 0);
      assert.deepEqual(refusal.counters.nativeReads, []);
    }
  }
}

async function worker() {
  register(new URL("./native-http-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential - Reviewed package manifest path.
  });
  const { createHash, randomUUID } = await import("node:crypto");
  const {
    ensureAgentHarnessSessionTables,
    startAgentHarnessRun,
    updateAgentHarnessSession,
  } = await import("@agent-native/core/agent/harness");
  const { closeDbExec, getDbExec, runMigrations, withMigrationRuntime } = await import("@agent-native/core/db");
  const { and, eq } = await import("@agent-native/core/db/schema");
  const { ORG_MIGRATIONS, organizations, orgMembers, setAppMemberRole } = await import("@agent-native/core/org");
  const requireCore = createRequire(process.env.VIVARY_TEST_CORE_PACKAGE_JSON); // guard:allow-env-credential - Same reviewed manifest as dependency loader.
  const { getAllSettings } = await import(pathToFileURL(requireCore.resolve("@agent-native/core/settings")).href);
  const {
    addSession,
    awaitBootstrap,
    createThread,
    getThread,
    removeSession,
    setThreadScope,
  } = await import("@agent-native/core/server");
  const { H3 } = await import("h3");
  const { getDb } = await import("../server/db/index.mjs");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const tables = await import("../server/db/schema.mjs");
  const { createNativeRegistry, createNativeRegistryAuth } = await import("../server/native-registry.mjs");
  const { createProjectRuntimeActivity, mountProjectRuntimeActivity } =
    await import("../server/project-runtime-activity.mjs");

  const nativeRetentionMs = 5 * 60 * 1000;
  const originalSetTimeoutDescriptor = Object.getOwnPropertyDescriptor(globalThis, "setTimeout");
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const ownedNativeRetentionTimers = new Map();
  let trackedNativeRunId = null;
  let seededNativeRunCount = 0;
  let finalizedNativeRunCount = 0;
  let clearedNativeRetentionTimerCount = 0;
  Object.defineProperty(globalThis, "setTimeout", {
    ...originalSetTimeoutDescriptor,
    value(callback, delay, ...args) {
      const handle = Reflect.apply(originalSetTimeout, globalThis, [callback, delay, ...args]);
      if (trackedNativeRunId !== null && delay === nativeRetentionMs) {
        ownedNativeRetentionTimers.set(handle, trackedNativeRunId);
      }
      return handle;
    },
  });
  const clearOwnedNativeRetentionTimers = runId => {
    let cleared = 0;
    for (const [handle, ownerRunId] of ownedNativeRetentionTimers) {
      if (runId !== undefined && ownerRunId !== runId) continue;
      Reflect.apply(originalClearTimeout, globalThis, [handle]);
      ownedNativeRetentionTimers.delete(handle);
      cleared += 1;
    }
    clearedNativeRetentionTimerCount += cleared;
    return cleared;
  };

  const email = "runtime-activity@example.test";
  const otherEmail = "other-runtime-activity@example.test";
  const grant = Object.freeze({ orgId: "runtime-activity-org", collectionId: "runtime-activity-collection",
    policyRevision: 7, locationRefs: ["primary", "alternate"] });
  const context = Object.freeze({ userEmail: email, orgId: grant.orgId, appId: "workbench", caller: "frontend" });
  const token = randomUUID();
  const harnessName = "synthetic-activity-harness";
  const runtimeIdentity = Object.freeze({ harnessName, runtimeVersion: "synthetic-v1",
    executionLocation: "synthetic-habitat", configurationRevision: 3,
    authorityContract: "synthetic-project-runner-v1" });
  const roots = new Map([
    ["primary", { code: "available", locationRef: "primary", rootId: "synthetic-root-primary",
      contentRevision: "synthetic-content-1" }],
    ["alternate", { code: "available", locationRef: "alternate", rootId: "synthetic-root-alternate",
      contentRevision: "synthetic-content-1" }],
  ]);
  let inspectCalls = 0;
  let inspectEffect = null;
  const provider = Object.freeze({
    deviceId: "runtime-activity-device",
    locationRefs: Object.freeze([...roots.keys()]),
    observe: async locationRef => {
      const root = roots.get(locationRef);
      return root ? { ...root, code: "observed" } : { code: "unavailable" };
    },
    inspect: async locationRef => {
      inspectCalls += 1;
      if (inspectEffect) await inspectEffect(inspectCalls, locationRef);
      return structuredClone(roots.get(locationRef) ?? { code: "unavailable" });
    },
  });
  const nativeReads = [];
  globalThis[Symbol.for("vivary.runtimeActivityNativeReads")] = name => nativeReads.push(name);
  const digest = value => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
  const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const canonicalValue = value => {
    if (typeof value === "bigint") return { $bigint: String(value) };
    if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("hex") };
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => lexicalCompare(left, right))
        .map(([key, entry]) => [key, canonicalValue(entry)]));
    }
    return value;
  };
  const canonicalJson = value => JSON.stringify(canonicalValue(value));
  const canonicalDigest = value => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
  const nativeStateWitness = { schemaVersion: 2, requiredTableNames: [...NATIVE_TABLE_NAMES], snapshots: {}, reads: [], refusals: [] };
  let activeCaseName;
  let activeRefusal;
  let resolveReferenceCalls = 0;
  let verifyFixtureBudgetCalls = 0;
  const references = new Map();
  const budgets = new Map();
  let referenceEffect = null;
  let budgetEffect = null;
  let adapterCreateCalls = 0;
  let adapterTurnCalls = 0;

  const query = (claim, overrides = {}) => {
    const params = new URLSearchParams({ projectId: claim.projectId,
      expectedBindingRevision: String(claim.expectedBindingRevision),
      expectedPolicyRevision: String(claim.expectedPolicyRevision), scopeKey: claim.scopeKey, ...overrides });
    return `?${params}`;
  };
  const registrySnapshot = () => Promise.all([
    getDb().select().from(tables.projects), getDb().select().from(tables.bindings),
    getDb().select().from(tables.revisions), getDb().select().from(tables.receipts),
  ]);
  const nativeSnapshot = async () => {
    const result = await getDbExec().execute({ sql: `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`, args: [] });
    const names = result.rows.map(row => String(row.name));
    const snapshotTables = {};
    for (const name of names) {
      assert.match(name, /^[A-Za-z_][A-Za-z0-9_]*$/);
      const tableInfo = await getDbExec().execute({ sql: `PRAGMA table_info(${name})`, args: [] });
      const columns = tableInfo.rows.map(row => String(row.name)).sort();
      assert.ok(columns.length > 0);
      assert.equal(new Set(columns).size, columns.length);
      const resultRows = await getDbExec().execute({ sql: `SELECT * FROM ${name}`, args: [] });
      const rows = resultRows.rows.map(row => Object.fromEntries(
        columns.map(column => [column, canonicalValue(row[column])]),
      )).sort((left, right) => lexicalCompare(canonicalJson(left), canonicalJson(right)));
      snapshotTables[name] = { columns, rows };
    }
    return { schemaVersion: 1, tables: snapshotTables };
  };
  const summarizeNativeSnapshot = snapshot => Object.fromEntries(Object.keys(snapshot.tables).map(name => {
    const table = snapshot.tables[name];
    return [name, { columns: table.columns, rowCount: table.rows.length,
      sha256: canonicalDigest({ columns: table.columns, rows: table.rows }) }];
  }));
  const acceptedNativeRead = async (name, operation) => {
    const before = await nativeSnapshot();
    const beforeHash = canonicalDigest(before);
    nativeStateWitness.snapshots[beforeHash] ??= { tables: summarizeNativeSnapshot(before) };
    const result = await operation();
    const after = await nativeSnapshot();
    const afterHash = canonicalDigest(after);
    nativeStateWitness.snapshots[afterHash] ??= { tables: summarizeNativeSnapshot(after) };
    const same = afterHash === beforeHash;
    nativeStateWitness.reads.push({ name, before: beforeHash, after: afterHash, same });
    assert.deepEqual(after, before);
    assert.equal(same, true);
    return result;
  };
  const rememberSnapshot = snapshot => {
    const hash = canonicalDigest(snapshot);
    nativeStateWitness.snapshots[hash] ??= { tables: summarizeNativeSnapshot(snapshot) };
    return hash;
  };
  const injectDatabaseChange = async (label, tableName, identity, operation, expectedColumns) => {
    assert.ok(activeRefusal, "database injection must belong to a refusal witness");
    const before = await nativeSnapshot();
    assert.deepEqual(before, activeRefusal.lastState, "action wrote before fixture injection");
    await operation();
    const after = await nativeSnapshot();
    assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables));
    const match = row => Object.entries(identity).every(([key, value]) => row[key] === value);
    const beforeRows = before.tables[tableName].rows.filter(match);
    const afterRows = after.tables[tableName].rows.filter(match);
    let changedColumns = [];
    assert.equal(beforeRows.length, 1);
    assert.equal(afterRows.length, label === "revoke-current-authority" ? 0 : 1);
    for (const name of Object.keys(before.tables)) {
      if (name !== tableName) assert.deepEqual(after.tables[name], before.tables[name]);
      else {
        assert.deepEqual(after.tables[name].rows.filter(row => !match(row)), before.tables[name].rows.filter(row => !match(row)));
        if (afterRows.length) {
          changedColumns = Object.keys(beforeRows[0]).filter(key => canonicalJson(beforeRows[0][key]) !== canonicalJson(afterRows[0][key]));
          assert.ok(changedColumns.length > 0);
          assert.ok(changedColumns.every(key => expectedColumns.includes(key)), `unexpected injected columns: ${changedColumns}`);
          if (label === "replace-session-harness") {
            assert.equal(afterRows[0].harness_name, "changed-harness");
            assert.equal(afterRows[0].generation, beforeRows[0].generation + 1);
          } else assert.equal(afterRows[0].revision, 12);
        }
      }
    }
    activeRefusal.injections.push({ label, before: rememberSnapshot(before), after: rememberSnapshot(after),
      allowedTable: tableName, allowedIdentityDigest: canonicalDigest(identity), allowedColumns: expectedColumns,
      changedRows: [{ identityDigest: canonicalDigest(identity), beforeHash: canonicalDigest(beforeRows), afterHash: canonicalDigest(afterRows),
        operation: afterRows.length ? "update" : "delete", changedColumns }] });
    activeRefusal.lastState = after;
  };
  const refusedRequest = async (variant, nitro, suffix, expected, options = {}, authenticated = true, beforeNativeAccess = false) => {
    assert.equal(activeRefusal, undefined);
    assert.ok(REFUSAL_VARIANTS.includes(variant));
    assert.ok(!nativeStateWitness.refusals.some(item => item.variant === variant));
    const before = await nativeSnapshot();
    const counters = { resolveReference: resolveReferenceCalls, verifyFixtureBudget: verifyFixtureBudgetCalls,
      inspect: inspectCalls, nativeReads: nativeReads.length, creates: adapterCreateCalls, turns: adapterTurnCalls };
    activeRefusal = { injections: [], lastState: before };
    try {
      const result = await call(nitro, suffix, options, authenticated);
      const after = await nativeSnapshot();
      assert.deepEqual(after, activeRefusal.lastState, "refused action wrote database rows");
      assert.equal(adapterCreateCalls, counters.creates);
      assert.equal(adapterTurnCalls, counters.turns);
      assert.equal(result.status, expected.status ?? 200);
      assert.deepEqual(result.body, expected.body);
      const injectionContract = INJECTION_CONTRACTS[variant];
      const expectedInjectionIdentity = variant === "session-drift" ? { id: "session_alpha" }
        : variant === "registry-drift" ? { scope_key: "runtime-activity-registry-revision" }
          : variant === "authority-drift" ? { org_id: grant.orgId, app_id: "workbench", email } : null;
      const expectedInjectionIdentityDigest = expectedInjectionIdentity ? canonicalDigest(expectedInjectionIdentity) : null;
      if (injectionContract) {
        assert.equal(activeRefusal.injections.length, 1, `required injection missing: ${variant}`);
        const injection = activeRefusal.injections[0];
        assert.equal(injection.label, injectionContract.label);
        assert.equal(injection.allowedTable, injectionContract.table);
        assert.equal(injection.allowedIdentityDigest, expectedInjectionIdentityDigest);
      } else assert.equal(activeRefusal.injections.length, 0);
      const observedCounters = { resolveReference: resolveReferenceCalls - counters.resolveReference,
        verifyFixtureBudget: verifyFixtureBudgetCalls - counters.verifyFixtureBudget,
        inspect: inspectCalls - counters.inspect, nativeReads: nativeReads.slice(counters.nativeReads) };
      if (beforeNativeAccess) {
        assert.equal(observedCounters.resolveReference, 0);
        assert.equal(observedCounters.verifyFixtureBudget, 0);
        assert.deepEqual(observedCounters.nativeReads, []);
      }
      nativeStateWitness.refusals.push({ caseName: activeCaseName, variant,
        requestDigest: canonicalDigest({ suffix, method: options.method ?? "GET", authenticated }),
        status: result.status, responseCode: result.body.code ?? null, responseBodyHash: canonicalDigest(result.body),
        disclosure: result.body.code ? "code-only" : "exact-transport-error", before: rememberSnapshot(before),
        after: rememberSnapshot(after), injections: activeRefusal.injections, expectedInjectionIdentityDigest, actionSegmentsUnchanged: true,
        beforeNativeAccess, counters: observedCounters });
      return result;
    } finally { activeRefusal = undefined; }
  };
  const refuse = (variant, nitro, suffix, code, beforeNativeAccess = false) =>
    refusedRequest(variant, nitro, suffix, { body: { code } }, {}, true, beforeNativeAccess);
  const storedBudget = async runId => {
    const result = await getDbExec().execute({
      sql: "SELECT event_data FROM agent_run_events WHERE run_id = ? ORDER BY seq", args: [runId],
    });
    return Object.freeze({ eventCount: result.rows.length,
      encodedBytes: result.rows.reduce((sum, row) => sum + Buffer.byteLength(String(row.event_data), "utf8"), 0) });
  };
  const runtimeConfig = (patch = {}) => Object.freeze({ ...runtimeIdentity,
    resolveReference: async identity => {
      resolveReferenceCalls += 1;
      if (referenceEffect) await referenceEffect(identity);
      return structuredClone(references.get(digest(identity)));
    },
    verifyFixtureBudget: async request => {
      verifyFixtureBudgetCalls += 1;
      if (budgetEffect) return await budgetEffect(request);
      return structuredClone(budgets.get(request.nativeRunId));
    },
    ...patch,
  });
  const mounted = async (runtime, readScope) => {
    const nitro = { h3: new H3() };
    const activity = createProjectRuntimeActivity({ readScope, provider, runtime });
    mountProjectRuntimeActivity(nitro, { activity, auth: createNativeRegistryAuth() });
    await awaitBootstrap(nitro);
    return nitro;
  };
  const call = async (nitro, suffix, options = {}, authenticated = true) => {
    const headers = authenticated ? { authorization: `Bearer ${token}`, ...options.headers } : options.headers;
    const response = await nitro.h3.fetch(new Request(
      `http://example.test/_agent-native/actions/vivary-project-runtime-activity${suffix}`,
      { ...options, headers },
    ));
    let body;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  };
  const check = async (name, run) => {
    activeCaseName = name;
    process.stdout.write(`START ${name}\n`);
    nativeReads.length = 0;
    inspectCalls = 0;
    await run();
    process.stdout.write(`PASS ${name}\n`);
  };
  const setRole = role => setAppMemberRole({ appId: "workbench", orgId: grant.orgId,
    email, role, updatedBy: email });

  function bindingIdentity(scope, projectId, binding, root, runtime = runtimeIdentity) {
    return Object.freeze({ ownerEmail: email, orgId: grant.orgId, actorId: scope.actorId,
      collectionId: scope.collectionId, deviceId: scope.deviceId, projectId,
      bindingId: binding.bindingId, bindingRevision: binding.bindingRevision,
      rootId: root.rootId, contentRevision: root.contentRevision, locationRef: binding.locationRef,
      policyRevision: scope.policyRevision, harnessName: runtime.harnessName,
      runtimeVersion: runtime.runtimeVersion, executionLocation: runtime.executionLocation,
      authorityContract: runtime.authorityContract,
      runtimeConfigurationRevision: runtime.configurationRevision });
  }

  async function seedNativeRun(identity, events, patch = {}) {
    const suffix = patch.suffix ?? randomUUID().replaceAll("-", "");
    const threadId = `thread_${suffix}`;
    const sessionId = `session_${suffix}`;
    const runId = `run_${suffix}`;
    const ownerEmail = patch.ownerEmail ?? identity.ownerEmail;
    const orgId = patch.orgId ?? identity.orgId;
    const threadScope = patch.threadScope ?? { type: "vivary-project-runtime-v1", id: digest(identity) };
    await createThread(ownerEmail, { id: threadId, title: "Synthetic Native activity",
      scope: threadScope, orgId });
    const adapter = Object.freeze({ name: patch.harnessName ?? identity.harnessName,
      label: "Synthetic activity fixture", description: "In-memory event source for Native fixture seeding.",
      capabilities: { sandbox: true, resumable: true, approvals: true, hostTools: true, fileEvents: true },
      createSession: async () => {
        adapterCreateCalls += 1;
        return { id: `provider_${suffix}`,
          streamTurn: async function* () {
            adapterTurnCalls += 1;
            for (const event of events) yield structuredClone(event);
          },
          detach: async () => ({ fixture: suffix }),
          stop: async () => undefined,
        };
      },
    });
    assert.equal(trackedNativeRunId, null);
    trackedNativeRunId = runId;
    seededNativeRunCount += 1;
    let started;
    try {
      started = startAgentHarnessRun({ runId, threadId, adapter, input: { prompt: "fixture only" },
        createSession: { sessionId }, ownerEmail, orgId, detachOnComplete: true,
        runOptions: { recoverChunkBoundaries: false, useHostedSoftTimeoutDefault: false } });
      assert.ok(started.finalized instanceof Promise, "Native fixture run must expose durable finalization");
      await started.finalized;
      finalizedNativeRunCount += 1;
    } finally {
      trackedNativeRunId = null;
      const cleared = clearOwnedNativeRetentionTimers(runId);
      if (started) assert.equal(cleared, 1, `one Native retention timer expected for ${runId}`);
    }
    const reference = Object.freeze({ schemaVersion: 1, referenceRevision: patch.referenceRevision ?? 1,
      bindingIdentityDigest: digest(identity), nativeThreadId: threadId, nativeSessionId: sessionId,
      nativeRunId: runId, harnessName: adapter.name });
    references.set(digest(identity), reference);
    budgets.set(runId, await storedBudget(runId));
    return { reference, threadId, sessionId, runId };
  }

  let runtime;
  try {
    await withMigrationRuntime(async () => {
      await runMigrations(ORG_MIGRATIONS, { table: "runtime_activity_org_migrations" })();
      await migrateRegistry();
      await ensureAgentHarnessSessionTables();
      await addSession(token, email);
      // Initialize Native's lazy settings schema before any unchanged-state witness.
      assert.deepEqual(await getAllSettings(), {});
    });
    await getDb().insert(organizations).values({ id: grant.orgId, name: "Synthetic activity fixture",
      createdBy: email, createdAt: Date.now() });
    await getDb().insert(orgMembers).values({ id: "runtime-activity-member", orgId: grant.orgId,
      email, role: "owner", joinedAt: Date.now() });
    await setRole("project-registrar");
    runtime = createNativeRegistry({ provider, grant, evaluate: () => ({ code: "denied" }) });
    const scope = await runtime.readScope(context);
    assert.ok(scope);
    const scopeKey = digest(scope);
    const projectA = { projectId: "runtime-activity-a", displayName: "Activity Alpha",
      bindingId: "runtime-activity-binding-a", bindingRevision: 4, locationRef: "primary" };
    const projectB = { projectId: "runtime-activity-b", displayName: "Activity Beta",
      bindingId: "runtime-activity-binding-b", bindingRevision: 5, locationRef: "alternate" };
    for (const project of [projectA, projectB]) {
      await getDb().insert(tables.projects).values({ projectId: project.projectId, schemaVersion: 1,
        displayName: project.displayName });
      await getDb().insert(tables.bindings).values({ bindingId: project.bindingId, projectId: project.projectId,
        collectionId: scope.collectionId, actorId: scope.actorId, deviceId: scope.deviceId,
        rootId: roots.get(project.locationRef).rootId, locationRef: project.locationRef,
        bindingRevision: project.bindingRevision, policyRevision: grant.policyRevision, vcsKind: "none" });
    }
    await getDb().insert(tables.revisions).values({ scopeKey: "runtime-activity-registry-revision",
      collectionId: scope.collectionId, deviceId: scope.deviceId, revision: 11 });
    const claimA = Object.freeze({ projectId: projectA.projectId,
      expectedBindingRevision: projectA.bindingRevision, expectedPolicyRevision: grant.policyRevision, scopeKey });
    const claimB = Object.freeze({ projectId: projectB.projectId,
      expectedBindingRevision: projectB.bindingRevision, expectedPolicyRevision: grant.policyRevision, scopeKey });
    const identityA = bindingIdentity(scope, projectA.projectId, projectA, roots.get("primary"));
    const identityB = bindingIdentity(scope, projectB.projectId, projectB, roots.get("alternate"));

    await check("unconfigured and strict transport boundaries disclose no Native activity", async () => {
      const unconfigured = await mounted(null, runtime.readScope);
      await refuse("unconfigured", unconfigured, query(claimA), "unavailable", true);
      assert.deepEqual(nativeReads, []);
      const configured = await mounted(runtimeConfig(), runtime.readScope);
      await refusedRequest("unauthenticated", configured, query(claimA),
        { status: 401, body: { error: "Authentication required" } }, {}, false, true);
      await setRole(null);
      await refusedRequest("revoked-role", configured, query(claimA),
        { status: 403, body: { error: "Not authorized" } }, {}, true, true);
      await setRole("project-registrar");
      for (const [variant, suffix] of [["duplicate-query", query(claimA) + "&projectId=other"],
        ["foreign-query", query(claimA) + "&actorId=foreign"],
        ["noncanonical-revision", query({ ...claimA, expectedBindingRevision: "04" })]]) {
        await refusedRequest(variant, configured, suffix,
          { status: 400, body: { error: "Invalid activity claims" } }, {}, true, true);
      }
      await refusedRequest("wrong-route", configured, "/other" + query(claimA),
        { status: 404, body: { error: "Not found" } }, {}, true, true);
      await refusedRequest("wrong-method", configured, query(claimA),
        { status: 405, body: { error: "Method not allowed" } }, { method: "POST" }, true, true);
    });

    const alpha = await seedNativeRun(identityA, [
      { type: "text-delta", text: "alpha text only" },
      { type: "tool-start", id: "tool-alpha", name: "read_file", input: { path: "safe.txt" } },
      { type: "tool-done", id: "tool-alpha", name: "read_file", input: { path: "safe.txt" },
        result: "alpha tool result" },
      { type: "done", reason: "complete" },
    ], { suffix: "alpha" });
    const beta = await seedNativeRun(identityB, [
      { type: "text-delta", text: "beta text must stay isolated" }, { type: "done" },
    ], { suffix: "beta" });

    await check("exact reference returns only its Native text and tool activity without read effects", async () => {
      const beforeRegistry = await registrySnapshot();
      const createsBefore = adapterCreateCalls;
      const turnsBefore = adapterTurnCalls;
      const nitro = await mounted(runtimeConfig(), runtime.readScope);
      const result = await acceptedNativeRead("exact-reference", () => call(nitro, query(claimA)));
      assert.equal(result.status, 200);
      assert.equal(result.body.code, "activity");
      assert.equal(result.body.projectId, projectA.projectId);
      assert.equal(result.body.nativeThreadId, alpha.threadId);
      assert.deepEqual(result.body.nativeScope, {
        type: "vivary-project-runtime-v1",
        id: digest(identityA),
      });
      assert.equal(result.body.nativeRunId, alpha.runId);
      const serialized = JSON.stringify(result.body);
      assert.match(serialized, /alpha text only/);
      assert.match(serialized, /alpha tool result/);
      assert.doesNotMatch(serialized, /beta text/);
      for (const forbidden of [email, otherEmail, "resumeState", "providerSessionId", "workspaceRef",
        "threadData", "synthetic-root-primary"]) assert.ok(!serialized.includes(forbidden));
      assert.deepEqual(nativeReads, ["thread", "session", "run", "events", "thread", "session", "run"]);
      assert.equal(adapterCreateCalls, createsBefore);
      assert.equal(adapterTurnCalls, turnsBefore);
      assert.deepEqual(await registrySnapshot(), beforeRegistry);
    });

    await check("project substitution and malformed or stale references fail closed", async () => {
      const keyA = digest(identityA);
      const valid = references.get(keyA);
      const nitro = await mounted(runtimeConfig(), runtime.readScope);
      references.set(keyA, beta.reference);
      await refuse("project-substitution", nitro, query(claimA), "unavailable");
      const invalid = [["missing-reference", undefined], ["array-reference", [valid, valid]],
        ["extra-reference-field", { ...valid, extra: true }], ["zero-reference-revision", { ...valid, referenceRevision: 0 }],
        ["wrong-identity", { ...valid, bindingIdentityDigest: "0".repeat(64) }],
        ["wrong-thread", { ...valid, nativeThreadId: beta.threadId }], ["wrong-session", { ...valid, nativeSessionId: beta.sessionId }],
        ["wrong-run", { ...valid, nativeRunId: beta.runId }], ["wrong-harness", { ...valid, harnessName: "wrong-harness" }]];
      for (const [variant, candidate] of invalid) {
        if (candidate === undefined) references.delete(keyA); else references.set(keyA, candidate);
        await refuse(variant, nitro, query(claimA), "unavailable");
      }
      references.set(keyA, valid);
      for (const stale of [{ scopeKey: "stale" }, { expectedBindingRevision: 3 },
        { expectedPolicyRevision: 6 }]) {
        await refuse(`stale-${Object.keys(stale)[0]}`, nitro, query({ ...claimA, ...stale }), "stale-claim", true);
      }
      const wrongRuntime = runtimeConfig({ runtimeVersion: "synthetic-v2" });
      await refuse("wrong-runtime", await mounted(wrongRuntime, runtime.readScope), query(claimA), "unavailable");
    });

    await check("owner organization scope and Native association mismatches refuse", async () => {
      const keyA = digest(identityA);
      const valid = references.get(keyA);
      const thread = await getThread(alpha.threadId);
      assert.ok(thread);
      const nitro = await mounted(runtimeConfig(), runtime.readScope);
      await setThreadScope(alpha.threadId, { type: "wrong-scope", id: keyA });
      await refuse("thread-scope", nitro, query(claimA), "unavailable");
      await setThreadScope(alpha.threadId, thread.scope);
      await updateAgentHarnessSession(alpha.sessionId, { orgId: "wrong-org" });
      await refuse("session-org", nitro, query(claimA), "unavailable");
      await updateAgentHarnessSession(alpha.sessionId, { orgId: grant.orgId });
      const otherOwner = await seedNativeRun(identityA, [{ type: "text-delta", text: "foreign owner" }],
        { suffix: "other_owner", ownerEmail: otherEmail });
      assert.equal(references.get(keyA).nativeRunId, otherOwner.runId);
      await refuse("foreign-owner", nitro, query(claimA), "unavailable");
      references.set(keyA, valid);
      references.set(keyA, { ...valid, nativeThreadId: beta.threadId });
      await refuse("thread-association", nitro, query(claimA), "unavailable");
      references.set(keyA, valid);
    });

    await check("reference Native root registry and final authority changes discard activity", async () => {
      const keyA = digest(identityA);
      const valid = references.get(keyA);
      const nitro = await mounted(runtimeConfig(), runtime.readScope);
      referenceEffect = async () => {
        if (nativeReads.includes("events")) references.set(keyA, { ...valid, referenceRevision: 2 });
      };
      await refuse("reference-drift", nitro, query(claimA), "stale-claim");
      referenceEffect = null;
      references.set(keyA, valid);

      budgetEffect = async request => {
        await injectDatabaseChange("replace-session-harness", "agent_harness_sessions", { id: request.nativeSessionId },
          () => updateAgentHarnessSession(request.nativeSessionId, { harnessName: "changed-harness" }),
          ["harness_name", "generation", "updated_at"]);
        return budgets.get(request.nativeRunId);
      };
      await refuse("session-drift", nitro, query(claimA), "stale-claim");
      budgetEffect = null;
      await updateAgentHarnessSession(alpha.sessionId, { harnessName });

      const driftingRuntime = { ...runtimeConfig() };
      const driftingNitro = await mounted(driftingRuntime, runtime.readScope);
      for (const [field, changed] of [["runtimeVersion", "synthetic-v2"],
        ["executionLocation", "alternate-habitat"],
        ["authorityContract", "alternate-project-runner-v1"]]) {
        budgetEffect = async request => {
          driftingRuntime[field] = changed;
          return budgets.get(request.nativeRunId);
        };
        await refuse(`runtime-${field}`, driftingNitro, query(claimA), "stale-claim");
        budgetEffect = null;
        driftingRuntime[field] = runtimeIdentity[field];
      }

      budgetEffect = async request => {
        roots.set("primary", { ...roots.get("primary"), contentRevision: "synthetic-content-2" });
        return budgets.get(request.nativeRunId);
      };
      await refuse("root-drift", nitro, query(claimA), "stale-claim");
      budgetEffect = null;
      roots.set("primary", { ...roots.get("primary"), contentRevision: "synthetic-content-1" });

      roots.set("primary", { ...roots.get("primary"), contentRevision: "synthetic-content-2" });
      await refuse("root-prechanged", nitro, query(claimA), "unavailable");
      roots.set("primary", { ...roots.get("primary"), contentRevision: "synthetic-content-1" });

      inspectEffect = async callNumber => {
        if (callNumber === 2) await injectDatabaseChange("advance-registry-revision", "vivary_registry_revisions",
          { scope_key: "runtime-activity-registry-revision" },
          () => getDb().update(tables.revisions).set({ revision: 12 }).where(and(
            eq(tables.revisions.collectionId, scope.collectionId), eq(tables.revisions.deviceId, scope.deviceId))), ["revision"]);
      };
      inspectCalls = 0;
      await refuse("registry-drift", nitro, query(claimA), "stale-claim");
      inspectEffect = null;
      await getDb().update(tables.revisions).set({ revision: 11 }).where(and(
        eq(tables.revisions.collectionId, scope.collectionId), eq(tables.revisions.deviceId, scope.deviceId)));

      inspectEffect = async callNumber => {
        if (callNumber === 2) await injectDatabaseChange("revoke-current-authority", "app_member_roles",
          { org_id: grant.orgId, app_id: "workbench", email }, () => setRole(null), []);
      };
      inspectCalls = 0;
      await refuse("authority-drift", nitro, query(claimA), "denied");
      inspectEffect = null;
      await setRole("project-registrar");
    });

    await check("fixture event and byte caps refuse before the all-events helper", async () => {
      const nitro = await mounted(runtimeConfig(), runtime.readScope);
      const exactCount = await seedNativeRun(identityA,
        Array.from({ length: 254 }, (_, index) => ({ type: "activity", label: `budget-${index}` })),
        { suffix: "budget_count_exact", referenceRevision: 20 });
      assert.equal(budgets.get(exactCount.runId).eventCount, 256);
      await refuse("fixture-count-exact", nitro, query(claimA), "activity-too-large");
      assert.ok(nativeReads.includes("events"), "the exact input boundary must reach the all-events helper");

      const overCount = await seedNativeRun(identityA,
        Array.from({ length: 255 }, (_, index) => ({ type: "activity", label: `budget-${index}` })),
        { suffix: "budget_count_over", referenceRevision: 21 });
      assert.equal(budgets.get(overCount.runId).eventCount, 257);
      nativeReads.length = 0;
      await refuse("fixture-count-over", nitro, query(claimA), "activity-too-large");
      assert.ok(!nativeReads.includes("events"));

      const probe = await seedNativeRun(identityA, [{ type: "activity", label: "" }],
        { suffix: "budget_byte_probe", referenceRevision: 22 });
      const emptyEventBytes = Buffer.byteLength(JSON.stringify({ type: "activity", label: "" }), "utf8");
      const fixedBytes = budgets.get(probe.runId).encodedBytes - emptyEventBytes;
      const exactFiller = 512 * 1024 - fixedBytes - emptyEventBytes;
      assert.ok(exactFiller > 16_384,
        "the exact fixture boundary must prove well-formed text passes the former schema ceiling");
      const exactBytes = await seedNativeRun(identityA, [{ type: "activity", label: "x".repeat(exactFiller) }],
        { suffix: "budget_bytes_exact", referenceRevision: 23 });
      assert.deepEqual(budgets.get(exactBytes.runId), { eventCount: 3, encodedBytes: 512 * 1024 });
      nativeReads.length = 0;
      await refuse("fixture-bytes-exact", nitro, query(claimA), "activity-too-large");
      assert.ok(nativeReads.includes("events"), "the exact byte boundary must reach the all-events helper");

      const overBytes = await seedNativeRun(identityA,
        [{ type: "activity", label: "x".repeat(exactFiller + 1) }],
        { suffix: "budget_bytes_over", referenceRevision: 24 });
      assert.deepEqual(budgets.get(overBytes.runId), { eventCount: 3, encodedBytes: 512 * 1024 + 1 });
      nativeReads.length = 0;
      await refuse("fixture-bytes-over", nitro, query(claimA), "activity-too-large");
      assert.ok(!nativeReads.includes("events"));
    });

    await check("item count item bytes and complete response bytes refuse without partial activity", async () => {
      async function selectFixture(name, events) {
        const fixture = await seedNativeRun(identityA, events, { suffix: name,
          referenceRevision: references.get(digest(identityA)).referenceRevision + 1 });
        return fixture;
      }
      const countBoundary = await selectFixture("count_boundary",
        Array.from({ length: 126 }, (_, index) => ({ type: "activity", label: `event-${index}` })));
      const nitro = await mounted(runtimeConfig(), runtime.readScope);
      assert.equal((await acceptedNativeRead("item-count-boundary",
        () => call(nitro, query(claimA)))).body.code, "activity");
      assert.equal(references.get(digest(identityA)).nativeRunId, countBoundary.runId);

      await selectFixture("count_over",
        Array.from({ length: 127 }, (_, index) => ({ type: "activity", label: `event-${index}` })));
      await refuse("item-count-over", nitro, query(claimA), "activity-too-large");

      const itemMessageLength = runId => 8 * 1024 - Buffer.byteLength(JSON.stringify({
        id: `${runId}:1`, runId, kind: "note", message: "", createdAt: "2026-09-07T12:00:00.000Z",
      }), "utf8");
      const exactItemRunId = "run_item_exact";
      const exactItemLength = itemMessageLength(exactItemRunId);
      await selectFixture("item_exact", [{ type: "text-delta", text: "x".repeat(exactItemLength) }]);
      const exactItemResult = await acceptedNativeRead("item-bytes-boundary",
        () => call(nitro, query(claimA)));
      assert.equal(exactItemResult.body.code, "activity");
      assert.equal(Buffer.byteLength(JSON.stringify(exactItemResult.body.items[1]), "utf8"), 8 * 1024);

      await selectFixture("item_overx", [{ type: "text-delta", text: "x".repeat(exactItemLength + 1) }]);
      await refuse("item-bytes-over", nitro, query(claimA), "activity-too-large");

      function projectedResponse(runId, referenceRevision, messages) {
        const createdAt = "2026-09-07T12:00:00.000Z";
        const items = [{ id: `${runId}:0`, runId, kind: "status",
          message: "Starting Synthetic activity fixture", createdAt, metadata: { tool: "harness" } }];
        messages.forEach((message, index) => items.push({ id: `${runId}:${index + 1}`, runId,
          kind: "note", message, createdAt }));
        items.push({ id: `${runId}:${messages.length + 1}`, runId, kind: "status",
          message: "Run completed", createdAt });
        return { code: "activity", projectId: projectA.projectId, scopeKey: claimA.scopeKey,
          bindingRevision: projectA.bindingRevision, policyRevision: grant.policyRevision,
          referenceRevision, nativeThreadId: runId.replace(/^run_/, "thread_"),
          nativeScope: { type: "vivary-project-runtime-v1", id: digest(identityA) },
          nativeRunId: runId, items };
      }
      const exactResponseRunId = "run_response_size_a";
      const responseRevision = references.get(digest(identityA)).referenceRevision + 1;
      const responseMessages = Array.from({ length: 100 }, (_, index) => `${index}:` + "r".repeat(2_000));
      const responseBase = projectedResponse(exactResponseRunId, responseRevision, responseMessages);
      let remaining = 256 * 1024 - Buffer.byteLength(JSON.stringify(responseBase), "utf8");
      assert.ok(remaining > 0);
      for (let index = 0; remaining > 0 && index < responseMessages.length; index += 1) {
        const room = 7_900 - responseMessages[index].length;
        const added = Math.min(room, remaining);
        responseMessages[index] += "r".repeat(added);
        remaining -= added;
      }
      assert.equal(remaining, 0);
      assert.equal(Buffer.byteLength(JSON.stringify(
        projectedResponse(exactResponseRunId, responseRevision, responseMessages)), "utf8"), 256 * 1024);
      await seedNativeRun(identityA, responseMessages.map(message => ({ type: "text-delta", text: message })),
        { suffix: "response_size_a", referenceRevision: responseRevision });
      const exactResponse = await acceptedNativeRead("response-bytes-boundary",
        () => call(nitro, query(claimA)));
      assert.equal(exactResponse.body.code, "activity");
      assert.equal(Buffer.byteLength(JSON.stringify(exactResponse.body), "utf8"), 256 * 1024);

      const overMessages = [...responseMessages];
      overMessages[overMessages.length - 1] += "r";
      await seedNativeRun(identityA, overMessages.map(message => ({ type: "text-delta", text: message })),
        { suffix: "response_size_b", referenceRevision: responseRevision + 1 });
      await refuse("response-bytes-over", nitro, query(claimA), "activity-too-large");
    });

    await check("ambiguous current binding refuses before Native reads", async () => {
      await getDb().update(tables.bindings).set({ projectId: projectA.projectId })
        .where(eq(tables.bindings.bindingId, projectB.bindingId));
      try {
        const nitro = await mounted(runtimeConfig(), runtime.readScope);
        await refuse("ambiguous-binding", nitro, query(claimA), "ambiguous-binding", true);
        assert.deepEqual(nativeReads, []);
      } finally {
        await getDb().update(tables.bindings).set({ projectId: projectB.projectId })
          .where(eq(tables.bindings.bindingId, projectB.bindingId));
      }
    });
  } finally {
    try {
      Reflect.deleteProperty(globalThis, Symbol.for("vivary.runtimeActivityNativeReads"));
      referenceEffect = null;
      budgetEffect = null;
      inspectEffect = null;
      await setRole(null).catch(() => undefined);
      await removeSession(token).catch(() => undefined);
      await closeDbExec();
    } finally {
      trackedNativeRunId = null;
      clearOwnedNativeRetentionTimers();
      Object.defineProperty(globalThis, "setTimeout", originalSetTimeoutDescriptor);
      assert.equal(globalThis.setTimeout, originalSetTimeout);
      assert.equal(ownedNativeRetentionTimers.size, 0);
      assert.equal(finalizedNativeRunCount, seededNativeRunCount);
      assert.equal(clearedNativeRetentionTimerCount, finalizedNativeRunCount);
      process.stdout.write(`NATIVE_TIMER_CLEANUP seededRuns=${seededNativeRunCount} `
        + `finalizedRuns=${finalizedNativeRunCount} `
        + `timersCleared=${clearedNativeRetentionTimerCount} pending=0 globalsRestored=true\n`);
    }
  }
  assert.deepEqual(nativeStateWitness.reads.map(read => read.name), [...ACCEPTED_NATIVE_READ_NAMES]);
  assert.deepEqual(nativeStateWitness.refusals.map(item => item.variant), [...REFUSAL_VARIANTS]);
  process.stdout.write(`NATIVE_STATE_WITNESS ${canonicalJson(nativeStateWitness)}\n`);
  process.stdout.write("PASS runtime activity worker cleanup\n");
}

if (process.env.VIVARY_RUNTIME_ACTIVITY_WORKER === "1") { // guard:allow-env-credential - Test child mode flag.
  try { await worker(); }
  catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  }
} else {
  test("project runtime activity reads exact bounded Native fixture records", async () => {
    const configured = process.env.VIVARY_REGISTRY_PROOF_ROOT; // guard:allow-env-credential - Disposable proof directory.
    assert.ok(configured && path.isAbsolute(configured), "explicit absolute proof root required");
    const proofRoot = await realpath(configured);
    const caseRoot = await mkdtemp(path.join(proofRoot, "runtime-activity-"));
    assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
    const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
      "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"];
    const env = Object.fromEntries(retained.filter(key => process.env[key]) // guard:allow-env-credential - Fixed OS launch paths.
      .map(key => [key, process.env[key]])); // guard:allow-env-credential - Fixed OS launch paths.
    Object.assign(env, { VIVARY_RUNTIME_ACTIVITY_WORKER: "1",
      VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential - Reviewed package manifest path.
      NODE_ENV: "test", DATABASE_URL: `file:${path.join(caseRoot, "registry.sqlite")}`,
      AGENT_NATIVE_DISABLED_PLUGINS: "agent-chat,auth,context-xray,core-routes,integrations,observational-memory,onboarding,org,resources,sentry,terminal" });
    try {
      const result = spawnSync(process.execPath, ["--max-old-space-size=192", TEST_FILE], {
        cwd: caseRoot, env, windowsHide: true, encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024,
      });
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      assert.equal(result.error, undefined, `${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
      assert.equal(result.signal, null, `${result.stdout}\n${result.stderr}`);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assertWorkerEvidence(result.stdout, 8);
      process.stdout.write("WORKER_NATURAL_EXIT code=0 signal=none timeoutMs=60000\n");
    } finally {
      assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
      await rm(caseRoot, { recursive: true, force: true });
    }
  });
}
