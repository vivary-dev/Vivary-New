# 11: Finish files, drafts, and conflict-safe editing
Type: outcome
Status: planned
Blocked-by: [05, 06, 08]
Unlocks: [17, 24, 29]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Goal

Make work panels operate on authorized project files while preserving dirty drafts and external edits.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own file browser, editor, preview, draft persistence, conflict dialog, and tests. Read Littleagent S-01 findings and `migration.md` hazards. Agent-Native personal resources cannot stand in for arbitrary project files.

## Done condition

Drafts survive reload and project switches. External changes and remote deletion produce reviewable conflicts. Saves bind the expected file identity and never overwrite a changed file silently.

## Verify

Run browser tests for reload, project switch, external edit, rename, deletion, save race, unsupported binary, path traversal, and denied root. Compare bytes after each conflict case.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packets

- [11a: Authorized file editing](../packets/11a-authorized-workspace-file-editing.md): finish real file access, drafts, and conflict handling.
- [11b: Generated project views](../packets/11b-generated-project-views.md): derive map/state views while preserving authored STATE.md until a migration is resolved.
- [18a: Scoped file memory](../packets/18a-scoped-file-memory.md): reuse file editing and Native context loading for cross-session continuity.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-13: Added editor and derived-view packets. Generated state requires an explicit writer/input/migration contract, not automatic replacement of authored state.
