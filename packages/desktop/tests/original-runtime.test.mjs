import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

import {
  cacheVerifiedAsset,
  createOriginalRuntimeManifest,
  ORIGINAL_RUNTIME_COMPONENTS,
  ORIGINAL_RUNTIME_LICENSE_ASSET,
  originalRuntimeTarget,
  stageManagedProjectBridge,
  writeOriginalRuntimeLauncher,
} from "../original-runtime.mjs";

const execFile = promisify(execFileCallback);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const helper = path.resolve(testRoot, "../build-original-wheels.py");
const python = process.platform === "win32" ? "python" : "python3";

test("runtime targets pin fixed relocated interpreter paths and archive hashes", () => {
  const linux = originalRuntimeTarget("linux", "x64");
  const windows = originalRuntimeTarget("win32", "x64");
  assert.equal(linux.pythonExecutable, "python/bin/python3");
  assert.equal(windows.pythonExecutable, "python/python.exe");
  assert.equal(linux.pythonVersion, "3.12.14");
  assert.match(linux.asset.sha256, /^[a-f0-9]{64}$/);
  assert.match(windows.asset.sha256, /^[a-f0-9]{64}$/);
  assert.equal(ORIGINAL_RUNTIME_LICENSE_ASSET.size, 105_875);
  assert.equal(ORIGINAL_RUNTIME_LICENSE_ASSET.sha256, "e43fb936c6655d7996dba480d7ebdea492d6040ec388eb8ed9d1000f72de8cab");
  assert.throws(() => originalRuntimeTarget("darwin", "arm64"), /does not support/);
});

test("runtime cache replaces corrupt content and reuses only the verified hash", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vivary-runtime-cache-"));
  try {
    const content = Buffer.from("verified portable runtime fixture");
    const sha256 = createHash("sha256").update(content).digest("hex");
    const asset = { fileName: "runtime.tar.gz", url: "https://invalid.test/runtime", sha256 };
    await writeFile(path.join(directory, asset.fileName), "corrupt");
    let downloads = 0;
    const downloaded = await cacheVerifiedAsset(asset, {
      cacheDirectory: directory,
      fetchImpl: async () => {
        downloads++;
        return new Response(content);
      },
    });
    assert.deepEqual(await readFile(downloaded), content);
    await cacheVerifiedAsset(asset, {
      cacheDirectory: directory,
      fetchImpl: async () => assert.fail("A verified cache entry must not download again."),
    });
    assert.equal(downloads, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("relative launchers invoke the fixed bundled interpreter in isolated mode", async () => {
  for (const [platform, executable] of [
    ["linux", "python/bin/python3"],
    ["win32", "python/python.exe"],
  ]) {
    const destination = await mkdtemp(path.join(os.tmpdir(), "vivary-" + platform + "-launcher-"));
    try {
      const target = originalRuntimeTarget(platform, "x64");
      const interpreter = path.join(destination, ...executable.split("/"));
      await mkdir(path.dirname(interpreter), { recursive: true });
      await writeFile(interpreter, "fixture");
      const launcher = await writeOriginalRuntimeLauncher(destination, target);
      const text = await readFile(launcher, "utf8");
      assert.match(text, /-I -B -m vivary_cli/);
      assert.equal(text.includes(destination), false);
      if (platform === "linux") assert.equal((await stat(launcher)).mode & 0o111, 0o111);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  }
});

test("manifest records the runtime, source, exact component closure, and relative licenses", () => {
  const target = originalRuntimeTarget("linux", "x64");
  const components = ORIGINAL_RUNTIME_COMPONENTS.map(component => ({
    distribution: component.distribution,
    version: component.version,
    wheel: component.wheel,
    sha256: "a".repeat(64),
    licensePaths: ["python/lib/python3.12/site-packages/" + component.distInfo + "/licenses/LICENSE"],
  }));
  const manifest = createOriginalRuntimeManifest({
    target,
    sourceCommit: "f".repeat(40),
    sourceDirty: false,
    components,
    managedProjectBridge: {
      path: "bridge/managed_project_workspace.py",
      sha256: "b".repeat(64),
      licensePath: "licenses/LICENSE.vivary-new-managed-project-bridge",
    },
    runtimeLicensePaths: ["licenses/python-build-standalone.rst", "python/LICENSE.txt"],
  });
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.components.length, 7);
  assert.deepEqual(manifest.source, { commit: "f".repeat(40), dirty: false });
  assert.equal(manifest.runtimeAsset.release, "20260901");
  assert.equal(manifest.runtimeLicenseAsset.url, "https://raw.githubusercontent.com/astral-sh/python-build-standalone/20260901/python-licenses.rst");
  assert.equal(manifest.managedProjectBridge.path, "bridge/managed_project_workspace.py");
  assert.equal(manifest.managedProjectBridge.sha256, "b".repeat(64));
  assert.deepEqual(manifest.runtimeLicensePaths, ["licenses/python-build-standalone.rst", "python/LICENSE.txt"]);
  assert.equal(JSON.stringify(manifest).includes(os.tmpdir()), false);
});

test("managed project bridge is copied with a content hash and repository license", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "vivary-managed-bridge-"));
  try {
    const repository = path.join(fixture, "repository");
    const destination = path.join(fixture, "runtime");
    await mkdir(path.join(repository, "packages", "workbench", "server"), { recursive: true });
    await mkdir(destination, { recursive: true });
    const bridge = "def main():\n    return 'installed creator'\n";
    await writeFile(path.join(repository, "packages", "workbench", "server", "managed_project_workspace.py"), bridge);
    await writeFile(path.join(repository, "LICENSE"), "MIT fixture license\n");
    const entry = await stageManagedProjectBridge(destination, repository);
    assert.deepEqual(entry, {
      path: "bridge/managed_project_workspace.py",
      sha256: createHash("sha256").update(bridge).digest("hex"),
      licensePath: "licenses/LICENSE.vivary-new-managed-project-bridge",
    });
    assert.equal(await readFile(path.join(destination, ...entry.path.split("/")), "utf8"), bridge);
    assert.equal(await readFile(path.join(destination, ...entry.licensePath.split("/")), "utf8"), "MIT fixture license\n");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("runtime extraction rejects traversal before writing outside the destination", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "vivary-runtime-archive-"));
  try {
    const archive = path.join(fixture, "runtime.tar.gz");
    const destination = path.join(fixture, "runtime");
    const makeArchive = [
      "import io, tarfile, sys",
      "archive = tarfile.open(sys.argv[1], 'w:gz')",
      "data = b'escape'",
      "item = tarfile.TarInfo('../escape.txt')",
      "item.size = len(data)",
      "archive.addfile(item, io.BytesIO(data))",
      "archive.close()",
    ].join("\n");
    await execFile(python, ["-c", makeArchive, archive]);
    await assert.rejects(
      execFile(python, [
        helper,
        "extract-runtime",
        "--archive", archive,
        "--destination", destination,
        "--platform", "linux",
      ]),
      error => String(error.stderr).includes("unsafe archive member"),
    );
    await assert.rejects(
      stat(path.join(fixture, "escape.txt")),
      error => error.code === "ENOENT",
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("runtime extraction preserves the pinned python-relative layout and executable mode", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "vivary-runtime-safe-archive-"));
  try {
    const archive = path.join(fixture, "runtime.tar.gz");
    const destination = path.join(fixture, "runtime");
    const makeArchive = [
      "import io, tarfile, sys",
      "archive = tarfile.open(sys.argv[1], 'w:gz')",
      "items = [('python/bin/python3', b'python', 0o755), ('python/LICENSE.txt', b'license', 0o644)]",
      "for name, data, mode in items:",
      "    item = tarfile.TarInfo(name)",
      "    item.size = len(data)",
      "    item.mode = mode",
      "    archive.addfile(item, io.BytesIO(data))",
      "archive.close()",
    ].join("\n");
    await execFile(python, ["-c", makeArchive, archive]);
    await execFile(python, [
      helper,
      "extract-runtime",
      "--archive", archive,
      "--destination", destination,
      "--platform", "linux",
    ]);
    const executable = path.join(destination, "python", "bin", "python3");
    assert.equal(await readFile(executable, "utf8"), "python");
    assert.equal((await stat(executable)).mode & 0o111, 0o111);
    assert.equal(await readFile(path.join(destination, "python", "LICENSE.txt"), "utf8"), "license");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

const consoleEntries = [
  ["vivary-0.2.1.dist-info", "vivary"],
  ["create_vivary-0.4.4.dist-info", "create-vivary"],
  ["vivary_tropo-0.5.5.dist-info", "tropo"],
  ["vivary_strato-0.1.3.dist-info", "strato"],
  ["vivary_ozone-0.3.2.dist-info", "ozone"],
  ["vivary_exo-0.3.1.dist-info", "exo"],
];

async function launcherFixture(platform) {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "vivary-launcher-records-"));
  const sitePackages = platform === "win32"
    ? path.join(fixture, "python", "Lib", "site-packages")
    : path.join(fixture, "python", "lib", "python3.12", "site-packages");
  await mkdir(sitePackages, { recursive: true });
  for (const [distInfo, script] of consoleEntries) {
    const directory = path.join(sitePackages, distInfo);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "RECORD"), [
      distInfo + "/METADATA,sha256=fixture,1",
      "../../bin/" + script + ",sha256=stale,1",
      distInfo + "/direct_url.json,sha256=stale,1",
      distInfo + "/RECORD,,",
      "",
    ].join("\n"));
  }
  const coreInfo = "vivary_core-0.2.7.dist-info";
  await mkdir(path.join(sitePackages, coreInfo), { recursive: true });
  await writeFile(path.join(sitePackages, coreInfo, "direct_url.json"), "{}\n");
  await writeFile(path.join(sitePackages, coreInfo, "RECORD"), [
    coreInfo + "/METADATA,sha256=fixture,1",
    coreInfo + "/direct_url.json,sha256=stale,1",
    coreInfo + "/RECORD,,",
    "",
  ].join("\n"));
  if (platform === "win32") {
    await writeFile(path.join(fixture, "python", "python.exe"), "fixture");
    const copyStub = [
      "from pathlib import Path",
      "import pip._vendor.distlib as distlib",
      "source = Path(distlib.__file__).parent / 't64.exe'",
      "target = Path(__import__('sys').argv[1]) / 'pip' / '_vendor' / 'distlib' / 't64.exe'",
      "target.parent.mkdir(parents=True, exist_ok=True)",
      "target.write_bytes(source.read_bytes())",
    ].join("\n");
    await execFile(python, ["-c", copyStub, sitePackages]);
  } else {
    const interpreter = path.join(fixture, "python", "bin", "python3");
    await mkdir(path.dirname(interpreter), { recursive: true });
    await writeFile(interpreter, "fixture");
  }
  return { fixture, sitePackages };
}

test("component launchers stay relative and replace stale pip RECORD rows", async () => {
  for (const platform of ["linux", "win32"]) {
    const { fixture, sitePackages } = await launcherFixture(platform);
    try {
      await execFile(python, [
        helper,
        "write-launchers",
        "--runtime-root", fixture,
        "--site-packages", sitePackages,
        "--platform", platform,
      ]);
      const coreRecord = await readFile(path.join(sitePackages, "vivary_core-0.2.7.dist-info", "RECORD"), "utf8");
      assert.equal(coreRecord.includes("direct_url.json"), false);
      await assert.rejects(
        stat(path.join(sitePackages, "vivary_core-0.2.7.dist-info", "direct_url.json")),
        error => error.code === "ENOENT",
      );
      for (const [distInfo, script] of consoleEntries) {
        const relativeLauncher = platform === "win32"
          ? path.join("python", "Scripts", script + ".exe")
          : path.join("python", "bin", script);
        const launcher = path.join(fixture, relativeLauncher);
        const data = await readFile(launcher);
        if (platform === "win32") {
          assert.equal(data.subarray(0, 2).toString("ascii"), "MZ");
          assert.equal(data.includes(Buffer.from("#!<launcher_dir>\\..\\python.exe -I -B\n")), true);
        } else {
          assert.equal(data.includes(Buffer.from('exec "$SCRIPT_DIR/python3" -I -B')), true);
          assert.equal(data.includes(Buffer.from(fixture)), false);
          assert.equal((await stat(launcher)).mode & 0o111, 0o111);
        }
        const record = await readFile(path.join(sitePackages, distInfo, "RECORD"), "utf8");
        const expected = platform === "win32"
          ? "../../Scripts/" + script + ".exe,sha256="
          : "../../../bin/" + script + ",sha256=";
        assert.equal(record.includes(expected), true);
        assert.equal(record.includes("sha256=stale"), false);
        assert.equal(record.includes("direct_url.json"), false);
      }
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  }
});
