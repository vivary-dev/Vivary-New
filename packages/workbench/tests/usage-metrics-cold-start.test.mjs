import assert from "node:assert/strict";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";

const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-usage-metrics-cold-start-"));
const database = `file:${path.join(caseRoot, "usage.sqlite")}`;
Object.assign(process.env, {
  APP_NAME: "Vivary",
  NODE_ENV: "test",
  DATABASE_URL: database,
  DATABASE_URL_UNPOOLED: database,
});

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const [{ listAppUsageMetrics }, { getDbExec }] = await Promise.all([
  import(pathToFileURL(path.join(coreRoot, "dist", "usage", "metrics-store.js")).href),
  import(pathToFileURL(path.join(coreRoot, "dist", "db", "client.js")).href),
]);

after(async () => rm(caseRoot, { recursive: true, force: true }));

test("usage metrics initialize an empty local database", async () => {
  const before = await getDbExec().execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'token_usage'",
    args: [],
  });
  assert.equal(before.rows.length, 0);

  const metrics = await listAppUsageMetrics(
    { scope: "me", sinceDays: 30 },
    { ownerEmail: "owner@example.test", orgId: null, app: "workbench" },
  );
  assert.equal(metrics.totals.calls, 0);
  assert.deepEqual(metrics.byLabel, []);
  assert.deepEqual(metrics.byModel, []);
  assert.deepEqual(metrics.recent, []);

  const afterCall = await getDbExec().execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'token_usage'",
    args: [],
  });
  assert.equal(afterCall.rows.length, 1);
});
