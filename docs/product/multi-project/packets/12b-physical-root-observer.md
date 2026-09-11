---
type: packet
---
# 12b: Observe physical roots within a verified Linux observer lifetime

Parent: 12
Status: done
Depends-on: [12a]
Owner: GPT-6 physical-observer implementation agent
Scope: Implement a bounded, read-only Linux physical-root observer and execute synthetic Habitat filesystem/Git fixtures. Preserve explicit uncertainty after observer restart. No production registry adapter, durable identity store, mutation reservation, file effect, Windows identity implementation, or Jujutsu activation.
Verification-kind: runtime
Evidence: [Physical observer receipt](../receipts/12b-physical-root-observer.md)
Verification-result: passed
Timebox: Checkpoint after implementation, Habitat verification, and independent review. Continue available work under the execution contract without a fresh-session stop.

## Goal

Produce private physical captures that distinguish aliases, directory replacement,
Git common administration, and checkout incarnation. Reuse the existing bounded
Git runner. Test the capture's limits before another owner uses it for effects.

## Context

Read the [12a contract](../contracts/root-vcs-observation.md), its
[expected oracles](../fixtures/root-vcs-observation.json), the
[accepted receipt](../receipts/12a-root-vcs-observation-contract.md#later-implementation-session),
and the [root source map](../source-map/modules/root-observation/index.md).
Use `workspace_observe.py` for fitting bounded Git probes and parsing.

The supported initial identity lifetime is one Linux observer instance holding
directory descriptors. Held descriptors pin the observed inode. Aliases and
renames preserve identity. A replacement cannot reuse that pinned incarnation.
Lost handles, unsupported platforms, uncertain reuse, and previous-instance
captures return `identity-unverified`. Raw device/inode or timestamps cannot
establish continuity after restart. This packet does not promise durable
cross-process identities or mutation authority.

The trusted local caller supplies a device namespace and authorized topology
scope. Product callers cannot submit root, repository, checkout, or owner IDs.
Allow bounded ancestor marker checks to detect an enclosing repository, but
refuse VCS metadata outside the authorized scope. Inspect only configured roots
and the administrative paths those roots require.

## Owned files

- `packages/core/vivary_core/physical_observe.py`
- `packages/core/tests/test_physical_observe.py`
- This packet and `docs/product/multi-project/receipts/12b-physical-root-observer.md`
- `docs/product/multi-project/tickets/12-implement-vcs-identity-adapters.md`
- `docs/product/multi-project/source-map/modules/root-observation/index.md`
- Generated `docs/product/multi-project/graph.md` and `index.md`

Use a direct module import. No shared package export or dependency change is
required. Other agents own their files and the shared Habitat source transfer.

## Done condition

1. Alias and rename observations share a root ID. Recreated roots differ while
   the original incarnation is pinned. Restart and lost-handle revalidation fail
   closed, preserving the previous capture.
2. Ordinary Git and linked worktrees share the common repository reservation
   key and differ on checkout identity. Monorepo siblings share both Git keys.
   Replacing private administration changes only checkout identity. Replacing
   common administration invalidates repository identity.
3. Dirty, ignored, and untracked content changes the captured revision. Content
   coverage includes entry types, relevant modes, and bytes. Bounds, unsupported
   links, permissions, and concurrent changes produce explicit refusals.
4. Every read probe preserves user and administrative bytes, modes, and write
   timestamps. Access timestamps are not product state. Git probes disable
   optional locks and executable configuration. No hook, filter, or Jujutsu
   command runs. Record exact observed Git and filesystem versions in Habitat.
5. No-VCS roots retain root-only keys. Nested independent ownership is refused.
   Overlapping monorepo roots are safe only within the same verified Git domain.
   Jujutsu or conflicting metadata never silently selects Git ownership.
6. Private captures include their observer lifetime and content policy. They
   grant no write authority and cannot replace registry authorization or fences.
7. A separate GPT-6 reader reviews the implementation and evidence. Habitat
   results and deterministic tests stay separate from unsupported platform and
   production-integration claims.

## Verify

Reuse the existing Habitat checkout and dependencies. The lead transfers only
reviewed task files and verifies hashes before testing. Do not create another
development checkout or worktree. Test-only repositories and linked worktrees
are disposable synthetic fixtures under one named task temporary directory.

```console
python -B -m unittest discover -s packages/core/tests -p test_physical_observe.py -v
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

Windows deterministic checks can verify unsupported-platform refusals. Only
observed Linux/Habitat execution can accept supported physical behavior.

## Stop conditions

Refuse unsupported filesystem behavior, ambiguous containment, incomplete capture,
or lost identity continuity. Never repair metadata, change a project, copy
credentials, install dependencies, or activate mutation to satisfy a probe.
Clean exact task-owned fixtures after preserving their final test evidence.
Keep outcome 12 open for Windows, Jujutsu, durable identity, registry composition,
and cross-process effect enforcement.

## Log

- 2026-09-07: Claimed under the approved continuous-execution decision after
  reading 12a's accepted contract and receipt. Implementation and physical
  acceptance are open. No model login or database dependency blocks this work.

## Verification log

- 2026-09-07: Windows boundary checks passed. The initial Habitat execution
  passed all 21 tests. Independent GPT-6 review accepted the bounded Linux
  identity lifetime and required bounded capture retention and locator updates.
- 2026-09-07: Corrected those findings and made untracked-content diagnostics
  distinct from Git porcelain status. The lead verified final source hashes
  and independently ran all 23 tests in the existing Habitat environment.
  All passed with zero skips in 1.772 seconds on Python 3.11.16, Git 2.43.0,
  and tmpfs. The receipt owns exact hashes, limits, and cleanup evidence.
- 2026-09-07: Accepted only this bounded physical-capture packet. Outcome 12
  remains open for durable identity, Windows, Jujutsu, registry composition,
  and cross-process mutation enforcement. Continue available program work.
