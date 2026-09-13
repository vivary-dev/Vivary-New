# 18a: Reload scoped file memory across conversations and restarts
Type: packet
Parent: 18
Status: needs-info
Depends-on: [11a]
Owner: Root-assigned Native context and file-memory integrator
Scope: Wire compact project guidance and sourced durable notes into existing Native runs, with visible correction and active-memory removal.
Verification-kind: runtime
Needs: Root accepts 11a and selects the authoritative project-memory paths, context loading boundary, and conflict behavior.
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Record one confirmed project fact through the GUI, retrieve it in a fresh
conversation after restart, correct it, and remove it from active memory.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

Follow [file memory and persistence](../research/file-memory-and-persistence.md)
and the existing outcome 18 instruction/skill-learning rules. The current source
review disproved a blanket non-Git block for S5. Do not create that restriction
or mark it as an expected failure. This packet proves the actual application path.

## Owned files

- Native Code context preparation and related actions in `packages/workbench/server/`.
- The file-editing/memory presentation from 11a and the selected guidance files.
- Existing Tropo context integration only where project-scoped retrieval needs it.
- Focused loading/correction/scope tests and the real memory GUI journey.

## Done condition

A run resolves its current authorized project, reads compact instructions/state,
and retrieves relevant durable facts from their owning files. A fresh conversation
and application restart recover the confirmed fact without replaying an old chat.
The UI shows where memory is stored and when changed context becomes effective.

Correcting a fact updates its owner instead of adding a competing statement.
Forgetting removes it from active memory retrieval, with explicit disclosure that
historical transcripts, versions, and backups may remain. Switching projects
never imports another project's private context. Global owner or machine-memory
access requires a separately defined grant and is not implied by a file link.

Basic continuity works without Brain, semantic providers, VCS, Beads, or Entire.
Native remains the owner of conversations, tools, and runs. Source notes and
progress updates do not automatically become instruction or skill changes.
Existing reviewed learning rules still govern those changes.

## Verify

Use the GUI to save, restart, recall, correct, and forget one sourced fact.
Exercise two projects with distinct facts and verify isolation, including missing
or revoked access. Repeat the small continuity case with optional providers and
VCS disabled. File existence or a manually supplied prompt is not proof of loading.
Use existing model-call authority and budgets only for the necessary real-agent check.

```console
pnpm --dir packages/workbench typecheck
node --test packages/workbench/tests/project-services.test.mjs
git diff --check
```

## Stop conditions

Do not add a memory daemon, duplicate transcript store, automatic history import,
mandatory human gate for every ordinary fact, or new backend. Do not bypass private
source exclusions, authorize cross-project promotion, or claim complete historical erasure.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.
