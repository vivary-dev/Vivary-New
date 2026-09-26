import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { codingRuntimeEnvironment, getVivaryRuntimeStatus, resolveVivaryRuntimeCommand, vivaryRuntimeStatusFromProbe } from "../server/local-runtime-setup.ts";

describe("local coding runtime status", () => {
  it("uses Claude's boolean status without returning account details", () => {
    const result = vivaryRuntimeStatusFromProbe("claude-cli", {
      kind: "exited", exitCode: 0,
      stdout: JSON.stringify({ loggedIn: true, authMethod: "claude.ai", email: "private@example.test", organization: "private" }),
      stderr: "private diagnostics",
    });
    assert.equal(result.status, "ready");
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.equal(vivaryRuntimeStatusFromProbe("claude-cli", {
      kind: "exited", exitCode: 1, stdout: '{"loggedIn":false}', stderr: "",
    }).status, "sign-in-required");
  });

  it("rejects malformed, misleading, and failed Claude status", () => {
    for (const stdout of ["not json", "null", "[]", '{"loggedIn":"true"}', "{}"]) {
      assert.equal(vivaryRuntimeStatusFromProbe("claude-cli", { kind: "exited", exitCode: 0, stdout, stderr: "" }).status, "unavailable");
    }
    assert.equal(vivaryRuntimeStatusFromProbe("claude-cli", {
      kind: "exited", exitCode: 2, stdout: '{"loggedIn":true}', stderr: "",
    }).status, "unavailable");
  });

  it("distinguishes Codex login failure from a failed status command", () => {
    assert.equal(vivaryRuntimeStatusFromProbe("codex-cli", {
      kind: "exited", exitCode: 0, stdout: "", stderr: "Logged in using ChatGPT",
    }).status, "ready");
    assert.equal(vivaryRuntimeStatusFromProbe("codex-cli", {
      kind: "exited", exitCode: 0, stdout: "", stderr: "Logged in using an API key",
    }).status, "unavailable");
    assert.equal(vivaryRuntimeStatusFromProbe("codex-cli", {
      kind: "exited", exitCode: 1, stdout: "", stderr: "Not logged in",
    }).status, "sign-in-required");
    assert.equal(vivaryRuntimeStatusFromProbe("codex-cli", {
      kind: "exited", exitCode: 1, stdout: "", stderr: "Could not access the credential store",
    }).status, "unavailable");
  });

  it("keeps missing installations separate from failed probes", () => {
    assert.equal(vivaryRuntimeStatusFromProbe("claude-cli", { kind: "not-installed" }).status, "not-installed");
    assert.equal(vivaryRuntimeStatusFromProbe("codex-cli", { kind: "unavailable" }).status, "unavailable");
  });

  it("deduplicates concurrent probes, caches polling, and refreshes explicitly", { skip: process.platform === "win32" }, async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "vivary-runtime-status-"));
    const countFile = path.join(fixture, "calls");
    // guard:allow-env-credential - Preserve only the test executable path, deployment mode, and CLI nesting marker.
    const previous = { PATH: process.env.PATH, VIVARY_ACCESS_MODE: process.env.VIVARY_ACCESS_MODE, CLAUDECODE: process.env.CLAUDECODE };
    try {
      const script = `#!/usr/bin/env node
const fs = require("node:fs");
// guard:allow-env-credential - The synthetic CLI checks that its nonsecret nesting marker was removed.
if (process.env.CLAUDECODE) process.exit(2);
if (JSON.stringify(process.argv.slice(2)) !== '["auth","status","--json"]') process.exit(2);
const file = ${JSON.stringify(countFile)};
const count = fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0;
fs.writeFileSync(file, String(count + 1));
setTimeout(() => process.stdout.write('{"loggedIn":true,"email":"private@example.test"}'), 50);
`;
      await writeFile(path.join(fixture, "claude"), script, { mode: 0o755 });
      // guard:allow-env-credential - Locate only the disposable allowlisted CLI fixture before normal executables.
      process.env.PATH = fixture + path.delimiter + previous.PATH;
      // guard:allow-env-credential - Select the local deployment mode for this status test.
      process.env.VIVARY_ACCESS_MODE = "local";
      // guard:allow-env-credential - Synthetic nonsecret marker verifies nested CLI state is stripped.
      process.env.CLAUDECODE = "nested-marker";
      const [one, two] = await Promise.all([
        getVivaryRuntimeStatus("claude-cli", { refresh: true }),
        getVivaryRuntimeStatus("claude-cli", { refresh: true }),
      ]);
      assert.equal(one.status, "ready");
      assert.strictEqual(one, two);
      assert.equal(await readFile(countFile, "utf8"), "1");
      await getVivaryRuntimeStatus("claude-cli");
      assert.equal(await readFile(countFile, "utf8"), "1");
      await getVivaryRuntimeStatus("claude-cli", { refresh: true });
      assert.equal(await readFile(countFile, "utf8"), "2");
      // guard:allow-env-credential - Verify hosted deployment mode cannot start local status probes.
      process.env.VIVARY_ACCESS_MODE = "hosted";
      assert.equal((await getVivaryRuntimeStatus("claude-cli")).status, "unavailable");
      assert.equal(await readFile(countFile, "utf8"), "2");
    } finally {
      // guard:allow-env-credential - Restore only the test's previous executable search path.
      if (previous.PATH === undefined) delete process.env.PATH; else process.env.PATH = previous.PATH;
      // guard:allow-env-credential - Restore only the test's previous deployment mode.
      if (previous.VIVARY_ACCESS_MODE === undefined) delete process.env.VIVARY_ACCESS_MODE; else process.env.VIVARY_ACCESS_MODE = previous.VIVARY_ACCESS_MODE;
      // guard:allow-env-credential - Restore only the test's previous CLI nesting marker.
      if (previous.CLAUDECODE === undefined) delete process.env.CLAUDECODE; else process.env.CLAUDECODE = previous.CLAUDECODE;
      await rm(fixture, { recursive: true, force: true });
    }
  });
});

// Credential names the server can hold, taken from what Agent-Native and Vivary read. The spellings
// in mixed and lower case stand for Windows, where environment names are case-insensitive.
const SERVER_CREDENTIALS = ["OPENROUTER_API_KEY", "OpenRouter_Api_Key", "openai_api_key", "CODEX_API_KEY",
  "DEEPSEEK_API_KEY", "BUILDER_GATEWAY_TOKEN", "BUILDER_PRIVATE_KEY", "BETTER_AUTH_SECRET", "AUTH_SECRET",
  "A2A_SECRET", "OAUTH_STATE_SECRET", "SECRETS_ENCRYPTION_KEY", "Vivary_SECRETS_ENCRYPTION_KEY",
  "WORKSPACE_SECRETS_ENCRYPTION_KEY", "WORKSPACE_SECRETS_ENCRYPTION_KEY_PREVIOUS", "DATABASE_URL",
  "DATABASE_URL_UNPOOLED", "VIVARY_DATABASE_URL", "NETLIFY_DATABASE_URL_UNPOOLED", "DATABASE_AUTH_TOKEN",
  "ACCESS_TOKEN", "ACCESS_TOKENS", "AGENT_NATIVE_MCP_HUB_TOKEN", "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SERVICE_ACCOUNT_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "TURNSTILE_SECRET_KEY",
  "R2_SECRET_ACCESS_KEY", "S3_ACCESS_KEY_ID", "SENTRY_DSN", "NOTIFICATIONS_WEBHOOK_AUTH",
  "NOTIFICATIONS_SLACK_WEBHOOK_URL", "SLACK_BOT_TOKEN", "STRIPE_SECRET_KEY", "PROMETHEUS_PASSWORD",
  "GITHUB_TOKEN", "GH_TOKEN"];
// Ordinary settings a coding runtime needs to find its login, reach the network, and build projects.
const ORDINARY_SETTINGS = ["PATH", "Path", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "SystemRoot",
  "ComSpec", "PATHEXT", "TEMP", "TMP", "LANG", "TERM", "HTTPS_PROXY", "no_proxy", "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS", "SSH_AUTH_SOCK", "CODEX_HOME", "CLAUDE_CONFIG_DIR", "XDG_CONFIG_HOME",
  "JAVA_HOME", "GOPATH", "AUTH_DISABLED", "BETTER_AUTH_URL"];

describe("coding runtime launch environment", () => {
  it("withholds credential-shaped names in any case and keeps ordinary settings", () => {
    const source = Object.fromEntries([...SERVER_CREDENTIALS, ...ORDINARY_SETTINGS, "CLAUDECODE", "CODEX_THREAD_ID"]
      .map(name => [name, `synthetic-${name}`]));
    const launch = codingRuntimeEnvironment(source);
    assert.deepEqual(SERVER_CREDENTIALS.filter(name => name in launch), [], "no server credential reaches the runtime");
    assert.deepEqual(ORDINARY_SETTINGS.filter(name => launch[name] !== `synthetic-${name}`), [], "ordinary settings pass through");
    assert.equal("CLAUDECODE" in launch || "CODEX_THREAD_ID" in launch, false, "nested-session markers are removed");
  });

  it("withholds every Native provider key Agent-Native reads", async () => {
    // Agent-Native does not export its provider list, so read the installed copy to catch a new provider.
    const coreServer = fileURLToPath(import.meta.resolve("@agent-native/core/server"));
    const listFile = path.join(path.dirname(coreServer), "..", "agent", "engine", "provider-env-vars.js");
    const { PROVIDER_ENV_VARS } = await import(pathToFileURL(listFile).href).catch((error: Error) => {
      throw new Error(`Agent-Native moved its provider list from ${listFile}. Update this test. ${error.message}`);
    });
    assert.ok(PROVIDER_ENV_VARS.length > 0);
    const launch = codingRuntimeEnvironment(Object.fromEntries(PROVIDER_ENV_VARS.map((name: string) => [name, "synthetic"])));
    assert.deepEqual(Object.keys(launch), []);
  });

  it("builds the Codex and Claude launches from the filtered environment", { skip: process.platform === "win32" }, async () => {
    const seeded = ["OPENROUTER_API_KEY", "BETTER_AUTH_SECRET", "DATABASE_URL", "HTTPS_PROXY", "PATH"];
    // guard:allow-env-credential - Snapshot only the names this test seeds, to restore them afterward.
    const previous = new Map(seeded.map(name => [name, process.env[name]]));
    const fixture = await mkdtemp(path.join(tmpdir(), "vivary-runtime-environment-"));
    try {
      for (const command of ["codex", "claude"]) await writeFile(path.join(fixture, command), "#!/bin/sh\nexit 2\n", { mode: 0o755 });
      // guard:allow-env-credential - Locate only the disposable CLI fixtures before normal executables.
      process.env.PATH = fixture + path.delimiter + previous.get("PATH");
      // guard:allow-env-credential - Seed synthetic nonsecret markers under credential names and one ordinary setting.
      Object.assign(process.env, { OPENROUTER_API_KEY: "synthetic", BETTER_AUTH_SECRET: "synthetic", DATABASE_URL: "synthetic", HTTPS_PROXY: "http://127.0.0.1:9" });
      for (const engine of ["codex-cli", "claude-cli"] as const) {
        const launch = await resolveVivaryRuntimeCommand(engine);
        assert.ok(launch, `${engine} resolves from the fixture`);
        assert.deepEqual(["OPENROUTER_API_KEY", "BETTER_AUTH_SECRET", "DATABASE_URL"].filter(name => name in launch.env), []);
        assert.equal(launch.env.HTTPS_PROXY, "http://127.0.0.1:9");
        assert.deepEqual(Object.keys(launch.env).filter(name => name.toUpperCase() === "PATH"), ["PATH"]);
      }
    } finally {
      for (const [name, value] of previous) {
        // guard:allow-env-credential - Restore only the names this test seeded.
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
      await rm(fixture, { recursive: true, force: true });
    }
  });
});
