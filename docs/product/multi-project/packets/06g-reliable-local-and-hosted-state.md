# 06g: Save project and conversation selections reliably
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/5
Parent: 06
Status: in-progress
Depends-on: [03c]
Owner: Coordinating Codex, sole local-access and application-state writer
Scope: Repair the observed selection-save failure through the existing local owner and Native application-state boundary.
Verification-kind: runtime
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

## Verification state

Implementation and source checks have passed. Packet acceptance remains open
until the full hosted and desktop journeys complete.

- The client reuses Native's public `useSession()` result. If the authenticated
  session has no token, it uses Native's standard cookie-backed state writer.
- If Native supplies a valid token, the client sends it only as
  `X-Vivary-Session` on an exact same-origin application-state PUT. The
  request rejects redirects. A 401 invalidates the Native session and blocks
  replay of the rejected token.
- The private preview accepts the header only for an exact application-state
  PUT after the existing request guard, same-origin checks, and stored-owner
  lookup succeed. Local desktop requests continue to use the Native cookie.
- The app does not add a token store, log token values, patch global fetch, add
  a route, or accept a tokenless mutation.
- Personal workspace persists as `{ scopeKey, projectId: null }`. The reader
  remains compatible with a missing value and the older raw `null` value.
- Project selection and appearance keep failed choices visible. Project Retry
  revalidates the catalog and scope. Appearance Retry retains theme and palette
  failures independently.
- A hosted JavaScript request using the eligible header returned 200 for PUT
  and 200 for GET, and the saved value matched exactly.
- The focused checks passed: 23 server tests, 9 client transport tests, the
  Personal-selection component remount, direct typecheck, and the production
  build.
- Project-journey verification uses normal shared temporary app data. The old
  Zo9p grant points to a folder whose inode changed, so the registry correctly
  reports that grant unavailable.

## Log

- 2026-09-13: Named the observed selection-save failure as the first product
  repair. No auth change or new persistence acceptance is claimed.
- 2026-09-14: Added the bounded private-preview state bridge, scoped Personal
  representation, and explicit project and appearance retries. Source and
  focused runtime checks pass. Full packet acceptance remains pending.

## Shared desktop and web behavior

Verify authorized saves and reloads in desktop and narrow browsers connected to the same host. Preserve denied remote access checks. New remote connection setup belongs to #30 and must not expand this save repair.
