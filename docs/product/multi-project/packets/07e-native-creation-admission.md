---
type: packet
---
# 07e: Compose private Native creation snapshots and effect admission

Parent: 07
Status: done
Depends-on: [07c, 07d]
Owner: Sol creation_apply_writer owns the receipt module and focused tests; GPT-6 lead owns dispatch, review, evidence and graph.
Scope: Internal Native receipt snapshots and ordered one-shot effect admission under an injected host scope. No Python transport or production activation.
Verification-kind: runtime
Verification-result: passed
Evidence: [07e runtime receipt](../receipts/07e-native-creation-admission.md)
Timebox: One receipt facade, adversarial Native database fixtures, independent review and exact cleanup.

## Goal

Compose 07d's trusted receipt port with the existing 07c Native receipt owner.

## Context

Read their packets and receipts, creation_apply.py, creation-receipts.mjs and the
Workbench database/test seams. Existing validated rows already hold the complete
request, actor/collection/device scope, phase, staging and continuity identity.
Reuse that schema and closure. Do not add a database, journal or admission token.

## Owned files

The writer owns packages/workbench/server/creation-receipts.mjs and
packages/workbench/tests/creation-effect-port.test.mjs, plus the smallest fixture
adjustment in tests/creation-receipts.test.mjs. The lead owns this packet, receipt
and source map. Do not change schema, migrations, Core, root-provider transport,
HTTP/actions or GUI. Another writer must not edit these files concurrently.

## Private receipt port

Provide internal load, prepare, transition and admitAndExecute operations matching
the 07d port. The final JavaScript spelling can fit the current module. Derive
exact binding/phase/namespace snapshots from validated stored records. Compare
supplied binding, snapshot and namespace as expected claims against current trusted
resolvers and a fresh row; never use public historical outputs as trusted snapshots.
Failed receipts return a refusal. Preserve public historical read output and
reservation/registration behavior. Return no snapshot through an HTTP/action API.

Only prepare-stage in preparing, publish in publishing, and recover-publication
in publishing may invoke an effect. Invalid pairs, altered requests, mismatched
snapshots or changed namespace/authority refuse before the callback.

## Host ordering contract

Inject a trusted host withCreationScope(scope, callback) and a guard whose
executeOnce(expectedAdmission, execute) admits one exact effect. Use a coarse
collection/device scope derived from trusted facts. The default host refuses.
Require that scope for every receipt mutation, including the existing prepare,
phase transition and fail methods; historical reads remain read-only. Update
existing creation fixtures to supply a labeled synthetic scope. There is no
unguarded mutation mode for a second store instance to bypass the coordinator.

The host must coordinate all owner instances/processes, receipt phase writers,
relevant authority invalidations and namespace custody changes. A store-local
mutex, permission bit or repeated resolveFacts call does not prove this. Production
activation stays unavailable until a real host supplies those guarantees.

Before admission, revocation, disconnect or lost continuity invalidates the guard.
Admission consumes the guard atomically with callback invocation. Keep the scope
held until the asynchronous callback settles. Later revocation may prevent the
next effect but cannot report completion while an admitted worker can still write.
After disconnect, timeout or host loss, worker quiescence or fencing is required
before custody can be released. An abort signal or rejected promise is not proof.

Track the actual one-shot callback and its settlement. Reject duplicate, late,
retained and early-return success paths. Never turn a host success-shaped return
into success when the callback did not execute and settle. Callback uncertainty
leaves the durable phase unchanged and requires recovery; do not call fail or retry.

Load and validate the receipt in a short Native transaction under the host scope,
finish the transaction, then invoke the effect. Phase changes are separate short
transactions under the same scope. No filesystem callback executes inside a database
transaction, and rollback never claims to undo filesystem effects.

## Done condition

Use actual configured Native database adapters in existing Habitat, a synthetic
coordinator with deferred promises and an inspectable event sequence, and bounded
low-memory checks. Reuse the accepted 07c harness and 07d behavior proof.

Prove exact private snapshots through a fresh database connection; altered binding,
phase, stage or continuity refusal; the exact three effect/phase pairs; zero effects
after pre-admission revocation; and blocked phase mutations/custody or revocation
completion from a second owner while a callback remains pending. They proceed only
after settlement. Prove duplicate, late, disconnected and early-return paths cannot
report success. Callback failures preserve preparing/publishing. Prove callbacks
execute outside Native transactions. Existing historical reads, reservations and
adjacent registration checks must remain green with their existing output shapes.

This proves Native persistence and the facade under a synthetic host protocol,
not production custody or cross-process fencing. Export exact source, full logs and
cleanup evidence, independently inspect the final archive, and remove contained
test resources. Run the graph, source navigation and diff checks after recording.

## Verify

After the named Habitat toolchain preflight, run the focused suites with the existing
Node executable and database dependencies. The lead's private runner binds exact
source hashes, runtime/output limits and fixture cleanup before dispatch.

```console
node --test --test-concurrency=1 packages/workbench/tests/creation-effect-port.test.mjs packages/workbench/tests/creation-receipts.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Next boundary

The next packet composes a private duplex Python bridge. Python's synchronous
callback must remain inside its active admission call while Native awaits the
matching response. Connection/effect correlation, nested current-authority reads,
disconnect handling and worker quiescence belong there. Never send a reusable
admission-granted response followed by independently scheduled writes.

## Stop conditions

No user-project writes, production host activation, caller-supplied paths or
authority flags, file bytes over transport, model calls, credential copying,
account changes, publication, push, merge or legacy deletion. Keep the engine's
created-unregistered result; registration retains its separate authority.

## Log

- 2026-09-07: Prepared after independent 07d engine acceptance. Astra reviewed the
  split between Native admission and later transport, including host ordering,
  callback lifetime and the existing phase-writer bypass. All mutations must use
  the default-refusing host scope; synthetic fixtures do not activate production.

- 2026-09-07: Claimed for the named Sol writer. Source implementation only until
  lead review and bounded Habitat dispatch; no worker or production host activation.

- 2026-09-07: Independent source review accepted the private bounded Habitat
  driver for preparation. No 07e runtime has run; dispatch awaits reviewed frozen
  product source, exact test/dependency manifest and current RAM headroom.

- 2026-09-07: Parent and independent Astra source review found that an early
  host return could leave a pending callback able to write after scope release.
  The writer is adding shared scope-liveness checks at effect and transaction
  boundaries, plus deferred-boundary fixtures. No 07e runtime has run.

- 2026-09-07: All 21 Habitat tests passed with zero skips after the liveness
  correction. Independent source/archive review and exact process/staging
  cleanup accepted. The reviewed 07f bridge packet is prepared; production
  host ordering, custody and GUI creation remain open.
