import assert from "node:assert/strict";
import path from "node:path";
import { EventEmitter } from "node:events";
import { registerHooks } from "node:module";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";

const electronStub = "data:text/javascript," + encodeURIComponent(
  "export const app = { setName() {}, isPackaged: false }; export const BrowserWindow = null; export const dialog = {}; export const session = {}; export const shell = {};",
);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "electron" ? { url: electronStub, shortCircuit: true } : nextResolve(specifier, context);
  },
});
const { attachProjectFolderChooser, isExternalSetupUrl, isProjectFolderRequest, localChildEnvironment } = await import("../main.mjs");
hooks.deregister();

const firstId = "01a094af-1abc-4234-8abc-123456789abc";
const secondId = "01a094af-2abc-4234-8abc-123456789abc";
const choose = (requestId = firstId) => ({ type: "vivary:project-folder:choose", requestId });

function childFixture() {
  const child = new EventEmitter();
  child.connected = true;
  child.replies = [];
  child.send = message => { child.replies.push(message); };
  return child;
}

test("folder IPC accepts only the request identifier and allowlisted operation", () => {
  assert.equal(isProjectFolderRequest(choose()), true);
  for (const message of [null, [], {}, { ...choose(), path: "/tmp/untrusted" }, choose("short"), { ...choose(), type: "shell" }]) {
    assert.equal(isProjectFolderRequest(message), false);
  }
});

test("one native directory dialog returns only its selected path", async () => {
  const child = childFixture();
  const response = Promise.withResolvers();
  let shown = 0;
  const dispose = attachProjectFolderChooser(child, () => ({ isDestroyed: () => false }), async (_window, options) => {
    shown++;
    assert.deepEqual(options, { title: "Open project folder", buttonLabel: "Open project", properties: ["openDirectory"] });
    return response.promise;
  });
  child.emit("message", choose());
  child.emit("message", choose(secondId));
  await setImmediate();
  assert.equal(shown, 1);
  assert.deepEqual(child.replies, [{ type: "vivary:project-folder:result", requestId: secondId, error: "chooser-unavailable" }]);
  response.resolve({ canceled: false, filePaths: ["/tmp/project"] });
  await setImmediate();
  assert.deepEqual(child.replies[1], { type: "vivary:project-folder:result", requestId: firstId, path: "/tmp/project" });
  dispose();
  assert.equal(child.listenerCount("message"), 0);
});

test("dialog cancellation stays distinct from safe dialog failures", async () => {
  for (const result of [{ canceled: true, filePaths: [] }, { canceled: false, filePaths: ["relative"] }, { canceled: false, filePaths: ["/one", "/two"] }, new Error("private host detail")]) {
    const child = childFixture();
    const dispose = attachProjectFolderChooser(child, () => ({ isDestroyed: () => false }), async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    child.emit("message", choose());
    await setImmediate();
    assert.deepEqual(child.replies, [{
      type: "vivary:project-folder:result", requestId: firstId,
      ...(result.canceled ? { path: null } : { error: "chooser-unavailable" }),
    }]);
    dispose();
  }
});

test("an unavailable parent window returns a safe failure", () => {
  for (const window of [null, { isDestroyed: () => true }]) {
    const child = childFixture();
    const dispose = attachProjectFolderChooser(child, () => window, () => assert.fail("No dialog should open without a parent window."));
    child.emit("message", choose());
    assert.deepEqual(child.replies, [{
      type: "vivary:project-folder:result", requestId: firstId, error: "chooser-unavailable",
    }]);
    dispose();
  }
});

test("shutdown and disconnected IPC discard late native selections", async () => {
  for (const reason of ["dispose", "disconnect", "error", "exit", "cancel"]) {
    const child = childFixture();
    const response = Promise.withResolvers();
    const dispose = attachProjectFolderChooser(child, () => ({ isDestroyed: () => false }), () => response.promise);
    child.emit("message", choose());
    await setImmediate();
    if (reason === "dispose") dispose();
    else if (reason === "cancel") child.emit("message", { type: "vivary:project-folder:cancel", requestId: firstId });
    else child.emit(reason, new Error("private host detail"));
    response.resolve({ canceled: false, filePaths: ["/tmp/late-selection"] });
    await setImmediate();
    assert.equal(child.replies.some(reply => reply.path !== null), false);
    dispose();
    for (const event of ["message", "disconnect", "error", "exit"]) assert.equal(child.listenerCount(event), 0);
  }
});

test("only exact HTTPS provider setup destinations can leave the app", () => {
  for (const url of [
    "https://code.claude.com/docs/en/setup",
    "https://developers.openai.com/codex/auth",
    "https://console.anthropic.com/settings/keys",
    "https://platform.openai.com/api-keys",
  ]) assert.equal(isExternalSetupUrl(url), true);
  for (const url of [
    "javascript:alert(1)", "file:///tmp/project", "http://platform.openai.com/api-keys",
    "https://platform.openai.com@evil.test/api-keys", "https://platform.openai.com/api-keys?secret=value",
    "https://platform.openai.com/api-keys#secret", "https://example.org", "https://platform.openai.com/",
  ]) assert.equal(isExternalSetupUrl(url), false);
});


test("packaged startup uses its own original runtime and does not inherit data or receipt targets", () => {
  const resources = path.resolve("packaged-resources");
  const environment = localChildEnvironment({ VIVARY_ORIGINAL_RUNTIME: path.resolve("other-runtime"), VIVARY_DATA_DIR: "/other-data", VIVARY_RECEIPT_LOG: "/other-receipt", APP_URL: "https://example.test", PATH: "host-tools" }, true, resources);
  assert.equal(environment.VIVARY_ORIGINAL_RUNTIME, path.join(resources, "original-runtime"));
  for (const key of ["VIVARY_DATA_DIR", "VIVARY_RECEIPT_LOG", "APP_URL"]) assert.equal(environment[key], undefined);
  assert.equal(environment.PATH, "host-tools");
  assert.equal(localChildEnvironment({ VIVARY_ORIGINAL_RUNTIME: "relative" }, false).VIVARY_ORIGINAL_RUNTIME, undefined);
});
