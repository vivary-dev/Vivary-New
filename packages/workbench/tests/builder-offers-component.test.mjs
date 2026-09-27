import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

// Issue #104. The local app's missing-access card offers the owner's own provider keys and no
// Builder.io option. The card is Core's, so the proof bundles Core's installed, patched module and
// renders it with the page config the server sends in local mode.
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, "..");
const CORE = dirname(realpathSync(join(WORKBENCH, "node_modules", "@agent-native", "core", "package.json")));
const RUN_RECOVERY = join(CORE, "dist", "client", "chat", "run-recovery.js");

// The key form and the Builder connect flow are stubbed. The card's own choice of what to show
// stays real. The stub popover renders its button, so the control case can see a Builder offer.
const stubs = new Map([
  ["../settings/ProviderSetupForm.js", `
    export function AgentProviderSetupForm() {
      return <form data-testid="provider-key-form"><label>Provider<input name="key" /></label></form>;
    }`],
  ["../settings/useBuilderStatus.js", `
    export function useBuilderConnectFlow() {
      return { configured: false, connecting: false, error: null, orgName: null, statusResolved: true, start() {} };
    }`],
  ["../settings/BuilderConnectPopover.js", `
    export function BuilderConnectPopover({ children }) { return children; }`],
  ["../i18n.js", `
    export function useT() { return (key, options) => options?.defaultValue ?? key; }
    export function useFormatters() { return {}; }`],
]);

const proofSource = String.raw`
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BuilderSetupCard } from "@proof/run-recovery";

export async function render(builderOffers) {
  window.__AGENT_NATIVE_CONFIG__ = builderOffers ? {} : { builderOffers: false };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<BuilderSetupCard onConnected={() => {}} />); });
  const snapshot = {
    text: host.textContent,
    buttons: [...host.querySelectorAll("button")].map(button => button.textContent),
    keyForms: host.querySelectorAll('[data-testid="provider-key-form"]').length,
  };
  await act(async () => { root.unmount(); });
  host.remove();
  return snapshot;
}
`;

async function buildProof() {
  const result = await esbuild.build({
    stdin: { contents: proofSource, resolveDir: HERE, sourcefile: "builder-offers-proof.tsx", loader: "tsx" },
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
      name: "builder-offers-proof",
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === "@proof/run-recovery") return { path: RUN_RECOVERY };
          if (args.importer === RUN_RECOVERY && stubs.has(args.path)) return { path: args.path, namespace: "stub" };
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

test("the missing-access card offers only provider keys when Builder offers are off", async t => {
  const proof = await import(`data:text/javascript;base64,${Buffer.from(await buildProof()).toString("base64")}`);
  const closeChannels = installDom();
  t.after(() => closeChannels());

  const local = await proof.render(false);
  assert.doesNotMatch(local.text, /builder/i, "no Builder text");
  assert.deepEqual(local.buttons.filter(label => /builder|credits/i.test(label)), [], "no Builder button");
  assert.match(local.text, /Connect AI/);
  assert.match(local.text, /Add your own provider keys\./);
  assert.equal(local.keyForms, 1, "the provider-key form shows without a toggle");

  // Control: Core's own behavior still offers Builder.io, so the check above can see an offer.
  const hosted = await proof.render(true);
  assert.match(hosted.text, /builder/i);
  assert.equal(hosted.keyForms, 0, "the key form waits behind its toggle");
});

test.after(() => esbuild.stop());
