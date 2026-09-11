# 07b receipt: Creation grant and parent custody

Evidence-record: 07b

Status: Complete for read-only creation authority; filesystem apply remains open.

## Accepted behavior

The trusted host supplies immutable parent configuration and a current resolver.
Creating a child requires an explicit parent grant and create-child capability;
registration or read membership does not substitute. Opaque process-local leases
bind the exact actor, collection, device, policy, operation, basename and accepted
plan digest. Repeated requests preserve those inputs and recheck authority.

Linux inspection opens every parent component without following links and checks
the held object against the current path before and after policy resolution.
Revocation, replacement, foreign leases and changed bindings refuse and retire
custody. Capacity settings bound resource use and are configurable.

Callers must use close() or the context manager. Process exit releases operating
system descriptors. A forked child rejects inherited ownership before acquiring
an inherited lock and releases its descriptor copies. Garbage-collection cleanup
is unsupported. A lease is not a filesystem write token, pathname reservation or
durable identity after restart.

## Verification and cleanup

The lead reproduced a forked-child hang against the original implementation:
the focused regression failed when its three-second alarm terminated the child.
After the process-owner fix, all 22 checks passed with no skips in 0.192 seconds
on existing Habitat Python. Peak resident use was 32,800 KiB at nice priority 10,
with a 768 MiB address-space limit. Tests exercised live Linux replacement,
symlinks, descriptor retirement and inherited process locks using owned fixtures.

Independent Astra review accepted the source and compared both source hashes
with the actual passing evidence. The lead read back the final ZIP and verified
unique membership, every payload and archive integrity. Archive SHA-256:
`cf4d668a9c56448d3d47cbbfa02a18993fca91050979e4463f030283721c8f8c` (25,652 bytes, 15 payloads).

Both bounded drivers completed with exit 0 after exporting full logs and removing
their exact eight staging files and empty directories. Test fixtures cleaned
themselves; no test process, container, server or model worker remains from this
unit. Final source remains in the existing Habitat checkout and the private
evidence archive remains for review.

## Remaining outcome work

Protected host namespace authority, exact-preview apply, atomic absent-target
publication, interruption recovery, trusted registration and GUI acceptance remain
required under outcome 07. No real project was created by this authority unit.
