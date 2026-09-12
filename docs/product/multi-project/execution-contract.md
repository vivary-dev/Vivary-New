# How agents execute the Vivary program

The 36 numbered records are product outcome contracts. Some require several
sessions. Lettered packets are bounded units of ownership and verification.
Context windows are checkpoints, not mandatory stops or fresh conversations. Completing a packet does not complete its parent outcome.

The owner's 2026-09-10 instruction requires local atomic commits. Commit one
coherent change with its tests and owning documentation, then continue. Inspect
the index before committing and stage exact paths or reviewed hunks. Separate
pre-existing work by responsibility. Local commits do not authorize push, PR,
merge, publication, or a claim that failed verification passed.

## One goal for all issues

On 2026-09-11, the owner clarified: "one goal for all issues". The active work
therefore covers every remaining issue in the [36-outcome program](graph.md),
including existing packets and defects found during implementation or review.
The owner also instructed “make sure we're coding in zo.” All current project
coding, tests, fixes and verification therefore run on Zo through its existing
connection. Each packet still requires its own verified isolation/resource
profile; this direction does not transfer or reset historical Habitat budgets.
The graph selects the current step; no individual packet is the completion
boundary. Continue through executable
dependencies after each accepted packet. Keep unresolved findings in their owning
packet or the program audit; do not omit them to close the overall goal.

This expands the work scope without granting paid calls, public deployment,
merges, account changes, or destructive operations. Complete independently
executable work while recording the exact prerequisites for gated issues.
The Codex goal tool currently retains the older 05b objective and cannot edit an
active objective. That tool limitation does not narrow this owner decision; do
not mark the overall work complete when only 05b passes.

## Private development hosting and review direction, 2026-09-11

The owner asked for atomic commits and reaffirmed fixing issues and reviewing
until no more findings remain. Keep each accepted change in a local atomic Git
commit with its tests and owning documentation. Continue independent review and
fix every remaining finding in that change before acceptance; do not claim this
proves the absence of every possible defect.

The owner then selected Entire for development hosting until the work is ready
for GitHub. Use private access and Entire-native branches under
`entire/unmirrored/` so unfinished work is not forwarded to GitHub. Retain the
local Zo Git repository. The hosting setup and session-capture compatibility
still need verification. This direction does not authorize a paid plan, public
visibility, old private transcript/archive export, or GitHub publication.

Earlier automatic approval review rejected a combined commit-and-push command
because it included a GitHub push. Local atomic commits are a separate, already
authorized operation. Keep GitHub publication separate from local commits and
from the newly requested private Entire hosting.

## One current frontier

Read [the generated graph](graph.md). Outcome and packet files own their fields.
the graph is generated and checked against them. Do not dispatch an older
GitHub release map or a local historical handoff. [The authority map](issue-authority.md)
preserves those issue histories and names their surviving responsibilities.

Outcome dependencies are completion gates, not a prohibition on independent
preparation. Packet `Depends-on` fields are start gates. Do not add a product
release, optional connector, source import, or account prerequisite to a packet
that can finish without it. For example, registry contract fixtures can be
reviewed before a database is selected. Live pod execution requires a connection.

## Program record format

Outcome and packet documents begin with YAML frontmatter containing
`type: outcome` or `type: packet`, followed by their existing H1 and body metadata.
Keep Status, Parent, dependency fields and the other planning keys in the body.
Do not repeat those keys in YAML, including case or underscore/hyphen aliases.
Unknown noncompeting YAML metadata is preserved. The canonical planning checker
uses Tropo to validate the type before rendering the frontier; the preserved
status/index renderer consumes the same validated record snapshot.

This requirement covers program outcome and packet records. It does not claim
that all repository Markdown is an OKF bundle or authorize converting frozen
contracts or existing user projects. [24b](packets/24b-program-record-knowledge-format.md)
owns the migration and its bounded acceptance.

## One reviewable iteration

The owner's [2026-09-07 execution decision](design.md#experimental-policy-and-continuous-execution-decision-2026-09-07)
authorizes continuous work through outcome 28 and its dependencies. Choose one
bounded packet, state what changes and what proves it, and check its environment.
Implement, verify, correct, obtain independent review, clean up, reconcile
documentation, and checkpoint.
Then continue the next available dependency or packet in the same conversation.
Do not request routine phase, packet, or context-window continuation. Stop only
the operation with a concrete external gate and continue independent work.

Treat hypotheses as claims to test. State the expected observable result,
choose a check that could disprove it, and record what happened. Keep a useful
baseline for comparisons. Scale evidence to the claim: source inspection,
deterministic fixtures, and live product results prove different things. Do not
present an untested idea or a native default as a measured quality improvement.

Use GPT-6 Astra for orchestration, difficult work and acceptance review; use
Sol for bounded implementation and Terra or Luna for searches and simple checks.
Choose reasoning effort to fit the task. The owner's
[resource and model decision](design.md#resource-and-model-decision-2026-09-07)
supersedes the earlier GPT-6-only assignment. Give each writer explicit ownership.
Keep shared-file edits serial and local heavy jobs to one at a time. Check RAM,
disk and included usage between waves. Defer heavy jobs when headroom is low;
continue source work and close completed processes before starting another job.
Scale checks to the change. A documentation correction does not need product
runtime tests. A runtime change needs behavior evidence from its named environment.

For current issues, assign separate agents to Plan, Implement, QA, and Verify.
The planner freezes user-visible acceptance, scope, and the sandbox profile before
the writer starts. One implementation agent owns product edits. An independent QA
agent reviews the candidate without editing product files. A separate verifier
checks raw artifacts, candidate bindings, runtime isolation, cleanup, and the
frozen acceptance criteria. The root agent orchestrates these roles and closes the
issue only after Verify passes. Rework returns to Implement, followed by fresh QA
and Verify passes.

This role contract does not describe the existing HoH workflow as a four-stage
runtime implementation. `tools/hoh/workflow.py` implements planner, developer,
and QA roles. Ozone verification remains planned in 20l. Codex agents share the
host filesystem, so role prompts are not operating-system sandboxes. Run product
runtime work only behind the verified Habitat boundaries in its packet. Full
agent-process isolation remains unproven.

The owner's 2026-09-08 laptop-resource instruction makes prompt cleanup part of
every run. Record owned processes, services, containers, and temporary paths before
launch. Keep one heavy job active, enforce its declared limits, and check host
headroom while it runs. Stop the owned job if available memory falls below the
1536 MiB reserve. A failed run needs a diagnosed cause and a reviewed correction
before retry. Do not raise memory limits to conceal a command or filesystem error.

Stop task-owned processes as soon as their step finishes. Verify their process
groups and services are absent before another heavy job. Keep one verified
evidence archive and remove authorized disposable copies.
Use packet-local scratch for test temporary directories. Pass that path explicitly
to temporary-file helpers so failed checks do not leave files in system Temp.
At the end of the batch, inventory leftovers and report anything retained. If this task started Habitat
from a verified stopped state, terminate only Habitat after a fresh inventory
proves no unrelated activity depends on it. Preserve user apps, other distributions,
and shared Docker services. Uncertain ownership blocks environment teardown,
not cleanup of known task-owned processes. Never use shared `wsl --shutdown` for
this cleanup.

## Finish without accumulating debris

Each fact has one owner: the packet holds work and status, the receipt holds
verification, and the existing private handoff holds the next starting point.
Replace stale handoff content in place. Link to decisions and receipts instead
of copying their histories. Keep the handoff near 100 lines. Do not create a
dated handoff or a second continuation prompt for each session.

Before creating a document, identify its reader, source owner, and retirement
condition. Put a correction in its existing owner when possible. Historical
assignments are optional provenance and never active instructions. Generated
HTML and site pages are views. Edit their source and regenerate the views.

Use one named scratch directory per ticket and reuse it across retries. Record
created containers, directories, servers, and caches in that ticket's receipt.
Keep one verified final evidence export and the minimum unresolved failure
evidence. After verifying the export, remove authorized disposable copies and
stopped task resources by exact identity and contained path. Report retained
resources with a reason and removal condition. Never prune unrelated resources.
Shared dependency caches have a named owner and reuse purpose, not a copy per run.

Include resource cleanup in the packet's initial authority. If that authority is
missing, prepare the exact cleanup list and request only that operation. A failed
test does not justify retaining every source copy and container indefinitely.
On close, check links, graph status, generated views, stopped processes, retained
bytes, and the next command. Leave failed product acceptance open.

Project knowledge remains plain files with stable IDs, source links, and checked
relationships. Use the existing [source map](source-map/index.md) and task graph.
Brain Open Knowledge Format owns cross-project knowledge. Do not create another
graph database or duplicate project records in Brain by default.

## Status and ownership

- Outcomes use `planned`, `in-progress`, or `done`.
- Packets use `ready-for-agent`, `in-progress`, `needs-info`,
  `ready-for-human`, or `done`.
- `ready-for-agent` means the packet has sufficient existing inputs, one named
  writer, owned outputs, observable acceptance, verification, and stop conditions.
- `needs-info` must name the exact missing fact or external prerequisite and its
  owner. It does not mean unfinished dependencies or outputs not yet created.
- `ready-for-human` names one actual operation that requires a human after the
  agent has prepared and verified everything else. PR merge approval remains
  separate from an agent's documentation or contract acceptance.
- `done` requires `Verification-result: passed`, a verification log, and a linked
  receipt whose `Evidence-record` is the exact outcome or packet ID. The structured
  result is authoritative. The log records commands, details, and relevant history,
  including earlier failures. Duplicate or ambiguous result and binding fields are
  invalid. A packet's success never automatically closes the outcome or a release gate.

Claim the lowest ready packet whose verification environment is available.
Record one writer before editing. Other agents may review, but must not edit its
owned files concurrently. Checkpoint at a context boundary or the packet's timebox: changed files,
evidence, remaining work, exact next command, and owner. Resume from that
checkpoint without requiring a fresh conversation or resetting runtime limits.
Do not reset dirty work, run a competing push, or take over another active writer.

## Execution and verification

On 2026-09-11 the owner directed all current coding to Zo. Use the existing
Zo checkout and the reviewed sandbox profile named by the active packet.
The following Habitat directions describe earlier execution; retain their
evidence and do not replay closed runs or copy private credentials.

Earlier work used the bounded Habitat development environment. The owner confirmed BrowserPod
is unavailable on 2026-09-05. See the latest answer in the design decision.
BrowserPod setup and execution are outside the active task list. Reuse the
existing Habitat checkout named in the private handoff. Verify its live path and
the packet's proof mount; Windows edits do not synchronize automatically. Transfer
reviewed task files and verify their hashes before checks. Preserve
`.claude/agents`, `.runtime-tools`, and existing dependencies. Do not create
another development checkout or worktree.
Runtime packets name the environment and require its live preflight for the exact
tools they execute. Habitat results cannot satisfy BrowserPod-specific checks. Native CLI, Python, database, persistence, and isolation support
remain separate capabilities until each is observed.

Inspection packets may read source, write contracts and fixtures, inspect diffs,
and use the existing repository CI for documentation checks. They do not need a
live pod and cannot claim runtime behavior. Record `Verification-kind: inspection`
or `Verification-kind: runtime`. A common plan-lint command proves document
consistency only. A runtime packet also needs its own failing/passing behavior
checks and observed results.

The SDK, model loop, native run/session state, resource connections, tasks,
messaging, and automations retain their existing owners. Use [the owner inventory](native-owners.md)
before adding infrastructure. New product records require a demonstrated gap.
do not create another reasoning loop, transcript store, task queue, or scheduler.

## Ticket quality before dispatch

Every packet names its parent, writer, scope, existing inputs, exact outputs,
observable acceptance, execution environment, verification, stop conditions,
and evidence destination. Future output files are created by the packet. their
absence is not a missing input. Runtime packets must include adversarial failure
cases, user-visible behavior where applicable, and recovery evidence.

Keep a bounded packet for the current frontier and prepare the next one before
closing its predecessor. Future outcomes retain their complete acceptance and
scope mapping. Do not fabricate exact APIs or make giant outcomes look like
single-session implementation tickets. A newly discovered gap repairs the owning
packet and dependency edge, with a log entry. It does not erase product scope.

For optional VCS, hosting, task-source, and Brain paths, implement and verify the
native/skip path independently. Completion of the full optional integration may
still gate release coverage. A missing connector must not disable the core path.
Behavior docs move with each feature. Outcome 24 audits the installed journey.

## Sandbox execution direction

On 2026-09-09, the owner reaffirmed sandboxed code execution, Habitat as the
working environment, and avoiding laptop performance degradation. The
[recorded answer](design.md#sandbox-execution-clarification-2026-09-09) owns this direction.
Run new application builds and tests in the verified Habitat boundary. Keep
host orchestration and source-only checks bounded. A Windows Job supplies
resource limits, not a security sandbox; it does not by itself justify running
application code on the host. Earlier Windows component proofs remain evidence
for their recorded runs, not a standing exception to the new direction.
Browser proofs must enable Chromium sandboxing and verify actual launch flags.
Those flags do not establish every operating-system sandbox policy.

## Gates and release truth

Routine in-scope design, fixture, documentation, and implementation choices are
agent work under the existing authorization. Account changes, spending, source
publication rights, destructive operations, scheduled activation, outbound email,
production release, and merges keep their specific authority requirements.
The [20a experimental policy](packets/20a-headless-loop-proof.md#usage-contract)
is approved for experimentation. Version its configurable settings and revise
them between evidence-based trials while preserving accounting and recovery.
Native compaction and response defaults remain unchanged. This authority does
not change 20b's separate policy or authorize paid usage or credential copying.
Stop only the dependent operation, continue independent packets, and name the
concrete prerequisite. Do not request blanket product reauthorization.

The real 100% scanner result remains an unmet release requirement. Neither
document checks, mock services, historical Habitat tests, nor a successful
BrowserPod Node fixture can close unrelated acceptance gates.

## Resource-first continuation and plan changes

The owner's 2026-09-10 handoff instruction requires resource discipline to survive
agent changes. Read the packet, current handoff, live checkout state and resource
readings before continuing. A prior reading never admits a new runtime job.
Missing or denied readings are unknown, not zero and not a pass.

Keep one heavy local job at a time. Before dispatch, record available RAM, commit
headroom, free disk, included usage, owned process identities and exact cleanup
paths. Check both available usage windows when the host provides them. Stop new
work at 95 percent used. Do not consume resets or schedule wakeups without authority.

The 1,536 MiB host reserve remains mandatory. Native and recovery proofs retain
their 2,560 MiB warm admission, 512 MiB Linux and 512 MiB Windows allowances.
The build retains 4 GiB warm admission, 2,048 MiB Linux and 512 MiB Windows.
The headless live gate remains 6 GiB. The owning packet also controls commit
headroom, disk, CPU, tasks, swap, observer, deadlines, output and cleanup limits.
Stop the owned job on reserve or observer failure. Keep its containment and
cleanup path available. Never label workload as cleanup to bypass the failure.

Source inventories must exclude dependency trees, caches, Git internals and
reparse targets. Use bounded metadata scans before opening file contents. Report
unreadable paths instead of claiming full coverage. Do not duplicate large proof
archives or build dependency trees for handoff preparation. Preserve user apps,
shared Docker services, unrelated distributions and protected agent processes.

Each new runtime phase must record a cumulative attempt and elapsed-time budget
as well as its per-run limits. Count retries across script names, agents and
sessions. Before another attempt, identify what changed and what the result can
disprove. Stop the affected approach when its budget expires, its hypothesis is
invalidated, or it repeats a failure without new evidence. Keep failed evidence
failed and continue independent source work while preparing a review.

Agents may choose reversible methods within the approved packet and record why.
They may propose better tools, alternative designs or narrower experiments.
Jeff may revise the direction at any point. A proposal is not a decision.
Use the following process when a material change is needed:

1. State the failing assumption and cite the observed evidence.
2. Present practical options, including keeping the existing approach when viable.
3. Explain scope, affected dependencies, verification, resource cost and rollback.
4. Recommend an option. Name the exact decision needed from Jeff.
5. Continue independent authorized work while the dependent decision is pending.
6. Record the answer, date and authority in the existing design decision owner.
7. Update affected packet scope, dependencies, budgets and checks before dispatch.

Routine implementation choices need no new approval. Changes to product outcomes,
security boundaries, spending, accounts, publication or other explicit human
gates require their specific authority. Never weaken a done condition or resource
guard to turn failed evidence into a pass. New search tools remain optional
retrieval candidates until measured against existing tools on a bounded corpus.

## Required step: Reconcile documentation

Authority: Jeff's explicit request on 2026-09-10. Perform this step after
verification and before handoff, completion or the next packet. The owner does
the work and the independent reviewer checks the result.

1. Reconcile current claims with changed code, accepted receipts, decisions and
   unresolved failures. Distinguish source review, execution, integration,
   publication and production acceptance. Keep historical receipts historical.
2. Update the packet's Current progress, evidence and next step. Check the full
   parent acceptance conditions before changing completion. Update requirements,
   current summaries and the existing handoff where affected. Date volatile facts.
3. Reconcile reviewed checkpoint changes against exact preimages. Never change
   expected hashes to suppress unexplained drift. Regenerate the graph and
   derived status, plan and HTML views from their owning sources.
4. Run the common planning checks below and the preserved handoff's documented
   index/plan/docs checks. Read the affected rendered paragraphs against the
   evidence. Matching copies can still repeat an inaccurate claim.
5. Fix discrepancies before reporting the docs current, or state the exact
   unresolved discrepancy. Report source owners changed, checks and limitations.

The preserved workbench's HANDOFF_AUDIT.md owns its concrete renderer commands.
This step adds no runtime, spending, publication or automatic completion authority.

## Maintaining the graph

This section owns the common planning checks. Outcome contracts link here instead
of copying the commands. After changing outcome or packet metadata:

```console
python scripts/check_multi_project_plan.py --render
python scripts/check_multi_project_plan.py --check
python scripts/check_line_endings.py
git diff --check
```

The renderer only transforms the generated frontier index and full graph. CI runs
the guard's adversarial fixtures and rejects frontier, dependency, status, coverage,
and evidence drift.
