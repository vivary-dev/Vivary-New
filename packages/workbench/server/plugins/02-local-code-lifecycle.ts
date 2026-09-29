import { stopRecurringJobs } from "@agent-native/core/jobs";
import { defineNitroPlugin } from "@agent-native/core/server";
import {
  initializeVivaryCodeAgent,
  shutdownVivaryCodeAgent,
} from "../local-code-agent.ts";

import { shutdownOriginalCommands } from "../original-runtime.ts";
import { shutdownProjectPreviews } from "../project-preview.ts";

// Automations get the Code host's 10-second shutdown wait, so a normal quit still
// settles before the desktop ends the server 15 seconds after asking it to stop.
// Their stop goes first: Promise.all calls its members in order, and a member
// that throws synchronously would skip the ones after it.
const stopLocalWork = () => Promise.all([
  stopRecurringJobs({ timeoutMs: 10_000 }),
  shutdownVivaryCodeAgent(), shutdownOriginalCommands(), shutdownProjectPreviews(),
]);

export default defineNitroPlugin(async (nitroApp) => {
  // guard:allow-env-credential - The direct CLI launcher owns this process's exit.
  const standalone = process.env.VIVARY_STANDALONE_HOST === "1";
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const cleanup = stopLocalWork().then(() =>
      standalone ? nitroApp.hooks.callHook("close") : undefined);
    void cleanup.then(() => {
      if (standalone) process.exit(0);
    }).catch(() => {
      console.error("[vivary-local-host] Shutdown did not settle.");
      if (standalone) process.exit(1);
    });
  };
  const removeSignalHandlers = () => {
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  nitroApp.hooks.hook("close", async () => {
    removeSignalHandlers();
    await stopLocalWork();
  });
  try {
    await initializeVivaryCodeAgent();
  } catch (error) {
    removeSignalHandlers();
    throw error;
  }
});
