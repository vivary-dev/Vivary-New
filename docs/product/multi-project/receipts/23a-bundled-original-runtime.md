# Bundled original runtime verification

Evidence-record: 23a
Date: 2026-09-14
Acceptance status: tested package evidence complete; PR delivery pending

[Issue #7](https://github.com/vivary-dev/Vivary-New/issues/7) owns acceptance
and delivery. This record covers the current source, Linux package, hosted
preview, adapter and clean-host runtime evidence, plus reviewed packaging repairs awaiting a new artifact. It does not close the issue.

## Current source

Workbench repair commit
`721735cbd03be8880662f98fbcbb74d84e4cc967` binds original commands to
the selected actor, project and scope and preserves the original governed-input
contracts. All seven jobs passed in
[CI run 34922890114](https://github.com/vivary-dev/Vivary-New/actions/runs/34922890114).

Clean-host backend commit
`8e0855c365dc1ae2a65be96a35d32acd9d63a436` removes ambient pip and
setuptools assumptions from runtime assembly. All seven jobs passed in
[CI run 34923985842](https://github.com/vivary-dev/Vivary-New/actions/runs/34923985842).

Reviewed packaging repairs landed in code commit
`e6f38f9ffcd2fbcd50d49c93864924fa238a9ff1` and need final delivery. Every bundled standalone and component launcher now invokes
the relative Python interpreter with `-I -X utf8 -B`, matching the application
adapter for redirected Unicode output. The desktop packager freezes tracked
source into a private staging snapshot before downloads or assembly: recorded
HEAD plus tracked working-tree overlays, with untracked files excluded. Build
metadata reports whether overlays were included and whether the packaged source
matches the recorded commit. The prebuilt Workbench output is captured once;
its metadata explicitly does not claim commit verification. These source fixes
have not been attributed to the earlier packaged artifacts.

An earlier packaged Linux artifact, build timestamp
`2026-09-15T01-28-52-385Z`, remains valid evidence for the packaged Electron
journey. Its manifest records base
`8822145117c63c35e30154fc461700e4c4847fc3` with `source.dirty: true`.
That artifact identity is retained as historical evidence and is not relabeled
with either later commit.

The runtime bundles pinned CPython 3.12.14, the seven owned component wheels,
relative component launchers, the managed-project bridge, component and runtime
licenses, and the existing ten-verb `vivary_cli` router. It needs no global
Python, source checkout or first-launch install.

## Packaged Linux behavior

- After relocation outside the source checkout, create, adopt, doctor,
  capabilities, check, find, decide, review, impact and control passed their
  real command fixtures.
- Core, Tropo, Strato, Ozone and Exo reported installed with no readiness
  reasons.
- The actual Node and Workbench application completed New project and opened
  its five-file preview.
- The rebuilt packaged Electron application opened canonical `/` with
  `app.isPackaged` true, sandboxing and context isolation on, and Node
  integration off.
- Authenticated Doctor returned HTTP 200 using Python 3.12.14 with exit code 0.
  The request produced one private application receipt and no project receipt.
- Normal window close stopped the owned loopback server. The relocated
  temporary directory was clean and no fixture process remained.

Two rejected artifacts identified real defects. Electron Packager's default
resource copy rewrote relative Python symlinks to temporary absolute paths; the
package now uses its supported `afterCopyExtraResources` hook with a
verbatim-symlink copy. Desktop readiness also required HTTP 200 from `/agent`
after that compatibility route became a redirect; readiness and the window now
use canonical `/`.

The raw package evidence is:

- `.tmp/original-runtime-acceptance/final-fixed-cli-evidence/result.json`
- `.tmp/original-runtime-acceptance/final-fixed-app-result.json`
- `.tmp/original-runtime-acceptance/final-routefixed-electron-evidence/result.json`
- `.tmp/original-runtime-acceptance/final-routefixed-electron-evidence/electron-original.png`
- `.tmp/original-runtime-acceptance/final-routefixed-electron-summary.json`
- `~/.vivary/workbench/original-runtime/receipts.jsonl`

These are local inputs to this record, not tracked release artifacts.

## Final Linux package after packaging repairs

The full Linux x64 Electron folder built at timestamp
`2026-09-15T03-54-07-393Z` from code commit
`e6f38f9ffcd2fbcd50d49c93864924fa238a9ff1`. Its `build.json` records
`sourceDirty: true`, a `git-archive-with-tracked-overlays` snapshot with 16
tracked overlays, no untracked files, and
`commitMatchesPackagedSource: false`. The prebuilt Workbench output was
captured once; `sourceCommitVerified: false` is explicit. The original runtime
manifest records CPython 3.12.14 and seven owned components. This is the
tested package identity, not a clean-commit artifact claim.

After relocation outside the source checkout, the actual packaged Electron
window opened with sandbox and context isolation on and Node integration off.
New Project previewed five files, created the project and returned it as
available in the catalog. Authenticated Doctor returned HTTP 200 using the
bundled Python 3.12.14 with exit code 0. One private application receipt was
recorded and no project receipt. Normal close stopped the owned server. The
raw evidence is at
`.tmp/original-runtime-acceptance/final-e6f38f9-artifact.json` and
`.tmp/original-runtime-acceptance/final-e6f38f9-electron-evidence/result.json`.
There were no page errors or console errors before close. The post-close
connection-refused probes observed the expected stopped server.

## Adapter review

The reviewed adapter now:

- Requires adoption to use the exact `sha256:` plan digest returned by preview.
- Sends control input through a private temporary request file and removes the
  file after success or failure.
- Records app-owned receipts for both successful and failed decide calls,
  without request or output content.
- Allows one original process at a time and returns a bounded busy result for a
  second request.
- Rejects foreign actor, project, authority and path scope before spawning.
- Labels decide and control results `caller-provided-evidence`. This is a pure
  evaluation description, not an execution grant.
- Runs Python as `-I -X utf8 -B -m vivary_cli`.

The real adapter result at
`.tmp/original-runtime-acceptance/review-adapter-result.json` passed adoption,
decide and control. It includes a refused decision with exit code 2 and its
failed app receipt. Five receipts stayed in private application data, no
receipt entered the project, all temporary request files were removed and no
model call occurred.

## Refreshed private preview

The final private preview combines Workbench source
`721735cbd03be8880662f98fbcbb74d84e4cc967` with held project-session
source `ff3ae49d9a51dfeeaff7735797312001c16aad4c`. The selected project was
`runtime-review-20260914`.

The UI produced the five-file plan, performed the actual create and displayed
the formatted `STATE.md` view. The panel closed cleanly with the new project
still selected. The public Native session returned HTTP 200 with its token.
Authenticated Doctor returned HTTP 200 using Python 3.12.14, and control
returned HTTP 200 with evaluation
kind `caller-provided-evidence`. A foreign identity returned HTTP 400 before
runtime work. The two read-only probes produced four private receipts, no
project receipt, no model calls and no remaining request files. The first
browser developer probe timed out after Doctor and control had completed;
receipt inspection confirmed completion before the same safe calls were
repeated with an adequate timeout.

The raw result is
`.tmp/original-runtime-acceptance/hosted-review-result.json`.

The previously created `bundled-runtime-final-20260914` project remained
available through the latest refresh. Other older saved roots remain
unavailable, and reconnect or rebind is not implemented.
[Issue #15](https://github.com/vivary-dev/Vivary-New/issues/15) owns that
recovery. This issue #7 slice does not weaken root identity checks or claim that
every old root survives a host refresh.

## Clean-host runtime assembly

The ignored reproducible proof at
`packages/desktop/.tmp/original-runtime/clean-proof-result.json` ran with
ambient pip and setuptools unavailable. It used SHA-256-verified pip 26.0.1 and
setuptools 84.0.0 in one temporary build environment, verified pip's vendored
distlib 0.4.0, then built, installed and wrote launchers before deleting that
environment.

Linux x64 and Windows x64 original runtimes each assembled seven components and
six relative component launchers. The Windows launchers had an MZ executable
stub and resolved the sibling bundled Python. Runtime destinations,
wheelhouses and build environments were removed after the proof, with no
lingering process.

The reviewed launcher change passed all nine focused desktop original-runtime
tests. One fresh Linux x64 runtime preparation used Python 3.12.14 and seven
pinned components. Both the top-level `bin/vivary find` and component
`python/bin/tropo query` wrote redirected output that decoded strictly as UTF-8
and retained literal `Café résumé`. All seven emitted Linux launcher paths
contained `-I -X utf8 -B`. The temporary runtime was removed. The ignored
reproducible script and result are at
`packages/desktop/.tmp/original-runtime/utf8-launcher-proof.mjs` and
`packages/desktop/.tmp/original-runtime/utf8-launcher-proof-result.json`. This
proves Linux runtime preparation and redirected output, not a final packaged
Electron artifact or Windows execution.

## Windows Electron folder

The earlier Windows x64 Electron folder was assembled at build timestamp
`2026-09-15T03-16-36-306Z`. It is 555 MiB. It is a superseded candidate after
the reviewed launcher and source-snapshot repairs; a new final folder must be
assembled and inspected. Its manifest records source
`8e0855c365dc1ae2a65be96a35d32acd9d63a436` with `source.dirty: true`,
seven components, six relative MZ x64 component launchers and 46 runtime
license files. The Electron application, bundled Node and bundled Python are
all x64 PE files. The manifest SHA-256 is
`c7b73c0df7aa047271369eeb208579c97541710069bb599c7e6494d66f82f8d4`.

The raw result is
`.tmp/original-runtime-acceptance/final-windows-assembly.json`. The folder was
assembled and structurally verified on Linux. It has not been executed on
Windows; issue #8 owns that first-launch and runtime evidence.

## Checks

The focused source checks include:

- 42 original-router and command-characterization tests.
- 15 desktop packaging and lifecycle tests.
- 5 startup tests, including a real HTTP redirect case.
- 11 original-runtime adapter tests before the final review repairs.
- 9 desktop original-runtime tests after clean-host backend preparation.
- 4 managed-project and lifecycle tests.
- 3 managed-project Python tests.
- 42 Native-action and original-command tests after owner-action registration.
- 24 CI-workflow tests and 8 launcher tests.
- TypeScript checking and the production build.
- Source-navigation, graph, guide, line-ending and diff checks.
- Independent source review with all findings closed.

The earlier failed
[CI run 34917863599](https://github.com/vivary-dev/Vivary-New/actions/runs/34917863599)
identified the pip-vendored-distlib mismatch. The corrected `721735c` source
passed all seven jobs in run 34922890114. Clean-host backend `8e0855c` passed
all seven jobs in run 34923985842. The reviewed code commit `e6f38f9` passed
all seven jobs in
[CI run 34926748026](https://github.com/vivary-dev/Vivary-New/actions/runs/34926748026).
Automated review found no new issue, and the two reviewed launcher/snapshot
threads were resolved. This is code-head CI and review evidence; the linked PR
owns final documentation-head delivery status.

## Remaining acceptance

Issue #7 acceptance evidence is complete for the tested source and artifacts.
The earlier Windows Electron folder is a superseded candidate. The final Linux
package passed relocated all-ten-verb and packaged-Electron journeys after the
reviewed launcher and source-snapshot repairs. The final Windows folder passed
assembly and structural checks on Linux. Actual Windows execution remains
unrun and belongs to issue #8. Recovery of unavailable roots and reconnect or
rebind remain with issue #15. The linked PR in issue #7 owns final CI and merge
status; issue #7 remains open until delivery completes. This evidence does not
establish merge, signing, upgrade behavior, release readiness or publication.
Record those results only after their owning checks finish.
