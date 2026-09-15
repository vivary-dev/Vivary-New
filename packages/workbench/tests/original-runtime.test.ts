import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { ActionRunContext } from "@agent-native/core/action";
import type { LocalProjectWorkspace } from "../server/project-services.mjs";
import { createOriginalCommandRunner, originalChildEnvironment, originalCommandArguments, originalCommandSchema, runOriginalProcess } from "../server/original-runtime";

const context: ActionRunContext = { caller: "http", userEmail: "owner@example.test", orgId: "test-org" };
const input = { projectId: "project-a", command: { verb: "doctor" as const } };

test("command input has no caller-supplied executable, paths, flags or receipt target", () => {
  for (const invalid of [
    { ...input, args: ["--root", "/outside"] },
    { ...input, receiptLog: "/outside" },
    { ...input, command: { verb: "shell" } },
    { ...input, command: { verb: "create", root: "/outside" } },
    { ...input, command: { verb: "review", pack: "/outside" } },
    { ...input, command: { verb: "review", pack: "context-budget" } },
    { ...input, command: { verb: "adopt", approvedPlanHash: "--yes" } },
  ]) assert.equal(originalCommandSchema.safeParse(invalid).success, false);
});

test("arguments preserve the ten owners and put option-like text after the option terminator", () => {
  const examples = [
    { verb: "create" }, { verb: "adopt" }, { verb: "doctor" }, { verb: "capabilities" },
    { verb: "check" }, { verb: "find", query: "--root /outside" },
    { verb: "decide", request: "{}" }, { verb: "review" },
    { verb: "impact", nodeId: "--receipt=/outside" }, { verb: "control", request: "{}" },
  ];
  for (const command of examples) {
    const parsed = originalCommandSchema.parse({ projectId: "project-a", command });
    const invocation = originalCommandArguments(parsed.command, "/granted/project");
    assert.equal(invocation.args[0], command.verb);
    if (command.verb === "create") assert.ok(invocation.args.includes("--dry-run"));
    if (command.verb === "adopt") assert.ok(!invocation.args.includes("--yes"));
    if (command.verb === "find" || command.verb === "impact") assert.equal(invocation.args.at(-2), "--");
    if (command.verb === "control" || command.verb === "decide") assert.equal(invocation.stdin, "{}");
  }
});

test("child environment excludes credentials and Python injection while owning the receipt location", () => {
  const env = originalChildEnvironment({ PATH: "/bin", HOME: "/home/owner", PYTHONPATH: "/evil", PYTHONHOME: "/evil", OPENAI_API_KEY: "fixture-secret", VIVARY_RECEIPT_LOG: "/outside" }, "/app-data/original-runtime/receipts.jsonl");
  assert.deepEqual(env, { PATH: "/bin", HOME: "/home/owner", PYTHONNOUSERSITE: "1", VIVARY_RECEIPT_LOG: "/app-data/original-runtime/receipts.jsonl" });
});


test("child executable search excludes the project and relative PATH entries", () => {
  const project = path.resolve("fixture-project");
  const trusted = path.resolve("trusted-tools");
  const env = originalChildEnvironment({ PATH: [".", "relative-tools", project, path.join(project, "bin"), trusted].join(path.delimiter) }, "/private/receipts", project);
  assert.equal(env.PATH, trusted);
});

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "vivary-original-"));
  const runtime = path.join(directory, "runtime");
  const data = path.join(directory, "data");
  const root = path.join(directory, "project");
  const relative = process.platform === "win32" ? "python/python.exe" : "python/bin/python3";
  const executable = path.join(runtime, relative);
  await Promise.all([mkdir(path.dirname(executable), { recursive: true }), mkdir(data), mkdir(root)]);
  await writeFile(executable, "fixture interpreter; execution is injected");
  await writeFile(path.join(runtime, "manifest.json"), JSON.stringify({ schemaVersion: 1, platform: process.platform, arch: process.arch, pythonVersion: "3.12.14", pythonExecutable: relative }));
  let workspace: LocalProjectWorkspace = { root, label: "Project A", projectId: "project-a", rootId: "root-a", bindingId: "binding-a", bindingRevision: 1, policyRevision: 1, locationRef: "local:a", verificationKind: "local-stat-revalidated-v1" };
  let reads = 0;
  let calls = 0;
  let beforeResolve = () => {};
  let afterExecute = () => {};
  const runner = createOriginalCommandRunner({
    environment: () => ({ VIVARY_ORIGINAL_RUNTIME: runtime, VIVARY_DATA_DIR: data }),
    resolveWorkspace: async () => { reads++; beforeResolve(); return workspace; },
    execute: async (python, args, _stdin, cwd, environment) => {
      calls++;
      assert.equal(python, executable);
      assert.deepEqual(args.slice(0, 4), ["-I", "-B", "-m", "vivary_cli"]);
      assert.equal(cwd, data);
      assert.equal(environment.VIVARY_RECEIPT_LOG, path.join(data, "original-runtime", "receipts.jsonl"));
      afterExecute();
      return { exitCode: 0, stdout: "result", stderr: "", signal: null };
    },
  });
  return { directory, runtime, data, runner, calls: () => calls, reads: () => reads,
    beforeResolve: (callback: () => void) => { beforeResolve = callback; },
    afterExecute: (callback: () => void) => { afterExecute = callback; },
    revise: () => { workspace = { ...workspace, policyRevision: workspace.policyRevision + 1 }; },
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("requires an authenticated actor before resolving a project", async () => {
  const f = await fixture();
  try { await assert.rejects(f.runner(input), /confirm access/); assert.equal(f.reads(), 0); }
  finally { await f.cleanup(); }
});

test("rechecks project policy before spawning and before returning its result", async () => {
  for (const when of ["before", "after"] as const) {
    const f = await fixture();
    try {
      if (when === "before") f.beforeResolve(() => { if (f.reads() === 2) f.revise(); });
      else f.afterExecute(f.revise);
      await assert.rejects(f.runner(input, context), /project changed/i);
      assert.equal(f.calls(), when === "before" ? 0 : 1);
    } finally { await f.cleanup(); }
  }
});

test("uses the exact bundle and private receipt path for an unchanged project", async () => {
  const f = await fixture();
  try {
    const result = await f.runner(input, context);
    assert.equal(result.stdout, "result");
    assert.equal(result.projectId, "project-a");
    assert.equal(f.reads(), 3);
  } finally { await f.cleanup(); }
});

test("refuses a hard-linked receipt file and oversized UTF-8 request before execution", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.runner({ projectId: "project-a", command: { verb: "decide", request: "é".repeat(40_000) } }, context), /format or size/);
    const receiptDir = path.join(f.data, "original-runtime");
    const outside = path.join(f.directory, "outside.jsonl");
    await writeFile(outside, "preserve me");
    await link(outside, path.join(receiptDir, "receipts.jsonl"));
    await assert.rejects(f.runner(input, context), /private application file/);
    assert.equal(f.calls(), 0);
  } finally { await f.cleanup(); }
});

test("bounded subprocess returns real output and stops on cancellation or excessive output", async () => {
  const env = originalChildEnvironment(process.env, path.join(tmpdir(), "unused-original-receipt.jsonl"));
  const result = await runOriginalProcess(process.execPath, ["-e", "process.stdout.write('ok')"], "", process.cwd(), env);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "ok");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150);
  try { await assert.rejects(runOriginalProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], "", process.cwd(), env, controller.signal), /cancelled/); }
  finally { clearTimeout(timer); }
  await assert.rejects(runOriginalProcess(process.execPath, ["-e", "process.stdout.write(Buffer.alloc(300000));setInterval(() => {}, 1000)"], "", process.cwd(), env), /output limit/);
});


test("cancellation stops a real descendant even when it ignores graceful termination", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "vivary-original-tree-"));
  const pidFile = path.join(directory, "descendant.pid");
  const descendant = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";
  const parent = `const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidFile)},String(child.pid));setInterval(()=>{},1000);`;
  const controller = new AbortController();
  const execution = runOriginalProcess(process.execPath, ["-e", parent], "", directory,
    originalChildEnvironment(process.env, path.join(directory, "receipt.jsonl")), controller.signal);
  const stopped = assert.rejects(execution, /cancelled/);
  let pid: number | undefined;
  const delay = () => new Promise(resolve => setTimeout(resolve, 50));
  const running = async () => {
    if (!pid) return false;
    try { process.kill(pid, 0); } catch { return false; }
    if (process.platform === "linux") {
      try { if ((await readFile(`/proc/${pid}/stat`, "utf8")).includes(") Z ")) return false; }
      catch { return false; }
    }
    return true;
  };
  try {
    for (let attempt = 0; attempt < 40 && !pid; attempt++) {
      try { pid = Number(await readFile(pidFile, "utf8")); } catch { await delay(); }
    }
    assert.ok(pid && Number.isSafeInteger(pid));
    controller.abort();
    await stopped;
    for (let attempt = 0; attempt < 40 && await running(); attempt++) await delay();
    assert.equal(await running(), false, "The command descendant must not survive cancellation.");
  } finally {
    controller.abort();
    await stopped;
    if (pid && await running()) process.kill(pid, "SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});

test("shutdown waits for active commands and permanently closes admission", async () => {
  const { shutdownOriginalCommands } = await import("../server/original-runtime");
  const directory = await mkdtemp(path.join(tmpdir(), "vivary-original-shutdown-"));
  const ready = path.join(directory, "ready");
  const execution = runOriginalProcess(process.execPath,
    ["-e", `require("node:fs").writeFileSync(${JSON.stringify(ready)},"ready");setInterval(()=>{},1000)`],
    "", directory, originalChildEnvironment(process.env, path.join(directory, "receipt.jsonl")));
  const stopped = assert.rejects(execution, /closing/);
  try {
    let started = false;
    for (let attempt = 0; attempt < 40 && !started; attempt++) {
      try { await readFile(ready); started = true; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(started, true);
    const shutdown = shutdownOriginalCommands();
    assert.equal(shutdownOriginalCommands(), shutdown);
    await shutdown;
    await stopped;
    assert.throws(() => runOriginalProcess(process.execPath, ["-e", ""], "", directory, {}), /cannot start/);
  } finally {
    await shutdownOriginalCommands();
    await stopped;
    await rm(directory, { recursive: true, force: true });
  }
});
