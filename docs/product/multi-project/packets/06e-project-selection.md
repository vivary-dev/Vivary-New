---
type: packet
---
# 06e: Register and select authorized projects in the workbench
Parent: 06
Status: in-progress
Depends-on: [05a, 06d]
Owner: Root owns the current product slice and acceptance. Use independent review where a named risk warrants it under ENGINEERING.md.
Scope: Normal Workbench startup, Native scoped project catalog, registration form, shared selection, and exact Native scope association for read-only Run activity. No model activation, arbitrary path registration, portable export grant, or project file writes.
Verification-kind: runtime
Verification-result: pending
Evidence: [Project selection receipt](../receipts/06e-project-selection.md)
Timebox: Ordinary development uses relevant test timeouts and owned cleanup under ENGINEERING.md. Retain the historical C5 allocations and results. No further custom C5 fixture run is planned.

## Current progress

Updated 2026-09-12. [ENGINEERING.md](../../../../ENGINEERING.md) governs this work.
Keep all implementation and runtime on Zo.

**Accepted:** Native10 transport, Zo build04, Doctor01, and the retained activity,
component, and missing-key mutant checks retain their bounded acceptance.
The [receipt](../receipts/06e-project-selection.md) owns their evidence and limits.

**Incomplete:** Browser08 recorded all twelve selected-project checks across
both Workbench routes, then failed in the separate chat check. The fixture
expected a hidden inactive thread title and rejected real chat startup requests.
It did not reach final state, model-counter, or passing lifecycle verification.
Independent review preserved the failure and verified all owned processes absent.

**Working through normal startup:** The built app now serves Workbench pages and
mounts the existing registry, catalog, readiness, and activity services. Eight
startup tests, 49 registry tests, the normal build, and a real-app browser journey
pass. The journey uses Native authentication and app roles with disposable
accounts, roots, and SQLite. It proves UI registration, switching, selection
after page reload, project-specific readiness, missing folders, and revocation.
A normal shutdown and restart retains the registered project records.

**Next:** Complete root identity recovery and the remaining project-bound state
and draft behavior. After restart, the current custody owner correctly refuses
the saved root identities, so the projects remain listed but unavailable.
Supported persistent deployment storage and configured runtime remain open.
[The receipt](../receipts/06e-project-selection.md#normal-application-startup-2026-09-12)
owns the current check and limits.

Preserve the failed C5 evidence and budgets. Its historical plans below describe
the original runs and grants. Do not extend or rerun that fixture campaign.
Ordinary development follows the engineering policy.

## Zo C5 focused-test contract, 2026-09-11

Authority: the owner's all-issues continuous-execution instruction and explicit
Zo-only direction. Root owns this plan and acceptance. Implement owns the bounded
fixture changes. Independent QA reviews source. Verify checks frozen inputs,
runtime evidence, isolation, resources, and cleanup before acceptance. This
contract now records completed runs. All three attempt names are consumed.

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

Retain the existing `.tmp/06e/zo-test` packet-local ledger and proof artifacts.
The namespace was prepared once. Activity, component, and mutant attempt names
are consumed. The runs reused dependencies and the build from
`.tmp/05b/zo-runtime/app`, mounted read-only. They overlaid only the reviewed
component test and the exact staged Conversation mutation. The profile pinned
all files, toolchains, dependency manifests, and the esbuild binary. Writable
storage was limited to private /work and tmpfs /tmp and /home. The runs used
private user, PID, and network namespaces with loopback only, UID/GID 1000, no
capabilities, and no-new-privileges.

The completed source-reviewed profile admitted one activity run up to 90 seconds,
one component run up to 75 seconds, and one mutant run up to 75 seconds. Its
300-second cumulative limit included dispatch, refusal, and cleanup. Each run
had five seconds for owned cleanup. The profile used two inherited CPUs, zero
swap, a 1536 MiB aggregate RSS stop, a 64-task stop, a 250 ms observer, an 8 MiB
combined output cap, and a 1536 MiB host reserve. Zo cgroup sublimits were not
enforceable, so these values were externally monitored stop thresholds. The
admission excluded installs, network access, model calls, production builds, and
browser runs. No further focused attempt is admitted.

The focused tests passed. Next, freeze a separate C5 browser packet with exact
scenario, input, and resource bindings. It must prove project switching, delayed
stale responses, remount and revocation on `/` and `/workbench`, separation from
05b's organization-qualified `/chat`, and zero unauthorized activity requests or
model calls. The component's fullPage variant is unit coverage, not a mounted
route. Complete source review and resource admission before the browser run. The
packet and parent outcome remain in progress until all C5 criteria pass.

## C5 browser design and original allocation

The owner's September 11 continuation authorizes implementation of this bounded
proof on Zo. The separate Plan role supplied the scope and profile below.
Implement agents own disjoint new fixture files under `fixtures/06e/`: one owns
the backend and runner; the other owns browser assertions and proof tools. Root
owns this packet, the receipt, and the handoff. Independent QA and Verify review the
finished source and evidence. No browser runtime is admitted by this contract.

The standalone app's server plugin mounts chat titles and awaits Native bootstrap.
It does not mount catalog, registry, readiness, or activity actions. This proof
explicitly composes those public services in a private fixture. Acceptance does
not establish default production startup or production authentication.

Reuse `createNativeRegistry`, `createNativeRegistryAuth`, `createProjectCatalog`,
`createProjectRuntimeReadiness`, `createProjectRuntimeActivity`, and their mount
functions. Use real Native storage, sessions, memberships, app roles, registration,
and root custody against two disposable physical roots. Serve accepted build04
through the tested SSR/H3 composition. Keep accepted 05b files and both earlier
ledgers unchanged. No install, new build, dependency upgrade, or model call belongs
in this proof. Product source remains unchanged.

The backend validates and hashes each static asset request. The runner serves
those same bytes from the frozen, read-only app after matching the exact source
manifest entry and backend metadata. Asset bodies do not cross the framed RPC
pipe. Keep its byte count and all diagnostic streams within the output limit.
Retain bounded raw diagnostic sidecars on success and failure.

Seed original and replacement Native threads, sessions, runs, and events through
public APIs before browser measurement with a declared synthetic adapter. Resolve
strict activity references through the existing trusted-reference callbacks.
Reference replacement during measurement changes only the selected fixture
reference to an already finalized run. Adapter starts, turns, and model calls
must remain zero after setup. Native thread, session, run, and event records must
remain unchanged. Do not manufacture catalog, readiness, or activity responses.

Run all six scenarios on both `/` and `/workbench`: no selection, Alpha activity,
available Beta without verified activity, delayed Alpha delivery after Beta
selection, replaced Alpha reference, and actual role revocation followed by
Refresh. Produce any delayed response with the real handler before holding its
delivery. The component mutant proves that the renderer key is necessary. Browser
DOM replacement alone cannot establish that claim. Call Beta unavailable
activity unless a genuine empty verified projection is seeded and proved.

Native normally cancels a superseded activity fetch. For the late-delivery case,
arm one exact Alpha activity GET per route in a fixture-only fetch wrapper. Keep
the original fetch chain, headers, credentials, request options, and response.
Detach only that matched request's supplied signal, and record its later abort.
The real Alpha response must finish before Beta selection starts. Beta's selection
PUT and the supplied-signal abort must both precede release, before Native's direct
timeout. Bound the response clone and match its browser hash to the held backend
bytes. Assert zero Alpha rendering afterward. Admit exactly two such probes and
restore the previous fetch descriptor on every path. This tests adversarial
transport that ignores cancellation. It does not claim normal transport delivers
cancelled requests or change product source.

Freeze separate request windows for shell bootstrap, Workbench measurements, and
an independent `/chat` scope check. Enumerate bootstrap and asset reads from the
accepted build and evidence. The Workbench may read the exact catalog, readiness,
and activity actions. It may read Native application state for
`vivary-project-selection-v1` and save only the exact selection object through
`PUT /_agent-native/application-state/vivary-project-selection-v1`.
That object's only fields are the current catalog `scopeKey` and available
`projectId`. No selection DELETE is allowed. Block all other writes during
Workbench measurement, thread/history discovery, model requests, external
origins, WebSockets, and EventSource. Record and reject unexpected requests.

The accepted shell persists locale on document startup. Set browser locale to
`en-US`, preference to absent or `system`, and no hydration override. Each named
bootstrap may make one `PUT /_agent-native/application-state/localization` with
exact JSON `{"locale":"en-US","preference":"system","dir":"ltr"}`,
`Content-Type: application/json`, and `X-Request-Source: localization`. Record and
settle that response before measurement; reject later or repeated locale writes.
The independent `/chat` window may save only its exact `__url__` application-state
object `{"pathname":"/chat","search":"","hash":"","searchParams":{}}`
and call `POST /_agent-native/actions/manage-agent-engine` with
`{"action":"list"}` for read-only discovery. Reject engine activation and
`agent-chat-context` writes. These source-derived exceptions preserve the
accepted build. They do not authorize thread, session, run, or event mutations.

Compare immutable Native execution rows to the original post-seed baseline
across every window, including bootstrap. For each permitted application-state
PUT, validate the exact cell value and update timestamp plus Native's one
corresponding sync-event append. Preserve all preexisting sync-event rows and
reject any extra event. The revision04 contract below owns this paired witness. Fixture setup, role,
reference, delay, snapshot, and close controls are separate from browser traffic
and have exact declared effects. The `/chat` check remains organization-qualified
and separate from Workbench activity.

The new `.tmp/06e/zo-browser` ledger admits at most one reviewed browser attempt:
360 seconds for execution and five seconds for cleanup within 365 cumulative
seconds. Reservation, refusals, execution, and cleanup retain their charges.
Use four inherited CPUs, zero swap, an 8 GiB aggregate RSS stop, a 256-task stop,
a 250 ms observer, a one-second maximum observer gap, and an 8 MiB combined output
cap. Preserve a 1536 MiB host reserve. Admission needs at least 9.5 GiB available
memory. Record disk, included usage, exact process ownership, and unknown metrics
before dispatch. These are externally monitored stop thresholds, not enforceable
Zo cgroup sublimits. Keep one heavy job active. A failed attempt requires diagnosis
and a reviewed bounded revision before any retry. It never resets either ledger.

Require private user, PID, network, and mount namespaces, loopback only, UID/GID
1000, no capabilities, and no-new-privileges. Source, app, Chromium, and proof
inputs remain read-only. Only packet work and private `/tmp` and `/home` are
writable. Freeze final fixture bytes, all 43 core Python files used by root
custody, registry evaluator dependencies, accepted build inputs/outputs, installed
dependency hashes, runtime identities, trusted evidence rules, the request
allowlist, and executable hashes before independent runtime admission. Verify
Chromium sandbox flags from its actual process. Do not disable its sandbox.

Settle browser requests and held responses before cleanup. Require browser and
backend exit, server/display closure, database and audit disposal, and closure of
owned SSR MessageChannel ports. Record the display helper's expected Xvfb SIGTERM
separately and reject its SIGKILL fallback on a passing run. Clear only explicitly captured fixture retention
timers. Call `await provider.close()` exactly once after provider work settles.
The accepted provider implements this call with SIGKILL. Record
`providerStopMode: public-close-sigkill`, unavailable readiness, refused post-close
inspection, and absence of its exact Python process. Do not call that provider
exit natural. A passing run requires zero supervisor escalation and no remaining
owned process. Retain bounded raw evidence and verify its archive before any
separately authorized removal. No accepted snapshot is a cleanup target.

The source-derived provider shutdown clarification preserves the accepted public
API. A graceful provider lifecycle would require a separate product change and
fresh evidence. The production-action gap remains with outcome 06 and runtime
owners.

## C5 browser revision02: retained budget

Browser01 consumed 37.09076154699869 seconds and failed before launching Chromium.
Its physical roots used `/work` on v9fs (`0x01021997`), which the existing observer
rejects. Revision02 moves only disposable physical roots and private custody
state into the sandbox's existing `/tmp` mount. Require tmpfs (`0x01021994`) before
registration and retain path, file-hash, and observation evidence. Preserve the
product filesystem allowlist. Generate a fresh fixture-only authentication secret
before Native initialization; do not persist, log, or pass it to child processes.

Use `.tmp/06e/zo-browser-r2` for the single `browser-02` attempt. Its 327-second
allocation is drawn from the original 365 seconds: 322 for execution and five
for cleanup. Pin Browser01's actual charge, failed result, ledger hash, and
verified cleanup in a frozen budget-authority record. Require prior plus current
actual charges to remain within the original limit. Keep the old namespace,
ledger, manifests, source archive, and diagnostics unchanged. A new namespace
does not create a new budget. The original profile's memory, task, CPU, output,
isolation, and traffic limits remain in force.

The failure archive is `.tmp/06e/browser-01-failed-evidence.zip`, SHA-256
`3d6be2d7a802a3d0551222b04d6d83e090ca5861251249f7107a6399720f8fc4`.
CRC, all 33 members, and their hashes passed readback. Independent QA accepted the fixture correction and retry tools; the 349-entry
revision02 freeze is prepared. Fresh Verify admission remains required. No retry
is authorized by the failed result alone.

## C5 browser revision03: exact empty selection

Browser02 consumed 36.77261576199817 seconds, bringing actual combined use to
73.86337730899686 of the original 365 seconds. Native returned the documented
empty batch response `{"values":{},"missing":["vivary-project-selection-v1"]}`;
the fixture incorrectly expected `{}`. Correct only that expectation and retain
the real handler and store. The tmpfs and auth corrections reached registration;
full post-close custody evidence remains unproved because setup stopped early.

Use one `browser-03` attempt in `.tmp/06e/zo-browser-r3`. Allocate 291 seconds from
the original remainder: 286 execution and five cleanup, with a maximum combined
charge of 364.86337730899686 seconds. Pin and sum both earlier actual charges,
ledgers, failed results, and archives in the new authority record. Preserve them
unchanged; no namespace creates a new budget. Keep all other resource, isolation,
traffic, and evidence requirements. Independent QA accepted all five source files,
and preparation completed once with 352 source entries. Verify that existing
freeze and fresh resources before admission; do not repeat preparation.

The Browser02 archive is `.tmp/06e/browser-02-failed-evidence.zip`, SHA-256
`866c7f989fc5230714104464785b7bcde730730e087c09ab15a9518f99172d36`.
All 32 payload members, hashes, and ZIP CRC passed readback. It also retains the
Browser01 archive. No further runtime follows from the failed result alone.


## C5 browser revision04: exact Native write effects

Browser03 exposed the normal sync-event append from an allowed application-state
PUT. The fixture must validate both effects against the installed Native schema:
the one declared state cell and its one corresponding new sync-event row. Retain
the raw before/after values and the exact event in each write witness. Preserve
every preexisting sync row. Exclude only individually verified new rows from the
immutable-state comparison and reject all additional, changed, or removed rows.
Thread, session, run, and execution-event records remain unchanged.

Drain browser bootstrap requests and inspect their actual response statuses
before closing the bootstrap window. Surface a rejected fire-and-forget request.
Locale startup still allows zero or one exact PUT. Keep the existing separate
chat URL and engine-list allowances. Do not widen browser traffic or change the
accepted app to satisfy the fixture.

Use one `browser-04` attempt in `.tmp/06e/zo-browser-r4`. Its 245 seconds come
from the original remainder: 240 execution and five cleanup. The frozen authority
must bind all three actual charges and all nine prior ledger, result, and archive
artifacts. Maximum combined charge is 364.5092389969941 of 365 seconds. No prior
namespace or ledger may change. All other CPU, memory, task, output, isolation,
cleanup, source-review, preparation, and fresh-admission requirements still apply.


## C5 browser revision05: settled integration schema

Browser04's difference is one empty `integration_configs` table. Reconstructing
the immutable digest from the retained database matches the pre-route hash.
Removing only that table matches the original baseline hash. This explains the
difference without any row changes.

Await Native's existing configuration-store initializer through its supported
local read before taking the original post-seed baseline. Record the resulting
schema and empty-row readiness witness. Keep this table in all later immutable
comparisons.

Do not exempt it, sleep to hide the race, or replace the baseline
after browser activity. Preserve the paired state/sync write checks and bootstrap
drain from revision04.

Use one `browser-05` attempt in `.tmp/06e/zo-browser-r5`. Allocate 200 execution
seconds and five cleanup seconds from the original remaining budget. Bind all
four actual prior charges and all 12 ledger, result, and archive artifacts.

Maximum combined charge is 364.3305799219961 of 365 seconds. Keep all other source,
resource, isolation, request, cleanup, preparation, and fresh-admission requirements.


## C5 browser revision06: Native tool and artifact rendering

Native projects the stored `tool_done` event as an artifact. Its conversation
normalizer merges status tool events, while the generic Read file details card
retains the input. The exact result renders separately in
`.agent-conversation-artifact`. Browser05 incorrectly waited for the result inside
the details card.

For original and replacement activity, verify the matching activity text, Read
file card, exact input, and separate exact artifact result. Open the details only
when closed, and check the actual boolean state. Preserve the assertion that the
other activity is absent. Keep the existing timeout, request boundaries, Native
state witnesses, and all 13 success checks.

A source check also found that the permitted chat engine-list read initializes
the absent `app_secrets` table through Native's credential prefetch. Await the
public local secret-store read before the original baseline. Require a null
result, the exact empty table, and no change beyond optional table creation.
Do not log secret values. Keep this table fully covered by later immutable
comparisons. The fixture has no configured provider keys or external network.

Use one `browser-06` attempt in `.tmp/06e/zo-browser-r6`. Allocate 131 execution
seconds and five cleanup seconds from the original remainder. Bind all five
prior charges and all 15 ledger, result, and archive artifacts. Maximum combined
use is 364.9819184700027 of the original 365 seconds. Keep all other source,
resource, isolation, preparation, admission, and cleanup requirements.

## C5 browser revision07: settled maintenance and manual refresh

Independent QA reconstructed Browser06's final database and WAL. Exactly five
new empty integration tables explain the original-baseline difference. The
revision must await Native's supported local maintenance-store initialization
before the original baseline. Verify the exact empty schemas and no other
change. Keep all five tables fully covered by every later immutable comparison.
Do not reset the baseline after browser activity or exempt these tables.

The retained replacement appeared on the 30-second catalog poll. The earlier
window-focus stimulus did not prove focus-triggered refetch. Root amends the
Plan's trigger to the existing **Refresh projects** control. Independent QA
confirmed that this covers the canonical replacement-reference criterion
through the same production catalog refetch path. It does not establish
window-focus behavior.

After replacing the trusted reference, click the real control. Record the
pre-click request state and timing, then require new catalog, readiness, and
activity requests to complete promptly, before an interval poll could account
for them. Require the exact replacement reference/run and activity/artifact,
with the original activity and artifact absent. Keep selection-write, Native
state, and request-boundary checks. Preserve all 13 scenario checks and label
this one manual refresh. Do not alter clocks, query caches, or Native polling.

Retain and verify the configuration diagnostic from the permitted ping read.
The fixture's file database in production mode explains Native's expected
local-database diagnostic by source inspection. Do not hide the warning or
silence other configuration issues.

One reviewed `browser-07` attempt in `.tmp/06e/zo-browser-r7` may reserve 60
execution seconds and five cleanup seconds. Bind all six prior charges and all
18 ledger/result/archive artifacts. Maximum combined use is
364.03402556999936 of the original 365 seconds. Removing the poll wait may allow
the full run to fit; this is an estimate, not runtime evidence. Keep every
source, resource, isolation, preparation, admission, and cleanup requirement.

## C5 supplemental allocation approved, 2026-09-12

The [owner decision](../design.md#c5-supplemental-browser-allocation-2026-09-12)
approves one additional attempt: 115 execution seconds and five cleanup seconds.
The original 365-second allocation retains seven charges totaling
346.26085875899935 seconds and its unused 18.73914124100065-second remainder.
The new attempt consumes only the separate 120-second allocation.

Use `browser-08` in a new `.tmp/06e/zo-browser-r8` namespace. Pin all seven prior
ledger/result/archive sets. Keep the same four CPUs, 8 GiB RSS stop, 256-task
stop, output/observer limits, host reserve, network isolation, and
no-install/no-build/no-model scope. Review the remaining browser and final
lifecycle paths, then review the budget profile, prepare once, and obtain fresh
independent admission.

Completion still requires all 13 checks, both delayed-response probes, raw
state/counter and permitted-write witnesses, resource/isolation checks, passing
cleanup, and independent archive/evidence review. Preserve old archives; the new
bundle references their hashes instead of embedding their bytes again.
A failure consumes this attempt and leaves acceptance open. Do not add optional
proof work or admit another retry under this decision.

The next product unit connects the existing project services to configured
Workbench startup. This fixture cannot establish production mounting,
persistent root custody, or parent session/draft behavior.

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

- Normal application project-service composition and its startup plugin, with
  focused tests that invoke that same composition. Reuse existing service,
  authorization, custody, and migration owners.
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
