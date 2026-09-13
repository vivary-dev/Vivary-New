import { defineNitroPlugin } from "@agent-native/core/server";
import {
  initializeVivaryCodeAgent,
  shutdownVivaryCodeAgent,
} from "../local-code-agent.ts";

export default defineNitroPlugin(async (nitroApp) => {
  // guard:allow-env-credential - The direct CLI launcher owns this process's exit.
  const standalone = process.env.VIVARY_STANDALONE_HOST === "1";
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const cleanup = shutdownVivaryCodeAgent().then(() =>
      standalone ? nitroApp.hooks.callHook("close") : undefined);
    void cleanup.then(() => {
      if (standalone) process.exit(0);
    }).catch(() => {
      console.error("[vivary-code-host] Shutdown did not settle.");
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
    await shutdownVivaryCodeAgent();
  });
  try {
    await initializeVivaryCodeAgent();
  } catch (error) {
    removeSignalHandlers();
    throw error;
  }
});
