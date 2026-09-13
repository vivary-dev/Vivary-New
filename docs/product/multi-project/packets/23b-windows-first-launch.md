# 23b: Make the packaged application start on Windows
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/8
Parent: 23
Status: needs-info
Depends-on: [23a]
Owner: Root-assigned Windows desktop integration owner
Scope: Validate and fix first launch, local dependencies, provider setup and shutdown on Windows.
Verification-kind: runtime
Needs: 23a accepted and its current Windows x64 artifact available for the authorized laptop journey.
Timebox: One Windows first-launch increment after the hosted application check.

## Goal

Extract the private Windows package, open Vivary.exe from Explorer, connect a
folder and use a configured coding runtime without installing the app's dependencies.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [desktop packaging](../../../../packages/desktop/README.md).
An older unsigned Windows folder exists at source 2b33101. Assembly was checked,
but Windows execution was not accepted. Use a fresh artifact from the current source.
Test hosted changes first, then this normal Windows package. Do not revive old proof campaigns.

## Owned files

- `packages/desktop/main.mjs`, `package.mjs`, `windows-target.mjs`, and README.
- `packages/workbench/bin/start.mjs`, `desktop-server.mjs`, and `server/desktop-host.ts`.
- `packages/workbench/server/local-runtime-setup.ts` and native setup UI only as needed.
- Existing desktop `main.test.mjs`, Workbench `startup.test.mjs`, `desktop-host.test.ts` and runtime tests.

## Done condition

A clean Windows profile opens the packaged executable with required siblings intact.
Bundled Node/Python/native modules work without global Node, Python or a source checkout.
Vivary opens without signup. Missing model CLIs or login show accurate setup guidance.
Folder selection works with spaces and Unicode, and files resolve to the selected project.
One authorized model request shows real tool output through the normal packaged UI.
A second application launch preserves the existing instance and its data.
Closing during idle and active work stops owned children while preserving files and history.
Unexpected Open With prompts are launcher defects. Do not change file associations.

## Verify

Use Explorer launch and the real system folder dialog on Windows after hosted checks.
Inspect local app data and provider setup, run one bounded authorized file-tool turn,
close/reopen and confirm port release and child cleanup. Use existing model limits.
Run relevant existing tests on the target platform. Record failures separately from build success.

```console
node --test packages/desktop/tests/main.test.mjs
node --test packages/workbench/tests/startup.test.mjs
pnpm --dir packages/workbench typecheck
```

## Stop conditions

Do not disable Defender, add exclusions, alter file associations, bundle provider
credentials, or claim Windows support from a Linux cross-build. Signing and publication are separate.

## Log

- 2026-09-13: Drafted. The existing Windows portable artifact has no accepted runtime journey.
