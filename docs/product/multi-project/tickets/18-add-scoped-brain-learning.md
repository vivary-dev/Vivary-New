# 18: Add optional Brain and reviewed learning
Type: outcome
Status: planned
Blocked-by: [03, 05]
Unlocks: [21, 22, 24, 30, 36]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Goal

Offer an optional Brain and a sourced project-scoped learning loop with review, correction, rejection, export, and documented deletion limits.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own Brain setup, project bindings, learning proposals, review UI, and tests. Read `design.md`, current second-brain and semantic-memory docs, and migration privacy constraints. Default scope is the originating project. Keep
[basic file continuity](../design.md#file-memory-and-setup-direction-2026-09-13)
independent of optional Brain, semantic providers, and the autonomous learning
pipeline. Reuse existing file and retrieval owners.

## Done condition

A user can skip Brain. Accepted setup keeps source files authoritative. Lessons carry evidence and scope. No proposal changes skills, instructions, or authority without review. Cross-project promotion requires explicit selection.

Project evidence continuity works with Brain disabled. Brain adds optional retrieval and reviewed promotion across scopes; it does not own acceptance or authorize changes to model, tools, policy, instructions, or skills.

## Verify

Complete a project evidence-to-next-plan handoff with Brain disabled and verify no Brain connection or permission is requested.

The basic memory journey records one sourced project fact, closes the app, and
retrieves it in a fresh conversation from files. Correct the fact and verify
that later recall uses the correction. Switch projects and verify the other
project does not receive the first project's private context. Repeat with VCS
and optional memory providers disabled. File presence alone is not acceptance.

Run tests for skipped setup, project-scoped retrieval, private-source exclusion, conflicting lesson, reject, accept, rollback, export, and deletion-limit disclosure.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packets

- [18a: Scoped file memory](../packets/18a-scoped-file-memory.md): prove S5 through save, restart, recall, correction, and active-memory removal.
- [11a: Authorized file editing](../packets/11a-authorized-workspace-file-editing.md): shared prerequisite for visible note edits and conflicts.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-05: Refined acceptance after the owner-requested [HoH comparison](../research/hoh-alignment.md). These criteria remain unimplemented and unverified.

- 2026-09-06: Owner decision: the learning loop is WikiSkill-shaped, per [the direction decision](../design.md#direction-decision-2026-09-06) and [the alignment brief](../research/hoh-direction-brief.md). Acceptance adds four record kinds with distinct write rules (trace write-once, pattern patch-only with a rejection counter and quarantine, proposal as one atomic diff naming its check, impact ledger append-only with the verbatim diff and verdict), working agents receive skills and a short index rather than the pattern corpus, cross-project promotion carries procedures and checks only, a bounded active set with outcome-driven retirement, and revocation of a lesson that fresh evidence contradicts. Unimplemented and unverified.

- 2026-09-13: Scoped basic file continuity separately from optional Brain and autonomous instruction/skill learning. Existing review, privacy, and cross-project promotion requirements remain.

## Desktop delivery scope

The [desktop release queue](../desktop-release.md) assigns bounded work for this
outcome and preserves the broader completion contract. A successful Windows
artifact requires its specified sessions, memory, search, and original-tool
journeys. Earlier source and Linux evidence retain their recorded scope.
