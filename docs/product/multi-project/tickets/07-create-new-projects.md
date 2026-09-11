---
type: outcome
---
# 07: Implement new-project planning and creation
Status: in-progress
Blocked-by: [03, 06]
Unlocks: [09, 13, 19, 24]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-10. Packets 07a through 07f cover preview, authority, receipts,
staged effects, admission and the Native bridge. Protected production custody,
trusted registration and the creation GUI remain open. Complete service/browser
interruption, retry, registration and created-workspace checks are still needed.
Outcome 06 remains unfinished. See the [07f limits](../receipts/07f-creation-duplex-bridge.md).

## Goal

Create blank Vivary projects through the GUI and service contract while keeping VCS, hosting, and templates independent choices.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own new-project service and UI. Reuse `scaffold_thin_workspace`, dry-run output, Doctor, and Tropo checks from `packages/create-vivary`. Read `design.md`, `evidence.md`, and the creation guide. Do not duplicate init rules.

## Done condition

A user previews the exact target and files, applies a bound plan, verifies the workspace, and registers it. A crash or repeated request does not create a duplicate project. VCS and hosting can remain `none`.

## Verify

Run service and browser tests for blank creation, occupied target refusal, changed plan input, interruption, retry, and registration. Run Doctor and Tropo against the result.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packet

[07a](../packets/07a-thin-init-preview.md) is accepted with its
[runtime receipt](../receipts/07a-thin-init-preview.md).
[07b](../packets/07b-creation-parent-authority.md) is accepted with its
[runtime receipt](../receipts/07b-creation-parent-authority.md), establishing explicit
creation authority and live parent custody.
[07c](../packets/07c-creation-receipts.md) is accepted with its
[database receipt](../receipts/07c-creation-receipts.md). Next,
[07d](../packets/07d-staged-creation-effects.md) is accepted with its
[Linux engine receipt](../receipts/07d-staged-creation-effects.md). Next,
[07e](../packets/07e-native-creation-admission.md) and
[07f](../packets/07f-creation-duplex-bridge.md) have accepted scoped evidence:
[Native admission](../receipts/07e-native-creation-admission.md) and the
[bounded Python bridge](../receipts/07f-creation-duplex-bridge.md). Protected host
custody, trusted registration and GUI acceptance remain open. The next creation
integration packet must preserve those limits; current independent work remains
listed in the [program frontier](../index.md).
Outcome 07 remains open.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-07: Completed scoped 07a exact-preview API and recorded runtime evidence.
