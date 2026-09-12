import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { disablePlaywrightFocusEmulation } from "./gui_display.mjs";

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
assert.equal(input.schema, "vivary.05b-gui-browser-input/v1");
assert.match(input.proofToken, /^[a-f0-9]{64}$/);
const baseUrl = new URL(input.baseUrl);
assert.equal(baseUrl.hostname, "127.0.0.1");
assert.equal(baseUrl.protocol, "http:");
const evidenceRoot = path.resolve(input.evidenceRoot);
await mkdir(evidenceRoot, { recursive: false });

const require = createRequire(input.playwrightPackageJson);
const { chromium } = require("playwright");
const events = [];
const checks = [];
const pageErrors = [];
const consoleMessages = [];
const failedRequests = [];
const chatPosts = [];
const shareFetchDiagnostics = [];
const shareRequestLifecycle = [];
let acceptedShareCancellations = [];
let fatalFailedRequests = [];
const shareDiagnosticProvenance = {
  schema: "vivary.05b-share-fetch-diagnostic/v1",
  capture: "browser fetch AbortSignal and Playwright request lifecycle",
  fetchEventLimit: 64,
  requestEventLimit: 64,
  stackByteLimit: 4096,
  eventByteLimit: 8192,
  totalByteLimit: 262144,
  cancellationRequestAgeLimitMilliseconds: 250,
  cancellationFetchAgeLimitMilliseconds: 250,
  replacementFinishLimitMilliseconds: 500,
};
let shareFetchDiagnosticBytes = 0;

function recordCheck(name, details = {}) {
  checks.push({ name, passed: true, ...details });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function control(action) {
  const response = await fetch(new URL("/_proof/control", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vivary-proof-token": input.proofToken,
    },
    body: JSON.stringify(action),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const value = JSON.parse(text);
  assert.equal(value.error, undefined, JSON.stringify(value.error));
  return value;
}

function orgChatScope(orgId) {
  assert.match(orgId, /^[A-Za-z0-9_-]{1,128}$/);
  return { type: "workspace-app", id: `vivary-workbench-chat-v1:${orgId}`, label: "Vivary" };
}

function scopeQuery(scope) {
  return `scopeType=${encodeURIComponent(scope.type)}&scopeId=${encodeURIComponent(scope.id)}`;
}

function identityStorageKey(email, orgId) {
  const namespace = encodeURIComponent(JSON.stringify([email.trim().toLowerCase(), orgId]));
  return `vivary-workbench-chat-v1:${namespace}`;
}

function activeThreadStorageKey(email, orgId) {
  const scope = orgChatScope(orgId);
  return `agent-chat-active-thread:${identityStorageKey(email, orgId)}:scope:${scope.type}:${scope.id}`;
}

async function seedSavedThread(page, email, orgId, threadId) {
  const storageKey = identityStorageKey(email, orgId);
  const scope = orgChatScope(orgId);
  await page.evaluate(
    ({ key, id, scopeType, scopeId }) => {
      localStorage.setItem(
        `agent-chat-active-thread:${key}:scope:${scopeType}:${scopeId}`,
        id,
      );
      localStorage.setItem(
        `agent-chat-open-tabs:${key}:scope:${scopeType}:${scopeId}`,
        JSON.stringify([id]),
      );
    },
    { key: storageKey, id: threadId, scopeType: scope.type, scopeId: scope.id },
  );
}

async function setIdentityCookie(context, cookieName, token) {
  await context.clearCookies();
  await context.addCookies([{ name: cookieName, value: token, url: baseUrl.href }]);
}

async function waitForComposer(page) {
  const composer = page.locator('[data-agent-composer-slot="editor"] .ProseMirror[contenteditable="true"]:visible');
  await composer.waitFor({ state: "visible" });
  assert.equal(await composer.count(), 1, "active composer is not unique");
  return composer;
}

async function submitMessage(page, message) {
  const composer = await waitForComposer(page);
  await composer.fill(message);
  const send = page.locator('[data-agent-composer-slot="send-button"]:visible');
  assert.equal(await send.count(), 1, "active Send button is not unique");
  await send.click();
  const transcript = page.locator(".message-scroller-viewport:visible");
  assert.equal(await transcript.count(), 1, "active transcript is not unique");
  await transcript.getByText("Synthetic response.", { exact: true }).last().waitFor();
  return chatPosts.at(-1);
}

function historyTitle(page, title) {
  return page.locator('[data-agent-native="chat-history-list"] .an-chat-history-row__title')
    .filter({ hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
}

async function uniqueHistoryTitle(page, title) {
  const locator = historyTitle(page, title);
  await locator.waitFor({ state: "visible" });
  assert.equal(await locator.count(), 1, `History title is not unique: ${title}`);
  return locator;
}

async function transcriptMessage(page, message) {
  const transcript = page.locator(".message-scroller-viewport:visible");
  assert.equal(await transcript.count(), 1, "active transcript is not unique");
  const locator = transcript.getByText(message, { exact: true });
  await locator.waitFor({ state: "visible" });
  assert.equal(await locator.count(), 1, `Transcript message is not unique: ${message}`);
}

function handled(promise) {
  promise.catch(() => undefined);
  return promise;
}

function scopedHistoryResponse(page, cookieName, token, orgId) {
  const expectedScope = orgChatScope(orgId);
  return handled(page.waitForResponse(async response => {
    const url = new URL(response.url());
    if (url.pathname !== "/_agent-native/agent-chat/threads" || response.request().method() !== "GET"
        || url.searchParams.get("scopeType") !== expectedScope.type
        || url.searchParams.get("scopeId") !== expectedScope.id) return false;
    const headers = await response.request().allHeaders();
    return (headers.cookie ?? "").split("; ").includes(`${cookieName}=${token}`);
  }));
}

async function finishScopedHistory(responsePromise, forbiddenThreadId) {
  const response = await responsePromise;
  assert.equal(await response.finished(), null);
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.ok(Array.isArray(result.threads));
  assert.ok(result.threads.every(thread => thread.id !== forbiddenThreadId));
  const requestUrl = new URL(response.url());
  events.push({ type: "authorized-scoped-history", status: response.status(),
    scope: { type: requestUrl.searchParams.get("scopeType"), id: requestUrl.searchParams.get("scopeId") },
    threads: result.threads.length, sha256: sha256(Buffer.from(JSON.stringify(result))) });
}

async function scopedThreadRequest(page, { threadId, scope, method, suffix = "", body }) {
  const pathname = `/_agent-native/agent-chat/threads/${encodeURIComponent(threadId)}${suffix}`;
  const url = `${pathname}?${scopeQuery(scope)}`;
  const result = await page.evaluate(async ({ requestUrl, requestMethod, requestBody }) => {
    const response = await fetch(requestUrl, {
      method: requestMethod,
      headers: requestBody === undefined ? undefined : { "content-type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    });
    const text = await response.text();
    return { status: response.status, text };
  }, { requestUrl: url, requestMethod: method, requestBody: body });
  events.push({ type: "scoped-thread-request", method, pathname, scope,
    status: result.status, bodySha256: sha256(Buffer.from(result.text)) });
  return { ...result, body: result.text ? JSON.parse(result.text) : null };
}

async function startLeakWatch(page, forbidden) {
  await page.evaluate(values => sessionStorage.setItem("vivary-proof-leak-watch", JSON.stringify(values)), forbidden);
}

async function finishLeakWatch(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const observation = await page.evaluate(() => {
    const state = window.__vivaryProofLeakWatch;
    if (!state) throw new Error("leak observer was not installed before hydration");
    state.inspect(document.documentElement);
    state.observer.disconnect();
    sessionStorage.removeItem("vivary-proof-leak-watch");
    return { findings: state.findings, observations: state.observations,
      transcriptObserved: state.transcriptObserved };
  });
  assert.ok(observation.observations > 0);
  assert.deepEqual(observation.findings, []);
  events.push({ type: "continuous-leak-observation", ...observation });
}

async function startHistoryWatch(page) {
  await page.evaluate(() => {
    const observations = [];
    let scheduled = false;
    let lastSignature = "";
    const sample = reason => {
      scheduled = false;
      const histories = [...document.querySelectorAll('[data-agent-native="chat-history-list"]')];
      const checkingAccess = [...document.querySelectorAll('*')].some(element =>
        element.textContent?.trim() === "Checking Full chat access" && element.getClientRects().length > 0);
      const signature = JSON.stringify({
        historyCount: histories.length,
        historyVisible: histories.some(element => element.getClientRects().length > 0),
        checkingAccess,
        panelOptions: document.querySelectorAll('button[aria-label="Agent panel options"]').length,
      });
      if (signature !== lastSignature && observations.length < 40) {
        observations.push({ milliseconds: Math.round(performance.now()), reason, ...JSON.parse(signature) });
        lastSignature = signature;
      }
    };
    const markBoundaryNode = (action, node) => {
      if (!(node instanceof Element) || observations.length >= 40) return;
      if (node.matches('[data-agent-native="chat-history-list"]') ||
          node.querySelector('[data-agent-native="chat-history-list"]')) {
        observations.push({ milliseconds: Math.round(performance.now()),
          reason: "mutation-record", action, target: "chat-history-list" });
      }
      if (observations.length >= 40) return;
      const accessNodes = [node.matches(".sr-only") ? node : null,
        ...[...node.querySelectorAll(".sr-only")].slice(0, 10)];
      if (accessNodes.some(element => element?.textContent?.trim() === "Checking Full chat access")) {
        observations.push({ milliseconds: Math.round(performance.now()),
          reason: "mutation-record", action, target: "checking-full-chat-access" });
      }
    };
    const describeTarget = target => {
      if (!(target instanceof Element)) return null;
      return {
        tag: target.tagName.toLowerCase(),
        role: target.getAttribute("role"),
        ariaLabel: target.getAttribute("aria-label"),
        dataState: target.getAttribute("data-state"),
        dataAgentNative: target.getAttribute("data-agent-native"),
      };
    };
    const eventHandlers = [];
    const observeEvent = type => {
      const handler = event => {
        if (observations.length >= 40) return;
        if (type === "keydown" && event.key !== "Escape") return;
        const target = event.target;
        const relevant = type === "focusin" || type === "dismissableLayer.focusOutside" ||
          (target instanceof Element && target.closest(
            '[role="menu"],[data-agent-native="chat-history-list"],button[aria-label="Agent panel options"]'));
        if (!relevant) return;
        observations.push({ milliseconds: Math.round(performance.now()), reason: "dom-event",
          event: type, target: describeTarget(target) });
      };
      document.addEventListener(type, handler, true);
      eventHandlers.push([type, handler]);
    };
    for (const type of ["focusin", "pointerdown", "pointerup", "pointerleave", "keydown",
      "dismissableLayer.focusOutside"]) observeEvent(type);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) markBoundaryNode("attached", node);
        for (const node of record.removedNodes) markBoundaryNode("detached", node);
      }
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => sample("mutation"));
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "hidden", "style", "aria-hidden"] });
    sample("start");
    window.__vivaryHistoryWatch = { observations, observer, eventHandlers };
  });
}

async function finishHistoryWatch(page) {
  return page.evaluate(() => {
    const watch = window.__vivaryHistoryWatch;
    if (!watch) return [];
    watch.observer.disconnect();
    for (const [type, handler] of watch.eventHandlers) document.removeEventListener(type, handler, true);
    delete window.__vivaryHistoryWatch;
    return watch.observations;
  });
}

function captureThreadTransition(label, oldThreadId) {
  assert.match(oldThreadId, /^[A-Za-z0-9_-]{8,200}$/);
  return { label, oldThreadId, startedAt: Date.now() };
}

function finishThreadTransition(window, succeeded) {
  transitionWindows.push({ ...window, completedAt: Date.now(), succeeded });
}

async function clickNativeNewChat(page, email, orgId, label) {
  const storageKey = activeThreadStorageKey(email, orgId);
  const oldThreadId = await page.evaluate(key => localStorage.getItem(key), storageKey);
  assert.match(oldThreadId, /^[A-Za-z0-9_-]{8,200}$/);
  const window = captureThreadTransition(label, oldThreadId);
  try {
    const button = page.locator('button[aria-label="New chat"]');
    assert.equal(await button.count(), 1, "expected one native New chat button");
    await button.click();
    await page.waitForFunction(({ key, oldId }) => {
      const activeId = localStorage.getItem(key);
      return Boolean(activeId && activeId !== oldId);
    }, { key: storageKey, oldId: oldThreadId });
    const newThreadId = await page.evaluate(key => localStorage.getItem(key), storageKey);
    assert.match(newThreadId, /^[A-Za-z0-9_-]{8,200}$/);
    finishThreadTransition(window, true);
    return newThreadId;
  } catch (error) {
    finishThreadTransition(window, false);
    throw error;
  }
}

async function openHistory(page) {
  const history = page.locator('[data-agent-native="chat-history-list"]');
  if (await history.isVisible()) return;
  await startHistoryWatch(page);
  const directButton = page.getByRole("button", { name: "All chats" });
  if (await directButton.isVisible()) {
    await directButton.click();
  } else {
    await page.getByRole("button", { name: "Agent panel options" }).click();
    await page.getByRole("menuitem", { name: "All chats" }).click();
  }
  await history.waitFor();
  events.push({ type: "history-control-observation", observations: await finishHistoryWatch(page) });
}

async function selectHistoryTitle(page, title, email, orgId, expectedThreadId) {
  await openHistory(page);
  await uniqueHistoryTitle(page, title);
  const storageKey = activeThreadStorageKey(email, orgId);
  const oldThreadId = await page.evaluate(key => localStorage.getItem(key), storageKey);
  assert.match(oldThreadId, /^[A-Za-z0-9_-]{8,200}$/);
  const window = captureThreadTransition(`select:${title}`, oldThreadId);
  const selectedShare = handled(page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === "GET" && url.origin === baseUrl.origin
      && url.pathname === "/_agent-native/actions/list-resource-shares"
      && url.searchParams.get("resourceType") === "chat_thread"
      && url.searchParams.get("resourceId") === expectedThreadId;
  }));
  try {
    const row = page.locator('[data-agent-native="chat-history-list"] .an-chat-history-row')
      .filter({ has: page.getByText(title, { exact: true }) });
    assert.equal(await row.count(), 1);
    await row.waitFor();
    await row.locator(".an-chat-history-row__button").click();
    await page.waitForFunction(({ key, expected }) => localStorage.getItem(key) === expected,
      { key: storageKey, expected: expectedThreadId });
    const shareResponse = await selectedShare;
    assert.equal(await shareResponse.finished(), null);
    assert.equal(shareResponse.status(), 200);
    const share = await shareResponse.json();
    const shareRequest = shareRequestDetails(shareResponse.request());
    assert.ok(shareRequest);
    assert.equal(share.role, "owner");
    assert.equal(share.ownerEmail, email);
    assert.equal(share.orgId, orgId);
    events.push({ type: "selected-thread-share-response", threadId: expectedThreadId,
      requestId: shareRequest.requestId, status: shareResponse.status(), role: share.role,
      ownerEmail: share.ownerEmail, orgId: share.orgId });
    finishThreadTransition(window, true);
  } catch (error) {
    finishThreadTransition(window, false);
    throw error;
  }
}

async function renameHistoryTitle(page, messageText, replacement) {
  await openHistory(page);
  const row = page.locator('[data-agent-native="chat-history-list"] .an-chat-history-row--active');
  await row.waitFor({ state: "visible" });
  assert.equal(await row.count(), 1, "Active history row is not unique");
  const labels = await row.locator(".an-chat-history-row__title, .an-chat-history-row__subtitle").allTextContents();
  assert.ok(labels.some(text => text.startsWith(messageText)),
    `Active history row does not start with the submitted message: ${messageText}`);
  await row.locator(".an-chat-history-row__menu-trigger").click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const input = page.getByRole("textbox", { name: "Rename chat" });
  await input.fill(replacement);
  await input.press("Enter");
}

async function takeScreenshot(page, name) {
  const target = path.join(evidenceRoot, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  const bytes = await readFile(target);
  events.push({ type: "screenshot", name, bytes: bytes.length, sha256: sha256(bytes) });
}

const browser = await chromium.launch({
  executablePath: input.chromiumExecutable,
  headless: false,
  chromiumSandbox: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  serviceWorkers: "block",
});
await context.exposeBinding("__vivaryRecordShareFetch", (_source, entry) => {
  if (shareFetchDiagnostics.length >= 64 || !entry || typeof entry !== "object") return;
  let bytes;
  try { bytes = Buffer.byteLength(JSON.stringify(entry)); }
  catch { return; }
  if (bytes > 8192 || shareFetchDiagnosticBytes + bytes > 262144) return;
  shareFetchDiagnosticBytes += bytes;
  shareFetchDiagnostics.push(entry);
});
await context.addInitScript(() => {
  const nativeFetch = window.fetch.bind(window);
  const documentId = crypto.randomUUID();
  let sequence = 0;
  let reported = 0;
  const describeReason = reason => {
    if (reason === undefined) return null;
    if (reason instanceof Error) return { name: reason.name, message: reason.message.slice(0, 1000) };
    try { return { value: String(reason).slice(0, 1000) }; }
    catch { return { value: "unprintable" }; }
  };
  const report = entry => {
    if (reported >= 64) return;
    reported += 1;
    try {
      const pending = window.__vivaryRecordShareFetch?.({
        documentId,
        recordedAt: Date.now(),
        performanceMilliseconds: Math.round(performance.now()),
        ...entry,
      });
      pending?.catch(() => undefined);
    } catch {}
  };
  window.fetch = (resource, init) => {
    let method;
    let url;
    try {
      method = (init?.method ?? (resource instanceof Request ? resource.method : "GET")).toUpperCase();
      const href = typeof resource === "string" ? resource
        : resource instanceof URL ? resource.href : resource.url;
      url = new URL(href, location.href);
    } catch {
      return nativeFetch(resource, init);
    }
    const resourceId = url.searchParams.get("resourceId");
    const isTarget = method === "GET" && url.origin === location.origin
      && url.pathname === "/_agent-native/actions/list-resource-shares"
      && url.searchParams.size === 2 && url.searchParams.get("resourceType") === "chat_thread"
      && typeof resourceId === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(resourceId);
    if (!isTarget) return nativeFetch(resource, init);
    const fetchId = `${documentId}:${++sequence}`;
    const signal = init?.signal ?? (resource instanceof Request ? resource.signal : undefined);
    report({ phase: "start", fetchId, method,
      url: url.href, signalPresent: Boolean(signal), signalAborted: signal?.aborted ?? false,
      signalReason: describeReason(signal?.reason),
      stack: new Error("share fetch start").stack?.split("\n").slice(0, 10).join("\n").slice(0, 4096) ?? null });
    signal?.addEventListener("abort", () => report({ phase: "abort", fetchId, url: url.href,
      signalAborted: signal.aborted, signalReason: describeReason(signal.reason),
      stack: new Error("share fetch abort").stack?.split("\n").slice(0, 10).join("\n").slice(0, 4096) ?? null }),
    { once: true });
    let promise;
    try { promise = nativeFetch(resource, init); }
    catch (error) {
      report({ phase: "throw", fetchId, url: url.href, error: String(error).slice(0, 1000) });
      throw error;
    }
    promise.then(response => report({ phase: "resolved", fetchId, url: url.href,
      status: response.status }), error => report({ phase: "rejected", fetchId, url: url.href,
      error: String(error).slice(0, 1000), signalAborted: signal?.aborted ?? false,
      signalReason: describeReason(signal?.reason) }));
    return promise;
  };
});
await context.routeWebSocket("**/*", async webSocket => {
  failedRequests.push({ url: webSocket.url(), error: "WebSocket refused by offline proof" });
  await webSocket.close({ code: 1008, reason: "Offline proof does not use WebSockets" });
});
await context.addInitScript(() => {
  const raw = sessionStorage.getItem("vivary-proof-leak-watch");
  if (!raw) return;
  const forbidden = JSON.parse(raw);
  const state = { findings: [], observations: 0, transcriptObserved: false };
  state.inspect = node => {
    state.observations += 1;
    state.transcriptObserved ||= Boolean(document.querySelector(".message-scroller-viewport"));
    const text = typeof node === "string" ? node : node?.textContent ?? "";
    for (const value of forbidden) {
      if (text.includes(value) && !state.findings.includes(value)) state.findings.push(value);
    }
  };
  state.observer = new MutationObserver(records => {
    state.inspect(document.documentElement);
    for (const record of records) {
      if (record.oldValue) state.inspect(record.oldValue);
      for (const node of [...record.addedNodes, ...record.removedNodes]) state.inspect(node);
    }
  });
  state.observer.observe(document, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });
  window.__vivaryProofLeakWatch = state;
});
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.origin === baseUrl.origin) return route.continue();
  failedRequests.push({ url: url.href, error: "external browser destination refused" });
  return route.abort("blockedbyclient");
});
const page = await context.newPage();
const focusSessions = [];
const inFlightRequests = new Set();
const requestStartedAt = new Map();
const navigationAbortWindows = new Map();
const navigationCancellations = [];
const transitionWindows = [];
const shareRequestIds = new WeakMap();
let shareRequestSequence = 0;
function shareRequestDetails(request) {
  const url = new URL(request.url());
  const resourceId = url.searchParams.get("resourceId");
  if (request.method() !== "GET" || url.origin !== baseUrl.origin
      || url.pathname !== "/_agent-native/actions/list-resource-shares"
      || url.searchParams.size !== 2 || url.searchParams.get("resourceType") !== "chat_thread"
      || typeof resourceId !== "string" || !/^[A-Za-z0-9_-]{8,200}$/.test(resourceId)) return null;
  let requestId = shareRequestIds.get(request);
  if (!requestId) {
    requestId = `playwright:${++shareRequestSequence}`;
    shareRequestIds.set(request, requestId);
  }
  return { requestId, method: request.method(), url: url.href,
    resourceType: url.searchParams.get("resourceType"), resourceId: url.searchParams.get("resourceId") };
}
function recordShareRequest(entry) {
  if (shareRequestLifecycle.length < 64) shareRequestLifecycle.push({ recordedAt: Date.now(), ...entry });
}

function classifyExpectedShareCancellation(failure, expectedIdentity, evidence = {}) {
  const fetchDiagnostics = evidence.fetchDiagnostics ?? shareFetchDiagnostics;
  const requestLifecycle = evidence.requestLifecycle ?? shareRequestLifecycle;
  const browserEvents = evidence.browserEvents ?? events;
  if (failure.error !== "net::ERR_ABORTED" || failure.method !== "GET"
      || typeof failure.requestId !== "string") return null;
  if (!expectedIdentity || typeof expectedIdentity.ownerEmail !== "string"
      || typeof expectedIdentity.orgId !== "string") return null;
  let url;
  try { url = new URL(failure.url); }
  catch { return null; }
  const resourceId = url.searchParams.get("resourceId");
  if (url.origin !== baseUrl.origin || url.pathname !== "/_agent-native/actions/list-resource-shares"
      || url.searchParams.size !== 2 || url.searchParams.get("resourceType") !== "chat_thread"
      || typeof resourceId !== "string" || !/^[A-Za-z0-9_-]{8,200}$/.test(resourceId)) return null;

  const failedCycles = requestLifecycle.filter(entry => entry.phase === "requestfailed"
    && entry.url === url.href && entry.error === "net::ERR_ABORTED"
    && entry.method === "GET" && entry.requestId === failure.requestId);
  if (failedCycles.length !== 1) return null;
  const failedCycle = failedCycles[0];
  const failedStarts = requestLifecycle.filter(entry => entry.phase === "request"
    && entry.requestId === failedCycle.requestId && entry.url === url.href);
  if (failedStarts.length !== 1) return null;
  const failedStart = failedStarts[0];
  const requestAgeMilliseconds = failedCycle.recordedAt - failedStart.recordedAt;
  if (requestAgeMilliseconds < 0 || requestAgeMilliseconds > 250) return null;

  const aborts = fetchDiagnostics.filter(entry => entry.phase === "abort" && entry.url === url.href);
  if (aborts.length !== 1) return null;
  const abort = aborts[0];
  const starts = fetchDiagnostics.filter(entry => entry.phase === "start"
    && entry.fetchId === abort.fetchId && entry.url === url.href);
  const rejections = fetchDiagnostics.filter(entry => entry.phase === "rejected"
    && entry.fetchId === abort.fetchId && entry.url === url.href);
  if (starts.length !== 1 || rejections.length !== 1) return null;
  const start = starts[0];
  const rejection = rejections[0];
  const fetchAgeMilliseconds = abort.recordedAt - start.recordedAt;
  const rejectAgeMilliseconds = rejection.recordedAt - abort.recordedAt;
  if (!start.signalPresent || start.signalAborted || !abort.signalAborted
      || abort.signalReason?.name !== "AbortError" || !rejection.signalAborted
      || rejection.signalReason?.name !== "AbortError" || !rejection.error?.startsWith("AbortError:")
      || fetchAgeMilliseconds < 0 || fetchAgeMilliseconds > 250
      || rejectAgeMilliseconds < 0 || rejectAgeMilliseconds > 250) return null;
  const requiredStackMarkers = ["AbortSignal.", "Object.onCancel", "[as cancel]",
    ".removeObserver", ".destroy", ".onUnsubscribe"];
  if (typeof abort.stack !== "string" || !requiredStackMarkers.every(marker => abort.stack.includes(marker))) return null;

  const replacementStarts = requestLifecycle.filter(entry => entry.phase === "request"
    && entry.url === url.href && entry.requestId !== failedCycle.requestId
    && entry.recordedAt >= failedStart.recordedAt
    && entry.recordedAt - failedStart.recordedAt <= 250
    && requestLifecycle.some(candidate => candidate.phase === "response"
      && candidate.requestId === entry.requestId && candidate.status === 200)
    && requestLifecycle.some(candidate => candidate.phase === "requestfinished"
      && candidate.requestId === entry.requestId && candidate.recordedAt >= entry.recordedAt
      && candidate.recordedAt - entry.recordedAt <= 500));
  if (replacementStarts.length !== 1) return null;
  const replacementRequest = replacementStarts[0];
  const replacementFetchStarts = fetchDiagnostics.filter(entry => entry.phase === "start"
    && entry.documentId === abort.documentId && entry.url === url.href && entry.fetchId !== abort.fetchId
    && entry.recordedAt > abort.recordedAt && entry.recordedAt - abort.recordedAt <= 250
    && fetchDiagnostics.some(candidate => candidate.phase === "resolved"
      && candidate.fetchId === entry.fetchId && candidate.status === 200
      && candidate.recordedAt >= entry.recordedAt && candidate.recordedAt - entry.recordedAt <= 500)
    && !fetchDiagnostics.some(candidate => ["abort", "rejected"].includes(candidate.phase)
      && candidate.fetchId === entry.fetchId));
  if (replacementFetchStarts.length !== 1) return null;
  const replacementFetch = replacementFetchStarts[0];
  const crossStartAgeMilliseconds = Math.abs(failedStart.recordedAt - abort.recordedAt);
  const crossFailureAgeMilliseconds = Math.abs(failedCycle.recordedAt - abort.recordedAt);
  const replacementCrossAgeMilliseconds = Math.abs(replacementRequest.recordedAt - replacementFetch.recordedAt);
  if (crossStartAgeMilliseconds > 250 || crossFailureAgeMilliseconds > 250
      || replacementCrossAgeMilliseconds > 250) return null;
  const authorization = browserEvents.filter(entry => entry.type === "selected-thread-share-response"
    && entry.threadId === resourceId && entry.requestId === replacementRequest.requestId
    && entry.status === 200 && entry.role === "owner"
    && entry.ownerEmail === expectedIdentity.ownerEmail && entry.orgId === expectedIdentity.orgId);
  if (authorization.length !== 1) return null;
  return {
    url: url.href,
    resourceId,
    error: failure.error,
    fetchId: abort.fetchId,
    failedRequestId: failedCycle.requestId,
    replacementRequestId: replacementRequest.requestId,
    replacementFetchId: replacementFetch.fetchId,
    requestAgeMilliseconds,
    crossStartAgeMilliseconds,
    crossFailureAgeMilliseconds,
    replacementCrossAgeMilliseconds,
    fetchAgeMilliseconds,
    rejectAgeMilliseconds,
    replacementFinishLimitMilliseconds: 500,
    stackMarkers: requiredStackMarkers,
    authorization: authorization[0],
  };
}

function partitionFailedRequests(failures, expectedIdentity, evidence = {}) {
  const classified = failures.map((failure, index) => ({
    index,
    classification: classifyExpectedShareCancellation(failure, expectedIdentity, evidence),
  }));
  const uses = new Map();
  const evidenceKeys = classification => [
    `abort-fetch:${classification.fetchId}`,
    `failed-request:${classification.failedRequestId}`,
    `replacement-request:${classification.replacementRequestId}`,
    `replacement-fetch:${classification.replacementFetchId}`,
  ];
  for (const entry of classified) {
    if (!entry.classification) continue;
    for (const key of evidenceKeys(entry.classification)) uses.set(key, (uses.get(key) ?? 0) + 1);
  }
  const accepted = classified
    .filter(entry => entry.classification
      && evidenceKeys(entry.classification).every(key => uses.get(key) === 1))
    .map(entry => ({ rawFailureIndex: entry.index, ...entry.classification }));
  const acceptedIndexes = new Set(accepted.map(entry => entry.rawFailureIndex));
  return {
    accepted,
    fatal: failures.filter((_failure, index) => !acceptedIndexes.has(index)),
  };
}

function assertClassifierRejectsInvalidEvidence(failure, accepted, expectedIdentity) {
  assert.equal(classifyExpectedShareCancellation({ ...failure, error: "net::ERR_FAILED" }, expectedIdentity), null);
  assert.equal(classifyExpectedShareCancellation({ ...failure, method: "POST" }, expectedIdentity), null);
  assert.equal(classifyExpectedShareCancellation({ ...failure, requestId: "playwright:wrong" }, expectedIdentity), null);
  const duplicateReuse = partitionFailedRequests([failure, { ...failure }], expectedIdentity);
  assert.equal(duplicateReuse.accepted.length, 0);
  assert.equal(duplicateReuse.fatal.length, 2);
  const clonedRequestId = `${failure.requestId}:clone`;
  const clonedLifecycle = shareRequestLifecycle
    .filter(entry => entry.requestId === failure.requestId)
    .map(entry => ({ ...entry, requestId: clonedRequestId }));
  const distinctReuse = partitionFailedRequests(
    [failure, { ...failure, requestId: clonedRequestId }], expectedIdentity,
    { requestLifecycle: [...shareRequestLifecycle, ...clonedLifecycle] });
  assert.equal(distinctReuse.accepted.length, 0);
  assert.equal(distinctReuse.fatal.length, 2);
  const wrongPath = new URL(failure.url);
  wrongPath.pathname = "/_agent-native/actions/list-resource-share";
  assert.equal(classifyExpectedShareCancellation({ ...failure, url: wrongPath.href }, expectedIdentity), null);
  assert.equal(classifyExpectedShareCancellation(failure, expectedIdentity, {
    fetchDiagnostics: shareFetchDiagnostics.filter(entry => entry.fetchId !== accepted.fetchId),
  }), null);
  const abort = shareFetchDiagnostics.find(entry => entry.phase === "abort" && entry.fetchId === accepted.fetchId);
  assert.ok(abort);
  assert.equal(classifyExpectedShareCancellation(failure, expectedIdentity, {
    fetchDiagnostics: [...shareFetchDiagnostics, { ...abort, recordedAt: abort.recordedAt + 1 }],
  }), null);
  assert.equal(classifyExpectedShareCancellation(failure, expectedIdentity, {
    requestLifecycle: shareRequestLifecycle.filter(entry => entry.requestId !== accepted.replacementRequestId),
  }), null);
  assert.equal(classifyExpectedShareCancellation(failure, expectedIdentity, {
    browserEvents: events.map(entry => entry.requestId === accepted.replacementRequestId
      ? { ...entry, ownerEmail: "wrong@example.test", orgId: "wrong-org" } : entry),
  }), null);
  const failedStart = shareRequestLifecycle.find(entry => entry.phase === "request"
    && entry.requestId === accepted.failedRequestId);
  assert.ok(failedStart);
  assert.equal(classifyExpectedShareCancellation(failure, expectedIdentity, {
    requestLifecycle: shareRequestLifecycle.map(entry => entry.phase === "requestfailed"
      && entry.requestId === accepted.failedRequestId
      ? { ...entry, recordedAt: failedStart.recordedAt + 251 } : entry),
  }), null);
}
let activeNavigation = null;
page.on("pageerror", error => pageErrors.push(String(error)));
page.on("console", message => {
  consoleMessages.push({ type: message.type(), text: message.text().slice(0, 4096) });
});
page.on("request", request => {
  inFlightRequests.add(request);
  requestStartedAt.set(request, Date.now());
});
page.on("request", request => {
  const details = shareRequestDetails(request);
  if (details) recordShareRequest({ phase: "request", ...details });
});
page.on("response", response => {
  const details = shareRequestDetails(response.request());
  if (details) recordShareRequest({ phase: "response", ...details, status: response.status() });
});
page.on("requestfinished", request => {
  inFlightRequests.delete(request);
  requestStartedAt.delete(request);
  navigationAbortWindows.delete(request);
});
page.on("requestfinished", request => {
  const details = shareRequestDetails(request);
  if (details) recordShareRequest({ phase: "requestfinished", ...details });
});
page.on("requestfailed", request => {
  const error = request.failure()?.errorText ?? "unknown";
  const shareDetails = shareRequestDetails(request);
  if (shareDetails) recordShareRequest({ phase: "requestfailed", ...shareDetails, error });
  const url = new URL(request.url());
  const navigation = navigationAbortWindows.get(request);
  const navigationAbort = navigation && error === "net::ERR_ABORTED"
    && url.origin === baseUrl.origin && ["GET", "HEAD"].includes(request.method())
    && !request.isNavigationRequest() && Date.now() - navigation.startedAt <= 10_000
    && Date.now() - (requestStartedAt.get(request) ?? 0) <= 10_000;
  const failure = { url: url.href, error,
    ...(shareDetails ? { method: shareDetails.method, requestId: shareDetails.requestId } : {}) };
  if (navigationAbort) {
    const candidate = { ...failure, navigation: navigation.label,
      ageMilliseconds: Date.now() - requestStartedAt.get(request),
      observedAt: Date.now(), operationStatus: navigation.status };
    if (navigation.status === "succeeded") navigationCancellations.push(candidate);
    else if (navigation.status === "pending") navigation.candidates.push(candidate);
    else failedRequests.push(failure);
  } else {
    failedRequests.push(failure);
  }
  inFlightRequests.delete(request);
  requestStartedAt.delete(request);
  navigationAbortWindows.delete(request);
});
page.on("request", request => {
  const url = new URL(request.url());
  if (request.method() === "POST" && url.pathname === "/_agent-native/agent-chat") {
    const body = request.postDataJSON();
    chatPosts.push(body);
    events.push({
      type: "chat-post",
      threadId: body.threadId ?? null,
      scope: body.scope ?? null,
      bodySha256: sha256(Buffer.from(request.postData() ?? "")),
    });
  }
});

async function navigatePage(label, operation) {
  assert.equal(activeNavigation, null);
  const window = { label, startedAt: Date.now(), status: "pending", candidates: [] };
  for (const request of inFlightRequests) {
    if (!navigationAbortWindows.has(request)) navigationAbortWindows.set(request, window);
  }
  activeNavigation = window;
  try {
    const result = await operation();
    window.status = "succeeded";
    navigationCancellations.push(...window.candidates);
    return result;
  } catch (error) {
    window.status = "failed";
    failedRequests.push(...window.candidates.map(({ url, error: failure }) => ({ url, error: failure })));
    throw error;
  } finally {
    activeNavigation = null;
    events.push({ type: "navigation-window", label, startedAt: window.startedAt,
      completedAt: Date.now(), succeeded: window.status === "succeeded",
      cancelledRequests: window.status === "succeeded" ? window.candidates.length : 0 });
  }
}

try {
  const identityReply = await control({ action: "identities" });
  const { identities, cookieName } = identityReply;
  await control({ action: "expect", completionCalls: 4, titleCalls: 3 });
  await setIdentityCookie(context, cookieName, identities.accountA.token);

  await navigatePage("initial-chat", () => page.goto(new URL("/chat", baseUrl).href));
  await waitForComposer(page);
  await takeScreenshot(page, "01-account-a-empty");

  await control({
    action: "title-mode",
    kind: "success",
    title: "DeepSeek proof title",
    delayMilliseconds: 0,
  });
  const firstPost = await submitMessage(page, "Quarterly research summary");
  const primaryScope = orgChatScope(identities.accountA.primaryOrgId);
  assert.deepEqual(firstPost.scope, primaryScope);
  const firstThreadId = firstPost.threadId;
  assert.match(firstThreadId, /^[A-Za-z0-9_-]{8,200}$/);
  await openHistory(page);
  await uniqueHistoryTitle(page, "DeepSeek proof title");
  recordCheck("first visible message generated a history title", { firstThreadId });

  const originalThread = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "GET",
  });
  assert.equal(originalThread.status, 200, originalThread.text);
  assert.equal(originalThread.body.title, "DeepSeek proof title");
  assert.match(originalThread.body.threadData, /Quarterly research summary/);
  const sameOrgSave = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "PUT",
    body: {
      threadData: originalThread.body.threadData,
      title: originalThread.body.title,
      preview: originalThread.body.preview,
      messageCount: originalThread.body.messageCount,
      scope: primaryScope,
    },
  });
  assert.equal(sameOrgSave.status, 200, sameOrgSave.text);
  const sameOrgRename = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "POST",
    suffix: "/rename",
    body: { title: originalThread.body.title },
  });
  assert.equal(sameOrgRename.status, 200, sameOrgRename.text);
  const sameOrgReadback = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "GET",
  });
  assert.equal(sameOrgReadback.status, 200, sameOrgReadback.text);
  assert.equal(sameOrgReadback.body.title, "DeepSeek proof title");
  assert.match(sameOrgReadback.body.threadData, /Quarterly research summary/);
  recordCheck("current organization scope is captured on send, detail, save, and rename requests");

  await navigatePage("chat-reload", () => page.reload());
  await waitForComposer(page);
  await assert.rejects(page.locator(".message-scroller-viewport:visible").getByText("Quarterly research summary", { exact: true }).waitFor({ timeout: 500 }));
  await selectHistoryTitle(page, "DeepSeek proof title", identities.accountA.email,
    identities.accountA.primaryOrgId, firstThreadId);
  await transcriptMessage(page, "Quarterly research summary");
  recordCheck("reload starts empty and History restores the persisted title and transcript");

  const secondDraftId = await clickNativeNewChat(page, identities.accountA.email,
    identities.accountA.primaryOrgId, "new-chat:manual-rename");
  await control({
    action: "title-mode",
    kind: "success",
    title: "Late generated title",
    delayMilliseconds: 3_000,
  });
  let titleResponseCompleted = false;
  const renameOrdering = [];
  const delayedTitle = handled(page.waitForResponse(response =>
    new URL(response.url()).pathname === "/_agent-native/agent-chat/generate-title"
    && response.request().method() === "POST").then(async response => {
      assert.equal(await response.finished(), null);
      titleResponseCompleted = true;
      renameOrdering.push("generated-response-completed");
      return response;
    }));
  const secondPost = await submitMessage(page, "Manual rename race");
  assert.equal(secondPost.threadId, secondDraftId);
  assert.match(secondPost.threadId, /^[A-Za-z0-9_-]{8,200}$/);
  const renameSaved = handled(page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `/_agent-native/agent-chat/threads/${encodeURIComponent(secondPost.threadId)}/rename`
      && url.searchParams.get("scopeType") === primaryScope.type
      && url.searchParams.get("scopeId") === primaryScope.id
      && response.request().method() === "POST"
      && response.request().postDataJSON()?.title === "Owner title";
  }));
  await renameHistoryTitle(page, "Manual rename race", "Owner title");
  const renameResponse = await renameSaved;
  assert.equal(await renameResponse.finished(), null);
  assert.equal(renameResponse.status(), 200);
  assert.equal(titleResponseCompleted, false, "generation completed before the manual rename settled");
  renameOrdering.push("manual-rename-persisted");
  const delayedResponse = await delayedTitle;
  assert.equal(await delayedResponse.finished(), null);
  assert.equal(delayedResponse.status(), 200);
  await navigatePage("manual-title-reload", () => page.reload());
  await waitForComposer(page);
  await openHistory(page);
  await uniqueHistoryTitle(page, "Owner title");
  assert.equal(await historyTitle(page, "Late generated title").count(), 0);
  await selectHistoryTitle(page, "Owner title", identities.accountA.email,
    identities.accountA.primaryOrgId, secondPost.threadId);
  await transcriptMessage(page, "Manual rename race");
  renameOrdering.push("manual-title-restored-after-reload");
  assert.deepEqual(renameOrdering, ["manual-rename-persisted", "generated-response-completed", "manual-title-restored-after-reload"]);
  events.push({ type: "rename-race-order", order: renameOrdering });
  recordCheck("manual rename wins the completed delayed response and survives reload");

  const fallbackDraftId = await clickNativeNewChat(page, identities.accountA.email,
    identities.accountA.primaryOrgId, "new-chat:fallback");
  await control({
    action: "title-mode",
    kind: "failure",
    title: "",
    delayMilliseconds: 0,
  });
  const fallbackPost = await submitMessage(page, "Fallback title survives");
  assert.equal(fallbackPost.threadId, fallbackDraftId);
  await openHistory(page);
  await uniqueHistoryTitle(page, "Fallback title survives");
  await navigatePage("fallback-title-reload", () => page.reload());
  await waitForComposer(page);
  await selectHistoryTitle(page, "Fallback title survives", identities.accountA.email,
    identities.accountA.primaryOrgId, fallbackPost.threadId);
  await transcriptMessage(page, "Fallback title survives");
  recordCheck("provider failure persists the local fallback title");

  await clickNativeNewChat(page, identities.accountA.email,
    identities.accountA.primaryOrgId, "new-chat:focus-draft");
  focusSessions.push(await disablePlaywrightFocusEmulation(context, page));
  events.push({ type: "driver-focus-emulation", enabled: false, sessions: focusSessions.length });
  await page.bringToFront();
  const draft = await waitForComposer(page);
  await draft.click();
  assert.equal(await page.evaluate(() => document.hasFocus()), true);
  await draft.fill("Draft survives standard focus");
  await page.evaluate(() => {
    window.__vivaryProofFocus = [];
    for (const name of ["blur", "focus", "visibilitychange"]) {
      const target = name === "visibilitychange" ? document : window;
      target.addEventListener(name, event => window.__vivaryProofFocus.push({
        name, focused: document.hasFocus(), visibility: document.visibilityState,
        isTrusted: event.isTrusted,
      }));
    }
  });
  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  focusSessions.push(await disablePlaywrightFocusEmulation(context, otherPage));
  events.push({ type: "driver-focus-emulation", enabled: false, sessions: focusSessions.length });
  await otherPage.bringToFront();
  await page.waitForFunction(() => window.__vivaryProofFocus.some(event =>
    event.isTrusted && (event.name === "blur" || event.visibility === "hidden")),
  undefined, { timeout: 5_000 });
  await page.bringToFront();
  await page.waitForFunction(() => document.hasFocus()
    && window.__vivaryProofFocus.some(event => event.isTrusted && event.name === "focus"),
  undefined, { timeout: 5_000 });
  await otherPage.close();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(500);
  assert.equal(await draft.textContent(), "Draft survives standard focus");
  events.push({ type: "focus-transition", transitions: await page.evaluate(() => window.__vivaryProofFocus) });
  recordCheck("standard window focus preserves the unsent draft");

  const preparedThreadId = randomUUID();
  const preparedBody = {
    ...firstPost,
    message: "Prepared coding thread",
    displayMessage: "Prepared coding thread",
    history: [],
    structuredHistory: [],
    turnId: randomUUID(),
    threadId: preparedThreadId,
    scope: { type: "desktop-app", id: "prepared-proof", label: "Prepared proof" },
  };
  const preparedResponse = await page.evaluate(async body => {
    const response = await fetch("/_agent-native/agent-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, text: await response.text() };
  }, preparedBody);
  assert.equal(preparedResponse.status, 200, preparedResponse.text);
  const persistedDesktopThread = await page.evaluate(async id => {
    const response = await fetch(`/_agent-native/agent-chat/threads/${encodeURIComponent(id)}?scopeType=desktop-app&scopeId=prepared-proof`);
    return { status: response.status, body: await response.json() };
  }, preparedThreadId);
  assert.equal(persistedDesktopThread.status, 200, JSON.stringify(persistedDesktopThread.body));
  assert.equal(persistedDesktopThread.body.id, preparedThreadId);
  assert.equal(persistedDesktopThread.body.scope.type, "desktop-app");
  assert.equal(persistedDesktopThread.body.scope.id, "prepared-proof");
  const freshAppHistory = scopedHistoryResponse(page, cookieName, identities.accountA.token,
    identities.accountA.primaryOrgId);
  await navigatePage("scope-filter-reload", () => page.reload());
  await waitForComposer(page);
  await openHistory(page);
  await finishScopedHistory(freshAppHistory, preparedThreadId);
  assert.equal(await page.getByText("Prepared coding thread", { exact: true }).count(), 0);
  recordCheck("persisted synthetic desktop-app thread stays outside freshly fetched app-scoped History", { preparedThreadId });

  await navigatePage("account-seed-chat", () => page.goto(new URL("/chat", baseUrl).href));
  await waitForComposer(page);
  const preservationBaseline = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "GET",
  });
  assert.equal(preservationBaseline.status, 200, preservationBaseline.text);
  assert.equal(preservationBaseline.body.title, "DeepSeek proof title");
  assert.match(preservationBaseline.body.threadData, /Quarterly research summary/);
  const preservedThreadState = {
    title: preservationBaseline.body.title,
    threadData: preservationBaseline.body.threadData,
  };
  await seedSavedThread(
    page,
    identities.accountB.email,
    identities.accountB.primaryOrgId,
    firstThreadId,
  );
  await control({ action: "delays", sessionMilliseconds: 1_000, orgMilliseconds: 1_000 });
  await setIdentityCookie(context, cookieName, identities.accountB.token);
  await startLeakWatch(page, ["Quarterly research summary", "DeepSeek proof title", "Manual rename race", "Owner title"]);
  const accountHistory = scopedHistoryResponse(page, cookieName, identities.accountB.token,
    identities.accountB.primaryOrgId);
  await navigatePage("identity-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
  await page.getByText("Checking Full chat access", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.getByText("Quarterly research summary", { exact: true }).count(), 0);
  await waitForComposer(page);
  await openHistory(page);
  await finishScopedHistory(accountHistory, firstThreadId);
  const foreignAccountCurrentScopeRead = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: orgChatScope(identities.accountB.primaryOrgId),
    method: "GET",
  });
  assert.equal(foreignAccountCurrentScopeRead.status, 404, foreignAccountCurrentScopeRead.text);
  const foreignAccountOwnerScopeRead = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "GET",
  });
  assert.equal(foreignAccountOwnerScopeRead.status, 404, foreignAccountOwnerScopeRead.text);
  const foreignAccountOwnerScopeRename = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "POST",
    suffix: "/rename",
    body: { title: "Foreign account rename" },
  });
  assert.equal(foreignAccountOwnerScopeRename.status, 404, foreignAccountOwnerScopeRename.text);
  recordCheck("foreign account cannot read or rename through the original owner's exact scope");
  await finishLeakWatch(page);
  assert.equal(await historyTitle(page, "DeepSeek proof title").count(), 0);
  recordCheck("account reload ignores stale saved thread IDs and old transcript cache");

  await control({ action: "delays", sessionMilliseconds: 0, orgMilliseconds: 0 });
  await setIdentityCookie(context, cookieName, identities.accountA.token);
  await navigatePage("organization-seed-reload", () => page.reload());
  await waitForComposer(page);
  await seedSavedThread(
    page,
    identities.accountA.email,
    identities.accountA.alternateOrgId,
    firstThreadId,
  );
  const switchResult = await page.evaluate(async orgId => {
    const response = await fetch("/_agent-native/org/switch", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    return { status: response.status, body: await response.json() };
  }, identities.accountA.alternateOrgId);
  assert.equal(switchResult.status, 200, JSON.stringify(switchResult.body));
  await control({ action: "delays", sessionMilliseconds: 750, orgMilliseconds: 1_000 });
  await startLeakWatch(page, ["Quarterly research summary", "DeepSeek proof title", "Manual rename race", "Owner title"]);
  const organizationHistory = scopedHistoryResponse(page, cookieName, identities.accountA.token,
    identities.accountA.alternateOrgId);
  await navigatePage("organization-identity-reload", () => page.reload({ waitUntil: "domcontentloaded" }));
  await page.getByText("Checking Full chat access", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.getByText("Quarterly research summary", { exact: true }).count(), 0);
  await waitForComposer(page);
  await openHistory(page);
  await finishScopedHistory(organizationHistory, firstThreadId);
  const alternateScope = orgChatScope(identities.accountA.alternateOrgId);
  const staleRead = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: alternateScope,
    method: "GET",
  });
  assert.equal(staleRead.status, 404, staleRead.text);
  const staleSave = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: alternateScope,
    method: "PUT",
    body: {
      threadData: originalThread.body.threadData,
      title: "Cross organization overwrite",
      preview: originalThread.body.preview,
      messageCount: originalThread.body.messageCount,
      scope: alternateScope,
    },
  });
  assert.equal(staleSave.status, 404, staleSave.text);
  const staleRename = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: alternateScope,
    method: "POST",
    suffix: "/rename",
    body: { title: "Cross organization rename" },
  });
  assert.equal(staleRename.status, 404, staleRename.text);
  const preservedThread = await scopedThreadRequest(page, {
    threadId: firstThreadId,
    scope: primaryScope,
    method: "GET",
  });
  assert.equal(preservedThread.status, 200, preservedThread.text);
  assert.deepEqual({ title: preservedThread.body.title, threadData: preservedThread.body.threadData },
    preservedThreadState);
  recordCheck("current organization scope rejects stale detail, save, and rename without changing the thread");
  await finishLeakWatch(page);
  assert.equal(await historyTitle(page, "DeepSeek proof title").count(), 0);
  recordCheck("organization reload ignores stale saved IDs and old transcript cache");

  await control({ action: "delays", sessionMilliseconds: 0, orgMilliseconds: 0 });
  const beforeWorkbench = await control({ action: "snapshot", label: "before-workbench" });
  await navigatePage("workbench", () => page.goto(new URL("/workbench", baseUrl).href));
  await page.getByRole("heading", { name: "Workbench" }).waitFor();
  assert.equal(await page.locator('[data-agent-composer-slot="editor"]').count(), 0);
  await page.waitForTimeout(500);
  const afterWorkbench = await control({ action: "snapshot", label: "after-workbench" });
  const chatMutations = afterWorkbench.snapshot.requests.filter(request =>
    request.ordinal > beforeWorkbench.snapshot.requests.at(-1)?.ordinal &&
    request.path.startsWith("/_agent-native/agent-chat") &&
    ["POST", "PUT"].includes(request.method));
  assert.deepEqual(chatMutations, []);
  recordCheck("Workbench remains read-only and sends no chat mutations");
  await takeScreenshot(page, "02-workbench-read-only");

  const finalSnapshot = await control({ action: "snapshot", label: "browser-complete" });
  assert.deepEqual(finalSnapshot.snapshot.calls, { completionCalls: 4, titleCalls: 3 });
  assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
  const expectedShareIdentity = {
    ownerEmail: identities.accountA.email,
    orgId: identities.accountA.primaryOrgId,
  };
  const partitionedFailures = partitionFailedRequests(failedRequests, expectedShareIdentity);
  acceptedShareCancellations = partitionedFailures.accepted;
  fatalFailedRequests = partitionedFailures.fatal;
  for (const accepted of acceptedShareCancellations) {
    assertClassifierRejectsInvalidEvidence(
      failedRequests[accepted.rawFailureIndex], accepted, expectedShareIdentity);
  }
  assert.equal(fatalFailedRequests.length, 0, JSON.stringify(fatalFailedRequests));
  const result = {
    schema: "vivary.05b-gui-browser-result/v1",
    passed: true,
    checks,
    events,
    pageErrors,
    consoleMessages,
    failedRequests,
    acceptedShareCancellations,
    fatalFailedRequests,
    navigationCancellations,
    transitionWindows,
    shareFetchDiagnostics,
    shareDiagnosticProvenance,
    shareRequestLifecycle,
    finalSnapshotSha256: finalSnapshot.snapshot.sha256,
    gap: "The built app exposes no organization-switch control, so this proof covers the public switch handler at a reload boundary rather than in-place useOrg invalidation.",
  };
  await writeFile(path.join(evidenceRoot, "browser-result.json"), `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
  });
} catch (error) {
  let failureBackendSnapshotSha256 = null;
  let failureBackendSnapshotError = null;
  try {
    const failureBackend = await control({ action: "snapshot", label: "browser-failure" });
    const failureBackendBytes = Buffer.from(`${JSON.stringify(failureBackend.snapshot)}\n`);
    assert.ok(failureBackendBytes.length <= 8 * 1024 * 1024 + 1_024);
    await writeFile(path.join(evidenceRoot, "browser-failure-backend.json"), failureBackendBytes,
      { flag: "wx" });
    failureBackendSnapshotSha256 = sha256(failureBackendBytes);
  } catch (snapshotError) {
    failureBackendSnapshotError = String(snapshotError?.message ?? snapshotError).slice(0, 4096);
  }
  const failureFocusState = await page.evaluate(() => ({
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    events: window.__vivaryProofFocus ?? [],
  })).catch(() => null);
  try {
    await page.screenshot({ path: path.join(evidenceRoot, "browser-failure.png"), fullPage: true });
    const history = page.locator('[data-agent-native="chat-history-list"]');
    const historyCount = await history.count();
    const diagnostic = {
      schema: "vivary.05b-gui-browser-failure/v1",
      error: String(error?.message ?? error).slice(0, 4096),
      failureBackendSnapshotSha256,
      failureBackendSnapshotError,
      failureFocusState,
      url: page.url(),
      visibleText: (await page.locator("body").innerText()).slice(0, 16384),
      history: {
        count: historyCount,
        visible: historyCount > 0 ? await history.first().isVisible() : false,
      },
      menuItems: (await page.getByRole("menuitem").allTextContents()).slice(0, 50),
      buttons: (await page.locator("button").evaluateAll(elements => elements.slice(0, 50).map(element => ({
        ariaLabel: element.getAttribute("aria-label"),
        text: element.textContent?.trim().slice(0, 200) ?? "",
      })))).slice(0, 50),
      checkingAccessVisible: await page.getByText("Checking Full chat access", { exact: true }).isVisible(),
      checks: checks.slice(-50),
      events: events.slice(-100),
      navigationCancellations: navigationCancellations.slice(-20),
      transitionWindows: transitionWindows.slice(-20),
      shareFetchDiagnostics: shareFetchDiagnostics.slice(-64),
      shareDiagnosticProvenance,
      shareRequestLifecycle: shareRequestLifecycle.slice(-64),
      historyTimeline: await finishHistoryWatch(page),
      pageErrors: pageErrors.slice(-20),
      consoleMessages: consoleMessages.slice(-50),
      failedRequests: failedRequests.slice(-20),
      acceptedShareCancellations: acceptedShareCancellations.slice(-20),
      fatalFailedRequests: fatalFailedRequests.slice(-20),
    };
    await writeFile(path.join(evidenceRoot, "browser-failure.json"), `${JSON.stringify(diagnostic, null, 2)}\n`, { flag: "wx" });
  } catch {}
  throw error;
} finally {
  await browser.close();
}
