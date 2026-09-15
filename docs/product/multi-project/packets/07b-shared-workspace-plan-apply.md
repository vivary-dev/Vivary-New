# 07b: Share a file-content plan and apply path between GUI and CLI
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/14
Parent: 07
Status: in-progress
Depends-on: [07a]
Owner: Coordinating Codex, sole creator and Workbench adapter writer
Scope: Complete the shared portable creator plan/apply operation. The separate 07d packet owns its visible GUI flow.
Verification-kind: runtime
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Preview the exact files and content of a new workspace and apply that plan
through one deterministic Native action and the equivalent existing CLI operation.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

The shared content-preview API was recovered in PR #4. Reuse that renderer.
The earlier guarded Python provider failed strict symlink checks on Zo. Use
the original creator's effect boundary and the existing managed-project bridge
for the greenfield path. A plan hash is not folder custody or an app grant.
Do not reintroduce the failed provider unchanged.

## Current source candidate

`plan_thin_workspace(target, preset, adapters, active_context)` returns the
ordered exact UTF-8 files, content hashes, normalized target/options and a
target-bound `plan_sha256` without writing.
`apply_thin_workspace(target, accepted_plan_sha256, ...)` recomputes those
inputs before the creator's existing write boundary. It returns `created`,
`plan-changed`, or `already-created`; the last result is a no-write retry only
when the target has exactly the reviewed file/byte inventory. An arbitrary
nonempty existing folder remains refused. Changed target or options invalidate
the reviewed hash. The managed bridge delegates to these source operations and
keeps its existing external camel-case result fields.

The source CLI candidate adds `create-vivary init TARGET --reviewed --dry-run
--json` for the full file-content plan, followed by `--reviewed --yes --plan
HASH --json` for its exact apply. Reviewed mode refuses wizard/provider,
storage, memory beyond `none`, and other setup side writers. This greenfield
content plan is separate from project registration and task plans. It does not
enable general existing-folder apply under issue #15. The bounded runtime
increment passed on 2026-09-15. Full issue #14 remains open for existing-folder
apply and delivery.

## Owned files

- Original thin renderer and apply helpers in `packages/create-vivary/create_vivary.py`.
- The existing `packages/workbench/server/managed_project_workspace.py` bridge
  and managed-project caller. Project registration keeps its own owner.
- Deterministic setup actions under `packages/workbench/`. The 07d packet owns
  project navigation and visible setup.
- The minimum packaging changes needed to call the same operations outside this
  source checkout, coordinated with outcome 23.
- Existing creator and creation-provider tests, plus shared action/CLI parity.

## Done condition

The plan includes target, selected inputs, creates/managed patches/kept files,
content, and conflicts. Approval binds the exact reviewed content and target.
Changed inputs invalidate apply. Original creator operations own writes, recovery,
and repeated-request handling. The registry uses the existing project identity.

The existing CLI and deterministic Native actions consume the same contract.
Packet 07d owns the visible preview/apply/register/reopen journey. VCS and
hosting can remain none. This first setup journey ships before
merge/split and does not require a conductor daemon or global CLI installation.

## Verify

Use temporary targets with the normal application composition. Check plan bytes
against applied bytes, refusal after changed input, retry/recovery, and no writes
from preview. Exercise the shared Native action and equivalent headless operations. The 07d
journey validates their GUI caller.
The 2026-09-15 greenfield increment passed against the bundled Python runtime
and the existing private hosted Workbench composition. The CLI and managed
bridge returned the same five-file plan for an exact target. Preview, Cancel,
and a wrong hash wrote nothing. Create wrote exactly the reviewed UTF-8 bytes.
A cross-caller repeat returned `already-created` without changing file bytes or
modification times. The hosted UI selected the new project, kept it after reload,
and opened formatted `STATE.md` with Edit and Rename controls. Normal-size preview and Cancel passed. Keyboard Create then passed at
1440x900. At 390x844, phone preview, Cancel, visible controls, focus, and
no-horizontal-overflow checks passed. Returning
to an earlier conversation preserved its closed panels. The app was idle and
made no model calls. Focused checks passed: 34 Python, 4 JS adapter, and 3
existing command-surface tests. The ignored evidence is
`.tmp/47-bundled-acceptance.json`, `.tmp/47-hosted-acceptance.json`, and
`.tmp/47-hosted-files-final.json`.

An exact repeated managed registration retained its project and binding, with
no policy change or file write. The existing registration receipt advanced
`registryRevision` from 15 to 16. That repeat does not establish an unchanged
whole catalog. The tested increment does not apply to an arbitrary nonempty
folder. Full issue #14, issue #15 existing-folder apply, Windows execution
under issue #8, and held PR #43 remain separate.

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

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.
- 2026-09-13: 07a accepted. Root owns the creator/adapter closure. Begin with
  a shared `plan_thin_workspace` operation over the existing renderer, then wire
  the retained adapter to the real apply path. Hosted mutation proof retains
  its separate unresolved auth prerequisite. Source preparation could proceed.

- 2026-09-13: Recovered preview and role metadata are integrated. This packet
  owns portable apply, with visible setup in 07d.
- 2026-09-15: Issue #14 is active on `feat/shared-workspace-plan`. The original
  creator source candidate binds reviewed greenfield file bytes, target and
  options before apply, recognizes only exact no-write retries, and routes the
  managed bridge and reviewed CLI through that contract. Hosted and packaged
  bundled-Python and private hosted acceptance passed for the bounded
  greenfield path. Existing-folder
  apply and issue #14 delivery remain open.
