# Expected-status settlement receipt

Evidence-record: 20h
Status: accepted

## Original request: failed

The 2026-09-10 request admitted at 4,505,694,208 bytes available physical memory
and failed the first event-set assertion. Only the parent event was captured.
The owner reported zero forced members, zero active helpers, 512 MiB Job cap,
no breakaway and maximum observer gap 255 ms. Independent readback found the
recorded supervisor, parent and child processes absent. Statuses 75, 5 and 1
were not exercised; the packet is not accepted.

Evidence: preserved `.tmp/hoh-proof/20h-owner-settlement/attempt.json`,
`windows-owner.json` and `expected-0.stdout.log`. Original bound source is retained
in `.tmp/vivary-continuation/20h-owner-settlement/original-source/`.

## Corrected phase: accepted

Jeff answered **Allow two corrected attempts** on 2026-09-10: a new 120-second
cumulative limit, at most two requests, and unchanged resource/cleanup guards.
The child now explicitly passes its output handles. Independent source review and runtime QA passed. Corrected evidence lives in the
`.tmp/hoh-proof/20h-owner-settlement-corrected/` phase directory.

Corrected attempt 1 at 20:36 UTC passed expected statuses 0, 75, 5 and 1 with
12 complete lineage events and no stderr. It admitted at 4,674,961,408 bytes
available physical memory. The owner settled with zero forced members and zero
active helpers; the Job cap remained 536,870,912 bytes with no breakaway.
The observer maximum gap was 273 ms. Independent QA verified all eight workload
PIDs and the supervisor absent, exact source hashes and the shared 120-second
dual-clock deadline. The second corrected attempt was unused and is not needed.

Source and QA receipts: preserved
`.tmp/vivary-continuation/20h-owner-settlement/source-review.json` and
`qa-review.json`. Runtime files: `attempt-1/attempt.json`,
`attempt-1/windows-owner.json` and `budget.json` under the corrected phase root.
Original failed evidence remains failed. No WSL, container or model call ran.
This accepts Windows settlement only; it does not accept the 06e build or 20a loop.
