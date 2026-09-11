import {
  awaitBootstrap, defineNitroPlugin, getSession, resolveSecret, runWithRequestContext,
} from "@agent-native/core/server";
import { getOrgContext } from "@agent-native/core/org";
import { mountChatTitles } from "../chat-title.mjs";

export default defineNitroPlugin(async nitroApp => {
  mountChatTitles(nitroApp, { getSession, getOrgContext, runWithRequestContext, resolveSecret });
  await awaitBootstrap(nitroApp);
});
