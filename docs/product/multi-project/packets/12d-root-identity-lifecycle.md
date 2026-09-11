---
type: packet
---
# 12d: Preserve root records while tracking live identity custody

Parent: 12
Status: done
Depends-on: [12b, 12c]
Owner: GPT-6 lifecycle writer; independent GPT-6 source and evidence reviewer.
Scope: Private application root records, exclusive local writer custody, restart refusal, and actual Linux fixture lifecycle proof.
Verification-kind: runtime
Verification-result: passed
Evidence: [12d lifecycle receipt](../receipts/12d-root-identity-lifecycle.md)
Timebox: One bounded lifecycle implementation through Habitat proof, independent review, export, and cleanup.

## Goal

Keep application root IDs as durable records while physical verification remains
dependent on live descriptor custody. Preserve old IDs after uncertainty and
refuse implicit reattachment, replacement, or recovery from serialized evidence.

## Context

Read the [root observation contract](../contracts/root-vcs-observation.md),
[12b proof](../receipts/12b-physical-root-observer.md), and
[12c limits](../receipts/12c-registry-read-observation.md).
The lead selected this packet after 06c because its SQL binding must not persist
12c's lifetime observer IDs as if they were durable physical identity.

The existing Habitat container exposes filesystem handles on tmpfs and its
ext-family checkout mount, but reopening those handles returns `EPERM` under
its existing user. Neither matching handles nor device/inode values prove
continuity after restore or remount. No additional OS capability is requested.

The accepted technical choice is a separate application UUID record whose
verification requires the current lifecycle owner's held observer descriptors.
Persisted bytes never establish verification. Owner restart, import, restored
state, replacement, or epoch uncertainty requires explicit reconciliation.
Automatic reconciliation remains unavailable in this packet.

## Owned files

- New `packages/core/vivary_core/root_identity_lifecycle.py`
- New `packages/core/tests/test_root_identity_lifecycle.py`
- This packet, its receipt, and the root-observation module index

Preserve the existing observer and registry services. The graph writer owns
generated planning files. The 05a writer owns application UI and build wiring.

## Done condition

1. Persist bounded, validated application records outside project scope. Keep
   observer IDs and verification authority out of serialized records.
2. Use one exclusive local writer lock and detect changed or malformed state.
   Never let copied, stale, or imported bytes restore live custody.
3. Preserve one ID for verified in-process aliases and rename. Refuse replacement
   and unresolved-record enrollment; leave historical records intact.
4. Permanently invalidate the owner after trusted epoch change or loss, even if
   an earlier epoch value returns. Preserve old records across owner restart.
5. Run actual create, rename, delete/recreate, copy, restore, and new-process
   fixtures. Prove cross-process locking, state limits, malformed imports, and
   real metadata write failure without changing project bytes.
6. Capture exact OS seams and source hashes, independent review, verified private
   evidence export, and cleanup of only owned fixture and staging paths.

## Verify

Use the existing authorized Habitat container after verifying its live mount
truth. Tests require an explicit absolute disposable proof directory and run
with synthetic device labels only in their fixtures.

```console
python -B packages/core/tests/test_root_identity_lifecycle.py
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

Do not write project identity markers, copy credentials, grant OS capabilities,
change mounts or services, create containers or checkouts, install dependencies,
call models, or feed synthetic facts into live registry SQL.

An injected changed mount epoch proves uncertainty handling only. It does not
claim an actual remount, filesystem snapshot rollback, automatic physical identity
recovery, Windows support, VCS administrative identity, or production policy wiring.

## Log

- 2026-09-07: Lead accepted durable application records with live descriptor
  verification and explicit restart uncertainty. Read-only OS probes confirmed
  handle encoding and denied handle reopening in the existing Habitat container.

- 2026-09-07: All 24 Habitat tests passed, including the independent lead replay. Final source review, all 52 archive payload hashes and 41 canonical source matches, and guarded Habitat/Windows cleanup passed. Durable records remain explicitly unverified after owner restart; automatic recovery is not claimed.
