import assert from "node:assert/strict";
import { fork, spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const role = process.argv[2];
const nativeWindows = process.platform === "win32";
const lifecycle = new URL("../server/plugins/02-local-code-lifecycle.ts", import.meta.url).href;
const desktop = new URL("../bin/desktop-server.mjs", import.meta.url).href;

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

function forceWindowsTree(pid) {
  // guard:allow-env-credential - Native Windows fixture locates the OS tree-kill executable.
  const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
  const result = spawnSync(taskkill, ["/PID", String(pid), "/T", "/F"], {
    encoding: "utf8", timeout: 5000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
}

async function until(check, description) {
  const deadline = Date.now() + 3000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, description);
    await delay(10);
  }
}

if (role) {
  const directory = process.argv[3];
  const receipt = name => path.join(directory, name);
  const exists = name => readFile(receipt(name)).then(() => true, () => false);
  const windows = role.startsWith("windows-");
  if (nativeWindows && ["windows-pending", "windows-preview-failure", "windows-close-failure"].includes(role)) {
    // The descendant has no IPC or pipe that could keep its server parent alive.
    const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore", windowsHide: true,
    });
    await new Promise((resolve, reject) => {
      descendant.once("spawn", resolve);
      descendant.once("error", reject);
    });
    descendant.unref();
    await writeFile(receipt("descendant-pid"), String(descendant.pid));
  }
  // Success cases retain this handle to require an explicit production exit.
  const keepAlive = setInterval(() => {}, 1000);
  const hooks = new Map();
  const nitro = { hooks: {
    hook: (name, handler) => hooks.set(name, handler),
    callHook: async name => {
      await writeFile(receipt("close-started"), "");
      await hooks.get(name)?.();
      if (role === "windows-close-failure") throw new Error("expected Nitro close failure");
    },
  } };
  let automationStop;
  globalThis.__shutdownTestStops = {
    automations: () => automationStop ??= (async () => {
      await writeFile(receipt("started"), "");
      if (windows) {
        // No fixture timer or polling may hide a missing production hold.
        if (role !== "windows-success") clearInterval(keepAlive);
        if (role === "windows-pending") await new Promise(() => {});
      } else {
        await until(() => exists("release"), "parent releases held cleanup");
      }
      await writeFile(receipt("settled"), "");
    })(),
    code: () => role === "failure" ? Promise.reject(new Error("expected cleanup failure")) : Promise.resolve(),
    previews: () => ["windows-preview-failure", "windows-standalone-failure"].includes(role)
      ? Promise.reject(new Error("expected preview cleanup failure")) : Promise.resolve(),
  };
  const replacements = {
    "@agent-native/core/server": "export const defineNitroPlugin = value => value;",
    "@agent-native/core/jobs": "export const stopRecurringJobs = () => globalThis.__shutdownTestStops.automations();",
    "../local-code-agent.ts": "export const initializeVivaryCodeAgent = async () => {}; export const shutdownVivaryCodeAgent = () => globalThis.__shutdownTestStops.code();",
    "../original-runtime.ts": "export const shutdownOriginalCommands = async () => {};",
    "../project-preview.ts": "export const shutdownProjectPreviews = () => globalThis.__shutdownTestStops.previews();",
  };
  registerHooks({ resolve(specifier, context, nextResolve) {
    const replacement = context.parentURL === lifecycle ? replacements[specifier]
      : context.parentURL === desktop && specifier === "./start.mjs"
        ? "export const startupOptions = () => ({mode: 'local', appUrl: 'http://127.0.0.1:4317'}); export const startVivary = () => globalThis.__shutdownTestBoot();"
        : undefined;
    return replacement === undefined ? nextResolve(specifier, context)
      : { url: "data:text/javascript," + encodeURIComponent(replacement), shortCircuit: true };
  } });
  globalThis.__shutdownTestBoot = async () => {
    const plugin = (await import(lifecycle)).default;
    // Load with the real platform first, then select Windows or POSIX only for initialization.
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    try {
      Object.defineProperty(process, "platform", { ...platform, value: windows ? "win32" : "linux" });
      await plugin(nitro);
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
  };
  if (role === "hosted" || role === "windows-standalone-failure") {
    await globalThis.__shutdownTestBoot();
    process.on("message", async message => {
      if (message.type === "signal") {
        process.emit("SIGTERM");
        if (role === "windows-standalone-failure") process.disconnect();
      }
      if (message.type === "owner-finish") {
        await nitro.hooks.callHook("close");
        clearInterval(keepAlive);
        process.disconnect();
      }
    });
    process.send({ type: "ready" });
  } else {
    globalThis.fetch = async () => new Response("ready");
    await (await import(desktop)).runDesktopServer([]);
  }
} else {
  for (const scenario of [
    "shutdown", "disconnect", "failure", "hosted", "windows-success",
    "windows-pending", "windows-preview-failure", "windows-close-failure",
    "windows-standalone-failure",
  ]) {
    test(`desktop lifecycle: ${scenario}`, { timeout: nativeWindows ? 20000 : 10000 }, async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "vivary-shutdown-"));
      const environment = { ...process.env };
      delete environment.VIVARY_STANDALONE_HOST;
      delete environment.VIVARY_DESKTOP_HOST;
      const standalone = scenario === "windows-standalone-failure";
      if (standalone) environment.VIVARY_STANDALONE_HOST = "1";
      else if (scenario !== "hosted") environment.VIVARY_DESKTOP_HOST = "1";
      const child = fork(fileURLToPath(import.meta.url), [scenario, directory], {
        env: environment, execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      let stderr = "";
      let result;
      let ready = false;
      let disconnected = false;
      child.once("disconnect", () => { disconnected = true; });
      child.stderr.on("data", chunk => { stderr += chunk; });
      const exited = new Promise(resolve => child.once("exit", (code, signal) => {
        result = { code, signal };
        resolve(result);
      }));
      child.on("message", message => {
        if (message.type === "vivary:desktop:bootstrap-needed") {
          child.send({ type: "vivary:desktop:bootstrap", capability: "a".repeat(43) });
        }
        if (message.type === "ready") ready = true;
      });
      const exists = name => readFile(path.join(directory, name)).then(() => true, () => false);
      try {
        await until(() => ready || result, "child becomes ready");
        assert.equal(result, undefined, stderr);
        if (scenario === "disconnect") child.disconnect();
        else child.send({ type: scenario === "hosted" || standalone ? "signal" : "shutdown" });
        if (scenario.startsWith("windows-")) {
          await until(() => exists("started"), "Windows shutdown starts cleanup");
          if (scenario === "windows-success" || standalone) {
            await until(() => result, `Windows control must exit after cleanup: ${stderr}`);
            assert.deepEqual(await exited, { code: standalone ? 1 : 0, signal: null });
            assert.ok(await exists("settled"), "automation cleanup settled before exit");
            if (!standalone) assert.ok(await exists("close-started"), "success closes Nitro");
          } else {
            await until(() => disconnected, "desktop shutdown disconnects IPC");
            if (scenario !== "windows-pending") {
              await until(() => stderr.includes("Shutdown did not settle."), "cleanup rejection is reported");
              assert.ok(await exists("settled"), "automation cleanup settled before rejection");
              if (scenario === "windows-close-failure") {
                assert.ok(await exists("close-started"), "Nitro close was attempted");
              }
            }
            // Only the parent waits. The child has no fixture interval, polling, or IPC.
            await delay(200);
            assert.equal(result, undefined,
              `Windows desktop must preserve its live PID for the parent tree fallback: ${stderr}`);
            if (nativeWindows) {
              const descendantPid = Number(await readFile(path.join(directory, "descendant-pid"), "utf8"));
              assert.ok(isAlive(child.pid), "Windows server PID remains live");
              assert.ok(isAlive(descendantPid), "owned descendant remains live before fallback");
              forceWindowsTree(child.pid);
              await until(() => result, "taskkill terminates the server");
              await exited;
              await until(() => !isAlive(child.pid) && !isAlive(descendantPid),
                "taskkill terminates both server and owned descendant");
            } else {
              assert.ok(child.kill("SIGKILL"), "parent fallback kills the live server");
              await until(() => result, "parent force kill completes");
              assert.deepEqual(await exited, { code: null, signal: "SIGKILL" });
            }
          }
          return;
        }
        await until(() => exists("started"), "shutdown starts cleanup");
        await delay(100);
        assert.equal(result, undefined, "held automation cleanup must keep the child alive");
        await writeFile(path.join(directory, "release"), "");
        await until(() => exists("settled"), "automation cleanup settles");
        if (scenario === "hosted") {
          await delay(100);
          assert.equal(result, undefined, "imported hosted lifecycle must leave process exit to its owner");
          child.send({ type: "owner-finish" });
        }
        await until(() => result, `child must exit after cleanup without a force kill: ${stderr}`);
        assert.deepEqual(await exited, { code: scenario === "failure" ? 1 : 0, signal: null });
      } finally {
        if (!result) {
          child.kill("SIGKILL");
          await until(() => result, "fixture force kill completes");
          await exited;
        }
        if (nativeWindows) {
          // Red source may exit before tree fallback. Clean only this fixture's recorded child.
          const descendant = await readFile(path.join(directory, "descendant-pid"), "utf8")
            .catch(error => { if (error.code === "ENOENT") return undefined; throw error; });
          if (descendant !== undefined) {
            const descendantPid = Number(descendant);
            assert.ok(Number.isSafeInteger(descendantPid) && descendantPid > 0, "fixture descendant PID is valid");
            if (isAlive(descendantPid)) forceWindowsTree(descendantPid);
            await until(() => !isAlive(descendantPid), "fixture descendant cleanup completes");
          }
        }
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
