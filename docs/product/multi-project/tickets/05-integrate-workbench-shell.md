---
type: outcome
---
# 05: Integrate the preserved workbench shell
Status: in-progress
Blocked-by: [02, 03]
Unlocks: [06, 11, 15, 18, 24]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-11. Packet 05a accepts the scoped visual shell and its historical
build/browser evidence. Current integrated selection behavior still needs 06e's
focused C5 tests and browser acceptance; its exact product build is accepted.
Outcome 02 remains unfinished. Full parent
closure must verify the required shell regions and provenance against the
integrated source. See the [05a receipt](../receipts/05a-workbench-shell.md).

Packet 05b accepts eight endpoint tests, Zo build 04 and browser 15. All twelve
GUI checks, natural backend exit, resource closure and independent runtime review
passed. The [05b receipt](../receipts/05b-deepseek-chat-titles.md) owns exact hashes,
the retained failures and the documentation-only README delta. Parent outcome
05 remains in progress for the integrated 06e behavior and its other exit gates.

## Goal

Place preserved Littleagent workbench source in the selected Vivary app package with provenance and a buildable shell.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own only the new app package, its provenance record, and package-local tests. Read tickets 01-03, `design.md`, `migration.md`, Littleagent S-01, design docs, and accessibility findings. Reuse accepted source slices instead of rewriting the shell.

## Done condition

The app opens with project navigation, task and session regions, conversation, and expandable work panels. It labels planned or unsupported controls accurately. The provenance receipt maps imported files to source hashes.

## Verify

Run the package build, unit tests, and a browser smoke from an isolated project environment. Compare the shell against the accepted S-01 layout and accessibility contract.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-07: Packet 05a preserves 24 selected GUI/composition source files and
  composes a native shell in `packages/workbench`. Frozen Habitat build,
  TypeScript, six preview tests, doctor, and the private exported-renderer browser
  fixture pass. The lead independently accepted desktop/mobile/focus evidence.
  Parent outcome remains open: full source preservation and runtime/identity
  dependencies, connected project behavior, and real application acceptance
  are not established by this shell proof. See the 05a receipt.
