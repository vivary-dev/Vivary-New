# 07d: Create and open a Vivary workspace through the GUI
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/15
Parent: 07
Status: needs-info
Depends-on: [07b, 06g]
Owner: Coordinating Codex, sole workspace-setup UI and action writer
Scope: Compose the accepted shared creator plan and apply operations into the existing project setup flow.
Verification-kind: runtime
Needs: 07b supplies the portable shared operation and 06g fixes authorized state saves.
Timebox: One Create, preview, apply, register, and reopen journey.

## Goal

Choose a folder, review its proposed guidance files, create the workspace, and
open its agent chat and files without a separate terminal setup step.

## Context

Read [the desktop target](../desktop-release.md), [07b](07b-shared-workspace-plan-apply.md),
and `packages/workbench/README.md`. The current Register project action connects
a folder. It does not create or adopt a Vivary workspace.
Use the original creator's content plan and existing Native actions and registry.
Start with the neutral five-file workspace. 07c adds composable starter content.

## Owned files

- Existing setup controls and project navigation in `packages/workbench/app/`.
- Deterministic creation actions and existing project-services adapters.
- Existing shared creator interfaces, only for a demonstrated caller mismatch.

## Done condition

The preview shows exact new and retained files and any conflicts. Confirming
applies only that plan. Changed inputs require a new preview. Existing content
is preserved, cancellation writes nothing, and repeated submission is safe.
The resulting stable project opens its files and chat, remains selected after
restart, and exposes its guidance to the agent. Failure offers a clear recovery
path without silently connecting the wrong folder.
No language-specific pack, VCS provider, cloud host, or model call is mandatory.

## Verify

Use a new disposable folder and a conflicting existing target. Check preview
bytes against written bytes. Exercise cancel, changed input, retry, restart,
and opening chat/files through the hosted GUI before Windows verification.

```console
python3 -B packages/create-vivary/tests/test_thin_init_preview.py
pnpm --dir packages/workbench typecheck
pnpm --dir packages/workbench build
git diff --check
```

## Stop conditions

Do not revive the skipped Linux-only creation provider unchanged. The UI cannot
grant custody or bypass a write refusal. Reuse Native components and inspect the
installed toolkit before writing setup widgets. Do not introduce a conductor.

## Log

- 2026-09-13: Split visible setup from shared creator work so each can be
  implemented and verified in one bounded change.
