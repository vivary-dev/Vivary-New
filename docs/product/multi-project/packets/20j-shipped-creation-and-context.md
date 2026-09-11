---
type: packet
---
# 20j: Compose shipped creation and planner context

Parent: 20
Status: in-progress
Depends-on: [07f, 20c]
Owner: GPT-6 lead, sole writer. Other agents inspect and review only.
Scope: Inspect the integration seams, compose create-vivary in the trusted workbench provider, and retrieve a governed Tropo capsule before each planner stage.
Verification-kind: runtime
Verification-result: pending
Evidence: [20j receipt](../receipts/20j-shipped-creation-and-context.md)
Timebox: One packet. At most six runtime batches and 1800 cumulative runtime seconds. Each batch is capped at 300 seconds, with five seconds for cleanup.

## Authority and limits

The owner's 2026-09-10 instruction authorizes deterministic creation and retrieval,
local atomic commits, and removal of duplicated composition after replacement
tests pass. No model invocation, install, public action, or littleagent change.
Keep existing dirty work. Commit each coherent verified slice with its tests and
owning documentation. Stage exact paths or reviewed hunks.

Use the existing Habitat checkout after verifying its path and toolchain. Transfer
only reviewed packet files and verify their hashes. Preserve frozen proof inputs.
One heavy job, 512 MiB Linux memory, zero swap, 64 tasks, one CPU, 512 MiB Windows
allowance, and a 1536 MiB host reserve. Admit at 2560 MiB warm available RAM,
2 GiB commit headroom, and 10 GiB free disk. Record included usage before each
batch and stop new work at 95 percent. Observe host headroom every 250 ms and
stop on observer failure or a one-second gap. Record exact task processes and
scratch paths before launch. Retain failed evidence. Remove only this packet's
disposable workspaces after results are archived and processes are absent.

## Acceptance

- Map creation, adoption, doctor, retrieval, decisions, verification, control,
  receipts, and visible state to the shipped owners and documented envelopes.
- Demonstrate failing-before and passing-after tests for both changed seams.
- Create a real disposable workspace through the trusted workbench composition.
  Compare its five files byte for byte with shipped init, and run shipped doctor
  and Tropo check. Retrieve the planner capsule from that workspace.
- Run workbench and loop suites in Habitat. Record fixtures separately from the
  disposable workspace result. Run the common planning and whitespace checks.
- Obtain independent review, reconcile documentation, and prepare 20k for the
  shipped decision gate. Later seams remain separate packets.

## Current progress

Claimed against local HEAD 84596ca4fabeeaa4ea5551e784da69eb1f05d992 on
`docs/context-compaction-policy`. Index was empty. Initial resource inspection
passed after sandboxed CIM and WSL inventory reads were denied. See the receipt.
