# 11a: Read and edit authorized project files through the GUI
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/12
Parent: 11
Status: ready-for-agent
Depends-on: [03c]
Owner: Coordinating Codex, sole workspace editor and conflict-action writer
Scope: Complete the existing Files panel using Native actions and root-bound file access, with drafts and external-change conflicts.
Verification-kind: runtime
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Open, edit, save, and revisit a real project file while preserving drafts and
other writers' changes. This can proceed independently of project merge/split.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

The existing inspector and Files placeholder are the starting surfaces, not a
complete editor. Root-bound workspace files are different from Native personal
resources. Reuse public Native UI/actions before composing a small app-owned seam.

## Owned files

- `packages/workbench/app/routes/workbench.tsx` and the smallest file-panel components.
- Relevant file actions and existing root resolution in `packages/workbench/server/`.
- Existing project-selection integration only where drafts need stable project scope.
- Focused file-conflict tests and a real GUI edit journey.

## Done condition

The panel shows supported files including workspace TOML, opens a selected file,
and saves through an authorized action. Large/binary/unsupported files have clear
limits and do not masquerade as editable text. Path metadata does not grant access.

Dirty drafts survive navigation, reload, and project switches. Saves bind the
selected project and expected prior content/identity. An external edit, rename,
or deletion produces a recoverable conflict rather than silent overwrite.
Missing or revoked roots block access without falling back to another workspace.

The selected file and result remain understandable in the GUI. Keep one source
of file contents and one draft owner. No replacement project registry or file database.

## Verify

Exercise a normal GUI file-open/edit/save flow, then project switching, reload,
external modification, and deletion while a draft exists. Confirm denied paths
and roots cannot be reached. Check bytes after a conflict. Use the focused tests
needed for the new write boundary and repeat only the failing journey.

```console
pnpm --dir packages/workbench typecheck
node --test packages/workbench/tests/project-services.test.mjs
git diff --check
```

## Stop conditions

Do not expose unrestricted filesystem routes or map local-stat verification to
held-custody mutation proof. Do not overwrite unsupported/binary content, move
folders, change authentication, or add a new runtime.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.

- 2026-09-13: Root selected the existing Native actions and project binding. Begin with the current inspector, expected-content revisions, and a recoverable conflict response.
