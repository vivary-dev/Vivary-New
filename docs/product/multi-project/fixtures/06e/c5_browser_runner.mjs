import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, lstat, mkdir, readFile, readlink, realpath, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Rpc } from "../05b/gui_zo_runner.mjs";
import { startPrivateDisplay } from "../05b/gui_display.mjs";

const MAX_JSON = 4 * 1024 * 1024;
const MAX_STREAM = 1024 * 1024;
const REQUEST_LIMIT = 256 * 1024;
const RESPONSE_LIMIT = 8 * 1024 * 1024;
const PROFILE_LIMITS = Object.freeze({
  memoryStopBytes: 8 * 1024 * 1024 * 1024,
  taskStopCount: 256,
  sampleMilliseconds: 250,
  cpuCount: 4,
  swapTotalBytes: 0,
  maxObserverGapSeconds: 1,
  outputStopBytes: 8 * 1024 * 1024,
  hostReserveBytes: 1536 * 1024 * 1024,
});
const ownedChildren = new Set();
const childSignals = new Map();
let ownedServer = null;
let ownedDisplay = null;
let cleanupIntervention = false;
let failureResultPath = null;
let runStartedAt = null;
let backendProtocolBytes = 0;
let diagnosticOutputBytes = 0;
const diagnosticCaptures = [];
let outputFailureReject;
let outputFailureError = null;
const outputFailure = new Promise((_, reject) => { outputFailureReject = reject; });
outputFailure.catch(() => undefined);

function accountOutput(kind, bytes) {
  assert.ok(Number.isSafeInteger(bytes) && bytes >= 0);
  if (kind === "backend-protocol") backendProtocolBytes += bytes;
  else if (kind === "diagnostic") diagnosticOutputBytes += bytes;
  else assert.fail(`unknown output kind: ${kind}`);
  const total = backendProtocolBytes + diagnosticOutputBytes;
  if (total > PROFILE_LIMITS.outputStopBytes && outputFailureError === null) {
    outputFailureError = new Error(`C5 child output exceeded ${PROFILE_LIMITS.outputStopBytes} bytes`);
    outputFailureReject(outputFailureError);
  }
}

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function track(child) {
  ownedChildren.add(child);
  childSignals.set(child, []);
  const kill = child.kill.bind(child);
  child.kill = signal => {
    childSignals.get(child).push(signal ?? "SIGTERM");
    return kill(signal);
  };
  child.once("close", () => ownedChildren.delete(child));
  return child;
}

async function forceCleanup() {
  cleanupIntervention = true;
  ownedServer?.closeAllConnections?.();
  await new Promise(resolve => ownedServer ? ownedServer.close(() => resolve()) : resolve());
  ownedServer = null;
  for (const child of [...ownedChildren]) child.kill("SIGKILL");
  await Promise.allSettled([...ownedChildren].map(child =>
    new Promise(resolve => child.once("close", resolve))));
  if (ownedDisplay) {
    await ownedDisplay.stop().catch(() => undefined);
    ownedDisplay = null;
  }
}

function authorizedProofToken(headers, expected) {
  const supplied = headers["x-vivary-proof-token"];
  if (typeof supplied !== "string" || !/^[0-9a-f]{64}$/.test(supplied)
      || typeof expected !== "string" || !/^[0-9a-f]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}

async function digestFile(file, maximum = 512 * 1024 * 1024) {
  assert.equal(await realpath(file), file);
  const info = await lstat(file);
  assert.ok(info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= maximum);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    bytes += chunk.length;
    assert.ok(bytes <= maximum);
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function readJson(file, maximum = MAX_JSON) {
  const identity = await digestFile(file, maximum);
  const value = JSON.parse(await readFile(file, "utf8"));
  return { value, ...identity };
}

function captureDiagnostic(stream, name, file, maximum = MAX_STREAM) {
  const entry = { name, file, actualBytes: 0, retainedBytes: 0, truncated: false, sha256: null };
  const promise = (async () => {
    const chunks = [];
    let streamError = null;
    try {
      for await (const chunk of stream) {
        entry.actualBytes += chunk.length;
        accountOutput("diagnostic", chunk.length);
        const remaining = Math.max(0, maximum - entry.retainedBytes);
        if (remaining > 0) {
          const retained = chunk.subarray(0, remaining);
          chunks.push(retained);
          entry.retainedBytes += retained.length;
        }
        if (entry.actualBytes > maximum) entry.truncated = true;
      }
    } catch (error) {
      streamError = error;
    }
    const bytes = Buffer.concat(chunks);
    entry.sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    if (entry.truncated) throw new Error(`${name} exceeded ${maximum} bytes`);
    if (streamError) throw streamError;
    return bytes;
  })();
  entry.promise = promise;
  diagnosticCaptures.push(entry);
  promise.catch(() => undefined);
  return promise;
}

function diagnosticSummary() {
  return diagnosticCaptures.map(({ promise: _promise, ...entry }) => ({ ...entry }));
}

function validateProfile(value) {
  assert.ok(exactObject(value,
    ["schema", "sourceBindingSha256", "sandbox", "supervision", "trafficManifestSha256"]));
  assert.equal(value.schema, "vivary.06e-c5-browser-profile/v1");
  assert.match(value.sourceBindingSha256, /^[0-9a-f]{64}$/);
  assert.match(value.trafficManifestSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(value.sandbox, {
    uid: 1000,
    gid: 1000,
    pidNamespace: true,
    network: "loopback-only",
    filesystem: "private-ro-source",
    capabilities: "none",
    noNewPrivileges: true,
  });
  assert.deepEqual(value.supervision, {
    kind: "external-observer",
    enforcement: "monitored-stop",
    ...PROFILE_LIMITS,
  });
  return value;
}

function validateConfig(value) {
  assert.ok(exactObject(value, [
    "schema", "appRoot", "sourceRoot", "scratchRoot", "evidenceRoot",
    "backendPath", "backendSha256", "browserPath", "browserSha256",
    "nodeExecutable", "nodeSha256", "nodeBytes", "playwrightPackageJson",
    "playwrightPackageJsonSha256", "chromiumExecutable", "chromiumSha256",
    "sourceManifestPath", "sourceManifestSha256", "sourceBindingSha256",
    "toolManifestPath", "toolManifestSha256", "trafficManifestPath",
    "trafficManifestSha256", "profilePath", "profileSha256", "proofToken",
    "deadlineSeconds",
  ]));
  assert.equal(value.schema, "vivary.06e-c5-browser-input/v1");
  for (const name of [
    "appRoot", "sourceRoot", "scratchRoot", "evidenceRoot", "backendPath", "browserPath",
    "nodeExecutable", "playwrightPackageJson", "chromiumExecutable", "sourceManifestPath",
    "toolManifestPath", "trafficManifestPath", "profilePath",
  ]) assert.ok(path.isAbsolute(value[name]), `${name} must be absolute`);
  for (const name of [
    "backendSha256", "browserSha256", "nodeSha256", "playwrightPackageJsonSha256",
    "chromiumSha256", "sourceManifestSha256", "sourceBindingSha256",
    "toolManifestSha256", "trafficManifestSha256", "profileSha256",
  ]) assert.match(value[name], /^[0-9a-f]{64}$/);
  assert.match(value.proofToken, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(value.nodeBytes) && value.nodeBytes > 0);
  assert.equal(value.deadlineSeconds, 240);
  assert.deepEqual({
    appRoot: value.appRoot,
    sourceRoot: value.sourceRoot,
    scratchRoot: value.scratchRoot,
    evidenceRoot: value.evidenceRoot,
  }, {
    appRoot: "/app",
    sourceRoot: "/source",
    scratchRoot: "/work",
    evidenceRoot: "/work/evidence",
  });
  return value;
}

function validateManifest(value, schema, maximumFiles) {
  assert.ok(exactObject(value, ["schema", "files", "bindingSha256"]));
  assert.equal(value.schema, schema);
  assert.ok(Array.isArray(value.files) && value.files.length > 0 && value.files.length <= maximumFiles);
  let previous = "";
  for (const file of value.files) {
    assert.ok(exactObject(file, ["path", "sha256", "bytes"]));
    assert.ok(path.isAbsolute(file.path));
    assert.ok(!file.path.split("/").includes(".."));
    assert.ok(file.path > previous);
    previous = file.path;
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0 && file.bytes <= 512 * 1024 * 1024);
  }
  assert.equal(value.bindingSha256,
    createHash("sha256").update(JSON.stringify(value.files)).digest("hex"));
  return value;
}

async function observeBoundary(profileSha256) {
  assert.equal(process.platform, "linux");
  assert.equal(process.getuid?.(), 1000);
  assert.equal(process.getgid?.(), 1000);
  const status = await readFile("/proc/self/status", "utf8");
  const field = name => status.split("\n").find(line => line.startsWith(`${name}:`))?.split(":", 2)[1]?.trim();
  assert.equal(field("NoNewPrivs"), "1");
  const capabilities = Object.fromEntries(
    ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(name =>
      [name, Number.parseInt(field(name), 16)]),
  );
  assert.deepEqual(capabilities, { CapInh: 0, CapPrm: 0, CapEff: 0, CapBnd: 0, CapAmb: 0 });
  const interfaces = (await readFile("/proc/net/dev", "utf8"))
    .split("\n").filter(line => line.includes(":")).map(line => line.split(":", 1)[0].trim());
  assert.deepEqual(interfaces, ["lo"]);
  const affinity = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
    "import json,os; print(json.dumps(sorted(os.sched_getaffinity(0))))"],
  { encoding: "utf8", timeout: 5000, maxBuffer: 4096 }));
  assert.equal(affinity.length, PROFILE_LIMITS.cpuCount);
  const memory = await readFile("/proc/meminfo", "utf8");
  const kb = name => Number(memory.match(new RegExp(`^${name}:\\s+(\\d+) kB$`, "m"))?.[1]);
  assert.equal(kb("SwapTotal"), 0);
  assert.equal(kb("SwapFree"), 0);
  const pidNamespaceId = await readlink("/proc/self/ns/pid");
  assert.equal(pidNamespaceId, await readlink("/proc/1/ns/pid"));
  const mountReadOnly = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
    'import json,os; paths=("/app","/source","/browser","/work"); print(json.dumps({p: bool(os.statvfs(p).f_flag & os.ST_RDONLY) for p in paths}, separators=(",",":")))',
  ], { encoding: "utf8", timeout: 5000, maxBuffer: 4096 }));
  assert.deepEqual(mountReadOnly, { "/app": true, "/source": true, "/browser": true, "/work": false });
  return {
    schema: "vivary.06e-c5-runner-boundary/v1",
    profileSha256,
    pid: process.pid,
    initPid: 1,
    uid: process.getuid(),
    gid: process.getgid(),
    noNewPrivileges: true,
    capabilities,
    networkInterfaces: interfaces,
    cpuAffinity: affinity,
    swapTotalBytes: 0,
    swapFreeBytes: 0,
    pidNamespaceId,
    readOnlyMounts: { "/app": true, "/source": true, "/browser": true },
    supervision: { kind: "external-observer", enforcement: "monitored-stop", ...PROFILE_LIMITS },
  };
}

async function run() {
  const started = process.hrtime.bigint();
  runStartedAt = started;
  const [configName] = process.argv.slice(2);
  assert.ok(configName);
  const configRead = await readJson(await realpath(configName));
  const config = validateConfig(configRead.value);
  assert.equal(await realpath(config.scratchRoot), config.scratchRoot);
  assert.equal(path.dirname(config.evidenceRoot), config.scratchRoot);
  await mkdir(config.evidenceRoot, { recursive: false, mode: 0o700 });
  failureResultPath = path.join(config.evidenceRoot, "runner-result.json");
  const journalPath = path.join(config.evidenceRoot, "runner-stages.jsonl");
  await writeFile(journalPath, "", { flag: "wx", mode: 0o600 });
  const stages = [];
  async function stage(name, details = {}) {
    assert.match(name, /^[a-z][a-z0-9-]{0,63}$/);
    const entry = { ordinal: stages.length + 1, name, recordedAt: Date.now(), ...details };
    assert.ok(stages.length < 20);
    await appendFile(journalPath, JSON.stringify(entry) + "\n");
    stages.push(entry);
  }

  const profileRead = await readJson(config.profilePath);
  assert.equal(profileRead.sha256, config.profileSha256);
  const profile = validateProfile(profileRead.value);
  assert.equal(profile.sourceBindingSha256, config.sourceBindingSha256);
  assert.equal(profile.trafficManifestSha256, config.trafficManifestSha256);

  const sourceManifestRead = await readJson(config.sourceManifestPath);
  assert.equal(sourceManifestRead.sha256, config.sourceManifestSha256);
  const sourceManifest = validateManifest(sourceManifestRead.value,
    "vivary.06e-c5-source/v1", 2048);
  assert.equal(sourceManifest.bindingSha256, config.sourceBindingSha256);
  const sourceManifestByPath = new Map(sourceManifest.files.map(file => [file.path, file]));
  assert.equal(sourceManifestByPath.size, sourceManifest.files.length);

  const toolManifestRead = await readJson(config.toolManifestPath);
  assert.equal(toolManifestRead.sha256, config.toolManifestSha256);
  const toolManifest = validateManifest(toolManifestRead.value,
    "vivary.06e-c5-tools/v1", 32);

  for (const file of [...sourceManifest.files, ...toolManifest.files]) {
    assert.deepEqual(await digestFile(file.path), { sha256: file.sha256, bytes: file.bytes });
  }
  const trafficRead = await readJson(config.trafficManifestPath);
  assert.equal(trafficRead.sha256, config.trafficManifestSha256);
  assert.equal(trafficRead.value.schema, "vivary.06e-c5-traffic/v1");

  for (const [pathKey, hashKey, byteKey] of [
    ["backendPath", "backendSha256"],
    ["browserPath", "browserSha256"],
    ["nodeExecutable", "nodeSha256", "nodeBytes"],
    ["playwrightPackageJson", "playwrightPackageJsonSha256"],
    ["chromiumExecutable", "chromiumSha256"],
  ]) {
    const observed = await digestFile(config[pathKey]);
    assert.equal(observed.sha256, config[hashKey]);
    if (byteKey) assert.equal(observed.bytes, config[byteKey]);
  }
  const boundary = await observeBoundary(config.profileSha256);
  const backendEvidence = path.join(config.evidenceRoot, "backend");
  await mkdir(backendEvidence, { recursive: false, mode: 0o700 });

  const backend = track(spawn(config.nodeExecutable, [
    config.backendPath,
    config.appRoot,
    config.sourceRoot,
    backendEvidence,
    config.profilePath,
    config.trafficManifestPath,
    config.profileSha256,
    config.nodeSha256,
    String(config.nodeBytes),
  ], {
    cwd: config.appRoot,
    env: {
      AGENT_MODE: "production",
      AGENT_NATIVE_DISABLE_RECURRING_JOBS: "true",
      AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS: "true",
      NODE_ENV: "production",
      DATABASE_URL: `file:${path.join(backendEvidence, "c5-native.sqlite")}`,
      HOME: "/home",
      TMPDIR: "/tmp",
      PATH: "/usr/bin:/bin",
      LANG: "C.UTF-8",
    },
    stdio: ["pipe", "pipe", "pipe"],
  }));
  const backendExit = new Promise(resolve => backend.once("close", (code, signal) => resolve({ code, signal })));
  backend.stdout.on("data", chunk => { accountOutput("backend-protocol", chunk.length); });
  const backendErrorsPromise = captureDiagnostic(backend.stderr, "backend-stderr",
    path.join(config.evidenceRoot, "backend-stderr.bin"));
  const rpc = new Rpc(backend);
  let startupTimer;
  let ready;
  try {
    ready = await Promise.race([
      rpc.ready,
      rpc.failure,
      outputFailure,
      new Promise((_, reject) => {
        startupTimer = setTimeout(() => reject(new Error("backend startup deadline exceeded")), 45_000);
      }),
    ]);
  } finally {
    clearTimeout(startupTimer);
  }
  const { pid: backendPid, ...backendBoundary } = ready.boundary;
  const { pid: runnerPid, ...runnerBoundary } = boundary;
  assert.ok(backendPid > 1 && runnerPid > 1);
  assert.deepEqual(backendBoundary, runnerBoundary);

  const server = http.createServer(async (request, response) => {
    try {
      assert.equal(request.socket.localAddress, "127.0.0.1");
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        assert.ok(bytes <= REQUEST_LIMIT);
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      if (request.url === "/_proof/control" && request.method === "POST") {
        if (!authorizedProofToken(request.headers, config.proofToken)) {
          response.writeHead(403, { "content-type": "application/json", "cache-control": "no-store" });
          response.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }
        const reply = await rpc.request(JSON.parse(body), 35_000);
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify(reply));
        return;
      }
      const reply = await rpc.request({
        action: "request",
        url: new URL(request.url, "http://127.0.0.1").href,
        method: request.method,
        headers: request.headers,
        body: body.length ? body.toString("base64") : null,
      }, 35_000);
      let payload;
      if (Object.hasOwn(reply, "asset")) {
        assert.ok(exactObject(reply, ["id", "status", "headers", "asset"]));
        assert.ok(exactObject(reply.asset, ["relativePath", "sha256", "bytes"]));
        assert.equal(request.method, "GET");
        const requestUrl = new URL(request.url, "http://127.0.0.1");
        assert.equal(requestUrl.search, "");
        const relativePath = `build/client${decodeURIComponent(requestUrl.pathname)}`;
        assert.equal(reply.asset.relativePath, relativePath);
        assert.match(relativePath, /^build\/client\/assets\/[A-Za-z0-9._/-]+$/);
        assert.ok(!relativePath.split("/").includes(".."));
        const target = path.join(config.appRoot, ...relativePath.split("/"));
        assert.equal(await realpath(target), target);
        const sourceEntry = sourceManifestByPath.get(target);
        assert.ok(sourceEntry);
        assert.deepEqual({ sha256: reply.asset.sha256, bytes: reply.asset.bytes },
          { sha256: sourceEntry.sha256, bytes: sourceEntry.bytes });
        payload = await readFile(target);
        assert.deepEqual({ sha256: createHash("sha256").update(payload).digest("hex"), bytes: payload.length },
          { sha256: reply.asset.sha256, bytes: reply.asset.bytes });
      } else {
        assert.ok(exactObject(reply, ["id", "status", "headers", "body"]));
        payload = Buffer.from(reply.body, "base64");
      }
      assert.ok(payload.length <= RESPONSE_LIMIT);
      const headers = { ...reply.headers };
      delete headers["content-length"];
      delete headers.connection;
      response.writeHead(reply.status, headers);
      response.end(payload);
    } catch (error) {
      response.writeHead(502, { "content-type": "text/plain", "cache-control": "no-store" });
      response.end(String(error?.message ?? error).slice(0, 4096));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    ownedServer = server;
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const browserEvidence = path.join(config.evidenceRoot, "browser");
  const browserInput = path.join(config.evidenceRoot, "browser-input.json");
  await writeFile(browserInput, JSON.stringify({
    schema: "vivary.06e-c5-browser-input/v1",
    baseUrl: `http://127.0.0.1:${address.port}/`,
    chromiumExecutable: config.chromiumExecutable,
    evidenceRoot: browserEvidence,
    playwrightPackageJson: config.playwrightPackageJson,
    proofToken: config.proofToken,
  }) + "\n", { flag: "wx", mode: 0o600 });

  ownedDisplay = await startPrivateDisplay({ workRoot: config.scratchRoot, track });
  const displayMetadata = ownedDisplay.metadata;
  const browser = track(spawn(config.nodeExecutable, [config.browserPath, browserInput], {
    cwd: config.sourceRoot,
    env: {
      HOME: "/home",
      TMPDIR: "/tmp",
      PATH: "/usr/bin:/bin",
      LANG: "C.UTF-8",
      ...ownedDisplay.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }));
  const browserExit = new Promise(resolve => browser.once("close", (code, signal) => resolve({ code, signal })));
  const browserOutPromise = captureDiagnostic(browser.stdout, "browser-stdout",
    path.join(config.evidenceRoot, "browser-stdout.bin"));
  const browserErrPromise = captureDiagnostic(browser.stderr, "browser-stderr",
    path.join(config.evidenceRoot, "browser-stderr.bin"));
  const browserResult = await Promise.race([browserExit, rpc.failure, outputFailure]);
  const [browserOut, browserErr] = await Promise.all([browserOutPromise, browserErrPromise]);
  assert.deepEqual(browserResult, { code: 0, signal: null }, browserErr.toString("utf8"));
  assert.equal(browserOut.length, 0);
  assert.equal(browserErr.length, 0);
  assert.deepEqual(childSignals.get(browser), []);
  await stage("browser-natural-exit", browserResult);

  const browserEvidenceRead = await readJson(path.join(browserEvidence, "browser-result.json"),
    16 * 1024 * 1024);
  assert.equal(browserEvidenceRead.value.passed, true);
  assert.equal(browserEvidenceRead.value.checks.length, 13);
  assert.equal(browserEvidenceRead.value.shutdown.browserClosedNaturally, true);
  assert.equal(browserEvidenceRead.value.shutdown.chromiumSandbox, true);

  const closing = await Promise.race([
    rpc.request({ action: "close" }, 45_000),
    outputFailure,
  ]);
  assert.equal(closing.closing, true);
  assert.equal(closing.shutdown.providerStopMode, "public-close-sigkill");
  assert.equal(closing.shutdown.providerCloseCalls, 1);
  assert.equal(closing.shutdown.providerAbsent, true);
  await stage("backend-close-ack", {
    providerStopMode: closing.shutdown.providerStopMode,
    providerIdentity: closing.shutdown.providerIdentity,
    providerAbsent: closing.shutdown.providerAbsent,
  });
  backend.stdin.end();
  const backendResult = await Promise.race([backendExit, outputFailure]);
  const backendErrors = await backendErrorsPromise;
  assert.deepEqual(backendResult, { code: 0, signal: null }, backendErrors.toString("utf8"));
  assert.deepEqual(childSignals.get(backend), []);
  assert.ok(backendProtocolBytes + diagnosticOutputBytes <= PROFILE_LIMITS.outputStopBytes);
  await stage("backend-natural-exit", backendResult);

  const backendFinalRead = await readJson(path.join(backendEvidence, "backend-final.json"),
    16 * 1024 * 1024);
  assert.equal(backendFinalRead.value.closeRequested, true);
  assert.equal(backendFinalRead.value.terminalError, null);
  assert.equal(backendFinalRead.value.shutdown.stdinEofConsumed, true);
  assert.equal(backendFinalRead.value.shutdown.providerStopMode, "public-close-sigkill");
  assert.equal(backendFinalRead.value.shutdown.providerAbsent, true);
  assert.equal(backendFinalRead.value.shutdown.ssrChannel.portsClosed, 2);
  assert.equal(backendFinalRead.value.shutdown.ssrChannel.closeEvents, 2);
  assert.deepEqual(backendFinalRead.value.counters, backendFinalRead.value.setupCounters);

  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  ownedServer = null;
  await stage("http-natural-close", { closed: true });

  const displayChild = [...childSignals.keys()].find(child => child.spawnfile === "/usr/bin/Xvfb");
  assert.ok(displayChild);
  const displayStop = await ownedDisplay.stop();
  ownedDisplay = null;
  assert.deepEqual(childSignals.get(displayChild), ["SIGTERM"]);
  await stage("display-public-stop", { mode: "public-stop-sigterm", fallback: false });

  const result = {
    schema: "vivary.06e-c5-runner-result/v1",
    passed: true,
    configSha256: configRead.sha256,
    profileSha256: config.profileSha256,
    sourceManifestSha256: config.sourceManifestSha256,
    sourceBindingSha256: config.sourceBindingSha256,
    toolManifestSha256: config.toolManifestSha256,
    trafficManifestSha256: config.trafficManifestSha256,
    boundary,
    display: {
      ...displayMetadata,
      ...displayStop,
      stopMode: "public-stop-sigterm",
      fallback: false,
    },
    browserResultSha256: browserEvidenceRead.sha256,
    backendFinalSha256: backendFinalRead.sha256,
    backendStderrBytes: backendErrors.length,
    backendStderrSha256: createHash("sha256").update(backendErrors).digest("hex"),
    output: {
      backendProtocolBytes,
      diagnosticBytes: diagnosticOutputBytes,
      totalBytes: backendProtocolBytes + diagnosticOutputBytes,
      limitBytes: PROFILE_LIMITS.outputStopBytes,
      liveLimitFailure: outputFailureError?.message ?? null,
      diagnosticSidecars: diagnosticSummary(),
    },
    shutdown: {
      browserExitedNaturally: true,
      backendExitedNaturally: true,
      providerStopMode: "public-close-sigkill",
      providerAbsent: true,
      displayStopMode: "public-stop-sigterm",
      displayFallback: false,
      httpClosedNaturally: true,
      cleanupIntervention,
      stageCount: stages.length + 1,
    },
    elapsedSeconds: Number(process.hrtime.bigint() - started) / 1e9,
  };
  await stage("runner-final", { passed: true, cleanupIntervention });
  assert.equal(cleanupIntervention, false);
  const journal = await digestFile(journalPath);
  result.stageJournalSha256 = journal.sha256;
  await writeFile(failureResultPath,
    JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify(result) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(async error => {
    const cleanupErrors = [];
    try {
      await forceCleanup();
    } catch (cleanupError) {
      cleanupErrors.push({
        type: cleanupError?.constructor?.name ?? "Error",
        message: String(cleanupError?.message ?? cleanupError).slice(0, 4096),
      });
    }
    await Promise.allSettled(diagnosticCaptures.map(entry => entry.promise));
    const failure = {
      schema: "vivary.06e-c5-runner-result/v1",
      passed: false,
      error: {
        type: error?.constructor?.name ?? "Error",
        message: String(error?.message ?? error).slice(0, 4096),
      },
      cleanup: {
        intervention: cleanupIntervention,
        output: {
          backendProtocolBytes,
          diagnosticBytes: diagnosticOutputBytes,
          totalBytes: backendProtocolBytes + diagnosticOutputBytes,
          limitBytes: PROFILE_LIMITS.outputStopBytes,
          liveLimitFailure: outputFailureError?.message ?? null,
          diagnosticSidecars: diagnosticSummary(),
        },
        errors: cleanupErrors,
        remainingChildren: [...ownedChildren].map(child => ({
          pid: child.pid,
          spawnfile: child.spawnfile,
        })),
        childSignals: [...childSignals.entries()].map(([child, signals]) => ({
          pid: child.pid,
          spawnfile: child.spawnfile,
          signals,
        })),
        serverOwned: ownedServer !== null,
        displayOwned: ownedDisplay !== null,
      },
      elapsedSeconds: runStartedAt === null ? null
        : Number(process.hrtime.bigint() - runStartedAt) / 1e9,
    };
    if (failureResultPath) {
      await writeFile(failureResultPath, JSON.stringify(failure, null, 2) + "\n",
        { flag: "wx", mode: 0o600 }).catch(() => undefined);
    }
    process.stderr.write(`06e C5 browser runner failed: ${failure.error.type}: ${failure.error.message}\n`);
    process.exitCode = 1;
  });
}
