# 09c: Expose original review and control tools in Native
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/20
Parent: 09
Status: needs-info
Depends-on: [09b, 07d]
Owner: Root-assigned governed-tool integrator
Scope: Expose decide, review, impact, and control without replacing original policies or records.
Verification-kind: runtime
Needs: Accept 09b and 07d. Resolve the supported operation set, actor binding, and record-write authority.
Timebox: One governed-tool increment with focused refusals and a visible review journey.

## Goal

Let the application and agent inspect original policy decisions, review findings,
impact, and control results while preserving the authority of each source owner.

## Context

Read [the desktop release plan](../desktop-release.md), [ENGINEERING.md](../../../../ENGINEERING.md),
[Native ownership](../native-owners.md), and the original context/review source map.
Reuse the original CLI routing and the shared bundled-package adapter from 09b.
A policy decision or returned control state does not itself execute the proposed work.

## Owned files

- `packages/strato/strato.py`: `decide_governed` and its existing request contract.
- `packages/ozone/ozone.py`: `cmd_review` and `cmd_impact`.
- `packages/exo/exo.py`: `governed_control`; `packages/core/vivary_core/control.py` owns transitions.
- Deterministic actions in `packages/workbench/actions/` and their existing server adapter.
- Existing review/result UI and focused original policy/control tests.

## Done condition

Expose decide, review, impact, and control through typed, project-scoped actions.
Retain original schemas, reason codes, policy versions, and supported operation
semantics. Resolve actor and project authority at the server boundary. Do not trust
an input field that claims an elevated role, approval, or verification result.

The app and agent receive the same result and can inspect the relevant source
records. Preserve required review gates and original ownership of writes.
Returned state remains a result until its authorized owning operation persists it.
Do not manufacture receipts from successful dispatch or duplicate records in Native.
Unsupported enforcement or missing evidence produces an explicit refusal.

## Verify

Compare installed CLI and action results for a permitted request and the relevant
denied cases: wrong actor/project, stale input, missing approval, and malformed data.
Exercise the GUI review and the registered Native tools. Confirm refusals leave
authored records unchanged and approved effects use only the original writer.

```console
python -B -m pytest packages/strato/tests/test_strato.py packages/ozone/tests/test_ozone.py packages/exo/tests/test_exo.py packages/core/tests/test_control.py -q
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Do not turn `act` into execution authority, enable strict mutation on local-stat
roots, bypass a source policy, launch workers, or create another executor/store.

## Log

- 2026-09-13: Drafted for the desktop release. No new tool or authority is activated.
