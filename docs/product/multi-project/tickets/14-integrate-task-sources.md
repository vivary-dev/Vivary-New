# 14: Integrate optional task sources without mirroring ownership
Type: outcome
Status: planned
Blocked-by: [03, 12]
Unlocks: [15, 16, 17, 20, 29]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Define one selected task authority per project and read optional Beads or external tracker tasks without silently copying or forking their state.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own task-source interfaces, identity mapping, refresh behavior, and UI labels. Read Littleagent S-02 through S-07, `design.md`, and `migration.md`. Beads stays an external owner when selected. VCS and hosting remain separate.

## Done condition

Local Vivary tasks, Beads, and one generic external source fixture remain distinguishable. Edits route to the authority that owns the task. Unsupported writes stay read-only with a clear external action.

## Verify

Run task identity, refresh, stale revision, duplicate ID, offline, and permission fixtures. Prove no hidden mirror becomes authoritative.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
