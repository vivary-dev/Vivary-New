---
type: packet
---
# 07b: Bind creation authority to live parent custody

Parent: 07
Status: done
Depends-on: [03c, 06d, 07a, 12d]
Owner: GPT-6 Astra creation-authority writer; GPT-6 lead owns acceptance and graph.
Scope: Read-only authorization and process-local parent custody for a later bounded creation effect.
Verification-kind: runtime
Verification-result: passed
Evidence: [07b runtime receipt](../receipts/07b-creation-parent-authority.md)
Timebox: One small authority module, focused low-memory Linux checks, independent review, evidence and cleanup.

## Goal

Distinguish permission to create one named child from permission to register or
read a project. Bind the current explicit creation grant, exact accepted preview
digest, operation and child name to a host-configured physical parent. This unit
must not create project files or claim authority over arbitrary GUI paths.

## Context

Read outcome 07, the 07a receipt, 12d custody limits, registry observation contracts,
and the project-writeback source map. Independent architecture review found no
creation-specific grant or safe admission of new GUI paths in the fixed Native
root inventory. Read authority and registration intentionally grant no writes.

## Owned files

The writer owns new `packages/core/vivary_core/creation_authority.py` and
`packages/core/tests/test_creation_authority.py`, plus private proof helpers.
The lead owns this packet, its receipt, outcome 07 and generated graph updates.
Changes to existing registry, observer, Native inventory or scaffolder code
require an explicit ownership handoff. No second member roster or policy store.

## Contract

Trusted configuration resolves one parent reference to an existing parent.
A trusted current-authority callback must return explicit create-child permission.
Request fields contain one child basename, an operation ID and an accepted plan
digest. They do not supply absolute parent paths or claims about filesystem safety.

Acquire an opaque process-local lease only after validating the grant, request
binding, supported Linux parent and current custody. Revalidation observes policy
and parent continuity again. Callers must close the owner explicitly or use its context manager. Process
exit releases descriptors; a forked child rejects inherited ownership and closes
its descriptor copies before touching inherited locks. Garbage collection is not
a supported cleanup mechanism. Repeated requests must not silently change operation input.

A held descriptor pins an object. It does not prevent pathname moves, create a
cross-process reservation or establish durable identity after restart. Preserve
that distinction in the API and receipt. The later effect requires a proved host
namespace restriction and atomic no-replace publication. This packet grants no
filesystem effect and cannot itself satisfy outcome 07's crash-recovery promise.

## Done condition

1. An explicit current creation grant is necessary; read/registration membership
   cannot substitute. Changed or revoked authority and mismatched bindings refuse.
2. Invalid names/digests, changed physical parents, closed or foreign leases and
   unsupported platforms refuse. Repeated requests preserve their exact identity.
3. Focused checks exercise real Linux parent replacement and descriptor cleanup
   using one synthetic task-owned parent. Parent contents remain unchanged.
4. Independent source/runtime review, verified evidence and exact staging cleanup
   are recorded. Filesystem apply, restart recovery and registration remain open.

## Verify

Run the focused core tests in existing Habitat at low priority after a resource
preflight. Use the installed Python and existing test dependencies. Preserve the
sources and actual results before exact cleanup. Then run common document checks.

```console
python -B -m unittest discover -s packages/core/tests -p test_creation_authority.py
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

No new checkout, dependency install, model call, server, public listener, account
configuration, project-file mutation, publication, push, merge or inventory edit.
Do not claim pathname containment from a held descriptor or infer durable effect
ownership from inode, marker or matching bytes. Defer heavy checks under D33;
continue source work while RAM headroom is low.

## Log

- 2026-09-07: Lead accepted the independent recommendation to establish explicit
  creation authority before the apply transaction. Claimed under continuous-work
  authority. Implementation and runtime acceptance are pending.

- 2026-09-07: Accepted after the reproduced fork regression, 22 passing Linux
  checks, independent review, evidence export and exact staging cleanup.
