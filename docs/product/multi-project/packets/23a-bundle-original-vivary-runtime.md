# 23a: Bundle the original Vivary command runtime
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/7
Parent: 23
Status: done
Depends-on: []
Owner: Root-assigned desktop packaging and original-CLI integrator
Scope: Include the existing Python suite and its runtime in the desktop distribution.
Verification-kind: runtime
Evidence: [Bundled original runtime verification](../receipts/23a-bundled-original-runtime.md)
Verification-result: passed
Timebox: One source-free runtime packaging increment with focused command routing checks.

## Goal

Ship all ten original Vivary verbs in the packaged standalone CLI without a
source checkout, global Python installation, or installation on first launch.
The application adapter exposes only the currently safe project-scoped subset.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [Native owners](../native-owners.md).
The current package contains Electron, ordinary Node and compiled Workbench only.
Reuse `packages/vivary/vivary_cli.py` and its component/version routing.
Original owners remain creator, Tropo, Strato, Ozone, Exo and shared Core.

## Owned files

- `packages/desktop/package.mjs`, `windows-target.mjs`, package metadata and README.
- `packages/workbench/bin/start.mjs` and a small deterministic original-runtime adapter.
- `packages/vivary/vivary_cli.py` and package manifests only for required relocation support.
- Existing component packages under `packages/{create-vivary,tropo,strato,ozone,exo,core}/`.
- `packages/vivary/tests/test_vivary_router.py`, `test_vivary_cli.py`, and command characterization.

## Done condition

The artifact includes a pinned compatible Python runtime, required original
packages and licenses, with no runtime download or dependence on checkout paths.
Preserve create, adopt, doctor, capabilities, find, check, decide, review, impact
and control through their existing router and owners. Do not replace them with stubs.
A bounded server adapter invokes allowlisted verbs using the selected project grant.
GUI actions and bundled CLI can share this runtime without another daemon.
Private runtime state belongs in app data. Use the supported VIVARY_RECEIPT_LOG
setting for app-invoked CLI execution receipts, which otherwise default inside
.vivary. Preserve standalone CLI defaults and intentional project evidence records.
Keep the existing logs and email-draft helpers available in the bundled CLI.
Email-draft verification creates a local draft only. It does not send email.
Templates and source files remain portable.
Build metadata records source and component versions. No credentials or live data ship.
Unavailable optional providers stay optional and produce existing actionable errors.

## Verify

Run the existing router and characterization tests, then exercise each packaged
verb on suitable disposable fixtures after relocating the artifact outside the checkout.
Include real create/adopt/doctor/find flows. Help output alone is insufficient.
Use deterministic fixtures for policy, review, impact and coordination commands.

```console
python3 -B packages/vivary/tests/test_vivary_router.py
python3 -B packages/vivary/tests/test_command_surface_characterization.py
node --test packages/desktop/tests/main.test.mjs packages/desktop/tests/original-runtime.test.mjs
pnpm --dir packages/workbench exec tsx --test tests/original-runtime.test.ts
```

## Stop conditions

Do not publish packages, install global CLIs, copy credentials, restore the skipped
Linux-only creation provider unchanged, or add another agent executor to run deterministic verbs.

## Log

- 2026-09-13: Drafted. Current desktop artifacts do not include the original Python suite.
- 2026-09-14: Workbench repair `721735c` binds the original commands to the
  selected actor, project and scope, preserves exact adoption and governed
  inputs, uses private control files and decide receipts, and passed all seven
  CI jobs. Clean-host backend `8e0855c` assembles both Linux x64 and Windows
  x64 original runtimes without ambient pip or setuptools. The latest private
  preview passed create, Doctor, control and foreign-identity rejection.
  The 555 MiB Windows x64 Electron folder passed structural verification,
  and all seven `8e0855c` CI jobs passed. That folder is a superseded candidate:
  reviewed `-I -X utf8 -B` launchers and a tracked-source packaging snapshot
  were followed by an e6 Linux package with all ten standalone verbs and an
  Electron journey pass, plus a structurally checked e6 Windows x64 folder.
  PR review then found that a project stat cannot hold existing-folder custody
  across preview and apply. Commit `9afa1ad` makes application create/adopt
  preview-only; apply belongs to issues #14/#15. Commit `2885589` rejects
  governed scope paths that cross links or raw parent segments. Its focused
  tests, seven CI jobs and actual hosted guard requests passed. The e6
  packages precede both guards. The rebuilt `2885589` Linux folder passed all
  ten standalone CLI verbs and the packaged-Electron New Project, Doctor and
  apply-refusal journey. The matching Windows folder passed structural checks
  on Linux. The linked PR owns final merge; actual Windows execution remains
  with issue #8. See the linked receipt.
- 2026-09-15: [PR #44](https://github.com/vivary-dev/Vivary-New/pull/44)
  merged into `dev` at `684b4e8e4041493940b4b534d75df66ad129f5c0` and
  issue #7 closed. The bundled-runtime slice is delivered; actual Windows
  execution remains issue #8 and existing-folder apply remains #14/#15.
