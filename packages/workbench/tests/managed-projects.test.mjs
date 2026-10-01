import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createManagedProject, installedPatternCatalog, previewManagedProject, readWorkspaceContext,
} from "../server/managed-projects.mjs";

test("production package cwd resolves the shipped creator bridge", async () => {
  const originalCwd = process.cwd();
  const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "vivary-managed-préview-"));
  try {
    process.chdir(workbenchRoot);
    const result = await previewManagedProject({}, { name: "Hosted-Preview" }, {
      dataDir,
      getAccess: async () => ({ code: "catalog" }),
    });
    assert.equal(result.code, "preview");
    assert.equal(result.plan.schema, "vivary.thin-init-plan/v1");
    assert.equal(result.plan.target, path.join(dataDir, "projects", "Hosted-Preview"));
    assert.equal(result.plan.files.length, 5);
  } finally {
    process.chdir(originalCwd);
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("the creator runs isolated Python through the original runner with only allowlisted names", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "vivary-managed-args-"));
  const bridge = path.join(dataDir, "managed_project_workspace.py");
  const launches = [];
  const answer = value => async (executable, args, stdin, cwd, environment, _signal, output) => {
    launches.push({ executable, args, request: JSON.parse(stdin), cwd, environment, output });
    return { exitCode: 0, stdout: JSON.stringify(value), stderr: "", signal: null };
  };
  const dependencies = { dataDir, getAccess: async () => ({ code: "catalog" }), python: "python-test", bridge,
    access: async () => {} };
  const target = path.join(dataDir, "projects", "Preview");
  const allowed = new Set(["PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "HOME", "USERPROFILE",
    "TEMP", "TMP", "LANG", "LC_ALL", "TZ", "PATH", "PYTHONNOUSERSITE"]);
  try {
    const result = await previewManagedProject({}, { name: "Preview" }, { ...dependencies,
      execute: answer({ code: "preview", plan: { schema: "vivary.thin-init-plan/v1", target, files: [] } }) });
    assert.equal(result.code, "preview");
    assert.deepEqual(await readWorkspaceContext({ projectId: "project_a", root: dataDir }, ["notes/new.md"],
      { ...dependencies, execute: answer({ code: "context", context: { status: "invalid", message: "bad toml" } }) }),
    { status: "invalid", message: "bad toml" });
    for (const launch of launches) {
      assert.equal(launch.executable, "python-test");
      assert.deepEqual(launch.args, ["-I", "-X", "utf8", "-B", bridge]);
      assert.equal(launch.cwd, dataDir);
      assert.deepEqual(launch.output, { bytes: 512 * 1024, stdout: "structured" });
      assert.deepEqual(Object.keys(launch.environment).filter(name => !allowed.has(name)), []);
    }
    assert.deepEqual(launches.map(launch => launch.request), [
      { operation: "plan", target, patternChoices: [], preset: "coding" },
      { operation: "context", target: dataDir, candidates: ["notes/new.md"] },
    ], "the bridge never receives the project id");
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("the creator child receives no server credential", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "vivary-creator-environment-"));
  const bridge = path.join(dataDir, "managed_project_workspace.py");
  await writeFile(bridge, "import json, os, sys\nsys.stdin.read()\nprint(json.dumps(sorted(os.environ)))\n");
  const seeded = {
    BETTER_AUTH_SECRET: randomBytes(24).toString("hex"),
    OPENROUTER_API_KEY: randomBytes(24).toString("hex"),
  };
  const previous = Object.fromEntries(Object.keys(seeded).map(name => [name, process.env[name]]));
  Object.assign(process.env, seeded);
  try {
    const names = await installedPatternCatalog({}, {
      getAccess: async () => ({ code: "catalog" }), python: "python3", bridge,
    });
    for (const name of Object.keys(seeded)) assert.equal(names.includes(name), false, `${name} reached the creator`);
    assert.ok(names.includes("PATH"), "an ordinary variable still reaches the creator");
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("one managed target has one apply and registration owner", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "vivary-managed-owner-"));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let applyCount = 0;
  let registrationCount = 0;
  const dependencies = {
    dataDir,
    getAccess: async () => ({ code: "catalog" }),
    runCreator: async ({ target }) => {
      applyCount += 1;
      await gate;
      await mkdir(target);
      return { code: "created", target, planSha256: "sha256:" + "a".repeat(64) };
    },
    connectFolder: async () => {
      registrationCount += 1;
      return { code: "registered", projectId: "project_one" };
    },
  };
  const input = {
    name: "Project-One",
    displayName: "Project One",
    acceptedPlanSha256: "sha256:" + "a".repeat(64),
  };
  try {
    const first = createManagedProject({}, input, dependencies);
    while (applyCount === 0) await new Promise(resolve => setTimeout(resolve, 1));
    await assert.rejects(createManagedProject({}, input, dependencies), /already being created/);
    assert.equal(applyCount, 1);
    release();
    const result = await first;
    assert.equal(result.registration.code, "registered");
    assert.equal(applyCount, 1);
    assert.equal(registrationCount, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("managed names reject Windows device names and case collisions before apply", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "vivary-managed-name-"));
  await mkdir(path.join(dataDir, "projects"));
  await mkdir(path.join(dataDir, "projects", "Alpha"));
  let applyCount = 0;
  const dependencies = {
    dataDir,
    getAccess: async () => ({ code: "catalog" }),
    runCreator: async () => {
      applyCount += 1;
      throw new Error("must not run");
    },
  };
  const base = {
    displayName: "Project",
    acceptedPlanSha256: "sha256:" + "b".repeat(64),
  };
  try {
    await assert.rejects(createManagedProject({}, { ...base, name: "CON.txt" }, dependencies), /valid on Windows/);
    await assert.rejects(createManagedProject({}, { ...base, name: "alpha" }, dependencies), /different capitalization/);
    assert.equal(applyCount, 0);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("workspace context reads the engine answer through the shipped bridge", async () => {
  const originalCwd = process.cwd();
  const workbenchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const folder = await mkdtemp(path.join(os.tmpdir(), "vivary-context-plain-"));
  try {
    process.chdir(workbenchRoot);
    assert.deepEqual(await readWorkspaceContext({ projectId: "project_plain", root: folder }), {
      status: "plain", memory: [".vivary/knowledge"], protected: [],
      privacy: { policy: "none", private: [], privateFiles: [],
        ignoreFiles: [".gitignore", ".vivary/.gitignore", ".vivary/knowledge/.gitignore"], privateCandidates: [],
        checkedFiles: [] },
    });
  } finally {
    process.chdir(originalCwd);
    await rm(folder, { recursive: true, force: true });
  }
});

test("workspace context passes invalid settings through and refuses an unexpected answer", async () => {
  const answer = context => ({ runCreator: async () => ({ code: "context", context }) });
  const project = { projectId: "project_a", root: "/project" };
  assert.deepEqual(await readWorkspaceContext(project, [], answer({ status: "invalid", message: "bad toml" })),
    { status: "invalid", message: "bad toml" });
  await assert.rejects(readWorkspaceContext(project, [], answer({ status: "plain", roles: null, state: null,
    memory: ["../outside"], memory_assigned: false, protected: [], privacy_policy: "none", private: [],
    private_files: [], ignore_files: [], private_candidates: [], checked_files: [] })));
  const limited = await readWorkspaceContext(project, [], answer({ status: "plain", roles: null, state: null,
    memory: [".vivary/knowledge"], memory_assigned: false, protected: [], privacy_policy: "gitignore", private: [],
    private_files: [], ignore_files: [".gitignore"], private_candidates: [], checked_files: [], privacy_limited: true }));
  assert.equal(limited.status === "plain" && limited.privacy.limited, true);
  await assert.rejects(readWorkspaceContext(project, [], { runCreator: async () => ({ code: "refused" }) }),
    /settings reader is unavailable/);
});
