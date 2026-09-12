import assert from "node:assert/strict";
import { test } from "node:test";

test("plugin and source-action module instances share one shutdown", async () => {
  const moduleUrl = new URL("../server/local-code-agent.ts", import.meta.url);
  const plugin = await import(moduleUrl.href + "?plugin");
  const action = await import(moduleUrl.href + "?action");
  const first = plugin.shutdownVivaryCodeAgent();
  const second = action.shutdownVivaryCodeAgent();
  assert.equal(first, second);
  await first;
});
