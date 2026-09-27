import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import test, { afterEach } from "node:test";
import { pathToFileURL } from "node:url";

// Issue #104. Vivary turns Core's Builder.io offers off in local mode through one Core switch. These
// cases check the switch and each server-side surface with it off and on. Core's package entries do
// not export every module, so load the installed, patched files by path.
const coreRoot = await realpath(new URL("../node_modules/@agent-native/core", import.meta.url));
const toolkitRoot = await realpath(new URL("../node_modules/@agent-native/toolkit", import.meta.url));
const load = relative => import(pathToFileURL(path.join(coreRoot, "dist", relative)).href);
const coreSource = relative => readFile(path.join(coreRoot, "dist", relative), "utf8");
const toolkitSource = relative => readFile(path.join(toolkitRoot, "dist", relative), "utf8");
// A missing module fails each case below rather than the whole file.
const offers = await load("shared/builder-offers.js").catch(() => ({}));
const server = await import("@agent-native/core/server");

afterEach(() => offers.setBuilderOffersEnabled?.(true));

test("the switch defaults on, turns off, and reaches the browser through the page config", async () => {
  assert.equal(typeof offers.setBuilderOffersEnabled, "function", "Core exports the switch");
  assert.equal(server.setBuilderOffersEnabled, offers.setBuilderOffersEnabled, "the server entry exports it");
  const { resolvePublicAppOriginConfig } = await load("server/app-origin-config.js");
  assert.equal(offers.builderOffersEnabled(), true);
  assert.equal(resolvePublicAppOriginConfig()?.builderOffers, undefined, "Core's default adds nothing to the page");
  offers.setBuilderOffersEnabled(false);
  assert.equal(offers.builderOffersEnabled(), false);
  assert.equal(resolvePublicAppOriginConfig()?.builderOffers, false);
});

test("the model's tools, prompts, and error texts drop Builder.io when offers are off", async () => {
  assert.equal(typeof offers.setBuilderOffersEnabled, "function", "Core exports the switch");
  const [credentialErrors, contextTools, browserTools, frameworkPrompts, webSearch, uploadImage] = await Promise.all([
    load("agent/engine/credential-errors.js"),
    load("server/agent-chat/context-tools.js"),
    load("server/agent-chat/browser-team-tools.js"),
    load("server/agent-chat/framework-prompts.js"),
    load("extensions/web-search-tool.js"),
    load("file-upload/actions/upload-image.js"),
  ]);
  const surfaces = async () => {
    const tools = browserTools.createBuilderBrowserTool({ getOrigin: () => "http://127.0.0.1:1",
      getOwner: () => "owner@example.test", extensionTools: false });
    const context = contextTools.createFrameworkContextEntry()["get-framework-context"];
    return {
      toolNames: Object.keys(tools),
      storageCard: tools["connect-file-storage"]?.tool?.description ?? "",
      prompts: JSON.stringify(frameworkPrompts.buildFrameworkPrompts("", {})),
      contextTopics: JSON.stringify(context.tool.parameters),
      builderTopic: String(await context.run({ topic: "builder" })),
      webSearch: JSON.stringify(webSearch.createWebSearchToolEntry()),
      uploadImage: uploadImage.default.tool.description,
      missingCredentials: credentialErrors.llmMissingCredentialsMessage?.() ?? credentialErrors.LLM_MISSING_CREDENTIALS_MESSAGE,
    };
  };
  // Core's text is kept when offers are on, which shows each surface can carry an offer.
  const hosted = await surfaces();
  assert.ok(hosted.toolNames.includes("connect-builder") && hosted.toolNames.includes("activate-browser"));
  for (const key of ["storageCard", "prompts", "contextTopics", "builderTopic", "webSearch", "uploadImage", "missingCredentials"]) {
    assert.match(hosted[key], /builder/i, `${key} offers Builder with offers on`);
  }
  offers.setBuilderOffersEnabled(false);
  const local = await surfaces();
  assert.deepEqual(local.toolNames.filter(name => name === "connect-builder" || name === "activate-browser"), []);
  for (const key of ["storageCard", "contextTopics", "webSearch", "uploadImage", "missingCredentials"]) {
    assert.doesNotMatch(local[key], /builder/i, key);
  }
  // "builder-coach mode" is a working style in Core's prompt, not a Builder.io offer.
  assert.doesNotMatch(local.prompts.replaceAll("builder-coach", ""), /builder/i, "prompts");
  assert.match(local.builderTopic, /^Unknown topic "builder"/);
  assert.match(local.missingCredentials, /^No LLM provider is connected\./, "run-recovery still recognizes the message");
  assert.match(local.missingCredentials, /your own provider key/);
});

test("voice, transcription, and attachment messages check the switch", async () => {
  for (const [file, pattern] of [
    ["server/transcribe-voice.js", /builderOffersEnabled\(\)\s*\?\s*"No voice transcription provider configured\. Connect Builder\.io/],
    ["server/realtime-voice.js", /builderOffersEnabled\(\)\s*\?\s*"Connect Builder \(free tier available\)/],
    ["file-upload/pre-upload-attachments.js", /builderOffersEnabled\(\)\s*\?\s*"Call `connect-file-storage` now so the user can connect Builder/],
  ]) {
    assert.match(await coreSource(file), pattern, file);
  }
});

test("Vivary turns the offers off in local mode only", async () => {
  const plugin = await readFile(new URL("../server/plugins/00-builder-offers.ts", import.meta.url), "utf8")
    .catch(() => "");
  assert.match(plugin, /setBuilderOffersEnabled\(process\.env\.VIVARY_ACCESS_MODE !== "local"\)/);
});

test("Settings, onboarding, and the code-access panel check the switch", async () => {
  const settings = await coreSource("client/settings/SettingsPanel.js");
  assert.match(settings, /function UseBuilderCard\(props\) \{\n\s+return builderOffersEnabled\(\) \? _jsx\(BuilderOfferCard/);
  assert.match(settings, /section !== "browser" && section !== "background"/);
  assert.doesNotMatch(settings, /t\("agentPanel\.builderOrOwnKeys", \{\s*defaultValue: "Choose Builder\.io or custom keys\.",\s*\}\)/,
    "every provider summary goes through the switch");
  const onboarding = await coreSource("client/onboarding/FirstRunOnboarding.js");
  assert.match(onboarding, /setScreen\(builderOffersEnabled\(\) \? "choice" : "manual"\)/);
  assert.match(onboarding, /if \(screen === "choice" && builderOffersEnabled\(\)\)/);
  const voice = await coreSource("client/settings/VoiceTranscriptionSection.js");
  assert.match(voice, /builderOffersEnabled\(\) && _jsx\(ProviderOption, \{ id: "builder-gemini"/);
  for (const [file, pattern] of [
    ["client/settings/BuilderConnectPopover.js", /BuilderConnectPopover\([^)]*\) \{\n[^\n]*\n\s+if \(!builderOffersEnabled\(\)\)\n\s+return null;/],
    ["client/setup-connections/BuilderConnectCard.js", /BuilderConnectCard\([^)]*\) \{\n[^\n]*\n\s+if \(!builderOffersEnabled\(\)\)\n\s+return null;/],
    ["client/FileStorageSetupCard.js", /FileStorageSetupCard\(\) \{\n[^\n]*\n\s+if \(!builderOffersEnabled\(\)\)\n\s+return null;/],
    ["client/AgentPanel.js", /builderOffersEnabled\(\) && _jsx\("a", \{ href: builderHref/],
    ["client/chat/run-recovery.js", /const shouldShowBuilderReconnect = builderOffersEnabled\(\) && isBuilderReconnectRunError\(info\);/],
    ["client/composer/runtime-adapters.js", /get offersEnabled\(\) \{\n\s+return builderOffersEnabled\(\);/],
  ]) {
    assert.match(await coreSource(file), pattern, file);
  }
});

test("the toolkit model picker and voice setup follow the adapter switch", async () => {
  assert.match(await toolkitSource("composer/runtime-adapters.js"), /builder: \{\n\s+offersEnabled: true,/);
  assert.match(await toolkitSource("composer/TiptapComposer.js"),
    /const showBuilderAction = adapters\.builder\.offersEnabled !== false && providerSetupWanted;/);
  const voice = await toolkitSource("composer/VoiceButton.js");
  assert.match(voice, /copy: setupCopy, showConnectBuilder: builderOffers,/);
  assert.match(await toolkitSource("composer/RealtimeVoiceMode.js"), /\[!showConnectBuilder \? null : BuilderConnectPopover/);
});
