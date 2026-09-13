# 09a: Verify and repair narrow non-code context and Doctor behavior
Type: packet
Parent: 09
Status: needs-info
Depends-on: []
Owner: Root-assigned Core/Tropo context writer coordinated with the adoption writer
Scope: Characterize supported non-code work, fix demonstrated context/schema/Doctor mismatches, and preserve valid behavior and existing budgets.
Verification-kind: runtime
Needs: Root confirms the exact current S6/S7 failure cases with runtime_setup and assigns non-overlapping Core/Tropo source ownership.
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Return useful, accurately scoped project context and meaningful health findings
for supported notes and writing workspaces, with VCS-specific checks optional.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

Read the original context/review source map and the research claims as hypotheses.
The blanket S5 non-Git block was disproved by a current reproduction. S7 does not
make an edgeless graph invalid. Do not encode either false claim as an expected
failure or turn optional capabilities into mandatory setup requirements.

## Owned files

- Existing Core workspace observation/content selection in
  `packages/core/vivary_core/workspace_model.py`, `workspace_content.py`, and
  `workspace_observe.py`, limited to demonstrated gaps.
- Existing Tropo graph/configuration code and original Doctor checks.
- Existing Strato/Ozone/Exo adapters only for a verified caller mismatch.
- Focused existing Core/Tropo/creator tests and the corresponding GUI context display.

## Done condition

Document and verify the smallest supported cases: non-Git notes when supported
by the existing observer, ordinary Markdown/frontmatter, explicit typed records,
and writing work without a code-test command. VCS or npm facts appear only when
applicable. Missing optional capability is described honestly.

Fix demonstrated dropped content, incorrect schema selection, caller/path mismatch,
or misleading severity at its owning source. Keep valid edgeless workspaces valid.
Undefined relationships or unsupported file formats are not silently counted as
indexed evidence. Preserve private-source exclusion and bounded context selection.

The GUI and headless command expose the same corrected result for the affected
case. Source fixes do not claim a new parser, semantic index, non-code factory,
or acceptance of every research scenario.

## Verify

First reproduce each selected claim against current source using a small local
fixture. If it already works, record that result rather than adding a failing test.
Add only the regression needed for a confirmed defect. Run the affected ordinary
CLI and GUI context journey. Do not replay retained historical proof campaigns.

```console
python -m pytest packages/core/tests/test_model.py packages/core/tests/test_content.py -q
python -m pytest packages/tropo/tests/test_tropo.py -q
python -m unittest discover -s packages/create-vivary/tests -p test_create_vivary.py
git diff --check
```

## Stop conditions

Do not relax strict evidence contracts to label unobserved content verified,
remove privacy exclusions, or equate node/edge counts with product correctness.
Coordinate shared Tropo files with 08a. An unsupported extension is a separate
capability choice, not permission for a broad parser or runtime rewrite.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.
