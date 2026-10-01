// Windows CI runs this file too, so the extended-length prefix, junction
// refusals, and the deep-tree sweep are proven on a real Windows file system.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { bytecodeFlag, pycachePrefixFlag } from "../server/python-bytecode.ts";

const BUILD = "3f9a0c12";
const freshState = () => ({ prepared: new Map(), logged: new Set() });
// A link the current user can always make: a junction on Windows, a symbolic link elsewhere.
const link = (target, at) => symlink(target, at, process.platform === "win32" ? "junction" : "dir");

async function folders(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vivary-bytecode-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5 }));
  const data = path.join(directory, "data");
  const install = path.join(directory, "install");
  await Promise.all([mkdir(data), mkdir(install)]);
  const prefix = async () => path.join(await realpath(data), "python-cache", BUILD);
  return { directory, data, install, bundle: { root: install, build: BUILD }, prefix };
}

async function stderrOf(run) {
  const lines = [];
  const original = console.error;
  console.error = line => { lines.push(String(line)); };
  try {
    return { result: await run(), lines };
  } finally {
    console.error = original;
  }
}

test("a launch keeps -B without a bundle, a valid build, or a usable absolute data folder", async t => {
  const f = await folders(t);
  const state = freshState();
  for (const [bundle, dataDir] of [
    [null, f.data],
    [{ root: f.install, build: "3f9a0c1" }, f.data],
    [{ root: f.install, build: "3f9a0c12a" }, f.data],
    [{ root: f.install, build: "3F9A0C12" }, f.data],
    [{ root: f.install, build: "../a0c12" }, f.data],
    [f.bundle, undefined],
    [f.bundle, "data"],
    [f.bundle, path.join(f.directory, "missing")],
  ]) {
    assert.equal(await bytecodeFlag(state, bundle, dataDir), "-B", JSON.stringify({ bundle, dataDir }));
  }
  assert.deepEqual(await readdir(f.data), [], "nothing was created");
});

test("the prefix is one argument, extended-length on Windows and plain elsewhere", () => {
  assert.equal(pycachePrefixFlag("C:\\Users\\Ann\\.vivary\\workbench\\python-cache\\3f9a0c12", path.win32),
    "-Xpycache_prefix=\\\\?\\C:\\Users\\Ann\\.vivary\\workbench\\python-cache\\3f9a0c12");
  assert.equal(pycachePrefixFlag("\\\\server\\share\\vivary\\python-cache\\3f9a0c12", path.win32),
    "-Xpycache_prefix=\\\\?\\UNC\\server\\share\\vivary\\python-cache\\3f9a0c12");
  assert.equal(pycachePrefixFlag("/home/ann/.vivary/workbench/python-cache/3f9a0c12", path.posix),
    "-Xpycache_prefix=/home/ann/.vivary/workbench/python-cache/3f9a0c12");
});

test("a bundle compiles into its build's private folder in the canonical data folder", async t => {
  const f = await folders(t);
  const flag = await bytecodeFlag(freshState(), f.bundle, f.data);
  const prefix = await f.prefix();
  assert.equal(flag, pycachePrefixFlag(prefix));
  // An empty value would turn the cache off without a word.
  assert.match(flag, process.platform === "win32" ? /^-Xpycache_prefix=\\\\\?\\.+/ : /^-Xpycache_prefix=\/.+/);
  for (const folder of [path.dirname(prefix), prefix]) {
    const info = await stat(folder);
    assert.ok(info.isDirectory(), folder);
    if (process.platform !== "win32") assert.equal(info.mode & 0o777, 0o700, folder);
  }
});

test("a cache inside the install folder or the call's project is refused once per process and writes nothing", async t => {
  const f = await folders(t);
  const inner = path.join(f.install, "data");
  await mkdir(inner);
  const state = freshState();
  const { lines } = await stderrOf(async () => {
    assert.equal(await bytecodeFlag(state, f.bundle, inner), "-B");
    for (let call = 0; call < 2; call++) assert.equal(await bytecodeFlag(state, f.bundle, f.data, f.data), "-B");
  });
  assert.deepEqual(await readdir(inner), [], "nothing was written in the install folder");
  assert.deepEqual(await readdir(f.data), [], "nothing was written in the project");
  assert.deepEqual(lines, ["[vivary-python-cache] refused inside=bundle", "[vivary-python-cache] refused inside=project"]);
  assert.equal(await bytecodeFlag(state, f.bundle, f.data, path.join(f.data, "projects", "Alpha")),
    pycachePrefixFlag(await f.prefix()), "a managed project inside the data folder does not hold the cache");
});

test("a link or a file where a cache folder belongs gives -B, writes nothing through it, and is retried", async t => {
  for (const plant of [
    async (data, outside) => link(outside, path.join(data, "python-cache")),
    async (data, outside) => {
      await mkdir(path.join(data, "python-cache"));
      await link(outside, path.join(data, "python-cache", BUILD));
    },
    async data => writeFile(path.join(data, "python-cache"), ""),
  ]) {
    const f = await folders(t);
    const outside = path.join(f.directory, "outside");
    await mkdir(outside);
    await plant(f.data, outside);
    const state = freshState();
    const { lines } = await stderrOf(async () => {
      for (let call = 0; call < 2; call++) assert.equal(await bytecodeFlag(state, f.bundle, f.data), "-B");
    });
    assert.deepEqual(lines, ["[vivary-python-cache] unavailable code=ENOTDIR"], "logged once per process");
    assert.deepEqual(await readdir(outside), [], "the link's target stays empty");
    await rm(path.join(f.data, "python-cache"), { recursive: true, force: true });
    assert.equal(await bytecodeFlag(state, f.bundle, f.data), pycachePrefixFlag(await f.prefix()),
      "the next launch prepares the cache again");
  }
});

test("the first launch removes other builds' folders and nothing else", async t => {
  const f = await folders(t);
  const root = path.join(f.data, "python-cache");
  const old = path.join(root, "a71d44e0");
  const deep = path.join(old, ...Array.from({ length: 6 }, (_, index) => `folder-${index}-${"x".repeat(40)}`), "module.pyc");
  const kept = path.join(f.directory, "kept");
  await mkdir(path.dirname(deep), { recursive: true });
  await writeFile(deep, "old build");
  assert.ok(deep.length > 300, "the old build holds a path past the Windows limit");
  await mkdir(path.join(root, "ABCDEF12"));
  await writeFile(path.join(root, "notes.txt"), "notes");
  await mkdir(kept);
  await writeFile(path.join(kept, "file"), "kept");
  await link(kept, path.join(root, "b0b0b0b0"));
  const state = freshState();
  const { result, lines } = await stderrOf(() => Promise.all([1, 2, 3, 4].map(() => bytecodeFlag(state, f.bundle, f.data))));
  assert.deepEqual(result, Array(4).fill(pycachePrefixFlag(await f.prefix())), "four concurrent first launches get the cache");
  assert.deepEqual(lines, ["[vivary-python-cache] removed build=a71d44e0"], "one sweep, one line per removed folder");
  assert.deepEqual((await readdir(root)).sort(), [BUILD, "ABCDEF12", "b0b0b0b0", "notes.txt"].sort());
  assert.equal(await readFile(path.join(kept, "file"), "utf8"), "kept", "the sweep never follows a link");
  await mkdir(old);
  assert.equal(await bytecodeFlag(state, f.bundle, f.data), pycachePrefixFlag(await f.prefix()));
  assert.ok((await stat(old)).isDirectory(), "a later launch in the same process does not sweep again");
});
