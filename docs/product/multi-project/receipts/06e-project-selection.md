# 06e project selection receipt

Evidence-record: 06e
Date: 2026-09-11
Verification-kind: runtime
Result: In progress. Native10, exact current-product Zo build04, Doctor01, and all three focused Zo tests are accepted. C5 browser acceptance and production action mounting remain open. Zo supersedes historical Habitat application. Production authentication remains separate.

The [owning packet](../packets/06e-project-selection.md) and
[catalog contract](../contracts/project-catalog.md) define acceptance. The 05a
shell and 06d registration evidence remain separately frozen and verified.

The workbench contains the shared authority and catalog/selection source.
This receipt records the remaining verification and runtime-integration gaps.
It does not establish configured model runtime or production authentication.

## Activity execution checkpoint, 2026-09-11

The existing `.tmp/06e/zo-test/activity` evidence records return 0, no failure or
refusal, 36.535973837999336 seconds, empty stderr, natural worker exit and owned
cleanup. The result records no TERM/KILL, no remaining PIDs, and retained work.
Peak aggregate RSS including the controller was 873426944 bytes, with 28 tasks,
six processes and a 0.282101301-second maximum observer gap. These observations
remain below the focused-test stop thresholds; they are not cgroup sublimits.

| Retained input or result | SHA-256 |
| --- | --- |
| Activity result | `be25e4b73d7ec2447252282cefa0d2cab031dcd4f1612090ba96099c97d4ec7e` |
| Activity stdout | `2859950e6e29f25e10543d6241e75a52f109852209842e13fbe0dd81f4b60ac5` |
| Profile | `52ecdbeb3fe187bba2e1c4506090e85b1b5b013ae92a1971297efcd34063f4b2` |
| Source freeze | `271084d21fb182f4a5b10234c94cd9b313e6169dc7290fd6663cd02f93429701` |
| Ledger after activity | `d8d534121625e34a119b39c8a12fe163d84caa11fed87758bb76f87b1f18340b` |
| Activity acceptance | `ad143ae38518e602ddd11a514763c852fec074cd0aa3da4151e70f9a0493dcfe` |

The ledger after activity has one finished entry charged
36.535973837999336 of 300 seconds. Its hash remains unchanged. QA and Verify
independently accepted the retained evidence on September 11 in America/Denver
and September 12 UTC. They did not rerun activity.

The accepted witness contains eight cases, 43 refusals, four reads, three injected
state changes, and 22 snapshots. Their union covers 26 tables, including all 13
required tables. Forty refusal cases left state unchanged. Each intentional
change affected one table. The runtime test checked full raw-row hashes. The
emitted summaries do not retain enough data for an independent reconstruction.
Reviewers independently reproduced the code-only refusal response hashes.

Stdout retains 41 identical legacy warnings about the missing user table. It also
contains one ephemeral development-secret warning and the expected
unauthenticated 401 log. This fixture does not prove production email
verification or authentication.

Verify passed 111 named bindings and all 80 original build inputs. Root's fresh
preparation check returned operation `check`, status `ok`, and exit 0. That
check reuses the recorded dependency tree while checking named files. It does not
rescan the full dependency tree. The runtime boundary computes the full tree
before execution. Natural exit, cleanup, and resource observations remain as
recorded above.

All three focused attempts are accepted in the [focused-test checkpoint](#focused-zo-tests-accepted-2026-09-11).
Do not rerun preparation or any focused attempt, reset accounting, or change the
accepted 05b snapshot. Production mounting, authentication, and parent outcome
gates remain open. The following sections preserve historical evidence and
proposals. Use this checkpoint and the packet's Current progress for the active
next step.

## Focused Zo tests accepted, 2026-09-11

Root accepted the activity, component, and missing-key mutant after independent
QA and Verify review. Each command returned 0, exited naturally, and required no
cleanup intervention. The three attempts consumed 107.12825294700451 of 300
seconds. Their names are consumed. Do not run another focused attempt.

| Retained result | SHA-256 |
| --- | --- |
| Activity acceptance | `ad143ae38518e602ddd11a514763c852fec074cd0aa3da4151e70f9a0493dcfe` |
| Component acceptance | `40eab8dd7c068e8c26ffc7b74577cf3231a65f4af5e19d2a88f7017426c67830` |
| Component result | `9537db6e07162021c5d60c5e269faef3339a9706e3d92be8509ef2dff08041c5` |
| Component stdout | `8d6bd626d953e5bf70c8c30f7b66fd0e124c220b8678bd9bb5bb6bf7bc7d1155` |
| Component boundary | `2a9e34fee6677d1c0cfb3799738fae2dbfdf14b51764da78430db00380a44ea8` |
| Ledger after component | `24ab346df95018c354d8dd4020612e05df1ffa2e8a7b93bc2dc8c32c0bd0399c` |
| Mutant acceptance | `f209a9b5590f09ddbfbf83d918f1c483a3280f7c7430b2b5a984c9239cddc0a0` |
| Mutant result | `3bb73cd1849e2e5f4f6e748373569dafbc871c5fc5b685df9f2b8f114a7eb2ff` |
| Mutant stdout | `9e98b1c4169fb722e30018af2333564ad9cca0180800667e88fd54cee9e865f3` |
| Mutant boundary | `03bdae732fc409856d11e75646adf31ce54726108799d899a12d0838aa8b2373` |
| Final focused-test ledger | `4b77b2bce264fa3a383046917e61396601e21719154fdbc5f275cfa7544d51ab` |
| Earlier archive provenance | `6fcdaa99e7a501ac3743db0e7be67bf28563b24cab98db1ac6e73aa4731f255a` |
| Final accepted evidence archive | `98ed2ae90177a43d4b282b297689a99ec6c043d6bf21791157e8d5b5fe9de082` |

The component run passed seven cases and matched all 1,419 physical bundle input
hashes. It cleaned up 167 channels and 334 ports. Its 125 samples recorded a
maximum aggregate RSS of 864837632 bytes, 30 tasks, seven processes, and a
0.281509255-second maximum observer gap. All six saved PID and start-time pairs
were absent after exit. Output totaled 327775 bytes. Stdout retains one
`NO_I18NEXT_INSTANCE` warning and the React DevTools advisory.

The component fixture uses simulated hooks and selection writes. It does not
measure HTTP or model calls, exercise real Native no-write snapshots, or prove
browser behavior or production authentication.

The mutant wrapper passed by observing the exact expected remount assertion
failure. Its 130 samples recorded a maximum aggregate RSS of 1006276608 bytes,
37 tasks, eight processes, and a 0.28750897-second maximum observer gap. It
cleaned up 1,337 channels and 2,674 ports. Output totaled 328500 bytes.

The final archive is `.tmp/06e/focused-evidence-accepted-r2.zip`. It is 226369
bytes and contains 31 evidence files with 1014859 source bytes plus its manifest.
Independent Verify passed CRC, safe-member, retained-byte, acceptance-binding,
member-rehash, and both historical-ledger checks. The earlier archive remains
retained as provenance. The original evidence also remains retained.

Next, freeze and review the separate C5 browser fixture and resource profile.
Its fixture design must preserve the exact Native selection-write contract.
Browser execution, production mounting, authentication, and the parent outcome
remain open.

## Selection races and inactive conversation

The selected project now cancels a pending selection read before publishing a
new choice. Selection saves serialize so a delayed earlier save cannot replace
the latest choice. Invalid or revoked selections clear the local cache without
sending a null write that could race with the next choice.

The lead accepted a focused component proof against the actual reviewed source:
five cases passed using ReactDOM, React effects, React Query and LinkeDOM.
They cover a delayed GET, overlapping PUTs, invalid selection, authorization
revocation and both inactive conversation layouts. The final run completed in
about 1.1 seconds, used 113,332 KiB peak Node RSS, and exited zero without a timeout
or process-tree kill. Stderr was empty. The fixture cleared its React roots, QueryClients, queries,
mutations and held mock operations. It restored DOM globals and stopped
the esbuild service. Remaining pre-exit handles were library MessagePorts
and stdio sockets. The process exited after flushing its evidence.

One earlier assertion expected the cleared cache to remain null. React Query
may remove an inactive entry, so the corrected check accepts null or absent and
still requires no active project, catalog or null save. The recovered failure
and final evidence are retained. Archive SHA-256 `e8feed7a333f0d6e87923163859d09a367881164f66581a8099e6f16f47fb807`,
16,956 bytes. Payload readback and ZIP integrity checks passed.

Native hooks, context persistence and the toolkit surface were controlled mocks.
This is component evidence, not browser, Native hydration, connected-runtime or
production authentication evidence. The current Conversation intentionally shows
runtime unavailable and never mounts Native chat or modifies saved chat context.
Installed Core 0.176.5 has no inspected public status-bearing context hydration
or history-only context scope seam. Supported ejection listings did not expose
the protected Core context store. No dependency internals were patched.

06e remains open for final build/typecheck, real transport and desktop/mobile
browser checks when resource headroom permits, and a supported project-bound
conversation integration after the runtime contract is established.

## 2026-09-08 final build gate

The final application build remains unaccepted. Four stopped attempts used the
existing Habitat checkout, Core 0.176.5, Node 22.23.2 and SQLite 12.11.1. No model,
account, credential, dependency-install or dev/proxy-container operation occurred.
Each archive below is under the preserved source's `.tmp/hoh-proof/` directory.

| Attempt | Observed result | Verified archive SHA-256 |
| --- | --- | --- |
| `06e-build-failed-01` | Doctor found 18 fixture-only environment annotations. 6.329s, 321220608-byte peak. No OOM. No later command ran. | `2ac5df099099b599b28181f4339f3f534e51898a9f1df5cd9565090aca7e75c4` |
| `06e-build-failed-02` | Doctor passed. Typegen refused writes to Vite's config cache on the read-only dependency mount. 7.587s. 321114112-byte peak. No OOM. | `dcf9862fc9f737cb5643d12582abe1be0479afd0483bbd588ffd02277d7659ed` |
| `06e-build-failed-03` | Doctor/typegen passed. Typecheck found two enum-exhaustiveness errors in Conversation. 15.271s. 735518720-byte peak. No OOM. | `d23b168c0fab3d95a549b9dbe9956ea83e76ca8e3836501e5167e0fb8cb828e5` |
| `06e-build-failed-04` | Entered build, reached its persisted 180.014s deadline, then lost the final in-process export. Exact termination cause is unproved. Cold inspection captured partial artifacts and unchanged 65 inputs. | `43dadcb32186dbf2ada609af61c300a25d8e3d0fd0ecee37f5be62203acbc902` |

Attempt 01's actual peak is 321220608 bytes, with no OOM. All four archives were
byte-verified before duplicate cleanup. The first three attempts confirmed owned
process absence and removed their stages normally. Attempt 04 initially retained
its stage because no result survived. External postmortem then verified the exact
service/cgroup and matching processes absent, exported every non-binary staged
file plus the Node binary hash, and removed all 19 verified owned entries. Its
142 artifact entries are partial/prior, not fresh-build or browser evidence.
Older kernel OOM entries precede this attempt and do not establish its cause.

The 18 independently reviewed exceptions are per-line fixture comments in five
test files. Both esbuild assignments retain credential-read annotations and add
mutation annotations. The dependency tree remains read-only. Only a disposable
stage cache is bound over the verified real `.vite-temp` directory. Runtime
checks proved its inode identity and writable state. Two unreachable default
arms now exhaust `result.code`, the schema-derived enum, instead of the object.
Independent source review accepted that correction without casts or UI changes.

These runs use 1024 MiB aggregate Linux memory, zero swap, one CPU, 512 MiB Node
heaps and a 512 MiB Windows controller allowance, with 1536 MiB host reserve.
Capture is 1 MiB combined across the entire job. Preflight holds at insufficient
headroom were honored. Production configuration diagnostics still identify
missing deployment auth/database settings. No live settings were supplied.

Next: persist bounded phase start/stop/output checkpoints and final failure
evidence before postflight. Retain systemd exit diagnosis before collection.
Review the build deadline using these observations, then rerun within a fresh
resource gate. Browser verification requires a successful fresh artifact
manifest and stays inert until that evidence exists. Private 04c preparation
proof can proceed independently once its final fixture revision is accepted.

## Checkpointed build clock failure

Attempt 05 passed doctor, route generation and typecheck on the current source.
During build, the legacy persisted deadline observed a 274912864 ns wall-clock
backstep and stopped the process. The 45.258-second attempt exported complete
phase output, final postflight and cleanup. All 68 dependencies were unchanged. All owned groups, the service and cgroup were absent, and all 42 stage entries
were removed. The new checkpoint and external cleanup paths worked as intended.

The cgroup reached its 1073741824-byte limit and recorded 588 max-pressure events,
with all OOM counters zero. The clock failure is established. Memory pressure
remains a separate observation for the next build. The 142 partial/prior artifacts
are not a successful build. Independent review verified the 104-entry,
409067-byte archive, SHA-256
`bb648c9d304022a36e61b93d7de0b8d0ca016fa63e2d1413fa27296bfbe5f35c`.

The next build driver selects the existing `linux-boottime-capped-wall-v1`
deadline owner through a versioned build-only policy for each phase. BOOTTIME
counts suspension. Wall-clock rollback cannot extend its capped expiry, and a
forward correction can shorten it. Phase durations, five-second cleanup grace,
memory, CPU, capture and host-reserve limits are unchanged. No runtime default,
model trial or usage ledger changes. Independent review accepted the delta. Three existing clock-policy regressions passed after a sandbox temporary-lock
denial was retried with the required filesystem permission. The three empty
failed-test directories were verified and removed.

Fresh build dispatch also waits for a focused selection regression: browser
review identified that a saved-selection GET begun during an awaited PUT may
arrive after the new selection is published. The earlier five component cases
do not prove that ordering. Its focused fixture and correction are in progress.
The inert browser runner is addressing independent launch, CPU accounting,
freshness, timeout ownership and final-capture findings before execution.

## GET started during selection save

A real React/Query regression reproduced a delayed Alpha read replacing Beta
after the Beta save completed. The minimal correction cancels the exact scoped
selection query again after the queued write, then rechecks the current attempt
before publishing cache state. The reviewed source is SHA-256
`2637062bf9be917747cd47806fef419b535451fb6a7cc5872f31c05ac48209ca`
in both the canonical worktree and Habitat.

Three green cases cover that ordering, overlapping serialized writes with the
latest choice winning, and authorization denial clearing local selection with
no durable null write. The Windows Job exited naturally in 0.923 seconds with
zero remaining processes and 165773312 bytes peak aggregate commit. Stderr was
empty. All source/log hashes, exact case labels and owned cleanup passed
independent review. The outer parser initially retained the older single-case
label. Its correction validated the existing immutable three-case evidence
without rerunning or rewriting raw logs. Native hooks are mocked here.

Red and green proof, physical bundle-input hashes and supervisors are retained
in one 39760-byte, 28-entry archive, SHA-256
`4ac3241c7f4be7ee18233045c56f3da0e9671649e8f6a5c6a1cee39cb8b93ec0`.
Verified duplicate evidence directories were removed. This is component proof,
not the pending Native transport/browser acceptance.

## Memory experiment after build attempt 06

The BOOTTIME build attempt 06 was killed by its actual 1 GiB cgroup. Systemd
reported `Result=oom-kill`, signal 9 and 1073745920 bytes peak. No final in-process
result survived. Cold inspection confirmed all 68 declared source inputs and
the source inventory unchanged, no matching owned process, and service/cgroup
absence. All 35 staged entries were exported, verified and removed. 142
partial/prior artifacts remain unaccepted. Archive SHA-256
`0f3f4d459f32472c9f21f728f5ceb9bc7b6394e982d63723a34c5b4dfd40ede6`
contains 134 entries in 434834 bytes. The original cold record conservatively
says unresolved. The independently checked systemd record establishes OOM.

Reviewed policy `06e-build-memory-v2` makes the build's aggregate Linux memory
configurable in its frozen manifest. Trial 07 selects 1280 MiB. Node stays at
512 MiB, Windows transfer allowance at 512 MiB, and host reserve at 1536 MiB.
One CPU, zero swap, 64 tasks and the existing BOOTTIME deadlines remain.
Admission needs 3328 MiB available and is bound to the same manifest bytes as
the service limit. Five cleanup fault scenarios still pass. These are build
experiments, not product runtime defaults or permanent limits.

Trial 07 dispatched with 3.61 GiB free against its 3.25 GiB gate. Its acceptance
requires a fresh complete result and cleanup. The browser proof independently
passed static review, including exact archive-bound build provenance, Windows
CPU affinity, stale-read ordering, timeout ownership and final capture limits.
Browser execution still requires the successful build. Static review grants no
browser, connected-runtime or production authentication claim.

## Build trials 07 through 11

Each failed attempt has one verified evidence archive. The owned service,
cgroup and staged source copies were removed after evidence export. Generated
partial build artifacts remain unaccepted.

| Attempt | Observed result | Archive SHA-256 |
| --- | --- | --- |
| 07 | 1280 MiB cgroup OOM. Kernel peak 1342414848 bytes. | `3514d3906ab290fe9ba7501abd17611b100b6ea2ad91c9e2e19087ffb8c1daca` |
| 08 | One Rolldown worker with the same 1280 MiB cap still hit OOM. | `3cb583a9fd5666b7bf52fa4087858b4e18d4d5b3f0507fdd1b3d2942c8d9319b` |
| 09 | Client build completed. SSR transformed 9755 modules before the 1792 MiB cgroup OOM. Kernel peak 1879048192 bytes. | `d76b76167644e52a9d4ef4135b4142c55e9dc9bcb734bc64238637b1e70ea98f` |
| 10 | TypeScript's native Go executable failed to create another OS thread, reporting 52 existing threads and errno 11 under the 64-task group limit. No OOM events. Peak 466161664 bytes. | `69898ab31ca8b387a4e63178b494c32b416ce9a9bb292c033d0e51e1f6d634fc` |

Attempt 09's sampled process evidence located most resident memory in the
bundler child. Samples ended before final OOM. Kernel peak and systemd own the
final limit result. Attempt 10 failed before bundling and completed its full
postflight, including unchanged source and dependency hashes. Its exact PID
peak was not measured. The reported thread error supports task pressure as
the cause. It does not prove a measured peak of 64.

Reviewed trial `06e-build-resources-trial11` keeps 2048 MiB aggregate Linux,
512 MiB Node heap, 512 MiB Windows allowance, one CPU, zero swap, 64 tasks,
and 1536 MiB reserve. It adds the installed TypeScript 7.0.2 public
`--singleThreaded` option through Core's existing argument forwarding seam.
Policy `06e-typescript-serial-v1` changes parse/check/emit scheduling. It is
not an OS-thread guarantee. The reviewed Rolldown one-worker setting remains.
Doctor, typegen and typecheck must pass before bundling begins. Native runtime,
model, context and response defaults are unchanged.

Trial 11 has not launched. Fresh admission on 2026-09-08 at 16:57 UTC reported
3.71 GiB available, below its 4 GiB requirement. No attempt record or build
service was created. A later launch must rerun admission against the same
frozen source bytes. The source freeze SHA-256 is
`6a4e18eb1ee17623425e01789a6eb14d33f3d7ce4e9bc82a4907d8112a10ef36`.
The read-only observer run after an earlier refused admission saw the exact
group absent in all eight samples. It is not trial 11 runtime evidence.

The reviewed browser proof still awaits a successful build, final attempt
record, verified evidence archive and matching handoff. Runtime-start packet
04d remains staged separately. Packet 20f is ready for its bounded no-model
resource experiment. It does not change live v4 admission.

## Build trials 11 and 12

Both archives passed a fresh SHA-256 check. Trial 11 archive SHA-256 is
`1d322d5e9d5291903571c430ae8fa08947637ed8fcce211719687ae76d045561`.
Trial 12 archive SHA-256 is
`66ed2dadedf62561978ebe097f56c2ba5ea72bcd24e6fd343dcb82b7d5ad028b`.
Both used the same bounded Habitat job and left no retained stage entries,
service, or cgroup.

Trial 11 admitted at 6.47 GiB free RAM and reached `build`. Its source freeze
was `6a4e18eb1ee17623425e01789a6eb14d33f3d7ce4e9bc82a4907d8112a10ef36`.
The build process exited 1 before its deadline. Nitro attempted to write
`packages/workbench/node_modules/.nitro/types/nitro-routes.d.ts` in the private Habitat checkout.
The read-only dependency mount rejected that write with `EROFS`. The archived
cleanup removed the Vite cache and all task-owned stage paths. This result
does not show an application build failure.

Trial 12 corrected that task-only filesystem boundary. It bind-mounted the
existing real `node_modules/.nitro` directory over the task-owned
`tmp/nitro-cache` directory, alongside the existing Vite cache mount. The
archive records cleanup of `last-build.json` and four generated Nitro type
files under that exact temporary directory. The job left no retained entries.
Nitro generated the public output, built the server, and reported `Build
complete.` The supervised build process returned 0 without a timeout. The
enclosing job still returned 1 because its process owner observed an orphaned
descendant before cleanup. The owner then removed it and verified the process
group, service, and cgroup absent. Its accepted predicate requires a zero
return code, no timeout, and no observed orphaned descendants. The output
therefore remains `partial-or-prior` and is not browser evidence or a
successful artifact manifest.

The archived build stderr reports that `BETTER_AUTH_SECRET` is absent and that
neither `DATABASE_URL` nor `NETLIFY_DATABASE_URL` names a persistent database.
Those are Native production-readiness diagnostics. Trial 12 proves they did
not make the build command fail because its process returned 0. They remain
deployment configuration work and do not justify injecting credentials, a
database URL, or a local fixture value into this build envelope. The next build
trial must instead inspect and resolve the observed descendant lifecycle while
keeping the existing no-orphan acceptance gate.

The packet separately authorizes a synthetic Native identity in a disposable
local fixture database for the test-owned browser fixture. That proof may be
recorded separately when its existing fixture runner is available. It does not
count as production authentication, a production build, or the fresh artifact
manifest required before packet browser acceptance. Packet 06e remains
in progress.

## Accepted build trial 13

Trial 13 accepted the existing serial Habitat build gate. The reviewed archive
is 110 entries and 445,790 bytes, SHA-256
`4a4d2fb91d6e6f378f50fff82d0f709e07b864d0ccabb3177be5c4957bf1a66d`.
ZIP integrity passed, and all 109 payload hashes in `manifest.json` matched
their archive bytes with no missing or extra entries. `build-handoff.json`
binds that archive to attempt
`06e-28e57d2c3e344628a036adb61a25f25d`, result SHA-256
`fbe45d5cc162b2da70b0b25862201930a051c7f8e2ae32ff87037829aa1d2dd6`,
the frozen source SHA-256
`a6a0a18d2d61d5358db6d9263a43c1f4d412efe2bfc433b95c551fa64ce9d144`,
and fresh artifact-manifest SHA-256
`2845721b0503ea05d91aa1a758fc9921b4b7ba907914a75fb5517e4ecbd2f7b5`.

Version, SQLite, doctor, React Router typegen, public typecheck, and the full
build each returned zero. Their checkpoint supervisor records are accepted,
timed out false, late output false, orphaned descendants false, and cleanup
confirmed. The full build returned zero under its 300-second BOOTTIME limit. The complete job took 107.063 seconds. Postflight confirms unchanged frozen
dependencies, no added or missing source inventory, an absent process group,
and no remaining task case entries. The accepted 20g supervisor source digest
is `db4e77bf86bab62f6c548520673e78772babf17e8b6fc6b021edf16f634c3562`.
This resolves the present build result. It does not identify Trial 12's former
unclassified child state after the fact.

The fresh candidate manifest has 228 files totaling 15,476,817 bytes and
includes both `build/server/index.js` and `.output/server/index.mjs`. It is a
fresh build artifact for the pending browser gate, not browser acceptance.
The job used a 2,048 MiB Linux cgroup, one CPU, zero swap, 64 tasks, a 512 MiB
Node heap, and a separate 512 MiB Windows-parent allowance. Admission recorded
4.74 GiB free RAM and 187.47 GiB free disk before launch, retaining the
1,536 MiB host reserve. The cgroup recorded a 2,147,483,648-byte peak and 692
`max` events, with every OOM counter zero. Maximum child RSS was 1,733,508 KiB.
Only loopback was available. Captured command output remained below the
1 MiB job limit. The Vite and real Nitro directories were bound to task-owned
caches. Cleanup removed those caches, `last-build.json`, four generated Nitro
type files, and all other owned entries. The stage, service, and cgroup are
absent with no cleanup errors or retained entries.

The archive builder re-verified only the preserved, hash-verified pure archive
validator from `browser-v2/source-before-adaptation.zip` (SHA-256
`67dbe4ded157270f903f8ce3bf3d46386506157787504f82b85efcfa50f8451f`).
It did not execute the browser launcher or incorporate browser source files
under separate edits. Browser flows, real production transport and
authentication, project-conversation runtime integration, and parent 06 remain
open. Packet 06e remains in progress.

## Browser trial 14

verified: 2026-09-09

Run `3a81eebff21d` passed all 14 browser observations against the accepted trial13
build. The lead and independent Astra reviewer inspected all four screenshots.
Independent review accepted the browser gate after checking all archive payloads,
22 exported Linux files, three complete 19-table snapshot hashes and the recorded
request orderings. The private archive is `.tmp/hoh-proof/06e-browser/reviewed-evidence.zip`
under the preserved source checkout. Its 59 entries total 571,465 compressed
bytes, SHA-256
`d4b4113ba4ab0c6dec01c8e85a59b8918f3aefcd0caf3e4015006eb5e0255cc3`.
ZIP integrity and all 58 payload hashes passed readback. The browser source
manifest SHA-256 is
`affa44574bb79f735d02bbb2393e8acc516f5e03cdc01a0250429c1faa177895`.
The archive retains the exact controller, backend, process owners, source review,
request ledger, database/root snapshots, screenshots and remote-stage export.

The browser used Windows Chromium and the real built React Router renderer,
Native HTTP actions, application state and SQLite in a bounded Habitat service.
Two configured physical folders became distinct projects. Checks covered
uncertain registration replay, duplicate registration, saved selection across
workbench/full-chat reloads, both stale-read orderings, foreign saved scope,
catalog revalidation, mobile disclosure, revoked access, replaced roots and
closed custody. The GET-during-PUT case delivered the captured old Beta body
after Alpha's save completed and verified that Alpha remained selected.

Role and membership recovery each advanced only browser wall time by 61 seconds
before one explicit refresh. Installed Native Core caches a denied URL for
60 seconds and has no supported public reset. These checks prove recovery after
that cooldown, not immediate recovery. The role case retained the draft, exact
operation ID and immutable request for replay. The permission clocks and real
HTTP responses are retained. Native dependencies were not patched.

All 85 completed requests have matching start records. There were no page or
transport errors. The 20 console errors are matched to specific expected denied,
unavailable auxiliary, or deliberately unusable registration responses. The
synthetic composition leaves Native ping, localization action and WebMCP
unavailable. It has no login flow, credentials, configured model, live scoped
chat or development container. The signed-out screenshot shows the fixture gate.
The desktop and mobile screenshots show distinct selected labels and an inert
runtime-unavailable conversation. They do not prove Native chat history isolation
or a supported project-bound conversation. Done condition 4 remains open.

The Windows owner settled in 26.574 seconds. Peak aggregate commit was
496,676,864 bytes under its 1,024 MiB limit. Its 107 memory samples had a maximum
gap of 294 ms and a minimum available physical memory of 3,900,432,384 bytes,
above the 1,536 MiB reserve. The Linux terminal recorded 239,001,600 bytes peak
under its 512 MiB cgroup, zero swap, one CPU, 64 tasks and no OOM events.
The controller drained its RPCs and renderer closures and exited zero. No Windows
helpers or forced members remained. The service and cgroup are absent, the
verified run stage and local binary/browser temporary files are gone, and the
existing development container stayed stopped. The remote export is 665,600
bytes, SHA-256
`85c7665c2bbb732b06b07ac1d4aa3280bb07273747385fd4f783573e611301d7`.

## Pending C5 activity identity amendment

On 2026-09-09, source inspection showed that Core's full chat component can
restore cached history before an authorized response and has no public cache
disable or authoritative restore-complete hook. The revised C5 contract uses
Native's existing stateless Run activity renderer. Its scope is selection
isolation through an exact verified Native thread and binding-digest scope.
Complete conversation history and production runtime composition remain open
under outcome 04. This does not claim Core's `isolateHistoryByScope` behavior.

The lead applied five independently source-reviewed candidate files to canonical
for freezing. They extend the existing 04b response only after final trusted
checks and key the renderer by scope, thread, reference and run. Exact preimages
are retained in `.tmp/hoh-proof/06e-scope/source-review.json` in the preserved
checkout. Habitat retains the previous activity source. Fresh Native, component,
missing-key mutant, build and both-route browser proof remain required. Earlier
accepted archives certify their original bytes, not this candidate.

## Handoff audit checkpoint, 2026-09-10

The earlier results in this receipt remain historical. Browser trial08 exposed
a refresh defect. The reviewed correction is canonical only. Packet 17a's
accepted application then changed three Native proof dependencies.

Native09 failed raw witness reconciliation after framework output interrupted
a JSON column-name field. Both Node phases returned zero, which does not accept
the failed witness. The service failure also triggered a forced console-helper
stop. All 32 recorded Windows PIDs are absent. Final activity found Habitat stopped.
The exact 85 archived duplicates were retired after independent review.

Private evidence in the preserved checkout remains under
`.tmp/hoh-proof/06e-scope/native-trial09/`. The 82-binding archive SHA is
`55d6acccedccc7cd9dc0e893e93bdcc17ba2b49dbdc3221d09f732c5791cbe6f`.
The failed review SHA is `b4d9a011325589c8107040172e15ce2727cce689c56eb57968737da2f1616654`.
The retirement SHA is `b24d39bd49224c42d8c841951f5811747b5bf4a57dbbe7337c803a13ed696f0a`.

The transport correction has source review and eleven passing inert tests.
Its source review SHA is `764b09f96bd45138a007e15f18b1840a7b54bff39b4244b4df1b742e67641c7c`.
It has not been applied to the active private inputs or executed in a fresh proof.
No refresh-03 generator or freeze exists. The next proof needs reviewed derivation,
fresh resource admission, zero forced helpers, complete reconciliation and cleanup.
Build, sandboxed browser, five-file Habitat application and broader parent gates remain open.

## Accepted Native10 and current build gate, 2026-09-10

Native10 accepted the refresh-03 transport correction. It completed in 28.5
seconds with eight worker cases, 43 refusals, four successful reads and three
injected state changes. Independent review verified the archive and raw result.
The Windows owner recorded zero forced members, zero active helpers and a
536 ms maximum observation gap. The stage, service and all recorded helper
identities were absent afterward. No model calls or Native chat/thread/run
writes occurred. Native09 remains failed historical evidence.

The preserved acceptance is
`.tmp/hoh-proof/06e-scope/native-trial10/lead-acceptance.json`, SHA-256
`594d44322ca252c3bc1beab46c7f3522998f26f9b7bfbfaa97d13a143222a853`.
The build generator was completed against that acceptance; its read-only check,
derivation and independent review passed for 70 dependencies and 72 source items.
The build freeze is `.tmp/hoh-proof/06e-build/reviewed-source.json`, SHA-256
`29f964d89424de387d228aaee523f0c9f9c85cb90112db04935245ad66ca97a7`.
Do not rederive this snapshot.

Build, sandboxed browser verification and five-file C5 application remain open.
The guarded build dispatcher is
`.tmp/vivary-continuation/run_06e_build_guarded.py`; its adjacent proof record
`.tmp/hoh-proof/06e-build/guarded-driver-review.json` binds the reviewed source. Run only after current
checkpoint verification and fresh resource admission. Its budget is one request
or 1,200 seconds from that request, including refusal, with no automatic retry.
Keep the 4 GiB warm gate, Linux 2,048 MiB cap, Windows 512 MiB Job and 1,536 MiB
reserve. The single guarded request was subsequently refused at warm admission.
Its budget is exhausted; see the dated refusal below. This packet and parent
outcome remain open. The existing 20a loop-first priority remains in force.

## Guarded build admission refusal, 2026-09-10

The single guarded request ran at 19:12 UTC. Cold available memory was
5,607,948,288 bytes; after Habitat activation the frozen preflight reported
3.94 GiB against the 4 GiB gate and exited 75. The build driver did not start:
there is no inner build-attempt record or build artifact. No model was called.

The exact service and cgroup were absent after settlement. The Windows owner
reported zero active helpers after forcing three owned console helpers to stop.
Its result is failed, not clean acceptance. The observer had no failure and its
largest gap was 286 ms. Preserve this failure and the unchanged source freeze.

Evidence in the preserved checkout is
`.tmp/hoh-proof/06e-build/guarded-build-attempt.json` and
`.tmp/hoh-proof/06e-build/guarded-host/windows-owner.json`; the adjacent
`build-launcher.stdout.log` records the warm refusal. One of one requests is used.
Do not retry or replace its marker. Review refusal cleanup before proposing any
separately bounded future attempt. Source work may continue independently.

## Expected-status settlement correction, 2026-09-10

Read-only analysis found that the accepted owner's `run` method immediately
forced Job members for every nonzero exit, even with `check=False`. The build
preflight refusal returned 75 and the absent-unit cleanup commands returned 5
and 1. The receipt cannot attribute each console helper to a particular command.

An isolated two-condition correction lets expected nonzero statuses use the
existing natural-settlement period and reserves its final half-second for force.
Unexpected failures, observer failure, timeout handling and forced-member
rejection remain intact. Six tests execute the real method with inert jobs and
virtual time: the base fails three; the candidate passes six. Independent review
accepted this source-only correction. No real Job, WSL or model ran in these tests.

The preserved candidate is
`.tmp/vivary-continuation/06e-expected-status-settlement/owner-candidate.py`;
`review.json` beside it binds the source and tests. The original controller and
guarded dispatcher are unchanged. Integration requires a reviewed driver/custody
update and fresh bounded runtime evidence. The old one-request budget remains
exhausted; do not alter its marker or claim runtime acceptance from these tests.

### Windows settlement integration accepted, 2026-09-10

[20h](../receipts/20h-expected-status-settlement.md) accepted the corrected Windows
owner on real parent/child cases for statuses 0, 75, 5 and 1, with independent QA,
zero forced members and every recorded PID absent. This closes the narrow Windows
settlement test. The original 06e request remains exhausted, its failed evidence
retained and its source freeze unchanged. The build still needs reviewed driver
custody integration and specific authority for another bounded build request.

### Corrected build adapter source accepted, 2026-09-10

The preserved `.tmp/vivary-continuation/06e-corrected-build-candidate/` now
composes the accepted guard with the Windows owner verified in 20h. Fourteen
source bindings and five inert composition checks passed independent review.
The adapter uses captured module bytes, a separate corrected-attempt marker and
host evidence directory, and a raw-byte warm admission check after Habitat starts.
The original failed marker, Native10 freeze, build launcher and build driver
remain unchanged.

Jeff subsequently answered **Authorize one corrected build request** on 2026-09-10. The authorized request
is one new admission and 1,200 cumulative seconds, including refusal, with the
existing 4 GiB physical/commit, 10 GiB disk, Linux/Windows caps and cleanup guards.
The proposal and command are in `PROPOSED_RUN.md` in the candidate directory.
`runtime-authority.json` records that exact answer against the accepted source-review hash.
The request later passed admission and failed during Node transfer verification, as recorded below. Its one-request authority is exhausted.
This does not authorize shared-helper mutation or renew any other budget.

### Corrected request failed during Node verification, 2026-09-10

The authorized corrected request ran at 22:16 UTC. Warm admission passed with
5,330,231,296 bytes available physical RAM and 13,669,498,880 commit headroom.
The launcher and Windows build driver started, but no Linux build phase began.
The transfer verification read the complete 124,836,408-byte Node executable
back while upload buffers remained allocated; Python's reader raised MemoryError
and the `cat` transfer check returned 13. No Linux result was exported.

Independent review accepted the recorded Windows and named unit/cgroup cleanup:
zero force, zero helpers, all recorded PIDs absent and a 719 ms observer gap.
The Job limit remained configured at 536,870,912 bytes; its reported peak was
540,921,856 bytes, above the limit. Do not describe that peak as below the cap.
The driver retained its Linux stage because failure preceded its own service
settlement path. Stage cleanup remains a separate operation. The five persistent
source preimages, original failed marker and application freeze are unchanged.
The corrected one-request authority is now exhausted.

The isolated `06e-transfer-corrected-build` candidate releases the upload buffer
and checks remote Node size/SHA-256, retaining exact byte checks for small files.
It also rejects an observed Job commit peak above the configured limit.
All eight inert checks and 27 source/evidence bindings passed independent source
review. Its separate one-request/1,200-second proposal retains all resource
limits. Runtime authority remains unapproved; stage cleanup and fresh admission
are required. The preserved candidate's PROPOSED_RUN.md owns the exact proposal.

### Retained transfer-stage maintenance, 2026-09-10

The isolated `06e-retained-stage-cleanup` source passed independent review and
12 inert checks. Existing task scope authorizes inspection and exact cleanup of
the generated failed-proof stage. Each operation has a separate hash-bound
one-request/300-second record. The maintenance profile is 512 MiB Linux plus
512 MiB Windows, 1,536 MiB reserve and 2,560 MiB cold/warm physical and commit
admission. This does not change the build's larger resource gate.

Inspection must verify the exact eight files and 12 directories, frozen manifest,
accepted Node digest, file identity and process inactivity. It rejects links,
mount crossings, unknown content or inaccessible evidence. Apply is unavailable
until an independent reviewer accepts the exported inode/device/hash allowlist;
it then rechecks all facts and exact build unit/cgroup absence before removal.
No deletion or new build is authorized by source acceptance alone. The bounded
read-only inspection is the next action; the build proposal remains unapproved.

### Corrected maintenance namespace, 2026-09-10

The first read-only inspection refused its own ReadOnlyPaths mount and removed
no target content. Preserve that attempt. Independent review accepted the
corrected layout and 15 inert checks: inspection creates no target mount;
apply grants write access to the parent required to unlink the exact stage.
The fixed owner still rejects mounts at or below the stage and verifies the
exact files, identities, hashes and process inactivity. One corrected inspection
has a separate 300-second authority under existing task scope. Apply remains
dependent on independent acceptance of its exported allowlist. The new build
proposal is still unapproved, and source acceptance is not runtime acceptance.

### Retained stage removed, 2026-09-10

Automatic approval review initially rejected the exact deletion for lack of
explicit user authority. Jeff then answered **Approve exact stage deletion**
for `vivary-06e-build-proof` under the verified Habitat work root: its eight generated files and
12 directories, preserving retained Windows evidence. The corrected inspection
passed independent review. Apply rechecked the exact hashes, identities, mount
boundaries and process inactivity before removal. The bounded cleanup passed
and independently reviewed evidence confirms the stage is absent.

The cleanup receipt is `.tmp/hoh-proof/06e-retained-stage-cleanup/apply/cleanup.json`;
independent acceptance is the adjacent proof root's `cleanup-review.json`.
All 75 frozen application inputs still match. This removes the stage blocker,
not the new-build authority gate. The transfer-corrected build source remains
accepted with eight inert checks; its one-request/1,200-second proposal still
requires Jeff's answer and fresh 4 GiB warm admission. Both prior build requests
remain failed and exhausted. Build, browser and C5 application remain open.

### Transfer-corrected build request authorized, 2026-09-10

Jeff answered **Authorize one transfer-corrected build** after the accepted
stage cleanup and reviewed transfer fix. One new admission request is authorized,
with a 1,200-second cumulative limit including refusal. Keep 4 GiB warm physical
and commit admission, 10 GiB disk, 2 GiB Linux and 512 MiB Windows caps, one CPU,
existing task/output/observer limits and 1,536 MiB reserve. No model calls or
shared-helper changes are included. The request is unused; dispatch only when
fresh resource readings support it. Both earlier failed requests stay exhausted.

## Transfer adapter preflight failure, 2026-09-11

After cold RAM rose to about 5.8 GiB, the accepted transfer-corrected
adapter was invoked. It failed locally at the frozen launcher SHA binding,
before resource admission, request marker creation, Windows Owner construction
or WSL dispatch. No build started. The exclusive proof directory contains its
dispatch and source snapshots plus a lead-recorded preflight failure. Independent
execution-flow review is pending. Preserve these artifacts; do not remove the
directory or bypass the freeze check. A corrected composition needs source review
and a decision on the existing exact authority before another invocation.

## Unused admission and binding correction, 2026-09-11

Independent execution-flow review confirms the transfer adapter failed before
resource admission, marker creation, Windows Owner construction, WSL dispatch or
build execution. Its one approved build admission remains unused. The immutable
application freeze names the original launcher and driver, but the wrapper
replaced those expected bindings with corrected runtime paths and hashes.

The selected correction retains both original frozen source bindings and adds
separate corrected runtime bindings. Every freeze validation must check the
original fields and re-hash corrected runtime sources, including pre-admission,
pre-dispatch and post-build checks. The application freeze is unchanged. The
candidate uses a new exclusive proof directory and preserves the occupied prior
proof. Independent source review and a derived continuation record are required
before using the same one-admission, 1,200-second authority; no extra admission
or invented user answer is included. Build, browser and C5 gates remain open.
Independent preflight review: `1997d662936a44eaf85902633c9c00018579cecec779371841e05c91ddb446a2`.

## Build binding correction accepted, 2026-09-11

The build binding correction passed independent source review and 11 inert
checks. The tests run the composed guard to its admission boundary, reject
corrected-source drift, preserve all three freeze validation sites and exercise
the real source/authority loader with all 39 bindings. Both child programs use
the new sibling inputs and exclusive proof path.

The original application freeze, corrected transfer implementation, earlier
source review, user authority and preflight evidence remain unchanged. A derived
continuation record binds the accepted repair to the same unused one-admission,
1,200-second build authority. It adds no admission. Fresh 4 GiB warm physical and
commit headroom, existing Linux/Windows limits and cleanup gates still apply.
No build has run. Browser verification and five-file C5 application remain open.
Candidate manifest: `70ae9389296a6849d79937df43588e1e7232d82926d6e461439116d19b6cf2fc`.
Independent source acceptance: `1dd4621975ab5b4c76b772a0ccb50303202dfdcc32ee02757532ad0db95cc7df`.
Derived continuation authority: `2284ff29a29acbe1954ae8a826f17bed8279917aaacd8b60cff636a911feec98`.

## Zo current-byte reconciliation, 2026-09-11

The owner selected Zo for all current project work. Read-only reconciliation
matched all five C5 files to the 80-input build04 snapshot; all 212 build outputs
remain exact. Build04 returned 0 in 23.440384656998503 seconds with cleanup.
Its supervisor SHA-256 is
`cef0c60fc026b680961ee59ac1d98efe975790d4eaa984b309fd22ca88125e39`.
Doctor01 returned 0 with ten guards, Clean/no findings and cleanup.
The [05b accepted receipt](05b-deepseek-chat-titles.md#current-result) owns those
raw records. No fresh build or separate Habitat application remains necessary.

At that reconciliation, current focused C5 tests and the missing-key mutant
remained unproved. The component test pinned Windows x64 esbuild; the subsequent
portable mapping is accepted below. Its assertions remain intact, with no
canonical product change. The focused Zo profile and three-run acceptance are frozen in the
[packet](../packets/06e-project-selection.md#zo-c5-focused-test-contract-2026-09-11).
No 06e runtime had started at that preparation checkpoint. The activity run
recorded in the [activity checkpoint](#activity-execution-checkpoint-2026-09-11)
is subsequent evidence. The historical laptop ledger is unchanged.

The current route contract is also reconciled: `/` and `/workbench` mount the
read-only activity panel; accepted 05b owns the separate `/chat` surface.
The earlier both-conversation-routes claim is historical. C5's remaining browser
proof must exercise both Workbench aliases and preserve the Full chat boundary.
The component fullPage variant does not establish a mounted activity page.

## Focused Zo test preparation accepted, 2026-09-11

Independent source QA accepted the portable component test and four proof tools
after correcting all reported findings. Inert syntax, preparation, ledger/mount,
and malformed-mutant checks passed. Real preparation and readback then passed
against the installed dependencies. No application test had run at that source
preparation checkpoint; the [activity execution](#activity-execution-checkpoint-2026-09-11)
occurred afterward.

| Input | SHA-256 |
| --- | --- |
| Portable component test | `4bd477ea9fa90722215edacbbb72844f1a4ba4d80964af2dd873f79c0d24b4c4` |
| Supervisor | `ca62a328dee8a37e9ac05d380fac28a23791b12774d72179bbfd7f32d78eb8d6` |
| Preparer | `d16a13d6d598085e0ccf60ed622ad46339d6240fb3e3a977ed038594ab6cb8ed` |
| Boundary attestation | `89eac21b0c9966c01a034704e5f773dca3305d46afaa557c757d2235d8a84bcf` |
| Missing-key validator | `06e60372e5bdc5177dccfc3b827d131b257c979e91167f5f7c469c284fe50e8b` |
| Real source freeze | `271084d21fb182f4a5b10234c94cd9b313e6169dc7290fd6663cd02f93429701` |
| Component dependency manifest | `16f4119888df69024271e5cd7870c0418dcc45f305d3b3efc5bd2c72163791d0` |
| Staged missing-key Conversation | `4254ba928150d08910aba2f19c8f057afa8f8f1320ff84b14e333ae3dd16be7e` |

The dependency tree contains 109,605 regular files, 3,408 internal links and
11,121 directories, totaling 1,047,716,004 file bytes. Its deterministic tree
digest is `1e107737d2c2ff8cae42ec6eeeb7f1d7f09ebd39e27c842b21e112821c92121c`.
The initial empty 06e ledger SHA-256 was
`37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570`.
Do not run preparation again: its namespace is exclusive. Fresh Verify checks
the existing freeze before runtime. The current component test intentionally
differs from the original `8165ff26...` snapshot test; production sources do not.

The controller records actual inner sandbox attestations, verifies the 80
original app inputs with exact named overrides and dependency bytes, and keeps
proof inputs read-only. It retains work until archive/readback, records all
cleanup interventions as failures, accounts for refusals, and includes the
supervisor in aggregate resource observations. The mutant validator accepts
only the exact remount failure with complete cleanup and outer test evidence.
