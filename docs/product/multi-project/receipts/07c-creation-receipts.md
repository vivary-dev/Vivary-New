# 07c receipt: Durable creation intent

Evidence-record: 07c

Status: Complete for database persistence; filesystem effects remain open.

## Accepted behavior

The existing Workbench receipt table now persists immutable creation requests,
reserves each collection/device/namespace/child across processes, and performs
exact phase compare-and-set transitions. Sibling targets remain available.
Current membership, actor scope, explicit creation grants and namespace continuity
are checked around new mutations; changed or revoked facts roll transactions back.
Historical replay needs current read authority and never grants a new effect.

Requests cannot supply authority or namespace facts. Strict string boundaries
reject trailing newlines and trailing dots before storage. Published replay does
not require a creation grant, recreate a target or claim current registration.
Existing registration behavior is preserved. No second database was added.

## Runtime evidence and cleanup

All 13 focused tests passed with zero skips on Windows Node 24.19 and on existing
Habitat Node 22.23.2, using actual Core 0.176.5 database adapters. The Habitat probe
opened SQLite 3.53.2 through better-sqlite3 12.11.1 before any source update.
Its suite completed in 35.04 seconds at nice priority 10, with reported maximum
child-process RSS of 260,224 KiB. Windows completed in 41.75 seconds.
Trusted grants and namespace facts were synthetic. These tests do not establish
production custody, abrupt-crash durability or PostgreSQL behavior.

The cases cover process restart, competing target reservations and phase writes,
request changes, invalid boundaries, revoked grants, continuity loss, rollback,
historical replay and adjacent registration behavior. Independent Astra review
accepted the source and reopened the complete runtime archive. The lead verified
all archive members and source hashes. Archive SHA-256:
`4dcce27b503e3208146ee049870e47cd563bbc268207be426c1fa9976307dd30`
(48,599 bytes, 27 entries).

The first Habitat preflight failed because createRequire received the Core
symlink path. Resolving it to the existing package target, as the test loader
already does, fixed resolution without installing dependencies. That failure is
retained alongside the passing evidence. Node was copied from the existing
stopped development container; no container was started. Both Habitat stages,
temporary Node copies and test fixtures were removed. No test process remains.
After comparing every byte with the accepted archive, 14 duplicate Windows
evidence files (16,590 bytes) were removed. The sole retained 07c export is
the 48,599-byte archive. Reviewed source stays in the existing Habitat checkout
for reuse.

## Remaining outcome work

[07d](../packets/07d-staged-creation-effects.md) implements the Linux staged effect
engine. Existing receipt read/replay responses are not effect admissions and omit
private recovery identity. A later native integration must provide a trusted
snapshot, fresh bounded effect admission and ordered revocation under the host
writer lock. Production namespace activation, registration and GUI creation
remain unverified. This unit created no user project.
