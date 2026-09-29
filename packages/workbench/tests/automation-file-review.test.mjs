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
// The Settings review is Vivary's. Missing before #109, so the cases below find nothing to list or review instead of
// failing to load.
const REVIEW_MODULE = path.join(WORKBENCH, "server", "automation-file-review.ts");
const review = existsSync(REVIEW_MODULE) ? await import(pathToFileURL(REVIEW_MODULE).href) : null;

const REVIEW_NOTE = /waiting for the owner's review in Settings > Automation files/;
const ORG_ID = "org-review";
const ORG_OWNER = store.organizationResourceOwner(ORG_ID);
const admin = "admin@example.test";
const member = "member@example.test";
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
const listFor = viewer => (review ? review.listAutomationFilesForReview(viewer) : Promise.resolve([]));
const reviewAs = (viewer, input) => text(review
  ? review.reviewAutomationFile(viewer, input).then(() => "done")
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

await getDbExec().execute({
  sql: "CREATE TABLE IF NOT EXISTS org_members (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, joined_at INTEGER NOT NULL)",
  args: [],
});
for (const [email, role] of [[admin, "admin"], [member, "member"]]) {
  await getDbExec().execute({
    sql: "INSERT INTO org_members (id, org_id, email, role, joined_at) VALUES (?, ?, ?, ?, ?)",
    args: [`member-${role}`, ORG_ID, email, role, Date.now()],
  });
}

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
