import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isActionExposedToExternalAgents, type ActionRunContext } from "@agent-native/core/action";
import {
  actionsToEngineTools, executeAgentToolCall, getRequestOrgId, getRequestRunContext,
  loadActionsFromStaticRegistry, runWithRequestContext, type RequestRunContext,
} from "@agent-native/core/server";

import { defineProjectReadTool } from "../actions/vivary-project-read.ts";
import { PROJECT_READ_MAX_RESULT_CHARS, READ_BOUNDS, type ProjectReadResult } from "../app/lib/project-read-schema.ts";
import { createVivaryChatIdentity } from "../server/chat-identity.ts";
import { createVivaryNativeChatProjectResolver } from "../server/native-chat-project.ts";
import type { ProjectReadCommand, ProjectReadRun } from "../server/original-runtime.ts";
import { createProjectRead } from "../server/project-read.ts";

type Output = { exitCode: number | null; stdout: string; stderr: string };
const fixtures = path.join(import.meta.dirname, "fixtures", "project-read");
const load = async (name: string) => JSON.parse(await readFile(path.join(fixtures, `${name}.json`), "utf8")) as Record<string, Output>;
const coding = await load("coding");
const notes = await load("notes");
const host = await load("host");

// The captured fixtures replaced their temporary folders with these paths.
const hostPaths = { root: "/fixture/coding", dataDir: "/fixture/app-data" };
const ownerEmail = "owner@example.test";
const orgId = "org-a";
const owner: ActionRunContext = { caller: "http", userEmail: ownerEmail, orgId, appId: "workbench" };

function fakeRun(output: (projectId: string, command: ProjectReadCommand) => Output | ProjectReadRun) {
  const calls: { projectId: string; command: ProjectReadCommand; context: ActionRunContext | undefined }[] = [];
  const run = async (projectId: string, command: ProjectReadCommand, context?: ActionRunContext): Promise<ProjectReadRun> => {
    calls.push({ projectId, command, context });
    const value = output(projectId, command);
    const project = { id: projectId, label: projectId === "project-b" ? "Project B" : "Project A" };
    return "outcome" in value ? value : { project, outcome: "exited", ...value, hostPaths };
  };
  return { run, calls };
}

const fixtureFor = (set: Record<string, Output>) => (_projectId: string, command: ProjectReadCommand) =>
  command.verb === "logs" ? (command.failedOnly ? host.logsFailed : host.logs) : set[command.verb];
const noChat = async () => { throw new Error("The owner path must not consult a chat."); };
const reported = (result: ProjectReadResult) => {
  assert.equal(result.status, "reported", JSON.stringify(result));
  if (result.status !== "reported") throw new Error("unreachable");
  return result.report;
};
const raw = (output: Output) => JSON.parse(output.stdout);

test("each operation runs its documented original command for the requested project", async () => {
  const { run, calls } = fakeRun(fixtureFor(coding));
  const reads = createProjectRead({ run, chatProject: noChat });
  for (const input of [
    { operation: "doctor" }, { operation: "check" }, { operation: "find", query: "sync queue" },
    { operation: "find", query: "sync queue", k: 3, budget: 800 }, { operation: "capabilities" },
    { operation: "capabilities", preset: "writing" }, { operation: "receipts" }, { operation: "receipts", failedOnly: true },
  ] as const) await reads.forOwner(owner, { projectId: "project-a", ...input });
  assert.deepEqual(calls.map(call => call.command), [
    { verb: "doctor" }, { verb: "check" }, { verb: "find", query: "sync queue", k: 5, budget: 1200 },
    { verb: "find", query: "sync queue", k: 3, budget: 800 }, { verb: "capabilities", preset: "coding" },
    { verb: "capabilities", preset: "writing" }, { verb: "logs", failedOnly: false }, { verb: "logs", failedOnly: true },
  ]);
  assert.ok(calls.every(call => call.projectId === "project-a" && call.context === owner));
});

test("captured coding and notes reports keep the original findings, sources and limits", async () => {
  for (const [set, name] of [[coding, "coding"], [notes, "notes"]] as const) {
    const reads = createProjectRead({ run: fakeRun(fixtureFor(set)).run, chatProject: noChat });
    const request = { projectId: "project-a" };
    const doctor = reported(await reads.forOwner(owner, { ...request, operation: "doctor" }));
    const doctorRaw = raw(set.doctor);
    assert.deepEqual(doctor, { operation: "doctor", ok: doctorRaw.ok, graph: doctorRaw.graph,
      errors: { items: doctorRaw.errors, total: doctorRaw.errors.length },
      warnings: { items: doctorRaw.warnings, total: doctorRaw.warnings.length } }, name);

    const check = reported(await reads.forOwner(owner, { ...request, operation: "check" }));
    const checkRaw = raw(set.check);
    assert.deepEqual(check, { operation: "check", checked: checkRaw.checked, clean: checkRaw.clean,
      errorCount: checkRaw.errors, warningCount: checkRaw.warnings, strict: checkRaw.strict, complete: checkRaw.complete,
      findings: { items: checkRaw.findings, total: checkRaw.findings.length }, omissions: checkRaw.omissions }, name);

    const find = reported(await reads.forOwner(owner, { ...request, operation: "find", query: raw(set.find).query }));
    const findRaw = raw(set.find);
    assert.deepEqual(find, { operation: "find", query: findRaw.query, k: 5, budget: 1200,
      estimatedTokens: findRaw.estimated_tokens, complete: findRaw.complete,
      results: { items: findRaw.results.map(({ edges: _edges, snippet, ...result }: { edges: unknown; snippet: string }) =>
        ({ ...result, snippet: snippet.length > READ_BOUNDS.text ? snippet.slice(0, READ_BOUNDS.text - 1) + "…" : snippet })),
      total: findRaw.results.length },
      omissions: findRaw.omissions }, name);

    const capabilities = reported(await reads.forOwner(owner, { ...request, operation: "capabilities" }));
    const capabilitiesRaw = raw(set.capabilities);
    assert.equal(capabilities.operation, "capabilities");
    if (capabilities.operation !== "capabilities") return;
    assert.equal(capabilities.preset, capabilitiesRaw.preset);
    assert.deepEqual(capabilities.defaults, capabilitiesRaw.default_capabilities);
    assert.deepEqual(capabilities.capabilities.items.map(item => [item.id, item.isDefault, item.network, item.installStatus, item.missing]),
      capabilitiesRaw.available_capabilities.map((item: Record<string, unknown>) =>
        [item.id, item.default, item.network, item.install_status, item.missing_install]));
    assert.equal(JSON.stringify(capabilities).includes("--governed"), false, "install and run commands are dropped");
  }
  const reads = createProjectRead({ run: fakeRun(fixtureFor(coding)).run, chatProject: noChat });
  const find = reported(await reads.forOwner(owner, { projectId: "project-a", operation: "find", query: "How does the sync queue work?" }));
  assert.equal(find.operation, "find");
  if (find.operation !== "find") return;
  assert.deepEqual(find.omissions, [{ kind: "privacy_excluded", reason: "git_ignored", count: 1 }]);
  assert.equal(JSON.stringify(find).includes("private-roadmap"), false, "the git-ignored note stays out of context");
});

test("receipts report the application log, including an absent one", async () => {
  const reads = createProjectRead({ run: fakeRun(fixtureFor(coding)).run, chatProject: noChat });
  const all = reported(await reads.forOwner(owner, { projectId: "project-a", operation: "receipts" }));
  const allRaw = raw(host.logs);
  assert.equal(all.operation, "receipts");
  if (all.operation !== "receipts") return;
  assert.deepEqual([all.scope, all.logPresent, all.total, all.failed, all.invalidLines, all.records.total],
    ["application", true, allRaw.summary.total, allRaw.summary.failed, 0, allRaw.records.length]);
  assert.deepEqual(all.records.items[0], { timestamp: allRaw.records[0].timestamp, tool: "create-vivary", command: "init",
    ok: true, exitCode: 0, durationMs: allRaw.records[0].duration_ms, source: "env" });
  const failed = reported(await reads.forOwner(owner, { projectId: "project-a", operation: "receipts", failedOnly: true }));
  assert.ok(failed.operation === "receipts" && failed.records.items.every(record => !record.ok));
  const missing = createProjectRead({ run: fakeRun(() => host.logsMissing).run, chatProject: noChat });
  assert.deepEqual(reported(await missing.forOwner(owner, { projectId: "project-a", operation: "receipts" })),
    { operation: "receipts", scope: "application", logPresent: false, total: 0, failed: 0, invalidLines: 0, records: { items: [], total: 0 } });
});

test("refusals, run failures and unreadable output are unavailable values, access errors throw", async () => {
  const project = { id: "project-a", label: "Project A" };
  const refused = createProjectRead({ run: fakeRun(() => host.refusal).run, chatProject: noChat });
  const privacy = await refused.forOwner(owner, { projectId: "project-a", operation: "find", query: "garden" });
  assert.equal(privacy.status, "unavailable");
  assert.ok(privacy.status === "unavailable" && privacy.reason === "privacy_policy_unavailable"
    && /neither a Git repository nor a Vivary workspace/.test(privacy.message));
  for (const reason of ["timeout", "queue_timeout", "output_limit", "runtime_unavailable"] as const) {
    const reads = createProjectRead({ run: fakeRun(() => ({ project, outcome: "failed", reason })).run, chatProject: noChat });
    const result = await reads.forOwner(owner, { projectId: "project-a", operation: "check" });
    assert.ok(result.status === "unavailable" && result.reason === reason && result.operation === "check"
      && result.message.length > 0, reason);
  }
  for (const output of [{ exitCode: 2, stdout: "", stderr: "\nvivary doctor: create-vivary is not installed at /fixture/coding.\n" },
    { exitCode: 0, stdout: "not json", stderr: "" }, { exitCode: 0, stdout: JSON.stringify({ ok: "yes" }), stderr: "" }]) {
    const reads = createProjectRead({ run: fakeRun(() => output).run, chatProject: noChat });
    const result = await reads.forOwner(owner, { projectId: "project-a", operation: "doctor" });
    assert.ok(result.status === "unavailable" && result.reason === "unreadable_output", output.stdout);
  }
  const detail = await createProjectRead({ run: fakeRun(() => ({ exitCode: 2, stdout: "",
    stderr: "usage: vivary find [-h] [--root ROOT]\nvivary find: error: unrecognized arguments: --public /fixture/coding\n" })).run,
  chatProject: noChat }).forOwner(owner, { projectId: "project-a", operation: "find", query: "x" });
  assert.ok(detail.status === "unavailable" && detail.reason === "unreadable_output"
    && detail.message.endsWith("vivary find: error: unrecognized arguments: --public ."), JSON.stringify(detail));

  const revoked = Object.assign(new Error("Project folder access changed."), { statusCode: 403 });
  const denied = createProjectRead({ run: async () => { throw revoked; }, chatProject: async () => { throw revoked; } });
  await assert.rejects(denied.forOwner(owner, { projectId: "project-a", operation: "doctor" }), error => error === revoked);
  await assert.rejects(denied.forChat({ caller: "tool" }, { operation: "doctor" }), error => error === revoked);
});

test("source paths that could leave the project make the whole report unreadable", async () => {
  for (const bad of ["/etc/passwd", "../outside.md", "notes/../../outside.md", "notes\\inside.md", "C:/notes.md",
    "notes/\u0000.md", "a".repeat(513)]) {
    const check = raw(coding.check);
    const find = raw(coding.find);
    check.findings[0].path = bad;
    find.results[0].path = bad;
    const reads = createProjectRead({ run: fakeRun((_id, command) => ({ exitCode: 0, stderr: "",
      stdout: JSON.stringify(command.verb === "check" ? check : find) })).run, chatProject: noChat });
    for (const input of [{ operation: "check" }, { operation: "find", query: "sync" }] as const) {
      const result = await reads.forOwner(owner, { projectId: "project-a", ...input });
      assert.ok(result.status === "unavailable" && result.reason === "unreadable_output", `${input.operation} ${bad}`);
    }
  }
});

test("host paths never appear in any serialized result", async () => {
  const doctor = raw(coding.doctor);
  doctor.errors.push(`workspace root ${hostPaths.root} is readable`, `receipts live in ${hostPaths.dataDir}/original-runtime`);
  const check = raw(coding.check);
  check.findings[0].message = `see ${hostPaths.root}/changes/add-sync.md`;
  const reads = createProjectRead({ run: fakeRun((_id, command) => command.verb === "doctor"
    ? { exitCode: 1, stdout: JSON.stringify(doctor), stderr: "" }
    : command.verb === "check" ? { exitCode: 1, stdout: JSON.stringify(check), stderr: "" }
      : fixtureFor(coding)(_id, command)).run, chatProject: noChat });
  const results = [];
  for (const input of [{ operation: "doctor" }, { operation: "check" }, { operation: "find", query: "sync queue" },
    { operation: "capabilities" }, { operation: "receipts" }] as const) {
    results.push(await reads.forOwner(owner, { projectId: "project-a", ...input }));
  }
  const text = JSON.stringify(results);
  assert.equal(text.includes(hostPaths.root), false);
  assert.equal(text.includes(hostPaths.dataDir), false);
  const report = reported(results[0]);
  assert.ok(report.operation === "doctor" && report.errors.items.includes("workspace root . is readable")
    && report.errors.items.includes("receipts live in <app data>/original-runtime"));
});

test("worst-case outputs stay under the tool result limit with true totals", async () => {
  const long = (prefix: string) => prefix + "x".repeat(5_000);
  const sourcePath = (index: number) => `notes/${String(index).padStart(4, "0")}-${"p".repeat(490)}.md`;
  const omissions = Array.from({ length: 16 }, () => ({ kind: long("kind"), reason: long("reason"), count: 9 }));
  const worst = {
    doctor: { ok: false, errors: Array.from({ length: 900 }, () => long("error")), warnings: Array.from({ length: 900 }, () => long("warning")),
      graph: { nodes: 1, edges: 1, broken: 1 } },
    check: { schema: "vivary.check-result/v0", checked: 900, clean: 0, errors: 900, warnings: 0, strict: true, complete: false, omissions,
      findings: Array.from({ length: 200 }, (_, index) => ({ path: sourcePath(index), line: 1, level: "error", code: long("E"), message: long("m") })) },
    find: { schema: "vivary.find-result/v0", query: long("q"), k: 20, budget: 4000, estimated_tokens: 4000, complete: false, omissions,
      results: Array.from({ length: 20 }, (_, index) => ({ id: long("id"), type: long("type"), path: sourcePath(index), reason: long("r"), snippet: long("s") })) },
    capabilities: { preset: "coding", default_capabilities: Array.from({ length: 90 }, () => long("default")),
      available_capabilities: Array.from({ length: 90 }, () => ({ id: long("id"), label: long("label"), default: false, requires_approval: true,
        network: true, install_status: "not-installed", missing_install: Array.from({ length: 90 }, () => long("package")) })) },
    logs: { summary: { total: 40, failed: 40, invalid_lines: 0 }, records: Array.from({ length: 40 }, () => ({ timestamp: long("t"),
      tool: long("tool"), command: long("command"), ok: false, exit_code: 1, duration_ms: 5, receipt_source: long("source"), error_type: long("type") })) },
  };
  const reads = createProjectRead({ run: fakeRun((_id, command) => ({ exitCode: 1, stderr: "",
    stdout: JSON.stringify(worst[command.verb]) })).run, chatProject: noChat });
  for (const input of [{ operation: "doctor" }, { operation: "check" }, { operation: "find", query: "q" },
    { operation: "capabilities" }, { operation: "receipts" }] as const) {
    const result = await reads.forOwner(owner, { projectId: "project-a", ...input });
    const report = reported(result);
    assert.ok(JSON.stringify(result, null, 2).length <= PROJECT_READ_MAX_RESULT_CHARS, input.operation);
    const lists = Object.values(report).filter((value): value is { items: unknown[]; total: number } =>
      typeof value === "object" && value !== null && "total" in value);
    assert.ok(lists.some(list => list.items.length < list.total && list.items.length > 0), `${input.operation} keeps its true total`);
    assert.ok(lists.every(list => list.items.length <= READ_BOUNDS.items));
    const strings = JSON.stringify(report).match(/"(?:[^"\\]|\\.)*"/g) ?? [];
    assert.ok(strings.every(value => JSON.parse(value).length <= Math.max(READ_BOUNDS.text, 512)), input.operation);
  }
});

const catalog = { code: "catalog", projects: [{ projectId: "project-a", displayName: "Project A" },
  { projectId: "project-b", displayName: "Project B" }] };
const scope = (projectId: string | null) => createVivaryChatIdentity(ownerEmail, orgId,
  { kind: "project", projectId, label: projectId ?? "Personal workspace" }).scope;

function tool() {
  const fake = fakeRun((projectId, command) => fixtureFor(projectId === "project-b" ? notes : coding)(projectId, command));
  const reads = createProjectRead({ run: fake.run, chatProject: createVivaryNativeChatProjectResolver({
    getScope: () => getRequestRunContext()?.chatScope,
    getOrgId: getRequestOrgId,
    getProjectAccess: async () => catalog,
    resolveProjectWorkspace: async () => { throw new Error("The tool path resolves the workspace in the runner."); },
  }) });
  const actions = loadActionsFromStaticRegistry({ "vivary-project-read": { default: defineProjectReadTool(reads) } });
  const call = (chatScope: RequestRunContext["chatScope"], input: unknown) =>
    runWithRequestContext({ userEmail: ownerEmail, orgId, run: { chatScope } }, () => executeAgentToolCall({
      actions, name: "vivary-project-read", input, callId: "call-project-read", ownerEmail, orgId }));
  return { reads, calls: fake.calls, call };
}

test("the Native tool reads only the chat's own project, and the owner path returns the same result", async () => {
  const { reads, calls, call } = tool();
  const result = await call(scope("project-b"), { operation: "check" });
  assert.equal(result.status, "completed", result.output);
  const parsed = JSON.parse(result.output) as ProjectReadResult;
  assert.deepEqual(parsed.project, { id: "project-b", label: "Project B" });
  assert.deepEqual(calls.map(entry => [entry.projectId, entry.context?.caller, entry.context?.appId, entry.context?.userEmail]),
    [["project-b", "http", "workbench", ownerEmail]]);
  assert.deepEqual(parsed, await reads.forOwner(owner, { projectId: "project-b", operation: "check" }));
});

test("the Native tool refuses caller projects, personal and legacy chats, and malformed input before running", async () => {
  const { calls, call } = tool();
  for (const input of [{ operation: "doctor", projectId: "project-a" }, { operation: "doctor", root: "/outside" },
    { operation: "find" }, { operation: "find", query: "--root /outside" }, { operation: "find", query: "x", k: 21 },
    { operation: "find", query: "x", budget: 5_000 }, { operation: "doctor", query: "x" }, { operation: "shell" },
    { operation: "receipts", path: "/outside/receipts.jsonl" }, { operation: "capabilities", preset: "admin" }]) {
    const result = await call(scope("project-a"), input);
    assert.equal(result.status, "failed", JSON.stringify(input));
  }
  for (const chatScope of [scope(null), createVivaryChatIdentity(ownerEmail, orgId, { kind: "unassigned" }).scope, undefined]) {
    const result = await call(chatScope, { operation: "doctor" });
    assert.equal(result.status, "failed");
    assert.match(result.output, /Open this chat from a project to use project tools/);
  }
  assert.equal(calls.length, 0);
});

test("a revoked project reaches the model as the resolver's refusal", async () => {
  const revoked = Object.assign(new Error("Project folder access changed."), { statusCode: 403 });
  const reads = createProjectRead({ run: async () => { throw revoked; }, chatProject: async () => ({ projectId: "project-a", ownerContext: owner }) });
  const actions = loadActionsFromStaticRegistry({ "vivary-project-read": { default: defineProjectReadTool(reads) } });
  const result = await runWithRequestContext({ userEmail: ownerEmail, orgId, run: { chatScope: scope("project-a") } },
    () => executeAgentToolCall({ actions, name: "vivary-project-read", input: { operation: "doctor" }, callId: "call-revoked", ownerEmail, orgId }));
  assert.equal(result.status, "failed");
  assert.match(result.output, /Project folder access changed/);
});

test("the model sees one Vivary tool with no project field and the observations rule", async () => {
  const modules: Record<string, unknown> = {};
  for (const file of await readdir(path.join(import.meta.dirname, "..", "actions"))) {
    if (file.endsWith(".ts")) modules[file.slice(0, -3)] = await import(`../actions/${file}`);
  }
  const actions = loadActionsFromStaticRegistry(modules);
  const vivaryTools = actionsToEngineTools(actions).filter(entry => entry.name.startsWith("vivary-"));
  assert.deepEqual(vivaryTools.map(entry => entry.name), ["vivary-project-read"]);
  const [projectTool] = vivaryTools;
  const schema = projectTool.inputSchema as { type: string; properties: Record<string, { enum?: string[] }>; required?: string[] };
  assert.equal(schema.type, "object");
  assert.deepEqual(schema.properties.operation.enum, ["doctor", "check", "find", "capabilities", "receipts"]);
  assert.equal("projectId" in schema.properties, false);
  assert.match(projectTool.description, /observations/);
  assert.equal(isActionExposedToExternalAgents(actions["vivary-project-read"]), false);
  assert.equal(isActionExposedToExternalAgents(actions["vivary-project-read-owner"]), false);
});
