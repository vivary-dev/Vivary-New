# Project file surface verification

Evidence-record: 11a
Date: 2026-09-14

Implementation and review: [issue #12](https://github.com/vivary-dev/Vivary-New/issues/12)
and [PR #37](https://github.com/vivary-dev/Vivary-New/pull/37).
The PR checks own final-head CI status. GitHub owns merge and issue lifecycle.

## Verified implementation

Jeff clarified that clicking a sidebar file opens a full-page reading surface.
Markdown renders as a document. Edit is explicit, Save writes the file, and
Rename changes an individual filename within its folder. The live issue records
the decision and day queue.

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

Validation on Zo: 13 file-boundary tests, 5 draft-state tests, 39 existing action/session checks,
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

The final PR review corrections preserve exact filename whitespace through the
input schemas and retain the base file's first newline convention during source
editing. Reads stop after 256 KiB plus one byte, then reject oversize content.
Listings apply case-insensitive directory exclusions, report an incomplete capped
list, and tolerate individual entries disappearing during a scan. Both reads and
listings revalidate project access before returning.

Rename reserves the destination exclusively and writes bounded raw bytes, so it
does not require hard-link support. It preserves permissions and BOM bytes,
checks the source version and project access before removing the original, and
cleans up an owned partial destination on write failure. It is not an atomic
filesystem rename or a guarantee against external writers racing the final check.
The source and destination may both exist if the process stops during the copy.

The 57 focused checks and direct TypeScript check pass with these corrections.
Independent source review approved the frontend and backend fixes. Build and
real browser results are recorded with the PR acceptance evidence.
