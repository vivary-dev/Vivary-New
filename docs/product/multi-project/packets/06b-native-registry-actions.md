---
type: packet
---
# 06b: Compose internal native registry actions

Parent: 06
Status: done
Depends-on: [06a, 03c]
Owner: GPT-6 native action writer; separate GPT-6 source and evidence reviewer.
Scope: Internal register/export action definitions, strict parsed-request validation, trusted per-invocation context, and Windows native action-to-storage proof.
Verification-kind: runtime
Verification-result: passed
Evidence: [06b internal native action receipt](../receipts/06b-native-registry-actions.md)
Timebox: One bounded action unit through implementation, native verification, independent review, evidence export, and cleanup.

## Goal

Run registration and portable export through Core's native action validation,
authorization, strict output projection, and audit behavior, using the accepted
native registry store. Keep each invocation bound to its trusted context.

## Context

Read the [03c transaction map](../contracts/project-registry-transaction-map.md),
[06a receipt](../receipts/06a-native-registry-storage.md), and installed Core
action definitions, access-control, run-context, and audit documentation/source.
The lead authorized this dependent application unit after 06a closure.

Core 0.176.5 coerces top-level numeric strings before schema validation. The
registry contract forbids that coercion. An app-owned entry therefore validates
with the exact same strict schema before calling the native entry's `run`.
This composition changes no native module or protected runtime contract.

Core's parsed-input action boundary cannot recover duplicate raw JSON keys.
These definitions remain outside automatic action discovery, with HTTP,
agent/MCP, extension, and public exposure disabled. This packet does not claim
a public HTTP transport or configured production authentication/root resolver.

## Owned files

- New `packages/workbench/server/registry-actions.mjs`
- New `packages/workbench/tests/registry-actions.test.mjs` and `native-action-dependency-loader.mjs`
- Existing package manifest and README for exact installed schema dependency and proof instructions
- This packet, its receipt, outcome 06, and the registry source-map index

The graph writer owns generated graph files. The existing store, decision engine,
physical observer, and native dependencies remain unchanged.

## Done condition

1. Compose `defineAction`, strict input/output schemas, authorization, and native
   audit with the existing store. Return only the contract's public output.
2. Reject numeric strings, unknown/authority fields, malformed IDs/revisions,
   invalid content identities, and invalid Unicode before resolver or database.
3. Prove missing/denied trusted context cannot enter the store. Require an
   affirmative current authorization result; do not default anonymous callers.
4. Bind each store invocation to an immutable snapshot of permitted native
   context fields. Prove concurrent calls cannot exchange their identity.
5. Exercise native action-to-SQLite register, replay, scoped export, and revoked
   policy. Confirm strict output rejection and private audit input configuration.
6. Inspect native metadata to prove all discovery/exposure flags are disabled.
   Prove native audit failure cannot roll back or replace the atomic receipt.
7. Record exact source/runtime evidence, complete independent review, verify the
   export, and remove only task-owned temporary files after worker exit.

## Verify

Run the focused native action test command using the existing dependency package
and one absolute disposable proof root. Test workers use a minimal environment.

```console
node --test packages/workbench/tests/registry-actions.test.mjs
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

Use synthetic identities and the existing installed Core 0.176.5/Zod 4.5.4
dependencies only. Do not install or patch packages, configure accounts, expose
HTTP/tool routes, persist observer lifetime IDs, create a checkout, add a new
authorization service, or call a model. No Linux driver or deployed-app claim.

Current production authority and durable root identity composition, strict raw
transport, GUI wiring/switching, and deployment verification remain concrete
future work. Routine native application composition is authorized here.

## Log

- 2026-09-07: Claimed after accepted 06a storage proof. Verified native action
  coercion and selected an outer strict validation using the same schema.

- 2026-09-07: Completed all 12 native Windows tests, independent source/archive review, and bounded cleanup. The receipt records exact runtime/source evidence and internal-only limits. Outcome 06 remains in progress.
