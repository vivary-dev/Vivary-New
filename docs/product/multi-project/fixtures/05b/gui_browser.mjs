import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

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

function identityStorageKey(email, orgId) {
  const namespace = encodeURIComponent(JSON.stringify([email.trim().toLowerCase(), orgId]));
  return `vivary-workbench-chat-v1:${namespace}`;
}

async function seedSavedThread(page, email, orgId, threadId) {
  const storageKey = identityStorageKey(email, orgId);
  await page.evaluate(
    ({ key, id }) => {
      localStorage.setItem(
        `agent-chat-active-thread:${key}:scope:workspace-app:vivary-workbench-chat-v1`,
        id,
      );
      localStorage.setItem(
        `agent-chat-open-tabs:${key}:scope:workspace-app:vivary-workbench-chat-v1`,
        JSON.stringify([id]),
      );
    },
    { key: storageKey, id: threadId },
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

function scopedHistoryResponse(page, cookieName, token) {
  return page.waitForResponse(async response => {
    const url = new URL(response.url());
    if (url.pathname !== "/_agent-native/agent-chat/threads" || response.request().method() !== "GET"
        || url.searchParams.get("scopeType") !== "workspace-app"
        || url.searchParams.get("scopeId") !== "vivary-workbench-chat-v1") return false;
    const headers = await response.request().allHeaders();
    return (headers.cookie ?? "").split("; ").includes(`${cookieName}=${token}`);
  });
}

async function finishScopedHistory(responsePromise, forbiddenThreadId) {
  const response = await responsePromise;
  assert.equal(await response.finished(), null);
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.ok(Array.isArray(result.threads));
  assert.ok(result.threads.every(thread => thread.id !== forbiddenThreadId));
  events.push({ type: "authorized-scoped-history", status: response.status(),
    threads: result.threads.length, sha256: sha256(Buffer.from(JSON.stringify(result))) });
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

async function openHistory(page) {
  const history = page.locator('[data-agent-native="chat-history-list"]');
  if (await history.isVisible()) return;
  const button = page.getByRole("button", { name: "All chats" });
  await button.click();
  await history.waitFor();
}

async function selectHistoryTitle(page, title) {
  await openHistory(page);
  await uniqueHistoryTitle(page, title);
  const row = page.locator('[data-agent-native="chat-history-list"] .an-chat-history-row')
    .filter({ has: page.getByText(title, { exact: true }) });
  assert.equal(await row.count(), 1);
  await row.waitFor();
  await row.locator(".an-chat-history-row__button").click();
}

async function renameHistoryTitle(page, currentText, replacement) {
  await openHistory(page);
  await uniqueHistoryTitle(page, currentText);
  const row = page.locator('[data-agent-native="chat-history-list"] .an-chat-history-row')
    .filter({ has: page.getByText(currentText, { exact: true }) });
  assert.equal(await row.count(), 1);
  await row.waitFor();
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
  headless: true,
  chromiumSandbox: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  serviceWorkers: "block",
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
page.on("pageerror", error => pageErrors.push(String(error)));
page.on("console", message => {
  consoleMessages.push({ type: message.type(), text: message.text().slice(0, 4096) });
});
page.on("requestfailed", request => {
  failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" });
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

try {
  const identityReply = await control({ action: "identities" });
  const { identities, cookieName } = identityReply;
  await control({ action: "expect", completionCalls: 4, titleCalls: 3 });
  await setIdentityCookie(context, cookieName, identities.accountA.token);

  await page.goto(new URL("/chat", baseUrl).href);
  await waitForComposer(page);
  await takeScreenshot(page, "01-account-a-empty");

  await control({
    action: "title-mode",
    kind: "success",
    title: "DeepSeek proof title",
    delayMilliseconds: 0,
  });
  const firstPost = await submitMessage(page, "Quarterly research summary");
  assert.equal(firstPost.scope.type, "workspace-app");
  assert.equal(firstPost.scope.id, "vivary-workbench-chat-v1");
  const firstThreadId = firstPost.threadId;
  assert.match(firstThreadId, /^[A-Za-z0-9_-]{8,200}$/);
  await openHistory(page);
  await uniqueHistoryTitle(page, "DeepSeek proof title");
  recordCheck("first visible message generated a history title", { firstThreadId });

  await page.reload();
  await waitForComposer(page);
  await assert.rejects(page.locator(".message-scroller-viewport:visible").getByText("Quarterly research summary", { exact: true }).waitFor({ timeout: 500 }));
  await selectHistoryTitle(page, "DeepSeek proof title");
  await transcriptMessage(page, "Quarterly research summary");
  recordCheck("reload starts empty and History restores the persisted title and transcript");

  await page.getByRole("button", { name: "New chat" }).click();
  await control({
    action: "title-mode",
    kind: "success",
    title: "Late generated title",
    delayMilliseconds: 3_000,
  });
  let titleResponseCompleted = false;
  const renameOrdering = [];
  const delayedTitle = page.waitForResponse(response =>
    new URL(response.url()).pathname === "/_agent-native/agent-chat/generate-title"
    && response.request().method() === "POST").then(async response => {
      assert.equal(await response.finished(), null);
      titleResponseCompleted = true;
      renameOrdering.push("generated-response-completed");
      return response;
    });
  await submitMessage(page, "Manual rename race");
  const renameSaved = page.waitForResponse(response =>
    new URL(response.url()).pathname.startsWith("/_agent-native/agent-chat/threads/")
    && response.request().method() === "PUT"
    && response.request().postDataJSON()?.title === "Owner title");
  await renameHistoryTitle(page, "Manual rename race", "Owner title");
  const renameResponse = await renameSaved;
  assert.equal(await renameResponse.finished(), null);
  assert.equal(renameResponse.status(), 200);
  assert.equal(titleResponseCompleted, false, "generation completed before the manual rename settled");
  renameOrdering.push("manual-rename-persisted");
  const delayedResponse = await delayedTitle;
  assert.equal(await delayedResponse.finished(), null);
  assert.equal(delayedResponse.status(), 200);
  await page.reload();
  await waitForComposer(page);
  await openHistory(page);
  await uniqueHistoryTitle(page, "Owner title");
  assert.equal(await historyTitle(page, "Late generated title").count(), 0);
  await selectHistoryTitle(page, "Owner title");
  await transcriptMessage(page, "Manual rename race");
  renameOrdering.push("manual-title-restored-after-reload");
  assert.deepEqual(renameOrdering, ["manual-rename-persisted", "generated-response-completed", "manual-title-restored-after-reload"]);
  events.push({ type: "rename-race-order", order: renameOrdering });
  recordCheck("manual rename wins the completed delayed response and survives reload");

  await page.getByRole("button", { name: "New chat" }).click();
  await control({
    action: "title-mode",
    kind: "failure",
    title: "",
    delayMilliseconds: 0,
  });
  await submitMessage(page, "Fallback title survives");
  await openHistory(page);
  await uniqueHistoryTitle(page, "Fallback title survives");
  await page.reload();
  await waitForComposer(page);
  await selectHistoryTitle(page, "Fallback title survives");
  await transcriptMessage(page, "Fallback title survives");
  recordCheck("provider failure persists the local fallback title");

  await page.getByRole("button", { name: "New chat" }).click();
  const draft = await waitForComposer(page);
  await draft.fill("Draft survives standard focus");
  await page.evaluate(() => {
    window.__vivaryProofFocus = [];
    for (const name of ["blur", "focus", "visibilitychange"]) {
      const target = name === "visibilitychange" ? document : window;
      target.addEventListener(name, () => window.__vivaryProofFocus.push({
        name, focused: document.hasFocus(), visibility: document.visibilityState,
      }));
    }
  });
  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  await otherPage.bringToFront();
  await page.waitForFunction(() => window.__vivaryProofFocus.some(event =>
    event.name === "blur" || event.visibility === "hidden"));
  await page.bringToFront();
  await page.waitForFunction(() => document.hasFocus()
    && window.__vivaryProofFocus.some(event => event.name === "focus"));
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
  const freshAppHistory = scopedHistoryResponse(page, cookieName, identities.accountA.token);
  await page.reload();
  await waitForComposer(page);
  await openHistory(page);
  await finishScopedHistory(freshAppHistory, preparedThreadId);
  assert.equal(await page.getByText("Prepared coding thread", { exact: true }).count(), 0);
  recordCheck("persisted synthetic desktop-app thread stays outside freshly fetched app-scoped History", { preparedThreadId });

  await page.goto(new URL("/chat", baseUrl).href);
  await seedSavedThread(
    page,
    identities.accountB.email,
    identities.accountB.primaryOrgId,
    firstThreadId,
  );
  await control({ action: "delays", sessionMilliseconds: 1_000, orgMilliseconds: 1_000 });
  await setIdentityCookie(context, cookieName, identities.accountB.token);
  await startLeakWatch(page, ["Quarterly research summary", "DeepSeek proof title", "Manual rename race", "Owner title"]);
  const accountHistory = scopedHistoryResponse(page, cookieName, identities.accountB.token);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Checking Full chat access", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.getByText("Quarterly research summary", { exact: true }).count(), 0);
  await waitForComposer(page);
  await openHistory(page);
  await finishScopedHistory(accountHistory, firstThreadId);
  await finishLeakWatch(page);
  assert.equal(await historyTitle(page, "DeepSeek proof title").count(), 0);
  recordCheck("account reload ignores stale saved thread IDs and old transcript cache");

  await control({ action: "delays", sessionMilliseconds: 0, orgMilliseconds: 0 });
  await setIdentityCookie(context, cookieName, identities.accountA.token);
  await page.reload();
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
  const organizationHistory = scopedHistoryResponse(page, cookieName, identities.accountA.token);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Checking Full chat access", { exact: true }).waitFor({ state: "attached" });
  assert.equal(await page.getByText("Quarterly research summary", { exact: true }).count(), 0);
  await waitForComposer(page);
  await openHistory(page);
  await finishScopedHistory(organizationHistory, firstThreadId);
  await finishLeakWatch(page);
  assert.equal(await historyTitle(page, "DeepSeek proof title").count(), 0);
  recordCheck("organization reload ignores stale saved IDs and old transcript cache");

  await control({ action: "delays", sessionMilliseconds: 0, orgMilliseconds: 0 });
  const beforeWorkbench = await control({ action: "snapshot", label: "before-workbench" });
  await page.goto(new URL("/workbench", baseUrl).href);
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
  assert.equal(failedRequests.length, 0, JSON.stringify(failedRequests));
  const result = {
    schema: "vivary.05b-gui-browser-result/v1",
    passed: true,
    checks,
    events,
    pageErrors,
    consoleMessages,
    failedRequests,
    finalSnapshotSha256: finalSnapshot.snapshot.sha256,
    gap: "The built app exposes no organization-switch control, so this proof covers the public switch handler at a reload boundary rather than in-place useOrg invalidation.",
  };
  await writeFile(path.join(evidenceRoot, "browser-result.json"), `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
  });
} finally {
  await browser.close();
}
