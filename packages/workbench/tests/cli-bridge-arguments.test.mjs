import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

// Vivary #111: Core's CLI bridge turns a tool call's arguments into argv for a script that reads
// them with parseArgs. A chat's script must read the names and values the model sent, and plan
// mode must approve the arguments the script then reads. Core's package entries do not export
// these modules, so load the installed, patched files by path.
const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-cli-bridge-"));
const database = `file:${path.join(caseRoot, "app.sqlite")}`;
Object.assign(process.env, {
  APP_NAME: "Vivary",
  NODE_ENV: "production",
  DATABASE_URL: database,
  DATABASE_URL_UNPOOLED: database,
});

const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [
  { createDbScriptEntries, createResourceScriptEntries },
  { createPlanModeActionRegistry },
  { runWithRequestContext },
  { resourceGetByPath },
] = await Promise.all([
  load("server/agent-chat/script-entries.js"),
  load("agent/production-agent.js"),
  load("server/request-context.js"),
  load("resources/store.js"),
]);
const Database = createRequire(path.join(coreRoot, "package.json"))("better-sqlite3");

const owner = "owner@example.test";
const chat = { caller: "tool" };
const asOwner = fn => runWithRequestContext({ userEmail: owner }, fn);
const outcome = promise => promise.then(String, error => `Error: ${error.message}`);
const stored = async resourcePath => (await resourceGetByPath(owner, resourcePath))?.content ?? null;

after(async () => {
  await rm(caseRoot, { recursive: true, force: true });
});

const { resources } = await createResourceScriptEntries();
const db = await createDbScriptEntries("read");
const call = (entry, args) => outcome(asOwner(() => entry.run(args, chat)));
const write = args => call(resources, { action: "write", ...args });

test("a chat stores content that starts with Markdown front matter", async () => {
  const content = "---\ntitle: Notes\ntags: [a=b]\n---\nBody.\n";
  assert.match(await write({ path: "notes/front-matter.md", content }), /Wrote resource: notes\/front-matter\.md/);
  assert.equal(await stored("notes/front-matter.md"), content);
});

test("a chat value that reads like another flag stays a value", async () => {
  const content = "--path=notes/from-value.md";
  assert.match(await write({ path: "notes/flag-value.md", content }), /Wrote resource: notes\/flag-value\.md/);
  assert.equal(await stored("notes/flag-value.md"), content);
  assert.equal(await stored("notes/from-value.md"), null);
});

test("declared arguments still reach the script", async () => {
  const result = await write({ path: "notes/declared.md", content: "kept", scope: "personal", visibility: "agent_scratch", mime: "text/markdown" });
  assert.match(result, /Wrote resource: notes\/declared\.md/);
  assert.equal(await stored("notes/declared.md"), "kept");
  const listed = await call(resources, { action: "list", prefix: "notes/declared", includeAgentScratch: true, format: "json" });
  assert.match(listed, /notes\/declared\.md/, "a boolean argument still lists agent scratch files");
});

test("a chat cannot pass an argument name the bridge would split or the tool does not declare", async () => {
  for (const [name, value] of [
    ["path=notes/crafted.md", "y"],
    ["-path", "notes/crafted.md"],
    ["--path", "notes/crafted.md"],
    ["created-by", "user"],
  ]) {
    const result = await write({ path: "notes/named.md", content: "x", [name]: value });
    assert.match(result, /^Error:/, `${name} is refused`);
  }
  assert.equal(await stored("notes/named.md"), null, "no crafted call wrote its declared path");
  assert.equal(await stored("notes/crafted.md"), null, "no crafted call wrote the crafted path");
});

test("db-query reads only the app database", async () => {
  assert.ok(db["db-query"], "read mode registers db-query");
  const other = path.join(caseRoot, "other.sqlite");
  const seeded = new Database(other);
  seeded.exec(`CREATE TABLE secret (marker TEXT, owner_email TEXT); INSERT INTO secret VALUES ('other-file-row', '${owner}');`);
  seeded.close();
  const query = args => call(db["db-query"], args);
  const fromOther = await query({ sql: "SELECT marker FROM secret LIMIT 1", limit: `--db=${other}` });
  assert.doesNotMatch(fromOther, /other-file-row/);
  assert.match(fromOther, /no such table: secret/, "the query ran against the app database");
  const created = path.join(caseRoot, "created.sqlite");
  await query({ sql: "PRAGMA user_version", limit: `--db=${created}` });
  assert.equal(existsSync(created), false, "a value cannot open or create another SQLite file");
  assert.match(await query({ sql: "SELECT 1", db: other }), /^Error: .*\bdb\b/, "the db name stays refused");
});

test("plan mode approves the arguments the script reads", async () => {
  assert.match(await write({ path: "notes/plan-visible.md", content: "visible" }), /Wrote resource/);
  assert.match(await write({ path: "notes/plan-hidden.md", content: "hidden-from-plan" }), /Wrote resource/);
  const planned = createPlanModeActionRegistry({ resources, "db-query": db["db-query"] });
  for (const args of [
    { action: "read", path: "notes/plan-visible.md", "path=notes/plan-hidden.md": "x" },
    { action: "read", path: "--path=notes/plan-hidden.md" },
  ]) {
    assert.doesNotMatch(await call(planned.resources, args), /hidden-from-plan/, JSON.stringify(args));
  }
  const created = path.join(caseRoot, "plan-created.sqlite");
  await call(planned["db-query"], { sql: "PRAGMA user_version", limit: `--db=${created}` });
  assert.equal(existsSync(created), false, "a plan-mode read cannot create a file");
});
