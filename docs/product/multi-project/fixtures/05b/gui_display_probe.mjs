import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import {
  disablePlaywrightFocusEmulation,
  startPrivateDisplay,
} from "./gui_display.mjs";
import { validateConfig } from "./gui_zo_runner.mjs";

const [inputPath] = process.argv.slice(2);
assert.ok(inputPath);
assert.equal(await realpath(inputPath), inputPath);
const config = validateConfig(JSON.parse(await readFile(inputPath, "utf8")));

async function digestFile(file, maximum) {
  assert.equal(await realpath(file), file);
  const info = await lstat(file);
  assert.ok(info.isFile() && info.size > 0 && info.size <= maximum);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    bytes += chunk.length;
    assert.ok(bytes <= maximum);
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), bytes };
}

const chromiumIdentity = await digestFile(config.chromiumExecutable, 512 * 1024 * 1024);
assert.equal(chromiumIdentity.sha256, config.chromiumSha256);
const playwrightIdentity = await digestFile(config.playwrightPackageJson, 1024 * 1024);
assert.equal(playwrightIdentity.sha256, config.playwrightPackageJsonSha256);
await mkdir(config.evidenceRoot, { recursive: false, mode: 0o700 });

const require = createRequire(config.playwrightPackageJson);
const { chromium } = require("playwright");
const children = new Set();
const track = child => {
  children.add(child);
  child.once("close", () => children.delete(child));
  return child;
};

let stage = "display-start";
let display;
let browser;
let first;
let preparation = null;
const focusSessions = [];
const actualSequence = [];
const recordSequence = step => actualSequence.push({ step, at: Date.now() });
try {
  display = await startPrivateDisplay({ workRoot: "/work", track });
  stage = "browser-launch";
  browser = await chromium.launch({
    executablePath: config.chromiumExecutable,
    headless: false,
    chromiumSandbox: true,
    env: { HOME: "/tmp", PATH: "/usr/bin:/bin", LANG: "C.UTF-8", ...display.env },
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  stage = "first-page-navigation";
  first = await context.newPage();
  recordSequence("first-page-created");
  await first.goto('data:text/html,<label>Draft%20<input%20aria-label="Draft"%20/></label>');
  await first.reload();
  recordSequence("first-page-final-navigation");
  focusSessions.push(await disablePlaywrightFocusEmulation(context, first));
  recordSequence("first-page-focus-emulation-disabled");
  await first.bringToFront();
  const inputBox = first.getByRole("textbox", { name: "Draft" });
  await inputBox.fill("Draft survives real focus");
  await inputBox.click();
  preparation = await first.evaluate(() => ({
    focused: document.hasFocus(),
    visibility: document.visibilityState,
  }));
  assert.deepEqual(preparation, { focused: true, visibility: "visible" });
  recordSequence("first-page-real-focus-established");
  await first.evaluate(() => {
    window.__displayProbeEvents = [];
    for (const name of ["blur", "focus", "visibilitychange"]) {
      const target = name === "visibilitychange" ? document : window;
      target.addEventListener(name, event => window.__displayProbeEvents.push({
        name,
        isTrusted: event.isTrusted,
        focused: document.hasFocus(),
        visibility: document.visibilityState,
        at: Math.round(performance.now()),
      }));
    }
  });

  stage = "second-page-navigation";
  const second = await context.newPage();
  recordSequence("second-page-created");
  await second.goto("about:blank");
  recordSequence("second-page-final-navigation");
  focusSessions.push(await disablePlaywrightFocusEmulation(context, second));
  recordSequence("second-page-focus-emulation-disabled");
  stage = "switch-away";
  await second.bringToFront();
  recordSequence("second-page-brought-forward");
  await first.waitForFunction(() => window.__displayProbeEvents.some(event =>
    event.isTrusted && (event.name === "blur" || event.visibility === "hidden")),
  undefined, { timeout: 5_000 });
  const afterBlur = await first.evaluate(() => ({
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    events: window.__displayProbeEvents,
  }));
  assert.ok(!afterBlur.focused || afterBlur.visibility === "hidden");
  recordSequence("trusted-blur-or-hidden-observed");

  stage = "switch-back";
  await first.bringToFront();
  await first.waitForFunction(() => document.hasFocus()
    && window.__displayProbeEvents.some(event => event.isTrusted && event.name === "focus"),
  undefined, { timeout: 5_000 });
  assert.equal(await inputBox.inputValue(), "Draft survives real focus");
  recordSequence("first-page-trusted-focus-restored");
  const finalState = await first.evaluate(() => ({
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    events: window.__displayProbeEvents,
  }));
  assert.equal(finalState.focused, true);
  assert.ok(finalState.events.some(event => event.isTrusted
    && (event.name === "blur" || event.visibility === "hidden")));
  assert.ok(finalState.events.some(event => event.isTrusted && event.name === "focus"));

  await browser.close();
  browser = null;
  const displayStop = await display.stop();
  const result = {
    schema: "vivary.05b-gui-display-probe-result/v1",
    passed: true,
    driverFocusEmulationEnabled: false,
    focusSessionCount: focusSessions.length,
    preparation,
    actualSequence,
    chromium: chromiumIdentity,
    playwrightPackageJson: playwrightIdentity,
    display: { ...display.metadata, ...displayStop },
    afterBlur,
    finalState,
    draftSha256: createHash("sha256").update("Draft survives real focus").digest("hex"),
  };
  stage = "write-result";
  const output = Buffer.from(`${JSON.stringify(result, null, 2)}\n`);
  assert.ok(output.length <= 64 * 1024);
  await writeFile(path.join(config.evidenceRoot, "display-probe-result.json"), output,
    { flag: "wx", mode: 0o600 });
} catch (error) {
  try {
    const observedState = first ? await first.evaluate(() => ({
      focused: document.hasFocus(),
      visibility: document.visibilityState,
      events: window.__displayProbeEvents ?? [],
    })).catch(() => null) : null;
    const failure = Buffer.from(`${JSON.stringify({
      schema: "vivary.05b-gui-display-probe-failure/v1",
      stage,
      error: String(error?.message ?? error).slice(0, 4096),
      driverFocusEmulationEnabled: false,
      focusSessionCount: focusSessions.length,
      observedState,
      preparation,
      actualSequence,
    }, null, 2)}\n`);
    assert.ok(failure.length <= 64 * 1024);
    await writeFile(path.join(config.evidenceRoot, "display-probe-failure.json"), failure,
      { flag: "wx", mode: 0o600 });
  } catch {}
  throw error;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (display) await display.stop().catch(() => undefined);
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}
