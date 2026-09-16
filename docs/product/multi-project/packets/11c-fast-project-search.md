# 11c: Search large project trees from the application
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/13
Parent: 11
Status: ready-for-agent
Depends-on: [03c]
Owner: Root-assigned Workbench project-search integrator
Scope: Add scoped filename and text search with bounded work, useful matches and file navigation.
Verification-kind: runtime
Timebox: One exact-search and source-navigation increment.

## Goal

Find a source file or text occurrence quickly in a large connected project and
open the matching file location without asking the agent to scan the whole tree.

## Context

Read [the desktop release target](../desktop-release.md),
[ENGINEERING.md](../../../../ENGINEERING.md), and [Native owners](../native-owners.md).
The existing inspector is a capped recursive Markdown/text/JSON list, not search.
Reuse authorized project resolution and available Native or CLI search primitives.
The separate [11d evaluation](11d-evaluate-zvec-search.md) owns zvec-grep adoption.
This packet supplies immediate filename, exact-text, and regex search.

## Owned files

- New `packages/workbench/actions/vivary-project-search.ts` and `server/project-search.ts`.
- A focused search panel under `packages/workbench/app/components/files/`.
- Existing `vivary-code-files.ts` and shared file navigation, coordinated with 11a.
- Existing `local-code-agent.test.ts`. Focused search scope, limits and cancellation tests.
- Desktop packaging only if the accepted search backend requires a bundled binary.

## Done condition

Filename and content searches run only within the current authorized project.
Results show paths, line numbers and excerpts and select the matching file location.
Respect project ignore/privacy rules and skip unsupported binary content by default.
Queries have explicit limits, cancellation and progressive results. Stale responses
cannot replace a newer query or appear after switching projects.
Measure cold and warm queries on a representative large fixture and record its size.
Keep any index in private app data, rebuildable from source and updated after edits.
The active agent can invoke scoped search through its supported Native tools or
bundled CLI. A GUI-only search field does not complete this ticket. Keep exact
search available without an index, model download, or semantic provider.

## Verify

Exercise large and small projects, no matches, Unicode/spaces in paths, changed
files, ignored/private paths, revoked access and query cancellation through the GUI.
Use a focused disposable fixture, ordinary timeouts and the existing test runner.
Record observed latency and memory. Do not add a benchmark service or model calls.

```console
node --test packages/workbench/tests/local-root-provider.test.mjs
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Do not accept arbitrary shell commands, search other projects by fallback, put
indexes in user folders, or require a paid embedding service for basic text search.

## Log

- 2026-09-13: App-owned project search is absent. 11d owns the optional semantic engine.

## Shared desktop and web behavior

Verify touch-accessible results, cancellation, and navigation to the matching file at narrow widths. Search executes inside the authorized project on the connected host.
