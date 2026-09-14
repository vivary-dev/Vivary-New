# 04a: Bind every chat session to its project
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/6
Parent: 04
Status: ready-for-agent
Depends-on: [03c]
Owner: Root-assigned Workbench session integrator, sole writer of shared chat identity
Scope: Give Code and Full chat stable project-scoped session references using existing Native records.
Verification-kind: runtime
Timebox: One project-session increment with focused checks and a two-project GUI journey.

## Goal

Open a project, start either kind of chat, and find that conversation under the
same project after navigation and reopening.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [Native owners](../native-owners.md).
Code runs bind project, root, binding and owner. The issue #6 implementation
derives new Native chat identity from actor, organization and project. Older
organization-only chats keep their original scope under Unassigned. Native owns
runs, threads, messages and tools.
Project scope labels do not grant filesystem access. Resolve the current grant.

## Owned files

- `packages/workbench/app/lib/chat-scope.ts` and `components/layout/use-vivary-chat-identity.ts`.
- `packages/workbench/app/components/workspace/CodeConversation.tsx`, `NativeConversation.tsx`, and shared session navigation.
- `packages/workbench/server/local-code-agent.ts` and related scoped actions where needed.
- `packages/workbench/tests/chat-scope.test.ts` and `local-code-agent.test.ts`.
- Coordinate changes to `components/projects/ProjectContext.tsx` with its current owner.

## Done condition

Both chat surfaces use stable actor/organization/project scope. Personal workspace
is explicit. Each displayed session references its existing Native thread or Code
run. Switching projects never retargets an existing run or changes its ownership.
The project session list shows both kinds with working open links and runtime labels.
Existing organization-only chats remain accessible as unassigned history. They are
not silently assigned to the currently selected project or copied to another store.
Missing or revoked folders preserve history and keep global Stop available.
No Vivary signup is introduced. Provider authentication remains separate.

## Verify

Exercise two projects and Personal workspace through both chat surfaces. Create,
reopen and follow up in each. Verify cross-project queries refuse mismatched IDs.
Use the installed TypeScript runner for the named existing Code boundary tests.
Run the normal hosted GUI first. An isolated normal-app instance may use a deterministic
local provider when Native provider credentials are unavailable. Keep that proof
separate from an actual hosted model run. Leave draft-restart acceptance to 17a.

```console
pnpm --dir packages/workbench exec tsx --test tests/chat-scope.test.ts tests/native-chat-project.test.ts tests/local-code-agent.test.ts
pnpm --dir packages/workbench exec tsc --noEmit -p tsconfig.json
git diff --check
```

## Stop conditions

Do not add a session database competing with Native, retag old chats by inference,
or weaken project authorization to make the history list populate.

## Log

- 2026-09-13: Drafted for the desktop release. No implementation or acceptance claimed.

## Shared desktop and web behavior

Both chat surfaces and project/session navigation must remain usable at narrow phone widths. Project identity and Stop remain reachable. All sessions belong to the selected backend host.
