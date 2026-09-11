---
type: packet
---
# 12c: Compose physical captures with registry read observations

Parent: 12
Status: done
Depends-on: [03c, 12b]
Owner: GPT-6 dependency adapter writer; separate GPT-6 source and evidence reviewer.
Scope: Private read-only composition of trusted resolver snapshots, the Linux physical observer, and the existing registry inspection oracle. No database or product action.
Verification-kind: runtime
Evidence: [Read observation receipt](../receipts/12c-registry-read-observation.md)
Verification-result: passed
Timebox: One bounded adapter through source review, Habitat proof, evidence, and cleanup.

## Goal

Use real no-VCS and Git captures to construct the existing observation contract.
Accept location, operation, and expected policy revision as request fields.
Resolve authority through an injected trusted connection/policy owner.

## Context

Read the [root observation contract](../contracts/root-vcs-observation.md),
[registry contract](../contracts/project-registry.md),
[03c mapping](../receipts/03c-registry-transaction-mapping.md), and
[12b receipt](../receipts/12b-physical-root-observer.md).
The physical observer supplies held-descriptor identity and complete configured
topology checks. The existing registry oracle owns registration decisions.

## Owned files

- `packages/core/vivary_core/registry_observe.py`
- `packages/core/tests/test_registry_observe.py`
- This packet and `receipts/12c-registry-read-observation.md`
- Outcome 12 and the root-observation source-map index

The coordinating graph writer owns generated files. Leave the physical observer,
registry contract, and oracle unchanged unless a required seam change is reported.

## Done condition

1. Deny mutation requests before probing. Reject caller-supplied authority,
   missing membership/capability/read grant, and stale policy.
2. Require the resolver's complete relevant locator inventory. Inspect relevant
   other-actor roots without granting the requesting actor access to their records.
   Refuse incomplete scans and unsafe overlap.
3. Bind each issued handle to one service and physical-observer lifetime.
   Refuse unissued, closed, replaced-root, changed-content, and stale-policy use.
4. Recheck policy around capture and inspection. Return only the existing
   immutable observation shape, with read-only mutation eligibility.
5. Run real Habitat no-VCS, Git, alias, moved-root, linked-worktree, and refusal
   cases. Compare project and administrative bytes, modes, and write timestamps.
6. Feed selected private fixture observations to the existing in-memory registry
   oracle for register, duplicate, and rebind decisions. Persist no registry ID.
7. Complete independent source/evidence review and bounded staging cleanup.

## Verify

Reuse the existing Habitat checkout and installed Python, Node, and Git.
Transfer only reviewed files and verify their hashes before running.
Test-owned repositories and linked worktrees are disposable fixtures under the
lead's named tmpfs task root. Create no additional development checkout.

```console
python -B -m unittest discover -s packages/core/tests -p test_registry_observe.py -v
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

Windows can verify request boundaries and explicit platform refusal. Linux tests
must run without skips in Habitat before accepting physical composition.

## Stop conditions

No model, native session, dependency installation, database, registry persistence,
public action, or file-effect adapter is added. Keep lifetime IDs private. An
inspection view cannot establish identity after restart or authorize mutation.
The injected resolver is a trusted integration seam, not a new authentication
service or proof that production connection configuration exists.

Retain private verification evidence before deleting only this packet's staging
and stopped test fixtures. Existing services and runtime tools stay in place.

## Log

- 2026-09-07: Claimed under continuous implementation authority after 12b.
  Windows boundary verification passed nine checks; twelve physical tests await
  Habitat execution. Independent review remains open.

- 2026-09-07: All 21 Habitat tests passed without skips. Two independent GPT-6
  readers accepted the bounded source and evidence. Private export and exact
  Windows/Habitat staging cleanup are complete. Outcome 12 remains open.
