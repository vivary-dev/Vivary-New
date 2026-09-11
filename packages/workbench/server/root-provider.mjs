/** One private custody process. No automatic restart or reusable proof cache. */
import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const configSchema = z.strictObject({
  deviceId: identifier, scope: z.string().refine(isAbsolute),
  statePath: z.string().refine(isAbsolute),
  locations: z.record(identifier, z.string().refine(isAbsolute))
    .refine((value) => Object.keys(value).length >= 1 && Object.keys(value).length <= 16),
});
const vcsSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none"), repositoryId: z.null(), checkoutId: z.null(),
    mutationOwner: z.null() }),
  z.strictObject({ kind: z.literal("git"),
    repositoryId: z.string().regex(/^repo_[0-9a-f]{32}$/),
    checkoutId: z.string().regex(/^checkout_[0-9a-f]{32}$/), mutationOwner: z.literal("git") }),
]);
const replySchema = z.union([
  z.strictObject({ version: z.literal(1), sequence: z.number().int().nonnegative(),
    code: z.enum(["ready", "identity-unverified"]) }),
  z.strictObject({ version: z.literal(1), sequence: z.number().int().positive(),
    code: z.literal("observed"), rootId: z.string().regex(/^root_[0-9a-f]{32}$/),
    locationRef: identifier, contentRevision: identifier, vcs: vcsSchema }),
  z.strictObject({ version: z.literal(1), sequence: z.number().int().positive(),
    code: z.literal("available"), rootId: z.string().regex(/^root_[0-9a-f]{32}$/).nullable(),
    locationRef: identifier, contentRevision: identifier }),
]);
const LIMIT = 16384;
const unavailable = () => Object.freeze({ code: "identity-unverified" });

/** Trusted app configuration supplies all executable and filesystem coordinates. */
export async function startRootProvider({ python, entryFile, config, parseStrictJson,
  timeoutMs = 5000 }) {
  if (process.platform !== "linux" || !isAbsolute(python) || !isAbsolute(entryFile)
    || typeof parseStrictJson !== "function" || !Number.isInteger(timeoutMs)
    || timeoutMs < 100 || timeoutMs > 10000) throw new TypeError("invalid root provider configuration");
  const settings = configSchema.parse(config);
  for (const file of [python, entryFile]) {
    if (await realpath(file) !== file || !(await stat(file)).isFile()) {
      throw new TypeError("root provider executable must be a resolved regular file");
    }
  }
  const child = spawn(python, ["-I", "-B", "-u", entryFile], {
    env: { LANG: "C.UTF-8" }, stdio: ["pipe", "pipe", "pipe"],
    cwd: "/", windowsHide: true,
  });
  let pending;
  let buffer = Buffer.alloc(0);
  let closed = false;
  let sequence = 0;
  const exited = new Promise((resolve) => child.once("close", resolve));
  function fail() {
    if (closed) return;
    closed = true;
    buffer = Buffer.alloc(0);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(unavailable());
      pending = undefined;
    }
    child.stdin.destroy();
    child.kill("SIGKILL");
  }
  child.on("error", fail);
  child.on("exit", fail);
  child.stdin.on("error", fail);
  // This protocol has no diagnostic channel. Unexpected stderr is a failed owner.
  child.stderr.on("data", fail);
  child.stdout.on("data", (chunk) => {
    if (closed) return;
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > LIMIT) return fail();
    const end = buffer.indexOf(10);
    if (end < 0) return;
    if (!pending || end !== buffer.length - 1) return fail();
    try {
      const value = replySchema.parse(parseStrictJson(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, end))));
      if (value.sequence !== pending.sequence
        || (pending.sequence === 0 ? value.code !== "ready" : value.code === "ready")
        || (value.code === "observed" && pending.operation !== "observe")
        || (value.code === "available" && pending.operation !== "inspect")
        || (["observed", "available"].includes(value.code) && value.locationRef !== pending.locationRef)) return fail();
      clearTimeout(pending.timer);
      const resolve = pending.resolve;
      pending = undefined;
      buffer = Buffer.alloc(0);
      resolve(Object.freeze(value));
    } catch { fail(); }
  });
  function exchange(message) {
    if (closed || pending) return Promise.resolve(unavailable());
    const frame = Buffer.from(JSON.stringify(message) + "\n");
    if (frame.length > LIMIT) { fail(); return Promise.resolve(unavailable()); }
    return new Promise((resolve) => {
      pending = { resolve, sequence: message.sequence, operation: message.operation, locationRef: message.locationRef,
        timer: setTimeout(fail, timeoutMs) };
      child.stdin.write(frame);
    });
  }
  const ready = await exchange({ version: 1, sequence: 0, operation: "initialize", config: settings });
  if (ready.code !== "ready") { fail(); await exited; throw new Error("root provider unavailable"); }
  return Object.freeze({
    deviceId: settings.deviceId,
    locationRefs: Object.freeze(Object.keys(settings.locations)),
    // Availability is not root verification. Every operation still observes.
    readiness: () => Object.freeze({ status: closed ? "unavailable" : "ready" }),
    observe: (locationRef) => {
      if (!Object.hasOwn(settings.locations, locationRef) || closed || pending) return Promise.resolve(unavailable());
      sequence++;
      return exchange({ version: 1, sequence, operation: "observe", locationRef });
    },
    inspect: (locationRef) => {
      if (!Object.hasOwn(settings.locations, locationRef) || closed || pending) return Promise.resolve(unavailable());
      sequence++;
      return exchange({ version: 1, sequence, operation: "inspect", locationRef });
    },
    close: async () => { fail(); await exited; },
  });
}
