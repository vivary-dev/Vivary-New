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

## Accepted new-folder increment and remaining work

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

The private dev CLI adds `create-vivary init TARGET --reviewed --dry-run
--json` for the full file-content plan, followed by `--reviewed --yes --plan
HASH --json` for its exact apply. Reviewed mode refuses wizard/provider,
storage, memory beyond `none`, and other setup side writers. This greenfield
content plan is separate from project registration and task plans. It does not
enable general existing-folder apply under issue #15. The bounded runtime
increment passed on 2026-09-15 and merged in PR #47. Full issue #14 remains open
for existing-folder apply. These private source commands are not a registry release.

## Existing-folder content preview

The ordinary `adopt --json` dry run now adds `content_plan` with schema
`vivary.adopt-content-plan.v1`. The creator captures complete proposed UTF-8
contents, byte counts, and hashes for creates, patches, and replacements during
planning. Retained paths carry hashes, including files with binary contents.
The existing `plan_hash` binds the same inputs as before. Serialization performs
no filesystem rereads, and applied and recovery reports keep their existing shape.
The [creator reference](../../../../packages/create-vivary/README.md#existing-repositories-and-vaults)
owns the field contract.

Workbench exposes this read-only report through **Details > Preview Vivary setup**
for the selected registered folder. It reuses `vivary-original-command` and the
original runtime's scope checks. Oversized output fails the whole preview at the
existing process output bound; content is never silently truncated. The
[Workbench reference](../../../../packages/workbench/README.md#projects-and-conversations)
owns the visible flow and its limit.

This increment adds no adoption write action. General GUI adoption apply and
its remaining approval, retry, and recovery work stay open under
[issue #14](https://github.com/vivary-dev/Vivary-New/issues/14) and
[issue #15](https://github.com/vivary-dev/Vivary-New/issues/15).

## Owned files

- Original thin renderer and apply helpers in `packages/create-vivary/create_vivary.py`.
- The existing `packages/workbench/server/managed_project_workspace.py` bridge
  and managed-project caller. Project registration keeps its own owner.
- Deterministic setup actions under `packages/workbench/`. The 07d packet owns
  project navigation and visible setup.
- The minimum packaging changes needed to call the same operations outside this
  source checkout, coordinated with outcome 23.
- Existing creator and creation-provider tests, plus shared action/CLI parity.

## Adoption concurrency prerequisite

The creator serializes ordinary adoption apply and approved rollback recovery for
the same physical folder before either can write. Read-only previews remain
unchanged. The [creator reference](../../../../packages/create-vivary/README.md#existing-repositories-and-vaults)
owns platform behavior and limits. Real subprocess checks cover contention,
process death, recovery, and independent folders; native Windows checks remain
separate from the packaged desktop journey.

Apply also refuses before any write when the complete journal could exceed the
recovery reader's size limit. Regression checks cover oversized UTF-8 inputs,
progress-state growth, and exact-byte recovery near the limit. The creator
reference above owns the limit and refusal behavior.

This prerequisite does not make a lost success response safely replayable.
Original-request completion records and explicit app-side write approval remain
part of issue #14; the GUI Apply and recovery journey remains under issue #15.

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
The earlier 2026-09-15 candidate passed the hosted keyboard Create journey
at 1440x900 and normal-size Cancel. Its unchanged frontend also passed phone
preview/Cancel controls, focus, and no horizontal overflow at 390x844. That
pre-fix hosted proof remains in `.tmp/47-hosted-acceptance.json` and
`.tmp/47-hosted-files-final.json`; it is not the corrected creator receipt.

The PR #47 review correction gives each write attempt its own file-commit
and directory ownership, so a failed concurrent attempt cannot roll back a
winner's files. An exact retry runs read-only Doctor before reporting success.
Target-inspection errors become structured refusals, and sanitized CLI
receipts include `--reviewed`. The corrected bundled-Python run in
`.tmp/47-review-bundled-acceptance.json` passed five-file CLI/bridge plan
parity, no preview or wrong-hash writes, exact create bytes, and no-write
cross-caller retry. Focused shared, CLI, bridge, and adoption tests passed
15, 22, 5, and 20 cases.

The corrected hosted journey in `.tmp/47-review-hosted-acceptance.json`
again matched all five UI plan contents to the Native response and bundled
CLI hash. Preview and wrong-hash refusal left the target absent. Keyboard
Create registered and selected the new project. Exact retry retained its
project and policy, with all five file bytes and modification times unchanged
(`.tmp/47-review-hosted-files-final.json`). The existing registration-attempt
receipt advanced `registryRevision` from 23 to 24; a whole-catalog-unchanged
claim does not follow. The actual `STATE.md` file view showed formatted content
and Edit/Rename controls. Returning to the earlier conversation restored its
history, enabled composer and New conversation, and left panels closed. The
app was idle and made no model calls.

Six saved fixture folders had changed filesystem inodes at the same paths.
Root used the existing reviewed reconnection flow; all 33 fixture files kept
their exact bytes. The underlying Zo identity-change cause remains unknown.
The corrected hosted run did not repeat the earlier viewport checks; the
frontend output was unchanged. Existing-folder apply, Windows execution,
and held PR #43 remain outside this increment.

Windows CI on `32ef296` found that `DirEntry.stat()` reports a zero link
count on Windows, so exact retries were refused. The creator now uses
`os.stat(..., follow_symlinks=False)` for that metadata, as specified by the
[Python documentation](https://docs.python.org/3.13/library/os.html#os.DirEntry.stat).
The existing CLI, shared creator, and bridge suites each have a separate
Windows CI step so any failing suite fails the job. This is platform test
coverage; Windows application acceptance remains separate under issue #8.

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
