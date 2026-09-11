---
type: packet
---
# 06c: Validate raw registration requests at the native HTTP mount

Parent: 06
Status: done
Depends-on: [06b, 03c]
Owner: GPT-6 HTTP boundary writer; separate GPT-6 source and evidence reviewer.
Scope: Opt-in registration HTTP middleware and native action mount, with real Windows loopback HTTP-to-SQLite proof using synthetic trusted auth callbacks.
Verification-kind: runtime
Verification-result: passed
Evidence: [06c runtime receipt](../receipts/06c-native-registry-http.md)
Timebox: One bounded transport unit through native runtime proof, independent review, exact evidence export, and cleanup.

## Goal

Reject duplicate raw JSON keys, invalid UTF-8, oversized requests, and coercible
caller values before native registration dispatch. Exercise actual HTTP through
the existing native action and registry storage rather than adding a CRUD route.

## Context

Read the [03c raw-input finding](../receipts/03c-registry-transaction-mapping.md),
[06b receipt](../receipts/06b-native-registry-actions.md), installed middleware
and plugin docs, and Core's public `getH3App`/`mountActionRoutes` implementation.

Native action routes parse JSON before calling the entry. A middleware registered
at the same mount can validate a bounded clone of the raw Web Request before that
parse while leaving native dispatch, auth context, output, and audit intact.
The existing strict JSON parser and the same action schema own validation.

The lead authorized this dependent unit after 06b. Use installed Core 0.176.5,
H3 2.0.1-rc.31, and existing database/schema dependencies. The Windows proof uses
a real loopback listener with an ephemeral port and synthetic trusted auth
callbacks. It does not configure a production authentication provider.

## Owned files

- New `packages/workbench/server/registry-http.mjs`
- New focused HTTP tests and existing-dependency loader under `packages/workbench/tests/`
- Package manifest and README for supported dependency and proof instructions
- This packet, its receipt, outcome 06, and the registry source-map index

The graph writer owns generated files. Preserve the native package, existing
registry action/store, decision engine/parser, and other agents' edits.

## Done condition

1. Mount middleware and the existing registration entry through public native
   APIs at the same action path. Add no duplicate CRUD route or state store.
2. Require POST and JSON, bound actual bytes as well as declared length, decode
   UTF-8 strictly, reject duplicate/escaped/nested keys with the existing parser,
   and validate with the existing action schema before native body parsing.
3. Preserve native authenticated context, action authorization/output validation,
   private audit, and the atomic registry receipt. Make mounting explicitly opt-in.
4. Prove HTTP registration and replay using a real listener and existing SQLite
   store. Reject malformed, coercible, unauthorized, and oversized requests with
   zero registry changes; include path-prefix and application-base cases.
5. Keep agent/MCP/extension/public-agent exposure disabled. Export remains
   internal; this packet does not invent a GET-query coercion contract.
6. Retain exact environment/source evidence, independent review, verified export,
   and cleanup of only the owned listener, worker, fixtures, and staging files.

## Verify

Use the existing dependency package and one absolute disposable proof root.
Workers receive a minimal environment and no live account configuration.

```console
node --test packages/workbench/tests/registry-http.test.mjs
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

Do not install or patch dependencies, configure accounts, add a parallel auth
service, call models, create a checkout, publish the listener, or persist observer
lifetime IDs. Keep listeners on loopback with a bounded process deadline.

The transport proof does not establish production policy/root identity,
installed Nitro application behavior, GUI integration, or Linux database support.
After closure, select concrete trusted policy/root and preserved-shell work so
the program continues toward the full product rather than isolated adapters.

## Log

- 2026-09-07: Claimed the approved native HTTP registration boundary after source
  inspection identified public middleware and action mounting seams.

- 2026-09-07: Ten real Windows HTTP-to-SQLite tests passed. The lead independently reviewed source and verified the 21-entry archive, all 20 payload hashes, 14 canonical source matches, and the final test log. Exact staging cleanup removed seven files and three directories; the archive remains verified.
