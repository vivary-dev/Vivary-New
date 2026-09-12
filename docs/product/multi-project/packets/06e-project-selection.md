---
type: packet
---
# 06e: Register and select authorized projects in the workbench
Parent: 06
Status: in-progress
Depends-on: [05a, 06d]
Owner: Root owns C5 acceptance and the Zo test plan. Implement owns the portable component fixture and bounded proof tools; QA and Verify independently review. Native10, Zo build04 and Doctor01 are accepted. Current focused tests, mutant and C5 browser acceptance remain open.
Scope: Native scoped project catalog, registration form, shared selection, and exact Native scope association for read-only Run activity. No model activation, arbitrary path registration, portable export grant, or project file writes.
Verification-kind: runtime
Verification-result: pending
Evidence: [Project selection receipt](../receipts/06e-project-selection.md)
Timebox: Current Zo focused-test unit admits 90/75/75-second runs within 300 cumulative seconds, with separate source and runtime review. Later browser work requires its own frozen profile. Historical Habitat allocations remain closed to replay.

## Current progress

Updated 2026-09-11. The owner requires all current coding and verification on Zo.
This supersedes the historical Habitat application/launcher steps below. Preserve
the original laptop evidence and unused admission; do not replay or reset it.

**Accepted:** Native10 transport evidence remains accepted. Zo build 04 contains
the exact five reviewed C5 files among its 80 app inputs and all 212 build outputs
remain unchanged. Doctor01 is accepted. This closes the current production-build
and doctor evidence gaps. Current canonical and copied Zo product bytes already
match, so no separate application to the obsolete Habitat location is needed.

**Remaining:** Prove the current activity and component suites, the deliberate
missing-renderer-key mutant, and the C5-specific browser journey. Browser15's
read-only Workbench check is supporting evidence, not C5 selection acceptance.
Standalone typegen/typecheck belonged to the older build envelope; the C5
amendment requires the fresh build already accepted, not another unchanged build.

**Source preparation accepted:** The portable Linux x64/Windows x64 component
fixture and four bounded proof tools passed independent QA and inert checks.
The real source/dependency freeze and check passed. The seven component cases
remain unchanged. The current component-test hash is an explicit test-only delta
from the preserved build snapshot; all production inputs remain exact.

**Next:** Fresh Verify admitted the first 90-second activity run with five seconds
for cleanup. Execute that fixed command after the local preparation checkpoint.
Then admit the 75-second component and mutant runs separately. The three runs
share a separate 06e ledger; the accepted 05b snapshot and accounting are immutable.
No 06e runtime result is accepted yet.

## Zo C5 focused-test contract, 2026-09-11

Authority: the owner's all-issues continuous-execution instruction and explicit
Zo-only direction. Root owns this plan and acceptance. Implement owns the bounded
fixture changes. Independent QA reviews source; Verify checks frozen inputs,
runtime evidence, isolation, resources and cleanup before acceptance.

Product scope remains C5's existing identity projection and read-only renderer.
Own only the component test's explicit platform mapping and the new 06e test
supervisor, preparation helper and mutant assertion wrapper. Do not change the
product implementation merely to satisfy a test. Preserve all five original
C5 hashes, the 05b build/input manifest and the accepted README documentation delta.
A portable test-only correction does not require rebuilding unchanged product code.

Acceptance remains:
1. Current activity suite: eight cases, 43 refusals, four accepted reads and three
   injected state changes, with natural worker exit and the state witness.
2. Component suite: all seven cases, both renderer surfaces, empty selection,
   delayed old selection, changed reference remount, revocation, malformed/missing
   native identity fields and unavailable transport. Require cleanup evidence.
3. Missing-key mutant: stage a copy of Conversation with exactly one
   `key={rendererKey}` removed. The selected remount case must fail for the exact
   remount assertion, and cleanup must pass. Canonical Conversation is unchanged.

Use `.tmp/06e/zo-test` for a fresh packet-local ledger and proof artifacts.
The source of reused dependencies/build remains `.tmp/05b/zo-runtime/app`,
mounted read-only. Overlay only the reviewed current component test and, during
the mutant run, its exact staged Conversation mutation. Pin all files, toolchains,
dependency manifests and esbuild binary. Writable storage is limited to private
/work and tmpfs /tmp and /home. Keep private user/PID/network namespaces,
loopback only, UID/GID 1000, no capabilities and no-new-privileges.

The proposed first source-reviewed profile admits one activity run up to 90
seconds, one component run up to 75 seconds and one mutant run up to 75 seconds,
with 300 cumulative seconds including dispatch/refusal/cleanup. Each run gets
five seconds for owned cleanup. Use two inherited CPUs, zero swap, a 1536 MiB
aggregate RSS stop, 64-task stop, 250 ms observer, 8 MiB combined output cap and
1536 MiB host reserve. Zo cgroup sublimits are not enforceable; describe these
as externally monitored stop thresholds. No install, network access, model call,
production build or browser run belongs to this focused-test admission.
A failure needs diagnosis, a reviewed correction and an explicit bounded revision
within retained accounting. Do not launch before exact source QA and fresh Verify.

After these tests pass, freeze a separate C5 browser packet with its own exact
scenario/input/resource bindings. It must prove project switching, delayed stale
responses, remount/revocation on `/` and `/workbench`, separation from 05b's
organization-qualified `/chat`, and zero unauthorized activity requests or model
calls. The component's fullPage variant is unit coverage, not a mounted route. Complete source review and resource admission before that browser run.
The packet and parent outcome remain in progress until all C5 criteria pass.

## C5 browser design pending focused-test acceptance

Read-only source review found that the standalone app's only server plugin
mounts chat titles and awaits Native bootstrap. It does not currently mount
catalog, registry, readiness or activity actions. The next browser proof must
explicitly compose the existing public services in its isolated fixture. That
acceptance will not establish default production startup or real authentication.

Reuse `createNativeRegistry`, `createNativeRegistryAuth`, `createProjectCatalog`,
`createProjectRuntimeReadiness`, `createProjectRuntimeActivity` and their existing
mount functions. Use the real Native database, sessions, memberships, app roles,
registration endpoint and root provider against two disposable physical roots.
Serve the exact accepted build04 through the tested SSR/H3 seam. Keep 05b files
and proof snapshots unchanged.

Seed bounded Native threads, sessions, runs and events through their public APIs
before browser measurements, using a declared synthetic adapter. Resolve exact
immutable activity references through the existing trusted reference seam.
After setup, adapter starts/turns and model calls must stay at zero, and Native
thread/session/run/event records must stay unchanged. Do not manufacture catalog,
readiness or activity responses.

Exercise both `/` and `/workbench`: no selection, Alpha activity, available Beta
without verified activity, late Alpha delivery after Beta selection, replaced
Alpha reference/run, and actual role revocation followed by Refresh. Any held
activity response must be produced by the real handler before delayed delivery.
Allow only named fixture setup/control writes and ordinary Native selection
persistence. Workbench must issue no thread/history discovery or chat/run
mutation. Keep `/chat` organization-qualified and independent of project activity.

Browser refetch temporarily unmounts the renderer, so DOM replacement alone
cannot prove the React key is necessary. The component missing-key mutant owns
that evidence. Call the Beta case unavailable activity unless a genuine empty
verified Native projection is separately seeded and proved.

Before implementation/runtime, freeze exact fixture sources, root-provider
dependencies, trusted evidence/reference rules, request allowlist, resource
profile and natural shutdown contract. This design creates no browser admission.
The configured production-action gap remains with outcome 06 and runtime owners.

## Historical Habitat continuation

The earlier corrected launcher and one-admission 1,200-second build allocation
remain preserved as historical evidence. Zo's accepted exact-byte build replaces
the need to execute that launcher. Do not modify its frozen bindings or claim a
new Habitat run. The receipt retains failures and their accounting.

## Goal

Let an authorized person register an already configured folder, see the resulting
project, and switch the workbench's current project. Show a concrete next step
when registration, access, or folder custody is unavailable.

## Context

Read the [catalog contract](../contracts/project-catalog.md), registry contract,
05a shell receipt, and 06d native-root registration receipt. The lead approved
this scope on 2026-09-07 under the owner's continuous implementation authority.
06d remains the native session, role, and trusted root owner.

## Owned files

- New `packages/workbench/server/project-catalog.mjs` and focused catalog tests.
- App project selection/context/form components, the workbench route, shared
  Conversation integration, focused behavior tests and styles. The root remains
  owned here. Packet 05b owns only `/chat` from the application route files.
- This packet, its receipt, and the bounded catalog contract.
- After 06d independent acceptance, its writer transfers only the minimal
  current-access resolver export needed by the catalog. Coordinate that edit.

The native registration oracle, store, provider, source preservation, account
configuration, task/session/transcript ownership, and runtime activation remain
with their existing owners. Record any necessary shared seam before changing it.

## Done condition

1. Record the read contract before implementation. Reuse the current native
   authorization owner and exact actor/collection/device database scope.
2. Return only authorized labels/IDs, configured opaque location references,
   revisions, and observed availability. Check current native grants before and
   after asynchronous work. Refuse foreign records and stale scopes.
3. Register through the existing action, retaining the immutable operation ID
   and request for uncertain retries. Do not create another registration engine.
4. Share project selection through native application state. Resolve every
   selected reference against the current catalog. Display only the existing
   Native Run activity projection for its verified thread and scope under C5.
   Revoke stale/unavailable selection, reject late responses, and mount no
   composer in the Workbench panel.
5. Prove two physical roots, real native roles, SQLite registration/replay/
   duplicate behavior, scoped selection, revocation, and lost/replaced custody.
6. Verify actual action responses in desktop/mobile browser flows. Record any
   synthetic login separately from production authentication. Build, typecheck,
   run focused tests/doctor, and inspect relevant console failures.
7. Obtain independent source/evidence review, retain verified private evidence,
   clean task-owned resources, and update the graph without closing parent 06
   beyond its demonstrated acceptance.

## Verify

The current executable checks are the [Zo C5 focused-test contract](#zo-c5-focused-test-contract-2026-09-11)
and its subsequent browser phase. Build04 and Doctor01 are already accepted for
the unchanged product bytes. The older Habitat commands below are historical
provenance, not instructions to rerun a build or transfer files.

### 2026-09-09 shared activity seam

The lead authorizes this packet to extend the existing 04b ready response with
`nativeThreadId` and `nativeScope`, a strict object containing type
`vivary-project-runtime-v1` and the existing binding identity digest as its ID.
Construct these fields only after the final trusted checks from the verified
reference and Native records. Refusals contain neither identity nor activity.
The response remains within the existing 256 KiB limit.

Owned shared files are `server/project-runtime-activity.mjs`,
`app/lib/runtime-activity-schema.ts`, and their two existing focused suites,
under `packages/workbench`. Conversation retains the public stateless Native
renderer. The new proof must cover exact identities, malformed schemas, selection
A to empty B with delayed A, reference changes, and the Workbench Conversation.
Prove zero thread/history-list requests, Native chat/thread/run HTTP mutations
and model calls. Project selection may use its existing Native application-state
write for `vivary-project-selection-v1`. Record that exact route and payload.
Trusted fixture setup and revocation controls remain separate from browser
product traffic and may change only their declared disposable fixture state.

04b's original receipt remains evidence for its original bytes. Fresh focused
runtime and browser evidence is required for this seam. No source application
or completion follows from this contract amendment alone. C5 records why the
earlier full-chat component assumption does not satisfy the inert display gate.
Complete conversation history remains an open outcome 04 requirement.

The lead applied the five independently source-reviewed candidate files to the
canonical worktree on 2026-09-09 for source freezing. Exact preimages and pending
proof gates are recorded privately. This is candidate application, not runtime
acceptance. The Habitat checkout retains its prior bytes until fresh acceptance.

At the historical Habitat checkpoint, the plan was to reuse its app and frozen
dependencies and transfer only reviewed
owned source with hash checks. Use test-owned physical roots and a synthetic
native identity inside a disposable local fixture database. Preserve existing
runtime tools, provider owners, app dependencies, and unrelated processes.

```console
node --test packages/workbench/tests/project-catalog.test.mjs
pnpm --dir packages/workbench build
pnpm --dir packages/workbench typecheck
pnpm --dir packages/workbench doctor
python scripts/check_multi_project_plan.py --check
```

Record browser commands, real transport, screenshots, and any remaining fixture
limits in the receipt. The approved 05a shell archives remain immutable.

## Stop conditions

No real credential copying, account changes, paid service, model invocation,
publication, arbitrary path input, file editor, runtime activation, or new
development checkout is authorized. Stop only the operation missing an actual
external prerequisite and continue independent implementation and verification.

## Log

- 2026-09-07: Lead accepted this bounded proposal. Read contract recorded before
  implementation. Waiting for the 06d source freeze before its narrow shared
  access-resolver edit. Independent contract/UI preparation may proceed.

- 2026-09-07: The lead accepted 06d independent execution and released its source freeze. Catalog/schema implementation started with authority changes assigned separately to the 06d writer.

## 2026-09-08 full-build verification envelope

The lead prepared the existing full-build gate as one serial Habitat job.
The 60 frozen source inputs already match the reviewed checkout. The two
explicitly recorded non-build differences are README and an older readiness
component fixture. No application source transfer is needed. Core 0.176.5,
React Router 8.3.1 and the existing package/binary closure remain in place.

Run the public doctor, React Router typegen, public typecheck and full build,
in that order. The explicit typegen check catches errors that the public
typecheck wrapper otherwise tolerates. This is ordinary production build
configuration with no application server or model session started.

Use the reviewed versioned build resource profile from the frozen manifest.
Current trial `06e-build-resources-trial11` under `06e-build-memory-v2` selects 2048 MiB aggregate Linux memory, zero swap,
64 tasks, one CPU and 512 MiB Node heaps. Preserve the separate 512 MiB Windows
transfer/controller allowance and 1536 MiB available-host reserve: admission
needs 4 GiB free RAM and 10 GiB disk. Bind admission and service limits to
the same manifest bytes. Doctor/typegen/typecheck/build deadlines are 45, 45,
90 and 300 seconds under the existing BOOTTIME policy. The service ceiling is
480 seconds. Profile values are adjustable experiments, not runtime defaults. Capture at most 1 MiB combined output across the entire job. Fresh task-owned HOME/TMPDIR, private loopback-only networking and a
read-only dependency mount prevent configuration leakage and dependency repair.
Verify Node/SQLite first. Do not install, transfer credentials or start a container.

Inspect source inventory and hashes before and after. Export exact command
results, enforced boundaries, memory peak/events, process absence and generated
artifact manifest. Retain the existing build output for the later browser check
and record its hash. Remove only exact task-owned staging and temporary files after
verification. Independent driver review and fresh resource preflight precede
execution. Any failed check leaves this gate and packet incomplete.

- 2026-09-08: Lead claimed the serial build verification lane while 04c source
  implementation proceeds in separate owned draft files. No build was launched
  at this checkpoint. Browser, production transport and scoped chat stay open.

- 2026-09-08: Four final build attempts remain unaccepted. Doctor fixture annotations, the disposable Vite-cache mount and two enum-exhaustiveness corrections are reviewed. The last run reached its build deadline and lost its in-process export. Cold evidence/cleanup are complete. The receipt owns archive hashes and limits. Lead prepares durable phase checkpoints. Browser waits for a fresh successful artifact manifest.

- 2026-09-08: Checkpointed attempt 05 passed doctor/typegen/typecheck, then stopped on a 275 ms wall-clock rollback. Complete evidence and cleanup are archived. The next build reuses the independently accepted BOOTTIME clock policy. The identified GET-during-PUT selection ordering gets focused regression proof before rebuilding. Browser runner remains inert while its review findings are corrected.

- 2026-09-08: Accepted the reproduced GET-during-PUT correction and three-case component proof. Attempt 06 hit its actual cgroup memory limit. Cold evidence and cleanup are complete. Reviewed versioned trial 07 uses 1280 MiB Linux with unchanged Node heap and host reserve. Browser source is independently reviewed and awaits successful build evidence.

- 2026-09-08: Archived failed attempts07-10 with exact cleanup. Trial11 adds the public TypeScript serial option while preserving the 64-task cap. Its fresh 4GiB memory gate refused launch. The receipt distinguishes OOM evidence, native thread pressure and unexecuted static changes.

- 2026-09-08: Trial 11 passed admission and reached the build phase, then exited
  1 when Nitro tried to write
  `node_modules/.nitro/types/nitro-routes.d.ts` through the read-only
  dependency mount. Trial 12 bound the real `.nitro` directory to the
  task-owned `tmp/nitro-cache` directory. Nitro completed, including the
  server build, and its command returned 0. The enclosing job exited 1 because
  its owned-process check observed then cleaned an orphaned descendant. The
  Native production-configuration messages on stderr did not make this build
  command fail. Both archives and cleanup are recorded in the receipt. This
  leaves the production build gate incomplete.
  The packet still authorizes a separately recorded synthetic identity in a
  disposable local fixture database for fixture proof. That result cannot be
  reported as production acceptance or replace the successful-artifact
  requirement for the packet's browser acceptance.

- 2026-09-08: Trial 13 accepted the full serial Habitat build gate. Version,
  SQLite, doctor, typegen, typecheck, and build each returned zero within their
  BOOTTIME limits, with no timeout, late output, or orphaned descendant in the
  recorded supervisor evidence. It produced a fresh 228-file, 15,476,817-byte
  artifact manifest bound to the successful attempt and evidence archive. The
  accepted 20g supervisor is present in the frozen source. It resolves the
  current build outcome without retroactively identifying Trial 12's former
  unknown child state. Browser, production transport, and parent-06 acceptance
  remain open.

- 2026-09-09: Browser trial14 passed all 14 observations against the accepted
  trial13 build. Lead and independent Astra review accepted the request ledger,
  exact database/root evidence, desktop/mobile screenshots and complete owned
  cleanup. The receipt records archive hashes and synthetic-identity limits.
  Permission recovery is proved after Native's 60-second denied-URL cooldown,
  with only browser wall time advanced for that check. Conversations remained
  inert. Done condition 4's supported Native chat scope/history integration is
  still open, so this packet remains in progress.

- 2026-09-09: The post-12h Native activity trial08 passed independent review: eight
  cases, 43 refusals, four reads and three deliberate state changes. All new
  mutation tables stayed empty across 22 snapshots. Its 82-binding archive in
  the preserved checkout is `.tmp/hoh-proof/06e-scope/native-trial08/evidence.tar`,
  SHA `0a477f4c8ee9f794caf950ffb8549fb0cd900313118eccf1f904cdee0edda81b`.
  The service, stage and all 31 recorded Windows identities are absent.
  A fresh source-reviewed build snapshot binds the complete 12h integration,
  SHA `cfc6cee4360fe4165b534e23d31028ac9e63cf133aa1beb4fb8b66fba93f36e0`.
  Its first prelaunch found Habitat no longer running and stopped before
  activation, memory admission or build. The fixed 4 GiB warm gate remains.
  This verifies Native activity compatibility only; the refresh correction
  still needs a fresh build, sandboxed browser proof and Habitat application.
  Full conversation scope/history and parent-06 acceptance remain open.

- 2026-09-10: Handoff audit corrected stale acceptance wording. Browser trial08 exposed
  the refresh defect. Its reviewed Conversation correction is canonical only.
  After accepted 17a application, Native09 passed both Node phases but failed raw
  witness reconciliation and Windows owner settlement. Final activity found Habitat
  stopped. The 85 archived duplicates were retired. The bounded transport correction
  passed source and inert review only. Fresh Native, build, sandboxed browser and
  five-file Habitat application remain open. Product execution is paused.

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
