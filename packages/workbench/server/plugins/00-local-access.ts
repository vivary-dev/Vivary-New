import {
  createAuthPlugin,
  defineNitroPlugin,
} from "@agent-native/core/server";

import { installDesktopBrowserAccess } from "../browser-ingress.mjs";
import { createVivaryLocalAuthOptions, resolveVivaryLocalAccessConfig } from "../local-access.ts";
import { createVivaryOwnerSignIn } from "../owner-sign-in.ts";

const config = resolveVivaryLocalAccessConfig(process.env);
// Desktop launches prove the owner through desktop admission and write no sign-in file.
const localAuth = config && createVivaryLocalAuthOptions(
  config,
  config.desktop ? undefined : createOwnerSignIn(config.origin),
);

function createOwnerSignIn(origin: string) {
  const dataDir = process.env.VIVARY_DATA_DIR; // guard:allow-env-credential - Data folder path set by the launcher, not a credential.
  if (!dataDir) throw new Error("[vivary-local-access] VIVARY_DATA_DIR is required for owner sign-in.");
  return createVivaryOwnerSignIn({ origin, dataDir });
}

export default defineNitroPlugin(nitroApp => {
  // guard:allow-env-credential - Nonsecret desktop process marker set by the parent launcher.
  if (process.env.VIVARY_DESKTOP_HOST === "1") {
    installDesktopBrowserAccess(nitroApp, `http://127.0.0.1:${process.env.PORT}`);
  }
  if (localAuth) return createAuthPlugin(localAuth)(nitroApp);
});
