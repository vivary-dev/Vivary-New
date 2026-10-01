import { createCoreRoutesPlugin } from "@agent-native/core/server";

import { vivaryNativeMcpOptions } from "../local-access.ts";
import { localAccessConfig } from "../local-access-config.ts";

// Replaces Native's defaultCoreRoutesPlugin with the same options, so the MCP
// connect and OAuth routes turn off with the MCP endpoint.
export default createCoreRoutesPlugin({
  googleOAuthManagedConnection: "not_applicable",
  mcp: vivaryNativeMcpOptions(localAccessConfig).coreRoutes,
});
