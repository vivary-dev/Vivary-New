import { execFileSync } from "node:child_process";
import { access, chmod, copyFile, cp, glob, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { packager } from "@electron/packager";
import { prepareWindowsX64Target } from "./windows-target.mjs";
import { prepareOriginalRuntime } from "./original-runtime.mjs";

const { values } = parseArgs({ options: { "windows-x64": { type: "boolean" } } });

const root = path.dirname(fileURLToPath(import.meta.url));
const workbench = path.resolve(root, "../workbench");
const repository = path.resolve(root, "../..");
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const stagingParent = path.join(root, ".tmp");
await access(path.join(workbench, ".output/server/index.mjs"));
await mkdir(stagingParent, { recursive: true });
const stage = await mkdtemp(path.join(stagingParent, "package-"));
const output = path.join(root, "dist", new Date().toISOString().replace(/[:.]/g, "-"));

try {
  const appDir = path.join(stage, "app");
  const runtimeDir = path.join(stage, "workbench");
  const nodeDir = path.join(stage, "node");
  await Promise.all([mkdir(appDir), mkdir(path.join(runtimeDir, "bin"), { recursive: true }), mkdir(nodeDir)]);
  await copyFile(path.join(root, "main.mjs"), path.join(appDir, "main.mjs"));
  await writeFile(path.join(appDir, "package.json"), JSON.stringify({
    name: "vivary", productName: "Vivary", version: manifest.version,
    private: true, type: "module", main: "main.mjs",
  }, null, 2));
  await cp(path.join(workbench, ".output"), path.join(runtimeDir, ".output"), { recursive: true, dereference: true });
  for (const file of ["start.mjs", "desktop-server.mjs"]) {
    await copyFile(path.join(workbench, "bin", file), path.join(runtimeDir, "bin", file));
  }
  await writeFile(path.join(runtimeDir, "package.json"), JSON.stringify({
    name: "@vivary/workbench", version: manifest.version, private: true, type: "module",
  }, null, 2));
  await copyFile(path.join(repository, "LICENSE"), path.join(appDir, "LICENSE"));
  const target = values["windows-x64"]
    ? await prepareWindowsX64Target({ runtimeDir, nodeDir })
    : {
      platform: process.platform, arch: process.arch, nodeVersion: process.version,
      nodeAbi: process.versions.modules,
      nodeExecutable: process.platform === "win32" ? "node.exe" : "node",
    };
  if (!values["windows-x64"]) {
    await copyFile(process.execPath, path.join(nodeDir, target.nodeExecutable));
    if (target.platform !== "win32") await chmod(path.join(nodeDir, target.nodeExecutable), 0o755);
  }

  const nodeLicense = await fetch(
    `https://raw.githubusercontent.com/nodejs/node/${target.nodeVersion}/LICENSE`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!nodeLicense.ok) throw new Error("Could not retrieve the bundled Node version's license.");
  await writeFile(path.join(nodeDir, "LICENSE"), await nodeLicense.text());

  const notices = ["Third-party notices from the locked Workbench dependency tree.\n"];
  const packageStore = path.join(workbench, "node_modules/.pnpm");
  const patterns = ["LICENSE*", "LICENCE*", "COPYING*", "NOTICE*"].flatMap(name => [
    path.join(packageStore, "*/node_modules/*", name).replaceAll(path.sep, "/"),
    path.join(packageStore, "*/node_modules/@*/*", name).replaceAll(path.sep, "/"),
  ]);
  for await (const file of glob(patterns)) {
    if (!(await stat(file)).isFile()) continue;
    const text = await readFile(file, "utf8");
    notices.push(`\n--- ${path.relative(packageStore, file).replaceAll(path.sep, "/")} ---\n${text}\n`);
  }
  await writeFile(path.join(runtimeDir, "THIRD-PARTY-NOTICES.txt"), notices.join(""));
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
  const sourceDirty = execFileSync("git", ["status", "--porcelain"], { cwd: repository, encoding: "utf8" }).trim().length > 0;
  const originalRuntimeDir = path.join(stage, "original-runtime");
  const originalRuntime = await prepareOriginalRuntime({
    destination: originalRuntimeDir, platform: target.platform, arch: target.arch,
    repository, sourceCommit, sourceDirty,
  });
  await writeFile(path.join(runtimeDir, "build.json"), JSON.stringify({
    product: "Vivary", version: manifest.version, sourceCommit, sourceDirty,
    platform: target.platform, architecture: target.arch, node: target.nodeVersion,
    nodeAbi: target.nodeAbi, electron: manifest.devDependencies.electron,
    buildHost: { platform: process.platform, architecture: process.arch },
    channel: "private-preview",
    originalRuntime: {
      manifest: "../original-runtime/manifest.json",
      python: originalRuntime.pythonVersion,
      components: originalRuntime.components.map(({ distribution, version }) => ({ distribution, version })),
    },
  }, null, 2));

  const built = await packager({
    dir: appDir, out: output, name: "Vivary", executableName: "vivary",
    appBundleId: "com.vivary.desktop", appVersion: manifest.version,
    win32metadata: { CompanyName: "Vivary", ProductName: "Vivary", FileDescription: "Vivary local desktop" },
    electronVersion: manifest.devDependencies.electron,
    platform: target.platform, arch: target.arch, asar: true,
    extraResource: [runtimeDir, nodeDir], overwrite: false,
    // Packager's default resource copy makes relative symlinks point at staging.
    // Keep Python's links relative so they survive staging cleanup and relocation.
    afterCopyExtraResources: [({ buildPath }) => cp(originalRuntimeDir,
      path.join(buildPath, "resources", "original-runtime"), { recursive: true, verbatimSymlinks: true })],
  });
  for (const directory of built) console.log(directory);
} finally {
  if (path.dirname(stage) !== stagingParent || !path.basename(stage).startsWith("package-")) {
    throw new Error("Refusing to clean an unexpected packaging directory.");
  }
  await rm(stage, { recursive: true, force: true });
}
