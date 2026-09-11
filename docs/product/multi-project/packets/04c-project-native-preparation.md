---
type: packet
---
# 04c: Prepare a project session with a durable intent and exact Native thread

Parent: 04
Status: done
Depends-on: [04b, 07e, 07f]
Required-successor: 04d project harness start and uncertain-start recovery
Owner: Sol runtime_readiness_writer owns the three implementation files; Astra reviews; the lead owns canonical packet, receipt and source-map updates.
Scope: Private server composition and controlled Native database fixtures. Production composition remains unavailable.
Verification-kind: runtime
Verification-result: passed
Evidence: [04c runtime receipt](../receipts/04c-project-native-preparation.md)
Timebox: One preparation service, one receipt module, focused fixtures and one bounded Habitat proof job.

## Goal

Prepare one project session by durably recording an authorized start intent and
creating its exact private Native thread. Return an opaque preparation ID that
04d can consume under fresh authority. This is the necessary preparation stage
of session start; it does not satisfy parent 04 or project chat by itself.

## Context

Canonical paths below are relative to the Vivary repository root.
Installed package evidence is relative to the preserved implementation checkout's
`node_modules/@agent-native/core`, verified as version `0.176.5`.

Read `docs/product/multi-project/tickets/04-define-runtime-session-contracts.md`,
`native-owners.md`, `source-map/modules/native-runtime/index.md`, the 04a/04b
packets and current 04b implementation, and the accepted 07e/07f packets and
receipts. 20a's role fixture is precedent for binding declared roles, not evidence
that a production Native harness enforces them.

The verified public seams are:

| Package surface | Evidence and consequence |
| --- | --- |
| `@agent-native/core/server`: `createThread(ownerEmail, { id?, title?, scope?, source?, orgId? }): Promise<ChatThread>` and `getThread(id)` | `dist/server/index.d.ts` exports the thread store; `dist/chat-threads/store.d.ts` declares these functions. `store.js`, lines 393–437, inserts the supplied ID using a strict insert and private visibility. Use a trusted newly allocated ID; a collision is a refusal, never adoption. |
| Mutable thread scope/data | `setThreadScope` and `updateThreadData` are public in the same declarations. Their contents can describe an association but cannot establish its trusted provenance. |
| `@agent-native/core/agent/harness`: `startAgentHarnessRun(opts): ActiveRun` | `dist/agent/harness/runner.d.ts`, lines 3–19, and `runner.js`, lines 24–43: adapter `createSession` occurs before `saveAgentHarnessSession`. A call can therefore leave an uncertain adapter session before a durable Native session reference exists. Do not invoke this function in 04c. |
| Public harness session save/update | `dist/agent/harness/store.d.ts`, lines 24–46, exposes Native session fields. `store.js`, lines 119–218, handles save conflicts through an update/CAS path. It is not an immutable create-only project admission record. |
| Native run lifecycle | `dist/agent/run-manager.js` aborts an existing same-thread run in `startRun` around line 677; run insertion around line 810 is asynchronous, and execution begins around line 1454. Run-start safety needs its own 04d proof. |

Native remains the owner of threads, harness sessions, runs and transcripts.
The inspected public state has no create-only project start-intent association
covering Vivary's full binding identity. Store only that missing operation
provenance in the existing `vivary_registry_receipts` table. Do not add a session,
run, transcript, queue or usage table. A mutable Native scope or resume payload
does not become authority merely because it is stored by Native.

## Owned files

Add exactly these implementation files:

- `packages/workbench/server/project-runtime-preparation.mjs`: export
  `createProjectRuntimePreparationService(dependencies)`; the returned frozen
  object exposes `prepare(request, authenticatedContext)` and
  `cancelPreparation(request, authenticatedContext)`.
- `packages/workbench/server/runtime-preparation-receipts.mjs`: export
  `createRuntimePreparationReceiptPort({ db })`; its private
  service-facing operations are `read`, `reserve`, `beginThreadCreation`,
  `recordThreadCandidate`, `verifySettlement`, `quarantine`, and
  `cancelBeforeCreation`. This port only performs exact-key short transactions;
  it never acquires a host scope or invokes Native.
- `packages/workbench/tests/project-runtime-preparation.test.mjs`: controlled
  Native database fixtures and adversarial admission/recovery cases.

Use current package dependencies and public Native imports. Do not edit database
schema, 04b readers, app roles, routes, actions, GUI, harness implementation or
`node_modules`. Do not mount a production endpoint. Other writers own their
files; propose a concrete correction before expanding ownership.

## Exact records and authority

Use strict schemas: reject unknown keys, invalid Unicode, oversized values and
nonfinite or unsafe revisions. IDs use the existing 04b identifier bounds;
digests are lowercase 64-character SHA-256; positive revisions are safe integers.
Bound each encoded record to 16 KiB. Build digest inputs explicitly from parsed
values, never from caller object ordering. Use the encodings below exactly.

`prepare` accepts only `{ schemaVersion: 1, operationId, scopeKey, projectId,
expectedBindingRevision, expectedPolicyRevision, role }`. `role` is exactly
`planner`, `developer` or `qa`. It contains no owner, Native IDs, provider name,
execution path, root identity, grant, configuration or user prompt.
`cancelPreparation` accepts only `{ schemaVersion: 1, operationId, scopeKey,
projectId, expectedBindingRevision, expectedPolicyRevision }`.

The trusted resolver constructs the exact 04b identity fields:
`ownerEmail`, `orgId`, `actorId`, `collectionId`, `deviceId`, `projectId`,
`bindingId`, `bindingRevision`, `rootId`, `contentRevision`, `locationRef`,
`policyRevision`, `harnessName`, `runtimeVersion`, `executionLocation`,
`authorityContract`, `runtimeConfigurationRevision`.
For `bindingIdentityDigest`, construct a new object with properties inserted in
exactly the order listed above, matching `canonicalIdentity` in
`server/project-runtime-activity.mjs`. Hash the UTF-8 bytes of
`JSON.stringify(identity)` with SHA-256. Do not sort those keys or encode that
identity as a tuple; either changes 04b compatibility. The intent additionally
binds `role`, `roleContractRevision`, and
`preparationAuthorityRevision` supplied by trusted configuration/current grants.
Role selection is recorded intent in this slice, not a claim of enforced
runtime permissions. 04d must prove that enforcement before role work starts.

Dependencies are a trusted facts resolver, a separately granted preparation
authority, the accepted host-coordinator contract, a receipt port, trusted ID
allocation, and Native `createThread`/`getThread` adapters. Default composition
refuses. Snapshot and freeze startup configuration. Neither a registry read grant
nor the existing `project-registrar` role grants session preparation. Do not call
`defineAppRoles` again: `server/native-registry.mjs` already declares Workbench's
roles and Core rejects a second descriptor. Production role integration is open;
the controlled fixture injects a separately scoped preparation grant.

For `vivary_registry_receipts`, use `operation = "runtime-prepare"` and the
existing unique `(actorId, collectionId, deviceId, operation, operationId)` key.
Set `receiptKey` to `runtime-prepare:v1:` plus SHA-256 of the UTF-8 JSON encoding
of `[actorId, collectionId, deviceId, "runtime-prepare", operationId]`.
Leave all three `creation*` columns null. The strict JSON `record` is:

`{ schemaVersion: 1, preparationId, operationId, request, requestDigest, identity,
bindingIdentityDigest, role, roleContractRevision, preparationAuthorityRevision,
nativeThreadId, issuerIncarnationId, attemptId, phase, settlement, quarantineReason }`.

`request` is the complete strict validated prepare request, including `scopeKey`.
Define `requestTuple` as `[1, operationId, scopeKey, projectId,
expectedBindingRevision, expectedPolicyRevision, role]`. Recompute
`requestDigest = SHA256(UTF8(JSON.stringify([requestTuple, identity, role,
roleContractRevision, preparationAuthorityRevision])))` using the freshly
reconstructed fixed-insertion-order identity. This encoding is self-contained.
Compare row operation ID to record/request operation IDs; record/request role;
request/identity project ID, binding revision and policy revision; and all scoped
row columns to identity. Resolve the stored `scopeKey` again under current
authenticated context; the stored string is not a grant. Verify row and record
request digests, identity digest and key independently. No redundant field may
silently win over a conflicting value.

`preparationId` and `nativeThreadId` are distinct trusted random IDs allocated
once during reservation. `issuerIncarnationId` identifies this service owner's
process incarnation, allocated once at startup, never supplied in an API request.
`attemptId` is null at reservation and allocated once in the creation CAS.
`phase` is exactly `reserved`, `creating-thread`, `thread-candidate`,
`thread-prepared`, `cancelled-before-create` or `quarantined`.
`settlement` is null except in `thread-prepared`, where it is strictly
`{ schemaVersion: 1, attemptId, issuerIncarnationId, authorityContract,
runtimeConfigurationRevision }`, with all redundant fields matching the record.
`quarantineReason` is null except in `quarantined`, where it is one of
`host-invalid`, `effect-uncertain`, `settlement-uncertain` or `foreign-incarnation`.
Quarantine clears any settlement marker. Validate each phase's field combination;
reserved/cancelled records have null attempt and settlement; creating/candidate
records have a non-null attempt and null settlement; prepared records require
both; quarantine preserves the existing attempt or null and clears settlement.
No other transitions or freeform error text are allowed. No model prompt, secret, email
fixture from a real account, session/run ID, transcript, run status, resume data
or copied Native metadata belongs in this record. `identity.ownerEmail` is a
runtime authenticated value; test fixtures use an obvious synthetic address.

Validate column/record agreement, the exact key, digests and every identity field
on each read. Zero or one exact row is permitted; malformed, conflicting,
duplicate or stale rows refuse without repair or Native mutation. Creation code
currently filters `operation = "create"` in `creation-receipts.mjs`; registry
registration reads its exact register key in `registry-store.mjs`. Confirm every
reader, validator and cleanup caller still handles this namespace before reuse.
If any assumes all receipt JSON is creation/registration data, stop that change
and report the exact caller; do not silently widen its parser or add a new table.

## Admission, effects and recovery

The preparation service is the only host-scope owner. It calls 07e's actual
`withCreationScope({ collectionId, deviceId }, callback)` signature and uses
`guard.executeOnce` inside that callback. Receipt operations use the already
admitted service context and never reacquire the scope. New later requests may
acquire a new scope; there is no nested acquisition between service and port.
The host contract requires serialization of affected authority/configuration/root
changes with the entire admitted effect and callback settlement. An unrelated
local mutex is insufficient. A callback's return does not itself prove the host
met that contract.
Do not infer production custody or fencing from the accepted fixture proof.
Read accepted 07e/07f evidence for callback admission, invalidation coordination,
early host return, retained callbacks and quiescence limitations.

Under that scope, resolve authenticated owner/org, current scope, exact single
project binding, physical root/content, policy, runtime configuration and role
grant. Recheck current facts at admission before each transition or Native effect.
No caller-supplied revision is authority. Missing, ambiguous, changed or revoked
facts refuse. Complete each short registry transaction before awaiting a Native
operation; never hold a database transaction across `createThread`.

1. Reserve the intent with a create-only receipt insert. Same operation plus the
   same freshly authorized complete intent reuses it. Changed inputs return
   `operation-conflict`; changed current identity/authority returns `stale-claim`
   or `denied`. Concurrent matching calls admit at most one effect.
2. Before issuing Native creation, durably CAS `reserved` to `creating-thread`
   under current admission. Call `createThread` exactly once with the allocated
   ID, authenticated owner/org, fixed title `Project session`, and scope
   `{ type: "vivary-project-runtime-v1", id: bindingIdentityDigest }`.
3. Validate the returned thread ID, owner, org, private visibility and exact
   scope. While admission is still held, CAS `creating-thread` to
   `thread-candidate`. This records an observed thread write only. It is never
   replayable success and cannot be consumed by 04d.
4. The service must first observe valid settlement of both `guard.executeOnce`
   and the outer `withCreationScope`. Each wrapper uses a different unforgeable
   in-process completion sentinel and permits exactly one admitted invocation.
   At the instant each host promise settles, capture whether its callback has
   already settled successfully, the invocation count, and exact sentinel
   identity. Close its invocation gate immediately. Draining an outstanding
   callback later must not turn an early host return into valid settlement.
5. Only after both wrappers validate does the service use one short transaction
   outside the finished host scope to CAS the exact candidate/attempt/incarnation
   into `thread-prepared` with the settlement marker. The private verifier owns
   this path; no public request or caller-supplied `trusted` boolean can invoke
   it. The marker attests to the completed preparation, not continuing authority,
   so recording it does not require another host scope. It cannot invoke Native.
   A lost CAS or write reply is `recovery-required`, never assumed success.
   Before returning the opaque preparation ID, reread the exact receipt and
   current authority; revocation in the settlement gap suppresses success.

The critical invariant is structural: code inside either host callback can write
at most `thread-candidate`; only code after verified outer host completion can
write the settlement marker. If host completion is invalid after a candidate
write, durably CAS it to `quarantined`. Pending callbacks see closed gates and
their later candidate CAS cannot overwrite quarantine. If quarantine persistence
fails or the process dies first, the surviving candidate still cannot be used.
Delayed retained callbacks after a valid settlement are rejected before any
operation; they cannot perform a second effect or rewrite the completed receipt.

No later phase rewrites immutable intent fields. In the same live incarnation,
`reserved` is resumable under a new current admission only after the original
invocation has settled and its gates are closed: no Native call was admitted.
An active duplicate cannot steal the original in-flight operation. Invalid host
completion attempts quarantine even if the row is still reserved; a quarantined
reservation never resumes. Invalid host completion permanently closes this
service incarnation's admission gate before quarantine is attempted. If a
quarantine write fails with a reserved row left behind, another request through
that composition must still refuse. There is no reopen API. A new incarnation
refuses the old reservation as below. This gate supplements the durable receipt
protocol; it does not replace candidate/settlement markers or restart checks.
Creating/candidate receipts never resume effects. An insert collision, rejected
call, lost reply, mismatched result or failed completion CAS returns
`recovery-required`; attempt quarantine without claiming that a failed quarantine
write succeeded. Even finding an exact-looking Native thread later does not prove
which invocation created it; 04c never adopts it or repeats creation.

On restart, a fresh incarnation accepts no receipt from another incarnation,
including a previously `thread-prepared` one. An exact authorized lookup attempts
a monotone CAS to `quarantined/foreign-incarnation` and returns recovery regardless
of CAS outcome; it never converts that record to success. A still-running older
callback loses any later candidate/settlement CAS against the quarantined row.
Restart does not scan, repair, resume or delete all receipts. Same-incarnation
prepared replay requires an open admission gate, the durable settlement marker,
exact Native thread and fresh authority. Creating/candidate rows are intrinsically
unusable; the incarnation gate also covers a failed quarantine of a reserved row.
04d must apply these same checks and must not accept phase alone.

This deliberately sacrifices automatic recovery across restarts. It does not
prove that a former process is dead, prevent all its outstanding Native writes,
or stop it from serving another request. The smallest missing production guarantee
is a host-owned exclusive incarnation fence covering admission, authority changes
and all in-flight Native effects, plus evidence of custody through callback
settlement. An object callback contract cannot prove hidden early lock release
or process-death fencing by itself. Production stays unavailable until that host
guarantee is implemented and verified. Controlled restart fixtures explicitly
close old composition gates and demonstrate old pending completion losing its
CAS; label this receipt/replay proof, not production process fencing.

Cancellation admitted before creation CAS changes `reserved` to
`cancelled-before-create`; replay is inert. A cancellation after `creating-thread`
cannot claim rollback, deletion or that a run stopped. Return a bounded
`already-prepared` only for a currently authorized, same-incarnation verified
settlement, otherwise `recovery-required` consistent with durable phase;
require current authorization before disclosing which. Never delete Native data.
Revocation winning admission prevents the call; admitted creation winning first
must settle under custody before conflicting revocation commits. A timeout is
not proof that a pending Native database write stopped. Invalid host completion,
released custody, retained/duplicate callback or uncertain settlement cannot
produce success or permit another call. Persist quarantine when possible; a
remaining creating/candidate record is intrinsically unusable. Production
handling of host death and cross-process custody remains unconfigured.

## Done condition

The controlled Native database contains exactly the one intended private thread
and the operation receipt for a successful preparation. Native session, run,
event and transcript contents are unchanged. All refusal/replay/race cases have
their specified durable phase and zero additional Native effects. Default
composition refuses without any Native write. No actual adapter, runtime,
model/provider call or execution process starts.

04b's reference requires session and run IDs; 04c must not fabricate them or make
its resolver available. Record 04d as the next dependent executable packet:
consume a same-incarnation `thread-prepared` intent with a valid durable
settlement marker under fresh admission, enforce its
role contract, admit one harness start, establish durable exact session/run
references, and handle the verified pre-save adapter-session uncertainty.
Native cancellation/resume, stop confirmation, bounded production transcript
reads and production host/role custody remain open. Parent 04/06e stay incomplete.

## Verify

Implement named cases for: default unavailable; one exact preparation; matching
replay; concurrent duplicate; changed-request conflict; malformed JSON/key/digest;
duplicate/conflicting/stale intent; owner/org/actor/project/root/content/binding/
policy/runtime-version/location/configuration/role mismatch; registrar-only
denial; grant revocation before and during admission; early host return;
retained/double callback; reserved interruption; crash before Native call after
creation CAS; lost successful Native reply; ID collision; mismatched Native
return; candidate-write failure; invalid host completion after durable candidate;
early host return followed by delayed successful callback; guard/outer sentinel
substitution; settlement-write failure and lost settlement reply; failed durable
quarantine followed by replay; crash between candidate and marker; foreign
incarnation rejection of reserved/candidate/prepared receipts; pending old CAS
losing to durable quarantine; Native deletion/scope mutation on replay;
cancel-before-create; cancel-versus-create; and cancel-after-uncertain-create.
Add exact 04b identity-digest compatibility and full stored-request reconstruction
cases, including changed `scopeKey`, reordered incoming JSON and every conflicting
redundant field. Assert one scope acquisition and no nested receipt acquisition.

Seed register/create receipts beside preparation receipts. Prove existing
registration, creation parsing, reservation lookup and cleanup behavior remain
unchanged, including null creation columns and repeated operation IDs in distinct
namespaces. Record the inspected caller paths in evidence.

Use actual configured Native database adapters for thread creation and reads,
with synthetic owners/orgs. Fault hooks surround public calls; do not patch
framework internals. Compare sorted complete row snapshots/hashes before and
after for all touched and prohibited stores, not only counts. Assert exact
operation results, receipt phases and Native call counts. A separate review checks
that no harness start or hidden runtime call can enter the fixture path.

Reuse the existing Habitat/dependencies: one reviewed Native job, 512 MiB memory,
zero swap, 64 tasks, one CPU, 192 MiB JS heap, 120 seconds, and 1 MiB combined stdout/stderr per supervised
phase, with the fixture worker limited to 90 seconds. Freeze actual invocation and limits in the receipt. Use existing focused
test entry conventions; no install, account change, credentials, paid sandbox,
new checkout or parallel job. Run required repository checks only inside the
accepted bounded packet. Record source/test hashes, full result counts, resource
and process cleanup evidence, independent review and fixes before acceptance.

The lead freezes source and dependencies before running this entrypoint through
the reviewed supervisor, never directly without the packet's resource limits:

```console
node --test packages/workbench/tests/project-runtime-preparation.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Stop conditions

Stop the affected operation if receipt namespace compatibility fails, public
Native behavior differs, authority cannot remain coupled to the effect, an
uncertain create would need adoption/retry, or the resource envelope cannot hold.
Report the exact evidence and smallest owner correction. Do not substitute
mutable Native metadata for provenance, grant registry read authority for start,
turn fixture injection into a production route, or mark the parent complete.
Continue independent compatible work. The lead accepted this packet for one
Sol implementation writer. Source review, dependency freeze and resource
preflight still precede the sole bounded Native verification job.

## Log

The lead owns `receipts/04c-project-native-preparation.md` and one final private
verified archive. The receipt owns final accepted runtime evidence.

- 2026-09-08: Claimed after 04b acceptance and independent architecture review. Lead corrected the exact host signature, fixed-order identity encoding, complete request provenance, candidate/settlement distinction, conservative restart refusal and admission closure when quarantine persistence fails. Production host fencing remains an explicit gap.

- 2026-09-08: Accepted all 13 cases, 63 full-row snapshots and 59 observations after fixture and TAP corrections. Independent archive review and exact cleanup passed. Preparation remains private; 04d, production custody, roles and scoped chat remain open.
