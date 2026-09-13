import { fork, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, session, shell } from "electron";

const START_TIMEOUT_MS = 20_000;
const STOP_TIMEOUT_MS = 15_000;
const sourceFile = fileURLToPath(import.meta.url);
const sourceRoot = path.dirname(sourceFile);

let mainWindow = null;
let serverChild = null;
let allowQuit = false;
let shutdownPromise = null;
let disposeProjectChooser = () => undefined;

app.setName("Vivary");
process.once("exit", () => {
  if (serverChild) forceServerTree(serverChild);
});

function workbenchRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "workbench")
    : path.resolve(sourceRoot, "../workbench");
}

function ordinaryNodePath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "node",
      process.platform === "win32" ? "node.exe" : "node",
    );
  }
  const configured = process.env.VIVARY_DESKTOP_NODE?.trim();
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error("Development requires an absolute VIVARY_DESKTOP_NODE path.");
  }
  return configured;
}

async function selectLoopbackPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => probe.close(resolve));
  if (!port) throw new Error("Could not reserve a local Vivary port.");
  return port;
}

function localChildEnvironment() {
  const environment = { ...process.env };
  for (const key of [
    "APP_URL",
    "DATABASE_URL",
    "HOST",
    "NITRO_HOST",
    "NITRO_PORT",
    "PORT",
    "VIVARY_ACCESS_MODE",
    "VIVARY_DATA_DIR",
    "VIVARY_LOCAL_AGENT_WORKSPACE",
    "VIVARY_TRUSTED_PROXY",
  ]) {
    delete environment[key];
  }
  environment.VIVARY_DESKTOP_HOST = "1";
  return environment;
}

async function startServer() {
  const root = workbenchRoot();
  const node = ordinaryNodePath();
  const entry = path.join(root, "bin", "desktop-server.mjs");
  await Promise.all([access(node), access(entry)]);
  const port = await selectLoopbackPort();
  const origin = `http://127.0.0.1:${port}`;

  const child = fork(entry, ["--port", String(port)], {
    cwd: root,
    detached: process.platform !== "win32",
    env: localChildEnvironment(),
    execArgv: [],
    execPath: node,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  serverChild = child;
  disposeProjectChooser = attachProjectFolderChooser(child, () => mainWindow);

  await new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);
      child.off("message", onMessage);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () => settle(new Error("Vivary local server startup timed out.")),
      START_TIMEOUT_MS,
    );
    const onError = (error) => settle(error);
    const onExit = (code) => settle(
      new Error(`Vivary local server exited during startup (${code ?? "signal"}).`),
    );
    const onMessage = (message) => {
      if (message?.type === "ready" && message.origin === origin) {
        settle();
      } else if (message?.type === "error") {
        settle(new Error(String(message.message || "Vivary local server failed.")));
      }
    };
    child.once("error", onError);
    child.once("exit", onExit);
    child.on("message", onMessage);
  }).catch((error) => {
    forceServerTree(child);
    throw error;
  });

  child.once("exit", (code, signal) => {
    if (process.platform !== "win32") forceServerTree(child);
    if (!shutdownPromise && !allowQuit) {
      dialog.showErrorBox(
        "Vivary stopped",
        `The local server ended unexpectedly (${code ?? signal ?? "unknown"}).`,
      );
      void beginQuit();
    }
  });
  return origin;
}

function forceServerTree(child) {
  if (!child.pid) return;
  const leaderAlive = child.exitCode === null && child.signalCode === null;
  if (process.platform === "win32") {
    if (!leaderAlive) return;
    const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
    spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    if (leaderAlive) child.kill("SIGKILL");
  }
}

async function stopServer() {
  disposeProjectChooser();
  const child = serverChild;
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) {
    if (process.platform !== "win32") forceServerTree(child);
    return;
  }
  try {
    if (child.connected) child.send({ type: "shutdown" }, () => undefined);
  } catch {
    // The child's disconnect handler owns graceful shutdown if IPC closed first.
  }
  await new Promise((resolve) => {
    let fallbackTimer;
    const settle = () => {
      clearTimeout(stopTimer);
      clearTimeout(fallbackTimer);
      child.off("exit", settle);
      resolve();
    };
    const stopTimer = setTimeout(() => {
      forceServerTree(child);
      fallbackTimer = setTimeout(settle, 2_000);
    }, STOP_TIMEOUT_MS);
    child.once("exit", settle);
  });
}

function beginQuit() {
  shutdownPromise ??= stopServer().finally(() => {
    allowQuit = true;
    app.quit();
  });
  return shutdownPromise;
}

function hardenSession() {
  const activeSession = session.defaultSession;
  activeSession.setPermissionCheckHandler(() => false);
  activeSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  activeSession.on("will-download", (event) => event.preventDefault());
}

async function createWindow(origin) {
  const window = new BrowserWindow({
    height: 900,
    show: false,
    title: "Vivary",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
    width: 1440,
  });
  mainWindow = window;
  const allow = (target) => {
    try {
      return new URL(target).origin === origin;
    } catch {
      return false;
    }
  };
  window.webContents.on("will-navigate", (event, target) => {
    if (!allow(target)) {
      event.preventDefault();
      openExternalSetupLink(target);
    }
  });
  window.webContents.on("will-redirect", (event, target) => {
    if (!allow(target)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSetupLink(url);
    return { action: "deny" };
  });
  window.on("close", (event) => {
    if (!allowQuit) {
      event.preventDefault();
      void beginQuit();
    }
  });
  window.once("ready-to-show", () => window.show());
  try {
    await window.loadURL(`${origin}/agent`);
  } catch (error) {
    if (mainWindow === window) mainWindow = null;
    window.destroy();
    throw error;
  }
  return window;
}

const EXTERNAL_SETUP_URLS = new Set([
  "https://code.claude.com/docs/en/setup",
  "https://code.claude.com/docs/en/cli-usage",
  "https://developers.openai.com/codex/cli",
  "https://developers.openai.com/codex/auth",
  "https://console.anthropic.com/settings/keys",
  "https://platform.openai.com/api-keys",
  "https://openrouter.ai/keys",
  "https://aistudio.google.com/apikey",
  "https://console.groq.com/keys",
  "https://console.mistral.ai/api-keys/",
  "https://dashboard.cohere.com/api-keys",
]);

export function isExternalSetupUrl(target) {
  return typeof target === "string" && EXTERNAL_SETUP_URLS.has(target);
}

function openExternalSetupLink(target) {
  if (!isExternalSetupUrl(target)) return;
  void shell.openExternal(target, { activate: true }).catch(() => {
    dialog.showErrorBox("Browser could not open", "Copy the setup link and open it in your browser.");
  });
}

export function isProjectFolderRequest(message) {
  return message !== null && typeof message === "object"
    && Object.keys(message).length === 2
    && (message.type === "vivary:project-folder:choose" || message.type === "vivary:project-folder:cancel")
    && typeof message.requestId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(message.requestId);
}

export function attachProjectFolderChooser(child, getWindow, showOpenDialog = (window, options) => dialog.showOpenDialog(window, options)) {
  let disposed = false;
  let pending = null;

  const reply = (requestId, result) => {
    if (!child.connected) return;
    try {
      child.send({ type: "vivary:project-folder:result", requestId, ...result }, () => undefined);
    } catch {
      // The server may disconnect while a native dialog is closing.
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    child.off("message", onMessage);
    child.off("disconnect", dispose);
    child.off("error", dispose);
    child.off("exit", dispose);
    if (pending) {
      pending.canceled = true;
      reply(pending.requestId, { path: null });
      pending = null;
    }
  };
  const onMessage = (message) => {
    if (disposed || !isProjectFolderRequest(message)) return;
    if (message.type === "vivary:project-folder:cancel") {
      if (pending?.requestId === message.requestId) pending.canceled = true;
      return;
    }
    const window = getWindow();
    if (pending || !window || window.isDestroyed()) {
      reply(message.requestId, { error: "chooser-unavailable" });
      return;
    }
    const request = { requestId: message.requestId, canceled: false };
    pending = request;
    Promise.resolve().then(() => showOpenDialog(window, {
      title: "Open project folder",
      buttonLabel: "Open project",
      properties: ["openDirectory"],
    })).then(result => {
      if (disposed || request.canceled) return;
      if (result.canceled) {
        reply(request.requestId, { path: null });
        return;
      }
      const selected = result.filePaths.length === 1 ? result.filePaths[0] : null;
      const valid = typeof selected === "string" && selected.length > 0 && selected.length <= 32_768
        && !selected.includes("\0") && path.isAbsolute(selected);
      reply(request.requestId, valid ? { path: selected } : { error: "chooser-unavailable" });
    }).catch(() => {
      if (!disposed && !request.canceled) reply(request.requestId, { error: "chooser-unavailable" });
    }).finally(() => {
      if (pending === request) pending = null;
    });
  };

  child.on("message", onMessage);
  child.once("disconnect", dispose);
  child.once("error", dispose);
  child.once("exit", dispose);
  return dispose;
}

export async function runDesktop() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.on("before-quit", (event) => {
    if (!allowQuit) {
      event.preventDefault();
      void beginQuit();
    }
  });
  await app.whenReady();
  hardenSession();
  try {
    const origin = await startServer();
    await createWindow(origin);
  } catch (error) {
    await stopServer();
    dialog.showErrorBox("Vivary could not start", error instanceof Error ? error.message : "Unknown error.");
    allowQuit = true;
    app.quit();
  }
}

const sourceArgument = process.argv[1] && path.resolve(process.argv[1]);
const directSourceEntry = sourceArgument === sourceFile || sourceArgument === sourceRoot;
if (app.isPackaged || directSourceEntry) void runDesktop();
