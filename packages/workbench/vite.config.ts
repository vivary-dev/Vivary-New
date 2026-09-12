import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type Plugin } from "vite";

const nodeRenderer: Plugin = {
  name: "vivary-node-renderer",
  enforce: "pre",
  resolveId(source, importer, options) {
    // Core's browser renderer retains a MessageChannel after the Node server closes.
    if (options.ssr && source === "react-dom/server.browser") {
      return this.resolve("react-dom/server.node", importer, { skipSelf: true });
    }
  },
};

export default defineConfig({
  cacheDir: ".cache/vite",
  plugins: [nodeRenderer, reactRouter(), agentNative({ ssrStubs: ["shiki"] })],
});
