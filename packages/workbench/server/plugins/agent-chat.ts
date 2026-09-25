import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { vivaryNativeChatProjectOptions } from "../native-chat-project";

export default createAgentChatPlugin({
  appId: "vivary",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  ...vivaryNativeChatProjectOptions,
});
