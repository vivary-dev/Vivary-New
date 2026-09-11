---
type: packet
---
# 12f: Map application VCS references through the Native registry boundary

Parent: 12
Status: done
Depends-on: [12e, 03c, 06d]
Owner: Astra vcs_evidence_review writes staged inspection outputs; Astra record_decisions independently reviews; lead owns canonical changes and acceptance.
Scope: Inspect and map the existing application identity, private root-provider, and Native registry seams. Contract and evidence only; no implementation or runtime.
Verification-kind: inspection
Verification-result: passed
Evidence: [12f inspection receipt](../receipts/12f-native-vcs-mapping.md)
Timebox: One bounded seam inventory, decision table, independent trace, and next implementation packet proposal.

## Goal

Identify the smallest change that could carry 12e's accepted application
repository and checkout references into the existing Native registry composition
while preserving current live custody, authorization, replay, and refusal rules.
Record exact existing seams and exact gaps. Do not invent framework APIs or
implement that change in this packet.

The application UUIDs name records. They do not prove physical identity after
restart, grant root access, select a mutation capability, or fence a Git process.

## Context

Verify the canonical packet headers and receipts before claiming:

- [12e](12e-vcs-identity-lifecycle.md) is done/passed and owns application VCS
  references, v2 records, full live custody comparison, and inert migration.
- [03c](03c-registry-transaction-mapping.md) is done/passed and owns the existing
  transaction map and source-inspection method.
- [06d](06d-native-root-registration.md) is done/passed and owns the accepted
  no-VCS Python/Node provider-to-Native-registration boundary being mapped.

06d is an explicit additional start gate because this inspection consumes its
accepted integration as a baseline. 04d and 06e are not inputs required to finish
this packet. Their unfinished work cannot be accepted or changed here.
Outcome 12's completion dependencies remain unchanged under the
[execution contract](../execution-contract.md).

Use the canonical Vivary checkout named by the existing private handoff for
contracts and accepted source. Use the preserved Littleagent checkout only for
version-matched installed Native package evidence. Resolve those roots from the
handoff and record their current Git revisions and relevant dirty files. Do not
create another checkout or copy the application. This inspection needs no Habitat
session, live project observation, provider process, or database.

## Read conditions and existing inputs

Start at the root instructions, [execution contract](../execution-contract.md),
outcome [12](../tickets/12-implement-vcs-identity-adapters.md), and
[source map](../source-map/index.md). Follow only the rows needed below.

| Read when | Owner and exact input | Question to resolve |
| --- | --- | --- |
| Establishing accepted identity behavior | 12e packet and receipt; `packages/core/vivary_core/root_identity_lifecycle.py`; its `test_root_vcs_identity_lifecycle.py` and existing lifecycle/read tests | Which persisted and live fields carry application IDs, which evidence stays private, and when does custody permanently refuse? |
| Resolving a physical-identity detail absent from 12e | `packages/core/vivary_core/physical_observe.py`, `registry_observe.py`, and their focused tests; accepted 12b/12c receipts | Is a value observer-lifetime physical evidence, an application reference, or a content revision? Stop when that distinction is established. |
| Following the accepted registration boundary | 06d packet and receipt; `packages/core/vivary_core/root_provider_stdio.py`; `packages/workbench/server/root-provider.mjs`, `native-registry.mjs`, and their focused tests | Where are live lifecycle results projected, bounded, validated, or refused before registration? What accepted no-VCS behavior must survive? |
| Following durable binding and replay | `contracts/project-registry.md`, especially Records and trust, R4-R5, R7-R10 and validation order; `contracts/project-registry-transaction-map.md`; Workbench `registry-store.mjs`, `registry-actions.mjs`, `registry-http.mjs`, and their focused tests | Which trusted fields reach binding storage and receipts, in which transaction, and how does current authorization precede replay? |
| Resolving topology or mutation limits | `contracts/root-vcs-observation.md`; registry R11-R13; accepted 12e receipt Remaining work | Which equality relationships are proven, and which key, overlap, lifetime, platform, or effect claims remain unavailable? |
| Naming a Native capability | `native-owners.md`; the installed `node_modules/@agent-native/core/package.json` and docs `AGENTS.md`; only relevant version-matched docs, public exports, declarations and implementation | Does a supported callable seam exist, and what does it actually own? Documentation or an internal function alone is not proof of a public API. |

Read package/app/shared instructions before entering their source. Start from
`packages/core/README.md` and `packages/workbench/README.md` for current source
ownership. For preserved app source, read its app and shared instructions first;
open it only if an already identified seam requires that evidence. Do not survey
all Native internals, runtime start code, the GUI, or unrelated application routes.

06e may have changed a shared input. Record its exact working bytes separately
from accepted baseline bytes, without reverting them or treating its behavior as
accepted. Use the accepted revision or verified evidence source for conclusions
that need the 06d baseline. If unavailable, name that precise missing input and
continue independent mapping rows.

## Owned files

All output paths below are relative to the canonical Vivary checkout. The
writer stages reviewed replacements in the existing private continuation scratch;
only the lead applies canonical changes after checking exact preimages.

The assigned inspection writer owns only:

- `docs/product/multi-project/contracts/project-registry-transaction-map.md`:
  add one bounded Native VCS-reference integration section and its expected-case
  table. Update only directly superseded gap text, with accepted evidence links;
  preserve unrelated 03c history and transaction requirements.
- `docs/product/multi-project/receipts/12f-native-vcs-mapping.md`: source ledger,
  version/hash evidence, review results, limitations, and successor prerequisite.

The lead owns the canonical 12f packet and log, outcome 12's next-packet pointer,
the generated frontier and graph, and the existing private handoff. The lead may
update only the current integration-gap paragraphs in the root-observation and
project-registry source-map indexes when the completed map warrants it. Preserve
their typed ownership edges. Coordinate these shared files serially.

Prepare one private successor packet proposal in the existing continuation
scratch directory. The lead chooses its ID and claims it only after reviewing
the completed map. Its proposal is not an executable assignment or acceptance.

You are not alone in the codebase. Other writers own 04d, 06e and 20f. Do not
edit or revert their work. No implementation source, tests, schema, framework
package, application UI, or existing observation-fixture file is owned here.

## Required map

1. Trace application root, repository and checkout IDs, VCS kind, mutation-owner
   label, content revision, locator, policy and binding revision from trusted
   construction through Python stdio, Node validation, registry resolution,
   durable binding/receipt, replay, and public projection. Each row identifies
   the producer, consumer, exact field/shape, current disposition, source locator,
   and accepted evidence or explicit gap. Separate persisted application IDs
   from descriptor/capture identities that must never become durable authority.
2. State whether each hop can already preserve a verified Git reference, rejects
   it intentionally, drops information, or requires an unimplemented seam. Cite
   current code and its accepted baseline. Do not presume that 12e's new fields
   traverse 06d, or replace an explicit refusal with invented support.
3. Map the existing trust and transaction boundaries: fixed provider
   configuration, complete locator inventory, current Native membership and app
   capability, provider liveness/custody, field validation, registry unique keys,
   binding persistence, receipt replay and portable export. Preserve R9 replay
   ordering and all-or-none existing registration transactions. Do not expand
   registration into rebind or mutation implementation.
4. Identify any conflict between the registry's verified VCS vocabulary and
   12e's inert persisted references. Distinguish a requirement from its measured
   implementation coverage. Shared application UUIDs are neither physical
   continuity proof nor sufficient cross-process reservation keys.
5. For each gap, name its current outcome/module owner, exact missing evidence,
   and smallest compatible implementation seam. Reuse existing provider, action,
   storage, receipt, authorization, and Native owners. Do not propose a second
   identity registry, connection store, task store, scheduler, or model loop.

Put expected scenarios in the map itself; do not create a parallel oracle or
test harness. Include no-VCS, ordinary Git, aliases, nested monorepo roots,
linked worktrees, equal-content independent repositories, dirty/detached state,
replaced private/common Git administration, provider exit or restart, inert v1
migration/unresolved records, revoked scope or capability, replay after changed
binding/VCS identity, forged caller IDs, and unsupported Windows/Jujutsu layouts.
For each, state the required identity relationship, the current boundary that
accepts or refuses it, the exact existing refusal code where source establishes
one, and the later runtime evidence needed. Where no current end-to-end result
exists, record that gap rather than inventing a public code. Every scenario has
zero executed effects in this inspection.

## Done condition

1. Every mapped ID and authority fact has one existing owner and a trace through
   each relevant boundary, or a specifically located gap. No path, remote URL,
   branch, commit, serialized flag, or application UUID becomes custody proof.
2. The receipt records installed Core version, relevant public export evidence,
   accepted source revisions/hashes, dirty-input distinctions, commands and
   searched scope. Negative findings state exactly what was inspected.
3. The expected-case table separates accepted 12e physical/lifecycle evidence,
   accepted 06d no-VCS integration evidence, source conclusions, unexecuted
   expectations, and open runtime acceptance. No-VCS support remains independent.
4. An independent reader traces at least one no-VCS success, a Git integration
   gap, linked-worktree sharing, a custody-loss refusal, and a replay or scope
   refusal through the actual cited sources. Correct every actionable finding
   before acceptance; record review results in the receipt.
5. A single bounded implementation successor names exact files, prerequisites,
   supported cases, negative cases and proposed proof environment. It does not
   implement APIs, claim itself ready, or close 04d/06e. Missing facts remain
   owned prerequisites, not a blanket halt of the program.
6. Documentation checks pass and the lead records `Verification-result: passed`
   only for this inspection. Outcome 12, Native Git enablement, Windows/Jujutsu,
   restart reconciliation, mutation serialization and release coverage stay open.

## Verify

Use bounded `rg` searches, source reads, `git show`/diff inspection and SHA-256
hashes. Do not import product modules or invoke their CLIs. Record exact searches
and relevant excerpts in the receipt without copying full framework files.

After the lead serializes canonical metadata and output changes, run from the
verified canonical root:

```console
python -B scripts/check_multi_project_plan.py --render
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

The lead owns generated changes; coordinate before rendering. Verify all new
links and cited line locations against the recorded source bytes. These checks
prove document consistency only. No product/runtime tests or Native doctor run
are needed to establish this packet's source-only claim.

## Stop conditions

No product implementation, schema/migration change, framework patch or API
addition, dependency installation, provider start, database opening, project/Git
probe, Habitat dispatch, model call, GUI/browser action, live gate change,
credential/account action, scheduled activation, publication, push, or merge.
Do not enable Git, Jujutsu, runtime start, write-back, reservations or fencing.

If a required accepted source cannot be located or a shared output has an active
writer, report the exact file and owner; continue independent read-only rows.
Do not take over the file. An absent callable Native seam is an inspection
result, not permission to invent or implement it.

Reuse the existing ticket scratch location if temporary notes are needed. Create
no server, container, dependency tree or new handoff. The receipt records any
retained private draft and its retirement condition; otherwise cleanup consists
only of confirming no runtime resources were created. Leave destructive cleanup
to the lead's existing exact-path authority.

## Log

- 2026-09-08: Lead verified 12e,03c and06d acceptance, then claimed this independent source inspection. It does not depend on unfinished04d or06e acceptance. One staged inspection writer and separate acceptance reviewer own bounded output; no product files or runtime behavior may change.

- 2026-09-08: Accepted source inspection after independent review of all 33 source hashes, five traces and the final 39-entry archive. Canonical planning, navigation, line-ending and diff checks passed. The [receipt](../receipts/12f-native-vcs-mapping.md) owns evidence. No runtime behavior or parent outcome accepted. Reviewed [03d](03d-vcs-replay-consistency.md) owns the replay prerequisite before Git forwarding.
