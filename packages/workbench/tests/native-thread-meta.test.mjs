import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Issue #145. A saved Native thread takes its fallback title and its preview from the first user message. Vivary's
// composer appends the project's context to that message in a <context> block, which the owner never typed.
const WORKBENCH = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORE = dirname(realpathSync(join(WORKBENCH, "node_modules", "@agent-native", "core", "package.json")));
const { extractThreadMeta } = await import(pathToFileURL(join(CORE, "dist", "agent", "thread-data-builder.js")).href);
const { appendAgentChatContextToMessage } = await import(pathToFileURL(join(CORE, "dist", "shared", "agent-chat-context.js")).href);

const threadWith = (...texts) => ({ messages: texts.map((text, index) => ({
  message: { id: `user-${index}`, role: "user", content: [{ type: "text", text }] }, parentId: null })) });
const context = "## Field notes\nResource context: workspace-app:vivary-project-a (project notes)";

test("a thread's fallback title and preview leave out the context the composer appends", () => {
  const meta = extractThreadMeta(threadWith(appendAgentChatContextToMessage("Sea stars", context)));
  assert.deepEqual(meta, { title: "Sea stars", preview: "Sea stars" });
});

test("a message with only context gives no title, and a later message still sets the preview", () => {
  const meta = extractThreadMeta(threadWith(appendAgentChatContextToMessage("", context),
    appendAgentChatContextToMessage("Kelp forest", context)));
  assert.deepEqual(meta, { title: "Kelp forest", preview: "Kelp forest" });
});
