---
type: outcome
---
# 06: Implement project registration and switching
Status: in-progress
Blocked-by: [03, 05]
Unlocks: [07, 08, 11, 12]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-12. Bounded registration, authorization, transport, root custody,
build, doctor, and focused activity evidence remain accepted in their receipts.
Browser08 recorded twelve Workbench checks but failed the separate chat check
and did not complete final verification. See the [06e receipt](../receipts/06e-project-selection.md).

The [engineering policy](../../../../ENGINEERING.md) now governs the work.
The next product step is normal Workbench startup using the existing project
services, followed by a small real-app project-switching check. Configured
startup, retained state and drafts, and persistence remain unfinished.
The custom C5 fixture is not a prerequisite to this implementation.

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
after changing this outcome's metadata. These checks validate planning documents.
They do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-07: [06a native registry storage](../packets/06a-native-registry-storage.md) implements private registration and portable export through existing native database transactions. All 14 Windows tests passed, including rollback, restart, replay, and process contention. Two independent reviews, evidence verification, and bounded cleanup passed. GUI registration, policy and durable identity composition, project switching, and Linux storage verification remain open.

- 2026-09-07: [06b internal native actions](../packets/06b-native-registry-actions.md) composes strict parsed-request entry validation, native authorization/output/audit, and the accepted registry store. All 12 Windows native tests passed. Independent source/archive review and bounded cleanup passed. The definitions remain undiscoverable pending production composition and raw transport.

- 2026-09-07: [06c native registration HTTP](../packets/06c-native-registry-http.md) composes a strict raw request guard with native action mounting. All 10 Windows loopback HTTP-to-SQLite tests and lead source review passed. Independent source/archive review and bounded cleanup passed. Trusted policy/root and configured application/GUI composition remain open.

- 2026-09-07: [06d live root registration](../packets/06d-native-root-registration.md) composes native session identity and current org/app capability with Linux root custody and SQLite. Six physical/native integration groups passed, including two-root registration, revocation, replacement, restart refusal, and source preservation. Independent source review, six-group replay, 63-entry archive verification and exact cleanup passed. Native doctor passed all ten guards. Configured GUI registration and switching remain open.
