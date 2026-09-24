import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, link, readdir, symlink } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { ActionRunContext } from "@agent-native/core/action";
import type { LocalProjectWorkspace } from "../server/project-services.mjs";
import { ActionContractError } from "@agent-native/core/action";
import { adoptionExecutionSchema, createAdoptionCommandRunner, createOriginalCommandRunner, createProjectReadRunner, originalChildEnvironment, originalCommandArguments, originalCommandSchema, runOriginalProcess } from "../server/original-runtime";

const context: ActionRunContext = { caller: "http", userEmail: "owner@example.test", orgId: "test-org" };
const input = { projectId: "project-a", command: { verb: "review" as const } };

test("command input has no caller-supplied executable, paths, flags or receipt target", () => {
  for (const invalid of [
    { ...input, args: ["--root", "/outside"] },
    { ...input, receiptLog: "/outside" },
    { ...input, command: { verb: "shell" } },
    { ...input, command: { verb: "create", root: "/outside" } },
    { ...input, command: { verb: "review", pack: "/outside" } },
    { ...input, command: { verb: "find", query: "--root /outside" } },
    { ...input, command: { verb: "find", query: "-v" } },
    { ...input, command: { verb: "impact", nodeId: "--receipt=/outside" } },
    { ...input, command: { verb: "review", pack: "context-budget" } },
    { ...input, command: { verb: "adopt", approvedPlanHash: "--yes" } },
    { ...input, command: { verb: "create", apply: true } },
    { ...input, command: { verb: "create", apply: false } },
    { ...input, command: { verb: "adopt", approvedPlanHash: "sha256:" + "a".repeat(64) } },
  ]) assert.equal(originalCommandSchema.safeParse(invalid).success, false);
});

test("the public command action has no unfiltered find or check, and no project read verb", () => {
  for (const command of [{ verb: "doctor" }, { verb: "capabilities" }, { verb: "check" },
    { verb: "find", query: "chapter outline" }, { verb: "logs" }]) {
    assert.equal(originalCommandSchema.safeParse({ projectId: "project-a", command }).success, false, command.verb);
  }
});

test("project reads use the privacy-filtered front door and never pass a receipt path", () => {
  const root = "/granted/project";
  assert.deepEqual(originalCommandArguments({ verb: "doctor" }, root).args, ["doctor", root, "--json"]);
  assert.deepEqual(originalCommandArguments({ verb: "capabilities", preset: "writing" }, root).args,
    ["capabilities", "--preset", "writing", "--json"]);
  assert.deepEqual(originalCommandArguments({ verb: "find", query: "chapter outline", k: 5, budget: 1200 }, root).args,
    ["find", "chapter outline", "--root", root, "--public", "--json", "--k", "5", "--budget", "1200"]);
  assert.deepEqual(originalCommandArguments({ verb: "check" }, root).args, ["check", "--root", root, "--public", "--json"]);
  assert.deepEqual(originalCommandArguments({ verb: "logs", failedOnly: false }, root).args, ["logs", "--json", "--tail", "40"]);
  assert.deepEqual(originalCommandArguments({ verb: "logs", failedOnly: true }, root).args, ["logs", "--json", "--tail", "40", "--failed"]);
});

test("arguments preserve the public owners and place the node id directly after its verb", () => {
  // tropo and ozone parse positionals once, right after the verb; a trailing
  // positional or a `--` terminator after options is rejected by both CLIs.
  const examples = [
    { verb: "create" }, { verb: "adopt" }, { verb: "pattern-state" },
    { verb: "decide", request: "{}" }, { verb: "review" },
    { verb: "impact", nodeId: "outline" }, { verb: "control", request: "{}" },
  ];
  for (const command of examples) {
    const parsed = originalCommandSchema.parse({ projectId: "project-a", command });
    const invocation = originalCommandArguments(parsed.command, "/granted/project", "/private/request.json");
    assert.equal(invocation.args[0], command.verb === "pattern-state" ? "adopt" : command.verb);
    if (command.verb === "create") assert.ok(invocation.args.includes("--dry-run"));
    if (command.verb === "adopt") assert.ok(!invocation.args.includes("--yes"));
    if (command.verb === "impact") assert.deepEqual(invocation.args.slice(0, 2), ["impact", "outline"]);
    assert.ok(!invocation.args.includes("--"), invocation.args.join(" "));
    if (command.verb === "decide") assert.equal(invocation.stdin, "{}");
    if (command.verb === "control") { assert.equal(invocation.stdin, ""); assert.equal(invocation.args.at(-1), "/private/request.json"); }
  }
});

test("installed guidance choices use bounded stdin and the existing adoption owner", () => {
  const choices = [{ id: "capture" as const, name: "My intake", path: "notes/inbox.md" }];
  const preview = originalCommandSchema.parse({
    projectId: "project-a", command: { verb: "adopt", patternChoices: choices },
  });
  const invocation = originalCommandArguments(preview.command, "/granted/project");
  assert.deepEqual(invocation.args, ["adopt", "/granted/project", "--json",
    "--pattern-choices", "-"]);
  assert.deepEqual(JSON.parse(invocation.stdin), choices);
  const apply = adoptionExecutionSchema.parse({
    verb: "adopt-apply", planHash: "sha256:" + "a".repeat(64),
    requestId: "00000000-0000-4000-8000-000000000001", patternChoices: choices,
  });
  const approved = originalCommandArguments(apply, "/granted/project");
  assert.ok(approved.args.includes("--yes"));
  assert.deepEqual(JSON.parse(approved.stdin), choices);
  assert.equal(originalCommandSchema.safeParse({
    projectId: "project-a", command: { verb: "adopt",
      patternChoices: [{ id: "unknown", name: "Other", path: "other.md" }] },
  }).success, false);
  assert.deepEqual(originalCommandArguments({ verb: "pattern-state" }, "/granted/project"),
    { args: ["adopt", "/granted/project", "--json", "--pattern-state"], stdin: "" });
});

test("privacy preparation is an internal owner-approved verb with a strict reviewed JSON descriptor", () => {
  const privacyRequest = {
    schema: "vivary.adopt-privacy-request.v1",
    root_hash: "sha256:" + "a".repeat(64),
    before_hash: null,
    after_hash: "sha256:" + "b".repeat(64),
  };
  const command = adoptionExecutionSchema.parse({
    verb: "adopt-prepare-privacy", planHash: "sha256:" + "c".repeat(64),
    requestId: "c86a4ac8-2cd3-4bab-befb-a01aef34a27a", privacyRequest,
  });
  const invocation = originalCommandArguments(command, "/granted/project");
  assert.deepEqual(invocation.args, ["adopt", "/granted/project", "--json", "--yes", "--prepare-privacy",
    "--plan", command.planHash, "--request-id", command.requestId, "--privacy-request", "-"]);
  assert.equal(invocation.stdin, JSON.stringify(privacyRequest));
  assert.equal(originalCommandSchema.safeParse({ projectId: "project-a", command }).success, false);
  for (const invalid of [
    { ...privacyRequest, extra: "caller field" },
    { ...privacyRequest, root_hash: "not-a-digest" },
    { ...privacyRequest, before_hash: "not-a-digest" },
    { ...privacyRequest, after_hash: "not-a-digest" },
    { ...privacyRequest, schema: "other-schema" },
  ]) {
    assert.equal(adoptionExecutionSchema.safeParse({ ...command, privacyRequest: invalid }).success, false);
  }
  assert.equal(adoptionExecutionSchema.safeParse({ ...command, callerPath: "/outside" }).success, false);
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

async function bundle(prefix: string) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  const runtime = path.join(directory, "runtime");
  const data = path.join(directory, "data");
  const relative = process.platform === "win32" ? "python/python.exe" : "python/bin/python3";
  const executable = path.join(runtime, relative);
  await Promise.all([mkdir(path.dirname(executable), { recursive: true }), mkdir(data)]);
  await writeFile(executable, "fixture interpreter; execution is injected");
  await writeFile(path.join(runtime, "manifest.json"), JSON.stringify({ schemaVersion: 1, platform: process.platform, arch: process.arch, pythonVersion: "3.12.14", pythonExecutable: relative }));
  return { directory, runtime, data, executable };
}

const projectWorkspace = (projectId: string, root: string): LocalProjectWorkspace => ({ root, actorId: "actor-owner", label: "Project A",
  projectId, rootId: "root-a", bindingId: "binding-a", bindingRevision: 1, policyRevision: 1, locationRef: "local:a", verificationKind: "local-stat-revalidated-v1" });

async function fixture(inspect?: (args: string[], stdin: string) => Promise<void>) {
  const { directory, runtime, data, executable } = await bundle("vivary-original-");
  const root = path.join(directory, "project");
  await mkdir(root);
  let workspace = projectWorkspace("project-a", root);
  let reads = 0;
  let calls = 0;
  let beforeResolve = () => {};
  let afterExecute = () => {};
  const runner = createOriginalCommandRunner({
    environment: () => ({ VIVARY_ORIGINAL_RUNTIME: runtime, VIVARY_DATA_DIR: data }),
    resolveWorkspace: async () => { reads++; beforeResolve(); return workspace; },
    execute: async (python, args, stdin, cwd, environment) => {
      calls++;
      assert.equal(python, executable);
      assert.deepEqual(args.slice(0, 6), ["-I", "-X", "utf8", "-B", "-m", "vivary_cli"]);
      assert.equal(cwd, data);
      assert.equal(environment.VIVARY_RECEIPT_LOG, path.join(data, "original-runtime", "receipts.jsonl"));
      await inspect?.(args, stdin);
      afterExecute();
      return { exitCode: 0, stdout: "result", stderr: "", signal: null };
    },
  });
  return { directory, runtime, data, root, runner, calls: () => calls, reads: () => reads,
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

test("create and adopt apply requests are rejected before project resolution or execution", async () => {
  const digest = "sha256:" + "a".repeat(64);
  const f = await fixture();
  try {
    for (const command of [
      { verb: "create", apply: true },
      { verb: "create", apply: false },
      { verb: "adopt", approvedPlanHash: digest },
    ]) {
      const request = { projectId: "project-a", command };
      assert.equal(originalCommandSchema.safeParse(request).success, false);
      await assert.rejects(f.runner(request, context));
    }
    assert.equal(f.reads(), 0);
    assert.equal(f.calls(), 0);
  } finally { await f.cleanup(); }
});

test("output overflow returns a safe action error after the child stops", async () => {
  const f = await fixture(async () => {
    await runOriginalProcess(process.execPath, ["-e", "process.stdout.write(Buffer.alloc(300000));setInterval(() => {}, 1000)"], "", process.cwd(), process.env);
  });
  try {
    await assert.rejects(f.runner(input, context), {
      message: "The original Vivary command exceeded its output limit.",
      statusCode: 413,
      errorCode: "vivary_original_output_limit",
    });
    assert.equal((await runOriginalProcess(process.execPath, ["-e", ""], "", process.cwd(), process.env)).exitCode, 0);
  } finally { await f.cleanup(); }
});

test("control uses a separate private request file and removes it after success or failure", async () => {
  for (const reject of [false, true]) {
    let requestPath = "";
    const request = JSON.stringify({ operation: "expire_leases", state: { claims: [] }, input: { now: "2026-09-14T12:00:00Z" } });
    const f = await fixture(async (args, stdin) => {
      requestPath = args.at(-1)!;
      assert.ok(requestPath.startsWith(path.join(f.data, "original-runtime", "request-")));
      assert.equal(await readFile(requestPath, "utf8"), request);
      assert.equal(stdin, "");
      if (reject) throw new Error("fixture execution failure");
    });
    try {
      const run = f.runner({ projectId: "project-a", command: { verb: "control", request } }, context);
      if (reject) await assert.rejects(run, /fixture execution failure/); else await run;
      await assert.rejects(readFile(requestPath), { code: "ENOENT" });
      assert.deepEqual(await readdir(path.join(f.data, "original-runtime")), []);
    } finally { await f.cleanup(); }
  }
});

test("app decisions append a compatible private receipt without request or output text", async () => {
  const f = await fixture();
  try {
    await f.runner({ projectId: "project-a", command: { verb: "decide", request: JSON.stringify({ actor: { kind: "human", id: "actor-owner" }, authority_class: "contributor", scope: { project: "project-a", paths: [f.root] }, capsule: { task: { scope: [f.root] } }, privateNote: "private request content" }) } }, context);
    const text = await readFile(path.join(f.data, "original-runtime", "receipts.jsonl"), "utf8");
    const receipt = JSON.parse(text);
    assert.equal(receipt.schema, "vivary.run_receipt.v1");
    assert.equal(receipt.command, "decide");
    assert.equal(receipt.exit_code, 0);
    assert.equal(receipt.ok, true);
    assert.equal(receipt.tool, "vivary-workbench");
    assert.equal(receipt.receipt_source, "app");
    assert.equal(text.includes("private request content"), false);
    assert.equal(text.includes("result"), false);
    assert.deepEqual(await readdir(path.join(f.directory, "project")), []);
  } finally { await f.cleanup(); }
});

type Execute = NonNullable<Parameters<typeof createOriginalCommandRunner>[0]>["execute"];
type Submission = { result: Promise<unknown>; signal: AbortSignal; abort: () => void; queued: () => Promise<void> };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

// Commands reach the scheduler in any order, so each test observes queue
// entry through the abort listener the scheduler registers on the caller's
// signal, and admission through the fake executor that receives that signal.
async function scheduling(execute?: Execute) {
  const { directory, runtime, data } = await bundle("vivary-original-queue-");
  const started: { projectId: string; verb: string; signal?: AbortSignal; finish: () => void }[] = [];
  const submitted: Submission[] = [];
  const fake: Execute = (_python, args, _stdin, _cwd, _environment, signal) => new Promise(resolve => started.push({
    projectId: path.basename(args.find(value => path.dirname(value) === directory)!),
    verb: args[6] === "adopt" && args.includes("--yes") ? "adopt-apply" : args[6], signal,
    finish: () => resolve({ exitCode: 0, stdout: "", stderr: "", signal: null }),
  }));
  const dependencies = {
    environment: () => ({ VIVARY_ORIGINAL_RUNTIME: runtime, VIVARY_DATA_DIR: data }),
    resolveWorkspace: async (_context: ActionRunContext | undefined, projectId: string) =>
      projectWorkspace(projectId, path.join(directory, projectId)),
    execute: execute ?? fake,
  };
  const read = createOriginalCommandRunner(dependencies);
  const write = createAdoptionCommandRunner(dependencies);
  const submit = (run: (signal: AbortSignal) => Promise<unknown>): Submission => {
    const controller = new AbortController();
    const signal = controller.signal;
    const add = signal.addEventListener.bind(signal);
    let entered!: () => void;
    const queued = new Promise<void>(resolve => { entered = resolve; });
    signal.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
      if (type === "abort") entered();
      add(type, listener, options);
    }) as typeof signal.addEventListener;
    const result = run(signal);
    result.catch(() => undefined);
    const submission = { result, signal, abort: () => controller.abort(), queued: () => queued.then(flush) };
    submitted.push(submission);
    return submission;
  };
  return {
    directory, started,
    review: (projectId: string) => submit(signal => read({ projectId, command: { verb: "review" } }, { ...context, signal })),
    apply: (projectId: string) => submit(signal => write({ verb: "adopt-apply", planHash: "sha256:" + "a".repeat(64),
      requestId: "00000000-0000-4000-8000-000000000001" }, projectWorkspace(projectId, path.join(directory, projectId)), { ...context, signal })),
    finish: async (submission: Submission) => {
      const entry = started.find(candidate => candidate.signal === submission.signal);
      assert.ok(entry, "the command was admitted");
      entry.finish();
      await submission.result;
      await flush();
    },
    running: (...submissions: Submission[]) => submissions.map(submission =>
      started.some(entry => entry.signal === submission.signal)),
    // A failed assertion must not leave a project locked for the next test.
    cleanup: async () => {
      for (const submission of submitted) submission.abort();
      for (const entry of started) entry.finish();
      await Promise.allSettled(submitted.map(submission => submission.result));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("reads in one project overlap and a write waits for them, then holds later reads back", async () => {
  const f = await scheduling();
  try {
    const first = f.review("project-a"), second = f.review("project-a");
    await first.queued(); await second.queued();
    assert.deepEqual(f.running(first, second), [true, true]);
    const write = f.apply("project-a");
    await write.queued();
    const later = f.review("project-a");
    await later.queued();
    assert.deepEqual(f.running(write, later), [false, false], "the write and the read behind it wait for the running reads");
    const other = f.review("project-b");
    await other.queued();
    assert.deepEqual(f.running(other), [true]);
    await f.finish(first);
    assert.deepEqual(f.running(write, later), [false, false]);
    await f.finish(second);
    assert.deepEqual(f.running(write, later), [true, false]);
    await f.finish(write);
    assert.deepEqual(f.running(later), [true]);
    await Promise.all([f.finish(later), f.finish(other)]);
  } finally { await f.cleanup(); }
});

test("a write in one project never waits for another project", async () => {
  const f = await scheduling();
  try {
    const read = f.review("project-a");
    await read.queued();
    const write = f.apply("project-b");
    await write.queued();
    assert.deepEqual(f.running(read, write), [true, true]);
    await Promise.all([f.finish(read), f.finish(write)]);
  } finally { await f.cleanup(); }
});

test("commands past the machine's parallelism wait for a free child instead of failing", async () => {
  const f = await scheduling();
  const capacity = availableParallelism();
  try {
    const commands = Array.from({ length: capacity + 1 }, (_, index) => f.review(`project-${index}`));
    for (const command of commands) await command.queued();
    const admitted = f.running(...commands);
    assert.equal(admitted.filter(Boolean).length, capacity);
    const waiting = commands[admitted.indexOf(false)];
    await f.finish(commands[admitted.indexOf(true)]);
    assert.deepEqual(f.running(waiting), [true]);
    await Promise.all(commands.filter(command => command !== commands[admitted.indexOf(true)]).map(f.finish));
  } finally { await f.cleanup(); }
});

test("a cancelled or timed-out waiter leaves the queue without running", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = await scheduling();
  try {
    const write = f.apply("project-a");
    await write.queued();
    const cancelled = f.review("project-a");
    await cancelled.queued();
    cancelled.abort();
    await assert.rejects(cancelled.result, /cancelled/);
    const expired = f.review("project-a");
    await expired.queued();
    t.mock.timers.tick(30_000);
    await assert.rejects(expired.result, { errorCode: "vivary_original_queue_timeout", statusCode: 503, message: /still running/ });
    await f.finish(write);
    assert.deepEqual(f.running(cancelled, expired), [false, false]);
    const next = f.review("project-a");
    await next.queued();
    assert.deepEqual(f.running(next), [true], "the project lock was released");
    await f.finish(next);
  } finally { await f.cleanup(); }
});

test("a missing bundle and a slow command fail with their own codes", async t => {
  const f = await fixture();
  try {
    const missing = createOriginalCommandRunner({ environment: () => ({ VIVARY_ORIGINAL_RUNTIME: path.join(f.directory, "absent"), VIVARY_DATA_DIR: f.data }),
      resolveWorkspace: async () => projectWorkspace("project-a", f.root), execute: runOriginalProcess });
    await assert.rejects(missing(input, context), { errorCode: "vivary_original_runtime_unavailable", statusCode: 503 });
  } finally { await f.cleanup(); }
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const slow = runOriginalProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], "", process.cwd(),
    originalChildEnvironment(process.env, path.join(tmpdir(), "unused-original-receipt.jsonl")));
  t.mock.timers.tick(30_000);
  await assert.rejects(slow, { errorCode: "vivary_original_timeout", statusCode: 504, message: /30-second limit/ });
});

test("public find and check append an app receipt without the question, and doctor does not", async () => {
  const f = await fixture();
  try {
    const read = createProjectReadRunner({
      environment: () => ({ VIVARY_ORIGINAL_RUNTIME: f.runtime, VIVARY_DATA_DIR: f.data }),
      resolveWorkspace: async () => projectWorkspace("project-a", f.root),
      execute: async () => ({ exitCode: 1, stdout: "{}", stderr: "", signal: null }),
    });
    await read("project-a", { verb: "find", query: "private question text", k: 5, budget: 1200 }, context);
    await read("project-a", { verb: "check" }, context);
    await read("project-a", { verb: "doctor" }, context);
    const text = await readFile(path.join(f.data, "original-runtime", "receipts.jsonl"), "utf8");
    const receipts = text.trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(receipts.map(receipt => [receipt.command, receipt.exit_code, receipt.ok, receipt.receipt_source]),
      [["find", 1, false, "app"], ["check", 1, false, "app"]]);
    assert.equal(text.includes("private question text"), false);
    assert.equal(text.includes(f.root), false);
  } finally { await f.cleanup(); }
});

test("a project read names its project and keeps host paths out of band", async () => {
  const f = await fixture();
  const dependencies = {
    environment: () => ({ VIVARY_ORIGINAL_RUNTIME: f.runtime, VIVARY_DATA_DIR: f.data }),
    resolveWorkspace: async () => projectWorkspace("project-a", f.root),
  };
  try {
    const exited = await createProjectReadRunner({ ...dependencies,
      execute: async () => ({ exitCode: 0, stdout: "report", stderr: "", signal: null }) })("project-a", { verb: "doctor" }, context);
    assert.deepEqual(exited, { project: { id: "project-a", label: "Project A" }, outcome: "exited", exitCode: 0,
      stdout: "report", stderr: "", hostPaths: { root: f.root, dataDir: f.data } });
    for (const [errorCode, reason] of [["vivary_original_timeout", "timeout"], ["vivary_original_output_limit", "output_limit"],
      ["vivary_original_queue_timeout", "queue_timeout"]] as const) {
      const failed = await createProjectReadRunner({ ...dependencies, execute: async () => {
        throw new ActionContractError("refused", { errorCode, statusCode: 503 });
      } })("project-a", { verb: "check" }, context);
      assert.deepEqual(failed, { project: { id: "project-a", label: "Project A" }, outcome: "failed", reason });
    }
    const missing = await createProjectReadRunner({ ...dependencies, execute: runOriginalProcess,
      environment: () => ({ VIVARY_ORIGINAL_RUNTIME: path.join(f.directory, "absent"), VIVARY_DATA_DIR: f.data }) })("project-a", { verb: "doctor" }, context);
    assert.deepEqual(missing, { project: { id: "project-a", label: "Project A" }, outcome: "failed", reason: "runtime_unavailable" });
    const revoked = Object.assign(new Error("Project folder access changed."), { statusCode: 403 });
    await assert.rejects(createProjectReadRunner({ ...dependencies, execute: runOriginalProcess,
      resolveWorkspace: async () => { throw revoked; } })("project-a", { verb: "doctor" }, context), error => error === revoked);
    await assert.rejects(createProjectReadRunner({ ...dependencies, execute: runOriginalProcess })(
      "project-a", { verb: "find", query: "--root /outside", k: 5, budget: 1200 }, context));
  } finally { await f.cleanup(); }
});

test("governed requests reject foreign identity, authority and scope before execution", async () => {
  const f = await fixture();
  const scope = { project: "project-a", paths: [f.root] };
  const capsule = { task: { scope: [f.root] } };
  const actor = { kind: "human", id: "actor-owner" };
  const decision = { actor, authority_class: "contributor", scope, capsule };
  try {
    for (const request of [
      { ...decision, actor: { kind: "human", id: "someone-else" } },
      { ...decision, authority_class: "owner" },
      { ...decision, scope: { ...scope, project: "other-project" } },
      { ...decision, scope: { ...scope, paths: [path.dirname(f.root)] } },
      { ...decision, scope: { ...scope, paths: ["relative"] } },
      { ...decision, capsule: { task: { scope: [path.dirname(f.root)] } } },
    ]) await assert.rejects(f.runner({ projectId: "project-a", command: { verb: "decide", request: JSON.stringify(request) } }, context), /signed-in project actor/);
    for (const request of [
      { operation: "claim", state: { claims: [] }, input: { actor: { ...actor, id: "someone-else" }, scope } },
      { operation: "claim", state: { claims: [] }, input: { actor, scope, authority_class: "owner" } },
      { operation: "release", state: { claims: [] }, input: { actor: { ...actor, id: "someone-else" } } },
      { operation: "expire_leases", state: { claims: [{ scope: { ...scope, project: "other-project" }, authority_class: "contributor" }] }, input: {} },
      { operation: "handoff", state: { claims: [{ scope, authority_class: "owner" }] }, input: { from_actor: actor, capsule } },
      { operation: "handoff", state: { claims: [] }, input: { from_actor: actor, capsule, to_authority_class: "owner" } },
      { operation: "record_execution", state: {}, input: { capsule: { task: { scope: [path.dirname(f.root)] } } } },
    ]) await assert.rejects(f.runner({ projectId: "project-a", command: { verb: "control", request: JSON.stringify(request) } }, context), /signed-in project actor/);
    await assert.rejects(f.runner({ projectId: "project-a", command: { verb: "control", request: '{"input":{},"input":{},"state":{}}' } }, context), /signed-in project actor/);
    assert.equal(f.calls(), 0);
  } finally { await f.cleanup(); }
});

test("governed scope and capsule paths refuse an existing symlink to a foreign root", async () => {
  const f = await fixture();
  const foreign = path.join(f.directory, "foreign");
  const linked = path.join(f.root, "linked");
  const actor = { kind: "human", id: "actor-owner" };
  try {
    await mkdir(foreign);
    await mkdir(path.join(foreign, "child"));
    await writeFile(path.join(foreign, "secret.txt"), "foreign marker");
    await symlink(path.join(foreign, "child"), linked, process.platform === "win32" ? "junction" : "dir");
    const escaped = path.join(linked, "secret.txt");
    const escapedRaw = `${linked}${path.sep}..${path.sep}secret.txt`;
    const escapedAlternate = `${linked}\\..\\secret.txt`;
    const planned = path.join(linked, "planned", "child.txt");
    const acceptedScope = { project: "project-a", paths: [f.root] };
    for (const request of [
      { verb: "decide" as const, value: { actor, authority_class: "contributor",
        scope: { project: "project-a", paths: [escaped] }, capsule: { task: { scope: [f.root] } } } },
      { verb: "decide" as const, value: { actor, authority_class: "contributor",
        scope: { project: "project-a", paths: [escapedRaw] }, capsule: { task: { scope: [f.root] } } } },
      { verb: "decide" as const, value: { actor, authority_class: "contributor",
        scope: acceptedScope, capsule: { task: { scope: [escapedRaw] } } } },
      { verb: "decide" as const, value: { actor, authority_class: "contributor",
        scope: { project: "project-a", paths: [escapedAlternate] }, capsule: { task: { scope: [f.root] } } } },
      { verb: "decide" as const, value: { actor, authority_class: "contributor",
        scope: acceptedScope, capsule: { task: { scope: [planned] } } } },
      { verb: "control" as const, value: { operation: "claim", state: { claims: [] },
        input: { actor, scope: { project: "project-a", paths: [escaped] } } } },
      { verb: "control" as const, value: { operation: "handoff", state: { claims: [] },
        input: { from_actor: actor, capsule: { task: { scope: [planned] } } } } },
    ]) {
      await assert.rejects(f.runner({ projectId: "project-a", command: { verb: request.verb,
        request: JSON.stringify(request.value) } }, context), /signed-in project actor/);
    }
    assert.equal(f.calls(), 0);
  } finally { await f.cleanup(); }
});

test("governed plans allow a missing child below a verified project parent", async () => {
  let raw = "";
  const f = await fixture(async (_args, stdin) => { assert.equal(stdin, raw); });
  try {
    const planned = path.join(f.root, "planned", "child.txt");
    raw = JSON.stringify({ actor: { kind: "human", id: "actor-owner" }, authority_class: "contributor",
      scope: { project: "project-a", paths: [planned] }, capsule: { task: { scope: [planned] } } });
    const result = await f.runner({ projectId: "project-a", command: { verb: "decide", request: raw } }, context);
    assert.equal(result.evaluationKind, "caller-provided-evidence");
    assert.equal(f.calls(), 1);
  } finally { await f.cleanup(); }
});

test("matching governed requests preserve submitted evidence and return no execution grant", async () => {
  let expected = "";
  const f = await fixture(async (args, stdin) => {
    const actual = args[6] === "control" ? await readFile(args.at(-1)!, "utf8") : stdin;
    assert.equal(actual, expected);
  });
  const actor = { kind: "human", id: "actor-owner" };
  const scope = { project: "project-a", paths: [f.root] };
  const capsule = { task: { scope: [f.root] }, fingerprint: "preserve-this-evidence" };
  try {
    const requests = [
      { verb: "decide" as const, request: { actor, scope, capsule, authority_class: "contributor" } },
      { verb: "control" as const, request: { operation: "claim", state: { claims: [] }, input: { actor, scope } } },
      { verb: "control" as const, request: { operation: "release", state: { claims: [] }, input: { actor } } },
      { verb: "control" as const, request: { operation: "handoff", state: { claims: [{ scope, authority_class: "contributor" }] }, input: { from_actor: actor, to_actor: { kind: "agent", id: "intended-recipient" }, capsule } } },
      { verb: "control" as const, request: { operation: "expire_leases", state: { claims: [] }, input: {} } },
    ];
    for (const { verb, request } of requests) {
      expected = JSON.stringify(request);
      const result = await f.runner({ projectId: "project-a", command: { verb, request: expected } }, context);
      assert.equal(result.evaluationKind, "caller-provided-evidence");
    }
  } finally { await f.cleanup(); }
});

test("shutdown stops running children, refuses waiters and permanently closes admission", async () => {
  const { shutdownOriginalCommands } = await import("../server/original-runtime");
  const f = await scheduling((_python, args, stdin, cwd, environment, signal) => runOriginalProcess(process.execPath,
    ["-e", `require("node:fs").writeFileSync(${JSON.stringify(path.join(f.directory, "ready"))},"ready");setInterval(()=>{},1000)`],
    stdin, cwd, environment, signal));
  const write = f.apply("project-a");
  await write.queued();
  const waiting = f.review("project-a");
  const stopped = assert.rejects(write.result, /closing. The original command was stopped/);
  const refused = assert.rejects(waiting.result, /closing. New original commands cannot start/);
  try {
    let started = false;
    for (let attempt = 0; attempt < 40 && !started; attempt++) {
      try { await readFile(path.join(f.directory, "ready")); started = true; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(started, true);
    await waiting.queued();
    const shutdown = shutdownOriginalCommands();
    assert.equal(shutdownOriginalCommands(), shutdown);
    await shutdown;
    await Promise.all([stopped, refused]);
    await assert.rejects(f.review("project-b").result, /cannot start/);
    assert.throws(() => runOriginalProcess(process.execPath, ["-e", ""], "", f.directory, {}), /cannot start/);
  } finally {
    await shutdownOriginalCommands();
    await Promise.allSettled([stopped, refused]);
    await f.cleanup();
  }
});
