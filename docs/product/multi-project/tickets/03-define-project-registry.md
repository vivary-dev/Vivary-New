---
type: outcome
---
# 03: Define project registry and authority contracts
Status: done
Blocked-by: [01]
Owner: Astra lead, with independent source review
Evidence: [Contract acceptance](../receipts/03-registry-contract-acceptance.md)
Verification-result: passed
Unlocks: [04, 05, 06, 07, 08, 12, 14, 18]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-10. Parent contract acceptance is complete. The
[acceptance receipt](../receipts/03-registry-contract-acceptance.md) maps each
Done/Verify clause to accepted 03a through 03d and 12h evidence. This closes
executable contract agreement and storage/transaction mapping. Production
integration, project/VCS effects and external-writer fencing remain with their
existing downstream owners.

## Goal

Define portable project identity, machine-local bindings, authority, idempotency, and serialization for a collection of independent project roots.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own the application contract under the proposed Vivary app package and canonical architecture docs named by `design.md`. Read `design.md`, `CONTEXT.md`, `evidence.md`, and the existing thin workspace schema in `packages/create-vivary/create_vivary.py`. Do not use the existing graph `project` type as an app registry.

## Done condition

Contract fixtures cover external roots, no-VCS folders, Git worktrees, monorepos, path moves, missing roots, duplicate registration, shared repository identity, and concurrent mutation ownership.

## Verify

Run contract tests that round-trip portable identity separately from local paths and secrets. Prove duplicate operations converge and shared repository mutations serialize.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packet

[03b](../packets/03b-registry-contract-model.md) completed executable
reference-model verification in the authorized Habitat fallback.
[03c](../packets/03c-registry-transaction-mapping.md) completed the native
transaction and adapter mapping.

[Packet 12a's
receipt](../receipts/12a-root-vcs-observation-contract.md) records the accepted
trusted root/VCS observation inspection. Follow [the generated
frontier](../index.md) under [the loop-first
direction](../design.md#direction-decision-2026-09-06). [03a's
receipt](../receipts/03a-registry-contract.md) records the completed registry
contract inspection. The [parent acceptance](../receipts/03-registry-contract-acceptance.md) now closes
the defined contract scope. Production integration remains separate work.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-05: Packet 03a started contract inspection. Executable contract and serialization proof remain open.

- 2026-09-05: Inspection packet 03a completed the portable registry contract and synthetic acceptance oracle. [03b](../packets/03b-registry-contract-model.md) owns executable state/concurrency tests after the BrowserPod proof. Production transactions and adapter enforcement remain unproved.

- 2026-09-05: Packet 03b completed its sandboxed reference-model checks after independent QA corrections. Outcome 03 remains in progress: transaction mapping and owning production adapters still need evidence.

- 2026-09-05: Packet 03c completed source mapping and independent oracle tracing. Outcome 03 remains in progress: configured database transactions, strict JSON transport, trusted root identity, and enforceable filesystem boundaries still need implementation evidence.

- 2026-09-08: [03d](../packets/03d-vcs-replay-consistency.md) is ready for the two VCS consistency predicates identified by accepted 12f inspection. Existing replay and duplicate owners, output schemas and tests own the change; implementation and Native evidence remain open.

- 2026-09-10: Completed parent acceptance after a clause-by-clause evidence review and independent review of the R11/R12 ownership boundary. The receipt binds accepted 03a through 03d and 12h evidence. No runtime was rerun, no production effect or release is claimed, and other outcomes retain their own acceptance requirements.
