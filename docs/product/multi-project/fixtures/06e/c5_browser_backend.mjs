import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readlink, realpath, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "node:util";

const MAX_FRAME_BYTES = 12 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 256 * 1024;
const MAX_RESPONSE_BODY_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_BYTES = 128 * 1024 * 1024;
const MAX_PENDING_REQUESTS = 24;
const REQUEST_DEADLINE_MS = 30_000;
const SELECTION_KEY = "vivary-project-selection-v1";
const MIME = Object.freeze({
  ".css": "text/css",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
});
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
const [
  appInput,
  sourceInput,
  evidenceInput,
  profileInput,
  trafficManifestInput,
  expectedProfileSha256,
  expectedNodeSha256,
  expectedNodeBytes,
] = process.argv.slice(2);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function boundedError(error) {
  return {
    type: error?.constructor?.name ?? "Error",
    message: String(error?.message ?? error).slice(0, 4096),
  };
}

function canonical(value) {
  if (typeof value === "bigint") return { $bigint: String(value) };
  if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("hex") };
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function canonicalDigest(value) {
  return sha256(Buffer.from(canonicalJson(value)));
}

async function digestFile(file, maximum = 512 * 1024 * 1024) {
  assert.equal(await realpath(file), file);
  const info = await lstat(file);
  assert.ok(info.isFile() && info.size > 0 && info.size <= maximum);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    bytes += chunk.length;
    assert.ok(bytes <= maximum);
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}
async function localPathFacts(target, expectedType) {
  assert.equal(await realpath(target), target);
  const information = await lstat(target);
  assert.equal(expectedType === "directory" ? information.isDirectory() : information.isFile(), true);
  if (expectedType === "file") assert.equal(information.nlink, 1);
  return {
    path: target,
    type: expectedType,
    device: information.dev,
    inode: information.ino,
    mode: (information.mode & 0o777).toString(8).padStart(3, "0"),
    links: information.nlink,
    bytes: information.size,
  };
}

function activeResourceCounts() {
  const counts = {};
  for (const item of process.getActiveResourcesInfo()) {
    assert.match(item, /^[A-Za-z][A-Za-z0-9_]{0,127}$/);
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

async function processIdentity(pid) {
  const raw = await readFile(`/proc/${pid}/stat`, "utf8");
  const close = raw.lastIndexOf(")");
  const fields = raw.slice(close + 2).split(" ");
  return { pid: Number(pid), start: Number(fields[19]) };
}

async function rootProviderProcesses() {
  const found = [];
  for (const name of await readdir("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const raw = await readFile(`/proc/${name}/cmdline`);
      if (raw.toString("utf8").includes("root_provider_stdio.py")) found.push(await processIdentity(name));
    } catch {}
  }
  return found.sort((left, right) => left.pid - right.pid);
}

assert.equal(process.platform, "linux");
assert.equal(process.getuid?.(), 1000);
assert.equal(process.getgid?.(), 1000);
assert.match(expectedProfileSha256 ?? "", /^[0-9a-f]{64}$/);
assert.match(expectedNodeSha256 ?? "", /^[0-9a-f]{64}$/);
assert.ok(Number.isSafeInteger(Number(expectedNodeBytes)) && Number(expectedNodeBytes) > 0);
for (const name of Object.keys(process.env)) {
  assert.ok(!/(TOKEN|SECRET|PASSWORD|API_KEY|ANTHROPIC|OPENAI|CLAUDE|GEMINI|PROXY)/i.test(name),
    `credential or proxy environment refused: ${name}`);
}
assert.equal(process.env.AGENT_MODE, "production");
assert.equal(process.env.AGENT_NATIVE_DISABLE_RECURRING_JOBS, "true");
assert.equal(process.env.AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS, "true");
assert.equal(process.env.NODE_ENV, "production");

const app = await realpath(appInput);
const source = await realpath(sourceInput);
const evidenceRoot = await realpath(evidenceInput);
assert.equal(app, appInput);
assert.equal(source, sourceInput);
assert.equal(evidenceRoot, evidenceInput);
const databasePath = path.join(evidenceRoot, "c5-native.sqlite");
assert.equal(process.env.DATABASE_URL, `file:${databasePath}`);
await assert.rejects(lstat(databasePath), error => error?.code === "ENOENT");

const nodeIdentity = await digestFile(process.execPath);
assert.deepEqual(nodeIdentity, { sha256: expectedNodeSha256, bytes: Number(expectedNodeBytes) });
const profileBytes = await readFile(await realpath(profileInput));
assert.equal(sha256(profileBytes), expectedProfileSha256);
const profile = JSON.parse(profileBytes);
const trafficManifestBytes = await readFile(await realpath(trafficManifestInput));
const trafficManifest = JSON.parse(trafficManifestBytes);
assert.ok(exactObject(profile, ["schema", "sourceBindingSha256", "sandbox", "supervision", "trafficManifestSha256"]));
assert.equal(profile.schema, "vivary.06e-c5-browser-profile/v1");
assert.deepEqual(profile.supervision, {
  kind: "external-observer",
  enforcement: "monitored-stop",
  ...PROFILE_LIMITS,
});
assert.equal(sha256(trafficManifestBytes), profile.trafficManifestSha256);
assert.ok(exactObject(trafficManifest, ["schema", "routeGets", "assetGets", "shellGets", "chatGets",
  "bootstrapMutations", "chatMutations"]));
assert.equal(trafficManifest.schema, "vivary.06e-c5-traffic/v1");
for (const list of [trafficManifest.routeGets, trafficManifest.assetGets,
  trafficManifest.shellGets, trafficManifest.chatGets]) {
  assert.ok(Array.isArray(list) && list.length > 0);
  assert.equal(new Set(list).size, list.length);
  assert.deepEqual([...list].sort(), list);
}
const expectedBootstrapMutations = [{
  method: "PUT",
  path: "/_agent-native/application-state/localization",
  body: { locale: "en-US", preference: "system", dir: "ltr" },
  headers: { "content-type": "application/json", "x-request-source": "localization" },
  maxPerWindow: 1,
  windows: ["c5-root", "c5-workbench", "chat"],
}];
const expectedChatMutations = [{
  method: "PUT",
  path: "/_agent-native/application-state/__url__",
  body: { pathname: "/chat", search: "", hash: "", searchParams: {} },
  headers: { "content-type": "application/json" },
  maxPerWindow: 1,
  windows: ["chat"],
}, {
  method: "POST",
  path: "/_agent-native/actions/manage-agent-engine",
  body: { action: "list" },
  headers: { "content-type": "application/json" },
  maxPerWindow: 1,
  windows: ["chat"],
}];
assert.deepEqual(trafficManifest.bootstrapMutations, expectedBootstrapMutations);
assert.deepEqual(trafficManifest.chatMutations, expectedChatMutations);
assert.deepEqual(profile.sandbox, {
  uid: 1000,
  gid: 1000,
  pidNamespace: true,
  network: "loopback-only",
  filesystem: "private-ro-source",
  capabilities: "none",
  noNewPrivileges: true,
});
assert.equal(process.env.BETTER_AUTH_SECRET, undefined);
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
const ephemeralAuthConfiguration = Object.freeze({
  generatedInFixture: true,
  encodedBytes: 64,
  persisted: false,
});

const status = await readFile("/proc/self/status", "utf8");
const statusValue = name => status.split("\n").find(line => line.startsWith(`${name}:`))?.split(":", 2)[1]?.trim();
assert.equal(statusValue("NoNewPrivs"), "1");
const capabilities = Object.fromEntries(
  ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(name => [name, Number.parseInt(statusValue(name), 16)]),
);
assert.deepEqual(capabilities, { CapInh: 0, CapPrm: 0, CapEff: 0, CapBnd: 0, CapAmb: 0 });
const cpuAffinity = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
  "import json,os; print(json.dumps(sorted(os.sched_getaffinity(0))))"],
{ encoding: "utf8", timeout: 5000, maxBuffer: 4096, env: { LANG: "C.UTF-8" } }));
assert.equal(cpuAffinity.length, PROFILE_LIMITS.cpuCount);
const networkInterfaces = (await readFile("/proc/net/dev", "utf8"))
  .split("\n").filter(line => line.includes(":")).map(line => line.split(":", 1)[0].trim());
assert.deepEqual(networkInterfaces, ["lo"]);
const memory = await readFile("/proc/meminfo", "utf8");
const memoryKb = name => Number(memory.match(new RegExp(`^${name}:\\s+(\\d+) kB$`, "m"))?.[1]);
assert.equal(memoryKb("SwapTotal"), 0);
assert.equal(memoryKb("SwapFree"), 0);
const pidNamespaceId = await readlink("/proc/self/ns/pid");
assert.equal(pidNamespaceId, await readlink("/proc/1/ns/pid"));
const mountReadOnly = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
  'import json,os; paths=("/app","/source","/browser","/work"); print(json.dumps({p: bool(os.statvfs(p).f_flag & os.ST_RDONLY) for p in paths}, separators=(",",":")))',
], { encoding: "utf8", timeout: 5000, maxBuffer: 4096, env: { LANG: "C.UTF-8" } }));
assert.deepEqual(mountReadOnly, { "/app": true, "/source": true, "/browser": true, "/work": false });
const boundary = {
  schema: "vivary.06e-c5-runner-boundary/v1",
  profileSha256: expectedProfileSha256,
  uid: process.getuid(),
  gid: process.getgid(),
  pid: process.pid,
  initPid: 1,
  noNewPrivileges: true,
  capabilities,
  networkInterfaces,
  cpuAffinity,
  swapTotalBytes: 0,
  swapFreeBytes: 0,
  pidNamespaceId,
  readOnlyMounts: { "/app": true, "/source": true, "/browser": true },
  supervision: profile.supervision,
};

let stderrBytes = 0;
const writeDiagnostic = (...args) => {
  const bytes = Buffer.from(`${format(...args)}\n`, "utf8");
  stderrBytes += bytes.length;
  if (stderrBytes <= 1024 * 1024) process.stderr.write(bytes);
};
for (const name of ["log", "warn", "error", "info", "debug"]) console[name] = writeDiagnostic;

const appRequire = createRequire(path.join(app, "package.json"));
const importPackage = async name => import(pathToFileURL(appRequire.resolve(name)).href);
const appImport = relative => import(pathToFileURL(path.join(app, relative)).href);
const sourceImport = relative => import(pathToFileURL(path.join(source, relative)).href);

const {
  addSession,
  awaitBootstrap,
  COOKIE_NAME,
  createAgentChatPlugin,
  createThread,
  getH3App,
  getSession,
  markDefaultPluginProvided,
  removeSession,
} = await importPackage("@agent-native/core/server");
const {
  ensureAgentHarnessSessionTables,
  registerAgentHarness,
  startAgentHarnessRun,
} = await importPackage("@agent-native/core/agent/harness");
const { registerAgentEngine } = await importPackage("@agent-native/core/agent/engine");
const { defaultOnboardingPlugin } = await importPackage("@agent-native/core/onboarding");
const { closeDbExec, getDbExec, runMigrations, withMigrationRuntime } =
  await importPackage("@agent-native/core/db");
const { stopAuditCleanupJob } = await importPackage("@agent-native/core/audit");
const {
  getMyOrgHandler,
  ORG_MIGRATIONS,
  organizations,
  orgMembers,
  setAppMemberRole,
} = await importPackage("@agent-native/core/org");
const { H3, defineEventHandler, getMethod, setResponseStatus } = await importPackage("h3");
const { createRequestHandler } = await importPackage("react-router");
const { getDb } = await appImport("server/db/index.mjs");
const { migrateRegistry } = await appImport("server/db/migrations.mjs");
const tables = await appImport("server/db/schema.mjs");
const { createNativeRegistry, createNativeRegistryAuth } = await appImport("server/native-registry.mjs");
const { mountRegistryHttp } = await appImport("server/registry-http.mjs");
const { createProjectCatalog, mountProjectCatalog } = await appImport("server/project-catalog.mjs");
const readinessSourceIdentity = await digestFile(
  path.join(app, "server/project-runtime-readiness.mjs"));
const { createProjectRuntimeReadiness, mountProjectRuntimeReadiness } =
  await appImport("server/project-runtime-readiness.mjs");
const { createProjectRuntimeActivity, mountProjectRuntimeActivity } =
  await appImport("server/project-runtime-activity.mjs");
const { startRootProvider } = await appImport("server/root-provider.mjs");
const { parseStrictJson, evaluateRegistryOperation } =
  await sourceImport("scripts/registry_contract_model.mjs");

const ssrBundlePath = path.join(app, "build/server/index.js");
const ssrBundleIdentity = await digestFile(ssrBundlePath, MAX_ASSET_BYTES);
const NativeMessageChannel = globalThis.MessageChannel;
const messageChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "MessageChannel");
assert.equal(typeof NativeMessageChannel, "function");
assert.ok(messageChannelDescriptor?.configurable);
const capturedSsrChannels = [];
const TrackedMessageChannel = new Proxy(NativeMessageChannel, {
  construct(target, args, newTarget) {
    const channel = Reflect.construct(target, args, newTarget);
    const stack = new Error("SSR MessageChannel creation").stack ?? "";
    if (stack.includes("/app/build/server/index.js")) {
      assert.ok(capturedSsrChannels.length < 2);
      capturedSsrChannels.push({ channel, stackSha256: sha256(Buffer.from(stack)) });
    }
    return channel;
  },
});
let build;
try {
  Object.defineProperty(globalThis, "MessageChannel", {
    configurable: messageChannelDescriptor.configurable,
    enumerable: messageChannelDescriptor.enumerable,
    writable: true,
    value: TrackedMessageChannel,
  });
  build = await appImport("build/server/index.js");
} finally {
  Object.defineProperty(globalThis, "MessageChannel", messageChannelDescriptor);
}
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "MessageChannel"), messageChannelDescriptor);
assert.equal(capturedSsrChannels.length, 1);
const render = createRequestHandler(build, "production");

const identity = Object.freeze({
  email: "c5-browser@example.test",
  token: randomUUID(),
  orgId: "c5-browser-org",
  collectionId: "c5-browser-collection",
});
const grant = Object.freeze({
  orgId: identity.orgId,
  collectionId: identity.collectionId,
  policyRevision: 7,
  locationRefs: ["alpha", "beta"],
});
const context = Object.freeze({
  userEmail: identity.email,
  orgId: identity.orgId,
  appId: "workbench",
  caller: "frontend",
});
const runtimeIdentity = Object.freeze({
  harnessName: "c5-browser-harness",
  runtimeVersion: "c5-browser-v1",
  executionLocation: "zo-browser-fixture",
  configurationRevision: 1,
  authorityContract: "c5-browser-read-only-v1",
});
const custodyRoot = "/tmp/c5-browser-custody";
const rootsRoot = path.join(custodyRoot, "roots");
const privateRoot = path.join(custodyRoot, "provider");
const providerStatePath = path.join(privateRoot, "roots.json");
const locations = Object.freeze({
  alpha: path.join(rootsRoot, "alpha"),
  beta: path.join(rootsRoot, "beta"),
});
await mkdir(custodyRoot, { recursive: false, mode: 0o700 });
for (const folder of [rootsRoot, privateRoot, ...Object.values(locations)]) {
  await mkdir(folder, { recursive: false, mode: 0o700 });
}
const custodyFilesystem = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
  [
    "import ctypes,json,os,sys",
    "def magic(path):",
    " b=ctypes.create_string_buffer(256)",
    " f=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)",
    " try:",
    "  fn=ctypes.CDLL(None,use_errno=True).fstatfs",
    "  fn.argtypes=(ctypes.c_int,ctypes.c_void_p)",
    "  fn.restype=ctypes.c_int",
    "  assert fn(f,b)==0",
    "  return hex(ctypes.c_long.from_buffer(b).value & 0xffffffff)",
    " finally: os.close(f)",
    "print(json.dumps({name:magic(path) for name,path in zip(('custody','roots','state'),sys.argv[1:])},separators=(',',':')))",
  ].join("\n"), custodyRoot, rootsRoot, privateRoot,
], { encoding: "utf8", timeout: 5000, maxBuffer: 4096, env: { LANG: "C.UTF-8" } }));
assert.deepEqual(custodyFilesystem, {
  custody: "0x1021994",
  roots: "0x1021994",
  state: "0x1021994",
});
await writeFile(path.join(locations.alpha, "proof.txt"), "alpha original\n", { flag: "wx", mode: 0o600 });
await writeFile(path.join(locations.beta, "proof.txt"), "beta original\n", { flag: "wx", mode: 0o600 });

let chatModelCreates = 0;
let chatModelCalls = 0;
const inertEngine = Object.freeze({
  name: "c5-browser-no-model",
  label: "C5 browser fixture",
  defaultModel: "c5-browser-no-model",
  supportedModels: ["c5-browser-no-model"],
  capabilities: {
    thinking: false,
    promptCaching: false,
    vision: false,
    computerUse: false,
    parallelToolCalls: false,
  },
  async *stream() {
    chatModelCalls += 1;
    throw new Error("C5 browser fixture forbids model execution");
  },
});
registerAgentEngine({
  name: inertEngine.name,
  label: inertEngine.label,
  description: "Fixture engine that refuses every model call.",
  capabilities: inertEngine.capabilities,
  defaultModel: inertEngine.defaultModel,
  supportedModels: inertEngine.supportedModels,
  requiredEnvVars: [],
  create: () => {
    chatModelCreates += 1;
    return inertEngine;
  },
});

let harnessCreates = 0;
let harnessTurns = 0;
let harnessDetaches = 0;
registerAgentHarness({
  name: runtimeIdentity.harnessName,
  label: "C5 browser synthetic Native seeder",
  description: "Creates only bounded Native fixture records before browser measurement.",
  capabilities: { sandbox: true, resumable: true, approvals: true, hostTools: true, fileEvents: true },
  create() {
    throw new Error("readiness must not construct the registered harness");
  },
});

const nitro = { h3: new H3() };
markDefaultPluginProvided(nitro, "agent-chat");
markDefaultPluginProvided(nitro, "org");
const nativeApp = getH3App(nitro);
nativeApp.use("/_agent-native/auth/session", defineEventHandler(async event => {
  if (getMethod(event) !== "GET") {
    setResponseStatus(event, 405);
    return { error: "Method not allowed" };
  }
  return (await getSession(event)) ?? { error: "Unauthenticated" };
}));
nativeApp.use("/_agent-native/org/me", defineEventHandler(async event => {
  if (getMethod(event) !== "GET") {
    setResponseStatus(event, 405);
    return { error: "Method not allowed" };
  }
  return getMyOrgHandler(event);
}));
defaultOnboardingPlugin(nitro);
createAgentChatPlugin({
  model: inertEngine.name,
  appId: "workbench",
  actions: {},
  mcp: { enabled: false },
  durableBackgroundRuns: false,
  codeExecution: { production: "off" },
  frameworkTools: "minimal",
})(nitro);

let provider;
let providerIdentity;
let providerCloseCalls = 0;
const references = new Map();
const readinessEvidenceByProject = new Map();
const fixtureBudgets = new Map();
const seededRuns = {};
const controlledWrites = [];
const readWitnesses = [];
const controlLog = [];
const requestLog = [];
const attemptedRequestCounts = { asset: 0, nonAsset: 0 };
let requestOrdinal = 0;
let assetBytesServed = 0;
let activeWindow = "setup";
let bootstrapOpen = false;
let bootstrapCompletion = null;
let localizationWrites = 0;
let chatUrlWrites = 0;
let chatEngineLists = 0;
const localizationWritesByWindow = {};
const chatMutationsByWindow = {};
let serialNativeReads = Promise.resolve();
let heldAlpha = null;
let holdNextAlpha = false;
let activeAlphaReference = "original";
let measurementBaseline = null;
let registeredRootFacts = null;
let custodyEvidence = null;

const setRole = role => setAppMemberRole({
  appId: "workbench",
  orgId: identity.orgId,
  email: identity.email,
  role,
  updatedBy: identity.email,
});

async function tableSnapshot() {
  const listed = await getDbExec().execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    args: [],
  });
  const output = {};
  for (const row of listed.rows) {
    const name = String(row.name);
    assert.match(name, /^[A-Za-z_][A-Za-z0-9_]*$/);
    const columnsResult = await getDbExec().execute({ sql: `PRAGMA table_info(${name})`, args: [] });
    const columns = columnsResult.rows.map(item => String(item.name)).sort();
    const rowsResult = await getDbExec().execute({ sql: `SELECT * FROM ${name}`, args: [] });
    const rows = rowsResult.rows.map(item => Object.fromEntries(columns.map(column => [column, canonical(item[column])])))
      .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
    output[name] = { columns, rows };
  }
  return { schemaVersion: 1, tables: output };
}

function changedTables(before, after) {
  const names = [...new Set([...Object.keys(before.tables), ...Object.keys(after.tables)])].sort();
  return names.filter(name => canonicalJson(before.tables[name]) !== canonicalJson(after.tables[name]));
}

function immutableTablesDigest(snapshot) {
  const mutableApplicationKeys = new Set([SELECTION_KEY, "localization", "__url__"]);
  const tables = Object.fromEntries(Object.entries(snapshot.tables)
    .filter(([name]) => name !== "app_member_roles")
    .map(([name, table]) => {
      if (name !== "application_state") return [name, table];
      return [name, {
        ...table,
        rows: table.rows.filter(row => !mutableApplicationKeys.has(row.key)),
      }];
    }));
  return canonicalDigest({ schemaVersion: snapshot.schemaVersion, tables });
}

async function controlledWrite(label, allowedTables, operation, allowUnchanged = false) {
  const before = await tableSnapshot();
  const result = await operation();
  const after = await tableSnapshot();
  const changed = changedTables(before, after);
  if (allowUnchanged && changed.length === 0) {
    assert.ok(true);
  } else {
    assert.deepEqual(changed, [...allowedTables].sort());
  }
  controlledWrites.push({
    label,
    allowedTables: [...allowedTables].sort(),
    beforeSha256: canonicalDigest(before),
    afterSha256: canonicalDigest(after),
  });
  return result;
}
function assertExactRowScope(label, before, after, tableName, rowMatches, allowUnchanged = false) {
  const changed = changedTables(before, after);
  if (allowUnchanged && changed.length === 0) {
    assert.ok(true);
  } else {
    assert.deepEqual(changed, [tableName]);
  }
  assert.deepEqual(before.tables[tableName].columns, after.tables[tableName].columns);
  assert.deepEqual(before.tables[tableName].rows.filter(row => !rowMatches(row)),
    after.tables[tableName].rows.filter(row => !rowMatches(row)));
  const beforeRows = before.tables[tableName].rows.filter(rowMatches);
  const afterRows = after.tables[tableName].rows.filter(rowMatches);
  assert.ok(beforeRows.length <= 1);
  assert.ok(afterRows.length <= 1);
  controlledWrites.push({
    label,
    allowedTables: [tableName],
    actualChangedTables: changed,
    beforeSha256: canonicalDigest(before),
    afterSha256: canonicalDigest(after),
  });
  return { changed, beforeRows, afterRows };
}

function applicationStateRow(key) {
  return row => row.session_id === identity.email && row.key === key;
}

function roleRow(row) {
  return row.org_id === identity.orgId && row.app_id === "workbench"
    && String(row.email).toLowerCase() === identity.email.toLowerCase();
}

function digestIdentity(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function bindingIdentity(scope, project, binding, root) {
  return Object.freeze({
    ownerEmail: identity.email,
    orgId: identity.orgId,
    actorId: scope.actorId,
    collectionId: scope.collectionId,
    deviceId: scope.deviceId,
    projectId: project.projectId,
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    rootId: root.rootId,
    contentRevision: root.contentRevision,
    locationRef: binding.locationRef,
    policyRevision: scope.policyRevision,
    harnessName: runtimeIdentity.harnessName,
    runtimeVersion: runtimeIdentity.runtimeVersion,
    executionLocation: runtimeIdentity.executionLocation,
    authorityContract: runtimeIdentity.authorityContract,
    runtimeConfigurationRevision: runtimeIdentity.configurationRevision,
  });
}

async function storedBudget(runId) {
  const result = await getDbExec().execute({
    sql: "SELECT event_data FROM agent_run_events WHERE run_id = ? ORDER BY seq",
    args: [runId],
  });
  return Object.freeze({
    eventCount: result.rows.length,
    encodedBytes: result.rows.reduce((sum, row) =>
      sum + Buffer.byteLength(String(row.event_data), "utf8"), 0),
  });
}

const nativeRetentionMs = 5 * 60 * 1000;
const originalSetTimeoutDescriptor = Object.getOwnPropertyDescriptor(globalThis, "setTimeout");
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const ownedNativeTimers = new Map();
let trackedRunId = null;
Object.defineProperty(globalThis, "setTimeout", {
  ...originalSetTimeoutDescriptor,
  value(callback, delay, ...args) {
    const handle = Reflect.apply(originalSetTimeout, globalThis, [callback, delay, ...args]);
    if (trackedRunId && delay === nativeRetentionMs) ownedNativeTimers.set(handle, trackedRunId);
    return handle;
  },
});
function clearOwnedTimers(runId) {
  let count = 0;
  for (const [handle, owner] of ownedNativeTimers) {
    if (owner !== runId) continue;
    Reflect.apply(originalClearTimeout, globalThis, [handle]);
    ownedNativeTimers.delete(handle);
    count += 1;
  }
  return count;
}

async function seedNativeRun(binding, events, suffix, revision) {
  const threadId = `thread_${suffix}`;
  const sessionId = `session_${suffix}`;
  const runId = `run_${suffix}`;
  await createThread(identity.email, {
    id: threadId,
    title: `C5 ${suffix}`,
    scope: { type: "vivary-project-runtime-v1", id: digestIdentity(binding) },
    orgId: identity.orgId,
  });
  const adapter = Object.freeze({
    name: runtimeIdentity.harnessName,
    label: "C5 browser Native seeder",
    description: "Deterministic premeasurement Native activity.",
    capabilities: { sandbox: true, resumable: true, approvals: true, hostTools: true, fileEvents: true },
    createSession: async () => {
      harnessCreates += 1;
      return {
        id: `provider_${suffix}`,
        streamTurn: async function* () {
          harnessTurns += 1;
          for (const event of events) yield structuredClone(event);
        },
        detach: async () => {
          harnessDetaches += 1;
          return { fixture: suffix };
        },
        stop: async () => undefined,
      };
    },
  });
  trackedRunId = runId;
  let started;
  try {
    started = startAgentHarnessRun({
      runId,
      threadId,
      adapter,
      input: { prompt: "fixture only" },
      createSession: { sessionId },
      ownerEmail: identity.email,
      orgId: identity.orgId,
      detachOnComplete: true,
      runOptions: { recoverChunkBoundaries: false, useHostedSoftTimeoutDefault: false },
    });
    assert.ok(started.finalized instanceof Promise);
    await started.finalized;
  } finally {
    trackedRunId = null;
    if (started) assert.equal(clearOwnedTimers(runId), 1);
  }
  const reference = Object.freeze({
    schemaVersion: 1,
    referenceRevision: revision,
    bindingIdentityDigest: digestIdentity(binding),
    nativeThreadId: threadId,
    nativeSessionId: sessionId,
    nativeRunId: runId,
    harnessName: runtimeIdentity.harnessName,
  });
  fixtureBudgets.set(runId, await storedBudget(runId));
  return Object.freeze({ reference, threadId, sessionId, runId });
}

async function initialize() {
  await withMigrationRuntime(async () => {
    await runMigrations(ORG_MIGRATIONS, { table: "c5_browser_org_migrations" })();
    await migrateRegistry();
    await ensureAgentHarnessSessionTables();
    await addSession(identity.token, identity.email);
  });
  await getDb().insert(organizations).values({
    id: identity.orgId,
    name: "C5 browser fixture",
    createdBy: identity.email,
    createdAt: Date.now(),
  });
  await getDb().insert(orgMembers).values({
    id: "c5-browser-member",
    orgId: identity.orgId,
    email: identity.email,
    role: "owner",
    joinedAt: Date.now(),
  });
  await setRole("project-registrar");

  const providerBefore = await rootProviderProcesses();
  assert.deepEqual(providerBefore, []);
  provider = await startRootProvider({
    python: await realpath("/usr/bin/python3"),
    entryFile: await realpath(path.join(source, "packages/core/vivary_core/root_provider_stdio.py")),
    config: {
      deviceId: "c5-browser-device",
      scope: rootsRoot,
      statePath: providerStatePath,
      locations,
    },
    parseStrictJson,
  });
  const providerAfter = await rootProviderProcesses();
  assert.equal(providerAfter.length, 1);
  providerIdentity = providerAfter[0];

  const registry = createNativeRegistry({
    provider,
    grant,
    evaluate: evaluateRegistryOperation,
  });
  const auth = createNativeRegistryAuth();
  mountRegistryHttp(nitro, {
    registration: registry.registration,
    parseStrictJson,
    ...auth,
  });
  const catalog = createProjectCatalog({
    readScope: registry.readScope,
    provider,
    locationLabels: { alpha: "Alpha folder", beta: "Beta folder" },
  });
  mountProjectCatalog(nitro, { catalog, auth });

  const readiness = createProjectRuntimeReadiness({
    readScope: registry.readScope,
    provider,
    runtime: {
      ...runtimeIdentity,
      resolveEvidence: async request => {
        const expected = readinessEvidenceByProject.get(request.projectId);
        assert.ok(expected);
        assert.deepEqual(request, expected);
        return {
          evidenceKey: expected.evidenceKey,
          authenticated: "available",
          authorized: "available",
          runnable: "available",
          verified: "available",
        };
      },
    },
  });
  mountProjectRuntimeReadiness(nitro, { readiness, auth });

  const activity = createProjectRuntimeActivity({
    readScope: registry.readScope,
    provider,
    runtime: {
      ...runtimeIdentity,
      resolveReference: async binding => {
        const key = digestIdentity(binding);
        const selected = references.get(key);
        return selected ? structuredClone(selected) : undefined;
      },
      verifyFixtureBudget: async request => structuredClone(fixtureBudgets.get(request.nativeRunId)),
    },
  });
  mountProjectRuntimeActivity(nitro, { activity, auth });
  await awaitBootstrap(nitro);

  async function registerProject(locationRef, displayName, expectedRegistryRevision, operationId) {
    const response = await nitro.h3.fetch(new Request(
      "http://127.0.0.1/_agent-native/actions/vivary-register-project",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${identity.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          locationRef,
          displayName,
          operationId,
          expectedPolicyRevision: grant.policyRevision,
          expectedRegistryRevision,
          contentIdentity: null,
          attachProjectId: null,
        }),
      },
    ));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.code, "registered");
    return body;
  }
  const alphaRegistration = await registerProject("alpha", "Alpha", 0, "c5-register-alpha");
  const betaRegistration = await registerProject("beta", "Beta", 1, "c5-register-beta");
  const scope = await registry.readScope(context);
  assert.ok(scope);
  const scopeKey = digestIdentity(scope);
  const bindingRows = await getDb().select().from(tables.bindings);
  const projectRows = await getDb().select().from(tables.projects);
  const byId = new Map(projectRows.map(row => [row.projectId, row]));
  const alphaBinding = bindingRows.find(row => row.projectId === alphaRegistration.projectId);
  const betaBinding = bindingRows.find(row => row.projectId === betaRegistration.projectId);
  assert.ok(alphaBinding && betaBinding);
  const alphaRoot = await provider.inspect("alpha");
  const betaRoot = await provider.inspect("beta");
  assert.equal(alphaRoot.code, "available");
  assert.equal(betaRoot.code, "available");
  registeredRootFacts = Object.freeze({
    alpha: Object.freeze({ rootId: alphaRoot.rootId, contentRevision: alphaRoot.contentRevision }),
    beta: Object.freeze({ rootId: betaRoot.rootId, contentRevision: betaRoot.contentRevision }),
  });
  const alphaIdentity = bindingIdentity(scope, byId.get(alphaBinding.projectId), alphaBinding, alphaRoot);
  const betaIdentity = bindingIdentity(scope, byId.get(betaBinding.projectId), betaBinding, betaRoot);
  for (const binding of [alphaIdentity, betaIdentity]) {
    const evidenceKey = digestIdentity({
      version: 1,
      runtime: {
        harnessName: runtimeIdentity.harnessName,
        runtimeVersion: runtimeIdentity.runtimeVersion,
        executionLocation: runtimeIdentity.executionLocation,
        configurationRevision: runtimeIdentity.configurationRevision,
        authorityContract: runtimeIdentity.authorityContract,
      },
      scope: {
        actorId: binding.actorId,
        collectionId: binding.collectionId,
        deviceId: binding.deviceId,
        policyRevision: binding.policyRevision,
      },
      projectId: binding.projectId,
      bindingRevision: binding.bindingRevision,
      rootId: binding.rootId,
      contentRevision: binding.contentRevision,
    });
    readinessEvidenceByProject.set(binding.projectId, Object.freeze({
      evidenceKey,
      actorId: binding.actorId,
      collectionId: binding.collectionId,
      deviceId: binding.deviceId,
      projectId: binding.projectId,
      rootId: binding.rootId,
      contentRevision: binding.contentRevision,
      bindingRevision: binding.bindingRevision,
      policyRevision: binding.policyRevision,
      harnessName: runtimeIdentity.harnessName,
      runtimeVersion: runtimeIdentity.runtimeVersion,
      executionLocation: runtimeIdentity.executionLocation,
      configurationRevision: runtimeIdentity.configurationRevision,
      authorityContract: runtimeIdentity.authorityContract,
    }));
  }
  assert.equal(readinessEvidenceByProject.size, 2);
  const original = await seedNativeRun(alphaIdentity, [
    { type: "text-delta", text: "C5 Alpha original activity" },
    { type: "tool-start", id: "tool-alpha-original", name: "read_file", input: { path: "proof.txt" } },
    { type: "tool-done", id: "tool-alpha-original", name: "read_file",
      input: { path: "proof.txt" }, result: "C5 Alpha original tool result" },
    { type: "done", reason: "complete" },
  ], "alpha_original", 1);
  const replacement = await seedNativeRun(alphaIdentity, [
    { type: "text-delta", text: "C5 Alpha replacement activity" },
    { type: "tool-start", id: "tool-alpha-replacement", name: "read_file", input: { path: "proof.txt" } },
    { type: "tool-done", id: "tool-alpha-replacement", name: "read_file",
      input: { path: "proof.txt" }, result: "C5 Alpha replacement tool result" },
    { type: "done", reason: "complete" },
  ], "alpha_replacement", 2);
  Object.assign(seededRuns, { original, replacement });
  references.set(digestIdentity(alphaIdentity), original.reference);

  const chatScope = { type: "workspace-app", id: `vivary-workbench-chat-v1:${identity.orgId}`,
    label: "Vivary" };
  await createThread(identity.email, {
    id: "thread_c5_chat_baseline",
    title: "C5 chat boundary",
    scope: chatScope,
    orgId: identity.orgId,
  });

  const applicationStateBootstrap = await nitro.h3.fetch(new Request(
    `http://127.0.0.1/_agent-native/application-state?keys=${SELECTION_KEY}`,
    { headers: { cookie: `${COOKIE_NAME}=${identity.token}` } },
  ));
  assert.equal(applicationStateBootstrap.status, 200);
  assert.deepEqual(await applicationStateBootstrap.json(), {
    values: {},
    missing: [SELECTION_KEY],
  });
  const nativeTables = await tableSnapshot();
  measurementBaseline = {
    sha256: canonicalDigest(nativeTables),
    immutableTablesSha256: immutableTablesDigest(nativeTables),
    tables: nativeTables,
    counters: {
      harnessCreates,
      harnessTurns,
      harnessDetaches,
      chatModelCreates,
      chatModelCalls,
    },
  };
  return {
    alpha: {
      projectId: alphaRegistration.projectId,
      bindingRevision: alphaRegistration.bindingRevision,
    },
    beta: {
      projectId: betaRegistration.projectId,
      bindingRevision: betaRegistration.bindingRevision,
    },
    scopeKey,
    policyRevision: grant.policyRevision,
    registryRevision: 2,
    chatScope,
  };
}

function exactClaim(url) {
  const keys = [...url.searchParams.keys()].sort();
  const expected = ["expectedBindingRevision", "expectedPolicyRevision", "projectId", "scopeKey"];
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index])
    && expected.every(key => url.searchParams.getAll(key).length === 1);
}

function classifyRequest(url, method, body) {
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.protocol, "http:");
  const exactPath = `${url.pathname}${url.search}`;
  if (method === "GET" && trafficManifest.routeGets.includes(exactPath)) return "route";
  if (method === "GET" && trafficManifest.assetGets.includes(exactPath)) return "asset";
  if (method === "GET" && trafficManifest.shellGets.includes(exactPath)) return "shell";
  if (url.pathname === "/_agent-native/actions/vivary-project-catalog"
    && method === "GET" && url.search === "") return "catalog";
  if (["/_agent-native/actions/vivary-project-runtime-readiness",
    "/_agent-native/actions/vivary-project-runtime-activity"].includes(url.pathname)
    && method === "GET" && exactClaim(url)) return url.pathname.endsWith("readiness") ? "readiness" : "activity";
  if (url.pathname === "/_agent-native/application-state" && method === "GET") {
    assert.deepEqual([...url.searchParams.keys()], ["keys"]);
    const keys = url.searchParams.getAll("keys");
    assert.equal(keys.length, 1);
    const frozenSets = new Set(trafficManifest.shellGets
      .filter(value => value.startsWith("/_agent-native/application-state?keys="))
      .map(value => new URL(value, "http://127.0.0.1").searchParams.get("keys")));
    if (keys[0] === SELECTION_KEY) return "selection-read";
    assert.ok(frozenSets.has(keys[0]));
    return "shell";
  }
  if (url.pathname === "/_agent-native/application-state/localization" && method === "PUT") {
    if (!bootstrapOpen) return "blocked-mutation";
    assert.equal(url.search, "");
    assert.equal(localizationWrites, 0);
    assert.equal(body.toString("utf8"),
      JSON.stringify(expectedBootstrapMutations[0].body));
    return "localization-write";
  }
  if (url.pathname === "/_agent-native/application-state/__url__" && method === "PUT") {
    if (activeWindow !== "chat" || !bootstrapOpen) return "blocked-mutation";
    assert.equal(url.search, "");
    assert.equal(chatUrlWrites, 0);
    assert.equal(body.toString("utf8"), JSON.stringify(expectedChatMutations[0].body));
    return "chat-url-write";
  }
  if (url.pathname === "/_agent-native/actions/manage-agent-engine" && method === "POST") {
    if (activeWindow !== "chat" || !bootstrapOpen) return "blocked-mutation";
    assert.equal(url.search, "");
    assert.equal(chatEngineLists, 0);
    assert.equal(body.toString("utf8"), JSON.stringify(expectedChatMutations[1].body));
    return "chat-engine-list";
  }
  if (url.pathname === `/_agent-native/application-state/${SELECTION_KEY}` && method === "PUT") {
    if (bootstrapOpen || !["c5-root", "c5-workbench"].includes(activeWindow)) {
      return "blocked-mutation";
    }
    assert.equal(url.search, "");
    const value = JSON.parse(body.toString("utf8"));
    assert.ok(exactObject(value, ["scopeKey", "projectId"]));
    assert.equal(value.scopeKey, fixture.scopeKey);
    assert.ok([fixture.alpha.projectId, fixture.beta.projectId].includes(value.projectId));
    return "selection-write";
  }
  if (activeWindow === "chat" && method === "GET"
    && trafficManifest.chatGets.includes(exactPath)) return "chat";
  if (url.pathname.startsWith("/_agent-native/")
    && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) return "blocked-mutation";
  throw new Error(`request outside frozen traffic contract: ${method} ${exactPath}`);
}

async function readBoundedResponse(response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length <= MAX_RESPONSE_BODY_BYTES);
  return bytes;
}

async function serialNative(operation) {
  const next = serialNativeReads.then(operation, operation);
  serialNativeReads = next.then(() => undefined, () => undefined);
  return next;
}

async function routeRequest(url, method, headers, body, category) {
  const request = new Request(url, {
    method,
    headers,
    ...(!["GET", "HEAD"].includes(method) ? { body: body.length ? body : null } : {}),
  });
  if (category === "blocked-mutation") {
    const response = Response.json({ error: "Mutation blocked by the C5 browser proof boundary" },
      { status: 503 });
    return { response, bytes: await readBoundedResponse(response) };
  }
  if (url.pathname.startsWith("/assets/")) {
    const relative = `build/client${decodeURIComponent(url.pathname)}`;
    assert.match(relative, /^build\/client\/assets\/[A-Za-z0-9._/-]+$/);
    assert.ok(!relative.split("/").includes(".."));
    const target = path.join(app, ...relative.split("/"));
    assert.equal(await realpath(target), target);
    const bytes = await readFile(target);
    assert.ok(bytes.length <= MAX_RESPONSE_BODY_BYTES);
    assetBytesServed += bytes.length;
    assert.ok(assetBytesServed <= MAX_ASSET_BYTES);
    return {
      response: new Response(bytes, {
        headers: { "content-type": MIME[path.extname(target)] ?? "application/octet-stream" },
      }),
      bytes,
      asset: {
        relativePath: relative,
        sha256: sha256(bytes),
        bytes: bytes.length,
      },
    };
  }
  if (["catalog", "readiness", "activity", "selection-read", "selection-write",
    "localization-write", "chat-url-write", "chat-engine-list", "shell", "chat"].includes(category)) {
    const execute = async () => {
      const response = await nitro.h3.fetch(request);
      return { response, bytes: await readBoundedResponse(response) };
    };
    return execute();
  }
  const response = await render(request);
  return { response, bytes: await readBoundedResponse(response) };
}

async function handleRequest(message) {
  assert.equal(typeof message.url, "string");
  assert.ok(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(message.method));
  assert.ok(message.headers && typeof message.headers === "object" && !Array.isArray(message.headers));
  const body = message.body ? Buffer.from(message.body, "base64") : Buffer.alloc(0);
  assert.ok(body.length <= MAX_REQUEST_BODY_BYTES);
  const url = new URL(message.url);
  const requestWindow = activeWindow;
  const category = classifyRequest(url, message.method, body);
  if (category === "localization-write") {
    assert.equal(message.headers["content-type"], "application/json");
    assert.equal(message.headers["x-request-source"], "localization");
    localizationWrites += 1;
    localizationWritesByWindow[requestWindow] = (localizationWritesByWindow[requestWindow] ?? 0) + 1;
  }
  if (category === "chat-url-write") {
    assert.equal(message.headers["content-type"], "application/json");
    assert.equal(message.headers["x-request-source"], undefined);
    chatUrlWrites += 1;
  }
  if (category === "chat-engine-list") {
    assert.equal(message.headers["content-type"], "application/json");
    chatEngineLists += 1;
  }
  const allowed = requestWindow === "chat"
    ? new Set(["route", "asset", "shell", "catalog", "selection-read", "chat",
      "localization-write", "chat-url-write", "chat-engine-list", "blocked-mutation"])
    : new Set(["route", "asset", "shell", "catalog", "readiness", "activity",
      "selection-read", "selection-write", "localization-write", "blocked-mutation"]);
  assert.ok(allowed.has(category), `${category} is not allowed in ${requestWindow}`);
  attemptedRequestCounts[category === "asset" ? "asset" : "nonAsset"] += 1;
  const ordinal = ++requestOrdinal;
  const exactMutationKeys = {
    "selection-write": SELECTION_KEY,
    "localization-write": "localization",
    "chat-url-write": "__url__",
  };
  const executeRouted = () => routeRequest(url, message.method, message.headers, body, category);
  let routed;
  if (Object.hasOwn(exactMutationKeys, category)) {
    routed = await serialNative(async () => {
      const before = await tableSnapshot();
      const response = await executeRouted();
      const after = await tableSnapshot();
      const rowScope = assertExactRowScope(`request-${ordinal}-${category}`, before, after,
        "application_state", applicationStateRow(exactMutationKeys[category]),
        category === "selection-write");
      assert.equal(rowScope.afterRows.length, 1);
      assert.deepEqual(JSON.parse(rowScope.afterRows[0].value), JSON.parse(body.toString("utf8")));
      assert.ok(Number.isSafeInteger(rowScope.afterRows[0].updated_at)
        && rowScope.afterRows[0].updated_at > 0);
      return response;
    });
  } else if (["chat-engine-list", "blocked-mutation"].includes(category)) {
    routed = await serialNative(async () => {
      const before = await tableSnapshot();
      const response = await executeRouted();
      const after = await tableSnapshot();
      assert.deepEqual(after, before);
      controlledWrites.push({
        label: `request-${ordinal}-${category}`,
        allowedTables: [],
        actualChangedTables: [],
        beforeSha256: canonicalDigest(before),
        afterSha256: canonicalDigest(after),
      });
      return response;
    });
  } else if (message.method === "GET" && category !== "asset") {
    routed = await serialNative(async () => {
      const before = await tableSnapshot();
      const response = await executeRouted();
      const after = await tableSnapshot();
      assert.deepEqual(after, before);
      readWitnesses.push({
        label: `request-${ordinal}-${category}`,
        tablesSha256: canonicalDigest(before),
      });
      return response;
    });
  } else {
    routed = await executeRouted();
  }
  const responseMeta = {
    ordinal,
    window: requestWindow,
    category,
    method: message.method,
    path: `${url.pathname}${url.search}`,
    requestBytes: body.length,
    requestSha256: body.length ? sha256(body) : null,
    responseStatus: routed.response.status,
    responseBytes: routed.bytes.length,
    responseSha256: sha256(routed.bytes),
    completedAt: Date.now(),
  };
  if (category === "activity" && holdNextAlpha
    && url.searchParams.get("projectId") === fixture.alpha.projectId) {
    const activityBody = JSON.parse(routed.bytes.toString("utf8"));
    const original = seededRuns.original.reference;
    assert.ok(exactObject(activityBody, ["code", "projectId", "scopeKey", "bindingRevision",
      "policyRevision", "referenceRevision", "nativeThreadId", "nativeScope", "nativeRunId", "items"]));
    assert.equal(activeAlphaReference, "original");
    assert.equal(activityBody.code, "activity");
    assert.equal(activityBody.projectId, fixture.alpha.projectId);
    assert.equal(activityBody.scopeKey, fixture.scopeKey);
    assert.equal(activityBody.bindingRevision, fixture.alpha.bindingRevision);
    assert.equal(activityBody.policyRevision, fixture.policyRevision);
    assert.equal(activityBody.referenceRevision, original.referenceRevision);
    assert.equal(activityBody.nativeThreadId, original.nativeThreadId);
    assert.equal(activityBody.nativeRunId, original.nativeRunId);
    assert.deepEqual(activityBody.nativeScope,
      { type: "vivary-project-runtime-v1", id: original.bindingIdentityDigest });
    responseMeta.activityIdentity = {
      code: activityBody.code,
      projectId: activityBody.projectId,
      scopeKey: activityBody.scopeKey,
      bindingRevision: activityBody.bindingRevision,
      policyRevision: activityBody.policyRevision,
      referenceRevision: activityBody.referenceRevision,
      nativeThreadId: activityBody.nativeThreadId,
      nativeRunId: activityBody.nativeRunId,
      nativeScope: activityBody.nativeScope,
    };
  }
  requestLog.push(responseMeta);
  if (bootstrapCompletion?.window === requestWindow
    && bootstrapCompletion.required.has(category)) {
    assert.equal(routed.response.status, 200);
    assert.equal(bootstrapCompletion.completed.has(category), false);
    bootstrapCompletion.completed.set(category, responseMeta);
  }
  if (category === "activity" && holdNextAlpha
    && url.searchParams.get("projectId") === fixture.alpha.projectId) {
    assert.equal(heldAlpha, null);
    holdNextAlpha = false;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    heldAlpha = { release, responseMeta };
    await gate;
    heldAlpha = null;
  }
  const responseHeaders = Object.fromEntries(routed.response.headers);
  if (category === "asset") {
    assert.ok(exactObject(routed.asset, ["relativePath", "sha256", "bytes"]));
    return {
      status: routed.response.status,
      headers: responseHeaders,
      asset: routed.asset,
    };
  }
  return {
    status: routed.response.status,
    headers: responseHeaders,
    body: routed.bytes.toString("base64"),
  };
}

let fixture;
async function resetRoute(label) {
  assert.match(label, /^(root|workbench)$/);
  {
    const beforeRole = await tableSnapshot();
    await setRole("project-registrar");
    const afterRole = await tableSnapshot();
    const roleScope = assertExactRowScope(`reset-${label}-role`, beforeRole, afterRole,
      "app_member_roles", roleRow, true);
    assert.equal(roleScope.afterRows.length, 1);
    assert.deepEqual({
      org_id: roleScope.afterRows[0].org_id,
      app_id: roleScope.afterRows[0].app_id,
      email: roleScope.afterRows[0].email,
      role: roleScope.afterRows[0].role,
      updated_by: roleScope.afterRows[0].updated_by,
    }, {
      org_id: identity.orgId,
      app_id: "workbench",
      email: identity.email,
      role: "project-registrar",
      updated_by: identity.email,
    });
    assert.ok(Number.isSafeInteger(roleScope.afterRows[0].updated_at)
      && roleScope.afterRows[0].updated_at > 0);
  }
  const before = await tableSnapshot();
  await getDbExec().execute({
    sql: "DELETE FROM application_state WHERE session_id = ? AND key = ?",
    args: [identity.email, SELECTION_KEY],
  });
  const after = await tableSnapshot();
  const selectionScope = assertExactRowScope(`reset-${label}-selection`, before, after,
    "application_state", applicationStateRow(SELECTION_KEY), true);
  assert.equal(selectionScope.afterRows.length, 0);
  references.clear();
  const bindingRows = await getDb().select().from(tables.bindings);
  const alphaBinding = bindingRows.find(row => row.projectId === fixture.alpha.projectId);
  const scope = await createNativeScope();
  const alphaRoot = await provider.inspect("alpha");
  const projectRows = await getDb().select().from(tables.projects);
  const alphaProject = projectRows.find(row => row.projectId === fixture.alpha.projectId);
  const key = digestIdentity(bindingIdentity(scope, alphaProject, alphaBinding, alphaRoot));
  references.set(key, seededRuns.original.reference);
  activeAlphaReference = "original";
  holdNextAlpha = false;
  assert.equal(heldAlpha, null);
  controlLog.push({ action: "reset-route", label });
  return { ok: true };
}

let registryRuntime;
async function createNativeScope() {
  const scope = await registryRuntime.readScope(context);
  assert.ok(scope);
  return scope;
}

async function handle(message) {
  assert.ok(message && typeof message === "object" && !Array.isArray(message));
  assert.ok(Number.isSafeInteger(message.id) && message.id > 0);
  if (message.action === "request") {
    assert.ok(exactObject(message, ["id", "action", "url", "method", "headers", "body"]));
    return handleRequest(message);
  }
  if (message.action === "identities") {
    assert.ok(exactObject(message, ["id", "action"]));
    return {
      identity,
      cookieName: COOKIE_NAME,
      fixture,
      providerIdentity,
      seededRuns,
      setupCounters: measurementBaseline.counters,
    };
  }
  if (message.action === "window") {
    assert.ok(exactObject(message, ["id", "action", "name"]));
    assert.match(message.name, /^(c5-root|c5-workbench|chat)$/);
    assert.equal(bootstrapOpen, false);
    activeWindow = message.name;
    bootstrapOpen = true;
    localizationWrites = 0;
    chatUrlWrites = 0;
    chatEngineLists = 0;
    bootstrapCompletion = {
      window: message.name,
      required: new Set(message.name === "chat"
        ? ["localization-write", "chat-url-write", "chat-engine-list"]
        : ["localization-write"]),
      completed: new Map(),
    };
    controlLog.push({ action: "window", name: message.name });
    return { ok: true };
  }
  if (message.action === "bootstrap-complete") {
    assert.ok(exactObject(message, ["id", "action"]));
    assert.equal(bootstrapOpen, true);
    assert.equal(bootstrapCompletion?.window, activeWindow);
    for (let attempt = 0; attempt < 200
      && bootstrapCompletion.completed.size !== bootstrapCompletion.required.size; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(localizationWrites, 1);
    assert.deepEqual([...bootstrapCompletion.completed.keys()].sort(),
      [...bootstrapCompletion.required].sort());
    if (activeWindow === "chat") {
      assert.equal(chatUrlWrites, 1);
      assert.equal(chatEngineLists, 1);
      chatMutationsByWindow.chat = { chatUrlWrites, chatEngineLists };
    } else {
      assert.equal(chatUrlWrites, 0);
      assert.equal(chatEngineLists, 0);
    }
    const completed = Object.fromEntries(bootstrapCompletion.completed);
    bootstrapOpen = false;
    bootstrapCompletion = null;
    controlLog.push({ action: "bootstrap-complete", window: activeWindow,
      localizationWrites, chatUrlWrites, chatEngineLists, completed });
    return { ok: true, localizationWrites, chatUrlWrites, chatEngineLists, completed };
  }
  if (message.action === "reset-route") {
    assert.ok(exactObject(message, ["id", "action", "label"]));
    return resetRoute(message.label);
  }
  if (message.action === "hold-alpha") {
    assert.ok(exactObject(message, ["id", "action"]));
    assert.equal(holdNextAlpha, false);
    assert.equal(heldAlpha, null);
    holdNextAlpha = true;
    controlLog.push({ action: "hold-alpha" });
    return { ok: true };
  }
  if (message.action === "hold-status") {
    assert.ok(exactObject(message, ["id", "action"]));
    return { held: heldAlpha !== null, armed: holdNextAlpha };
  }
  if (message.action === "release-alpha") {
    assert.ok(exactObject(message, ["id", "action"]));
    assert.ok(heldAlpha);
    const metadata = heldAlpha.responseMeta;
    heldAlpha.release();
    controlLog.push({ action: "release-alpha", response: metadata });
    return { ok: true, completedResponse: metadata };
  }
  if (message.action === "cancel-hold") {
    assert.ok(exactObject(message, ["id", "action"]));
    const metadata = heldAlpha?.responseMeta ?? null;
    heldAlpha?.release();
    heldAlpha = null;
    holdNextAlpha = false;
    controlLog.push({ action: "cancel-hold", response: metadata });
    return { ok: true, completedResponse: metadata };
  }
  if (message.action === "replace-reference") {
    assert.ok(exactObject(message, ["id", "action"]));
    const scope = await createNativeScope();
    const bindingRows = await getDb().select().from(tables.bindings);
    const projectRows = await getDb().select().from(tables.projects);
    const binding = bindingRows.find(row => row.projectId === fixture.alpha.projectId);
    const project = projectRows.find(row => row.projectId === fixture.alpha.projectId);
    const root = await provider.inspect("alpha");
    references.set(digestIdentity(bindingIdentity(scope, project, binding, root)), seededRuns.replacement.reference);
    activeAlphaReference = "replacement";
    controlLog.push({ action: "replace-reference", referenceRevision: 2 });
    return { ok: true, referenceRevision: 2 };
  }
  if (message.action === "revoke-role") {
    assert.ok(exactObject(message, ["id", "action"]));
    const beforeRole = await tableSnapshot();
    await setRole(null);
    const afterRole = await tableSnapshot();
    const roleScope = assertExactRowScope("revoke-role", beforeRole, afterRole,
      "app_member_roles", roleRow);
    assert.equal(roleScope.beforeRows.length, 1);
    assert.equal(roleScope.beforeRows[0].role, "project-registrar");
    assert.equal(roleScope.afterRows.length, 0);
    controlLog.push({ action: "revoke-role" });
    return { ok: true };
  }
  if (message.action === "drain") {
    assert.ok(exactObject(message, ["id", "action"]));
    await serialNativeReads;
    assert.equal(heldAlpha, null);
    assert.equal(holdNextAlpha, false);
    return { drained: true, pendingRequests: pending.size - 1 };
  }
  if (message.action === "snapshot") {
    assert.ok(exactObject(message, ["id", "action", "label"]));
    const tablesNow = await tableSnapshot();
    return {
      snapshot: {
        schema: "vivary.06e-c5-browser-snapshot/v1",
        label: message.label,
        tablesSha256: canonicalDigest(tablesNow),
        immutableTablesSha256: immutableTablesDigest(tablesNow),
        tables: tablesNow,
        baselineSha256: measurementBaseline.sha256,
        baselineImmutableTablesSha256: measurementBaseline.immutableTablesSha256,
        counters: {
          harnessCreates,
          harnessTurns,
          harnessDetaches,
          chatModelCreates,
          chatModelCalls,
        },
        reference: activeAlphaReference,
        requests: requestLog,
        controls: controlLog,
        controlledWrites,
        readWitnesses,
        requestFailures,
        timeoutFailures,
        requestFailureOverflow,
        bootstrap: { open: bootstrapOpen, localizationWrites, chatUrlWrites, chatEngineLists,
          localizationWritesByWindow, chatMutationsByWindow },
        provider: {
          readiness: provider.readiness(),
          identity: providerIdentity,
          live: await rootProviderProcesses(),
        },
      },
    };
  }
  throw new Error("unsupported C5 proof action");
}

let writeQueue = Promise.resolve();
function encodeReply(id, value) {
  const bytes = Buffer.from(`${JSON.stringify({ id, ...value })}\n`);
  assert.ok(bytes.length <= MAX_FRAME_BYTES);
  writeQueue = writeQueue.then(() => new Promise((resolve, reject) => {
    process.stdout.write(bytes, error => error ? reject(error) : resolve());
  }));
  return writeQueue;
}

async function* readFrames(stream) {
  let buffered = Buffer.alloc(0);
  for await (const chunk of stream) {
    assert.ok(buffered.length + chunk.length <= MAX_FRAME_BYTES * 2);
    buffered = Buffer.concat([buffered, chunk]);
    while (true) {
      const newline = buffered.indexOf(10);
      if (newline < 0) break;
      const line = buffered.subarray(0, newline);
      buffered = buffered.subarray(newline + 1);
      if (line.length) yield line;
    }
  }
  assert.equal(buffered.length, 0);
}

const pending = new Map();
let accepting = true;
let closeRequested = false;
let terminalError = null;
let shutdown = null;
const MAX_RETAINED_REQUEST_FAILURES = 32;
const requestFailures = [];
const timeoutFailures = [];
let requestFailureOverflow = 0;

function failedRequestIdentity(message) {
  const identity = {
    id: message.id,
    action: typeof message.action === "string" ? message.action.slice(0, 128) : null,
  };
  if (typeof message.method === "string") identity.method = message.method.slice(0, 16);
  if (typeof message.url === "string") {
    try {
      const url = new URL(message.url);
      identity.path = `${url.pathname}${url.search}`.slice(0, 2048);
    } catch {
      identity.path = "invalid-url";
    }
  }
  if (typeof message.name === "string") identity.name = message.name.slice(0, 128);
  if (typeof message.label === "string") identity.label = message.label.slice(0, 128);
  return identity;
}

function retainRequestFailure(list, kind, message, error) {
  const entry = {
    ordinal: requestFailures.length + timeoutFailures.length + requestFailureOverflow + 1,
    kind,
    request: failedRequestIdentity(message),
    error: boundedError(error),
  };
  if (list.length < MAX_RETAINED_REQUEST_FAILURES) list.push(entry);
  else requestFailureOverflow += 1;
}

function schedule(message) {
  assert.equal(accepting, true);
  assert.ok(pending.size < MAX_PENDING_REQUESTS);
  assert.ok(!pending.has(message.id));
  const operation = Promise.resolve().then(() => handle(message));
  let timer;
  const timeoutError = new Error("C5 backend request deadline exceeded");
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), REQUEST_DEADLINE_MS);
  });
  const task = (async () => {
    let racedError = null;
    try {
      const result = await Promise.race([operation, deadline]);
      await encodeReply(message.id, result);
    } catch (error) {
      racedError = error;
      retainRequestFailure(error === timeoutError ? timeoutFailures : requestFailures,
        error === timeoutError ? "timeout" : "handler", message, error);
      await encodeReply(message.id, { error: boundedError(error) });
    } finally {
      clearTimeout(timer);
      const settled = await operation.then(
        () => ({ ok: true }),
        error => ({ ok: false, error }),
      );
      if (!settled.ok && settled.error !== racedError) {
        retainRequestFailure(requestFailures, "handler-after-timeout", message, settled.error);
      }
      pending.delete(message.id);
    }
  })();
  pending.set(message.id, { operation, task });
}

async function settlePending() {
  const tasks = [...pending.values()].map(value => value.task);
  if (tasks.length) await Promise.allSettled(tasks);
  await serialNativeReads;
}

async function closeBackend() {
  accepting = false;
  assert.equal(heldAlpha, null);
  assert.equal(holdNextAlpha, false);
  assert.equal(bootstrapOpen, false);
  assert.equal(bootstrapCompletion, null);
  assert.deepEqual(localizationWritesByWindow, {
    "c5-root": 1,
    "c5-workbench": 1,
    chat: 1,
  });
  assert.deepEqual(chatMutationsByWindow, {
    chat: { chatUrlWrites: 1, chatEngineLists: 1 },
  });
  await settlePending();
  assert.deepEqual(requestFailures, []);
  assert.deepEqual(timeoutFailures, []);
  assert.equal(requestFailureOverflow, 0);
  const beforeClose = await tableSnapshot();
  const counters = {
    harnessCreates,
    harnessTurns,
    harnessDetaches,
    chatModelCreates,
    chatModelCalls,
  };
  assert.deepEqual(counters, measurementBaseline.counters);
  const beforeProviderClose = await rootProviderProcesses();
  assert.deepEqual(beforeProviderClose, [providerIdentity]);
  providerCloseCalls += 1;
  await provider.close();
  assert.equal(providerCloseCalls, 1);
  assert.deepEqual(provider.readiness(), { status: "unavailable" });
  assert.deepEqual(await provider.inspect("alpha"), { code: "identity-unverified" });
  assert.deepEqual(await rootProviderProcesses(), []);
  const afterProviderClose = await tableSnapshot();
  assert.deepEqual(afterProviderClose, beforeClose);
  const retainedPreCloseSnapshotSha256 = canonicalDigest(afterProviderClose);
  custodyEvidence = {
    filesystem: custodyFilesystem,
    custodyRoot: await localPathFacts(custodyRoot, "directory"),
    rootsRoot: await localPathFacts(rootsRoot, "directory"),
    privateRoot: await localPathFacts(privateRoot, "directory"),
    state: {
      ...await localPathFacts(providerStatePath, "file"),
      ...await digestFile(providerStatePath),
    },
    roots: Object.fromEntries(await Promise.all(Object.entries(locations).map(async ([name, root]) => {
      const proof = path.join(root, "proof.txt");
      return [name, {
        ...await localPathFacts(root, "directory"),
        observed: registeredRootFacts[name],
        proof: {
          ...await localPathFacts(proof, "file"),
          ...await digestFile(proof),
        },
      }];
    }))),
  };

  await removeSession(identity.token);
  const activeResourcesBeforeAuditStop = activeResourceCounts();
  stopAuditCleanupJob();
  await closeDbExec();
  const channel = capturedSsrChannels[0];
  const closeEvents = [];
  channel.channel.port1.addEventListener("close", () => closeEvents.push("port1"), { once: true });
  channel.channel.port2.addEventListener("close", () => closeEvents.push("port2"), { once: true });
  channel.channel.port1.close();
  channel.channel.port2.close();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(closeEvents.sort(), ["port1", "port2"]);
  shutdown = {
    stage: "backend-finalized",
    providerStopMode: "public-close-sigkill",
    providerCloseCalls,
    providerIdentity,
    providerAbsent: true,
    auditCleanupStopped: true,
    databaseClosed: true,
    ssrChannel: {
      bundleSha256: ssrBundleIdentity.sha256,
      stackSha256: channel.stackSha256,
      captured: 1,
      portsClosed: 2,
      closeEvents: 2,
      globalDescriptorRestored: true,
    },
    retainedPreCloseSnapshotSha256,
    activeResourcesBeforeAuditStop,
    activeResourcesAfterClose: activeResourceCounts(),
  };
}

try {
  fixture = await initialize();
  registryRuntime = createNativeRegistry({
    provider,
    grant,
    evaluate: evaluateRegistryOperation,
  });
  await encodeReply(0, {
    ready: true,
    boundary,
    fixture,
    providerIdentity,
    setupCounters: measurementBaseline.counters,
  });
  for await (const line of readFrames(process.stdin)) {
    const message = JSON.parse(line.toString("utf8"));
    if (message.action === "close") {
      assert.ok(exactObject(message, ["id", "action"]));
      closeRequested = true;
      process.stdin.pause();
      await closeBackend();
      await encodeReply(message.id, {
        closing: true,
        shutdown,
        finalSnapshotSha256: shutdown.retainedPreCloseSnapshotSha256,
      });
      continue;
    }
    schedule(message);
  }
  assert.equal(closeRequested, true);
  shutdown.stdinEofConsumed = true;
} catch (error) {
  terminalError = boundedError(error);
  process.exitCode = 1;
  throw error;
} finally {
  Object.defineProperty(globalThis, "setTimeout", originalSetTimeoutDescriptor);
  for (const handle of ownedNativeTimers.keys()) Reflect.apply(originalClearTimeout, globalThis, [handle]);
  const ephemeralSecretWasPresent = typeof process.env.BETTER_AUTH_SECRET === "string";
  delete process.env.BETTER_AUTH_SECRET;
  assert.equal(process.env.BETTER_AUTH_SECRET, undefined);
  const final = {
    schema: "vivary.06e-c5-browser-backend-final/v1",
    closeRequested,
    terminalError,
    shutdown,
    requestLog,
    controlLog,
    controlledWrites,
    readWitnesses,
    requestFailures,
    timeoutFailures,
    requestFailureOverflow,
    attemptedRequestCounts: {
      ...attemptedRequestCounts,
      total: attemptedRequestCounts.asset + attemptedRequestCounts.nonAsset,
    },
    counters: {
      harnessCreates,
      harnessTurns,
      harnessDetaches,
      chatModelCreates,
      chatModelCalls,
    },
    setupCounters: measurementBaseline?.counters ?? null,
    readinessEvidence: {
      source: readinessSourceIdentity,
      projects: Object.fromEntries([...readinessEvidenceByProject.entries()]
        .sort(([left], [right]) => left.localeCompare(right))),
    },
    custodyStorage: {
      configuredPaths: { custodyRoot, rootsRoot, privateRoot, providerStatePath, locations },
      filesystem: custodyFilesystem,
      evidence: custodyEvidence,
    },
    ephemeralAuthConfiguration: {
      ...ephemeralAuthConfiguration,
      presentUntilFinalization: ephemeralSecretWasPresent,
      cleared: true,
    },
    stderrBytes,
  };
  await writeFile(path.join(evidenceRoot, "backend-final.json"),
    JSON.stringify(final, null, 2) + "\n", { flag: "wx", mode: 0o600 }).catch(() => undefined);
}
