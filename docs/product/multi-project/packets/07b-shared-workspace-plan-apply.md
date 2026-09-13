# 07b: Share a file-content plan and apply path between GUI and CLI
Type: packet
Parent: 07
Status: ready-for-agent
Depends-on: [07a]
Owner: Coordinating Codex, sole creator and Workbench adapter writer
Scope: Repair the existing creator adapter and expose one deterministic content plan/apply contract through the CLI and Native GUI.
Verification-kind: runtime
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Preview the exact files and content of a new workspace, apply that plan, and
open the registered result through the normal GUI and existing CLI.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

The retained `creation_workspace.py` refers to unavailable APIs. Repair the real
source closure rather than adding a replacement renderer or trusting the adapter
as ready to mount. Built-in setup does not depend on the external catalog.

## Owned files

- Original thin renderer and apply helpers in `packages/create-vivary/create_vivary.py`.
- `packages/workbench/server/creation_workspace.py`, `creation-provider.mjs`,
  and the required existing project-services/registry integration.
- Setup actions and project navigation under `packages/workbench/`.
- The minimum packaging changes needed to call the same operations outside this
  source checkout, coordinated with outcome 23.
- Existing creator and creation-provider tests, plus a narrow GUI journey.

## Done condition

The plan includes target, selected inputs, creates/managed patches/kept files,
content, and conflicts. Approval binds the exact reviewed content and target.
Changed inputs invalidate apply. Original creator operations own writes, recovery,
and repeated-request handling. The registry uses the existing project identity.

GUI and CLI consume the same contract. The GUI shows the plan, applies it, opens
the folder's files, and reports recovery errors. Reopen retains the registered
project. VCS and hosting can remain none. This first setup journey ships before
merge/split and does not require a conductor daemon or global CLI installation.

## Verify

Use temporary targets with the normal application composition. Check plan bytes
against applied bytes, refusal after changed input, retry/recovery, and no writes
from preview. Exercise Create through the GUI and equivalent headless operations.
Test hosted workflow first, then the packaged desktop path under existing authority.
The commands below are starting suites, not substitutes for the actual journey.

```console
python -m unittest discover -s packages/create-vivary/tests -p test_init_thin.py
node --test packages/workbench/tests/creation-provider.test.mjs
git diff --check
```

## Stop conditions

Resolve any new write-authority requirement with the owning root/creation
contract. Do not enable strict mutation roles on the local-stat provider, claim
held custody from a path, install another executor, or activate external templates.
A hosted-auth blocker prevents only its dependent hosted mutation proof.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.
- 2026-09-13: 07a accepted. Root owns the creator/adapter closure. Begin with
  a shared `plan_thin_workspace` operation over the existing renderer, then wire
  the retained adapter to the real apply path. Hosted mutation proof retains
  its separate unresolved auth prerequisite. Source preparation can proceed.
