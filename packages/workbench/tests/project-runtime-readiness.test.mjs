import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_FILE = fileURLToPath(import.meta.url);

function assertWorkerEvidence(stdout, expectedCases) {
  const lines = stdout.split(/\r?\n/);
  const starts = lines.filter(line => line.startsWith("START ")).map(line => line.slice(6));
  const passes = lines.filter(line => line.startsWith("PASS ")
    && line !== "PASS runtime readiness worker cleanup").map(line => line.slice(5));
  assert.equal(starts.length, expectedCases, `expected ${expectedCases} worker case starts`);
  assert.deepEqual(passes, starts, "every started worker case must emit one ordered pass marker");
  assert.equal(lines.filter(line => line === "PASS runtime readiness worker cleanup").length, 1,
    "worker cleanup evidence must appear exactly once");
}

async function worker() {
  register(new URL("./native-http-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential - Test dependency manifest path; no credential value.
  });
  const { createHash, randomUUID } = await import("node:crypto");
  const {
    ensureAgentHarnessSessionTables,
    listAgentHarnesses,
    registerAgentHarness,
  } = await import("@agent-native/core/agent/harness");
  const { closeDbExec, getDbExec, runMigrations, withMigrationRuntime } = await import("@agent-native/core/db");
  const { and, eq } = await import("@agent-native/core/db/schema");
  const { ORG_MIGRATIONS, organizations, orgMembers, setAppMemberRole } = await import("@agent-native/core/org");
  const { addSession, awaitBootstrap, removeSession } = await import("@agent-native/core/server");
  const { H3 } = await import("h3");
  const { getDb } = await import("../server/db/index.mjs");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const tables = await import("../server/db/schema.mjs");
  const { createNativeRegistry, createNativeRegistryAuth } = await import("../server/native-registry.mjs");
  const { createProjectRuntimeReadiness, mountProjectRuntimeReadiness } =
    await import("../server/project-runtime-readiness.mjs");

  const email = "runtime-readiness@example.test";
  const grant = Object.freeze({ orgId: "runtime-readiness-org", collectionId: "runtime-readiness-collection",
    policyRevision: 7, locationRefs: ["primary", "alternate"] });
  const context = Object.freeze({ userEmail: email, orgId: grant.orgId, appId: "workbench", caller: "frontend" });
  const token = randomUUID();
  const projectId = "runtime-readiness-project";
  const fixtureHarness = "synthetic-readiness-harness";
  const missingPackageHarness = "synthetic-missing-package-harness";
  let adapterConstructions = 0;
  let inspectCalls = 0;
  let inspectEffect = null;
  const roots = new Map([
    ["primary", { code: "available", locationRef: "primary", rootId: "synthetic-root-primary",
      contentRevision: "synthetic-content-1" }],
    ["alternate", { code: "available", locationRef: "alternate", rootId: "synthetic-root-alternate",
      contentRevision: "synthetic-content-1" }],
  ]);
  const provider = Object.freeze({
    deviceId: "runtime-readiness-device",
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

  registerAgentHarness({
    name: fixtureHarness,
    label: "Synthetic readiness fixture",
    description: "Trusted test inventory only. It must never construct an adapter.",
    capabilities: { sandbox: true, resumable: true, approvals: true, hostTools: true, fileEvents: true },
    create() {
      adapterConstructions += 1;
      throw new Error("runtime readiness must not construct an adapter");
    },
  });
  registerAgentHarness({
    name: missingPackageHarness,
    label: "Synthetic missing package fixture",
    description: "Trusted test inventory with a deliberately absent package.",
    installPackage: "@vivary/nonexistent-runtime-readiness-fixture@0.0.0",
    capabilities: { sandbox: true, resumable: true, approvals: true, hostTools: true, fileEvents: true },
    create() {
      adapterConstructions += 1;
      throw new Error("runtime readiness must not construct a missing adapter");
    },
  });

  const scopeKey = scope => createHash("sha256").update(JSON.stringify(scope)).digest("hex");
  const runtimeConfig = (resolveEvidence, patch = {}) => Object.freeze({
    harnessName: fixtureHarness,
    runtimeVersion: "synthetic-v1",
    executionLocation: "synthetic-habitat",
    configurationRevision: 3,
    authorityContract: "synthetic-project-runner-v1",
    resolveEvidence,
    ...patch,
  });
  const evidence = (state = "available") => async request => ({ evidenceKey: request.evidenceKey,
    authenticated: state, authorized: state, runnable: state, verified: state });
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
  const nativeRunCounts = async () => {
    const names = await getDbExec().execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('agent_harness_sessions', 'agent_runs')",
      args: [],
    });
    const present = new Set(names.rows.map(row => String(row.name)));
    const count = async table => {
      if (!present.has(table)) return null;
      const result = await getDbExec().execute({ sql: `SELECT COUNT(*) AS count FROM ${table}`, args: [] });
      return Number(result.rows[0]?.count ?? 0);
    };
    return { harnessSessions: await count("agent_harness_sessions"), agentRuns: await count("agent_runs") };
  };
  const mounted = async (runtime, readScope) => {
    const nitro = { h3: new H3() };
    const readiness = createProjectRuntimeReadiness({ readScope, provider, runtime });
    mountProjectRuntimeReadiness(nitro, { readiness, auth: createNativeRegistryAuth() });
    await awaitBootstrap(nitro);
    return nitro;
  };
  const call = async (nitro, suffix, options = {}, authenticated = true) => {
    const headers = authenticated ? { authorization: `Bearer ${token}`, ...options.headers } : options.headers;
    const response = await nitro.h3.fetch(new Request(
      `http://example.test/_agent-native/actions/vivary-project-runtime-readiness${suffix}`,
      { ...options, headers },
    ));
    let body;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  };
  const check = async (name, run) => {
    process.stdout.write(`START ${name}\n`);
    await run();
    process.stdout.write(`PASS ${name}\n`);
  };

  const setRole = role => setAppMemberRole({ appId: "workbench", orgId: grant.orgId, email, role, updatedBy: email });
  let runtime;
  try {
    await withMigrationRuntime(async () => {
      await runMigrations(ORG_MIGRATIONS, { table: "runtime_readiness_org_migrations" })();
      await migrateRegistry();
      await ensureAgentHarnessSessionTables();
      await addSession(token, email);
    });
    await getDb().insert(organizations).values({ id: grant.orgId, name: "Synthetic readiness fixture",
      createdBy: email, createdAt: Date.now() });
    await getDb().insert(orgMembers).values({ id: "runtime-readiness-member", orgId: grant.orgId,
      email, role: "owner", joinedAt: Date.now() });
    await setRole("project-registrar");
    runtime = createNativeRegistry({ provider, grant, evaluate: () => ({ code: "denied" }) });
    const scope = await runtime.readScope(context);
    assert.ok(scope);
    const claim = Object.freeze({ projectId, expectedBindingRevision: 4,
      expectedPolicyRevision: grant.policyRevision, scopeKey: scopeKey(scope) });
    await getDb().insert(tables.projects).values({ projectId, schemaVersion: 1,
      displayName: "Synthetic runtime project" });
    await getDb().insert(tables.bindings).values({ bindingId: "runtime-readiness-binding", projectId,
      collectionId: scope.collectionId, actorId: scope.actorId, deviceId: scope.deviceId,
      rootId: roots.get("primary").rootId, locationRef: "primary", bindingRevision: claim.expectedBindingRevision,
      policyRevision: grant.policyRevision, vcsKind: "none" });
    await getDb().insert(tables.revisions).values({ scopeKey: "runtime-readiness-registry-revision",
      collectionId: scope.collectionId, deviceId: scope.deviceId, revision: 11 });

    await check("authenticated GET boundary rejects malformed claims, methods and suffixes", async () => {
      const nitro = await mounted(runtimeConfig(evidence()), runtime.readScope);
      assert.notEqual((await call(nitro, query(claim), {}, false)).status, 200);
      await setRole(null);
      assert.equal((await call(nitro, query(claim))).status, 403);
      await setRole("project-registrar");
      const malformed = [
        "?projectId=runtime-readiness-project&expectedBindingRevision=4&expectedPolicyRevision=7",
        query(claim) + "&projectId=other",
        query(claim, { expectedBindingRevision: "04" }),
        query(claim, { expectedBindingRevision: "4.0" }),
        query(claim, { expectedBindingRevision: "4e0" }),
        query(claim, { expectedBindingRevision: "9007199254740992" }),
        query(claim) + "&actorId=foreign",
      ];
      for (const suffix of malformed) assert.equal((await call(nitro, suffix)).status, 400, suffix);
      assert.equal((await call(nitro, "/other" + query(claim))).status, 404);
      assert.equal((await call(nitro, query(claim), { method: "POST" })).status, 405);
    });

    await check("matching evidence reports observations without registry, session or run effects", async () => {
      const beforeRegistry = await registrySnapshot();
      const beforeNative = await nativeRunCounts();
      const beforeHarnesses = listAgentHarnesses();
      const nitro = await mounted(runtimeConfig(evidence()), runtime.readScope);
      const result = await call(nitro, query(claim));
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, {
        code: "readiness", projectId, scopeKey: claim.scopeKey, bindingRevision: 4, policyRevision: 7,
        observations: {
          installed: { state: "available", evidence: ["package-inventory"] },
          configured: { state: "available", evidence: ["trusted-configuration"] },
          authenticated: { state: "available", evidence: ["runtime-authentication"] },
          bound: { state: "available", evidence: ["current-binding", "root-observation"] },
          runnable: { state: "available", evidence: ["runtime-execution"] },
          verified: { state: "available", evidence: ["verification-receipt"] },
        }, blockers: [],
      });
      const serialized = JSON.stringify(result.body);
      for (const forbidden of [email, "bindingId", "rootId", "contentRevision", "executionLocation",
        "authorityContract", roots.get("primary").rootId]) assert.ok(!serialized.includes(forbidden));
      assert.equal(adapterConstructions, 0);
      assert.deepEqual(listAgentHarnesses(), beforeHarnesses);
      assert.deepEqual(await registrySnapshot(), beforeRegistry);
      assert.deepEqual(await nativeRunCounts(), beforeNative);
    });

    await check("declared capabilities and package presence cannot invent stronger evidence", async () => {
      const nitro = await mounted(runtimeConfig(evidence("unknown")), runtime.readScope);
      const result = await call(nitro, query(claim));
      assert.equal(result.body.observations.installed.state, "available");
      assert.equal(result.body.observations.configured.state, "available");
      assert.equal(result.body.observations.bound.state, "available");
      assert.equal(result.body.observations.authenticated.state, "unknown");
      assert.equal(result.body.observations.runnable.state, "unknown");
      assert.equal(result.body.observations.verified.state, "unknown");
      assert.ok(result.body.blockers.includes("runtime-authority-unknown"));
      assert.equal(adapterConstructions, 0);
    });

    await check("missing package inventory stays separate from trusted configuration", async () => {
      const nitro = await mounted(runtimeConfig(evidence(), { harnessName: missingPackageHarness }), runtime.readScope);
      const result = await call(nitro, query(claim));
      assert.deepEqual(result.body.observations.installed,
        { state: "unavailable", evidence: ["package-inventory"] });
      assert.equal(result.body.observations.configured.state, "available");
      assert.equal(result.body.observations.authenticated.state, "available");
      assert.equal(result.body.observations.runnable.state, "unavailable");
      assert.equal(result.body.observations.verified.state, "unavailable");
      assert.ok(result.body.blockers.includes("runtime-package-missing"));
      assert.equal(adapterConstructions, 0);
    });

    await check("an evidence key from another configuration cannot strengthen readiness", async () => {
      const nitro = await mounted(runtimeConfig(async () => ({ evidenceKey: "0".repeat(64),
        authenticated: "available", authorized: "available", runnable: "available", verified: "available" })),
      runtime.readScope);
      const result = await call(nitro, query(claim));
      assert.equal(result.body.observations.authenticated.state, "unknown");
      assert.equal(result.body.observations.runnable.state, "unknown");
      assert.equal(result.body.observations.verified.state, "unknown");
    });

    await check("stale scope, policy and binding claims refuse", async () => {
      const nitro = await mounted(runtimeConfig(evidence()), runtime.readScope);
      for (const stale of [{ scopeKey: "stale-scope" }, { expectedPolicyRevision: 6 },
        { expectedBindingRevision: 3 }]) {
        assert.deepEqual((await call(nitro, query({ ...claim, ...stale }))).body, { code: "stale-claim" });
      }
    });

    await check("multiple authorized bindings refuse instead of selecting one", async () => {
      await getDb().insert(tables.bindings).values({ bindingId: "runtime-readiness-binding-alternate", projectId,
        collectionId: scope.collectionId, actorId: scope.actorId, deviceId: scope.deviceId,
        rootId: roots.get("alternate").rootId, locationRef: "alternate", bindingRevision: 5,
        policyRevision: grant.policyRevision, vcsKind: "none" });
      try {
        const nitro = await mounted(runtimeConfig(evidence()), runtime.readScope);
        const before = await registrySnapshot();
        assert.deepEqual((await call(nitro, query(claim))).body, { code: "ambiguous-binding" });
        assert.deepEqual(await registrySnapshot(), before);
      } finally {
        await getDb().delete(tables.bindings).where(eq(tables.bindings.bindingId,
          "runtime-readiness-binding-alternate"));
      }
    });

    await check("authority loss during evidence resolution refuses the response", async () => {
      const nitro = await mounted(runtimeConfig(async request => {
        await setRole(null);
        return { evidenceKey: request.evidenceKey, authenticated: "available", authorized: "available",
          runnable: "available", verified: "available" };
      }), runtime.readScope);
      assert.deepEqual((await call(nitro, query(claim))).body, { code: "denied" });
      await setRole("project-registrar");
    });

    await check("root and registry changes across the evidence await refuse stale proof", async () => {
      const rootNitro = await mounted(runtimeConfig(async request => {
        roots.set("primary", { ...roots.get("primary"), contentRevision: "synthetic-content-2" });
        return { evidenceKey: request.evidenceKey, authenticated: "available", authorized: "available",
          runnable: "available", verified: "available" };
      }), runtime.readScope);
      try {
        assert.deepEqual((await call(rootNitro, query(claim))).body, { code: "stale-claim" });
      } finally {
        roots.set("primary", { ...roots.get("primary"), contentRevision: "synthetic-content-1" });
      }

      const revisionNitro = await mounted(runtimeConfig(async request => {
        await getDb().update(tables.revisions).set({ revision: 12 }).where(and(
          eq(tables.revisions.collectionId, scope.collectionId), eq(tables.revisions.deviceId, scope.deviceId),
        ));
        return { evidenceKey: request.evidenceKey, authenticated: "available", authorized: "available",
          runnable: "available", verified: "available" };
      }), runtime.readScope);
      try {
        assert.deepEqual((await call(revisionNitro, query(claim))).body, { code: "stale-claim" });
      } finally {
        await getDb().update(tables.revisions).set({ revision: 11 }).where(and(
          eq(tables.revisions.collectionId, scope.collectionId), eq(tables.revisions.deviceId, scope.deviceId),
        ));
      }
    });

    await check("late root inspection cannot outlive Native authority or registry state", async () => {
      inspectCalls = 0;
      inspectEffect = async callNumber => {
        if (callNumber === 3) await setRole(null);
      };
      const revokedNitro = await mounted(runtimeConfig(evidence()), runtime.readScope);
      try {
        assert.deepEqual((await call(revokedNitro, query(claim))).body, { code: "denied" });
        assert.equal(inspectCalls, 3);
      } finally {
        inspectEffect = null;
        await setRole("project-registrar");
      }

      inspectCalls = 0;
      inspectEffect = async callNumber => {
        if (callNumber === 3) {
          await getDb().update(tables.revisions).set({ revision: 12 }).where(and(
            eq(tables.revisions.collectionId, scope.collectionId), eq(tables.revisions.deviceId, scope.deviceId),
          ));
        }
      };
      const changedNitro = await mounted(runtimeConfig(evidence()), runtime.readScope);
      try {
        assert.deepEqual((await call(changedNitro, query(claim))).body, { code: "stale-claim" });
        assert.equal(inspectCalls, 3);
      } finally {
        inspectEffect = null;
        await getDb().update(tables.revisions).set({ revision: 11 }).where(and(
          eq(tables.revisions.collectionId, scope.collectionId), eq(tables.revisions.deviceId, scope.deviceId),
        ));
      }
    });

    await check("unconfigured runtime keeps unobserved facts unknown", async () => {
      const nitro = await mounted(null, runtime.readScope);
      const beforeNative = await nativeRunCounts();
      const result = await call(nitro, query(claim));
      assert.equal(result.body.observations.installed.state, "unknown");
      assert.deepEqual(result.body.observations.configured,
        { state: "unavailable", evidence: ["trusted-configuration"] });
      assert.equal(result.body.observations.authenticated.state, "unknown");
      assert.equal(result.body.observations.runnable.state, "unknown");
      assert.equal(result.body.observations.verified.state, "unknown");
      assert.equal(adapterConstructions, 0);
      assert.deepEqual(await nativeRunCounts(), beforeNative);
    });
  } finally {
    inspectEffect = null;
    await setRole(null).catch(() => undefined);
    await removeSession(token).catch(() => undefined);
    await closeDbExec();
  }
  process.stdout.write("PASS runtime readiness worker cleanup\n");
}

if (process.env.VIVARY_RUNTIME_READINESS_WORKER === "1") { // guard:allow-env-credential - Test child mode flag; no credential value.
  try { await worker(); }
  catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  }
} else {
  test("runtime readiness uses current Native authority without starting a runtime", async () => {
    const configured = process.env.VIVARY_REGISTRY_PROOF_ROOT; // guard:allow-env-credential - Disposable test directory path; no credential value.
    assert.ok(configured && path.isAbsolute(configured), "explicit absolute proof root required");
    const proofRoot = await realpath(configured);
    const caseRoot = await mkdtemp(path.join(proofRoot, "runtime-readiness-"));
    assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
    const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
      "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"];
    const env = Object.fromEntries(retained.filter(key => process.env[key]) // guard:allow-env-credential - Child gets only fixed OS launch paths.
      .map(key => [key, process.env[key]])); // guard:allow-env-credential - Child gets only fixed OS launch paths.
    Object.assign(env, {
      VIVARY_RUNTIME_READINESS_WORKER: "1",
      VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential - Test dependency manifest path; no credential value.
      NODE_ENV: "test",
      DATABASE_URL: `file:${path.join(caseRoot, "registry.sqlite")}`,
      AGENT_NATIVE_DISABLED_PLUGINS: "agent-chat,auth,context-xray,core-routes,integrations,observational-memory,onboarding,org,resources,sentry,terminal",
    });
    try {
      const result = spawnSync(process.execPath, ["--max-old-space-size=256", TEST_FILE], {
        cwd: caseRoot, env, windowsHide: true, encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024,
      });
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      assert.equal(result.error, undefined, `${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assertWorkerEvidence(result.stdout, 11);
    } finally {
      assert.equal(path.dirname(await realpath(caseRoot)), proofRoot);
      await rm(caseRoot, { recursive: true, force: true });
    }
  });
}
