import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { vivaryNativeMcpOptions } from "../local-access.ts";
import { localAccessConfig } from "../local-access-config.ts";
import { vivaryNativeChatProjectOptions } from "../native-chat-project";

export default createAgentChatPlugin({
  appId: "vivary",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  ...vivaryNativeChatProjectOptions,
  mcp: vivaryNativeMcpOptions(localAccessConfig),
});
