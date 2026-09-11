---
type: outcome
---
# 12: Implement none, Git, and Jujutsu identity adapters
Status: in-progress
Blocked-by: [03, 06]
Unlocks: [13, 14, 15, 16, 17, 29]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-10. The accepted packets include bounded root/Git observation,
Native registration and durable mutation admission. Actual Jujutsu support,
Windows identity, automatic reconciliation, production integration and
shared-repository effect enforcement remain open. Outcome 06 is unfinished.
[12h](../receipts/12h-durable-mutation-admission.md) proves admission and claims,
not project/VCS effects or external-process fencing.

## Goal

Report and operate within the selected VCS mode while assigning one mutation owner for no-VCS, Git, Git worktree, monorepo, and colocated Jujutsu cases.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own VCS capability adapters and fixtures. Read `design.md` filesystem rules and Jujutsu evidence. Keep repository host behavior in ticket 13. Unsupported layouts remain read-only or external-tool paths.

## Done condition

Detection distinguishes no VCS, Git repository, linked worktree, shared monorepo, Jujutsu workspace, and colocated Jujutsu. The adapter exposes only proven operations and serializes shared repository mutation.

## Verify

Run fixture tests for every layout, nested project roots, shared common directories, dirty state, detached state, and ambiguous ownership. Verify the no-VCS path never promises branch or merge rollback.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packet

[12b](../packets/12b-physical-root-observer.md) and
[12c](../packets/12c-registry-read-observation.md) completed the bounded Linux
observer and private read-only registry projection.
[12d](../packets/12d-root-identity-lifecycle.md) completed durable application
records with live custody, explicit restart refusal, 24 passing physical tests,
independent review and exact cleanup.

[06d](../packets/06d-native-root-registration.md) now connects that custody to
native policy, HTTP registration and Linux SQLite. Continue through
[06e project selection](../packets/06e-project-selection.md) for the GUI.
[12e](../packets/12e-vcs-identity-lifecycle.md) has [accepted Linux evidence](../receipts/12e-vcs-identity-lifecycle.md) for durable application
repository/checkout references under current descriptor custody, with explicit
inert record migration. Automatic reconciliation, Native VCS integration,
Windows, Jujutsu and cross-process effect enforcement remain separate work.
[12f](../packets/12f-native-vcs-mapping.md) now supplies the independently
accepted Native VCS boundary map. [03d](../packets/03d-vcs-replay-consistency.md)
owns its accepted replay/duplicate consistency prerequisite.
[12g](../packets/12g-native-vcs-registration.md) now has accepted Linux evidence
for live application Git references across the stdio and Native registration
boundary. All five sources match canonical and Habitat. Continue the current
graph frontier. Windows/Jujutsu identity, production integration, reconciliation
and shared-repository mutation enforcement remain open. Outcome 12 remains in progress.

[12h](../packets/12h-durable-mutation-admission.md) has
[accepted durable-admission evidence](../receipts/12h-durable-mutation-admission.md)
for no-VCS and Git through Native policy and the registry store. Its 39 tests,
42 mutation witnesses, independent review and serial canonical/Habitat
application passed. Admission records intent and reservations; it performs no
project or VCS effect. Uncertain-owner recovery and enforceable effect-boundary
fencing remain separate work.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-06: Packet 12a accepted a storage-neutral observation contract and
  expected fixtures after independent review. No adapter implementation or
  physical fixture execution occurred. Required inspection checks passed.
  The receipt retains a separate Windows planning-test newline failure.

- 2026-09-07: Claimed 12b under the approved continuous-execution authority.
  The packet names the Linux identity lifetime, exact files, synthetic fixture
  scope, and read-only checks before implementation. Physical acceptance is open.

- 2026-09-07: 12b bounded Linux observation verified on Habitat tmpfs with all
  23 tests passing after independent review. The receipt records source hashes
  and explicit identity-lifetime, VCS, and production-integration limits.
  Outcome 12 remains open. Continue available dependencies without a session stop.

- 2026-09-07: Claimed 12c for read-only observation composition. The packet
  preserves private lifetime identity and refuses all mutation operations.

- 2026-09-07: 12c accepted private read-only registry observation composition.
  Real Habitat no-VCS and Git captures passed the existing in-memory registry
  oracle. No durable binding or mutation capability was enabled.

- 2026-09-07: 12d accepted application root records and live Linux custody after 24 tests, independent replay/source/archive review, and complete Windows/Habitat cleanup. The 53-entry archive remains verified. Dependent 06d then passed six native policy/HTTP/SQLite/physical-root groups with independent replay and cleanup. These units do not complete outcome 12's VCS and effect-enforcement scope.

- 2026-09-08: Accepted 12e application repository/checkout references and explicit inert migration after 44 tests, complete fixture witness export, independent review and exact cleanup. Outcome 12 remains open for platform, integration, reconciliation and mutation-owner enforcement work.

- 2026-09-08: Accepted 12f source mapping and its verified inspection archive. Three forwarding gaps and a registry consistency prerequisite have explicit owners. Published 03d ready for serial implementation; Native Git forwarding remains unimplemented.

- 2026-09-08: Independently reviewed the proposed 12g successor and retained it privately until 03d passes, as required by the executable-packet validator. Retired the four byte-verified 12f staging copies; its accepted archive remains. No implementation or runtime acceptance added.

- 2026-09-09: Accepted 12g after 56 tests, complete Native/Core witnesses,
  independent archive review and exact cleanup. The five verified source files
  match canonical and Habitat. Outcome 12 remains open for the work named above.

- 2026-09-09: Claimed 12h after all four start dependencies passed. The packet
  names a separate Native mutation role, complete-key durable reservations,
  exact rollback/retry/concurrency evidence and the bounded Habitat proof.
  Source preparation is active; runtime proof and source application are pending.

- 2026-09-09: Accepted 12h durable mutation admission and its seven-file canonical/Habitat application. Shared keys, persistent high-waters, receipt-first retries, transaction rollback and refusal ordering passed their bounded proofs. Outcome 12 remains open for remaining platforms and actual mutation-owner enforcement.
