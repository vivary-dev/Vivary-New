# 07c: Compose built-in workspace patterns and reconfigure an existing project
Type: packet
Parent: 07
Status: needs-info
Depends-on: [07d]
Owner: Root-assigned creator and setup UI writer
Scope: Use the shared plan for useful built-in starter content and explicit pattern/role reconfiguration without replacing the workspace.
Verification-kind: runtime
Needs: 07d supplies the working create UI over the shared plan. This packet adds reconfiguration. Preserve authored content in built-in pattern changes.
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Create a useful second-brain, wiki, writing, or mixed workspace from editable
starting choices, then change those choices while preserving real work.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

Use the [file-memory study](../research/file-memory-and-persistence.md) and
[workspace pattern examples](../research/letta-code-workspace-patterns.md).
S1 means an explicit reconfiguration plan and apply. Metadata from 07a alone
cannot satisfy it. Research labels do not establish universal mandatory roles.

## Owned files

- Built-in content and pattern composition in the original creator package.
- The shared plan/apply entry points from 07b.
- Native setup/reconfiguration actions and their GUI presentation.
- Existing creator/adoption compatibility tests and one reconfiguration journey.

## Done condition

A small built-in pattern library supplies useful capture, source-reference,
navigation, and project-brief guidance. Starting choices compose those patterns
with editable names and paths. Prefill known inputs and workflow instructions,
not invented personal knowledge. Keep preset aliases readable for compatibility.

Reconfiguration previews added, retained, conflicting, and retired managed content.
Existing user edits and authored state survive. Apply changes the selected
configuration without creating another project or silently removing files.
Role paths grant no access. The GUI shows the result and an agent can discover
its guidance through the selected project's existing instruction path.

Built-in choices and GUI delivery proceed without an external catalog. No
maintenance loop, model, provider, hook, or schedule starts from selecting a pattern.

## Verify

Check two composable patterns, an existing edited guidance file, a changed
selection after preview, and retry. Use a visible GUI journey to create, edit,
reconfigure, and reopen one workspace. S1 passes only when its exact supported
change works through shared GUI/CLI operations, not by directly rewriting TOML.

```console
python -m unittest discover -s packages/create-vivary/tests -p test_init_thin.py
python -m unittest discover -s packages/create-vivary/tests -p test_adopt.py
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Do not treat role metadata as authority to delete user files, replace authored
STATE.md, import private history, or install third-party templates. Broader
pattern catalogs remain later additions, not blockers for the first useful flow.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.

- 2026-09-13: Included in the desktop release after 07d. Existing preset aliases remain compatible.
