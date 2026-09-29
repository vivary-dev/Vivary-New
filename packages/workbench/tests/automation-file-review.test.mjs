import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Owner decision (Vivary #109, 2026-09-28 and 2026-09-29): an instruction or memory file that an automation run
// writes waits for the owner's review. Chats and later runs do not load it until the owner accepts it in Settings >
// Automation files, and a chat sees only how many files wait. Core's package entries do not export these modules, so
// load the installed, patched files by path.
const caseRoot = await mkdtemp(path.join(os.tmpdir(), "vivary-automation-file-review-"));
const database = `file:${path.join(caseRoot, "resources.sqlite")}`;
Object.assign(process.env, {
  APP_NAME: "Vivary",
  NODE_ENV: "production",
  DATABASE_URL: database,
  DATABASE_URL_UNPOOLED: database,
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKBENCH = path.join(HERE, "..");
const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const [
  { restrictActionsForUnattendedRun },
  { createResourceScriptEntries },
  { runWithRequestContext },
  store,
  { loadResourcesForPrompt },
  { resolveSkillReferenceContent },
  { resolveAutomationExecutionIdentity },
  { getDbExec },
] = await Promise.all([
  load("jobs/unattended-surface.js"),
  load("server/agent-chat/script-entries.js"),
  load("server/request-context.js"),
  load("resources/store.js"),
  load("server/agent-chat/prompt-resources.js"),
  load("agent/production-agent.js"),
  load("automations/service.js"),
  load("db/client.js"),
]);
// The Settings review is Vivary's action. Missing before #109, so the cases below find nothing to list or review
// instead of failing to load.
const REVIEW_ACTION = path.join(WORKBENCH, "actions", "vivary-automation-files.ts");
const review = existsSync(REVIEW_ACTION) ? (await import(pathToFileURL(REVIEW_ACTION).href)).default : null;

const REVIEW_NOTE = /waiting for the owner's review in Settings > Automation files/;
const ORG_ID = "org-review";
const ORG_OWNER = store.organizationResourceOwner(ORG_ID);
const admin = "admin@example.test";
const entries = await createResourceScriptEntries();
// The context Core's agent loop gives a tool call in an automation run.
const RUN = { runId: "job-probe-1", threadId: "t-run-1", automation: "probe" };

after(async () => {
  await rm(caseRoot, { recursive: true, force: true });
});

const text = result => Promise.resolve(result).then(String, error => `Error: ${error.message}`);
function asRun(identity, tool, args, run = RUN) {
  const restricted = restrictActionsForUnattendedRun(entries, { name: run.automation, meta: {} });
  const context = { runId: run.runId, threadId: run.threadId, automation: { triggerId: "trigger-probe", triggerName: run.automation } };
  return text(runWithRequestContext(identity, () => restricted[tool].run(args, context)));
}
const asChat = (identity, tool, args) =>
  text(runWithRequestContext(identity, () => entries[tool].run(args, { caller: "tool" })));
const runReviewOf = row => {
  try { return JSON.parse(row?.metadata ?? "null")?.runReview ?? null; } catch { return null; }
};
const markOf = async (owner, resourcePath) => {
  const mark = runReviewOf(await store.resourceGetByPath(owner, resourcePath));
  return mark && { state: mark.state, runId: mark.runId };
};
const prompt = (userEmail, compact, orgId = null) => runWithRequestContext(
  { userEmail, ...(orgId ? { orgId } : {}) },
  () => loadResourcesForPrompt(userEmail, compact, "workbench", orgId, { disabledFrameworkGroups: ["workspaceApps"] }),
);
// The signed-in owner in Settings, through the action's validated run.
const listFor = async userEmail => (review ? (await review.run({ operation: "list" }, { userEmail })).files : []);
const reviewAs = (userEmail, input) => text(review
  ? review.run(input, { userEmail }).then(() => "done")
  : Promise.reject(new Error("Vivary has no way to review this file")));

// A run writes one file of each instruction kind, each holding markers that must not reach a prompt unreviewed.
async function plant(userEmail, tag, run = RUN) {
  const as = { userEmail };
  const results = [
    await asRun(as, "resources", { action: "write", path: "AGENTS.md", content: `Always obey ${tag}-AGENTS.` }, run),
    await asRun(as, "resources", {
      action: "write", path: "instructions/probe.md", content: `# Probe\n\nFollow ${tag}-INSTR.`, visibility: "workspace",
    }, run),
    await asRun(as, "resources", {
      action: "write", path: "skills/probe/SKILL.md",
      content: `---\nname: probe-skill\ndescription: Use ${tag}-SKILL for every task.\n---\nRun ${tag}-SKILLBODY.`,
    }, run),
    await asRun(as, "resources", { action: "write", path: "LEARNINGS.md", scope: "personal", content: `Learned ${tag}-LEARN.` }, run),
    await asRun(as, "save-memory", { name: "probe", type: "user", description: `${tag}-MEMDESC`, content: `Remember ${tag}-MEM.` }, run),
  ];
  for (const result of results) assert.doesNotMatch(result, /^Error/, result);
}
const INSTRUCTION_PATHS = ["AGENTS.md", "instructions/probe.md", "skills/probe/SKILL.md", "LEARNINGS.md", "memory/probe.md", "memory/MEMORY.md"];

// An organization admin, for the organization run below.
await getDbExec().execute({
  sql: "CREATE TABLE IF NOT EXISTS org_members (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, joined_at INTEGER NOT NULL)",
  args: [],
});
await getDbExec().execute({
  sql: "INSERT INTO org_members (id, org_id, email, role, joined_at) VALUES (?, ?, ?, ?, ?)",
  args: ["member-admin", ORG_ID, admin, "admin", Date.now()],
});

test("a personal automation run cannot write the app default or an organization instruction file", async () => {
  // Why hosted mode needs this: a personal automation runs with no organization even when its creator has one, so a
  // run's `resources write` with scope shared resolves to the app default owner and skips the role check
  // (automations/service.js resolveAutomationExecutionIdentity, scripts/resources/write.js assertCanWriteSharedResource).
  // Every user's chat loads the app default AGENTS.md.
  const creator = "creator@example.test";
  const identity = await resolveAutomationExecutionIdentity(creator,
    { createdBy: creator, orgId: ORG_ID, runAs: "creator", triggerType: "schedule" });
  assert.equal(identity.ok, true);
  assert.equal(identity.identity.orgId, undefined, "a personal automation runs with no organization");

  await store.resourcePut(store.SHARED_OWNER, "AGENTS.md", "App default rules.", "text/markdown");
  const sharedBefore = async resourcePath => (await store.resourceGetByPath(store.SHARED_OWNER, resourcePath))?.content ?? null;
  const before = Object.fromEntries(await Promise.all(["AGENTS.md", "LEARNINGS.md", "skills/team/SKILL.md", "instructions/team.md"]
    .map(async resourcePath => [resourcePath, await sharedBefore(resourcePath)])));
  for (const args of [
    { action: "write", path: "AGENTS.md", scope: "shared", content: "Every user obeys HOSTED-AGENTS." },
    { action: "write", path: "LEARNINGS.md", content: "Every user learns HOSTED-LEARN." },
    { action: "write", path: "skills/team/SKILL.md", scope: "shared", content: "---\nname: team\ndescription: HOSTED-SKILL\n---\n" },
    { action: "write", path: "instructions/team.md", scope: "shared", content: "HOSTED-INSTR", visibility: "workspace" },
  ]) {
    assert.match(await asRun({ userEmail: creator }, "resources", args), /^Error: Automation runs cannot write/, args.path);
    assert.equal(await sharedBefore(args.path), before[args.path], `the app default ${args.path} is unchanged`);
  }

  // An organization automation runs as its creator inside the organization. An admin may write organization files
  // from a chat, but a run may not, because every member loads them.
  const orgRun = await asRun({ userEmail: admin, orgId: ORG_ID }, "resources",
    { action: "write", path: "AGENTS.md", scope: "shared", content: "Every member obeys HOSTED-ORG." });
  assert.match(orgRun, /^Error: Automation runs cannot write/);
  assert.equal(await store.resourceGetByPath(ORG_OWNER, "AGENTS.md"), null, "no organization AGENTS.md was written");

  // Other shared files and the run's own instruction files stay writable.
  assert.match(await asRun({ userEmail: creator }, "resources",
    { action: "write", path: "notes/team.md", scope: "shared", content: "Team notes." }), /Wrote resource: notes\/team\.md/);
  assert.match(await asRun({ userEmail: creator }, "resources",
    { action: "write", path: "AGENTS.md", content: "Creator notes." }), /Wrote resource: AGENTS\.md/);
});

test("every write an automation run makes records the run, and an instruction write waits for review", async () => {
  const owner = "origin@example.test";
  await asChat({ userEmail: owner }, "save-memory", { name: "old", type: "user", description: "old fact", content: "Old fact." });
  await plant(owner, "ORIGIN");
  assert.doesNotMatch(await asRun({ userEmail: owner }, "delete-memory", { name: "old" }), /^Error/);
  assert.match(await asRun({ userEmail: owner }, "resources", { action: "write", path: "notes/probe.md", content: "Run notes." }),
    /Wrote resource/);

  for (const resourcePath of INSTRUCTION_PATHS) {
    const row = await store.resourceGetByPath(owner, resourcePath);
    assert.ok(row, `${resourcePath} exists`);
    assert.deepEqual({ createdBy: row.createdBy, runId: row.runId, threadId: row.threadId },
      { createdBy: "agent", runId: RUN.runId, threadId: RUN.threadId }, `${resourcePath} records the run`);
    const mark = runReviewOf(row);
    assert.deepEqual(mark && { state: mark.state, runId: mark.runId, automation: mark.automation },
      { state: "pending", runId: RUN.runId, automation: RUN.automation }, `${resourcePath} waits for review`);
    assert.equal(mark.writtenAt, row.updatedAt, `${resourcePath} records when the run wrote it`);
  }
  const notes = await store.resourceGetByPath(owner, "notes/probe.md");
  assert.deepEqual({ createdBy: notes.createdBy, runId: notes.runId, threadId: notes.threadId },
    { createdBy: "agent", runId: RUN.runId, threadId: RUN.threadId }, "a note records the run");
  assert.equal(runReviewOf(notes), null, "a note is not an instruction file, so it does not wait");
});

test("a chat loads no file a run wrote until review and sees only how many wait", async () => {
  const owner = "chat@example.test";
  await plant(owner, "CHAT");
  const compact = await prompt(owner, true);
  const full = await prompt(owner, false);
  for (const [label, body] of [["compact", compact], ["full", full]]) {
    for (const marker of ["CHAT-AGENTS", "CHAT-INSTR", "CHAT-SKILL", "CHAT-MEMDESC", "instructions/probe.md", "skills/probe/SKILL.md"]) {
      assert.ok(!body.includes(marker), `the ${label} prompt holds no ${marker}`);
    }
    assert.match(body, REVIEW_NOTE, `the ${label} prompt says files wait`);
    const note = body.split("\n").find(line => REVIEW_NOTE.test(line));
    assert.ok(!/probe|CHAT/.test(note), "the note names no path and no text");
  }
  // AGENTS.md, the instruction file, and the skill in both modes. The memory index loads only in full mode.
  assert.match(compact, /3 instruction or memory files written by automation runs are waiting/);
  assert.match(full, /4 instruction or memory files written by automation runs are waiting/);

  await runWithRequestContext({ userEmail: owner }, async () => {
    assert.equal(await resolveSkillReferenceContent({ source: "resource", path: "skills/probe/SKILL.md" }), null,
      "the skill is not applied");
  });
  for (const resourcePath of INSTRUCTION_PATHS) {
    for (const scope of [undefined, "personal"]) {
      const read = await asChat({ userEmail: owner }, "resources", { action: "read", path: resourcePath, ...(scope ? { scope } : {}) });
      assert.match(read, REVIEW_NOTE, `a chat reading ${resourcePath} gets the review note`);
      assert.ok(!read.includes("CHAT-"), `a chat reading ${resourcePath} gets no text`);
    }
  }
});

test("a later automation run loads no file an earlier run wrote", async () => {
  const owner = "run@example.test";
  await plant(owner, "CHAIN");
  // The scheduler's and the dispatcher's getSystemPrompt build a run's prompt with loadResourcesForPrompt for the
  // owner, the same loader a chat uses.
  const plugin = await readFile(path.join(coreRoot, "dist", "server", "agent-chat-plugin.js"), "utf8");
  assert.equal(plugin.split("loadResourcesForPrompt(owner, lazyContext, options?.appId, undefined, { disabledFrameworkGroups: unattendedPromptGroups })").length - 1, 2);
  const runPrompt = await runWithRequestContext({ userEmail: owner }, () =>
    loadResourcesForPrompt(owner, true, "workbench", undefined, { disabledFrameworkGroups: ["workspaceApps"] }));
  assert.ok(!runPrompt.includes("CHAIN-AGENTS"), "the next run's prompt holds no planted AGENTS.md");
  assert.ok(!runPrompt.includes("CHAIN-SKILL"), "the next run's prompt holds no planted skill");
  assert.match(runPrompt, REVIEW_NOTE);
  const read = await asRun({ userEmail: owner }, "resources", { action: "read", path: "AGENTS.md" }, { ...RUN, runId: "job-probe-2" });
  assert.match(read, REVIEW_NOTE, "the next run reading AGENTS.md gets the review note");
});

test("a later chat or owner edit keeps the file waiting", async () => {
  const owner = "edit@example.test";
  await plant(owner, "EDIT");
  const waiting = { state: "pending", runId: RUN.runId };
  assert.deepEqual(await markOf(owner, "AGENTS.md"), waiting, "the run's AGENTS.md waits");

  // A chat's write keeps the mark, even with arguments that name another run or metadata.
  assert.match(await asChat({ userEmail: owner }, "resources",
    { action: "write", path: "AGENTS.md", content: "Chat edit EDIT-CHATWRITE.", runId: "cleared", metadata: "{}" }), /Wrote resource/);
  assert.deepEqual(await markOf(owner, "AGENTS.md"), waiting, "a chat's write keeps the mark");
  assert.doesNotMatch(await asChat({ userEmail: owner }, "save-memory",
    { name: "chat", type: "user", description: "EDIT-CHATMEM", content: "Chat memory." }), /^Error/);
  assert.deepEqual(await markOf(owner, "memory/MEMORY.md"), waiting, "a chat's memory save keeps the index waiting");

  // The owner's Resources panel sends the content alone, or metadata the client chose.
  await store.resourcePut(owner, "AGENTS.md", "Owner edit EDIT-OWNER.", "text/markdown");
  assert.deepEqual(await markOf(owner, "AGENTS.md"), waiting, "an owner edit is not a review");
  await store.resourcePut(owner, "AGENTS.md", "Owner edit EDIT-OWNER.", "text/markdown",
    { metadata: JSON.stringify({ runReview: { state: "accepted" } }) });
  assert.deepEqual(await markOf(owner, "AGENTS.md"), waiting, "metadata from a caller cannot clear the mark");

  const compact = await prompt(owner, true);
  for (const marker of ["EDIT-CHATWRITE", "EDIT-OWNER", "EDIT-CHATMEM"]) assert.ok(!compact.includes(marker), marker);
});

test("accept loads the file from then on, and a stale accept changes nothing", async () => {
  const owner = "accept@example.test";
  await plant(owner, "ACCEPT");
  assert.ok(!(await prompt(owner, true)).includes("ACCEPT-AGENTS"), "the file waits before accept");
  const listed = (await listFor(owner)).find(file => file.path === "AGENTS.md");
  assert.ok(listed, "Settings lists the run's AGENTS.md");
  assert.equal(listed.content, "Always obey ACCEPT-AGENTS.");
  assert.deepEqual((await listFor(owner)).map(file => file.path).sort(), [...INSTRUCTION_PATHS].sort());

  assert.match(await reviewAs(owner, { operation: "accept", id: listed.id, updatedAt: listed.updatedAt - 1 }),
    /This file changed\. Reload the list\./);
  // A chat edit between the list and the click is a change too.
  await asChat({ userEmail: owner }, "resources", { action: "write", path: "AGENTS.md", content: "Always obey ACCEPT-AGENTS. And ACCEPT-LATE." });
  assert.match(await reviewAs(owner, { operation: "accept", id: listed.id, updatedAt: listed.updatedAt }),
    /This file changed\. Reload the list\./);
  assert.equal(runReviewOf(await store.resourceGetByPath(owner, "AGENTS.md"))?.state, "pending", "a refused accept changes nothing");

  const current = (await listFor(owner)).find(file => file.path === "AGENTS.md");
  assert.equal(await reviewAs(owner, { operation: "accept", id: current.id, updatedAt: current.updatedAt }), "done");
  const accepted = runReviewOf(await store.resourceGetByPath(owner, "AGENTS.md"));
  assert.deepEqual({ state: accepted.state, runId: accepted.runId, acceptedBy: accepted.acceptedBy },
    { state: "accepted", runId: RUN.runId, acceptedBy: owner });
  assert.match(await prompt(owner, true), /ACCEPT-LATE/, "the accepted file loads");
  assert.match(await asChat({ userEmail: owner }, "resources", { action: "read", path: "AGENTS.md" }), /ACCEPT-LATE/);
  assert.ok(!(await listFor(owner)).some(file => file.path === "AGENTS.md"), "an accepted file leaves the list");
  // Settings reviews only waiting files, so it cannot delete an accepted one.
  const acceptedRow = await store.resourceGetByPath(owner, "AGENTS.md");
  assert.match(await reviewAs(owner, { operation: "delete", id: acceptedRow.id, updatedAt: acceptedRow.updatedAt }),
    /This file is no longer waiting for review/);
  assert.ok(await store.resourceGetByPath(owner, "AGENTS.md"), "the accepted file stays");
  // The store's accept also refuses a file that no longer waits, whoever calls it.
  assert.equal(await store.resourceAcceptRunReviewIfCurrent(
    { id: acceptedRow.id, updatedAt: acceptedRow.updatedAt, acceptedBy: owner }), false);

  // A later run write waits again.
  await asRun({ userEmail: owner }, "resources", { action: "write", path: "AGENTS.md", content: "Always obey ACCEPT-SECOND." },
    { ...RUN, runId: "job-probe-2" });
  assert.deepEqual(await markOf(owner, "AGENTS.md"), { state: "pending", runId: "job-probe-2" });
  assert.ok(!(await prompt(owner, true)).includes("ACCEPT-SECOND"), "a second run's write waits again");
});

test("delete removes the whole file, and a stale delete changes nothing", async () => {
  const owner = "delete@example.test";
  await plant(owner, "DELETE");
  const listed = (await listFor(owner)).find(file => file.path === "skills/probe/SKILL.md");
  assert.ok(listed, "Settings lists the run's skill");
  assert.match(await reviewAs(owner, { operation: "delete", id: listed.id, updatedAt: listed.updatedAt + 1 }),
    /This file changed\. Reload the list\./);
  assert.ok(await store.resourceGetByPath(owner, "skills/probe/SKILL.md"), "a refused delete keeps the file");
  assert.equal(await reviewAs(owner, { operation: "delete", id: listed.id, updatedAt: listed.updatedAt }), "done");
  assert.equal(await store.resourceGetByPath(owner, "skills/probe/SKILL.md"), null);
  assert.ok(!(await listFor(owner)).some(file => file.path === "skills/probe/SKILL.md"));
  assert.ok(!(await prompt(owner, true)).includes("DELETE-SKILL"));
});

test("only the owner sees and reviews a file", async () => {
  const ownerA = "a@example.test";
  const ownerB = "b@example.test";
  await plant(ownerA, "PERM");
  const file = (await listFor(ownerA)).find(item => item.path === "AGENTS.md");
  assert.ok(file, "A sees its own file");
  assert.ok(!(await listFor(ownerB)).some(item => item.id === file.id), "B does not see A's file");
  for (const operation of ["accept", "delete"]) {
    assert.match(await reviewAs(ownerB, { operation, id: file.id, updatedAt: file.updatedAt }),
      /This file is no longer waiting for review/, `B cannot ${operation} it by id`);
  }
  assert.deepEqual(await markOf(ownerA, "AGENTS.md"), { state: "pending", runId: RUN.runId }, "B changed nothing");
});

test("the run surface marks writes, and Settings is the only way to review", async () => {
  const surface = await readFile(path.join(coreRoot, "dist", "jobs", "unattended-surface.js"), "utf8");
  // assert.ok keeps a failure from printing the whole source file.
  assert.ok(/runWithRequestContext\(\{[\s\S]{0,200}automationRun: \{[\s\S]{0,200}runId: context\?\.runId/.test(surface),
    "each kept tool runs with the run's origin in its request context");
  const plugin = await readFile(path.join(coreRoot, "dist", "server", "agent-chat-plugin.js"), "utf8");
  assert.ok(/for \(const r of resourceSkills\) \{\s*(\/\/[^\n]*\n\s*)*if \(isPendingRunReview\(r\)\)\s*continue;/.test(plugin),
    "the slash-skill menu leaves out a waiting skill");
  const actionFile = path.join(WORKBENCH, "actions", "vivary-automation-files.ts");
  assert.ok(existsSync(actionFile), "Vivary has a Settings action for the review");
  const action = await readFile(actionFile, "utf8");
  assert.ok(/requiresAuth: true, agentTool: false, mcpTool: false, toolCallable: false,/.test(action),
    "no chat, MCP client, or run can call it");
  const ownerActions = await readFile(path.join(WORKBENCH, "shared", "owner-actions.ts"), "utf8");
  assert.ok(ownerActions.includes('"vivary-automation-files"'), "the private proxy transport reaches it");
});
