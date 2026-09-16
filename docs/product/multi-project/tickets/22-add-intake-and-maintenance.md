# 22: Add signed email intake
Type: outcome
Status: planned
Blocked-by: [04, 10, 18]
Unlocks: [24, 36]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Implement S-11 email intake with signed inputs, deduplication, explicit routing, and recovery.

## Context

Read [the native owner inventory](../native-owners.md) before adding any run, session, task, plan, messaging, scheduler, or resource infrastructure.

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own email intake adapters, event routing, intake UI, and tests. Read Littleagent S-11. Ticket 30 owns heartbeat maintenance. Sending email and account changes remain separate gates.

## Done condition

Repeated or replayed messages converge. Invalid signatures fail closed. Routing binds the selected project and authority. Drafting or classifying intake never sends a reply.

## Verify

Run signed fixture, duplicate, reordered, malformed, wrong-project, crash, and retry tests. Use a local mailbox fixture, not a live account.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
