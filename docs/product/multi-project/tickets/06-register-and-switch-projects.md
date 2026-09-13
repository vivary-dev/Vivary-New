# 06: Implement project registration and switching
Type: outcome
Status: planned
Blocked-by: [03, 05]
Unlocks: [07, 08, 11, 12]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Let the GUI register existing roots read-only, display identity and capabilities, and switch projects without retargeting active sessions or losing drafts.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own project-list and project-detail UI, registry application services, and their tests. Read tickets 03 and 05 plus `design.md` project onboarding rules. Registration alone must not write project files, initialize VCS, or create a remote.

## Done condition

Two independent roots can be registered and reopened. Missing and duplicate roots are clear. Switching preserves drafts and keeps each active session bound to its original project.

## Verify

Run integration tests with two roots, one missing root, duplicate physical paths, and a session active during a switch. Assert zero project-byte changes during registration.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.
