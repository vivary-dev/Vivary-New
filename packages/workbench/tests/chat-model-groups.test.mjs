import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// The maintained Core patch makes a provider and model the user chose the default for a new Native
// chat. Core does not export this module, so load the installed, patched copy.
const clientDir = path.dirname(fileURLToPath(import.meta.resolve("@agent-native/core/client")));
const { buildChatModelGroups } = await import(pathToFileURL(path.join(clientDir, "chat-model-groups.js")).href);

const engines = [
  { name: "anthropic", label: "Claude", supportedModels: ["claude-haiku-4-5-20251001", "claude-sonnet-5"], requiredEnvVars: ["ANTHROPIC_API_KEY"] },
  { name: "ai-sdk:openai", label: "OpenAI", supportedModels: ["gpt-5.6-luna", "gpt-5.6-sol"], requiredEnvVars: ["OPENAI_API_KEY"] },
  { name: "ai-sdk:openrouter", label: "OpenRouter", supportedModels: ["openai/gpt-5.6-luna", "anthropic/claude-opus-4.8"], requiredEnvVars: ["OPENROUTER_API_KEY"] },
];
const listed = (groups, model) => groups.filter(group => group.models.includes(model)).map(group => group.engine);

test("a chosen custom OpenRouter model leads the picker and becomes the new-chat default", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: ["OPENAI_API_KEY", "OPENROUTER_API_KEY"],
    currentEngineName: "ai-sdk:openrouter", currentModel: "stealth/space-bunny-alpha", currentChosen: true });
  assert.equal(groups[0].engine, "ai-sdk:openrouter");
  assert.equal(groups[0].models[0], "stealth/space-bunny-alpha");
  assert.ok(groups[0].models.includes("openai/gpt-5.6-luna"), "built-in models stay selectable");
  assert.ok(groups.some(group => group.engine === "ai-sdk:openai"), "other configured providers stay listed");
});

test("a chosen model already in the built-in list moves first without a duplicate", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: ["OPENROUTER_API_KEY"],
    currentEngineName: "ai-sdk:openrouter", currentModel: "anthropic/claude-opus-4.8", currentChosen: true });
  assert.equal(groups[0].models[0], "anthropic/claude-opus-4.8");
  assert.equal(groups[0].models.filter(model => model === "anthropic/claude-opus-4.8").length, 1);
});

test("a chosen provider without a key does not become the default or list its model", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: ["OPENAI_API_KEY"],
    currentEngineName: "ai-sdk:openrouter", currentModel: "stealth/space-bunny-alpha", currentChosen: true });
  assert.equal(groups.find(group => group.configured)?.engine, "ai-sdk:openai");
  assert.deepEqual(listed(groups, "stealth/space-bunny-alpha"), []);
});

test("a detected engine keeps core's order, so detection never picks the model", () => {
  const options = { engines, configuredKeys: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
    currentEngineName: "anthropic", currentModel: "claude-sonnet-5" };
  const detected = buildChatModelGroups({ ...options, currentChosen: false });
  assert.deepEqual(detected, buildChatModelGroups(options), "detected is the same as no signal");
  assert.equal(detected[0].engine, "ai-sdk:openai");
});

test("a model reported for an engine without a key is not added to its group", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: [],
    currentEngineName: "anthropic", currentModel: "gpt-5-6-luna", currentChosen: false });
  assert.deepEqual(listed(groups, "gpt-5-6-luna"), []);
});
