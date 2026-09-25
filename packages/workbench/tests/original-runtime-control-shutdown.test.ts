import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createOriginalCommandRunner, runOriginalProcess, shutdownOriginalCommands } from "../server/original-runtime";
import { context, fixture, projectWorkspace, scheduling } from "./original-runtime-harness.ts";

test("a queued control command writes no request, and shutdown resolves after the running one's is gone", async () => {
  const f = await fixture();
  const request = JSON.stringify({ operation: "expire_leases", state: { claims: [] }, input: { now: "2026-09-14T12:00:00Z" } });
  const ready = path.join(f.directory, "ready");
  const requests = () => readdir(path.join(f.data, "original-runtime"), { recursive: true })
    .then(entries => entries.filter(entry => String(entry).endsWith("request.json")), () => [] as string[]);
  const run = createOriginalCommandRunner({ parallelism: 4,
    environment: () => ({ VIVARY_ORIGINAL_RUNTIME: f.runtime, VIVARY_DATA_DIR: f.data }),
    resolveWorkspace: async () => projectWorkspace("project-a", f.root),
    execute: (_python, _args, stdin, cwd, environment, signal) => runOriginalProcess(process.execPath,
      ["-e", `require("node:fs").writeFileSync(${JSON.stringify(ready)},"ready");setInterval(()=>{},1000)`],
      stdin, cwd, environment, signal) });
  // Control writes, so one command runs and the other waits for the project.
  const control = () => run({ projectId: "project-a", command: { verb: "control", request } }, context);
  const outcomes = Promise.allSettled([control(), control()]);
  try {
    let started = false;
    for (let attempt = 0; attempt < 40 && !started; attempt++) {
      try { await readFile(ready); started = true; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(started, true, "one control child started");
    assert.equal((await requests()).length, 1, "the running command has its request file, and the queued one has none");
    await shutdownOriginalCommands();
    assert.deepEqual(await requests(), [], "no request file remains when shutdown resolves");
    const messages = (await outcomes).map(outcome => outcome.status === "rejected" ? String(outcome.reason?.message) : "succeeded");
    assert.ok(messages.some(message => message.includes("The original command was stopped"))
      && messages.some(message => message.includes("New original commands cannot start")), messages.join(" | "));
  } finally {
    await f.cleanup();
  }
});
