import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { startRootProvider } from "../server/root-provider.mjs";
import { parseStrictJson } from "../../../scripts/registry_contract_model.mjs";

const [base, entryFile, pythonPath] = process.argv.slice(2);
if (![base, entryFile, pythonPath].every((value) => typeof value === "string" && path.isAbsolute(value))) {
  throw new Error("explicit absolute proof, provider and interpreter paths are required");
}
const python = await realpath(pythonPath);
const digest = (data) => createHash("sha256").update(data).digest("hex");
async function setup() {
  const root = await mkdtemp(path.join(base, "wire-read-"));
  const scope = path.join(root, "projects");
  const state = path.join(root, "private");
  await mkdir(scope);
  await mkdir(state);
  const locations = {};
  for (const ref of ["a", "b"]) {
    locations[ref] = path.join(scope, ref);
    await mkdir(locations[ref]);
    await writeFile(path.join(locations[ref], "note.txt"), ref + " original\n");
  }
  locations.alias = locations.a;
  const config = { deviceId: "read-device", scope, statePath: path.join(state, "roots.json"), locations };
  const metadata = async () => Promise.all((await readdir(state)).sort().map(async (name) => {
    const file = path.join(state, name);
    const info = await stat(file, { bigint: true });
    return { name, digest: digest(await readFile(file)), inode: info.ino.toString(),
      mode: info.mode.toString(), mtime: info.mtimeNs.toString(), ctime: info.ctimeNs.toString() };
  }));
  return { root, config, metadata, start: () => startRootProvider({ python, entryFile, config, parseStrictJson }) };
}

test("real private inspect wire leaves unenrolled and enrolled metadata unchanged", async () => {
  const f = await setup();
  let provider;
  try {
    provider = await f.start();
    const initial = await f.metadata();
    assert.deepEqual(initial.map((item) => item.name), ["roots.json.lock"]);
    for (const ref of ["a", "b", "alias", "a"]) {
      const available = await provider.inspect(ref);
      assert.equal(available.code, "available");
      assert.equal(available.rootId, null);
      assert.equal(available.locationRef, ref);
    }
    assert.deepEqual(await f.metadata(), initial);
    const enrolled = await provider.observe("a");
    assert.equal(enrolled.code, "observed");
    const saved = await f.metadata();
    assert.equal((await provider.inspect("a")).rootId, enrolled.rootId);
    assert.equal((await provider.inspect("alias")).rootId, enrolled.rootId);
    assert.equal((await provider.inspect("b")).rootId, null);
    assert.deepEqual(await f.metadata(), saved);
    assert.ok(!(await readFile(f.config.statePath, "utf8")).includes("alias"));
    for (const ref of ["a", "b"]) {
      assert.deepEqual(await readdir(f.config.locations[ref]), ["note.txt"]);
      assert.equal(await readFile(path.join(f.config.locations[ref], "note.txt"), "utf8"), ref + " original\n");
    }
    await provider.close();
    provider = await f.start();
    assert.equal((await provider.inspect("a")).code, "identity-unverified");
    assert.equal((await provider.inspect("b")).code, "identity-unverified");
    assert.deepEqual(await f.metadata(), saved);
  } finally { await provider?.close(); await rm(f.root, { recursive: true }); }
});

test("inspection and enrollment replies cannot cross operations", async () => {
  const f = await setup();
  try {
    for (const [operation, responseCode, rootId] of [
      ["inspect", "observed", "root_" + "a".repeat(32)],
      ["observe", "available", null],
      ["inspect", "available", "lifetime-private-id"],
    ]) {
      const wrong = path.join(f.root, "cross-operation.py");
      const response = { version: 1, sequence: 1, code: responseCode, rootId,
        locationRef: "a", contentRevision: "content" };
      await writeFile(wrong, 'import sys,json\nsys.stdin.readline()\n'
        + 'print(json.dumps({"version":1,"sequence":0,"code":"ready"}), flush=True)\n'
        + 'sys.stdin.readline()\nprint(' + JSON.stringify(JSON.stringify(response)) + ', flush=True)\n');
      const provider = await startRootProvider({ python, entryFile: wrong, config: f.config, parseStrictJson });
      try {
        assert.equal((await provider[operation]("a")).code, "identity-unverified");
        assert.equal(provider.readiness().status, "unavailable");
      } finally { await provider.close(); }
    }
  } finally { await rm(f.root, { recursive: true }); }
});
