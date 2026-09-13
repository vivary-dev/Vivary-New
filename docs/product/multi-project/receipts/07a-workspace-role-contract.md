# Workspace role contract verification

Evidence-record: 07a
Date: 2026-09-13
Verification-kind: inspection
Result: passed

The existing thin renderer writes optional `workspace.patterns` and
`workspace.roles`. Tropo resolves them once through its configuration reader.
Doctor JSON exposes the effective assignments. The four presets retain the
five-file base, and old configurations infer the same `thin-context` assignments.

Adoption preserves custom metadata, unrelated TOML, and authored `STATE.md`.
Empty assignments cannot disable required files or privacy exclusions.
Assignments describe exact relative paths without reading files or granting
access. Only the existing `thin-context` pattern is supported in this increment.

## Verification log

All commands ran on Zo with the existing dependencies and temporary test roots.

| Command | Result |
| --- | --- |
| `python3 -B packages/tropo/tests/test_tropo.py` | 203/203 passed |
| `python3 -B packages/create-vivary/tests/test_create_vivary.py` | Exit 0 |
| `python3 -B packages/create-vivary/tests/test_adopt.py` | 20 passed |
| `python3 -B packages/create-vivary/tests/test_init_thin.py` | 16 passed after the review correction |
| `python3 -B packages/create-vivary/tests/test_assets_parity.py` | 5/5 passed |
| `npm --prefix site run sync-docs` | Passed |
| `npm --prefix site run build` | 33 pages built |
| `git diff --check` | Passed |

Independent source review found that wildcard rejection also rejected literal
square brackets. The resolver now accepts bracketed filenames. The existing
adoption test preserves `notes/[Q3] review.md` through configuration loading and
apply. Review confirmed the correction and found no other source blocker.

## Acceptance boundary

This accepts compatible configuration metadata only. It does not establish GUI
creation, preset reconfiguration, generated state, memory loading, or a package
release. Packet 07b owns the next shared GUI/CLI content-plan operation.
Existing hosted auth work, preview runtime, retained 06e evidence, and historical
budgets remain outside this increment.
