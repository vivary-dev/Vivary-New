import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";
import { createOriginalCommandRunner, shutdownOriginalCommands } from "../server/original-runtime";
import { context, fixture, projectWorkspace } from "./original-runtime-harness.ts";

test("shutdown waits for a control request being written, and no request remains", async () => {
  const f = await fixture();
  const request = JSON.stringify({ operation: "expire_leases", state: { claims: [] }, input: { now: "2026-09-14T12:00:00Z" } });
  const requests = () => fs.readdir(path.join(f.data, "original-runtime"), { recursive: true })
    .then(entries => entries.filter(entry => String(entry).endsWith("request.json")), () => [] as string[]);
  // Hold the request write, so shutdown begins while it is in flight.
  const writeFile = fs.writeFile;
  let reachedWrite!: () => void;
  let releaseWrite!: () => void;
  const atWrite = new Promise<void>(resolve => { reachedWrite = resolve; });
  const writing = new Promise<void>(resolve => { releaseWrite = resolve; });
  fs.writeFile = (async (...args: Parameters<typeof writeFile>) => {
    if (String(args[0]).endsWith("request.json")) { reachedWrite(); await writing; }
    return writeFile(...args);
  }) as typeof writeFile;
  syncBuiltinESMExports();
  const run = createOriginalCommandRunner({ parallelism: 4,
    environment: () => ({ VIVARY_ORIGINAL_RUNTIME: f.runtime, VIVARY_DATA_DIR: f.data }),
    resolveWorkspace: async () => projectWorkspace("project-a", f.root),
    execute: () => { throw new Error("no child may start once shutdown began"); } });
  const outcome = run({ projectId: "project-a", command: { verb: "control", request } }, context)
    .then(() => "succeeded", (error: Error) => error.message);
  try {
    await atWrite;
    let resolved = false;
    const shutdown = shutdownOriginalCommands().then(() => { resolved = true; });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(resolved, false, "shutdown waits while the control request is being written");
    releaseWrite();
    await shutdown;
    assert.deepEqual(await requests(), [], "no request file remains when shutdown resolves");
    assert.match(await outcome, /New original commands cannot start/);
  } finally {
    fs.writeFile = writeFile;
    syncBuiltinESMExports();
    await f.cleanup();
  }
});
