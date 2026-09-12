import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readlink, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "node:util";

const MAX_FRAME_BYTES = 12 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 256 * 1024;
const MAX_RESPONSE_BODY_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_BYTES = 128 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const MAX_TABLES = 160;
const MAX_ROWS_PER_TABLE = 512;
const MAX_DATABASE_BYTES = 8 * 1024 * 1024;
const MAX_NON_ASSET_REQUESTS = 1_024;
const MAX_ASSET_REQUESTS = 4_096;
const MAX_PENDING_REQUESTS = 16;
const REQUEST_DEADLINE_MILLISECONDS = 15_000;
const SSR_BUNDLE_SHA256 = "8c9a139b8c88dfbd577ccceb1451a35aae469c92710e6c1c208154f86e3a91a6";

function activeResourceCounts() {
  const resources = process.getActiveResourcesInfo();
  assert.ok(resources.length <= 256, "active resource diagnostic exceeded");
  const counts = {};
  for (const resource of resources) {
    assert.match(resource, /^[A-Za-z][A-Za-z0-9_]{0,127}$/);
    counts[resource] = (counts[resource] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}
function orgChatScope(orgId) {
  assert.match(orgId, /^[A-Za-z0-9_-]{1,128}$/);
  return { type: "workspace-app", id: `vivary-workbench-chat-v1:${orgId}`, label: "Vivary" };
}

const [appInput, evidenceInput, profileInput, expectedProfileSha256, expectedNodeSha256, expectedNodeBytes] =
  process.argv.slice(2);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function boundedError(error) {
  return {
    type: error?.constructor?.name ?? "Error",
    message: String(error?.message ?? error).slice(0, 4096),
  };
}

function canonical(value) {
  if (typeof value === "bigint") return { $bigint: String(value) };
  if (value instanceof Uint8Array) {
    return { $bytes: Buffer.from(value).toString("hex") };
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function exactObject(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function assertSyntheticEmail(value) {
  assert.match(value, /^[a-z0-9-]+@example\.test$/);
  return value;
}

assert.equal(process.platform, "linux");
assert.equal(process.getuid?.(), 1000);
assert.equal(process.getgid?.(), 1000);
assert.match(expectedProfileSha256 ?? "", /^[0-9a-f]{64}$/);
assert.match(expectedNodeSha256 ?? "", /^[0-9a-f]{64}$/);
assert.ok(Number.isSafeInteger(Number(expectedNodeBytes)) && Number(expectedNodeBytes) > 0);
assert.equal(process.env.AGENT_MODE, "production");
assert.equal(process.env.AGENT_NATIVE_DISABLE_RECURRING_JOBS, "true");
assert.equal(process.env.AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS, "true");
assert.equal(process.env.AGENT_ENGINE, "vivary-proof");
assert.equal(process.env.NODE_ENV, "production");
assert.ok(process.env.DATABASE_URL?.startsWith("file:"));
for (const name of Object.keys(process.env)) {
  assert.ok(
    !/(TOKEN|SECRET|PASSWORD|API_KEY|ANTHROPIC|OPENAI|CLAUDE|GEMINI|PROXY)/i.test(name),
    `credential or proxy environment refused: ${name}`,
  );
}

const app = await realpath(appInput);
const evidenceRoot = await realpath(evidenceInput);
assert.equal(app, appInput);
assert.equal(evidenceRoot, evidenceInput);
const databasePath = path.join(evidenceRoot, "native-chat.sqlite");
assert.equal(process.env.DATABASE_URL, `file:${databasePath}`);
await assert.rejects(lstat(databasePath), error => error?.code === "ENOENT");
let executableBytes = 0;
const executableDigest = createHash("sha256");
for await (const chunk of createReadStream(process.execPath, { highWaterMark: 1024 * 1024 })) {
  executableBytes += chunk.length;
  assert.ok(executableBytes <= Number(expectedNodeBytes));
  executableDigest.update(chunk);
}
assert.equal(executableBytes, Number(expectedNodeBytes));
assert.equal(executableDigest.digest("hex"), expectedNodeSha256);

assert.ok(path.isAbsolute(profileInput));
assert.equal(await realpath(profileInput), profileInput);
const profileInfo = await lstat(profileInput);
assert.ok(profileInfo.isFile() && profileInfo.nlink === 1 && profileInfo.size > 0 && profileInfo.size <= 64 * 1024);
const profileBytes = await readFile(profileInput);
const profileSha256 = sha256(profileBytes);
assert.equal(profileSha256, expectedProfileSha256);
const profile = JSON.parse(profileBytes);
assert.ok(exactObject(profile, ["schema", "candidateHead", "sourceBindingSha256", "sandbox", "supervision"]));
assert.equal(profile.schema, "vivary.05b-zo-profile/v1");
assert.match(profile.candidateHead, /^[0-9a-f]{40}$/);
assert.match(profile.sourceBindingSha256, /^[0-9a-f]{64}$/);
assert.ok(exactObject(profile.sandbox, ["uid", "gid", "pidNamespace", "network", "filesystem", "capabilities", "noNewPrivileges"]));
assert.equal(profile.sandbox.uid, 1000);
assert.equal(profile.sandbox.gid, 1000);
assert.equal(profile.sandbox.pidNamespace, true);
assert.equal(profile.sandbox.network, "loopback-only");
assert.equal(profile.sandbox.filesystem, "private-ro-source");
assert.equal(profile.sandbox.capabilities, "none");
assert.equal(profile.sandbox.noNewPrivileges, true);
assert.ok(exactObject(profile.supervision, ["kind", "enforcement", "memoryStopBytes", "processStopCount", "sampleMilliseconds", "cpuCount", "swapTotalBytes"]));
assert.equal(profile.supervision.kind, "external-observer");
assert.equal(profile.supervision.enforcement, "monitored-stop");
assert.equal(profile.supervision.memoryStopBytes, 8589934592);
assert.equal(profile.supervision.processStopCount, 256);
assert.equal(profile.supervision.sampleMilliseconds, 250);
assert.equal(profile.supervision.cpuCount, 4);
assert.equal(profile.supervision.swapTotalBytes, 0);

const status = await readFile("/proc/self/status", "utf8");
const statusValue = name => status.split("\n").find(line => line.startsWith(`${name}:`))?.split(":", 2)[1]?.trim();
assert.equal(statusValue("NoNewPrivs"), "1");
assert.equal(Number(statusValue("Uid")?.split(/\s+/)[1]), 1000);
assert.equal(Number(statusValue("Gid")?.split(/\s+/)[1]), 1000);
const capabilities = Object.fromEntries(
  ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(name => [name, Number.parseInt(statusValue(name), 16)]),
);
assert.deepEqual(capabilities, { CapInh: 0, CapPrm: 0, CapEff: 0, CapBnd: 0, CapAmb: 0 });
const cpuAffinity = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
  "import json,os; print(json.dumps(sorted(os.sched_getaffinity(0))))"],
{ encoding: "utf8", timeout: 5_000, maxBuffer: 4096 }));
assert.ok(Array.isArray(cpuAffinity) && cpuAffinity.every(Number.isSafeInteger));
assert.equal(cpuAffinity.length, 4);
const networkInterfaces = (await readFile("/proc/net/dev", "utf8"))
  .split("\n").filter(line => line.includes(":")).map(line => line.split(":", 1)[0].trim());
assert.deepEqual(networkInterfaces, ["lo"]);
const memory = await readFile("/proc/meminfo", "utf8");
const memoryKb = name => Number(memory.match(new RegExp(`^${name}:\\s+(\\d+) kB$`, "m"))?.[1]);
assert.equal(memoryKb("SwapTotal"), 0);
assert.equal(memoryKb("SwapFree"), 0);
const initPidNamespace = await readlink("/proc/1/ns/pid");
const selfPidNamespace = await readlink("/proc/self/ns/pid");
assert.equal(initPidNamespace, selfPidNamespace);
assert.ok(process.pid > 1);
const mountReadOnly = JSON.parse(execFileSync("/usr/bin/python3", ["-I", "-B", "-c",
  'import json,os; paths=("/app","/source","/browser","/work"); print(json.dumps({p: bool(os.statvfs(p).f_flag & os.ST_RDONLY) for p in paths}, separators=(",",":")))',
], { encoding: "utf8", timeout: 5_000, maxBuffer: 4096 }));
assert.ok(exactObject(mountReadOnly, ["/app", "/source", "/browser", "/work"]));
for (const readOnly of Object.values(mountReadOnly)) assert.equal(typeof readOnly, "boolean");
assert.deepEqual(mountReadOnly, { "/app": true, "/source": true, "/browser": true, "/work": false });
const readOnlyMounts = { "/app": true, "/source": true, "/browser": true };
const boundary = {
  schema: "vivary.05b-zo-boundary/v1", profileSha256, uid: process.getuid(), gid: process.getgid(),
  pid: process.pid, initPid: 1, noNewPrivileges: true, capabilities, networkInterfaces, cpuAffinity,
  swapTotalBytes: 0, swapFreeBytes: 0, pidNamespaceId: selfPidNamespace,
  readOnlyMounts, supervision: profile.supervision,
};

let stderrBytes = 0;
const writeDiagnostic = (...args) => {
  const bytes = Buffer.from(`${format(...args)}\n`, "utf8");
  stderrBytes += bytes.length;
  if (stderrBytes <= 1024 * 1024) process.stderr.write(bytes);
};
for (const name of ["log", "warn", "error", "info", "debug"]) {
  console[name] = writeDiagnostic;
}

const appRequire = createRequire(path.join(app, "package.json"));
const importPackage = async name => import(pathToFileURL(appRequire.resolve(name)).href);
const appImport = relative => import(pathToFileURL(path.join(app, relative)).href);

const {
  addSession,
  awaitBootstrap,
  COOKIE_NAME,
  createAgentChatPlugin,
  getH3App,
  getSession,
  markDefaultPluginProvided,
  removeSession,
  runWithRequestContext,
} = await importPackage("@agent-native/core/server");
const { closeDbExec, getDbExec, runMigrations, withMigrationRuntime } =
  await importPackage("@agent-native/core/db");
const { stopAuditCleanupJob } = await importPackage("@agent-native/core/audit");
const {
  getMyOrgHandler,
  getOrgContext,
  ORG_MIGRATIONS,
  organizations,
  orgMembers,
  switchOrgHandler,
} = await importPackage("@agent-native/core/org");
const {
  H3,
  defineEventHandler,
  getMethod,
  setResponseStatus,
} = await importPackage("h3");
const { createRequestHandler } = await importPackage("react-router");
const { registerAgentEngine, resolveEngine } =
  await importPackage("@agent-native/core/agent/engine");
const { getDb } = await appImport("server/db/index.mjs");
const { mountChatTitles } = await appImport("server/chat-title.mjs");
const ssrBundlePath = path.join(app, "build/server/index.js");
const ssrBundleBytes = await readFile(ssrBundlePath);
assert.ok(ssrBundleBytes.length <= MAX_ASSET_BYTES);
const ssrBundleSha256 = sha256(ssrBundleBytes);
assert.equal(ssrBundleSha256, SSR_BUNDLE_SHA256);
const NativeMessageChannel = globalThis.MessageChannel;
assert.equal(typeof NativeMessageChannel, "function");
const messageChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "MessageChannel");
assert.ok(messageChannelDescriptor?.configurable);
const capturedSsrChannels = [];
const TrackedMessageChannel = new Proxy(NativeMessageChannel, {
  construct(target, args, newTarget) {
    const channel = Reflect.construct(target, args, newTarget);
    const stack = new Error("SSR MessageChannel creation").stack ?? "";
    if (/\/app\/build\/server\/index\.js:3995:\d+/.test(stack)) {
      assert.ok(capturedSsrChannels.length < 2, "SSR MessageChannel capture exceeded");
      capturedSsrChannels.push({
        channel,
        createdAt: Date.now(),
        stack: stack.slice(0, 4096),
        stackSha256: sha256(Buffer.from(stack)),
      });
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
const restoredMessageChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "MessageChannel");
assert.deepEqual(restoredMessageChannelDescriptor, messageChannelDescriptor);
assert.equal(globalThis.MessageChannel, NativeMessageChannel);
assert.equal(capturedSsrChannels.length, 1);
const render = createRequestHandler(build, "production");

const identities = {
  accountA: {
    email: assertSyntheticEmail("gui-account-a@example.test"),
    token: randomUUID(),
    primaryOrgId: "gui-org-a-primary",
    alternateOrgId: "gui-org-a-alternate",
  },
  accountB: {
    email: assertSyntheticEmail("gui-account-b@example.test"),
    token: randomUUID(),
    primaryOrgId: "gui-org-b-primary",
  },
};
const APP_SCOPE = orgChatScope(identities.accountA.primaryOrgId);

const orgRows = [
  {
    id: identities.accountA.primaryOrgId,
    name: "Proof organization A",
    createdBy: identities.accountA.email,
    createdAt: Date.now(),
  },
  {
    id: identities.accountA.alternateOrgId,
    name: "Proof organization A alternate",
    createdBy: identities.accountA.email,
    createdAt: Date.now() + 1,
  },
  {
    id: identities.accountB.primaryOrgId,
    name: "Proof organization B",
    createdBy: identities.accountB.email,
    createdAt: Date.now() + 2,
  },
];
const memberRows = [
  {
    id: "gui-member-a-primary",
    orgId: identities.accountA.primaryOrgId,
    email: identities.accountA.email,
    role: "owner",
    joinedAt: Date.now(),
  },
  {
    id: "gui-member-a-alternate",
    orgId: identities.accountA.alternateOrgId,
    email: identities.accountA.email,
    role: "owner",
    joinedAt: Date.now() + 1,
  },
  {
    id: "gui-member-b-primary",
    orgId: identities.accountB.primaryOrgId,
    email: identities.accountB.email,
    role: "owner",
    joinedAt: Date.now() + 2,
  },
];

let sessionDelayMilliseconds = 0;
let orgDelayMilliseconds = 0;
let titleMode = { kind: "success", title: "DeepSeek proof title", delayMilliseconds: 0 };
let expectedCompletionCalls = null;
let expectedTitleCalls = null;
let completionCalls = 0;
let titleCalls = 0;
let assetBytesServed = 0;
let requestOrdinal = 0;
const attemptedRequestCounts = { asset: 0, nonAsset: 0 };
const requestLog = [];
const titlePayloads = [];
const completionPayloads = [];

const fakeEngine = {
  name: "vivary-proof",
  label: "Synthetic proof",
  defaultModel: "vivary-proof",
  supportedModels: ["vivary-proof"],
  capabilities: {
    thinking: false,
    promptCaching: false,
    vision: false,
    computerUse: false,
    parallelToolCalls: false,
  },
  async *stream(options) {
    if (options.abortSignal.aborted) throw options.abortSignal.reason;
    const tools = options.tools ?? {};
    const toolNames = (Array.isArray(tools)
      ? tools.map(tool => {
        const name = tool.name ?? tool.function?.name;
        assert.equal(typeof name, "string", "offered tool has no schema name");
        return name;
      })
      : Object.keys(tools))
      .sort();
    completionCalls += 1;
    if (expectedCompletionCalls !== null) {
      assert.ok(completionCalls <= expectedCompletionCalls, "unexpected completion call");
    }
    completionPayloads.push({
      ordinal: completionCalls,
      model: options.model ?? null,
      messageSha256: sha256(Buffer.from(JSON.stringify(options.messages ?? []))),
      offeredToolCount: toolNames.length,
      offeredToolNamesSha256: sha256(Buffer.from(JSON.stringify(toolNames))),
      emittedToolCalls: 0,
    });
    yield { type: "text-delta", text: "Synthetic response." };
    yield {
      type: "assistant-content",
      parts: [{ type: "text", text: "Synthetic response." }],
    };
    yield { type: "stop", reason: "end_turn" };
  },
};

registerAgentEngine({
  name: "vivary-proof",
  label: "Synthetic proof",
  description: "Bounded synthetic completion engine for the 05b GUI proof.",
  capabilities: fakeEngine.capabilities,
  defaultModel: fakeEngine.defaultModel,
  supportedModels: fakeEngine.supportedModels,
  requiredEnvVars: [],
  create: () => fakeEngine,
});
async function fakeTitleFetch(url, init) {
  assert.equal(url, "https://api.deepseek.com/chat/completions");
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  titleCalls += 1;
  if (expectedTitleCalls !== null) {
    assert.ok(titleCalls <= expectedTitleCalls, "unexpected title call");
  }
  const payload = JSON.parse(init.body);
  titlePayloads.push({ ordinal: titleCalls, payload: canonical(payload) });
  const selectedMode = { ...titleMode };
  if (selectedMode.delayMilliseconds > 0) await sleep(selectedMode.delayMilliseconds);
  if (selectedMode.kind === "failure") {
    return Response.json({ error: "synthetic provider failure" }, { status: 503 });
  }
  return Response.json({
    choices: [{ message: { content: selectedMode.title } }],
  });
}

const nitro = { h3: new H3() };
markDefaultPluginProvided(nitro, "agent-chat");
markDefaultPluginProvided(nitro, "org");
const nativeApp = getH3App(nitro);

mountChatTitles(nitro, {
  getSession,
  getOrgContext,
  runWithRequestContext,
  resolveSecret: async name => {
    assert.equal(name, "DEEPSEEK_API_KEY");
    return "synthetic-proof-key";
  },
  fetchImpl: fakeTitleFetch,
});

nativeApp.use(
  "/_agent-native/auth/session",
  defineEventHandler(async event => {
    if (getMethod(event) !== "GET") {
      setResponseStatus(event, 405);
      return { error: "Method not allowed" };
    }
    if (sessionDelayMilliseconds > 0) await sleep(sessionDelayMilliseconds);
    return (await getSession(event)) ?? { error: "Unauthenticated" };
  }),
);
nativeApp.use(
  "/_agent-native/org/me",
  defineEventHandler(async event => {
    if (getMethod(event) !== "GET") {
      setResponseStatus(event, 405);
      return { error: "Method not allowed" };
    }
    if (orgDelayMilliseconds > 0) await sleep(orgDelayMilliseconds);
    return getMyOrgHandler(event);
  }),
);
nativeApp.use(
  "/_agent-native/org/switch",
  defineEventHandler(async event => {
    if (getMethod(event) !== "PUT") {
      setResponseStatus(event, 405);
      return { error: "Method not allowed" };
    }
    return switchOrgHandler(event);
  }),
);

let startupProbe = null;
const outstandingOperations = new Set();

async function abortable(operation, signal) {
  const promise = Promise.resolve(operation);
  outstandingOperations.add(promise);
  promise.finally(() => outstandingOperations.delete(promise)).catch(() => undefined);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason ?? new Error("proof operation aborted"));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

async function initialize() {
  const signal = AbortSignal.timeout(15_000);
  await abortable(withMigrationRuntime(async () => {
    await runMigrations(ORG_MIGRATIONS, { table: "gui_05b_org_migrations" })();
    await addSession(identities.accountA.token, identities.accountA.email);
    await addSession(identities.accountB.token, identities.accountB.email);
  }), signal);
  await abortable(getDb().insert(organizations).values(orgRows), signal);
  await abortable(getDb().insert(orgMembers).values(memberRows), signal);
  const resolvedProofEngine = await abortable(runWithRequestContext(
    { userEmail: identities.accountA.email, orgId: identities.accountA.primaryOrgId },
    () => resolveEngine({ model: "vivary-proof", appId: "workbench" }),
  ), signal);
  assert.equal(resolvedProofEngine, fakeEngine);
  createAgentChatPlugin({
    model: "vivary-proof",
    appId: "workbench",
    actions: {},
    mcp: { enabled: false },
    durableBackgroundRuns: false,
    codeExecution: { production: "off" },
    frameworkTools: "minimal",
  })(nitro);
  await abortable(awaitBootstrap(nitro), signal);
  const probeSignal = AbortSignal.timeout(5_000);
  const response = await abortable(nitro.h3.fetch(new Request(
    `http://127.0.0.1/_agent-native/agent-chat/threads?scopeType=${APP_SCOPE.type}&scopeId=${APP_SCOPE.id}`,
    {
      method: "GET",
      headers: { cookie: `${COOKIE_NAME}=${identities.accountA.token}` },
      signal: probeSignal,
    },
  )), probeSignal);
  const bytes = await readBoundedResponse(response, probeSignal);
  assert.equal(response.status, 200, bytes.toString("utf8"));
  const body = JSON.parse(bytes.toString("utf8"));
  assert.ok(Array.isArray(body.threads));
  startupProbe = { status: response.status, bytes: bytes.length,
    sha256: sha256(bytes), threads: body.threads.length };
}

const MIME = {
  ".css": "text/css",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function chatRequestAllowed(url, method) {
  const base = "/_agent-native/agent-chat";
  if (url.pathname === base || url.pathname === `${base}/`) return method === "POST";
  if (url.pathname === `${base}/generate-title`) return method === "POST";
  if (url.pathname === `${base}/mode`) return method === "GET";
  if (url.pathname === `${base}/threads`) return method === "GET";
  if (new RegExp(`^${base}/threads/[^/]+/rename$`).test(url.pathname)) return method === "POST";
  if (new RegExp(`^${base}/threads/[^/]+$`).test(url.pathname)) {
    return method === "GET" || method === "PUT";
  }
  if (url.pathname === `${base}/runs/active`) return method === "GET";
  return false;
}

function nativeShareReadAllowed(url, method) {
  if (method !== "GET" || url.pathname !== "/_agent-native/actions/list-resource-shares") {
    return false;
  }
  const keys = [...url.searchParams.keys()].sort();
  return keys.length === 2
    && keys[0] === "resourceId"
    && keys[1] === "resourceType"
    && url.searchParams.get("resourceType") === "chat_thread"
    && /^[A-Za-z0-9_-]{8,200}$/.test(url.searchParams.get("resourceId") ?? "");
}

function nativeRequestAllowed(url, method) {
  if (url.pathname === "/_agent-native/auth/session") return method === "GET";
  if (url.pathname === "/_agent-native/org/me") return method === "GET";
  if (url.pathname === "/_agent-native/org/switch") return method === "PUT";
  if (nativeShareReadAllowed(url, method)) return true;
  return chatRequestAllowed(url, method);
}

async function readBoundedResponse(response, signal) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  const cancel = () => {
    reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BODY_BYTES) {
        reader.cancel("05b GUI response cap exceeded").catch(() => undefined);
        throw new Error("05b GUI response cap exceeded");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function tableEvidence(signal) {
  if (signal.aborted) throw signal.reason;
  const database = getDbExec();
  const pageCountResult = await database.execute({ sql: "PRAGMA page_count", args: [] });
  const pageSizeResult = await database.execute({ sql: "PRAGMA page_size", args: [] });
  const pageCount = Number(pageCountResult.rows[0]?.page_count);
  const pageSize = Number(pageSizeResult.rows[0]?.page_size);
  assert.ok(Number.isSafeInteger(pageCount) && pageCount >= 0);
  assert.ok(Number.isSafeInteger(pageSize) && pageSize > 0);
  assert.ok(pageCount * pageSize <= MAX_DATABASE_BYTES, "proof database exceeds snapshot cap");
  const listed = await database.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    args: [],
  });
  const names = listed.rows.map(row => String(row.name));
  assert.ok(names.length <= MAX_TABLES && names.every(name => /^[A-Za-z0-9_]+$/.test(name)));
  const output = {};
  for (const name of names) {
    if (signal.aborted) throw signal.reason;
    const info = await database.execute({ sql: `PRAGMA table_info(${name})`, args: [] });
    const columns = info.rows.map(row => String(row.name)).sort();
    const counted = await database.execute({ sql: `SELECT COUNT(*) AS count FROM ${name}`, args: [] });
    const rowCount = Number(counted.rows[0]?.count);
    assert.ok(Number.isSafeInteger(rowCount) && rowCount >= 0 && rowCount <= MAX_ROWS_PER_TABLE);
    const selected = await database.execute({
      sql: `SELECT * FROM ${name} LIMIT ${MAX_ROWS_PER_TABLE + 1}`,
      args: [],
    });
    assert.equal(selected.rows.length, rowCount);
    const rows = selected.rows
      .map(row => Object.fromEntries(columns.map(column => {
        const value = canonical(row[column]);
        return [column, /token|secret|password|api_key/i.test(column)
          ? { $redactedSha256: sha256(Buffer.from(JSON.stringify(value) ?? "undefined")) }
          : value];
      })))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    output[name] = {
      columns,
      rows,
      rowCount,
      sha256: sha256(Buffer.from(JSON.stringify(canonical({ columns, rows })))),
    };
  }
  return { pageCount, pageSize, bytes: pageCount * pageSize, tables: output };
}

async function snapshot(label, signal = AbortSignal.timeout(10_000)) {
  if (signal.aborted) throw signal.reason;
  const value = canonical({
    schema: "vivary.05b-gui-backend-snapshot/v1",
    label: String(label ?? "snapshot").slice(0, 128),
    scope: APP_SCOPE,
    calls: { completionCalls, titleCalls },
    startupProbe,
    completionPayloads,
    titlePayloads,
    requests: requestLog,
    attemptedRequestCounts: {
      ...attemptedRequestCounts,
      total: attemptedRequestCounts.asset + attemptedRequestCounts.nonAsset,
    },
    tables: await tableEvidence(signal),
    boundary: { ...boundary, stderrBytes },
  });
  const bytes = Buffer.from(JSON.stringify(value));
  assert.ok(bytes.length <= MAX_SNAPSHOT_BYTES);
  return { ...value, sha256: sha256(bytes) };
}

async function handleRequest(message, signal) {
  assert.equal(typeof message.url, "string");
  assert.ok(["GET", "HEAD", "POST", "PUT"].includes(message.method));
  assert.ok(
    message.headers !== null &&
      typeof message.headers === "object" &&
      !Array.isArray(message.headers),
  );
  const body = message.body ? Buffer.from(message.body, "base64") : undefined;
  assert.ok(!body || body.length <= MAX_REQUEST_BODY_BYTES);
  const url = new URL(message.url);
  assert.equal(url.hostname, "127.0.0.1");
  const request = new Request(url, {
    method: message.method,
    headers: message.headers,
    signal,
    ...(!["GET", "HEAD"].includes(message.method) ? { body: body ?? null } : {}),
  });
  const staticAssetRequest = ["GET", "HEAD"].includes(message.method)
    && url.pathname.startsWith("/assets/")
    && !url.pathname.includes("_agent-native")
    && !url.pathname.startsWith("/api/");
  const requestCategory = staticAssetRequest ? "asset" : "nonAsset";
  attemptedRequestCounts[requestCategory] += 1;
  const categoryLimit = staticAssetRequest ? MAX_ASSET_REQUESTS : MAX_NON_ASSET_REQUESTS;
  assert.ok(attemptedRequestCounts[requestCategory] <= categoryLimit,
    `${requestCategory} request count exceeded`);
  const ordinal = ++requestOrdinal;
  let routedResponse;
  if (
    message.method === "POST" &&
    (url.pathname === "/_agent-native/agent-chat" ||
      url.pathname === "/_agent-native/agent-chat/")
  ) {
    let parsed;
    try {
      parsed = JSON.parse(body?.toString("utf8") ?? "null");
    } catch {
      parsed = null;
    }
    const engineAllowed = parsed?.engine === undefined || parsed.engine === "vivary-proof";
    const modelAllowed = parsed?.model === undefined || parsed.model === "vivary-proof";
    if (!engineAllowed || !modelAllowed) {
      routedResponse = Response.json(
        { error: "The proof accepts only the pinned synthetic engine and model." },
        { status: 400 },
      );
    } else {
      routedResponse = await abortable(nitro.h3.fetch(request), signal);
    }
  } else if (nativeRequestAllowed(url, message.method)) {
    routedResponse = await abortable(nitro.h3.fetch(request), signal);
  } else if (url.pathname.includes("_agent-native") || url.pathname.startsWith("/api/")) {
    routedResponse = Response.json(
      { error: "This bounded proof blocks non-chat Native routes." },
      { status: 503 },
    );
  } else if (staticAssetRequest) {
    const relative = `build/client${decodeURIComponent(url.pathname)}`;
    assert.match(relative, /^build\/client\/assets\/[A-Za-z0-9._/-]+$/);
    assert.ok(!relative.split("/").some(part => part === ".."));
    const target = path.join(app, ...relative.split("/"));
    assert.equal(await realpath(target), target);
    const bytes = await readFile(target);
    assert.ok(bytes.length <= MAX_RESPONSE_BODY_BYTES);
    assetBytesServed += bytes.length;
    assert.ok(assetBytesServed <= MAX_ASSET_BYTES);
    routedResponse = new Response(bytes, {
      headers: { "content-type": MIME[path.extname(target)] ?? "application/octet-stream" },
    });
  } else {
    assert.equal(message.method, "GET");
    routedResponse = await abortable(render(request), signal);
  }
  const responseBody = await readBoundedResponse(routedResponse, signal);
  requestLog.push({
    ordinal,
    method: message.method,
    path: `${url.pathname}${url.search}`,
    requestBytes: body?.length ?? 0,
    requestSha256: body ? sha256(body) : null,
    responseStatus: routedResponse.status,
    responseBytes: responseBody.length,
    responseSha256: sha256(responseBody),
  });
  return {
    status: routedResponse.status,
    headers: Object.fromEntries(routedResponse.headers),
    body: responseBody.toString("base64"),
  };
}

async function handle(message, signal) {
  assert.ok(message !== null && typeof message === "object" && !Array.isArray(message));
  assert.ok(Number.isSafeInteger(message.id) && message.id > 0);
  if (message.action === "request") {
    assert.ok(exactObject(message, ["id", "action", "url", "method", "headers", "body"]));
    return handleRequest(message, signal);
  }
  if (message.action === "identities") {
    assert.ok(exactObject(message, ["id", "action"]));
    return {
      identities,
      cookieName: COOKIE_NAME,
      scope: APP_SCOPE,
    };
  }
  if (message.action === "delays") {
    assert.ok(exactObject(message, ["id", "action", "sessionMilliseconds", "orgMilliseconds"]));
    for (const value of [message.sessionMilliseconds, message.orgMilliseconds]) {
      assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= 4_000);
    }
    sessionDelayMilliseconds = message.sessionMilliseconds;
    orgDelayMilliseconds = message.orgMilliseconds;
    return { ok: true };
  }
  if (message.action === "title-mode") {
    assert.ok(exactObject(message, ["id", "action", "kind", "title", "delayMilliseconds"]));
    assert.ok(["success", "failure"].includes(message.kind));
    assert.equal(typeof message.title, "string");
    assert.ok(message.title.length <= 60);
    assert.ok(
      Number.isSafeInteger(message.delayMilliseconds) &&
        message.delayMilliseconds >= 0 &&
        message.delayMilliseconds <= 4_000,
    );
    titleMode = {
      kind: message.kind,
      title: message.title,
      delayMilliseconds: message.delayMilliseconds,
    };
    return { ok: true };
  }
  if (message.action === "expect") {
    assert.ok(exactObject(message, ["id", "action", "completionCalls", "titleCalls"]));
    assert.ok(Number.isSafeInteger(message.completionCalls) && message.completionCalls >= 0);
    assert.ok(Number.isSafeInteger(message.titleCalls) && message.titleCalls >= 0);
    expectedCompletionCalls = message.completionCalls;
    expectedTitleCalls = message.titleCalls;
    return { ok: true };
  }
  if (message.action === "snapshot") {
    assert.ok(exactObject(message, ["id", "action", "label"]));
    return { snapshot: await snapshot(message.label, signal) };
  }
  throw new Error("unsupported proof action");
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
    assert.ok(chunk.length <= MAX_FRAME_BYTES);
    assert.ok(buffered.length + chunk.length <= MAX_FRAME_BYTES * 2);
    buffered = Buffer.concat([buffered, chunk]);
    while (true) {
      const newline = buffered.indexOf(10);
      if (newline < 0) break;
      assert.ok(newline <= MAX_FRAME_BYTES);
      const line = buffered.subarray(0, newline);
      buffered = buffered.subarray(newline + 1);
      if (line.length > 0) yield line;
    }
    assert.ok(buffered.length <= MAX_FRAME_BYTES);
  }
  assert.equal(buffered.length, 0, "truncated final RPC frame");
}

let closeRequested = false;
let accepting = true;
const pending = new Map();
function abortPromise(signal) {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

function schedule(message) {
  if (!accepting) throw new Error("proof backend is closing");
  if (pending.size >= MAX_PENDING_REQUESTS) throw new Error("proof request concurrency exceeded");
  if (pending.has(message.id)) throw new Error("duplicate proof request id");
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("proof request deadline exceeded"));
  }, REQUEST_DEADLINE_MILLISECONDS);
  const operation = handle(message, controller.signal);
  const task = (async () => {
    try {
      const result = await Promise.race([operation, abortPromise(controller.signal)]);
      await encodeReply(message.id, result);
    } catch (error) {
      await encodeReply(message.id, { error: boundedError(error) });
    } finally {
      clearTimeout(timeout);
      await abortable(operation, AbortSignal.timeout(1_000)).catch(() => undefined);
      pending.delete(message.id);
    }
  })();
  pending.set(message.id, { controller, task });
}

async function settlePending() {
  for (const { controller } of pending.values()) {
    controller.abort(new Error("proof backend is closing"));
  }
  const tasks = [...pending.values()].map(value => value.task);
  tasks.push(...outstandingOperations);
  if (tasks.length === 0) return;
  await Promise.race([
    Promise.allSettled(tasks),
    sleep(5_000).then(() => {
      throw new Error("pending proof requests did not settle during close");
    }),
  ]);
}

let terminalError = null;
try {
  await initialize();
  await encodeReply(0, {
    ready: true,
    startupProbe,
    limits: { frameBytes: MAX_FRAME_BYTES, requestBodyBytes: MAX_REQUEST_BODY_BYTES,
      responseBodyBytes: MAX_RESPONSE_BODY_BYTES, assetBytes: MAX_ASSET_BYTES,
      nonAssetRequests: MAX_NON_ASSET_REQUESTS, assetRequests: MAX_ASSET_REQUESTS },
    boundary,
  });
  for await (const line of readFrames(process.stdin)) {
    const message = JSON.parse(line.toString("utf8"));
    assert.ok(message !== null && typeof message === "object" && !Array.isArray(message));
    assert.ok(Number.isSafeInteger(message.id) && message.id > 0);
    if (message.action === "close") {
      assert.ok(exactObject(message, ["id", "action"]));
      accepting = false;
      process.stdin.pause();
      await settlePending();
      if (expectedCompletionCalls !== null) assert.equal(completionCalls, expectedCompletionCalls);
      if (expectedTitleCalls !== null) assert.equal(titleCalls, expectedTitleCalls);
      const closingSnapshot = await snapshot("requested-close", AbortSignal.timeout(10_000));
      closeRequested = true;
      await encodeReply(message.id, {
        closing: true,
        snapshot: closingSnapshot,
        shutdown: {
          stage: "close-acknowledged",
          activeResources: activeResourceCounts(),
          pendingRequests: pending.size,
          outstandingOperations: outstandingOperations.size,
          stdin: {
            destroyed: process.stdin.destroyed,
            readableEnded: process.stdin.readableEnded,
            paused: process.stdin.isPaused(),
          },
          ssrChannel: {
            bundleSha256: ssrBundleSha256,
            captured: capturedSsrChannels.length,
            stackSha256: capturedSsrChannels[0].stackSha256,
          },
        },
      });
      break;
    }
    schedule(message);
  }
  if (!closeRequested) throw new Error("proof backend input closed without close acknowledgement");
} catch (error) {
  terminalError = error;
} finally {
  accepting = false;
  const cleanupErrors = [];
  try { await settlePending(); }
  catch (error) { cleanupErrors.push({ step: "pending", ...boundedError(error) }); }
  try {
    if (expectedCompletionCalls !== null) assert.equal(completionCalls, expectedCompletionCalls);
    if (expectedTitleCalls !== null) assert.equal(titleCalls, expectedTitleCalls);
  } catch (error) { cleanupErrors.push({ step: "expectations", ...boundedError(error) }); }
  for (const identity of [identities.accountA, identities.accountB]) {
    try { await removeSession(identity.token); }
    catch (error) { cleanupErrors.push({ step: `session:${identity.email}`, ...boundedError(error) }); }
  }
  let finalSnapshot = null;
  try { finalSnapshot = await snapshot("backend-final", AbortSignal.timeout(10_000)); }
  catch (error) { cleanupErrors.push({ step: "snapshot", ...boundedError(error) }); }
  const shutdown = {
    stage: "backend-finalized",
    activeResourcesBeforeAuditStop: activeResourceCounts(),
    auditCleanup: { attempted: true, stopped: false },
    activeResourcesAfterAuditStop: null,
    databaseClosed: false,
    activeResourcesAfterDatabaseClose: null,
    ssrChannel: {
      bundleSha256: ssrBundleSha256,
      captured: capturedSsrChannels.length,
      createdAt: capturedSsrChannels[0].createdAt,
      creationStack: capturedSsrChannels[0].stack,
      stackSha256: capturedSsrChannels[0].stackSha256,
      globalDescriptorRestored: globalThis.MessageChannel === NativeMessageChannel,
      portsClosed: 0,
      closeEvents: 0,
    },
    activeResourcesAfterSsrChannelClose: null,
    stdin: null,
  };
  try {
    stopAuditCleanupJob();
    shutdown.auditCleanup.stopped = true;
  } catch (error) {
    cleanupErrors.push({ step: "audit-cleanup", ...boundedError(error) });
  }
  shutdown.activeResourcesAfterAuditStop = activeResourceCounts();
  try {
    await closeDbExec();
    shutdown.databaseClosed = true;
  } catch (error) { cleanupErrors.push({ step: "database", ...boundedError(error) }); }
  shutdown.activeResourcesAfterDatabaseClose = activeResourceCounts();
  try {
    const ports = [capturedSsrChannels[0].channel.port1, capturedSsrChannels[0].channel.port2];
    assert.equal(pending.size, 0, "pending requests remain before SSR MessageChannel close");
    assert.equal(outstandingOperations.size, 0,
      "outstanding operations remain before SSR MessageChannel close");
    const closeEvents = ports.map(port => new Promise(resolve => {
      port.addEventListener("close", resolve, { once: true });
    }));
    for (const port of ports) {
      port.close();
      shutdown.ssrChannel.portsClosed += 1;
    }
    let closeDeadline;
    try {
      await Promise.race([
        Promise.all(closeEvents).then(events => { shutdown.ssrChannel.closeEvents = events.length; }),
        new Promise((_, reject) => {
          closeDeadline = setTimeout(() => reject(
            new Error("SSR MessageChannel close events did not settle")), 1_000);
        }),
      ]);
    } finally {
      clearTimeout(closeDeadline);
    }
  } catch (error) {
    cleanupErrors.push({ step: "ssr-message-channel", ...boundedError(error) });
  }
  shutdown.activeResourcesAfterSsrChannelClose = activeResourceCounts();
  shutdown.stdin = {
    destroyed: process.stdin.destroyed,
    readableEnded: process.stdin.readableEnded,
    paused: process.stdin.isPaused(),
  };
  if (closeRequested && !shutdown.stdin.destroyed) {
    cleanupErrors.push({ step: "stdin", type: "Error",
      message: "proof backend stdin iterator did not release after close" });
  }
  await writeFile(
    path.join(evidenceRoot, "backend-final.json"),
    `${JSON.stringify({
      schema: "vivary.05b-gui-backend-final/v1",
      closeRequested,
      finalSnapshot,
      terminalError: terminalError ? boundedError(terminalError) : null,
      cleanupErrors,
      shutdown,
    }, null, 2)}\n`,
    { flag: "wx" },
  );
  if (cleanupErrors.length > 0) {
    terminalError ??= new Error(`proof backend cleanup failed: ${JSON.stringify(cleanupErrors)}`);
  }
}
if (terminalError) throw terminalError;
