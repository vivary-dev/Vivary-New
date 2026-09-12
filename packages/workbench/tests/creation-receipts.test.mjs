import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_FILE = fileURLToPath(import.meta.url);
const activeChildren = new Map();
const PLAN = `sha256:${"a".repeat(64)}`;
const request = (patch = {}) => ({
  operationId: "operation-a",
  parentRef: "parent-a",
  childName: "example",
  acceptedPlanSha256: PLAN,
  expectedPolicyRevision: 1,
  ...patch,
});
const authority = (patch = {}) => ({
  actorId: "actor-a",
  collectionId: "collection-a",
  deviceId: "device-a",
  policyRevision: 1,
  member: true,
  capabilities: ["create-child"],
  creatableParents: ["parent-a"],
  ...patch,
});
const continuity = (patch = {}) => ({
  parentRef: "parent-a",
  namespaceKey: "namespace-a",
  childKey: "child-example",
  stageId: "stage-a",
  continuityId: "continuity-a",
  exclusiveControl: true,
  ...patch,
});
const syntheticCreationHost = Object.freeze({
  async withCreationScope(_scope, callback) {
    return callback(Object.freeze({
      executeOnce: async (_expectedAdmission, execute) => execute(),
    }));
  },
});

async function worker() {
  register(new URL("./native-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential — Test dependency manifest path; no credential value.
  });
  const { withMigrationRuntime, getDbExec, closeDbExec } = await import("@agent-native/core/db");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const { getDb } = await import("../server/db/index.mjs");
  const schema = await import("../server/db/schema.mjs");
  const { createCreationReceiptStore } = await import("../server/creation-receipts.mjs");
  process.send({ type: "ready" });
  const payload = await new Promise((resolve) => process.once("message", resolve));
  if (payload.migrate) await withMigrationRuntime(() => migrateRegistry());
  if (payload.abortUpdate) {
    await getDbExec().execute(`CREATE TRIGGER fixture_abort_creation_update
      BEFORE UPDATE OF creation_phase ON vivary_registry_receipts
      WHEN OLD.operation = 'create'
      BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END`);
  }
  let factCalls = 0;
  let namespaceCalls = 0;
  let revokedByNamespace = false;
  const options = {
    creationHost: syntheticCreationHost,
    resolveFacts: async () => {
      factCalls++;
      const patch = revokedByNamespace || payload.revokeAt === factCalls
        ? { member: false }
        : (payload.authorityPatch ?? {});
      return authority(patch);
    },
  };
  if (!payload.useDefaultNamespace) options.resolveNamespace = async () => {
    namespaceCalls++;
    if (payload.namespaceUnavailable) return null;
    if (payload.revokeOnNamespaceAt === namespaceCalls) revokedByNamespace = true;
    return continuity(payload.lostContinuity || payload.loseNamespaceAt === namespaceCalls
      ? { continuityId: "continuity-replaced" }
      : (payload.namespacePatch ?? {}));
  };
  const store = createCreationReceiptStore(options);

  async function invoke(action, item = payload.request ?? request()) {
    if (action === "prepare") return store.prepare(item);
    if (action === "read") return store.read(item);
    if (action === "prepared") return store.markPrepared(item);
    if (action === "publishing") return store.markPublishing(item);
    if (action === "published") return store.markPublished(item);
    if (action === "failed") return store.fail(item, payload.expectedPhase, payload.failureCode);
    throw new Error(`unsupported creation receipt action: ${action}`);
  }

  let value = {};
  try {
    if (payload.action === "request-sequence") {
      value.decisions = [];
      for (const item of payload.requests) value.decisions.push(await invoke("prepare", item));
    } else if (payload.action === "sequence") {
      value.decisions = [];
      for (const action of payload.actions) value.decisions.push(await invoke(action));
    } else if (payload.action && payload.action !== "snapshot" && payload.action !== "register") {
      value.decision = await invoke(payload.action);
    }
    if (payload.action === "register") {
      const fixture = JSON.parse(await readFile(new URL(
        "../../../docs/product/multi-project/fixtures/project-registry.json", import.meta.url,
      ), "utf8"));
      const { createRegistryStore } = await import("../server/registry-store.mjs");
      const { evaluateRegistryOperation } = await import("../../../scripts/registry_contract_model.mjs");
      const FACTS = ["actorId", "collectionId", "deviceId", "member", "capabilities",
        "rootAccess", "policyRevision", "root", "overlapSafe"];
      const facts = Object.fromEntries(FACTS.map((key) => [key, fixture.inputs.register.trusted[key]]));
      const registry = createRegistryStore({
        resolveFacts: async () => facts,
        allocateIds: async () => ({ projectId: "project-new", bindingId: "binding-new" }),
        evaluate: evaluateRegistryOperation,
      });
      value.decision = await registry.register({
        ...fixture.inputs.register.request,
        expectedRegistryRevision: 0,
      });
    }
  } catch (error) {
    if (!payload.expectFailure) throw error;
    value = { failed: true, errorCode: error.cause?.code ?? error.code ?? error.name };
  }
  if (payload.snapshot || payload.action === "snapshot") {
    value.snapshot = await getDb().transaction(async (tx) => ({
      projects: await tx.select().from(schema.projects),
      bindings: await tx.select().from(schema.bindings),
      receipts: await tx.select().from(schema.receipts),
      revisions: await tx.select().from(schema.revisions),
    }));
  }
  value.factCalls = factCalls;
  value.namespaceCalls = namespaceCalls;
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
    VIVARY_CREATION_RECEIPT_WORKER: "1",
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
      reject(new Error("creation receipt worker exceeded 30 seconds"));
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
        const error = new Error(`creation receipt worker failed (${code}): ${diagnostic}`);
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

if (process.env.VIVARY_CREATION_RECEIPT_WORKER === "1") { // guard:allow-env-credential — Test child-mode flag; no credential value.
  await worker();
} else {
  test("creation intent survives restart and a changed operation is refused", async () => sandbox(async (dir) => {
    const first = await run(dir, { migrate: true, action: "prepare", snapshot: true });
    assert.equal(first.decision.output.phase, "preparing");
    assert.equal(first.decision.output.replayed, false);
    assert.equal(first.snapshot.receipts.length, 1);
    const reopened = await run(dir, { action: "read", snapshot: true });
    assert.equal(reopened.decision.output.phase, "preparing");
    assert.equal(reopened.decision.output.replayed, true);
    assert.deepEqual(reopened.snapshot, first.snapshot);
    const changed = await run(dir, {
      action: "prepare",
      request: request({ childName: "changed" }),
      namespacePatch: { childKey: "child-changed" },
      snapshot: true,
    });
    assert.equal(changed.decision.output.code, "operation-conflict");
    assert.deepEqual(changed.snapshot, first.snapshot);
  }));

  test("independent processes reserve one target while sibling targets remain available", async () => sandbox(async (dir) => {
    await run(dir, { migrate: true, action: "snapshot" });
    const contenders = [startWorker(dir), startWorker(dir)];
    await Promise.all(contenders.map((child) => child.ready));
    contenders[0].send({ action: "prepare", request: request({ operationId: "operation-a" }) });
    contenders[1].send({ action: "prepare", request: request({ operationId: "operation-b" }) });
    const results = await Promise.all(contenders.map((child) => child.completion));
    assert.deepEqual(results.map((item) => item.decision.output.code).sort(),
      ["preparing", "target-reserved"]);
    const sibling = await run(dir, {
      action: "prepare",
      request: request({ operationId: "operation-c", childName: "other" }),
      namespacePatch: { childKey: "child-other" },
    });
    assert.equal(sibling.decision.output.code, "preparing");
    const sameChildInAnotherNamespace = await run(dir, {
      action: "prepare",
      request: request({ operationId: "operation-d" }),
      namespacePatch: { namespaceKey: "namespace-other", stageId: "stage-other" },
    });
    assert.equal(sameChildInAnotherNamespace.decision.output.code, "preparing");
    const { snapshot } = await run(dir, { action: "snapshot" });
    assert.equal(snapshot.receipts.length, 3);
    assert.ok(snapshot.receipts.every((row) => row.operation === "create"));
  }));

  test("callers cannot submit authority or namespace facts", async () => sandbox(async (dir) => {
    const refused = await run(dir, {
      migrate: true,
      action: "prepare",
      request: { ...request(), namespaceKey: "caller-selected", capabilities: ["create-child"] },
    });
    assert.equal(refused.decision.output.code, "invalid-input");
    assert.equal(refused.factCalls, 0);
    assert.equal(refused.namespaceCalls, 0);
    const wrongType = await run(dir, {
      action: "prepare",
      request: request({ operationId: 123 }),
    });
    assert.equal(wrongType.decision.output.code, "invalid-input");
    assert.equal(wrongType.factCalls, 0);
    assert.equal(wrongType.namespaceCalls, 0);
  }));

  test("strict request boundaries refuse final newlines and trailing dots before resolution or storage", async () => sandbox(async (dir) => {
    const invalid = [
      { operationId: "operation-a\n" },
      { parentRef: "parent-a\n" },
      { childName: "example\n" },
      { childName: "trailing." },
      { acceptedPlanSha256: `${PLAN}\n` },
      { operationId: "a".repeat(129) },
      { childName: "a".repeat(129) },
    ];
    const refused = await run(dir, {
      action: "request-sequence",
      requests: invalid.map((patch) => request(patch)),
    });
    assert.ok(refused.decisions.every((item) => item.output.code === "invalid-input"));
    assert.equal(refused.factCalls, 0);
    assert.equal(refused.namespaceCalls, 0);
    const parentRef = "p".repeat(128);
    const accepted = await run(dir, {
      migrate: true,
      action: "prepare",
      request: request({
        operationId: "o".repeat(128),
        parentRef,
        childName: "c".repeat(128),
      }),
      authorityPatch: { creatableParents: [parentRef] },
      namespacePatch: { parentRef },
    });
    assert.equal(accepted.decision.output.code, "preparing");
  }));

  test("phase changes are exact CAS operations and terminal failures retain identity", async () => sandbox(async (dir) => {
    const values = await run(dir, {
      migrate: true,
      action: "sequence",
      actions: ["prepare", "publishing", "prepared", "prepared", "failed", "prepare"],
      expectedPhase: "prepared",
      failureCode: "verification-failed",
      snapshot: true,
    });
    assert.deepEqual(values.decisions.map((item) => item.output.code), [
      "preparing", "stale-phase", "prepared", "stale-phase", "creation-failed",
      "creation-failed",
    ]);
    assert.equal(values.snapshot.receipts.length, 1);
    assert.equal(values.snapshot.receipts[0].creationPhase, "failed");
  }));

  test("concurrent phase contenders admit exactly one compare-and-set", async () => sandbox(async (dir) => {
    await run(dir, { migrate: true, action: "prepare" });
    const contenders = [startWorker(dir), startWorker(dir)];
    await Promise.all(contenders.map((child) => child.ready));
    for (const contender of contenders) contender.send({ action: "prepared" });
    const results = await Promise.all(contenders.map((child) => child.completion));
    const codes = results.map((item) => item.decision.output.code);
    assert.equal(codes.filter((code) => code === "prepared").length, 1);
    assert.ok(codes.every((code) => ["prepared", "stale-phase", "retry-state"].includes(code)));
    const { snapshot } = await run(dir, { action: "snapshot" });
    assert.equal(snapshot.receipts.length, 1);
    assert.equal(snapshot.receipts[0].creationPhase, "prepared");
  }));

  test("revocation after CAS rolls the phase back", async () => sandbox(async (dir) => {
    await run(dir, { migrate: true, action: "prepare" });
    const denied = await run(dir, {
      action: "prepared",
      revokeAt: 4,
      snapshot: true,
    });
    assert.equal(denied.decision.output.code, "denied");
    assert.equal(denied.snapshot.receipts[0].creationPhase, "preparing");
  }));

  test("lost or unconfigured namespace continuity requires recovery without mutation", async () => sandbox(async (dir) => {
    const unavailable = await run(dir, {
      migrate: true,
      action: "prepare",
      useDefaultNamespace: true,
      snapshot: true,
    });
    assert.equal(unavailable.decision.output.code, "recovery-required");
    assert.equal(unavailable.snapshot.receipts.length, 0);
    await run(dir, { action: "prepare" });
    const lost = await run(dir, {
      action: "prepared",
      lostContinuity: true,
      snapshot: true,
    });
    assert.equal(lost.decision.output.code, "recovery-required");
    assert.equal(lost.decision.output.reason, "creation-continuity-lost");
    assert.equal(lost.snapshot.receipts[0].creationPhase, "preparing");
  }));

  test("namespace changes after insert or phase CAS roll the transaction back", async () => sandbox(async (dir) => {
    const insertLost = await run(dir, {
      migrate: true,
      action: "prepare",
      loseNamespaceAt: 2,
      snapshot: true,
    });
    assert.equal(insertLost.decision.output.code, "recovery-required");
    assert.equal(insertLost.decision.output.reason, "creation-continuity-lost");
    assert.equal(insertLost.snapshot.receipts.length, 0);
    await run(dir, { action: "prepare" });
    const transitionLost = await run(dir, {
      action: "prepared",
      loseNamespaceAt: 2,
      snapshot: true,
    });
    assert.equal(transitionLost.decision.output.code, "recovery-required");
    assert.equal(transitionLost.decision.output.reason, "creation-continuity-lost");
    assert.equal(transitionLost.snapshot.receipts[0].creationPhase, "preparing");
  }));

  test("authority revoked by final namespace revalidation rolls the mutation back", async () => sandbox(async (dir) => {
    const denied = await run(dir, {
      migrate: true,
      action: "prepare",
      revokeOnNamespaceAt: 2,
      snapshot: true,
    });
    assert.equal(denied.decision.output.code, "denied");
    assert.equal(denied.snapshot.receipts.length, 0);
  }));

  test("adapter failure during a transition preserves the prior durable phase", async () => sandbox(async (dir) => {
    await run(dir, { migrate: true, action: "prepare" });
    const failed = await run(dir, {
      abortUpdate: true,
      action: "prepared",
      expectFailure: true,
      snapshot: true,
    });
    assert.equal(failed.failed, true);
    const { snapshot } = await run(dir, { action: "snapshot" });
    assert.equal(snapshot.receipts[0].creationPhase, "preparing");
  }));

  test("published replay requires current membership but not a creation grant or namespace", async () => sandbox(async (dir) => {
    const first = await run(dir, {
      migrate: true,
      action: "sequence",
      actions: ["prepare", "prepared", "publishing", "published"],
      snapshot: true,
    });
    assert.equal(first.decisions.at(-1).output.code, "published");
    const denied = await run(dir, {
      action: "prepare",
      authorityPatch: { member: false, capabilities: [], creatableParents: [] },
      namespaceUnavailable: true,
      snapshot: true,
    });
    assert.equal(denied.decision.output.code, "denied");
    assert.equal(denied.namespaceCalls, 0);
    assert.deepEqual(denied.snapshot, first.snapshot);
    const revokedDuringRead = await run(dir, {
      action: "prepare",
      revokeAt: 2,
      namespaceUnavailable: true,
      snapshot: true,
    });
    assert.equal(revokedDuringRead.decision.output.code, "denied");
    assert.equal(revokedDuringRead.namespaceCalls, 0);
    assert.deepEqual(revokedDuringRead.snapshot, first.snapshot);
    const replay = await run(dir, {
      action: "prepare",
      authorityPatch: { policyRevision: 2, capabilities: [], creatableParents: [] },
      namespaceUnavailable: true,
      snapshot: true,
    });
    assert.equal(replay.decision.output.code, "published");
    assert.equal(replay.decision.output.replayed, true);
    assert.equal(replay.namespaceCalls, 0);
    assert.deepEqual(replay.snapshot, first.snapshot);
  }));

  test("registration records retain their existing behavior beside creation receipts", async () => sandbox(async (dir) => {
    const created = await run(dir, { migrate: true, action: "prepare", snapshot: true });
    assert.equal(created.snapshot.receipts.length, 1);
    const registered = await run(dir, { action: "register", snapshot: true });
    assert.equal(registered.decision.output.code, "registered");
    assert.equal(registered.snapshot.projects.length, 1);
    assert.equal(registered.snapshot.bindings.length, 1);
    assert.equal(registered.snapshot.revisions[0].revision, 1);
    assert.deepEqual(registered.snapshot.receipts.map((row) => row.operation).sort(),
      ["create", "register"]);
    const registration = registered.snapshot.receipts.find((row) => row.operation === "register");
    assert.equal(registration.creationNamespaceKey, null);
    assert.equal(registration.creationChildKey, null);
    assert.equal(registration.creationPhase, null);
  }));
}
