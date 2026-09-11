import assert from "node:assert/strict";
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readlink, realpath, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MAX_JSON = 64 * 1024;
const MAX_FRAME = 12 * 1024 * 1024;
const MAX_STREAM = 1024 * 1024;
const REQUEST_LIMIT = 256 * 1024;
const RESPONSE_LIMIT = 8 * 1024 * 1024;
const PROFILE = Object.freeze({
  kind: "external-observer", enforcement: "monitored-stop", memoryStopBytes: 8589934592,
  processStopCount: 256, sampleMilliseconds: 250, cpuCount: 4, swapTotalBytes: 0,
});
const ownedChildren = new Set();
let ownedServer = null;
export function track(child) {
  ownedChildren.add(child);
  child.once("close", () => ownedChildren.delete(child));
  return child;
}
export async function stopOwned() {
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(resolve, 5_000); });
  try {
    if (ownedServer) {
      ownedServer.closeAllConnections?.();
      await Promise.race([new Promise(resolve => ownedServer.close(() => resolve())), timeout]);
      ownedServer = null;
    }
    const children = [...ownedChildren];
    for (const child of children) child.kill("SIGKILL");
    await Promise.race([
      Promise.allSettled(children.map(child => new Promise(resolve => child.once("close", resolve)))),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

export function expandCpuList(value) {
  assert.equal(typeof value, "string");
  const result = new Set();
  for (const item of value.split(",")) {
    assert.match(item, /^\d+(?:-\d+)?$/);
    const [firstText, lastText = firstText] = item.split("-", 2);
    const first = Number(firstText);
    const last = Number(lastText);
    assert.ok(Number.isSafeInteger(first) && Number.isSafeInteger(last)
      && first >= 0 && last >= first && last - first < 1024);
    for (let cpu = first; cpu <= last; cpu += 1) result.add(cpu);
  }
  return [...result].sort((left, right) => left - right);
}

export function validateProfile(profile) {
  assert.ok(exactObject(profile, ["schema", "candidateHead", "sourceBindingSha256", "sandbox", "supervision"]));
  assert.equal(profile.schema, "vivary.05b-zo-profile/v1");
  assert.match(profile.candidateHead, /^[0-9a-f]{40}$/);
  assert.match(profile.sourceBindingSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(profile.sandbox, {
    uid: 1000, gid: 1000, pidNamespace: true, network: "loopback-only",
    filesystem: "private-ro-source", capabilities: "none", noNewPrivileges: true,
  });
  assert.deepEqual(profile.supervision, PROFILE);
  return profile;
}

export function validateConfig(value) {
  assert.ok(exactObject(value, [
    "schema", "appRoot", "scratchRoot", "evidenceRoot", "backendPath", "backendSha256",
    "browserPath", "browserSha256", "nodeExecutable", "nodeSha256", "nodeBytes",
    "playwrightPackageJson", "playwrightPackageJsonSha256", "chromiumExecutable",
    "chromiumSha256", "sourceBindingSha256", "candidateHead", "candidateManifestPath",
    "candidateManifestSha256", "profilePath", "profileSha256", "proofToken", "deadlineSeconds",
  ]));
  assert.equal(value.schema, "vivary.05b-zo-gui-input/v1");
  for (const name of ["appRoot", "scratchRoot", "evidenceRoot", "backendPath", "browserPath",
    "nodeExecutable", "playwrightPackageJson", "chromiumExecutable", "candidateManifestPath", "profilePath"]) {
    assert.ok(path.isAbsolute(value[name]), `${name} must be absolute`);
  }
  for (const name of ["backendSha256", "browserSha256", "nodeSha256",
    "playwrightPackageJsonSha256", "chromiumSha256", "sourceBindingSha256",
    "candidateManifestSha256", "profileSha256"]) {
    assert.match(value[name], /^[0-9a-f]{64}$/);
  }
  assert.match(value.candidateHead, /^[0-9a-f]{40}$/);
  assert.match(value.proofToken, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(value.nodeBytes) && value.nodeBytes > 0);
  assert.equal(value.deadlineSeconds, 300);
  assert.equal(value.appRoot, "/app");
  assert.equal(value.scratchRoot, "/work");
  assert.equal(value.evidenceRoot, "/work/evidence");
  assert.equal(value.nodeExecutable, "/usr/bin/node");
  assert.equal(value.candidateManifestPath, "/source/candidate.json");
  return value;
}

export function authorizedProofToken(headers, expected) {
  const supplied = headers["x-vivary-proof-token"];
  if (typeof supplied !== "string" || !/^[0-9a-f]{64}$/.test(supplied)
      || typeof expected !== "string" || !/^[0-9a-f]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}

export function validateCandidateManifest(value) {
  assert.ok(exactObject(value, ["schema", "candidateHead", "sourceBindingSha256", "files"]));
  assert.equal(value.schema, "vivary.05b-zo-source/v1");
  assert.match(value.candidateHead, /^[0-9a-f]{40}$/);
  assert.match(value.sourceBindingSha256, /^[0-9a-f]{64}$/);
  assert.ok(Array.isArray(value.files) && value.files.length > 0 && value.files.length <= 512);
  const allowedFixtures = new Set([
    "/source/docs/product/multi-project/fixtures/05b/gui_backend.mjs",
    "/source/docs/product/multi-project/fixtures/05b/gui_browser.mjs",
    "/source/docs/product/multi-project/fixtures/05b/gui_zo_runner.mjs",
    "/source/docs/product/multi-project/fixtures/05b/zo_supervisor.py",
  ]);
  let previous = "";
  for (const file of value.files) {
    assert.ok(exactObject(file, ["path", "sha256", "bytes"]));
    assert.ok((file.path.startsWith("/app/") && !file.path.split("/").includes(".."))
      || allowedFixtures.has(file.path));
    assert.ok(file.path > previous);
    previous = file.path;
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0 && file.bytes <= 512 * 1024 * 1024);
  }
  const computed = createHash("sha256").update(JSON.stringify(value.files)).digest("hex");
  assert.equal(value.sourceBindingSha256, computed);
  return value;
}

async function digestFile(name, maximum = 512 * 1024 * 1024) {
  const info = await lstat(name);
  assert.ok(info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= maximum);
  assert.equal(await realpath(name), name);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(name, { highWaterMark: 1024 * 1024 })) {
    bytes += chunk.length;
    assert.ok(bytes <= maximum);
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

async function readJson(name, maximum = MAX_JSON) {
  const identity = await digestFile(name, maximum);
  const raw = await readFile(name);
  return { value: JSON.parse(raw), ...identity };
}

export function parseMountReadOnly(raw) {
  const value = JSON.parse(raw);
  assert.ok(exactObject(value, ["/app", "/source", "/browser", "/work"]));
  for (const readOnly of Object.values(value)) assert.equal(typeof readOnly, "boolean");
  assert.deepEqual(value, { "/app": true, "/source": true, "/browser": true, "/work": false });
  return { "/app": true, "/source": true, "/browser": true };
}

async function readOnlyMounts() {
  const raw = execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
    'import json,os; paths=("/app","/source","/browser","/work"); print(json.dumps({p: bool(os.statvfs(p).f_flag & os.ST_RDONLY) for p in paths}, separators=(",",":")))',
  ], { encoding: "utf8", timeout: 5000, maxBuffer: 4096 });
  return parseMountReadOnly(raw);
}

export async function observeBoundary(profileSha256) {
  assert.equal(process.platform, "linux");
  assert.equal(process.getuid?.(), 1000);
  assert.equal(process.getgid?.(), 1000);
  const status = await readFile("/proc/self/status", "utf8");
  const field = name => status.split("\n").find(line => line.startsWith(`${name}:`))?.split(":", 2)[1]?.trim();
  assert.equal(field("NoNewPrivs"), "1");
  const capabilities = Object.fromEntries(
    ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(name => [name, Number.parseInt(field(name), 16)]),
  );
  assert.deepEqual(capabilities, { CapInh: 0, CapPrm: 0, CapEff: 0, CapBnd: 0, CapAmb: 0 });
  const networkInterfaces = (await readFile("/proc/net/dev", "utf8"))
    .split("\n").filter(line => line.includes(":")).map(line => line.split(":", 1)[0].trim());
  assert.deepEqual(networkInterfaces, ["lo"]);
  const cpuAffinity = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
    "import json,os; print(json.dumps(sorted(os.sched_getaffinity(0))))"],
  { encoding: "utf8", timeout: 5000, maxBuffer: 4096 }));
  assert.ok(Array.isArray(cpuAffinity) && cpuAffinity.every(Number.isSafeInteger));
  assert.equal(cpuAffinity.length, 4);
  const memory = await readFile("/proc/meminfo", "utf8");
  const memoryKb = name => Number(memory.match(new RegExp(`^${name}:\\s+(\\d+) kB$`, "m"))?.[1]);
  assert.equal(memoryKb("SwapTotal"), 0);
  assert.equal(memoryKb("SwapFree"), 0);
  assert.ok(process.pid > 1);
  const pidNamespaceId = await readlink("/proc/self/ns/pid");
  assert.equal(pidNamespaceId, await readlink("/proc/1/ns/pid"));
  return {
    schema: "vivary.05b-zo-boundary/v1", profileSha256, uid: 1000, gid: 1000,
    pid: process.pid, initPid: 1, noNewPrivileges: true, capabilities, networkInterfaces,
    cpuAffinity, swapTotalBytes: 0, swapFreeBytes: 0, pidNamespaceId,
    readOnlyMounts: await readOnlyMounts(), supervision: PROFILE,
  };
}

export class Rpc {
  constructor(child) {
    this.child = child;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.readySeen = false;
    this.failed = false;
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.failure = new Promise((_, reject) => {
      this.failureReject = reject;
    });
    this.ready.catch(() => undefined);
    this.failure.catch(() => undefined);
    child.stdout.on("data", chunk => {
      try { this.consume(chunk); }
      catch (error) { this.fail(error); }
    });
    child.stdout.on("end", () => this.fail(new Error("backend stdout closed")));
    child.stdout.on("error", error => this.fail(error));
    child.stdin.on("error", error => this.fail(error));
    child.on("error", error => this.fail(error));
  }
  consume(chunk) {
    assert.equal(this.failed, false);
    this.buffer = Buffer.concat([this.buffer, chunk]);
    assert.ok(this.buffer.length <= MAX_FRAME * 2);
    while (true) {
      const end = this.buffer.indexOf(10);
      if (end < 0) break;
      assert.ok(end <= MAX_FRAME);
      const line = this.buffer.subarray(0, end);
      this.buffer = this.buffer.subarray(end + 1);
      const reply = JSON.parse(line);
      assert.ok(reply !== null && typeof reply === "object" && !Array.isArray(reply)
        && Number.isSafeInteger(reply.id) && reply.id >= 0);
      if (reply.id === 0) {
        assert.equal(this.readySeen, false);
        assert.equal(reply.ready, true);
        this.readySeen = true;
        this.readyResolve(reply);
        continue;
      }
      const operation = this.pending.get(reply.id);
      assert.ok(operation, "unexpected or late backend reply");
      this.pending.delete(reply.id);
      clearTimeout(operation.timer);
      if (reply.error) operation.reject(new Error(JSON.stringify(reply.error)));
      else operation.resolve(reply);
    }
    assert.ok(this.buffer.length <= MAX_FRAME);
  }
  request(message, timeout = 15000) {
    assert.equal(this.failed, false);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("backend RPC deadline exceeded"));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      const frame = Buffer.from(JSON.stringify({ id, ...message }) + "\n");
      assert.ok(frame.length <= MAX_FRAME);
      this.child.stdin.write(frame, error => {
        if (error) this.fail(error);
      });
    });
  }
  fail(error) {
    if (this.failed) return;
    this.failed = true;
    const failure = error instanceof Error ? error : new Error(String(error));
    this.readyReject(failure);
    this.failureReject(failure);
    for (const operation of this.pending.values()) {
      clearTimeout(operation.timer);
      operation.reject(failure);
    }
    this.pending.clear();
    this.child.stdin.destroy();
  }
}

async function collect(stream, limit = MAX_STREAM) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    assert.ok(bytes <= limit);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function run() {
  const started = process.hrtime.bigint();
  const [configName] = process.argv.slice(2);
  assert.ok(configName);
  const configRead = await readJson(await realpath(configName));
  const config = validateConfig(configRead.value);
  assert.equal(await realpath(configName), configName);
  assert.equal(await realpath(config.scratchRoot), config.scratchRoot);
  assert.equal(path.dirname(config.evidenceRoot), config.scratchRoot);
  await mkdir(config.evidenceRoot, { recursive: false, mode: 0o700 });

  const profileRead = await readJson(config.profilePath);
  assert.equal(profileRead.sha256, config.profileSha256);
  const profile = validateProfile(profileRead.value);
  assert.equal(profile.candidateHead, config.candidateHead);
  assert.equal(profile.sourceBindingSha256, config.sourceBindingSha256);
  const manifestRead = await readJson(config.candidateManifestPath, 4 * 1024 * 1024);
  assert.equal(manifestRead.sha256, config.candidateManifestSha256);
  const manifest = validateCandidateManifest(manifestRead.value);
  assert.equal(manifest.candidateHead, config.candidateHead);
  assert.equal(manifest.sourceBindingSha256, config.sourceBindingSha256);
  for (const file of manifest.files) {
    const observed = await digestFile(file.path);
    assert.deepEqual(observed, { sha256: file.sha256, bytes: file.bytes });
  }
  const boundary = await observeBoundary(config.profileSha256);

  const identities = {};
  for (const [pathKey, hashKey, byteKey] of [
    ["backendPath", "backendSha256"], ["browserPath", "browserSha256"],
    ["nodeExecutable", "nodeSha256", "nodeBytes"],
    ["playwrightPackageJson", "playwrightPackageJsonSha256"],
    ["chromiumExecutable", "chromiumSha256"],
  ]) {
    const observed = await digestFile(config[pathKey]);
    assert.equal(observed.sha256, config[hashKey]);
    if (byteKey) assert.equal(observed.bytes, config[byteKey]);
    identities[pathKey] = observed;
  }
  const backendEvidence = path.join(config.evidenceRoot, "backend");
  await mkdir(backendEvidence, { recursive: false, mode: 0o700 });
  const deadline = setTimeout(() => {
    for (const child of ownedChildren) child.kill("SIGKILL");
  }, config.deadlineSeconds * 1000);
  deadline.unref();
  const backend = track(spawn(config.nodeExecutable, [
    config.backendPath, config.appRoot, backendEvidence, config.profilePath,
    config.profileSha256, config.nodeSha256, String(config.nodeBytes),
  ], {
    cwd: config.appRoot,
    env: {
      AGENT_MODE: "production", AGENT_NATIVE_DISABLE_RECURRING_JOBS: "true",
      AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS: "true", AGENT_ENGINE: "vivary-proof",
      NODE_ENV: "production", DATABASE_URL: `file:${backendEvidence}/native-chat.sqlite`,
      HOME: "/tmp", PATH: "/usr/bin:/bin", LANG: "C.UTF-8",
    },
    stdio: ["pipe", "pipe", "pipe"],
  }));
  const backendErrorsPromise = collect(backend.stderr);
  backendErrorsPromise.catch(() => undefined);
  const backendExit = new Promise(resolve => backend.once("close", resolve));
  const rpc = new Rpc(backend);
  let startupTimer;
  const ready = await Promise.race([
    rpc.ready,
    rpc.failure,
    new Promise((_, reject) => {
      startupTimer = setTimeout(() => reject(new Error("backend startup deadline exceeded")), 30000);
    }),
  ]);
  clearTimeout(startupTimer);
  const { pid: backendPid, ...backendBoundary } = ready.boundary;
  const { pid: runnerPid, ...runnerBoundary } = boundary;
  assert.ok(Number.isSafeInteger(backendPid) && backendPid > 1 && runnerPid > 1);
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
      let reply;
      if (request.url === "/_proof/control" && request.method === "POST") {
        if (!authorizedProofToken(request.headers, config.proofToken)) {
          response.writeHead(403, { "content-type": "application/json", "cache-control": "no-store" });
          response.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }
        const action = JSON.parse(body);
        assert.ok(action && typeof action === "object" && !Array.isArray(action));
        reply = await rpc.request(action);
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify(reply));
        return;
      }
      reply = await rpc.request({
        action: "request", url: new URL(request.url, `http://127.0.0.1`).href,
        method: request.method, headers: request.headers,
        body: body.length ? body.toString("base64") : null,
      });
      const payload = Buffer.from(reply.body, "base64");
      assert.ok(payload.length <= RESPONSE_LIMIT);
      const headers = { ...reply.headers };
      delete headers["content-length"];
      delete headers.connection;
      response.writeHead(reply.status, headers);
      response.end(payload);
    } catch (error) {
      response.writeHead(502, { "content-type": "text/plain" });
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
    schema: "vivary.05b-gui-browser-input/v1",
    baseUrl: `http://127.0.0.1:${address.port}/`,
    chromiumExecutable: config.chromiumExecutable,
    evidenceRoot: browserEvidence,
    playwrightPackageJson: config.playwrightPackageJson,
    proofToken: config.proofToken,
  }) + "\n", { flag: "wx", mode: 0o600 });

  const browser = track(spawn(config.nodeExecutable, [config.browserPath, browserInput], {
    cwd: config.appRoot, env: { HOME: "/tmp", PATH: "/usr/bin:/bin", LANG: "C.UTF-8" },
    stdio: ["ignore", "pipe", "pipe"],
  }));
  const browserExit = new Promise(resolve => browser.once("close", resolve));
  const browserOutPromise = collect(browser.stdout);
  const browserErrPromise = collect(browser.stderr);
  browserOutPromise.catch(() => undefined);
  browserErrPromise.catch(() => undefined);
  const browserCode = await Promise.race([browserExit, rpc.failure]);
  const [browserOut, browserErr] = await Promise.all([browserOutPromise, browserErrPromise]);
  assert.equal(browserCode, 0, browserErr.toString("utf8"));
  assert.equal(browserOut.length, 0);
  assert.equal(browserErr.length, 0);
  const browserResultRead = await readJson(path.join(browserEvidence, "browser-result.json"), 4 * 1024 * 1024);
  assert.equal(browserResultRead.value.passed, true);

  const closing = await rpc.request({ action: "close" }, 30000);
  assert.equal(closing.closing, true);
  backend.stdin.end();
  const backendCode = await backendExit;
  const backendErrors = await backendErrorsPromise;
  assert.equal(backendCode, 0, backendErrors.toString("utf8"));
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  ownedServer = null;
  clearTimeout(deadline);

  const result = {
    schema: "vivary.05b-zo-gui-result/v1", passed: true, candidateHead: config.candidateHead,
    sourceBindingSha256: config.sourceBindingSha256, configSha256: configRead.sha256,
    profileSha256: config.profileSha256, candidateManifestSha256: config.candidateManifestSha256,
    identities, boundary,
    backendReadySha256: createHash("sha256").update(JSON.stringify(ready)).digest("hex"),
    backendClosingSha256: createHash("sha256").update(JSON.stringify(closing)).digest("hex"),
    backendStderrBytes: backendErrors.length,
    backendStderrSha256: createHash("sha256").update(backendErrors).digest("hex"),
    browserResultSha256: browserResultRead.sha256,
    elapsedSeconds: Number(process.hrtime.bigint() - started) / 1e9,
  };
  await writeFile(path.join(config.evidenceRoot, "runner-result.json"),
    JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify(result) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(async error => {
    await stopOwned();
    process.stderr.write(`05b Zo GUI runner failed: ${error?.constructor?.name ?? "Error"}: ${String(error?.message ?? error).slice(0, 4096)}\n`);
    process.exitCode = 1;
  });
}
