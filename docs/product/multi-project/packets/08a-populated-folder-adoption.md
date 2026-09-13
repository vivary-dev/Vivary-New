# 08a: Adopt populated folders with truthful type and conflict preflight
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/17
Parent: 08
Status: needs-info
Depends-on: [07b]
Owner: Root-assigned adoption integrator, sole writer
Scope: Fix verified folder-name/type collisions and plan/apply disagreement, then expose preservation-focused adoption in the GUI.
Verification-kind: runtime
Needs: 07b provides the shared plan/apply operation. Start by reproducing the named type-collision cases and preserve explicit existing declarations.
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Adopt an existing notes folder without renaming its layout, claiming unrelated
files as typed Vivary records, or approving a plan that is already known to fail.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

Reuse `plan_adopt`, `adopt_workspace`, the existing Tropo configuration reader,
and the [adoption outcome](../tickets/08-adopt-existing-projects.md).
Investigate the reported S2 type-name collision against current source before
fixing it. Existing valid schema declarations must keep their meaning.

## Owned files

- Original thin adoption and planned-content validation in `packages/create-vivary/`.
- Existing Tropo type/path interpretation only where the verified failure requires it.
- Shared adoption actions/adapter and Native preview/apply UI in `packages/workbench/`.
- Existing adoption tests and a populated-folder GUI journey.

## Done condition

Preflight identifies actual creates, managed appends, retained files, collisions,
and expected validation findings. Ordinary folder names do not silently assign
Vivary record schemas to unrelated notes. Explicit existing typed records still
validate correctly. The same relevant checks inform preview and apply.

The user can register without adopting, or approve a specific adoption plan.
Existing notes, state, links, and non-Markdown files remain byte-preserved except
for reviewed managed changes. Unsupported content is described accurately rather
than counted as indexed knowledge. Retry and recovery preserve completed work.
The GUI can open the adopted result immediately after the shared operation.

## Verify

Start with a small reproducible ordinary-notes fixture containing a conflicting
folder name, custom frontmatter, a valid typed record, and an unsupported file.
Then exercise the representative S2 corpus through preview/apply and the GUI.
Assert file preservation and truthful outcomes, not an invented minimum edge count.

```console
python -m unittest discover -s packages/create-vivary/tests -p test_adopt.py
python -m pytest packages/tropo/tests/test_tropo.py -q
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Do not rename/move the user's corpus, weaken private-source exclusions, or
silently infer authoritative schemas. Zero graph edges are not inherently invalid.
Semantic indexing, PDF extraction, and external templates are separate capabilities.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.

- 2026-09-13: Required by the desktop release. Use the original adoption plan and journals through the same packaged Native action and project identity.
