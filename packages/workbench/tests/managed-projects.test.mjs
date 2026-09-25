import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createManagedProject, previewManagedProject, readWorkspaceContext } from "../server/managed-projects.mjs";

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

test("creator keeps isolated mode and explicitly enables UTF-8", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "vivary-managed-args-"));
  let launch;
  const spawn = (executable, args, options) => {
    launch = { executable, args, options };
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.kill = () => true;
    child.stdin = { end: () => queueMicrotask(() => {
      child.stdout.emit("data", Buffer.from(JSON.stringify({ code: "preview", plan: {
        schema: "vivary.thin-init-plan/v1", target: path.join(dataDir, "projects", "Preview"), files: [],
      } }), "utf8"));
      child.emit("close", 0);
    }) };
    return child;
  };
  try {
    const result = await previewManagedProject({}, { name: "Preview" }, {
      dataDir,
      getAccess: async () => ({ code: "catalog" }),
      python: "python-test",
      bridge: path.join(dataDir, "managed_project_workspace.py"),
      access: async () => {},
      spawn,
    });
    assert.equal(result.code, "preview");
    assert.deepEqual(launch.args, ["-I", "-X", "utf8", "-B", path.join(dataDir, "managed_project_workspace.py")]);
    assert.equal(launch.executable, "python-test");
    assert.deepEqual(launch.options, { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  } finally {
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
    assert.deepEqual(await readWorkspaceContext(folder), {
      status: "plain", memory: [".vivary/knowledge"], protected: [],
      privacy: { policy: "none", private: [], privateFiles: [],
        ignoreFiles: [".gitignore", ".vivary/.gitignore", ".vivary/knowledge/.gitignore"], privateCandidates: [] },
    });
  } finally {
    process.chdir(originalCwd);
    await rm(folder, { recursive: true, force: true });
  }
});

test("workspace context passes invalid settings through and refuses an unexpected answer", async () => {
  const answer = context => ({ runCreator: async () => ({ code: "context", context }) });
  assert.deepEqual(await readWorkspaceContext("/project", [], answer({ status: "invalid", message: "bad toml" })),
    { status: "invalid", message: "bad toml" });
  await assert.rejects(readWorkspaceContext("/project", [], answer({ status: "plain", roles: null, state: null,
    memory: ["../outside"], memory_assigned: false, protected: [], privacy_policy: "none", private: [],
    private_files: [], ignore_files: [], private_candidates: [] })));
  await assert.rejects(readWorkspaceContext("/project", [], { runCreator: async () => ({ code: "refused" }) }),
    /settings reader is unavailable/);
});
