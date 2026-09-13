# Vivary agent instructions

## GUI branch acceptance

Jeff corrected delivery on 2026-09-12: keep new Vivary product work on
`feat/vivary-gui`. Do not merge it into `dev` until Jeff has used the GUI,
seen the real agent loop and tool results, and explicitly approved promotion.
The local preview was shown. Jeff then returned execution to Zo and authorized
a private hosted GUI service and model trials on 2026-09-12. Preserve the local
preview, Zo source, and existing evidence.
Working components and passing tests do not establish a finished product.
Vivary is a local desktop product. Zo is the current development and preview
host, not a product dependency or a required deployment destination. Prioritize
the installable desktop path from outcome 23 alongside the working agent slice.
Users must be able to open Vivary and use their own local files and CLI models
without a Vivary account, Zo account, or cloud control plane.
Jeff confirmed self-hosted installation must not require login or signup. Private hosted
access and model sign-in must work reliably. Reuse the original Vivary contracts
and any relevant existing Paperclip integration; do not create a replacement
agent system merely to connect the GUI.

Read [ENGINEERING.md](ENGINEERING.md). It is the governing engineering policy.
Older packet and runtime instructions cannot restore heavier process defaults.

## Team and visual testing

Jeff clarified on 2026-09-12: use up to three concurrent subagents as useful for
implementation, research, independent review, and documentation. Keep one owner
per shared file and coordinate through the primary agent. Keep one heavy build,
browser, or model job active at a time.

Jeff clarified the testing sequence on 2026-09-13: implement on Zo and test the
latest application changes through the existing private hosted Zo version first.
Then build Electron packages for further local testing on his laptop. This
replaces the earlier blanket restriction of all runtime testing to Zo. See the
[testing decision](docs/product/multi-project/design.md#hosted-and-desktop-testing-decision-2026-09-13).

Exercise completed UI flows extensively: real desktop and narrow layouts,
keyboard interactions, empty/error states, navigation, persistence, and actual
tool results. Fix a failure and repeat the affected journey. Then continue the
product work. Do not turn visual testing into new verification infrastructure,
repeat unrelated checks, or change historical evidence and budgets.

Self-hosted Vivary does not require login or signup. Local access stays on loopback.
The private Zo service uses Zo's existing owner-login boundary and must stay
private. Internal Native session identity still scopes actions and records.
Model-provider login remains separate from access to Vivary.

## Start with the product

Read [the current frontier](docs/product/multi-project/index.md) and the owning
packet. [The execution contract](docs/product/multi-project/execution-contract.md)
owns program metadata and delivery details. Choose the next observable user
capability and implement one coherent slice through the real application.

Use the workspace and execution environment authorized for the task. Reuse the
current checkout and handoff when provided. Inspect live Git and preserve dirty
work before editing. Keep one writer per shared file.

Use existing implementations and tests. Run the cheapest relevant checks,
exercise the actual application, fix failures, and review the diff.
Use another reviewer when the risk or complexity warrants it.

Before unusually heavy work, check memory and disk. Keep one heavy job active,
bound runaway processes, and clean up task-owned servers, browsers, and children.
Normal tests need ordinary timeouts and cleanup.

Invoke [high-assurance mode](docs/verification/high-assurance-mode.md) only for a
named dangerous failure. Select controls for that risk.

## Delivery and authority

Follow [CONTRIBUTING.md](CONTRIBUTING.md). Branch from current remote `dev`,
use a typed topic branch, and integrate through a PR with the required CI and
review gates. Never push directly to protected `dev` or legacy `prod`.

Make small, coherent, reviewed commits. Preserve unrelated work, accepted
evidence, and historical budgets. Keep private handoffs, credentials, transcripts,
and machine-specific continuity notes outside public source and Git history.
Private source hosting does not establish agent-session capture.

Use the user's existing authorization. Complete reversible preparation before
requesting any missing approval for pushes, PR creation, merges, publication,
account changes, paid calls, scheduled activation, outbound messages, or
destructive actions.
A material scope or authority change needs alignment before that action.
Do not modify the read-only source repositories loam, braincheck, throughline,
or flywheel.

Follow [the release workflow](docs/RELEASE-WORKFLOW.md) when release operations
apply. Source implementation and passing tests do not establish publication.
[README.md](README.md#release-status) owns shipped behavior.

## Keep knowledge useful

Use the [source map](docs/product/multi-project/source-map/index.md) when work
crosses project identity, root custody, runtime, or project writes.
Read [the architecture](docs/ARCHITECTURE.md) when a design decision needs it.
Reuse existing Native owners and installed dependencies. Review relevant
deny-lists and advisories before adding packages.

Update durable docs when behavior, architecture, contracts, or lasting
constraints change. Give each fact one owner and refresh generated views when
their inputs change. Keep the existing handoff concise. Failed or unrun
verification remains incomplete regardless of a policy change.
