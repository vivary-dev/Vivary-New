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

## Accepted readiness and current work

[04a](../../../packets/04a-project-runtime-readiness.md) has accepted
[read-only readiness evidence](../../../receipts/04a-project-runtime-readiness.md).
Package, configuration, authentication and execution observations stay distinct.
[04b](../../../packets/04b-project-native-activity.md) has accepted
[exact-reference activity evidence](../../../receipts/04b-project-native-activity.md).
Native remains the thread, session, run and transcript owner. Its trusted
reference contains schemaVersion=1, referenceRevision, bindingIdentityDigest,
nativeThreadId, nativeSessionId, nativeRunId and harnessName. Mutable Native
scope only supplies a comparison; it does not establish provenance.

The 2026-09-09 [06e C5 amendment](../../../contracts/project-catalog.md#c5-selection-and-native-conversation-scope)
authorizes a bounded shared seam: expose the already verified thread ID and
scope in a ready activity response after all final checks. The stateless Native
renderer uses that identity for selection isolation. The original 04b receipt
does not certify these new bytes. A reviewed candidate may be applied in the
canonical worktree for source freezing. Fresh focused runtime and browser proof
is required before applying it to Habitat and accepting the behavior. Complete
conversation history remains open.

The identity digest is SHA-256 over UTF-8 JSON.stringify of an object constructed
in this exact insertion order: ownerEmail, orgId, actorId, collectionId, deviceId,
projectId, bindingId, bindingRevision, rootId, contentRevision, locationRef,
policyRevision, harnessName, runtimeVersion, executionLocation, authorityContract,
runtimeConfigurationRevision. Preserve that encoding when preparing a reference.
[04c](../../../packets/04c-project-native-preparation.md) has accepted
[private thread-preparation evidence](../../../receipts/04c-project-native-preparation.md)
using the existing receipt namespace. Candidate records cannot become
prepared until both host completion layers are verified. Restart refuses foreign
incarnations. Production host custody and process fencing remain unconfigured;
no harness start is authorized by readiness, activity or preparation alone.

[04d](../../../packets/04d-project-native-start.md) has accepted
[one-shot start evidence](../../../receipts/04d-project-native-start.md).
The private start service consumes an exact preparation and records the returned
Native session/run reference. Uncertain effects quarantine the operation instead
of starting it again. Its synthetic host proof covers 25 preparation/start cases,
including closure during a pending Native start. The four accepted files match
canonical and Habitat. Production host fencing and a real runtime adapter remain
unconfigured. This evidence does not establish live project chat.

## Gaps

Production runtime composition, complete conversation fidelity, a public bounded
Native event read, lifecycle, enforced roles and cross-runtime acceptance remain
open. Readiness and controlled fixture evidence do not establish a real coding
session. Outcome 04's full execution contract is incomplete.
