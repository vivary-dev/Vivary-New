---
type: outcome
---
# 17: Deliver crash recovery and native session resume
Status: in-progress
Blocked-by: [04, 11, 12, 14, 15, 16]
Unlocks: [20, 24, 29, 36]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Goal

Recover interrupted work and resume native sessions without duplicating completed effects or losing drafts.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own the recovery coordinator, resume UI, replay ledger, and tests. Read Littleagent S-06 and the recovery parts of S-07. Reuse native session state and runtime files. Ticket 29 owns review, integration, and handoffs.

## Done condition

Restart reconstructs the project, task, plan, runtime, session, draft, and verification state. Replay does not repeat completed effects. Unsupported runtime resume states remain explicit.

## Verify

Run crash-point, restart, stale receipt, changed root, cancelled process, partial event stream, and native resume tests. Prove replay does not duplicate completed effects.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

## First bounded packet

[17a](../packets/17a-quarantine-mutation.md) owns an authorized transition from
an existing active/pending mutation admission to uncertain state. It retains
every key and fence, observes no replacement root, and grants no new writer.
The existing registry model owns decisions; its store owns SQL integrity and
atomic persistence. The packet owns current proof and application status.

- 2026-09-09: Claimed 17a after accepted 12h application. Broader recovery,
  cancellation, reconciliation, native resume and effect-replay gates remain open.

## Next bounded packet

[17b](../packets/17b-recovery-state-read.md) adds one private read of an
admission's pending or uncertain recovery state after restart. It reuses
the accepted admission loader, performs no writes and grants no replay
authority. Isolated preparation can proceed while 06e owns a source freeze;
shared application waits for that ownership to close.

- 2026-09-09 (2026-09-10 UTC): 17a runtime and serial application accepted.
  Independent review approved the bounded 17b contract for source preparation
  under continuous implementation authority. Outcome 17 remains in progress.
