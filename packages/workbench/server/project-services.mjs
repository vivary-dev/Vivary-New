import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, normalize } from "node:path";
import { defineEventHandler } from "h3";
import { z } from "zod";
import {
  deriveMutationKeys,
  evaluateRegistryOperation,
  parseStrictJson,
} from "../../../scripts/registry_contract_model.mjs";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const absolutePath = z.string().refine(value => isAbsolute(value) && normalize(value) === value);
const label = z.string().refine(value => value.isWellFormed()
  && Array.from(value).length >= 1 && Array.from(value).length <= 200);
const installationSchema = z.strictObject({
  python: absolutePath,
  entryFile: absolutePath,
  provider: z.strictObject({
    deviceId: identifier,
    scope: absolutePath,
    statePath: absolutePath,
    locations: z.record(identifier, absolutePath)
      .refine(value => Object.keys(value).length >= 1 && Object.keys(value).length <= 16),
  }),
  grant: z.strictObject({
    orgId: identifier,
    collectionId: identifier,
    policyRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    locationRefs: z.array(identifier).min(1).max(16)
      .refine(refs => new Set(refs).size === refs.length),
  }),
  locationLabels: z.record(identifier, label),
}).superRefine((value, context) => {
  const locations = new Set(Object.keys(value.provider.locations));
  const labels = new Set(Object.keys(value.locationLabels));
  for (const ref of value.grant.locationRefs) {
    if (!locations.has(ref)) {
      context.addIssue({ code: "custom", message: "grant location is not configured" });
    }
    if (!labels.has(ref)) {
      context.addIssue({ code: "custom", message: "grant location has no label" });
    }
  }
  if (labels.size !== value.grant.locationRefs.length
    || [...labels].some(ref => !value.grant.locationRefs.includes(ref))) {
    context.addIssue({ code: "custom", message: "location labels must exactly cover the grant" });
  }
});

export const PROJECT_ACTION_PATHS = Object.freeze([
  "/_agent-native/actions/vivary-register-project",
  "/_agent-native/actions/vivary-project-catalog",
  "/_agent-native/actions/vivary-project-runtime-readiness",
  "/_agent-native/actions/vivary-project-runtime-activity",
]);

const controllers = new WeakMap();
const deepFreeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};
const projectAction = pathname => PROJECT_ACTION_PATHS.some(path =>
  pathname === path || pathname.endsWith(path));

class InstallationError extends Error {
  constructor(code) {
    super(code);
    this.name = "InstallationError";
    this.code = code;
  }
}

export function parseProjectInstallation(value) {
  try {
    return deepFreeze(installationSchema.parse(value));
  } catch {
    throw new InstallationError("invalid-configuration");
  }
}

export async function loadProjectInstallation(filePath, dependencies = {}) {
  if (filePath === undefined || filePath === null || filePath === "") return null;
  if (!isAbsolute(filePath) || normalize(filePath) !== filePath) {
    throw new InstallationError("invalid-configuration-file");
  }
  const read = dependencies.readFile ?? readFile;
  const resolve = dependencies.realpath ?? realpath;
  const inspect = dependencies.stat ?? stat;
  let raw;
  try {
    raw = await read(filePath, "utf8");
  } catch {
    throw new InstallationError("configuration-unavailable");
  }
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 65_536) {
    throw new InstallationError("invalid-configuration");
  }
  let parsed;
  try {
    parsed = parseStrictJson(raw);
  } catch {
    throw new InstallationError("invalid-configuration");
  }
  const configuration = parseProjectInstallation(parsed);
  try {
    for (const executable of [configuration.python, configuration.entryFile]) {
      if (await resolve(executable) !== executable || !(await inspect(executable)).isFile()) {
        throw new InstallationError("invalid-configuration");
      }
    }
  } catch (error) {
    if (error instanceof InstallationError) throw error;
    throw new InstallationError("configuration-unavailable");
  }
  return configuration;
}

export async function loadProductionRuntime() {
  const [
    database,
    migrations,
    registry,
    registryHttp,
    provider,
    catalog,
    readiness,
    activity,
  ] = await Promise.all([
    import("@agent-native/core/db"),
    import("./db/migrations.mjs"),
    import("./native-registry.mjs"),
    import("./registry-http.mjs"),
    import("./root-provider.mjs"),
    import("./project-catalog.mjs"),
    import("./project-runtime-readiness.mjs"),
    import("./project-runtime-activity.mjs"),
  ]);
  return Object.freeze({
    migrateRegistry: () => database.withMigrationRuntime(() => migrations.migrateRegistry()),
    createNativeRegistry: registry.createNativeRegistry,
    createNativeRegistryAuth: registry.createNativeRegistryAuth,
    startRootProvider: provider.startRootProvider,
    createProjectCatalog: catalog.createProjectCatalog,
    mountProjectCatalog: catalog.mountProjectCatalog,
    mountRegistryHttp: registryHttp.mountRegistryHttp,
    createProjectRuntimeReadiness: readiness.createProjectRuntimeReadiness,
    mountProjectRuntimeReadiness: readiness.mountProjectRuntimeReadiness,
    createProjectRuntimeActivity: activity.createProjectRuntimeActivity,
    mountProjectRuntimeActivity: activity.mountProjectRuntimeActivity,
  });
}

function diagnosticCode(error) {
  return error instanceof InstallationError ? error.code : "initialization-failed";
}

function defaultDiagnostic(code) {
  console.error(`[vivary-project-services] ${code}`);
}

export function startProjectServices(nitroApp, dependencies) {
  if (!nitroApp || typeof dependencies?.getH3App !== "function"
    || typeof dependencies?.awaitBootstrap !== "function") {
    throw new TypeError("project service startup requires Native application primitives");
  }
  const existing = controllers.get(nitroApp);
  if (existing) return existing;

  const hooks = nitroApp.hooks;
  const signals = dependencies.shutdownSignals;
  let status = "initializing";
  let failure = null;
  let provider = null;
  let providerClose = null;
  let closing = false;
  let ready;
  let closePromise;
  const activeRequests = new Set();
  const drainWaiters = new Set();

  const snapshot = () => Object.freeze({ status, failure });
  const finishRequest = event => {
    if (!activeRequests.delete(event) || activeRequests.size !== 0) return;
    for (const resolve of drainWaiters) resolve();
    drainWaiters.clear();
  };
  const waitForRequests = async () => {
    if (activeRequests.size === 0) return;
    const drainMs = Number.isInteger(dependencies.requestDrainMs)
      && dependencies.requestDrainMs >= 10 && dependencies.requestDrainMs <= 10_000
      ? dependencies.requestDrainMs
      : 5_000;
    let timer;
    await Promise.race([
      new Promise(resolve => drainWaiters.add(resolve)),
      new Promise(resolve => { timer = setTimeout(resolve, drainMs); }),
    ]);
    clearTimeout(timer);
    activeRequests.clear();
    for (const resolve of drainWaiters) resolve();
    drainWaiters.clear();
  };
  const closeProvider = async () => {
    if (!provider) return;
    providerClose ??= Promise.resolve().then(() => provider.close());
    await providerClose;
  };
  const close = () => {
    if (closePromise) return closePromise;
    closing = true;
    if (status === "open" || status === "initializing") status = "closing";
    closePromise = (async () => {
      try {
        await ready;
        await waitForRequests();
        await closeProvider();
        status = "closed";
        failure = null;
        return snapshot();
      } finally {
        signals?.off("SIGTERM", shutdown);
        signals?.off("SIGINT", shutdown);
      }
    })();
    return closePromise;
  };

  const shutdown = () => {
    void close().catch(() => {
      failure = "shutdown-failed";
      (dependencies.diagnostic ?? defaultDiagnostic)(failure);
    });
  };
  // The Node server closes HTTP on signals without invoking Nitro's close hook.
  signals?.once("SIGTERM", shutdown);
  signals?.once("SIGINT", shutdown);

  hooks?.hook?.("request", event => {
    if (status === "open" && projectAction(event.url?.pathname ?? "")) activeRequests.add(event);
  });
  hooks?.hook?.("response", (_response, event) => finishRequest(event));
  hooks?.hook?.("close", close);

  const unavailable = defineEventHandler(event => {
    if (status === "open") return;
    return Response.json({ error: "Project services unavailable" }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  });
  const app = dependencies.getH3App(nitroApp);
  for (const path of PROJECT_ACTION_PATHS) app.use(path, unavailable);

  const controller = Object.freeze({
    get ready() { return ready; },
    close,
    snapshot,
  });
  controllers.set(nitroApp, controller);

  ready = (async () => {
    try {
      const installation = await (dependencies.loadInstallation ?? loadProjectInstallation)(
        dependencies.installationFile ?? process.env.VIVARY_PROJECT_INSTALLATION_FILE, // guard:allow-env-credential - Trusted server configuration path; no credential value.
      );
      if (installation === null) {
        status = closing ? "closed" : "unconfigured";
        return snapshot();
      }
      if (closing) return snapshot();

      const runtime = await (dependencies.loadRuntime ?? loadProductionRuntime)();
      await dependencies.awaitBootstrap(nitroApp);
      if (closing) return snapshot();
      await runtime.migrateRegistry();
      if (closing) return snapshot();

      provider = await runtime.startRootProvider({
        python: installation.python,
        entryFile: installation.entryFile,
        config: installation.provider,
        parseStrictJson,
      });
      if (closing) return snapshot();

      const registry = runtime.createNativeRegistry({
        provider,
        grant: installation.grant,
        evaluate: evaluateRegistryOperation,
        deriveMutationKeys,
      });
      const auth = runtime.createNativeRegistryAuth();
      const catalog = runtime.createProjectCatalog({
        readScope: registry.readScope,
        provider,
        locationLabels: installation.locationLabels,
      });
      const readiness = runtime.createProjectRuntimeReadiness({
        readScope: registry.readScope,
        provider,
      });
      const activity = runtime.createProjectRuntimeActivity({
        readScope: registry.readScope,
        provider,
      });
      runtime.mountRegistryHttp(nitroApp, {
        registration: registry.registration,
        parseStrictJson,
        ...auth,
      });
      runtime.mountProjectCatalog(nitroApp, { catalog, auth });
      runtime.mountProjectRuntimeReadiness(nitroApp, { readiness, auth });
      runtime.mountProjectRuntimeActivity(nitroApp, { activity, auth });
      status = "open";
      return snapshot();
    } catch (error) {
      const code = diagnosticCode(error);
      failure = code;
      status = closing ? "closing" : "failed";
      (dependencies.diagnostic ?? defaultDiagnostic)(code);
      try {
        await closeProvider();
      } catch {
        failure = "shutdown-failed";
      }
      return snapshot();
    }
  })();

  return controller;
}
