---
type: packet
---
# 04d: Admit one synthetic Native first start from an exact preparation

Parent: 04
Status: done
Depends-on: [04c]
Owner: Sol runtime_readiness_writer; Astra independent review; lead canonical writes and evidence acceptance.
Scope: Private first-start service, existing registry receipts and actual Native stores with a controlled synthetic adapter.
Verification-kind: runtime
Verification-result: passed
Evidence: [04d runtime receipt](../receipts/04d-project-native-start.md)
Timebox: One receiving seam, one first-start service, one receipt port and a bounded serial Habitat proof.
Authority: Lead reviewed the packet on 2026-09-08 under the continuous execution decision. Claim before implementation; source freeze and resource proof precede execution.

## Goal

Consume one exact, currently authorized 04c preparation and admit at most one
first Native harness start. A successful controlled turn establishes the exact
seven-field reference consumed by 04b. Native owns threads, harness sessions,
runs and events; Vivary records only the missing start provenance.

This packet proves a synthetic adapter using the real public Native runner and
stores. Production composition remains unavailable. It cannot close parent 04,
scoped project chat, production host fencing, real-runtime role confinement or
stop/quiescence for an external runtime. No model, ACP peer, provider process,
credential, package installation, scheduler, GUI or product cancellation API is
included. A real-adapter packet is a separate successor.

## Context

Canonical paths below are relative to the Vivary repository. Read:

- `docs/product/multi-project/packets/04c-project-native-preparation.md`, its
  matching receipt under `receipts/`, and its three owned implementation files.
- `docs/product/multi-project/packets/04b-project-native-activity.md` and its
  matching receipt; `packages/workbench/server/project-runtime-activity.mjs`
  and `packages/workbench/tests/project-runtime-activity.test.mjs`.
- `docs/product/multi-project/packets/07e-native-creation-admission.md` and
  `07f-creation-duplex-bridge.md`, with their matching receipts.

This packet defines the receiving API, lookup, Native completion method and
acceptance boundary in full. No private proposal or temporary checkout document
is required to implement it.

Accepted 04c evidence is archive SHA-256
`1c8e3fd462914595304212bb474d7fef460b6c08cbeee667ced63f3f0728aff3`:
13 preparation cases, 63 full-row snapshots and 59 observations. The production
host/incarnation fence remains unconfigured despite that controlled proof.

Core 0.176.5 public `startAgentHarnessRun` starts adapter creation before the
Native session save; run insertion is asynchronous and an existing same-thread
run can be aborted by a second start. Native session saves can update a
colliding ID. Therefore no returned `ActiveRun`, empty read or exact-looking
session grants retry or adoption.

`runOptions.waitUntil` is public in `dist/agent/run-manager.d.ts:200` and is
passed through the public harness runner. Inspected `run-manager.js:1825`
supplies the run completion promise. The controlled fixture captures and awaits
that promise; it does not access undeclared `ActiveRun.finalized`. Final SQL
writes remain best-effort, so promise fulfillment alone is not persistence proof.
Use public Native reads plus fixture-only SQL for the exact run/event evidence.

Freeze the installed Habitat versions and relevant bytes before proof. Local
inspection found these Core hashes; require matching evidence or review the
actual difference before execution:

| File under `@agent-native/core` | SHA-256 |
| --- | --- |
| `dist/agent/run-manager.js` | `7a792cc68028512a5d8be6a1604ae06402de371f4f4ccfa336f8f67bfbc578e2` |
| `dist/agent/run-manager.d.ts` | `a84e76888515e71ecf29b4a09b82a944abff5ce310af647b6aaed6b47a92c9c8` |
| `dist/agent/harness/runner.js` | `edee3d10fda576b628743cfa3f6fc9392842789a548b90bb643ace0dc3b75b19` |

Native schedules a five-minute retention timer after completion. Reuse the
existing 04b fixture's ownership pattern for that exact timer and restore global
descriptors during cleanup. Never shorten Native defaults or clear arbitrary
timers. Promise settlement does not prove that unrelated Native maintenance has
finished; inventory its writes and prove owned-process absence at final cleanup.

## Owned files

Add:

- `packages/workbench/server/project-runtime-start.mjs`: private
  `createProjectRuntimeStartService(dependencies)` with `start` and
  `resolveReference` as specified below.
- `packages/workbench/server/runtime-start-receipts.mjs`: private
  `createRuntimeStartReceiptPort({ db })`, exposing `read`, `reserve`,
  `beginStart`, `recordReferenceCandidate`, `verifySettlement` and `quarantine`.
  These methods perform short exact-key transactions, never host acquisition or
  Native effects.
- `packages/workbench/tests/project-runtime-start.test.mjs`: actual Native
  synthetic fixture, receiving-seam cases and adversarial start evidence.

Modify only the necessary parts of
`packages/workbench/server/project-runtime-preparation.mjs` to add
`withPreparedForStart`. Keep the accepted prepare/cancel behavior intact. Test
the new seam in the new start fixture and rerun all 13 existing preparation cases.

Do not change 04c's receipt port, database schema, 04b readers, existing tests,
role declarations, routes, actions, dependencies, Native implementation or GUI.
Do not mount an endpoint. Other writers own their files; do not revert their
changes. The lead reviews any ownership expansion before adding it to the packet.

## Exact receiving API

The strict lookup and start request are the same seven-field object, in this
insertion order:

```text
{ schemaVersion: 1, preparationId, preparationOperationId, scopeKey,
  projectId, expectedBindingRevision, expectedPolicyRevision }
```

`preparationOperationId` identifies the original 04c operation. Preparation ID
alone cannot address 04c's existing receipt key. It does not authorize a scan,
JSON-field search, latest-row lookup, new index or side map. Current
authenticated facts plus the original operation identify the exact row;
`preparationId` must equal that row's allocated ID. The request supplies no role,
identity, Native IDs, adapter, prompt, environment, cwd, tools or grant.

Add this method to the frozen 04c service:

```text
withPreparedForStart(lookup, authenticatedContext, consume)
```

Only trusted private service composition supplies `consume`. The method:

1. Strictly parses the lookup, checks configuration and the existing open issuer
   gate, resolves current scoped facts and addresses the exact preparation row.
2. Reconstructs the full original prepare request and role from that row. Uses
   the existing validators/receipt port and resolves current preparation
   authority. Checks all request, identity, digest, role, revision, settlement
   and issuer agreements; requires `thread-prepared` and the exact current
   private Native thread. Missing/unprepared, forged, cancelled, malformed,
   changed and foreign-incarnation records refuse. Preserve 04c's authorized
   exact-row foreign-incarnation quarantine behavior; never scan or repair.
3. Holds the existing `activeOperations` token for the original preparation
   operation through `consume` and final revalidation. An already active
   prepare/cancel/receiving invocation refuses. Use a token/open lifetime so an
   old handle cannot regain validity when a later call reuses the key.
4. Invokes `consume` once with a callback-scoped frozen object containing only
   `{ prepared, revalidate, assertLive }`. `prepared` is a deep-frozen clone of
   the complete validated 04c record. `revalidate()` repeats the complete fresh
   validation and requires the same prepared record/intent; it returns that
   validated record or raises a private bounded refusal. `assertLive()` checks
   synchronously that 04c admission is open and this issuer/token/handle is
   still live. A validation failure invalidates this handle. No boolean or
   serializable record represents ongoing authority.
5. Checks the gate after every await, revalidates before propagating successful
   callback output, and closes the handle/releases its token in `finally`.
   Retained `revalidate`/`assertLive` calls reject after closure. Map private
   validation errors to bounded refusal results; do not leak exception text.

The receiving method acquires **no host scope**, invokes no Native mutation and
does not create or advance a preparation. Initial lookup outside the host is
only for routing. 04d calls this method once around its complete start/settlement
operation and is the sole `withCreationScope` owner inside `consume`. Neither
receipt port nor receiving callback reacquires that host scope.

## Private service and configuration

`start(request, authenticatedContext)` accepts only the receiving lookup.
Success is strictly `{ code: "started", preparationId, reference, replayed,
evidenceKind: "synthetic-native-start" }`. The reference has exactly the 04b
fields listed below. Bounded refusals are `{ code }`, with code in
`invalid-input`, `unavailable`, `denied`, `stale-claim`, `ambiguous-binding`,
`operation-conflict`, `cancelled-before-create` or `recovery-required`.

`resolveReference(lookup, authenticatedContext, expectedIdentity)` performs no
Native mutation and acquires no host scope. It uses the same 04c receiving seam,
the exact scoped start receipt and fresh start authority, checks both services'
live gates, and compares the complete strict 04b `expectedIdentity` to the
currently reconstructed identity. It returns the bare seven-field reference
only for a same-incarnation verified record and exact current Native reads;
otherwise it returns a bounded refusal. Bind 04b's private fixture resolver to
one known lookup and authenticated context. Never search by identity, role,
owner, name or latest run. Do not put this resolver in production composition.

Snapshot/freeze trusted dependencies: the preparation service; start host;
scoped start-authority resolver; receipt port; ID allocator; fixed synthetic
profile/adapter; public Native runner/read functions; and the test-only
settlement observer. Missing composition is unavailable. The start grant is
strict `{ roles, startAuthorityRevision }`, where roles are unique members of
`planner`, `developer`, `qa` and the revision is a positive safe integer. It is
resolved for current authenticated facts and must include the prepared role.
A registry/preparation grant alone cannot satisfy it. Do not redeclare app roles.

This slice accepts only a reviewed deterministic synthetic adapter profile.
Its complete strict serializable descriptor is:

```text
{ schemaVersion: 1, kind: "synthetic-native-adapter", harnessName,
  runtimeVersion, fixtureRevision, turnInputDigest }
```

Use fixed synthetic `harnessName` and `runtimeVersion` that match the 04c
prepared identity. `fixtureRevision` is a version label. The trusted fixture
turn is exactly `Vivary synthetic first-start proof.`; `turnInputDigest` is the
SHA-256 of those UTF-8 bytes. The adapter object implements the real public
`AgentHarnessAdapter` interface, has no model/provider/process/filesystem
effects and emits bounded deterministic events. Its source is part of the
freeze. Public capability flags and permission-mode strings establish no real
role confinement. A real adapter/profile is unavailable in this packet; no
`roleEnforced`, `trusted`, `durable` or similar production capability boolean is
accepted. The functional fixture observer returns inspectable evidence, not a
success flag standing in for execution.

## Exact receipt contract

Use existing `vivary_registry_receipts` with operation `runtime-start`.
Derive `operationId = preparationId`; callers cannot choose a second first-start
operation. The existing scoped uniqueness key is
`(actorId, collectionId, deviceId, "runtime-start", preparationId)`.
`receiptKey` is `runtime-start:v1:` plus SHA-256 of UTF-8 JSON encoding of
`[actorId, collectionId, deviceId, "runtime-start", preparationId]`.
All three creation columns remain null. Confirm register/create/runtime-prepare
callers continue to use their own namespaces without broadening their parsers.

The mapped database row is exactly `{ receiptKey, actorId, collectionId,
deviceId, operation, operationId, requestDigest, creationNamespaceKey,
creationChildKey, creationPhase, record }`. `record` is bounded JSON text, not an
unvalidated object. Read no unrelated rows and change no schema/index.

The strict JSON record contains exactly these fields:

```text
{ schemaVersion: 1, operationId, request, requestDigest,
  preparationId, preparationRequest, preparationRequestDigest,
  preparationIssuerIncarnationId, preparationAttemptId,
  identity, bindingIdentityDigest, role, roleContractRevision,
  preparationAuthorityRevision, startAuthorityRevision,
  adapterConfiguration, adapterConfigurationDigest,
  nativeThreadId, nativeSessionId, nativeRunId, allocationDigest,
  issuerIncarnationId, attemptId, phase, nativeEvidenceDigest,
  settlement, quarantineReason }
```

`request` is the complete strict receiving lookup. `preparationRequest` is the
complete original seven-field 04c request. `preparationAttemptId` and
`preparationIssuerIncarnationId` come from its verified settlement. Identity,
role, thread and all preparation revisions/digests must match that record.
`issuerIncarnationId` is the separate 04d service incarnation, allocated once at
construction. Allocate distinct random Native session/run IDs once at start
reservation; neither equals the prepared thread or preparation ID. Do not
manually save a Native session as a reservation. `attemptId` is allocated once
when CAS enters `starting`.

Use 04c's exact ID/text/version/revision bounds, reject unknown keys, malformed
Unicode and oversized/unsafe values, and bound encoded records to 16 KiB.
All digests are lowercase 64-character SHA-256. Construct parsed digest inputs
explicitly; caller property order has no effect.

Identity property insertion order is exactly:
`ownerEmail, orgId, actorId, collectionId, deviceId, projectId, bindingId,
bindingRevision, rootId, contentRevision, locationRef, policyRevision,
harnessName, runtimeVersion, executionLocation, authorityContract,
runtimeConfigurationRevision`.
`bindingIdentityDigest = SHA256(UTF8(JSON.stringify(identity)))`. Do not sort
identity keys or turn the identity into a tuple.

Recompute `preparationRequestDigest` using the accepted 04c encoding:

```text
preparationTuple = [1, preparationOperationId, scopeKey, projectId,
  expectedBindingRevision, expectedPolicyRevision, role]
preparationRequestDigest = SHA256(UTF8(JSON.stringify([
  preparationTuple, identity, role,
  roleContractRevision, preparationAuthorityRevision
])))
```

The original preparation request must supply those exact tuple values.
Additional start digest encodings are:

```text
requestTuple = [1, preparationId, preparationOperationId, scopeKey,
  projectId, expectedBindingRevision, expectedPolicyRevision]
configurationTuple = [1, "synthetic-native-adapter", harnessName,
  runtimeVersion, fixtureRevision, turnInputDigest]
adapterConfigurationDigest = SHA256(UTF8(JSON.stringify(configurationTuple)))
requestDigest = SHA256(UTF8(JSON.stringify([
  requestTuple, preparationRequestDigest, preparationIssuerIncarnationId,
  preparationAttemptId, identity, role, roleContractRevision,
  preparationAuthorityRevision, startAuthorityRevision,
  adapterConfigurationDigest, nativeThreadId
])))
allocationDigest = SHA256(UTF8(JSON.stringify([
  1, requestDigest, issuerIncarnationId, preparationId,
  nativeThreadId, nativeSessionId, nativeRunId
])))
```

Start issuer and newly allocated session/run/attempt IDs are not request digest
inputs; the allocation digest binds the reserved issuer and Native IDs. Validate
the attempt through phase/settlement agreement. Never rewrite these values during
replay. Every read validates all row columns, keys, digests, phase fields and redundant
request/preparation/identity/configuration fields independently. Read by both
the exact key and scoped operation tuple as in 04c; disagreement refuses.
An existing row with mismatching allocated IDs cannot overwrite the winner.

Required equalities include:

- `row.operationId = record.operationId = record.preparationId =
  record.request.preparationId`.
- `record.request.preparationOperationId = record.preparationRequest.operationId`.
  Both requests agree on scope key, project and expected binding/policy revisions.
- Those project/revision claims equal the current identity's corresponding
  fields; `record.role = record.preparationRequest.role`.
- Row actor/collection/device equal identity; row request digest equals the
  independently recomputed record request digest; all three creation columns
  are null and operation is exactly `runtime-start`.
- Configuration harness/version equal identity; preparation issuer/attempt,
  thread, request digest, role and revisions equal the exact freshly validated
  04c record. Neither digest replaces that live 04c comparison.

The port's strict immutable `intent` is `{ request, preparationRequest,
preparationRequestDigest, preparationIssuerIncarnationId, preparationAttemptId,
identity, bindingIdentityDigest, role, roleContractRevision,
preparationAuthorityRevision, startAuthorityRevision, adapterConfiguration,
adapterConfigurationDigest, nativeThreadId, issuerIncarnationId }`. The port
recomputes keys/digests and validates this shape rather than trusting derived
values. Its signatures are `read(intent)`,
`reserve(intent, { nativeSessionId, nativeRunId })`, `beginStart(intent, attemptId)`,
`recordReferenceCandidate(intent, attemptId, nativeEvidenceDigest)`,
`verifySettlement(intent, attemptId)` and `quarantine(intent, reason)`.
Reserve allocates no IDs itself. A matching concurrent reservation returns its
existing winner without replacing allocations. Normal transitions require the
record's current issuer; exact authorized foreign quarantine preserves the old
issuer/allocations while clearing settlement. No other port read selector or
transition is admitted.

Phases are exactly `reserved`, `starting`, `reference-candidate`,
`reference-verified`, `quarantined`. These describe operation provenance, never
running/stopped/session state. Normal transitions are monotone:

| Phase | Required combinations |
| --- | --- |
| `reserved` | null attempt, evidence digest, settlement and quarantine reason |
| `starting` | non-null attempt; null evidence digest, settlement and reason |
| `reference-candidate` | non-null attempt and evidence digest; null settlement and reason |
| `reference-verified` | non-null attempt, evidence digest and exact settlement; null reason |
| `quarantined` | preserve prior attempt/evidence digest or null; clear settlement; require an allowed reason |

A non-null evidence digest always requires a non-null attempt, including in
quarantine. Recompute the allocation digest on every read; the record must not
silently accept a changed session/run allocation because its request is equal.

Allowed quarantine reasons are `host-invalid`, `effect-uncertain`,
`settlement-uncertain`, `foreign-incarnation` and `authority-changed`.
The verified settlement object is strictly:

```text
{ schemaVersion: 1, attemptId, issuerIncarnationId,
  preparationIssuerIncarnationId, startAuthorityRevision,
  adapterConfigurationDigest, nativeEvidenceDigest,
  referenceRevision: 1, evidenceKind: "synthetic-native-start" }
```

All repeated values must equal the record. The private service verifier alone
invokes the settlement CAS after host validation; no request selects this phase.
Transitions compare the exact old row JSON, key, digest, issuer, attempt and
allowed phase in short transactions. Do not hold a transaction while awaiting
Native. No raw events, prompts, resume state, usage or copied Native run/session
objects belong in these receipts. Authenticated `identity.ownerEmail` is the
existing identity field; fixtures use an obvious synthetic address.

## Admission and settlement

Keep an independent 04d admission gate and per-operation active token. After
every awaited boundary check both 04d admission and `lease.assertLive()`; check
them synchronously immediately before Native invocation, candidate/settlement
CAS and success return. Revalidation never reopens a closed gate. Concurrent
matching operations cannot steal an active invocation.

The guard admission is a strict six-field object in this exact insertion order:

```text
{ schemaVersion: 1, operation: "runtime-start", operationId: preparationId,
  requestDigest, collectionId, deviceId }
```

The service constructs it from the freshly validated start intent. Its
`requestDigest` is the start request digest above; collection/device come from
the current prepared identity and equal the outer scope. Reject any substituted
value, unknown field or alternate operation. Pass a fresh parsed clone to
`guard.executeOnce(admission, invoke)`; never accept a caller-supplied admission,
grant or completion marker. Returned sentinel validation and scope ownership
are separate from the serializable admission object's shape.

1. Enter `withPreparedForStart`. Resolve fresh start grant/configuration from
   its validated preparation. Compute the complete start intent. For start only,
   acquire `withCreationScope({ collectionId, deviceId }, callback)` and one
   `guard.executeOnce` with the exact six-field admission above. Check the
   prepared scope matches the actual admitted scope. Revalidate preparation and
   start authority inside admission before any reservation.
2. Strictly read/reserve the start receipt. Changed request conflicts; changed
   current authority/configuration refuses. A same-incarnation `reserved` row
   may proceed only after the original invocation settled without entering
   `starting`. Quarantined/starting/candidate rows never resume an effect.
   Foreign 04d issuers always return recovery, including verified receipts;
   attempt exact-row foreign quarantine without scanning or changing its issuer.
3. Verify allocated IDs and exact prepared thread. The fixture checks existing
   same-thread runs and session/run ID collisions before invocation and proves
   isolation against competing writers. These checks are not atomic production
   exclusion. CAS `reserved -> starting`, revalidate both authorities and gates,
   then invoke actual public `startAgentHarnessRun` exactly once with only
   trusted fixed options and the allocated IDs.
4. Capture exactly one public `runOptions.waitUntil` promise, retain ownership
   of the synthetic session and pending callbacks, and await controlled turn
   settlement within the packet deadline. Verify the returned run identity,
   adapter-created session identity, actual public thread/session/background
   association and fixture-only SQL evidence below. A fulfilled promise does
   not override a failed or missing durable write. Revalidate current authority
   and preparation, then CAS `starting -> reference-candidate` with the evidence
   digest. No host callback may write `reference-verified`.
5. Require the 04c-style two-layer host completion observation: distinct private
   sentinels, exactly one invocation, and callback settlement already observed
   when each host promise settles. Close callback gates immediately. A later
   drain cannot repair an early, duplicate or substituted completion. Invalid
   host completion permanently closes 04d admission before quarantine, even if
   quarantine fails and leaves `reserved`. Do not expose a reopen operation.
6. Outside the completed host scope, while the 04c receiving handle remains
   live, revalidate both authorities, exact preparation and Native evidence.
   Require the same evidence digest. CAS the exact candidate/attempt/issuer to
   verified settlement. Reread receipt and Native identity, revalidate grants
   and both gates, then return success. The receiving method performs its final
   check before passing success to the caller. No Native mutation occurs here.

Verified replay and reference resolution repeat current preparation/start
authority and exact Native checks; a marker alone grants nothing. The reference
is exactly `{ schemaVersion: 1, referenceRevision: 1, bindingIdentityDigest,
nativeThreadId, nativeSessionId, nativeRunId, harnessName }`. Label synthetic
evidence in the surrounding result/receipt and fixed harness identity; the 04b
reference schema itself is strict and must not gain an extra field.

Revoked/cancelled admission before the effect refuses with zero runner calls.
After `starting`, any create rejection, ID mismatch, lost reply, persistence
uncertainty, authority loss or failed candidate/settlement write returns recovery
or the applicable bounded authority refusal and attempts quarantine. It never
retries, adopts, deletes Native state or claims that an abort/stop succeeded.
No product cancel API is added. The fixture owner must still drain/terminate its
own controlled effects and prove cleanup; that is not external-runtime stop
semantics. New service incarnations refuse old receipts. These local gates and
CAS losses do not establish cross-process fencing or death of an old issuer.

## Native evidence and fixture ownership

Use the actual public runner and adapter interface with the fixed synthetic
adapter. Do not replace the runner/store implementations with mocks for the
positive case. The injected fixture-only observer uses public
`getThread`, `getAgentHarnessSession`, `getAgentHarnessBackgroundRun` and
transcript reads, then parameterized exact-ID SQL against the disposable
database. No private run-store query is imported into a production service.
Reuse the reviewed 04c fixture-only schema initialization, including its pinned
private DDL seam if still needed; no fake run is started merely to create tables.

The observer returns strictly `{ schemaVersion: 1, nativeThreadId,
nativeSessionId, nativeRunId, harnessName, runRowDigest, runEventsDigest }` after
actually checking owner/org/thread/session/run/harness association, exact public
projection, the complete durable run row's successful terminal fields, and the
complete ordered contiguous run-event chain with its expected deterministic
output and terminal event. It compares stored/provider session identity to the
owned synthetic session and verifies its stream/detach callbacks are settled.
Missing, duplicate, malformed or mismatched evidence refuses. Public background
projection alone is not an independent run-row observation.

For row evidence only, recursively sort object keys, preserve array order,
represent any bytes/bigints using the accepted fixture convention, and hash
UTF-8 canonical JSON. `runRowDigest` covers the complete exact SQL run row;
`runEventsDigest` covers all complete event rows ordered by Native sequence.
Compute `nativeEvidenceDigest` from the ordered tuple
`[1, nativeThreadId, nativeSessionId, nativeRunId, harnessName, runRowDigest,
runEventsDigest]`. Recompute observations after host settlement and on replay;
require equal digest for this completed deterministic fixture. This observer
and evidence kind are fixture-specific, never a configurable production
capability assertion. Authority/root custody is verified separately.

Capture every column and full rows before/after each case and each inner
scenario that clears fixtures. Cover all four registry tables, `chat_threads`,
`agent_harness_sessions`, `agent_runs`, `agent_run_events`,
`agent_run_outcome_daily` and `agent_tool_ledger`, plus any additional Native
table the frozen runner/finalization path writes. Discover those writes before
freezing the fixture; expand evidence, not application schema. Record initial
schema contents and explicit setup allowances. Assert refusal boundaries do
not add Native effects; counts alone are insufficient. Keep per-scenario
counter baselines separate from setup, as in accepted 04c.

The private worker owns all synthetic sessions, promises, callbacks and exact
Native retention timers through cleanup. Await the captured Native completion
promise where available, close the database only after owned writes settle,
restore global descriptors, and prove natural worker exit plus outer process
group/service/cgroup absence. Never treat `onRunComplete`, session idle state,
an empty Native lookup or a successful stop callback alone as finalization.

## Done condition

One fresh authorized synthetic first start yields one exact prepared thread,
one newly associated Native harness session, one actual durable run and its
bounded event chain. Verified replay and the exact-bound resolver produce the
seven-field 04b reference without another runner call. A fixture connection to
the existing 04b reader confirms reference compatibility. Every refusal and
uncertain outcome has inspectable complete-row evidence and conservative replay.
All 13 accepted preparation regression cases still pass after the service-only
receiving addition. No production endpoint or real-runtime availability changes.

## Verify

Freeze sources, Core/dependency inputs, profile, expected cases, capture budgets
and reviewed proof driver before execution. Group start cases around:

1. Default/unconfigured and real-profile-unproved refusal; strict request,
   context and expected-identity validation; separate start grant and role denial.
2. Exact receiving lookup and Native thread; forged preparation ID/original
   operation, scope mismatch, stale identity/revisions, cancelled/unprepared
   phase, foreign issuer, active preparation/cancel/receiving contention, and
   retained handle rejection.
3. One real synthetic Native start and exact seven-field 04b read; matching
   replay/concurrency and changed-operation/configuration conflicts; zero second
   start. Include original operation/preparation ID disagreement.
4. Receipt key/digest/JSON/phase corruption, every redundant-field mismatch,
   null creation columns and isolation from register/create/runtime-prepare.
5. Grant/root/configuration changes before scope, before reservation/CAS,
   immediately before Native invocation, during final reads and settlement.
   Close 04c admission through another invalid preparation while 04d is paused;
   separately close 04d while another start is paused. Neither may escape a gate.
6. Adapter create rejection before and after an actual controlled fixture effect,
   missing/late created-session reply, wrong session/run/thread identity, Native
   save/run insertion failure or delay, and preexisting session/run/thread-run
   collisions. No uncertainty permits retry or adoption.
7. Early/retained/double/substituted guard and outer callbacks, including an
   actual pending Native effect and a durable candidate before invalid outer
   completion; close admission before failed quarantine and prove later replies
   cannot promote or re-admit.
8. Lost/failed candidate and settlement writes/replies; reference resolver
   suppression during uncertainty, stale preparation, deleted/mutated Native
   association and foreign 04d incarnation; old pending CAS loses to quarantine.
9. Controlled callback/stream finalization and timer cleanup, delayed observer
   completion, denied admission without an effect, and owned-resource cleanup on
   every refusal. Do not claim production cancellation/stop proof.

Run the unchanged 13-case preparation fixture as a separate serial phase of
the same reviewed job. The proposed envelope is 512 MiB aggregate Linux memory,
192 MiB Node heap, one CPU, zero swap, 64 tasks, plus 512 MiB Windows parent
allowance and 1536 MiB available-memory reserve. Proposed test-process deadline
is 180 seconds, worker deadline 120 seconds, and combined stdout/stderr capture
is 1 MiB per phase. Use the existing versioned BOOTTIME deadline policy and its
five-second stop grace; no new clock or runtime/model default changes. The outer
service ceiling is 430 seconds with five-second stop grace. The Windows
driver bounds its service launch wait to 470 seconds; that value is not a
whole-driver wall limit. Transfer, inspection, export and cleanup calls each
have explicit timeouts. The 512 MiB Windows amount is a declared admission
allowance, not an observed or enforced Job Object memory cap. Preserve these
distinctions in the result and receipt. Stop before launch if measured resource
headroom, fixture size or known Native behavior cannot fit these limits.

Only the reviewed supervisor may execute the first two commands below. They are
the child commands for the reviewed source snapshot, in separate serial
phases with frozen fixture environment/dependency bindings. The private proof
uses `source/packages/workbench` within its private proof stage as cwd and
absolute fixture paths under that same snapshot. The exact machine path belongs
in the private reviewed manifest. Preserve the original relative
source layout, including `scripts/fixtures` and the activity schema. Resolve
Native packages through the existing hash-pinned test loader against installed
Core, and import the unchanged HoH supervisor from the existing checkout.
Copy only the declared sources and dependency closure; do not change product
files in the canonical or Habitat checkout during this proof. Bind every
snapshot file and original product preimage in the manifest and verify them
afterward. Runtime evidence applies to those exact bytes; canonical publication
must match them before packet closure. This block
does not authorize an unbounded direct launch. After canonical publication and
runtime proof, the lead runs the remaining existing checks:

```console
node --max-old-space-size=192 --test --test-concurrency=1 --test-reporter=tap packages/workbench/tests/project-runtime-preparation.test.mjs
node --max-old-space-size=192 --test --test-concurrency=1 --test-reporter=tap packages/workbench/tests/project-runtime-start.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

The frozen outer verifier must require exact named START/PASS case lists in
order, zero failed/skipped cases, natural worker exit, cleanup markers, the
complete snapshot/observation manifest with independently recomputed hashes,
and before/after equality of frozen source/dependency inputs. It must record
actual cgroup memory peak/events, deadline policy/audit, process exit and owned
group/service/cgroup absence. Refusal-case setup allowances belong to named
observations, never unexplained aggregate counts. A candidate receipt, worker
success line or archived file alone cannot set acceptance. Export a checksummed
archive, preserve any failed attempts, and verify exact cleanup before acceptance.

The canonical packet remains `Verification-kind: runtime` and
`Verification-result: not-run` until those checks pass. Only the lead may then
set `Verification-result: passed`, `Status: done`, and an `Evidence` link to the
accepted canonical receipt. Parent 04 and real-runtime availability stay open.

## Stop conditions

Stop the affected operation if current authority cannot be coupled to the
effect, an exact prepared lookup needs a scan/new store, a Native uncertainty
would require retry/adoption, the receiving API reacquires the host scope, a
receipt reader assumes another namespace, an unexplained Native write appears,
or the verified resource/cleanup limits cannot hold. Report the precise owner
and smallest correction. Keep candidates unavailable when durable evidence or
ownership cannot be established. Continue independent compatible work.

Do not replace missing production guarantees with booleans, metadata, fixture
SQL, adapter flags or matching IDs. Do not promote the synthetic result into
real project execution or scoped chat. The lead must claim this packet before implementation dispatch.

## Log

The lead owns the canonical `receipts/04d-project-native-start.md` and one final
verified evidence archive. Those outputs are created during delivery, not required
as a prerequisite to implementing this packet.

- 2026-09-08: Private executable-packet draft prepared from accepted 04c evidence
  and receiving-seam review. Corrected the original preparation-ID-only lookup,
  fixed single host ownership, and selected public `runOptions.waitUntil` plus
  fixture SQL for controlled Native completion evidence. Awaiting lead review;
  no implementation, execution, canonical claim or acceptance performed here.
- 2026-09-08: Tightened the exact six-field guard admission, row/intent/port
  contracts and cross-field equalities; replaced the private proposal dependency
  with canonical sources and added literal supervised verification commands and
  acceptance checks. Still a private draft awaiting lead publication/claim.

- 2026-09-08: Lead accepted the receiving seam, strict receipt and bounded synthetic Native proof contract. Packet ready; implementation awaits the serial writer after 06e. No source or runtime behavior changed.

- 2026-09-08: Lead claimed 04d for the existing serial Sol writer. Stage only the owned three new files and narrow preparation receiving seam in the task directory while 06e build inputs remain frozen. No runtime execution until reviewed inputs and resource admission.

- 2026-09-08: Independent review accepted the corrected three source modules for source-only evidence. The fixture remains under correction. Lead approved a private source snapshot so serial04c/04d proofs need not change the frozen06e build inputs. Generic supervisor review accepted preserved deadline JSON/audit, exact source checks and cleanup; final fixture/parser/manifest review and actual execution remain required.

- 2026-09-08 Habitat availability checkpoint: Production sources and event, full-row, lock-timing and cleanup assertions passed source review. Packaging caught a missing fixture and creation API/input mismatch in the final namespace case; correction using the verified 04c mechanism passed independent source review. Final fixture SHA-256 fd73accfc7e18055fe2603fd6b398621214cc15c70c082ea880b531f52bce1b2 (116298 bytes). Private proof snapshot is frozen; no runtime launched. Habitat remains stopped after repeated `HCS_E_CONNECTION_TIMEOUT` availability failures. No test process launched; shared WSL/Docker were not restarted. Runtime requires restored availability and fresh resource admission.

- 2026-09-08 frozen source preparation checkpoint: The corrected four-source Native snapshot and drivers are frozen. Six inert witness-parser tests passed. Actual Native first-start proof remains unrun. Private source freeze: `04d/native/reviewed-source.json`; SHA-256 `4b21f0b676a3dc8f6d1d2bec57d93fb9427ccbeb9750aeb70e18544243dffad0`. Repeated no-op Habitat startup checks returned `HCS_E_CONNECTION_TIMEOUT`, including after a successful Habitat-only terminate command. No test started. Two unrelated Hermes containers remained running; shared WSL/Docker restart was not attempted. Runtime requires restored Habitat and fresh packet-specific resource admission.

- 2026-09-09: All 25 synthetic preparation/start cases passed in Habitat. Independent review verified the archive, full-row witnesses, callback refusals and pending-start quarantine regression. Four exact accepted sources are applied to the canonical checkout. The receipt owns verification limits and retained evidence. Parent 04 remains open.
