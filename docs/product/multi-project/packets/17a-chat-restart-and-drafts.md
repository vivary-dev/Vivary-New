# 17a: Restore project chats and drafts after restart
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/9
Parent: 17
Status: needs-info
Depends-on: [04a, 06g]
Owner: Root-assigned Workbench continuity integrator
Scope: Persist project/session selection and unsent text through Native state across desktop origins.
Verification-kind: runtime
Needs: 04a supplies stable project/session keys and an unassigned-history location. 06g supplies accepted selection persistence across local and hosted access.
Timebox: One restart-continuity increment with focused state checks and the real desktop journey.

## Goal

Close Vivary and reopen it to the same project and conversation, including an
unsent text draft, even when the local server uses a different port.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [Native owners](../native-owners.md).
Completed Code transcripts already persist. Native composer drafts currently use
browser storage and do not survive an origin change. Hosted selection-save warnings
are known. Follow the separately owned access fix rather than bypassing authentication.

## Owned files

- `packages/workbench/app/routes/agent.tsx`, `chat.tsx`, and 04a shared session navigation.
- `packages/workbench/app/components/projects/ProjectContext.tsx`.
- Native application-state adapters at the smallest supported public seam.
- `packages/workbench/bin/start.mjs` and desktop startup only if stable identity requires it.
- Existing `chat-scope.test.ts`, `startup.test.mjs`, and `packages/desktop/tests/main.test.mjs`.

## Done condition

Project selection, active session and unsent text use stable owner/project/session keys.
Persist drafts through Native state without becoming another message or transcript store.
Restoring a draft never sends it automatically or adds an extra conversation.
Two projects retain different drafts, and stale asynchronous saves cannot overwrite
a newer selection or resurrect a draft after a successful send or explicit discard.
Missing folders retain their session and draft without switching to Personal workspace.
Interrupted work is shown honestly and global Stop remains available where applicable.
Changing the desktop port does not lose completed history, selection or text drafts.

## Verify

In the normal GUI, type distinct unsent drafts in two projects, navigate, close,
reopen on another port and inspect both. Send one and verify it stays cleared.
Exercise save failure, rapid switching and unavailable-folder recovery with focused cases.
Test the desktop journey after the corresponding hosted application behavior works.

```console
node --test packages/workbench/tests/startup.test.mjs
node --test packages/desktop/tests/main.test.mjs
pnpm --dir packages/workbench typecheck
```

## Stop conditions

Do not solve origin changes by copying browser profiles, invent a second history
store, or weaken local/private-proxy access. Never submit a restored draft automatically.

## Log

- 2026-09-13: Drafted. Cross-origin draft restoration is not accepted.

## Shared desktop and web behavior

Include browser refresh, navigation away and back, interrupted connection, and an on-screen keyboard. Restore drafts through the existing host-owned Native state without automatic sending or a second synchronization system.
