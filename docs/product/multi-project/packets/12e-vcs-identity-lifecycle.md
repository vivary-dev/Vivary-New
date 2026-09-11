---
type: packet
---
# 12e: Preserve application VCS references under live lifecycle custody

Parent: 12
Status: done
Depends-on: [12d]
Owner: Sol vcs_identity_writer owns the lifecycle module and named tests. Astra lead owns review, runtime dispatch, evidence and canonical records.
Scope: Version the existing private lifecycle record to retain application repository and checkout UUIDs. No Native integration or mutation authority.
Verification-kind: runtime
Verification-result: passed
Evidence: [12e runtime receipt](../receipts/12e-vcs-identity-lifecycle.md)
Timebox: One lifecycle schema revision, inert migration, focused Linux physical fixtures, independent review, and exact cleanup.

## Goal

Give enrolled Git roots durable application repository and checkout references
while verification still requires the current owner's held physical descriptors.
Distinct project roots in one checkout share both VCS references. Linked
worktrees share the repository reference and have different checkout references.

These UUIDs name application records. They do not establish durable physical
identity, restore authority after restart, or serialize repository mutations.

## Context

Read outcomes 12 and 03, the accepted 12d packet and receipt, and
`packages/core/vivary_core/root_identity_lifecycle.py`. Use the existing
`physical_observe.py` and `registry_observe.py` as read-only dependencies.

`PhysicalCapture` already contains observer-lifetime repository, checkout, root,
and mutation-owner identities. Repository identity derives from held Git common
administration. Checkout identity includes held private administration and the
checkout root. This distinction already covers linked worktrees and nested
project roots. Physical captures and resource keys remain private.

`RegistryReadObserver` retains its issued capture and exposes read-only VCS
identity within that observer lifetime. It does not provide application UUID
records. `RootIdentityLifecycle` saves only root UUIDs and locator references.
Its custody comparison uses physical root identity alone, and its live results
omit VCS references. This packet closes those lifecycle gaps only.

Keep 12d's complete bounded locator inventory, exclusive local writer, pinned
metadata files, epoch invalidation, post-commit inspection, and restart refusal.
Its state recheck detects cooperative changes. It is not an atomic compare-and-swap
against a hostile writer using the same operating-system account.

## Owned files

The implementation writer may modify only:

- `packages/core/vivary_core/root_identity_lifecycle.py`
- `packages/core/tests/test_root_identity_lifecycle.py`

Add one focused test file:

- `packages/core/tests/test_root_vcs_identity_lifecycle.py`

Update existing lifecycle schema assertions for v2 without weakening their
security or cleanup assertions. Reuse the existing disposable-root test pattern
and `tree_state` helper. Add no dependency or production fixture mode.

The lead owns the canonical packet, receipt, source map, graph, and handoff.
Do not edit physical observation, registry observation, root providers, Native
registry/database code, Workbench, or other tests. Another writer owns 04b.
Preserve others' edits. If a demonstrated observer defect prevents the specified
behavior, report its exact case to the lead before proposing an owner change.

## Record schema decision

Use the same private file and writer lock. Set its schema to
`vivary.application-root-records/v2`. Keep the exact top-level fields:
`schema`, `device_id`, `revision`, `verification`, and `records`.
Persist `verification: "unavailable-without-live-custody"` for every state.

Each record has exactly `root_id`, `location_refs`, and `vcs`. Keep existing
`root_<32 lowercase hex>` IDs. Make `vcs` one of these exact tagged shapes:

```json
{"kind":"none","repository_id":null,"checkout_id":null}
{"kind":"git","repository_id":"repo_<32 lowercase hex>","checkout_id":"checkout_<32 lowercase hex>"}
{"kind":"unresolved","repository_id":null,"checkout_id":null}
```

Allocate repository and checkout IDs independently with UUID4. Do not derive
them from paths, Git remotes, commits, device/inode values, physical capture IDs,
or one another. `unresolved` records result only from explicit v1 migration.
They are historical records requiring reconciliation, not newly observed no-VCS
roots. The `git` tag records VCS kind, not permission to run Git commands.

Keep exact-field and duplicate-key rejection, device validation, safe integer
revisions, the 65536-byte file limit, and existing record/locator limits.
Reject malformed IDs, unexpected nulls, duplicate root IDs or locators, and a
checkout ID associated with different repository IDs. Shared repository/checkout
references across different roots are valid. Do not add repository tables,
sidecar indexes, journals, project markers, or a second store.

## Live identity and deduplication

Replace the private root-only custody value with a named immutable record
containing observer lifetime, physical root ID, physical repository ID,
physical checkout ID, and observed mutation owner. Keep all these values private.
Associate each custody record with the persisted application root/VCS references.

For a fresh enrollment, allocate or reuse IDs only from captures belonging to
the same current observer and from already enrolled records with live custody.
Reuse a repository UUID only for an equal held physical common-directory identity.
Reuse a checkout UUID only for an equal held checkout identity under that same
repository. Preserve one root UUID for physical aliases. Different physical
project roots remain distinct root records even when their VCS references match.

Never deduplicate against serialized VCS references without live custody. Never
choose the first matching path, content hash, Git remote, branch, or commit.
Reject conflicting live mappings or UUID collisions without saving a partial
association. Commit the root and both VCS references together through the existing
bounded atomic-replacement path.

Every later `enroll`, `inspect`, and enrolled-root `inspect_location` comparison
must check the full custody tuple. A changed root, repository, checkout, mutation
owner, or observer lifetime permanently invalidates this lifecycle owner. Keep
historical application IDs intact. Do not attach replacement administration or
silently allocate new IDs for a previously enrolled root.

Reinspect the full tuple after metadata commit before issuing a live result.
Normal content edits, branch changes, and dirty/detached observations can change
content revision without changing application IDs when descriptor custody holds.
Do not use the observer's content-conflict revalidation as a substitute for this
identity comparison, because 12d permits content revision changes.

Append optional `repository_id`, `checkout_id`, and `mutation_owner` fields to
`LiveRootIdentity` and `RootAvailability`, preserving existing positional fields.
Populate application VCS IDs only for an enrolled root under verified current
custody. An unenrolled root returns no application root or VCS IDs and allocates
nothing, even when it shares a physical checkout with an enrolled root.
Read-only inspection of an alias never saves that locator.

No-VCS records return null VCS IDs and a null mutation owner. Git records return
their application IDs and the observed owner label `git`. Keep
`mutation_authorized=False`, preserve live-result serialization refusal, and
document that the owner label selects no lock or mutation capability.

## Explicit inert migration

Strictly recognize v1 and v2 when opening the private file. Opening, inspecting,
or enrolling must never rewrite a v1 record implicitly. Opening either version
starts with no restored custody. Unresolved historical records continue to make
inspection and enrollment return `identity-reconciliation-required`.

Add trusted local method `migrate_legacy_records()`. It operates under the same
exclusive writer lock and metadata checks. For valid v1, retain every root ID,
locator reference, and device ID, add `vcs.kind="unresolved"` with null IDs,
advance the revision once, and write v2 atomically. Return only migration status,
schema, and revision. A v2 call reports already-current without changing bytes
or revision. A missing state reports nothing-to-migrate without creating a file.

Migration performs no physical observation, Git probe, UUID allocation, locator
adoption, or custody reconstruction. A failed migration preserves the prior
record where the existing write protocol can do so, otherwise invalidates the
owner and reports retained temporary metadata through `pending_cleanup`.
No failure returns verified identity. Unknown schemas and malformed v1/v2 refuse.

This is format migration only. Explicit reconciliation that can authorize reuse
after restart remains unavailable. Production migration rollout is outside this
packet. The method is exercised only against disposable test metadata here.

## Done condition

Run actual Linux filesystem and Git fixtures under one explicit disposable proof
root. Test setup may initialize fixture repositories and create linked fixture
worktrees with the installed Git binary. This is not permission to create a
production checkout or mutate existing project repositories.

The focused suite must prove:

1. No-VCS enrollment saves v2 with null VCS IDs and changes no project bytes.
2. Git enrollment persists application repository/checkout UUIDs and returns the
   same references through current live inspection.
3. Physical path aliases share one root, repository, and checkout identity.
   Separate nested project roots in one monorepo keep different root IDs while
   sharing repository and checkout UUIDs, regardless of enrollment order.
4. A main checkout and real linked worktree share a repository UUID and have
   different checkout UUIDs. Separate repositories with equal contents do not
   share IDs.
5. Renames with updated trusted locators, content edits, and dirty/detached Git
   state preserve application identities while the full physical tuple holds.
6. Replacing private or common Git administration while retaining the project root
   invalidates custody. Changing no-VCS to Git, or Git to no-VCS, also invalidates
   the enrolled owner instead of adopting the new association.
7. Replacement during metadata commit cannot return verified identity. Allocation
   collision, record overflow, and conflicting checkout/repository references
   refuse without committing a partial identity graph.
8. A restarted process, copied record/root, restored state, changed epoch, or
   foreign observer lifetime cannot restore application VCS verification.
   Persisted IDs round-trip as inert references only.
9. Read-only `inspect_location` allocates nothing and does not persist aliases.
   Every successful result has `mutation_authorized=False`.
10. Explicit v1 migration preserves IDs and locators, advances the revision once,
    calls no observer/Git/allocation function, and leaves reconciliation required.
    Repetition is byte-stable. Malformed, mixed-schema, duplicate-key, foreign-device,
    oversized, and unknown-version records refuse.
11. A real migration write failure and state/lock replacement during commit cannot
    issue verification or overwrite a detected change. Retained temporary files
    are named for controlled cleanup.

Use real descriptors and Git topology for sharing and replacement tests. Label
injected epoch or allocation-collision cases as branch checks. They do not prove
actual remount, snapshot rollback, Windows identity, or arbitrary concurrency.

Snapshot project content and all Git administration immediately before each
lifecycle operation. Compare afterward. Test-setup Git mutations happen outside
that interval. Keep the existing observer's hook/filter suppression and minimal
fixture environment. Missing Git or unsupported mount behavior is a failed
preflight for this proof, not a passing skip.

## Verify

The lead freezes source and dependency hashes, exact test counts, toolchain,
process limits, and cleanup inventory after independent source review. Use the
existing authorized Habitat environment with no new container or installation.
Set `VIVARY_ROOT_IDENTITY_PROOF_ROOT` to its verified absolute disposable root.
Keep each fixture within existing capture limits and cap each test command at
120 seconds with 1 MiB per output stream. Bound every Git/child subprocess and
include those processes in the reviewed supervisor's cleanup accounting.

```console
python -B packages/core/tests/test_root_identity_lifecycle.py
python -B packages/core/tests/test_root_vcs_identity_lifecycle.py
python -B packages/core/tests/test_root_identity_reads.py
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

The existing lifecycle and read-only lifecycle tests are compatibility checks.
If an unchanged dependency fails independently, preserve its failure separately
and identify whether this change introduced it. Do not silently edit that owner.

Export exact sources, logs, serialized v1/v2 fixture records, before/after byte
comparisons, and process/resource cleanup evidence. Independently inspect the
archive before deleting only exact disposable resources. The lead records
acceptance and the next bounded packet.

## Stop conditions

No Native/provider/registry integration, mutation lock service, project markers,
policy grants, recovery from serialized authority, new dependencies, credentials,
models, network Git access, user-project writes, production checkout creation,
container or mount changes, publication, push, or merge.

Windows and Jujutsu remain unsupported by this proof. Unsupported or ambiguous
layouts retain existing refusal. Shared UUIDs do not serialize mutations.
The lifecycle writer lock protects private metadata, not repository effects.

Implementation can proceed after the lead accepts this packet. Block only a
demonstrated observer inability to supply a stable common/private identity or
an incompatibility requiring edits outside the assigned files. Runtime dispatch
also requires installed Git and a verified supported Habitat fixture mount.

The next packet must carry application VCS references through the Native root
provider and registry while preserving authority checks. Later packets own
explicit reconciliation and shared repository mutation serialization. This unit
contributes inert identity round-trip and shared identity evidence to outcome 03.
It does not complete outcome 03 or outcome 12.

## Log

- 2026-09-07: Lead accepted the independently prepared schema/custody/migration contract and claimed one Sol writer. 04b remains a separate Workbench lane. Runtime proof is unexecuted; Native VCS integration and mutation serialization remain open.

### 2026-09-08 bounded proof checkpoint

The reviewed source passed 44 Linux tests in 5.233 seconds with Git 2.43.0. Aggregate cgroup memory peaked at 59318272 bytes under a 256 MiB hard cap, zero swap, 16 tasks and one core. All OOM counters were zero; process group 775 was absent, the service collected and the exact temporary stage was removed. The first pre-execution failure lacked one accepted compatibility test; all dependencies were compared before transferring that exact missing file.

Independent review verified the 53-entry archive and every payload hash, but withheld acceptance: export exact serialized fixture records and before/after byte comparisons, and add an explicitly labeled foreign-observer-lifetime branch case. Product correctness review found no further issue. Preserve the passing but incomplete evidence while correcting only the fixtures. The packet remains in progress.

- 2026-09-08: Accepted 44 Linux tests, exported physical-byte and serialized-record witnesses, independent source/archive review and exact cleanup. The receipt closes the two fixture evidence findings; Native integration, reconciliation, Windows/Jujutsu and mutation serialization remain open.
