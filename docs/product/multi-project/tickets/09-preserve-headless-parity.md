# 09: Preserve standalone and headless operation parity
Type: outcome
Status: planned
Blocked-by: [04, 07, 08]
Unlocks: [23, 24]

Execution: Read and claim the live [GitHub issue](https://github.com/vivary-dev/Vivary-New/issues). Its dependencies govern starting work. Use [the graph](../graph.md) for supporting references. Parent dependencies still gate outcome completion, not independent preparation.

## Goal

Keep existing Vivary commands and structured project operations usable without the GUI, registry daemon, account, or network.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own headless application entry points, parity fixtures, and command docs. Read the static router in `packages/vivary/vivary_cli.py`, `design.md`, and tickets 04, 07, and 08. Avoid changing existing command meanings to fit the GUI. Follow the
[file memory and setup direction](../design.md#file-memory-and-setup-direction-2026-09-13):
one creator/adopter implementation serves GUI and CLI setup. A setup conductor
is an existing agent role, not another runtime or installer.

## Done condition

Every supported GUI project operation has a deterministic headless contract. Existing `vivary`, `create-vivary`, Tropo, Strato, Ozone, and Exo flows retain characterized behavior.

## Verify

Run existing command characterization suites plus GUI-to-headless parity fixtures from installed artifacts. Prove the GUI process can remain closed.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packets

- [09a: Non-code context and Doctor](../packets/09a-noncode-context-doctor.md): verify narrow S6/S7 requirements and fix only demonstrated mismatches.
- [07b: Shared GUI/CLI creator](../packets/07b-shared-workspace-plan-apply.md): one content plan and apply implementation for both entry points.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-13: Recorded shared setup parity and targeted non-code characterization. The disproved blanket S5 non-Git block and invalid assumption that every graph needs edges are not acceptance requirements.
