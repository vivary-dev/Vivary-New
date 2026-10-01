import { resolveVivaryLocalAccessConfig } from "./local-access.ts";

// Resolved once so the local access and chat plugins agree on the access mode.
export const localAccessConfig = resolveVivaryLocalAccessConfig(process.env);
