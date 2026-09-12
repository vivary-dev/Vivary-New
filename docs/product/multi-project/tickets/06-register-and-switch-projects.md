---
type: outcome
---
# 06: Implement project registration and switching
Status: in-progress
Blocked-by: [03, 05]
Unlocks: [07, 08, 11, 12]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-12. **Accepted:** 06a through 06d retain bounded storage,
action, HTTP, and physical-root registration evidence. Native10 accepts the C5
activity transport. Zo build04 contains the exact current product bytes, and
Doctor01 passes. The historical Habitat build and application operation is
superseded.

QA and Verify independently accepted the retained activity evidence without a
rerun. They also accepted the component and deliberate missing-key mutant. All
three focused attempts returned 0, exited naturally, and passed cleanup. The
[06e receipt](../receipts/06e-project-selection.md#focused-zo-tests-accepted-2026-09-11)
owns the exact evidence, resource observations, and limits.

Seven browser attempts remain unaccepted. Browser07 recorded four root checks,
then failed on a fixture metadata assertion. Independent Verify accepted its
archive and confirmed all 24 saved process identities absent after forced cleanup.

**Accepted source:** Independent QA approved the browser-only response-byte
correction. Syntax checks passed, but the correction has not run.

**Remaining:** The original browser allocation has 18.73914124100065 seconds left,
which cannot cover the required boundary scan. A separate allocation proposal
awaits the owner's decision in the [06e packet](../packets/06e-project-selection.md#c5-additional-allocation-proposal-pending-owner-decision).
Workbench browser acceptance, configured production action mounting, and this
outcome's switching and draft-preservation conditions remain open. Full chat
retains its independent accepted 05b evidence.

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
