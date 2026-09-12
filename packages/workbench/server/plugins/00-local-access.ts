import {
  createAuthPlugin,
  defineNitroPlugin,
} from "@agent-native/core/server";

import { createVivaryLocalAuthOptions } from "../local-access.ts";

const localAuth = createVivaryLocalAuthOptions(process.env);

export default localAuth
  ? createAuthPlugin(localAuth)
  : defineNitroPlugin(() => undefined);
