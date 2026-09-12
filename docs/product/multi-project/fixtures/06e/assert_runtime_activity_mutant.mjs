import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TEST = "/app/tests/runtime-activity-component.test.mjs";
const TARGET = "replaced reference remounts the Native renderer";
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

export function assertKilledMutant(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  assert.equal(stderr, "");
  assert.equal((stdout.match(/^# START replaced reference remounts the Native renderer$/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^# FAIL replaced reference remount code=ERR_ASSERTION message="replaced reference remount"$/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^# TEMP_MODULE_CLEANUP fileRemoved=true directoryRemoved=true$/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^# MESSAGE_CHANNEL_CLEANUP channels=\d+ portsClosed=\d+$/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^# PASS runtime activity component cleanup nodeWorkers=1 esbuildServices=1 esbuildStopped=true globalsRestored=true$/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^# BUNDLE_INPUTS \{"schemaVersion":1,/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^not ok 1 - Conversation renders only current bounded Native run activity$/gm) ?? []).length, 1);
  assert.equal((stdout.match(/^ok \d+ - /gm) ?? []).length, 0);
  assert.equal((stdout.match(/^not ok \d+ - /gm) ?? []).length, 1);

  const outerStart = stdout.indexOf("not ok 1 - Conversation renders only current bounded Native run activity");
  assert.ok(outerStart >= 0);
  const outer = stdout.slice(outerStart);
  assert.match(outer, /\n\s+error: 'replaced reference remount'\n/);
  assert.match(outer, /\n\s+code: 'ERR_ASSERTION'\n/);
  assert.match(outer, /\n\s+name: 'AssertionError'\n/);
  assert.match(outer, /\n1\.\.1\n/);
  assert.match(outer, /\n# tests 1\n/);
  assert.match(outer, /\n# pass 0\n/);
  assert.match(outer, /\n# fail 1\n/);
  assert.match(outer, /\n# cancelled 0\n/);
  assert.match(outer, /\n# skipped 0\n/);
  assert.match(outer, /\n# todo 0\n/);
  assert.doesNotMatch(stdout, /timed out|ETIMEDOUT|ERR_CHILD_PROCESS_STDIO_MAXBUFFER/i);
  assert.doesNotMatch(stdout, /^# PASS replaced reference remounts the Native renderer$/m);
}

function run() {
  for (const name of [
    "VIVARY_TEST_COMPONENT_DEPENDENCY_MANIFEST",
    "VIVARY_TEST_CORE_PACKAGE_JSON",
  ]) {
    assert.ok(process.env[name]?.startsWith("/"), `missing absolute environment input: ${name}`);
  }
  const result = spawnSync("/usr/bin/node", ["--test", "--test-reporter=tap", TEST], {
    cwd: "/app",
    env: {
      PATH: "/usr/bin:/bin",
      HOME: "/home/test",
      TMPDIR: "/tmp",
      LANG: "C.UTF-8",
      NODE_ENV: "test",
      VIVARY_TEST_COMPONENT_DEPENDENCY_MANIFEST:
        process.env.VIVARY_TEST_COMPONENT_DEPENDENCY_MANIFEST,
      VIVARY_TEST_CORE_PACKAGE_JSON: process.env.VIVARY_TEST_CORE_PACKAGE_JSON,
      VIVARY_RUNTIME_ACTIVITY_COMPONENT_TARGET_CASE: TARGET,
    },
    encoding: "utf8",
    timeout: 65_000,
    maxBuffer: MAX_CAPTURE_BYTES,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  assertKilledMutant(result);
  process.stdout.write("PASS missing renderer key mutant killed exact remount assertion\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
