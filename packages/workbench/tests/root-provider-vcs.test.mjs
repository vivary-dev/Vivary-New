import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const [base, entryFile, pythonPath] = process.argv.slice(2);
if (![base, entryFile, pythonPath].every((value) => typeof value === "string" && path.isAbsolute(value))) {
  throw new Error("explicit absolute proof, provider and interpreter paths are required");
}
const python = await realpath(pythonPath);
const { parseStrictJson } = await import("../../../scripts/registry_contract_model.mjs");
const { startRootProvider } = await import("../server/root-provider.mjs");

async function setup() {
  const root = await mkdtemp(path.join(base, "wire-vcs-"));
  const scope = path.join(root, "projects");
  const state = path.join(root, "private");
  await mkdir(scope);
  await mkdir(state);
  const plain = path.join(scope, "plain");
  const repository = path.join(scope, "repository");
  const nested = path.join(repository, "nested");
  const linked = path.join(scope, "linked");
  await mkdir(plain);
  await mkdir(repository);
  await mkdir(nested);
  await writeFile(path.join(plain, "note.txt"), "plain\n");
  await writeFile(path.join(repository, "note.txt"), "git\n");
  const git = (...args) => spawnSync("/usr/bin/git", ["-C", repository, ...args], {
    env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", HOME: root,
      GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" },
    timeout: 5000, maxBuffer: 32768,
  });
  for (const args of [["init", "-q", "-b", "main"], ["add", "."],
    ["-c", "commit.gpgSign=false", "commit", "-q", "-m", "fixture"],
    ["worktree", "add", "-q", "-b", "linked", linked]]) {
    const result = git(...args);
    assert.equal(result.status, 0, result.stderr.toString());
  }
  const config = { deviceId: "wire-vcs-device", scope,
    statePath: path.join(state, "roots.json"), locations: { plain, repository, nested, linked } };
  return { root, config, start: (file = entryFile) => startRootProvider({
    python, entryFile: file, config, parseStrictJson,
  }) };
}

test("version 1 carries strict no-VCS and Git application references", async () => {
  const f = await setup();
  let provider;
  try {
    provider = await f.start();
    const plain = await provider.observe("plain");
    assert.equal(plain.code, "observed");
    assert.deepEqual(plain.vcs, { kind: "none", repositoryId: null,
      checkoutId: null, mutationOwner: null });
    const repository = await provider.observe("repository");
    assert.equal(repository.code, "observed");
    assert.match(repository.vcs.repositoryId, /^repo_[0-9a-f]{32}$/);
    assert.match(repository.vcs.checkoutId, /^checkout_[0-9a-f]{32}$/);
    assert.equal(repository.vcs.mutationOwner, "git");
    const nested = await provider.observe("nested");
    assert.equal(nested.code, "observed");
    assert.equal(nested.vcs.repositoryId, repository.vcs.repositoryId);
    assert.equal(nested.vcs.checkoutId, repository.vcs.checkoutId);
    assert.equal(nested.vcs.mutationOwner, "git");
    const linked = await provider.observe("linked");
    assert.equal(linked.code, "observed");
    assert.equal(linked.vcs.repositoryId, repository.vcs.repositoryId);
    assert.match(linked.vcs.checkoutId, /^checkout_[0-9a-f]{32}$/);
    assert.notEqual(linked.vcs.checkoutId, repository.vcs.checkoutId);
    assert.equal(linked.vcs.mutationOwner, "git");
    const available = await provider.inspect("repository");
    assert.equal(available.code, "identity-unverified");
    assert.equal(Object.hasOwn(available, "vcs"), false);
    assert.deepEqual(provider.readiness(), { status: "ready" });
  } finally {
    await provider?.close();
    await rm(f.root, { recursive: true });
  }
});

test("missing or malformed VCS replies fail closed", async () => {
  const f = await setup();
  try {
    const malformedReplies = [
      { version: 1, sequence: 1, code: "observed", rootId: "root_" + "a".repeat(32),
        locationRef: "plain", contentRevision: "content" },
      { version: 1, sequence: 1, code: "observed", rootId: "root_" + "a".repeat(32),
        locationRef: "plain", contentRevision: "content", vcs: { kind: "git",
          repositoryId: "repo_" + "b".repeat(32), checkoutId: null, mutationOwner: "git" } },
      { version: 1, sequence: 1, code: "observed", rootId: "root_" + "a".repeat(32),
        locationRef: "plain", contentRevision: "content", vcs: { kind: "none",
          repositoryId: null, checkoutId: null, mutationOwner: null, path: "/forged" } },
    ];
    const observed = { version: 1, sequence: 1, code: "observed",
      rootId: "root_" + "a".repeat(32), locationRef: "plain", contentRevision: "content",
      vcs: { kind: "none", repositoryId: null, checkoutId: null, mutationOwner: null } };
    const git = { kind: "git", repositoryId: "repo_" + "b".repeat(32),
      checkoutId: "checkout_" + "c".repeat(32), mutationOwner: "git" };
    for (const [operation, response] of [
      ...malformedReplies.map(response => ["observe", response]),
      ["observe", { ...observed, locationRef: "repository", vcs: git }],
      ["inspect", observed],
      ["observe", { ...observed, vcs: { ...git, kind: "jj-git", mutationOwner: "jj" } }],
    ]) {
      const wrong = path.join(f.root, "wrong-reply.py");
      await writeFile(wrong, "import json,sys\nsys.stdin.readline()\n"
        + "print(json.dumps({'version':1,'sequence':0,'code':'ready'}),flush=True)\n"
        + "sys.stdin.readline()\nprint(" + JSON.stringify(JSON.stringify(response)) + ",flush=True)\n");
      const provider = await f.start(wrong);
      try {
        assert.equal((await provider[operation]("plain")).code, "identity-unverified");
        assert.deepEqual(provider.readiness(), { status: "unavailable" });
      } finally { await provider.close(); }
    }
  } finally { await rm(f.root, { recursive: true }); }
});

test("an unresolved configured Git sibling blocks otherwise valid observations", async () => {
  const f = await setup();
  let provider;
  try {
    const broken = path.join(f.config.scope, "broken");
    await mkdir(broken);
    await writeFile(path.join(broken, ".git"), "gitdir: /missing-vivary-fixture-administration\n");
    f.config.locations.broken = broken;
    provider = await f.start();
    assert.equal((await provider.observe("plain")).code, "identity-unverified");
    assert.equal((await provider.observe("repository")).code, "identity-unverified");
  } finally {
    await provider?.close();
    await rm(f.root, { recursive: true });
  }
});
