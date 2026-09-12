import {
  awaitBootstrap,
  defineNitroPlugin,
  getH3App,
} from "@agent-native/core/server";
import { startProjectServices } from "../project-services.mjs";

export function createProjectServicesPlugin(overrides = {}) {
  return defineNitroPlugin(nitroApp => startProjectServices(nitroApp, {
    awaitBootstrap,
    getH3App,
    shutdownSignals: process,
    ...overrides,
  }).ready);
}

export default createProjectServicesPlugin();
