/** One-shot private bridge from Native receipt admission to Python creation. */
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { randomBytes } from "node:crypto";
import { z } from "zod";

export const CREATION_WORKER_QUIESCENT = Object.freeze({ quiescent: true });

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const identifier = z.string().regex(ID);
const bindingSchema = z.strictObject({
  actorId: identifier, collectionId: identifier, deviceId: identifier,
  policyRevision: z.number().int().safe().positive(), operationId: identifier,
  parentRef: identifier, childName: z.string().regex(NAME).refine((value) => !value.endsWith(".")),
  acceptedPlanSha256: z.string().regex(DIGEST),
});
const namespaceSchema = z.strictObject({
  namespaceKey: identifier, childKey: identifier, stageId: identifier, continuityId: identifier,
});
const snapshotSchema = z.strictObject({
  binding: bindingSchema,
  phase: z.enum(["preparing", "prepared", "publishing", "published"]),
  namespace: namespaceSchema,
});
const failureSchema = z.strictObject({
  code: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  reason: z.string().regex(/^[a-z][a-z0-9-]{0,127}$/),
  phase: z.enum(["preparing", "prepared", "publishing", "published", "failed"]).nullable(),
});
const factsSchema = z.strictObject({
  actorId: identifier, collectionId: identifier, deviceId: identifier,
  policyRevision: z.number().int().safe().positive(), member: z.boolean(),
  capabilities: z.array(identifier).max(128), creatableParents: z.array(identifier).max(128),
}).superRefine((value, context) => {
  for (const key of ["capabilities", "creatableParents"]) {
    if (new Set(value[key]).size !== value[key].length) {
      context.addIssue({ code: "custom", message: `${key} must be unique` });
    }
  }
});
const claimsSchema = z.strictObject({
  operationId: identifier, parentRef: identifier,
  childName: z.string().regex(NAME).refine((value) => !value.endsWith(".")),
  acceptedPlanSha256: z.string().regex(DIGEST),
  expectedPolicyRevision: z.number().int().safe().positive(), preset: identifier,
  adapters: z.array(identifier).max(16), activeContext: identifier.nullable(),
}).superRefine((value, context) => {
  if (new Set(value.adapters).size !== value.adapters.length) {
    context.addIssue({ code: "custom", message: "adapters must be unique" });
  }
});
const limitsSchema = z.strictObject({
  frameBytes: z.number().int().min(1024).max(1024 * 1024),
  rpcMs: z.number().int().min(100).max(60_000),
  effectMs: z.number().int().min(100).max(120_000),
  applyMs: z.number().int().min(100).max(300_000),
  stopMs: z.number().int().min(100).max(60_000),
}).refine((value) => value.effectMs <= value.applyMs, "effect deadline exceeds apply deadline");
const DEFAULT_LIMITS = Object.freeze({
  frameBytes: 16 * 1024, rpcMs: 5_000, effectMs: 20_000,
  applyMs: 60_000, stopMs: 5_000,
});
const effectNames = new Set(["prepare-stage", "publish", "recover-publication"]);

const recovery = (reason = "creation-provider-unavailable") => Object.freeze({
  code: "recovery-required", reason, phase: null,
});
const exactKeys = (value, keys) => value !== null && typeof value === "object"
  && !Array.isArray(value) && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const freeze = (value) => Object.freeze(structuredClone(value));

function refusingProvider(reason = "creation-provider-unconfigured") {
  return Object.freeze({
    readiness: () => Object.freeze({ status: "unavailable" }),
    apply: async () => recovery(reason),
    close: async () => {},
  });
}

/**
 * Start one trusted worker. The lifecycle owns every possible writer and must
 * return the exact exported quiescence token before custody may drain.
 * Host preconditions: `start(deadlineMs)` must enforce that deadline itself,
 * and lifecycle quiescence must cover the worker and every possible descendant
 * writer. `start` must stop or retain ownership of any worker unless it returns
 * the complete owner shape below. The bridge cannot safely abandon a lifecycle
 * promise that may transfer a writer later.
 */
export async function startCreationProvider({
  effectPort, resolveFacts, lifecycle, parseStrictJson, limits = DEFAULT_LIMITS,
} = {}) {
  const configuredLimits = limitsSchema.parse(limits);
  if (!lifecycle) return refusingProvider();
  if (typeof lifecycle.start !== "function" || typeof resolveFacts !== "function"
    || typeof parseStrictJson !== "function" || !effectPort
    || ["load", "prepare", "transition", "admitAndExecute"]
      .some((name) => typeof effectPort[name] !== "function")) {
    throw new TypeError("invalid creation provider configuration");
  }

  let worker;
  try {
    worker = await lifecycle.start(configuredLimits.rpcMs);
  } catch {
    return refusingProvider("creation-worker-unavailable");
  }
  if (!worker || typeof worker.writable?.write !== "function"
    || typeof worker.readable?.on !== "function"
    || typeof worker.stopAndConfirmQuiescent !== "function"
    || typeof worker.quiescence?.then !== "function") {
    throw new TypeError("invalid owned worker lifecycle");
  }

  let sentId = 0;
  const connectionId = randomBytes(16).toString("hex");
  let receivedId = 0;
  let buffer = Buffer.alloc(0);
  let state = "starting";
  let used = false;
  let stopping;
  let quiescentOutcome;
  let applyCall;
  let applyRequestId = null;
  let acceptedClaims = null;
  let acceptedBinding = null;
  let initialFacts = null;
  let observedSnapshot = null;
  let activeReceipt = null;
  let activeEffect = null;
  let activeAuthority = false;
  let terminalFailure = null;
  let finalReplyAccepted = false;
  const replies = new Map();

  function write(kind, fields = {}) {
    if (["quarantined", "quiescent"].includes(state)) throw new Error("provider unavailable");
    sentId += 1;
    const frame = Buffer.from(JSON.stringify({
      version: 1, connectionId, id: sentId, kind, ...fields,
    }) + "\n");
    if (frame.length > configuredLimits.frameBytes) {
      void fail("creation-frame-too-large");
      throw new Error("creation frame too large");
    }
    worker.writable.write(frame);
    return sentId;
  }

  function awaitReply(parentId, kind, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        replies.delete(parentId);
        reject(new Error("creation RPC deadline"));
        void fail("creation-rpc-timeout");
      }, timeoutMs);
      replies.set(parentId, { kind, resolve, reject, timer });
    });
  }

  function request(kind, fields, responseKind, timeoutMs) {
    const parentId = sentId + 1;
    const reply = awaitReply(parentId, responseKind, timeoutMs);
    if (write(kind, fields) !== parentId) throw new Error("outgoing id changed");
    return reply;
  }

  function drainQuiescent() {
    if (!quiescentOutcome || activeReceipt || activeEffect) return;
    if (applyCall) applyCall.resolve(quiescentOutcome.result);
  }

  function settleQuiescent(reason, result = recovery(reason)) {
    if (state === "quiescent") return;
    state = "quiescent";
    buffer = Buffer.alloc(0);
    for (const pending of replies.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    replies.clear();
    quiescentOutcome = { result };
    if (activeEffect) activeEffect.reject(new Error(reason));
    drainQuiescent();
    worker.writable.destroy?.();
  }

  async function confirmStop(reason, finalResult) {
    const settleConfirmed = () => {
      if (terminalFailure) settleQuiescent(terminalFailure);
      else settleQuiescent(reason, finalResult);
    };
    let confirmation;
    try {
      confirmation = await Promise.race([
        Promise.resolve(worker.stopAndConfirmQuiescent(configuredLimits.stopMs)),
        delay(configuredLimits.stopMs, null, { ref: false }),
      ]);
    } catch {
      confirmation = null;
    }
    if (confirmation === CREATION_WORKER_QUIESCENT) {
      settleConfirmed();
      return;
    }
    // Unknown quiescence remains quarantined. Only independently delivered,
    // exact local lifecycle evidence may drain the admitted callback.
    try {
      const later = await worker.quiescence;
      if (later === CREATION_WORKER_QUIESCENT) {
        settleConfirmed();
        return;
      }
    } catch {
      // A rejected or non-affirmative lifecycle claim cannot release custody.
    }
    await new Promise(() => {});
  }

  function fail(reason) {
    if (state === "quiescent") return stopping ?? Promise.resolve();
    terminalFailure ??= reason;
    state = "quarantined";
    if (!stopping) stopping = confirmStop(reason);
    return stopping;
  }

  function sendResponse(kind, parentId, value) {
    write(kind, { parentId, value });
  }

  async function withDeadline(action, milliseconds) {
    let timer;
    try {
      return await Promise.race([
        action(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("creation operation deadline")), milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function handleAuthority(message) {
    try {
      const facts = factsSchema.parse(await withDeadline(resolveFacts, configuredLimits.rpcMs));
      if (initialFacts === null) initialFacts = freeze(facts);
      sendResponse("authority-result", message.id, freeze(facts));
    } finally {
      activeAuthority = false;
    }
  }

  function validateReceipt(message) {
    if (!exactKeys(message, ["version", "connectionId", "id", "kind", "parentId", "operation", "binding", "namespace"])
      && !exactKeys(message, ["version", "connectionId", "id", "kind", "parentId", "operation", "binding", "namespace",
        "snapshot", "expectedPhase", "nextPhase"])
      && !exactKeys(message, ["version", "connectionId", "id", "kind", "parentId", "operation", "binding", "namespace",
        "snapshot", "effect"])) throw new Error("invalid receipt request");
    if (message.parentId !== applyRequestId) throw new Error("receipt belongs to another apply");
    const binding = bindingSchema.parse(message.binding);
    const namespace = namespaceSchema.parse(message.namespace);
    if (!acceptedClaims || !initialFacts) throw new Error("receipt preceded trusted binding");
    const expectedBinding = {
      actorId: initialFacts.actorId, collectionId: initialFacts.collectionId,
      deviceId: initialFacts.deviceId, policyRevision: acceptedClaims.expectedPolicyRevision,
      operationId: acceptedClaims.operationId, parentRef: acceptedClaims.parentRef,
      childName: acceptedClaims.childName,
      acceptedPlanSha256: acceptedClaims.acceptedPlanSha256,
    };
    if (initialFacts.policyRevision !== acceptedClaims.expectedPolicyRevision
      || !isDeepStrictEqual(binding, expectedBinding)) throw new Error("receipt binding changed");
    acceptedBinding = freeze(expectedBinding);
    if (["load", "prepare"].includes(message.operation)) {
      if (Object.keys(message).length !== 8) throw new Error("invalid receipt shape");
      return { binding, namespace };
    }
    const snapshot = snapshotSchema.parse(message.snapshot);
    if (!isDeepStrictEqual(snapshot.binding, binding)
      || !isDeepStrictEqual(snapshot.namespace, namespace)) throw new Error("receipt binding changed");
    if (message.operation === "transition") {
      const phases = new Map([["preparing", "prepared"], ["prepared", "publishing"],
        ["publishing", "published"]]);
      if (message.expectedPhase !== snapshot.phase
        || phases.get(message.expectedPhase) !== message.nextPhase) throw new Error("invalid transition");
      return { binding, namespace, snapshot };
    }
    if (message.operation !== "admit" || !effectNames.has(message.effect)) {
      throw new Error("invalid receipt operation");
    }
    const expected = message.effect === "prepare-stage" ? "preparing" : "publishing";
    if (snapshot.phase !== expected) throw new Error("cross-phase effect");
    return { binding, namespace, snapshot };
  }

  function portValue(value) {
    if (value === null) return null;
    const failure = failureSchema.safeParse(value);
    if (failure.success) return freeze(failure.data);
    return freeze(snapshotSchema.parse(value));
  }

  function recordPortValue(value, binding, namespace) {
    const encoded = portValue(value);
    const snapshot = snapshotSchema.safeParse(encoded);
    if (snapshot.success) {
      if (!isDeepStrictEqual(snapshot.data.binding, binding)
        || !isDeepStrictEqual(snapshot.data.namespace, namespace)) {
        throw new Error("receipt result changed binding");
      }
      observedSnapshot = freeze(snapshot.data);
    }
    return encoded;
  }

  async function handleReceipt(message, values) {
    let ordinaryTimer;
    let invoked = false;
    let effectSettledResolve;
    const effectSettled = new Promise((resolve) => { effectSettledResolve = resolve; });
    let resultPromise;
    try {
      const operation = async () => {
        if (message.operation === "load") return effectPort.load(values.binding, values.namespace);
        if (message.operation === "prepare") return effectPort.prepare(values.binding, values.namespace);
        if (message.operation === "transition") {
          return effectPort.transition(values.binding, values.snapshot, values.namespace,
            message.expectedPhase, message.nextPhase);
        }
        const localCompletion = Object.freeze({});
        const result = await effectPort.admitAndExecute(
          values.binding, values.snapshot, values.namespace, message.effect, async () => {
            invoked = true;
            clearTimeout(ordinaryTimer);
            let invokeId;
            try {
              invokeId = sentId + 1;
              const completion = new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                  void fail("creation-effect-timeout");
                }, configuredLimits.effectMs);
                activeEffect = { invokeId, resolve, reject, timer, completed: false };
              });
              // A write can fail before this callback reaches its await. Keep a
              // rejection observed while the lifecycle independently proves quiescence.
              completion.catch(() => {});
              if (write("effect-invoke", {
                parentId: message.id, effect: message.effect,
              }) !== invokeId) throw new Error("effect id changed");
              const response = await completion;
              if (terminalFailure) throw new Error("terminal creation protocol failure");
              if (response.ok !== true) throw new Error("creation effect failed");
              return localCompletion;
            } catch (error) {
              // `fail` starts stop confirmation without waiting for this callback.
              // Holding here keeps the Native admission and host scope in custody
              // until exact local lifecycle quiescence is independently known.
              await fail(terminalFailure ?? "creation-effect-unavailable");
              throw error;
            } finally {
              if (invokeId && activeEffect?.invokeId === invokeId) {
                clearTimeout(activeEffect.timer);
                activeEffect = null;
              }
              effectSettledResolve();
            }
          },
        );
        if (terminalFailure) throw new Error("terminal creation protocol failure");
        if (result === localCompletion && invoked) return Object.freeze({ executed: true });
        return result;
      };
      resultPromise = operation();
      if (!invoked) {
        const timeout = new Promise((_, reject) => {
          ordinaryTimer = setTimeout(() => {
            reject(new Error("creation receipt deadline"));
            void fail("creation-rpc-timeout");
          }, configuredLimits.rpcMs);
        });
        // The callback clears the ordinary timer before it can race the effect.
        const value = await Promise.race([resultPromise, timeout]);
        clearTimeout(ordinaryTimer);
        sendResponse("receipt-result", message.id,
          value?.executed === true ? value : recordPortValue(
            value, values.binding, values.namespace));
      } else {
        await effectSettled;
        const value = await withDeadline(() => resultPromise, configuredLimits.rpcMs);
        sendResponse("receipt-result", message.id,
          value?.executed === true ? value : recordPortValue(
            value, values.binding, values.namespace));
      }
    } catch (error) {
      if (!stopping) void fail("creation-receipt-unavailable");
      if (resultPromise) await Promise.allSettled([resultPromise]);
      throw error;
    } finally {
      clearTimeout(ordinaryTimer);
      activeReceipt = null;
      drainQuiescent();
    }
  }

  function handleReply(message) {
    const parentId = message.parentId;
    if (!Number.isSafeInteger(parentId) || parentId < 1) throw new Error("invalid parent id");
    const pending = replies.get(parentId);
    if (!pending || pending.kind !== message.kind) throw new Error("unsolicited response");
    replies.delete(parentId);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  function applyResult(value) {
    const failure = failureSchema.safeParse(value);
    if (failure.success) return freeze(failure.data);
    const success = z.strictObject({
      code: z.literal("created-unregistered"), operationId: identifier,
      phase: z.literal("published"), replayed: z.boolean(),
      targetPresent: z.literal(true), registered: z.literal(false),
    }).parse(value);
    if (!acceptedClaims || success.operationId !== acceptedClaims.operationId
      || observedSnapshot?.phase !== "published"
      || !acceptedBinding
      || !isDeepStrictEqual(observedSnapshot.binding, acceptedBinding)) {
      throw new Error("success lacks published receipt");
    }
    return freeze(success);
  }

  function dispatch(message) {
    if (message.kind === "authority-read") {
      if (!exactKeys(message, ["version", "connectionId", "id", "kind", "parentId"])
        || state !== "applying" || activeAuthority
        || message.parentId !== (activeEffect?.invokeId ?? null)) {
        throw new Error("invalid authority read");
      }
      activeAuthority = true;
      return handleAuthority(message);
    }
    if (message.kind === "receipt") {
      if (state !== "applying" || activeReceipt) {
        throw new Error("concurrent receipt request");
      }
      const values = validateReceipt(message);
      activeReceipt = message.id;
      return handleReceipt(message, values);
    }
    if (message.kind === "effect-complete") {
      if (!exactKeys(message, ["version", "connectionId", "id", "kind", "parentId", "ok"])
        || typeof message.ok !== "boolean" || activeAuthority
        || !activeEffect || activeEffect.completed
        || message.parentId !== activeEffect.invokeId) throw new Error("invalid effect completion");
      const current = activeEffect;
      current.completed = true;
      clearTimeout(current.timer);
      current.resolve({ ok: message.ok });
      return;
    }
    if (["ready", "apply-result"].includes(message.kind)) {
      if (message.kind === "ready") {
        if (!exactKeys(message, ["version", "connectionId", "id", "kind", "parentId"])) {
          throw new Error("invalid ready response");
        }
      } else if (!exactKeys(message, ["version", "connectionId", "id", "kind", "parentId", "value"])) {
        throw new Error("invalid apply response");
      }
      const completed = message.kind === "apply-result" ? applyResult(message.value) : null;
      handleReply(message);
      if (completed) {
        finalReplyAccepted = true;
        state = "quarantined";
        if (!stopping) stopping = confirmStop("creation-provider-complete", completed);
      }
      return;
    }
    throw new Error("invalid message kind");
  }

  worker.readable.on("data", (chunk) => {
    if (state === "quiescent" || (state === "quarantined" && !finalReplyAccepted)) return;
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > configuredLimits.frameBytes && !buffer.includes(10)) {
      void fail("creation-frame-too-large");
      return;
    }
    while (true) {
      const end = buffer.indexOf(10);
      if (end < 0) break;
      if (end + 1 > configuredLimits.frameBytes) {
        void fail("creation-frame-too-large");
        return;
      }
      const frame = buffer.subarray(0, end);
      buffer = buffer.subarray(end + 1);
      try {
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(frame);
        const message = parseStrictJson(text);
        if (!exactKeys(message, Object.keys(message)) || message.version !== 1
          || message.connectionId !== connectionId
          || !Number.isSafeInteger(message.id) || message.id !== receivedId + 1) {
          throw new Error("invalid protocol envelope");
        }
        receivedId = message.id;
        const pending = dispatch(message);
        Promise.resolve(pending).catch(() => { void fail("creation-protocol-error"); });
      } catch {
        void fail("creation-protocol-error");
        return;
      }
    }
    if (buffer.length > configuredLimits.frameBytes) void fail("creation-frame-too-large");
  });
  for (const emitter of [worker.readable, worker.writable]) {
    emitter.on?.("error", () => { void fail("creation-connection-lost"); });
  }
  worker.readable.on("end", () => {
    if (buffer.length !== 0) void fail("creation-partial-frame");
    else if (!finalReplyAccepted) void fail("creation-connection-lost");
  });

  try {
    await request("initialize", {}, "ready", configuredLimits.rpcMs);
  } catch {
    await fail("creation-worker-unavailable");
    return refusingProvider("creation-worker-unavailable");
  }
  if (terminalFailure || ["quarantined", "quiescent"].includes(state)) {
    await (stopping ?? fail("creation-worker-unavailable"));
    return refusingProvider(terminalFailure ?? "creation-worker-unavailable");
  }
  state = "ready";

  return Object.freeze({
    readiness: () => Object.freeze({ status: state === "ready" ? "ready" : state }),
    apply: async (claimsValue) => {
      if (used || state !== "ready") return recovery("creation-provider-unavailable");
      used = true;
      let claims;
      try {
        claims = freeze(claimsSchema.parse(claimsValue));
      } catch {
        state = "quarantined";
        if (!stopping) stopping = confirmStop("invalid-creation-request");
        await stopping;
        return Object.freeze({ code: "invalid-input", reason: "invalid-creation-request", phase: null });
      }
      state = "applying";
      acceptedClaims = claims;
      return new Promise((resolve) => {
        const applyTimer = setTimeout(() => { void fail("creation-apply-timeout"); },
          configuredLimits.applyMs);
        applyCall = {
          resolve: (value) => {
            clearTimeout(applyTimer);
            applyCall = null;
            resolve(value);
          },
        };
        const requestId = sentId + 1;
        const reply = awaitReply(requestId, "apply-result", configuredLimits.applyMs);
        applyRequestId = requestId;
        try {
          if (write("apply", { claims }) !== requestId) throw new Error("apply id changed");
        } catch {
          void fail("creation-connection-lost");
          return;
        }
        reply.catch(() => {});
      });
    },
    close: async () => {
      if (state === "quiescent") return;
      await fail("creation-provider-closed");
    },
  });
}
