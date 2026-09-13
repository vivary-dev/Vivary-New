# 07a: Describe workspace roles and patterns without changing files
Type: packet
Parent: 07
Status: in-progress
Depends-on: []
Owner: runtime_setup, coordinated by root, sole source writer
Scope: Add optional descriptive role and pattern metadata to the existing workspace contract. Preserve the four preset aliases and the actual five-file base.
Verification-kind: inspection
Timebox: One additive source increment with focused compatibility checks and independent review.

## Goal

Let later setup plans describe how existing files serve the workspace without
requiring a fixed layout or changing what an existing project contains.
This is compatible preparation under outcome 07, not completed GUI creation.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the
[setup direction](../design.md#workspace-setup-direction-2026-09-13), the
[original source map](../research/original-vivary-product-map.md), and the
[file-memory comparison](../research/file-memory-and-persistence.md).
Use the existing thin renderer and workspace configuration reader. Root owns
program reconciliation and delivery. Other agents must not edit the same source.

The research vocabulary is descriptive. It does not establish universal required
roles or approve the embedded D1-D5 proposals. Read old configurations without
requiring a migration. Missing optional metadata must have a defined result.

## Owned files

- The thin renderer and existing configuration helpers in
  `packages/create-vivary/create_vivary.py`.
- The existing workspace configuration reader used by Tropo, only where the
  additive metadata requires compatibility handling. Coordinate any shared file
  ownership with root before editing it.
- Existing focused thin-initialization and configuration tests, beginning at
  `packages/create-vivary/tests/test_init_thin.py`.
- This packet's implementation notes. Root reconciles generated plan views.

## Done condition

Optional roles and patterns can be represented and read without changing the
meaning of existing fields. The four aliases remain `coding`, `second-brain`,
`knowledge-work`, and `writing`. Each describes the files the current thin
renderer actually creates: `AGENTS.md`, `STATE.md`, `.gitignore`,
`.vivary/context.md`, and `.vivary/workspace.toml`.

Do not invent a generated map, owner-memory file, records, skills, or an active
maintenance loop when those artifacts are absent. Represent absent roles
explicitly. Multiple roles may reference one existing file when accurate.
Paths are descriptions, never filesystem grants, root identities, or executable
commands. Existing authorized root resolution still controls all access.

Old configurations remain readable and retain their preset, state, privacy,
runtime, and projection behavior. Ordinary initialization still creates the
five-file base only. `STATE.md` keeps its existing owner and authored content.
No role-assignment metadata claims full reconfiguration scenario S1.

## Verify

Use the existing focused tests for old configuration loading, the four aliases,
optional metadata, absent roles, and unchanged file inventory. Check malformed
metadata at its configuration boundary. Do not add a second contract parser.

```console
python3 -B packages/create-vivary/tests/test_init_thin.py
git diff --check
```

Record the actual command and result. Source review and unit checks do not
establish Create/Adopt, memory recall, or any new GUI workflow.

## Stop conditions

Stop only an incompatible configuration change or conflicting file edit and
resolve it with root. Do not generate `STATE.md`, create new memory files,
install a CLI or backend, expand access, change auth, or activate the held
external template program. Routine additive representation choices belong to
the writer and reviewer within this scope.

## Log

- 2026-09-13: Opened as the first bounded increment of the combined plan.
  Implementation is assigned to runtime_setup. Verification remains pending.
