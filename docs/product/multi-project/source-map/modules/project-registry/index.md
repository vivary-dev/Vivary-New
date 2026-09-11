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
results, and transaction examples. The private Workbench store composes the decision engine with native database transactions.

## Dependencies

Registry reconciliation consumes [root observations](../root-observation/index.md).
Its two contracts, executable model, focused tests, and accepted transaction receipt
are linked as typed graph edges.

## Gaps

The JavaScript model proves the contract. [06a](../../../packets/06a-native-registry-storage.md) adds private Windows SQLite registration storage and portable export. Its [receipt](../../../receipts/06a-native-registry-storage.md) records transaction, rollback, restart, replay, and concurrency evidence. The later composition packets below own public transport, trusted root identity and Linux verification; GUI switching and production deployment remain open.

[06b internal native actions](../../../packets/06b-native-registry-actions.md) composes the store with strict input, native authorization/output validation, and native audit. Its [receipt](../../../receipts/06b-native-registry-actions.md) records the Windows action-to-storage proof. These definitions remain outside automatic discovery and expose no HTTP or tool surface.

[06c opt-in HTTP mounting](../../../packets/06c-native-registry-http.md) validates raw registration requests before native parsing and dispatch. Its [receipt](../../../receipts/06c-native-registry-http.md) records ten real Windows HTTP-to-SQLite cases. This explicit mount exposes only registration POST; the base action definitions and export remain undiscoverable. Configured authentication, trusted root identity, and GUI composition remain open.

[06d live root registration](../../../packets/06d-native-root-registration.md) composes native request authentication and current app capability with durable application root records and live Linux custody. Its [receipt](../../../receipts/06d-native-root-registration.md) records six passing native HTTP/SQLite and physical-root groups. Production configuration, durable Git administration identity, restart reconciliation, and GUI catalog/switching remain open.

[07c creation intent](../../../packets/07c-creation-receipts.md) reuses the receipt owner for creation reservations and phase transitions. Its [receipt](../../../receipts/07c-creation-receipts.md) records Windows and Habitat database evidence. Historical read/replay is not filesystem authority; [07d](../../../packets/07d-staged-creation-effects.md) owns the next effect engine and the later native admission seam remains explicit.

[12f inspection](../../../packets/12f-native-vcs-mapping.md) maps the three
Native Git forwarding gaps without enabling them. Its
[receipt](../../../receipts/12f-native-vcs-mapping.md) distinguishes accepted
lifecycle evidence from unimplemented forwarding.
[03d](../../../packets/03d-vcs-replay-consistency.md) owns complete VCS equality
for completed replay and duplicate registration before that forwarding proceeds.
