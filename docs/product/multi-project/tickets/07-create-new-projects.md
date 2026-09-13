# 07: Implement new-project planning and creation
Type: outcome
Status: planned
Blocked-by: [03, 06]
Unlocks: [09, 13, 19, 24]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Goal

Create blank or built-in Vivary workspaces through the GUI and service contract. Keep workspace structure, agent guidance, runtime, VCS, and hosting as independent choices.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own new-project service and UI. Reuse `scaffold_thin_workspace`, dry-run output, Doctor, and Tropo checks from `packages/create-vivary`. Read `design.md`, `evidence.md`, and the creation guide. Do not duplicate init rules. Follow the [workspace setup direction](../design.md#workspace-setup-direction-2026-09-13) when extending the built-in guidance. The four existing preset names remain a compatibility input, not mandatory GUI categories.

## Done condition

A user previews the exact target and files, applies a bound plan, verifies the workspace, and registers it. A crash or repeated request does not create a duplicate project. VCS and hosting can remain `none`. Selected built-in guidance and starter files appear in the plan and remain editable afterward. A folder registration or the five-file base alone does not establish completion of the useful-workspace setup requirement.

## Verify

Run service and browser tests for blank creation, occupied target refusal, changed plan input, interruption, retry, and registration. Run Doctor and Tropo against the result.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-13: Jeff clarified useful workspace setup and questioned fixed language or stack packs. Recorded composable structure and agent guidance as the proposed implementation direction. The GUI creation flow remains unimplemented.
