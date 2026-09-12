# 06f: Integrate the working Workbench into canonical Vivary
Type: packet
Parent: 06
Status: in-progress
Depends-on: [03c, 12h]
Owner: Coordinating Codex, sole integration writer; independent boundary reviewer
Scope: Finish the Workbench on feat/vivary-gui. Make the working agent surface locally usable, begin desktop packaging under outcome 23, then connect the remaining project workflows. Zo is the development/preview host only. Dev promotion requires Jeff's explicit product acceptance.
Verification-kind: runtime
Timebox: One coherent application increment per reviewed PR; use existing checks and the real application.

## Current increment

Jeff corrected delivery on 2026-09-12: show the GUI on its own branch, then
returned execution to Zo and requested a private web service with model trials.
The local layout was shown; a working tool loop was not established there.
The private Zo preview now passes actual Sonnet file creation/readback, a Fable
follow-up, Opus cancellation, idle restart persistence, and active-run shutdown. It uses Native's
Claude file tools, model selection, transcript history, and file inspection.
Self-hosted access opens without login or signup. Jeff explicitly prioritized
local desktop delivery: Zo is the development/preview host, not a product
dependency. The next increments are the local desktop entry point and
selected-project agent work. Reuse the original Vivary context and authority owners.
Test each completed capability through the normal app, fix failures, then move
to the next product gap. Preserve prior failed evidence and budgets. No further
merge into `dev` is authorized until Jeff explicitly accepts the product.

This increment does not accept shell execution, multi-user access, full factory
orchestration, persistent project-root recovery, or the remaining outcomes.

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
or revoked access clears stale project state. Shutdown cleans up the owned provider.
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
