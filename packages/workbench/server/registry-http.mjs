/** Opt-in HTTP registration using native middleware and action dispatch. */
import { getH3App, mountActionRoutes } from "@agent-native/core/server";
import { defineEventHandler } from "h3";

const ACTION_NAME = "vivary-register-project";
const ACTION_PATH = `/_agent-native/actions/${ACTION_NAME}`;
const MAX_BODY_BYTES = 8192;
const refusal = (status, error) => Response.json({ error }, {
  status, headers: { "cache-control": "no-store" },
});

class BodyRefusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function rawJson(request) {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw new BodyRefusal(413, "Registry request body is too large");
  }
  const copy = request.clone();
  const reader = copy.body?.getReader();
  if (!reader) throw new BodyRefusal(400, "Invalid registry JSON request");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        throw new BodyRefusal(413, "Registry request body is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    // A Request clone tees its body. Waiting for cancellation here can wait for
    // the untouched native branch, which is intentionally not read on refusal.
    void reader.cancel().catch(() => {});
    if (error instanceof BodyRefusal) throw error;
    throw new BodyRefusal(400, "Invalid registry JSON request");
  } finally {
    reader.releaseLock();
  }
}

/**
 * The trusted app supplies its already configured native auth callbacks and
 * existing registration entry/parser. This helper neither authenticates a
 * caller itself nor changes the entry's agent/public discovery policy.
 */
export function mountRegistryHttp(nitroApp, { registration, parseStrictJson,
  getOwnerFromEvent, resolveOrgId }) {
  if (!registration?.schema || typeof registration.run !== "function"
    || [parseStrictJson, getOwnerFromEvent, resolveOrgId].some((value) => typeof value !== "function")) {
    throw new TypeError("registry HTTP requires its entry, parser and trusted native auth callbacks");
  }
  const app = getH3App(nitroApp);
  app.use(ACTION_PATH, defineEventHandler(async (event) => {
    // The native mount matcher strips the same prefix for both this middleware
    // and the action, including configured app-base paths. Reject suffix routes.
    if (event.url.pathname !== "/") {
      return refusal(404, "Not found");
    }
    const request = event.req;
    if (request.method === "OPTIONS") return;
    if (request.method !== "POST") {
      return refusal(405, "Method not allowed");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
      || ![null, "identity"].includes(request.headers.get("content-encoding"))) {
      return refusal(415, "Registry requests require JSON");
    }
    try {
      const text = await rawJson(request);
      const parsed = parseStrictJson(text);
      if (!registration.schema.safeParse(parsed).success) return refusal(400, "Invalid registry JSON request");
    } catch (error) {
      // Returning a Response is essential: Core's exception adapter can mistake
      // a fully read Node request for an aborted client and fall through.
      return error instanceof BodyRefusal ? refusal(error.status, error.message)
        : refusal(400, "Invalid registry JSON request");
    }
  }));
  mountActionRoutes(nitroApp, {
    [ACTION_NAME]: { ...registration, http: { method: "POST" }, requiresAuth: true,
      maxBodyBytes: MAX_BODY_BYTES },
  }, { appId: "workbench", getOwnerFromEvent, resolveOrgId, allowDelegatedCaller: false });
}
