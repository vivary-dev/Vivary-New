---
type: packet
---
# 06d: Register real roots through native policy and live custody

Parent: 06
Status: done
Depends-on: [06c, 12d, 05a]
Owner: GPT-6 native root composition writer; separate source and evidence reviewer.
Scope: Native registration with explicit native app roles and a bounded Linux Python custody process over private stdio.
Verification-kind: runtime
Verification-result: passed
Evidence: [06d runtime receipt](../receipts/06d-native-root-registration.md)
Timebox: One bounded composition through real Linux native storage proof, review, evidence export, and cleanup.

## Goal

Register two authorized no-VCS roots using real physical observations and the
existing native action and SQL registry. Preserve unverified identity after lost
custody. Keep the GUI registration mount closed without trusted configuration.

## Context

The lead approved this unit after [12d](../receipts/12d-root-identity-lifecycle.md).
Use its durable application root records and current-custody checks. Reuse the
existing Habitat container and the exact Native dependency graph installed for
05a under the Workbench package. Do not install another runtime or dependency.

Native HTTP authenticates the request once. Every store resolver boundary reads
current native org membership and explicitly assigned app capability. This does
not promise immediate session revocation inside an already running request.

## Owned files

- New Python root-provider module and focused tests in the core package.
- New Node provider/native context composition modules and tests in Workbench.
- This packet, its receipt, outcome 06, and registry source navigation.

Coordinate a single plugin/readiness seam with the 05a app owner. Preserve the
existing native package, registry action/store, decision engine, and lifecycle.

## Done condition

1. Fixed trusted configuration owns executable arguments, private metadata path,
   device, scope, and complete locator inventory. Use minimal subprocess env,
   strict bounded messages and deadlines; loss of the process fails closed.
2. Native session identity and explicit app role constrain trusted app collection
   and locator grants. Requests never supply policy, paths, or identity facts.
3. Every resolver rechecks current policy and current custody. Persist application
   UUIDs only; no physical lifetime identifier becomes a durable SQL binding.
4. Prove two real roots, registration/replay/duplicates, source preservation,
   permission revocation, root replacement, process restart, and malformed wire
   refusal with the existing Linux Native action and SQLite implementation.
5. Preserve no-VCS scope, unsupported Git identity, and unverified restart. Add no
   reconciliation, network service, job queue, transcript store, or auth layer.
6. Retain exact sources, native environment, independent review, verified evidence
   export, and cleanup of only owned processes and disposable proof paths.

## Verify

Run focused Python protocol and real native integration tests in the existing
Habitat. Then run plan, source navigation, line endings, and diff checks.

```console
node packages/workbench/tests/native-registry.test.mjs /absolute/proof/root /absolute/provider/entry.py /absolute/python
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

No new checkout/container, dependency install, credential copy, model call,
public listener, account configuration, publish, push, merge, or project writes.
Missing production configuration leaves registration closed. Preserve original
root and native stores; scope changes require lead alignment before proceeding.

## Log

- 2026-09-07: Lead approved the Linux native composition and the exact request-auth
  versus current membership/capability guarantee.

- 2026-09-07: Six Linux groups passed. Independent replay passed all six in 6.791 seconds. The lead verified all 62 archive payloads and 50 canonical sources. Exact cleanup removed 47 Habitat files and 12 Windows staging files. Native doctor passed all ten guards.
