---
type: packet
---
# 17a: Quarantine a durable mutation admission
Parent: 17
Status: done
Depends-on: [12h, 06d, 03d]
Owner: Sol owns the isolated model, storage, action and fixture candidate. Astra owns contract acceptance, serial application, runtime evidence and cleanup acceptance.
Scope: One private active-to-uncertain transition for an existing no-VCS or Git admission. Keep every reservation claim and fence high-water. No release, cancellation, reconciliation, project/VCS effect or external-process fencing.
Verification-kind: runtime
Verification-result: passed
Evidence: [17a runtime and application receipt](../receipts/17a-quarantine-mutation.md)
Timebox: One model transition, its existing Native/store composition, focused fixtures, one supervised Habitat proof, independent review and exact cleanup.

## Goal

Record uncertainty about an admitted operation without granting another writer
or substituting a replacement root. Later recovery packets must establish what
actually happened before releasing any key or replaying an effect.

## Context

Read project-registry R9, R11 and R12, the transaction map, outcome 17 and the
accepted 12h receipt. 12h persists the complete reservation, its fence and a
pending admission receipt. Outcome 17 owns the recovery lifecycle. This packet
adds its first conservative state transition, not a recovery coordinator.

Extend the existing registry decision model and transaction adapter. Native
policy remains the current authorization owner. No second policy engine,
receipt ledger, queue or process owner is needed.

## Owned files

Prepare isolated candidates under `.tmp/vivary-17a/candidate` for:

- `scripts/registry_contract_model.mjs`
- `scripts/tests/test_registry_contract_model.mjs`
- `packages/workbench/server/registry-actions.mjs`
- `packages/workbench/server/registry-store.mjs`
- `packages/workbench/server/native-registry.mjs`
- New `packages/workbench/tests/mutation-quarantine.test.mjs`
- `docs/product/multi-project/contracts/project-registry.md`
- `docs/product/multi-project/contracts/project-registry-transaction-map.md`
- `docs/product/multi-project/fixtures/project-registry.json`

Pin every existing canonical preimage and the new fixture's absence before
editing. Keep schema, migrations, root provider, installed dependencies,
lockfiles, all 06e files and existing admission/registration fixtures read-only.
Preserve every existing model operation and refusal order.

The current 06e proof owns any active source freeze. Isolated preparation and a
lead-reviewed candidate snapshot proof may proceed without changing shared
canonical or persistent files. Keep one heavy Habitat job active. Apply only
after that source freeze closes, after rereading all preimages, and with final
canonical/Habitat hash equality. No candidate proof establishes application.

## Done condition

1. Add `quarantine-mutation` to the existing model and one strict private Native
   action. Its exact request fields are `operationId`, `bindingId`, `fence`,
   `expectedPolicyRevision` and `expectedRegistryRevision`. The operation ID is
   the existing admission operation ID. IDs use the existing identifier shape;
   fence/policy are positive safe integers and registry revision is a
   nonnegative safe integer. Caller paths, resource keys, root/VCS identities,
   actor/collection/device scope and receipt contents are forbidden.
2. Reauthorize the current Native `project-mutator` role and `mutate-project`
   capability at the existing action and transaction boundaries. Preserve the
   registrar role. Quarantine facts contain authenticated scope and current
   policy, with unused root facts explicitly unverified. Never call
   `provider.observe`, select a replacement root or require a current binding.
   Root loss, replacement and later binding changes must not prevent a properly
   authorized actor from quarantining their exact historical admission.
3. Select the scoped `admit-mutation` receipt namespace. Do not compare a new
   quarantine request digest with the original admission digest or insert a
   second receipt. Load the receipt, its reservation parent, complete claims,
   selected high-waters and scoped registry revision inside one transaction.
4. In the existing model, validate current authorization/policy before any
   admission lookup or projection. Branch for quarantine before live-root
   validation and generic admission replay. Validate the receipt-derived
   complete sorted key set, exact owner scope and operation, binding ID, fence,
   normalized reservation and immutable receipt identity. Never derive ownership
   from a later observation. Keep SQL envelope integrity in the existing store
   loader: receipt columns must match its record; complete key claims must equal
   the parent keys; exactly one high-water row per selected key must equal the
   reservation fence. Missing, lower or higher high-waters and inconsistent
   columns/claims return `invalid-input` with zero writes, including repeats.
   The model receives normalized records and owns authorization, identity,
   lifecycle, revision and replay decisions; it does not receive raw SQL rows.
5. For a valid `pending` receipt and `active` reservation, require the expected
   registry revision and a safe increment. Atomically advance it once, replace
   the reservation state with `uncertain`, and replace the original receipt
   status with `uncertain`. Preserve every other receipt/parent field, all key
   claims, every fence high-water, and all project/binding rows.
6. Guard all three writes with their loaded identities/values. Extend the
   existing model's atomic transition support for receipt/reservation
   replacement and the admission namespace; the store implements its guarded
   persistence and adds no parallel decision rules. Commit all changes or none.
7. A currently authorized exact `uncertain`/`uncertain` repeat returns
   `replayed: true` with zero writes, before stale registry-revision and
   increment-limit checks. It still validates the exact admission identity and
   fence. Mixed or unsupported lifecycle states require reconciliation with
   zero writes. A revoked role or stale policy refuses even for a repeat.
8. Success returns only `{code: "quarantined", bindingId, ownerOperationId,
   fence, replayed}`. Use `admission-unavailable` for no scoped admission,
   `denied` for failed authorization, `stale-policy`, `stale-fence` for a target
   binding/fence mismatch, `invalid-input` for inconsistent records,
   `retry-state` for revision/CAS failure, and `reconciliation-required` for
   unsupported lifecycle states. No refusal exposes foreign admission data.
9. Disable HTTP, agent tools, MCP, extension calls and public discovery for the
   new entry. Keep audit input private. Add no runtime trigger, scheduler,
   timeout-to-release path, cancellation claim or production activation.
10. After quarantine, an otherwise admissible same-key or cross-collection
    contender returns `reconciliation-required`. Preserve the 12h pending retry
    and operation-digest conflict behavior. Obtain independent model/source,
    runtime evidence and final application review before closing the packet.

## Verify

Extend the existing pure model fixtures and test runner. Prove the Native
action/store against configured SQLite with complete before/after SQL rows and
unchanged project/Git trees. Use real 12h admission setup, not hand-written
success receipts. Synthetic setup may create Git repositories/worktrees only
inside the disposable proof root before unchanged-tree snapshots.

The finite witness ledger must cover:

- First no-VCS and Git quarantine, exact three-row transition and preserved keys.
- Restart persistence and exact replay, including stale expected registry
  revision and maximum registry revision on an already uncertain owner.
- First-transition revision mismatch and safe-integer exhaustion with zero writes.
- Wrong operation, binding, fence, actor/collection/device scope and current
  grant/policy refusal, with no foreign projection.
- Missing/replaced roots and changed/missing live binding, while proving zero
  observation calls and preservation of historical admission identity.
- Inconsistent receipt/parent identity, incomplete/foreign claims, contradictory
  fence high-water and mixed lifecycle states, with zero writes.
- Independent-process duplicate quarantine: exactly one transition, then an
  idempotent result or explicit bounded retry; no double revision increment.
- Same-key and cross-collection admission contenders remain quarantined.
- Injected failures at revision, reservation and receipt writes roll back all rows.
- Unchanged registrar behavior, admission replay/conflict order, Native policy,
  project/Git bytes and private action transport metadata.

Freeze exact source-derived counts and commands before dispatch. Run these seven
phases through the existing reviewed Native dependency bootstrap where needed:

```console
node --max-old-space-size=192 --test scripts/tests/test_registry_contract_model.mjs
node --max-old-space-size=192 --test packages/workbench/tests/mutation-quarantine.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/mutation-admission.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-actions.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-store.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-vcs-registration.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-registry.test.mjs
```

The new focused phase emits one bounded `VIVARY_17A_QUARANTINE_WITNESS` JSON
record with finite case IDs, exact SQL before/after rows, current authorization
and observation counters, child settlement and project/Git inventories. Inspect
the raw evidence independently; a summary count cannot prove transitions.

## Runtime and cleanup limits

Reuse the existing Habitat checkout and installed dependencies. Freeze one
disposable candidate root, seven commands, source/dependency hashes, finite
processes, output bounds and an exact cleanup allowlist. Keep the accepted 12h
profile: 512 MiB Linux, zero swap, 64 tasks, one CPU, Node heaps at 192 MiB, and
512 MiB for the observed Windows owner. Preserve 1536 MiB host reserve, require
2.5 GiB fresh warm memory and 10 GiB free disk. Keep one heavy job active.

Each phase has at most 180 seconds and one MiB combined output. The global
service/host caps remain 940/980 seconds, with 70 seconds reserved for cleanup
and five-second owned process termination grace. These global caps may stop a
slow run before every phase uses its individual allowance. Do not bypass a
resource observer failure by dispatching work as cleanup. Retain bounded failed
attempt evidence. Export and verify the final archive before exact stage removal.

## Stop conditions

No release, reconciliation decision, re-admission, effect replay, project write,
service-time Git command, process cancellation, runtime start, public endpoint,
credential use, paid call, dependency installation, new persistent checkout,
publication, push or merge. An uncertain row does not prove a writer stopped.
Keep unsupported platforms and cross-device fencing unclaimed.

## Log

- 2026-09-09: The lead selected the conservative uncertain-owner transition after
  accepted 12h application. It extends the existing model and atomic store under
  continuous implementation authority. The packet specifies required registry
  CAS, authorized idempotent replay and historical admission identity before
  implementation. Broader outcome 17 completion still requires its remaining gates.

- 2026-09-09: Independent packet review accepted the model/store ownership and clarified that SQL envelope, complete claim and exact high-water integrity stay in the store loader. Sol claimed isolated source preparation; runtime and application remain pending.
- 2026-09-09: Trial08 passed six preflights and 89 assertions across seven suites, including the complete 40-case quarantine witness and 14 Native VCS operations. Independent review accepted source bindings, raw results, resource controls and cleanup. The private 122-binding runtime archive has SHA `fa15187c2a10b83add4cbc86126ffea55e9a470931c09d7f86e079b84f0937fc`. Candidate runtime acceptance has SHA `2e7dd37e37d4fdd998d04086722999140af274c29e95990685707b96ac408201`.
- 2026-09-09: Two later application preflights refused the fixed warm-memory admission threshold before checker or receiver dispatch. The second retained 60 samples and timed out without reaching 2,560 MiB. All recorded Windows identities are absent. Source application and packet acceptance remain pending; preserve the held unrun 06e freeze until a fresh absence check passes.

- 2026-09-09 (2026-09-10 UTC): The third application preflight passed the fixed warm-memory gate.
  Root retired the held unrun 06e freeze, applied the nine accepted files serially to canonical
  and Habitat, and verified exact readback. Final activity found Habitat stopped. Independent
  review accepted the 68-binding application archive and final application receipt
  `5e182a234be2dfdd5b7d303960595a859688e7042bf5ffbca374efecd4f09050`.
  Packet 17a is complete. Outcome 17 recovery gates and the separate 06e proofs remain open.
