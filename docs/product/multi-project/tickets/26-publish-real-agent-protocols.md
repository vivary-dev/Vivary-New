# 26: Publish one real read-only service and OpenAPI catalog
Type: outcome
Status: planned
Blocked-by: [23, 24, 25]
Unlocks: [27, 31, 32, 33, 34, 35]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Publish one useful read-only Vivary HTTP service and an OpenAPI catalog that describes only its implemented operations.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own the read-only service, OpenAPI document, API catalog entry, errors, rate limits, and direct tests. Read `release.md` and its raw receipt. Reuse an actual Agent-Native application or action only after version-matched proof. Tickets 31-35 own auth, MCP, A2A, browser tools, and web discovery.

## Done condition

The OpenAPI document matches a deployed staging service. Every operation returns real Vivary data within declared privacy and authority. Unsupported operations remain absent.

## Verify

Run OpenAPI validation, contract tests, rate-limit tests, privacy cases, and direct staging requests. Compare every catalog operation with the implemented router.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
