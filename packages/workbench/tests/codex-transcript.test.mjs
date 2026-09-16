import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileFunction } from "node:vm";

const workbench = fileURLToPath(new URL("../", import.meta.url));
// guard:allow-env-credential - Disposable test paths and fixture behavior, not credentials.
const core = process.env.VIVARY_CORE_TEST_ROOT ?? path.join(workbench, "node_modules/@agent-native/core");
const { normalizeCodeAgentTranscript, isCredentialGapCodeAgentEvent } = await import(
  pathToFileURL(path.join(core, "dist/code-agents/transcript-normalizer.js")));
async function loadFunctions(file, names, dependencies) {
  const source = (await readFile(path.join(core, file), "utf8"))
    .replace(/^import [\s\S]*?;\n/gm, "").replace(/^export /gm, "");
  return compileFunction(`${source}\nreturn {${names.join(",")}};`, Object.keys(dependencies), {
    filename: path.join(core, file),
  })(...Object.values(dependencies));
}
const dependencies = { normalizeCodeAgentTranscript, isCredentialGapCodeAgentEvent };
const { codeAgentTranscriptEventsToContent } = await loadFunctions("dist/client/code-agent-chat-adapter.js",
  ["codeAgentTranscriptEventsToContent"], dependencies);
const { buildRepositoryFromCodeAgentTranscript } = await loadFunctions("dist/agent/thread-data-builder.js",
  ["buildRepositoryFromCodeAgentTranscript"], dependencies);
const require = createRequire(path.join(workbench, "package.json"));
const { jsx, jsxs } = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");
const renderer = await readFile(path.join(core, "dist/client/chat/message-components.js"), "utf8");
const cardSource = renderer.slice(renderer.indexOf("export function CodeAgentActivityCard("),
  renderer.indexOf("export function AssistantMessage(")).replace(/^export /, "");
assert.ok(cardSource.startsWith("function CodeAgentActivityCard("));
const Card = compileFunction(`${cardSource}\nreturn CodeAgentActivityCard;`, ["_jsx", "_jsxs"])(jsx, jsxs);
let sequence = 0;
function event(message, metadata, kind = "system") {
  const id = `event-${++sequence}`;
  return { schemaVersion: 1, id, runId: "run-main", kind, message,
    createdAt: "2026-09-16T00:00:00.000Z", metadata: { source: "codex-app-server", ...metadata } };
}
const assistant = (text, itemId, phase) => event(text, { role: "assistant", itemId, phase });
function restoredContent(events) {
  return buildRepositoryFromCodeAgentTranscript(events).messages
    .filter(entry => entry.message.role === "assistant").flatMap(entry => entry.message.content);
}

test("commentary is progress, final and unknown phases remain normal answers, live and reopened match", () => {
  const events = [event("Work", {}, "user"), assistant("Inspecting the file.", "a", "commentary"),
    assistant("Verifying the edit.", "b", "commentary"), assistant("The file is updated.", "c", "final_answer")];
  const content = codeAgentTranscriptEventsToContent(events);
  assert.deepEqual(content.map(part => part.type), ["data", "data", "text"]);
  assert.deepEqual(content.filter(part => part.type === "data").map(part => part.data.kind), ["progress", "progress"]);
  assert.deepEqual(restoredContent(events), content);
  assert.deepEqual(codeAgentTranscriptEventsToContent([assistant("Legacy answer", "old", undefined)]),
    [{ type: "text", text: "Legacy answer" }]);
  assert.equal(content.some(part => part.data?.kind === "subagent"), false);
});

test("actual collab events update one card by native identity without losing other agents", () => {
  const metadata = { type: "subagent", itemId: "collab-1", senderThreadId: "main-thread",
    receiverThreadIds: ["child-a", "child-b"], tool: "spawnAgent", status: "inProgress",
    agentsStates: { "child-a": { status: "running" }, "child-b": { status: "running" } } };
  const events = [event("Delegating checks", metadata, "status"),
    assistant("I am checking the result.", "comment", "commentary"),
    event("Checks finished", { ...metadata, status: "completed", agentsStates: {
      "child-a": { status: "completed", message: "Read succeeded" }, "child-b": { status: "errored", message: "Missing fixture" },
    } }, "status")];
  const normalized = normalizeCodeAgentTranscript(events);
  assert.equal(normalized.items.filter(item => item.type === "activity" && item.activity.kind === "subagent").length, 1);
  const content = codeAgentTranscriptEventsToContent(events);
  const activity = content[0].data;
  assert.equal(activity.senderThreadId, "main-thread");
  assert.deepEqual(activity.agents.map(agent => [agent.id, agent.status]), [["child-a", "completed"], ["child-b", "errored"]]);
  assert.deepEqual(restoredContent(events), content);
});

test("reused native IDs in separate turns do not overwrite earlier activity", () => {
  const events = [event("First", {}, "user"), assistant("First progress", "same", "commentary"),
    event("Second", {}, "user"), assistant("Second progress", "same", "commentary")];
  const content = codeAgentTranscriptEventsToContent(events);
  assert.deepEqual(content.map(part => part.data.text), ["First progress", "Second progress"]);
});

test("native activity display is bounded, expandable, and escapes text", () => {
  const events = [assistant("<script>bad()</script> " + "x".repeat(20000), "long", "commentary")];
  const part = codeAgentTranscriptEventsToContent(events)[0];
  assert.ok(part.data.text.length < 12100);
  assert.match(part.data.text, /Display truncated/);
  const html = renderToStaticMarkup(jsx(Card, { part }));
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /aria-label="Progress"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-code-activity="progress"/);
  assert.match(html, /max-height:16rem/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(Card({ part: { type: "data", name: "unrelated", data: {} } }), null);
});

test("subagent card identifies actual native agent and its status", () => {
  const part = codeAgentTranscriptEventsToContent([event("Check complete", { type: "subagent", itemId: "collab",
    senderThreadId: "main", receiverThreadIds: ["real-child"], tool: "wait", status: "completed",
    agentsStates: { "real-child": { status: "completed", message: "No failure" } } }, "status")])[0];
  const html = renderToStaticMarkup(jsx(Card, { part }));
  assert.match(html, /data-code-activity="subagent"/);
  assert.match(html, /real-child/);
  assert.match(html, /completed/);
  assert.match(renderer, /case "data":[\s\S]*?CodeAgentActivityCard/);
});
