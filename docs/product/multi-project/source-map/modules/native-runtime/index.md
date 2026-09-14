---
project: Vivary
status: active
module_area: native coding-runtime execution
source_refs: [program-execution, native-owners]
module_refs: [project-registry]
---

# Native runtime

## Outcome ownership

Outcome [04](../../../tickets/04-define-runtime-session-contracts.md) owns the app
runtime, session, action, event, tool, and receipt contracts. Outcome
[10](../../../tickets/10-prove-native-runtime.md) owns the native adapter and real
execution proof. Outcome [16](../../../tickets/16-run-verified-workers.md) owns worker
orchestration, verification receipts, and usage accounting. Outcome
[17](../../../tickets/17-deliver-recovery-review-handoffs.md) owns crash recovery and
native session resume. Outcome
[29](../../../tickets/29-deliver-review-integration-handoffs.md) owns review,
integration, and portable handoffs.

## Intended caller-visible contract and errors

When Outcome 04 is implemented, callers will select a registered project and bounded
task packet, then receive observable run state and failures without gaining ambient
authority over repositories, secrets, spending, publication, or cleanup gates.

## Hidden concerns

Runtime choice, sandbox lifecycle, credentials, process supervision, and provider
adapters remain behind this responsibility. The native owner inventory identifies
where each capability belongs.

## Dependencies

Runtime work resolves stable project identity through the
[project registry](../project-registry/index.md) and follows the
[packet execution policy](../../sources/program-execution.md). That policy governs
how work is claimed and verified; it is not the native runtime behavior contract.

## Current integration and remaining gaps

The canonical Workbench now has a working Native Code path in
`packages/workbench/server/local-code-agent.ts` and the Code execution host/worker.
It reuses Native Code run/transcript records. The private Claude file-tool and
follow-up evidence is routed from the [Native owner inventory](../../../native-owners.md).
Generic harness discovery, native resume, linked conversations and the complete
runtime contract remain unaccepted. Existing follow-ups use bounded text replay.

The [adapter specification](../../../specification/harness-adapters.md) identifies
the current owners and intended generic Native seam. These implementation paths
do not establish every outcome 04/10 requirement or Windows acceptance.
