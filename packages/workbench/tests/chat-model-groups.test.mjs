import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// The maintained Core patch makes the provider and model saved in Settings the default for a new
// Native chat. Core does not export this module, so load the installed, patched copy.
const clientDir = path.dirname(fileURLToPath(import.meta.resolve("@agent-native/core/client")));
const { buildChatModelGroups } = await import(pathToFileURL(path.join(clientDir, "chat-model-groups.js")).href);

const engines = [
  { name: "ai-sdk:openai", label: "OpenAI", supportedModels: ["gpt-5.6-luna", "gpt-5.6-sol"], requiredEnvVars: ["OPENAI_API_KEY"] },
  { name: "ai-sdk:openrouter", label: "OpenRouter", supportedModels: ["openai/gpt-5.6-luna", "anthropic/claude-opus-4.8"], requiredEnvVars: ["OPENROUTER_API_KEY"] },
];

test("a saved custom OpenRouter model leads the picker and becomes the new-chat default", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: ["OPENAI_API_KEY", "OPENROUTER_API_KEY"],
    currentEngineName: "ai-sdk:openrouter", currentModel: "stealth/space-bunny-alpha" });
  assert.equal(groups[0].engine, "ai-sdk:openrouter");
  assert.equal(groups[0].models[0], "stealth/space-bunny-alpha");
  assert.ok(groups[0].models.includes("openai/gpt-5.6-luna"), "built-in models stay selectable");
  assert.ok(groups.some(group => group.engine === "ai-sdk:openai"), "other configured providers stay listed");
});

test("a saved model already in the built-in list moves first without a duplicate", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: ["OPENROUTER_API_KEY"],
    currentEngineName: "ai-sdk:openrouter", currentModel: "anthropic/claude-opus-4.8" });
  assert.deepEqual(groups[0].models.filter(model => model === "anthropic/claude-opus-4.8"), ["anthropic/claude-opus-4.8"]);
  assert.equal(groups[0].models[0], "anthropic/claude-opus-4.8");
});

test("a saved provider without a key does not become the default", () => {
  const groups = buildChatModelGroups({ engines, configuredKeys: ["OPENAI_API_KEY"],
    currentEngineName: "ai-sdk:openrouter", currentModel: "stealth/space-bunny-alpha" });
  assert.equal(groups.find(group => group.configured)?.engine, "ai-sdk:openai");
});
