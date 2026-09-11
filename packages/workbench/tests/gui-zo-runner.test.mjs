import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  authorizedProofToken,
  exactObject,
  parseMountReadOnly,
  expandCpuList,
  Rpc,
  stopOwned,
  track,
  validateCandidateManifest,
  validateConfig,
  validateProfile,
} from "../../../docs/product/multi-project/fixtures/05b/gui_zo_runner.mjs";

const hash = "a".repeat(64);
const head = "b".repeat(40);

function profile() {
  return {
    schema: "vivary.05b-zo-profile/v1",
    candidateHead: head,
    sourceBindingSha256: hash,
    sandbox: {
      uid: 1000, gid: 1000, pidNamespace: true, network: "loopback-only",
      filesystem: "private-ro-source", capabilities: "none", noNewPrivileges: true,
    },
    supervision: {
      kind: "external-observer", enforcement: "monitored-stop",
      memoryStopBytes: 8589934592, processStopCount: 256,
      sampleMilliseconds: 250, cpuCount: 4, swapTotalBytes: 0,
    },
  };
}

function config() {
  return {
    schema: "vivary.05b-zo-gui-input/v1",
    appRoot: "/app",
    scratchRoot: "/work",
    evidenceRoot: "/work/evidence",
    backendPath: "/source/docs/product/multi-project/fixtures/05b/gui_backend.mjs",
    backendSha256: hash,
    browserPath: "/source/docs/product/multi-project/fixtures/05b/gui_browser.mjs",
    browserSha256: hash,
    nodeExecutable: "/usr/bin/node",
    nodeSha256: hash,
    nodeBytes: 1,
    playwrightPackageJson: "/app/node_modules/playwright/package.json",
    playwrightPackageJsonSha256: hash,
    chromiumExecutable: "/browser/chrome",
    chromiumSha256: hash,
    sourceBindingSha256: hash,
    candidateHead: head,
    profilePath: "/work/zo-profile.json",
    candidateManifestPath: "/source/candidate.json",
    candidateManifestSha256: hash,
    profileSha256: hash,
    proofToken: hash,
    deadlineSeconds: 300,
  };
}

function candidateManifest(files) {
  const sourceBindingSha256 = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  return { schema: "vivary.05b-zo-source/v1", candidateHead: head, sourceBindingSha256, files };
}

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new PassThrough();
    this.stdin = new PassThrough();
  }
}

test("Zo profile names monitored thresholds without claiming kernel enforcement", () => {
  assert.equal(validateProfile(profile()).supervision.enforcement, "monitored-stop");
  for (const [key, value] of [
    ["enforcement", "kernel-hard"], ["sampleMilliseconds", 500],
    ["memoryStopBytes", 32 * 1024 * 1024], ["processStopCount", 257],
  ]) {
    const changed = profile();
    changed.supervision[key] = value;
    assert.throws(() => validateProfile(changed));
  }
});

test("runner configuration is exact and pinned to sandbox paths", () => {
  assert.equal(validateConfig(config()).deadlineSeconds, 300);
  const extra = { ...config(), unexpected: true };
  assert.throws(() => validateConfig(extra));
  for (const [key, value] of [
    ["appRoot", "/source/packages/workbench"],
    ["scratchRoot", "/tmp/work"],
    ["nodeExecutable", "node"],
    ["deadlineSeconds", 301],
  ]) {
    const changed = config();
    changed[key] = value;
    assert.throws(() => validateConfig(changed));
  }
});

test("candidate manifest computes its binding from sorted exact files", () => {
  const files = [
    { path: "/app/package.json", sha256: hash, bytes: 10 },
    { path: "/source/docs/product/multi-project/fixtures/05b/gui_backend.mjs", sha256: hash, bytes: 20 },
  ];
  const manifest = candidateManifest(files);
  assert.equal(validateCandidateManifest(manifest), manifest);
  assert.throws(() => validateCandidateManifest({ ...manifest, sourceBindingSha256: hash }));
  assert.throws(() => validateCandidateManifest(candidateManifest([...files].reverse())));
  assert.throws(() => validateCandidateManifest(candidateManifest([
    { path: "/source/private.txt", sha256: hash, bytes: 1 },
  ])));
});

test("candidate manifest admits the complete source and generated-build set within a fixed ceiling", () => {
  const actualSized = Array.from({ length: 294 }, (_, index) => ({
    path: `/app/build/file-${String(index).padStart(3, "0")}.js`, sha256: hash, bytes: 1,
  }));
  assert.equal(validateCandidateManifest(candidateManifest(actualSized)).files.length, 294);
  const overLimit = Array.from({ length: 513 }, (_, index) => ({
    path: `/app/build/file-${String(index).padStart(3, "0")}.js`, sha256: hash, bytes: 1,
  }));
  assert.throws(() => validateCandidateManifest(candidateManifest(overLimit)));
});

test("proof control token uses exact constant-time comparable bytes", () => {
  assert.equal(authorizedProofToken({ "x-vivary-proof-token": hash }, hash), true);
  assert.equal(authorizedProofToken({ "x-vivary-proof-token": "b".repeat(64) }, hash), false);
  assert.equal(authorizedProofToken({}, hash), false);
  assert.equal(authorizedProofToken({ "x-vivary-proof-token": [hash] }, hash), false);
});

test("mount flags require exact syscall-backed read-only truth", () => {
  const observed = JSON.stringify({ "/app": true, "/source": true, "/browser": true, "/work": false });
  assert.deepEqual(parseMountReadOnly(observed), { "/app": true, "/source": true, "/browser": true });
  assert.throws(() => parseMountReadOnly(JSON.stringify({ "/app": false, "/source": true, "/browser": true, "/work": false })));
  assert.throws(() => parseMountReadOnly(JSON.stringify({ "/app": true, "/source": true, "/browser": true })));
  assert.throws(() => parseMountReadOnly(JSON.stringify({ "/app": true, "/source": true, "/browser": true, "/work": 0 })));
});

test("RPC accepts a valid frame larger than one MiB", async () => {
  const child = new FakeChild();
  const rpc = new Rpc(child);
  const padding = "x".repeat(2 * 1024 * 1024);
  child.stdout.write(JSON.stringify({ id: 0, ready: true, padding }) + "\n");
  assert.equal((await rpc.ready).padding.length, padding.length);
  const pending = rpc.request({ action: "large" });
  const request = JSON.parse(child.stdin.read().toString("utf8"));
  rpc.consume(Buffer.from(JSON.stringify({ id: request.id, padding }) + "\n"));
  assert.equal((await pending).padding.length, padding.length);
});

test("malformed and late RPC replies fail the transport and pending work", async () => {
  const malformedChild = new FakeChild();
  const malformed = new Rpc(malformedChild);
  const malformedFailure = malformed.failure;
  malformedChild.stdout.write("{\n");
  await assert.rejects(malformedFailure);
  assert.equal(malformedChild.stdin.destroyed, true);

  const lateChild = new FakeChild();
  const late = new Rpc(lateChild);
  const pending = late.request({ action: "timeout" }, 5);
  const request = JSON.parse(lateChild.stdin.read().toString("utf8"));
  await assert.rejects(pending, /deadline exceeded/);
  const lateFailure = late.failure;
  lateChild.stdout.write(JSON.stringify({ id: request.id, ok: true }) + "\n");
  await assert.rejects(lateFailure, /late backend reply/);
  assert.equal(lateChild.stdin.destroyed, true);
});

test("failed-run cleanup kills and waits for every tracked child", async () => {
  class OwnedChild extends EventEmitter {
    kill(signal) {
      this.signal = signal;
      queueMicrotask(() => this.emit("close", 137));
      return true;
    }
  }
  const left = track(new OwnedChild());
  const right = track(new OwnedChild());
  await stopOwned();
  assert.equal(left.signal, "SIGKILL");
  assert.equal(right.signal, "SIGKILL");
});

test("CPU-list expansion is exact and bounded", () => {
  assert.deepEqual(expandCpuList("0-2,7"), [0, 1, 2, 7]);
  assert.deepEqual(expandCpuList("4,2-3,3"), [2, 3, 4]);
  for (const value of ["", "4-2", "-1", "0-2048", "a"]) {
    assert.throws(() => expandCpuList(value));
  }
});

test("backend uses the Zo boundary and contains no cgroup enforcement claim", async () => {
  const source = await readFile(new URL("../../../docs/product/multi-project/fixtures/05b/gui_backend.mjs", import.meta.url), "utf8");
  for (const term of [
    "vivary.05b-zo-profile/v1", "vivary.05b-zo-boundary/v1",
    "CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb",
    "NoNewPrivs", "sched_getaffinity", "SwapTotal", "SwapFree",
  ]) assert.ok(source.includes(term), term);
  for (const term of ["cgroupMembership", "cgroupBoundary", "memory.max", "pids.max", "expectedUnit"]) {
    assert.equal(source.includes(term), false, term);
  }
});

test("runner leaves exclusive ownership of the browser evidence root to the browser fixture", async () => {
  const source = await readFile(new URL("../../../docs/product/multi-project/fixtures/05b/gui_zo_runner.mjs", import.meta.url), "utf8");
  assert.ok(source.includes('const browserEvidence = path.join(config.evidenceRoot, "browser");'));
  assert.ok(source.includes("evidenceRoot: browserEvidence"));
  assert.equal(source.includes("mkdir(browserEvidence"), false);
});

test("browser acceptance fixture remains unchanged by the Zo adapter", async () => {
  const source = await readFile(new URL("../../../docs/product/multi-project/fixtures/05b/gui_browser.mjs", import.meta.url), "utf8");
  for (const term of [
    'chromiumSandbox: true',
    'manual rename wins the completed delayed response and survives reload',
    'provider failure persists the local fallback title',
    'account reload ignores stale saved thread IDs and old transcript cache',
    'organization reload ignores stale saved IDs and old transcript cache',
    'Workbench remains read-only and sends no chat mutations',
  ]) assert.ok(source.includes(term), term);
});
