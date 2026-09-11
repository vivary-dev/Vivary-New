# 05b title generation evidence and recovery checkpoint

Evidence-record: 05b
Verification-kind: runtime
Verification-result: failed

## Current result

The complete app/native source and validation closure is committed in `9b11c45`.
The current program records and registry semantic dependencies are committed in
`c8fd467`. Their exact Git-index export passed plan and source-navigation checks
without local untracked files. Independent QA verified both source allowlists
and privacy scans. Historical source provenance remains labeled as a snapshot.
The owner approved a private GitHub repository after the review identified
unresolved public redistribution rights. `vivary-dev/vivary-workbench-handoff`
was created with verified private visibility; the public upstream was not changed.
Commit `29f7686ff40acfd00624875bd25ae3c795c67c7c` was pushed and verified through
GitHub, then cloned on Zo with its existing authenticated GitHub connection.
The Zo checkout was clean and matched the exact commit. Its plan and source-map
checks passed: 36 outcomes, 16 source records, 23 edges, 11 locators and no broken
source references. The portable Zo handoff contains the verified state, hashes
and next steps. Raw private log/configuration archives remain on the laptop;
automatic approval review rejected their exact export. No archive was copied
through another channel. Independent review caught missing scratch-ignore
coverage on Zo; the repository now ignores root .tmp storage. Source delivery
and the portable handoff are complete. Build/browser acceptance remains pending.

Local GUI execution is closed. The final resume passed one real dependency
inspection under its 512 MiB memory cap, zero swap, one CPU, private network,
four exact read-only mounts and five empty capability sets. It then failed
build admission at about 3.6 GiB available host RAM, below the 4 GiB gate.
No build or browser phase ran. The owner selected Zo compute through the existing
T3 connection and requested GitHub source delivery before handoff.

The final result SHA-256 is
`180119491b32cd2d06cab534e401b83121bfd5e9ed54b2243884f885485b1f10`.
The 81,920-byte export contains 16 verified regular members and has SHA-256
`950278eb873dd4db11d43be792464a98969f5989480e76ab23138f05d952518f`.
The seven-event closed ledger has SHA-256
`8254d432c415babf7fc121bb184c7d188dbf4ce2fa6e40e6587b53b9b76e2dd8`.
Independent Verify matched all older evidence, 49 other frozen source files and
six preserved inputs. The 268 observer samples contain no active phase.
The inspection reached 512 MiB peak, with 6,232 memory-limit pressure events and
zero OOM events. Two wrapper launches are consumed and one inspection passed.
Process cleanup passed; 63 Linux files totaling 1,015,271 bytes remain preserved.

The final resume consumed 71.26599550247192 seconds. Cumulative active time is
214.56320595741272 seconds, leaving 985.4367940425873 seconds in the original
allocation, including 85.4367940425873 overhead. The proposed further laptop
completion was not implemented. All local allocations are unavailable for replay.

The initial Zo read-only preflight reports a 128 GiB memory limit, 16-CPU quota,
roughly 512 GiB free filesystem space, Node 24.15.0 and pnpm 10.33.2. Zo exposes
a gVisor environment and cgroup v1, so the Windows/WSL and cgroup v2 proof owner
cannot run there unchanged. These readings establish access and capacity, not
GUI acceptance. No app was built, installed, published or run on Zo at this point.

The backend passed eight tests in the first bounded Habitat attempt. The first
fixed-key `/chat` candidate failed source QA because it could display a prior
account's cached active thread before server authorization completed. The corrected
source gates the native chat on matching account and organization identity,
binds its mount and storage keys to both identities, and disables automatic active
thread restoration. QA also caught a nullable organization ID; the corrected
route now reaches its unavailable state. Independent source QA and Verify report ready.
No build or browser check has run against these changed bytes. The packet's
GUI verification and its authorized continuation both stopped at the resource gate
before either phase. Its recovery later stopped at directory traversal before
the hash helper or a phase could start. Existing tests prove
only the handler and native middleware composition with fake authentication,
credentials, and provider responses.

The first GUI bootstrap transfer succeeded on 2026-09-11. Toolchain binding then
failed at an undersized inventory cap. The source correction passed independent
review. Jeff then approved the exact corrected bootstrap destination after
automatic approval review rejected its two-line source change. The original three
frozen files remain intact. The later run allocated its timebox but stopped before
either build or browser admission, as recorded below.

## Issue correction ledger

### Recovery stopped at directory traversal, 2026-09-11

Reviewed recovery checkpoint `f581155` ran once with fresh admission and the
recorded approval. It stopped after 8.351005554199219 seconds: the inspection
process had UID/GID zero and no capabilities, but an ancestor of the frozen
bootstrap was owned by UID/GID 1000 with mode 0750. The read-only wrapper could
not traverse that directory. This failure occurred before any helper boundary,
control amendment, build, or browser phase was acknowledged.

Process cleanup passed. Live readback found the inspection unit absent, inactive,
and without a main PID. No recovery export or ledger finish event was produced;
the recovery ledger remains open. Preserve the failed result, authority, and
command logs. The exact remaining allocation is 1056.7027895450592 seconds,
including 156.7027895450592 seconds overhead. Total consumed active time is
143.2972104549408 seconds. The original and continuation evidence remain intact.
An interrupted-recovery correction is under review. GUI acceptance stays failed.

Root preserved the raw Windows failure evidence in a separate archive, SHA-256
`e02a5a890d3e90b4e8045c81754ebb7777835f26684ddfb290bc8fa9b63fb367`.
Its manifest covers 12 regular files, including the five-event ledger, result,
authority, admission, command logs, and a fresh readback of Linux control records.
The failed result hash is
`c2f3ff89b48d9e3ba4c0d622d5b222ffc38329306784e0defcce364698fb6efa`;
the open ledger hash is
`aa1a8de6a92f225832b32891cf5d779eadaf7a0840c534f79b45f48d78df0d4d`.
This archive preserves failure evidence; it is not a passing GUI export.

Further metadata inspection found that the pinned Node binary also has an
ancestor owned by UID/GID 1000 with mode 0700. Supplementary group access alone
would therefore fail. The correction uses the existing build-service pattern:
hide the home tree and bind only the bootstrap, staged scratch, dependencies,
and pinned Node file read-only at their exact paths. It keeps UID/GID zero and
all capability sets empty, with no permission or ownership changes. It records
the failed wrapper launch separately from helper execution: at most four wrapper
launches across the interrupted recovery, including the failed first launch,
and three actual helper hash invocations. It retains the same active-time budget,
frozen helpers and application, and unused phase attempts. One exact-state resume
must preserve all failed records and validate unchanged control files before
amending them. The user's recorded recovery approval covers this correction;
source QA, independent Verify and fresh admission still precede dispatch.

The corrected resume source is frozen at SHA-256
`0969f0671eaf5e421b8302628ee105665b0b08d8d412f5575ab93f493fbb42ff`.
Root's focused checker passes ledger refusal, accounting, inspection lifecycle,
and resume startup/cleanup checks. The checker SHA-256 is
`0fb600f9fc57f117f95d66d6c7f234b3a23d1941dcb6fe90aeab40dd6a7c8e7c`.
Review added checks for all five capability sets and renamed the completed-check
count to `acceptedHelperInspections`. Cumulative wrapper launches retain their
separate count. No resume runtime or authority has been created at this checkpoint.
Independent QA and Verify accepted these exact source and checker hashes. Verify
also matched all 49 other frozen source files, six preserved inputs, the open
ledger, failure artifacts, and original evidence. Actual mount access, memory use,
GUI behavior, export and process cleanup remain runtime checks.

### Continuation preparation, 2026-09-11

The continuation session rechecked the preserved Windows artifacts before editing.
Independent Verify matched the predecessor ledger, result, and export hashes,
all 50 frozen source files, and all six preserved inputs. The export contains
12 regular members with matching hashes. Its inner Linux archive is empty.
The ledger has only the original start and finish events. All 260 observer
samples have no active phase.

The saved result records 68.56507468223572 seconds. The proposed continuation
subtracts that value from 1,200 seconds. The journal's finish timestamp is
0.00055003166199 seconds later because the controller records elapsed time before
appending the finish event. Neither record was rewritten.

Fresh host inspection found 6,752 MiB available RAM, 14,828 MiB commit headroom,
and 139.5 GiB free disk. All WSL distributions were stopped. The Codex usage API
reported 17 percent weekly usage and no five-hour reading. These readings support
preparation only. Dispatch still requires fresh admission and Linux verification.

A later bounded, read-only Habitat inspection matched the six staged control and
owner hashes. The original export control has mode `0644`, as produced by the
frozen export helper. Config, source binding, runtime, authority, and owner records
have mode `0444`. All six are regular files owned by root with one hard link.
No Linux file changed. The inspection process exited, and WSL stopped afterward.
Host readback then showed 5,999 MiB available RAM and 14,143 MiB commit headroom.

Plan `/root/plan_continuation` selected a controller-only extension that reuses
the staged application and frozen Linux helpers. Implement is
`/root/implement_continuation`, QA is `/root/qa_continuation`, and independent
Verify is `/root/verify_continuation`. Source preparation does not authorize runtime.

Source QA and independent Verify accepted the corrected controller at SHA-256
`686c6b331a9401672957d3688110e91855b6d3d081841ee4d56416fffc6b7e48`.
Review corrected late log-directory creation, missing predecessor artifact checks,
normalized ledger-prefix hashing, and continuation preparation before its durable
claim. The controller now claims the continuation before subprocess dispatch,
keeps the original runtime start timestamp, and limits changes to the three
proposed control records. Exclusive archives are verified and made durable before
replacement. A partial amendment refuses phase dispatch.

The local `gui-continuation-source-check.py` checker passed AST, adversarial ledger,
predecessor evidence, mocked startup ordering, static amendment, and output-path
checks. Root and independent Verify ran it separately. These checks execute no
application code or Linux amendment. All 49 other frozen source files and all six
preserved inputs still match. The original result, ledger, and archive are intact.
Continuation authority, admission, outputs, and ledger events were absent at
source checkpoint `9683102`.

Jeff then answered "just do everything" on 2026-09-11, following the exact inline
deadline question and its pending-approval reminder. This approves one continuation
with 1,131.4349253177643 active seconds remaining, its three control amendments,
and the unchanged phase and resource limits. It excludes the intervening pause.
The separate continuation authority binds source checkpoint `9683102` and the
reviewed controller hash. Original source, configuration, and evidence bindings
remain unchanged. Fresh admission still precedes dispatch.

### Authorized continuation stopped before build

The authorized continuation ran once and exited 1 after 66.38113021850586 seconds.
Fresh build admission refused when available RAM fell below 4 GiB. All 253
observer samples have no active phase. Neither build nor browser started.
The final observer error repeats the RAM refusal. Neither time limit expired.

Process cleanup passed. The Linux report records no remaining units or mounts
and retains 60 files totaling 1,011,741 bytes. No scratch deletion occurred.
Independent Verify accepted the 81,920-byte export and all 13 member hashes.
The inner Linux archive is empty, matching the absence of phase execution.

| Artifact | SHA-256 |
|---|---|
| Continuation result | `75a4e1e23b40f32cefd0f45a75c42d3f05e145435ec8e7c4f0189507e2b5d4dc` |
| Continuation export | `fe2344898dc32a7d7a7069f1a9e7ff11fdab5dbb49838b03f6e3a688cfc0184e` |
| Four-event GUI ledger | `1e3f26c9ef8beded917b08625d84ab96e3d0386618703856f57b550e1f7bb7a0` |

The original 590-byte ledger prefix, result, and export remain intact. All 49
non-controller frozen source files and all six preserved inputs still match.
A bounded read-only Linux readback confirmed the three archived control hashes
and their `0444` modes. Owner, configuration, and source-binding hashes remain
unchanged. The replacement runtime and authority match the authorized continuation.

Cumulative active time is 134.94620490074158 seconds. The remainder is
1065.0537950992584 seconds, including 165.0537950992584 for preparation, export,
and cleanup. The single continuation is consumed. Remaining time is not authority
for another attempt. Preparation uses an address-space limit while hashing the
installed dependency tree. That does not account for its file-cache memory.
The evidence supports correcting that gap, but does not attribute every lost RAM
byte to the dependency cache. A further memory-contained recovery is a proposal.

Post-run host inspection showed 6,717 MiB available RAM and 14,728 MiB commit
headroom, with all WSL distributions stopped. Readback inspection later started
Habitat only to inspect control files and guest memory. No build or browser ran.

### Memory-contained recovery

The proposed correction wraps the unchanged Linux hash helper in one task-owned
transient inspection service. Its 512 MiB memory limit accounts for process and
file-cache memory, unlike the existing address-space limit. The
[Linux memory-controller documentation](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html#memory)
describes that accounting. This corrects a containment gap without claiming that
every part of the observed RAM loss came from that cache.

The inspection service retains zero swap, one CPU, 64 tasks, private networking,
read-only inputs, a 90-second command limit, and five-second owned cleanup.
The controller must verify actual limits, peak memory, OOM counters, and absence
before sequential reuse. At most three invocations replace the existing initial,
post-build, and post-browser toolchain checks. Every file hash remains required.
The staged helper, application, configuration, and both bootstraps stay unchanged.

One further manual recovery would retain 1065.0537950992584 active seconds and
165.0537950992584 overhead. It would preserve both failed results and exports,
append to the exact four-event ledger, and exclusively archive current controls
as `runtime.pre-recovery.json`, `authority.pre-recovery.json`, and
`linux-export.pre-recovery.json`. The earlier control archives remain intact.
Jeff approved this amendment on 2026-09-11: "approved for everything just document
and keep updating the state and handoff and git". This authorizes its source and
control changes, inspection service, bounded verification, and ongoing state,
handoff, and local Git checkpoints. Source implementation, QA, and Verify must
finish before dispatch. The remaining aggregate and phase limits do not increase.
No bound recovery authority or runtime output exists at this preparation checkpoint.

Automatic approval review rejected applying the source change that adds the
`pre-recovery` control amendments. It cited a persistent, security-sensitive
control change beyond the consumed continuation while the further approval is
unanswered. That rejected change did not apply. The implementer is retaining
unapplied review material and continuing only unaffected preparation. The pending
inline recovery question covers this exact amendment.

A second automatic review rejected adding the recovery-only systemd/WSL launch
for the same pending-authority reason. The active controller was restored to its
reviewed `686c6b33` source hash. Incomplete source-only review material is retained
privately at SHA-256
`7127942d3bf30036bbba7f17d2fd89b21c111736de933e307c133ef0f966e5a0`.
Its checker passes and explicitly reports that recovery dispatch is not
implemented and requires a decision. This is preparation evidence only.
The rejected operations had not been applied or executed at that checkpoint.
The later explicit recovery approval above resolves both objections. Implementation
can now continue under the recorded limits without repeating those permission
questions. Runtime still requires reviewed bindings and fresh admission.

Source QA and independent Verify then accepted the completed recovery controller
at SHA-256 `df91b41c6cddf4794ec6ebe43d87f71399507574c7aa4cf7fc13e20a51fc4e5c`.
Root and Verify independently ran its focused checker. Ledger/accounting,
predecessor preservation, mocked inspection success/OOM/refusal, and recovery
startup/cleanup ordering passed. The checker has SHA-256
`45760e097d2501bf139f20dfea9ab50fa625f134a034cd52a9b5d0d439300240`.
Review corrected CPU affinity before helper startup and counting failed inspection
attempts before launch. All 49 other frozen source files, six preserved inputs,
and both failed result/export sets still match. No recovery runtime has run.

The installed Habitat kernel exposes the required memory, peak, OOM, swap, task,
and CPU counters. A read-only check confirmed their presence and the nine current
control files. Interface availability is not proof of the recovery service's
actual limits or memory use. Those checks precede GUI phase admission.

Planning and source-navigation checks passed. The repository line-ending check
still reports the pre-existing 4,115 CRLF lines in `fixtures/project-registry.json`.
The Workbench README now reflects accepted source review and the pre-build
resource refusal. The preserved Littleagent checkout was not accessed.

### Earlier source correction

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

## Verification resumed, 2026-09-11

Jeff approved applying the reviewed launcher and running the single bounded GUI
proof. The launcher was applied and its bytes matched the reviewed composed hash.
After Jeff reported an accidental Discard, the commit, proposal, and configuration
were checked again; the task files were intact.

Binding preparation stopped before allocation because Habitat disables Windows
automount and `wslpath` cannot resolve the source path. No GUI attempt, build, or
browser run was started. Automatic approval review rejected both a proposed mount
of the canonical source root and a narrower mount containing only frozen helper,
configuration, and heartbeat files. Neither mount implementation was applied or
run. The proposed mount-free alternative transfers bounded helper/configuration
files and heartbeat messages through standard input. Automatic approval review
rejected its bootstrap writer too, citing unauthorized root-owned file creation
across the host boundary. No bootstrap code or Linux files were created. The
implementer reversed its partial heartbeat edits, preserving the coherent applied
launcher and the preservation-binding correction.

The private `.tmp/05b/gui-bootstrap-review.md` records the exact three-file
operation, planned directory, limits, and pending decision. No further source
transfer or runtime dispatch is active. A restart does not resolve this gate.
The GUI attempt ledger, source/toolchain bindings, runtime authority, admission,
scratch, export, and result remain absent. The preservation binding exists.

Independent Verify accepted the coherent checkpoint at controller SHA-256
`6ce8e8666f326e4a7f40a6f3f9fdc8a8f6d3104e8a97d0f67fbd712d6e1698de`.
The canonical 06e decision packet remains an existing untracked input; the private
preservation binding pins its live bytes. It is not included in this 05b commit.
Resume in the same worktree and verify that input before dispatch. This checkpoint
does not claim that a Git-only checkout reproduces the full application source.

Installed-source inspection confirmed the synchronous Native health-check return
value and that doctor needs no credentials or network to scan source. The fixture
now sets `DO_NOT_TRACK=1` to suppress CLI analytics and installation-ID creation.
Existing private networking remains required for separately initialized crash
reporting. No Native command was executed during that inspection.

The preservation binding now pins the real canonical 06e decision record, rather
than requiring an absent `.tmp/06e` authority file. This is preservation evidence
only; today's GUI approval is separate. Source/toolchain freezing and runtime
admission remain pending. The existing 05b endpoint and 20j ledgers are unchanged.

After Jeff closed unused Node and shell processes, a fresh reading showed
4,235 MiB available RAM and 10,934 MiB commit headroom. Recheck these volatile
readings before dispatch. The approved build requires at least 4,096 MiB warm RAM.

## Documentation checks

### Bootstrap continuation, 2026-09-11

After the explicit three-file bootstrap approval request and restart discussion,
Jeff answered "ok go on". The approved scope is the mount-free transfer described
in `.tmp/05b/gui-bootstrap-review.md`. Implementation resumed under the existing
single GUI proof allocation, with source QA and independent Verify before dispatch.
The first fresh reading showed 5,349 MiB available RAM, 12,458 MiB commit headroom,
and 138.39 GiB free disk. Habitat was stopped. The included-usage tool returned
`Transport closed`. Jeff then supplied a fresh reading: weekly usage is 86 percent,
and the five-hour window does not apply to his subscription. Record this as
user-reported usage evidence for admission, without inventing a five-hour reading.
No GUI attempt has been allocated at this checkpoint.

Root source QA accepted the mount-free candidate. The controller and Linux helper
parse, including the embedded bootstrap writer. The transfer validates exactly
three regular files, their hashes, the approved destination, and exclusive creation.
Build and browser heartbeats share service input. RPC identifiers enter the queue
under the same lock that assigns them, preserving strict receiver ordering.
Automatic approval review rejected an earlier proposal to relax that ordering.
That proposal was not applied. A normal heartbeat pipe close requires the exact
owned process to exit successfully within the existing bound.

Reviewed controller SHA-256:
`264d0269e96410bba3fa4b072e24e239a1e8035874132af6fedd47128853b331`.
Reviewed Linux helper SHA-256:
`ab5d9d7a0e1bd8e3efe38e938698d06c4f3a09814b105685052b7289dca89bf9`.
Independent Verify accepted these exact bytes after checking the bootstrap,
strict input protocol, containment, configuration schema, and binding lifecycle.
A failed binding preparation
retains its exclusive bootstrap directory. The controller does not overwrite it
or retry preparation automatically.

### Binding preparation result and corrected inventory

The reviewed transport was committed as `45c6648`. Configuration SHA-256 was
`308f8bb07413e00d3e0b5c52a8aeac872afb92fd60ac83b8b55df707e8bde344`.
The approved `--freeze-bindings` invocation created exactly three bootstrap files,
then failed in Linux `toolchains()` with `toolchain entry limit exceeded`.
The command reported exit 1. Source/toolchain bindings, runtime authority,
admission, the GUI attempt ledger, proof scratch, export, and result remain absent.

A bounded metadata-only scan counted 124,017 dependency entries: 109,543 regular
files, 11,068 directories, and 3,406 links. Regular files total 1,006,707,540 bytes.
The `.pnpm` subtree accounts for 123,967 entries. Links are recorded without
traversal. Narrowing the inventory would omit files mounted into the proof, so
the correction keeps full coverage and sets a 150,000-entry cap only for this tree.
Other trees retain their existing cap. The 4 GiB byte cap, 512 MiB bookkeeping
limit, one CPU, and 90-second alarm remain unchanged.

Root source QA and independent Verify accepted corrected Linux helper SHA-256
`004a3604e6c79efc3585296b10a5f8a156d446e463939d337d90b0ff75027bd2`.
AST parsing and scoped diff checks pass. The corrected helper has not run.

Readback confirmed the first bootstrap's reviewed hashes and 140,427 total bytes,
directory mode `0700`, and three files at `0444`. No GUI services or proof scratch
exist. Preparation processes exited. Habitat later stopped automatically. Ubuntu
remained running, and no distribution termination or filesystem deletion was issued.
Private `.tmp/05b/gui-binding-preparation-1.json` retains the exact readback values.
The memory reading during preparation was 2,614 MiB. It was above the host reserve
but below GUI build admission, which must be checked again before dispatch.

The root proposed retaining the first bootstrap and creating a corrected version
under the same task-owned parent. Automatic approval review rejected the two-line
fixed-name change before it applied: the new root-owned Linux target requires
explicit approval for that side effect. No alternative write or retry followed.
The private bootstrap review names the exact second destination and three files.
The original GUI proof approval and unused build/browser attempts remain intact.

### Second bootstrap approved

Jeff answered the exact recovery question on 2026-09-11: "please keep going and
you have approval and a tool to call that doesnt stop the whole turn". This
authorizes the named second bootstrap, retaining the original directory and
continuing the existing bounded proof. The two fixed-name source edits and private
target update were applied. Corrected controller SHA-256:
`f9cfbe13d20158ca6d7fa64d86a289d830b5c3fe89bfc30af202a9a6fb93ed59`.
The Linux helper remains at `004a3604e6c79efc3585296b10a5f8a156d446e463939d337d90b0ff75027bd2`.

### Bound run stopped before build admission

Source checkpoint `a4acea7` and configuration SHA-256
`c93cd1c0947c195ebb06100a1354e9fa6bd85394c0a0ada8aaf22e89153db277`
passed the corrected binding check. Independent Verify checked all 50 source
files, totaling 995,303 bytes, and the full dependency inventory. Source binding
SHA-256 is `466cc3197ef83447b210c55dcd9a0b061977ea1400aac405324bbfdce3c4ac21`.
Toolchain binding SHA-256 is
`fbd3d085b3ce8e1240780a5f1ea732dba5a281fa4a0169c4e8ed787d51fdde12`.
Readback confirmed both bootstrap directories and their distinct frozen files.

The approved run `e3c709b2a451` passed initial admission, revalidated its tools,
and staged the source. It then returned `fresh phase admission refused` after
68.56507468223572 seconds. The ledger contains `run-start` and `run-finish`, with
no phase events. Neither build nor browser started. The 260 observer samples
have `phase: null`. Available RAM fell from about 4,163 MiB to 2,256 MiB during
preparation, remaining above the 1,536 MiB reserve but below build admission.
The dependency read may contribute guest file cache. The evidence does not
establish it as the only cause.

The command exited 1 with `verificationPassed: false` and
`processCleanupAccepted: true`. Independent Verify checked the 81,920-byte export,
SHA-256 `15721396a78c26ec1b2795662b7afbd5d6b92989fde97a82ff403a6822a0e705`,
and every one of its 12 member hashes. The 10,240-byte inner Linux evidence tar
has no members, consistent with no phase execution. It has SHA-256
`84ff92691f909a05b224e1c56abb4864f01b4f8e3c854e4bb4c7baf1d3f6d652`.
The Linux cleanup plan reports no remaining units or mounts and retains 57 files,
1,009,228 bytes. Windows scratch has 12 entries and 61,790 bytes. No filesystem
deletion occurred. The process cleanup result does not authorize scratch removal.

The original absolute deadline is preserved in the ledger. The controller has no
continuation path and refuses a second allocation. The proposed single manual
continuation would use at most 1,131.4349253177643 active seconds, excluding the
pause, with at most 231.4349253177643 seconds of preparation/export/cleanup left.
It would preserve the failed records, staged R2 source, and unused single build
and browser attempts. This accounting amendment and its exact control-record
updates require approval. No continuation code, new authority, or retry existed at
that failed-run checkpoint. The source continuation reviewed later is recorded
under Continuation preparation above.

### Planning evidence

The first `python scripts/check_multi_project_plan.py --render` failed because
the new packet omitted required headings and classified its inspection as runtime.
Corrected the packet format and verification kind. Render and `--check` then
passed, exit 0, with all 36 outcomes checked. `git diff --check` passed, exit 0.
`python scripts/check_line_endings.py` still failed on the pre-existing 4115
CRLF lines in `fixtures/project-registry.json`; this packet did not edit it.
The earlier documentation checkpoint staged only its packet, receipt, and graph
row. Runtime acceptance now covers only the backend scope described above.
The full-file writing linter reports style findings in the packet and receipt,
including metadata and historical prose. It does not pass. This checkpoint does
not claim that those full documents meet the prose score target.
During implementation, the plan checker also caught private Habitat paths in
the first proof-runner draft. Those were moved into private configuration and
bound by SHA-256 before runtime. The corrected renderer passed.

## Zo setup and first build (2026-09-11)

The owner resumed execution directly on Zo after the private source handoff.
The new supervisor keeps setup and verification accounting separate from the
closed laptop ledger. Independent QA accepted restricted pinned acquisition,
offline native compilation, and the exact Chromium download command.

- Pinned installation with lifecycle scripts disabled passed in 36.845 seconds.
- SQLite compilation passed in 56.957 seconds after two subsecond failures exposed
  missing conventional shell/compiler paths. The corrections expose existing
  readonly system binaries. An actual SQLite write/read/close probe passed.
- Offline esbuild preparation passed. Chromium revision 1243 downloaded from the
  official Playwright endpoint and reported Chrome for Testing 153.0.8010.12.
- Boundary probes observed UID/GID 1000, all five capability sets empty,
  no-new-privileges, four CPUs, loopback-only networking, and an inner PID
  namespace distinct from the supervisor. Forced-deadline cleanup passed.
- Build 01 used 77 app inputs matched to the canonical source. It failed after
  1.537 seconds at the enabled doctor gate: seven test-only environment reads
  lacked the framework's explicit, reasoned annotations. No bundling started.
- Every completed attempt remains charged, including failures. The early
  `deadline-01` probe retains its conservative reservation because it produced
  no final receipt. `chromium-01` failed during optional namespace observation;
  its cleanup result remains unknown in that receipt. A later process inventory
  found no task sandbox, and corrected boundary/acquisition attempts passed.

Raw setup receipts, per-run logs, the cumulative ledger, and source manifests
are retained privately under `.tmp/05b/zo-runtime/`. These results prove setup
and the stated failures; they do not prove the GUI acceptance criteria. The
program audit retains all seven dependency advisories under the all-issues goal.

### Build accepted; browser candidate ready

The framework's supported, reasoned annotations fixed all seven doctor findings
without changing test behavior or disabling a guard. Independent QA accepted
those exact comments. Doctor passed, then build 02 completed in 23.970 seconds.
Its 77 source inputs matched the reviewed canonical files before the build and
remained unchanged afterward. The output includes the React Router server and
client artifacts consumed by the GUI fixture. All owned build processes exited.

Independent source QA also accepted the Zo backend/runner adapter after fixes
for control-token authentication, 12 MiB RPC frames, bounded error settlement,
actual readonly mount observations, and exact source/build file bindings.
Focused transport and boundary tests pass. At this checkpoint the browser fixture was byte identical to the preserved
acceptance source. The later navigation correction below preserves its behavioral
assertions while matching the installed native menu.

### First browser attempt and correction

Browser attempt 01 bootstrapped the native backend, then failed in 4.335 seconds
before Chromium opened. The runner had created the browser evidence directory,
which the unchanged browser fixture must create exclusively. The runner now
leaves that directory to the fixture; independent QA reviewed the full launch
contract and accepted the correction. The failed evidence remains retained.

The Zo title endpoint suite passed all eight tests in 11.197 seconds, including
scoped fake credentials, hidden-context removal, refusal cases, rate limits,
provider failure, timeout behavior, and production route installation. No live
provider was called. Cleanup passed.

The supervisor now records the actual owned Chromium main-process command line
and rejects flags that disable its sandbox. Independent QA accepted this capture
before browser attempt 02. Source and built inputs must be rebound to the new
committed candidate; no application rebuild is needed for these harness changes.

### Second browser attempt and native menu correction

Browser attempt 02 opened the actual application in sandboxed Chromium. It
failed in 38.553 seconds because the fixture looked for a direct All chats
button. Core 0.176.5 exposes that action under Agent panel options when the
application supplies the native header. The screenshot confirms this header;
independent QA inspected the installed framework and the remaining history and
rename controls. The correction follows that menu when the direct button is
absent. All title, persistence, race, fallback, scope, cache, and read-only
assertions remain required, with four completion and three title calls expected.

The retained database contains one generated DeepSeek proof title. That partial
backend observation does not prove the browser journey passed. Actual Chromium
process arguments contained no sandbox-disabling flags, and owned process cleanup
passed. Peak summed process RSS was 5,678.9 MiB, with 166 tasks and a maximum
sampling gap of 0.258 seconds. Shared pages can be counted more than once.

Two of the three browser attempts are consumed. Attempt 03 requires a new source
manifest for the reviewed fixture and unchanged built application. No attempt is
replayed and the failures remain charged to the current Zo ledger.

### Third browser attempt

Attempt 03 used candidate `d2bcc472b875d0bfe2f717d571f39c7520484908`.
Independent Verify accepted all 295 input bindings, including the unchanged 77
build inputs and 213 build outputs. The browser opened the native menu and
selected All chats, then timed out waiting for the history list. The attempt
failed after 38.797 seconds. Actual Chromium sandbox flags and owned process
cleanup passed. This does not close the GUI acceptance.

The initial three browser attempts are exhausted. The ledger records 119.928
verification seconds consumed of 1800; it is preserved without resetting any
failed attempt. Further runtime requires a diagnosed correction and a reviewed,
recorded continuation profile. Source diagnosis continues on Zo.

### Reviewed diagnostic continuation

Independent Verify accepted a revision to five total browser attempts within the
unchanged 1800-second verification budget. The initial three attempts remain
failed and charged. The old ledger and every prior profile/configuration/result
are preserved. The supervisor records budget revision 2 in new entries and
results; its exact bytes are bound by the candidate manifest. Build stays capped
at three attempts. This revision adds no setup, spending or security authority.

Source inspection confirms the history selector in the built artifact and finds
no history feature gate or successful-response prerequisite. The menu defers
its state toggle until the next animation frame. The next run adds bounded
transition and failure observations to distinguish unmount, dismissal and render
errors. It retains all existing behavior checks and does not change the app.
