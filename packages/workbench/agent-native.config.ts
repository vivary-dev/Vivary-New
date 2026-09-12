import { defineAgentNativeConfig } from "@agent-native/core/config";

export default defineAgentNativeConfig({
  changelog: { enabled: false },
  harness: false,
  // Vivary runs in one Node process with a persistent local data directory.
  runtime: { database: { required: false } },
});
