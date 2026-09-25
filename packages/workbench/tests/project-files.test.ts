import assert from "node:assert/strict";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createProjectFileService, readFolder } from "../server/project-files.ts";
import {
  projectFileRenameInputSchema,
  projectFileSaveInputSchema,
  projectFilesInputSchema,
} from "../app/lib/project-file-schema.ts";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "vivary-project-files-"));
  roots.push(root);
  let revision = 1;
  let available = true;
  const workspace = () => ({ root, label: "Example", projectId: "project_a", bindingId: "binding_a",
    rootId: "root_a", bindingRevision: revision, policyRevision: 1 });
  const service = createProjectFileService(async (_context, projectId) => {
    if (!available || projectId !== "project_a") throw new Error("Project unavailable");
    return workspace();
  });
  return { root, service, revoke: () => { available = false; }, rebind: () => { revision += 1; } };
}

describe("project file boundary", () => {
  it("lists and reads bounded text including workspace TOML while hiding secret and dependency trees", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "README.md"), "# Hello\n");
    await writeFile(path.join(f.root, "workspace.toml"), "name = \"Example\"\n");
    await writeFile(path.join(f.root, ".env"), "SECRET=value\n");
    await mkdir(path.join(f.root, "node_modules"));
    await writeFile(path.join(f.root, "node_modules", "package.js"), "ignored\n");
    await writeFile(path.join(f.root, "image.png"), Buffer.from([0, 1, 2]));

    const listing = await f.service.get(undefined, "project_a");
    assert.equal(listing.code, "listing");
    if (listing.code !== "listing") return;
    assert.deepEqual(listing.files.map(file => file.path), ["image.png", "README.md", "workspace.toml"]);
    assert.deepEqual(listing.files.find(file => file.path === "workspace.toml"), {
      path: "workspace.toml", name: "workspace.toml", sizeBytes: 17,
      updatedAt: listing.files.find(file => file.path === "workspace.toml")?.updatedAt,
      access: "editable", kind: "toml",
    });
    assert.equal(listing.files.find(file => file.path === "image.png")?.access, "blocked");
    const read = await f.service.get(undefined, "project_a", "README.md");
    assert.equal(read.code, "file");
    if (read.code === "file") assert.equal(read.file.content, "# Hello\n");
  });

  it("saves normally and returns a new exact version", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "note.md"), "before\n");
    await chmod(path.join(f.root, "note.md"), 0o664);
    const opened = await f.service.get(undefined, "project_a", "note.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const result = await f.service.save(undefined, { projectId: "project_a", path: "note.md",
      expectedVersion: opened.file.version, content: "after\n" });
    assert.equal(result.code, "saved");
    assert.equal(await readFile(path.join(f.root, "note.md"), "utf8"), "after\n");
    assert.equal((await stat(path.join(f.root, "note.md"))).mode & 0o777, 0o664);
    if (result.code === "saved") assert.notEqual(result.file.version, opened.file.version);
  });

  it("serializes app saves so one stale writer conflicts", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "note.md"), "before\n");
    const opened = await f.service.get(undefined, "project_a", "note.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const results = await Promise.all([
      f.service.save(undefined, { projectId: "project_a", path: "note.md", expectedVersion: opened.file.version, content: "first\n" }),
      f.service.save(undefined, { projectId: "project_a", path: "note.md", expectedVersion: opened.file.version, content: "second\n" }),
    ]);
    assert.deepEqual(results.map(result => result.code).sort(), ["conflict", "saved"]);
    assert.ok(["first\n", "second\n"].includes(await readFile(path.join(f.root, "note.md"), "utf8")));
  });

  it("preserves externally changed bytes on save conflict", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "note.md"), "before\n");
    const opened = await f.service.get(undefined, "project_a", "note.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    await writeFile(path.join(f.root, "note.md"), "external\n");
    const result = await f.service.save(undefined, { projectId: "project_a", path: "note.md",
      expectedVersion: opened.file.version, content: "mine\n" });
    assert.deepEqual({ code: result.code, reason: result.code === "conflict" ? result.reason : null },
      { code: "conflict", reason: "changed" });
    assert.equal(await readFile(path.join(f.root, "note.md"), "utf8"), "external\n");
  });

  it("reports deletion and rename as conflict without recreating the original", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "note.md"), "before\n");
    const opened = await f.service.get(undefined, "project_a", "note.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    await rename(path.join(f.root, "note.md"), path.join(f.root, "moved.md"));
    const result = await f.service.save(undefined, { projectId: "project_a", path: "note.md",
      expectedVersion: opened.file.version, content: "mine\n" });
    assert.deepEqual(result, { code: "conflict", operation: "save", reason: "renamed-or-deleted", path: "note.md" });
    await assert.rejects(lstat(path.join(f.root, "note.md")), { code: "ENOENT" });
    assert.equal(await readFile(path.join(f.root, "moved.md"), "utf8"), "before\n");
  });

  it("blocks revoked and rebound roots before saving", async () => {
    const revoked = await fixture();
    await writeFile(path.join(revoked.root, "note.md"), "before\n");
    const first = await revoked.service.get(undefined, "project_a", "note.md");
    assert.equal(first.code, "file");
    if (first.code !== "file") return;
    revoked.revoke();
    await assert.rejects(revoked.service.save(undefined, { projectId: "project_a", path: "note.md",
      expectedVersion: first.file.version, content: "mine\n" }), /unavailable/);
    assert.equal(await readFile(path.join(revoked.root, "note.md"), "utf8"), "before\n");

    const rebound = await fixture();
    await writeFile(path.join(rebound.root, "note.md"), "before\n");
    const second = await rebound.service.get(undefined, "project_a", "note.md");
    assert.equal(second.code, "file");
    if (second.code !== "file") return;
    rebound.rebind();
    const conflict = await rebound.service.save(undefined, { projectId: "project_a", path: "note.md",
      expectedVersion: second.file.version, content: "mine\n" });
    assert.equal(conflict.code, "conflict");
    if (conflict.code === "conflict") assert.equal(conflict.reason, "changed");
  });

  it("blocks symlink directories and multiply linked files", async () => {
    const f = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "vivary-project-files-outside-"));
    roots.push(outside);
    await writeFile(path.join(outside, "outside.md"), "outside\n");
    await symlink(outside, path.join(f.root, "linked-dir"), "dir");
    await assert.rejects(f.service.get(undefined, "project_a", "linked-dir/outside.md"), /not available/);
    await writeFile(path.join(f.root, "note.md"), "one inode\n");
    await link(path.join(f.root, "note.md"), path.join(f.root, "alias.md"));
    const listing = await f.service.get(undefined, "project_a");
    assert.equal(listing.code, "listing");
    if (listing.code === "listing") {
      assert.equal(listing.files.find(file => file.path === "note.md")?.access, "blocked");
      assert.equal(listing.files.find(file => file.path === "alias.md")?.access, "blocked");
    }
  });

  it("renames within one directory and refuses destination collisions", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "note.md"), "hello\n");
    const opened = await f.service.get(undefined, "project_a", "note.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const outside = path.join(path.dirname(f.root), path.basename(f.root) + "-escape.txt");
    await assert.rejects(
      f.service.rename(undefined, { projectId: "project_a", path: "note.md",
        name: `../${path.basename(outside)}`, expectedVersion: opened.file.version }),
      error => error instanceof Error && error.message === "Choose a file inside the selected project."
        && "statusCode" in error && error.statusCode === 400,
    );
    assert.equal(await readFile(path.join(f.root, "note.md"), "utf8"), "hello\n");
    await assert.rejects(stat(outside), { code: "ENOENT" });
    const renamed = await f.service.rename(undefined, { projectId: "project_a", path: "note.md",
      name: "renamed.md", expectedVersion: opened.file.version });
    assert.equal(renamed.code, "renamed");
    assert.equal(await readFile(path.join(f.root, "renamed.md"), "utf8"), "hello\n");

    await writeFile(path.join(f.root, "other.md"), "other\n");
    const current = await f.service.get(undefined, "project_a", "renamed.md");
    assert.equal(current.code, "file");
    if (current.code !== "file") return;
    const collision = await f.service.rename(undefined, { projectId: "project_a", path: "renamed.md",
      name: "other.md", expectedVersion: current.file.version });
    assert.equal(collision.code, "conflict");
    if (collision.code === "conflict") assert.equal(collision.reason, "target-exists");
    assert.equal(await readFile(path.join(f.root, "renamed.md"), "utf8"), "hello\n");
    assert.equal(await readFile(path.join(f.root, "other.md"), "utf8"), "other\n");
  });

  it("normalizes denied directories and reports a same-directory file cap", async () => {
    const f = await fixture();
    await mkdir(path.join(f.root, "NODE_MODULES"));
    await writeFile(path.join(f.root, "NODE_MODULES", "hidden.ts"), "hidden\n");
    await Promise.all(Array.from({ length: 401 }, (_, index) =>
      writeFile(path.join(f.root, `visible-${String(index).padStart(3, "0")}.txt`), "visible\n")));
    const listing = await f.service.get(undefined, "project_a");
    assert.equal(listing.code, "listing");
    if (listing.code !== "listing") return;
    assert.equal(listing.files.length, 400);
    assert.equal(listing.truncated, true);
    assert.equal(listing.files.some(file => file.path.includes("NODE_MODULES")), false);
    await assert.rejects(f.service.get(undefined, "project_a", "NODE_MODULES/hidden.ts"), /not available/);
  });

  it("keeps spaced filenames distinct through read, save, and rename", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, " note.md"), "spaced\n");
    await writeFile(path.join(f.root, "note.md"), "plain\n");
    const readInput = projectFilesInputSchema.parse({ projectId: "project_a", path: " note.md" });
    assert.equal(readInput.path, " note.md");
    const opened = await f.service.get(undefined, readInput.projectId, readInput.path);
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const saveInput = projectFileSaveInputSchema.parse({ projectId: "project_a", path: " note.md",
      expectedVersion: opened.file.version, content: "changed\n" });
    assert.equal(saveInput.path, " note.md");
    const saved = await f.service.save(undefined, saveInput);
    assert.equal(saved.code, "saved");
    assert.equal(await readFile(path.join(f.root, "note.md"), "utf8"), "plain\n");
    if (saved.code !== "saved") return;
    const renameInput = projectFileRenameInputSchema.parse({ projectId: "project_a", path: " note.md",
      name: " moved.md", expectedVersion: saved.file.version });
    assert.deepEqual({ path: renameInput.path, name: renameInput.name }, { path: " note.md", name: " moved.md" });
    const renamed = await f.service.rename(undefined, renameInput);
    assert.equal(renamed.code, "renamed");
    assert.equal(await readFile(path.join(f.root, " moved.md"), "utf8"), "changed\n");
    assert.equal(await readFile(path.join(f.root, "note.md"), "utf8"), "plain\n");
  });

  it("bounds oversized files and preserves permissions during rename", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "large.txt"), Buffer.alloc(256 * 1024 + 1, 65));
    await writeFile(path.join(f.root, "script.sh"), "echo hello\n");
    await chmod(path.join(f.root, "script.sh"), 0o754);
    const listing = await f.service.get(undefined, "project_a");
    assert.equal(listing.code, "listing");
    if (listing.code !== "listing") return;
    assert.equal(listing.files.find(file => file.path === "large.txt")?.access, "blocked");
    assert.deepEqual(await f.service.get(undefined, "project_a", "large.txt"),
      { code: "blocked", path: "large.txt", reason: "too-large" });
    const opened = await f.service.get(undefined, "project_a", "script.sh");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const renamed = await f.service.rename(undefined, { projectId: "project_a", path: "script.sh",
      name: "moved.sh", expectedVersion: opened.file.version });
    assert.equal(renamed.code, "renamed");
    assert.equal((await stat(path.join(f.root, "moved.sh"))).mode & 0o777, 0o754);
  });

  it("renames UTF-8 BOM files without changing their bytes", async () => {
    const f = await fixture();
    const original = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# Note\n")]);
    await writeFile(path.join(f.root, "bom.md"), original);
    const opened = await f.service.get(undefined, "project_a", "bom.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const renamed = await f.service.rename(undefined, { projectId: "project_a", path: "bom.md",
      name: "moved.md", expectedVersion: opened.file.version });
    assert.equal(renamed.code, "renamed");
    assert.deepEqual(await readFile(path.join(f.root, "moved.md")), original);
  });

  it("create makes missing folders without following links and writes exclusively", async () => {
    const f = await fixture();
    const created = await f.service.create(undefined, { projectId: "project_a",
      path: ".vivary/knowledge/relay-budget.md", content: "# Relay budget\n" });
    assert.equal(created.code, "created");
    if (created.code !== "created") return;
    assert.equal(created.file.path, ".vivary/knowledge/relay-budget.md");
    assert.equal(await readFile(path.join(f.root, ".vivary", "knowledge", "relay-budget.md"), "utf8"),
      "# Relay budget\n");
    assert.equal((await stat(path.join(f.root, ".vivary", "knowledge", "relay-budget.md"))).mode & 0o777, 0o644);
    await assert.rejects(f.service.create(undefined, { projectId: "project_a", path: "notes/secret-plan.md",
      content: "x\n" }), /not available/);
    await assert.rejects(f.service.create(undefined, { projectId: "project_a", path: "notes/image.png",
      content: "x\n" }), /not available/);
  });

  it("create refuses a symlinked parent and returns target-exists for an existing file", async () => {
    const f = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "vivary-project-files-outside-"));
    roots.push(outside);
    await symlink(outside, path.join(f.root, "linked-dir"), "dir");
    await assert.rejects(f.service.create(undefined, { projectId: "project_a", path: "linked-dir/fact.md",
      content: "x\n" }), /not available/);
    await assert.rejects(stat(path.join(outside, "fact.md")), { code: "ENOENT" });

    await writeFile(path.join(f.root, "fact.md"), "existing\n");
    const existing = await f.service.create(undefined, { projectId: "project_a", path: "fact.md", content: "new\n" });
    assert.equal(existing.code, "conflict");
    if (existing.code === "conflict") {
      assert.equal(existing.reason, "target-exists");
      assert.equal(existing.current?.content, "existing\n");
    }
    assert.equal(await readFile(path.join(f.root, "fact.md"), "utf8"), "existing\n");
  });

  it("remove deletes one file after a matching version and never a folder", async () => {
    const f = await fixture();
    await mkdir(path.join(f.root, "facts"));
    await writeFile(path.join(f.root, "facts", "fact.md"), "fact\n");
    const opened = await f.service.get(undefined, "project_a", "facts/fact.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    await assert.rejects(f.service.remove(undefined, { projectId: "project_a", path: "facts",
      expectedVersion: opened.file.version }), /not available/);
    const removed = await f.service.remove(undefined, { projectId: "project_a", path: "facts/fact.md",
      expectedVersion: opened.file.version });
    assert.equal(removed.code, "removed");
    assert.equal(removed.code === "removed" && removed.path, "facts/fact.md");
    await assert.rejects(lstat(path.join(f.root, "facts", "fact.md")), { code: "ENOENT" });
    assert.equal((await lstat(path.join(f.root, "facts"))).isDirectory(), true);
  });

  it("remove returns changed, renamed-or-deleted, and project-changed conflicts", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "fact.md"), "before\n");
    const opened = await f.service.get(undefined, "project_a", "fact.md");
    assert.equal(opened.code, "file");
    if (opened.code !== "file") return;
    const input = { projectId: "project_a", path: "fact.md", expectedVersion: opened.file.version };
    await writeFile(path.join(f.root, "fact.md"), "external\n");
    const changed = await f.service.remove(undefined, input);
    assert.equal(changed.code === "conflict" && changed.reason, "changed");
    assert.equal(changed.code === "conflict" && changed.current?.content, "external\n");
    await rm(path.join(f.root, "fact.md"));
    assert.deepEqual(await f.service.remove(undefined, input),
      { code: "conflict", operation: "remove", reason: "renamed-or-deleted", path: "fact.md" });

    let call = 0;
    await writeFile(path.join(f.root, "fact.md"), "again\n");
    const moving = createProjectFileService(async () => ({ root: f.root, label: "Example", projectId: "project_a",
      bindingId: "binding_a", rootId: "root_a", bindingRevision: ++call, policyRevision: 1 }));
    const result = await moving.remove(undefined, { ...input, expectedVersion: opened.file.version });
    assert.equal(result.code === "conflict" && result.reason, "project-changed");
    assert.equal(await readFile(path.join(f.root, "fact.md"), "utf8"), "again\n");
  });

  it("readFolder skips links, hardlinks, secret names, binaries, and oversize files", async () => {
    const f = await fixture();
    const project = { projectId: "project_a", label: "Example", rootId: "root_a", bindingId: "binding_a",
      bindingRevision: 1, policyRevision: 1 };
    const folder = path.join(f.root, "facts");
    await mkdir(folder);
    await writeFile(path.join(folder, "b-fact.md"), "# B\n");
    await writeFile(path.join(folder, "a-fact.md"), "# A\n");
    await writeFile(path.join(folder, "notes.txt"), "not markdown\n");
    await writeFile(path.join(folder, "secret-plan.md"), "hidden\n");
    await writeFile(path.join(folder, "binary.md"), Buffer.from([0, 1, 2]));
    await writeFile(path.join(folder, "large.md"), Buffer.alloc(256 * 1024 + 1, 65));
    await writeFile(path.join(f.root, "outside.md"), "outside\n");
    await symlink(path.join(f.root, "outside.md"), path.join(folder, "linked.md"));
    await writeFile(path.join(f.root, "twin.md"), "twin\n");
    await link(path.join(f.root, "twin.md"), path.join(folder, "twin.md"));

    const read = await readFolder(f.root, "facts", project, 10);
    assert.equal(read.status, "ready");
    if (read.status !== "ready") return;
    assert.deepEqual(read.files.map(file => file.path), ["facts/a-fact.md", "facts/b-fact.md"]);
    assert.deepEqual(read.skipped, [
      { path: "facts/binary.md", reason: "binary" },
      { path: "facts/large.md", reason: "too-large" },
      { path: "facts/linked.md", reason: "linked" },
      { path: "facts/twin.md", reason: "linked" },
    ]);
    assert.equal(read.truncated, false);
    const capped = await readFolder(f.root, "facts", project, 1);
    assert.equal(capped.status === "ready" && capped.truncated, true);

    const outside = await mkdtemp(path.join(os.tmpdir(), "vivary-project-files-outside-"));
    roots.push(outside);
    await symlink(outside, path.join(f.root, "linked-facts"), "dir");
    assert.deepEqual(await readFolder(f.root, "linked-facts", project, 10), { status: "linked" });
    assert.deepEqual(await readFolder(f.root, "missing/facts", project, 10), { status: "absent" });
    assert.deepEqual(await readFolder(f.root, "outside.md", project, 10), { status: "not-folder" });
    assert.deepEqual(await readFolder(f.root, "outside.md/facts", project, 10), { status: "not-folder" });
    assert.deepEqual(await readFolder(f.root, "credentials/facts", project, 10), { status: "blocked" });
  });

  it("rejects reads when the project binding changes before return", async () => {
    const f = await fixture();
    await writeFile(path.join(f.root, "note.md"), "private\n");
    let call = 0;
    const changing = createProjectFileService(async () => ({ root: f.root, label: "Example", projectId: "project_a",
      bindingId: "binding_a", rootId: "root_a", bindingRevision: ++call, policyRevision: 1 }));
    await assert.rejects(changing.get(undefined, "project_a", "note.md"), /changed while its files were being read/);
  });
});
