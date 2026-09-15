# Bundled original runtime verification

Evidence-record: 23a
Date: 2026-09-14
Acceptance status: delivered in PR #44; issue #7 closed; Windows execution remains issue #8

[Issue #7](https://github.com/vivary-dev/Vivary-New/issues/7) owns acceptance
and delivery. This receipt records the reviewed `2885589` source and tested
private artifacts. The issue is closed after the reviewed PR merge; this
receipt does not claim a Windows launch.

## Current boundary

The package includes pinned CPython 3.12.14, seven owned component wheels, six
relative component launchers, runtime and component licenses, the managed
New Project bridge, and the existing ten-verb `vivary_cli` router. The
standalone CLI retains create, adopt, doctor, capabilities, check, find,
decide, review, impact and control with their original flags. It also retains
local logs and email-draft helpers. It needs no global Python, source checkout
or first-launch download.

The application original-command adapter in final source
`2885589f1757cff1ec803c777477737cbe9e7101` is narrower. It makes create
and adopt preview-only: an application request to apply either operation to an existing
folder is refused before invocation. The separate managed New Project flow
still creates its approved project. [Issues #14](https://github.com/vivary-dev/Vivary-New/issues/14)
and [#15](https://github.com/vivary-dev/Vivary-New/issues/15) own a later
existing-folder apply path with portable held custody; a plan digest or
ordinary stat is not that custody.

The same source checks the selected project root and governed decide/control
paths before invocation and again before execution. It rejects raw `.` and `..` segments before normalization,
symlink/junction parents and foreign resolved paths. Missing children are
allowed only below a verified existing parent. Nested scope and capsule paths
receive the same check. This boundary check does not grant execution or hold
custody for a later write. Decide and control remain labeled
`caller-provided-evidence`, not an execution grant. The adapter keeps actor,
project, authority and host authorization, denial, approval and Stop boundaries;
it admits one original process at a time. Its app-invoked receipts stay in
private application data. Standalone CLI receipts retain their original
defaults and intentional project evidence locations.

The desktop packager captures a tracked-source snapshot before downloads or
assembly: recorded HEAD plus tracked working-tree overlays, excluding
untracked files. Every bundled standalone and component launcher uses the
relative interpreter with `-I -X utf8 -B`. The prebuilt Workbench output is
captured once, and build metadata explicitly does not verify it against the
source commit. The [desktop packaging contract](../../../../packages/desktop/README.md)
records the pinned runtime, build prerequisites and license inventory.

## Hosted guard evidence

The private hosted preview on final source `2885589` accepted a direct
governed request at HTTP 200 with exit code 0 and
`caller-provided-evidence`. Linked and raw-parent paths returned HTTP 400
before invocation. The selected older unavailable project remained selected,
no model call occurred, and the owned fixture link and outside test directory
were removed.
Raw result: `.tmp/original-runtime-acceptance/hosted-scope-after.json`.
The packaged-Electron proof below separately exercises create/adopt apply
refusal on the final source.

## Guarded Linux package

The Linux x64 Electron folder built at `2026-09-15T04-48-17-876Z` from source
`2885589f1757cff1ec803c777477737cbe9e7101`. Its metadata records
`sourceDirty: true`, six tracked overlays, untracked files excluded and
`sourceCommitVerified: false` for the prebuilt Workbench output. It is the
exact tested artifact identity, not a clean-commit build claim.

After relocation outside the checkout, all ten standalone CLI verbs passed
real fixtures with no global Python or source imports. Core, Tropo, Strato,
Ozone and Exo reported installed with no readiness reasons. The CLI fixtures
recorded six intentional project receipts and two app-data receipts. The logs
helper read both receipt locations; the email helper created a local draft and
sent nothing. Raw result:
`.tmp/original-runtime-acceptance/final-2885589-cli-evidence/result.json`.

The actual packaged Electron window opened with sandbox and context isolation
on and Node integration off. Managed New Project previewed five files, created
the project and returned it as available in the catalog. Authenticated Doctor
returned HTTP 200 and exit code 0 using bundled Python 3.12.14. Two
application existing-folder apply requests returned HTTP 400. Doctor wrote one
private app receipt and no project receipt. Normal close stopped the server.
There were no page errors; the two expected HTTP 400 console messages appeared
before close, and post-close connection-refused probes confirmed shutdown.
Raw result: `.tmp/original-runtime-acceptance/final-2885589-electron-evidence/result.json`.

A separate fresh Linux runtime preparation verified literal redirected UTF-8
output from both top-level `vivary find` and component `tropo query`, including
`Café résumé`. Its ignored reproducible result is at
`packages/desktop/.tmp/original-runtime/utf8-launcher-proof-result.json`.
Clean-host Linux and Windows runtime preparation without ambient pip or
setuptools is retained at
`packages/desktop/.tmp/original-runtime/clean-proof-result.json`.

## Guarded Windows assembly

The matching Windows x64 Electron folder built at
`2026-09-15T04-53-20-040Z` from source `2885589`. Its metadata reports
`sourceDirty: true`, six tracked overlays, untracked files excluded and a
prebuilt Workbench output not verified against the commit. Structural
inspection on Linux passed seven components, six relative UTF-8 MZ launchers,
46 runtime license files, and x64 PE application, Node and Python binaries.
Runtime manifest SHA-256:
`55674adaea5688ef4dee1243283101958b724112e1a0ef19661d1cfd8be683bd`.
The ZIP was integrity-checked at 228,534,356 bytes with SHA-256
`e9c33d0a67d0da27be10339db80c2560a4967a5146be02d0e351791f17fa1d85`.
Raw assembly result:
`.tmp/original-runtime-acceptance/final-2885589-windows-assembly.json`.
Raw archive result: `.tmp/original-runtime-acceptance/windows-archive-2885589.json`.
The folder and ZIP have not been executed on Windows;
[issue #8](https://github.com/vivary-dev/Vivary-New/issues/8) owns that proof.

## Checks and retained history

The corrected source passed 19 focused adapter tests, nine desktop
original-runtime tests, router and command characterization, TypeScript checks,
normal and combined Workbench builds, and all seven jobs in
[CI run 34929560537](https://github.com/vivary-dev/Vivary-New/actions/runs/34929560537).
Independent and automated source review closed the reported findings with no
new finding on `2885589`; all review threads were resolved. The linked PR owns
final documentation-head CI and merge status.

Earlier candidate results remain as historical inputs, not claims about the
corrected application boundary. The packaged Linux symlink-copy and canonical
route repairs are retained at
`.tmp/original-runtime-acceptance/final-routefixed-electron-evidence/result.json`.
The `8e0855c` Windows assembly and the `e6f38f9` CLI/Electron/Windows checks
are retained at `.tmp/original-runtime-acceptance/final-windows-assembly.json`,
`.tmp/original-runtime-acceptance/final-e6f38f9-cli-evidence/result.json`,
`.tmp/original-runtime-acceptance/final-e6f38f9-electron-evidence/result.json`
and `.tmp/original-runtime-acceptance/final-e6f38f9-windows-assembly.json`.
The earlier hosted write-guard and scope regression results are retained at
`.tmp/original-runtime-acceptance/hosted-write-guard-result.json` and
`.tmp/original-runtime-acceptance/hosted-scope-before.json`. The earlier
application adoption/apply observation at
`.tmp/original-runtime-acceptance/review-adapter-result.json` is superseded by
the held-custody finding. These ignored files and the reviewed Git commits
preserve the evidence without assigning old behavior to the final artifact.

## Remaining acceptance

The tested `2885589` source and Linux package passed the recorded hosted,
standalone CLI and packaged-Electron journeys. The matching Windows folder
passed structural checks on Linux. Actual Windows execution remains unrun
under issue #8. Recovery and reconnect/rebind for unavailable saved roots
remain with issue #15. Existing-folder apply in the application remains
deferred to issues #14/#15. [PR #44](https://github.com/vivary-dev/Vivary-New/pull/44) merged into `dev`
on 2026-09-15 at `684b4e8e4041493940b4b534d75df66ad129f5c0`, and
issue #7 closed. This delivery does not establish signing, upgrade behavior,
release readiness or publication.
