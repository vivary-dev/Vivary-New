# 11a: Read and edit authorized project files through the GUI
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/12
Parent: 11
Status: implemented; acceptance and lifecycle are on the linked GitHub issue
Depends-on: [03c]
Owner: Coordinating Codex, sole workspace editor and conflict-action writer
Scope: Full-page project file reading with sidebar navigation, explicit source editing and Save, same-folder Rename, retained Native drafts, and external-change conflicts.
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

- `packages/workbench/app/routes/files.tsx`, project-file sidebar and Native draft components, and existing navigation entry points.
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

## Shared desktop and web behavior

Make host-file navigation, editing, save/conflict dialogs, and draft recovery usable at phone widths. Clearly identify the files as belonging to the connected host.

## Implementation checkpoint: 2026-09-14

Jeff clarified that clicking a sidebar file opens a full-page reading surface.
Markdown renders as a document. Edit is explicit, Save writes the file, and
Rename changes an individual filename within its folder. The live issue records
the decision and day queue. This checkpoint does not close the issue.

The implementation uses the installed Toolkit Markdown surface and Native app
state for drafts. Project file actions resolve the authenticated owner's current
registered project on every call. Versions bind the project, root, binding,
policy, file identity and bytes. Vivary serializes its own writes per root and
binding. External changes present at the final check produce recoverable
conflicts. Renames use exclusive destination creation and preserve collisions.

These are ordinary local optimistic file operations. They do not turn
local-stat verification into held-custody mutation admission or an OS sandbox.
A non-cooperating external writer can still race the final check and effect.
No new project registry, transcript store, dependency, or provider runtime was
added. Supported UTF-8 text files are limited to 256 KiB. Binary, oversized,
unsupported and multiply linked files have explicit blocked states. Secret,
dependency, generated and Git paths are excluded; symlink paths are rejected.

Validation on Zo: 8 file-boundary tests, 4 draft-state tests, 39 existing action/session checks,
direct TypeScript checking, the CI workflow contract, and production builds
passed. Independent review found a permission-mode bug; the corrected save
preserves 0664 even under umask 0022. Final review approved the corrections.

The private hosted UI created a disposable project, opened formatted STATE.md,
and retained an unsaved draft through file navigation. Its initial browser
automation attempt hit Cancel instead of Preview; keyboard submission repaired
that test step. The hosted draft also survived a preview restart and a new browser
session. Save detected an external edit without changing its bytes. Explicit
reconciliation saved the combined text, and Rename updated the file and sidebar.
Jeff authorized necessary private preview refreshes for this feature while no
agent work is running, preserving the service command, privacy and data.

The isolated local instance on Zo passed draft navigation/reload and project
switching, external-edit conflicts without changing external bytes, explicit
reconciliation and Save, Rename and sidebar refresh, missing-path recovery,
and failed draft persistence with visible Retry across routes. A real 390px
viewport opened and edited workspace TOML without horizontal overflow. No model
work ran. The owned temporary server stopped; its data and evidence are retained.
A test's document-load wait timed out after a successful SPA rename. A focused
continuation verified the actual URL, retained renamed bytes and mobile flow.

Retained evidence: `.tmp/file-surface-local-evidence/`,
`.tmp/file-surface-file-tests.log`, `.tmp/file-surface-boundary-tests.log`, and
`.tmp/file-surface-final-build.log` in the integration checkout. The linked GitHub
issue and PR own CI, merge and final acceptance status. Windows artifact
acceptance remains under #8 and #23.

A final reopen check found that Native 0.176.5 normalizes top-level null request
bodies to empty objects. Draft clears now use a versioned object with nested
null. The reader recovers the exact empty values emitted by the earlier preview
and preserves older drafts; malformed or unknown values still block editing.
Save followed by full-page reload passed against the real local Native store
and the existing private hosted instance, with Edit restored and no old draft.
The final dark render also passed selected-file and keyboard-focus checks.
