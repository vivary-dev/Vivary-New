# 05b title generation inspection and approval checkpoint

Evidence-record: 05b
Verification-kind: inspection
Verification-result: pending

## Requested behavior and concrete proposal

Jeff requested DeepSeek API chat-title generation on 2026-09-10. The proposed
endpoint uses the existing native `/generate-title` request contract. It sends
at most the first 500 characters of visible message text to
`https://api.deepseek.com/chat/completions`; it strips hidden `<context>` blocks
and mention metadata first. It sends no transcript, project files, or runtime
instructions. Provider authentication uses the request-scoped native
`resolveSecret("DEEPSEEK_API_KEY")` resolver, with no new credential store.

The proposal uses `deepseek-flash`, thinking disabled, a 64-token output limit,
a five-second timeout, no redirects/retries, and a ten-per-minute caller limit.
Missing credentials, failed requests, and invalid output return a local title
from the sanitized message. The model/endpoint were checked against
[DeepSeek's current API guide](https://api-docs.deepseek.com/) and
[chat completion reference](https://api-docs.deepseek.com/api/create-chat-completion/).
These are proposed settings, not a measured cost or quality claim.

Remove only the two literal `thread.title === "Project session"` comparisons
from runtime preparation/start. Keep the initial fallback title and every ID,
owner, organization, private visibility, scope, session, run, and receipt check.
Retain native client protection for titles manually renamed by the user.

## Source evidence

- Installed Core 0.176.5 `dist/server/agent-chat-plugin.js:4064` mounts the
  title endpoint and calls Anthropic Haiku directly. Main chat-engine selection
  does not control this handler. No configurable title-provider hook was found.
- `dist/client/use-chat-threads.js:1000` posts `{ message }` to that endpoint
  and suppresses generated results when the thread was manually renamed.
- Public `getH3App`, `awaitBootstrap`, `getSession`, `runWithRequestContext`,
  `resolveSecret`, and organization APIs supply the app composition seam.
  `framework-request-handler` starts default bootstrap asynchronously. Mounting
  this middleware before awaiting bootstrap precedes the default title route.
  Independent source review confirmed that ordering. Every handled path must
  return a response to avoid falling through to Anthropic.
- `packages/workbench/server/project-runtime-preparation.mjs:177` and
  `project-runtime-start.mjs:239` currently include the literal title check.
- `packages/workbench/README.md` and `app/components/workbench/Conversation.tsx`
  confirm the current UI is read-only, with no composer. Adding a title endpoint
  alone would not activate automatic titles in that UI.

## Rejected attempt and unchanged state

The automatic approval review rejected the combined implementation patch because
it would send potentially sensitive chat text to DeepSeek, read a provider
secret, and remove the title comparisons. It required specific user approval
beyond the general feature request. Do not bypass that rejection.

Readback after rejection:

```console
Test-Path packages/workbench/server/chat-title.mjs
Test-Path packages/workbench/server/plugins/00-chat-title.mjs
git diff -- packages/workbench/server/project-runtime-preparation.mjs packages/workbench/server/project-runtime-start.mjs
```

Both paths returned `False`; the diff was empty, exit 0. Only this documentation
packet exists. No product code, runtime proof, credential read, API request, or
new service was created. Source review does not prove endpoint behavior.

## Next action

Obtain explicit approval for the described external payload and guard change.
Then implement, verify native dispatch with a fake upstream, and check renamed
thread replay/start alongside unchanged ownership rejection. A live paid smoke
test remains separately gated. No 05b runtime attempt has been consumed.

## Documentation checks

The first `python scripts/check_multi_project_plan.py --render` failed because
the new packet omitted required headings and classified its inspection as runtime.
Corrected the packet format and verification kind. Render and `--check` then
passed, exit 0, with all 36 outcomes checked. `git diff --check` passed, exit 0.
`python scripts/check_line_endings.py` still failed on the pre-existing 4115
CRLF lines in `fixtures/project-registry.json`; this packet did not edit it.
The staged index was empty before staging only this packet, receipt, and the
single generated graph row. No product or runtime acceptance is claimed.
