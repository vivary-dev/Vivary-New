import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { resolveVivaryLocalAccessConfig } from "../local-access.ts";
import { vivaryNativeChatProjectOptions } from "../native-chat-project";

export default createAgentChatPlugin({
  appId: "vivary",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  ...vivaryNativeChatProjectOptions,
  // Native's MCP endpoint skips the session guard and, with no ACCESS_TOKEN or
  // A2A_SECRET, trusts a loopback caller that names an owner email. Vivary's
  // local owner launches set neither, so those modes serve no MCP endpoint.
  mcp: { enabled: resolveVivaryLocalAccessConfig(process.env) === null },
});
