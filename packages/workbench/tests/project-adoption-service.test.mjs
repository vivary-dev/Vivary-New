import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Use the host's native temporary filesystem for byte/mtime retry assertions.
// Zo's mounted /tmp can report cached timestamps from before a completed write.
const directory = await mkdtemp(path.join(process.platform === "linux" ? "/dev/shm" : os.tmpdir(), "vivary-adoption-app-"));
const dataDir = path.join(directory, "data");
const database = "file:" + path.join(directory, "app.sqlite");
Object.assign(process.env, { APP_NAME: "Vivary", DATABASE_URL: database, DATABASE_URL_UNPOOLED: database,
  VIVARY_DATABASE_URL: database, VIVARY_DATABASE_URL_UNPOOLED: database, VIVARY_DATA_DIR: dataDir });
const { withMigrationRuntime, runMigrations, closeDbExec } = await import("@agent-native/core/db");
const { ORG_MIGRATIONS, organizations, orgMembers, setAppMemberRole } = await import("@agent-native/core/org");
const { getSetting, mutateSetting, deleteSettingIfValue } = await import("@agent-native/core/settings");
const { getDb } = await import("../server/db/index.mjs");
const { migrateRegistry } = await import("../server/db/migrations.mjs");
const { projects, bindings } = await import("../server/db/schema.mjs");
const { createLocalRootProvider } = await import("../server/local-root-provider.mjs");
const { createNativeRegistry } = await import("../server/native-registry.mjs");
const { createProjectCatalog } = await import("../server/project-catalog.mjs");
const { connectLocalProjectFolder, resolveLocalProjectWorkspace } = await import("../server/project-services.mjs");
const { createProjectAdoptionService } = await import("../server/project-adoption.ts");
const { originalCommandArguments } = await import("../server/original-runtime.ts");
const { evaluateRegistryOperation, deriveMutationKeys } = await import("../../../scripts/registry_contract_model.mjs");
const { default: action } = await import("../actions/vivary-project-adoption.ts");
const creator = path.resolve(import.meta.dirname, "../../create-vivary/create_vivary.py");
const context = { caller: "frontend", appId: "vivary", userEmail: "owner@local.vivary.test", orgId: "adoption-test-org" };
const owner = { ...context, appId: "workbench" };
const executeFile = promisify(execFile);
let provider;
let executions = 0;
let loseResponse = false;
let crash = null;
let beforeExecute = async () => {};
async function execute(command, workspace) {
  executions++;
  await beforeExecute();
  const invocation = originalCommandArguments(command, workspace.root);
  let output;
  const crashMode = crash;
  crash = null;
  if (crashMode && command.verb === "adopt-apply") {
    const script = `import runpy,sys
m=runpy.run_path(sys.argv[1])
f=m['adopt_workspace']
if sys.argv[5] == 'publishing':
 original=f.__globals__['_write_adopt_journal']
 def write(target,payload,**kw):
  original(target,payload,**kw)
  if payload.get('phase') == 'publishing': raise KeyboardInterrupt('injected publishing crash')
 f.__globals__['_write_adopt_journal']=write
f(sys.argv[2],yes=True,plan_hash=sys.argv[3],request_id=sys.argv[4],_crash_after=2 if sys.argv[5]=='applying' else None)
`;
    try { await executeFile("python3", ["-B", "-c", script, creator, workspace.root, command.planHash, command.requestId, crashMode]); }
    catch { return { exitCode: 130, stdout: "", stderr: "injected crash", signal: null }; }
    assert.fail("crash injection did not run");
  }
  try {
    const result = await executeFile("python3", ["-B", creator, ...invocation.args], { maxBuffer: 512 * 1024 });
    output = { exitCode: 0, ...result, signal: null };
  } catch (error) { output = { exitCode: error.code, stdout: error.stdout, stderr: error.stderr, signal: error.signal }; }
  if (loseResponse) { loseResponse = false; throw new Error("injected lost response"); }
  return output;
}
function service() {
  return createProjectAdoptionService({ resolveWorkspace: resolveLocalProjectWorkspace,
    preview: async (input, ctx) => execute(input.command, await resolveLocalProjectWorkspace(ctx, input.projectId)),
    execute, get: getSetting, mutate: mutateSetting, remove: deleteSettingIfValue });
}
async function reopen() {
  await provider?.close();
  provider = await createLocalRootProvider({ ownerEmail: context.userEmail });
  const registry = createNativeRegistry({ provider, resolveGrant: provider.resolveGrant,
    evaluate: evaluateRegistryOperation, deriveMutationKeys });
  const catalog = createProjectCatalog({ readScope: registry.readScope, provider, locationLabels: provider.locationLabels });
  globalThis[Symbol.for("vivary.local-project-services.v1")] = {
    provider, registry, catalog, controller: { snapshot: () => ({ status: "open" }) },
  };
  await provider.resolveGrant(owner);
}
async function snapshot(root) {
  const result = {};
  async function visit(relative) {
    for (const name of await readdir(path.join(root, relative))) {
      const rel = path.join(relative, name);
      const file = path.join(root, rel);
      const info = await stat(file);
      if (info.isDirectory()) { result[rel + "/"] = "directory"; await visit(rel); }
      else result[rel] = { bytes: (await readFile(file)).toString("base64"), mtime: info.mtimeMs };
    }
  }
  await visit("");
  return result;
}
const approval = (review, operation = "apply") => ({ operation, projectId: review.projectId,
  operationId: review.operationId, acceptedPlanHash: review.planHash });
async function preview(run, projectId, preset = "auto") {
  const result = await run({ operation: "preview", projectId, preset }, context);
  assert.equal(result.code, "preview", JSON.stringify(result));
  return result;
}

test("registered existing-folder setup uses creator plans, exact owner approval and durable replay", async suite => {
  await mkdir(dataDir);
  await withMigrationRuntime(async () => {
    await runMigrations(ORG_MIGRATIONS, { table: "adoption_test_org_migrations" })();
    await migrateRegistry();
  });
  await getDb().insert(organizations).values({ id: context.orgId, name: "Adoption test", createdBy: context.userEmail, createdAt: Date.now() });
  await getDb().insert(orgMembers).values({ id: "adoption-owner", orgId: context.orgId,
    email: context.userEmail, role: "owner", joinedAt: Date.now() });
  try {
    await reopen();
    const folders = {};
    for (const name of ["Alpha", "Beta", "Unprotected", "Recovery", "Interrupted", "Uncertain", "RecoveryRetry"]) {
      const root = path.join(directory, name);
      await mkdir(root);
      await writeFile(path.join(root, "AGENTS.md"), "# Existing owner guidance\nKeep these instructions.\n");
      await writeFile(path.join(root, "unrelated.txt"), "Do not change me.\n");
      if (name !== "Unprotected") await writeFile(path.join(root, ".gitignore"), ".vivary/runtime/\n");
      const registration = await connectLocalProjectFolder(context, root);
      assert.equal(registration.code, "registered");
      folders[name] = { root, projectId: registration.projectId };
    }
    let run = service();
    const alpha = folders.Alpha;
    const beta = folders.Beta;

    await suite.test("preview and Cancel preserve every project byte and timestamp", async () => {
      const before = await snapshot(alpha.root);
      const review = await preview(run, alpha.projectId);
      assert.equal(review.report.request_replay.ready, true);
      assert.deepEqual(await snapshot(alpha.root), before);
      assert.deepEqual(await run(approval(review, "cancel"), context), { code: "idle" });
      assert.deepEqual(await snapshot(alpha.root), before);
      await assert.rejects(run(approval(review), context), /does not match/);
    });
    await suite.test("owner action rejects tool callers and unrelated owners before creator invocation", async () => {
      assert.equal(action.toolCallable, false);
      assert.equal(action.agentTool, false);
      assert.equal(action.mcpTool, false);
      assert.equal(action.requiresAuth, true);
      const calls = executions;
      for (const ctx of [undefined, { ...context, caller: "agent" }, { ...context, userEmail: "another@example.test" }]) {
        await assert.rejects(run({ operation: "preview", projectId: alpha.projectId, preset: "auto" }, ctx));
      }
      assert.equal(executions, calls);
    });
    await suite.test("options, target and content require the exact current review", async () => {
      const old = await preview(run, alpha.projectId);
      const review = await preview(run, alpha.projectId, "writing");
      const calls = executions;
      await assert.rejects(run(approval(old), context), /does not match/);
      await assert.rejects(run({ ...approval(review), projectId: beta.projectId }, context), /does not match/);
      await assert.rejects(run({ ...approval(review), acceptedPlanHash: "sha256:" + "0".repeat(64) }, context), /does not match/);
      assert.equal(executions, calls);
      await writeFile(path.join(alpha.root, "AGENTS.md"), "# Changed owner guidance\nKeep this revision.\n");
      const before = await snapshot(alpha.root);
      const changed = await run(approval(review), context);
      assert.equal(changed.code, "refused");
      assert.match(changed.message, /changed/);
      assert.deepEqual(await snapshot(alpha.root), before);
    });
    await suite.test("revoked application role prevents writes", async () => {
      const review = await preview(run, alpha.projectId);
      const before = await snapshot(alpha.root);
      await setAppMemberRole({ appId: "workbench", orgId: context.orgId, email: context.userEmail,
        role: "denied-role", updatedBy: context.userEmail });
      await assert.rejects(run(approval(review), context));
      assert.deepEqual(await snapshot(alpha.root), before);
      await setAppMemberRole({ appId: "workbench", orgId: context.orgId, email: context.userEmail,
        role: "project-registrar", updatedBy: context.userEmail });
    });
    await suite.test("apply matches reviewed bytes and preserves unrelated files and existing guidance", async () => {
      const review = await preview(run, alpha.projectId);
      const unrelated = (await snapshot(alpha.root))["unrelated.txt"];
      const result = await run(approval(review), context);
      assert.deepEqual(result, { code: "applied", projectId: alpha.projectId, replayed: false });
      for (const file of review.report.content_plan.files) {
        assert.equal(await readFile(path.join(alpha.root, file.path), "utf8"), file.content);
      }
      assert.match(await readFile(path.join(alpha.root, "AGENTS.md"), "utf8"), /^# Changed owner guidance\nKeep this revision\.\n/);
      assert.deepEqual((await snapshot(alpha.root))["unrelated.txt"], unrelated);
      const after = await snapshot(alpha.root);
      assert.deepEqual(await run(approval(review), context), { code: "applied", projectId: alpha.projectId, replayed: true });
      assert.deepEqual(await snapshot(alpha.root), after);
    });
    await suite.test("lost response survives service restart and replay makes no duplicate writes or projects", async () => {
      const review = await preview(run, beta.projectId);
      loseResponse = true;
      await assert.rejects(run(approval(review), context), /lost response/);
      const after = await snapshot(beta.root);
      const beforeProjects = await getDb().select().from(projects);
      const beforeBindings = await getDb().select().from(bindings);
      await reopen();
      run = service();
      const resumed = await run({ operation: "resume", projectId: beta.projectId }, context);
      assert.equal(resumed.code, "pending");
      assert.equal(resumed.operationId, review.operationId);
      assert.deepEqual(await run(approval(resumed), context), { code: "applied", projectId: beta.projectId, replayed: true });
      assert.deepEqual(await snapshot(beta.root), after);
      const registration = await connectLocalProjectFolder(context, beta.root);
      assert.equal(registration.code, "already-registered");
      assert.equal(registration.projectId, beta.projectId);
      assert.deepEqual(await getDb().select().from(projects), beforeProjects);
      assert.deepEqual(await getDb().select().from(bindings), beforeBindings);
    });
    await suite.test("unprotected recovery records are explained before confirmation and cannot apply", async () => {
      const target = folders.Unprotected;
      const before = await snapshot(target.root);
      const review = await preview(run, target.projectId);
      assert.equal(review.report.request_replay.ready, false);
      assert.match(review.report.request_replay.reason, /ignore|protect/i);
      await assert.rejects(run(approval(review), context));
      assert.deepEqual(await snapshot(target.root), before);
    });
    await suite.test("incomplete writes require a reviewed recovery and restore original bytes", async () => {
      const target = folders.Interrupted;
      const before = await snapshot(target.root);
      const review = await preview(run, target.projectId);
      crash = "applying";
      assert.equal((await run(approval(review), context)).code, "pending");
      run = service();
      const recovery = await run(approval(review, "preview-recovery"), context);
      assert.equal(recovery.code, "recovery-preview", JSON.stringify(recovery));
      const interrupted = await snapshot(target.root);
      await assert.rejects(run({ ...approval(review, "recover"), acceptedRecoveryHash: "sha256:" + "0".repeat(64) }, context), /recovery preview changed/);
      assert.deepEqual(await snapshot(target.root), interrupted);
      assert.equal((await run({ ...approval(review, "recover"), acceptedRecoveryHash: recovery.recovery.recovery_plan_hash }, context)).code, "recovered");
      const bytes = snapshot => Object.fromEntries(Object.entries(snapshot).map(([key,value]) => [key, typeof value === "string" ? value : value.bytes]));
      const restored = bytes(await snapshot(target.root));
      for (const [name, value] of Object.entries(bytes(before))) assert.equal(restored[name], value);
      assert.equal(restored["STATE.md"], undefined);
      assert.equal(restored[path.join(".vivary", "context.md")], undefined);
      assert.equal((await preview(run, target.projectId)).report.request_replay.ready, true);
    });
    await suite.test("lost recovery success survives restart and cannot re-enable original apply", async () => {
      const target = folders.RecoveryRetry;
      const review = await preview(run, target.projectId);
      crash = "applying";
      assert.equal((await run(approval(review), context)).code, "pending");
      const recovery = await run(approval(review, "preview-recovery"), context);
      assert.equal(recovery.code, "recovery-preview");
      loseResponse = true;
      const request = { ...approval(review, "recover"), acceptedRecoveryHash: recovery.recovery.recovery_plan_hash };
      await assert.rejects(run(request, context), /lost response/);
      const restored = await snapshot(target.root);
      await reopen();
      run = service();
      const refreshed = await run(approval(review, "preview-recovery"), context);
      assert.equal(refreshed.code, "recovery-preview");
      assert.equal(refreshed.approved, true);
      await assert.rejects(run(approval(review), context), /Recovery was approved/);
      assert.equal((await run(request, context)).code, "recovered");
      assert.deepEqual(await snapshot(target.root), restored);
    });
    await suite.test("possible completed publication refuses rollback and preserves all files", async () => {
      const target = folders.Uncertain;
      const review = await preview(run, target.projectId);
      crash = "publishing";
      assert.equal((await run(approval(review), context)).code, "pending");
      const after = await snapshot(target.root);
      const recovery = await run(approval(review, "preview-recovery"), context);
      assert.equal(recovery.code, "pending");
      assert.match(recovery.message, /committed or uncertain/);
      assert.deepEqual(await snapshot(target.root), after);
      assert.equal((await run(approval(review), context)).code, "pending");
      assert.deepEqual(await snapshot(target.root), after);
    });
    await suite.test("concurrent requests do not start another writer", async () => {
      const target = folders.Recovery;
      const review = await preview(run, target.projectId);
      let release;
      let arrived;
      const entered = new Promise(resolve => { arrived = resolve; });
      beforeExecute = async () => { arrived(); await new Promise(resolve => { release = resolve; }); };
      const running = run(approval(review), context);
      await entered;
      await assert.rejects(run(approval(review), context), /already running/);
      release();
      assert.equal((await running).code, "applied");
      beforeExecute = async () => {};
    });
  } finally {
    await provider?.close();
    delete globalThis[Symbol.for("vivary.local-project-services.v1")];
    await closeDbExec();
    await rm(directory, { recursive: true, force: true });
  }
});
