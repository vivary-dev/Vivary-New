# 04c: Retain provider sessions outside project folders
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/10
Parent: 04
Status: needs-info
Depends-on: [04a]
Owner: Root-assigned Native runtime adapter integrator
Scope: Bind provider session and log references to existing Native runs while preserving provider ownership.
Verification-kind: runtime
Needs: 04a accepted and a supported pinned-Native seam verified for provider persistence and resume.
Timebox: One provider-session integration with focused lifecycle checks and bounded provider journeys.

## Goal

A project chat can identify and resume its provider session, with runtime logs
stored outside the user's project and visible through safe app references.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [Native owners](../native-owners.md).
Native Code already saves run JSON and transcript JSONL in private app data.
Its pinned Claude executor currently omits session options, causing the participant
to disable native session persistence. Do not mistake Native replay for provider resume.

## Owned files

- `packages/workbench/server/local-code-agent.ts` and `code-execution-worker.ts`.
- `packages/workbench/server/code-execution-protocol.ts` and host code only where required.
- `packages/workbench/bin/start.mjs` for explicit runtime-storage configuration.
- A small session-details view and scoped action referencing 04a session identities.
- Existing `code-execution-host.test.ts`, `code-host-lifecycle.test.ts`, and `local-code-agent.test.ts`.

## Done condition

Each supported provider invocation records its native session identifier when
available and states whether a follow-up resumes it or reconstructs context.
Use a supported Native API. Unsupported persistence is reported without a false resume claim.
Provider logs default outside selected projects. Native stores session/log references
in app data. Provider-native files and Native transcripts retain their existing owners.
Do not repoint an entire provider credential directory merely to relocate logs.
The user can open relevant log details without exposing credentials or arbitrary paths.
Restart, Stop and interrupted runs preserve references without attaching another session.
Claude Code and Codex each pass session/log checks. An unresolved provider remains unaccepted.

## Verify

Use focused lifecycle fixtures for references, missing logs and denied projects.
Then run the minimum already-authorized provider journeys: start, follow up, stop,
restart and resume. Inspect writes in disposable project and app-data directories.
No additional model budget or account operation is granted by this packet.

```console
node --test packages/desktop/tests/main.test.mjs
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Do not patch node_modules, install another executor, duplicate credentials, or
claim provider continuity from a matching title. Escalate a missing supported Native seam.

## Log

- 2026-09-13: Drafted. Provider-session persistence remains unimplemented.
