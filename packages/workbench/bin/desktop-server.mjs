import path from "node:path";
import { fileURLToPath } from "node:url";

import { startVivary, startupOptions } from "./start.mjs";

const sourceFile = fileURLToPath(import.meta.url);
const READY_TIMEOUT_MS = 8_000;

function send(message) {
  if (!process.connected || !process.send) return;
  try {
    process.send(message, () => undefined);
  } catch {
    // The parent may disconnect between the connected check and send.
  }
}

export async function runDesktopServer(args = process.argv.slice(2)) {
  let stopping = false;
  let nativeHandlersReady = false;
  const requestShutdown = () => {
    if (stopping) return;
    stopping = true;
    send({ type: "stopping" });
    if (!nativeHandlersReady) {
      process.exit(0);
      return;
    }
    process.emit("SIGTERM");
    try {
      if (process.connected) process.disconnect();
    } catch {
      // The parent may disconnect while the signal handlers begin cleanup.
    }
  };
  process.on("message", (message) => {
    if (message?.type === "shutdown") requestShutdown();
  });
  process.once("disconnect", requestShutdown);

  const options = startupOptions(args, process.env);
  if (options.help || options.mode !== "local") {
    throw new Error("The desktop server accepts only validated local startup options.");
  }
  await startVivary(options);
  nativeHandlersReady = true;
  await waitForAgent(options.appUrl);
  send({ type: "ready", origin: options.appUrl });
}

async function waitForAgent(origin) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastStatus;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1_000);
    try {
      const response = await fetch(`${origin}/agent`, {
        headers: { accept: "text/html" },
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
      lastStatus = response.status;
      const ready = response.ok;
      try {
        await response.body?.cancel();
      } catch {
        // Readiness depends on the response status, not body disposal.
      }
      if (ready) return;
    } catch {
      // The server may still be completing its first local boot.
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const cause = lastStatus === undefined ? "no HTTP response" : `last HTTP status ${lastStatus}`;
  throw new Error(`Vivary local server did not return a successful GET /agent response (${cause}).`);
}

const directEntry = process.argv[1] && path.resolve(process.argv[1]) === sourceFile;
if (directEntry) {
  runDesktopServer().catch((error) => {
    send({
      type: "error",
      message: error instanceof Error ? error.message.slice(0, 1_000) : "Vivary local server failed.",
    });
    process.exitCode = 1;
  });
}
