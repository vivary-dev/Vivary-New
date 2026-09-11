---
type: packet
---
# 06a: Persist native registry registration transactions

Parent: 06
Status: done
Depends-on: [03c]
Owner: GPT-6 dependency storage writer; separate GPT-6 source and evidence reviewer.
Scope: New private Workbench database/schema/migration/store modules and Windows SQLite integration proof using existing locked native dependencies. Synthetic identities only.
Verification-kind: runtime
Verification-result: passed
Evidence: [06a native registry storage receipt](../receipts/06a-native-registry-storage.md)
Timebox: One bounded storage unit through failure, persistence, concurrency, review, evidence, and cleanup.

## Goal

Persist registration, duplicate-operation receipts, and registry revision through
the existing Agent-Native database transaction. Reopen accepted records in another
process. Reject partial writes and conflicting contenders.

## Context

Read the [registry contract](../contracts/project-registry.md),
[transaction map](../contracts/project-registry-transaction-map.md),
[03c receipt](../receipts/03c-registry-transaction-mapping.md),
[native ownership map](../native-owners.md), and installed Core database docs.

Choosing the existing local SQLite backend is an ordinary reversible technical
choice under continuous implementation authority. Core 0.176.5 documents it as
the local default. The lead authorized Windows checks against already installed
locked dependencies. Habitat currently resolves none of Core, Drizzle, or
better-sqlite3; that limits Linux verification without blocking this Windows unit.
No dependency installation or hosted backend is selected.

Use one revision row per collection/device, as proposed by 03c. The private app
package belongs under `packages/workbench`, beside existing packages. New source
does not change the preserved Littleagent implementation. Its native dependencies
are reused only through explicit private test configuration.

## Owned files

- `packages/workbench/package.json` and `README.md`
- `packages/workbench/server/db/schema.mjs`, `index.mjs`, and `migrations.mjs`
- `packages/workbench/server/registry-store.mjs`
- `packages/workbench/tests/registry-store.test.mjs` and `native-dependency-loader.mjs`
- This packet, its receipt, outcome 06, and the registry source-map index

The coordinating writer owns generated graph files. The existing registry
decision oracle, native dependencies, and physical observer remain unchanged.

## Done condition

1. Use Core's public `createGetDb`, portable schema helpers, and `runMigrations`.
   Reuse the existing evaluator as the decision owner.
2. Load current projects, bindings, scoped receipts, and revision inside one
   native transaction. Caller requests cannot replace stored records.
3. Persist project, binding, receipt, and revision together. Inject native
   failures before each insert and prove zero partial records after reopen.
4. Reopen a file-backed registration in another process. Export only portable
   fields and reauthorize replay without reallocating or rewriting records.
5. Prove operation-key conflicts, physical-root uniqueness with synthetic IDs,
   allocation collision, revoked authority, and scoped reads.
6. Exercise concurrent native async transactions and independent process
   contenders. Preserve one registration and one accepted scoped operation.
7. Retain exact environment/source evidence, complete independent review,
   verify the export, and remove only task-owned temporary files and processes.

## Verify

Run the package's focused Node test suite with explicit existing dependency and
proof-root variables described in its README. Children receive a minimal
environment and a task-local database URL; no live account configuration is used.

```console
node --test packages/workbench/tests/registry-store.test.mjs
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

Keep all proof identities synthetic. Do not persist 12c lifetime IDs. Add no UI,
public action, authentication service, native task/session table, reservation,
write-back adapter, or source import. Do not install dependencies, modify native
packages, or claim Linux, deployed-storage, or production registration support.

Durable physical identity, current policy composition, raw-transport validation,
application integration, deployment backend checks, and Linux driver evidence
remain actual production prerequisites. They do not pause this bounded unit.

## Log

- 2026-09-07: Claimed native database persistence under the approved Windows
  verification scope. Implementation and behavioral proof are in progress.

- 2026-09-07: Completed all 14 native Windows tests, two independent source reviews, exact archive verification, and bounded cleanup. The receipt records driver versions, source hashes, proof boundaries, and remaining production prerequisites.
