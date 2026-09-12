import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdtemp, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink,
  writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const [base, entryFile, pythonPath] = process.argv.slice(2);
if (![base, entryFile, pythonPath].every(value => typeof value === "string" && path.isAbsolute(value))) {
  throw new Error("explicit absolute proof, provider and interpreter paths are required");
}
const python = await realpath(pythonPath);
const { withMigrationRuntime, runMigrations, closeDbExec } = await import("@agent-native/core/db");
const { and, eq } = await import("@agent-native/core/db/schema");
const { ORG_MIGRATIONS, organizations, orgMembers, setAppMemberRole } = await import("@agent-native/core/org");
const { evaluateRegistryOperation, parseStrictJson } = await import("../../../scripts/registry_contract_model.mjs");
const { getDb } = await import("../server/db/index.mjs");
const { migrateRegistry } = await import("../server/db/migrations.mjs");
const tables = await import("../server/db/schema.mjs");
const { createNativeRegistry } = await import("../server/native-registry.mjs");
const { startRootProvider } = await import("../server/root-provider.mjs");

const digest = value => createHash("sha256").update(value).digest("hex");
const serializable = value => JSON.parse(JSON.stringify(value,
  (_key, item) => typeof item === "bigint" ? item.toString() : item));
async function tree(root, { includeUtf8 = false } = {}) {
  const entries = [];
  async function visit(current, relative) {
    const info = await lstat(current);
    if (info.isSymbolicLink()) {
      entries.push({ path: relative, kind: "symlink", target: await readlink(current) });
    } else if (info.isDirectory()) {
      entries.push({ path: relative, kind: "directory" });
      for (const name of (await readdir(current)).sort()) {
        await visit(path.join(current, name), relative ? `${relative}/${name}` : name);
      }
    } else {
      const bytes = await readFile(current);
      entries.push({ path: relative, kind: "file", bytes: bytes.length, sha256: digest(bytes),
        ...(includeUtf8 ? { utf8: bytes.toString("utf8") } : {}) });
    }
  }
  await visit(root, "");
  return entries;
}

async function fixture() {
  const root = await mkdtemp(path.join(base, "native-vcs-"));
  const scope = path.join(root, "projects");
  const privateRoot = path.join(root, "private");
  const plain = path.join(scope, "plain");
  const repository = path.join(scope, "repository");
  const nested = path.join(repository, "nested");
  const linked = path.join(scope, "linked");
  const separate = path.join(scope, "separate");
  const alias = path.join(scope, "nested-alias");
  await mkdir(scope);
  await mkdir(privateRoot);
  await mkdir(plain);
  await mkdir(repository);
  await mkdir(nested);
  await mkdir(separate);
  await writeFile(path.join(plain, "note.txt"), "plain\n");
  await writeFile(path.join(repository, "note.txt"), "git\n");
  await writeFile(path.join(separate, "note.txt"), "git\n");
  const gitEnv = { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", HOME: root,
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" };
  const git = (cwd, ...args) => spawnSync("/usr/bin/git", ["-C", cwd, ...args],
      { env: gitEnv, timeout: 5000, maxBuffer: 32768 });
  for (const [cwd, args] of [
    [repository, ["init", "-q", "-b", "main"]], [repository, ["add", "."]],
    [repository, ["-c", "commit.gpgSign=false", "commit", "-q", "-m", "fixture"]],
    [repository, ["worktree", "add", "-q", "-b", "linked", linked]],
    [separate, ["init", "-q", "-b", "main"]], [separate, ["add", "."]],
    [separate, ["-c", "commit.gpgSign=false", "commit", "-q", "-m", "fixture"]],
  ]) {
    const result = git(cwd, ...args);
    assert.equal(result.status, 0, result.stderr.toString());
  }
  const repositoryTree = git(repository, "ls-tree", "-r", "HEAD");
  const separateTree = git(separate, "ls-tree", "-r", "HEAD");
  assert.equal(repositoryTree.status, 0, repositoryTree.stderr.toString());
  assert.equal(separateTree.status, 0, separateTree.stderr.toString());
  assert.equal(repositoryTree.stdout.toString(), separateTree.stdout.toString());
  await symlink(nested, alias, "dir");
  const config = { deviceId: `device-${randomUUID().replaceAll("-", "")}`, scope,
    statePath: path.join(privateRoot, "roots.json"),
    locations: { plain, repository, nested, linked, separate, alias } };
  return { root, scope, privateRoot, repository, config,
    setupEvidence: { equalTrackedTree: repositoryTree.stdout.toString(),
      sha256: digest(repositoryTree.stdout) },
    start: () => startRootProvider({
    python, entryFile, config, parseStrictJson,
  }) };
}

test("real live Git observations persist exact Native binding and receipt references", async t => {
  const f = await fixture();
  const suffix = randomUUID().replaceAll("-", "");
  const email = `vcs-${suffix}@example.test`;
  const orgId = `org-${suffix}`;
  const grant = { orgId, collectionId: `collection-${suffix}`, policyRevision: 1,
    locationRefs: ["plain", "repository", "nested", "linked", "separate", "alias"] };
  const context = { userEmail: email, orgId, caller: "frontend", appId: "workbench" };
  const request = (locationRef, expectedRegistryRevision, operationId = `operation-${locationRef}`) => ({
    operationId, expectedPolicyRevision: 1, expectedRegistryRevision,
    locationRef, displayName: locationRef, contentIdentity: null, attachProjectId: null,
  });
  let provider;
  try {
    await withMigrationRuntime(async () => {
      await runMigrations(ORG_MIGRATIONS, { table: "native_org_vcs_registration_migrations" })();
      await migrateRegistry();
    });
    await getDb().insert(organizations).values({ id: orgId, name: "VCS fixture",
      createdBy: email, createdAt: Date.now() });
    await getDb().insert(orgMembers).values({ id: `member-${suffix}`, orgId,
      email, role: "owner", joinedAt: Date.now() });
    await setAppMemberRole({ appId: "workbench", orgId, email,
      role: "project-registrar", updatedBy: email });
    provider = await f.start();
    const registry = createNativeRegistry({ provider, grant, evaluate: evaluateRegistryOperation });
    const witnesses = [];
    t.after(() => {
      const witnessLine = `NATIVE_VCS_REGISTRATION_WITNESS ${JSON.stringify({
        setup: f.setupEvidence, operations: witnesses,
      })}`;
      assert.ok(Buffer.byteLength(witnessLine, "utf8") <= 900 * 1024);
      process.stdout.write(`${witnessLine}\n`);
    });
    const snapshot = async () => {
      const sql = {};
      for (const name of ["projects", "bindings", "receipts", "revisions"]) {
        sql[name] = (await getDb().select().from(tables[name]))
          .map(row => serializable(Object.fromEntries(Object.entries(row))))
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
      }
      return { sql, projectGit: await tree(f.scope),
        privateMetadata: await tree(f.privateRoot, { includeUtf8: true }) };
    };
    const run = async (label, action) => {
      const before = await snapshot();
      let result;
      let failure;
      try { result = await action(); }
      catch (error) { failure = error; }
      const after = await snapshot();
      assert.deepEqual(after.projectGit, before.projectGit, `${label} changed project or Git bytes`);
      witnesses.push({ label, before, after, result: failure
        ? { error: String(failure.message), name: failure.name } : result });
      if (failure) throw failure;
      return result;
    };
    const plain = await run("register no-VCS root",
      () => registry.registration.run(request("plain", 0), context));
    assert.equal(plain.code, "registered");
    const repository = await run("register ordinary Git root",
      () => registry.registration.run(request("repository", 1), context));
    assert.equal(repository.code, "registered");
    const beforeReplay = { bindings: await getDb().select().from(tables.bindings),
      receipts: await getDb().select().from(tables.receipts),
      revisions: await getDb().select().from(tables.revisions) };
    assert.deepEqual(await run("replay ordinary Git registration",
      () => registry.registration.run(request("repository", 1), context)),
      { ...repository, replayed: true });
    assert.deepEqual({ bindings: await getDb().select().from(tables.bindings),
      receipts: await getDb().select().from(tables.receipts),
      revisions: await getDb().select().from(tables.revisions) }, beforeReplay);
    for (const [locationRef, revision] of [["nested", 2], ["linked", 3], ["separate", 4]]) {
      assert.equal((await run(`register ${locationRef} topology`,
        () => registry.registration.run(request(locationRef, revision), context))).code,
        "registered");
    }
    assert.equal((await run("deduplicate aliased nested root",
      () => registry.registration.run(request("alias", 5), context))).code,
      "already-registered");
    const registered = await snapshot();
    const selected = Object.fromEntries(registered.sql.bindings.filter(row => row.deviceId === provider.deviceId)
      .map(row => [row.locationRef, row]));
    assert.deepEqual({ kind: selected.plain.vcsKind, repositoryId: selected.plain.repositoryId,
      checkoutId: selected.plain.checkoutId, mutationOwner: selected.plain.mutationOwner },
    { kind: "none", repositoryId: null, checkoutId: null, mutationOwner: null });
    assert.match(selected.repository.repositoryId, /^repo_[0-9a-f]{32}$/);
    assert.match(selected.repository.checkoutId, /^checkout_[0-9a-f]{32}$/);
    assert.equal(selected.repository.mutationOwner, "git");
    assert.equal(selected.nested.repositoryId, selected.repository.repositoryId);
    assert.equal(selected.nested.checkoutId, selected.repository.checkoutId);
    assert.equal(selected.linked.repositoryId, selected.repository.repositoryId);
    assert.notEqual(selected.linked.checkoutId, selected.repository.checkoutId);
    assert.notEqual(selected.separate.repositoryId, selected.repository.repositoryId);
    assert.notEqual(selected.separate.checkoutId, selected.repository.checkoutId);
    assert.equal(registered.sql.bindings.some(row => row.locationRef === "alias"), false);
    const aliasWitness = witnesses.find(item => item.label === "deduplicate aliased nested root");
    assert.equal(aliasWitness.after.sql.projects.length, aliasWitness.before.sql.projects.length);
    assert.equal(aliasWitness.after.sql.bindings.length, aliasWitness.before.sql.bindings.length);
    assert.equal(aliasWitness.after.sql.receipts.length, aliasWitness.before.sql.receipts.length + 1);
    assert.equal(aliasWitness.after.sql.revisions.find(row => row.deviceId === provider.deviceId).revision,
      aliasWitness.before.sql.revisions.find(row => row.deviceId === provider.deviceId).revision + 1);
    const receipt = registered.sql.receipts.find(row => row.deviceId === provider.deviceId
      && row.operationId === "operation-repository");
    assert.deepEqual(JSON.parse(receipt.record).vcs, { kind: "git",
      repositoryId: selected.repository.repositoryId,
      checkoutId: selected.repository.checkoutId, mutationOwner: "git" });

    let revokedAcrossObservation = false;
    const roleChanging = createNativeRegistry({ grant, evaluate: evaluateRegistryOperation,
      provider: { ...provider, observe: async ref => {
        const observed = await provider.observe(ref);
        if (!revokedAcrossObservation) {
          revokedAcrossObservation = true;
          await setAppMemberRole({ appId: "workbench", orgId, email,
            role: null, updatedBy: email });
        }
        return observed;
      } } });
    assert.equal((await run("refuse role revocation across observation",
      () => roleChanging.registration.run(request("plain", 6, "role-across"), context))).code,
    "denied");
    assert.deepEqual((await snapshot()).sql, registered.sql);
    await setAppMemberRole({ appId: "workbench", orgId, email,
      role: "project-registrar", updatedBy: email });

    let removedAcrossObservation = false;
    const memberChanging = createNativeRegistry({ grant, evaluate: evaluateRegistryOperation,
      provider: { ...provider, observe: async ref => {
        const observed = await provider.observe(ref);
        if (!removedAcrossObservation) {
          removedAcrossObservation = true;
          await getDb().delete(orgMembers).where(and(
            eq(orgMembers.orgId, orgId), eq(orgMembers.email, email)));
        }
        return observed;
      } } });
    assert.equal((await run("refuse membership removal across observation",
      () => memberChanging.registration.run(request("plain", 6, "member-across"), context))).code,
    "denied");
    assert.deepEqual((await snapshot()).sql, registered.sql);
    await getDb().insert(orgMembers).values({ id: `replacement-member-${suffix}`, orgId,
      email, role: "member", joinedAt: Date.now() });
    await setAppMemberRole({ appId: "workbench", orgId, email,
      role: "project-registrar", updatedBy: email });

    let observations = 0;
    const changingFacts = createNativeRegistry({ grant, evaluate: evaluateRegistryOperation,
      provider: { ...provider, observe: async ref => {
        const observed = await provider.observe(ref);
        observations += 1;
        return observations === 1 ? observed
          : { ...observed, vcs: { ...observed.vcs, repositoryId: "repo_" + "f".repeat(32) } };
      } } });
    assert.equal((await run("refuse changing Git identity inside registration transaction",
      () => changingFacts.registration.run(request("repository", 6, "facts-change"), context))).code,
    "retry-state");
    assert.deepEqual((await snapshot()).sql, registered.sql);

    await setAppMemberRole({ appId: "workbench", orgId, email, role: null, updatedBy: email });
    await assert.rejects(run("refuse revoked role before dispatch",
      () => registry.registration.run(request("plain", 6, "revoked"), context)),
    { statusCode: 403 });
    assert.equal((await getDb().select().from(tables.bindings)).length, registered.sql.bindings.length);
    await setAppMemberRole({ appId: "workbench", orgId, email,
      role: "project-registrar", updatedBy: email });
    await rename(f.repository, path.join(f.scope, "replaced-repository"));
    await mkdir(f.repository);
    assert.equal((await run("refuse replaced Git administration",
      () => registry.registration.run(request("repository", 6, "replaced"), context))).code,
      "identity-unverified");
    assert.equal((await getDb().select().from(tables.bindings)).length, registered.sql.bindings.length);
    await provider.close();
    provider = await f.start();
    const restarted = createNativeRegistry({ provider, grant, evaluate: evaluateRegistryOperation });
    assert.equal((await run("refuse restarted provider with unresolved persisted identities",
      () => restarted.registration.run(request("plain", 6, "restart"), context))).code,
    "identity-unverified");
    assert.deepEqual((await snapshot()).sql, registered.sql);
    await assert.rejects(run("reject forged action fields", () => registry.registration.run({
      ...request("plain", 6, "forged"),
      vcs: { kind: "git" } }, context)), { statusCode: 400 });
    assert.ok(witnesses.every(item => item.before.sql && item.before.projectGit
      && item.before.privateMetadata && item.after.sql && item.after.privateMetadata));
  } finally {
    await provider?.close();
    await closeDbExec();
    await rm(f.root, { recursive: true });
  }
});
