import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Some providers reached through OpenRouter keep only the first nine characters of a tool-call id.
// The maintained Core patch makes replayed ids nine alphanumeric characters. Core's package entries
// do not export replayToolCallId or assistantUiMessagesToStructuredHistory, so load the installed,
// patched module by path.
const clientDir = path.dirname(fileURLToPath(import.meta.resolve("@agent-native/core/client")));
const { assistantUiMessagesToStructuredHistory, replayToolCallId } =
  await import(pathToFileURL(path.join(clientDir, "agent-chat-adapter.js")).href);

const idsIn = (value, found = []) => {
  if (Array.isArray(value)) value.forEach(item => idsIn(item, found));
  else if (value && typeof value === "object") {
    if (typeof value.toolCallId === "string") found.push({ type: value.type, id: value.toolCallId });
    Object.values(value).forEach(item => idsIn(item, found));
  }
  return found;
};

test("replay ids are nine alphanumeric characters with a history or continuation prefix", () => {
  assert.equal(replayToolCallId("h", 1), "h00000001");
  assert.equal(replayToolCallId("c", 36), "c00000010");
  for (const id of [replayToolCallId("h", 1), replayToolCallId("c", 2 ** 31)]) assert.match(id, /^[a-z0-9]{9}$/);
});

test("a turn with several tool calls replays ids that stay distinct in their first nine characters", () => {
  const calls = [1, 2, 3, 4, 5].map(n => ({ type: "tool-call", toolCallId: `provider-${n}`, toolName: "vivary-project-read",
    args: { report: "find" }, argsText: "{\"report\":\"find\"}", result: `{"matches":${n}}` }));
  const history = assistantUiMessagesToStructuredHistory([
    { role: "user", content: [{ type: "text", text: "Search this project for relay." }] },
    { role: "assistant", content: [{ type: "text", text: "Searching." }, ...calls, { type: "text", text: "The gamma relay." }] },
    { role: "user", content: [{ type: "text", text: "Remind me which relay." }] },
  ]);
  const ids = idsIn(history);
  const callIds = ids.filter(entry => entry.type === "tool-call").map(entry => entry.id);
  const resultIds = ids.filter(entry => entry.type === "tool-result").map(entry => entry.id);
  assert.equal(callIds.length, 5, "every tool call is replayed");
  for (const id of callIds) assert.match(id, /^[a-z0-9]{9}$/);
  assert.equal(new Set(callIds.map(id => id.slice(0, 9))).size, callIds.length, "ids differ within their first nine characters");
  assert.deepEqual([...resultIds].sort(), [...callIds].sort(), "each result pairs with its call");
});
