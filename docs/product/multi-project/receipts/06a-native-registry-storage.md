# 06a native registry storage receipt

Evidence-record: 06a
Date: 2026-09-07
Verification-kind: runtime
Result: All 14 Windows native database tests, two independent source reviews, archive verification, and bounded cleanup passed.

The [packet](../packets/06a-native-registry-storage.md) adds private Workbench
registration storage. Outcome 06 remains in progress for application integration
and switching. This receipt establishes bounded Windows SQLite behavior.

## Implementation

The new `packages/workbench` package composes Core's public `createGetDb`, portable
schema helpers, and `runMigrations`. Four application-owned tables store portable
projects, local bindings, scoped operation receipts, and collection/device
revision. Native tasks, sessions, transcripts, and credentials keep their owners.

The trusted caller injects the existing registry evaluator, a policy/root fact
resolver, and an ID allocator. Only nine named facts can come from the resolver.
Stored records are loaded inside the transaction. The existing evaluator owns
decisions; the adapter applies its bounded registration changes atomically.

Authorization is checked before entering storage, after loading current records,
and after writes before commit. Changed or revoked authority aborts the whole
transaction. Scoped exports also use a transaction. SQL uniqueness covers root
ownership and operation scope; the revision update checks its prior value.

The adapter implements register and portable export. It has no public action,
GUI, root inspection, reservation, write-back, or production policy resolver.
The read observer is disconnected: its process-lifetime IDs are not persisted.
Every database identity in this proof is synthetic.

## Native runtime proof

Windows x64 used Node 24.19.0, Core 0.176.5, Drizzle 0.45.2, better-sqlite3
12.11.1, and SQLite 3.53.2. The installed libSQL client is 0.15.15; the proof
selected file-backed SQLite, so it does not establish libSQL service behavior.

The test-only loader resolves the already installed locked Core package through
explicit private process configuration. No dependencies, links, or package
patches were installed. Test workers receive a minimal environment, an explicit
disposable `file:` database URL, and a working directory inside their case tree.
Core's automatic data directory therefore stays inside disposable test storage.

```console
node --test packages/workbench/tests/registry-store.test.mjs
```

The first complete suite passed all 14 tests in 42.803 seconds. After strengthening
failure cleanup to wait for remaining child processes, the final suite passed all
14 tests with no failures, skips, or cancellations in 44.146 seconds.

| Case | Observed result |
| --- | --- |
| Initial database and repeated native migrations | No product records; reopen succeeds |
| Accepted registration and fresh-process export | Four records survive; export contains portable fields only |
| Native failure before each of four inserts | Reopen finds zero projects, bindings, receipts, and revisions |
| Completed operation replay after restart | Same result; no ID allocation, new writes, or revision reset |
| Changed request under the same operation key | Explicit operation conflict |
| New operation for an existing physical root | Existing project; one new receipt and revision |
| Foreign actor registration or export | Denied without disclosing the binding |
| Revocation after inserts | Transaction aborts; no partial records |
| Allocated ID collision | Existing portable records remain intact |
| Concurrent async calls on one native connection | One registration; second call replays the receipt |
| Independent processes with different operation keys | One winner; stale contender retries |
| Independent processes with the same operation key | One registration; completed result replays |

SQLite triggers inject failures before each insert. The binding, receipt, and
revision cases fail after earlier records have been written in the transaction.
Fresh-process snapshots verify rollback. Cross-process cases use distinct native
connections against one disposable file and inspect the final database.

The initial sandbox preflight failed at Node test-runner process spawn with
`EPERM`, before a test ran. The authorized elevated retry passed. A private
environment-capture helper initially encountered an unexported package-manifest
subpath; the corrected helper locates that manifest from the resolved package
entry and recorded the actual driver and framework hashes. Neither issue changed
the production database implementation.

Habitat has no resolvable Core, Drizzle, or better-sqlite3 package. No installation
was authorized for this packet, so no Linux database acceptance is claimed.

## Source and review

The final source hashes and native framework hashes are retained in the private evidence manifest. The registration store hash is `df36b4f77e3d454691b6e28063614fe533b8fb79740d8f900115493d3597ca86`; the test suite hash is `4c84462823e5a832e4aba01298ccd4e055bf8cbc718e65c27830850360bc19ef`.

The GPT-6 lead and a separate GPT-6 source reader independently reviewed the store, schema, migrations, tests, and stated limits. Neither found a blocking issue in transaction ownership, reauthorization, decision delegation, allocation timing, persistence, replay, uniqueness, concurrency, or contained cleanup. The implementation writer did not supply independent acceptance.

## Evidence and cleanup

The retained private archive has 18 entries and 32,708 bytes, SHA-256 `6ae38f9381b92977e53449b5636cc5f11ca04ffa47960c59fe7b77761676c3a5`. Its internal manifest hashes all 17 payload entries: eight new package files, the existing decision engine and fixture, runtime logs, environment evidence, and capture helpers. The lead independently verified every member hash and all ten current source files against archived bytes.

After both source reviews passed, cleanup rechecked the archive hash and exact target, rejected reparse points and unexpected files, then removed only the owned staging tree: 12 files, 46,295 bytes, and three directories. The target was verified absent. Individual test database trees had already been removed after child exit. The final archive, sidecar, logs, and cleanup receipt remain private. No Habitat files were created for this Windows-only packet.

Source navigation, tracked line endings, and diff checks passed. The graph writer renders the completed packet and verifies the canonical planning graph.

Durable physical identity, configured current-policy composition, raw transport
validation, application wiring, switching, deployed storage checks, and Linux
driver evidence remain production prerequisites. This package is private and
unreleased; it does not alter existing Python package release claims.
