# 33: Publish an A2A service and agent card
Type: outcome
Status: planned
Blocked-by: [26, 31]
Unlocks: [27, 35]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Expose a bounded real Vivary agent service through A2A and publish a matching agent card.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own the A2A endpoint, agent card, task lifecycle mapping, authentication binding, cancellation, and tests. Read the current primary A2A specification during implementation. Reuse ticket 26 operations and ticket 31 scopes. Do not wrap metadata around a nonexistent agent.

## Done condition

A conforming client discovers the card and completes one stated operation. Task state, errors, cancellation, authentication, and unsupported operations match the implementation.

## Verify

Run A2A schema and lifecycle tests plus direct staging requests for success, authentication failure, wrong scope, cancellation, and unsupported operation.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
