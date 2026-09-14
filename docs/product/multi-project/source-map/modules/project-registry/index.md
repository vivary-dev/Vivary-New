---
project: Vivary
status: active
module_area: canonical project registry
contract_refs: [registry-contract, registry-transactions]
source_refs: [registry-model-code]
test_refs: [registry-model-tests]
evidence_refs: [registry-receipt]
module_refs: [root-observation]
---

# Project registry

## Outcome ownership

Outcome [03](../../../tickets/03-define-project-registry.md) owns stable project
identity, registry state, authority, idempotency, and transaction rules.

## Caller-visible contract and errors

Callers reconcile observed checkouts into canonical project and checkout identities.
The transaction map defines allowed state changes, conflicts, and retry behavior so
callers do not infer identity from a mutable path.

## Hidden concerns

The executable model owns transition validation, conflict detection, deterministic
results, and transaction examples. Storage layout and provider selection remain
behind the eventual registry boundary.

## Dependencies

Registry reconciliation consumes [root observations](../root-observation/index.md).
Its two contracts, executable model, focused tests, and accepted transaction receipt
are linked as typed graph edges.

## Gaps

The JavaScript model proves its contract fixtures. Canonical Workbench registry
services and database bindings now exist in `packages/workbench/server/native-registry.mjs`,
`registry-store.mjs` and `project-services.mjs`. See the
[module catalog](../../../specification/modules.md) for current entry points.
The model receipt alone does not prove every production root, VCS or grant case.
