# 07e receipt: Native creation snapshots and effect admission

Evidence-record: 07e

Status: Complete for the Native facade under a synthetic host ordering protocol.

## Accepted behavior

The existing Native receipt owner now exposes a private load, prepare, transition
and admitAndExecute port. Exact snapshots include the stored binding, phase, stage
and continuity identity. Changed claims, failed receipts, stale authority and
unsupported effect/phase pairs refuse. No new table, journal or admission token
was added. Private snapshots are not an HTTP/action response.

Every receipt mutation requires the injected collection/device host scope. The
default host refuses; public historical reads remain available under current read
authority. Only prepare-stage in preparing, or publish/recover-publication in
publishing, may invoke a callback. Native transactions finish before filesystem
callbacks. The facade preserves the actual callback's one-shot identity and waits
for settlement before returning uncertainty.

Independent review caught a callback-liveness gap when a host returned early while
validation awaited. The correction carries scope liveness into the running
callback and checks immediately before effects, before insert/update and before
transaction completion. Deferred tests observe zero effects and rollback of
staged public/private mutations after expiry. An already-started effect or a
committed transaction still depends on the trusted host's custody promise; local
checks cannot restore custody after a broken host releases it.

## Runtime evidence

All 21 tests passed with zero skips in existing Habitat: eight focused admission
tests and the 13 existing creation-receipt tests. Actual Core 0.176.5 database
adapters used SQLite 3.53.2 through better-sqlite3 12.11.1 on Node 22.23.2. The
supervised run took 49.342 seconds, including toolchain preflight; the test reporter
recorded 48.537 seconds. Maximum reported child RSS was 137,728 KiB, not aggregate
machine memory. The main heap was capped at 192 MiB and fixture children at 128 MiB.

The suite observes fresh-connection snapshots, exact claims/effect pairs,
pre-admission revocation and disconnect, delayed phase writers/invalidation,
duplicate and retained callbacks, early returns, callback/host failures and
transaction rollback. Existing process-restart, reservation/CAS, historical replay
and adjacent registration cases remain green. The admission coordinator is a
synthetic same-process fixture. Cross-process cases establish database reservation
and CAS behavior; they do not establish production host ordering or fencing.

## Review and cleanup

Parent and independent Astra review accepted the final source and tests. The
independent reviewer reopened all 26 payload hashes in the 27-entry evidence
archive and checked current source/dependency and driver bytes. Archive SHA-256:
`99d2ab3eb1b663c63e4970bf657a2da61a1ca0b9168454091b2e86a40e47ca8a`
(108,701 bytes).

The version, SQLite and test process groups were confirmed absent. All fixtures,
the copied Node binary and the exact Habitat proof stage were removed after local
evidence readback. No container was started, no model was called and no user project
was written. Ten duplicate Windows evidence/source files (101,269 bytes) and
the empty source staging tree were removed after byte comparison with the
accepted archive. The sole retained 07e export is 108,701 bytes. Reviewed source
remains in the existing Habitat checkout for reuse.

## Next integration

[07f](../packets/07f-creation-duplex-bridge.md) composes the private duplex Python
bridge with correlated nested authority reads and quiescence before failure
settlement. Production namespace/lifecycle activation, registration and GUI
creation remain unverified. Outcome 07 remains open.
