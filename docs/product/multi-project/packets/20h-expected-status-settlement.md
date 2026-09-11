---
type: packet
---
# 20h: Verify natural settlement for handled child statuses
Parent: 20
Status: done
Depends-on: [20f]
Owner: Astra implements and accepts; independent source and runtime reviewer verifies the result.
Scope: Real Windows Job integration of the independently reviewed expected-status correction. No Habitat, containers, model, build or existing-helper mutation.
Verification-kind: runtime
Verification-result: passed
Evidence: [Expected-status settlement receipt](../receipts/20h-expected-status-settlement.md)
Timebox: Original one-request phase exhausted and retained as failed. Jeff authorized up to two corrected attempts on 2026-09-10, with a new 120-second cumulative limit including refusals and all original resource guards.

## Goal

Prove that handled exit statuses 0, 75, 5 and 1 let a short-lived owned descendant
exit naturally while preserving the resource owner's limits and zero-force gate.
The accepted source correction changes two conditions in the existing owner.

## Context

06e's warm preflight refused its build before dispatch. The owner immediately
forced members for nonzero statuses even when the caller set check=False.
The source-only correction passed six inert tests and independent review.
This packet verifies the Windows side of the existing Habitat execution boundary.
It neither starts Habitat nor substitutes for Linux or model integration proof.

## Owned files

The preserved source directory is `.tmp/vivary-continuation/20h-owner-settlement/`.
Its run.py imports the exact reviewed owner candidate and accepted 20f seam,
overriding the owner evidence directory before construction. Source-review.json
binds every executable input. Runtime evidence uses the new, exclusive
`.tmp/hoh-proof/20h-owner-settlement/` directory.

## Done condition

All four real parent/descendant cases return their expected codes and three
nonce-bound lineage events. Each descendant settles without force; the final
Job has zero active helpers, an accepted observer and unchanged memory, affinity,
process and no-breakaway limits. Independent review verifies the source, results
and absence of every recorded process. Evidence preserves any failed request.

## Verify

```console
python .tmp/vivary-continuation/20h-owner-settlement/run.py --review-sha256 REVIEWED_SHA256
```

After independent source acceptance, run the preserved driver with the exact
source-review SHA-256. Admit only with at least 2,048 MiB free physical memory and
commit headroom, plus 1 GiB free disk. The Job cap is 512 MiB, one CPU and 16
processes; reserve is 1,536 MiB, observed every 250 ms with a 1,000 ms gap limit.
Each child operation has a five-second deadline. The owner retains its 70-second
cleanup reserve within the total 120-second request budget.

## Stop conditions

Refuse changed source bindings, existing request evidence, unknown or insufficient
resources, observer failure, excess output, any forced member or unsettled process.
The original 06e build request remains exhausted. This independent owner test
does not reset or replace its marker, source freeze or acceptance requirements.

## Log

- 2026-09-10: Prepared under continuous implementation authority after the owner repeated the instruction to keep building. Source review and real execution remain pending.

## Corrected test phase, 2026-09-10

The first request failed its event-set assertion: only the parent event reached
the output pipe. The Windows owner reported zero forced members, zero remaining
helpers and an accepted observer. Independent review confirmed supervisor, parent
and leaf PIDs absent. This is partial evidence, not acceptance of the four cases.

The corrected child explicitly passes stdout and stderr to its subprocess. The
driver retains the original source and runtime evidence and uses a separate
phase ledger with an absolute 120-second expiry and at most two request folders.
It preserves the 70-second cleanup reserve and all admission and resource checks.

Authority: Jeff answered **Allow two corrected attempts** on 2026-09-10 to the
specific request for a new 120-second cumulative limit, the same 512 MiB cap,
reserve and cleanup checks. Independent source acceptance remains required
before dispatch. This does not reopen the original 06e build budget.

## Accepted result, 2026-09-10

Corrected attempt 1 passed all four statuses with 12 nonce-bound parent/child
events, empty stderr, zero forced members and zero remaining helpers. Independent
QA verified all recorded PIDs absent, the 512 MiB Job cap, observer maximum gap
273 ms, no breakaway and the exact source/budget bindings. No second corrected
attempt was needed. No WSL, container or model operation ran.

The Windows settlement integration is accepted. The 06e build still requires
reviewed driver integration and a separately authorized new build budget.
