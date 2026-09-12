# Vivary multi-project workbench

Updated: 2026-09-07. Status: documented program; implementation evidence is tracked by the ticket graph. The product direction and Habitat development environment are approved. The owner confirmed BrowserPod is unavailable. Ordinary reversible technical choices belong to the owning packet; explicit unresolved product, account, security, and release decisions retain their stated owners.

This is the canonical program plan. [Execution rules](execution-contract.md), [scope coverage](capability-matrix.md), [native owners](native-owners.md), and [current risks](audit.md) keep the work bounded and current. Start here, then open [the graph](graph.md), [source evidence](evidence.md), [migration map](migration.md), or [release criteria](release.md). [CONTEXT.md](CONTEXT.md) defines the terms.

## Product direction and authority

Vivary absorbs the public Littleagent work into one product evolution. The GUI is the primary work environment. Standalone Vivary workspaces and users' favorite runtimes remain supported.

The [audience and setup decision](#approachable-workspace-decision-2026-09-06)
includes professionals across coding, research, writing, and second brains.
Vivary helps them accomplish work through an installable workspace and GUI.

The product handles new and existing projects, workspace templates installed within projects, an optional recommended Brain, and learning from verified work. Version control is optional. GitHub, Gitea, Jujutsu, and Beads belong to separate integration choices.

The full little-agent scope survives: visual planning, research, tickets, workers, review, portable handoffs, CLI agents, factory mode, email intake, and heartbeat maintenance. Delivery order does not remove later scope.

Implementation proceeds through the bounded packets in the generated graph. HarnessMax removal remains deferred. Website, UI, docs, guides, and a real 100% isitagentready.com result belong to the delivery program. This plan does not claim that the behavior is implemented, released, or published.

No model, storage vendor, hosting plan, default runtime, or payment service is selected by this document. Earlier Littleagent implementation authority remains relevant to compatible work after the changed contracts are reconciled. Planning authority does not establish implementation or publication evidence.

## Execution decision: 2026-09-05

The current development environment is the bounded Habitat container named by
the packet. On 2026-09-05 the owner first selected BrowserPod, subsequently
authorized Habitat fallback, then explicitly corrected the active instructions:
"we can't use browserpod". The latest answer supersedes the BrowserPod selection.
Keep BrowserPod setup and execution out of the active task list. Packet 10b is
unavailable and does not block Habitat implementation.

[10c](receipts/10c-habitat-fallback-proof.md) records the Habitat toolchain proof.
Each runtime packet still verifies its exact tools, containment, and behavior.
Earlier research and receipts retain their historical environment labels.
Runtime choice and standalone support remain part of the product. This development
decision does not authorize account, spending, credential-transfer, scheduled
activation, or production-hosting changes.

## Direction decision: 2026-09-06

The owner answered the three questions in
[the alignment brief](research/hoh-direction-brief.md) on 2026-09-06:

1. Loop first. The planning, coding, and testing loop runs and proves itself
   on files before the GUI depends on it. The GUI stays vital for usability
   and accessibility and is not descoped; it consumes the loop's evidence
   instead of preceding it.
2. Code first. The first project under the loop is a code project with an
   executable test suite, because that oracle is verifiable. Non-code
   workspaces wait for a declared oracle.
3. WikiSkill-shaped outer loop. Cross-session learning follows the
   compile-into-skills design: write-once traces, patch-only patterns, one
   gated proposal at a time with a named execution check, and skills that
   roll back while the record persists. Background memory consolidation
   without a gate is not selected.

The owner subsequently added **decision four**, recorded separately in
[PR #334](https://github.com/vivary-dev/vivary/pull/334) on 2026-09-06:
Vivary drives whichever coding agent the user already pays for, Claude Code,
Codex, or another through an adapter, with one role contract and one receipt
shape. The loop never requires its own model API key and never resells tokens.
This clarification was not a fourth answer in the three-question brief.

Packet [20a](packets/20a-headless-loop-proof.md) carries the first bounded
runtime proof and retains priority when its prerequisites are satisfied.
[20c](packets/20c-headless-loop-preparation.md) completed deterministic preparation.
The [experimental policy decision](#experimental-policy-and-continuous-execution-decision-2026-09-07)
approves 20a's replacement admission policy for implementation and verification. This split follows
the execution contract's rule to stop only dependent operations. The required
20b continuation of 20a owns the cross-runtime proof. [Outcome 04](tickets/04-define-runtime-session-contracts.md#done-condition)
owns the shared adapter acceptance. Outcomes 18, 19, 20, 30, and 36 carry the
rest in their logs. These decisions change order and acceptance. They do not add
product scope or authorize spending, publication, scheduling, or account changes.

## Multi-agent phase decision: 2026-09-06

The owner clarified that the product loop passes work between distinct agents,
with deterministic phase completion and handoff. Each stage can select a
different runtime. This extends the run-wide runtime choice above; using Claude
for a whole run and Codex for a separate run does not prove mixed-stage operation.

The coordinator owns the workflow state and transition rules. Each stage binds
its assigned agent, runtime, permissions, required outputs, and completion rule.
It starts a distinct agent session for that stage and hands over only the
declared inputs and accepted artifacts. Resuming a stage preserves its identity;
handoff to another stage must not reuse the first agent's conversation as a new role.

A returned response or complete usage report is not phase acceptance. The
coordinator checks the declared artifact and evidence requirements, persists the
decision, and dispatches the assigned next agent only when the rule allows it.
Rules must cover advance, bounded rework, blocked work, and final completion.
Missing evidence, unknown outcomes, and an unsupported runtime cannot silently
advance or select a replacement runtime. Reopening the same accepted handoff
must not start the successor twice or reset the workflow's budget.

Determinism applies to the transition given the recorded inputs and policy.
AI judgments can vary. When a phase needs judgment, its gate consumes an explicit
review or human decision bound to the artifact revision, rather than interpreting
freeform claims of completion. The exact phase checks and rework routes are
implementation choices that require declared tests; no runtime assignment or
quality threshold is selected by this clarification.

Packet 20c owns the offline routing and gate implementation. Packet 20a and its
20b continuation can still establish each runtime's baseline behavior, but
accepting the product also requires a bounded proof with different runtimes in
one workflow and preserved handoff identities, artifacts, and shared accounting.
Reuse the native run/session owners; this decision creates no replacement queue,
unbounded worker service, spending grant, or live-runtime acceptance.

## Context and response decision: 2026-09-07

The owner clarified: "Response limit is different than chat length we should
use something like 250k chat limit before compaction while response limit
should be in-line with the best practices of current harnesses". The owner
then instructed: "Use research to find best practice which will supersede my
judgement". This supersedes both earlier numeric suggestions. Research and
representative quality checks determine the compaction policy; 250k is a
comparison candidate, not an approved universal default.

The owner accepted the recommendation on 2026-09-07: "Lets use native for
now" and "we should always test our hypotheses and current ideas". Use native
defaults for this stage. Custom thresholds remain future experiments.

The accepted baseline uses the selected native runtime's model-aware compaction
and response defaults, with sufficient headroom for reasoning and output. This
is a supported starting point, not a claim that those defaults are optimal for
every task. Preserve the user's selected model and reasoning settings. Test
threshold changes against that baseline before choosing a different default.

The [compaction research](research/context-compaction.md) owns the source
comparison and proposed implementation checks. Native runtimes keep compaction
and session state. Outcome [04](tickets/04-define-runtime-session-contracts.md)
owns the capability contract. This decision does not turn the separate 20a
cumulative test-run allowance into a response limit or authorize an unbounded
run. Native behavior and quality preservation still require execution evidence.

## Experimental policy and continuous execution decision: 2026-09-07

Authority: Jeff explicitly approved `20a-observed-usage-v1` for experimentation
and directed continuous implementation through outcome 28 and its dependencies.
This decision supersedes earlier approval waits, packet-by-packet stops, and
requirements to start a fresh conversation. Complete each packet's verification
and checkpoint, then continue available work until that scope is verified or
only genuine external gates remain.

The policy's numbers and rules are configurable, versioned experimental
settings. They are not permanent product limits. Packet
[20a](packets/20a-headless-loop-proof.md#usage-contract) owns the active contract
and initial trial settings. The [20e receipt](receipts/20e-native-usage-policy.md)
preserves the reviewed proposal and its evidence. Approval accepts its stated
unknown token-overrun exposure within bounded local execution. It does not
establish complete provider accounting or live acceptance.

Revise settings between trials using recorded evidence. Bind every trial to its
policy revision, exact configuration, accounting, and recovery state. Never
change settings during an admitted trial, reset accumulated usage, replay an
uncertain invocation, or extend its deadlines through a configuration edit.
Reconcile prior trials and record the reason and authority for the next one.
Evidence-based experiment revisions are authorized within the existing
subscription and security limits. An unresolved accounting or authority gate
still blocks the dependent live call. Preserve native compaction and response
defaults as the comparison baseline.

The later [resource and model decision](#resource-and-model-decision-2026-09-07)
keeps GPT-6 Astra as lead and permits task-appropriate Sol, Terra and Luna
subagents. Each writer has explicit file ownership. Continue useful work across
the dependency graph without concurrent writes to the same owner. These development assignments do not replace the native runtime
selected for a product proof. In particular, 20a remains the Claude baseline.
The separate 20b hard-reservation policy does not change by implication.

Reuse the existing worktree and Habitat checkout named in the private handoff,
mounted at `/workspace/vivary`. Windows edits do not synchronize automatically.
Transfer only reviewed task files and verify their hashes before Habitat checks.
Preserve `.claude/agents`, `.runtime-tools`, existing work, and dependencies.
Do not create another development checkout or worktree. Reuse contained fixture
projections where possible and treat fixture copies as test data, not a second
development checkout. Clean only task-owned temporary resources by exact path.

Jeff confirmed ample included Claude allowance during this continuation on
2026-09-07. Record that as owner-supplied allowance evidence alongside the native
subscription-authentication check. The initial confirmation did not authorize
an account change. The later scoped account decision below records the separately
approved disabling of Usage credits. Stop on a reported usage limit or paid-access
requirement; included-subscription authority does not authorize paid fallback.

Jeff further authorized existing Claude and Codex subscriptions, including
supported subscription routes through Pi for Claude, Codex, or OpenCode.
Verify each installed route's authentication, isolation, and live behavior.
This broadens permitted subscription routes without accepting unavailable
integrations or changing the separate proof requirements.

Use existing included subscription access only where authorized and verified.
No paid usage, credential copying, push, publication, merge, or legacy deletion
is authorized. Account changes require their exact authority; the scoped exception
below permits only disabling Claude Usage credits. Stop only the operation
requiring additional authority. Keep graph status, receipts, and the existing Markdown/HTML handoff
current. Separate documented capabilities, deterministic tests, and observed
live behavior in every acceptance claim.



### Resource and model decision: 2026-09-07

Authority: Jeff asked agents to close completed processes and preserve free
memory, then explicitly directed, "just autonomously go through the project."
He wants to play games while work continues as a long-running task.

Use GPT-6 Astra for the lead, difficult implementation and acceptance review.
Use GPT-5.6 Sol for bounded medium-complexity work and Terra or Luna for source
search, general search and straightforward checks. Choose reasoning effort for
the actual task. This supersedes the earlier GPT-6-only development assignment;
the native model selected for a product experiment remains separately bound.

Keep local resource use small. Run one heavy build, browser proof or runtime
experiment at a time. Check available RAM and disk before starting it; defer
heavy work when headroom is low and continue source work or reviews. Close
completed task processes and browser tabs, stop idle task containers, and verify
cleanup. Preserve files, evidence, shared dependencies and unrelated user apps.
Check included model usage between waves and retain existing spending limits.

The initial cleanup confirmed no active test, build or model workers. The lead
closed one idle Habitat terminal and stopped the two idle Vivary containers.
They remain available to restart when needed. No unrelated app or shared WSL
service was terminated. The existing handoff owns later resource state.

Operational defaults revised after Jeff's 2026-09-07 slowdown report and request
to continue without filling memory: use one implementation subagent and one
local execution job at a time. Admit each heavy job using its measured or
enforced total memory budget plus at least 1536 MiB available for other apps.
The preflight check does not enforce a runtime cap; the runner owns enforcement.
Recheck after startup and cleanup. Prepare an explicit bound for unmeasured
jobs instead of waiting behind a blanket free-memory threshold. Existing
packet-specific constraints remain until their bounded execution plan changes.
The unused global Ruflo MCP autostart was disabled and its 14 verified launcher
and server processes stopped. Preserve unrelated apps and active tool helpers;
reuse existing collaborators rather than accumulating new tool sessions.


### Included-only account setting decision: 2026-09-07

Authority: Jeff explicitly answered, "Turn off usage credits and continue the
included-only experiment." This is the canonical owner of the scoped decision
mirrored as D32 in the preserved Littleagent plan.

Automatic approval review rejected the initial bootstrap before execution because
paid extra-usage eligibility was unresolved. Jeff then authorized disabling
Claude Usage credits for the account used by the native runtime. The lead turned
off that setting, confirmed the provider's Turn off action, and verified the fresh
UI showed it disabled. Read-only native authentication evidence matched the browser
organization and reported an authenticated first-party Claude subscription.
Private account identifiers and email addresses are omitted from this record.

This authority covers the completed account-wide disabling action and continuation
of the already approved included-only experiment. It does not authorize buying
credits, re-enabling Usage credits, changing auto-reload, using paid fallback, or
changing another account. D31's permitted subscription routes and native defaults
remain unchanged. A depleted allowance or paid-access requirement still stops the
dependent call. This account-setting verification is not model execution evidence;
the packet receipt and existing handoff own the current trial checkpoint.

## Recommended architecture

Use Vivary as the portable workspace and governance layer. Compose Agent-Native's application, action, chat, run, session, resource, connection, and automation primitives in the workbench. Selected coding runtimes retain their loops, tools, compaction, and native session state.

Do not add a second agent reasoning loop, transcript store, task queue, or scheduler merely because the product coordinates multiple projects. Add a product service only when a concrete requirement has no suitable existing owner.

```text
Vivary workbench GUI       Agent/CLI entry
          |                     |
          +--- same operations -+
                    |
          project registry and authority
             /              \
 Vivary context/policy     Agent-Native sessions/actions
             \              /
           explicit project + runtime binding
                    |
       Claude Code / Codex / Pi / other adapters
                    |
       chosen project folder or isolated checkout
```

Core remains pure validation and projection. Tropo observes and retrieves. Strato evaluates authority. Ozone verifies. Exo projects claims, dependencies, and handoffs. The application owns effectful coordination through supported framework APIs. See [the inspected seams](evidence.md).

## Filesystem and repository model

Recommended default: a collection folder without a parent Git repository. Projects can live under it or remain at existing external paths.

```text
My work/                    collection, no required .git
  .vivary/                  collection configuration and local bindings
  Brain/                    optional private knowledge workspace
  projects/
    new-tool/               standalone Vivary workspace, optional .git or .jj
    course-notes/           standalone Vivary workspace, no VCS required

/path/to/existing-app/     registered in place, retains existing conventions
```

These paths illustrate the model, not a finalized on-disk schema. Separate portable project identity/configuration from machine-local paths, user authorizations, database state, and credentials. Never synchronize those local bindings by accident.

A folder nested under a non-repository container is not a nested Git repository. Its Git history is independent of its siblings. A Git submodule instead makes a parent repository track a particular child commit and adds clone/update lifecycle. A monorepo stores project files in one shared history. A Git worktree is another checkout of the same repository, not a new project repository. [Git submodules](https://git-scm.com/docs/gitsubmodules) and [worktrees](https://git-scm.com/docs/git-worktree), verified 2026-09-05.

Do not default to submodules, subtree imports, or one giant parent repository for users' projects. Register an existing monorepo or submodule project without converting it. When multiple logical projects share a repository, serialize mutations against the common repository and checkout identity.

If a user versions the collection metadata, exclude child project content and private state explicitly. Prefer a separate metadata repository beside the project roots. A parent commit does not back up independent child repositories. Explain backup coverage accurately.

Jujutsu supports Git-backed and colocated workspaces. Detection must distinguish a colocated Jujutsu workspace from a Git-only checkout and select one mutation owner. Preserve unsupported layouts with read-only or external-tool access rather than rewriting them. [Jujutsu compatibility](https://docs.jj-vcs.dev/latest/git-compatibility/), verified 2026-09-05.

## Project onboarding

The GUI starts with three choices: create a project, open an existing folder, or open an existing Vivary workspace. An agent can invoke the same operations with structured inputs and receive the same plan and receipt.

New project:

1. Choose a display name and target folder. Suggest a filesystem-safe slug without changing the display name.
2. Choose a blank workspace or a versioned template. Explain the resulting files.
3. Offer version control independently: none, Git, or an available Jujutsu adapter. Default recommendations may suggest Git for code, but selection is never forced.
4. Offer hosting separately and make it skippable. Show host, account/organization, remote name, visibility, local path, and intended initial push before creating anything remote.
5. Preview all changes, apply the bound plan, verify, then register the project. Recover visibly if any step fails.

Existing folder:

1. Register and inspect read-only first. Canonicalize its path and detect the actual repository root, worktree, instructions, and configured tools.
2. Offer optional Vivary adoption using the existing dry run and plan-hash contract. Registration alone never writes an AGENTS.md, initializes Git, or creates a remote.
3. Keep existing Git/Jujutsu, submodules, monorepo layout, task files, ignored state, and human edits. Report ambiguity rather than resolving it by guessing.
4. Scope template additions to a verified empty child directory initially. Merging template content into a populated folder requires a later conflict-aware plan, not thin adoption by another name.

Repository creation is an optional wizard step, never the definition of a project. Allow local-only history, custom Git remotes, self-hosted Gitea, and no host. Do not require GitHub login to use Vivary.

## Template composition

Resume and extend the existing [held template-installer program](external-dependencies.md#held-template-installer-program) as the one implementation source for template semantics, verified transport, combined plans, and transactional apply. Its earlier implementation hold is not silently lifted by this planning request.

The catalog continues to own template content, manifests, versions, archives, and distribution. Vivary owns composition, adoption, verification, receipts, and conformance. Agent-Native app scaffolding and integration blueprints are different mechanisms. They must not become hidden substitutes for Vivary workspace templates.

A project created from a template remains a normal standalone Vivary workspace. The collection references it and routes sessions to it. Installing a template does not install another coordinator server, copy the whole collection, create a remote repository, or start another agent.

Bind each installation to the project ID, canonical target, template version and digest, selected options, target fingerprint, and authority. Recover across both filesystem changes and registry updates. Repeated requests must not create duplicate projects or lose an already completed install after a crash.

Allow project-contained workspace templates, including knowledge workspaces. First delivery supports a single collection of explicitly registered roots. Recursive collection coordination requires an explicit future contract for cycles, ownership, and authority inheritance. It is not implied by ordinary template nesting.

## GUI and agent parity

Keep the familiar little-agent shape: project navigation, task/session list, conversation, and expandable work panels for files, plans, board, preview, and evidence. The active project and runtime remain visible. Switching projects preserves drafts and never silently retargets an active session.

The GUI operates on actual authorized project files. Agent-Native personal resources remain useful for app-owned material, but are not represented as arbitrary disk files. Preserve dirty drafts, detect external edits, and resolve save conflicts before presenting the editor as reliable.

Every local project operation has a deterministic service contract with a plan, result, error, and capability description. CLI and agent tools share this contract. Transport and command names are selected in the contract ticket, not invented here as shipped exports.

Existing single-workspace commands remain compatible and do not require a running GUI, an Agent-Native account, a registry, or a network connection. Closing the GUI does not revoke access to plain workspace files.

## Runtime ownership and isolation

Use the installed Agent-Native native-runtime host as the initial seam. Preserve native session IDs and event streams. Distinguish runtime installed, configured, authenticated, bound, runnable, and verified. Do not turn the eleven deterministic little-agent host tests into a claim of real execution.

Bind each session to actor, project identity, canonical root or checkout, execution location, runtime, policy revision, and any relevant plan revision. Reattach to that binding. A dropdown change cannot move an existing runtime session to another project.

Offer native local execution and supported sandboxed execution with accurate capability descriptions. A path in a prompt is not filesystem isolation. If a runtime cannot enforce required limits, make that mode unavailable under that policy. Do not compensate by copying credentials or weakening protection.

When VCS is absent, use content fingerprints, conflict-aware patch previews, and a single active writer as the initial supported workflow. Isolated copies can be added with explicit reconciliation. Do not promise branches, atomic merges, or Git rollback for an ordinary folder.

## Research-informed verification

The [HoH comparison](research/hoh-alignment.md) records the owner-requested
review of arXiv:2609.01481v1. Its acceptance refinements belong to outcomes
04, 15, 16, 18, 20, 21, 29, and 36. They are agent-selected implementation criteria,
not evidence that the product already implements the method. Existing native
run, task, session, and receipt owners remain in place.

[The alignment brief](research/hoh-direction-brief.md) of 2026-09-06 extends
that review to the outer loop and the fleet question, with every number traced
to its source page, and records the owner's answers in
[the direction decision](#direction-decision-2026-09-06).

## Brain and self-improvement

Recommend a Brain during onboarding and let the user skip it. Start with sourced files, retrieval, and project-scoped learning records. Semantic indexes and provider-backed memory remain optional and rebuildable where feasible.

The learning loop is evidence capture, candidate lesson, evaluation, review, and accepted change. Separate user knowledge from runtime transcripts and operational traces. Proposals do not rewrite skills, authority, or instructions automatically. Support comparison, rejection, rollback, and provenance.

Default learning scope is the originating project. Moving knowledge into a shared Brain requires explicit selection or policy. Keep credentials, private source material, and another project's context out of automatic cross-project prompts. The user can inspect, export, correct, and remove managed memory with documented limits.

Decided 2026-09-06: the learning loop is WikiSkill-shaped, per
[the direction decision](#direction-decision-2026-09-06). Working agents load
skills and a short index, never the raw learning corpus.

## Full scope and delivery

[Migration](migration.md) maps the complete Littleagent plan and HarnessMax evidence to the surviving program. Existing native framework task/run/session records remain authoritative. Beads and external issue trackers are optional task sources, separate from version control and repository hosting.

The [graph](graph.md) sequences compatibility, project operations, GUI, native execution, templates, learning, integrations, planning/factory/research/intake, and release work. Each implementation slice must add or update its corresponding docs and evidence. Final website and guide publication follows verified product behavior.

The first usable milestone is one GUI registering two independent projects, adopting one safely, running one supported agent in the correct root, and showing a verified result. It is a milestone inside the whole program, not a reduction of the requested scope.

## Decisions still requiring evidence

- Exact source integration and history preservation for Littleagent's dirty local code. Recommended destination is a Vivary app package alongside existing Python packages, without nested .git metadata. Validate Agent-Native build and deploy assumptions before accepting that placement.
- Registry serialization and app persistence ownership. Reuse framework state for native runs and references, preserve portable filesystem truth, and avoid premature duplicate tables.
- Supported Jujutsu, host, and tracker write operations at first release. Registering and working in their folders does not prove an integrated connector.
- Runtime authentication and execution location. A native login or documented adapter does not prove the sandboxed path.
- Concrete agent-readiness protocols required by the live checker. The all-checks 100% target is retained. Real authentication or commerce capabilities may require additional product decisions.

No release date or package version is invented. Publication, remote creation, data migration, and legacy retirement are explicit operations with their own evidence and authority.


## Iterative process decision: 2026-09-06

Authority: the owner explicitly requested a bounded process and environment
maintenance ticket, modest sub-agent use, and discussion between product slices.
The [2026-09-07 continuous-execution decision](#experimental-policy-and-continuous-execution-decision-2026-09-07)
supersedes the discussion stop; the later resource and model decision sets current agent assignments.
The owner asked to overwrite the original handoff, clean task temporary files,
keep knowledge searchable through open formats and graph links, and incorporate
the small maintenance details that prevent documentation and storage buildup.

The [execution contract](execution-contract.md#one-reviewable-iteration) owns this
repeatable process. Packet [20d](packets/20d-process-environment-maintenance.md)
applies it once and updates environment prerequisites. This decision authorizes
task-owned disposable-resource cleanup. The owner also requested dependency
preparation. After an initially declined prompt, the owner renewed the setup
permission and the dependency installation and build passed under packet 20d.
It does not accept unfinished runtime behavior or activate the whole factory.


The owner clarified on 2026-09-07 that each claimed ticket proceeds through
planning, implementation, QA, correction, independent review, and cleanup in
one flow. Routine phase changes do not require another user instruction.
Stop for consequential decisions or unresolved authority-bound operations.
Preserve the existing Markdown/HTML handoff instead of creating phase copies.

## Approachable workspace decision: 2026-09-06

Authority: the owner requested an installable workspace with a GUI that makes a
disciplined work process usable without programming expertise.
The owner clarified that Vivary is a tool for accomplishing real work, not an
educational product. The GUI directs work and presents results and decisions.
Do not add lessons, tutorials, or teaching flows from this accessibility goal.
Existing Claude Code and Codex subscriptions are an intended connection journey.
The desired action is one button to connect an existing coding agent.

Preserve GUI-first and headless-capable use, runtime choice, and the complete agreed
scope. Show the task, changed result, passing and failing checks, and required
user judgment first. Keep evidence and technical detail available on demand.
Authentication, subscription eligibility, available capabilities, and supported
connection APIs require provider-specific verification. The desired experience
does not establish automatic sign-in or authorize credential copying.

At task close, inspect evidence for a useful lesson. Amend an existing owning
instruction, check, or module guide when the evidence supports a reusable change.
Keep speculation out of accepted learning and avoid creating a document per lesson.
The existing learning review and project-boundary rules still apply.


The owner clarified that developers are only one audience. Vivary serves
professionals doing coding, research, writing, second-brain work, and other tasks.
Assume basic ability to install and message an agent, not professional programming
expertise or prior coding work. Use direct, respectful product language. The website must explain the
product, setup, supported runtime connections, requirements, and important limits.
The application focuses on directing work and reviewing results. Website details
must follow verified capabilities rather than presenting the planned connection
experience as already implemented.

When owner statements genuinely conflict, name the conflicting requirements and
the decision they affect. Discuss that conflict before choosing a consequential
interpretation. An explicit correction updates the existing decision.

## Sandbox execution clarification (2026-09-09)

Authority: Jeff, direct instruction in the active implementation conversation.
Date: 2026-09-09.
Answer: "yo have we not sandboxed while working? have we previously been sandboxed? I dont want performance degradation but we have to try and run code only in sandboxes and work should be kept in habitat or whatever"

Execution interpretation: keep new application builds and tests in the verified
Habitat boundary, with the existing resource limits and cleanup. Host controllers
and source-only checks retain bounded ownership. Windows Job limits are resource
containment rather than security isolation. The proposed Windows refresh
component regression was prepared but not run; its gate does not establish
permission to execute application code outside a security sandbox. Use the
actual failed sandboxed browser proof as the refresh regression baseline, then
verify the correction through a fresh Habitat build and sandboxed browser.
No resource limit, credential, spending, or publication authority changed.

## Handoff, resources and plan adaptation decision, 2026-09-10

Authority: Jeff's explicit local task instructions on 2026-09-10.
He requested a module file index, completed and remaining work, Markdown and HTML
plans, a current handoff, and autonomous execution that can discuss needed changes.
He also explicitly required the next agent to preserve resource discipline.

Keep the existing handoff as the continuation owner. Generate file and status
views from live records. Product implementation was paused during this handoff
audit until the later runtime-continuation decision lifted that pause. Preserve the approved direction and all resource, security and external
action gates. Agents may recommend alternatives when evidence challenges the
plan. Record proposals separately from decisions and update affected packets
after a decision. The execution contract owns the operational process.

The mentioned search tool is an evaluation request, not adoption authority.
Consider `zg` / `zvec-grep` as an optional retrieval candidate. First compare
it with existing exact search and optional retrieval adapters under a bounded
resource plan. No installation, model download, index, daemon or data transfer
was authorized or performed by this handoff audit.

## Runtime continuation and agent-loop priority, 2026-09-10

Authority: the owner's explicit continuation request and answer on 2026-09-10.
The owner answered: "Resume bounded Habitat proofs" once source review and
resource gates pass. This lifts the temporary runtime pause from the handoff audit.
It preserves existing resource caps, included-only access, ownership, cleanup,
security and external-action gates. It does not authorize usage resets, paid
fallback, account changes, scheduling or publication.

The owner also clarified that the intended result is a platform running agents
according to Vivary's design. Apply the existing loop-first decision: packet 20a
has priority when its concrete prerequisites are satisfied. Deliver the distinct
planner, developer and independent QA stages with file-based handoffs and evidence
feeding the next iteration. Verification supports that working workflow.
Registry and GUI preparation remain in scope and continue where independent.
They do not become new start gates for the agent loop.

## Existing Vivary and startup direction, 2026-09-10

Authority: Jeff's explicit clarification in the local development task.
Use Vivary's planning, development and independent QA approach to develop
Vivary itself. Extend the shipped workspace logic, including brownfield setup
and durable state. Preserve the complete program scope.

Starting work should establish or resume the appropriate workspace as part of
the normal flow. Support code, second brains and other projects. Detect an
existing Vivary workspace and resume its state; route an existing unconfigured
folder through the existing brownfield adoption mechanism. The project onboarding
contract above retains inspection, a bound change plan and preservation of human
files. Automatic routing does not make registration permission to overwrite them.
This describes the target startup experience, not completed GUI acceptance.

Rewrite the existing handoff in place. Keep it short and link to the file index,
owning packets and evidence. Do not create another continuation document for
each session. The execution contract already owns this rule.

## Knowledge, retrieval and learning enforcement, 2026-09-10

Authority: the owner's explicit request to use zvec-grep, enforce Open Knowledge
Format and graph methodology, and research reviewed skill improvement.

Use zvec-grep for developer retrieval within the existing environment and
resource rules. Pin and verify its local behavior before indexing the selected
source subset. Preserve exact search and Tropo's deterministic graph as the
baseline; semantic results are candidates to inspect, not authoritative records.
Routine local setup is included in this direction. Remote embeddings, disclosure,
paid calls and scheduled execution retain their specific gates.

Vivary-managed knowledge must have validated metadata and graph relationships
in normal work. Apply OKF's required type/frontmatter convention to the declared
knowledge scope. Keep source code, binaries and unadopted brownfield files outside
an indiscriminate metadata rewrite. Preserve explicit local project-edge semantics
and provenance requirements. Reuse Tropo parsing and graph validation rather than
creating a second knowledge store. Migrate the program's legacy record readers
before changing their metadata format; preserve frozen contract preimages.

Outcome 18 already owns the WikiSkill-shaped product loop. Implement its trace,
pattern, proposal and impact-ledger contracts with independent evaluation and
rollback. Capturing a failure does not prove a skill improved. The workspace's
own WikiSkill instance is not evidence that product learning is implemented.
The recent OKF v0.2 specification and WikiSkill research inform implementation;
they do not establish local performance or acceptance by themselves.

## Windows settlement test correction authority, 2026-09-10

Authority: Jeff answered **Allow two corrected attempts** after the original
20h test consumed its single request and exposed missing child-output wiring.
Allow up to two corrected Windows-only attempts with a new 120-second cumulative
limit, the same 512 MiB Job cap, 1,536 MiB reserve and existing cleanup checks.
Retain the failed evidence and count corrected requests together across agents,
scripts and sessions. This authority does not change the 06e build budget or
permit WSL, container or model work under the Windows-only test.

## Corrected frozen-build request authority, 2026-09-10

Authority: Jeff answered **Authorize one corrected build request** after reviewing
the corrected build adapter proposal. Allow one new admission request with a
1,200-second cumulative limit, including refusal, and the same memory, reserve,
observer, CPU, task, output and cleanup limits. Dispatch only when fresh resource
readings support it. Bind the answer to the reviewed source and preserve the
original failed marker, Native10 freeze and all other exhausted budgets.
This approval includes no model call or shared-helper cap mutation.

## Shared helper cap authority, 2026-09-10

Authority: Jeff answered **Authorize the exact helper change**. Authorize the
existing reference container at 512 MiB and proxy at 256 MiB, with memory-swap
equal to each memory cap, use within the bounded attempt and both stopped
with those caps retained afterward. This is a persistent shared-container
configuration decision. It does not waive source, runtime-evidence, memory,
usage, ownership or cleanup gates, or authorize unrelated container changes.

## Exact failed-build stage deletion authority, 2026-09-10

Authority: Jeff answered **Approve exact stage deletion** for
`vivary-06e-build-proof` under the verified Habitat work root, limited to the independently
inspected eight generated files and 12 directories. Preserve Windows
evidence. This resolves the automatic approval rejection of that deletion
only; it does not renew an exhausted build request or authorize other cleanup.

## Transfer-corrected build authority, 2026-09-10
Jeff answered **Authorize one transfer-corrected build** after the accepted
stage cleanup and reviewed transfer fix. One new admission request is authorized,
with a 1,200-second cumulative limit including refusal. Keep 4 GiB warm physical
and commit admission, 10 GiB disk, 2 GiB Linux and 512 MiB Windows caps, one CPU,
existing task/output/observer limits and 1,536 MiB reserve. No model calls or
shared-helper changes are included. The request is unused; dispatch only when
fresh resource readings support it. Both earlier failed requests stay exhausted.

## C5 supplemental browser allocation, 2026-09-12

Authority: In response to the proposal for one additional 120-second browser
attempt, Jeff directed: "keep it going until completion but i need your help to
ensure that we are not going off the rails". This approves that single proposed
allocation: 115 execution seconds and five cleanup seconds. It does not renew
the original 365-second ledger or authorize another retry after this attempt.

Preserve all seven original charges, totaling 346.26085875899935 seconds, and
their 18.73914124100065-second remainder. Charge the new attempt only to the
separate 120-second allocation. Keep all source, resource, isolation, and
acceptance requirements. Review the remaining browser paths and budget changes,
prepare once, and obtain fresh independent admission before dispatch.

The direction audit found excessive fixture churn and recursive archive copies.
Finish the existing 13 checks without expanding the proof framework. Preserve
old archives and reference their hashes in the next bundle. A failed attempt
ends this allocation; retain its evidence and continue independent source work.
A passing fixture establishes only its stated browser behavior. The next product
unit is configured Workbench startup using the existing project services.
Production custody and parent session/draft conditions remain separate gates.
