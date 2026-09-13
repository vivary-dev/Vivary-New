# 34: Publish working browser WebMCP tools
Type: outcome
Status: planned
Blocked-by: [26, 31]
Unlocks: [27, 35]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Expose selected real site operations as browser tools with truthful discovery, permissions, abort behavior, and fallback UI.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own browser tool registration, UI affordances, permission handling, abort support, and browser tests. Reuse ticket 26 routes and ticket 31 scopes. Support only verified browsers and keep ordinary site use intact.

## Done condition

A supported browser discovers and invokes each advertised tool. Unsupported browsers retain the normal UI. Permission refusal and abort produce bounded results without partial effects.

## Verify

Run browser tests in every supported engine for discovery, invocation, refusal, abort, navigation, and fallback. Compare registered tools with implemented operations.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
