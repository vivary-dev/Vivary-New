import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
export default defineConfig({ cacheDir: ".cache/vite", plugins: [reactRouter(), agentNative({ ssrStubs: ["shiki"] })] });
