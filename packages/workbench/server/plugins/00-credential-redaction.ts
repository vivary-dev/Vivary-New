import { setTextRedactor } from "@agent-native/core/audit";
import { defineNitroPlugin } from "@agent-native/core/server";

import { redactCredentials, redactStreamWrites, refreshHeldCredentials } from "../credential-redaction.ts";

// Issue #97. Core redacts tool results, run events, error text, saved threads, automation
// errors, and Code transcript events with the redactor registered here. Server output is
// redacted too, which covers console output in command-line mode. Environment and MCP values
// are held at once, and stored secrets when the database answers.
export default defineNitroPlugin(() => {
  setTextRedactor(redactCredentials);
  redactStreamWrites(process.stdout);
  redactStreamWrites(process.stderr);
  void refreshHeldCredentials().catch(() => undefined);
});
