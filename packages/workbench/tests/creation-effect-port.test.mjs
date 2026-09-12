import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_FILE = fileURLToPath(import.meta.url);
const activeChildren = new Map();
const PLAN = `sha256:${"b".repeat(64)}`;

const binding = (suffix = "a", patch = {}) => ({
  actorId: "actor-a",
  collectionId: "collection-a",
  deviceId: "device-a",
  policyRevision: 1,
  operationId: `operation-${suffix}`,
  parentRef: "parent-a",
  childName: `child-${suffix}`,
  acceptedPlanSha256: PLAN,
  ...patch,
});
const namespace = (suffix = "a", patch = {}) => ({
  namespaceKey: "namespace-a",
  childKey: `child-key-${suffix}`,
  stageId: `stage-${suffix}`,
  continuityId: `continuity-${suffix}`,
  ...patch,
});
const requestFor = (claim) => ({
  operationId: claim.operationId,
  parentRef: claim.parentRef,
  childName: claim.childName,
  acceptedPlanSha256: claim.acceptedPlanSha256,
  expectedPolicyRevision: claim.policyRevision,
});
const snapshot = (claim, phase, namespaceClaim) => ({
  binding: claim,
  phase,
  namespace: namespaceClaim,
});
const refusal = (reason, phase) => ({
  code: "recovery-required",
  reason,
  phase,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
};

class SyntheticCreationHost {
  #tails = new Map();

  constructor(state, events) {
    this.state = state;
    this.events = events;
    this.disconnected = false;
  }

  async #exclusive(scope, kind, callback) {
    const key = `${scope.collectionId}/${scope.deviceId}`;
    const previous = this.#tails.get(key) ?? Promise.resolve();
    const release = deferred();
    const tail = previous.then(() => release.promise);
    this.#tails.set(key, tail);
    await previous;
    this.events.push([`${kind}-enter`, key]);
    try {
      return await callback();
    } finally {
      this.events.push([`${kind}-exit`, key]);
      release.resolve();
      if (this.#tails.get(key) === tail) this.#tails.delete(key);
    }
  }

  withCreationScope(scope, callback) {
    return this.#exclusive(scope, "scope", () => callback(Object.freeze({
      executeOnce: async (admission, execute) => {
        const phase = admission?.snapshot?.phase ?? null;
        this.events.push(["guard-admission", admission]);
        this.events.push(["guard-check", admission?.effect ?? null, phase]);
        if (this.disconnected) {
          return refusal("creation-admission-disconnected", phase);
        }
        if (!this.state.member) {
          return { code: "denied", reason: "creation-effect-not-authorized", phase };
        }
        this.events.push(["guard-admit", admission.effect, phase]);
        const value = await execute();
        this.events.push(["guard-settled", admission.effect, phase]);
        return value;
      },
    })));
  }

  invalidate(scope, label, callback) {
    return this.#exclusive(scope, label, callback);
  }
}

async function worker() {
  register(new URL("./native-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential — Test dependency manifest path; no credential value.
  });
  const { withMigrationRuntime, closeDbExec } = await import("@agent-native/core/db");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const { getDb } = await import("../server/db/index.mjs");
  const schema = await import("../server/db/schema.mjs");
  const { createCreationReceiptStore } = await import("../server/creation-receipts.mjs");
  process.send({ type: "ready" });
  const payload = await new Promise((resolve) => process.once("message", resolve));
  if (payload.migrate) await withMigrationRuntime(() => migrateRegistry());

  const events = [];
  const state = {
    member: true,
    capabilities: ["create-child"],
    creatableParents: ["parent-a"],
    namespacePatch: {},
  };
  const host = new SyntheticCreationHost(state, events);
  const resolveFacts = async () => ({
    actorId: "actor-a",
    collectionId: "collection-a",
    deviceId: "device-a",
    policyRevision: 1,
    member: state.member,
    capabilities: state.capabilities,
    creatableParents: state.creatableParents,
  });
  const resolveNamespace = async (request) => ({
    parentRef: request.parentRef,
    ...namespace(request.operationId.slice("operation-".length)),
    ...state.namespacePatch,
    exclusiveControl: true,
  });
  const createStore = (creationHost = host) => createCreationReceiptStore({
    resolveFacts,
    resolveNamespace,
    creationHost,
  });
  const scope = Object.freeze({ collectionId: "collection-a", deviceId: "device-a" });

  async function prepare(store, suffix) {
    const claim = binding(suffix);
    const namespaceClaim = namespace(suffix);
    return {
      claim,
      namespaceClaim,
      value: await store.effectPort.prepare(claim, namespaceClaim),
    };
  }

  async function advanceToPublishing(store, suffix) {
    const prepared = await prepare(store, suffix);
    const ready = await store.effectPort.transition(
      prepared.claim, prepared.value, prepared.namespaceClaim, "preparing", "prepared",
    );
    const publishing = await store.effectPort.transition(
      prepared.claim, ready, prepared.namespaceClaim, "prepared", "publishing",
    );
    return { ...prepared, value: publishing };
  }

  function expiringStore(factCall) {
    const entered = deferred();
    const release = deferred();
    let calls = 0;
    const pausedFacts = async () => {
      calls++;
      if (calls === factCall) {
        entered.resolve();
        await release.promise;
      }
      return resolveFacts();
    };
    const earlyReturnHost = Object.freeze({
      async withCreationScope(_scope, callback) {
        callback(Object.freeze({
          executeOnce: async (_admission, execute) => execute(),
        })).catch(() => {});
        await entered.promise;
        return { pretending: "success" };
      },
    });
    return {
      entered,
      release,
      store: createCreationReceiptStore({
        resolveFacts: pausedFacts,
        resolveNamespace,
        creationHost: earlyReturnHost,
      }),
    };
  }

  async function expireAt(factCall, invoke) {
    const fixture = expiringStore(factCall);
    const pending = invoke(fixture.store);
    await fixture.entered.promise;
    await new Promise((resolve) => setImmediate(resolve));
    fixture.release.resolve();
    return pending;
  }

  async function phaseFor(operationId) {
    const rows = await getDb().transaction((tx) => tx.select().from(schema.receipts));
    return rows.find((row) => row.operationId === operationId)?.creationPhase ?? null;
  }

  let value;
  const store = createStore();
  if (payload.scenario === "prepare") {
    value = await prepare(store, "a");
  } else if (payload.scenario === "fresh-load-default") {
    const claim = binding("a");
    const namespaceClaim = namespace("a");
    const loaded = await store.effectPort.load(claim, namespaceClaim);
    const unconfigured = createCreationReceiptStore({ resolveFacts, resolveNamespace });
    const historical = await unconfigured.read(requestFor(claim));
    const refusedMutation = await unconfigured.markPrepared(requestFor(claim));
    const refusedPrivateLoad = await unconfigured.effectPort.load(claim, namespaceClaim);
    const unchanged = await store.effectPort.load(claim, namespaceClaim);
    value = { historical, loaded, refusedMutation, refusedPrivateLoad, unchanged };
  } else if (payload.scenario === "claims") {
    const prepared = await prepare(store, "claims");
    let callbacks = 0;
    const alteredBinding = binding("claims", { childName: "child-altered" });
    const changedBinding = await store.effectPort.load(
      alteredBinding, namespace("claims"),
    );
    const changedStage = await store.effectPort.load(
      prepared.claim, namespace("claims", { stageId: "stage-replaced" }),
    );
    const changedContinuity = await store.effectPort.load(
      prepared.claim, namespace("claims", { continuityId: "continuity-replaced" }),
    );
    const forgedPhase = await store.effectPort.admitAndExecute(
      prepared.claim,
      snapshot(prepared.claim, "prepared", prepared.namespaceClaim),
      prepared.namespaceClaim,
      "prepare-stage",
      async () => { callbacks++; },
    );
    const wrongEffect = await store.effectPort.admitAndExecute(
      prepared.claim,
      prepared.value,
      prepared.namespaceClaim,
      "publish",
      async () => { callbacks++; },
    );
    const failed = await store.fail(
      requestFor(prepared.claim), "preparing", "stage-failed",
    );
    const failedLoad = await store.effectPort.load(prepared.claim, prepared.namespaceClaim);
    value = {
      prepared: prepared.value,
      changedBinding,
      changedStage,
      changedContinuity,
      forgedPhase,
      wrongEffect,
      failed,
      failedLoad,
      callbacks,
    };
  } else if (payload.scenario === "pairs") {
    const pairs = [
      ["prepare-stage", "preparing"],
      ["publish", "publishing"],
      ["recover-publication", "publishing"],
    ];
    const results = [];
    for (const [effect, phase] of pairs) {
      const suffix = effect.replaceAll("-", "_");
      const prepared = phase === "preparing"
        ? await prepare(store, suffix)
        : await advanceToPublishing(store, suffix);
      const result = await store.effectPort.admitAndExecute(
        prepared.claim, prepared.value, prepared.namespaceClaim, effect, async () => {
          const rows = await getDb().transaction((tx) => tx.select().from(schema.receipts));
          const row = rows.find((candidate) => candidate.operationId === prepared.claim.operationId);
          events.push(["callback", effect, row?.creationPhase ?? null]);
          return `completed-${effect}`;
        },
      );
      results.push({ effect, phase, result });
    }
    value = { results, events };
  } else if (payload.scenario === "revocation-disconnect") {
    const revoked = await prepare(store, "revoked");
    let callbacks = 0;
    await host.invalidate(scope, "revoke", () => { state.member = false; });
    const afterRevocation = await store.effectPort.admitAndExecute(
      revoked.claim, revoked.value, revoked.namespaceClaim, "prepare-stage",
      async () => { callbacks++; },
    );
    await host.invalidate(scope, "restore", () => { state.member = true; });
    const disconnected = await prepare(store, "disconnected");
    await host.invalidate(scope, "disconnect", () => { host.disconnected = true; });
    const afterDisconnect = await store.effectPort.admitAndExecute(
      disconnected.claim, disconnected.value, disconnected.namespaceClaim, "prepare-stage",
      async () => { callbacks++; },
    );
    value = { afterRevocation, afterDisconnect, callbacks, events };
  } else if (payload.scenario === "pending") {
    const publishing = await advanceToPublishing(store, "pending");
    const started = deferred();
    const release = deferred();
    let admissionSettled = false;
    let mutationSettled = false;
    let invalidationSettled = false;
    const admission = store.effectPort.admitAndExecute(
      publishing.claim, publishing.value, publishing.namespaceClaim, "publish", async () => {
        events.push(["callback-start", "publish"]);
        started.resolve();
        await release.promise;
        events.push(["callback-finish", "publish"]);
        return "published-effect";
      },
    ).then((result) => { admissionSettled = true; return result; });
    await started.promise;
    const secondStore = createStore();
    const mutation = secondStore.markPublished(requestFor(publishing.claim))
      .then((result) => { mutationSettled = true; return result; });
    await new Promise((resolve) => setImmediate(resolve));
    const invalidation = host.invalidate(scope, "revoke", () => { state.member = false; })
      .then(() => { invalidationSettled = true; });
    const unconfigured = createCreationReceiptStore({ resolveFacts, resolveNamespace });
    const unscoped = await unconfigured.markPublished(requestFor(publishing.claim));
    await new Promise((resolve) => setImmediate(resolve));
    const whilePending = { admissionSettled, mutationSettled, invalidationSettled };
    release.resolve();
    value = {
      whilePending,
      unscoped,
      admission: await admission,
      mutation: await mutation,
    };
    await invalidation;
    value.memberAfterInvalidation = state.member;
    value.events = events;
  } else if (payload.scenario === "adversarial") {
    const duplicatePrepared = await prepare(store, "duplicate");
    let duplicateEffects = 0;
    const duplicateHost = Object.freeze({
      async withCreationScope(_scope, callback) {
        return callback(Object.freeze({
          async executeOnce(_admission, execute) {
            const calls = await Promise.allSettled([execute(), execute()]);
            return calls.find((call) => call.status === "fulfilled")?.value;
          },
        }));
      },
    });
    const duplicate = await createStore(duplicateHost).effectPort.admitAndExecute(
      duplicatePrepared.claim,
      duplicatePrepared.value,
      duplicatePrepared.namespaceClaim,
      "prepare-stage",
      async () => { duplicateEffects++; return "duplicate-effect"; },
    );

    const latePrepared = await prepare(store, "late");
    let retainedExecute;
    let lateEffects = 0;
    const lateHost = Object.freeze({
      async withCreationScope(_scope, callback) {
        return callback(Object.freeze({
          async executeOnce(admission, execute) {
            retainedExecute = execute;
            return refusal("creation-admission-disconnected", admission.snapshot.phase);
          },
        }));
      },
    });
    const late = await createStore(lateHost).effectPort.admitAndExecute(
      latePrepared.claim, latePrepared.value, latePrepared.namespaceClaim, "prepare-stage",
      async () => { lateEffects++; },
    );
    let lateRejected = false;
    try { await retainedExecute(); } catch { lateRejected = true; }

    const earlyPrepared = await prepare(store, "early");
    const earlyStarted = deferred();
    const earlyRelease = deferred();
    let earlySettled = false;
    const earlyHost = Object.freeze({
      async withCreationScope(_scope, callback) {
        return callback(Object.freeze({
          async executeOnce(_admission, execute) {
            execute().catch(() => {});
            return { pretending: "success" };
          },
        }));
      },
    });
    const earlyPromise = createStore(earlyHost).effectPort.admitAndExecute(
      earlyPrepared.claim, earlyPrepared.value, earlyPrepared.namespaceClaim, "prepare-stage",
      async () => {
        earlyStarted.resolve();
        await earlyRelease.promise;
        return "early-effect";
      },
    ).then((result) => { earlySettled = true; return result; });
    await earlyStarted.promise;
    await new Promise((resolve) => setImmediate(resolve));
    const earlyBeforeRelease = earlySettled;
    earlyRelease.resolve();
    const early = await earlyPromise;
    value = {
      duplicate,
      duplicateEffects,
      late,
      lateEffects,
      lateRejected,
      early,
      earlyBeforeRelease,
    };
  } else if (payload.scenario === "failures") {
    const preparing = await prepare(store, "failure_preparing");
    const preparingFailure = await store.effectPort.admitAndExecute(
      preparing.claim, preparing.value, preparing.namespaceClaim, "prepare-stage",
      async () => { throw new Error("fixture preparing failure"); },
    );
    const preparingAfter = await store.effectPort.load(
      preparing.claim, preparing.namespaceClaim,
    );
    const publishing = await advanceToPublishing(store, "failure_publishing");
    const publishingFailure = await store.effectPort.admitAndExecute(
      publishing.claim, publishing.value, publishing.namespaceClaim, "publish",
      async () => { throw new Error("fixture publishing failure"); },
    );
    const publishingAfter = await store.effectPort.load(
      publishing.claim, publishing.namespaceClaim,
    );
    const hostLossPrepared = await prepare(store, "host_loss");
    let hostLossEffects = 0;
    const hostLoss = Object.freeze({
      async withCreationScope(_scope, callback) {
        return callback(Object.freeze({
          async executeOnce(_admission, execute) {
            await execute();
            throw new Error("fixture host loss");
          },
        }));
      },
    });
    const hostLossResult = await createStore(hostLoss).effectPort.admitAndExecute(
      hostLossPrepared.claim,
      hostLossPrepared.value,
      hostLossPrepared.namespaceClaim,
      "prepare-stage",
      async () => { hostLossEffects++; return "host-loss-effect"; },
    );
    const hostLossAfter = await store.effectPort.load(
      hostLossPrepared.claim, hostLossPrepared.namespaceClaim,
    );
    value = {
      preparingFailure,
      preparingAfter,
      publishingFailure,
      publishingAfter,
      hostLossResult,
      hostLossEffects,
      hostLossAfter,
    };
  } else if (payload.scenario === "expired-scope") {
    const publicPrepareClaim = binding("expired_public_prepare");
    const publicPrepare = await expireAt(4, (expiring) =>
      expiring.prepare(requestFor(publicPrepareClaim)));

    const publicMarkPrepared = await prepare(store, "expired_public_mark");
    const publicMark = await expireAt(5, (expiring) =>
      expiring.markPrepared(requestFor(publicMarkPrepared.claim)));

    const publicFailPrepared = await prepare(store, "expired_public_fail");
    const publicFail = await expireAt(5, (expiring) =>
      expiring.fail(requestFor(publicFailPrepared.claim), "preparing", "stage-failed"));

    const privatePrepareClaim = binding("expired_private_prepare");
    const privatePrepareNamespace = namespace("expired_private_prepare");
    const privatePrepare = await expireAt(5, (expiring) =>
      expiring.effectPort.prepare(privatePrepareClaim, privatePrepareNamespace));

    const privateTransitionPrepared = await prepare(store, "expired_private_transition");
    const privateTransition = await expireAt(6, (expiring) =>
      expiring.effectPort.transition(
        privateTransitionPrepared.claim,
        privateTransitionPrepared.value,
        privateTransitionPrepared.namespaceClaim,
        "preparing",
        "prepared",
      ));

    const admissionPrepared = await prepare(store, "expired_admission");
    let admissionEffects = 0;
    const admission = await expireAt(3, (expiring) =>
      expiring.effectPort.admitAndExecute(
        admissionPrepared.claim,
        admissionPrepared.value,
        admissionPrepared.namespaceClaim,
        "prepare-stage",
        async () => { admissionEffects++; },
      ));

    value = {
      publicPrepare,
      publicPreparePhase: await phaseFor(publicPrepareClaim.operationId),
      publicMark,
      publicMarkPhase: await phaseFor(publicMarkPrepared.claim.operationId),
      publicFail,
      publicFailPhase: await phaseFor(publicFailPrepared.claim.operationId),
      privatePrepare,
      privatePreparePhase: await phaseFor(privatePrepareClaim.operationId),
      privateTransition,
      privateTransitionPhase: await phaseFor(privateTransitionPrepared.claim.operationId),
      admission,
      admissionEffects,
      admissionPhase: await phaseFor(admissionPrepared.claim.operationId),
    };
  } else {
    throw new Error(`unsupported scenario: ${payload.scenario}`);
  }

  await closeDbExec();
  await new Promise((resolve, reject) => process.send({ type: "result", value },
    (error) => error ? reject(error) : resolve()));
  process.exit(0);
}

function startWorker(directory) {
  const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
    "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"];
  const env = Object.fromEntries(retained.filter((key) => process.env[key]) // guard:allow-env-credential - Fixed OS launch paths for the fixture child.
    .map((key) => [key, process.env[key]])); // guard:allow-env-credential — Fixed OS launch-path allowlist.
  Object.assign(env, {
    VIVARY_CREATION_EFFECT_WORKER: "1",
    VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential — Test dependency manifest path; no credential value.
    DATABASE_URL: `file:${path.join(directory, "registry.sqlite")}`,
    NODE_ENV: "test",
  });
  const child = fork(TEST_FILE, [], {
    cwd: directory,
    env,
    execArgv: ["--max-old-space-size=128"],
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const owned = activeChildren.get(directory) ?? new Set();
  activeChildren.set(directory, owned);
  const record = { child, closed: null };
  record.closed = new Promise((resolve) => child.once("close", () => {
    owned.delete(record);
    resolve();
  }));
  owned.add(record);
  let diagnostic = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-16000);
  });
  let received;
  let sent = false;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const completion = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("creation effect worker exceeded 30 seconds"));
    }, 30000);
    child.on("message", (message) => {
      if (message.type === "ready") readyResolve();
      else if (message.type === "result") received = message.value;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      readyReject(error);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || received === undefined) {
        const error = new Error(`creation effect worker failed (${code}): ${diagnostic}`);
        readyReject(error);
        reject(error);
      } else resolve(received);
    });
  });
  completion.catch(() => {});
  return {
    ready,
    completion,
    send(payload) {
      assert.equal(sent, false);
      sent = true;
      child.send(payload);
    },
  };
}

async function run(directory, payload) {
  const child = startWorker(directory);
  await child.ready;
  child.send(payload);
  return child.completion;
}

async function sandbox(check) {
  assert.ok(process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential - Reviewed Core dependency manifest path.
    "set the explicit existing native dependency root"); // guard:allow-env-credential — Test dependency manifest path; no credential value.
  const configuredRoot = process.env.VIVARY_REGISTRY_PROOF_ROOT; // guard:allow-env-credential — Disposable task-owned path; no credential value.
  assert.ok(configuredRoot && path.isAbsolute(configuredRoot),
    "set an absolute task-owned proof root");
  const proofRoot = await realpath(configuredRoot);
  const directory = await mkdtemp(path.join(proofRoot, "case-"));
  try {
    await check(directory);
  } finally {
    const remaining = [...(activeChildren.get(directory) ?? [])];
    for (const { child } of remaining) {
      if (child.pid && child.exitCode === null && child.signalCode === null) child.kill();
    }
    await Promise.all(remaining.map((record) => record.closed));
    activeChildren.delete(directory);
    const resolved = await realpath(directory);
    const relative = path.relative(proofRoot, resolved);
    assert.equal(path.dirname(relative), ".");
    assert.ok(path.basename(relative).startsWith("case-") && !path.isAbsolute(relative));
    await rm(resolved, { recursive: true, force: true });
  }
}

if (process.env.VIVARY_CREATION_EFFECT_WORKER === "1") { // guard:allow-env-credential — Test child-mode flag; no credential value.
  await worker();
} else {
  test("private snapshots survive a fresh connection while the default host only permits historical reads", async () => sandbox(async (dir) => {
    const prepared = await run(dir, { migrate: true, scenario: "prepare" });
    const expected = snapshot(binding("a"), "preparing", namespace("a"));
    assert.deepEqual(prepared.value, expected);
    const reopened = await run(dir, { scenario: "fresh-load-default" });
    assert.deepEqual(reopened.loaded, expected);
    assert.deepEqual(reopened.unchanged, expected);
    assert.equal(reopened.historical.output.code, "preparing");
    assert.equal(reopened.historical.output.replayed, true);
    assert.equal(Object.hasOwn(reopened.historical.output, "namespace"), false);
    assert.deepEqual(reopened.refusedMutation.output, {
      code: "recovery-required",
      reason: "creation-host-unavailable",
    });
    assert.deepEqual(reopened.refusedPrivateLoad, refusal("creation-host-unavailable", null));
  }));

  test("altered binding, phase, stage and continuity claims refuse, and failed rows never load", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "claims" });
    assert.equal(value.prepared.phase, "preparing");
    assert.equal(value.changedBinding.code, "operation-conflict");
    assert.equal(value.changedStage.reason, "creation-continuity-lost");
    assert.equal(value.changedContinuity.reason, "creation-continuity-lost");
    assert.equal(value.forgedPhase.reason, "creation-effect-not-authorized");
    assert.equal(value.wrongEffect.reason, "creation-effect-not-authorized");
    assert.equal(value.failed.output.code, "creation-failed");
    assert.deepEqual(value.failedLoad, {
      code: "creation-failed",
      reason: "stage-failed",
      phase: "failed",
    });
    assert.equal(value.callbacks, 0);
  }));

  test("only the exact three effect and phase pairs execute after the Native transaction closes", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "pairs" });
    assert.deepEqual(value.results, [
      { effect: "prepare-stage", phase: "preparing", result: "completed-prepare-stage" },
      { effect: "publish", phase: "publishing", result: "completed-publish" },
      { effect: "recover-publication", phase: "publishing", result: "completed-recover-publication" },
    ]);
    for (const { effect, phase } of value.results) {
      const suffix = effect.replaceAll("-", "_");
      const expectedClaim = binding(suffix);
      const expectedNamespace = namespace(suffix);
      assert.ok(value.events.some((event) => event[0] === "guard-admission"
        && event[1].effect === effect
        && JSON.stringify(event[1]) === JSON.stringify({
          binding: expectedClaim,
          snapshot: snapshot(expectedClaim, phase, expectedNamespace),
          namespace: expectedNamespace,
          effect,
        })));
      const admitted = value.events.findIndex((event) => event[0] === "guard-admit"
        && event[1] === effect);
      const callback = value.events.findIndex((event) => event[0] === "callback"
        && event[1] === effect && event[2] === phase);
      const settled = value.events.findIndex((event) => event[0] === "guard-settled"
        && event[1] === effect);
      assert.ok(admitted >= 0 && admitted < callback && callback < settled);
    }
  }));

  test("coordinated revocation and disconnect prevent every pre-admission callback", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "revocation-disconnect" });
    assert.equal(value.afterRevocation.code, "denied");
    assert.equal(value.afterDisconnect.code, "recovery-required");
    assert.equal(value.afterDisconnect.reason, "creation-admission-disconnected");
    assert.equal(value.callbacks, 0);
  }));

  test("a pending effect holds phase writers and invalidation across stores until settlement", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "pending" });
    assert.deepEqual(value.whilePending, {
      admissionSettled: false,
      mutationSettled: false,
      invalidationSettled: false,
    });
    assert.equal(value.unscoped.output.code, "recovery-required");
    assert.equal(value.unscoped.output.reason, "creation-host-unavailable");
    assert.equal(value.admission, "published-effect");
    assert.equal(value.mutation.output.code, "published");
    assert.equal(value.memberAfterInvalidation, false);
    const callbackFinish = value.events.findIndex((event) => event[0] === "callback-finish");
    const secondScope = value.events.findIndex((event, index) => index > callbackFinish
      && event[0] === "scope-enter");
    const revocation = value.events.findIndex((event) => event[0] === "revoke-enter");
    assert.ok(callbackFinish >= 0 && secondScope > callbackFinish && revocation > secondScope);
  }));

  test("duplicate, retained and early-return callbacks cannot report success", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "adversarial" });
    assert.equal(value.duplicate.reason, "creation-effect-uncertain");
    assert.equal(value.duplicateEffects, 1);
    assert.equal(value.late.reason, "creation-admission-disconnected");
    assert.equal(value.lateEffects, 0);
    assert.equal(value.lateRejected, true);
    assert.equal(value.earlyBeforeRelease, false);
    assert.equal(value.early.reason, "creation-effect-uncertain");
  }));

  test("callback failure and host loss preserve the durable preparing or publishing phase", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "failures" });
    assert.equal(value.preparingFailure.reason, "creation-effect-uncertain");
    assert.equal(value.preparingAfter.phase, "preparing");
    assert.equal(value.publishingFailure.reason, "creation-effect-uncertain");
    assert.equal(value.publishingAfter.phase, "publishing");
    assert.equal(value.hostLossResult.reason, "creation-effect-uncertain");
    assert.equal(value.hostLossEffects, 1);
    assert.equal(value.hostLossAfter.phase, "preparing");
  }));

  test("an early-returned host expires paused callbacks before effects and rolls back staged mutations", async () => sandbox(async (dir) => {
    const value = await run(dir, { migrate: true, scenario: "expired-scope" });
    for (const result of [
      value.publicPrepare,
      value.publicMark,
      value.publicFail,
    ]) {
      assert.equal(result.output.code, "recovery-required");
      assert.equal(result.output.reason, "creation-host-unavailable");
    }
    for (const result of [
      value.privatePrepare,
      value.privateTransition,
      value.admission,
    ]) {
      assert.equal(result.code, "recovery-required");
      assert.equal(result.reason, "creation-host-unavailable");
    }
    assert.equal(value.publicPreparePhase, null);
    assert.equal(value.publicMarkPhase, "preparing");
    assert.equal(value.publicFailPhase, "preparing");
    assert.equal(value.privatePreparePhase, null);
    assert.equal(value.privateTransitionPhase, "preparing");
    assert.equal(value.admissionEffects, 0);
    assert.equal(value.admissionPhase, "preparing");
  }));
}
