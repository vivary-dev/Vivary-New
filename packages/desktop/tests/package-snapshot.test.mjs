import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { snapshotTrackedRepository } from "../package.mjs";

const git = (repository, args) => execFileSync("git", args, { cwd: repository, stdio: "ignore" });

test("packaging source snapshot is immutable and records tracked overlays", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vivary-package-snapshot-"));
  const repository = path.join(directory, "repository");
  const stagedSource = path.join(repository, ".tmp", "package-source");
  const tracked = path.join(repository, "tracked.txt");
  try {
    await mkdir(repository);
    git(repository, ["init"]);
    git(repository, ["config", "user.email", "packaging@example.test"]);
    git(repository, ["config", "user.name", "Packaging Test"]);
    await writeFile(tracked, "committed\n");
    git(repository, ["add", "tracked.txt"]);
    git(repository, ["commit", "-m", "fixture"]);
    await mkdir(stagedSource, { recursive: true });

    const cleanDestination = path.join(directory, "clean-snapshot");
    const clean = await snapshotTrackedRepository(stagedSource, cleanDestination);
    await writeFile(tracked, "changed after clean snapshot\n");
    assert.equal(await readFile(path.join(cleanDestination, "tracked.txt"), "utf8"), "committed\n");
    assert.equal(clean.sourceDirty, false);
    assert.equal(clean.kind, "git-archive");
    assert.equal(clean.trackedOverlayCount, 0);

    await writeFile(tracked, "dirty snapshot value\n");
    await writeFile(path.join(repository, "untracked.txt"), "excluded\n");
    const dirtyDestination = path.join(directory, "dirty-snapshot");
    const dirty = await snapshotTrackedRepository(stagedSource, dirtyDestination);
    await writeFile(tracked, "changed after dirty snapshot\n");
    assert.equal(await readFile(path.join(dirtyDestination, "tracked.txt"), "utf8"), "dirty snapshot value\n");
    await assert.rejects(readFile(path.join(dirtyDestination, "untracked.txt")), { code: "ENOENT" });
    assert.equal(dirty.sourceCommit, clean.sourceCommit);
    assert.equal(dirty.sourceDirty, true);
    assert.equal(dirty.kind, "git-archive-with-tracked-overlays");
    assert.equal(dirty.trackedOverlayCount, 1);

    await rm(tracked);
    const deletedDestination = path.join(directory, "deleted-snapshot");
    const deleted = await snapshotTrackedRepository(stagedSource, deletedDestination);
    await assert.rejects(readFile(path.join(deletedDestination, "tracked.txt")), { code: "ENOENT" });
    assert.equal(deleted.sourceDirty, true);
    assert.equal(deleted.kind, "git-archive-with-tracked-overlays");
    assert.equal(deleted.trackedOverlayCount, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
