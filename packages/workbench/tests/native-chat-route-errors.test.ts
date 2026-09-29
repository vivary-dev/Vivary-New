import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, type TestContext } from "node:test";

// Issue #142. Core mounts its chat route through `getH3App(...).use`. That wrapper decided an error came from a client
// that left whenever the request stream was destroyed, which Node does once a body has been read to the end. The error
// was dropped, and the browser got h3's "Cannot find any route" instead. These tests serve the mounted route over a
// Node server, as the app does, and read the body before the handler throws, as Core's chat handler does.
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-native-chat-route-errors-"));
const database = `file:${path.join(caseRoot, "native.sqlite")}`;
Object.assign(process.env, { APP_NAME: "Vivary", DATABASE_URL: database, DATABASE_URL_UNPOOLED: database });
after(() => rm(caseRoot, { recursive: true, force: true }));

const { getH3App } = await import("@agent-native/core/server");
const { defineEventHandler, H3, toNodeHandler } = await import("h3");
const { createVivaryNativeChatProjectGuard } = await import("../server/native-chat-project.ts");
type Handler = Parameters<typeof defineEventHandler>[0];

async function mountedChatRoute(t: TestContext, handler: (event: Parameters<Handler>[0]) => Promise<unknown>) {
  const nitroApp = { h3: new H3() };
  getH3App(nitroApp).use("/_agent-native/agent-chat", defineEventHandler(async event => {
    await event.req.text();
    return handler(event);
  }));
  const server = createServer(toNodeHandler(nitroApp.h3));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/_agent-native/agent-chat`;
}

test("a refused Native chat send keeps its status and sentence through Core's mounted chat route",
  { timeout: 10_000 }, async t => {
    const refused = Object.assign(new Error("Project conversation access is unavailable."), { statusCode: 403 });
    const guard = createVivaryNativeChatProjectGuard({ getOrgId: () => "org-a",
      matchChatProject: async () => { throw refused; }, resolveProjectWorkspace: async () => ({}) });
    const url = await mountedChatRoute(t, async () => {
      await guard({ event: {}, ownerEmail: "owner@example.test", message: "Hi", attachments: [], references: [],
        mode: "act" });
      return "sent";
    });
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hi" }) });
    const body = await response.json();
    assert.deepEqual([response.status, body.error, body.errorCode, body.retryable],
      [422, "Project conversation access is unavailable.", "vivary_project_conversation_refused", false]);
  });

test("a client that leaves mid-request is still an abort, not a server error", { timeout: 10_000 }, async t => {
  const logged = t.mock.method(console, "error", () => undefined);
  let started!: () => void;
  const handlerStarted = new Promise<void>(resolve => { started = resolve; });
  let thrown!: () => void;
  const handlerThrew = new Promise<void>(resolve => { thrown = resolve; });
  const url = await mountedChatRoute(t, async event => {
    const response = event.node?.res;
    if (!response) throw new Error("The test needs a Node response.");
    const clientLeft = once(response, "close");
    started();
    await clientLeft;
    queueMicrotask(thrown);
    throw new Error("The run could not start.");
  });
  const client = new AbortController();
  fetch(url, { method: "POST", body: JSON.stringify({ message: "Hi" }), signal: client.signal }).catch(() => undefined);
  // The handler has read the whole body, so the request stream is complete and destroyed before the client leaves.
  await handlerStarted;
  client.abort();
  await handlerThrew;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(logged.mock.calls.map(call => String(call.arguments[0])).filter(line => line.includes("agent-chat")), []);
});
