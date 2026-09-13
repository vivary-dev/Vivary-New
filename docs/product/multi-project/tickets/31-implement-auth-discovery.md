# 31: Implement authentication discovery and protected-resource flow
Type: outcome
Status: planned
Blocked-by: [26]
Unlocks: [27, 33, 34, 35]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Implement real authentication and scoped authorization for selected protected public operations, then publish matching discovery metadata.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own OAuth authorization-server metadata, protected-resource metadata, Auth documentation, scope enforcement, and negative tests. Read `release.md`. Reuse actual Agent-Native auth and connection capabilities only after version-matched proof. External dependency: The repository owner must choose the auth service and approve account or security changes.

## Done condition

Discovery points to working endpoints. Tokens enforce declared scopes and resource boundaries. Public operations remain usable without fabricated login requirements. Metadata reveals no private workspace or credential data.

## Verify

Run metadata validation, authorization-code or selected flow tests, expired and wrong-scope cases, resource-boundary cases, and direct staging requests. Record external security changes only after approval.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
