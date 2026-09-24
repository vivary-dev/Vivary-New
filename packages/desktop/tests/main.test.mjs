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
const { createExternalWindowHandler, attachProjectFolderChooser, flushDraftsBeforeQuit, isExternalSetupUrl, isProjectFolderRequest, localChildEnvironment } = await import("../main.mjs");
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

test("preview links open the exact HTTP address only after native confirmation", async () => {
  for (const url of ["http://127.0.0.1:4321/page?q=one#two", "https://example.org/app"]) {
    const opened = [];
    const response = Promise.withResolvers();
    const window = { isDestroyed: () => false };
    const handler = createExternalWindowHandler(window, {
      openExternal: async (...args) => opened.push(args),
    }, {
      showMessageBox: (parent, options) => {
        assert.equal(parent, window);
        assert.equal(options.detail, url);
        assert.equal(options.cancelId, 0);
        assert.equal(options.defaultId, 0);
        return response.promise;
      },
    });
    assert.deepEqual(handler({ url }), { action: "deny" });
    assert.deepEqual(opened, []);
    handler({ url: "https://other.test" });
    response.resolve({ response: 1 });
    await setImmediate();
    assert.deepEqual(opened, [[url, { activate: true }]]);
  }
});

test("preview cancellation and parent closure never launch a browser", async () => {
  for (const response of [0, 1]) {
    let destroyed = false;
    const handler = createExternalWindowHandler({ isDestroyed: () => destroyed }, {
      openExternal: () => assert.fail("unexpected browser launch"),
    }, {
      showMessageBox: async () => { destroyed = response === 1; return { response }; },
    });
    handler({ url: "https://example.org" });
    await setImmediate();
  }
});

test("external window requests reject unsafe schemes, credentials, malformed URLs and POST", () => {
  const handler = createExternalWindowHandler({ isDestroyed: () => false }, {}, {
    showMessageBox: () => assert.fail("unsafe URL reached confirmation"),
  });
  for (const url of ["file:///tmp/page", "javascript:alert(1)", "data:text/html,hello", "mailto:a@example.org", "vivary://open", "https://user:secret@example.org", "bad url"]) {
    assert.deepEqual(handler({ url }), { action: "deny" });
  }
  assert.deepEqual(handler({ url: "https://example.org", postBody: { data: [] } }), { action: "deny" });
});

test("browser failure gives recovery and permits the next request", async () => {
  let attempts = 0;
  let errors = 0;
  const handler = createExternalWindowHandler({ isDestroyed: () => false }, {
    openExternal: async () => { attempts++; throw new Error("launch failed"); },
  }, {
    showMessageBox: async () => ({ response: 1 }),
    showErrorBox: (title, message) => { errors++; assert.match(message, /Copy the address/); },
  });
  for (let i = 0; i < 2; i++) {
    handler({ url: "http://localhost:4321/" });
    await setImmediate();
  }
  assert.equal(attempts, 2);
  assert.equal(errors, 2);
});

test("allowlisted provider setup links retain direct browser opening", async () => {
  const opened = [];
  const handler = createExternalWindowHandler({ isDestroyed: () => false }, {
    openExternal: async url => opened.push(url),
  }, {
    showMessageBox: () => assert.fail("setup links do not need confirmation"),
  });
  handler({ url: "https://developers.openai.com/codex/auth" });
  await setImmediate();
  assert.deepEqual(opened, ["https://developers.openai.com/codex/auth"]);
});

test("desktop close waits for same-origin draft acknowledgement and refuses failure", async () => {
  const origin = "http://127.0.0.1:4567";
  const pending = Promise.withResolvers();
  let executed = 0;
  const enabled = [];
  const window = {
    isDestroyed: () => false,
    setEnabled: value => enabled.push(value),
    webContents: {
      isDestroyed: () => false,
      getURL: () => origin + "/?runtime=native",
      executeJavaScript: script => {
        assert.equal(script, "globalThis.__vivaryFlushChatDraftsForClose?.() ?? true");
        executed++;
        return pending.promise;
      },
    },
  };
  const waiting = flushDraftsBeforeQuit(window, origin, 1000);
  await setImmediate();
  assert.equal(executed, 1);
  pending.resolve(true);
  assert.equal(await waiting, true);
  assert.deepEqual(enabled, [false]);
  window.webContents.executeJavaScript = async () => false;
  assert.equal(await flushDraftsBeforeQuit(window, origin, 1000), false);
  assert.deepEqual(enabled, [false, false, true]);
  window.webContents.getURL = () => "https://other.test/";
  assert.equal(await flushDraftsBeforeQuit(window, origin, 1000), false);
  assert.equal(executed, 1);
  window.webContents.getURL = () => origin + "/";
  window.webContents.executeJavaScript = () => new Promise(() => undefined);
  assert.equal(await flushDraftsBeforeQuit(window, origin, 5), false);
  assert.deepEqual(enabled, [false, false, true, false, true]);
});
