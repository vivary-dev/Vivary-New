---
type: packet
---
# 03d: Preserve VCS consistency on registry replay and duplicate registration

Parent: 03
Status: done
Depends-on: [12f, 03c, 06a, 06b]
Owner: Sol registry_vcs_consistency is the sole implementation writer for the seven owned files; Astra independently reviews; the lead owns canonical application, proof dispatch and acceptance.
Scope: Two registry VCS-consistency predicates, their contract/oracle fixtures, registration output validation and bounded Native SQLite evidence.
Verification-kind: runtime
Verification-result: passed
Evidence-record: 03d
Evidence: [03d runtime acceptance receipt](../receipts/03d-vcs-replay-consistency.md)
Timebox: One focused contract/model/action change, independent review and supervised Linux proof.

## Goal

A completed registration/rebind replay must still refer to the same complete VCS
identity. A new-key registration must not issue an `already-registered` receipt
whose VCS identity disagrees with its existing binding. Refuse those cases using
existing result codes, without changing identifiers, records or effect authority.

## Context

Read root instructions, the execution contract, and accepted packet/receipt pairs
for 12f, 03c, 06a and 06b. 12f supplies the inspected gap; 03c supplies transaction
ownership; 06a/06b supply the existing Native storage/action proof and reusable
test harness. Those packets must be done/passed before the lead claims 03d.

Read `contracts/project-registry.md` R4, R9-R11 and validation order, then
`scripts/registry_contract_model.mjs` validation, `same`, `replay`, duplicate
registration and atomic transition logic. Read Workbench's package instructions
and the existing action/store tests before editing their owners below. Treat
`packages/workbench/server/registry-store.mjs` as a read-only implementation input.

The lead accepted these semantic rules as an agent-owned contract extension:

| Operation | Required equality | Refusal |
| --- | --- | --- |
| Completed same-key `register` or `rebind` replay | `receipt.vcs`, current `binding.vcs` and current `root.vcs` must all be canonically equal | `superseded-operation` |
| New-key duplicate registration with one authorized same-root binding | Existing `binding.vcs` must be canonically equal to current `root.vcs` before constructing a new success receipt | `stale-binding` |

Use the existing `same()` comparator over each complete validated VCS object.
It compares values independently of object key order. Include kind, repository,
checkout and owner, plus both Jujutsu identities when present. Malformed shapes
remain R1 `invalid-input`; do not normalize a mismatch away or coerce an
unsupported/unresolved identity into another kind.

This packet does not connect real Git observations to Native registration. The
later outcome-12 forwarding packet uses these accepted semantics. It also does
not alter the original 12f inspection's historical description of pre-03d code.

## Owned files

The implementation writer may edit exactly these seven canonical files, staged
for lead application through the existing private continuation workflow:

1. `docs/product/multi-project/contracts/project-registry.md`
2. `scripts/registry_contract_model.mjs`
3. `docs/product/multi-project/fixtures/project-registry.json`
4. `scripts/tests/test_registry_contract_model.mjs`
5. `packages/workbench/server/registry-actions.mjs`
6. `packages/workbench/tests/registry-actions.test.mjs`
7. `packages/workbench/tests/registry-store.test.mjs`

The lead owns this packet, its receipt, outcome/frontier metadata, any current
transaction-map pointer, the existing handoff, and bounded proof drivers/evidence.
Coordinate shared documentation serially. Keep the production registry store,
provider, lifecycle, database schema/migrations, HTTP module, GUI, runtime modules
and dependency graph read-only. A demonstrated need to change an unowned file
requires a specific ownership amendment before that edit.

You are not alone in the codebase. Other writers own 04d, 06e and 20f. The lead
must serialize snapshots and refreeze affected 04d/06e build/proof dependencies
before applying canonical code. Do not overwrite a frozen source, mix dependency
generations, reset another writer's changes, or require unrelated packet acceptance.

## Implementation requirements

1. Preserve R1 validation, then current authorization/resolved-record scope,
   policy, root access and verified current identity before R9. Within replay,
   retain receipt scope, request digest and receipt-status decisions ahead of
   the new complete-VCS comparison. Keep existing project/binding/root/revision
   checks. Both equality predicates belong to the existing replay owner.
2. A pending/uncertain receipt continues to return `reconciliation-required`.
   A changed same-key request continues to return `operation-conflict`. A valid
   completed replay still ignores the old requested registry/binding revisions;
   compare the current result's binding revision instead. Admission retries and
   export/write-back behavior remain unchanged.
3. In new registration, retain attachment and overlap/uniqueness ordering. Once
   exactly one authorized same-root binding is selected, compare its VCS object
   with the observed one before constructing `already-registered`, inserting a
   receipt or checking the new transaction's expected registry revision. Do not
   rewrite the binding, allocate replacement IDs or automatically rebind.
4. Reuse `superseded-operation` and `stale-binding` exactly. A verified observation
   is not `identity-unverified` merely because stored records disagree; one known
   binding is not ambiguous ownership. R11's `read-only`/`busy` decisions do not
   become registration refusals for this mismatch.
5. Add a strict `{code: "stale-binding"}` branch to registration output validation
   only. Preserve export's existing output schema and every public success
   allowlist. No refusal may include project/binding/VCS IDs or private details.
6. The production store already loads the relevant VCS records, allocates only
   after a new `registered` decision, and applies only declared record changes.
   Reuse that path. Do not add a second comparison policy or state store there.
7. Update the owning contract, fixture expectations and model together. Add
   focused deliberate mutants that remove each new predicate and prove the
   oracle kills them. Keep unrelated fixtures and mutation coverage intact;
   calculate reported case counts from the actual selected fixture set.

## Done condition

The pure oracle must prove:

- Completed registration and rebind replay accept three equal VCS objects,
  including differently ordered keys, and reject a change isolated to each of
  the receipt, binding and current observation. Cover valid changes to kind,
  repository, checkout, owner and Jujutsu repository/workspace identities.
- Matching completed replay remains eligible with old requested revisions and
  at the safe-integer increment boundary, because it makes no new increment.
  Existing binding/result identity checks remain effective.
- Foreign scope/current authorization, stale policy and unverified current
  identity retain precedence over replay mismatches. Digest conflicts and
  pending/uncertain receipts keep their established earlier results. Malformed
  VCS shapes remain `invalid-input` before semantic comparison.
- A valid single-binding duplicate mismatch returns `stale-binding`, including
  when its expected registry revision is also stale. A matching duplicate still
  advances only its completed receipt and registry revision, once. Matching
  same-key replay makes no changes. Attachment and ambiguous-overlap precedence
  remain unchanged; new-root registration still follows its existing rules.
- Every refusal is exactly `{output: {code}, effects: [], recordChanges: {}}`;
  atomic application preserves the original state. Each removed-predicate mutant
  fails a named expected case.

Actual Native SQLite tests must additionally prove:

- Register valid synthetic Git facts through the existing store/actions, then
  supply the mismatch cases through their real record-loading paths. Use exact
  contained fixture rows when a saved binding or receipt must be changed for
  setup; no production backdoor or new product fixture mode.
- Snapshot all registry projects, bindings, receipts and revision rows before
  each attempted operation. A mismatch leaves every row and revision unchanged,
  invokes the allocator zero times, and reports no registry effects. Fixture
  setup changes are outside that interval and clearly labeled synthetic facts.
- Native registration output accepts only the bounded `stale-binding` refusal;
  an added private field fails strict output validation. Existing successful
  replay and duplicate flows still pass through the actual native action/store.
  Native audit remains a separate permitted after-handler record, not part of
  the unchanged registry-row assertion or a replacement transaction receipt.

Reuse the existing test workers, loaders, migrations and snapshot helpers. Add
focused cases to those harnesses; do not fork a complete Native test application.
Pass `--max-old-space-size=192` explicitly in every child Node invocation in
the two owned Native test files. Their worker launchers discard outer Node flags
and filter `NODE_OPTIONS`, so setting only the parent flag is insufficient.
Keep each inner worker's stdout and stderr buffers bounded and record their
aggregate allowance separately from the supervisor's combined exported capture.
Native evidence here proves synthetic identity decisions and SQL behavior, not
physical Git identity, production authentication, a filesystem effect or fencing.

Independent review must accept source, expected cases, actual output and row
witnesses, artifact hashes and exact cleanup before the lead marks 03d passed.
The accepted packet then satisfies the outcome-03 prerequisite for forwarding;
it does not complete outcome 03, outcome 12 or a release gate.

## Verify

Use the existing authorized Linux Habitat checkout and installed Native dependency
graph named by the private handoff. No installation or new environment is needed.
After implementation design, freeze the exact source/dependency hashes, selected
commands, phase count, evidence destinations and outer supervisor deadline before
execution. Verify each transferred source hash. Do not run concurrent heavy jobs.

The proof profile is:

- Linux aggregate cgroup memory: 512 MiB; zero swap; one CPU; 64 tasks.
- Node heap ceiling: 192 MiB per Node process, within the aggregate cgroup cap.
- Windows parent allowance: 512 MiB outside that cgroup.
- Required host reserve: 1536 MiB, giving 2.5 GiB fresh available headroom before
  launch for Linux allowance, Windows allowance and reserve together.
- Each phase has an absolute Linux `CLOCK_BOOTTIME` deadline 180 seconds from
  phase start, plus at most five seconds of termination grace. Capture combined
  stdout/stderr up to 1 MiB per phase. Every descendant and capture path shares
  the phase deadline and bounded accounting.

Freeze the actual phase count and outer deadline after selecting the existing
test commands and cleanup path. The outer deadline must cover the finite selected
phases and their explicit cleanup/grace allowances; never create an open-ended
retry loop or reset a phase deadline while work is still running.

Preflight verifies current tools, cgroup/deadline enforcement and fresh resource
headroom. It does not require this exact new test suite to have passed previously
under the profile. Its first bounded run supplies that evidence. Insufficient
headroom or missing enforcement blocks only runtime dispatch; continue independent
source and fixture work. Missing tools are failed preflight, not passing skips.

Selected command targets are the existing suites:

```console
node --max-old-space-size=192 --test scripts/tests/test_registry_contract_model.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-store.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-actions.test.mjs
```

Use the existing private dependency/proof-root inputs required by those suites;
the lead records their resolved paths in private launch evidence. Record actual
counts, deliberate-mutant outcomes and failures. Confirm all descendants stop
and capture settles before exporting evidence or starting another attempt.

After lead application, run the canonical planning/source-navigation/line-ending
and diff checks. Those checks prove document consistency; the Native suites own
the SQL and action claims. Export exact reviewed sources, commands, results,
before/after SQL witnesses, zero-allocation observations, bounded resource data,
independent review and cleanup evidence in one verified final artifact.

## Stop conditions

No actual implementation until the lead claims this packet. No root-provider
forwarding, real project/Git observation or mutation, schema/migration change,
new framework API, GUI/runtime activation, restart reconciliation, reservation
or fencing, new dependency/container/checkout, model call, account or credential
action, network Git, paid usage, scheduled activation, publication, push or merge.

Keep 12f's four reviewed outputs and other writers' frozen dependencies untouched.
If evidence requires broader semantics or another production owner, report the
exact case to the lead before dependent edits. Do not create a human approval
gate for routine compatible implementation.

Reuse one named ticket scratch directory and the existing proof harness. The
lead freezes exact disposable process, database and directory identities before
runtime dispatch, including contained cleanup authority. After a verified export,
remove only those authorized disposable resources; preserve shared caches and
other packets' sources. Report any retained unresolved evidence with its removal
condition in the receipt and keep the existing handoff current.

## Log

- 2026-09-08: Lead accepted the compatible registry consistency extension under continuous execution authority. Independent review accepted semantics, seven-file ownership and non-circular proof admission; explicit child heap flags and separate inner capture accounting address its two harness findings. Published ready for serial assignment. No implementation or runtime acceptance occurred.

- 2026-09-08: Claimed with all four prerequisites passed. The assigned Sol writer stages only its seven owned files in private scratch, disjoint from the active 04d fixture and 20f source. The lead serializes canonical application and all heavy execution. No frozen shared dependency is changed by this claim.

- 2026-09-08 Habitat availability checkpoint: Seven private staged sources passed independent source review after the safe-integer receipt-digest fix and current-binding/current-root Native replay variants. Three-phase proof drivers are being prepared; runtime remains not-run. Habitat remains stopped after repeated `HCS_E_CONNECTION_TIMEOUT` availability failures. No test process launched; shared WSL/Docker were not restarted. Runtime requires restored availability and fresh resource admission.

- 2026-09-08 frozen source preparation checkpoint: Seven accepted sources and three-phase drivers are frozen. Seven inert witness-parser tests passed, including exact numeric types, case-target binding and refusal of a no-op replacement. The success archiver passed independent source review. Actual oracle/storage/action proof remains unrun. Private source freeze: `03d/native/reviewed-source.json`; SHA-256 `c8a443d8cab38b45687a8005e0de02c1a946cbdb6245b881637de3eeb41cb25f`. Repeated no-op Habitat startup checks returned `HCS_E_CONNECTION_TIMEOUT`, including after a successful Habitat-only terminate command. No test started. Two unrelated Hermes containers remained running; shared WSL/Docker restart was not attempted. Runtime requires restored Habitat and fresh packet-specific resource admission.

- 2026-09-08 runtime acceptance: The frozen Habitat snapshot passed 78 tests: 47 oracle, 18 storage, and 13 action tests, with no failures or skips. The oracle evaluated 65 fixture cases and killed all seven deliberate mutants. Astra independently accepted the actual outputs, five unchanged-row witnesses, zero allocations, source hashes, resource limits, and exact proof cleanup. The linked receipt binds that review to the unchanged archive and records its limits.

- 2026-09-08 canonical application: The lead verified all seven canonical preimages and applied the exact accepted bytes. Readback matched every source hash. The canonical oracle passed 47 tests and seven mutants. Plan, source-navigation, line-ending and whitespace checks passed. Earlier 04d and 06e evidence is archived. Both dependent proof freezes must be reconciled before their next launch. Packet 03d is done. Physical Git forwarding remains with 12g.
