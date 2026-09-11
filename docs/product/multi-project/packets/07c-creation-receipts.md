---
type: packet
---
# 07c: Persist creation intent in the existing receipt owner

Parent: 07
Status: done
Depends-on: [06d, 07a, 07b]
Owner: Sol creation-receipt writer; GPT-6 lead owns review, runtime dispatch and graph.
Scope: Durable bound creation intent, target reservation, phase transitions and replay using the existing Workbench database owner. No filesystem creation.
Verification-kind: runtime
Verification-result: passed
Evidence: [07c runtime receipt](../receipts/07c-creation-receipts.md)
Timebox: One scoped persistence unit, existing-database checks, independent review and cleanup.

## Goal

Reuse Workbench's vivary_registry_receipts and its database configuration.

## Context

Read outcome 07, the 07a and 07b receipts, registry-store.mjs, db/schema.mjs,
db/migrations.mjs and existing store tests. The registration receipt is currently
written only after registration; it cannot record intent before a creation effect.
Do not add a second database, queue, member roster or JSON inventory journal.

## Owned files

The writer owns server/creation-receipts.mjs, its focused tests, and the smallest
additive changes to server/db/schema.mjs and migrations.mjs needed for exclusive
namespace/child reservations. Paths are relative to packages/workbench.
Existing registration semantics and 06e UI/provider files remain with their owners.
The lead owns this packet, its receipt, outcome metadata and generated views.

## Contract

Trusted host facts bind actor, collection, device, current policy and explicit
create-child grant. The caller supplies operation identity and accepted plan binding;
it cannot assert namespace continuity or grant itself authority. A trusted namespace
resolver supplies parent reference, exclusive-control continuity and stage identity.
Production namespace activation remains unavailable until its host evidence exists.

Persist one immutable request before filesystem work can be admitted. Reserve one
namespace/child across competing operations and processes in the existing database.
Use compare-and-set transitions preparing, prepared, publishing, published with
current authority checks for new effects. A changed operation request refuses.
Terminal failures retain identity; published replay returns historical result and
never authorizes recreation. A receipt alone proves no current root or filesystem
identity. Unknown/invalid/lost continuity returns recovery-required.

## Done condition

Tests use the actual configured database adapter with synthetic trusted grants.
Prove restart readback, competing reservations, changed inputs, illegal/stale phase
transitions, revoked authority, lost continuity, transaction rollback and unchanged
registration behavior. Returned values stay bounded and contain no file bytes,
private physical paths or credentials. The store has no filesystem effect API.

## Verify

The lead runs one small Habitat check at a time under D33 resource bounds. No new
container, dependency or server without a reviewed need and memory preflight.
Export complete results and source hashes, obtain independent review, clean exact
fixtures/staging, and run the common graph/source checks. Record the next apply
packet before closing this unit; outcome 07 remains open.

The focused test path is owned by this packet and must exist before execution.

```console
node --test packages/workbench/tests/creation-receipts.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Stop conditions

No real project writes, host activation, account changes, model calls, publication,
push, merge, inventory admission or legacy deletion. Filesystem publication needs
a separate trusted namespace boundary and atomic no-replace proof. Do not infer
ownership from matching hashes, inodes or marker files after interruption.

## Log

- 2026-09-07: Claimed persistence prerequisite following accepted 07b and independent
  transactional-creation design. Implementation and runtime acceptance are pending.

- 2026-09-07: Accepted after 13 passing tests on Windows and Habitat, independent
  source/evidence review, verified archive and exact temporary-stage cleanup.
