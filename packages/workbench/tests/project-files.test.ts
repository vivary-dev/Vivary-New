import assert from "node:assert/strict";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createProjectFileService } from "../server/project-files.ts";

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
});
