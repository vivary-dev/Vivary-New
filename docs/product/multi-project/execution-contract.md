# How agents execute the Vivary program

[ENGINEERING.md](../../../ENGINEERING.md) is the governing engineering policy.
Jeff approved it on 2026-09-12. It supersedes the former default verification
workflow, including mandatory role separation, per-run admission, proof
archives, and permanent test-attempt accounting. The optional controls now live
in [high-assurance mode](../../verification/high-assurance-mode.md).

This document owns program metadata, source ownership, and delivery details.
Older packets preserve scope and evidence. Their process instructions do not
override the engineering policy.

## One goal for all issues

The owner directed continuous work across the [36-outcome program](graph.md).
Keep all project implementation and runtime in the existing Zo checkout.
The private handoff owns its exact path. Continue through executable work
without routine phase or session confirmation. A completed packet does
not complete its parent outcome or the program.

This scope grants no paid calls, public deployment, account changes, destructive
operations, or merges. Continue independent work when one operation has a real
external prerequisite.

## Private development hosting and review direction, 2026-09-11

Use small, coherent, reviewed commits on the existing private Entire-only branch.
Review can be the implementing agent's diff inspection unless the risk warrants
another reviewer. Stage exact paths and preserve unrelated dirty work.

Keep the local Zo repository and its configured Entire-native
`entire/unmirrored/docs-context-compaction-policy` ref. Verify the remote commit
after pushing. GitHub publication and PRs retain their separate permission gate.
Private source hosting does not authorize paid plans, public visibility, or
export of old private transcripts and archives. Actual session capture needs
evidence from the Zo agent runtime.

## One current frontier

Read [the frontier](index.md) and the owning packet. Outcome and packet files own
their fields. The graph is generated from them. Use [the authority map](issue-authority.md)
for historical issue ownership, not an older release map as an execution queue.

Outcome dependencies gate completion. Packet `Depends-on` fields gate starting
the packet. Independent preparation can use completed dependencies without
claiming unfinished integration works. Repair an incorrect dependency when its
actual requirement is clear. Do not use a retired proof workflow as a substitute
for a product dependency.

## Program record format

Outcome and packet documents begin with YAML frontmatter containing
`type: outcome` or `type: packet`. Keep Status, Parent, dependency fields, and
other planning keys in the body. Do not duplicate those fields in YAML.
[24b](packets/24b-program-record-knowledge-format.md) owns the original migration.

## One reviewable iteration

Identify the observable result, implement one coherent slice, run the cheapest
useful checks, exercise the real app, fix failures, review the diff, and commit.
Then continue. Use existing tests and normal timeouts during debugging.

One writer owns each shared file. Use another agent for architecture, risky
boundaries, difficult concurrency, or a milestone review when it adds enough
confidence. Plan, Implement, QA, and Verify are not mandatory separate agents.
The implementing agent may inspect, test, fix, and retest its own work.

Use Astra for difficult decisions and Sol for bounded implementation when those
models are available. Use cheaper retrieval for narrow searches. Model choice
does not justify extra review roles or duplicate work.

## Finish without accumulating debris

Keep current scope and status in the packet, useful verification in its receipt,
and the next starting point in the existing private handoff. Update them when a
capability, contract, architecture, or lasting constraint changes. Do not record
every normal test attempt or create another handoff for each session.

Use the [source map](source-map/index.md) and existing Native owners. Reuse shared
dependencies. Stop task-owned processes and retain useful failure logs. Preserve
existing evidence until a separately authorized cleanup identifies safe targets.
Do not recursively copy old archives or prune unrelated resources.

## Status and ownership

- Outcomes use `planned`, `in-progress`, or `done`.
- Packets use `ready-for-agent`, `in-progress`, `needs-info`,
  `ready-for-human`, or `done`.
- `ready-for-agent` names a writer, known inputs, owned outputs, an observable
  result, and relevant verification.
- `needs-info` names a missing fact or external prerequisite and its owner.
- `ready-for-human` names a specific operation awaiting approval after reversible
  preparation is complete.
- `done` requires `Verification-result: passed`, a verification log, and a receipt
  with the exact outcome or packet ID in `Evidence-record`. A concise command
  and result are enough for ordinary work. Runtime claims need runtime evidence.

Keep failed and unrun checks distinct from passed checks. A policy change cannot
turn historical failure into acceptance. Do not reset another writer's changes
or run a competing push.

## Execution and verification

Use the real application composition with disposable test roots and databases,
loopback networking, and fake or disabled model providers. Prefer an application
bootstrap shared by production and tests to a separate test implementation.

Use `Verification-kind: inspection` for source-only claims and
`Verification-kind: runtime` for behavior claims. Documentation checks prove
consistency, not application behavior. Historical Habitat and Windows results
remain evidence for their original environments. Do not replay their launchers,
closed grants, or private credentials on Zo.

## Ticket quality before dispatch

Keep the current unit small enough to finish and tie it to a user capability.
Name scope, ownership, inputs, observable acceptance, relevant checks, and real
external gates. A future output file is not a missing input. Add another packet
only when it clarifies an independent unit of work.

## Sandbox execution direction

Run project work on Zo. Use safe test dependencies and existing isolation when
the operation needs it. Ordinary timeout and owned cleanup handling is enough
for normal tests. Named dangerous work can invoke selected high-assurance
controls. Historical environment-specific profiles remain attached to their runs.

## Gates and release truth

Routine implementation, tests, retries, reviews, and documentation are authorized.
Account changes, paid usage, publication, scheduled activation, outbound messages,
destructive operations, production releases, and merges retain specific authority.
Complete reversible preparation before requesting a gated action.

Keep Native defaults and existing product ownership. Consult [the Native owner
inventory](native-owners.md) before adding another registry, queue, transcript
store, scheduler, or model loop. Source versions and mock services do not prove
publication, production readiness, or the remaining scanner release requirement.

## Resource-first continuation and plan changes

Check the live checkout and preserve existing work when resuming. Before unusually
heavy work, inspect available memory, disk, and included usage. Keep one heavy
job active, bound runaway work, and clean up owned children. Unknown readings
are not measurements. Respect existing usage limits and specific approved caps.

Normal tests may be fixed and rerun. Strict cumulative limits apply only to
expensive, destructive, externally limited, or destabilizing operations that
need them. Preserve earlier budgets as historical facts. Do not rename a legacy
proof job to evade its approved limit.

Record material product or authority decisions in their existing owner. Choose
routine reversible methods without requesting another phase approval. Prefer
simpler verification when it catches the same concrete failure.

## Required step: Reconcile documentation

Keep durable claims accurate when behavior, architecture, contracts, or lasting
constraints change. Update the affected source owner and generated views when
their inputs change. Before a milestone handoff, correct stale current-state
claims and name remaining limitations. Ordinary edits do not require a separate
documentation reviewer, evidence export, or checkpoint ceremony.

## Maintaining the graph

After changing outcome or packet metadata, run the existing relevant checks:

```console
python scripts/check_multi_project_plan.py --render
python scripts/check_multi_project_plan.py --check
python scripts/check_line_endings.py
git diff --check
```

The renderer updates the frontier and full graph. A passing planning check does
not establish the feature's definition of done.
