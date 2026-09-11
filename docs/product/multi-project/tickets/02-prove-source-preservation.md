---
type: outcome
---
# 02: Prove source integration can preserve history and dirty work
Status: in-progress
Blocked-by: [01]
Unlocks: [04, 05]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-10. Packets 02a through 02c are accepted for their bounded
preservation scopes. The native-host restoration covers eight selected files.
Full parent acceptance still needs the remaining selected source classes,
history/attribution, resources, hosted records and rights reconciliation.
See the [02c limits](../receipts/02c-source-preservation.md).

## Goal

Prove an import method that preserves selected Littleagent source, provenance, and recoverability without modifying either source checkout.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own an isolated proof fixture under `sandboxes/multi-project/source-integration/` and `docs/product/multi-project/receipts/02-source-preservation.md`. Read `migration.md` and ticket 01. Reuse source slices. Do not flatten Core or nest Littleagent `.git` metadata.

## Done condition

The receipt records selected paths, hashes, commit ancestry or attribution, dirty-file capture, restore steps, license findings, and a successful restoration in a disposable target.

## Verify

Run the bounded preservation and restore script against copies or fixtures. Compare the restored manifest and hashes with the recorded source manifest. Leave both source repositories unchanged.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Next packet

[02a](../packets/02a-source-preservation-fixture.md) completed the contract and
oracle. [02b](../packets/02b-restore-fixture-harness.md) completed synthetic
filesystem restoration in Habitat.

[02c](../packets/02c-source-preservation.md) owns private capture and restoration
of eight selected Littleagent native-host files. Its
[receipt](../receipts/02c-source-preservation.md) separates selected byte proof
from source publication rights, application import, and complete preservation.

[Packet 12a's
receipt](../receipts/12a-root-vcs-observation-contract.md) records the accepted
trusted root/VCS observation inspection. Follow [the generated
frontier](../index.md) under [the loop-first
direction](../design.md#direction-decision-2026-09-06). Preservation of other
selected source, attribution, history, resources, and hosted records remains open.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-05: Synthetic restoration is verified by 02b. This does not prove preservation of real source, ignored resources, Git history, hosted records, or runtime state.

- 2026-09-07: Packet 02c preserved eight untracked native-host source and configuration
  files privately. Windows and Habitat restoration, archive replay, and independent
  review passed. This does not establish publication rights, import an app, or
  preserve other source classes. Outcome 02 stays in progress.
