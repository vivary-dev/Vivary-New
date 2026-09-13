# 23a: Bundle the original Vivary command runtime
Type: packet
Parent: 23
Status: ready-for-agent
Depends-on: []
Owner: Root-assigned desktop packaging and original-CLI integrator
Scope: Include the existing Python suite and its runtime in the desktop distribution.
Verification-kind: runtime
Timebox: One source-free runtime packaging increment with focused command routing checks.

## Goal

Run all ten original Vivary verbs from the packaged application without a
source checkout, global Python installation, or installation on first launch.

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
Private runtime state belongs in app data. Templates and source files remain portable.
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
node --test packages/desktop/tests/main.test.mjs
```

## Stop conditions

Do not publish packages, install global CLIs, copy credentials, restore the skipped
Linux-only creation provider unchanged, or add another agent executor to run deterministic verbs.

## Log

- 2026-09-13: Drafted. Current desktop artifacts do not include the original Python suite.
