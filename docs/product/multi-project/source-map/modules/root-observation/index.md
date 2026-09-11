---
project: Vivary
status: active
module_area: bounded checkout observation
contract_refs: [root-observation-contract]
source_refs: [checkout-observer-code]
test_refs: [checkout-observer-tests]
evidence_refs: [observation-receipt]
---

# Root observation

## Outcome ownership

Outcome [12](../../../tickets/12-implement-vcs-identity-adapters.md) owns VCS
observation and mutation-owner adapters. Packet 12a established this bounded
observer contract and its continuation guidance.
Packet [12b](../../../packets/12b-physical-root-observer.md) implements the
bounded Linux observer and owns its physical acceptance.

## Caller-visible contract and errors

Given an explicit allowlist of roots, observation returns normalized checkout facts
and preserves per-root failures as observations. A caller can distinguish an absent,
inaccessible, invalid, or non-repository root without losing successful siblings.

## Hidden concerns

Core owns bounded path normalization, Git topology probing, stable ordering, and
error capture. Existing graph identities retain their graph semantics. The
[physical observer](../../../../../../packages/core/vivary_core/physical_observe.py)
adds descriptor-held Linux identity within one observer lifetime. Its
[focused tests](../../../../../../packages/core/tests/test_physical_observe.py)
exercise physical capture and explicit refusal. These identities establish no
durable registry binding or mutation reservation.

The private [registry read adapter](../../../../../../packages/core/vivary_core/registry_observe.py)
composes those captures with a trusted policy/locator resolver. Its
[focused tests](../../../../../../packages/core/tests/test_registry_observe.py)
exercise read-only projection into the existing registry oracle.
[Packet 12c](../../../packets/12c-registry-read-observation.md) owns that bounded
composition and its evidence.

## Dependencies

This module supplies observed identities to the [project registry](../project-registry/index.md).
Its contract, Core implementation, focused tests, and accepted receipt are linked as
typed graph edges.

## Gaps

The private Linux observer implements a bounded part of the trusted capture
contract. [12b's receipt](../../../receipts/12b-physical-root-observer.md) owns
verification and limits. Restart continuity, Windows identity, Jujutsu, complete
registry authorization, and cross-process effect enforcement remain open.
No physical capture grants mutation authority.

[Packet 12d](../../../packets/12d-root-identity-lifecycle.md) adds private application root records whose verification requires live descriptor custody. Its [lifecycle owner](../../../../../../packages/core/vivary_core/root_identity_lifecycle.py), [tests](../../../../../../packages/core/tests/test_root_identity_lifecycle.py), and [receipt](../../../receipts/12d-root-identity-lifecycle.md) cover restart refusal, replacement, copied state, and metadata failure. Durable records do not establish automatic physical identity continuity; unresolved records require explicit reconciliation.

[06d](../../../packets/06d-native-root-registration.md) accepted the bounded Linux custody-to-native-registry composition with two-root HTTP/SQLite proof. [06e](../../../packets/06e-project-selection.md) continues GUI selection. The 12d packet, receipt and private cleanup sidecars all record complete cleanup.

## Current VCS-reference extension

[12e](../../../packets/12e-vcs-identity-lifecycle.md) versions the existing
lifecycle records to retain application repository/checkout references while
requiring current descriptor custody. Migration preserves historical IDs without
restoring verification. This packet adds no Native integration, mutation lock,
restart reconciliation or new record owner.

Its [accepted 12e receipt](../../../receipts/12e-vcs-identity-lifecycle.md) records 44 Linux tests, full byte/serialized-state witnesses, the foreign-lifetime branch, independent review and exact cleanup. Application references remain inert without live custody.
