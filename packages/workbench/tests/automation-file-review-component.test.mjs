import assert from "node:assert/strict";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

// Issue #109. Settings > Automation files lists the instruction and memory files automation runs wrote, shows each as
// plain text, and offers Accept and Delete to the people who may review it. The component and React are real. The
// owner action transport, the toolkit button, and Core's error helper are stubbed.
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, "..");
const REVIEW = join(WORKBENCH, "app", "components", "settings", "AutomationFileReview.tsx");
const CORE = dirname(realpathSync(join(WORKBENCH, "node_modules", "@agent-native", "core", "package.json")));

const stubs = new Map([
  // The real caller keeps one call function for the component's life, so the stand-in does too.
  ["../../lib/native-actions", `
    export const callProof = { calls: [], answer: () => ({ files: [] }) };
    async function call(name, params) {
      callProof.calls.push({ name, params });
      return callProof.answer(params);
    }
    export function useNativeActionCaller() {
      return { ready: true, retrySession() {}, call };
    }`],
  ["@agent-native/core/client/hooks", `export function actionErrorMessage(failure) { return failure?.message; }`],
  ["@agent-native/toolkit/ui", `
    import { forwardRef } from "react";
    export const Button = forwardRef(function Button({ size, variant, ...props }, ref) {
      return <button ref={ref} type="button" {...props} />;
    });`],
]);

const proofSource = String.raw`
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AutomationFileReview } from "@proof/AutomationFileReview";
import { callProof } from "../../lib/native-actions";

const PLANTED = "# Rules\n\n![x](http://evil.test/x.png) <img src=x onerror=alert(1)> [click](http://evil.test)";
const AGENTS = { id: "res-agents", path: "AGENTS.md", scope: "personal", runId: "job-digest-1", automation: "digest",
  writtenAt: Date.UTC(2026, 8, 29, 12), updatedAt: Date.UTC(2026, 8, 29, 13), changedAfterRun: true, content: PLANTED,
  canReview: true };
const TEAM = { id: "res-team", path: "LEARNINGS.md", scope: "organization", runId: "job-team-1", automation: "team",
  writtenAt: Date.UTC(2026, 8, 29, 12), updatedAt: Date.UTC(2026, 8, 29, 12), changedAfterRun: false, content: "Team rule.",
  canReview: false, reviewNote: "Only organization owners and admins can review organization files." };

async function flush() {
  await act(async () => { for (let turn = 0; turn < 10; turn += 1) await Promise.resolve(); });
}

async function mount(answer) {
  callProof.calls = [];
  callProof.answer = answer;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AutomationFileReview />); });
  await flush();
  return { host, dispose: async () => {
    await act(async () => { root.unmount(); });
    host.remove();
  } };
}

const items = host => [...host.querySelectorAll("li")];
const button = (scope, label) => [...scope.querySelectorAll("button")].find(item => item.textContent === label);
async function click(element) {
  await act(async () => { element.click(); });
  await flush();
}
const listing = files => params => params.operation === "list" ? { files } : { [params.operation + "d"]: true };

export async function aFileShowsItsOriginAndPlainText() {
  const { host, dispose } = await mount(listing([AGENTS]));
  try {
    assert.deepEqual(callProof.calls, [{ name: "vivary-automation-files", params: { operation: "list" } }]);
    const [item] = items(host);
    assert.equal(item.querySelector("h3")?.textContent, "AGENTS.md");
    assert.match(item.textContent, /Personal\. Written by the digest automation on .+, run job-digest-1\./);
    assert.match(item.textContent, /Changed after the run\./);
    assert.equal(item.querySelector("pre"), null, "the text stays hidden until View");
    await click(button(item, "View"));
    assert.equal(item.querySelector("pre")?.textContent, PLANTED, "View shows the file as written");
    assert.equal(host.querySelectorAll("img, a").length, 0, "a planted image or link is only text");
    await click(button(item, "Hide"));
    assert.equal(item.querySelector("pre"), null);
  } finally { await dispose(); }
}

export async function aFileTheViewerCannotReviewSaysWhy() {
  const { host, dispose } = await mount(listing([TEAM]));
  try {
    const [item] = items(host);
    assert.match(item.textContent, /Organization\. Written by the team automation/);
    assert.equal(button(item, "Accept").disabled, true);
    assert.equal(button(item, "Delete").disabled, true);
    assert.match(item.textContent, /Only organization owners and admins can review organization files\./);
  } finally { await dispose(); }
}

export async function acceptNamesTheVersionShownAndReloads() {
  let files = [AGENTS];
  const { host, dispose } = await mount(params => {
    if (params.operation === "accept") { files = []; return { accepted: true }; }
    return { files };
  });
  try {
    await click(button(items(host)[0], "Accept"));
    assert.deepEqual(callProof.calls.map(call => call.params), [
      { operation: "list" },
      { operation: "accept", id: AGENTS.id, updatedAt: AGENTS.updatedAt, runId: AGENTS.runId },
      { operation: "list" },
    ]);
    assert.equal(items(host).length, 0);
    assert.match(host.textContent, /No files from automation runs are waiting for review\./);
  } finally { await dispose(); }
}

export async function deleteAsksFirst() {
  const asked = [];
  let confirmed = false;
  window.confirm = message => { asked.push(message); return confirmed; };
  const { host, dispose } = await mount(listing([AGENTS]));
  try {
    await click(button(items(host)[0], "Delete"));
    assert.deepEqual(asked, ["Delete AGENTS.md? This removes the whole file, including anything that was in it before the run."]);
    assert.deepEqual(callProof.calls.map(call => call.params.operation), ["list"], "Cancel sends nothing");
    confirmed = true;
    await click(button(items(host)[0], "Delete"));
    assert.deepEqual(callProof.calls[1].params,
      { operation: "delete", id: AGENTS.id, updatedAt: AGENTS.updatedAt, runId: AGENTS.runId });
  } finally { await dispose(); delete window.confirm; }
}

export async function aRefusedReviewShowsTheServerMessage() {
  const { host, dispose } = await mount(params => {
    if (params.operation === "accept") throw new Error("This file changed. Reload the list.");
    return { files: [AGENTS] };
  });
  try {
    await click(button(items(host)[0], "Accept"));
    assert.equal(host.querySelector('[role="alert"]')?.textContent, "This file changed. Reload the list.");
    assert.equal(callProof.calls.at(-1).params.operation, "list", "the list reloads");
    assert.equal(items(host).length, 1);
  } finally { await dispose(); }
}
`;

async function buildProof() {
  const result = await esbuild.build({
    stdin: { contents: proofSource, resolveDir: join(WORKBENCH, "app", "components", "settings"),
      sourcefile: "automation-file-review-proof.tsx", loader: "tsx" },
    absWorkingDir: WORKBENCH,
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    target: "node22",
    jsx: "automatic",
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{
      name: "automation-file-review-proof",
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === "@proof/AutomationFileReview") return { path: REVIEW };
          if (stubs.has(args.path)) return { path: args.path, namespace: "stub" };
          return undefined;
        });
        build.onLoad({ filter: /.*/, namespace: "stub" }, args => (
          { contents: stubs.get(args.path), loader: "tsx", resolveDir: WORKBENCH }));
      },
    }],
  });
  const inputs = Object.keys(result.metafile.inputs).map(input => resolve(WORKBENCH, input));
  assert.ok(inputs.includes(REVIEW), "the proof bundles the real AutomationFileReview");
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

test("Settings > Automation files lists run-written files as plain text with Accept and Delete", async t => {
  assert.ok(existsSync(REVIEW), "Vivary has the Automation files tab");
  const proof = await import(`data:text/javascript;base64,${Buffer.from(await buildProof()).toString("base64")}`);
  const closeChannels = installDom();
  t.after(() => closeChannels());
  for (const [name, run] of [
    ["a file shows its scope, automation, run, and text as plain text", proof.aFileShowsItsOriginAndPlainText],
    ["a file the viewer cannot review has Accept and Delete off and says why", proof.aFileTheViewerCannotReviewSaysWhy],
    ["Accept names the version shown and reloads the list", proof.acceptNamesTheVersionShownAndReloads],
    ["Delete asks first and sends nothing on Cancel", proof.deleteAsksFirst],
    ["a refused review shows the server's message", proof.aRefusedReviewShowsTheServerMessage],
  ]) await t.test(name, () => run());
});

test("the Settings page offers the Automation files tab", async () => {
  const settings = await readFile(join(WORKBENCH, "app", "routes", "settings.tsx"), "utf8");
  assert.ok(settings.includes('id: "automation-files"'), "the tab has its id");
  assert.ok(settings.includes('label: "Automation files"'), "the tab has its label");
  assert.ok(settings.includes("<AutomationFileReview />"), "the tab renders the review");
  assert.ok(settings.includes('tabId: "automation-files"'), "Settings search finds it");
});

test.after(() => esbuild.stop());
