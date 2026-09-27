import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

// Issue #97. Every value below is random, generated for this run, and never a real credential.
// A failed comparison masks the generated values before it reports text.
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-credential-redaction-"));
const database = `file:${path.join(caseRoot, "secrets.sqlite")}`;
const generated: string[] = [];
// Letters and digits ending in a digit and a letter, or lower-case hex.
const synthetic = (length = 40, alphabet: "alnum" | "hex" = "alnum") => {
  const value = alphabet === "hex" ? randomBytes(length).toString("hex").slice(0, length)
    : randomBytes(length * 2).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, length - 2) + "7q";
  generated.push(value);
  return value;
};
Object.assign(process.env, { DATABASE_URL: database, DATABASE_URL_UNPOOLED: database, BETTER_AUTH_SECRET: synthetic(48) });
after(() => rm(caseRoot, { recursive: true, force: true }));

const {
  createCredentialRedactor, heldCredentialCount, redactCredentialPatterns, redactCredentials, refreshHeldCredentials,
  defaultCredentialSources,
} = await import("../server/credential-redaction.ts");

const masked = (text: string) => generated.reduce((out, value) => out.split(value).join("<generated>"), text);
function assertText(actual: string, expected: string, label = "") {
  if (actual !== expected) assert.fail(`${label} ${masked(actual)} !== ${masked(expected)}`);
}
function assertMatch(text: string, pattern: RegExp, label = "") {
  if (!pattern.test(text)) assert.fail(`${label} ${masked(text).slice(0, 2_000)} does not match ${pattern}`);
}
function assertHidden(text: string, values: string[], label = "") {
  const shown = values.filter(value => text.includes(value)).length;
  assert.equal(shown, 0, `${label} showed ${shown} generated value(s)`);
}
const noSources = { environment: () => ({}), mcpConfig: () => null, storedSecrets: async () => [] };

test("a held value and its URL, JSON, and base64 forms become the labeled placeholder", () => {
  const value = `${synthetic(36)}/+"?`;
  const redactor = createCredentialRedactor([{ name: "OPENROUTER_API_KEY", value }]);
  const label = "[redacted OPENROUTER_API_KEY]";
  for (const form of [value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)]) {
    assertText(redactor.redact(`before ${form} after`), `before ${label} after`, "plain form");
  }
  // Inside a longer base64 string, at each of the three byte alignments, in standard and URL-safe alphabets.
  for (const prefix of ["", "a", "ab"]) {
    for (const encoding of ["base64", "base64url"] as const) {
      const encoded = Buffer.from(`${prefix}${value}tail`).toString(encoding);
      const output = redactor.redact(`before ${encoded} after`);
      assertMatch(output, /^before .{0,3}\[redacted OPENROUTER_API_KEY\].{0,10} after$/, `${encoding} at offset ${prefix.length}`);
    }
  }
});

test("common key formats that Vivary does not hold are redacted", () => {
  const alnum = (length: number) => synthetic(length);
  const upper = (length: number) => randomBytes(length).toString("hex").toUpperCase().slice(0, length);
  const tokens: Record<string, string> = {
    openai: `sk-proj-${alnum(48)}`, openrouter: `sk-or-v1-${synthetic(64, "hex")}`, github: `ghp_${alnum(36)}`,
    githubOAuth: `gho_${alnum(36)}`, githubPat: `github_pat_${alnum(22)}_${alnum(59)}`, aws: `AKIA${upper(16)}`,
    google: `AIza${alnum(35)}`, slack: `xoxb-${upper(12)}-${alnum(24)}`,
  };
  for (const [kind, token] of Object.entries(tokens)) {
    generated.push(token);
    assertText(redactCredentialPatterns(`value ${token} end`), "value [redacted credential] end", kind);
  }
  const bearer = synthetic(32);
  assertText(redactCredentialPatterns(`Authorization: Bearer ${bearer}`), "Authorization: Bearer [redacted credential]");
  const password = synthetic(20);
  assertText(redactCredentialPatterns(`postgres://app:${password}@db.example.test:5432/app`),
    "postgres://app:[redacted credential]@db.example.test:5432/app");
  // Credential-named assignments, including a prefixed environment name, a .env dump, and JSON.
  const [one, two, three, hex] = [synthetic(40), synthetic(44), synthetic(30), synthetic(40, "hex")];
  assertText(redactCredentialPatterns(`OPENROUTER_API_KEY=${one}\nexport GITHUB_TOKEN="${two}"\nX_API_KEY=${hex}\n`),
    "OPENROUTER_API_KEY=[redacted credential]\nexport GITHUB_TOKEN=\"[redacted credential]\"\nX_API_KEY=[redacted credential]\n");
  assertText(redactCredentialPatterns(`{"apiKey": "${three}", "client_secret":"${one}"}`),
    '{"apiKey": "[redacted credential]", "client_secret":"[redacted credential]"}');
});

test("code, paths, settings, and short values are not redacted", () => {
  for (const text of [
    // guard:allow-env-credential - A sample line of code text for the redactor, never an environment read.
    "const apiKey = process.env.OPENROUTER_API_KEY;", "apiKey: config.providers.openrouter.apiKey",
    "token = getToken(request)", "DATABASE_URL=file:/tmp/vivary/auth.sqlite", "OPENAI_BASE_URL=https://api.example.test/v1",
    "key: 2026-09-27T00:00:00Z", "password: short1", "the task-force report was risk-assessment-framework-document",
    "GOOGLE_APPLICATION_CREDENTIALS=/home/owner/service-account.json", "Bearer tokens are described in RFC 6750.",
    "AUTH_URL=https://auth.example.test/login", "postgres://app@db.example.test:5432/app",
  ]) assertText(redactCredentialPatterns(text), text);
});

test("held values come from credential settings, MCP configuration, and stored secrets, and settings that are not secret are skipped", async () => {
  const [provider, dbPassword, webhook, headerToken, githubToken, stored, access, refresh, mcpHeader] =
    [synthetic(48), synthetic(20), synthetic(30), synthetic(32), synthetic(40), synthetic(51), synthetic(40), synthetic(40), synthetic(36)];
  const environment = {
    OPENROUTER_API_KEY: provider, PATH: `/usr/bin:/opt/${synthetic(20)}`, DATABASE_URL: "file:/tmp/vivary/auth.sqlite",
    POSTGRES_URL: `postgres://app:${dbPassword}@db.example.test/app`, SERVICE_TOKEN_PORT: "5173", SHORT_TOKEN: "abc123",
    FEATURE_TOKEN_ENABLED: "true", SLACK_WEBHOOK_URL: `https://hooks.example.test/services/${webhook}`,
  };
  const mcpConfig = { source: "test", servers: {
    docs: { type: "http" as const, url: "https://mcp.example.test", headers: { Authorization: `Bearer ${headerToken}`, Accept: "application/json-seq-with-extras" } },
    local: { type: "stdio" as const, command: "node", env: { GITHUB_TOKEN: githubToken, LOG_LEVEL: "debug-verbose-mode-on" } },
  } };
  const bundle = JSON.stringify({ access_token: access, refresh_token: refresh, expires_at: "2026-09-27T12:00:00.000Z" });
  await refreshHeldCredentials({ environment: () => environment, mcpConfig: () => mcpConfig, storedSecrets: async () => [
    { name: "OPENAI_API_KEY", value: stored }, { name: "google_tokens", value: bundle },
    { name: "mcp_headers:docs", value: JSON.stringify({ Authorization: `Bearer ${mcpHeader}` }) },
  ] });
  for (const [name, value] of [["OPENROUTER_API_KEY", provider], ["POSTGRES_URL", dbPassword], ["Authorization", headerToken],
    ["GITHUB_TOKEN", githubToken], ["OPENAI_API_KEY", stored], ["google_tokens", access], ["google_tokens", refresh],
    ["mcp_headers:docs", mcpHeader]]) {
    assertText(redactCredentials(`x ${value} y`), `x [redacted ${name}] y`, name);
  }
  assertText(redactCredentials(`hook https://hooks.example.test/services/${webhook} end`), "hook [redacted SLACK_WEBHOOK_URL] end");
  for (const text of [environment.PATH, "file:/tmp/vivary/auth.sqlite", "2026-09-27T12:00:00.000Z", "debug-verbose-mode-on",
    "application/json-seq-with-extras", "5173", "abc123"]) assertText(redactCredentials(text), text);
  await refreshHeldCredentials(noSources);
});

test("the secret store and legacy credential settings are read from the database", async () => {
  const { writeAppSecret, encryptSecretValue } = await import("@agent-native/core/secrets");
  const { putSetting } = await import("@agent-native/core/settings");
  const [storedKey, legacyEncrypted, legacyPlain] = [synthetic(44), synthetic(40), synthetic(36)];
  await writeAppSecret({ key: "OPENROUTER_API_KEY", value: storedKey, scope: "user", scopeId: "owner@example.test" });
  await putSetting("u:owner@example.test:credential:LEGACY_API_KEY", { value: encryptSecretValue(legacyEncrypted) });
  await putSetting("o:org-a:credential:LEGACY_TOKEN", { value: legacyPlain });
  await refreshHeldCredentials({ ...defaultCredentialSources, environment: () => ({}), mcpConfig: () => null });
  assertText(redactCredentials(`${storedKey} ${legacyEncrypted} ${legacyPlain}`),
    "[redacted OPENROUTER_API_KEY] [redacted LEGACY_API_KEY] [redacted LEGACY_TOKEN]");
  // A failed read keeps the values from the last read.
  await refreshHeldCredentials({ environment: () => ({}), mcpConfig: () => null, storedSecrets: async () => { throw new Error("database closed"); } });
  assertText(redactCredentials(storedKey), "[redacted OPENROUTER_API_KEY]");
  await refreshHeldCredentials(noSources);
});

test("a redactor exposes redact and a count, never its values", async () => {
  const [first, second] = [synthetic(40), synthetic(40)];
  const redactor = createCredentialRedactor([{ name: "A_TOKEN", value: first }, { name: "B_TOKEN", value: second },
    { name: "C_TOKEN", value: first }, { name: "SHORT_TOKEN", value: "short" }]);
  assert.equal(redactor.count, 2);
  assert.deepEqual(Object.keys(redactor).sort(), ["count", "redact"]);
  assertHidden(JSON.stringify(redactor), [first, second], "serialized redactor");
  await refreshHeldCredentials({ ...noSources, environment: () => ({ A_TOKEN: first, B_TOKEN: second }) });
  assert.equal(heldCredentialCount(), 2);
  await refreshHeldCredentials(noSources);
  assert.equal(heldCredentialCount(), 0);
});

test("redacting a megabyte against forty held values stays fast", () => {
  const held = Array.from({ length: 40 }, (_, index) => ({ name: `SYNTH_${index}_API_KEY`, value: synthetic(24 + index) }));
  const redactor = createCredentialRedactor(held);
  const filler = "lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10_000);
  const text = `${filler}${held[3].value}${filler}${Buffer.from(`x${held[7].value}`).toString("base64")}`;
  const started = performance.now();
  const output = redactor.redact(text);
  const elapsed = performance.now() - started;
  assertHidden(output, held.map(entry => entry.value), "large text");
  assert.ok(elapsed < 1_000, `took ${Math.round(elapsed)} ms`);
});

test("original command output and component receipts keep placeholders only", async () => {
  const { originalChildEnvironment, runOriginalProcess, createOriginalCommandRunner } = await import("../server/original-runtime.ts");
  const { bundle, context, projectWorkspace } = await import("./original-runtime-harness.ts");
  const [held, pattern] = [synthetic(40), `ghp_${synthetic(36)}`];
  await refreshHeldCredentials({ ...noSources, environment: () => ({ VIVARY_PROBE_TOKEN: held }) });
  try {
    const env = originalChildEnvironment(process.env, path.join(caseRoot, "unused-receipts.jsonl"));
    const printed = await runOriginalProcess(process.execPath,
      ["-e", "process.stdout.write(process.argv[1]); process.stderr.write(process.argv[2])", held, pattern], "", caseRoot, env);
    assertText(printed.stdout, "[redacted VIVARY_PROBE_TOKEN]");
    assertText(printed.stderr, "[redacted credential]");

    const { directory, runtime, data } = await bundle("vivary-redaction-receipts-");
    const root = path.join(directory, "project");
    await mkdir(root);
    const runner = createOriginalCommandRunner({ parallelism: 1,
      environment: () => ({ VIVARY_ORIGINAL_RUNTIME: runtime, VIVARY_DATA_DIR: data }),
      resolveWorkspace: async () => projectWorkspace("project-a", root),
      execute: async (_python, args, _stdin, _cwd, environment) => {
        await writeFile(environment.VIVARY_RECEIPT_LOG!, JSON.stringify({ command: args[6], note: `used ${held} and ${pattern}` }) + "\n");
        return { exitCode: 0, stdout: "{}", stderr: "", signal: null };
      } });
    await runner({ projectId: "project-a", command: { verb: "pattern-state" } }, context);
    const receipts = await readFile(path.join(data, "original-runtime", "receipts.jsonl"), "utf8");
    assertHidden(receipts, [held, pattern], "receipts");
    assertMatch(receipts, /used \[redacted VIVARY_PROBE_TOKEN\] and \[redacted credential\]/);
    await rm(directory, { recursive: true, force: true });
  } finally {
    await refreshHeldCredentials(noSources);
  }
});

test("server output is redacted, including console output and direct writes", async () => {
  const [held, pattern] = [synthetic(40), `sk-${synthetic(40)}`];
  const plugin = pathToFileURL(path.join(import.meta.dirname, "..", "server", "plugins", "00-credential-redaction.ts")).href;
  // The child receives the values as arguments and through its environment, never in this file's text.
  const script = `const { default: plugin } = await import(${JSON.stringify(plugin)});
plugin({});
const [held, pattern] = process.argv.slice(-2);
console.error("console", held, pattern);
process.stderr.write("direct " + held + " " + pattern + "\\n");
console.log("stdout", held);
process.stdout.write(Buffer.from("buffer " + held + "\\n"));
// A pending database read must not keep the child alive.
setTimeout(() => process.exit(0), 200).unref();`;
  // A failure message would quote the command line, so it reports the masked output instead.
  const { stdout, stderr } = await promisify(execFile)(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script, "--", held, pattern], {
    cwd: path.join(import.meta.dirname, ".."), timeout: 60_000,
    env: { ...process.env, VIVARY_PROBE_TOKEN: held, DATABASE_URL: `file:${path.join(caseRoot, "plugin.sqlite")}` },
  }).catch((error: { code?: unknown; stderr?: string }) =>
    assert.fail(`the server child failed (${String(error.code)}): ${masked(String(error.stderr ?? "")).slice(0, 2_000)}`));
  assertHidden(stdout + stderr, [held, pattern], "server output");
  assertMatch(stderr, /console \[redacted VIVARY_PROBE_TOKEN\] \[redacted credential\]/);
  assertMatch(stderr, /direct \[redacted VIVARY_PROBE_TOKEN\] \[redacted credential\]/);
  assertMatch(stdout, /stdout \[redacted VIVARY_PROBE_TOKEN\]\nbuffer \[redacted VIVARY_PROBE_TOKEN\]/);
});
