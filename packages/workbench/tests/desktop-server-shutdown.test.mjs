import assert from "node:assert/strict";
import { fork, spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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

async function isRunning(pid) {
  if (!isAlive(pid)) return false;
  if (nativeWindows) return true;
  // An orphan can be a terminated zombie until the host's init process reaps it.
  const stat = await readFile("/proc/" + pid + "/stat", "utf8")
    .catch(error => { if (error.code === "ENOENT" || error.code === "ESRCH") return ""; throw error; });
  return stat !== "" && !/^\d+ \(.+\) Z /.test(stat);
}

async function until(check, description, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!await check()) {
    assert.ok(Date.now() < deadline, description);
    await delay(10);
  }
}

if (role === "parent-loss-owner") {
  const directory = process.argv[3];
  const scenario = process.argv[4];
  const environment = { ...process.env };
  delete environment.VIVARY_STANDALONE_HOST;
  environment.VIVARY_DESKTOP_HOST = "1";
  const server = fork(fileURLToPath(import.meta.url), [scenario, directory, "parent-loss"], {
    env: environment, execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  writeFileSync(path.join(directory, "server-pid"), String(server.pid));
  server.on("message", message => {
    if (message.type === "vivary:desktop:bootstrap-needed") {
      server.send({ type: "vivary:desktop:bootstrap", capability: "a".repeat(43) });
    }
    if (message.type === "ready") process.send({ type: "ready" });
  });
  process.on("message", message => {
    if (message.type === "shutdown-server") server.send({ type: "shutdown" });
  });
} else if (role) {
  const directory = process.argv[3];
  const receipt = name => path.join(directory, name);
  const exists = name => readFile(receipt(name)).then(() => true, () => false);
  const windows = role.startsWith("windows-");
  const parentLoss = process.argv[4] === "parent-loss";
  process.once("exit", code => writeFileSync(receipt("exit-code"), String(code)));
  globalThis.__shutdownTestTaskkill = (command, args, options) => {
    writeFileSync(receipt("taskkill"), JSON.stringify({ command, args, timeout: options?.timeout }));
    return { status: 0, signal: null };
  };
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
        if (role !== "windows-success" || parentLoss) clearInterval(keepAlive);
        if (role === "windows-pending") await new Promise(() => {});
      } else {
        await until(() => exists("release"), "parent releases held cleanup");
      }
      await writeFile(receipt("settled"), "");
    })(),
    code: () => role === "failure" ? Promise.reject(new Error("expected cleanup failure")) : Promise.resolve(),
    previews: () => {
      if (["windows-preview-failure", "windows-standalone-failure"].includes(role)) {
        writeFileSync(receipt("preview-rejected"), "");
        return Promise.reject(new Error("expected preview cleanup failure"));
      }
      return Promise.resolve();
    },
  };
  const replacements = {
    "@agent-native/core/server": "export const defineNitroPlugin = value => value;",
    "@agent-native/core/jobs": "export const stopRecurringJobs = () => globalThis.__shutdownTestStops.automations();",
    "../local-code-agent.ts": "export const initializeVivaryCodeAgent = async () => {}; export const shutdownVivaryCodeAgent = () => globalThis.__shutdownTestStops.code();",
    "../original-runtime.ts": "export const shutdownOriginalCommands = async () => {};",
    "../project-preview.ts": "export const shutdownProjectPreviews = () => globalThis.__shutdownTestStops.previews();",
  };
  registerHooks({ resolve(specifier, context, nextResolve) {
    const replacement = !nativeWindows && context.parentURL === desktop && specifier === "node:child_process"
      ? "export * from 'node:child_process'; export const spawnSync = (...args) => globalThis.__shutdownTestTaskkill(...args);"
      : context.parentURL === lifecycle ? replacements[specifier]
      : context.parentURL === desktop && specifier === "./start.mjs"
        ? "export const startupOptions = () => ({mode: 'local', appUrl: 'http://127.0.0.1:4317'}); export const startVivary = () => globalThis.__shutdownTestBoot();"
        : undefined;
    return replacement === undefined ? nextResolve(specifier, context)
      : { url: "data:text/javascript," + encodeURIComponent(replacement), shortCircuit: true };
  } });
  const plugin = (await import(lifecycle)).default;
  globalThis.__shutdownTestBoot = async () => {
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
    const { runDesktopServer } = await import(desktop);
    // Both modules are preloaded before simulating the launcher's platform decision.
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    try {
      Object.defineProperty(process, "platform", { ...platform, value: windows ? "win32" : "linux" });
      await runDesktopServer([]);
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
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
            if (scenario !== "windows-pending") {
              await until(() => stderr.includes("Shutdown did not settle."), "cleanup rejection is reported");
              assert.ok(await exists("settled"), "automation cleanup settled before rejection");
              if (scenario === "windows-close-failure") {
                assert.ok(await exists("close-started"), "Nitro close was attempted");
              }
            }
            // No fixture interval or polling may replace production's live-parent hold.
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

  for (const [scenario, requestFirst] of [
    ["windows-pending", false],
    ["windows-preview-failure", true],
    ["windows-success", false],
  ]) {
    const loss = requestFirst ? "after shutdown" : "before shutdown";
    test("desktop parent loss: " + scenario + " " + loss, { timeout: 30000 }, async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "vivary-parent-loss-"));
      const receipt = name => path.join(directory, name);
      const exists = name => readFile(receipt(name)).then(() => true, () => false);
      const readPid = async name => {
        const value = await readFile(receipt(name), "utf8")
          .catch(error => { if (error.code === "ENOENT") return undefined; throw error; });
        if (value === undefined) return undefined;
        const pid = Number(value);
        assert.ok(Number.isSafeInteger(pid) && pid > 0, "owned fixture PID is valid");
        return pid;
      };
      const owner = fork(fileURLToPath(import.meta.url), ["parent-loss-owner", directory, scenario], {
        execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      let ownerResult;
      let ready = false;
      const ownerExited = new Promise(resolve => owner.once("exit", (code, signal) => {
        ownerResult = { code, signal };
        resolve(ownerResult);
      }));
      owner.on("message", message => { if (message.type === "ready") ready = true; });
      try {
        await until(() => ready || ownerResult, "intermediary reports server readiness");
        assert.equal(ownerResult, undefined, "desktop owner remains alive until the test terminates it");
        const serverPid = await readPid("server-pid");
        assert.ok(serverPid, "intermediary records its server PID");
        if (requestFirst) {
          owner.send({ type: "shutdown-server" });
          await until(() => exists("settled"), "explicit shutdown settles automation cleanup");
          assert.ok(await exists("preview-rejected"), "preview cleanup rejected before parent loss");
        }
        // Kill only the intermediary. The server loses its real IPC peer without a shutdown message.
        assert.ok(owner.kill("SIGKILL"), "desktop owner is abruptly terminated");
        await until(() => ownerResult, "desktop owner termination completes");
        await ownerExited;
        await until(() => exists("started"), "real parent loss starts server cleanup");
        if (scenario === "windows-success") {
          await until(async () => !await isRunning(serverPid), "successful cleanup exits after parent loss");
          assert.equal(await readFile(receipt("exit-code"), "utf8"), "0");
          assert.ok(await exists("settled"), "successful cleanup settles automations");
          assert.ok(await exists("close-started"), "successful cleanup closes Nitro");
          assert.equal(await exists("taskkill"), false, "success does not invoke fallback");
        } else {
          await delay(200);
          assert.ok(await isRunning(serverPid), "unsettled server remains live for bounded tree cleanup");
          const descendantPid = nativeWindows ? await readPid("descendant-pid") : undefined;
          if (nativeWindows) {
            assert.ok(descendantPid, "Windows fixture records its owned descendant");
            assert.ok(await isRunning(descendantPid), "owned descendant is live before fallback");
          }
          await until(async () => !await isRunning(serverPid),
            "server must terminate after parent loss within the 15-second fallback plus grace", 23000);
          if (nativeWindows) {
            await until(async () => !await isRunning(descendantPid), "server self-fallback terminates its descendant");
          } else {
            const fallback = JSON.parse(await readFile(receipt("taskkill"), "utf8"));
            // Linux records the Windows OS boundary. Windows executes the real command above.
            // guard:allow-env-credential - Match the fixture OS taskkill path.
            assert.equal(path.win32.normalize(fallback.command),
              path.win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"));
            assert.deepEqual(fallback.args, ["/PID", String(serverPid), "/T", "/F"]);
            assert.ok(fallback.timeout > 0 && fallback.timeout <= 5000, "self taskkill is bounded");
            assert.equal(await readFile(receipt("exit-code"), "utf8"), "1", "server really exits after fallback returns");
          }
        }
      } finally {
        if (!ownerResult) {
          owner.kill("SIGKILL");
          await until(() => ownerResult, "fixture owner cleanup completes");
          await ownerExited;
        }
        const serverPid = await readPid("server-pid");
        if (serverPid && await isRunning(serverPid)) {
          if (nativeWindows) forceWindowsTree(serverPid);
          else process.kill(serverPid, "SIGKILL");
          await until(async () => !await isRunning(serverPid), "fixture server cleanup completes");
        }
        if (nativeWindows) {
          const descendantPid = await readPid("descendant-pid");
          if (descendantPid && await isRunning(descendantPid)) {
            forceWindowsTree(descendantPid);
            await until(async () => !await isRunning(descendantPid), "fixture descendant cleanup completes");
          }
        }
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
