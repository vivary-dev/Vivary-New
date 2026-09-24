# 17a: Restore project chats and drafts after restart
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/9
Parent: 17
Status: in-progress
Depends-on: [04a, 06g]
Owner: Root-assigned Workbench continuity integrator
Scope: Persist project/session selection and unsent text through Native state across desktop origins.
Verification-kind: runtime
Timebox: One restart-continuity increment with focused state checks and the real desktop journey.

## Goal

Close Vivary and reopen it to the same project and conversation, including an
unsent text draft, even when the local server uses a different port.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [Native owners](../native-owners.md).
At activation on 2026-09-23, completed Code transcripts persisted, but Native
composer drafts used browser storage and did not survive an origin change.
Issue #5 had repaired selection saves. The
[read-only integration findings](https://github.com/vivary-dev/Vivary-New/issues/9#issuecomment-5672430467)
identified the missing public draft seam. The implementation reuses the
existing authenticated state writer without copying browser-storage keys or
replacing Native history.

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
pnpm --dir packages/workbench test:chat-draft
pnpm --dir packages/workbench exec tsc --noEmit -p tsconfig.json
```

## Stop conditions

Do not solve origin changes by copying browser profiles, invent a second history
store, or weaken local/private-proxy access. Never submit a restored draft automatically.

## Log

- 2026-09-13: Drafted. Cross-origin draft restoration is not accepted.

- 2026-09-23: Activated after #16 completed. Dependencies #5 and #6 are
  accepted. Published Core still lacks a public draft restoration API. Extend
  the existing versioned Native patch at its owning composer components, then
  persist drafts through the existing authenticated application-state writer.
  Keep Native storage and execution ownership. All draft acceptance remains open.

- 2026-09-24: Hosted acceptance passed on clean `250b402f` with the unchanged
  bundled Python runtime from `079fba00`. The [receipt](../receipts/17a-chat-restart-and-drafts.md)
  records two project drafts, Native and Code sends, save failure and retry,
  lost-response recovery, rapid edits, unavailable folders, narrow layout,
  and bare-root restart on a different local port. Core and Toolkit use pinned,
  opt-in patches. The renderer close check passed. The packaged result follows
  below, and this packet stays in progress while keyboard input is unverified.

- 2026-09-24: The clean `250b402f` Windows EXE restored distinct Native and
  Code drafts after normal close and a changed-port bare-root reopen. A blocked
  SQLite save kept the window open. Retry then saved the text, and a second
  normal close and reopen retained it. One Native GUI send kept its history
  after refresh. A Code draft was accepted into a run that the fixture stopped
  at its first approval. The later Code follow-up was saved and explicitly
  discarded without losing accepted history. The [receipt](../receipts/17a-chat-restart-and-drafts.md)
  keeps the source metadata and fixture qualifications. The on-screen keyboard
  appeared but did not deliver input because automation could not control its
  higher-integrity window. Keep #9 open for that acceptance case and delivery.

## Shared desktop and web behavior

Include browser refresh, navigation away and back, interrupted connection, and an on-screen keyboard. Restore drafts through the existing host-owned Native state without automatic sending or a second synchronization system.
