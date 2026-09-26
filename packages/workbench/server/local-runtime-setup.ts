import type { CodexModelCatalog } from "./codex-models";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { CLI_REGISTRY, isAllowedCommand } from "@agent-native/core/terminal/server";

export type VivaryCodeEngine = "claude-cli" | "codex-cli";
export type VivaryRuntimeStatus = {
  status: "ready" | "sign-in-required" | "not-installed" | "unavailable";
  message: string;
  checkedAt: string;
};
export type VivaryRuntimeStatusResult = {
  codexModels: CodexModelCatalog | null;
  runtimes: Array<VivaryRuntimeStatus & { engine: VivaryCodeEngine; label: string }>;
};

type ProbeResult =
  | { kind: "exited"; exitCode: number; stdout: string; stderr: string }
  | { kind: "not-installed" }
  | { kind: "unavailable" };
export type CommandLaunch = { executable: string; prefix: string[]; env: NodeJS.ProcessEnv };

const STATUS_TTL_MS = 30_000;
const PROBE_TIMEOUT_MS = 10_000;
const PROBE_MAX_BYTES = 64 * 1024;
const cached = new Map<VivaryCodeEngine, { expiresAt: number; value: VivaryRuntimeStatus }>();
const pending = new Map<VivaryCodeEngine, Promise<VivaryRuntimeStatus>>();

// Coding runtimes run commands the agent chooses and keep their own logins. They never receive the
// Native provider keys that Agent-Native reads from this environment, or the sign-in secret,
// secret-store keys, and database URLs from bin/start.mjs or a deployment. The sign-in secret also
// derives the key that encrypts saved provider credentials. The provider names follow
// Agent-Native's provider list, which tests/local-runtime-setup.test.ts compares against.
const SERVER_CREDENTIAL_NAMES = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENROUTER_API_KEY",
  "GROQ_API_KEY", "MISTRAL_API_KEY", "COHERE_API_KEY", "DEEPSEEK_API_KEY",
  "BUILDER_GATEWAY_TOKEN", "BUILDER_PRIVATE_KEY",
  "BETTER_AUTH_SECRET", "A2A_SECRET", "SECRETS_ENCRYPTION_KEY", "VIVARY_SECRETS_ENCRYPTION_KEY",
  "WORKSPACE_SECRETS_ENCRYPTION_KEY", "WORKSPACE_SECRETS_ENCRYPTION_KEY_PREVIOUS",
  "DATABASE_URL", "DATABASE_URL_UNPOOLED", "VIVARY_DATABASE_URL", "VIVARY_DATABASE_URL_UNPOOLED",
];

const commands = {
  "claude-cli": { command: "claude", args: ["auth", "status", "--json"], npmEntry: ["@anthropic-ai", "claude-code", "cli.js"] },
  "codex-cli": { command: "codex", args: ["login", "status"], npmEntry: ["@openai", "codex", "bin", "codex.js"] },
} satisfies Record<VivaryCodeEngine, { command: string; args: string[]; npmEntry: string[] }>;

export function vivaryRuntimeStatusFromProbe(
  engine: VivaryCodeEngine,
  result: ProbeResult,
  checkedAt = new Date().toISOString(),
): VivaryRuntimeStatus {
  const label = CLI_REGISTRY[commands[engine].command].label;
  const unavailable: VivaryRuntimeStatus = {
    status: "unavailable",
    message: `${label} could not report its sign-in status. Check the CLI in your terminal, then refresh.`,
    checkedAt,
  };
  if (result.kind === "not-installed") {
    return { status: "not-installed", message: `Install ${label} on this computer, then refresh.`, checkedAt };
  }
  if (result.kind === "unavailable") return unavailable;

  let signedIn: boolean;
  if (engine === "claude-cli") {
    let data: unknown;
    try { data = JSON.parse(result.stdout); } catch { return unavailable; }
    if (!data || typeof data !== "object" || !("loggedIn" in data) || typeof data.loggedIn !== "boolean") {
      return unavailable;
    }
    if (result.exitCode !== 0 && !(result.exitCode === 1 && !data.loggedIn)) return unavailable;
    signedIn = data.loggedIn;
  } else if (result.exitCode === 0 && /Logged in using ChatGPT/i.test(`${result.stdout}\n${result.stderr}`)) {
    signedIn = true;
  } else if (result.exitCode === 0) {
    return { ...unavailable, message: "Sign in to Codex with ChatGPT to use your subscription in Vivary. API-key access is not enabled for this integration." };
  } else if (result.exitCode === 1 && /\bnot logged in\b/i.test(`${result.stdout}\n${result.stderr}`)) {
    signedIn = false;
  } else {
    return unavailable;
  }
  return signedIn
    ? { status: "ready", message: `${label} is ready to use.`, checkedAt }
    : { status: "sign-in-required", message: `Sign in to ${label} in your terminal, then refresh.`, checkedAt };
}

export function getVivaryRuntimeStatus(
  engine: VivaryCodeEngine,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<VivaryRuntimeStatus> {
  // guard:allow-env-credential - Deployment mode gates access to local CLI status, not a credential.
  const mode = process.env.VIVARY_ACCESS_MODE;
  if (mode !== "local" && mode !== "private-proxy") {
    return Promise.resolve({
      status: "unavailable",
      message: "Local coding runtimes are available in the self-hosted app.",
      checkedAt: new Date().toISOString(),
    });
  }
  const active = pending.get(engine);
  if (active) return active;
  const previous = cached.get(engine);
  if (!refresh && previous && previous.expiresAt > Date.now()) return Promise.resolve(previous.value);

  const check = probeRuntime(engine)
    .then(result => vivaryRuntimeStatusFromProbe(engine, result))
    .catch(() => vivaryRuntimeStatusFromProbe(engine, { kind: "unavailable" }))
    .then(value => {
      cached.set(engine, { expiresAt: Date.now() + STATUS_TTL_MS, value });
      return value;
    })
    .finally(() => { pending.delete(engine); });
  pending.set(engine, check);
  return check;
}

async function probeRuntime(engine: VivaryCodeEngine): Promise<ProbeResult> {
  const launch = await resolveVivaryRuntimeCommand(engine);
  if (!launch) return { kind: "not-installed" };
  return new Promise(resolve => {
    const child = execFile(launch.executable, [...launch.prefix, ...commands[engine].args], {
      cwd: homedir(),
      env: launch.env,
      encoding: "utf8",
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: PROBE_MAX_BYTES,
      killSignal: "SIGKILL",
      shell: false,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === "ENOENT") { resolve({ kind: "not-installed" }); return; }
        if (error.killed || typeof error.code !== "number") { resolve({ kind: "unavailable" }); return; }
        resolve({ kind: "exited", exitCode: error.code, stdout, stderr });
        return;
      }
      resolve({ kind: "exited", exitCode: 0, stdout, stderr });
    });
    child.stdin?.end();
  });
}

export async function resolveVivaryRuntimeCommand(engine: VivaryCodeEngine): Promise<CommandLaunch | null> {
  const spec = commands[engine];
  if (!isAllowedCommand(spec.command)) return null;
  const home = homedir();
  // guard:allow-env-credential - OS executable search paths locate the fixed CLI allowlist.
  const executablePath = process.env.PATH ?? process.env.Path ?? "";
  // guard:allow-env-credential - Package-manager installation directory, not a credential.
  const pnpmHome = process.env.PNPM_HOME;
  // guard:allow-env-credential - Windows user application directory locates installed CLI packages.
  const appData = process.env.APPDATA;
  // guard:allow-env-credential - Windows local application directory locates installed CLI executables.
  const localAppData = process.env.LOCALAPPDATA;
  const directories = [
    ...executablePath.split(path.delimiter),
    pnpmHome,
    path.join(home, ".local", "bin"),
    path.join(home, ".local", "share", "pnpm"),
    path.join(home, "Library", "pnpm"),
    path.join(home, ".cargo", "bin"),
    ...(process.platform === "win32"
      ? [
          appData && path.join(appData, "npm"),
          localAppData && path.join(localAppData, "Microsoft", "WinGet", "Links"),
        ]
      : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]),
  ];
  const nvmRoot = path.join(home, ".nvm", "versions", "node");
  try {
    const versions = await readdir(nvmRoot, { withFileTypes: true });
    directories.push(...versions.filter(entry => entry.isDirectory()).slice(0, 32).map(entry => path.join(nvmRoot, entry.name, "bin")));
  } catch {
    // NVM is optional. The other standard installation locations still apply.
  }
  const searchDirectories = [...new Set(directories
    .filter((directory): directory is string => typeof directory === "string" && path.isAbsolute(directory)))];
  // Windows environment names are case-insensitive, so any spelling of a withheld name is removed.
  const withheld = new Set([
    ...SERVER_CREDENTIAL_NAMES,
    ...Object.values(CLI_REGISTRY).flatMap(entry => entry.stripEnv),
    "CODEX_THREAD_ID", "CODEX_SESSION_ID",
    // Codex uses its ChatGPT login here, never an API key.
    ...(engine === "codex-cli" ? ["CODEX_API_KEY"] : []),
  ].map(name => name.toUpperCase()));
  const env: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !withheld.has(name.toUpperCase())));
  delete env.Path;
  env.PATH = searchDirectories.join(path.delimiter);

  for (const directory of searchDirectories) {
    const executable = path.join(directory, spec.command + (process.platform === "win32" ? ".exe" : ""));
    if (await isExecutable(executable)) return { executable, prefix: [], env };
    if (process.platform === "win32") {
      const npmEntry = path.join(directory, "node_modules", ...spec.npmEntry);
      if (await isFile(npmEntry)) return { executable: process.execPath, prefix: [npmEntry], env };
    }
  }
  return null;
}

async function isFile(file: string): Promise<boolean> {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

async function isExecutable(file: string): Promise<boolean> {
  if (!await isFile(file)) return false;
  try { await access(file, constants.X_OK); return true; } catch { return false; }
}
