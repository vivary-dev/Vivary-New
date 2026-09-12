import { defineNitroPlugin } from "@agent-native/core/server";
import {
  initializeVivaryCodeAgent,
  shutdownVivaryCodeAgent,
} from "../local-code-agent.ts";

export default defineNitroPlugin(async (nitroApp) => {
  const shutdown = () => {
    void shutdownVivaryCodeAgent().catch(() => {
      console.error("[vivary-code-host] Shutdown did not settle.");
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
