# 06g: Save project and conversation selections reliably
Type: packet
Parent: 06
Status: ready-for-agent
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
The current hosted browser reaches the app but some Native state writes return
401. The parked auth proposal is evidence to review, not an accepted fix.

## Owned files

- `packages/workbench/server/local-access.ts` and its existing focused tests.
- Existing Native state calls in `ProjectContext.tsx` and `app/routes/agent.tsx`.
- Existing startup configuration only if the reproduced cause requires it.

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
pnpm --dir packages/workbench exec tsx --test tests/local-access.test.ts
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Do not publish the private service or bypass its access boundary. If the chosen
fix expands access, present the exact reviewed change and obtain its specific
authority before deployment. Do not pop unrelated parked work or edit Native
dependencies. A rejected auth change does not authorize an equivalent workaround.

## Log

- 2026-09-13: Named the observed selection-save failure as the first product
  repair. No auth change or new persistence acceptance is claimed.
