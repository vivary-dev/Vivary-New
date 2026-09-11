---
type: packet
---
# 20g: Reap exited adopted children before process acceptance

Parent: 20
Status: done
Depends-on: [10c, 20c]
Owner: Astra lead owns the bounded supervisor correction and proof. A separate agent reviews source and actual evidence before application.
Scope: Reap already-exited adopted descendants before classifying a completed process group. Preserve rejection and termination of live descendants.
Verification-kind: runtime
Verification-result: passed
Evidence: [20g exited-child reaping receipt](../receipts/20g-exited-child-reaping.md)
Timebox: One reproduced lifecycle defect, narrow correction, adversarial proof and review.

## Goal

A successful command whose child already exited must not fail merely because
the Linux subreaper has not yet collected that child's exit status. A command
that leaves a live child must still fail and clean up within the existing limit.

## Context

06e build trial12 returned zero but failed the supervisor's orphaned-descendant
predicate. The archive identifies one child but does not record its process state.
Source inspection shows the completion path classifies every remaining process
group member before reaping adopted children. The cleanup path already knows how
to reap them. A zombie state means execution ended and only the exit record remains.

The [accepted proof](../receipts/20g-exited-child-reaping.md) reproduces this
ordering defect against unchanged source. The correction accepts the exited
child case and preserves rejection of live descendants. Trial 12's child state
remains unknown. A later build must show whether this correction resolves that
run's failure.

## Owned files

- `tools/hoh_loop.py`, limited to the completed-process classification boundary.
- `tools/tests/test_hoh_loop.py`, one Linux regression beside the existing
  closed-pipe descendant test.
- This packet and its evidence receipt.

Stage source privately until independently accepted. Preserve all existing
deadlines, grace, process identity, output capture, kill behavior, clock policies,
accounting and admission rules. No natural-settlement delay or grace extension
is authorized by this packet. Reap only completed children, then classify any
remaining live members under the existing refusal rule. Do not filter zombies
out of evidence without actually reaping and verifying their absence.

The lead owns shared dependency freezes. 04d, 06e and 20f proofs must remain bound
to their reviewed supervisor bytes. Do not modify canonical or Habitat copies
while another proof uses the prior freeze.

## Done condition

1. Reproduce a zero-exit parent with one already-exited adopted child. The old
   supervisor rejects it and the candidate accepts it after verified reaping.
2. The existing closed-pipe live descendant remains rejected and is killed and
   reaped within its unchanged five-second grace.
3. Timeout and clock refusal regressions pass. Source review confirms that the
   existing late-output deadline check and output handling remain unchanged.
   No separate late-output runtime regression is claimed.
4. Record actual Linux process states, exit codes, observed IDs, group absence,
   source hashes, bounded output and cleanup. Keep any build claim separate.
5. Obtain independent review, reconcile affected freezes, apply accepted bytes,
   and update the canonical graph. Do not close outcome 20 or live v4 acceptance.

## Verify

Use the existing Habitat environment and one private packet snapshot. Before
launch, freeze exact source/dependency hashes, finite test names, temporary paths
and cleanup allowlist. Enforce a 256 MiB Linux cgroup, no swap, one CPU, 64 tasks,
512 MiB Windows Job Object, 1 MiB output and a 90-second outer deadline. Admit
only with at least the declared budget plus 1536 MiB host reserve. Run no model,
network request, container, dependency install or new development checkout.

Run only the five selected tests named in the
[receipt](../receipts/20g-exited-child-reaping.md) under their existing deadline
contracts. The lead ran these private entry points against their respective
frozen source snapshots. Paths are relative to the preserved proof checkout:

```console
python -B .tmp/vivary-continuation/run_20g_process_proof.py red
python -B .tmp/vivary-continuation/run_20g_process_proof.py green
```

The driver owns admission, resource limits, export, and cleanup. The red command
requires the frozen unchanged supervisor. The green command requires the
accepted candidate. Check the resulting canonical packet records with:

```console
python scripts/check_multi_project_plan.py --check
```

The full test module is the canonical test owner. The private proof records its
exact selected names rather than invoking unrelated model or long loop cases.
Export and verify evidence before removing the exact packet-owned snapshot.
Preserve shared caches and unrelated processes. Stop only a refused operation.

## Stop conditions

No live-child acceptance, deadline extension, model invocation, credential change,
paid usage, container start, dependency repair, publication or merge is authorized.
Stop source application while a dependent proof is active. Keep earlier evidence
and frozen sources available until reviewed reconciliation is complete.

## Log

- 2026-09-08: Lead accepted this narrow investigation under continuous execution
  authority after trial12's actual orphan predicate was identified. Reproduction
  precedes correction. Live-child acceptance, runtime defaults and model gates
  stay unchanged.
- 2026-09-08: The unchanged supervisor produced the expected exited-child
  rejection. The accepted LF candidate passed five selected Linux regressions.
  Source review confirmed that the two-line correction preserves live-child
  rejection, deadlines, and output handling. The
  [20g receipt](../receipts/20g-exited-child-reaping.md) binds exact source and
  driver bytes, resource limits, historical trials, and terminal cleanup.
  The lead verified canonical application and Habitat synchronization against
  the accepted LF bytes. The receipt binds both application records. This
  completes 20g without accepting trial 12's build or closing outcome 20.
- 2026-09-08 verification log: The bounded `red` command recorded one expected
  regression failure. The final `green` command ran five tests in 9.949 seconds,
  with zero failures, errors, or skips. The accepted archive and application
  records are bound by the evidence field above.
