# 06g: Save project and conversation selections reliably
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/5
Parent: 06
Status: done
Depends-on: [03c]
Owner: Coordinating Codex, sole local-access and application-state writer
Scope: Repair the observed selection-save failure through the existing local owner and Native application-state boundary.
Verification-kind: runtime
Evidence: [Reliable state verification](../receipts/06g-reliable-state.md)
Verification-result: passed
Timebox: One focused state-persistence fix and its affected GUI journey.

## Goal

Select a workspace and conversation, change appearance, reopen the app, and
recover those choices without a save warning.

## Context

Read [the desktop release target](../desktop-release.md), [Native owners](../native-owners.md),
and the [recovery findings](../receipts/salvage-handoff-2026-09-12.md).
Local installation needs no Vivary login. The private Zo preview retains its
existing owner-login boundary. Model-provider login is a separate setting.
The hosted browser kept its Native cookie, but the tested private proxy path
did not forward the Cookie header to Node. An explicit same-origin request had
the same result. The proxy preserved `X-Vivary-Session`. The parked auth
proposal remains evidence to review, not an accepted fix.

## Owned files

- `packages/workbench/server/local-access.ts` and its focused tests.
- The shared client state writer and its focused transport tests.
- Native state callers for projects, conversations, and appearance.
- Project selection schema and existing component tests.

## Done condition

The same authorized owner can save selections and appearance and reload them.
Failure keeps the user's choice visible with a usable retry. A revoked project
cannot fall back to another workspace. Unauthenticated remote requests remain
denied. The desktop remains loopback-only and needs no Vivary account.
The fix does not create another state store or relax unrelated action guards.

## Verify

Reproduce the failing hosted write with safe diagnostics. Test the actual cause,
then repeat selection, navigation, refresh, appearance, and restart on Zo.
Retain negative access checks and repeat the local desktop path under 23b.

```console
pnpm --dir packages/workbench exec tsx --test tests/local-access.test.ts tests/native-state.test.ts
pnpm --dir packages/workbench exec tsc --noEmit -p tsconfig.json
git diff --check
```

## Stop conditions

Do not publish the private service or bypass its access boundary. If the chosen
fix expands access, present the exact reviewed change and obtain its specific
authority before deployment. Do not pop unrelated parked work or edit Native
dependencies. A rejected auth change does not authorize an equivalent workaround.

## Implementation guidance

Use the shared client state writer for app-owned selections and appearance.
It reuses Native's public session and standard cookie transport. The private
preview accepts an additional existing-session header only for exact same-origin
application-state PUT requests, after the existing request and owner checks.
The client rejects redirects and does not replay a rejected token.

Persist Personal as `{ scopeKey, projectId: null }`; older missing/null values
remain readable. Keep failed requested selections visible. Retry must recheck
the original catalog scope and project availability. Retain failed theme and
palette values independently and load saved appearance once per provider mount.

## Verification state

Focused checks, independent review, hosted GUI persistence, loopback restart,
and narrow-screen keyboard acceptance passed. The [verification receipt](../receipts/06g-reliable-state.md)
owns the observed results and limits. The PR owns final-head CI status.
Windows product acceptance remains under issue #8; draft-text continuity remains
under issue #9. The stale Zo folder grant was preserved for explicit recovery
under issue #15.

## Log

- 2026-09-13: Named the observed selection-save failure as the first product
  repair. No auth change or new persistence acceptance is claimed.
- 2026-09-14: Added the bounded private-preview state bridge, scoped Personal
  representation, and explicit project and appearance retries. Source and
  focused runtime checks pass. Hosted and loopback GUI acceptance, including
  failed writes, restart, and narrow-screen keyboard focus, passed after fixes.

## Shared desktop and web behavior

Verify authorized saves and reloads in desktop and narrow browsers connected to the same host. Preserve denied remote access checks. New remote connection setup belongs to #30 and must not expand this save repair.
