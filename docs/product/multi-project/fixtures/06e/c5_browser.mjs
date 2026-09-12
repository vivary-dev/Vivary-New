import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { disablePlaywrightFocusEmulation } from "../05b/gui_display.mjs";

const [inputPath] = process.argv.slice(2);
assert.ok(inputPath);
const input = JSON.parse(await readFile(inputPath, "utf8"));
assert.deepEqual(Object.keys(input).sort(), [
  "baseUrl",
  "chromiumExecutable",
  "evidenceRoot",
  "playwrightPackageJson",
  "proofToken",
  "schema",
].sort());
assert.equal(input.schema, "vivary.06e-c5-browser-input/v1");
assert.match(input.proofToken, /^[a-f0-9]{64}$/);
const baseUrl = new URL(input.baseUrl);
assert.equal(baseUrl.hostname, "127.0.0.1");
assert.equal(baseUrl.protocol, "http:");
const evidenceRoot = path.resolve(input.evidenceRoot);
await mkdir(evidenceRoot, { recursive: false, mode: 0o700 });

const require = createRequire(input.playwrightPackageJson);
const { chromium } = require("playwright");
const events = [];
const checks = [];
const pageErrors = [];
const consoleMessages = [];
const failedRequests = [];
const browserRequests = [];
const screenshots = [];
const transportProbes = [];
const PROBE_DEADLINE_MILLISECONDS = 20_000;
const COMPLETED_META_KEYS = [
  "ordinal", "window", "category", "method", "path", "requestBytes",
  "requestSha256", "responseStatus", "responseBytes", "responseSha256", "completedAt",
];
const MUTATION_BODIES = Object.freeze({
  "localization-write": JSON.stringify({ locale: "en-US", preference: "system", dir: "ltr" }),
  "chat-url-write": JSON.stringify({ pathname: "/chat", search: "", hash: "", searchParams: {} }),
  "chat-engine-list": JSON.stringify({ action: "list" }),
});
const MUTATION_REQUESTS = Object.freeze({
  "localization-write": Object.freeze({
    method: "PUT",
    path: "/_agent-native/application-state/localization",
  }),
  "chat-url-write": Object.freeze({
    method: "PUT",
    path: "/_agent-native/application-state/__url__",
  }),
  "chat-engine-list": Object.freeze({
    method: "POST",
    path: "/_agent-native/actions/manage-agent-engine",
  }),
});

function deadlineTimeout(deadlineAt, label) {
  if (deadlineAt === undefined) return undefined;
  const remaining = deadlineAt - Date.now();
  assert.ok(remaining > 0, label + " exceeded the whole-probe deadline");
  return remaining;
}

function assertCompletedMeta(meta, windowName, category) {
  assert.deepEqual(Object.keys(meta).sort(), COMPLETED_META_KEYS.slice().sort());
  const request = MUTATION_REQUESTS[category];
  const body = Buffer.from(MUTATION_BODIES[category]);
  assert.ok(Number.isSafeInteger(meta.ordinal) && meta.ordinal > 0);
  assert.equal(meta.window, windowName);
  assert.equal(meta.category, category);
  assert.equal(meta.method, request.method);
  assert.equal(meta.path, request.path);
  assert.equal(meta.requestBytes, body.length);
  assert.equal(meta.requestSha256, sha256(body));
  assert.equal(meta.responseStatus, 200);
  assert.ok(Number.isSafeInteger(meta.responseBytes) && meta.responseBytes > 0);
  assert.match(meta.responseSha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(meta.completedAt) && meta.completedAt > 0);
}

function assertBootstrapComplete(value, windowName) {
  assert.deepEqual(Object.keys(value).sort(), [
    "id", "ok", "localizationWrites", "chatUrlWrites", "chatEngineLists", "completed",
  ].sort());
  assert.ok(Number.isSafeInteger(value.id) && value.id > 0);
  assert.equal(value.ok, true);
  assert.equal(value.localizationWrites, 1);
  const categories = windowName === "chat"
    ? ["chat-engine-list", "chat-url-write", "localization-write"]
    : ["localization-write"];
  assert.equal(value.chatUrlWrites, windowName === "chat" ? 1 : 0);
  assert.equal(value.chatEngineLists, windowName === "chat" ? 1 : 0);
  assert.deepEqual(Object.keys(value.completed).sort(), categories);
  for (const category of categories) assertCompletedMeta(value.completed[category], windowName, category);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function recordCheck(route, name, details = {}) {
  checks.push({ route, name, passed: true, ...details });
}

async function control(action, deadlineAt) {
  const timeout = deadlineTimeout(deadlineAt, "proof control");
  const response = await fetch(new URL("/_proof/control", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vivary-proof-token": input.proofToken,
    },
    body: JSON.stringify(action),
    ...(timeout === undefined ? {} : { signal: AbortSignal.timeout(timeout) }),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const value = JSON.parse(text);
  assert.equal(value.error, undefined, JSON.stringify(value.error));
  return value;
}

async function takeScreenshot(page, name) {
  assert.match(name, /^[a-z0-9-]+$/);
  const target = path.join(evidenceRoot, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  const bytes = await readFile(target);
  screenshots.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
}

async function waitForNoSelection(page) {
  await page.getByRole("heading", { name: "Choose a project", exact: true }).waitFor();
  assert.equal(await page.getByText("C5 Alpha original activity", { exact: true }).count(), 0);
  assert.equal(await page.getByText("C5 Alpha replacement activity", { exact: true }).count(), 0);
}

async function waitForProject(page, name) {
  await page.getByRole("button", { name, exact: true }).waitFor();
}

async function selectProject(page, name, deadlineAt) {
  const timeout = deadlineTimeout(deadlineAt, "project selection");
  const selectionResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === "PUT"
      && url.pathname === "/_agent-native/application-state/vivary-project-selection-v1";
  }, timeout === undefined ? {} : { timeout });
  await page.getByRole("button", { name, exact: true }).click(
    timeout === undefined ? {} : { timeout },
  );
  const response = await selectionResponse;
  assert.equal(response.status(), 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["projectId", "scopeKey"]);
  assert.equal(body.projectId.length > 0, true);
  assert.equal(body.scopeKey.length, 64);
  return body;
}

async function waitForActivity(page, kind) {
  const other = kind === "original" ? "replacement" : "original";
  await page.getByText(`C5 Alpha ${kind} activity`, { exact: true }).waitFor();
  const card = page.locator("details.agent-conversation-tool")
    .filter({ hasText: "Read file" }).first();
  await card.locator("summary").waitFor();
  if (!await card.evaluate(element => element.open)) await card.locator("summary").click();
  const result = card.locator("pre").filter({ hasText: `C5 Alpha ${kind} tool result` });
  await result.waitFor();
  assert.equal(await page.getByText(`C5 Alpha ${other} activity`, { exact: true }).count(), 0);
}

const waitForOriginal = page => waitForActivity(page, "original");
const waitForReplacement = page => waitForActivity(page, "replacement");

async function assertNoComposer(page) {
  assert.equal(await page.locator("textarea").count(), 0);
  assert.equal(await page.getByRole("button", { name: /send/i }).count(), 0);
}

async function waitForHeldAlpha(deadlineAt) {
  while (Date.now() < deadlineAt) {
    const status = await control({ action: "hold-status" }, deadlineAt);
    if (status.held) return status;
    await new Promise(resolve => setTimeout(resolve,
      Math.min(25, deadlineTimeout(deadlineAt, "held Alpha wait"))));
  }
  throw new Error("completed Alpha activity response was not held before the whole-probe deadline");
}

function originalClaims() {
  return {
    expectedBindingRevision: fixtureIds.alpha.bindingRevision,
    expectedPolicyRevision: fixtureIds.policyRevision,
    projectId: fixtureIds.alpha.projectId,
    scopeKey: fixtureIds.scopeKey,
  };
}

function originalActivityIdentity() {
  const original = identityEvidence.seededRuns.original;
  const reference = original.reference;
  assert.equal(original.threadId, reference.nativeThreadId);
  assert.equal(original.sessionId, reference.nativeSessionId);
  assert.equal(original.runId, reference.nativeRunId);
  return {
    code: "activity",
    projectId: fixtureIds.alpha.projectId,
    scopeKey: fixtureIds.scopeKey,
    bindingRevision: fixtureIds.alpha.bindingRevision,
    policyRevision: fixtureIds.policyRevision,
    referenceRevision: reference.referenceRevision,
    nativeThreadId: reference.nativeThreadId,
    nativeRunId: reference.nativeRunId,
    nativeScope: {
      type: "vivary-project-runtime-v1",
      id: reference.bindingIdentityDigest,
    },
  };
}

function assertOriginalActivityBody(body) {
  assert.deepEqual(Object.keys(body).sort(), [
    "code", "projectId", "scopeKey", "bindingRevision", "policyRevision",
    "referenceRevision", "nativeThreadId", "nativeScope", "nativeRunId", "items",
  ].sort());
  const { items, ...identity } = body;
  assert.deepEqual(identity, originalActivityIdentity());
  assert.ok(Array.isArray(items) && items.length > 0);
  const serialized = JSON.stringify(items);
  assert.ok(serialized.includes("C5 Alpha original activity"));
  assert.ok(serialized.includes("C5 Alpha original tool result"));
}

async function runRoute(page, routePath, label) {
  let probeArmed = false;
  try {
    await control({ action: "reset-route", label });
    await control({ action: "window", name: `c5-${label}` });
    const routeStart = (await control({ action: "snapshot", label: `${label}-before-route` })).snapshot;

    await page.goto(new URL(routePath, baseUrl).href);
    await waitForProject(page, "Alpha");
    await waitForProject(page, "Beta");
    await waitForNoSelection(page);
    assert.equal(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().locale), "en-US");
    const bootstrap = await control({ action: "bootstrap-complete" });
    assertBootstrapComplete(bootstrap, `c5-${label}`);
    const noSelection = (await control({ action: "snapshot", label: `${label}-no-selection` })).snapshot;
    assert.equal(routeStart.immutableTablesSha256, routeStart.baselineImmutableTablesSha256);
    assert.equal(noSelection.immutableTablesSha256, routeStart.immutableTablesSha256);
    const routeRequests = noSelection.requests.slice(routeStart.requests.length);
    assert.equal(routeRequests.filter(item => ["readiness", "activity"].includes(item.category)).length, 0);
    recordCheck(label, "no selection sends no readiness or activity request");

    await selectProject(page, "Alpha");
    await waitForOriginal(page);
    await assertNoComposer(page);
    recordCheck(label, "Alpha shows only exact Native text and expanded tool activity");
    await takeScreenshot(page, `${label}-alpha`);

    await selectProject(page, "Beta");
    await page.getByRole("heading", { name: "Run activity", exact: true }).waitFor();
    await page.getByText("Run activity unavailable", { exact: true }).waitFor();
    await page.getByText("No verified run activity is available for this project.", { exact: true }).waitFor();
    assert.equal(await page.getByText(/C5 Alpha/, { exact: false }).count(), 0);
    await assertNoComposer(page);
    recordCheck(label, "available Beta without a verified reference shows unavailable activity");

    const probeStartedAt = Date.now();
    const probeDeadlineAt = probeStartedAt + PROBE_DEADLINE_MILLISECONDS;
    const claims = originalClaims();
    await page.evaluate(value => window.__c5TransportProbe.arm(value), claims);
    probeArmed = true;
    const armed = await page.evaluate(() => window.__c5TransportProbe.state());
    assert.deepEqual(armed.claims, claims);
    assert.equal(armed.duplicateKeyRejected, true);
    assert.equal(armed.duplicateTargetAttempts, 0);
    await control({ action: "hold-alpha" }, probeDeadlineAt);
    const alphaTimeout = deadlineTimeout(probeDeadlineAt, "Alpha selection");
    const alphaPut = page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "PUT"
        && url.pathname === "/_agent-native/application-state/vivary-project-selection-v1"
        && response.request().postDataJSON()?.projectId === fixtureIds.alpha.projectId;
    }, { timeout: alphaTimeout });
    await page.getByRole("button", { name: "Alpha", exact: true }).click({ timeout: alphaTimeout });
    const alphaPutResponse = await alphaPut;
    assert.equal(alphaPutResponse.status(), 200);
    await waitForHeldAlpha(probeDeadlineAt);
    const heldSnapshot = (await control(
      { action: "snapshot", label: `${label}-held-alpha` },
      probeDeadlineAt,
    )).snapshot;
    const heldResponse = heldSnapshot.requests.findLast(item =>
      item.category === "activity"
      && item.activityIdentity?.nativeRunId === identityEvidence.seededRuns.original.runId);
    assert.ok(heldResponse);
    assert.deepEqual(heldResponse.activityIdentity, originalActivityIdentity());
    assert.equal(heldResponse.responseStatus, 200);
    assert.equal(heldResponse.method, "GET");
    assert.equal(heldResponse.requestBytes, 0);
    assert.equal(heldResponse.requestSha256, null);

    const betaSelectionStartedAt = Date.now();
    assert.ok(heldResponse.completedAt <= betaSelectionStartedAt);
    const betaValue = await selectProject(page, "Beta", probeDeadlineAt);
    const betaPutCompletedAt = Date.now();
    assert.equal(betaValue.projectId, fixtureIds.beta.projectId);
    await page.waitForFunction(() => window.__c5TransportProbe.state().signalAborted === true,
      undefined, { timeout: deadlineTimeout(probeDeadlineAt, "selection abort") });
    const beforeRelease = await page.evaluate(() => window.__c5TransportProbe.state());
    assert.equal(beforeRelease.invocations, 1);
    assert.equal(beforeRelease.signalSupplied, true);
    assert.equal(beforeRelease.signalAborted, true);
    assert.ok(beforeRelease.signalAbortedAt >= betaSelectionStartedAt);
    await page.getByText("Run activity unavailable", { exact: true }).waitFor({
      timeout: deadlineTimeout(probeDeadlineAt, "Beta unavailable state"),
    });

    const releaseStartedAt = Date.now();
    assert.ok(heldResponse.completedAt <= betaSelectionStartedAt);
    assert.ok(betaPutCompletedAt <= releaseStartedAt);
    assert.ok(beforeRelease.signalAbortedAt <= releaseStartedAt);
    const released = await control({ action: "release-alpha" }, probeDeadlineAt);
    assert.equal(released.ok, true);
    assert.deepEqual(released.completedResponse, heldResponse);
    await page.waitForFunction(() => window.__c5TransportProbe.state().received === true,
      undefined, { timeout: deadlineTimeout(probeDeadlineAt, "held response delivery") });
    const probe = await page.evaluate(() => window.__c5TransportProbe.state());
    assert.equal(probe.responseStatus, 200);
    assert.equal(probe.responseSha256, released.completedResponse.responseSha256);
    assert.ok(probe.receivedAt >= releaseStartedAt);
    assert.ok(probe.responseBytes <= 256 * 1024);
    assertOriginalActivityBody(probe.responseBody);
    assert.equal(await page.getByText(/C5 Alpha/, { exact: false }).count(), 0);
    await page.getByText("No verified run activity is available for this project.", { exact: true }).waitFor({
      timeout: deadlineTimeout(probeDeadlineAt, "stale DOM exclusion"),
    });
    const probeCompletedAt = Date.now();
    assert.ok(probeCompletedAt <= probeDeadlineAt);
    const relativeOrder = beforeRelease.signalAbortedAt <= betaPutCompletedAt
      ? "signal-abort-before-or-with-beta-put"
      : "beta-put-before-signal-abort";
    transportProbes.push({
      route: label,
      ...probe,
      heldResponseSha256: released.completedResponse.responseSha256,
      heldCompletedAt: heldResponse.completedAt,
      betaSelectionStartedAt,
      betaPutCompletedAt,
      releaseStartedAt,
      probeStartedAt,
      probeCompletedAt,
      durationMilliseconds: probeCompletedAt - probeStartedAt,
      relativeOrder,
    });
    recordCheck(label, "adversarial uncancellable Alpha response cannot cross completed Beta selection", {
      heldResponseSha256: released.completedResponse.responseSha256,
      heldCompletedAt: heldResponse.completedAt,
      betaSelectionStartedAt,
      betaPutCompletedAt,
      signalAbortedAt: probe.signalAbortedAt,
      releaseStartedAt,
      responseReceivedAt: probe.receivedAt,
      durationMilliseconds: probeCompletedAt - probeStartedAt,
      relativeOrder,
    });
    await page.evaluate(() => window.__c5TransportProbe.restore());
    probeArmed = false;

    await selectProject(page, "Alpha");
    await waitForOriginal(page);
    await control({ action: "replace-reference" });
    await disablePlaywrightFocusEmulation(context, page);
    const otherPage = await context.newPage();
    await disablePlaywrightFocusEmulation(context, otherPage);
    await otherPage.goto("about:blank");
    await otherPage.bringToFront();
    await page.waitForTimeout(100);
    await page.bringToFront();
    await waitForReplacement(page);
    await otherPage.close();
    recordCheck(label, "focus refetch renders only the preseeded replacement reference");

    const beforeRevocation = (await control({ action: "snapshot", label: `${label}-before-revocation` })).snapshot;
    await control({ action: "revoke-role" });
    await page.getByRole("button", { name: "Refresh projects", exact: true }).click();
    await page.getByText("Project access is unavailable. Ask the workspace owner to check your folder access.",
      { exact: true }).waitFor();
    assert.equal(await page.getByText(/C5 Alpha/, { exact: false }).count(), 0);
    const afterRevocation = (await control({ action: "snapshot", label: `${label}-after-revocation` })).snapshot;
    const revocationRequests = afterRevocation.requests.slice(beforeRevocation.requests.length);
    assert.equal(revocationRequests.some(item => item.method === "DELETE"), false);
    assert.equal(revocationRequests.some(item => item.category === "selection-write"), false);
    assert.equal(afterRevocation.immutableTablesSha256, beforeRevocation.immutableTablesSha256);
    recordCheck(label, "role revocation and Refresh clear selection and activity without DELETE");

    const current = (await control({ action: "snapshot", label: `${label}-complete` })).snapshot;
    assert.deepEqual(current.counters, routeStart.counters);
    assert.equal(current.immutableTablesSha256, routeStart.immutableTablesSha256);
    await takeScreenshot(page, `${label}-revoked`);
  } finally {
    if (probeArmed && !page.isClosed()) {
      await page.evaluate(() => window.__c5TransportProbe.restore()).catch(() => undefined);
    }
    const held = await control({ action: "hold-status" }).catch(() => ({ held: false, armed: false }));
    if (held.held || held.armed) await control({ action: "cancel-hold" }).catch(() => undefined);
    if (!page.isClosed()) await page.close();
    const drained = await control({ action: "drain" });
    assert.equal(drained.drained, true);
    assert.equal(drained.pendingRequests, 0);
  }
}

const browser = await chromium.launch({
  executablePath: input.chromiumExecutable,
  headless: false,
  chromiumSandbox: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  locale: "en-US",
  serviceWorkers: "block",
});
const requestLifecycle = [];
const requestRecords = new WeakMap();
const externalAttempts = [];
const websocketEvents = [];
const eventSourceRequests = [];
const attachedPages = new WeakSet();

function attachPage(page) {
  if (attachedPages.has(page)) return;
  attachedPages.add(page);
  page.on("pageerror", error => pageErrors.push({
    url: page.url(),
    name: error.name,
    message: error.message.slice(0, 2048),
  }));
  page.on("console", message => consoleMessages.push({
    url: page.url(),
    type: message.type(),
    text: message.text().slice(0, 4096),
  }));
}
context.on("page", attachPage);
context.on("request", request => {
  const url = new URL(request.url());
  const entry = {
    ordinal: requestLifecycle.length + 1,
    method: request.method(),
    origin: url.origin,
    path: `${url.pathname}${url.search}`,
    resourceType: request.resourceType(),
    documentUrl: request.frame()?.url() ?? null,
    bodySha256: request.postData() ? sha256(Buffer.from(request.postData())) : null,
    startedAt: Date.now(),
    terminal: null,
  };
  requestLifecycle.push(entry);
  requestRecords.set(request, entry);
  browserRequests.push({ ...entry });
});
context.on("requestfinished", request => {
  const entry = requestRecords.get(request);
  if (entry) entry.terminal = { kind: "finished", at: Date.now() };
});
context.on("requestfailed", request => {
  const entry = requestRecords.get(request);
  const failure = {
    method: request.method(),
    url: request.url(),
    error: request.failure()?.errorText ?? null,
  };
  if (entry) entry.terminal = { kind: "failed", at: Date.now(), error: failure.error };
  failedRequests.push(failure);
});
await context.routeWebSocket("**/*", async socket => {
  const url = new URL(socket.url());
  websocketEvents.push({
    url: socket.url(),
    origin: url.origin,
    blocked: true,
    at: Date.now(),
  });
  await socket.close({ code: 1008, reason: "C5 proof blocks WebSocket traffic" });
});
await context.route("**/*", async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (request.resourceType() === "eventsource") {
    eventSourceRequests.push({
      method: request.method(),
      url: request.url(),
      origin: url.origin,
      blocked: true,
      at: Date.now(),
    });
    await route.abort("blockedbyclient");
    return;
  }
  if (url.protocol !== "about:" && url.origin !== baseUrl.origin) {
    externalAttempts.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      origin: url.origin,
      blocked: true,
      at: Date.now(),
    });
    await route.abort("blockedbyclient");
    return;
  }
  await route.continue();
});

await context.addInitScript(() => {
  let installed = false;
  let restored = false;
  let armedClaims = null;
  let ownFetchDescriptor = null;
  let previousFetch = null;
  const record = {
    invocations: 0,
    claims: null,
    signalSupplied: false,
    signalAborted: false,
    signalAbortedAt: null,
    requestStartedAt: null,
    responseStatus: null,
    responseBytes: null,
    responseSha256: null,
    responseBody: null,
    duplicateKeyRejected: false,
    duplicateTargetAttempts: 0,
    received: false,
    receivedAt: null,
  };
  const toHex = bytes => [...new Uint8Array(bytes)]
    .map(value => value.toString(16).padStart(2, "0")).join("");
  const readBounded = async response => {
    if (!response.body) return new Uint8Array();
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 256 * 1024) {
        await reader.cancel("C5 transport probe response exceeded limit");
        throw new Error("C5 transport probe response exceeded limit");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  };
  const matchesClaims = url => {
    const keys = [...url.searchParams.keys()].sort();
    const expectedKeys = ["expectedBindingRevision", "expectedPolicyRevision", "projectId", "scopeKey"];
    return keys.length === expectedKeys.length
      && keys.every((key, index) => key === expectedKeys[index])
      && expectedKeys.every(key => url.searchParams.getAll(key).length === 1)
      && url.searchParams.get("projectId") === armedClaims.projectId
      && url.searchParams.get("scopeKey") === armedClaims.scopeKey
      && url.searchParams.get("expectedBindingRevision") === String(armedClaims.expectedBindingRevision)
      && url.searchParams.get("expectedPolicyRevision") === String(armedClaims.expectedPolicyRevision);
  };
  const c5AdversarialFetch = async function c5AdversarialFetch(resource, init) {
    const rawUrl = typeof resource === "string" || resource instanceof URL
      ? String(resource)
      : resource.url;
    const url = new URL(rawUrl, location.href);
    const method = String(init?.method ?? (resource instanceof Request ? resource.method : "GET")).toUpperCase();
    const exactTarget = armedClaims !== null
      && url.origin === location.origin
      && method === "GET"
      && url.pathname === "/_agent-native/actions/vivary-project-runtime-activity"
      && matchesClaims(url);
    if (!exactTarget) return Reflect.apply(previousFetch, this, [resource, init]);
    if (record.invocations !== 0) {
      record.duplicateTargetAttempts += 1;
      throw new Error("C5 probe received a second exact target request");
    }
    if (resource instanceof Request) throw new Error("C5 probe expected URL plus init transport");
    const signal = init?.signal;
    if (!(signal instanceof AbortSignal)) throw new Error("C5 probe requires the supplied request signal");
    record.invocations += 1;
    record.signalSupplied = true;
    record.requestStartedAt = Date.now();
    if (signal.aborted) {
      record.signalAborted = true;
      record.signalAbortedAt = Date.now();
    } else {
      signal.addEventListener("abort", () => {
        record.signalAborted = true;
        record.signalAbortedAt = Date.now();
      }, { once: true });
    }
    const forwarded = { ...init };
    delete forwarded.signal;
    const response = await Reflect.apply(previousFetch, this, [resource, forwarded]);
    const bytes = await readBounded(response.clone());
    const bodyText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    record.responseStatus = response.status;
    record.responseBytes = bytes.byteLength;
    record.responseSha256 = toHex(await crypto.subtle.digest("SHA-256", bytes));
    record.responseBody = JSON.parse(bodyText);
    record.received = true;
    record.receivedAt = Date.now();
    return response;
  };
  const api = Object.freeze({
    arm(claims) {
      if (installed || restored || armedClaims !== null || record.invocations !== 0) {
        throw new Error("C5 transport probe can arm only once");
      }
      const keys = Object.keys(claims ?? {}).sort();
      const expectedKeys = ["expectedBindingRevision", "expectedPolicyRevision", "projectId", "scopeKey"];
      if (keys.join("\0") !== expectedKeys.sort().join("\0")) throw new Error("invalid C5 probe claims");
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(claims.projectId)) throw new Error("invalid C5 probe project");
      if (!/^[a-f0-9]{64}$/.test(claims.scopeKey)) throw new Error("invalid C5 probe scope");
      if (!Number.isSafeInteger(claims.expectedBindingRevision) || claims.expectedBindingRevision < 1) {
        throw new Error("invalid C5 probe binding revision");
      }
      if (!Number.isSafeInteger(claims.expectedPolicyRevision) || claims.expectedPolicyRevision < 1) {
        throw new Error("invalid C5 probe policy revision");
      }
      armedClaims = structuredClone(claims);
      record.claims = structuredClone(claims);
      const duplicate = new URL(
        "/_agent-native/actions/vivary-project-runtime-activity",
        location.origin,
      );
      duplicate.searchParams.set("expectedBindingRevision", String(claims.expectedBindingRevision));
      duplicate.searchParams.set("expectedPolicyRevision", String(claims.expectedPolicyRevision));
      duplicate.searchParams.set("projectId", claims.projectId);
      duplicate.searchParams.set("scopeKey", claims.scopeKey);
      duplicate.searchParams.append("projectId", claims.projectId);
      record.duplicateKeyRejected = !matchesClaims(duplicate);
      if (!record.duplicateKeyRejected) throw new Error("C5 probe accepted a duplicate claim key");
      ownFetchDescriptor = Object.getOwnPropertyDescriptor(window, "fetch");
      previousFetch = window.fetch;
      const descriptor = ownFetchDescriptor ?? {
        configurable: true,
        enumerable: true,
        writable: true,
        value: previousFetch,
      };
      Object.defineProperty(window, "fetch", { ...descriptor, value: c5AdversarialFetch });
      installed = true;
    },
    state() {
      return structuredClone(record);
    },
    restore() {
      if (restored) return;
      restored = true;
      if (!installed) return;
      if (ownFetchDescriptor) Object.defineProperty(window, "fetch", ownFetchDescriptor);
      else Reflect.deleteProperty(window, "fetch");
    },
  });
  Object.defineProperty(window, "__c5TransportProbe", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api,
  });
});

let fixtureIds = null;
let identityEvidence = null;
let browserClosedNaturally = false;
let terminalError = null;
let finalSnapshot = null;
let passed = false;
try {
  const identityReply = await control({ action: "identities" });
  assert.deepEqual(Object.keys(identityReply).sort(), [
    "id", "identity", "cookieName", "fixture", "providerIdentity", "seededRuns",
    "setupCounters",
  ].sort());
  assert.deepEqual(Object.keys(identityReply.fixture).sort(), [
    "alpha", "beta", "scopeKey", "policyRevision", "registryRevision", "chatScope",
  ].sort());
  assert.deepEqual(Object.keys(identityReply.seededRuns).sort(), ["original", "replacement"]);
  for (const name of ["original", "replacement"]) {
    const seeded = identityReply.seededRuns[name];
    assert.deepEqual(Object.keys(seeded).sort(),
      ["reference", "threadId", "sessionId", "runId"].sort());
    assert.deepEqual(Object.keys(seeded.reference).sort(), [
      "schemaVersion", "referenceRevision", "bindingIdentityDigest",
      "nativeThreadId", "nativeSessionId", "nativeRunId", "harnessName",
    ].sort());
    assert.equal(seeded.threadId, seeded.reference.nativeThreadId);
    assert.equal(seeded.sessionId, seeded.reference.nativeSessionId);
    assert.equal(seeded.runId, seeded.reference.nativeRunId);
  }
  fixtureIds = identityReply.fixture;
  identityEvidence = identityReply;
  await context.addCookies([{
    name: identityReply.cookieName,
    value: identityReply.identity.token,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);

  const rootPage = await context.newPage();
  attachPage(rootPage);
  await runRoute(rootPage, "/", "root");
  const workbenchPage = await context.newPage();
  attachPage(workbenchPage);
  await runRoute(workbenchPage, "/workbench", "workbench");

  await control({ action: "reset-route", label: "workbench" });
  await control({ action: "window", name: "chat" });
  const beforeChat = (await control({ action: "snapshot", label: "before-chat" })).snapshot;
  const chatPage = await context.newPage();
  attachPage(chatPage);
  await chatPage.goto(new URL("/chat", baseUrl).href);
  await chatPage.getByText("C5 chat boundary", { exact: true }).waitFor();
  assert.equal(await chatPage.evaluate(() => Intl.DateTimeFormat().resolvedOptions().locale), "en-US");
  const chatBootstrap = await control({ action: "bootstrap-complete" });
  assertBootstrapComplete(chatBootstrap, "chat");
  const afterChat = (await control({ action: "snapshot", label: "after-chat" })).snapshot;
  const chatRequests = afterChat.requests.slice(beforeChat.requests.length);
  assert.equal(chatRequests.some(item => ["readiness", "activity", "selection-write"].includes(item.category)), false);
  assert.ok(chatRequests.some(item => item.category === "chat"
    && item.path.includes(`scopeId=vivary-workbench-chat-v1%3A${identityReply.identity.orgId}`)));
  assert.equal(await chatPage.getByText(/C5 Alpha/, { exact: false }).count(), 0);
  assert.equal(afterChat.immutableTablesSha256, beforeChat.immutableTablesSha256);
  assert.deepEqual(afterChat.bootstrap, {
    open: false,
    localizationWrites: 1,
    chatUrlWrites: 1,
    chatEngineLists: 1,
    localizationWritesByWindow: { "c5-root": 1, "c5-workbench": 1, chat: 1 },
    chatMutationsByWindow: { chat: { chatUrlWrites: 1, chatEngineLists: 1 } },
  });
  recordCheck("chat", "organization-qualified chat stays separate from C5 activity");
  await chatPage.close();
  const chatDrain = await control({ action: "drain" });
  assert.deepEqual(chatDrain, { id: chatDrain.id, drained: true, pendingRequests: 0 });

  finalSnapshot = (await control({ action: "snapshot", label: "browser-final" })).snapshot;
  assert.deepEqual(finalSnapshot.counters, identityReply.setupCounters);
  assert.equal(finalSnapshot.immutableTablesSha256, finalSnapshot.baselineImmutableTablesSha256);
  assert.equal(finalSnapshot.provider.live.length, 1);
  assert.deepEqual(finalSnapshot.provider.live[0], identityReply.providerIdentity);
  assert.equal(externalAttempts.length, 0, JSON.stringify(externalAttempts));
  assert.equal(websocketEvents.length, 0, JSON.stringify(websocketEvents));
  assert.equal(eventSourceRequests.length, 0, JSON.stringify(eventSourceRequests));
  const c5Discovery = browserRequests.filter(item => {
    const documentPath = item.documentUrl ? new URL(item.documentUrl).pathname : null;
    return ["/", "/workbench"].includes(documentPath)
      && (/\/_agent-native\/agent-chat\/(?:threads|runs)/.test(item.path)
        || item.path.startsWith("/_agent-native/runs"));
  });
  assert.deepEqual(c5Discovery, []);
  const browserMutations = browserRequests.filter(item => item.method !== "GET");
  const selectionPath = "/_agent-native/application-state/vivary-project-selection-v1";
  const selectionBody = projectId =>
    sha256(Buffer.from(JSON.stringify({ scopeKey: fixtureIds.scopeKey, projectId })));
  const signature = item =>
    [item.method, item.path, item.bodySha256 ?? item.requestSha256 ?? ""].join("\0");
  const counted = values => Object.fromEntries(
    [...values.reduce((counts, item) => {
      const key = signature(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
  );
  const expectedMutationCounts = counted([
    ...Array.from({ length: 6 }, () => ({
      method: "PUT",
      path: selectionPath,
      bodySha256: selectionBody(fixtureIds.alpha.projectId),
    })),
    ...Array.from({ length: 4 }, () => ({
      method: "PUT",
      path: selectionPath,
      bodySha256: selectionBody(fixtureIds.beta.projectId),
    })),
    ...Array.from({ length: 3 }, () => ({
      method: "PUT",
      path: MUTATION_REQUESTS["localization-write"].path,
      bodySha256: sha256(Buffer.from(MUTATION_BODIES["localization-write"])),
    })),
    {
      method: "PUT",
      path: MUTATION_REQUESTS["chat-url-write"].path,
      bodySha256: sha256(Buffer.from(MUTATION_BODIES["chat-url-write"])),
    },
    {
      method: "POST",
      path: MUTATION_REQUESTS["chat-engine-list"].path,
      bodySha256: sha256(Buffer.from(MUTATION_BODIES["chat-engine-list"])),
    },
  ]);
  assert.deepEqual(counted(browserMutations), expectedMutationCounts);
  const backendMutations = finalSnapshot.requests.filter(item => item.method !== "GET");
  assert.equal(backendMutations.some(item => item.category === "blocked-mutation"), false);
  assert.ok(backendMutations.every(item => item.responseStatus === 200));
  assert.deepEqual(counted(backendMutations), expectedMutationCounts);
  const expectedCategory = new Map([
    [selectionPath, "selection-write"],
    [MUTATION_REQUESTS["localization-write"].path, "localization-write"],
    [MUTATION_REQUESTS["chat-url-write"].path, "chat-url-write"],
    [MUTATION_REQUESTS["chat-engine-list"].path, "chat-engine-list"],
  ]);
  for (const mutation of backendMutations) {
    assert.equal(mutation.category, expectedCategory.get(mutation.path));
  }
  assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
  const fatalFailures = failedRequests.filter(item =>
    !(item.url.includes("/vivary-project-runtime-activity")
      && /abort|cancel|NS_BINDING_ABORTED/i.test(item.error ?? "")));
  assert.equal(fatalFailures.length, 0, JSON.stringify(fatalFailures));
  assert.equal(checks.length, 13);
  assert.equal(transportProbes.length, 2);
  assert.ok(transportProbes.every(probe => probe.invocations === 1
    && probe.signalSupplied && probe.signalAborted && probe.received
    && probe.duplicateKeyRejected
    && probe.duplicateTargetAttempts === 0
    && probe.durationMilliseconds <= PROBE_DEADLINE_MILLISECONDS));
  passed = true;
} catch (error) {
  terminalError = {
    type: error?.constructor?.name ?? "Error",
    message: String(error?.message ?? error).slice(0, 4096),
  };
  throw error;
} finally {
  try {
    await context.close();
    await browser.close();
    browserClosedNaturally = terminalError === null;
  } catch (error) {
    terminalError ??= {
      type: error?.constructor?.name ?? "Error",
      message: String(error?.message ?? error).slice(0, 4096),
    };
  }
  const result = {
    schema: "vivary.06e-c5-browser-result/v1",
    passed: passed && terminalError === null && browserClosedNaturally,
    terminalError,
    checks,
    events,
    screenshots,
    transportProbes,
    browserRequests,
    requestLifecycle,
    externalAttempts,
    websocketEvents,
    eventSourceRequests,
    pageErrors,
    consoleMessages,
    failedRequests,
    finalSnapshot,
    shutdown: {
      browserClosedNaturally,
      chromiumSandbox: true,
      serviceWorkers: "block",
    },
  };
  await writeFile(path.join(evidenceRoot, "browser-result.json"),
    JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
