import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

// Native chat controls rendered from Core's and Toolkit's installed, patched modules, bundled with
// esbuild and mounted on linkedom as builder-offers-component.test.mjs does.
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, "..");
const CORE = dirname(realpathSync(join(WORKBENCH, "node_modules", "@agent-native", "core", "package.json")));
const CLIENT = join(CORE, "dist", "client");
const TOOLKIT = dirname(realpathSync(join(WORKBENCH, "node_modules", "@agent-native", "toolkit", "package.json")));
const COMPOSER = join(TOOLKIT, "dist", "composer");

// Only the Builder connect flow, which polls a status route, is stubbed. It is matched by the file
// it resolves to, so every importer gets the same stub.
const stubs = new Map([
  [join(CLIENT, "settings", "useBuilderStatus.js"), `
    export function useBuilderConnectFlow() {
      return { configured: false, connecting: false, error: null, orgName: null, statusResolved: true, start() {} };
    }
    export function useBuilderStatus() { return { status: null, refetch() {} }; }`],
]);

const proofSource = String.raw`
import { act } from "react";
import { createRoot } from "react-dom/client";
import { getRunErrorMetadata, RunErrorRecoveryCard } from "@proof/run-recovery";
import { processEvent } from "@proof/sse-event-processor";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { TiptapComposer } from "@proof/tiptap-composer";
import { TooltipProvider } from "@proof/tooltip";

async function mount(element) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(element); });
  return { host, async unmount() { await act(async () => { root.unmount(); }); host.remove(); } };
}

// The run's terminal error event goes through the client's own event handling, and the card
// renders the metadata that handling stores on the message.
export async function renderRunError(event) {
  const outcome = processEvent(event, [], { value: 0 }, "probe-tab");
  const info = getRunErrorMetadata({ metadata: outcome.result?.metadata });
  if (!info) return { action: outcome.action };
  let retries = 0;
  const view = await mount(<RunErrorRecoveryCard info={info} onContinue={() => {}} onRetry={() => { retries += 1; }}
    onDismiss={() => {}} />);
  const retry = view.host.querySelector('button[aria-label="Retry"]');
  if (retry) await act(async () => { retry.dispatchEvent(new window.Event("click", { bubbles: true })); });
  const snapshot = { action: outcome.action, text: view.host.textContent, retry: Boolean(retry), retries };
  await view.unmount();
  return snapshot;
}

// The name a screen reader announces for a control, in the order the accessible name computation
// reads it for a button: labelledby, aria-label, content, then title.
function accessibleName(element) {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) return labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? "").join(" ").trim();
  return (element.getAttribute("aria-label") ?? "").trim() || element.textContent.trim() || (element.getAttribute("title") ?? "").trim();
}

const idleModel = { async *run() {} };
function Composer({ willQueue }) {
  const runtime = useLocalRuntime(idleModel);
  return <AssistantRuntimeProvider runtime={runtime}><TooltipProvider>
    <TiptapComposer willQueue={willQueue} plusMenuMode="hidden" voiceEnabled={false} includeDefaultSlashSkills={false} />
  </TooltipProvider></AssistantRuntimeProvider>;
}

export async function renderComposer(willQueue) {
  const view = await mount(<Composer willQueue={willQueue} />);
  const button = view.host.querySelector('[data-agent-composer-slot="send-button"]');
  const snapshot = { editor: Boolean(view.host.querySelector(".ProseMirror")), sendName: button ? accessibleName(button) : null };
  await view.unmount();
  return snapshot;
}
`;

async function buildProof() {
  const result = await esbuild.build({
    stdin: { contents: proofSource, resolveDir: HERE, sourcefile: "native-chat-proof.tsx", loader: "tsx" },
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
      name: "native-chat-proof",
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === "@proof/run-recovery") return { path: join(CLIENT, "chat", "run-recovery.js") };
          if (args.path === "@proof/sse-event-processor") return { path: join(CLIENT, "sse-event-processor.js") };
          if (args.path === "@proof/tiptap-composer") return { path: join(COMPOSER, "TiptapComposer.js") };
          if (args.path === "@proof/tooltip") return { path: join(TOOLKIT, "dist", "ui", "tooltip.js") };
          // The workbench does not list the assistant runtime, so the proof takes the Toolkit's copy.
          if (args.path === "@assistant-ui/react" && args.resolveDir !== COMPOSER) {
            return build.resolve(args.path, { kind: args.kind, resolveDir: COMPOSER });
          }
          if (args.path.startsWith(".") && args.importer.startsWith(CORE)) {
            const target = resolve(dirname(args.importer), args.path);
            if (stubs.has(target)) return { path: target, namespace: "stub" };
          }
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
  class ResizeObserver { observe() {} unobserve() {} disconnect() {} }
  // linkedom has no text selection. An unfocused editor only needs an empty one.
  const selection = { rangeCount: 0, anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0, isCollapsed: true,
    removeAllRanges() {}, addRange() {}, collapse() {}, extend() {} };
  view.getSelection = () => selection;
  view.document.getSelection = () => selection;
  const getComputedStyle = () => new Proxy({ getPropertyValue: () => "" }, { get: (style, name) => style[name] ?? "" });
  const values = { window: view, self: view, document: view.document, navigator: view.navigator,
    HTMLElement: view.HTMLElement, Element: view.Element, Node: view.Node, Event: view.Event,
    CustomEvent: view.CustomEvent, EventTarget: view.EventTarget, MessageChannel: TrackedMessageChannel,
    ResizeObserver, getComputedStyle, innerHeight: 800, innerWidth: 1200,
    IS_REACT_ACT_ENVIRONMENT: true };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => { for (const channel of channels) { channel.port1.close(); channel.port2.close(); } };
}

test("Native chat controls", async t => {
  // Tiptap reads the DOM when its module loads, so the DOM goes in first.
  const closeChannels = installDom();
  const proof = await import(`data:text/javascript;base64,${Buffer.from(await buildProof()).toString("base64")}`);
  t.after(() => closeChannels());

  // Issue #101.
  await t.test("a provider stream error shows its message and a Retry, and does not continue on its own", async () => {
    const card = await proof.renderRunError({ type: "error", error: "Provider returned error (code 502)",
      errorCode: "provider_stream_error" });
    assert.equal(card.action, "error", "the client ends the turn instead of continuing it");
    assert.match(card.text, /Provider returned error \(code 502\)/);
    assert.equal(card.retry, true, "Retry is offered");
    assert.equal(card.retries, 1, "Retry reaches the chat's retry handler");
  });

  await t.test("an unclassified error still has no Retry", async () => {
    const card = await proof.renderRunError({ type: "error", error: "The request was refused.",
      errorCode: "probe_unclassified" });
    assert.equal(card.action, "error");
    assert.match(card.text, /The request was refused\./);
    assert.equal(card.retry, false);
  });

  // Issue #102.
  await t.test("the composer's send button is named for its action", async () => {
    const idle = await proof.renderComposer(false);
    assert.equal(idle.editor, true, "the Tiptap editor mounts");
    assert.equal(idle.sendName, "Send message");
    assert.equal((await proof.renderComposer(true)).sendName, "Queue message");
  });
});

test.after(() => esbuild.stop());
