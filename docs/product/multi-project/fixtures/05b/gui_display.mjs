import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DISPLAY_NUMBER = 99;
const DISPLAY_NAME = `:${DISPLAY_NUMBER}`;
const READY_TIMEOUT_MILLISECONDS = 5_000;
const STOP_TIMEOUT_MILLISECONDS = 2_000;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024;
const TOOLS = Object.freeze([
  Object.freeze({
    name: "Xvfb",
    path: "/usr/bin/Xvfb",
    sha256: "c50687113cd5232844b8fa3a49276a48a022fa7fc4275b983ae8f88158efed72",
  }),
  Object.freeze({
    name: "xauth",
    path: "/usr/bin/xauth",
    sha256: "d5d3c556e7acc1a224a2847095bd5551a81b2418e2de827193119a028b0d0058",
  }),
  Object.freeze({
    name: "xkbcomp",
    path: "/usr/bin/xkbcomp",
    sha256: "eca6986af7d15277394b8476b8ad85229ee1a1a879d43d2a526f106af3761550",
  }),
]);

async function digestFile(file) {
  const resolved = await realpath(file);
  assert.equal(resolved, file);
  const info = await lstat(file);
  assert.ok(info.isFile() && info.size > 0 && info.size <= 8 * 1024 * 1024);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    bytes += chunk.length;
    assert.ok(bytes <= 8 * 1024 * 1024);
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function collectBounded(stream) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    assert.ok(bytes <= MAX_PROCESS_OUTPUT_BYTES);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function childExit(child, milliseconds, label) {
  return new Promise((resolve, reject) => {
    let timer;
    const done = (error, code, signal) => {
      clearTimeout(timer);
      child.off("error", onError);
      child.off("close", onClose);
      if (error) reject(error);
      else resolve({ code, signal });
    };
    const onError = error => done(error);
    const onClose = (code, signal) => done(null, code, signal);
    child.once("error", onError);
    child.once("close", onClose);
    timer = setTimeout(() => done(new Error(`${label} deadline exceeded`)), milliseconds);
  });
}

async function configureAuthority(authorityPath, cookie, track) {
  const child = track(spawn("/usr/bin/xauth", ["-q", "-f", authorityPath], {
    env: { HOME: "/work", PATH: "/usr/bin:/bin", LANG: "C.UTF-8" },
    stdio: ["pipe", "ignore", "pipe"],
  }));
  const stderr = collectBounded(child.stderr);
  stderr.catch(() => undefined);
  child.stdin.end(`add ${DISPLAY_NAME} MIT-MAGIC-COOKIE-1 ${cookie}\n`);
  const [exit, errors] = await Promise.all([
    childExit(child, READY_TIMEOUT_MILLISECONDS, "xauth"),
    stderr,
  ]);
  assert.deepEqual(exit, { code: 0, signal: null }, errors.toString("utf8"));
  assert.equal(errors.length, 0, errors.toString("utf8"));
  const info = await lstat(authorityPath);
  assert.ok(info.isFile());
  assert.equal(info.mode & 0o777, 0o600);
}

function waitForDisplayReady(child, readyStream) {
  return new Promise((resolve, reject) => {
    let bytes = Buffer.alloc(0);
    let timer;
    const done = (error, value) => {
      clearTimeout(timer);
      readyStream.off("data", onData);
      readyStream.off("error", onError);
      child.off("close", onClose);
      if (error) reject(error);
      else resolve(value);
    };
    const onData = chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 16) {
        done(new Error("Xvfb displayfd output exceeded limit"));
        return;
      }
      const end = bytes.indexOf(10);
      if (end >= 0) {
        const value = bytes.subarray(0, end).toString("ascii");
        if (value !== String(DISPLAY_NUMBER)) done(new Error("Xvfb selected an unexpected display"));
        else done(null, value);
      }
    };
    const onError = error => done(error);
    const onClose = (code, signal) => done(new Error(
      `Xvfb exited before readiness: code=${code} signal=${signal}`,
    ));
    readyStream.on("data", onData);
    readyStream.once("error", onError);
    child.once("close", onClose);
    timer = setTimeout(() => done(new Error("Xvfb readiness deadline exceeded")),
      READY_TIMEOUT_MILLISECONDS);
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = childExit(child, STOP_TIMEOUT_MILLISECONDS, "Xvfb stop");
  child.kill("SIGTERM");
  try {
    await exited;
  } catch {
    child.kill("SIGKILL");
    await childExit(child, STOP_TIMEOUT_MILLISECONDS, "Xvfb kill");
  }
}

export async function disablePlaywrightFocusEmulation(context, page) {
  assert.equal(typeof context?.newCDPSession, "function");
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  return session;
}

export async function startPrivateDisplay({ workRoot, track }) {
  assert.equal(workRoot, "/work");
  assert.equal(typeof track, "function");
  const toolIdentities = {};
  for (const tool of TOOLS) {
    const observed = await digestFile(tool.path);
    assert.equal(observed.sha256, tool.sha256);
    toolIdentities[tool.name] = { path: tool.path, ...observed };
  }

  const authorityPath = path.join(workRoot, "gui.Xauthority");
  const socketPath = `/tmp/.X11-unix/X${DISPLAY_NUMBER}`;
  await mkdir(path.dirname(authorityPath), { recursive: true, mode: 0o700 });
  await writeFile(authorityPath, "", { flag: "wx", mode: 0o600 });
  let child = null;
  try {
    const cookie = randomBytes(16).toString("hex");
    await configureAuthority(authorityPath, cookie, track);
    child = track(spawn("/usr/bin/Xvfb", [
      DISPLAY_NAME,
      "-auth", authorityPath,
      "-nolisten", "tcp",
      "-screen", "0", "1440x960x24",
      "-noreset",
      "-displayfd", "3",
    ], {
      env: { HOME: "/work", PATH: "/usr/bin:/bin", LANG: "C.UTF-8" },
      stdio: ["ignore", "ignore", "pipe", "pipe"],
    }));
    const stderrPromise = collectBounded(child.stderr);
    stderrPromise.catch(() => undefined);
    await waitForDisplayReady(child, child.stdio[3]);
    const socket = await lstat(socketPath);
    assert.ok(socket.isSocket());

    let stopped = false;
    let stopMetadata = null;
    return {
      env: Object.freeze({ DISPLAY: DISPLAY_NAME, XAUTHORITY: authorityPath }),
      metadata: Object.freeze({
        display: DISPLAY_NAME,
        screen: "1440x960x24",
        tcpListening: false,
        authorityMode: "0600",
        toolIdentities,
      }),
      async stop() {
        if (stopped) return stopMetadata;
        stopped = true;
        let errors = Buffer.alloc(0);
        let stopError = null;
        try {
          await stopChild(child);
          errors = await stderrPromise;
        } catch (error) {
          stopError = error;
        } finally {
          await rm(authorityPath, { force: true });
          await rm(socketPath, { force: true });
        }
        if (stopError) throw stopError;
        stopMetadata = Object.freeze({
          stderrBytes: errors.length,
          stderrSha256: createHash("sha256").update(errors).digest("hex"),
        });
        return stopMetadata;
      },
    };
  } catch (error) {
    if (child) await stopChild(child).catch(() => undefined);
    await rm(authorityPath, { force: true }).catch(() => undefined);
    await rm(socketPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
