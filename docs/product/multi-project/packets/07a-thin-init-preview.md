---
type: packet
---
# 07a: Preview exact thin workspace creation bytes

Parent: 07
Status: done
Depends-on: [03c, 05a, 06d]
Owner: GPT-6 lead writer; separate native composition writer reviews the diff.
Scope: Read-only exact file preview from the existing thin workspace generator.
Verification-kind: runtime
Verification-result: passed
Evidence: [07a runtime receipt](../receipts/07a-thin-init-preview.md)
Timebox: One source/API unit with focused and existing scaffolder checks in Habitat, independent review, evidence, and cleanup.

## Goal

Let a caller show the exact generated files before asking to create a blank
Vivary workspace. Reuse `scaffold_thin_workspace` generation and preserve its
existing apply and rollback behavior. No filesystem effect is authorized by
this preview or its hashes.

## Context

Read outcome 07, the design's project onboarding section, and the create-vivary
package README.

## Owned files

The lead owns `packages/create-vivary/create_vivary.py`, a new
focused test file, this packet, its receipt, and outcome 07's next-packet entry.
No Native registry, root provider, GUI, runtime, or auth module changes belong
to this unit. Reuse the existing Habitat source and installed Python/Tropo.

## Contract

Expose `plan_thin_workspace` with the existing preset, adapter, and optional
active-context inputs. Validate the target using the same read-only rules as
thin init. Return a versioned JSON-compatible plan with ordered relative file
paths, exact UTF-8 text, byte lengths, and content hashes. A portable content
digest excludes absolute target coordinates; a separate plan digest binds the
normalized target, selected options, schema, and complete preview. Timestamps
and generated random IDs do not enter either digest.

The preview describes only creates. It refuses occupied targets, invalid
options, and unsafe paths. It does not create directories, initialize VCS,
install dependencies, add templates, or invoke a model. Keep one file generator
shared by preview and existing scaffold apply so the two cannot drift.

## Done condition

1. Repeated previews are identical and leave absent and empty targets unchanged.
2. Each preview's files and bytes match actual existing scaffold output across
   supported presets/adapters and the optional active-context mode.
3. Changed target/options/content change the appropriate digest; unsafe or
   occupied targets refuse without partial output.
4. Existing scaffold behavior and checks pass. Doctor and Tropo verify actual
   generated fixtures. Real Linux symlink refusal is included.
5. Independent source/evidence review and named temporary cleanup are recorded.
   Outcome 07 stays open for bound apply, crash recovery, registration, and GUI.

## Verify

```console
python -B packages/create-vivary/tests/test_thin_init_preview.py
python -B packages/create-vivary/tests/test_create_vivary.py
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check_line_endings.py
git diff --check
```

## Stop conditions

These tests use synthetic task-owned directories in the existing Habitat.
No new development checkout, dependency install, real project mutation, model
call, credential access, publication, push, or merge is part of this packet.

## Log

- 2026-09-07: Claimed under the owner's continuous implementation authority.
  Independent design review confirmed content preview is distinct from target
  custody and effect authorization. The exact bytes retain existing ordering.

- 2026-09-07: Accepted scoped preview API after seven focused checks, 192 existing
  passes and two platform skips, independent review, archive verification and
  named cleanup. See the [receipt](../receipts/07a-thin-init-preview.md).
