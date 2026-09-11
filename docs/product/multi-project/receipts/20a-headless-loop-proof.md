# 20a headless-loop implementation receipt

Evidence-record: 20a
Date: 2026-09-07
Verification-kind: runtime
Result: In progress. Deterministic controls and isolated role-tool execution have evidence; native-model acceptance remains open.

## Authority and scope

The [accepted experimental decision](../design.md#experimental-policy-and-continuous-execution-decision-2026-09-07)
and [packet contract](../packets/20a-headless-loop-proof.md#usage-contract)
own the settings and authority. Existing included subscriptions are authorized;
available allowance is user-reported and bound to observed native authentication.
No account setting was changed, and no credential was copied.

## Implemented controls

The existing usage ledger now supports explicit observed-usage trials alongside
its unchanged hard-reservation mode. Versioned policy, native runtime/model,
declared calls, workflow stages, and session bindings are checked before dispatch.
Input observations are deduplicated by message identity. Unknown final accounting
stops admission and requires reconciliation; it never becomes a fabricated charge
or a fresh allowance. Authorized trial transitions retain prior charges and stops.

Invocation, iteration, and packet durations plus stop grace are configurable and
bound to the trial. Resume preserves wall-clock and monotonic expiry. Native
compaction, model selection, reasoning, and response-length defaults remain intact.
The adapter validates stream identities, tools, final usage, and role responses.
The existing owned-process supervisor now delivers usage events before exit and
terminates its process group when an event is rejected or the deadline expires.

## Verification checkpoints

- Habitat ran 119 coordinator, ledger, adapter, deadline, and process tests:
  zero failures, errors, or skips; 67.424 seconds. The native role calls in those
  tests are deterministic doubles. Source hashes for that run follow below.
- Independent review found an oversized completed-line edge case and loss of a
  UTF-8 prefix during timeout cleanup. Both were corrected. Six real-process
  transport tests then passed in 0.820 seconds with no resource warnings. They
  prove delivery before exit, usage-rejection descendant cleanup, concurrent pipe
  draining, oversized-event refusal, and ASCII/UTF-8 timeout evidence retention.
- The constrained-host offline proof exercised planner, developer, and QA in six
  sequential task containers. It made 37 real MCP requests, verified role reads,
  candidate-only developer writes, rejected undeclared capabilities, and confirmed
  container removal. The separate Linux host/tool suite passed 19 tests. These
  observations do not establish native model use, session behavior, or usage fields.

- Native-model bootstrap binding passed seven Habitat tests with zero failures,
  errors, or skips in 0.029 seconds. The same ledger derives the concrete model
  from its single settled preflight. Later calls retain existing charges and launch
  history without resetting trial identity or deadlines. Missing, ambiguous, stopped, or prior-trial evidence
  is refused, and changed native model identity stops dispatch without an override.
  Independent review found no issues. These tests use deterministic native events.

| Source at the 119-test checkpoint | SHA-256 |
| --- | --- |
| `tools/hoh_loop.py` | `c09686b3872aa8cd433ff214a5e7e0dac72225bdff121d97be55ceafdeb07fb9` |
| `tools/hoh/protocol.py` | `834b08605ec918a7b15f9be0f59e9c4e509f983f6e50b5972c5d18c651420f86` |
| `tools/hoh/claude.py` | `6cd3a03c3cb441da9810c596853b70df626b91edf89cb934e57bad2fbbbb4f75` |
| `tools/hoh/workflow.py` | `04a7841e6c60d91ddaf54b127e1e4061423dedbcbfd0dde86b1f3f2abc8dc87c` |

## Later supervisor and telemetry checkpoints

The actual WSL supervisor ran 165 tests with zero failures, errors, or skips in
65.5464239 seconds: Python 3.12.3, Git 2.43.0, Docker at `/usr/bin/docker`, UID 1000.
This checkpoint precedes the telemetry and packet-deadline changes.

| Source at the 165-test checkpoint | SHA-256 |
| --- | --- |
| `tools/hoh_loop.py` | `7d0291728469c76b75b4f166fcda1ebd2c991e2bbc40eded7df7e9b7ad29735b` |
| `tools/hoh/protocol.py` | `04df266768682b6b2e088c3c9349c9fe820c8b2930f7fec53c6ba9fe4718f9de` |
| `tools/hoh/claude.py` | `71cbbb000a7f9f01177db24059deefbf6b2c803d314866a225c7a7195f19d588` |

The [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript#sdkratelimitevent)
documents rate-limit events and session attribution. The
[Python reference](https://code.claude.com/docs/en/agent-sdk/python#ratelimitinfo)
describes quota and overage metadata; its
[first-party parser](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/message_parser.py)
confirms the camelCase wire fields. These sources were checked on 2026-09-07.
They do not prove the installed 2.1.241 stream behavior.

The adapter accepts attributable, validated allowed/warning telemetry without
charging tokens. It retains the raw events for receipts and stops on rejection
or explicit active-overage signals. Overage availability grants no spending
authority. The active-overage boolean guard is conservative; its installed-runtime
shape remains unverified. Nine synthetic telemetry tests passed in 0.009 seconds;
the 16 existing adapter tests passed in 0.014 seconds. No model call was made.

The actual no-model launch proof awaits evidence export. Its final acceptance
and cleanup evidence will be recorded after that export is verified.

## Observed native host configuration

An observed-usage workflow requires the explicit CLI option:

```console
--native-host-config /absolute/path/to/native-host.json
```

The host configuration has exactly these fields:

```json
{
  "schema": "vivary.habitat-native-host/v1",
  "task_root": "/absolute/path/to/task-hosts",
  "included_access_evidence": "/absolute/path/to/included-access.json"
}
```

The config file and both referenced paths must be absolute, have no parent
traversal, and have no linked path components. The config and authority evidence
must be regular files. An existing task root must be a directory; a missing task
root is allowed. The evidence file is the separately verified included-access
authority record, not credentials. The loader supplies the repository source root
and binds the runner and launch verifier to the same Habitat host owner.
Observed workflows cannot fall back to local execution. Hard mode keeps its local
executable guard and refuses this host option.

Ten loader tests passed on Windows in 0.183 seconds, using synthetic adapter
boundaries and modeled link reports. They cover malformed and missing config,
relative and linked paths, source-root selection, bound ownership, mode selection,
workflow validation, and CLI forwarding. These tests make no Docker or model call.


## First native preflight and reconciliation

The lead observed one actual Claude CLI invocation after automatic review accepted
the included-only bootstrap. It completed three turns with native default model
`claude-opus-5[1m]`, exactly two scoped read-only tools, and confirmed cleanup.
Both tool calls returned MCP `-32602`; the model truthfully reported `blocked`,
and the read log remained empty. This does not pass the scoped-read preflight.

Retained stdout is 14,433 bytes without truncation, SHA-256
`c4c65db2517676dba26b64d19b0de138df1cd1759f9e19480ebb45c79c2d4f4a`.
The main terminal reports 13,127 tokens and a distinct Haiku entry reports 1,242.
The original accounting parser incorrectly compared the sum of model entries
with the main terminal counters, so settlement refused. Trial v1 initially retained one
unknown claim and a terminal stop; it must not be reset or silently replayed.
Helper purpose and reporting coverage remain unknown. A native `costUSD` field
does not establish paid usage; Usage credits were verified disabled on this account.

The lead corrected MCP handling to accept object-valued request metadata and
omitted arguments for the no-argument tool. Metadata is discarded before dispatch
and cannot confer role, path, or write authority. The four-case regression run exposed three errors
before the correction; all four passed afterward. Of 23 adjacent Windows checks,
21 passed and two Linux cases were explicitly skipped. Independent source review found
no blocking issue. The [MCP schema](https://modelcontextprotocol.io/specification/2025-06-18/schema)
and [metadata definition](https://modelcontextprotocol.io/specification/2025-06-18/basic)
support those request forms; execution extensions remain refused.

The versioned accounting correction matches the main terminal report against the
exact initialized model entry before adding distinct canonical model entries once.
It checks streamed input against main usage first, retains native raw fields, and
leaves helper purpose/coverage unknown. Nine focused tests and independent source
review cover the main/helper split, cache counting, alias ambiguity, malformed
counters, and contradictory main or streamed reports. The nine focused tests,
16 native-event tests, and seven model-binding tests pass.

Read-only replay of the retained preflight passed all 16 events. Three distinct
assistant message IDs report 12,465 main input tokens. The final normalized report
counts 14,369 tokens: 13,694 input and 675 output, including 8,167 cache-read and
4,292 cache-write tokens within input. Main usage is 13,127 and the separately
reported Haiku entry is 1,242; native turns remain three. Native usage, model, and
rate telemetry are retained. The ledger and six retained artifacts remained
unchanged by SHA-256; the replay made no model call or ledger write.

## Reconciled accounting and clock investigation

The retained first call is now reconciled at 14,369 reported tokens. Its
original stop remains in the stopped trial snapshot and the carried ledger's
history. The private failed-trial archive is 32,365 bytes with 27 payload files,
SHA-256 `0ef9e1273b7c110069f00c2d133703ac68f79b5087c244ba8d88373da004ba9f`.
The lead independently verified the export's member hashes and sizes.

A second preparation uses `20a-observed-usage-v2`, a 300,000 reported-token
target, and the original 29-launch, 600-second invocation, 3,600-second packet
and iteration, ten-turn, and five-second cleanup settings. Its 14 role stages
plus one preflight have new session bindings. It carries the same ledger and
all 14,369 prior tokens; zero launches and an unstarted clock were verified.
The fixed fixture baseline and three proof projects were prepared without a
model call. This is prepared work, not a successful native trial.

The subsequent 220-test Habitat suite had 219 passes and one checkpoint error.
A focused rerun passed, then a bounded repeat observed a 50.8 ms wall-clock
rollback. An independent single-thread sample observed a 96.8 ms wall rollback
while the monotonic clock advanced. All captured Git processes cleaned up.
The strict deadline guard refused the clock reversal; the error was not an
artifact-tampering assertion or evidence of an orphaned Git process.

The private clock diagnostic archive is 10,700 bytes with five payload files,
SHA-256 `c5098363c2bf5de4fb25e6f1ded98cb89ad26e1d6740165a68b522e1b35869f2`.
The lead independently verified its payload hashes and sizes. No WSL clock,
time service, or shared kernel setting was changed. A separate sample-before-lock
race was reproduced and fixed by sampling under the existing deadline lock;
its deterministic Windows regression passes. That fix does not resolve the
measured wall-clock adjustment. Checkpoint errors now retain the deadline and
process-refusal details. Those deltas were subsequently synchronized and verified as recorded below.
Any policy change must retain prior usage, recovery, and trial evidence.


## Reviewed BOOTTIME implementation checkpoint

The first frozen BOOTTIME implementation passed all 239 Habitat tests with zero
skips in 64.631 seconds. Its private archive is 174,177 bytes, SHA-256
`61aa4af1135212f606f52e7105a0c41c62f80405ae056b132d7692f82cfb995c`.
Review then added a new-policy-only deadline check before every buffered output
callback. Its two-line regression reproduced late callback delivery before the fix.

The final 240-test run had 239 passes and one legacy strict-clock refusal: an
actual 25.303189 ms wall reversal occurred before a Git checkpoint. This run is
not recorded as green. The 37 focused final checks, including that legacy case,
then passed with zero skips in 5.424 seconds. The combined final test archive
preserves both reports and 27 exact sources: 152,307 bytes, SHA-256
`0368dd26c4bc24394df165050d34bf6793b1a0754948ca92bc593c52399490fc`.

The actual no-model proof passed two cases in credential-free, inspected workers.
A stopped process supervisor rejected buffered output after its original three
second expiry while retaining the bytes as diagnostic evidence; process cleanup
was confirmed in 0.013 seconds. A stopped worker rejected a queued file-read
request after its original ten-second expiry, returned zero response bytes, and
recorded no read. Both exact containers were removed. These are SIGSTOP/resume
tests, not an actual VM-suspend experiment. Shared clock settings were unchanged.

The first transport attempt passed the process case but failed in the private
proof's overlong Unix socket pathname. The driver now connects through a verified
directory descriptor. Product source was unchanged for that correction. The
44-payload transport archive retains both attempts and their drivers: 52,959
bytes, SHA-256 `38e35de0590950bbe1e19128ecc6cffbbe84c27b183205ddc1bfe29938409896`.
The lead independently verified every exported archive member and read the
actual clock, cleanup, callback, and worker-response records.

The v3 preparation driver passed independent review. It refuses optimized Python
and requires the final preparation receipt and unchanged v2 inventory before
bootstrap. The next operation is an inert, guarded preparation revision followed
by a new included-only preflight. No additional model call or live ledger
transition is claimed at this checkpoint.

## Native BOOTTIME preflight and sequence start

The guarded v3 preparation revision completed with the original ledger and its
14,369 prior reported tokens preserved. The unused v2 preparation is retained
separately with its exact inventory. Independent review accepted the final
clock tests and actual no-model pause evidence before the v3 preflight.

The v3 native preflight completed with exactly the two allowed read tools and
one specification read. Native transport retained complete output and confirmed
process cleanup. It reported 14,543 tokens: 13,303 for the main native model and
1,240 for a separate native helper. The native rate event reported no overage
and organization-disabled overage. Native defaults remain unchanged.

Automatic approval review initially rejected this call because its payload and
destination were unspecified. Read-only inspection established the synthetic
link-checker specification, no project checkout mount in the model host, scoped
read-only tools, and Anthropic first-party service through the existing proxy.
The same reviewed bootstrap then passed approval and execution.

Four tiny synthetic fixture repositories were prepared within the existing
private trial directory. The three-iteration healthy sequence has started;
healthy, restart recovery, and regression acceptance remain open until their
actual retained results are independently reviewed. No completion is inferred
from the successful preflight.

## Stopped native schema retry

The healthy run stopped during its first planner's one schema retry. Attempt
one completed natively, returned a Markdown report instead of the required
JSON envelope, and settled 22,356 reported tokens. Its exact admitted prompt
contained both the planner's Markdown-only directive and the appended JSON
response contract. This is a conflicting prompt contract, not missing prompt
assembly.

The native resumed attempt initialized as `claude-opus-5`; the preflight and
first attempt initialized as `claude-opus-5[1m]`. The exact model guard refused
that difference. The resumed input was queued, dequeued, and persisted in its
exact native session, but no later assistant usage or terminal result exists.
This cannot prove whether upstream dispatch occurred. The retry remains an
unknown claim and the terminal hold remains intact; it is not charged zero.

Trial v3 retains 36,899 known reported tokens plus that unknown invocation.
Earlier trial history retains another 14,369 known tokens. The private stopped
archive retains the trial, ledger snapshot, frozen source, and drivers: 251,470
bytes and 203 payloads, SHA-256
`a6c7b23154ddcd1d84e4579618e26b4827ecf8bc978457bb653f2fdbdab3ed66`.
The lead independently verified every member's hash and size. Container
inspection confirms no trial model host or worker remains.

Further native calls are held. Prompt correction, model identity semantics,
and explicit accounting-preserving continuation policy remain under review.
No successful healthy, recovery, regression, or full 20a acceptance is claimed.


## Experimental continuation mechanism

The explicit continuation API has separate unit acceptance. The lead reviewed
the frozen source and independently ran 46 synthetic ledger/clock cases in the
existing Habitat WSL with Python 3.12.3. All passed with no skips in 1.713 seconds.
The low-priority process peaked at 29,008 KiB resident memory. No container,
native model or live usage ledger was involved.

The initial run passed 45 cases; one thread-concurrency test could not start a
thread under the proof runner's 256 MiB virtual-address cap. Raising that cap to
768 MiB allowed the test while resident use remained about 28 MiB. Product code
was unchanged. The initial summary and observed traceback are retained; its full
temporary unittest log became unavailable before collection. The final complete
log was exported from durable staging, then all eight staging files and empty
directories were removed. No test process remains.

The API requires explicit versioned authority bound to the exact stopped state,
complete archive/member hashes, raw archived ledger bytes, target configuration,
fresh sessions and separately hashed quiescence evidence for every invocation.
The caller must actually inspect process termination; the API verifies the receipt.

Unknown native usage remains immutable and null-charged in typed history. A new
snapshot exposes the lifetime known reported lower bound, unresolved invocation
set/count and incomplete accounting. A successful later trial cannot erase those
facts. Default settled-only continuation remains unchanged. Replay preserves
newly started work; a superseded replay refuses.

The independently replayed unit archive has SHA-256 `5d7eee51cb583ec630d9f294d8d52bed5baa0d39cffcb1abc897bd0bcee02612` and contains
the original frozen source archive, complete final results, cleanup and helpers.
No live continuation occurred. Its revised trial settings, authority, actual
quiescence and combined runtime checks remain prerequisites to another native call.



## Combined identity and experiment settings verification

The versioned workflow can set planner_priority_limit to an exact integer from
one through three. Omission preserves legacy configuration hashes and behavior.
Configured prompts request at most that many unmet priorities, allow an honest
zero-priority all-green report, and forbid manufactured failures or edits. The
gate still requires concrete nonempty report sections. The assembled instruction
is hashed after transport preparation and bound to the request and receipt.

Independent source review caught the initial zero-priority contradiction; the
five focused configuration checks cover that correction, excess priorities,
invalid types, legacy compatibility and exact dispatched prompt hashing.
No-progress detection, final oracle verification and the three-round healthy
policy remain unchanged. An early all-green report does not itself pass them.

The combined Habitat run passed 114 checks with zero skips in 10.952 seconds,
including the frozen native identity adapter, exact prompt handling, telemetry,
observed accounting, continuation history and actual deterministic loop recovery.
Native calls were test doubles; no live model or usage ledger was touched. Peak
resident memory was 31,152 KiB, with nice priority 10 and a 768 MiB address-space
cap. Containers and build servers remained stopped.

The first preflight correctly refused an older Habitat Claude adapter before any
test or source mutation. Its failure log and exact cleanup are retained. The
second transfer admitted only archived preimages for the reviewed scope, adapter
and prompt edits, then checked all dependency hashes. All temporary staging was
exported and removed. A separate process inspection found no remaining matching
test process, and both owned staging paths were absent.

The lead verified all final archive payloads against the source/results and read
back ZIP integrity. Archive SHA-256 `6aa4cb34fb65c217a2faa7921919e39bb59d0b399a3a10c1180a939a8d51dae8`; 170,945 bytes,
47 payloads. This combined unit is accepted. A new native trial still
needs its frozen settings, explicit continuation authority, actual quiescence,
fresh sessions and resource headroom. Earlier unknown accounting remains unknown.



## Version four preparation

The lead and independent reviewer accepted the inert v4 preparation after the
combined 114-test proof. The existing Habitat ledger transitioned through the
typed continuation API with the full stopped v3 archive and fresh local
quiescence evidence. Every prior reservation and history entry remains preserved.
The known reported lower bound remains 51,268 tokens plus one unresolved native
invocation; local process/container absence does not establish upstream usage.

The new trial has zero launches and reservations, no running clock, and no stop.
No model call occurred during preparation. The versioned v4 workflows request at
most one unmet planner priority and use fresh native session IDs. All v3 numeric
limits, native compaction and response defaults remain unchanged. This is an
implementation choice under D31, not a newly invented owner decision.

The reviewed inputs and prepared trial directory remain private in the existing
Habitat workspace because the upcoming trial needs their continuation authority.
They will be removed after verified final export. The Windows export includes
the exact preparation receipt, launch log and prepared ledger. Live bootstrap
and sequences remain unexecuted pending their separate source review and fresh
RAM headroom of at least 6 GiB; the latest reading was 3.73 GiB.



## Version four launch staging

Independent Astra review accepted the exact launch gates after 12 passing offline
tests with no failures or skips. The gates require settled current-trial preflight
evidence, bind its model/request/result/usage and immutable artifacts, and stop
the ledger on bootstrap failure. Final verification also binds the regression
candidate and receipt tree and rejects an unexpected QA admission.

The reviewed wrapper transferred those exact gates and prepared the four tiny
sequence fixtures in existing Habitat. All staged bytes were read back. The
canonical ledger is byte-identical to the prepared export: zero model calls,
zero reservations and no running clock. The original frozen preparation inputs
were unchanged. Launch gates and fixtures remain private until final export and
exact cleanup. The offline proof uses synthetic ledger/bootstrap fixtures and
does not establish native execution. Live calls remain deferred while available
RAM is below the 6 GiB threshold; the latest check reported 2.50 GiB.



## Version four execution readiness

Independent Astra review accepted the one-mode Windows wrapper and its Habitat
audit after corrections for prelaunch quiescence, unresolved attempts, independent
evidence export, timeout output retention and unreadable process state. It checks
RAM before and after starting the two existing reference/proxy containers and
attempts to stop each captured container independently after the mode returns.

The accepted audit ran in Habitat without starting containers or invoking a model.
It found no owned containers, matching processes or unreadable process entries.
The helper was removed and the canonical ledger remained byte-identical. Local
absence does not resolve prior upstream token usage. Bootstrap and live sequences
remain unexecuted because the 22:15 UTC check found only 4.22 GiB free RAM.

The complete launch-readiness archive includes offline tests, inert staging,
accepted wrapper sources and the actual audit result. The lead reopened every
member and verified ZIP integrity. SHA-256 `ea7f79b5684116da00458476b786d5aaec53632bed59b242b0659315002cd0a9`
(29,770 bytes, 18 entries). This is launch readiness,
not completion of native healthy, recovery or regression acceptance.


## Open acceptance

The executable and isolation boundaries retain their independent evidence.
The later v3 scoped-read preflight passed after D32's verified included-only
setting. Its healthy sequence stopped on the schema retry described above.
Native acceptance still requires three healthy iterations and both isolated
fault runs under one verified trial configuration. Source and deterministic
checks do not establish that complete lifecycle or resolve the earlier unknown
invocation's accounting.

Keep task-owned detailed evidence until the packet's verified export and cleanup.
Do not infer full factory, Codex parity, or product release acceptance from this
implementation checkpoint.

## Stopped-container resource inventory

Read-only Docker inspection on 2026-09-08 confirmed both existing Habitat
reference and proxy containers exited with PID zero. Their configured memory,
swap, CPU quota and period fields were zero, and PID limits were null. These
are unspecified limits, not zero memory consumption or enforced no-swap policy.
The Docker engine reports systemd cgroups v2 and 4107522048 bytes of total Linux
memory. Both root filesystems remain read-only. No environment or credential
values were read or exported; no container, account, trial or ledger changed.

This is configuration evidence only. It neither measures live peaks nor sizes
WSL overhead. The current native-host source additionally allows 1 GiB for each
invocation host and role worker. A smaller live admission threshold therefore
needs a versioned complete resource profile, bounded reference/proxy phases and
an outside stop owner for sequencer death/OOM. No live threshold was reduced.
The existing 6 GiB gate and the launcher's missing explicit budget argument remain
unresolved until that profile is implemented and verified. V4 still has zero
model calls; compatible resource preparation can continue without trial bootstrap.

## Resumed continuation and zero-swap source review, 2026-09-10

The owner lifted the temporary audit pause and prioritized the existing agent
loop. No Habitat runtime or model invocation has started in this continuation.
The current memory-budget, helper-containment and outside-cleanup blockers are
recorded in the packet. Resource experiment source preparation is in progress.

The native host and worker retain their 1 GiB memory, two-CPU and 128-PID limits.
Their create command now sets `--memory-swap 1g`; inspection rejects any other
`MemorySwap` value. Docker defines this value as memory plus swap, so equality
with the memory limit disables swap. The receipt and focused tests include it.
Independent source review found no issues. Habitat tests remain unrun.

| Source | Before SHA-256 | Reviewed SHA-256 |
| --- | --- | --- |
| `tools/hoh/native_host.py` | `4babaf434c03d477984c9db756e22854484611b47c77ce90d992ba8d4f71c071` | `59949947a7c6f897f1dbd5baf50c4e148059231216762df224a0bd9fbda2ba05` |
| `tools/tests/test_hoh_native_host.py` | `3684898809c9bf64acd704c3f70ea91b7df03cdd58a6f87a8a0a46585e4b21ee` | `fcb372b2af40d66e97d8e28a0d45c99337f0e77bb944ef049da354dfe6756e34` |

Exact preimages remain in the preserved checkout under
`.tmp/vivary-continuation/20a-native-resource/preimages`. The old V4 freeze and
Habitat source have not been changed. The prepared V4 ledger still records zero
launches, with 51,268 known reported tokens and one unknown invocation retained
in history. That statement comes from the retained prepared readback; it does
not replace live preflight reconciliation before a later launch.

## Source isolation and first container exercise, 2026-09-10

Fresh Native10 source admission exposed a shared dependency: the 06e owner
closure still binds the original canonical native-host bytes. Preserve that
accepted closure. The reviewed zero-swap source and its tests are now isolated
under the preserved checkout's
`.tmp/vivary-continuation/20a-native-resource/candidate/`. Their reviewed hashes
are unchanged; exact canonical preimages were restored. The resource exercise
must stage that candidate over a small isolated source snapshot. It must not
update the existing Habitat source or frozen V4 inputs.

The first no-model exercise is narrowed to the new invocation host and worker.
Keep the existing reference and proxy stopped and unchanged. Their allowances
remain reserved in the conservative 4,224 MiB budget, but this exercise cannot
accept their sizing or lifecycle. Docker ignores a zero memory-swap setting;
the proposed helper update does not establish an exact configuration rollback.
See [Docker's resource documentation](https://docs.docker.com/engine/containers/resource_constraints/#--memory-swap-details).

Prove the owned pair's caps, controller-death and worker-OOM cleanup first.
Runtime acceptance of the complete live profile, helper lifecycle, Windows
observer integration and native-model bootstrap remains open. All existing attempt,
deadline, reserve and 6 GiB admission limits remain unchanged.

## Reviewed container drivers, 2026-09-10

Independent source review accepted the isolated no-model host/worker exercise.
The preserved `20a-native-resource/driver-review.json` has SHA-256
`4c9bfe34428993733a29c82122a7e5e9441c428456ad44b05bf3cfae75885d25`.
It binds the final resource profile, Linux owner and Windows dispatcher. Seven
inert Windows tests passed. Review corrected CPU/PID verification, shared
observation deadlines, cleanup reservation, continued cleanup after a failure,
and acceptance identity across cumulative requests.

No container exercise or model invocation ran. Zero requests have been consumed.
The full reference/proxy lifecycle and native bootstrap remain open. The exact
existing canonical native-host bytes and V4 inputs remain unchanged; the new
candidate is isolated. The current packet's progress section owns the next step.

## Reviewed V4 helper owner, 2026-09-10

The preserved `.tmp/vivary-continuation/20a-v4-helper-lifecycle-candidate/`
core and no-model lifecycle driver passed independent source review. All 25
core and 15 driver inert checks passed. Exact custody includes the native audit,
full helper configuration and every attempt/profile/custody journal identity.
Only a durable owned start grants stop authority. Failed cleanup invokes
serialized fallback; a missing journal grants no stop authority.

Normal success waits for the owner unit to become inactive. Primary cleanup
has at most three seconds; fallback receives only the remainder of the same
five-second absolute expiry. Command timeouts normalize to a bounded timeout
result. Expiry records unsettled and blocks success. Five seconds cannot
guarantee that primary cleanup and fallback both finish.

Jeff answered **Authorize the exact helper change** on 2026-09-10: reference
512 MiB and proxy 256 MiB, memory-swap equal to each memory cap, bounded use and
both left stopped with caps retained. Source acceptance is separate from that
authority. Profile and custody runtime-promotion flags remain blocked.

The original no-model host/worker exercise has zero of two requests used and a
1,200-second cumulative budget. It must pass first, while helpers still match
its stopped uncapped preimage. The helper lifecycle phase then has at most two
requests and 1,200 cumulative seconds, with 240 seconds of work and five seconds
of cleanup per live case. Both phases require fresh 6 GiB warm physical memory,
5,760 MiB commit headroom, 10 GiB disk and the existing 1,536 MiB host reserve.
The helper review binds this packet and requires a separately reviewed pair
acceptance before dispatch. No phase has executed.

The lifecycle cases cover partial cap failure, primary abort, exact outer
Windows controller loss, heartbeat cleanup, serialized fallback and durable
journal export. Cap faults cannot be replayed after persistent convergence;
request two may reuse only exact accepted first-request fault coverage. The
no-unowned-stop case remains inert-only because deliberately losing ownership
of a shared running helper is unsafe. A passing lifecycle result retains this
declared limitation and cannot accept the complete planner/developer/QA cycle.
