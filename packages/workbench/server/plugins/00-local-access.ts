import {
  createAuthPlugin,
  defineNitroPlugin,
} from "@agent-native/core/server";

import { installDesktopBrowserAccess } from "../browser-ingress.mjs";
import { createVivaryLocalAuthOptions } from "../local-access.ts";

const localAuth = createVivaryLocalAuthOptions(process.env);

export default defineNitroPlugin(nitroApp => {
  // guard:allow-env-credential - Nonsecret desktop process marker set by the parent launcher.
  if (process.env.VIVARY_DESKTOP_HOST === "1") {
    installDesktopBrowserAccess(nitroApp, `http://127.0.0.1:${process.env.PORT}`);
  }
  if (localAuth) return createAuthPlugin(localAuth)(nitroApp);
});
