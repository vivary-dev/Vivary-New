---
type: packet
---
# 20j: Compose shipped creation and planner context

Parent: 20
Status: needs-info
Depends-on: [07f, 20c]
Owner: GPT-6 lead, sole writer. Other agents inspect and review only.
Needs: Diagnose and resolve the repeated Habitat clock rollback, then obtain authority for another runtime attempt. The original six batches and the one approved rerun are consumed.
Scope: Inspect the integration seams, compose create-vivary in the trusted workbench provider, and retrieve a governed Tropo capsule before each planner stage.
Verification-kind: runtime
Verification-result: failed
Evidence: [20j receipt](../receipts/20j-shipped-creation-and-context.md)
Timebox: Six original runtime batches plus one owner-approved loop recheck, within 1800 cumulative runtime seconds. Original batches are capped at 300 seconds. The loop recheck is capped at 180 seconds. Each keeps five seconds for cleanup.

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

## Goal

Use the shipped deterministic workspace and retrieval logic in both callers.

## Context

Read `docs/COMMANDS.md`, the create-vivary and Tropo READMEs, and the source
implementations before binding an envelope. Core owns custody and receipt
validation. Workbench supplies the shipped operations through its trusted provider.

## Owned files

`packages/workbench/server/creation_workspace.py`, affected creation tests,
`tools/hoh_loop.py`, the planner prompt, loop tests, and this packet's program docs.

## Done condition

Every acceptance item above has an exact command and observed result in the receipt.

## Verify

```console
python docs/product/multi-project/fixtures/20j/run_habitat.py red
python docs/product/multi-project/fixtures/20j/run_habitat.py green
python docs/product/multi-project/fixtures/20j/run_habitat.py suites
python scripts/check_multi_project_plan.py --render
python scripts/check_multi_project_plan.py --check
python scripts/check_line_endings.py
git diff --check
```

Runtime source is the read-only mount of this Windows worktree in Habitat.
The existing Habitat checkout and installed dependencies stay intact. The private
`.tmp/20j/habitat.json` records verified checkout, Node, and disposable scratch
paths. Windows evidence belongs to `.tmp/20j`. The runner binds each phase to its
named command list.

## Stop conditions

Stop the owned job on resource, observer, deadline, or containment failure.
Preserve failed results and diagnose them before retry. No native model call.

## Log

2026-09-11 UTC: Claimed under the owner's 2026-09-10 local-date instruction.

2026-09-11 UTC: The owner answered "Approve one bounded rerun" after six batches
consumed 290.581 seconds. This authorizes only `loop-recheck`, after a stable-clock
check, with the same memory, reserve, output, isolation, and cumulative time limits.

## Current progress

Both integration regressions passed in the first post-change batch, along with
45 Core creation and 55 workbench creation checks. The broader loop suite failed.
The approved rerun confirmed clock rollback in every interrupted retrieval.
It also exposed an iteration-order bug in the new assertion, now corrected.
Read-only review found 35 matching capsule/receipt pairs in retained evidence.
That review does not replace a runtime run of the corrected test.

Source is saved in local commits `86ce5dd`, `9135ce1`, `faf1d40`, and `09f0f0d`.
No push, PR, merge, publish, dependency install, or native model call occurred.
20k is prepared but cannot start until this packet's runtime acceptance is resolved.
The next safe action is read-only diagnosis of the clock observations preserved
in the 20j archive. Do not retry the exhausted proof or weaken clock checks.
