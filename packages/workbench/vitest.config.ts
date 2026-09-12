import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["tests/workbench-preview.test.ts"] } });
