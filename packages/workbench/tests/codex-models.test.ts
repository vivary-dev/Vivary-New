import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCodexCatalog, probeCodexModels } from "../server/codex-models";

const models = { data: [
  { model: "gpt-example-a", displayName: "Example A", isDefault: true, hidden: false },
  { model: "gpt-example-b", displayName: "Example B", isDefault: false, hidden: false },
  { model: "gpt-hidden", displayName: "Hidden", isDefault: false, hidden: true },
], nextCursor: null };
const account = { account: { type: "chatgpt", email: "private@example.test" } };
const config = { config: { model: "gpt-example-b", model_provider: "openai",
  mcp_servers: { files: { command: "private-command", env: { SECRET: "do-not-return" } }, disabled: { enabled: false } } } };
// A Codex that answers every request, then keeps running after its input closes, so only a forced stop ends it.
const lingeringCodex = String.raw`import readline from 'node:readline';
const values = ${JSON.stringify({ 1: {}, 2: models, 3: config, 4: account })};
readline.createInterface({input:process.stdin}).on('line', line => {
 const input=JSON.parse(line);
 if (input.id) process.stdout.write(JSON.stringify({id:input.id,result:values[input.id]})+'\n');
});
setInterval(() => {}, 1000);`;

test("uses only reported models and returns no account or connection secrets", () => {
  const result = parseCodexCatalog(models, config, account);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("catalog failed");
  assert.equal(result.defaultModel, "gpt-example-b");
  assert.deepEqual(result.models.map(model => model.id), ["gpt-example-b", "gpt-example-a"]);
  assert.deepEqual(result.connections, ["files"]);
  assert.doesNotMatch(JSON.stringify(result), /private|SECRET|do-not-return/);
});

test("reports a stale configured model without inventing an available choice", () => {
  const result = parseCodexCatalog(models, { config: { model: "retired" } }, account);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("catalog failed");
  assert.equal(result.defaultModel, "gpt-example-a");
  assert.match(result.message, /not in its reported catalog/);
});

test("refuses API accounts and alternate providers for subscription-only integration", () => {
  assert.equal(parseCodexCatalog(models, config, { account: { type: "apiKey" } }).status, "unavailable");
  assert.equal(parseCodexCatalog(models, { config: { model_provider: "paid-custom" } }, account).status, "unavailable");
  assert.equal(parseCodexCatalog(models, { config: { model_providers: { openai: { env_key: "PAID_KEY" } } } }, account).status, "unavailable");
});

test("rejects malformed, empty, and partial catalogs", () => {
  for (const input of [null, { data: [] }, { data: [{ model: 4 }] }, { ...models, nextCursor: "more" }]) {
    assert.equal(parseCodexCatalog(input, config, account).status, "unavailable");
  }
});

test("speaks bounded app-server protocol through an absolute launcher with spaces", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vivary codex models "));
  const file = path.join(dir, "fake cli.mjs");
  await writeFile(file, String.raw`import readline from 'node:readline';
import {writeFileSync} from 'node:fs';
const values = ${JSON.stringify({ 1: {}, 2: models, 3: config, 4: account })};
readline.createInterface({input:process.stdin}).on('line', line => {
 const input=JSON.parse(line);
 if (input.id) {
  const output=JSON.stringify({id:input.id,result:values[input.id]})+'\n';
  process.stdout.write(output.slice(0,7));
  process.stdout.write(output.slice(7));
 }
}).on('close', () => setImmediate(() => writeFileSync('closed.txt', 'graceful')));`);
  try {
    const result = await probeCodexModels({ executable: process.execPath, prefix: [file], env: {} }, dir);
    assert.equal(result.status, "ready");
    assert.equal(await readFile(path.join(dir, "closed.txt"), "utf8"), "graceful");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("bounds a stalled CLI and handles missing executables", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vivary-codex-stalled-"));
  const file = path.join(dir, "stall.mjs");
  await writeFile(file, "setInterval(() => {}, 1000);");
  try {
    assert.equal((await probeCodexModels({ executable: process.execPath, prefix: [file], env: {} }, dir, 100)).status, "unavailable");
    assert.equal((await probeCodexModels({ executable: path.join(dir, "missing"), prefix: [], env: {} }, dir)).status, "unavailable");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a timed-out npm-style launcher and its native child both stop before resolution", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vivary-codex-tree-"));
  const file = path.join(dir, "wrapper.mjs");
  const pids = path.join(dir, "pids.json");
  await writeFile(file, `import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'ignore'});
writeFileSync(${JSON.stringify(pids)},JSON.stringify([process.pid,child.pid]));
process.on('SIGTERM',()=>{});
process.stdin.resume();setInterval(()=>{},1000);`);
  try {
    const result = await probeCodexModels({ executable: process.execPath, prefix: [file], env: {} }, dir, 500);
    assert.equal(result.status, "unavailable");
    const identities: number[] = JSON.parse(await readFile(pids, "utf8"));
    for (const pid of identities) {
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = process.platform !== "linux" || !/^State:\s+Z/m.test(await readFile(`/proc/${pid}/status`, "utf8"));
      } catch { /* A stopped process has no identity to inspect. */ }
      assert.equal(alive, false, `discovery process ${pid} survived`);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a forced stop counts once Codex exits, even when taskkill reports an error", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vivary-codex-slow-stop-"));
  const file = path.join(dir, "lingering.mjs");
  await writeFile(file, lingeringCodex);
  // On a loaded Windows host `taskkill /F` can time out and still end Codex, which then reports no success code.
  const slowTaskkill = async (child: ChildProcess, workerExited: boolean) => {
    if (workerExited) return;
    setImmediate(() => child.kill("SIGKILL"));
    throw Object.assign(new Error("taskkill timed out"), { killed: true });
  };
  try {
    const result = await probeCodexModels({ executable: process.execPath, prefix: [file], env: {} }, dir, 12_000, { stopTree: slowTaskkill });
    assert.equal(result.status, "ready");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a failed stop refuses later checks only until that Codex exits, and logs the failed step", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "vivary-codex-failed-stop-"));
  const file = path.join(dir, "lingering.mjs");
  await writeFile(file, lingeringCodex);
  const launch = { executable: process.execPath, prefix: [file], env: {} };
  let lingering: ChildProcess | undefined;
  const refusedTreeStop = async (child: ChildProcess, workerExited: boolean) => {
    if (workerExited) return;
    lingering = child;
    throw Object.assign(new Error("Access denied."), { code: "EPERM" });
  };
  const logged = t.mock.method(console, "error", () => undefined);
  const unconfirmed = /could not confirm that Codex stopped/;
  try {
    const failed = await probeCodexModels(launch, dir, 12_000, { stopTree: refusedTreeStop, stopBudgetMs: 200 });
    assert.match(failed.status === "unavailable" ? failed.message : "", unconfirmed);
    const step = process.platform === "win32" ? "taskkill" : "group";
    assert.deepEqual(logged.mock.calls.map(call => call.arguments),
      [[`[vivary-codex-models] cleanup-unverified step=${step} error=EPERM`]]);
    const refused = await probeCodexModels(launch, dir);
    assert.match(refused.status === "unavailable" ? refused.message : "", unconfirmed);
    lingering?.kill("SIGKILL");
    if (lingering) await once(lingering, "close");
    assert.equal((await probeCodexModels(launch, dir)).status, "ready");
  } finally {
    lingering?.kill("SIGKILL");
    await rm(dir, { recursive: true, force: true });
  }
});
