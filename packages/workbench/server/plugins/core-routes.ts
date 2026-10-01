import { createCoreRoutesPlugin } from "@agent-native/core/server";

import { VIVARY_NATIVE_MCP_OPTIONS } from "../local-access.ts";

// Replaces Native's defaultCoreRoutesPlugin with the same options, so the MCP
// connect and OAuth routes turn off with the MCP endpoint.
export default createCoreRoutesPlugin({
  googleOAuthManagedConnection: "not_applicable",
  mcp: VIVARY_NATIVE_MCP_OPTIONS.coreRoutes,
});
