import assert from "node:assert/strict";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

// Issue #157. Local owner launches serve no MCP endpoint, so Settings > MCP explains that to the local owner
// instead of showing Native's setup guides. The component and React are real. The session hook, the toolkit
// button, and the router link are stubbed.
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, "..");
const SETTINGS = join(WORKBENCH, "app", "components", "settings", "McpSettings.tsx");
const CORE = dirname(realpathSync(join(WORKBENCH, "node_modules", "@agent-native", "core", "package.json")));

const stubs = new Map([
  ["@agent-native/core/client/hooks", `
    export const sessionProof = { value: { session: null, status: "loading", retry() {} } };
    export function useSession() { return sessionProof.value; }`],
  ["@agent-native/toolkit/ui", `
    export function Button({ size, variant, ...props }) { return <button type="button" {...props} />; }`],
  ["react-router", `
    export function Link({ to, ...props }) { return <a href={to} {...props} />; }`],
]);

const proofSource = String.raw`
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { McpSettings } from "@proof/McpSettings";
import { sessionProof } from "@agent-native/core/client/hooks";

const NATIVE = <p data-native="true">Native MCP setup guides</p>;

async function render(value, interact = async () => {}) {
  sessionProof.value = value;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(<McpSettings nativeContent={NATIVE} />); });
  await interact(host);
  const text = host.textContent;
  const native = host.querySelector("[data-native]") !== null;
  const buttons = [...host.querySelectorAll("button")];
  const links = [...host.querySelectorAll("a")].map(link => link.getAttribute("href"));
  await act(async () => { root.unmount(); });
  host.remove();
  return { text, native, buttons, links };
}

export async function aLoadingSessionShowsNothing() {
  const shown = await render({ session: null, status: "loading", retry() {} });
  assert.equal(shown.text, "");
  assert.equal(shown.native, false, "no guide flashes while the session loads");
}

export async function anUnavailableSessionOffersRetry() {
  let retried = 0;
  const shown = await render({ session: null, status: "unavailable", retry() { retried += 1; } }, async host => {
    await act(async () => { host.querySelector("button").click(); });
  });
  assert.match(shown.text, /could not check your session/);
  assert.equal(shown.native, false);
  assert.equal(shown.buttons.length, 1);
  assert.equal(retried, 1, "Retry session asks the session again");
}

export async function theLocalOwnerGetsTheNote() {
  const shown = await render({ session: { email: " Owner@Local.Vivary.Test " }, status: "authenticated", retry() {} });
  assert.match(shown.text, /serves no MCP endpoint/);
  assert.equal(shown.native, false, "the local owner never sees guides for an endpoint this computer does not serve");
  assert.deepEqual(shown.links, ["/settings/runtimes"]);
}

export async function anyOtherSessionGetsNativeContent() {
  for (const value of [
    { session: { email: "someone@example.test" }, status: "authenticated", retry() {} },
    { session: null, status: "unauthenticated", retry() {} },
  ]) {
    const shown = await render(value);
    assert.equal(shown.native, true, value.status);
    assert.doesNotMatch(shown.text, /serves no MCP endpoint/);
  }
}
`;

async function buildProof() {
  const result = await esbuild.build({
    stdin: { contents: proofSource, resolveDir: join(WORKBENCH, "app", "components", "settings"),
      sourcefile: "mcp-settings-proof.tsx", loader: "tsx" },
    absWorkingDir: WORKBENCH,
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "node22",
    jsx: "automatic",
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{
      name: "mcp-settings-proof",
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === "@proof/McpSettings") return { path: SETTINGS };
          if (stubs.has(args.path)) return { path: args.path, namespace: "stub" };
          return undefined;
        });
        build.onLoad({ filter: /.*/, namespace: "stub" }, args => (
          { contents: stubs.get(args.path), loader: "tsx", resolveDir: WORKBENCH }));
      },
    }],
  });
  return result.outputFiles[0].text;
}

function installDom() {
  const linkedom = createRequire(join(CORE, "package.json"))("linkedom");
  const view = linkedom.parseHTML("<!doctype html><html><body></body></html>");
  // React schedules through MessageChannel. Open ports keep Node alive, so the proof closes them.
  const channels = [];
  class TrackedMessageChannel extends MessageChannel {
    constructor() { super(); channels.push(this); }
  }
  const values = { window: view, self: view, document: view.document, navigator: view.navigator,
    HTMLElement: view.HTMLElement, Element: view.Element, Node: view.Node, Event: view.Event,
    CustomEvent: view.CustomEvent, EventTarget: view.EventTarget, MessageChannel: TrackedMessageChannel,
    IS_REACT_ACT_ENVIRONMENT: true };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => { for (const channel of channels) { channel.port1.close(); channel.port2.close(); } };
}

test("Settings > MCP explains the missing endpoint to the local owner", async t => {
  assert.ok(existsSync(SETTINGS), "Vivary has its own MCP settings content");
  const proof = await import(`data:text/javascript;base64,${Buffer.from(await buildProof()).toString("base64")}`);
  const closeChannels = installDom();
  t.after(() => closeChannels());
  for (const [name, run] of [
    ["a loading session shows nothing", proof.aLoadingSessionShowsNothing],
    ["an unavailable session offers Retry session", proof.anUnavailableSessionOffersRetry],
    ["the local owner gets the note and a link to coding runtimes", proof.theLocalOwnerGetsTheNote],
    ["any other session keeps Native's content", proof.anyOtherSessionGetsNativeContent],
  ]) await t.test(name, () => run());
});

test("the Settings page wraps Native's MCP tab", async () => {
  const settings = await readFile(join(WORKBENCH, "app", "routes", "settings.tsx"), "utf8");
  assert.match(settings, /tab\.id === "mcp" \? \{ \.\.\.tab, content: <McpSettings nativeContent=\{tab\.content\} \/> \}/);
});

test.after(() => esbuild.stop());
