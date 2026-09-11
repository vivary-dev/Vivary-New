# 05b title generation inspection and approval checkpoint

Evidence-record: 05b
Verification-kind: runtime
Verification-result: passed

## Current result

Eight backend tests passed in the first bounded Habitat attempt. This proves
the title handler and native middleware composition with fake authentication,
credentials, and provider responses. It does not prove an active GUI composer,
production authentication/vault setup, or a real DeepSeek completion.

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

Jeff subsequently clarified: "no this is internal to the vivary gui". Narrow
this proposal to conversation titles inside that GUI. The earlier proposed
runtime preparation/start guard changes are withdrawn from this packet. Keep
native client protection for titles manually renamed by the user. The GUI
backend calls DeepSeek for this feature; the development harness and main chat
model do not change, and this session makes no live model call.

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

Both paths returned `False`; the diff was empty, exit 0. At that rejection
checkpoint, only documentation existed. No product code, runtime proof,
credential read, API request, or new service had been created.

## Approved implementation and commands

Jeff answered "dont ask justt do it" after the precise GUI backend call was
described. This is explicit implementation authority. The narrowed code patch
was then accepted. A live paid smoke test remains separately gated.

The handler and Nitro plugin now exist, along with eight focused tests using
installed H3/native request context and a fake provider. Runtime preparation/start
remain unchanged. The packet's isolated Habitat test command was:

```console
python -B docs/product/multi-project/fixtures/05b/run_habitat.py
```

The runner executes:

```console
node --max-old-space-size=192 --import packages/workbench/tests/register-native-dependencies.mjs --test --test-concurrency=1 packages/workbench/tests/chat-title.test.mjs
```

## Implementation and initial review

`server/chat-title.mjs` owns the authenticated title request. It removes nested
and unterminated context blocks, bounds visible provider input, preserves native
credential scope, and returns explicit responses for authentication/store/provider
failures. The synchronous plugin mount takes precedence over the native default.
The route does not write thread records or change the main chat provider.

Independent source review found no blocking issue. The ten-per-minute limit is
per process, matching the native default's deployment scope. Added explicit auth
failure handling and nested-context coverage before runtime. Existing manual-rename
protection remains a native-client source finding; these tests do not activate
the GUI composer or prove production credential configuration.

Preflight: 3,186,954,240 bytes available RAM; 8,348,303,360 bytes commit headroom;
151,870,746,624 bytes free disk. Included weekly usage was two percent. The other
Codex usage window was unavailable. Only Ubuntu was running; Habitat was stopped.
The runner performed fresh admission and enforced the declared reserve.

## Runtime and cleanup evidence

`.tmp/05b/attempt-1.json` records exit 0, no observer failure, 74 resource samples,
and accepted cleanup. Available RAM never fell below 2,278,273,024 bytes, above
the 1,536 MiB reserve. The parent took 20.322 seconds; the service took 14.733
seconds. One of four 60-second allocations was used. The append-only dispatch
journal preserves the allocation; completion evidence is separate.

The inner `command.log` records eight tests, eight passed, zero failed, skipped,
or cancelled. The timeout test took 5.004 seconds. Native middleware dispatched
the title route before a test default-provider sentinel; every covered success
and refusal path avoided that sentinel. Actual AsyncLocalStorage kept overlapping
user/organization requests separate. The production plugin was imported and
mounted against installed H3; its method refusal was exercised without credentials.
Default framework services were disabled in this fixture. Full production
bootstrap, deployed authentication, and GUI title persistence remain untested.

The source envelope binds 24 files and the private toolchain configuration.
The service observed 512 MiB memory, zero swap, 64 tasks, one CPU, read-only
source/dependencies, and the configured network isolation. No dependency install,
real credential read, live provider request, or listening app server occurred.

The owned service was unloaded, MainPID was zero, and its cgroup was absent.
The clean inner evidence was archived to `.tmp/05b/disposable-evidence.tar`:
20,480 bytes, seven members, SHA-256
`a004e772f635894cdca0bb329411a218b57a68b3bd6179d017c7239c7a5912e3`.
The Windows archive hash matches the source stream. After verifying that archive
and the absent proof mount/cgroup, the exact 2,611-byte Linux scratch tree was
removed. A fresh WSL inventory showed only Ubuntu running. No shared distribution
shutdown or unrelated cleanup was performed. Keep the Windows archive, manifest,
configuration, resource samples, and logs as local verification evidence.

Deletion was a separate command after archival, not an effect of the archive
helper. With `scratch` bound to the exact private configuration path, the root
verified its resolved path, rejected links, and checked the absent mount/cgroup;
then `rm -r -- "$scratch"; test ! -e "$scratch"` returned exit 0 and printed
`05b disposable scratch removed after verified archive`. The retained archive
contains the evidence copied before that deletion.

## Documentation checks

The first `python scripts/check_multi_project_plan.py --render` failed because
the new packet omitted required headings and classified its inspection as runtime.
Corrected the packet format and verification kind. Render and `--check` then
passed, exit 0, with all 36 outcomes checked. `git diff --check` passed, exit 0.
`python scripts/check_line_endings.py` still failed on the pre-existing 4115
CRLF lines in `fixtures/project-registry.json`; this packet did not edit it.
The earlier documentation checkpoint staged only its packet, receipt, and graph
row. Runtime acceptance now covers only the backend scope described above.
During implementation, the plan checker also caught private Habitat paths in
the first proof-runner draft. Those were moved into private configuration and
bound by SHA-256 before runtime. The corrected renderer passed.
