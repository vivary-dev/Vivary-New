---
type: packet
---
# 20e: Resolve the native usage-policy mismatch

Parent: 20
Status: done
Depends-on: [10c, 20c]
Owner: Codex 20e lead, sole writer. Independent reviewer: usage_review.
Scope: Prepare one verified execution-policy recommendation for 20a using existing native-runtime evidence. No live model call or change to active admission controls.
Verification-kind: inspection
Evidence: [Usage-policy receipt](../receipts/20e-native-usage-policy.md)
Verification-result: passed
Timebox: One bounded session through analysis, verification, review, fixes, and cleanup.

## Goal

Give the owner a concrete decision that can unblock the first live Claude proof.
Native compaction and response defaults are accepted. The remaining mismatch is
20a's requirement for a hard cumulative input-plus-output bound before a native
CLI invocation. A context threshold or response cap does not establish that bound.

## Context

Read [20a's usage contract](20a-headless-loop-proof.md#usage-contract), the
[accepted native-default decision](../design.md#context-and-response-decision-2026-09-07),
the [research](../research/context-compaction.md), [native owners](../native-owners.md),
and the [20c receipt](../receipts/20c-headless-loop-preparation.md).
Inspect `tools/hoh/claude.py` and the existing usage-ledger contract and tests.
Use the preserved installed-runtime evidence before querying version-matched
official documentation for a specific missing fact. Do not repeat broad research
or repeatedly probe for the already-unverified whole-invocation bound.

## Owned files

- `receipts/20e-native-usage-policy.md` owns the evidence and one recommended policy.
- This packet, the parent log, and generated graph own status and continuation.
- The existing private handoff owns the next starting prompt.

## Done condition

Produce a short control table separating what the runtime enforces from what
the coordinator observes: context, output, native turns or calls, elapsed time,
cumulative usage, cancellation, retries, and auxiliary requests. Record unknowns.
Account for subscription operation without adding an API key or another model loop.

Recommend one practical alternative to the unsupported pre-call token guarantee,
or identify a newly verified supported mechanism with exact version evidence.
State the intended limits, residual overrun exposure, interruption behavior,
incomplete-usage handling, and exact proposed replacement for 20a's usage contract.
Never describe observed usage plus cancellation as a hard total-token ceiling.

Walk the proposed rules through healthy completion, native retries, missing
usage, delayed cancellation, interrupted work, and resume. Use existing fixtures
where applicable; label paper examples and deterministic evidence accurately.
Have one independent reviewer challenge the controls, accounting, and authority.
Fix findings. The owner should receive one reviewable recommendation, not a menu
of unresolved implementation choices or another generic permission question.

## Verify

Run the [common planning checks](../execution-contract.md#maintaining-the-graph)
and source-navigation check. Record sources, reviewed scenarios, findings, and
limits in the receipt. Evidence-record must be `20e` when the packet closes.
This inspection packet can finish when the recommendation is ready. Acceptance
of a replacement policy and live execution remain separate operations owned by
20a. Keep 20a `needs-info` until its literal prerequisite is satisfied or the
owner approves the exact replacement. Then update 20a before launching anything.


```console
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
```

## Stop conditions

Do not weaken active admission controls, change native compaction or response
defaults, call a model, transfer credentials, spend money, publish, or merge.
No custom compactor, provider proxy, scheduler, or new transcript store.
Use one scratch directory; remove exact task-owned disposable helpers after
verification and retain only the final receipt and necessary source evidence.

## Log

- 2026-09-07: Prepared at the owner's request for the next development session.

- 2026-09-07: Codex claimed 20e as sole writer and completed the inspection with
  independent reviewer `usage_review`. The receipt proposes `20a-observed-usage-v1`.
  Fifteen selected existing Habitat tests passed with no skips. Independent
  review corrections, source navigation, planning checks, document/plan render
  checks, writing lint, and task cleanup passed. The exact recommendation awaits
  the owner's decision. 20a and its executable hard-admission rule remain
  unchanged and blocked. No next packet, live model call, spend, push, publication,
  or merge occurred.
