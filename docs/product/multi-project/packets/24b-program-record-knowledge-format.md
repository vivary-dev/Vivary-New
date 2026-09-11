---
type: packet
---
# 24b: Enforce typed program records without changing graph meaning
Parent: 24
Status: done
Depends-on: [24a]
Owner: Astra plans and accepts; Sol implements; independent QA reviews the changed source and tests.
Scope: Required YAML type for current program ticket and packet records, canonical parsing, and reuse by the preserved status/index renderer. No contract-body migration, general workspace conversion, search installation or product learning activation.
Verification-kind: inspection
Verification-result: passed
Evidence: [Knowledge-format receipt](../receipts/24b-program-record-knowledge-format.md)
Timebox: One parser and record migration with focused fixtures, generated parity, independent QA and documentation reconciliation.

## Current progress

Accepted 2026-09-10. All 80 current outcome and packet records have their sole
type in YAML. The canonical parser reuses Tropo and rejects invalid types and
competing body-owned YAML keys while preserving unknown custom metadata.
The preserved renderer validates and hashes one guarded record snapshot.
The developer's 83 planning tests and four renderer tests passed. Independent
QA accepted collision handling and the final size/mutation regressions. Lead
verification confirmed the 80-record semantic and graph/index byte parity before
these completion metadata updates. The receipt owns evidence and remaining scope.

## Goal

Use the required Open Knowledge Format type convention in the program's own
managed ticket and packet records. Preserve every status, dependency, evidence
reference and body. Reject invalid metadata before producing the work frontier.

## Context

The owner requested normal-work knowledge and graph enforcement on 2026-09-10.
Read the [direction](../design.md#knowledge-retrieval-and-learning-enforcement-2026-09-10),
[execution contract](../execution-contract.md) and accepted [24a](24a-source-module-navigation.md).
Reuse Tropo's frontmatter parser. This bounded class is not a claim that the
whole repository conforms to OKF. Frozen 06e/17b contracts retain their bytes.

## Owned files

- Canonical `scripts/check_multi_project_plan.py` and `scripts/tests/test_multi_project_plan.py`.
- Current Markdown records in `docs/product/multi-project/tickets/` and `packets/`.
- Preserved `scripts/render-handoff-index.py` and its focused renderer test.
- This packet and receipt, parent outcome's progress note, and existing generated views.
- A private rerunnable migration/check tool and preimages for exact semantic comparison.

## Done condition

Every current outcome and packet declares its sole type in YAML frontmatter.
Status, Parent, Depends-on, Blocked-by and other planning fields remain in their
existing body dialect. No type is duplicated in the body. Unknown custom YAML
fields remain readable and are not rejected merely because they are unknown.
Reject malformed/nonmapping/duplicate metadata, missing or non-string type,
wrong type for the declared record class, and a competing body type declaration.
The explicit local schema may constrain this record class more than generic OKF.

Canonical graph/index meaning and bytes match the same pre-migration records.
The preserved status/index renderer uses the canonical parser, so it cannot
silently accept metadata that the frontier rejects. Receipt and external-gate
body parsers remain compatible. Independent QA accepts adversarial fixtures,
all existing plan tests, generated outputs and checkpoint reconciliation.

## Verify

```console
python scripts/tests/test_multi_project_plan.py
python scripts/check_multi_project_plan.py --render
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
```

Run the existing planning test suite and focused preserved renderer tests.
Check valid type, missing/unclosed/nonmapping/duplicate frontmatter, conflicting
or same-value body type, non-string/wrong type, unknown custom fields, heading
placement and semantic/byte parity. Run canonical planning and source-navigation
checks, then preserved complete index, plan/PRD, HTML and readiness checks.

## Stop conditions

Stop this migration on unexplained source drift, changed graph semantics or any
need to edit a frozen contract. Preserve failed results. No runtime, model call,
new dependency, public action or deletion of historical evidence is authorized.

## Log

- 2026-09-10: Claimed this bounded implementation under the owner's knowledge-format direction. The preceding documentation reconciliation passed readiness, complete index, plan/PRD and HTML checks. Product outcome 24 remains open.

- 2026-09-10: Accepted the migration and reader fixes after independent QA. The original graph meaning and body content were unchanged by migration. This completion update changes packet status deliberately; broader knowledge classes and installed-product acceptance remain open.
