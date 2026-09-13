# 08b: Preserve project identities when merging or splitting selected work
Type: packet
Parent: 08
Status: needs-info
Depends-on: [07c, 08a]
Owner: Root-assigned project lifecycle integrator with an independent identity reviewer
Scope: Define and implement bounded merge/split plans using existing project identities, root grants, and recovery, rather than treating them as index edits alone.
Verification-kind: runtime
Needs: Root accepts 07c/08a and resolves surviving/new project IDs, authorized content movement, link conflicts, privacy inheritance, and rollback boundaries.
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

Show a concrete merge or split plan, preserve the identity and access of each
participating project, and keep the resulting projects usable after recovery.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

S3/S4 are future product requirements. Research suggestions to union or partition
indexes do not specify root access, ownership, references, or file effects.
Read the existing registry/root lifecycle contracts before selecting the smallest
supported operation. Physical moves and logical collection membership are distinct.

## Owned files

- Existing registry and root lifecycle adapters under `packages/workbench/server/`.
- Original creator/adopter helpers where a reviewed file plan needs them.
- Native merge/split preview and recovery actions and their GUI presentation.
- Focused identity/link/privacy/recovery tests for the selected operation.

## Done condition

The approved contract states which IDs survive, which new IDs appear, and how
references resolve after the operation. Display-name changes do not replace
identity. Duplicate record IDs and contradictory ownership are visible conflicts.
Only explicitly selected roots and content participate. Access is not the union
of every participant's grants or private material.

A preview shows file effects, reference changes, retained content, and project
registration changes. Apply rechecks its inputs and uses existing recovery
mechanisms across files and registry state. Repeated requests cannot create
duplicate projects. Reopen and project switching resolve the intended identities.
GUI setup and ordinary memory do not wait for this packet.

## Verify

Use two disposable projects with colliding filenames/record IDs, scoped private
material, and references across selected content. Verify both the agreed S3 merge
and S4 split, changed-input refusal, interruption/recovery, and project selection
after reopen. Keep the evidence specific to the supported operation.

```console
node --test packages/workbench/tests/project-services.test.mjs
node --test packages/workbench/tests/local-root-provider.test.mjs
python -m unittest discover -s packages/create-vivary/tests -p test_adopt.py
git diff --check
```

## Stop conditions

Do not infer identity from path strings, widen root grants, silently repair
ambiguous references, or delete source projects as cleanup. An unresolved lifecycle
choice blocks that operation. Keep strict mutation/quarantine roles closed on the
local-stat variant and select the proper authorized effect boundary.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.
