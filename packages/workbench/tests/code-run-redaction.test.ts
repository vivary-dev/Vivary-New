import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

// Issue #97, Code runs. The coding worker receives salted fingerprints of the held values, never
// the values, and redacts each transcript event before it is written. Every value is random and
// generated for this run. A failed comparison masks the generated values before it reports text.
const workbench = path.join(import.meta.dirname, "..");
const caseRoot = await mkdtemp(path.join(tmpdir(), "vivary-code-redaction-"));
const database = `file:${path.join(caseRoot, "code.sqlite")}`;
const codeRuns = path.join(caseRoot, "code-runs");
const generated: string[] = [];
const synthetic = (length = 40) => {
  const value = randomBytes(length * 2).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, length - 2) + "9m";
  generated.push(value);
  return value;
};
const held = synthetic();
Object.assign(process.env, { DATABASE_URL: database, DATABASE_URL_UNPOOLED: database, VIVARY_ACCESS_MODE: "local",
  AGENT_NATIVE_CODE_AGENTS_HOME: codeRuns, VIVARY_PROBE_TOKEN: held });
after(() => rm(caseRoot, { recursive: true, force: true }));

const redaction = await import("../server/credential-redaction.ts");
const { isVivaryCodeWorkerRequest } = await import("../server/code-execution-protocol.ts");
const { buildVivaryCodeFollowUpPrompt, getVivaryCodeState, sendVivaryCodeMessage } = await import("../server/local-code-agent.ts");
const { codeAgentRunTranscriptPath, getCodeAgentRunRecord, listCodeAgentTranscriptEvents } = await import("@agent-native/core/code-agents");
const { setTextRedactor } = await import("@agent-native/core/audit");
// The server process registers its redactor as the Nitro plugin does.
setTextRedactor(redaction.redactCredentials);

const masked = (text: string) => generated.reduce((out, value) => out.split(value).join("<generated>"), text);
function assertText(actual: string, expected: string, label = "") {
  if (actual !== expected) assert.fail(`${label} ${masked(actual)} !== ${masked(expected)}`);
}
function assertMatch(text: string, pattern: RegExp, label = "") {
  if (!pattern.test(text)) assert.fail(`${label} ${masked(text).slice(0, 2_000)} does not match ${pattern}`);
}
function assertHidden(text: string, values: string[], label: string) {
  const shown = values.filter(value => text.includes(value)).length;
  assert.equal(shown, 0, `${label} showed ${shown} generated value(s)`);
}
const fingerprintsOf = () => {
  assert.equal(typeof redaction.credentialFingerprints, "function", "the redaction module has no worker fingerprints");
  return redaction.credentialFingerprints();
};

test("worker fingerprints redact like the server redactor and carry no held value", async () => {
  const special = `${synthetic(30)}/+"?`;
  await redaction.refreshHeldCredentials({ environment: () => ({ VIVARY_PROBE_TOKEN: held, OTHER_API_KEY: special }),
    mcpConfig: () => null, storedSecrets: async () => [] });
  const fingerprints = fingerprintsOf();
  assert.equal(redaction.isCredentialFingerprints(fingerprints), true);
  const base64 = ["", "a", "ab"].flatMap(prefix => [Buffer.from(`${prefix}${held}tail`).toString("base64"),
    Buffer.from(`${prefix}${special}tail`).toString("base64url")]);
  const forms = [held, special, encodeURIComponent(special), JSON.stringify(special).slice(1, -1),
    Buffer.from(held).toString("base64").slice(0, 40)];
  assertHidden(JSON.stringify(fingerprints), forms, "fingerprints");
  const worker = redaction.createFingerprintRedactor(fingerprints);
  assert.equal(worker.count, 2);
  const samples = [`a ${held} b`, `url ${encodeURIComponent(special)} end`, `json "${JSON.stringify(special).slice(1, -1)}"`,
    ...base64, `ghp_${synthetic(36)} and OPENROUTER_API_KEY=${synthetic(44)}`, "nothing to redact here", `${held}${held}`];
  for (const sample of samples) assertText(worker.redact(sample), redaction.redactCredentials(sample), "worker and server");
  assertHidden(samples.map(sample => worker.redact(sample)).join("\n"), [held, special], "worker output");
  const again = fingerprintsOf();
  assert.notEqual(again.salt, fingerprints.salt);
  assert.notDeepEqual(again.entries.map(entry => entry.digest), fingerprints.entries.map(entry => entry.digest));
});

test("the worker start request requires fingerprints and refuses any other credential field", async () => {
  await redaction.refreshHeldCredentials({ environment: () => ({ VIVARY_PROBE_TOKEN: held }), mcpConfig: () => null, storedSecrets: async () => [] });
  const fingerprints = fingerprintsOf();
  const request = { type: "vivary:code-worker:start", runId: "vivary-local-code-test", prompt: "Read the note.",
    ownerEmail: "owner@local.vivary.test", redaction: fingerprints };
  assert.equal(isVivaryCodeWorkerRequest(request), true);
  const { redaction: _omitted, ...withoutFingerprints } = request;
  for (const invalid of [withoutFingerprints, { ...request, redaction: { ...fingerprints, values: [held] } },
    { ...request, redaction: { ...fingerprints, salt: "short" } },
    { ...request, redaction: { ...fingerprints, entries: [{ ...fingerprints.entries[0], value: held }] } },
    { ...request, redaction: { ...fingerprints, entries: [{ ...fingerprints.entries[0], digest: "not-a-digest" }] } },
  ]) assert.equal(isVivaryCodeWorkerRequest(invalid), false);
});

test("a Claude run that prints a held value keeps placeholders only in the transcript, the state, and the follow-up prompt",
  { timeout: 120_000, skip: process.platform === "win32" }, async () => {
    await redaction.refreshHeldCredentials({ environment: () => ({}), mcpConfig: () => null, storedSecrets: async () => [] });
    const fixture = await mkdtemp(path.join(tmpdir(), "vivary-code-redaction-run-"));
    const server = path.join(fixture, ".output", "server");
    const bin = path.join(fixture, "bin");
    const started = path.join(fixture, "started.json");
    await mkdir(server, { recursive: true });
    await mkdir(bin);
    const token = `ghp_${synthetic(36)}`;
    // The project file holds both values, as a real .env or note might. The stub reads it like an agent would.
    await writeFile(path.join(fixture, "probe.txt"), `${held}\n${token}\n`);
    await writeFile(path.join(bin, "claude"), `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
if (process.argv[2] === "auth") {
  process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty", subscriptionType: "pro" }));
  process.exit(0);
}
process.stdin.resume();
process.stdin.on("end", () => {
  const probe = readFileSync("probe.txt", "utf8");
  const [value, pattern] = probe.trim().split("\\n");
  const reply = "The file holds " + value + " and " + pattern + ".";
  for (const line of [
    { type: "system", subtype: "init", session_id: "00000000-0000-4000-8000-000000000097" },
    { type: "assistant", message: { content: [{ type: "text", text: "Reading probe.txt." },
      { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "probe.txt" } }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "tool-1", content: probe }] } },
    { type: "assistant", message: { content: [{ type: "thinking", thinking: "It holds " + value }, { type: "text", text: reply }] } },
    { type: "result", subtype: "success", is_error: false, result: reply, session_id: "00000000-0000-4000-8000-000000000097" },
  ]) process.stdout.write(JSON.stringify(line) + "\\n");
});
`, { mode: 0o755 });
    // The built worker is this source file. tsx loads it, and the wrapper keeps a copy of the start request.
    await writeFile(path.join(server, "vivary-code-worker.mjs"), `
import { writeFileSync } from "node:fs";
import { register } from ${JSON.stringify(import.meta.resolve("tsx/esm/api"))};
process.on("message", message => {
  if (message?.type === "vivary:code-worker:start") writeFileSync(${JSON.stringify(started)}, JSON.stringify(message));
});
register();
await import(${JSON.stringify(pathToFileURL(path.join(workbench, "server", "code-execution-worker.ts")).href)});
`);
    const owner = "redaction@example.test";
    const workspace = { root: fixture, label: "Redaction project", projectId: "redaction", bindingId: "redaction-binding",
      rootId: "redaction-root", bindingRevision: 1 };
    const previousCwd = process.cwd();
    // guard:allow-env-credential - Isolated synthetic test configuration, restored after the run.
    const previousPath = process.env.PATH;
    try {
      process.chdir(fixture);
      Object.assign(process.env, { PATH: bin + path.delimiter + (previousPath ?? "") });
      const state = await sendVivaryCodeMessage({ ownerEmail: owner, message: "Read probe.txt and tell me what it holds.",
        engine: "claude-cli", model: "sonnet", workspace, revalidateWorkspace: async () => workspace });
      const runId = state.run!.id;
      let record = getCodeAgentRunRecord(runId);
      for (let attempt = 0; attempt < 400 && !["completed", "errored", "paused"].includes(String(record?.status)); attempt++) {
        await delay(100);
        record = getCodeAgentRunRecord(runId);
      }
      for (let attempt = 0; attempt < 100 && (await getVivaryCodeState(owner, runId, workspace)).activeRun; attempt++) await delay(100);
      assert.equal(record?.status, "completed", `the run ended as ${String(record?.status)}`);

      const transcript = await readFile(codeAgentRunTranscriptPath(runId), "utf8");
      assertHidden(transcript, [held, token], "transcript");
      assertMatch(transcript, /The file holds \[redacted VIVARY_PROBE_TOKEN\] and \[redacted credential\]\./);
      assertMatch(transcript, /"result":"\[redacted VIVARY_PROBE_TOKEN\]\\n\[redacted credential\]/);
      const stored: string[] = [];
      const walk = async (directory: string) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const target = path.join(directory, entry.name);
          if (entry.isDirectory()) await walk(target);
          else stored.push(await readFile(target, "utf8"));
        }
      };
      await walk(codeRuns);
      assertHidden(stored.join("\n"), [held, token], "code-runs folder");

      const request = await readFile(started, "utf8");
      assertHidden(request, [held, token], "worker start request");
      assert.ok((JSON.parse(request).redaction?.entries?.length ?? 0) > 0, "the worker received fingerprints");
      const shown = JSON.stringify(await getVivaryCodeState(owner, runId, workspace));
      assertHidden(shown, [held, token], "state route");
      assertMatch(shown, /\[redacted VIVARY_PROBE_TOKEN\]/);
      const followUp = buildVivaryCodeFollowUpPrompt(listCodeAgentTranscriptEvents(runId), "What else is in it?");
      assertHidden(followUp, [held, token], "follow-up prompt");
      assertMatch(followUp, /Assistant: The file holds \[redacted VIVARY_PROBE_TOKEN\] and \[redacted credential\]\./);
    } finally {
      process.chdir(previousCwd);
      Object.assign(process.env, { PATH: previousPath });
      await rm(fixture, { recursive: true, force: true });
    }
  });
