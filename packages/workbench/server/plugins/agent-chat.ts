import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { prepareVivaryNativeChatProject } from "../native-chat-project";

export default createAgentChatPlugin({
  appId: "vivary",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  prepareRequest: prepareVivaryNativeChatProject,
});
