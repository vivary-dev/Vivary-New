# Workspace primitives and templates for Vivary

Supplied research input. Read the [source reconciliation](workspace-research-reconciliation.md) before using
its claims or delivery order. The accepted plan is the program frontier.

Research: 2026-09-13. Status: proposal, all six research slices complete.
This note answers one question Jeff asked on 2026-09-13: what primitives do
real agent-operated workspaces share, where does the original Vivary CLI fall
short of them, and what template list and delivery hypothesis follow. It
makes no implementation claim. [design.md](../design.md) owns decisions, and
outcomes 07, 08, 11, and 19 own the work it maps onto.

**The short version.** Real workspaces share five things: a law file, a
generated map, an append-only record, owner memory wherever a person is the
audience, and a declared boundary between runtime and durable. State is a
view the harness derives, not a file anyone keeps well by hand. Everything
else is an extension owned by a kind of work, and the extensions compose.
The original CLI has the law and a hand-kept state file, dropped the two
files that held owner memory, cannot change a project's kind, merge, split,
or adopt a full folder, and its governed loop produces nothing without git.
The proposal is a role-assignment contract in place of presets, the memory
pattern restored in three scopes, a generated map with derived state,
adoption by inference, merge and split as index operations, then a two-level
template list, then the GUI.

## The question, in Jeff's terms

- Look at real workspaces people use with agents on GitHub and extract the
  primitives that translate to everyone: minimal, universal, and able to grow
  through customization and added knowledge.
- Find where the original Vivary CLI is weakest. Predefined workspaces were the
  wrong shape. Agent work needs a workspace that can absorb a project: planned
  as one thing, redefined a few iterations later, old material pulled into the
  new one at once.
- Expand beyond code: second brains, knowledge work, life management, and
  other activities as first-class agent spaces.
- The owner talks through the Vivary GUI and moves between projects without
  friction. The agent should feel like it knows the owner because of what is
  in the files. Saving information and work into the file system is the layer
  to get right.

## What already exists and is not repeated here

| Source | What it settled | Where |
| --- | --- | --- |
| Agent Workspace Catalog research | Market demand, competitors, delivery surfaces, 19 shipped templates in 7 collections | `The Little AI Company/projects/agent-workspace-catalog/research/landscape-synthesis.md`, `templates/` |
| Letta Code study | Memory levels, init from the folder, skills versus tools versus roles | [letta-code-workspace-patterns.md](letta-code-workspace-patterns.md) |
| Original product map | The five-file thin contract, four presets, legacy scaffold, role packages, GUI gaps | [original-vivary-product-map.md](original-vivary-product-map.md) |
| Harness-of-Harness brief | Plan revision from evidence, evidence feedback, and warm start each carry six to eight points. A learning loop pays only with a gate | [hoh-direction-brief.md](hoh-direction-brief.md) |
| Workspace setup direction | Three separable choices: structure, agent guidance, execution | [design.md](../design.md#workspace-setup-direction-2026-09-13) |
| Graph readiness assessment | The knowledge graph is real. The work graph is a line, not a graph | AIS-OS `Brain/projects/vivary-graph-readiness.md` |
| WikiSkill template design | Three layers (raw, wiki, skills) and one gated iteration | catalog `research/wikiskill-template-design.md` |
| File memory and persistence note, committed by the Codex agent at `36e1ebf` on 2026-09-13 while this note was being written | Durable knowledge, work state, and history are three kinds. Letta, Claude Code, and Hermes memory shapes. Git, Jujutsu, Entire, and Beads as optional persistence with one owner per fact. Visible save, correct, and forget operations | [file-memory-and-persistence.md](file-memory-and-persistence.md) |

## Method

Six research slices ran in parallel on 2026-09-13. Slices 1 to 5 read public
repositories and official vendor docs through the GitHub API and raw file
fetches, with no cloning or installation, and tested each against a fixed
vocabulary of seventeen primitives. Slice 6 traced seven scenarios through the
original CLI source on branch `feat/vivary-gui`. Each slice's file is listed in
the sources section. Every claim below that comes from a slice cites it.

| Slice | Scope | Output file |
| --- | --- | --- |
| 1 | Second brains, vaults, LLM wikis operated by an agent | `slice-1-second-brain.md` |
| 2 | Agent OS, personal AI infrastructure, and vendor instruction hierarchies | `slice-2-agent-os.md` |
| 3 | Multi-agent orchestration: tasks, claims, handoffs, evidence | `slice-3-orchestration.md` |
| 4 | One agent, many projects: roots, inheritance, routing | `slice-4-multi-project.md` |
| 5 | Self-learning, self-healing, self-growing loops | `slice-5-self-maintaining.md` |
| 6 | The original Vivary CLI against absorption, non-code work, and owner memory | `slice-6-vivary-cli-weaknesses.md` |

## Hypothesis under test

Stated before the evidence arrived so the evidence can falsify it.

**H1. The universal minimum is five roles a file plays, not a folder layout.**
Law (what the agent obeys here), Map (what exists and what to read first),
State (what is true now and what is next), Memory (durable facts about the
owner and the work, separate from logs), and Record (dated traces of what
happened). Everything else is an extension that appears when a kind of work
needs it: capture inbox, skills, roles, task graph, claim ledger, receipts,
gates, private boundary, maintenance loop, tool projections.

**H2. Absorption is role reassignment plus a conflict-aware plan, not a
re-scaffold.** If the workspace contract records which file plays which role,
changing a project's kind is a change to that assignment. Merging two projects
is a union of assignments with conflicts surfaced. Splitting is a partition.
A preset that fixes the layout cannot do any of these.

**H3. A template is a bundle of patterns over the five roles.** A pattern is a
file set, the instruction paragraph that tells the agent how to use it, its
maintenance loop, and its gate. Patterns compose. The template list is two
levels: a pattern library and named starting points defined as pattern
selections with defaults.

**H4. "Knows you" is Memory with three scopes and one read rule.** Owner,
project, and machine or runtime scopes. Law tells the agent to read the Memory
index at startup, and retrieval indexes it as typed nodes. Session end writes a
Record. A gated maintenance loop promotes Records into Memory. Without the
gate, memory rots.

**H5. Delivery order.** Build the role-assignment contract and one pattern
(Memory plus its maintenance loop) first. Dogfood it on the owner's own
multi-project root. Add patterns in the order the catalog's demand evidence
ranks them. The seven scenarios in slice 6 must pass before any GUI template
picker ships.

## A local existence proof: the owner's own root

Jeff's AIS-OS root (`<owner-workspace>`, read 2026-09-13) is a working
multi-project workspace operated by several agent runtimes. It is one sample
and it is the owner's, so it proves feasibility, not generality. Its files map
onto the five roles in H1 without any of them having been designed for that
vocabulary:

| Role | File or folder | Note |
| --- | --- | --- |
| Law | `WORKSHOP.md`, root `AGENTS.md`, nearest area `AGENTS.md` | The mandatory chain is two files: the law and the nearest area manual |
| Map | `PROJECTS-INDEX.md`, `Brain/index.md`, `prompts/index.md` | One index per area, plus a root index of repositories and their remotes |
| State | `Brain/log.md`, company `Brain/CURRENT.md`, `Brain/daily/` | Open items and dated orientation |
| Memory | `Brain/USER.md`, `~/MACHINE.md`, `Brain/concepts/`, harness auto-memory | Owner, machine, and durable knowledge kept in separate files with a size budget on the machine file |
| Record | `Brain/experience/raw/`, `Brain/memory/`, `decisions/` | Write-once traces, dated receipts, decisions |

Extensions present: capture inbox (`Brain/inbox/`), skills (`.agents/skills`
with junctions into per-tool dirs), maintenance loop (the `rounds` steward pass
three times a day and the `wikiskill` consolidate, propose, gate operations),
private boundary (`working/` on a fourteen-day clock, `archives/` instead of
deletion), tool projections (`.claude/`, `.codex/`, `.agents/`), and
multi-project routing (`projects/` here, company projects in a second root,
each project carrying its own `.git`).

Two lessons from its history bear on absorption. The root was reorganized on
2026-09-10 when a prior workshop dissolved into two roots, and the machine
file records that a path-keyed memory store died with the old folder. Both
say the same thing: structure that lives in paths breaks when the project
changes shape, and structure that lives in an index survives. Sources:
`WORKSHOP.md` pre-reads and routing, `PROJECTS-INDEX.md` "Moved out on
2026-09-10", `~/MACHINE.md` Safety.

## Where the original CLI is weakest

Slice 6 traced seven scenarios through the source on branch `feat/vivary-gui`
at SHA `6f7db03` and ran the CLI against synthetic workspaces on Zo, since
deleted, leaving the checkout untouched. Every claim cites
`slice-6-vivary-cli-weaknesses.md`, which carries file and line for each.

### The seven scenarios

| Scenario | Verdict | What the owner sees |
| --- | --- | --- |
| S1. Change a project's kind after creation | Refused, with a misleading error | `second-brain` and `knowledge-work` produce byte-identical workspaces apart from one string. No verb changes it. Re-running adopt with the new preset reports "existing file is not thin-v0.3" on a genuine thin-v0.3 file. |
| S2. Adopt 400 notes with no frontmatter plus PDFs | Plan reports clean, apply rolls back | Any folder named `projects`, `modules`, `changes`, `decisions`, `verification`, or `gates` is claimed by Vivary's type vocabulary. A PARA vault's `projects/` produced 90 missing-field errors and a full rollback. The plan cannot warn because `plan_adopt` never runs Doctor and `adopt_workspace` does. With the folder renamed: 403 nodes, 0 edges, PDFs never indexed. |
| S3. Merge two workspaces | Undefined | No code path. Two thin roots in one tree are refused as competing. Node ids are filename slugs, so two workspaces holding the same slug collapse to one node with no error. |
| S4. Split one workspace | Undefined | `init` refuses a non-empty target, so the second half must be moved out and adopted fresh, which guarantees broken cross-half edges, and broken edges fail Doctor. The CLI blocks the workspace it just helped create. |
| S5. Store a durable owner fact | Partly, with no slot | The thin five files have no owner, profile, or memory entry. The only route is a `decision` record, which needs a git repository, a capsule, and a supersession lifecycle to hold "I write in the morning." |
| S6. Knowledge work with no code or tests | Blocked or blind | Strato needs a capsule that only a git repository produces. Ozone's one non-code pack cannot fire because its folders are not registered types. Exo's board reports no work items because records live under `.vivary/records/` and `role_of` reads the first path segment. |
| S7. Doctor on a non-code workspace | Green when it should not be | Zero edges is not reported. Only zero nodes warns. Every Tropo warning is promoted to an error, so a vault whose notes carry an ordinary `title:` field fails Doctor. |

### The ten weakest points, ranked by how much each blocks a requirement

1. **No code path for merge, split, or absorb.** The ten verbs contain
   nothing that could stand in.
2. **Adopt plans a transaction it cannot finish** on any folder whose names
   overlap the six type folders, and the dry run cannot warn.
3. **The thin scaffold dropped both files that held owner facts.**
   `USER.template.md` and `MEMORY.template.md` are still on disk in the
   legacy assets and still required by the legacy contract. The thin file
   list has no owner slot of any kind.
4. **The governed loop produces nothing without git.** The workspace model
   adds a bare node and skips content projection when the path is not a
   repository. A 400-note vault yields a capsule with zero claims.
5. **The typed graph has no edges on a note corpus.** Edges come only from
   frontmatter fields declared `ref` or `ref-list`. There is no wikilink or
   Markdown-link parsing.
6. **The preset is a label nothing reads**, and changing it later is refused.
   The per-preset starter table exists and is reachable only from the legacy
   scaffold path.
7. **The one non-code review pack cannot fire** on the workspace the CLI
   creates. A correctly linked draft and review pair is reported as unlinked
   while `tropo check` passes silently.
8. **The only private slot is excluded from retrieval.** A fact placed in
   `.vivary/private/` is not returned by find.
9. **Retrieval evidence is capped at eight files per checkout with no
   relevance ranking.** Two hundred tied matches return in slug order.
10. **Doctor is green on a workspace with zero edges and red on one with
    ordinary frontmatter.**

### What the legacy scaffold had that the thin path dropped

The owner profile, durable memory, dated daily notes, per-preset starter
graphs, the knowledge-work sources router, brownfield module routers, and
per-path excludes for pre-existing type-folder content. The last item is the
exact mechanism that would have prevented the observed PARA rollback. It
lives in `_legacy_full_plan_adopt`, which has no caller anywhere in
`packages/` or `tests/`. The thin plan hardcodes empty follow-up lists in its
place. Two files the legacy scaffold wrote, `STRATO.md` and `SOUL.md`, are
still checked by Ozone's context budget pack, while the file the thin
contract tells the agent to read first, `.vivary/context.md`, is never
inspected.

### Where the code assumes code

Nineteen assumptions, with file and line in the slice. The ones that block
non-code work outright: content search is `git grep` over tracked files with
binaries dropped, so uncommitted notes and PDFs are invisible. The observable
facts about a workspace are all version-control and npm facts, including
`no_npm_test_script` reported as an unknown on a writing project. The six
type nouns are module, change, decision, verification, gate, project, so
source, draft, note, person, and meeting have no type. The module type
carries `test_files`, the change type carries `slice` and `branch`, and the
verification type carries `command`. Exo's seven roles are a hardcoded list
with no config hook. The automatic preset choice can only ever return
`coding` or `second-brain`.

### What the program already knew

The evidence document records that the project type is graph data inside one
workspace and not a registry of managed projects, that presets are flags that
do not discover runtimes, and that adoption does not create records or scan
for modules. The migration map carries "remove unconditional Git assumptions"
and "make VCS operations conditional." The root-VCS observation contract
anticipates non-git roots. `governed_find` does not act on that. No issue in
the sixty returned names merge, split, changing a preset, an owner slot, or
running the governed loop without git. Closed issue 85's acceptance criterion
for the knowledge-work preset, a graph with workbench and sources routers, is
not met by the thin path.

### What the ranking says about the hypothesis

Points 1, 2, and 6 are the absence of the role-assignment contract in H2.
Points 3 and 8 are the absence of the memory pattern in H4. Points 4, 5, 7,
9, and 10 are the code-shaped assumptions that make the minimal set fail for
knowledge work: a Map that only counts frontmatter refs, a Record layer that
only reads git, and a Doctor that cannot tell an empty graph from a healthy
one. The finding that cuts deepest is point 4 combined with S5: the governed
loop, which is Vivary's distinctive job, is unreachable for exactly the
workspaces Jeff wants to add.

## What real workspaces share

Four kinds of workspace, read one slice each. The cross-slice verdict is in
the section after these four.

### Second brains and LLM wikis (slice 1, 11 full records plus the gist)

Every claim cites `slice-1-second-brain.md`.

- **Present everywhere except the one pre-agent vault:** a law file, a dated
  log, and a place to file durable knowledge. Nine of eleven carry an index.
  Karpathy's six nouns (`raw/`, `wiki/`, a schema file, `index.md`, `log.md`,
  three operations) survive every reimplementation intact. The log line format
  `## [YYYY-MM-DD] operation | Title` propagated verbatim into four
  independent repos.
- **State surface is weak in this kind.** Four of eleven have one, five have a
  partial one (an overview page, a hot cache, a dashboard), two have none.
  Knowledge workspaces track what is known more than what is next. This is
  evidence against H1's claim that State is one of five universal roles. It
  may be universal for project work and optional for knowledge work.
- **Orchestration primitives are rare here.** Roles appear in two of eleven,
  a task graph in two, a claim ledger in three. The wiki repos treat a source
  as the unit of work and have no task graph at all. The productivity vaults
  have boards and goal cascades but no evidence layer. Almost nothing has both.
- **The sharpest quality line is whether anything can fail.** Five repos ship
  a checker that can return an error: a grounding-invariant script, a zero-LLM
  health script, a claim ledger with independence keys, an AI-first write
  validator, a tool-call guardrail. The rest ask the model to be careful.
- **Raw immutability is universal. Its enforcement is the variable.** It runs
  from prose ("never modify these") through a create-only transaction mode
  with expected hashes to a tool-call hook that blocks the write.
- **Gates cluster at three moments** in every repo that has one: letting a
  synthesized answer become a durable page, moving a source out of staging,
  and sending anything over the network.
- **Maintenance gets priced once a workspace has run for a while.** The two
  most recently active repos run health free on every session and lint, which
  is expensive, every ten to fifteen ingests.
- **The newest direction is memory of work, not only memory of sources.**
  Trajectories, cases, and distilled skill pages stored beside the wiki.
- **Names:** law `CLAUDE.md` (6) and `AGENTS.md` (5). Index `index.md` (6). Inbox `raw/` (6). Durable `entities/`, `concepts/`, `sources/` (5 each). Log `log.md` (6). Skills `skills/<name>/SKILL.md` (6). Maintenance `lint`
  (6).

### Multi-agent orchestration (slice 3, 11 systems)

Every claim cites `slice-3-orchestration.md`. Systems: gastown, beads,
ruflo, Entire, the Claude Code file convention, oh-my-claudecode,
openai-agents-python's workspace, crewAI, the LangGraph template, and
adk-samples. Two repo moves recorded: beads and gastown now live under the
`gastownhall` org, and Entire's CLI is `entireio/cli`.

- **What every coordinating system has:** a law file, named roles as
  separate Markdown files with YAML frontmatter, and a declared boundary
  between runtime state and durable record. The three that lack all of them
  (crewAI, LangGraph, ADK) are libraries whose agents never outlive a process.
  The boundary is usually written as a `.gitignore` inside the state directory
  itself, keeping one committable exception (a config file, a skills folder).
- **The durable record is moving out of the working tree.** beads keeps it in
  a Dolt database synced over `refs/dolt/data`. Entire keeps it on the git ref
  `entire/checkpoints/v1`. ruflo and oh-my-claudecode keep it in a mostly
  ignored state directory. Files remain the interface. Git refs become the
  store.
- **No capture inbox in any of the eleven.** All assume work arrives already
  shaped as a ticket or a prompt. The knowledge workspaces in slice 1 nearly
  all have one. The two kinds are complements, not variants.
- **State surface is nearly absent** (one present, one partial). The task
  graph carries it. Combined with slice 1, where knowledge vaults carry state
  as an overview or hot page, the pattern is that serious systems derive the
  state view from the record rather than maintaining a state file by hand.
  This is a correction to H1: State is a view over Record and the task graph,
  not a fifth primitive file. The original `STATE.md` is a hand-maintained
  view, which is why it goes stale.
- **Claims split into two families.** A database-backed atomic claim where
  the first writer wins (beads `bd update --claim`, plus a single-holder merge
  slot), or a committed plain-file ownership table with one owner per file
  per lane and contested files moving only by explicit handoff
  (oh-my-claudecode). ruflo sits between: the rule in prose, enforced by
  worktree isolation. The owner's Dropped Work catalog template is the
  plain-file family.
- **Handoff splits the same way.** A persistent message plus a pinned work
  item (gastown's mail plus Hook), or a reconstructed summary with a fixed
  section schema (Entire's six sections, openai-agents' PR packet). The two
  most rigorous specifications refuse to write a handoff file at all and
  derive it from the transcript or the live diff.
- **Evidence is where serious systems converge hardest.** gastown, beads,
  and openai-agents each bind a verdict to exact commit SHAs, keep a
  machine-readable artifact beside a human-readable one (`evidence.json`
  plus `report.md`. A gate file. A validator against a shipped-path
  manifest), and treat a missing or extra file path as a hard stop. The
  original Vivary receipt binds outcomes to a capsule and a workspace, which
  is the same idea.
- **Per-agent worktrees are nearly universal**, and three systems arrived
  independently at one worktree, one writer. Gates cluster on push, publish,
  and merge.
- **Roles converge on `.claude/agents/<name>.md`** as the de facto schema
  even for tools that also target Codex and Cursor.
- **Names:** law `CLAUDE.md` (6) and `AGENTS.md` (6) with managed-block
  delimiters for injected sections. Skills `SKILL.md` (8). Roles
  `.claude/agents/<name>.md` (4). Boundary `.gitignore` inside the state dir
  (3). Maintenance `doctor` (2), `lint`, `gc`, `compact`, `stale`, `orphans`
  (beads).

### One agent, many projects (slice 4, 7 vendor conventions and 10 repos)

Every claim cites `slice-4-multi-project.md`. Vendors: Claude Code, Codex
and agents.md, GitHub Copilot, Cursor, VS Code, Nx, Turborepo. Repos:
infinite-brain-os, personalos-boilerplate, agent-workspace-architecture,
peter-brain, obsidian-claude-pkm, LifeOS, safe-wallet-monorepo, osdk-ts,
skmtc, pm-brain.

- **Only two things are universal across roots:** one law file the agent
  reads first, and a rule, stated or inherited, for how a deeper file
  modifies it. Nothing else.
- **Every vendor resolves nested instructions by concatenation with the
  closest file read last, never by replacement.** A per-project override is
  really a per-project append that must contradict the root loudly to win.
  Only safe-wallet-monorepo writes overrides into its routing table
  explicitly. Only osdk-ts states leaf-versus-skill precedence at the leaf and
  asks the agent to flag conflicts. VS Code's nested files carry the note "no
  specific order is guaranteed."
- **Personal roots and code monorepos split on the state axis, not on
  tooling.** All five personal roots carry a state surface, a capture inbox,
  and durable memory. None of the four monorepos carry any of the three. The
  monorepos carry receipts and gates instead, because their work product is
  reviewed by other people and the personal roots' is not.
- **Routing written down beats routing by folder position.** Four repos ship
  a routing artifact: by task class (infinite-brain-os), by intent to skill
  (personalos-boilerplate), by subtree table (safe-wallet-monorepo), by alias
  table (LifeOS). The five that rely on the vendor's nearest-file rule require
  a request to already know its own directory. The repos with no routing
  artifact are the repos with the most instruction files: skmtc carries 51
  nested `CLAUDE.md` files and no index, which produced duplicated release
  rules at two depths and a session log growing inside an always-loaded
  instruction file.
- **Only two roots answer "which project is this session in" with a
  mechanism.** peter-brain asks at the first message and refuses to read
  outside the answer. LifeOS resolves an alias table. Everyone else assumes.
- **The leaf instruction file is doing two incompatible jobs.** In the
  monorepos it carries rules that override the root. In obsidian-claude-pkm it
  carries project state with no rules at all. Both load, because the vendor
  loads the file either way, but they are different primitives wearing the
  same filename.
- **Path-move fragility is the absorption finding.** High fragility: routing
  maps and `@` imports that hardcode paths (infinite-brain-os,
  personalos-boilerplate, agent-workspace-architecture, obsidian-claude-pkm),
  glob-scoped rules in a central file (Cursor, VS Code). Low fragility:
  per-directory files that travel with their folder (osdk-ts, Codex, Claude
  Code without imports), and Nx, which resolves by project graph rather than
  by path. This matches the owner's own record of a path-keyed memory store
  dying when its folder moved.
- **The closest match to a parent-of-projects contract** is
  infinite-brain-os's multi-brain workspace: a thin parent folder whose
  `.claude/` layer routes between several brain repos mounted under
  `brains/`, each an independent repo with its own remote, `brains/*` ignored
  so no embedded-repo tracking occurs, one idempotent start command that
  clones or refreshes every brain. Its canonical entities are projected into
  `.claude/` and `.codex/` by a regeneration script because "your OS does not
  support symlinks," with the rule "edit the canonical file, then run the
  sync. Never edit a shim." Its retrieval budget is explicit: load the primary
  sequence in order, stop when the task is answerable, never pre-load a whole
  row.
- **The per-project file people write most often is a task list**, `todo.md`
  or `PLAN.md`, in five of ten repos. The per-project instruction file is the
  rarer choice.
- **Boundary is the rarest primitive** (three of nine), and all three are
  repos whose owner publishes the workspace. Boundary discipline is driven by
  an audience.
- **Names:** law `CLAUDE.md` (9), `AGENTS.md` (6). Index `INDEX.md` inside a
  folder (5), `START-HERE.md` (2), `RESOLVER.md` (2). The literal
  `PROJECTS-INDEX.md` has no public hit. Routing `projects/<slug>/` (4). Tool
  projections `.claude/` (8) with a one-line `CLAUDE.md` pointing at
  `AGENTS.md` (10 instances in one repo).
- **Unresolved:** whether Claude Code follows transitive `@` imports. The
  vendor doc says four hops. LifeOS ships a workaround built on the claim that
  it does not. Test on the installed version before relying on either.

### Agent OS and harness layers (slice 2, 7 repos and 4 vendor conventions)

Every claim cites `slice-2-agent-os.md`. Repos: LifeOS, agent-os,
superpowers, SuperClaude, BMAD-METHOD with five module clones read from the
owner's local cache, context-engineering-intro, icm-architect. Vendors:
Claude Code, Codex and agents.md, Cursor, Gemini CLI.

- **What all seven share:** durable behavior in plain Markdown on disk, the
  directory layout as the mechanism rather than documentation of one, a
  stable reference layer separated from a per-run artifact layer, records in
  dated or slugged folders rather than a database. Six of seven derive some
  state by scanning what exists on disk rather than reading a status field.
- **Systems that survive real work encode state as machine-readable fields a
  human can open.** BMAD's spec frontmatter `status` and its append-only
  deferred-work ledger, superpowers' per-plan `progress.md` whose first line
  asserts ownership. Systems that encode state as prose drift:
  context-engineering-intro's law orders the agent to read a `PLANNING.md`
  and `TASK.md` the repo has never shipped, and SuperClaude's state file is
  stale.
- **Only two of seven model the human at all** (LifeOS, icm-architect). The
  rest model a codebase and carry no owner profile. superpowers refuses the
  memory primitive on purpose because it holds that git is the record.
- **Enforcement splits three ways:** hooks plus machine-readable status
  (LifeOS, BMAD), one synchronous session-start hook plus an eval harness
  (superpowers), and prose the model may ignore (agent-os, SuperClaude,
  context-engineering-intro).
- **All four vendors concatenate instruction files and load the nearest
  last.** Precedence is position in a prompt, never replacement. No vendor
  guarantees compliance, and Claude Code and Gemini CLI both point at hooks,
  not stronger prose, when a rule must hold. Gemini CLI's experimental auto
  memory mines idle transcripts into a review inbox of patch and skill drafts
  approved through a command, which is the propose-then-apply shape again.
- **Two of seven name where their method loses and what evidence would
  change a rule** (icm-architect, BMAD). The rest do not.

**What BMAD teaches, read from the v6 modules on this machine.** BMAD was
meant as an input to how Vivary should change, so its mechanics are recorded
here as lessons, with the caveat that its fixed lifecycle is the opposite of
absorption.

1. **The spec file is a bounded capsule the implementer works from alone.**
   Frontmatter carries `status`, `route`, and a `context` list. The first
   three body sections (intent, boundaries, I/O matrix) sit inside a
   `frozen-after-approval` block marked human-owned. The template writes its
   own token budget: 900 to 1,300 tokens, with 1,600 named as high risk of
   context rot. The dispatch rule bans padding: no goal restatements, file
   lists, or house-style rules pasted in. The supervisor judges the diff, not
   the subagent's report. This is the same idea as Vivary's Task Capsule with
   a stricter size rule and an explicit frozen region.
2. **Planning and development are two output folders bridged by one compile
   step.** `_bmad-output/planning-artifacts` holds brief, PRD, UX,
   architecture, epics. `implementation-artifacts` holds stories and status.
   `compile-epic-context` reads the planning folder and emits one context file
   per epic with fixed headings, pulling only what that epic needs. The
   readiness gate identifies documents by reading them, not by filename.
3. **Status is a YAML file with a written update contract and a repair
   operation.** `sprint-status.yaml` carries epic, story, retrospective, and
   action-item states. A six-line contract says who sets which key, and a
   `fix-sprint-status` reference plus `validate` exist because the file does
   drift.
4. **Persona identity is split from persona behavior.** Name and title are
   hardcoded in the module config. Everything a user may change (activation
   steps, persistent facts, role, principles, menu) lives in a
   `customize.toml` that the updater never overwrites. A role is a skill
   directory, not a running worker, which matches Vivary's design rule.
5. **A domain pack is a peer of core that adds and never overrides.** It adds
   a module code, an agent roster, install-time questions that become config,
   a help CSV with one row per capability (phase, preceded-by, followed-by,
   outputs), and its own config file. CIS is the flat shape: eleven skill
   directories, six personas and five workflows, with the domain knowledge
   held as CSV method tables beside each skill rather than prose inside it.
   GDS is the phased shape: agents separate from workflows, workflows grouped
   into numbered lifecycle phases, and its own output split. This is the
   closest existing model for "a template is a bundle of patterns": add a
   roster, add procedures, add tabular knowledge, declare outputs, override
   nothing.
6. **The builder is a skill that writes skills**, and its agent template is
   the only place BMAD models memory: a curated `MEMORY.md` with a 1,500-token
   budget, append-only `sessions/YYYY-MM-DD.md` logs that are deliberately not
   loaded on waking, and a curation pass that distills logs into memory. Its
   guidance file states the premise: "You are stateless. Your sanctum is the
   ONLY bridge between sessions. If you don't write it down, it never
   happened." No shipped BMAD agent has this. A user instantiates it.
7. **Installed footprint is one root plus one output root.** `_bmad/` holds
   team and user config, a `custom/` overlay, scripts, and one config per
   module. Outputs go to a sibling `_bmad-output/`. Projections are skills
   only, one directory per tool, no rules files and no commands.
8. **What BMAD does not do:** no owner profile beyond a name, a language, and
   a self-reported experience level. No machine tier. No capture inbox. No
   learning loop in core: retrospectives append action items, nothing promotes
   a repeated finding into a rule, no skill edits another skill.
9. **BMAD Loop is a deterministic Python outer loop, not an LLM.** Story
   selection, retries, gates, and completion checks run in plain Python, on
   the stated grounds that an LLM orchestrator is nondeterministic and spends
   tokens on control flow. What carries between iterations is one append-only
   ledger, `deferred-work.md`, with three rules worth taking as they are:
   never rewrite or delete an entry. On a repeat, add a `seen-again` line
   instead of a duplicate. Write `location: n/a` explicitly and define it as
   "no location was recorded," not "this item has none." Gates are per story,
   one before code and one after the commit, because a run-global gate cannot
   ask for a plan review on this story only. A pass that keeps recommending
   its own follow-up is honored a bounded number of times, then the
   recommendation is re-filed to the ledger instead of burning cycles. Policy
   is per machine and ignored by git. This is the Harness-of-Harness shape
   with a ledger and per-item gates added.

**Names in this slice:** law `CLAUDE.md` (8), `AGENTS.md` (6), `CONTEXT.md`
(2). State `sprint-status.yaml`, `progress.md`, `TASK.md` and `PLANNING.md`
(2, propagated as a pair). Index `index.yml`, `MEMORY.md`, `FILE-MAP.md`,
`module-manifest.toml`. Five of seven generate their index rather than
hand-write it.

## The minimal universal set

H1 named five roles. The evidence keeps four, corrects one, and adds one.

| Role | Verdict | Evidence |
| --- | --- | --- |
| Law | Universal | Every workspace people work inside carries one, in all four kinds. The only misses are libraries whose agents do not outlive a process (slice 3) and BMAD, which re-derives routing from disk on each request (slice 2). Vendors concatenate, load nearest last, and guarantee nothing. A rule that must hold is a hook (slices 2, 4). |
| Map | Universal, and generated | Nine of eleven vaults, most agent OS and orchestration systems, four of nine roots carry one. Five of seven agent OS systems generate it. The repos without one are the repos with the most instruction files, and that absence is the failure mode (skmtc, slice 4). Vivary's own program index is already generated and marked do-not-edit. |
| Record | Universal | A dated, append-only trace in every self-maintaining system (13 of 13, slice 5), a log in every vault, evidence bound to commit SHAs in every serious orchestration system. Sub-shape: raw trace plus index plus log. |
| Memory | Universal where a person is the audience, absent where the product is reviewed by others | All five personal roots and nearly every vault carry it. None of the four code monorepos and only two of seven agent OS systems do (slices 2, 4). Vivary's "knows you" requirement puts it in the minimal set. |
| State | Not a primitive file. A view derived from Record and the task graph | One of eleven orchestration systems keeps a state file (slice 3). Six of seven agent OS systems derive state by scanning disk (slice 2). Vaults keep an overview or hot page (slice 1). The hand-kept state files in the sample are the stale ones (SuperClaude, context-engineering-intro). BMAD keeps status as machine-readable YAML with a repair operation. |
| Boundary | Added. Universal for anything that runs a loop or is published | Every coordinating orchestration system declares runtime versus durable, usually as a `.gitignore` inside the state directory (slice 3). Every self-maintaining system separates raw from durable from procedure (slice 5). Rare in private personal roots (three of nine) and driven by audience (slice 4). Vivary runs loops and is a product, so it is in. |

The minimal set is therefore Law, Map, Record, Memory, and Boundary, with
State computed from Record by the harness rather than maintained by hand.
The original thin contract has Law and a hand-maintained State, and lacks
Map, Memory, and the raw-versus-durable Boundary as first-class files.

## Extension layers and when they appear

Each extension is owned by a kind of work. A template declares which it
carries.

| Extension | Who carries it | Who does not | Smallest form seen |
| --- | --- | --- | --- |
| Capture inbox | Eight of eleven vaults, four of five personal roots | Zero of eleven orchestration systems, zero of four code monorepos | A `raw/` or `inbox/` folder whose contents the agent never edits, plus a frontmatter status field (`processing_status: pending_review`) |
| Task graph | Orchestration, personal productivity roots, BMAD | Wikis, which treat a source as the unit of work | A `todo.md` or `PLAN.md` per project, the most common per-project file in the multi-project sample (five of ten) |
| Roles | Every coordinating orchestration system, five of seven agent OS | Two of eleven vaults | One Markdown file per role with YAML frontmatter, `.claude/agents/<name>.md` as the de facto schema. Identity split from customizable behavior (BMAD) |
| Claim ledger and handoff | Orchestration only | Everyone else | Two families: an atomic first-writer-wins claim, or a committed ownership table with one owner per file. The two most rigorous handoffs derive the summary from the transcript or diff rather than writing a file |
| Evidence and receipts | Orchestration and code monorepos. Five of eleven vaults ship a checker | Personal roots | A verdict bound to exact commit SHAs, a machine-readable file beside a human-readable one, and a missing or extra path treated as a hard stop |
| Gates | Everyone who has run for a while | Fresh templates | Vaults gate three moments: page, staging exit, network. Orchestration gates three actions: push, publish, merge. Personal roots gate canon promotion. Self-maintaining loops gate promotion per item |
| Skills | Near universal (`SKILL.md` in 8 of 11 orchestration, 6 of 11 vaults, 8 of 10 roots) | Almost no one | `skills/<name>/SKILL.md`, with a deterministic script beside it in the stronger systems |
| Maintenance loop | Everyone who has run for a while | Fresh templates and libraries | Capture plus consolidate plus index plus log, then gated promotion. Health free every session. Lint priced every ten to fifteen ingests |
| Tool projections | Portable systems (superpowers nine, BMAD six) | Claude Code monocultures | One canonical folder, generated mirrors per tool, a sync script where symlinks are unavailable, and the rule "never edit a shim" |
| Multi-project routing | Roots and coordinating systems | Single-project workspaces | A routing artifact by task class, intent, subtree, or alias. A parent folder that mounts child repos and ignores them. A first-message question that scopes the session |

The two kinds of work that never co-occur in the sample are worth naming:
no workspace holds both a capture inbox and a claim ledger, and almost none
holds both a task graph and an evidence layer. Those are the seams a
composable template can cross that no single existing system does.

## Absorption: what the evidence says about changing shape

Jeff's requirement: a project planned as one thing becomes another a few
iterations later, and the old material is absorbed into the new at once.
Also: adopting a full folder, merging two projects, splitting one, changing a
project's kind. The code trace of what the CLI does today is in the next
section. What the surveyed systems do:

- **What breaks on a move is a hardcoded path, never a file.** Slice 4 rates
  routing maps and `@` imports that name paths as high fragility, glob-scoped
  rules in a central file as high, and per-directory files that travel with
  their folder as low. Nx resolves by project graph rather than path and is
  the lowest. The owner's own machine record says the same: a path-keyed
  memory store died with its folder, and structure that lives in an index
  survived a reorganization.
- **Serious systems identify documents by reading them, not by filename.**
  BMAD's readiness gate states it. Letta's init reads existing instructions,
  a manifest, and READMEs and updates an existing memory topic in place rather
  than duplicating it (Letta study). ICM does the opposite, fixing stages as
  numbered folders, and its README lists branching work as a poor fit.
- **The two most rigorous handoffs write no handoff file.** Entire and
  openai-agents derive the summary from the transcript or the live diff
  (slice 3). Derived artifacts cannot go stale.
- **Nothing is deleted. Everything superseded gets a tombstone and link
  repair.** agent-context-os's archive action appends a tombstone row, moves
  the file, and rewrites links in three directions, inbound, outbound, and
  the index line, with a three-way classifier that resumes a half-applied
  archive (slice 5). hermes-agent archives with a restore command. LifeOS
  snapshots before every overwrite.
- **Merging content into a populated folder is the case every system
  avoids.** The catalog scopes template additions to a verified empty child.
  The original adopter appends marked sections and refuses conflicting
  managed content. claude-obsidian's transaction contract is the only
  mechanism found that can apply a multi-file change into a live vault
  safely: hash every target, draft without writing, inspect, apply once
  against the approved hash, fail on a concurrent edit.
- **A parent can hold projects without owning them.** infinite-brain-os
  mounts child repos under `brains/`, ignores them, and refreshes them with
  one idempotent command. Each child keeps its own remote and lifecycle.

What follows for Vivary, as a proposal:

1. **The contract records role assignments and pattern selections, not a
   preset name.** Which file plays Law, Map, Record, Memory, Boundary, and
   which patterns are present. Changing a project's kind is an edit to that
   assignment plus a plan that adds or removes patterns. The four preset
   names stay as an input that expands to an assignment, which keeps
   outcome 07's compatibility rule.
2. **Every cross-reference goes through the generated Map.** Instruction
   files name roles and patterns, never paths. A move is an index
   regeneration.
3. **Merge is a union with named conflict classes.** Two Laws concatenate
   under managed blocks, which is what every vendor does anyway. Two Maps
   regenerate. Two Memories merge under the three-or-more promotion rule with
   tombstones for the losers. Two Records append and interleave by date. Two
   Boundaries union. Raw sources stay immutable on both sides.
4. **Split is a partition of index entries.** Each side gets a regenerated
   Map. Shared Memory is copied, not moved. Records stay with the side that
   produced them and the other side gets a pointer.
5. **Adopting a populated folder is inference, then a plan.** Read the
   folder the way Letta's init does, infer which files already play which
   role, propose the assignment, apply against the plan hash the adopter
   already uses. Never move a user file.
6. **The GUI answers "which project is this session in" by mechanism.** A
   first-message question or an alias table, the two mechanisms slice 4
   found. Never by assumption.

What the CLI does for each of these today, from slice 6: the preset is
immutable and the refusal names the wrong cause (S1). Adoption discards the
brownfield inventory it computes and cannot apply into any folder whose names
overlap the type vocabulary, while the dead legacy adopter held the per-path
excludes and module routers that would have handled it (S2). Merge has no
path, competing roots are refused, and slug-derived node ids collapse
silently (S3). Split guarantees broken edges and a failing Doctor (S4).
Every item in the list above is therefore new mechanism, not a repair, and
the first item, the assignment contract, is what makes the other five
expressible.

## What self-maintaining workspaces share

Slice 5 read thirteen systems that let a file-based workspace grow, repair, and
prune itself: WikiSkill, Karpathy's llm-wiki, Voyager, Letta MemFS and
dreaming, Claude Code auto memory, Codex memories, obsidian-second-brain,
claude-obsidian, LifeOS Cortex, hermes-agent, agent-context-os, year-of-ai,
and sebastian-ai. Every claim below cites `slice-5-self-maintaining.md`.

**The floor is three operations and one boundary.** All thirteen capture a
dated, append-only trace. Eleven consolidate that trace plus the current
durable set into durable knowledge. Every one keeps an index that says what
exists and a log that says what happened. The boundary every system draws is
between knowledge, which accumulates and is cheap to be wrong about, and
procedure, which changes behavior and is therefore gated. WikiSkill states
the payoff: when a skill change rolls back, the wiki that motivated it stays,
so a failed promotion never costs the lesson. Codex states the same thing as
doctrine: memories are recall, and `AGENTS.md` is where rules that must
always apply live.

**They split on who approves a promotion.** Three answers exist. An automatic
numeric gate on a held-out score (WikiSkill, Voyager's critic). A confidence
threshold that separates automatic from human (LifeOS auto-applies at 0.70
and asks between 0.40 and 0.69). A human answering one proposal at a time
(agent-context-os, claude-obsidian, obsidian-second-brain). Which one a
workspace can use depends on whether it has a runnable score. Knowledge work
does not, so it lands on the third.

**The strongest gating shape is a two-command split.** The consolidate pass
writes a proposal artifact and nothing else. A separately invoked apply
command validates that artifact with an executable checker and walks
proposals one at a time through a human answer. agent-context-os ships it as
`/dream` plus `/dream-apply`, both marked so the model cannot invoke them.
claude-obsidian ships the same shape as `transaction inspect` followed by
`transaction apply` bound to the approval hash of the inspected plan, and a
concurrent edit fails the apply instead of being clobbered. This is the same
contract the original Vivary adopter already uses for its plan hash, which
means the mechanism exists in the codebase and is applied only to adoption.

**Pruning is reversible by construction, not by policy.** hermes-agent's
curator never deletes, only archives, with a restore command. agent-context-os
refuses to remove a memory file without a tombstone row. LifeOS snapshots
every automatic overwrite into a thirty-deep ring buffer, added after a
cross-vendor audit wiped its live memory file with an empty set operation.
The rule the owner's own workspace already follows, move to `archives/`
rather than delete, is the same rule.

**Bounds and thresholds people converge on.** Index files are held to 100 to
200 lines (Claude Code 200 lines or 25 KB, agent-context-os 100 lines,
sebastian-ai about 100 lines on any indexed file). A fact seen three or more
times becomes a promotion candidate (obsidian-second-brain). At most three
instruction edits per cycle, biased toward deletion (year-of-ai). One skill
change per iteration (WikiSkill). Hot memory is small and always loaded, the
rest is cold and addressable: Letta's `system/` directory, LifeOS's 48-entry
hot layer, hermes-agent's frozen snapshot at session start.

**Triggers that need no scheduler.** Codex waits for a chat to go idle before
summarizing it, which avoids consolidating half-done work. hermes-agent fires
its curator when the agent is idle and the last run is older than an interval.
LifeOS gates its reviewer on three conditions at once: eight turns, thirty
minutes since the last review across all sessions, and two minutes idle.

**Names people use.** Raw traces: `raw/` (3), `sessions/`, `telemetry/`,
`journal/`. Durable knowledge: `wiki/` (4), `memory/` (5). Index: `index.md`
(5), `MEMORY.md` as index (3). Log: `log.md` (3). Procedures:
`skills/<name>/SKILL.md` (5), `CLAUDE.md` or `AGENTS.md` (7),
`.claude/commands/*.md` (4). Consolidate command: `consolidate` (3), `dream`
(2), `learn` (2), `ingest` (2). Repair command: `lint` (3), `health` (2),
`doctor` (2).

What this settles for H4: the memory primitive needs a raw layer, a durable
layer, an index, a log, and a procedure layer, with promotion gated by a human
one item at a time. What it does not settle: where owner facts live relative
to project facts. That waits on slices 2 and 6.

## The owner memory layer

Jeff's requirement: the agent should feel like it knows the owner because of
what is in the files, and work should be saved into the file system.

- **Three scopes exist in practice and almost nobody separates all three.**
  Owner (LifeOS's principal files, `USER.md` in two personal roots, hermes's
  `USER.md`, Letta's `human.md`), project (Claude Code's memory keyed to the
  git repo, BMAD's sanctum, every vault), and machine (no surveyed system
  keeps a per-machine facts file. Slice 4 calls it a gap even in
  infinite-brain-os, which references multiple hosts). The owner's own root
  keeps all three: `Brain/USER.md`, per-repo harness memory, and
  `~/MACHINE.md` with a byte budget.
- **Memory lives outside the project when the person is the unit.** Claude
  Code, Codex, hermes, and Letta all keep memory in the home directory,
  machine-local, keyed to a repo or a profile, and deliberately not synced.
  Owner memory that lived inside one project would be lost to the next.
- **The shape converges.** A bounded index (100 to 200 lines) plus unbounded
  topic files, a raw session log that is never loaded at start, a hot layer
  that is always in context and small (Letta's `system/`, LifeOS's 48
  entries, BMAD's 1,500-token sanctum, hermes's frozen snapshot), and the
  rest cold and addressable.
- **Writing is cheap and promotion is gated.** Capture runs mid-session
  without asking (Claude Code, hermes, Letta). Consolidation runs on idle or
  session end and writes a proposal. Promotion into the index or into
  procedure goes through a human, one item at a time, in every system that
  lacks a runnable score (slice 5). Gemini CLI's review inbox is the newest
  vendor version of that shape.
- **Forgetting is omission plus a snapshot, never deletion.** LifeOS drops a
  stale fact by leaving it out of a full-set rewrite, with a ring buffer
  behind it and two guards against suspicious shrink. hermes and
  agent-context-os archive with restore.
- **The four note types Claude Code stamps** (`user`, `feedback`, `project`,
  `reference`) give a prune pass something to sort on, and match the owner's
  own memory convention on this machine.

**Relation to the Codex agent's memory note.** The
[file memory note](file-memory-and-persistence.md) landed in the same folder
during this research. It reads three systems where slice 5 reads thirteen,
and the two agree on the shape: curated files separate from history, a
compact always-loaded surface with details retrieved on demand, one owner per
fact, forgetting that removes a note from retrieval while history copies are
explained rather than denied, and initialization from the selected folder.
This note goes further in three places the smaller sample could not reach:
the owner, project, and machine scope split, promotion gated per item through
a propose-then-apply pair, and archive with a tombstone in place of deletion.
The one disagreement is `STATE.md`. That note keeps its original
responsibility as a hand-maintained file. The evidence in slices 2 and 3 is
that hand-maintained state files are the ones that go stale, and that the
systems which survive real work derive state from records and machine-readable
status fields. The proposal here treats State as a derived view. design.md
should settle that one.

What follows for Vivary, as a proposal:

1. **Memory is a pattern with three homes.** Owner memory in a location the
   owner chooses once, outside any project, referenced by every project's
   Law. Project memory inside the project. Machine memory at the user root
   with a byte budget. Each home has the same shape: `MEMORY.md` index under
   a line bound, topic files, `sessions/` raw log not loaded at start.
2. **Tropo indexes memory as typed nodes**, so a governed find returns owner
   facts inside the capsule. Today the thin contract has no memory slot for
   it to index (see the code trace).
3. **Session end writes a Record.** Idle or session end triggers a
   consolidation that writes a proposal artifact and nothing else. The GUI
   shows a proposal inbox. Apply is per item, bound to the plan hash the
   adopter already uses. This is the two-command split from slice 5 applied
   to memory.
4. **Never delete.** Archive with a tombstone row, snapshot before an
   overwrite, and a restore command.

Where the thin contract can and cannot hold an owner fact today, from
slice 6: nowhere by name. The five files have no owner, profile, or memory
entry, and the two legacy templates that held exactly those fields
(`USER.template.md` with name, timezone, role, teach-versus-do, ask-before,
never-make-public. `MEMORY.template.md` with focus, preferences, boundaries,
locked decisions, lessons, open loops, superseded) sit unused in the assets
folder. The one private directory is excluded from retrieval. The working
substitute is a `decision` record, which needs a git repository to obtain a
capsule, a supersession lifecycle a standing preference does not have, and
lexical retrieval that returns nothing for a query with no shared words.
Nothing in the contract loads any file unconditionally at session start, so
even a stored fact is only found when asked for in its own vocabulary. Ozone
then reports it as an orphan. The memory pattern above is therefore a
restoration of two dropped files in the shape the surveyed systems converge
on, plus the three-scope split none of them make. Where vendor conventions put user versus project
versus machine facts, what the thin contract dropped from the legacy
`USER.template.md` and `MEMORY.template.md`, and what the maintenance loops
gate.

## Template list for Vivary

Two levels, per H3. A pattern is a file set, the paragraph that tells the
agent how to use it, its maintenance loop, and its gate. A starting point is
a pattern selection with defaults. BMAD's domain pack is the closest existing
model for the second level: it adds a roster, procedures, tabular knowledge,
and declared outputs, and overrides nothing.

### Pattern library

| # | Pattern | Files | Loop | Gate | Seen in |
| --- | --- | --- | --- | --- | --- |
| 1 | Law | `AGENTS.md` with managed blocks, one-line `CLAUDE.md` pointer, per-tool mirrors | None. A rule that must hold becomes a hook | Editing the law is a gated change | All slices |
| 2 | Map | Generated `index.md`. A routing table by task class for roots | Regenerated on every change, never hand-edited | None | Slices 1, 2, 4 |
| 3 | Record | `log.md` with `## [YYYY-MM-DD] op \| title`. `raw/` or `sessions/` append-only | Append only | None | Slices 1, 3, 5 |
| 4 | Memory | `MEMORY.md` index under a line bound, topic files typed user, feedback, project, reference, `sessions/` unloaded | Capture free. Consolidate on idle writes a proposal. Apply per item | Promotion into index or procedure | Slices 2, 4, 5 |
| 5 | Boundary | `.gitignore` inside the state dir, `private/`, `runtime/` | None | None | Slices 3, 5 |
| 6 | Capture inbox | `inbox/` or `raw/`, immutable, `status` frontmatter | Ingest one source at a time. Index and log updated | Source leaves staging | Slices 1, 4 |
| 7 | Sources and synthesis | `sources/`, `concepts/` or `wiki/`, `entities/`, claim fields `supports`, `contradicts`, `confidence` | Lint for contradictions, orphans, stale claims. Priced every ten to fifteen ingests | A synthesized answer becomes a page | Slice 1 |
| 8 | Task list and task graph | `todo.md` or `PLAN.md` per project. Tickets with `blocked-by`. A status YAML with an update contract and a repair op | Status derived by scanning. A repair op exists because it drifts | None | Slices 2, 3, 4 |
| 9 | Roles | `agents/<name>.md` with frontmatter. Identity fixed, behavior in a user overlay the updater never overwrites | None | None | Slices 2, 3 |
| 10 | Claim ledger and handoff | Ownership table, one owner per file per lane. Three-field receipt (what changed, one command that proves it, what remains) | Check-ins with a stated cadence. Orphan ruling resume or restart | Collision goes to a named conflict owner | Slice 3, catalog Dropped Work |
| 11 | Evidence and receipts | `evidence.json` beside `report.md`, verdict bound to commit SHAs, a shipped-path manifest | Missing or extra path is a hard stop | Verdict precedes merge | Slice 3 |
| 12 | Gates | Named moments written in the law: page, staging, network. Push, publish, merge. Canon promotion | None | These are the gates | Slices 1, 3, 4 |
| 13 | Skills | `skills/<name>/SKILL.md` plus a deterministic script beside it | Curator pins, archives, or patches on inactivity | A skill edit is gated. One per iteration | Slices 1, 2, 3, 5 |
| 14 | Maintenance loop | `lint`, `health`, `doctor` as commands. A proposal artifact dir. `ARCHIVE.md` tombstones | Health free every session. Consolidate proposes. Apply per item. Archive never delete | Every apply | Slices 1, 5 |
| 15 | Tool projections | One canonical folder, generated `.claude/`, `.codex/`, `.agents/` mirrors, a sync script | Regenerate after any canonical edit. Never edit a shim | None | Slices 2, 3, 4 |
| 16 | Multi-project routing | Parent root, children mounted and ignored, routing table, first-message scope question | One idempotent refresh command | Cross-child writes | Slices 3, 4 |
| 17 | Domain pack | Roster, procedures, CSV method tables, declared outputs, help table with phase and order | None | None | Slice 2 (BMAD CIS and GDS) |
| 18 | Outer loop | Planner, developer, and tester roles. `deferred-work.md` append-only ledger with seen-again and explicit n/a. Per-item checkpoints before code and after commit. Evidence carried forward | Bounded re-recommendation, then re-file | Per story, two checkpoints | Slice 2 (BMAD Loop), HoH brief |

Patterns 1 to 5 are the minimal set. Pattern 18 requires an oracle, which is
the manifest field ticket 19 already proposes. A workspace without one cannot
run it.

### Named starting points

Each is a manifest naming its patterns, its defaults, its audience (private
or reviewed), and its oracle or none. Names stay editable. Where a catalog
template already exists it is the content source, per the design's rule that
the catalog owns content and Vivary owns composition.

| Starting point | Patterns beyond the minimal five | Audience | Oracle | Catalog content |
| --- | --- | --- | --- | --- |
| Second brain | 6, 7, 8 (task list only), 14 | Private | None | Linked Notes, Projects and Areas, Daily Journal |
| LLM wiki | 6, 7 with claim ledger, 14 with lint | Private | Lint script | Named gap in the catalog's ranking |
| Research campaign | 6, 7, 8, 11 (checker), 12 with stop rules | Private or reviewed | Source checker | Research Method Wiki, the Autoresearch decision |
| Writing project | 7 (brief and drafts), 13 (review skill), 12 | Private | None | Existing `writing` preset content |
| Coding project | 8, 11, 13, 12 (push, publish, merge) | Reviewed | Test command | Existing `coding` preset, Project Brain |
| Client engagement | Coding project plus a scope record and a dated comms log | Reviewed | Test command | Client Hub |
| Life operations | Second brain plus 8, 5 with a privacy rule, recurring runs | Private | None | The catalog's mainstream expansion batch |
| Agent OS | 9, 13, 14, 15 | Private | None | Agent Harness |
| Multi-agent delivery | Coding project plus 9, 10, 11, 18 | Reviewed | Required | Dropped Work, Review Deadlock |
| Multi-project root | 16, 15, 8 per child, 4 owner scope at the root | Private | None | The owner's AIS-OS root is the working example |

A domain pack (17) is an add-on to any starting point, not a starting point.
The audience column is the switch slice 4 found: private roots carry memory
and an inbox, reviewed roots carry receipts and gates.

## Delivery hypothesis for the program

A proposal for the program's order, mapped to the outcomes that already own
the work. It changes no ticket contract.

1. **Role-assignment contract first.** Extend the workspace configuration
   so it records which file plays each of the five roles and which patterns
   are present. The five-file base maps onto it unchanged: `AGENTS.md` is
   Law, `context.md` is its detail, and `STATE.md` becomes a derived view.
   Preset names expand to an assignment. Owner: outcome 07. Proof: scenario
   S1 (change kind after creation) becomes an assignment edit plus a plan.
2. **Memory pattern second.** Owner scope outside the project, project scope
   inside, machine scope at the user root. Index bound, typed topics,
   unloaded session log, propose-then-apply curation using the existing plan
   hash. Tropo indexes it. Dogfood on the owner's own root before any GUI
   work. Owner: outcome 07 for creation, 11 for editing. Proof: S5, a durable
   owner fact stated in one session appears in the next session's capsule.
3. **Generated Map and derived State third.** The harness generates the
   index and computes the state view from records and the task list. Proof:
   S2, adopting a folder of 400 notes yields a usable index without
   frontmatter edits, and no hand-kept state file exists to go stale.
4. **Adoption by inference fourth.** The adopter reads a populated folder,
   proposes role assignments, applies against the plan hash. Never moves a
   user file. Owner: outcome 08. Proof: S2 end to end.
5. **Merge and split as index operations fifth.** Union with named conflict
   classes, partition by index entries, tombstones and three-direction link
   repair. Owner: outcome 08. Proof: S3 and S4.
6. **Pattern library and starting points sixth**, in the catalog's demand
   order, each as a manifest. The oracle field stays with ticket 19.
7. **GUI last**: the first-message scope question, the proposal inbox, one
   writer per project, then the template picker. Owner: outcomes 07, 11, 19.

The seven scenarios in slice 6 are the acceptance test. They are run against
the current CLI now for a baseline, and they must pass before a GUI template
picker ships. What falsifies H3: if the nineteen catalog templates cannot be
expressed as pattern selections without per-template code, the two-level
list is wrong and the catalog's content layer has to carry more than
content.

Each step is one verifiable unit. Step 1 is the smallest change that makes
the other six possible, and it removes the preset as the unit of identity,
which is the specific thing Jeff named as wrong.

## Uncertainties

Each slice carries its own list. The ones that could change a conclusion:

- **Model-summarized sources.** Karpathy's gist in slice 5, the WikiSkill
  paper, and the Claude Code, agents.md, Cursor, and Codex doc pages were
  read through a fetch that summarizes through a model. Slice 1 re-read the
  gist verbatim from the raw endpoint and matched. The vendor doc quotes
  carry more paraphrase risk than the repo quotes, which were read
  byte-exact at pinned SHAs.
- **Transitive imports in Claude Code.** The vendor doc says four hops.
  LifeOS ships a workaround built on the claim that it does not follow them.
  Unresolved. Test on the installed version.
- **beads record fields** come from its agent-instruction templates and CLI
  reference, not from a JSONL line, because the export file exceeded the
  contents API limit.
- **ruflo's written layout** comes from its README table and `.gitignore`,
  not from a template directory, which was not found in the tree.
- **BMAD's installed tree** is assembled from docs and module manifests. The
  installer was not run. The module clones were read from the owner's local
  cache and matched their own manifests. GDS reports two versions across two
  files.
- **Slice 6 ran in-repo code**, not a released install, because `vivary-core`
  is not installed on the box. `exo control` and `ozone verify` were not
  exercised. Their verdicts are traced from the shared capsule precondition.
  The synthetic vault had uniform note bodies, which demonstrates the lexical
  tie rule cleanly and overstates how often real notes tie.
- **The checkout moved during the trace.** Slice 6 read SHA `6f7db03`. The
  Codex agent had advanced the branch to `36e1ebf` by the time this note was
  placed. Line numbers in slice 6 are pinned to the SHA it names.
- **Evidence of real use is thin everywhere.** It rests on commit-author
  names in short windows, committed artifacts, and dated incident notes.
  Commit-author names are self-reported.
- **Code search is a ranked sample, not a census.** Repos matching every
  slice exist that the queries did not surface. The `llm-wiki` topic shows
  signs of automated repo creation and was not investigated.
- **Cursor precedence** between user rules, project rules, and `AGENTS.md`
  is not stated on the page read. **VS Code multi-root** instruction
  discovery is undocumented.
- **Nothing was cloned, installed, or executed** from any surveyed
  repository. The only code run was Vivary's own, against scratch
  directories on Zo that were deleted afterward.

## Sources

The six slice files sit beside this note under `slices/`. Each carries a
per-claim citation with URL, SHA or page date, and access date 2026-09-13.
The local sources are named inline. Three slice files keep an em dash inside
a quoted filename or issue title so the citation stays findable. The prose
of this note and the slices carries none.
