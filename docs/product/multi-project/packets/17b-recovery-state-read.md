---
type: packet
---
# 17b: Read durable mutation recovery state
Parent: 17
Status: in-progress
Depends-on: [17a, 12h]
Owner: Sol owns isolated model, store, action and fixture candidates. Astra owns packet acceptance, serial application, runtime evidence and cleanup acceptance.
Scope: One private read of an existing admission's pending or uncertain state. No repair, release, cancellation, replay, root observation, project/VCS effect, coordinator, public transport or UI.
Verification-kind: runtime
Verification-result: pending
Evidence: Isolated ten-file candidate passed source review and static custody checks. Bounded Habitat proof and serial application remain pending.
Timebox: One read operation through existing owners, focused fixtures, one supervised proof, independent review and exact cleanup.

## Current progress

Updated 2026-09-10.

**Accepted:** The isolated ten-file recovery-read candidate passed independent
source review, seven MJS syntax checks and the custody check. It contains 95 JSON
cases and declares 40 integration witnesses. No application test or integration
witness has run for this candidate.

**Remaining:** Prepare and review the runtime snapshot/controller, run the
recovery checks, then apply the accepted source serially. Shared application
still waits for 06e to release its source ownership.

**Next:** Continue isolated preparation under the existing authority. The earlier
general runtime pause has been lifted. Actual source, resource and application
gates remain. The two-request, 2,400-second runtime budget has used zero requests.

## Goal

After a restart, reconstruct one admission's stored recovery state without
changing it or implying that an interrupted effect can safely be replayed.
The accepted [17a receipt](../receipts/17a-quarantine-mutation.md) owns the
active/pending to uncertain/uncertain transition. This packet only reads it.

## Context

Read registry R9, R11 and R12, the transaction map, outcome 17 and the accepted
12h and 17a receipts. Reuse the existing normalized admission loader and model
identity checks. SQL envelope integrity stays in the store; authorization,
historical identity, lifecycle decisions and projection stay in the model.

## Owned files

Prepare isolated candidates in the preserved checkout's `.tmp/vivary-17b/candidate`:

- `scripts/registry_contract_model.mjs` and `scripts/tests/test_registry_contract_model.mjs`
- `packages/workbench/server/registry-store.mjs`, `registry-actions.mjs` and `native-registry.mjs`
- `packages/workbench/tests/registry-actions.test.mjs` and new `mutation-recovery-read.test.mjs`
- The existing registry contract, transaction map and JSON fixture

Pin the nine existing canonical preimages and the new fixture's absence before
editing. Keep schema, migrations, root provider, dependencies, lockfiles and
all 06e sources read-only. Verify the exact owned inventory before freezing.
Current 06e source ownership permits isolated preparation only. Shared canonical
or Habitat application requires that freeze to close and fresh target readback.

## Done condition

1. Add model operation `read-mutation-recovery`, store method
   `readMutationRecovery`, and private action `vivary-read-mutation-recovery`
   at action entry `mutationRecovery`. Input is exactly `operationId` and
   `expectedPolicyRevision`, using the existing identifier and positive safe
   integer rules. Reject paths, keys, root identity, caller scope and receipts.
2. Reauthorize the current `project-mutator` role and `mutate-project`
   capability before lookup and before projection through existing resolver
   boundaries. Preserve strict parsing and code-only scope/policy refusals.
3. In one transaction, load the scoped `admit-mutation` receipt, normalized
   reservation parent, complete claims, exact fence high-waters and scoped
   registry revision. Reuse 17a's integrity checks through the smallest shared
   internal seam. A read must not invoke the quarantine transition or require
   caller binding, fence, expected registry revision or a current root binding.
4. Return exactly `{code: "mutation-recovery", bindingId, ownerOperationId,
   fence, registryRevision, state}`. Historical identifiers and fences come
   from validated records. State is `pending` only for active/pending and
   `uncertain` only for uncertain/uncertain. The observed revision grants no
   future freshness or replay authority. Project no keys, raw records, root
   facts, caller scope or timestamps.
5. Missing scoped admission returns `admission-unavailable`. Inconsistent
   envelope, historical identity, parent, claims or high-waters returns
   `invalid-input`. Valid unsupported lifecycle pairs return
   `reconciliation-required`; invalid stored state values return `invalid-input`.
   Preserve `retry-state` for changed authorization facts across resolver
   boundaries. Do not relabel database errors or add an automatic retry loop.
6. Emit zero model effects and perform zero SQL writes. A valid read at
   `Number.MAX_SAFE_INTEGER` succeeds without incrementing the revision.
   Root loss, replacement and later binding changes cannot substitute the
   historical identity or cause a root observation.
7. Mark the new action read-only while disabling HTTP, agent tools, MCP,
   extension calls and public discovery. Extend the action metadata fixture's
   existing mutation exception for this read. Preserve registrar and mutator
   authorization, audit privacy and every existing operation's refusal order.

## Verify

Use real no-VCS and Git admissions through 12h, quarantine selected admissions,
restart the process and read both supported states. Use the actual frozen model
evaluator and key derivation. The 06e denied evaluator fixture cannot prove this.
Prove unchanged complete SQL rows, project/Git trees, claims and high-waters;
zero root observations; and continued contender refusal for occupied keys.

Cover maximum-safe revision, stale policy, revoked role, wrong or foreign scope,
reused operation IDs, root loss/replacement, binding drift, missing admissions,
malformed records, incomplete claims, bad high-waters and every supported or
unsupported lifecycle pair. Mixed-condition cases must prove refusal order
without returning foreign data. No read may repair corruption.

Run the pure model and focused recovery-read fixture, plus existing quarantine,
admission, registry action/store and Native registry/VCS compatibility fixtures.
Freeze source-derived phase names, commands, counts and finite witness IDs
before dispatch. Use bounded integrity-protected witness transport and inspect
raw records independently. Summary counts alone cannot prove read-only behavior.

Run these commands only inside the reviewed bounded snapshot:

```console
node --max-old-space-size=192 --test scripts/tests/test_registry_contract_model.mjs
node --max-old-space-size=192 --test packages/workbench/tests/mutation-recovery-read.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/mutation-quarantine.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/mutation-admission.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-actions.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-store.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-vcs-registration.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-registry.test.mjs
```

## Runtime, custody and cleanup

Reuse Habitat and its verified dependencies, with one disposable candidate root
and one heavy job. Preserve 512 MiB Linux, zero swap, 64 tasks, one CPU,
192 MiB Node heaps, a 512 MiB observed Windows owner, 2,560 MiB warm admission,
1,536 MiB reserve and 10 GiB free disk. Each phase allows 180 seconds and one MiB
output. The service/host caps remain 940/980 seconds, including 70 seconds of
cleanup reserve and five-second owned termination grace.

Record exact sources, dependencies, processes, output limits and cleanup paths
before launch. Never label workload as cleanup to bypass a resource observer
failure; preserve the existing containment and cleanup path after that failure.
Review failed evidence and a source correction before any retry. Export and
verify one evidence archive, verify owned processes/services absent, then
retire exact authorized disposable copies. Preserve unrelated activity.

Before serial application, close any shared freeze, verify the exact existing
preimages and new fixture absence in each target, and retain rollback bytes.
Finish with exact canonical/Habitat postimage equality and independent runtime,
application and cleanup review. This packet cannot close outcome 17's broader
restart UI, cancellation, reconciliation, native resume or effect-replay gates.

## Stop conditions

No state repair, release, reconciliation decision, cancellation, replay, project
or VCS effect, runtime activation, public transport, credentials, paid call,
dependency installation, new persistent checkout, publication, push or merge.
Stop shared-source application while 06e owns a source freeze. Do not substitute
summary counts, a denied evaluator stub or repaired evidence for the required proof.

## Log

- 2026-09-09 (2026-09-10 UTC): Prepared after final 17a application acceptance
  under the existing continuous implementation decision. Names and internal
  seams are implementation choices for independent packet review, not new
  user decisions. Shared 06e source ownership remains a write gate.

- 2026-09-09 (2026-09-10 UTC): Sol claimed isolated source preparation after independent packet review. Shared application remains gated by current 06e proof ownership.

## Isolated preparation checkpoint

On 2026-09-10, the owner requested continued reversible preparation and
implementation while preserving the product runtime pause. Sol resumed isolated
17b preparation. Nine canonical preimages and the new fixture's absence were
verified before editing. The ten-file candidate passed independent source review
and static custody checks. It adds a private recovery read and focused fixtures.
All runtime suites remain unrun. Shared source ownership remains unchanged.

The next recovery proof has at most two warm-admission requests and 2,400 seconds
from the first request, whichever limit expires first. Refused and failed
requests count. Script names, agents and sessions do not reset either limit.
No request has run in this continuation. Record the first request time before
dispatch. Review failed evidence and a corrected source before any second request.
Existing per-phase, service, host, output, containment and cleanup caps still apply.
Budget exhaustion stops the approach for review, without an automatic extension.

Source preparation did not itself lift the then-active runtime pause. The later
runtime-resume decision now governs execution. The shared application gate remains. Independent source review, a reviewed proof snapshot, fresh admission,
runtime evidence and serial application remain separate requirements.
