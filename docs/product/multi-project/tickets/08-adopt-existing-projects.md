# 08: Implement existing-project adoption
Type: outcome
Status: planned
Blocked-by: [03, 06]
Unlocks: [09, 11, 19, 24]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Goal

Expose the existing brownfield plan, approval hash, apply, conflict, and recovery behavior without changing registration-only workflows.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own adoption service and GUI. Reuse `plan_adopt` and `adopt_workspace` from `packages/create-vivary`. Read the adoption guide and `evidence.md`. Keep all user content outside managed blocks.

## Done condition

The GUI shows creates, patches, optional projections, kept files, conflicts, privacy state, and plan hash. Apply requires the matching approved hash. Registration remains byte-for-byte read-only.

## Verify

Run adoption tests for clean apply, conflict, changed input, interrupted transaction, recovery, and registration without adoption. Compare host-file bytes outside managed blocks.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packets

- [08a: Populated-folder adoption](../packets/08a-populated-folder-adoption.md): verify S2 collisions and preserve existing content through visible preview/apply.
- [08b: Project merge and split](../packets/08b-project-merge-split.md): resolve identity, access, reference, and recovery contracts before S3/S4.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-13: Separated populated-folder adoption from later identity-changing merge/split work. The research does not authorize file movement or settle those lifecycle choices.
