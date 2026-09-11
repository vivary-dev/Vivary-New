# 05b title generation evidence and recovery checkpoint

Evidence-record: 05b
Verification-kind: runtime
Verification-result: pending

## Current result

The backend passed eight tests in the first bounded Habitat attempt. The first
fixed-key `/chat` candidate failed source QA because it could display a prior
account's cached active thread before server authorization completed. The corrected
source gates the native chat on matching account and organization identity,
binds its mount and storage keys to both identities, and disables automatic active
thread restoration. QA also caught a nullable organization ID; the corrected
route now reaches its unavailable state. Independent source QA and Verify report ready.
No build or browser check has run against these changed bytes. The packet's
global result remains pending. Existing tests prove
only the handler and native middleware composition with fake authentication,
credentials, and provider responses.

## Issue correction ledger

| Stage | Owner | State | Responsibility |
|---|---|---|---|
| Plan | `/root/plan_issue` | accepted | Froze the source-only recovery scope and observable GUI acceptance. |
| Implement | `/root/implement_issue` | completed | Corrected packet, receipt, package, outcome, and execution-contract truth. |
| QA | `/root/qa_issue` | ready | Independently reviewed the source correction; no blocking findings. GUI acceptance remains pending. |
| Verify | `/root/verify_issue` | passed for source correction only | Checked raw diffs, 24 source bindings, archived backend evidence, generated views, and pending GUI acceptance. |

This ledger records the repair of issue truth. It does not accept the GUI feature.

On 2026-09-10, `/root/verify_issue` independently accepted the issue-truth
correction after QA reported ready.
`C:/Python314/python.exe scripts/check_multi_project_plan.py --check`
and `git diff --check` exited 0. All 24 bound source hashes match, and the retained
archive records eight backend passes and zero model calls. Separately,
`C:/Python314/python.exe scripts/check_line_endings.py` exited 1 for the existing
4,115 CRLF lines in `fixtures/project-registry.json`. No runtime was rerun.

## GUI implementation ledger

| Stage | Owner | State | Responsibility |
|---|---|---|---|
| Plan | `/root/plan_gui` | accepted | Froze the Native app scope, route ownership, user-visible acceptance, and runtime separation. |
| Implement | `/root/implement_gui` | completed | Replaced the failed fixed-key candidate with the identity-bound `/chat` source and reconciled its owned documentation. |
| QA | `/root/qa_gui` | ready for source verification | Rejected cached restoration and nullable organization handling, then accepted both corrections against installed public APIs. |
| Verify | `/root/review_doctor_fix` | passed for source only | Checked candidate and documentation bindings, public composition, identity gating, and unchanged project guards. Runtime acceptance remains pending. |

Source QA accepted `app/routes/chat.tsx` SHA-256
`0536dc59295273c1a155731c8039372b55b20ecb08a11478b107c3ff8250c44b`.
It checked public exports, identity gating, fresh-thread restoration, and the
root query-client defaults. This is source composition evidence only. Build,
browser QA, and runtime Verify remain open.

The separate verifier accepted that source hash and confirmed the Workbench
conversation, activity, preparation, and start files match their preimages.
The plan renderer and checker passed for all 36 outcomes; `git diff --check`
passed. This checkpoint adds no runtime evidence or budget authority.

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
- `app/components/workbench/Conversation.tsx` remains the read-only Workbench
  panel with no composer. The `/chat` source now uses the public
  `AgentChatSurface` with fixed workspace-app scope, scoped history isolation,
  identity-bound mount and storage keys, and automatic active-thread restoration
  disabled. This composition has no build or browser evidence.

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

## Backend implementation and initial review

`server/chat-title.mjs` owns the authenticated title request. It removes nested
and unterminated context blocks, bounds visible provider input, preserves native
credential scope, and returns explicit responses for authentication/store/provider
failures. The synchronous plugin mount takes precedence over the native default.
The route does not write thread records or change the main chat provider.

Independent source review found no blocking issue. The ten-per-minute limit is
per process, matching the native default's deployment scope. Added explicit auth
failure handling and nested-context coverage before runtime. Existing manual-rename
protection remains a native-client source finding. These tests do not activate
the GUI composer, exercise Native history persistence, or prove production
credential configuration.

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
bootstrap, deployed authentication, and every user-visible GUI acceptance case
remain untested.

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

## Open GUI acceptance

The retained backend evidence does not close 05b. The first fixed-key candidate
failed source QA because Native can import a cached active thread before server
authorization completes. The corrected `/chat` source uses Core 0.176.5's public
`AgentChatSurface` in page mode with scope ID `vivary-workbench-chat-v1`, scope
type `workspace-app`, app chat, scoped history isolation, native header and tabs,
chat-only behavior, disabled code access, and no URL thread synchronization.

The route requires an authenticated session and a successful live organization
result whose normalized email matches the session. Native ownership uses the
required session email, so the route uses that account identity rather than the
optional user ID. Empty or mismatched identity fails closed. Collision-safe
encoding of the normalized email and organization ID namespaces both the React
mount key and Native storage key. Organization loading, refetch, error, or identity
mismatch leaves the chat unmounted. Automatic active-thread restoration is
disabled. Each fresh mount starts an empty thread, while server-fetched History
retains saved conversations and titles. The Workbench `Conversation` remains
read-only and project-bound. No old proof covers the changed route or root bytes.

The public `createAgentNativeQueryClient()` used by the root sets a 30-second stale
time and `refetchOnWindowFocus: false`. Standard window focus should not unmount
a draft. An actual organization invalidation intentionally unmounts the chat while
Native resolves the next identity. This behavior remains browser acceptance, not
a source-proven result.

The GUI must show that the first visible message generates a history title,
persistence survives reload and thread switching, a manual rename wins a delayed
generation, and a local fallback persists. Foreign and prepared coding threads
must stay out of this app scope's history, and stale saved thread IDs must refuse.
Cross-account and cross-organization access must fail. Cached history from another
account or organization must not render before the authorized response resolves.
Standard window focus must preserve an unsent draft. Organization switching must
unmount old messages until the new identity resolves. Reload must start a fresh
empty conversation, and selecting a saved conversation through History must load
its persisted messages and title. The Workbench panel must remain read-only and
issue no chat mutations. Existing backend cases must still prove that hidden
context never reaches DeepSeek and unauthenticated requests do not fall through
to Anthropic.

The endpoint budget remains four 60-second allocations and 240 seconds total. One
allocation is consumed and three remain. Do not rerun the accepted backend tests
for this source composition. The 512 MiB limit cannot expand, and the existing
profile disables Native services. It cannot prove GUI behavior. Current Habitat
inspection found no installed browser executable. Windows Playwright Chromium
1234 is installed for a future bounded proof, but it has not run. A later GUI run
needs a new exact build and browser admission for the reviewed Native composition.
The frozen 06e one-request, 1,200-second grant cannot absorb these changed files.

Project activity read, preparation, and start retain their literal guards. This
GUI rework changes only the assigned `/chat` source. It changes no project control,
Workbench Conversation, root, backend guard, runtime process, dependency,
credential, budget, or environment. Packet 20j remains
budget-exhausted, and 20k remains blocked.

## GUI proof source preparation

The GUI source checkpoint is local commit `b26a5e7`. The executable proof is a
separate preparation unit and remains unexecuted. The first backend/browser
draft failed source QA. Corrections address public engine selection, readiness,
database containment, bounded transport, startup/close cleanup, ambiguous UI
locators, continuous cache-leak observation, and rename-race ordering.
The owning packet records the proposed build/browser bounds. The controller
must pass source QA and separate verification before runtime dispatch.

Independent QA and Verify accepted the backend/browser source unit after its
rework. Backend SHA-256 is
`10ad20d9057b32b8e853315a0fbc3802bc1db7eee30f93b166e10044de246e61`;
browser SHA-256 is
`43e2461b03e43e4470aa1dfd73d944efaa53a1c89188e82a95c3c5524477b03a`.
These checks did not execute either file.

Automatic approval review rejected the first Linux-controller patch before it
landed. The review cited root-level subprocess/service operations, evidence
streaming, and recursive scratch deletion without specific implementation and
cleanup authority. A revised Linux helper now runs product commands only as the
non-root service user after checking the service boundary. It can export evidence
and describe retained scratch cleanup; it has no filesystem deletion operation.

Automatic approval review then rejected the proposed host launcher before it
landed. The review cited root-owned WSL commands and child-process management
without trusted authorization for that exact scope. The proposed host integration
is being preserved as an inert patch for source QA and separate verification.
The installed controller remains an inspection entry point; the executable host
dispatcher is not installed. No build, browser proof, or deletion followed either
rejection. Applying and running that exact dispatcher remains the concrete gate.

Controller QA corrected connection admission before HTTP worker creation, bounded
RPC writes, and Native's file-shaped `nitro-preset` marker. Separate verification
also checked heartbeat mounting and owned-child termination. Cleanup covers
partial setup and independently attempts each stop and absence check. The
browser fixture additionally blocks service workers and WebSockets; its revised
SHA-256 is `4191693c766b2d6c0e07896f4450f2bc8ae8af0f53aa149e72415b2b1c3b4820`.
The earlier backend/browser hashes above record their earlier source review.

The rejected draft is retained separately from the final proposed patch. Static
in-memory composition caught incompatible historical patch context; the corrected
single proposal composes against the current source and parses as Python. This
check does not apply the patch, import the proposed controller, or execute it.
Final source QA and independent Verify accepted the setup-failure correction.
The frozen proposal SHA-256 is
`759fefec88eef173ef3f21a06cad504d3a216b652ca93efabaa81f48e191857d`.
Static composition produced one patch block, two exact hunks, and 1,794 parsed
lines, with composed-source SHA-256
`56b43162e6b2d8900a5dd56a40b776e49eafd735df72e23bd5200d9c894ed789`.
The installed inspection controller is
`6f89ac719b1ee185ed02260031aeba3b7bc8963cd74b7231f1a932e1c924429b`;
the Linux helper is
`a7a6ef3d5bdd77eab0e4efecfc957a72149250c15a43faccf8ce0aa77d40d6e6`.
These are source-review results, not runtime admission or GUI acceptance.
The executable proposal remains unapplied. Source/toolchain bindings, runtime
authority, fresh resource admission, and the GUI attempt ledger are absent.

The dependency write paths were inspected in the installed Vite/Nitro source.
Vite's bundled config loader uses `.vite-temp`; Nitro uses `.nitro` for four
generated type files and `last-build.json`. Service-private mounts can redirect
those writes without making installed package code writable. A whole dependency
overlay was rejected and removed before execution.

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
