---
type: packet
---
# 07d: Implement staged creation under protected namespace custody

Parent: 07
Status: done
Depends-on: [07a, 07b, 07c]
Owner: Sol creation_apply_writer owns the Python module and tests; GPT-6 lead owns the contract, review, runtime dispatch and graph.
Scope: Linux staged creation, exact preview verification, atomic no-replace publication and recovery through an injected receipt interface. No production activation or GUI action.
Verification-kind: runtime
Verification-result: passed
Evidence: [07d runtime receipt](../receipts/07d-staged-creation-effects.md)
Timebox: One bounded effect engine, adversarial Linux fixtures, independent review and exact cleanup.

## Goal

Create precisely the accepted thin workspace and preserve ownership uncertainty
across interruption. Keep the existing native database as the durable receipt
owner; this unit defines its required interface and adds no replacement store.

## Context

Read outcome 07, accepted 07a/07b/07c receipts, CreationAuthority,
createCreationReceiptStore, plan_thin_workspace, scaffold_thin_workspace,
doctor_workspace and the existing root-provider boundary. The stored intent alone
does not authorize an effect. Current host configuration does not establish an
exclusive namespace across restart; production creation therefore stays inactive.

## Owned files

The assigned writer owns packages/core/vivary_core/creation_apply.py and focused
tests. Preserve the 07b read-only API and all existing scaffold rules. The lead
owns this packet, its receipt and source-map updates. Any needed receipt API
extension or native bridge must have separate explicit ownership before editing.

## Contract

The caller supplies only a CreationLease and thin options. A trusted host fixes
the parent, private staging location, supported filesystem and receipt adapter.
Use a typed namespace interface that attests exclusive control of the parent,
staging and ancestors, one cross-process writer lock, same-filesystem staging,
and continuity across the declared restart boundary. No GUI boolean, permission
bit, inode, marker file or matching content hash establishes those guarantees.
The default namespace owner refuses. Controlled fixture custody is test evidence,
not a production security claim.

Derive the final target from the bound child name and fixed parent. Refuse every
occupied target, including an empty directory. Require the final-target preview
digest to match the accepted lease, then persist intent before stage writes.
Stage with the same child basename so generated names and bytes match the preview.
Compare the entire staged tree and bytes, reuse Doctor/Tropo, and sync files and
directories before Linux renameat2(RENAME_NOREPLACE). Refuse unsupported systems;
there is no check-then-rename fallback. Sync affected directories after publication.

The receipt interface must admit each new effect under current creation grants,
the exact request, expected phase and unchanged namespace continuity. Existing
historical read/replay methods do not grant filesystem authority. The implementation
must surface this missing integration seam explicitly. Do not implement a second
database, JSON inventory, queue, runtime session store or global journal.

Use preparing, prepared, publishing and published intent phases. Rebuild partial
staging only inside its recorded private namespace. A publishing receipt with
stage absent and target present can complete only under uninterrupted exclusive
namespace continuity. Both present, both absent, changed continuity or unclear
ownership require recovery. Never remove or adopt an uncertain target. Published
replay is historical and never recreates a missing target. Return created-unregistered;
registration and native inventory admission retain their own authority.


## Accepted implementation boundary

The engine receives CreationAuthority, a CreationReceiptPort, a CreationNamespace
and ThinWorkspaceOperations. Inject the existing plan/scaffold/Doctor/Tropo
callbacks; importing create-vivary into dependency-free Core would create a cycle.

Receipt load returns a trusted internal snapshot with the exact binding, phase,
stage identity and namespace continuity. Prepare persists intent. Admit grants
one bounded effect under current custody and phase. Transition performs the
expected phase change. Public historical replay is separate. Neither snapshot nor
custody comes from GUI JSON. The native admission/snapshot protocol is 07e work;
07d uses a labeled fixture implementation, never a replacement product database.

Hold namespace custody and its writer lock throughout reconciliation and effects.
Reauthorize publication after scaffold work. The host must order admission and
revocation; a stale/disconnected admission cannot permit a delayed write.
Reconcile publishing/published before asking the final-target planner to inspect
an occupied target. Fresh processes reacquire the exact request and a new lease.
The namespace owner supplies restart continuity; the lease cannot serialize it.

After rename, sync both affected directories before recording published. Rename
ambiguity, sync failure, transport loss or a receipt-write failure retains
publishing and requires recovery. Never remove the target or mark it terminally
failed. A fixture supervisor can retain synthetic receipt state and exclusive
custody while actual worker processes terminate and restart. Supervisor loss
loses continuity. This proves the engine, not native integration or power-loss
durability.


## Done condition

Prove exact preview bytes, occupied targets, changed options, revocation, competing
operations, interruption at every phase, failure after rename before receipt
completion, fresh-process recovery, lost continuity and unsupported atomic publish.
Use actual Linux files and the existing scaffolder/Doctor/Tropo. Receipt test doubles
prove only engine behavior; any cross-process synthetic persistence must be labeled
as fixture state, never a second product state owner. Native database composition
and the external host protocol require the next integration packet before GUI use.
Process-crash proof does not establish power-loss or storage-rollback safety.

## Verify

Reuse the existing Habitat checkout and dependencies. Run one bounded low-memory
job with private disposable fixtures; verify exact source hashes before execution.
Export complete source/results, independently inspect the final archive and remove
only the contained test-owned fixtures and processes. Update the graph and the
next native receipt/host integration packet before this unit closes.

```console
python -m unittest discover -s packages/core/tests -p test_creation_apply.py
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Stop conditions

No user project writes, production namespace activation, arbitrary client paths,
model calls, credential copying, account changes, publication, push, merge or
legacy deletion. Stop only the operation whose host custody or atomic primitive
is unavailable; continue supported fixture implementation and independent work.

## Log

- 2026-09-07: Prepared the next effect unit after independent 07c persistence
  acceptance. Native database composition and production custody remain explicit
  later acceptance, not inferred from a creation receipt or fixture path.

- 2026-09-07: Claimed for one Sol writer after independent 07c runtime acceptance
  and Astra effect-boundary review. Implementation is source-only until lead dispatch.

- 2026-09-07: Initial source review found deferred-admission lifetime, reverse
  path overlap and external hard-link gaps, plus incomplete crash/custody fixtures.
  The assigned writer is correcting them before execution. No 07d test or user
  project effect has run. The lead is preparing the bounded Habitat proof driver.

- 2026-09-07: Accepted after all 23 Habitat tests passed, independent source and
  archive review, and exact process/staging cleanup. The next native admission
  packet is prepared; production custody and transport integration remain open.
