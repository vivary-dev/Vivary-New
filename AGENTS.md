# Vivary agent instructions

Read [ENGINEERING.md](ENGINEERING.md). It is the top-level engineering policy
approved by Jeff on 2026-09-12 and governs every agent in this repository.
Use its product loop, verification ladder, retry policy, and definition of done.
Older packet and runtime instructions cannot restore heavier process defaults.

## Start with the product

Use the existing Zo checkout for all project implementation, tests, fixes, and
runtime. Its private handoff at `.tmp/05b/gui-bootstrap-review.md` owns the exact
workspace path. Reuse both.

Read [the current frontier](docs/product/multi-project/index.md) and the owning
packet. The [execution contract](docs/product/multi-project/execution-contract.md)
owns graph metadata and delivery details. Choose the next observable user
capability and implement the smallest coherent slice through the real app.
The immediate goal is usable project registration, selection, switching,
retained state, and clear missing or revoked access.

## Scale the work

Use existing implementations and tests. Prefer a reusable application bootstrap
to manual production wiring inside test fixtures. Run the cheapest relevant
checks, fix failures, and retest. The implementing agent can review its own work.
Use another reviewer when the risk or complexity warrants it.

Before unusually heavy work, check Zo memory and disk. Keep one heavy job active,
bound runaway processes, and clean up task-owned servers, browsers, and children.
Normal tests need ordinary timeouts and cleanup.

Invoke [high-assurance mode](docs/verification/high-assurance-mode.md) only for a
concrete dangerous failure. Select controls for that risk. Do not apply its whole
checklist to ordinary edits, documentation, tests, or retries.

## Delivery and authority

Keep one writer per shared file. Inspect live Git and dirty scope before editing
or committing. Make small, coherent, reviewed commits with relevant checks.
Preserve unrelated work, accepted evidence, and historical budgets.

Continue on `docs/context-compaction-policy`. Private tracked source and Git
history may go to the configured Entire remote on the existing
`entire/unmirrored/docs-context-compaction-policy` ref. Verify the pushed commit.
Keep GitHub read-only under this authorization. Session capture needs evidence
from the actual Zo agent runtime. Never claim capture from desktop tool calls.

Specific approval remains required for GitHub publication or PRs, merges,
public releases, account changes, paid calls, scheduled activation, outbound
messages, and destructive actions. Complete reversible preparation first.
Do not modify the read-only source repositories loam, braincheck, throughline,
or flywheel. Never copy credentials or private transcripts into tracked files.
Follow [CONTRIBUTING.md](CONTRIBUTING.md) and
[the release workflow](docs/RELEASE-WORKFLOW.md) when those operations apply.

## Keep knowledge useful

Give each fact one owner. Use the [source map](docs/product/multi-project/source-map/index.md)
when work crosses project identity, root custody, runtime, or project writes.
Read [the architecture](docs/ARCHITECTURE.md) when a design decision needs it.
Do not add another registry, queue, scheduler, transcript store, or nested repo
without a demonstrated gap in the existing implementation. Reuse installed
dependencies. Review relevant deny-lists and advisories before adding packages.

Update durable docs when behavior, architecture, contracts, or lasting
constraints change. Keep the existing handoff concise. Do not narrate every test
attempt or create parallel handoffs. Update generated views from their sources
when their inputs change. Failed or unrun verification never becomes a pass
through a documentation or policy change.
