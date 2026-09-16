import { hardStopWorkerTree } from "./code-execution-host";
import { spawn } from "node:child_process";
import { z } from "zod";
import { resolveVivaryRuntimeCommand, type CommandLaunch } from "./local-runtime-setup";

const modelSchema = z.object({
  model: z.string().min(1).max(128), displayName: z.string().min(1).max(200),
  isDefault: z.boolean(), hidden: z.boolean().optional(),
});
const modelsSchema = z.object({ data: z.array(modelSchema).max(200), nextCursor: z.string().nullable().optional() });
const configSchema = z.object({ config: z.object({
  model: z.string().nullable().optional(), model_provider: z.string().nullable().optional(),
  model_providers: z.record(z.string(), z.unknown()).optional(),
  mcp_servers: z.record(z.string(), z.object({ enabled: z.boolean().optional() }).passthrough()).optional(),
}) });
const accountSchema = z.object({ account: z.object({ type: z.literal("chatgpt") }).passthrough() });
export type CodexModelCatalog =
  | { status: "ready"; models: { id: string; label: string }[]; defaultModel: string; connections: string[]; message: string }
  | { status: "unavailable"; message: string };
const unavailable = (): CodexModelCatalog => ({ status: "unavailable",
  message: "Codex could not report its subscription models. Check Codex in your terminal, then refresh Runtime settings." });
const cleanupUnavailable = (): CodexModelCatalog => ({ status: "unavailable",
  message: "Vivary could not confirm that Codex stopped after checking models. Restart Vivary before trying again.",
});
let cleanupBlocked = false;
const cache = new Map<string, { expiresAt: number; value: CodexModelCatalog }>();
const pending = new Map<string, Promise<CodexModelCatalog>>();

export function parseCodexCatalog(modelsValue: unknown, configValue: unknown, accountValue: unknown): CodexModelCatalog {
  const models = modelsSchema.safeParse(modelsValue);
  const config = configSchema.safeParse(configValue);
  if (!models.success || !config.success || !accountSchema.safeParse(accountValue).success) return unavailable();
  const settings = config.data.config;
  if ((settings.model_provider && settings.model_provider !== "openai") || settings.model_providers?.openai !== undefined) return {
    status: "unavailable", message: "Codex is configured for another provider. Select the ChatGPT provider in Codex to use your subscription here.",
  };
  // A partial catalog must not silently hide available choices.
  if (models.data.nextCursor) return unavailable();
  const visible = models.data.data.filter(model => !model.hidden);
  const preferred = visible.find(model => model.model === settings.model)
    ?? visible.find(model => model.isDefault) ?? visible[0];
  if (!preferred) return unavailable();
  const unique = [...new Map(visible.map(model => [model.model, model])).values()];
  unique.sort((a, b) => Number(b.model === preferred.model) - Number(a.model === preferred.model));
  return {
    status: "ready", models: unique.map(model => ({ id: model.model, label: model.displayName })),
    defaultModel: preferred.model,
    connections: Object.entries(settings.mcp_servers ?? {}).filter(([, server]) => server.enabled !== false).map(([name]) => name),
    message: settings.model && settings.model !== preferred.model
      ? "The configured Codex model is not in its reported catalog. Choose an available model."
      : "Models and configured connections come from Codex. Credentials stay with Codex.",
  };
}

export async function getCodexModels(cwd: string, { refresh = false }: { refresh?: boolean } = {}): Promise<CodexModelCatalog> {
  const active = pending.get(cwd);
  if (active) return active;
  const previous = cache.get(cwd);
  if (!refresh && previous && previous.expiresAt > Date.now()) return previous.value;
  const request = (async () => {
    const launch = await resolveVivaryRuntimeCommand("codex-cli");
    const value = launch ? await probeCodexModels(launch, cwd) : unavailable();
    if (cache.size >= 32) cache.delete(cache.keys().next().value ?? "");
    cache.set(cwd, { expiresAt: Date.now() + 30_000, value });
    return value;
  })().catch(unavailable).finally(() => pending.delete(cwd));
  pending.set(cwd, request);
  return request;
}

/** Read safe catalog fields over Codex's supported protocol without starting a thread or model turn. */
export function probeCodexModels(launch: CommandLaunch, cwd: string, timeoutMs = 12_000): Promise<CodexModelCatalog> {
  if (cleanupBlocked) return Promise.resolve(cleanupUnavailable());
  return new Promise(resolve => {
    const child = spawn(launch.executable, [...launch.prefix, "app-server", "--listen", "stdio://"], {
      cwd, env: launch.env, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "ignore"],
    });
    let buffer = "";
    let bytes = 0;
    let complete = false;
    const replies = new Map<number, unknown>();
    let didClose = false;
    const closed = new Promise<void>(done => child.once("close", () => { didClose = true; done(); }));
    const waitClosed = (ms: number) => new Promise<boolean>(done => {
      const timeout = setTimeout(() => done(false), ms);
      void closed.then(() => { clearTimeout(timeout); done(true); });
    });
    const finish = async (value: CodexModelCatalog) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      child.stdin.end();
      try {
        if (!await waitClosed(1_000)) {
          if (!didClose) {
            try { await hardStopWorkerTree(child, false); }
            catch (error) {
              // Codex may finish normally while Windows starts taskkill.
              if (!await waitClosed(3_000) || child.exitCode !== 0) throw error;
            }
          }
          if (!await waitClosed(3_000)) throw new Error("Codex discovery did not stop.");
        }
        if (process.platform !== "win32") await hardStopWorkerTree(child, true);
      } catch {
        cleanupBlocked = true;
        value = cleanupUnavailable();
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish({ status: "unavailable",
      message: "Codex took too long to report its models. Refresh Runtime settings and try again.",
    }), timeoutMs);
    const send = (message: unknown) => { if (!complete) child.stdin.write(JSON.stringify(message) + "\n"); };
    child.once("error", () => finish(unavailable()));
    child.once("close", () => { void finish(unavailable()); });
    child.stdin.on("error", () => finish(unavailable()));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > 512 * 1024) { finish(unavailable()); return; }
      buffer += chunk;
      let newline: number;
      while (!complete && (newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let message: unknown;
        try { message = JSON.parse(line); } catch { finish(unavailable()); return; }
        const parsed = z.object({ id: z.number().optional(), result: z.unknown().optional(), error: z.unknown().optional() }).safeParse(message);
        if (!parsed.success || parsed.data.id === undefined) continue;
        if (parsed.data.error) { finish(unavailable()); return; }
        if (parsed.data.id === 1) {
          send({ method: "initialized", params: {} });
          send({ id: 2, method: "model/list", params: { limit: 200, includeHidden: false } });
          send({ id: 3, method: "config/read", params: { includeLayers: false, cwd } });
          send({ id: 4, method: "account/read", params: { refreshToken: false } });
        } else if (parsed.data.id >= 2 && parsed.data.id <= 4) {
          replies.set(parsed.data.id, parsed.data.result);
          if (replies.size === 3) finish(parseCodexCatalog(replies.get(2), replies.get(3), replies.get(4)));
        }
      }
    });
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "vivary-model-discovery", version: "0.0.0" }, capabilities: {} } });
  });
}
