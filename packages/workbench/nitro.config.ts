import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const codeWorkerEntry = fileURLToPath(new URL("./server/code-execution-worker.ts", import.meta.url));

export default {
  rollupConfig: {
    plugins: [{
      name: "vivary-code-worker",
      buildStart() {
        this.emitFile({
          type: "chunk",
          id: codeWorkerEntry,
          fileName: "vivary-code-worker.mjs",
          preserveSignature: "strict",
        });
      },
    } satisfies Plugin],
  },
};
