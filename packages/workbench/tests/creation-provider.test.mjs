import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { access, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CREATION_WORKER_QUIESCENT,
  startCreationProvider,
} from "../server/creation-provider.mjs";
import { parseStrictJson } from "../../../scripts/registry_contract_model.mjs";

const TEST_FILE = fileURLToPath(import.meta.url);
const PYTHON_FIXTURE = fileURLToPath(new URL(
  "../../core/tests/fixtures/creation_provider_fixture.py", import.meta.url,
));
const PYTHON_PROVIDER = fileURLToPath(new URL(
  "../../core/vivary_core/creation_provider_stdio.py", import.meta.url,
));
const activeChildren = new Map();
const NORMAL_LIMITS = Object.freeze({
  frameBytes: 16 * 1024, rpcMs: 5_000, effectMs: 20_000, applyMs: 60_000, stopMs: 5_000,
});
const FAULT_LIMITS = Object.freeze({
  frameBytes: 16 * 1024, rpcMs: 300, effectMs: 500, applyMs: 2_000, stopMs: 300,
});
const PYTHON_HANG_BEFORE_LIMITS = Object.freeze({
  ...NORMAL_LIMITS,
  effectMs: FAULT_LIMITS.effectMs,
  applyMs: FAULT_LIMITS.applyMs,
  stopMs: FAULT_LIMITS.stopMs,
});
const PYTHON_HANG_DURING_LIMITS = Object.freeze({
  ...NORMAL_LIMITS,
  effectMs: FAULT_LIMITS.effectMs,
  stopMs: FAULT_LIMITS.stopMs,
});
const authority = (patch = {}) => ({
  actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
  policyRevision: 7, member: true, capabilities: ["create-child"],
  creatableParents: ["fixture-parent"], ...patch,
});
const namespace = Object.freeze({
  parentRef: "fixture-parent", namespaceKey: "fixture-namespace",
  childKey: "fixture-child", stageId: "fixture-stage",
  continuityId: "fixture-continuity", exclusiveControl: true,
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixtureLifecycle({ python, directory, behavior = "normal", refuseStop = false }) {
  const controller = { child: null, pid: null, stopCalls: 0 };
  return {
    controller,
    lifecycle: {
      async start() {
        const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
          "HOME", "USERPROFILE"];
        const env = Object.fromEntries(retained.filter((key) => process.env[key]) // guard:allow-env-credential - Fixed OS launch paths for the fixture child.
          .map((key) => [key, process.env[key]])); // guard:allow-env-credential — Fixed launch-path allowlist.
        Object.assign(env, {
          VIVARY_CREATION_FIXTURE_ROOT: directory,
          VIVARY_CREATION_FIXTURE_BEHAVIOR: behavior,
        });
        const child = spawn(python, ["-I", "-B", "-u", PYTHON_FIXTURE], {
          cwd: "/", env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
        });
        controller.child = child;
        controller.pid = child.pid;
        process.send?.({ type: "python-started", pid: child.pid });
        let diagnostics = "";
        child.stderr.on("data", (chunk) => {
          diagnostics = (diagnostics + chunk.toString()).slice(-8_000);
        });
        const closed = new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (code, signal) => resolve({ code, signal, diagnostics }));
        });
        const quiescence = closed.then(() => {
          assert.throws(() => process.kill(controller.pid, 0), { code: "ESRCH" });
          return CREATION_WORKER_QUIESCENT;
        });
        controller.killAndConfirm = async () => {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          return quiescence;
        };
        return {
          readable: child.stdout, writable: child.stdin, quiescence,
          async stopAndConfirmQuiescent(timeoutMs) {
            controller.stopCalls += 1;
            if (refuseStop) return null;
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
            return Promise.race([quiescence, delay(timeoutMs, null, { ref: false })]);
          },
        };
      },
    },
  };
}

function lockingCreationHost(effectStarted, onEffect, scopeContended) {
  let tail = Promise.resolve();
  let held = false;
  return Object.freeze({
    async withCreationScope(_scope, callback) {
      const previous = tail;
      const release = deferred();
      tail = previous.then(() => release.promise);
      if (held) scopeContended?.resolve();
      await previous;
      held = true;
      try {
        return await callback(Object.freeze({
          executeOnce: async (admission, execute) => {
            if (admission?.effect) {
              onEffect?.(admission.effect);
              effectStarted?.resolve();
            }
            return execute();
          },
        }));
      } finally {
        held = false;
        release.resolve();
      }
    },
  });
}

async function databaseSnapshot(getDb, schema) {
  return getDb().transaction(async (tx) => ({
    receipts: await tx.select().from(schema.receipts),
    projects: await tx.select().from(schema.projects),
    bindings: await tx.select().from(schema.bindings),
  }));
}

async function worker() {
  register(new URL("./native-dependency-loader.mjs", import.meta.url), {
    data: { corePackageJson: process.env.VIVARY_TEST_CORE_PACKAGE_JSON }, // guard:allow-env-credential — Dependency manifest path only.
  });
  const { withMigrationRuntime, closeDbExec } = await import("@agent-native/core/db");
  const { migrateRegistry } = await import("../server/db/migrations.mjs");
  const { getDb } = await import("../server/db/index.mjs");
  const schema = await import("../server/db/schema.mjs");
  const { createCreationReceiptStore } = await import("../server/creation-receipts.mjs");
  const payload = await new Promise((resolve) => {
    process.send({ type: "ready" });
    process.once("message", resolve);
  });
  await withMigrationRuntime(() => migrateRegistry());
  const effectStarted = deferred();
  const scopeContended = deferred();
  const effects = [];
  let facts = authority(payload.revokedInitially ? { member: false } : {});
  let factReads = 0;
  const resolveFacts = async () => {
    factReads += 1;
    return facts;
  };
  const store = createCreationReceiptStore({
    creationHost: lockingCreationHost(
      effectStarted, (effect) => effects.push(effect), scopeContended,
    ), resolveFacts,
    resolveNamespace: async () => namespace,
  });
  const fixture = fixtureLifecycle({
    python: process.env.VIVARY_TEST_PYTHON, // guard:allow-env-credential - Reviewed Python executable path for the fixture.
    directory: payload.directory,
    behavior: payload.behavior,
    refuseStop: payload.refuseStop,
  });
  // Real Python initialization keeps production-like RPC time. Short deadlines
  // arm only after apply/effect entry has established the intended fault phase.
  const limits = payload.behavior === "hang-before-effect" ? PYTHON_HANG_BEFORE_LIMITS
    : payload.behavior === "hang-during-effect" ? PYTHON_HANG_DURING_LIMITS
      : NORMAL_LIMITS;
  const provider = await startCreationProvider({
    effectPort: store.effectPort, resolveFacts, lifecycle: fixture.lifecycle,
    parseStrictJson, limits,
  });
  const preview = JSON.parse(await readFile(path.join(payload.directory, "accepted-plan.json"), "utf8"));
  const claims = {
    operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
    acceptedPlanSha256: preview.acceptedPlanSha256, expectedPolicyRevision: 7,
    preset: "coding", adapters: [], activeContext: null,
    ...(payload.claimsPatch ?? {}),
  };

  let result;
  let blocked = false;
  if (payload.action === "quarantine") {
    const pending = provider.apply(claims);
    await effectStarted.promise;
    await delay(limits.effectMs + limits.stopMs + 100);
    assert.equal(provider.readiness().status, "quarantined");
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    assert.equal(fixture.controller.child.exitCode, null);
    await fixture.controller.killAndConfirm();
    result = await pending;
  } else if (payload.action === "contend") {
    const pending = provider.apply(claims);
    await effectStarted.promise;
    const transition = store.markPrepared({
      operationId: claims.operationId, parentRef: claims.parentRef,
      childName: claims.childName, acceptedPlanSha256: claims.acceptedPlanSha256,
      expectedPolicyRevision: claims.expectedPolicyRevision,
    });
    await Promise.race([
      scopeContended.promise,
      delay(2_000).then(() => { throw new Error("phase mutation did not reach host custody"); }),
    ]);
    facts = authority({ member: false });
    blocked = await Promise.race([transition.then(() => false), delay(100, true)]);
    await fixture.controller.killAndConfirm();
    result = await pending;
    const denied = await transition;
    assert.equal(denied.output.code, "denied");
  } else {
    result = await provider.apply(claims);
  }
  const second = await provider.apply(claims);
  const snapshot = await databaseSnapshot(getDb, schema);
  let targetPresent = true;
  try {
    await access(path.join(payload.directory, "parent", "example"));
  } catch {
    targetPresent = false;
  }
  if (fixture.controller.child.exitCode === null && fixture.controller.child.signalCode === null) {
    await fixture.controller.killAndConfirm();
  }
  await provider.close();
  await closeDbExec();
  process.send({
    type: "result",
    value: {
      result, second, snapshot, factReads, blocked,
      pid: fixture.controller.pid, stopCalls: fixture.controller.stopCalls, effects, targetPresent,
    },
  }, () => process.exit(0));
}

function startWorker(directory, payload) {
  const retained = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP",
    "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"];
  const env = Object.fromEntries(retained.filter((key) => process.env[key]) // guard:allow-env-credential - Fixed OS launch paths for the fixture child.
    .map((key) => [key, process.env[key]])); // guard:allow-env-credential — Fixed OS launch-path allowlist.
  Object.assign(env, {
    VIVARY_CREATION_PROVIDER_WORKER: "1",
    VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON, // guard:allow-env-credential - Reviewed Core dependency manifest path.
    VIVARY_TEST_PYTHON: process.env.VIVARY_TEST_PYTHON, // guard:allow-env-credential - Reviewed Python executable path for the fixture.
    DATABASE_URL: `file:${path.join(directory, "registry.sqlite")}`,
    NODE_ENV: "test",
  });
  const child = fork(TEST_FILE, [], {
    cwd: directory, env, execArgv: ["--max-old-space-size=128", "--import",
      fileURLToPath(new URL("./register-native-dependencies.mjs", import.meta.url))], windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const record = { child, closed: null, pythonPid: null };
  const owned = activeChildren.get(directory) ?? new Set();
  activeChildren.set(directory, owned);
  record.closed = new Promise((resolve) => child.once("close", resolve));
  owned.add(record);
  let diagnostics = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
    diagnostics = (diagnostics + chunk.toString()).slice(-16_000);
  });
  return new Promise((resolve, reject) => {
    let received;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`creation provider worker timed out: ${diagnostics}`));
    }, payload.behavior?.startsWith("hang") ? 20_000 : 90_000);
    child.on("message", (message) => {
      if (message.type === "ready") child.send({ ...payload, directory });
      if (message.type === "python-started") record.pythonPid = message.pid;
      if (message.type === "result") {
        received = message.value;
      }
    });
    child.on("error", reject);
    child.on("exit", async (code) => {
      clearTimeout(timeout);
      const childAbsent = record.pythonPid !== null
        && await waitPidAbsent(record.pythonPid, 2_000);
      if (childAbsent) owned.delete(record);
      if (code !== 0 || received === undefined) {
        reject(new Error(`creation provider worker failed (${code}): ${diagnostics}`));
      } else if (!childAbsent) {
        reject(new Error("Python fixture absence was not independently confirmed"));
      } else resolve(received);
    });
  });
}

function pidAbsent(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (error.code === "ESRCH") return true;
    throw error;
  }
}

async function waitPidAbsent(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pidAbsent(pid)) return true;
    await delay(20);
  }
  return pidAbsent(pid);
}

async function sandbox(check) {
  assert.ok(process.env.VIVARY_TEST_CORE_PACKAGE_JSON); // guard:allow-env-credential - Reviewed Core dependency manifest path.
  assert.ok(path.isAbsolute(process.env.VIVARY_TEST_PYTHON)); // guard:allow-env-credential - Reviewed Python executable path for the fixture.
  const configuredRoot = process.env.VIVARY_REGISTRY_PROOF_ROOT; // guard:allow-env-credential - Disposable task-owned proof directory.
  assert.ok(configuredRoot && path.isAbsolute(configuredRoot));
  const proofRoot = await realpath(configuredRoot);
  const directory = await mkdtemp(path.join(proofRoot, "case-"));
  let originalFailure = null;
  try {
    await check(directory);
  } catch (error) {
    originalFailure = error;
  }
  let cleanupFailure = null;
  try {
    const remaining = [...(activeChildren.get(directory) ?? [])];
    let safe = true;
    for (const record of remaining) {
      if (record.pythonPid === null) {
        safe = false;
      } else if (!pidAbsent(record.pythonPid)) {
        try {
          process.kill(record.pythonPid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") safe = false;
        }
        if (!await waitPidAbsent(record.pythonPid, 2_000)) safe = false;
      }
      if (record.child.exitCode === null && record.child.signalCode === null) {
        record.child.kill("SIGKILL");
      }
    }
    await Promise.all(remaining.map((record) => record.closed));
    if (!safe) {
      throw new Error(`retained unresolved creation fixture: ${directory}`);
    }
    activeChildren.delete(directory);
    const resolved = await realpath(directory);
    const relative = path.relative(proofRoot, resolved);
    assert.equal(path.dirname(relative), ".");
    assert.ok(path.basename(relative).startsWith("case-") && !path.isAbsolute(relative));
    await rm(resolved, { recursive: true, force: true });
  } catch (error) {
    cleanupFailure = error;
  }
  if (originalFailure) {
    if (cleanupFailure) {
      try {
        Object.defineProperty(originalFailure, "cleanupFailure", {
          value: `${cleanupFailure.name}: ${cleanupFailure.message}`,
          enumerable: true,
        });
      } catch {
        // The original check failure remains authoritative even if immutable.
      }
    }
    throw originalFailure;
  }
  if (cleanupFailure) throw cleanupFailure;
}

function fakeLifecycle(script, {
  stopResult = CREATION_WORKER_QUIESCENT, throwOnWriteKind = null,
} = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const quiet = deferred();
  let received = Buffer.alloc(0);
  input.on("data", (chunk) => {
    received = Buffer.concat([received, chunk]);
    while (received.includes(10)) {
      const end = received.indexOf(10);
      const message = JSON.parse(received.subarray(0, end).toString());
      received = received.subarray(end + 1);
      script(message, output);
    }
  });
  const lifecycle = {
    stopCalls: 0,
    confirmQuiescence() {
      quiet.resolve(CREATION_WORKER_QUIESCENT);
    },
    async start() {
      const writable = throwOnWriteKind === null ? input : {
        write(chunk) {
          const message = JSON.parse(Buffer.from(chunk).toString());
          if (message.kind === throwOnWriteKind) throw new Error("injected write failure");
          return input.write(chunk);
        },
        destroy() {
          input.destroy();
        },
      };
      return {
        readable: output, writable, quiescence: quiet.promise,
        async stopAndConfirmQuiescent() {
          lifecycle.stopCalls += 1;
          if (stopResult === CREATION_WORKER_QUIESCENT) quiet.resolve(stopResult);
          return stopResult;
        },
      };
    },
  };
  return lifecycle;
}

const refusingPort = Object.freeze({
  load: async () => null, prepare: async () => null, transition: async () => null,
  admitAndExecute: async () => null,
});

function custodialPort() {
  let tail = Promise.resolve();
  let admissions = 0;
  const started = deferred();
  const settled = deferred();
  return {
    port: {
      ...refusingPort,
      admitAndExecute: async (_binding, _snapshot, _namespace, _effect, execute) => {
        admissions += 1;
        const previous = tail;
        const release = deferred();
        tail = previous.then(() => release.promise);
        await previous;
        started.resolve();
        try {
          return await execute();
        } finally {
          release.resolve();
          settled.resolve();
        }
      },
    },
    started: started.promise,
    settled: settled.promise,
    admissionCount: () => admissions,
    contend: () => tail.then(() => true),
  };
}

if (process.env.VIVARY_CREATION_PROVIDER_WORKER === "1") { // guard:allow-env-credential - Isolated fixture child-mode flag.
  await worker();
} else {
  test("unconfigured lifecycle refuses without resolving facts or effects", async () => {
    let calls = 0;
    const provider = await startCreationProvider({
      effectPort: refusingPort, resolveFacts: async () => { calls += 1; },
      parseStrictJson,
    });
    assert.equal((await provider.apply({})).reason, "creation-provider-unconfigured");
    assert.equal(calls, 0);
  });

  test("trusted lifecycle startup owns its bounded refusal", async () => {
    let deadline;
    const provider = await startCreationProvider({
      effectPort: refusingPort, resolveFacts: async () => authority(), parseStrictJson,
      limits: FAULT_LIMITS,
      lifecycle: { async start(value) { deadline = value; throw new Error("refused"); } },
    });
    assert.equal(deadline, FAULT_LIMITS.rpcMs);
    assert.equal(provider.readiness().status, "unavailable");
  });

  test("a same-chunk startup fault cannot resurrect a ready provider", async () => {
    const outboundKinds = [];
    const startupFramesSent = deferred();
    let effects = 0;
    const heldLifecycle = fakeLifecycle((message, output) => {
      outboundKinds.push(message.kind);
      if (message.kind !== "initialize") return;
      const frame = (value) => `${JSON.stringify({
        version: 1, connectionId: message.connectionId, ...value,
      })}\n`;
      output.write(Buffer.from(
        frame({ id: 1, kind: "ready", parentId: message.id })
        + frame({ id: 2, kind: "invalid-startup-frame" }),
      ));
      startupFramesSent.resolve();
    }, { stopResult: null });
    const starting = startCreationProvider({
      effectPort: {
        ...refusingPort,
        admitAndExecute: async () => { effects += 1; },
      },
      resolveFacts: async () => authority(), lifecycle: heldLifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    await startupFramesSent.promise;
    assert.deepEqual(outboundKinds, ["initialize"]);
    assert.equal(heldLifecycle.stopCalls, 1);
    assert.equal(await Promise.race([starting.then(() => false), delay(50, true)]), true);
    heldLifecycle.confirmQuiescence();
    const provider = await starting;
    assert.equal(provider.readiness().status, "unavailable");
    assert.equal((await provider.apply({})).code, "recovery-required");
    assert.deepEqual(outboundKinds, ["initialize"]);
    assert.equal(effects, 0);
  });

  test("ordinary Python entrypoint has no composition and exits unavailable", async () => {
    assert.ok(path.isAbsolute(process.env.VIVARY_TEST_PYTHON)); // guard:allow-env-credential - Reviewed Python executable path for the fixture.
    const child = spawn(process.env.VIVARY_TEST_PYTHON, ["-I", "-B", "-u", PYTHON_PROVIDER], { // guard:allow-env-credential - Reviewed Python executable path for the fixture.
      cwd: "/", env: { LANG: "C.UTF-8" }, stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const closed = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code));
    });
    const timeout = delay(5_000, "timeout", { ref: false });
    const result = await Promise.race([closed, timeout]);
    if (result === "timeout") {
      child.kill("SIGKILL");
      await closed;
      assert.fail("unconfigured Python provider did not exit");
    }
    assert.equal(result, 1);
    assert.equal(stdout, "");
    assert.equal(stderr, "");
    assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
  });

  test("real Python apply preserves the local completion sentinel and creates unregistered", async () =>
    sandbox(async (directory) => {
      const value = await startWorker(directory, { behavior: "normal" });
      assert.equal(value.result.code, "created-unregistered");
      assert.equal(value.result.registered, false);
      assert.equal(value.snapshot.receipts[0].creationPhase, "published");
      assert.equal(value.snapshot.projects.length, 0);
      assert.equal(value.snapshot.bindings.length, 0);
      assert.deepEqual(value.effects, ["prepare-stage", "publish"]);
      assert.ok(value.factReads >= 10, "07d revalidation must cross the nested read lane");
      assert.equal(value.second.code, "recovery-required");
      assert.ok(value.stopCalls >= 1);
    }));

  test("pre-admission revocation performs no effect and stores no receipt", async () =>
    sandbox(async (directory) => {
      const value = await startWorker(directory, { behavior: "normal", revokedInitially: true });
      assert.equal(value.result.code, "denied");
      assert.equal(value.snapshot.receipts.length, 0);
      assert.equal(value.effects.length, 0);
    }));

  for (const [behavior, receiptPhase, targetPresent, expectedEffects] of [
    ["exit-before-effect", null, false, []],
    ["hang-before-effect", null, false, []],
    ["exit-during-effect", "preparing", false, ["prepare-stage"]],
    ["hang-during-effect", "preparing", false, ["prepare-stage"]],
    ["exit-after-preparation-effect-before-completion", "preparing", false, ["prepare-stage"]],
    ["exit-after-preparation-completion-before-reply", "preparing", false, ["prepare-stage"]],
    ["exit-after-publication-effect-before-completion", "publishing", true,
      ["prepare-stage", "publish"]],
    ["exit-after-publication-completion-before-reply", "publishing", true,
      ["prepare-stage", "publish"]],
  ]) {
    test(`${behavior} returns recovery and never advances an uncertain receipt`, async () =>
      sandbox(async (directory) => {
        const value = await startWorker(directory, { behavior });
        assert.equal(value.result.code, "recovery-required");
        assert.equal(value.snapshot.receipts.length, receiptPhase === null ? 0 : 1);
        if (receiptPhase !== null) {
          assert.equal(value.snapshot.receipts[0].creationPhase, receiptPhase);
        }
        assert.equal(value.targetPresent, targetPresent);
        assert.deepEqual(value.effects, expectedEffects);
      }));
  }

  test("unknown stop evidence quarantines until independent child death drains admission", async () =>
    sandbox(async (directory) => {
      const value = await startWorker(directory, {
        behavior: "hang-during-effect", refuseStop: true, action: "quarantine",
      });
      assert.equal(value.result.code, "recovery-required");
      assert.equal(value.snapshot.receipts[0].creationPhase, "preparing");
    }));

  test("revocation and phase mutation remain blocked until the effect settles", async () =>
    sandbox(async (directory) => {
      const value = await startWorker(directory, {
        behavior: "hang-during-effect", refuseStop: true, action: "contend",
      });
      assert.equal(value.blocked, true);
      assert.equal(value.result.code, "recovery-required");
      assert.equal(value.snapshot.receipts[0].creationPhase, "preparing");
    }));

  test("claims are exact and reject caller authority, paths, and a second apply", async () =>
    sandbox(async (directory) => {
      const value = await startWorker(directory, {
        behavior: "normal", claimsPatch: { capabilities: ["create-child"] },
      });
      assert.equal(value.result.code, "invalid-input");
      assert.equal(value.factReads, 0);
      assert.equal(value.snapshot.receipts.length, 0);
      assert.equal(value.second.code, "recovery-required");
    }));

  for (const [name, response] of [
    ["duplicate JSON fields", ({ connectionId }) =>
      `{"version":1,"connectionId":"${connectionId}","id":1,"id":1,"kind":"ready","parentId":1}\n`],
    ["stale message id", ({ connectionId }) => JSON.stringify({
      version: 1, connectionId, id: 2, kind: "ready", parentId: 1,
    }) + "\n"],
    ["unsolicited effect completion", ({ connectionId }) => JSON.stringify({
      version: 1, connectionId, id: 1, kind: "effect-complete", parentId: 1, ok: true,
    }) + "\n"],
    ["partial frame", ({ connectionId }) => `{"version":1,"connectionId":"${connectionId}"`],
    ["oversized frame", () => `${"x".repeat(17_000)}\n`],
  ]) {
    test(`strict framing rejects ${name}`, async () => {
      const lifecycle = fakeLifecycle((message, output) => {
        if (message.kind === "initialize") {
          output.write(response(message));
          if (name === "partial frame") output.end();
        }
      });
      const provider = await startCreationProvider({
        effectPort: refusingPort, resolveFacts: async () => authority(), lifecycle,
        parseStrictJson, limits: FAULT_LIMITS,
      });
      assert.equal(provider.readiness().status, "unavailable");
    });
  }

  test("effect completion requires exact invocation correlation", async () => {
    let pythonId = 0;
    let applyId;
    const custody = custodialPort();
    const faultInjected = deferred();
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const snap = { binding, phase: "preparing", namespace: {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    } };
    const heldLifecycle = fakeLifecycle((message, output) => {
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") {
        queueMicrotask(() => send({ kind: "receipt", parentId: applyId, operation: "admit",
          binding, namespace: snap.namespace, snapshot: snap, effect: "prepare-stage" }));
      } else if (message.kind === "effect-invoke") {
        send({ kind: "effect-complete", parentId: message.id + 1, ok: true });
        faultInjected.resolve();
      }
    }, { stopResult: null });
    const provider = await startCreationProvider({
      effectPort: custody.port, resolveFacts: async () => authority(), lifecycle: heldLifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const pending = provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    await custody.started;
    await faultInjected.promise;
    const contender = custody.contend();
    assert.equal(custody.admissionCount(), 1);
    assert.equal(provider.readiness().status, "quarantined");
    assert.equal(heldLifecycle.stopCalls, 1);
    assert.equal(await Promise.race([custody.settled.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([contender.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    heldLifecycle.confirmQuiescence();
    await custody.settled;
    assert.equal(await contender, true);
    assert.equal((await pending).code, "recovery-required");
  });

  test("duplicate effect completion in one chunk cannot settle admitted success", async () => {
    let pythonId = 0;
    let applyId;
    const custody = custodialPort();
    const faultInjected = deferred();
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const snapshot = { binding, phase: "preparing", namespace: portNamespace };
    const heldLifecycle = fakeLifecycle((message, output) => {
      const frame = (value) => `${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`;
      if (message.kind === "initialize") output.write(frame({ kind: "ready", parentId: message.id }));
      else if (message.kind === "apply") {
        applyId = message.id;
        output.write(frame({ kind: "authority-read", parentId: null }));
      } else if (message.kind === "authority-result") {
        queueMicrotask(() => output.write(frame({
          kind: "receipt", parentId: applyId, operation: "admit",
          binding, namespace: portNamespace, snapshot, effect: "prepare-stage",
        })));
      } else if (message.kind === "effect-invoke") {
        output.write(Buffer.from(
          frame({ kind: "effect-complete", parentId: message.id, ok: true })
          + frame({ kind: "effect-complete", parentId: message.id, ok: true }),
        ));
        faultInjected.resolve();
      }
    }, { stopResult: null });
    const provider = await startCreationProvider({
      effectPort: custody.port, resolveFacts: async () => authority(), lifecycle: heldLifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const pending = provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    await custody.started;
    await faultInjected.promise;
    const contender = custody.contend();
    assert.equal(custody.admissionCount(), 1);
    assert.equal(provider.readiness().status, "quarantined");
    assert.equal(heldLifecycle.stopCalls, 1);
    assert.equal(await Promise.race([custody.settled.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([contender.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    heldLifecycle.confirmQuiescence();
    await custody.settled;
    assert.equal(await contender, true);
    assert.equal((await pending).code, "recovery-required");
  });

  test("negative effect completion holds the Native host scope until quiescence", async () => {
    let pythonId = 0;
    let applyId;
    const custody = custodialPort();
    const completionSent = deferred();
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const snapshot = { binding, phase: "preparing", namespace: portNamespace };
    const heldLifecycle = fakeLifecycle((message, output) => {
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") {
        queueMicrotask(() => send({
          kind: "receipt", parentId: applyId, operation: "admit",
          binding, namespace: portNamespace, snapshot, effect: "prepare-stage",
        }));
      } else if (message.kind === "effect-invoke") {
        send({ kind: "effect-complete", parentId: message.id, ok: false });
        completionSent.resolve();
      }
    }, { stopResult: null });
    const provider = await startCreationProvider({
      effectPort: custody.port, resolveFacts: async () => authority(), lifecycle: heldLifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const pending = provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    await custody.started;
    await completionSent.promise;
    const contender = custody.contend();
    assert.equal(custody.admissionCount(), 1);
    assert.equal(provider.readiness().status, "quarantined");
    assert.equal(heldLifecycle.stopCalls, 1);
    assert.equal(await Promise.race([custody.settled.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([contender.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    heldLifecycle.confirmQuiescence();
    await custody.settled;
    assert.equal(await contender, true);
    assert.equal((await pending).code, "recovery-required");
  });

  test("effect-invoke write failure holds the Native host scope until quiescence", async () => {
    let pythonId = 0;
    let applyId;
    const custody = custodialPort();
    const outboundKinds = [];
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const snapshot = { binding, phase: "preparing", namespace: portNamespace };
    const heldLifecycle = fakeLifecycle((message, output) => {
      outboundKinds.push(message.kind);
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") {
        queueMicrotask(() => send({
          kind: "receipt", parentId: applyId, operation: "admit",
          binding, namespace: portNamespace, snapshot, effect: "prepare-stage",
        }));
      }
    }, { stopResult: null, throwOnWriteKind: "effect-invoke" });
    const provider = await startCreationProvider({
      effectPort: custody.port, resolveFacts: async () => authority(), lifecycle: heldLifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const pending = provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    await custody.started;
    const contender = custody.contend();
    assert.equal(custody.admissionCount(), 1);
    assert.equal(provider.readiness().status, "quarantined");
    assert.equal(heldLifecycle.stopCalls, 1);
    assert.deepEqual(outboundKinds, ["initialize", "apply", "authority-result"]);
    assert.equal(await Promise.race([custody.settled.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([contender.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    heldLifecycle.confirmQuiescence();
    await custody.settled;
    assert.equal(await contender, true);
    assert.equal((await pending).code, "recovery-required");
  });

  test("receipt timeout retains Native custody until the real operation settles", async () => {
    const nativeWrite = deferred();
    let pythonId = 0;
    let applyId;
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const lifecycle = fakeLifecycle((message, output) => {
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") {
        send({ kind: "receipt", parentId: applyId, operation: "load",
          binding, namespace: portNamespace });
      }
    });
    const port = { ...refusingPort, load: async () => nativeWrite.promise };
    const provider = await startCreationProvider({
      effectPort: port, resolveFacts: async () => authority(), lifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const pending = provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    await delay(FAULT_LIMITS.rpcMs + FAULT_LIMITS.stopMs + 50);
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    nativeWrite.resolve(null);
    assert.equal((await pending).code, "recovery-required");
  });

  test("premature success without an observed published receipt is rejected", async () => {
    let pythonId = 0;
    const lifecycle = fakeLifecycle((message, output) => {
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") send({ kind: "apply-result", parentId: message.id,
        value: { code: "created-unregistered", operationId: "operation-a", phase: "published",
          replayed: false, targetPresent: true, registered: false } });
    });
    const provider = await startCreationProvider({
      effectPort: refusingPort, resolveFacts: async () => authority(), lifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const result = await provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: `sha256:${"a".repeat(64)}`, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    assert.equal(result.code, "recovery-required");
  });

  test("receipt binding cannot substitute another operation after trusted facts", async () => {
    let pythonId = 0;
    let applyId;
    let portCalls = 0;
    const wrongBinding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-b", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const lifecycle = fakeLifecycle((message, output) => {
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") send({
        kind: "receipt", parentId: applyId, operation: "load",
        binding: wrongBinding, namespace: portNamespace,
      });
    });
    const provider = await startCreationProvider({
      effectPort: { ...refusingPort, load: async () => { portCalls += 1; } },
      resolveFacts: async () => authority(), lifecycle, parseStrictJson, limits: FAULT_LIMITS,
    });
    const result = await provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: wrongBinding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    assert.equal(result.code, "recovery-required");
    assert.equal(portCalls, 0);
  });

  for (const [ending, expectedCode] of [
    ["expected EOF", "created-unregistered"],
    ["duplicate final reply", "recovery-required"],
  ]) {
    test(`${ending} after a valid published result preserves receipt truth`, async () => {
      let pythonId = 0;
      let applyId;
      let receiptReads = 0;
      let receiptWrites = 0;
      const finalFramesSent = deferred();
      const binding = {
        actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
        policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
        childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
      };
      const portNamespace = {
        namespaceKey: "fixture-namespace", childKey: "fixture-child",
        stageId: "fixture-stage", continuityId: "fixture-continuity",
      };
      const durablePublished = Object.freeze({
        binding: Object.freeze({ ...binding }), phase: "published",
        namespace: Object.freeze({ ...portNamespace }),
      });
      const heldLifecycle = fakeLifecycle((message, output) => {
        const frame = (value) => `${JSON.stringify({
          version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
        })}\n`;
        if (message.kind === "initialize") {
          output.write(frame({ kind: "ready", parentId: message.id }));
        } else if (message.kind === "apply") {
          applyId = message.id;
          output.write(frame({ kind: "authority-read", parentId: null }));
        } else if (message.kind === "authority-result") {
          output.write(frame({
            kind: "receipt", parentId: applyId, operation: "load",
            binding, namespace: portNamespace,
          }));
        } else if (message.kind === "receipt-result") {
          const value = {
            code: "created-unregistered", operationId: "operation-a", phase: "published",
            replayed: true, targetPresent: true, registered: false,
          };
          const valid = frame({ kind: "apply-result", parentId: applyId, value });
          if (ending === "duplicate final reply") {
            output.write(Buffer.from(
              valid + frame({ kind: "apply-result", parentId: applyId, value }),
            ));
          } else {
            output.write(valid);
            output.end();
          }
          finalFramesSent.resolve();
        }
      }, { stopResult: null });
      const effectPort = {
        ...refusingPort,
        load: async () => {
          receiptReads += 1;
          return durablePublished;
        },
        prepare: async () => { receiptWrites += 1; },
        transition: async () => { receiptWrites += 1; },
        admitAndExecute: async () => { receiptWrites += 1; },
      };
      const provider = await startCreationProvider({
        effectPort, resolveFacts: async () => authority(), lifecycle: heldLifecycle,
        parseStrictJson, limits: FAULT_LIMITS,
      });
      const pending = provider.apply({
        operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
        acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
        preset: "coding", adapters: [], activeContext: null,
      });
      await finalFramesSent.promise;
      assert.equal(provider.readiness().status, "quarantined");
      assert.equal(heldLifecycle.stopCalls, 1);
      assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
      heldLifecycle.confirmQuiescence();
      assert.equal((await pending).code, expectedCode);
      assert.equal(receiptReads, 1);
      assert.equal(receiptWrites, 0);
      assert.equal(durablePublished.phase, "published");
      assert.deepEqual(durablePublished.binding, binding);
      assert.deepEqual(durablePublished.namespace, portNamespace);
    });
  }

  test("final success operation must match its observed published receipt", async () => {
    let pythonId = 0;
    let applyId;
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const published = { binding, phase: "published", namespace: portNamespace };
    const lifecycle = fakeLifecycle((message, output) => {
      const send = (value) => output.write(`${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`);
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") send({
        kind: "receipt", parentId: applyId, operation: "load", binding,
        namespace: portNamespace,
      });
      else if (message.kind === "receipt-result") send({
        kind: "apply-result", parentId: applyId,
        value: { code: "created-unregistered", operationId: "operation-b", phase: "published",
          replayed: true, targetPresent: true, registered: false },
      });
    });
    const provider = await startCreationProvider({
      effectPort: { ...refusingPort, load: async () => published },
      resolveFacts: async () => authority(), lifecycle, parseStrictJson, limits: FAULT_LIMITS,
    });
    const result = await provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    assert.equal(result.code, "recovery-required");
  });

  test("a nested mutation before same-chunk completion holds admission until quiescence", async () => {
    let pythonId = 0;
    let applyId;
    const custody = custodialPort();
    const faultInjected = deferred();
    const binding = {
      actorId: "fixture-actor", collectionId: "fixture-collection", deviceId: "fixture-device",
      policyRevision: 7, operationId: "operation-a", parentRef: "fixture-parent",
      childName: "example", acceptedPlanSha256: `sha256:${"a".repeat(64)}`,
    };
    const portNamespace = {
      namespaceKey: "fixture-namespace", childKey: "fixture-child",
      stageId: "fixture-stage", continuityId: "fixture-continuity",
    };
    const snapshot = { binding, phase: "preparing", namespace: portNamespace };
    const heldLifecycle = fakeLifecycle((message, output) => {
      const frame = (value) => `${JSON.stringify({
        version: 1, connectionId: message.connectionId, id: ++pythonId, ...value,
      })}\n`;
      const send = (value) => output.write(frame(value));
      if (message.kind === "initialize") send({ kind: "ready", parentId: message.id });
      else if (message.kind === "apply") {
        applyId = message.id;
        send({ kind: "authority-read", parentId: null });
      } else if (message.kind === "authority-result") {
        queueMicrotask(() => send({
          kind: "receipt", parentId: applyId, operation: "admit",
          binding, namespace: portNamespace, snapshot, effect: "prepare-stage",
        }));
      } else if (message.kind === "effect-invoke") {
        output.write(Buffer.from(
          frame({ kind: "receipt", parentId: applyId, operation: "load",
            binding, namespace: portNamespace })
          + frame({ kind: "effect-complete", parentId: message.id, ok: true }),
        ));
        faultInjected.resolve();
      }
    }, { stopResult: null });
    const provider = await startCreationProvider({
      effectPort: custody.port, resolveFacts: async () => authority(), lifecycle: heldLifecycle,
      parseStrictJson, limits: FAULT_LIMITS,
    });
    const pending = provider.apply({
      operationId: "operation-a", parentRef: "fixture-parent", childName: "example",
      acceptedPlanSha256: binding.acceptedPlanSha256, expectedPolicyRevision: 7,
      preset: "coding", adapters: [], activeContext: null,
    });
    await custody.started;
    await faultInjected.promise;
    const contender = custody.contend();
    assert.equal(custody.admissionCount(), 1);
    assert.equal(provider.readiness().status, "quarantined");
    assert.equal(heldLifecycle.stopCalls, 1);
    assert.equal(await Promise.race([custody.settled.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([contender.then(() => false), delay(50, true)]), true);
    assert.equal(await Promise.race([pending.then(() => false), delay(50, true)]), true);
    heldLifecycle.confirmQuiescence();
    await custody.settled;
    assert.equal(await contender, true);
    assert.equal((await pending).code, "recovery-required");
  });

  test("a reply carrying an old connection id is rejected", async () => {
    let oldConnection;
    const first = await startCreationProvider({
      effectPort: refusingPort, resolveFacts: async () => authority(), parseStrictJson,
      lifecycle: fakeLifecycle((message, output) => {
        oldConnection = message.connectionId;
        output.write(`${JSON.stringify({
          version: 1, connectionId: oldConnection, id: 1,
          kind: "ready", parentId: message.id,
        })}\n`);
      }), limits: FAULT_LIMITS,
    });
    await first.close();
    const second = await startCreationProvider({
      effectPort: refusingPort, resolveFacts: async () => authority(), parseStrictJson,
      lifecycle: fakeLifecycle((message, output) => {
        assert.notEqual(message.connectionId, oldConnection);
        output.write(`${JSON.stringify({
          version: 1, connectionId: oldConnection, id: 1,
          kind: "ready", parentId: message.id,
        })}\n`);
      }), limits: FAULT_LIMITS,
    });
    assert.equal(second.readiness().status, "unavailable");
  });
}
