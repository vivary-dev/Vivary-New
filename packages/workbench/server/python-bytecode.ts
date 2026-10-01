import { lstat, mkdir, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";

/**
 * The one bytecode argument a Python child gets after `-I -X utf8`. It is a
 * single argument, so `-m` stays at index 4 and a command's verb at index 6.
 */
export type BytecodeFlag = "-B" | `-Xpycache_prefix=${string}`;
/** A bundled runtime's canonical install folder and its build, from `resolveOriginalRuntime`. */
export type Bundle = { root: string; build: string };
/**
 * Per-process cache state. The original runner keeps it on its process-wide
 * host, because the server loads that module twice. `prepared` holds one
 * preparation per cache folder, and `logged` the lines already printed.
 */
export type BytecodeState = { prepared: Map<string, Promise<boolean>>; logged: Set<string> };

const CACHE_FOLDER = "python-cache";
const BUILD = /^[0-9a-f]{8}$/;

/**
 * Never throws. A bundle with a usable data folder compiles into
 * `<data>/python-cache/<build>`. Anything else keeps `-B`, including a Python
 * outside the bundle, which a prefix would cut off from its own `__pycache__`.
 * `project` is the folder a creator call works on.
 */
export async function bytecodeFlag(state: BytecodeState, bundle: Bundle | null, dataDir: string | undefined,
  project?: string): Promise<BytecodeFlag> {
  if (!bundle || !BUILD.test(bundle.build) || !dataDir || !path.isAbsolute(dataDir)) return "-B";
  const data = await realpath(dataDir).catch(() => undefined);
  if (!data) return "-B";
  const prefix = path.join(data, CACHE_FOLDER, bundle.build);
  // A cache in the install folder would write into the bundle, and one in the
  // project would let that project's tools change what the next command runs.
  const holder = containsPath(bundle.root, prefix) ? "bundle" : project && containsPath(project, prefix) ? "project" : undefined;
  if (holder) {
    logOnce(state, `[vivary-python-cache] refused inside=${holder}`);
    return "-B";
  }
  let pending = state.prepared.get(prefix);
  if (!pending) state.prepared.set(prefix, pending = prepareCache(state, prefix));
  if (await pending) return pycachePrefixFlag(prefix);
  // A failed preparation is dropped, so the next launch tries again.
  if (state.prepared.get(prefix) === pending) state.prepared.delete(prefix);
  return "-B";
}

/**
 * CPython mirrors each source's absolute path under the prefix. On Windows the
 * extended-length spelling, `\\?\C:\...` or `\\?\UNC\...`, lets those paths pass
 * 260 characters where long paths are off.
 */
export function pycachePrefixFlag(directory: string, flavor: typeof path.posix = path): BytecodeFlag {
  return `-Xpycache_prefix=${flavor.toNamespacedPath(directory)}`;
}

/**
 * Creates `python-cache` and the build folder without writing through a link,
 * then removes other builds' folders. The build folder exists before any child
 * starts, so CPython's `set_data`, which climbs to the nearest existing parent,
 * never reaches a bare `\\?\C:` root.
 */
async function prepareCache(state: BytecodeState, prefix: string): Promise<boolean> {
  const root = path.dirname(prefix);
  try {
    for (const folder of [root, prefix]) {
      await mkdir(folder, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      // lstat reports a link or a Windows junction as a link, never as a directory.
      if (!(await lstat(folder)).isDirectory()) {
        logOnce(state, "[vivary-python-cache] unavailable code=ENOTDIR");
        return false;
      }
    }
    await sweepOtherBuilds(root, path.basename(prefix));
    return true;
  } catch (error) {
    logOnce(state, `[vivary-python-cache] unavailable code=${(error as NodeJS.ErrnoException).code ?? "unknown"}`);
    return false;
  }
}

/** Removes each other build's folder. Files, links, junctions, and other names stay. */
async function sweepOtherBuilds(root: string, build: string): Promise<void> {
  for (const name of await readdir(root)) {
    if (name === build || !BUILD.test(name)) continue;
    const folder = path.join(root, name);
    if (!(await lstat(folder).catch(() => undefined))?.isDirectory()) continue;
    // Windows refuses to delete a file a running child holds open. That folder goes at a later server start.
    if (await rm(folder, { recursive: true, force: true, maxRetries: 3 }).then(() => true, () => false)) {
      console.error(`[vivary-python-cache] removed build=${name}`);
    }
  }
}

function containsPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function logOnce(state: BytecodeState, line: string): void {
  if (state.logged.has(line)) return;
  state.logged.add(line);
  console.error(line);
}
