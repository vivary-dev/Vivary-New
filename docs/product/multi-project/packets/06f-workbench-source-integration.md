# 06f: Integrate the working Workbench into canonical Vivary
Type: packet
Parent: 06
Status: needs-info
Depends-on: [06g, 04a, 07d]
Owner: Coordinating Codex, sole integration writer; independent boundary reviewer
Scope: Finish the Workbench in private Vivary-New through typed topic PRs into dev. Make the working agent surface locally usable, begin desktop packaging under outcome 23, then connect the remaining project workflows. Zo is the development/preview host only. Main promotion requires Jeff's explicit product acceptance.
Verification-kind: runtime
Needs: 06g, 04a, and 07d complete the remaining application integration. Follow the desktop release queue rather than this umbrella packet.
Timebox: One coherent application increment per reviewed PR; use existing checks and the real application.

## Current increment

Follow the [desktop release queue](../desktop-release.md) for executable work.
This packet retains the integration acceptance contract and earlier evidence.

The current source-recovery task runs in private Vivary-New on
`feat/salvage-reconcile`, with a review PR into `dev` under Jeff's later
2026-09-13 instruction to consolidate useful work toward the desktop product. The existing GUI remains the application surface.
The [50-commit salvage receipt](../receipts/salvage-handoff-2026-09-12.md)
records the recovered thin-workspace preview API, skipped guarded-creation
provider, and remaining acceptance failures. This does not promote outcome 06
or complete GUI workspace creation. Earlier application evidence follows.

Jeff corrected delivery on 2026-09-12: show the GUI on its own branch, then
returned execution to Zo and requested a private web service with model trials.
The working private branch now composes Native's shell, rich composer, history,
Settings, provider controls, CLI readiness, and Code executor. The Linux desktop
has passed system-folder registration, project switching, separate drafts and
history, a real selected-project Claude file change, file inspection, and
reopening with the selected project, transcript, and appearance intact.

The active-run control remains available in Settings and when a selected folder
disappears. An actual cancellation check passed with that folder missing, then
restored its paused Native conversation when the folder returned. Missing access
does not silently select the Personal workspace. Source review, focused tests,
typechecking, build, Native Doctor, and program/navigation checks passed.

Native's unsent text draft cache uses browser storage. Project switches and
navigation preserve drafts; a desktop restart with a different loopback port
does not yet restore them. Windows/macOS execution, provider-backed Full chat
trials, relocated-folder recovery, and the governed multi-stage workflow remain
open. A Windows portable artifact does not establish Windows execution.

Zo remains the authorized development and private-preview host. The product is
local and requires no Vivary signup or login. Jeff authorized consolidation
into `dev`. Promotion to `main` requires acceptance of the delivered milestone.

For later increments, follow the [2026-09-13 testing decision](../design.md#hosted-and-desktop-testing-decision-2026-09-13):
implement and test the latest changes on the private hosted Zo app first. Then
build Electron packages for further local testing on Jeff's laptop. Keep hosted
workflow results separate from desktop platform acceptance.

This increment does not accept shell execution, multi-user access, full factory
orchestration, persistent project-root recovery, or the remaining outcomes.

The [original Vivary study](../research/original-vivary-product-map.md) identifies
the next integration work: built-in presets, creation/adoption, full file access,
and the original context/review contracts. Folder registration does not create
or adopt a Vivary project. The desktop package also needs the original Python
package closure for those capabilities to work outside the source checkout.

## Goal

Run the Workbench from canonical Vivary source, register two disposable projects,
switch between them, and retain the selected project after a browser refresh.

## Context

Read [the engineering policy](../../../../ENGINEERING.md),
[the current frontier](../index.md), [Native ownership](../native-owners.md),
and [12h](12h-core-root-custody-integration.md). The user authorized canonical
integration on 2026-09-12. Use the existing authorized Zo checkout and private
handoff to locate the working implementation and its accepted runtime evidence.

Keep one writer. Review the source dependency closure and copy only what the
normal app needs. Preserve private history, runtime data, transcripts, and old
verification infrastructure at their existing private locations.

## Owned files

- The required application/configuration source under `packages/workbench/`.
- Required changes to the existing registry contract model and its focused tests.
- Existing app verification commands, relevant CI coverage, README, and outcome 06.
- A concise receipt and regenerated frontier after acceptance.

## Done condition

The canonical source boots through normal startup with disposable Native identity,
SQLite, supported temporary project roots, and disabled model providers. Two
projects can register and switch; refresh restores the current selection. Missing
or revoked access clears cached authorization and file access while preserving
the blocked project/session selection, history, and drafts. Shutdown cleans up
the owned provider.
Relevant tests, actual application checks, source review, and PR CI pass.

## Verify

Use the existing package scripts after the source has been integrated:

```console
pnpm --dir packages/workbench typecheck
pnpm --dir packages/workbench test:project-services
pnpm --dir packages/workbench build
pnpm --dir packages/workbench doctor
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

Exercise the normal app through the existing concise browser journey. Keep an
ordinary command/result record. Do not recreate the retired C5 proof campaign.

## Stop conditions

Inspect source provenance and any applicable template license before publishing
copied files. Core and Toolkit package metadata declares MIT; preserve required
notices. Review the shell's recorded dependency advisories before admitting an
exposed deployment. Do not infer production readiness from the disposable setup.

Root recovery, persistent deployment storage, project mutations, paid model calls,
and activation of scheduled work remain separate requirements. Stop only the
operation whose actual prerequisite is missing and continue independent work.

## Log

- 2026-09-12: Prepared the next canonical application increment after the reviewed
  Core custody import. Existing private application behavior is the implementation
  source; its history and retained evidence remain private.
- 2026-09-13: Accepted the private Native UI and selected-project desktop
  increment. System folder selection, Alpha/Beta drafts and history, actual
  Claude file tools, global Stop during missing-folder recovery, and reopen
  persistence passed on Linux. Native Code remains the execution/record owner;
  the factory workflow and other platform execution remain unfinished.
- 2026-09-13: Studied the original CLI, thin and legacy templates, adoption,
  context, review, and coordination. Recorded the source map and missing GUI
  connections against existing outcomes. Source review only, with no additional
  runtime acceptance or changes to the external template hold.
- 2026-09-13: Jeff selected the hosted Zo app for testing latest changes,
  followed by Electron builds for further local testing on his laptop.
- 2026-09-13: Repaired hosted project loading on filesystems without creation
  times. Added a regression covering reopen, edits, replacement, and symlink
  redirection. The hosted catalog returns successfully. Restored layered dark
  surfaces and bright green actions, with light and alternate Native palettes
  checked in Chrome. Hosted preference and selection writes still fail because
  the proxy omits Native session cookies. An unapplied scoped auth patch awaits
  explicit user approval after automatic approval review rejected that change.
- 2026-09-13: Fixed duplicate composer focus outlines caused by the global
  focus rule overriding Native's inner editor. The hosted build and Chrome
  checks passed for text entry, one outer focus border, and keyboard traversal.
  No model call ran. The separate hosted-auth patch remains unapplied.
- 2026-09-13: Recorded useful workspace setup with composable starter content
  and independent agent guidance, runtime, and tools. Added a primary-source
  Letta Code comparison. Create/Adopt and the full workspace editor remain
  unfinished. The external template catalog hold remains unchanged.
- 2026-09-13: Compared file persistence in Letta, Claude Code, and Hermes,
  plus Git, Jujutsu, Entire, and Beads. The recommendation keeps project files
  authoritative and uses the existing Native agent with one shared GUI/CLI
  setup contract. Source review found missing APIs in the retained creation
  adapter and no explicit project-memory reload in Code follow-ups. These are
  implementation gaps, not accepted runtime behavior. No runtime or auth changed.

- 2026-09-13: Reconciled the preserved handoff line by feature in Vivary-New.
  Recovered the shared thin-workspace preview API. Skipped guarded creation
  after two custody failures. Build and hosted read/navigation checks passed,
  but full suites and hosted selection persistence remain incomplete. See the
  salvage receipt for the complete ruling table. Main remains unchanged.
- 2026-09-13: Jeff moved active development to private vivary-dev/Vivary-New
  with GitHub and Entire connected. His later correction selects typed topic
  PRs into dev and reviewed promotion to main. The existing outcome graph owns
  the combined workspace plan. Public promotion and release remain unapproved.

- 2026-09-13: Jeff authorized useful-work consolidation and selected the Windows product target. PRs #3 and #4 are integrated into dev. Scoped desktop packets now own the next work.
