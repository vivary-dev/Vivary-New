# Slice 2: Agent OS, personal AI infrastructure, and harness workspaces

Supplied research input. Read the [source reconciliation](../workspace-research-reconciliation.md) before using
its claims or delivery order. The accepted plan is the program frontier.

Structural read of seven repositories and four vendor instruction-file conventions. All
claims trace to a file in the named repo or to that vendor's own docs. Accessed
2026-09-13. Repo content read from the pinned SHA in each record.

Scope note: this is a structural read only. Traction and pricing were covered by a
separate survey and are not repeated. Star counts appear once per repo as identity
metadata, from `gh api repos/OWNER/REPO`.

---

## Primitive vocabulary used

1. Law (instruction file read first)
2. State surface (current focus, status, next, blockers)
3. Index or map (routes to everything else)
4. Capture inbox (unprocessed input lands here)
5. Durable memory (facts about user, project, machine)
6. Dated log (journal, daily notes, changelog, session traces)
7. Records (decisions, changes, verification, ADRs)
8. Skills or procedures (SKILL.md, slash commands)
9. Roles or agent definitions
10. Task graph (tickets, issues, board, dependencies)
11. Handoff or claim ledger
12. Evidence or receipts
13. Gates (named human approval points)
14. Boundary (private, runtime, ignored paths)
15. Maintenance loop (consolidate, repair, rebuild, prune)
16. Tool projections (`.claude/`, `.cursor/`, `.agents/`, `.codex/`)
17. Multi-project routing (a root holding several projects)

Two primitives this slice forced me to add, because more than one repo carries them and
the list above does not name them:

18. **Factory/product split**: stable reference material kept structurally apart from
    per-run artifacts. Named explicitly by icm-architect and agent-os; implicit in BMAD
    and LifeOS.
19. **Generated index**: an index rebuilt by script from file frontmatter, with a written
    prohibition on hand-editing it. Distinct from primitive 3, which is hand-authored
    routing.

---

### danielmiessler/LifeOS

- URL: https://github.com/danielmiessler/LifeOS
- Stars 19,005 · forks 2,465 · last push 2026-09-04T01:07:21Z · license MIT
- SHA read: `5e2f2e8c0abde612da0e99c16c0d07d4ec21b88c` (branch `main`)
- Created 2025-09-08. Formerly PAI. 56 open issues.
- Purpose: a single installed harness that claims to move one named human (the
  "principal") from a described current state to a described ideal state, with a named
  assistant persona (the "DA") running every session under one constitutional prompt.

**Entry files the agent is told to read, in order**

The installed root is `~/.claude/`, not the repo. Order is stated in
`LifeOS/install/CLAUDE.template.md` and the system prompt:

1. `LIFEOS/LIFEOS_SYSTEM_PROMPT.md`, loaded via `--append-system-prompt-file`. It holds
   five numbered CONSTITUTIONAL rules and wins any conflict: "When this file and the
   system prompt disagree, the system prompt wins."
2. `~/.claude/CLAUDE.md` (from `CLAUDE.template.md`), described in itself as "the
   **routing table**".
3. One mandatory `@`-import: `@LIFEOS/DOCUMENTATION/ARCHITECTURE_SUMMARY.md`.
4. Five identity imports, shipped commented out and uncommented by
   `skills/LifeOS/Tools/ActivateImports.ts` during `/LifeOS setup`:
   `USER/TELOS/PRINCIPAL_TELOS.md`, `USER/PRINCIPAL/PRINCIPAL_IDENTITY.md`,
   `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md`, `USER/PROJECTS.md`,
   `USER/CONFIG/OPERATIONAL_RULES.md`.
5. For substantial work only: `~/.claude/LIFEOS/ALGORITHM/LATEST` for a version string,
   then `~/.claude/LIFEOS/ALGORITHM/v${V}.md`.

The template records a harness constraint as the reason for its own shape: "Claude Code
does not follow transitive @-imports, so each must be listed here directly."

**Layout written into the install target (`~/.claude/`), top two levels**

```
~/.claude/
├── CLAUDE.md                  routing table (from install/CLAUDE.template.md)
├── settings.json              from settings.system.json + settings.enhancements.json
├── .env                       secrets (USER zone)
├── LIFEOS/
│   ├── LIFEOS_SYSTEM_PROMPT.md    constitutional rules
│   ├── LIFEOS_StatusLine.sh
│   ├── VERSION
│   ├── ALGORITHM/             LATEST, v8.20.2.md, ideate-loop.md, optimize-loop.md,
│   │                          eval-guide.md, changelog.md, archive/
│   ├── RULES/                 Philosophy.md, SelfHealing.md, Verification.md
│   ├── DOCUMENTATION/         ~30 subsystem docs (Memory, Hooks, Skills, Agents,
│   │                          Ledger, Upgrades, Atlas, Synapse, Work, Security,
│   │                          Testing, SystemUserBoundary.md, ...)
│   ├── TOOLS/                 models.ts, ascent.ts, Inference.ts
│   ├── ATLAS/                 collectors for Github, Cloudflare, Systemd, Launchd,
│   │                          Secrets, Projects, Gear, InfraInventory
│   ├── PULSE/                 dashboard on localhost:31337, VoiceServer, plists
│   ├── HERMES/                optional sidecar
│   ├── USER_TEMPLATES/        Beliefs, Books, Goals, Identity, Pronunciations
│   ├── CORTEX_INDEX_POLICY.json
│   ├── USER/        → symlink to ~/.config/LIFEOS/USER/   (private)
│   └── MEMORY/      → symlink to ~/.config/LIFEOS/USER/MEMORY/  (private)
├── skills/       56 skills, each a dir with SKILL.md + Workflows/
├── agents/       8 defs: Max, Forge, Gemini, Grok, ClaudeResearcher, CodexResearcher,
│                 GeminiResearcher, PerplexityResearcher
├── commands/     7: context-search, cs, grill-me, isdown, lu, teach-me, tm
└── hooks/        ~50 *.hook.ts + hooks.json + handlers/ + lib/
```

`USER/` (private, deleted from every release) holds `PRINCIPAL/`, `DIGITAL_ASSISTANT/`,
`TELOS/`, `CONFIG/`, `FINANCES/`, `HEALTH/`, `WORK/`, `SECURITY/`, `CUSTOMIZATIONS/`,
`Daemon/`, plus flat files `ABOUTME.md`, `OPINIONS.md`, `CONTACTS.md`, `DEFINITIONS.md`,
`GEAR.md`, `FEED.md`, `PROJECTS.md`, `CANONICAL_CONTENT.md`, `AI_WRITING_PATTERNS.md`.

`MEMORY/` is not in the repo, but `DOCUMENTATION/SystemUserBoundary.md` enumerates its
subtrees and splits them: git-tracked durable set is `KNOWLEDGE`, `WORK/<slug>/ISA.md`,
`RELATIONSHIP`, `WISDOM`, `PLANS`, `RESEARCH`, `STATE/work.json`, `BOOKMARKS`,
`REFERENCE`, `SKILLS`, `PROJECT`, `TEAMS`, `SYSTEMUPDATES`, `VERIFICATION`; gitignored
ephemeral set is `OBSERVABILITY` JSONLs, `_BROWSER_STATE`, `LEARNING` signals,
`SECURITY`, `VOICE`, `STATE` caches, per-skill runtime state, `PULSE_DATA`,
`SCRATCHPAD`, `RAW`, `AUTO`, `CALLS`, `INBOX`, `ARCHIVE`, `DATA`.

**Primitives present**

1. Law: `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` (constitutional, five numbered rules) plus
   `~/.claude/CLAUDE.md` as subordinate routing.
2. State surface: `USER/TELOS/LIFEOS_STATE.json` (dimension percentages read by Pulse
   rings and statusline); per-task state is an ISA file; `MEMORY/STATE/work.json`.
3. Index: `CLAUDE.md` is explicitly the routing table; `DOCUMENTATION/ARCHITECTURE_SUMMARY.md`
   is the one auto-loaded map; `CORTEX_INDEX_POLICY.json` governs the memory index.
4. Capture inbox: `MEMORY/INBOX` (ephemeral tier, per SystemUserBoundary.md); Synapse is
   documented as "capture → amber ledger → grade vs TELOS → route"
   (`DOCUMENTATION/Synapse/SynapseSystem.md`).
5. Durable memory: `MEMORY/KNOWLEDGE/` (People, Companies, Ideas, Research with a
   schema), `MEMORY/WISDOM/`, `USER/PRINCIPAL/`, `USER/TELOS/`. Claude Code's own
   auto-memory is deliberately disabled: "`autoMemoryEnabled: false` in shipped
   settings, plus deny rules on that path" (`DOCUMENTATION/Memory/MemorySystem.md`).
6. Dated log: `MEMORY/OBSERVABILITY/` JSONLs written by `EventLogger.hook.ts`;
   `ALGORITHM/changelog.md`; every system file carries `last_updated` frontmatter under
   a named convention `pai-freshness-v1`.
7. Records: `DOCUMENTATION/Ledger/LedgerSystem.md` ("change tracking: versioning, update
   registry, integrity gate, deploy events"); `MEMORY/VERIFICATION/`;
   `MEMORY/SYSTEMUPDATES/`.
8. Skills: 56 `skills/<Name>/SKILL.md`, most with a `Workflows/` subdir. 7 slash
   commands in `commands/`.
9. Roles: `agents/*.md`, eight named agents including per-provider researchers.
10. Task graph: `DOCUMENTATION/Work/WorkSystem.md` routes work to "private GitHub Issues
    as system of record"; `DOCUMENTATION/Upgrades/UpgradesSystem.md` is a
    system-improvement queue.
11. Handoff ledger: not found as a file. `MEMORY/WORK/<slug>/ISA.md` is the per-task
    state-of-record that survives sessions, but nothing claims ownership between agents.
12. Evidence: constitutional rule 2. `RULES/Verification.md` holds seven
    incident-derived rules by name (modality fidelity, unavailable-verifier-means-DEFER,
    appearance != existence, reproduce before fixing, temporal fidelity, restore-parity,
    cache fidelity), enforced by `hooks/VerificationGate.hook.ts` and
    `hooks/AlgorithmNudge.hook.ts`. Web output must carry an Interceptor screenshot;
    Playwright is banned; "A 200 from curl proves nothing about a page."
13. Gates: hook-enforced, not prose. `ISAGate`, `ISACloseGate`, `ISAFoldGate`,
    `DeployRegistrationGate`, `PublicPushGate`, `MemoryHealthGate`, `StopGates`,
    `FormatGate`, `WritingGate`, `VerificationGate`, `ComplexityRatchet`,
    `EgressClassGuard`, `SpendAuditor`. Plus a prose gate: "Plan means stop."
14. Boundary: the strongest in the slice. `DOCUMENTATION/SystemUserBoundary.md` defines
    four zones (SYSTEM, USER, and two others) and states enforcement "at three layers: at
    write time by a runtime hook, at PR time by GitHub Actions, at release time by the
    existing build-time gates". `USER/` and `MEMORY/` are symlinks into
    `~/.config/LIFEOS/` so the public tree never contains them. Private skills use an
    underscore prefix: `skills/_<name>/`.
15. Maintenance loop: an "autonomic loop" over Cortex (`SessionHarvester`,
    `KnowledgeHarvester`, `LearningPatternSynthesis`, `WisdomCrossFrameSynthesizer`),
    plus `HookHealer.hook.ts`, `IntegrityCheck.hook.ts`,
    `handlers/RebuildKnowledgeSchema.ts`, `handlers/RebuildArchSummary.ts`,
    `handlers/DocCrossRefIntegrity.ts`, `MemoryReviewFire.hook.ts`. `RULES/SelfHealing.md`
    is a routing table for where a new rule structurally belongs.
16. Tool projections: only `.claude/`. LifeOS is Claude Code native and treats
    `~/.claude/` as its whole filesystem. Non-Claude models are reached as subagents
    (`agents/Gemini.md`, `agents/Grok.md`), not as parallel projections.
17. Multi-project routing: `USER/PROJECTS.md` is a "project registry + routing aliases",
    and `CLAUDE.template.md` tells the principal to drop project-scoped `CLAUDE.md`
    files beside each codebase.
18. Factory/product: implicit in the SYSTEM/USER zone split rather than named.
19. Generated index: `ARCHITECTURE_SUMMARY.md` is rebuilt by
    `hooks/handlers/RebuildArchSummary.ts`; `USER/TELOS/PRINCIPAL_TELOS.md` is described
    as an "auto-generated derivative".

**Primitives absent that I would expect**

- No handoff or claim ledger, despite eight agent definitions and a delegation doc that
  is marked RETIRED.
- No cross-tool projection. A user on Codex or Cursor gets nothing.
- No task graph inside the workspace. Tickets live in GitHub Issues, off-disk.

**Loop**

Startup: system prompt, then `CLAUDE.md`, then `ARCHITECTURE_SUMMARY.md`, then the five
identity imports. Hooks `LoadContext.hook.ts`, `LoadMemory.hook.ts`, and
`TimeContext.hook.ts` inject more. Per turn: one fixed response format with a banner, an
answer, optional `CHANGE`/`VERIFY` blocks, and hook-fed `SYSTEM`/`MEMORY`/ascent lines.
The rule is that the model never computes those lines: "Never self-compute a strip; no
block, no strip." Substantial work reads `ALGORITHM/LATEST` and climbs an ISA whose
claims close on tool evidence. Maintenance: an autonomic Cortex reviewer plus scheduled
Pulse jobs (`DOCUMENTATION/Services/BackgroundServices.md`).

**Memory split**

Per-user and per-machine: `~/.claude/LIFEOS/USER/**` (symlinked to `~/.config/LIFEOS/`),
`~/.claude/.env`. Per-project: a project-local `CLAUDE.md` beside each codebase, plus
`MEMORY/WORK/<slug>/`. Per-session: `MEMORY/SCRATCHPAD`, `STATE` caches,
`_BROWSER_STATE`, and Claude Code's own 30-day transcript store, which the memory doc
calls "the source of truth for transcripts".

**Human gates**

"Plan means stop." Analysis is read-only (constitutional rule 5). `PublicPushGate` on
public pushes. `DeployRegistrationGate` on deploys. `SpendAuditor` on cost.
`EgressClassGuard` and `VoiceEgressGuard` on data leaving the machine. Context
sufficiency allows up to three questions with a `proceed` override.

**Evidence of real use**

Strong. Release `v7.40.4` shipped 2026-08-14 with a notes-completeness pass; a
2026-09-03 commit credits 29 community contributors from a dated triage; 2,465 forks; 56
open issues. Files carry dated directives quoted inside them, for example a
"2026-07-10 readability directive" and a named principal quote dated 2026-07-27 that
justifies the SYSTEM response line. Doc text records specific dated incidents as the
reason for a rule, e.g. "a self-computed strip is how the response said Ascending while
the board derived Traverse (2026-08-11)."

**Generalizes**

The three-tier precedence (system prompt beats routing file beats project file) stated in
writing. The four-zone public/private boundary enforced at write time, PR time, and
release time. The rule that status lines are hook-fed and never model-computed. A routing
file that declares it holds no content. A named self-healing table that says where a new
rule structurally lives, with an explicit instruction to patch the system rather than
write a note.

**Idiosyncratic**

TELOS as a life-goal ontology. The euphoric-surprise target. The DA persona speaking in
first person and never saying "the user". The `pai-freshness-v1` frontmatter convention.
Hard bans on npm, Python, and Playwright. The Pulse dashboard on port 31337 and hooks
that call it over HTTP. The one-format-always response shape with a Unicode banner.

**Sources** (all under `https://raw.githubusercontent.com/danielmiessler/LifeOS/5e2f2e8c0abde612da0e99c16c0d07d4ec21b88c/`)

- `LifeOS/install/CLAUDE.template.md`: routing table, import list, harness constraint
- `LifeOS/install/LIFEOS/LIFEOS_SYSTEM_PROMPT.md`: five constitutional rules, format,
  Algorithm entry, verification, self-healing, operational rules
- `LifeOS/install/LIFEOS/DOCUMENTATION/SystemUserBoundary.md`: four zones, three-layer
  enforcement, symlink mounts, MEMORY subtree split
- `LifeOS/install/LIFEOS/DOCUMENTATION/Memory/MemorySystem.md`: Cortex, capture
  pipelines, harvesters, auto-memory disabled
- `LifeOS/install/USER/README.md`: USER layout, `/interview` bootstrap, privacy claim
- `LifeOS/install/hooks/hooks.json`: hook wiring, HTTP hooks to localhost:31337
- Git tree at that SHA: 56 skills, 8 agents, 7 commands, ~50 hooks

---

### buildermethods/agent-os

- URL: https://github.com/buildermethods/agent-os
- Stars 5,404 · forks 829 · last push 2026-08-29T15:11:00Z · license MIT
- SHA read: `475b0cac4c7c5cf2336ad5a663b691a6d3415e05` (branch `main`)
- Created 2025-07-16. 1 open issue.
- Purpose: an installer that puts a codebase-standards library and four planning
  commands into a target repo, so an agent shapes a spec against written standards
  before it writes code.

**Entry files the agent is told to read, in order**

There is no law file. The commands do the reading. `commands/agent-os/shape-spec.md`
tells the agent to read `agent-os/standards/index.yml`, then the confirmed standards
files, then check whether `agent-os/product/` exists and read `mission.md`,
`roadmap.md`, `tech-stack.md` if so. `commands/agent-os/inject-standards.md` emits
`@agent-os/standards/...` import lines into whatever context is being built.

**Layout written into the target project**

From `scripts/project-install.sh`:

```
your-project/
├── agent-os/
│   ├── standards/           copied from profiles/<profile>/standards, .md files
│   │   ├── index.yml        GENERATED by the installer; description per file
│   │   ├── global/tech-stack.md
│   │   └── <folder>/<topic>.md
│   ├── product/             written by /plan-product: mission.md, roadmap.md,
│   │                        tech-stack.md
│   └── specs/               written by /shape-spec:
│       └── YYYY-MM-DD-HHMM-<feature-slug>/
│           ├── plan.md
│           ├── shape.md
│           ├── standards.md
│           ├── references.md
│           └── visuals/
└── .claude/commands/agent-os/   5 command files
```

The base installation (the cloned repo itself) holds `config.yml` with
`default_profile` and an optional `profiles:` inheritance map, and
`profiles/<name>/standards/`. The installer resolves an inheritance chain and refuses
circular references.

**Primitives present**

1. Law: not found. No `AGENTS.md`, no `CLAUDE.md` written into the target. The closest
   thing is `agent-os/standards/`, which is injected on demand rather than read first.
2. State surface: partial. `agent-os/product/roadmap.md` carries phases, but there is no
   current-focus or blockers file.
3. Index: `agent-os/standards/index.yml`, read by both `shape-spec` and
   `inject-standards`. A separate `/index-standards` command maintains it.
4. Capture inbox: not found.
5. Durable memory: `agent-os/standards/` is durable project knowledge, and
   `/discover-standards` extracts it from the existing codebase. Nothing about the user
   or the machine.
6. Dated log: the spec folder name is the date stamp
   (`YYYY-MM-DD-HHMM-<feature-slug>/`). `CHANGELOG.md` is the framework's own.
7. Records: each spec folder is a record of one change: `shape.md` carries Scope,
   Decisions, Context, Standards Applied.
8. Skills: five slash commands, no `SKILL.md`. `inject-standards.md` has a "Creating a
   Skill" scenario that writes `@agent-os/standards/...` imports into a skill being
   authored.
9. Roles: not found. No agent or persona definitions.
10. Task graph: partial. `shape-spec` builds a numbered task list inside `plan.md` with
    "Task 1 always being 'Save spec documentation'". No cross-spec dependencies.
11. Handoff ledger: not found.
12. Evidence: not found. No verification or receipt requirement.
13. Gates: heavy, and conversational. `shape-spec` must run in plan mode and is told to
    "stop immediately" otherwise. `AskUserQuestion` is mandated at every step. The
    installer asks before overwriting an existing standards folder, and offers
    `--commands-only` to avoid it.
14. Boundary: partial. `profiles/` separates the base install from any project.
    No private/runtime split inside the target.
15. Maintenance loop: `/index-standards` rebuilds `index.yml`;
    `/discover-standards` re-extracts standards from the codebase;
    `scripts/sync-to-profile.sh` pushes a project's standards back to the base profile.
16. Tool projections: `.claude/commands/agent-os/` is the only one the installer writes.
    The repo's own `.agents/setup` and `.agents/resume` are bash scripts for provisioning
    a dev container, not a skills projection. README claims it "works alongside Claude
    Code, Cursor, Antigravity, and other AI tools", but at this SHA only the
    `.claude/commands/` destination is in `project-install.sh`.
17. Multi-project routing: yes, via profiles. `config.yml` names a `default_profile`
    and an inheritance chain, so one base install serves many projects with overridable
    standards. This is the cleanest multi-project mechanism in the slice.
18. Factory/product: `profiles/` and `agent-os/standards/` are the factory;
    `agent-os/specs/<dated>/` is the product.
19. Generated index: `index.yml`, built by `update_standards_index()` in
    `scripts/project-install.sh` and by `/index-standards`. Files not yet described are
    stamped "Needs description - run /index-standards".

**Primitives absent that I would expect**

No law file at all, which is unusual for this category. No evidence or verification
requirement, so a spec can be marked done with nothing proving it. No agent roles.

**Loop**

No startup loop. Per invocation: `/discover-standards` once to seed, then
`/inject-standards` to pull the relevant subset into context, then `/shape-spec` in plan
mode to produce a dated spec folder, then execution. The installer prints the next steps
verbatim: "1. Run /discover-standards ... 2. Run /inject-standards".

**Memory split**

Per-machine: the base install (`config.yml`, `profiles/`). Per-project: `agent-os/`
inside the repo, committed. Per-user: not modeled. Per-session: not modeled.

**Human gates**

Plan mode required for `shape-spec`. `AskUserQuestion` at every step of every command.
Standards-overwrite confirmation at install. Plan-structure approval before tasks are
filled in. Final "approve / adjust" before execution.

**Evidence of real use**

Moderate. 829 forks, 1 open issue. Commits credit external PRs (#327, #328) with
maintainer follow-ups authored as "Brian Casel (via Claud...", so the maintainer's own
commits are agent-assisted. Installation and usage docs live off-repo at
buildermethods.com, so the repo alone understates the system.

**Generalizes**

The dated spec folder as the unit of record. `index.yml` as a generated catalog with
per-file descriptions, read before any standard is loaded. Profile inheritance for
multi-project standards. "Task 1 always being 'Save spec documentation'", which makes the
record a step of the plan rather than an afterthought.

**Idiosyncratic**

Plan-mode enforcement as a hard prerequisite. Mandating `AskUserQuestion` rather than
plain prose questions. Shipping no law file at all.

**Sources** (under `https://raw.githubusercontent.com/buildermethods/agent-os/475b0cac4c7c5cf2336ad5a663b691a6d3415e05/`)

- `scripts/project-install.sh`: target paths, index generation, overwrite confirm
- `config.yml`: default_profile, profile inheritance
- `commands/agent-os/shape-spec.md`: plan-mode gate, index read, dated spec folder
- `commands/agent-os/plan-product.md`: `agent-os/product/` files
- `commands/agent-os/inject-standards.md`: `@agent-os/standards/...` injection
- `README.md`: stated tool coverage
- `.agents/setup`, `.agents/resume`: dev-container provisioning, not a projection

---

### obra/superpowers

- URL: https://github.com/obra/superpowers
- Stars 286,065 (as reported by the GitHub API on 2026-09-13) · forks 25,596 · last push
  2026-09-12T00:16:38Z · license MIT
- SHA read: `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` (branch `main`)
- Created 2025-10-09. 363 open issues.
- Purpose: a zero-dependency skills plugin that forces a process skill to fire before the
  agent does anything, across many harnesses.

One-line classification: this is a **plugin, not a workspace people work inside**. Its
repo-root `CLAUDE.md` is contributor guidelines for people submitting PRs, not law for a
user's own sessions. I keep the full record anyway because its skills define a workspace
convention (`docs/superpowers/plans/`, `docs/superpowers/specs/`, a per-plan ledger) that
other people adopt.

**Entry files the agent is told to read, in order**

1. `hooks/hooks.json` fires `hooks/run-hook.cmd session-start` on
   `startup|clear|compact`, `async: false`.
2. That bootstrap loads `skills/using-superpowers/SKILL.md`, which is the law of a
   session. Its own description: "Use when starting any conversation - establishes how to
   find and use skills, requiring skill invocation before ANY response including
   clarifying questions".
3. Per-harness reference files when the harness matches:
   `skills/using-superpowers/references/{codex,pi,antigravity,hermes,gemini}-tools.md`.

`GEMINI.md` at the repo root is two `@` import lines pointing at the bootstrap skill and
the Gemini reference. `AGENTS.md` is a symlink whose blob content is the single string
`CLAUDE.md`, so the two files are one file on disk.

**Layout, top two levels**

```
superpowers/
├── CLAUDE.md                  contributor law (94% PR rejection rate stated)
├── AGENTS.md        → symlink to CLAUDE.md
├── GEMINI.md                  two @ imports into the bootstrap skill
├── hooks/            hooks.json, hooks-cursor.json, run-hook.cmd, session-start/
├── skills/           14 skills, each <name>/SKILL.md plus scripts and references
├── docs/
│   ├── superpowers/plans/     dated plan records, 2026-01 through 2026-08
│   ├── superpowers/specs/     dated design records
│   ├── plans/                 older dated plans
│   └── porting-to-a-new-harness.md
├── tests/            per-harness integration tests (claude-code, codex, gemini,
│                     opencode, kimi, devin, hermes, pi, antigravity)
├── .claude-plugin/   plugin.json, marketplace.json
├── .codex-plugin/    plugin.json
├── .cursor-plugin/   plugin.json
├── .devin-plugin/    plugin.json
├── .kimi-plugin/     plugin.json
├── .hermes-plugin/   plugin.yaml, __init__.py
├── .agents/plugins/  marketplace.json
├── .opencode/plugins/superpowers.js
├── .pi/extensions/superpowers.ts
└── gemini-extension.json
```

Skills: `brainstorming`, `dispatching-parallel-agents`, `executing-plans`,
`finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`,
`subagent-driven-development`, `systematic-debugging`, `test-driven-development`,
`using-git-worktrees`, `using-superpowers`, `verification-before-completion`,
`writing-plans`, `writing-skills`.

**Primitives present**

1. Law: `skills/using-superpowers/SKILL.md` for sessions; repo `CLAUDE.md` for
   contributors. The skill states its own precedence: "User instructions (CLAUDE.md,
   AGENTS.md, GEMINI.md, etc, direct requests) take precedence over skills, which in turn
   override default behavior."
2. State surface: per-plan, not global. `subagent-driven-development/SKILL.md` names a
   ledger at `<workspace>/progress.md` whose first line must be
   `# SDD ledger — plan: <plan file path>`, and calls out the superseded flat path
   `.superpowers/sdd/progress.md`.
3. Index: not found. There is no map file; the bootstrap skill is the router.
4. Capture inbox: not found.
5. Durable memory: not found. Nothing about the user or the machine persists.
6. Dated log: `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` is mandated by
   `writing-plans/SKILL.md`: "**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`".
   `skills/systematic-debugging/CREATION-LOG.md` records how that skill was built.
7. Records: `docs/superpowers/specs/<dated>-design.md` paired with each plan; a plan
   carries a `**Spec:**` pointer to the design doc it implements.
8. Skills: 14 `skills/<name>/SKILL.md`, several with `scripts/` and `references/`.
   Skill content is treated as behavior-shaping code: "Skills are not prose — they are
   code that shapes agent behavior", and changes require eval evidence.
9. Roles: prompt files rather than agent definitions:
   `requesting-code-review/code-reviewer.md`,
   `subagent-driven-development/{implementer-prompt,task-reviewer-prompt,re-review-prompt}.md`,
   `writing-plans/plan-document-reviewer-prompt.md`,
   `brainstorming/spec-document-reviewer-prompt.md`.
10. Task graph: a plan file's numbered tasks, each with exact file paths to create,
    modify, and test, and a runnable test command per task.
11. Handoff ledger: yes, and the most explicit in the slice.
    `scripts/sdd-workspace PLAN_FILE` prints a git-ignored per-plan workspace;
    `progress.md` inside it is the ledger; a mismatched first line means another plan owns
    it. The workspace is deleted when the final review is clean
    (`rm -rf <workspace>`), with the reason stated: "the git history is" the record.
    A warning is included: "`git clean -fdx` will destroy the workspace".
12. Evidence: a whole skill, `verification-before-completion`. New-harness PRs must paste
    a complete session transcript proving the integration works; the acceptance test is a
    verbatim user message ("Let's make a react todo list") and a working integration
    auto-triggers `brainstorming`. `scripts/review-package PLAN_FILE BASE HEAD` produces
    a reviewable diff artifact, with a named trap: never use `HEAD~1`, "which silently
    drops all but the last commit of a multi-commit task".
13. Gates: `requesting-code-review` and `receiving-code-review` bracket each task.
    Contributor gates: human must review the complete diff before a PR; submitters must
    disclose model, harness, harness version, and installed plugins.
14. Boundary: the SDD workspace is git-ignored scratch, deliberately outside the record.
15. Maintenance loop: `writing-skills` is the meta-skill; evals live in a separate repo
    cloned into `evals/` and drive real tmux sessions of Claude Code, Codex, and Gemini
    CLI, judged by an LLM verifier.
16. Tool projections: nine, the most in the slice: `.claude-plugin/`, `.codex-plugin/`,
    `.cursor-plugin/`, `.devin-plugin/`, `.kimi-plugin/`, `.hermes-plugin/`,
    `.agents/plugins/`, `.opencode/plugins/`, `.pi/extensions/`, plus
    `gemini-extension.json`. `AGENTS.md` as a symlink to `CLAUDE.md` is the cheapest
    projection I saw anywhere.
17. Multi-project routing: not found. It is a plugin installed once and active everywhere.

**Primitives absent that I would expect**

No durable memory, no index, no capture inbox. Deliberate: the README-level philosophy is
that skills are the unit, and state belongs in git.

**Loop**

Startup: a synchronous SessionStart hook loads the bootstrap skill. Per turn: check for a
relevant skill before any response, announce "Using [skill] to [purpose]", create a todo
per checklist item. Process skills outrank implementation skills. Maintenance: eval runs
against real sessions on multiple harnesses.

**Memory split**

Per-project: `docs/superpowers/plans/` and `specs/`, committed. Per-plan and
per-session: the git-ignored SDD workspace, deleted on completion. Per-user and
per-machine: nothing.

**Human gates**

Contributor-facing: complete PR template, prior-PR search, human diff review, harness
disclosure, `dev` branch targeting. Session-facing: brainstorming before plan mode; code
review requested and received per task; verification before completion.

**Evidence of real use**

Very strong. 25,596 forks, 363 open issues, release v6.3.0 on 2026-08-12, community
commits merged with named external authors, and 30-plus dated plan and spec documents
from 2025-11 through 2026-08 that record its own development under its own method. The
`CLAUDE.md` states a measured rejection rate: "This repo has a 94% PR rejection rate."

**Generalizes**

A synchronous SessionStart hook that loads a bootstrap skill, treated as the only real
integration: "If you are not sure whether your integration loads the bootstrap at session
start, it does not." A per-plan git-ignored workspace with a ledger whose first line
asserts ownership. `AGENTS.md` as a symlink to `CLAUDE.md`. Skills as tested behavior
code with an eval harness. A verbatim acceptance test for an integration.

**Idiosyncratic**

The adversarial contributor CLAUDE.md aimed at agents, including a section telling the
agent to protect its "human partner" from embarrassment. The deliberate refusal to comply
with Anthropic's published skill-authoring guidance without eval evidence. The
"human partner" terminology, explicitly not interchangeable with "the user".

**Sources** (under `https://raw.githubusercontent.com/obra/superpowers/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/`)

- `CLAUDE.md`: contributor law, rejection rate, harness acceptance test, eval
  requirement, disclosure requirement
- `AGENTS.md`: blob content is `CLAUDE.md`, i.e. a symlink
- `GEMINI.md`: two `@` imports
- `hooks/hooks.json`: SessionStart matcher `startup|clear|compact`, async false
- `skills/using-superpowers/SKILL.md`: the rule, red-flags table, precedence statement
- `skills/writing-plans/SKILL.md`: plan path convention
- `skills/subagent-driven-development/SKILL.md`: per-plan workspace, `progress.md`
  ledger, review-package, workspace deletion
- Git tree at that SHA: nine tool projections, 14 skills, dated plans and specs

---

### SuperClaude-Org/SuperClaude_Framework

- URL: https://github.com/SuperClaude-Org/SuperClaude_Framework
- Stars 23,885 · forks 2,001 · last push 2026-08-21T04:13:47Z · license MIT
- SHA read: `1b81e51db955126ec8983769b96dec575d730c05` (branch `master`)
- Created 2025-06-22. 73 open issues.
- Purpose: a Python-installed configuration pack that drops 30 slash commands, 20 agent
  definitions, 7 behavioral modes, and a rules file into a Claude Code install.

**Entry files the agent is told to read, in order**

Order is not stated anywhere I could find. The installed surface is
`~/.claude/commands/sc/`, `~/.claude/agents/`, `~/.claude/skills/`, and the plugin's
`core/RULES.md` plus `core/PRINCIPLES.md` and `core/FLAGS.md`. `RULES.md` declares its
own precedence system instead of a read order: three tiers (CRITICAL, IMPORTANT,
RECOMMENDED) and a four-step "Conflict Resolution Hierarchy" (Safety First, Scope over
Features, Quality over Speed, Context Matters).

**Installed layout**

Quoted from the repo's own `CLAUDE.md`:

```
~/.claude/
├── settings.json
├── commands/sc/         # 30 slash commands (/sc:research, /sc:implement, etc.)
├── agents/              # 20 domain-specialist agents
└── skills/              # Skills (confidence-check, etc.)
```

The distributable plugin at `plugins/superclaude/` is the fuller picture:

```
plugins/superclaude/
├── .claude-plugin/plugin.json
├── .mcp.json
├── agents/       20 *.md (backend-architect, pm-agent, root-cause-analyst, self-review,
│                 socratic-mentor, deep-research-agent, repo-index, ...)
├── commands/     30 *.md (load, save, reflect, task, spawn, workflow, index-repo, ...)
├── core/         FLAGS.md, PRINCIPLES.md, RULES.md, RESEARCH_CONFIG.md,
│                 BUSINESS_SYMBOLS.md, BUSINESS_PANEL_EXAMPLES.md
├── modes/        7: Brainstorming, Business_Panel, DeepResearch, Introspection,
│                 Orchestration, Task_Management, Token_Efficiency
├── mcp/          8 MCP_*.md + configs/
├── hooks/hooks.json
└── examples/
```

**Primitives present**

1. Law: `core/RULES.md` ("Claude Code Behavioral Rules") plus `core/PRINCIPLES.md`. The
   repo's own `CLAUDE.md` is a contributor file; `CLAUDE.md` and `AGENTS.md` at the root
   disagree about the project layout, which is a drift signal rather than a hierarchy.
2. State surface: `TASK.md` at the repo root ("Current Tasks, Priorities, and Backlog"),
   last updated 2025-11-12 while the head commit is 2026-08-21. It is stale by roughly
   nine months, and it describes the framework's own development, not a user's work.
3. Index: `PROJECT_INDEX.json` and `PROJECT_INDEX.md` at the root, with an
   `/sc:index-repo` command and a `repo-index` agent that build them.
4. Capture inbox: not found.
5. Durable memory: delegated to an external MCP server. `/sc:save` and `/sc:load` both
   declare "**Serena MCP**: Mandatory integration for session management, memory
   operations, and cross-session persistence", using `write_memory` and `read_memory`.
   Nothing durable lives in the workspace filesystem.
6. Dated log: `CHANGELOG.md`. No session log.
7. Records: `KNOWLEDGE.md` at the root ("Accumulated Insights, Best Practices, and
   Troubleshooting"), also last updated 2025-11-12. `DELETION_RATIONALE.md`,
   `QUALITY_COMPARISON.md`, `PR_DOCUMENTATION.md`, `PARALLEL_INDEXING_PLAN.md` are
   one-off records at the root.
8. Skills: `skills/confidence-check` plus `/sc:*` commands. Commands, not `SKILL.md`,
   carry most of the behavior; each command file has frontmatter with `category`,
   `complexity`, `mcp-servers`, `personas`.
9. Roles: 20 agent definitions, the largest roster in the slice. `pm-agent` is a
   documented meta-layer that "activates after task completion to document learnings".
10. Task graph: `/sc:task` and `/sc:spawn` commands plus `MODE_Task_Management.md`. The
    on-disk graph is `TASK.md`, stale.
11. Handoff ledger: `/sc:save --checkpoint` writes checkpoints through Serena MCP, and
    `/sc:load --type checkpoint` reads them back. Off-filesystem, so not a ledger a human
    can open.
12. Evidence: `RULES.md` requires it in prose ("All claims must be verifiable through
    testing or documentation", "Run lint/typecheck before marking tasks complete"), and
    a PostToolUse prompt hook on `Write|Edit` asks the model to verify its own edit. No
    receipt artifact.
13. Gates: the Stop hook is a prompt, not a block: "Before ending, check if there are
    uncommitted changes or incomplete tasks." Nothing halts for a human.
14. Boundary: not found beyond `.gitignore`.
15. Maintenance loop: stated as a cadence in `RULES.md`: "Monthly Maintenance: PM Agent
    performs systematic documentation health reviews" and "Monthly → PM Agent prunes
    outdated docs → Updates knowledge base". The stale `TASK.md` and `KNOWLEDGE.md` are
    direct evidence the loop did not run.
16. Tool projections: `.claude/` only, plus the plugin format. `AGENTS.md` exists but
    documents Python and TypeScript build commands, not agent behavior.
17. Multi-project routing: not found. Global install, per-user.
18. Factory/product: not found.
19. Generated index: `PROJECT_INDEX.json` via `/sc:index-repo`.

**Primitives absent that I would expect**

No capture inbox. No boundary. No on-disk durable memory (a hard dependency on one
third-party MCP server for all cross-session state). No stated startup read order.

**Loop**

`RULES.md` states it: "Session Lifecycle: Initialize with /sc:load, checkpoint
regularly, save before end" and "Session Pattern: /sc:load → Work → Checkpoint (30min) →
/sc:save", with checkpoint triggers at task completion, 30-minute intervals, and risky
operations. A SessionStart hook runs `scripts/session-init.sh`. Task pattern:
"Understand → Plan (with parallelization analysis) → TodoWrite(3+ tasks) → Execute →
Track → Validate". Maintenance is monthly, by the PM agent.

**Memory split**

Per-user: `~/.claude/{commands/sc,agents,skills}` installed globally. Per-project: only
whatever Serena MCP stores for that project. Per-machine: not modeled. Per-session:
checkpoints in Serena.

**Human gates**

None enforced. The Stop hook is advisory; the PostToolUse hook asks the model to
self-verify.

**Evidence of real use**

Mixed. 2,001 forks and 73 open issues, but commit velocity is low (five most recent
commits span 2026-03 to 2026-08) and the framework's own state files are nine months
stale while claiming monthly maintenance. Root-level drift is visible: `CLAUDE.md` and
`AGENTS.md` describe different project structures, and `AGENTS.md` names `pm/`,
`research/`, and `index/` directories that do not exist at this SHA.

**Generalizes**

A three-tier rule priority with a written conflict-resolution order. A per-command
frontmatter contract (`category`, `complexity`, `mcp-servers`, `personas`). A named
meta-agent whose job is to document learnings after each task and prune docs monthly.

**Idiosyncratic**

Emoji-keyed rule tiers. Behavioral "modes" as a separate concept from agents and
commands. Routing all durable memory through one third-party MCP server. Naming a
mandatory external dependency inside a command's frontmatter.

**Sources** (under `https://raw.githubusercontent.com/SuperClaude-Org/SuperClaude_Framework/1b81e51db955126ec8983769b96dec575d730c05/`)

- `CLAUDE.md`: installed `~/.claude/` tree, project structure
- `AGENTS.md`: conflicting structure claim, build commands
- `plugins/superclaude/core/RULES.md`: rule tiers, conflict hierarchy, session
  lifecycle, PM-agent meta-layer, monthly maintenance
- `plugins/superclaude/hooks/hooks.json`: SessionStart, Stop prompt, PostToolUse prompt
- `plugins/superclaude/commands/save.md`, `load.md`: Serena MCP as mandatory memory
- `TASK.md`, `KNOWLEDGE.md`, `PLANNING.md`: state, records, and design surfaces, all
  stamped "Last Updated: 2025-11-12"
- Git tree at that SHA: 20 agents, 30 commands, 7 modes, `PROJECT_INDEX.json`

---

### bmad-code-org/BMAD-METHOD

- URL: https://github.com/bmad-code-org/BMAD-METHOD
- Stars 52,967 · forks 5,985 · last push 2026-09-13T14:50:22Z · license NOASSERTION
- SHA read: `94b6727b00c8316557828c8a8ff2a48ff60d60cc` (branch `main`)
- Created 2025-04-13. 36 open issues.
- Purpose: an installer that puts a named-persona agile team (analyst, PM, architect,
  developer, UX) into a project as skills, with a planning-to-implementation pipeline
  whose state lives in YAML and spec frontmatter.

**Entry files the agent is told to read, in order**

No single law file is written into the target. Routing is dynamic and the mechanism is
unusual. `skills/bmad/SKILL.md` (the `bmad-help` skill) is the router, and it forbids
assuming an install: it must re-scan the skill roots every request ("Re-scan every
exposed root for this request; do not reuse an earlier scan"), read each skill's sibling
`module-manifest.toml`, group by its `module` key, and then read that manifest's
`knowledge` value, which is free-form text naming where the module's knowledge lives.
"Those documents are the only routing guides; treat no other manifest key as routing."

The repo's own root is a different matter: `CLAUDE.md` contains exactly `@AGENTS.md`, a
one-line pointer.

**Layout written into the target project**

From `docs/start/install-bmad.md`, `docs/reference/skills-and-agents.md`,
`docs/customize/customize-bmad.md`, and `skills/bmad/assets/config.template.toml`:

```
your-project/
├── _bmad/
│   ├── config.toml            installer-owned, team scope: install answers +
│   │                          agent roster
│   ├── config.user.toml       installer-owned, user scope: user_name, language,
│   │                          skill level
│   ├── custom/                starts empty; files appear only on customization
│   │   ├── config.toml            team overrides (committed)
│   │   ├── config.user.toml       personal overrides (gitignored)
│   │   ├── <skill>.toml           team override for one skill
│   │   └── <skill>.user.toml      personal override (gitignored)
│   └── scripts/              render_skill.py and friends
├── _bmad-output/             output_folder from config.template.toml
│   ├── planning-artifacts/       modules.bmm.planning_artifacts
│   └── implementation-artifacts/ modules.bmm.implementation_artifacts
├── docs/                     modules.bmm.project_knowledge
└── <tool skills dir>/        one directory per skill, each with SKILL.md,
                              module-manifest.toml, customize.toml
```

The skills directory depends on the tool, and the table in
`docs/reference/skills-and-agents.md` is the clearest cross-tool projection map in this
slice: `.claude/skills/` for Claude Code; `.agents/skills/` for "Cursor, Windsurf,
Codex, Auggie, Amp, and most others"; `.cline/skills/`; `.bob/skills/` for IBM Bob;
`.agent/skills/` for Antigravity; `.adal/skills/` for AdaL.

28 skill directories ship in the repo, including five agent personas
(`bmad-agent-{analyst,pm,architect,dev,ux-designer}`) and workflows such as `bmad-prd`,
`bmad-spec`, `bmad-create-epics-and-stories`, `bmad-sprint-planning`, `bmad-build`,
`bmad-build-auto`, `bmad-code-review`, `bmad-retrospective`, `bmad-correct-course`,
`bmad-project-context`, `bmad-customize`, `bmad-walkthrough`, `bmad-party-mode`.

**Primitives present**

1. Law: no single file. `skills/bmad/SKILL.md` plus each module's `knowledge` document
   named in `module-manifest.toml`. Repo-level: `AGENTS.md`, with `CLAUDE.md` as a
   one-line `@AGENTS.md` pointer.
2. State surface: two, by path shape. `sprint-status.yaml` for a PRD-backed project;
   `stories.yaml` beside `SPEC.md` for a single spec-backed epic. A spec file's
   frontmatter `status` is "the main machine-readable state for orchestration", with
   values including `ready-for-dev`, `in-review`, `blocked`, `done`.
3. Index: `docs/reference/skills-and-agents.md` names the installed skills directory as
   the catalog: "The installed directories are the canonical list." Disk is the index:
   "Disk is the membership list."
4. Capture inbox: not found.
5. Durable memory: `_bmad/config.toml` (team) and `_bmad/config.user.toml` (user) hold
   install answers, user name, language, skill level. `modules.bmm.project_knowledge`
   points at `docs/`.
6. Dated log: `skills/bmad/scripts/memlog.py` implements `.memlog.md`, an append-only
   chronological working memory with three stated invariants: append-only and never
   reordered or deleted; write-only and blind, echoing new state as one line of JSON;
   and no lifecycle status, because "Whether the work is done, blocked, or paused is
   itself a fact that happened, so it is recorded as an entry". Writes are atomic via
   temp file, fsync, rename. Entries carry an optional `--type` and `--by`.
7. Records: `_bmad-output/planning-artifacts/` and `implementation-artifacts/`; each
   spec's `## Auto Run Result` section; a sprint change proposal from
   `bmad-correct-course`; epic retrospectives.
8. Skills: 28 `skills/<name>/SKILL.md`, each with `module-manifest.toml` and, when
   customizable, `customize.toml` as its own schema.
9. Roles: five named personas with icons, menu codes, and voice descriptions in
   `config.template.toml`. Menu codes are agent-scoped and collide deliberately: "`CR`
   is a competitive teardown for the Analyst and a code review for the Developer."
10. Task graph: epic files plus `sprint-status.yaml`, or an ordered `stories.yaml`. A
    readiness gate sits between planning and implementation; the optional external
    `bmad-loop` repo is "an ordered story scheduler".
11. Handoff ledger: the spec frontmatter `status` plus the `.memlog.md` are what a fresh
    session reads to resume: "It persists ACROSS sessions, so a fresh session can load it
    and continue." `bmad-build-auto` routes on an existing spec's `status` value.
12. Evidence: the strongest artifact-level receipt in the slice. On an intent gap during
    review, the working tree is reverted but "the attempted change is first saved as a
    patch file in `{implementation_artifacts}`, referenced from the spec's triage log and
    the halt output. The patch shows which reading of the intent the run implemented —
    concrete evidence for repairing the intent." Terminal statuses and blocking
    conditions are machine-readable, with an explicit instruction to "Read `status`,
    `blocking condition`, and `followup_review_recommended` rather than inferring success
    from chat output alone."
13. Gates: a named READY FOR DEVELOPMENT gate; an implementation-readiness check (`IR`
    code on PM and Architect); a review repair loop capped at five iterations before
    halting non-convergent; `bmad-help` refuses to advance on uncertainty ("When
    completion remains uncertain, say what is known and ask the user"); "File presence
    alone does not prove completion."
14. Boundary: a clean four-layer scope split. `_bmad/config.toml` and
    `_bmad/custom/config.toml` are committed team scope; `_bmad/config.user.toml` and
    `_bmad/custom/*.user.toml` are gitignored personal scope.
15. Maintenance loop: `bmad-help` has doctor and update flows
    (`skills/bmad/references/setup.md`) which are explicitly distinct from setup: "never
    route update or doctor through setup". Sprint tracking has "validate sprint status"
    and "fix sprint status", where repair infers true state from epic files, story files,
    and git before regenerating.
16. Tool projections: six named skills directories plus a global per-user variant. This
    is the only repo in the slice whose docs table the per-tool path for each supported
    tool.
17. Multi-project routing: per-project `_bmad/` install; modules are the composition
    unit, with external and custom modules pulled from Git.
18. Factory/product: `_bmad/` is the factory, `_bmad-output/` the product, and the
    config template names the split as two keyed paths.
19. Generated index: not found as a file; membership is derived from disk each run,
    which is a stronger version of the same idea.

**Primitives absent that I would expect**

No capture inbox. No single law file, which is a deliberate choice but means a cold agent
cannot find the rules without the help skill. No owner profile and no learning loop; see
the mechanics subsection below, item 8, for what is absent and where the one opt-in memory
design lives.

**Loop**

Startup: no hook. The user invokes a skill, or invokes `bmad-help`, which re-scans skill
roots and manifests fresh every request. Per run: a workflow activates, resolves
customization through the four-layer priority chain, reads its inputs, writes into
`_bmad-output/`, and sets a `status`. Autonomous mode (`bmad-build-auto`) resumes from a
spec's existing `status` and ends by "writing a terminal status to the spec file or
fallback result artifact". Maintenance: doctor, update, validate-sprint-status,
fix-sprint-status, epic retrospective.

**Memory split**

Per-user: `_bmad/config.user.toml`, `_bmad/custom/*.user.toml`, both gitignored.
Per-project and per-team: `_bmad/config.toml`, `_bmad/custom/*.toml`, committed.
Per-machine: not modeled. Per-session: `.memlog.md` persists across sessions by design,
so it straddles session and project.

**Human gates**

READY FOR DEVELOPMENT gate. Implementation readiness. Sprint-planning gate at the
planning-to-implementation boundary. Repair confirmation before regenerating a sprint
file. Non-convergence halt after five review iterations. Correct-course produces a
proposal for a human to apply.

**Evidence of real use**

The strongest in the slice. 5,985 forks, commits on the day of reading, multiple named
contributors in the last week, a docs site, a release process documented in
`tools/release.md`, deterministic skill validation (`tools/validate_skills.py --strict`),
and a `removals.txt`. `AGENTS.md` carries a prompt-economics rule derived from
experience: "Length and ambiguity are paid on every run; a corner case is paid only when
it occurs. So do not add instructions for exotic cases."

**Generalizes**

The four-layer config precedence with `.user.toml` gitignored and `.toml` committed. A
skill shipping its own `customize.toml` as the schema of what may be overridden, with a
caution against copying the whole file. Machine-readable `status` frontmatter as the
handoff contract, read instead of chat output. Saving a reverted attempt as a patch so a
failed run still produces evidence. An append-only memlog with no completion flag,
because completion is itself an entry. Deriving installed-skill membership from disk
every request instead of from a catalog.

**Idiosyncratic**

Named personas with voice descriptions and emoji. Agent-scoped two-letter menu codes that
collide across agents on purpose. The `bmad-party-mode` skill. Requiring `uv` for
skills that render Python.

**Sources** (under `https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/94b6727b00c8316557828c8a8ff2a48ff60d60cc/`)

- `docs/start/install-bmad.md`: `npx bmad-method install`, `_bmad` detection, headless
  flags
- `docs/reference/skills-and-agents.md`: per-tool skills directories, agent roster,
  menu codes, "installed directories are the canonical list"
- `docs/customize/customize-bmad.md`: four-layer config precedence, `_bmad/custom/`,
  `customize.toml` as schema, merge rules
- `docs/plan/break-work-into-stories-and-track-it.md`: `sprint-status.yaml`,
  `stories.yaml`, validate and fix flows
- `docs/build/autonomous-development-loops.md`: spec `status` values, terminal statuses,
  intent-gap patch as evidence, five-iteration cap
- `skills/bmad/SKILL.md`: fresh-discovery routing, manifest `knowledge` key, uncertainty
  rule
- `skills/bmad/references/setup.md`: `_bmad` requirement, setup vs update vs doctor
- `skills/bmad/assets/config.template.toml`: `_bmad-output` paths, agent roster
- `skills/bmad/scripts/memlog.py`: append-only memlog invariants and file shape
- `AGENTS.md`, `CLAUDE.md`: repo law and the one-line pointer

### BMAD mechanics worth learning from

Version: the v6 modular layout. The main repo at the SHA read carries no `VERSION` file,
but `bmad-loop`'s `deferred-work-format.md` pins the current era as "BMAD-METHOD
6.10.1-next.33+". Core ships as module `bmm`; domain packs are separate repos. Module
clones read locally, versions from their own manifests: CIS 0.3.2
(`cis/package.json`, repo `bmad-module-creative-intelligence-suite`), GDS 0.7.2
(`gds/package.json`, `module_version: 0.7.0` in `gds/src/module.yaml`, repo
`bmad-module-game-dev-studio`), BMB 2.2.2 (`bmb/package.json`, repo `bmad-builder`),
BMAD Loop 0.11.1 (`bmad-loop/module.yaml`), TEA 1.24.0 (`tea/package.json`).

**1. The story file.** `bmad-create-epics-and-stories` shards a PRD into epic files, then
`bmad-sprint-planning` generates tracking; the per-story unit is a spec file from
`skills/bmad-build/spec-template.md`. Frontmatter: `title`, `type` (feature | bugfix |
refactor | chore), `created`, `status` (draft | ready-for-dev | in-progress | in-review |
done), `route` (oneshot | full), `review_loop_iteration`, `context: []`. Body sections:
`## Intent` (Problem, Approach), `## Boundaries & Constraints` (Always, Never), `## I/O &
Edge-Case Matrix`, `## Code Map`, `## Tasks & Acceptance`, `## Implementation Notes`
(append-only, agent-owned), `## Spec Change Log` (append-only). The first three sit inside
`<frozen-after-approval reason="human-owned intent — do not modify unless human
renegotiates">`. Token target is written into the template: "Target: 900–1300 tokens ...
Above 1600 = high risk of context rot."

Yes, the implementer works from the spec alone. `step-03-implement.md`: "the spec is the
subagent's sole source of truth", with an explicit ban on padding the dispatch: "Do not
add goal restatements, file lists, ownership boundaries, investigation detail, acceptance
criteria, or CLAUDE.md/house-style rules to the dispatch". Even the `context:` list is
loaded by the subagent, not pasted in: "never pre-load and paste those files into the
dispatch." The supervisor then judges the diff, not the report: "Judge against the diff,
not against the implementation subagent's report."

**2. Planning-to-development split.** Planning produces brief, PRFAQ, PRD, UX, architecture,
and epic files into `{planning_artifacts}` = `_bmad-output/planning-artifacts`
(`config.template.toml`). Development writes into `{implementation_artifacts}` =
`_bmad-output/implementation-artifacts`. The bridge is one compilation step:
`bmad-build/compile-epic-context.md` reads the epics file plus the planning directory and
emits `epic-<N>-context.md` with fixed headings (Goal, Stories, Requirements &
Constraints, Technical Decisions, UX & Interaction Patterns, Cross-Story Dependencies),
pulling "only the information relevant to this epic". Artifacts are identified by reading
them, not by filename: the readiness gate says "Identify documents by reading what they
are, not by filename patterns".

**3. Status and lifecycle.** `{implementation_artifacts}/sprint-status.yaml`, generated by
`bmad-sprint-planning`. `sprint-status-template.yaml` defines epic status (backlog,
in-progress, done), story status (backlog, ready-for-dev, in-progress, review, done),
retrospective status, and action-item status. Who updates it: the build skill, via a
six-line contract in `bmad-build/sync-sprint-status.md` that sets
`development_status[{story_key}]`, promotes the parent epic on first story start, updates
`last_updated`, and "Preserve comments and structure". Code review moves stories through
review; retrospectives append to `action_items`. Repair is a first-class operation:
`references/fix-sprint-status.md` plus `validate.md`.

**4. Personas.** Five in core, each a skill directory
(`skills/bmad-agent-{analyst,pm,architect,dev,ux-designer}/`): Mary the Business Analyst,
John the Product Manager, Winston the System Architect, Amelia the Senior Software
Engineer, Sally the UX Designer. Identity is split from behavior. The hardcoded half lives
in `config.template.toml` `[agents.<code>]` (module, team, name, title, icon, description).
The customizable half lives in the skill's `customize.toml`, which states the rule at the
top: "DO NOT EDIT -- overwritten on every update ... Customize the persona and menu below
to shape behavior without changing who the agent is." Its `[agent]` block carries
non-configurable `name` and `title`, then `icon`, `activation_steps_prepend`,
`activation_steps_append`, `persistent_facts` (literal sentences or `file:` paths, globs
supported), `role`, `identity`, `communication_style`, `principles`, and `[[agent.menu]]`
items keyed by `code`, each with exactly one of `skill` or `prompt`. The SKILL.md is a
seven-step activation bootloader: resolve the agent block (by running
`_bmad/scripts/resolve_customization.py`, with a written fallback to merge the three files
by hand), run prepend steps, adopt persona, load persistent facts, load
`_bmad/<module>/config.yaml`, greet by name prefixed with the icon, run append steps.

**5. Domain packs (the item that matters most).** A pack is a separate npm-named repo whose
`src/` is the installable payload, and it is structurally a peer of core, not a plugin
into it. Two shapes exist.

CIS (`cis/src/`) is the flat shape: `module.yaml`, `module-help.csv`, and `skills/` with
eleven directories. Six are agent personas (`bmad-cis-agent-storyteller`,
`-design-thinking-coach`, `-brainstorming-coach`, `-creative-problem-solver`,
`-innovation-strategist`, `-presentation-master`), each holding only `SKILL.md` plus
`customize.toml`. Five are workflows (`bmad-cis-storytelling`, `-design-thinking`,
`-problem-solving`, `-innovation-strategy`, and a brainstorming entry), each holding
`SKILL.md`, `customize.toml`, `template.md`, and a method table as CSV
(`story-types.csv`, `design-methods.csv`, `solving-methods.csv`,
`innovation-frameworks.csv`). The CSV-as-method-library is the pack's real content: domain
knowledge is tabular data beside the skill, not prose inside it.

What a pack adds versus overrides. It adds: a module code (`code: cis`), an agent roster
in `module.yaml` `agents:` with `code`, `name`, `title`, `icon`, `team`, `description`;
install-time questions that become config (CIS asks `visual_tools` as a multi-select over
mermaid, excalidraw, gemini-nano, other-image); a `module-help.csv` row per capability with
`display-name`, `menu-code`, `description`, `phase`, `preceded-by`, `followed-by`,
`required`, `output-location`, `outputs`; and a `_bmad/<code>/config.yaml` its skills read.
It overrides nothing in core. Composition is by named team (`team: creative`) and by shared
external skills: `module.yaml` states that "External skills (party-mode, retrospective,
advanced-elicitation, help catalog) read these descriptors to route, display, and embody
agents", and CIS registers the core `bmad-brainstorming` skill in its own help CSV rather
than forking it. Core variables are inherited, listed in `module.yaml` as comments:
`user_name`, `communication_language`, `document_output_language`, `output_folder`. User
extension happens outside the pack, in `_bmad/custom/config.toml` or
`config.user.toml`, and `module.yaml` says so: "users can add their own agents (real or
fictional)" there.

GDS is the phased shape, and the structural difference is one level of directory. Instead
of one flat `skills/`, it splits `src/agents/` (five: game-architect, game-designer,
game-dev, game-solo-dev, tech-writer) from `src/workflows/`, and the workflows are grouped
into numbered lifecycle phases: `1-preproduction/`, `2-design/`, `3-technical/`,
`4-production/`, plus an unnumbered `gametest/` and a loose `gds-document-project/`. Each
workflow directory carries more than a CIS one: `SKILL.md`, `customize.toml`,
`template.md`, `checklist.md`, and `discover-inputs.md`. GDS also asks richer install
questions (`project_name`, `game_dev_experience` as a three-level single-select that
"affects how agents explain concepts in chat", and its own `planning_artifacts` and
`implementation_artifacts` paths), so it declares its own output split rather than
inheriting core's. In short: CIS is a library of anytime capabilities, GDS is a parallel
full lifecycle that mirrors `bmm` phase for phase with game-specific workflows.

TEA footprint, one line: `tea/src/` follows the GDS shape, `agents/` plus `workflows/`
plus `module.yaml` and `module-help.csv`, with ten `SKILL.md` files.

**6. The builder (BMB).** Three builders plus a setup and an eval runner, each a skill
under `bmb/skills/`: `bmad-agent-builder`, `bmad-workflow-builder`, `bmad-module-builder`,
`bmad-bmb-setup`, `bmad-eval-runner`. A built workflow gets `SKILL.md` from
`assets/SKILL-template.md` plus an optional `customize-template.toml`. A built agent gets
a far larger set, and this is where BMAD's one memory design lives:
`assets/SKILL-template.md` or `SKILL-template-bootloader.md`, `customize-template.toml`,
`PERSONA-template.md`, `CREED-template.md`, `BOND-template.md`,
`CAPABILITIES-template.md`, `INDEX-template.md`, `MEMORY-template.md`,
`PULSE-template.md`, `memory-guidance-template.md`, `first-breath-template.md` with a
config, `capability-authoring-template.md`, plus two scripts, `init-sanctum-template.py`
and `wake-template.py`. A module is scaffolded by `bmad-module-builder` from
`assets/setup-skill-template/` (its own `SKILL.md`, `assets/module.yaml`,
`assets/module-help.csv`, and three merge scripts: `merge-config.py`,
`merge-help-csv.py`, `cleanup-legacy.py`) or, for a single skill, from
`assets/standalone-module-template/` which embeds self-registration into the skill itself.
`references/create-module.md` documents the eleven help-CSV columns the builder fills and
reads each existing `SKILL.md` plus `customize.toml` to populate `module.yaml:agents[]`.

**7. Installed footprint.** `_bmad/` at the project root, written by
`npx bmad-method install`. Top two levels: `_bmad/config.toml` and
`_bmad/config.user.toml` (installer-owned, team and user scope), `_bmad/custom/` (starts
empty; `config.toml`, `config.user.toml`, `<skill>.toml`, `<skill>.user.toml`),
`_bmad/scripts/` (including `resolve_customization.py` and `render_skill.py`),
`_bmad/<module-code>/config.yaml` per installed module, and `_bmad/<module>/module-help.csv`.
Outputs go to a sibling `_bmad-output/` with `planning-artifacts/` and
`implementation-artifacts/`. Per-tool projections are one skills directory per tool, from
`docs/reference/skills-and-agents.md`: `.claude/skills/` for Claude Code;
`.agents/skills/` for "Cursor, Windsurf, Codex, Auggie, Amp, and most others";
`.cline/skills/`; `.bob/skills/`; `.agent/skills/` for Antigravity; `.adal/skills/`.
No `.cursor/rules` and no `.claude/commands` are written; skills are the only projection.
`bmad-loop` adds a second root, `.bmad-loop/` (see below).

**8. What BMAD does not do.** No owner profile: nothing anywhere models the human beyond
`user_name`, `communication_language`, `document_output_language`, and a self-reported
experience level. No machine tier: there is a team scope and a user scope, and no
per-machine facts file. No capture inbox. No learning loop in core: `bmad-retrospective`
produces action items appended to `sprint-status.yaml`, but nothing promotes a repeated
finding into a rule, and no skill edits another skill. Persistent memory is absent from
core by design and present only two places, both opt-in and both outside `bmm`. First,
`persistent_facts` in a `customize.toml`, which the comment marks as static:
"Distinct from the runtime memory sidecar — these are static context loaded on
activation." Second, an agent built by BMB, which can be given a "sanctum": a curated
`MEMORY.md` with a stated budget ("Aim to stay under roughly 1500 tokens"), append-only
raw logs at `sessions/YYYY-MM-DD.md` that are deliberately not loaded on waking, a
`PULSE` curation pass that distills logs into memory and prunes, and a `wake.py`. Its
`memory-guidance-template.md` states the premise plainly: "You are stateless. Every
conversation begins with total amnesia. Your sanctum is the ONLY bridge between sessions.
If you don't write it down, it never happened." That is a template a user instantiates,
not something any shipped BMAD agent has.

**BMAD Loop, the outer orchestrator (v0.11.1).** Deliberately not an LLM: its
`docs/FEATURES.md` claims a "Deterministic control loop ... Story selection, retries,
gates, completion checks run in plain Python", against "LLM-as-orchestrator is
nondeterministic, hard to debug, and costs tokens for control flow". On-disk artifacts:
`bmad-loop init` copies a hook relay to `<project>/.bmad-loop/bmad_loop_hook.py`, writes
`.bmad-loop/policy.toml` from a template if missing, installs the bundled skills into each
selected CLI tree (`.claude/skills` for claude, `.agents/skills` for
codex/gemini/copilot), registers that CLI's hooks, and gitignores `.bmad-loop/runs/` and
`.bmad-loop/cache/` plus `policy.toml` itself, "policy is per-machine". The only file it
writes under `_bmad/` is `_bmad/bmad-loop/module-help.csv`. Per-run state lives in
`.bmad-loop/runs/` as `journal.jsonl`, `state.json`, and `stop-request.json`. Three skills
ship with the wheel: `bmad-loop-setup`, `bmad-loop-resolve` (interactive escalation
resolution), and `bmad-loop-sweep` (deferred-work triage, which "normalizes and migrates
the deferred-work ledger per its own deferred-work-format.md").

What carries between iterations is one append-only ledger:
`{implementation_artifacts}/deferred-work.md`, owned by the orchestrator and described as
"the sweep's sole read surface". Entries are numbered `DW-<seq>` with fields `origin`,
`location`, `severity` (critical | high | medium | low), `reason`, `status`, plus
`source_spec` on harvested entries. Three rules are worth stealing outright. The file is
append-only: "never rewrite or delete existing entries." A repeat is recorded rather than
duplicated: scan for the same issue first, and if found "add a `seen-again:` line to the
existing entry instead". And `location: n/a` is written explicitly, with the semantics
spelled out: "The field says 'no location was recorded', not 'this item has none'", and a
reader that finds `n/a` falls back to `reason`. The harvest path is a handoff contract: the
inner primitive `bmad-build-auto` records defers in its spec's frontmatter `deferred:`
list, and "after the session the orchestrator harvests those into canonical entries",
carrying a fingerprinted `origin:` that is half the dedupe key. Gating is per story rather
than per run: `spec_checkpoint` pauses to review the plan before code, `done_checkpoint`
pauses after the commit, "both independent, both surfaced in the TUI", because "Coarse
run-global gates can't ask for a plan review on _this_ story only". Non-convergence is
damped rather than looped: a finalized pass that keeps recommending its own follow-up is
honored a bounded number of times, "after which the round converges (verify + commit) and
the lingering recommendation is re-filed to the deferred-work ledger instead of burning
cycles to the hard cap". A stray uncommitted file in the main checkout escalates and pauses
an unattended run.

**Sources for this subsection.** Main repo, SHA `94b6727b00c8316557828c8a8ff2a48ff60d60cc`:
`skills/bmad-build/spec-template.md`, `step-03-implement.md`, `compile-epic-context.md`,
`sync-sprint-status.md`; `skills/bmad-sprint-planning/sprint-status-template.yaml`,
`references/readiness-gate.md`, `references/fix-sprint-status.md` (path only);
`skills/bmad/assets/config.template.toml`; `docs/reference/skills-and-agents.md`;
`docs/customize/customize-bmad.md`. Local module clones under
`<external-modules>\`:
`cis/package.json`, `cis/src/module.yaml`, `cis/src/module-help.csv`,
`cis/src/skills/bmad-cis-agent-storyteller/{customize.toml,SKILL.md}` (repo
https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite);
`gds/package.json`, `gds/src/module.yaml`, `gds/src/` tree (repo
https://github.com/bmad-code-org/bmad-module-game-dev-studio);
`bmb/package.json`, `bmb/skills/` tree,
`bmb/skills/bmad-agent-builder/assets/{MEMORY-template.md,memory-guidance-template.md}`,
`bmb/skills/bmad-module-builder/references/create-module.md`,
`bmb/skills/bmad-module-builder/assets/` tree (repo
https://github.com/bmad-code-org/bmad-builder);
`bmad-loop/module.yaml`, `bmad-loop/docs/{setup-guide.md,FEATURES.md}`,
`bmad-loop/src/bmad_loop/install.py`,
`bmad-loop/src/bmad_loop/data/skills/bmad-loop-sweep/deferred-work-format.md`;
`tea/package.json`, `tea/src/` tree. No script from any clone was executed.

---

### coleam00/context-engineering-intro

- URL: https://github.com/coleam00/context-engineering-intro
- Stars 13,833 · forks 2,722 · last push 2026-03-16T12:13:59Z · license MIT
- SHA read: `a2d84b021cee1e2f4e77ba854bba0be8cb319035` (branch `main`)
- Created 2025-07-02. 32 open issues.
- Purpose: a clone-and-edit template that turns a one-page feature request into a
  self-contained "Product Requirements Prompt" the agent then executes.

**Entry files the agent is told to read, in order**

`CLAUDE.md` is the law and states its own startup order in its first section: "**Always
read `PLANNING.md`** at the start of a new conversation" and "**Check `TASK.md`** before
starting a new task. If the task isn't listed, add it with a brief description and
today's date."

Neither `PLANNING.md` nor `TASK.md` exists in the repo at this SHA. I checked the full
recursive tree: the only matches are unrelated (`use-cases/.../planning/` under a
different template, and `src/index.ts` files). The law names a state surface and a task
graph that the template does not ship. Users are expected to create them, but nothing
says so.

**Layout, quoted from `README.md`**

```
context-engineering-intro/
├── .claude/
│   ├── commands/
│   │   ├── generate-prp.md    # Generates comprehensive PRPs
│   │   └── execute-prp.md     # Executes PRPs to implement features
│   └── settings.local.json    # Claude Code permissions
├── PRPs/
│   ├── templates/
│   │   └── prp_base.md       # Base template for PRPs
│   └── EXAMPLE_multi_agent_prp.md  # Example of a complete PRP
├── examples/                  # Your code examples (critical!)
├── CLAUDE.md                 # Global rules for AI assistant
├── INITIAL.md               # Template for feature requests
├── INITIAL_EXAMPLE.md       # Example feature request
└── README.md                # This file
```

Plus `validation/` (three files), `claude-code-full-guide/` (a second copy of the
template with its own `CLAUDE.md`, `INITIAL.md`, `PRPs/`, `.claude/`, `.devcontainer/`),
and seven `use-cases/` sub-templates, of which
`use-cases/ai-coding-workflows-foundation/` carries `agents/` (codebase-analyst,
validator) and `commands/` (create-plan, execute-plan, primer), and
`use-cases/build-with-agent-team/` carries a `SKILL.md` and an `example-plan/`.

**Primitives present**

1. Law: `CLAUDE.md`, hand-written project rules. Six sections, 60 lines.
2. State surface: named but not shipped. `PLANNING.md` does not exist.
3. Index: not found. `INITIAL.md` is an input form, not a router.
4. Capture inbox: `INITIAL.md` is the closest thing, a fixed four-section form (FEATURE,
   EXAMPLES, DOCUMENTATION, OTHER CONSIDERATIONS) that the user fills and
   `/generate-prp` consumes.
5. Durable memory: `examples/` is the durable pattern library, and `README.md` calls it
   "critical!". At this SHA it contains only `.gitkeep`. Nothing about the user.
6. Dated log: named but not shipped. `CLAUDE.md` instructs the agent to stamp tasks with
   "today's date" in `TASK.md`.
7. Records: `PRPs/<feature>.md` is the record of one feature's full context. The template
   is `PRPs/templates/prp_base.md`.
8. Skills: two slash commands in the root template (`generate-prp`, `execute-prp`); one
   `SKILL.md` in a use-case sub-template.
9. Roles: two agent definitions, but only inside
   `use-cases/ai-coding-workflows-foundation/agents/`. The root template has none.
10. Task graph: named but not shipped (`TASK.md`), with a stated convention for a
    "Discovered During Work" section.
11. Handoff ledger: not found.
12. Evidence: partial, and the interesting part. `README.md` claims "Validation loops
    allow AI to fix its own mistakes", and `validation/` holds
    `ultimate_validate_command.md` and `example-validate.md`. `CLAUDE.md` requires a
    three-case Pytest set per feature (expected use, edge case, failure case) in a
    `/tests` folder mirroring the app.
13. Gates: none enforced. `CLAUDE.md` says "Never delete or overwrite existing code
    unless explicitly instructed to or if part of a task from `TASK.md`" and "Never
    assume missing context. Ask questions if uncertain."
14. Boundary: `.claude/settings.local.json` only.
15. Maintenance loop: partial. `CLAUDE.md` requires updating `README.md` when features or
    dependencies change and marking tasks done in `TASK.md` immediately. No script.
16. Tool projections: `.claude/` only.
17. Multi-project routing: the repo is a bag of sibling templates (`use-cases/*`,
    `claude-code-full-guide/`), each with its own `CLAUDE.md`. There is no inheritance or
    override between them, so it is duplication, not routing.
18. Factory/product: `examples/` and `PRPs/templates/` are the factory; `PRPs/<feature>.md`
    is the product.
19. Generated index: not found.

**Primitives absent that I would expect**

Two of the three files the law tells the agent to read first. No index. No roles at the
root. No handoff. The 500-line file cap, Python-only stance, and `venv_linux` reference
in `CLAUDE.md` are project-specific rules shipped as a general template, so the law and
the template disagree about scope.

**Loop**

Stated in `README.md` as a five-step sequence: edit `CLAUDE.md`, add `examples/`, fill
`INITIAL.md`, run `/generate-prp INITIAL.md`, run `/execute-prp PRPs/your-feature.md`.
`CLAUDE.md` adds a per-conversation preamble (read `PLANNING.md`, check `TASK.md`) and a
per-task postamble (mark done in `TASK.md`, add discovered TODOs). No maintenance cadence.

**Memory split**

Per-project: everything, committed. Per-user, per-machine, per-session: not modeled.

**Human gates**

None enforced. Two prose instructions about asking and about not overwriting.

**Evidence of real use**

Wide adoption, dormant repo. 2,722 forks and 32 open issues, but the last commit is
2026-03-16, six months before reading, and `examples/` (called critical) is empty. The
`PLANNING.md`/`TASK.md` gap has survived every commit. Note that
SuperClaude_Framework's repo root carries `PLANNING.md`, `TASK.md`, and `KNOWLEDGE.md`
by those exact names, which suggests the trio propagated from this template.

**Generalizes**

A fixed-section intake form (`INITIAL.md`) as the only thing a human writes. A dated
per-feature record folder. Naming an examples library as the highest-value context. The
three-test rule (expected, edge, failure) as a definition of done.

**Idiosyncratic**

"Context Engineering is 10x better than prompt engineering and 100x better than vibe
coding" as a header claim. `venv_linux` hardcoded in a general template. The 500-line
file cap.

**Sources** (under `https://raw.githubusercontent.com/coleam00/context-engineering-intro/a2d84b021cee1e2f4e77ba854bba0be8cb319035/`)

- `CLAUDE.md`: startup read order naming `PLANNING.md` and `TASK.md`, task-completion
  convention, three-test rule, prohibitions
- `README.md`: five-step loop, template structure tree, validation-loop claim
- `INITIAL.md`: four-section intake form
- Git tree at that SHA: absence of `PLANNING.md` and `TASK.md`; `examples/` holds only
  `.gitkeep`

---

### RinDig/icm-architect

- URL: https://github.com/RinDig/icm-architect
- Stars 1,536 · forks 218 · last push 2026-08-25T21:18:28Z · license MIT
- SHA read: `e16cafe6a664dcf6d787a726b452adba77d913f4` (branch `main`)
- Created 2026-07-18. 2 open issues.
- Purpose: a single Claude skill that designs a described process into a folder workspace,
  or restructures an existing folder into one, where the folder structure replaces
  framework code.

**Which repo I settled on and why**

GitHub search for "interpretable context model" and "icm-architect" returned a large
field. `RinDig/icm-architect` is canonical for this slice for three reasons: the owner's
GitHub profile name is "JV", matching Jake Van Clief; `SKILL.md` cites the method as
"Interpretable Context Methodology (Van Clief & McDermott, arXiv:2603.16021,
MIT-licensed)", making it the author's own implementation of his own paper; and at 1,536
stars and 218 forks it is an order of magnitude ahead of every other ICM repo. Everything
else in the search field is downstream: `jsbuissnet/icm-architect-plugin` states in its
description that the "Original skill by RinDig"; `shutori/icm-architect-codex` and
`adrozdenko/icm-architect-codex` are Codex ports; `RadFlavor/icm-architect`,
`ndxtraders/icm-architect`, and `vladai-git/icm-architect` are zero-star copies;
`blackghostosint/icm-workspace-architect` (8 stars) and `ktnCodes/icm-template` (58
stars, branch `master`, last push 2026-04-14) are independent takes. Note that the
Van Clief paper is cited by the skill; I did not read the arXiv paper itself, so its
content is secondhand here.

One-line classification: this is a **skill, not a workspace people work inside**. I keep
the full record because it is the only artifact in the slice that states a general
workspace grammar, and because every primitive in my vocabulary appears in it as a rule
rather than as a file.

**Entry files the agent is told to read, in order**

`SKILL.md`, then by branch: `references/forms.md` at step 2 of either mode;
`references/system-map.md` if the System map form is chosen;
`references/reference-integrity.md` at step 4 of Restructure mode; `references/core.md`
"when writing contracts or when a structural call is contested".

**Layout**

```
icm-architect/
├── SKILL.md
├── README.md
├── references/
│   ├── core.md                  five principles, five-layer hierarchy, naming,
│   │                            library rules, token discipline, where ICM loses
│   ├── forms.md                 six forms with skeletons
│   ├── system-map.md            audit pipeline for the System map form
│   └── reference-integrity.md   the move-safety gate
└── assets/templates/
    ├── CLAUDE.md            root entry template
    ├── CONTEXT.md           workspace contract
    ├── stage-CONTEXT.md     per-folder contract
    ├── node.md, object.md, process.md, schema.md, questionnaire.md
```

The workspace it generates, quoted from `references/forms.md` (Pipeline form):

```
├─ CLAUDE.md               identity + routing table
├─ CONTEXT.md              the pipeline in one screen
├─ stages/
│  ├─ 01_research/   {CONTEXT.md, references/, output/}
│  ├─ 02_script/     {CONTEXT.md, references/, output/}
│  └─ 03_production/ {CONTEXT.md, references/, output/}
├─ _shared/                factory: voice.md, design-system.md
└─ setup/questionnaire.md  configures the factory once
```

Six forms are named with skeletons: Pipeline, Umbrella, Record library, Knowledge
bundle, Context map, System map. The Record library skeleton names
`00_START-HERE.md`, `_index/log.md` ("one line per record, id + status"),
`_templates/record-template/`, `01_reference/`, `records/`. The Context map skeleton
names `FILE-MAP.md` ("GENERATED index — agents jump here, never crawl"), `_meta/`,
`teams/<team>/<Team>.md` node cards with "In / Movement / Out / Edges", `patterns/`,
`dashboards/00-tracker.md`.

**Primitives present**

1. Law: invariant 2 defines it. "A small, stable entry file. `CLAUDE.md` (or
   `AGENTS.md`) at the root answers 'where am I, where does everything live, where do I
   go for task X' — and nothing else. Target under ~60 lines. It routes; it never holds
   content."
2. State surface: invariant 9 replaces it with the filesystem. "The filesystem is the
   state machine. 'Status' is derivable by scanning what exists in output folders."
   The Record library form does carry `_index/log.md` with "id + status", and the Context
   map form carries `dashboards/00-tracker.md`.
3. Index: the catalog metaphor is the core of the method. `CLAUDE.md` (L0) plus root
   `CONTEXT.md` (L1) are "the catalog: small, stable, no content payload". Library rule:
   "The catalog holds no books."
4. Capture inbox: not found as a primitive. `setup/questionnaire.md` is a one-time intake,
   not an inbox.
5. Durable memory: the factory layer (L3: `_shared/`, `references/`) is the durable
   store, and it is about the work rather than the user or the machine. No user profile.
6. Dated log: not found. Ordinal-prefixed files (`00-tracker.md`) are ordered, not dated.
7. Records: the Record library form exists for exactly this, and stage `output/` folders
   hold per-run artifacts.
8. Skills: the artifact is itself a skill. The guardrail states the ladder: "chat → saved
   prompt/skill → folders + one agent. Only climb when the rung below is genuinely
   automated and repeating."
9. Roles: deliberately absent, and this is the thesis. "One agent, reading the right files
   at the right moment, replaces a multi-agent framework."
10. Task graph: the folder numbering is the graph. "Numbering encodes order. `01_`, `02_`,
    … where sequence matters. Renaming folders reorders the pipeline — that is the point."
11. Handoff ledger: one folder's `output/` is the next folder's declared input. The
    stage contract's Inputs section splits "Working (this run)" from "Reference (every
    run)" with exact paths.
12. Evidence: the walk test. Validate any workspace "by walking it cold, as an agent with
    no memory", with eight named checks including a token check (entry file plus one
    contract plus its inputs should land in 2k to 8k tokens) and, after a restructure,
    "does every reference that existed *before* the move still resolve?"
13. Gates: invariant 6 and the one rule in the `CLAUDE.md` template. "Nothing moves to
    the next stage until a person has read the output of the last one." Each stage
    contract carries "Exactly one human check, stated as something a person does, not a
    vague 'review.'" Restructure mode step 5 is a propose-before-moving gate, and step 6
    is copy, verify parity by file count and content hash, then remove.
14. Boundary: the underscore convention. "Meta/system folders get an underscore prefix
    and sort to the top: `_meta/`, `_system/`, `_shared/`, `_config/`, `_templates/`,
    `_index/`, `_archive/`. Underscore = 'about the workspace, not of the work.'"
15. Maintenance loop: Restructure mode is the loop, with a five-role classification
    (Catalog, Contract, Factory, Product, Dead) and the rule that "A file is Dead only
    after step 4 confirms nothing depends on it — apparent disuse is not proof."
16. Tool projections: handled by a de-duplication rule rather than a directory. "Entry
    file: `CLAUDE.md` for Claude Code, `AGENTS.md` for other agents. If both exist, one
    is generated from the other or is a one-line pointer — never two hand-maintained
    copies."
17. Multi-project routing: the Umbrella form. Several full Pipeline workspaces, each with
    its own `CLAUDE.md`, under one root that holds the shared factory layers.
18. Factory/product: invariant 5, named. "Reference material (rules, voice, schemas,
    templates — stable across runs) lives structurally apart from working artifacts
    (outputs, drafts — new every run)."
19. Generated index: a library rule. "Generated indexes are never hand-edited. A file map
    built from frontmatter by a script cannot drift; a hand-curated one always does. If
    an index matters, script it and schedule the rebuild."

**Primitives absent that I would expect**

No dated log and no durable memory about the person or machine, which is consistent with
its scope (it structures work, not a life). No capture inbox. No roles, by design.

**Loop**

Not a session loop; a design loop. Build mode: extract structure from dialogue, pick a
form, scaffold the smallest structure, write the contracts, validate with the walk test.
Restructure mode: inventory without touching, find the hidden form, classify every file
into five roles, verify reference integrity before proposing, propose before moving,
migrate copy-verify-remove, walk test. The runtime loop it installs is per stage: read
the stage `CONTEXT.md`, read its declared inputs, do one job, write to `output/`, stop
for a human.

**Memory split**

Per-workspace: the factory layer. Per-run: the product layer. No per-user, per-machine,
or per-session tier. The method's one concession to reuse is "Method and instance live
apart. The blank, reusable template of a structure is a different artifact from any
filled-in deployment of it."

**Human gates**

One per stage, mandatory, and named as something a person does. Propose-before-moving in
Restructure mode, with the reviewer approving "against the reference report from step 4,
not against a hunch". Case-folded destination collisions must be surfaced at the approval
gate, with the Windows and macOS failure named: "`CLAUDE.md` → `CONTEXT.md` silently
overwrites an existing `context.md`, and a file-inventory map will not show the
collision."

**Evidence of real use**

Moderate but specific. 218 forks and a downstream ecosystem of ports and plugins within
two months of creation. The most recent commit message is itself evidence of field
feedback: "Take the field-tested restructure fixes; leave the invariants alone."
`SKILL.md` lists "Anti-patterns seen in the wild" with five concrete decay modes, and
sets a bar for when an observation becomes structure: "one team complaining is a gripe —
the same shape appearing three independent times is structure."

**Generalizes**

Nearly all of it, since it is written as a general grammar. The five-layer hierarchy with
token budgets per layer (L0 300-800, L1 200-500, L2 200-500, L3 500-2k, L4 varies). The
catalog-holds-no-books rule. Underscore prefix for workspace-about-workspace folders.
One home per fact, link beats copy. The walk test as a cold-start audit. Move safety as
enumerate-referrers, then propose, then copy-verify-remove.

**Idiosyncratic**

The library metaphor carried all the way through. The honest "Where ICM loses" section
naming real-time multi-agent collaboration, high concurrency, and automated mid-pipeline
branching. The anti-over-structuring guardrail: "A workspace for a thing done twice is
scaffolding, not architecture."

**Sources** (under `https://raw.githubusercontent.com/RinDig/icm-architect/e16cafe6a664dcf6d787a726b452adba77d913f4/`)

- `SKILL.md`: ten invariants, mode selection, build and restructure steps, walk test,
  guardrails, anti-patterns
- `references/core.md`: five principles, five-layer table with token budgets, stage
  contract format, naming conventions, library rules, token discipline, where ICM loses
- `references/forms.md`: six form skeletons
- `assets/templates/CLAUDE.md`: entry-file template with routing tables and the one rule
- GitHub search results and `gh api users/RinDig`: authorship and canonicity

---

## Vendor conventions

### Vendor: Anthropic Claude Code

Source: https://code.claude.com/docs/en/memory and https://code.claude.com/docs/en/claude-directory,
accessed 2026-09-13.

**Levels, in load order from broadest to most specific**

| Scope | Location | Shared with |
|---|---|---|
| Managed policy | macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux and WSL `/etc/claude-code/CLAUDE.md`; Windows `C:\Program Files\ClaudeCode\CLAUDE.md` | all users in the org |
| User instructions | `~/.claude/CLAUDE.md` | just you, all projects |
| Project instructions | `./CLAUDE.md` or `./.claude/CLAUDE.md` | team, via source control |
| Local instructions | `./CLAUDE.local.md` | just you, current project |

A fifth path exists: the `claudeMd` key inside `managed-settings.json` carries managed
content inline, with "**Precedence**: same as a managed CLAUDE.md file", and it is
honored only in managed and policy settings.

**Precedence on conflict**

There is no override. "All discovered files are concatenated into context rather than
overriding each other." Ordering is positional: "Across the directory tree, content is
ordered from the filesystem root down to your working directory", and within a directory
"`CLAUDE.local.md` is appended after `CLAUDE.md`". The docs are explicit that two
conflicting rules produce arbitrary behavior: "If two rules contradict each other, Claude
may pick one arbitrarily." Hard enforcement is a different mechanism: "To block an action
regardless of what Claude decides, use a PreToolUse hook instead."

Managed policy is the one true override, in the negative direction: "Managed policy
CLAUDE.md files cannot be excluded."

**Nesting**

Ancestor files load at launch: every `CLAUDE.md` and `CLAUDE.local.md` from the cwd up.
Descendant files load lazily: "Claude also discovers `CLAUDE.md` and `CLAUDE.local.md`
files in subdirectories under your current working directory. Instead of loading them at
launch, they are included when Claude reads files in those subdirectories."
`claudeMdExcludes` (glob patterns against absolute paths, mergeable across settings
layers) skips unwanted ancestors in a monorepo.

**Imports**

`@path/to/import`, relative to the importing file, "with a maximum depth of four hops".
Imports are expanded at launch, so they organize but do not save context. Code spans and
fenced blocks are skipped, so `` `@README` `` stays literal. An import in a project file
that resolves outside the working directory is an "external import" and triggers a
one-time approval dialog; declining disables them permanently. User-scope imports are
trusted without the dialog, except in Cowork desktop sessions.

**Rules directory**

`.claude/rules/*.md`, discovered recursively, "loaded at launch with the same priority as
`.claude/CLAUDE.md`" when they have no `paths` frontmatter. With `paths` frontmatter they
are glob-scoped and load only when Claude reads a matching file. User-level rules live in
`~/.claude/rules/` and are "loaded before project rules, giving project rules higher
priority". Symlinked rule directories from outside the working directory are treated like
external imports.

**Locations of the other surfaces** (from the `.claude` directory page and the memory page)

- Skills: `~/.claude/skills/<name>/SKILL.md` (user) and `.claude/skills/` (project).
  Commands and skills are the same mechanism now; `commands/` is legacy.
- Agents: `~/.claude/agents/<name>.md` and `.claude/agents/`.
- Hooks: configured in `settings.json` at any settings layer.
- Settings: `~/.claude/settings.json` (user), `.claude/settings.json` (project,
  committed), `.claude/settings.local.json` (project, gitignored),
  `managed-settings.json` (policy).
- Workflows: `~/.claude/workflows/` and `.claude/workflows/`.
- Output styles, themes, keybindings: `~/.claude/{output-styles,themes}/`,
  `~/.claude/keybindings.json`.
- Auto memory: `~/.claude/projects/<project>/memory/`, containing a `MEMORY.md` index
  plus one topic file per memory. Relocatable via `autoMemoryDirectory`.
- Subagent memory: a separate `agent-memory/<agent-name>/` directory.

**Auto memory, as a distinct system**

Claude writes it, not the user. Four types recorded in frontmatter: `user`, `feedback`,
`project`, `reference`. Only the first 200 lines or 25 KB of `MEMORY.md` load per
session; topic files load on demand. It is keyed to the git repository, so "all worktrees
and subdirectories within the same repo share one auto memory directory", and it is
"machine-local", excluded from the transcript retention sweep. Writes get a `modified`
ISO-8601 frontmatter field. A subagent does not inherit the main conversation's auto
memory unless it is a fork.

**AGENTS.md**

"Claude Code reads `CLAUDE.md`, not `AGENTS.md`." Two sanctioned bridges: a `CLAUDE.md`
containing `@AGENTS.md` plus any Claude-specific additions below it, or
`ln -s AGENTS.md CLAUDE.md` when no additions are needed. The docs name the Windows
caveat: symlinks need Administrator or Developer Mode there, so use the import.
`/init` reads `.cursor/rules/`, `.cursorrules`, and `.github/copilot-instructions.md`;
with `CLAUDE_CODE_NEW_INIT=1` it also reads `AGENTS.md`, `.devin/rules/`,
`.windsurf/rules/`, `.windsurfrules`, and `.clinerules`. `/import` copies another agent's
config in once.

**What the agent reads at startup**

Managed policy, user, and ancestor project CLAUDE.md and CLAUDE.local.md; unscoped rules
from `~/.claude/rules/` then `.claude/rules/`; all `@` imports expanded; the first 200
lines of auto-memory `MEMORY.md`. Delivered "as a user message after the system prompt,
not as part of the system prompt itself", which the docs give as the reason compliance is
not guaranteed. Project-root CLAUDE.md is re-read from disk after `/compact`; nested files
and path-scoped rules reload only when a matching file is next read. `/context` lists
what actually loaded; the `InstructionsLoaded` hook logs it.

---

### Vendor: OpenAI Codex and the AGENTS.md convention

Sources: https://agents.md and https://learn.chatgpt.com/docs/agent-configuration/agents-md
(reached via a 308 redirect from https://developers.openai.com/codex/guides/agents-md),
accessed 2026-09-13.

**Levels**

1. Global: `~/.codex/` (or `$CODEX_HOME`). `AGENTS.override.md` is checked first, then
   `AGENTS.md`. "Uses only the first non-empty file at this level."
2. Project: every directory from the Git root down to the current working directory. Each
   directory is checked for `AGENTS.override.md`, then `AGENTS.md`, maximum one file per
   directory. Additional filenames can be registered via
   `project_doc_fallback_filenames`.

So yes, `~/.codex/AGENTS.md` is read, and an `AGENTS.override.md` beside it wins at that
level.

**Precedence**

Concatenation with positional precedence, the same model as Claude Code: "Codex
concatenates files from the root down, joining them with blank lines. Files closer to your
current directory override earlier guidance because they appear later."

The agents.md site states the general convention more bluntly: "The closest AGENTS.md to
the edited file wins; explicit user chat prompts override everything." So the full chain
is user chat, then nearest file, then progressively more distant files.

**Nesting**

"Place another AGENTS.md inside each package. Agents automatically read the nearest file
in the directory tree, so the closest one takes precedence and every subproject can ship
tailored instructions." The site cites scale: "at time of writing the main OpenAI repo has
88 AGENTS.md files."

**Limits**

Combined size capped at 32 KiB by default (`project_doc_max_bytes`). Empty files skipped.
Discovery rebuilds on every run, with no caching.

**Config and memory**

`~/.codex/config.toml`. The page I read does not specify where Codex keeps prompts,
skills, or memory, so I record that as not found rather than guessing. Third-party
evidence in this slice points at `.agents/skills/` as the de-facto Codex skills path:
BMAD's `docs/reference/skills-and-agents.md` lists Codex under `.agents/skills/`, and
superpowers ships a `.codex-plugin/plugin.json`. Neither is an OpenAI source.

---

### Vendor: Cursor

Source: https://cursor.com/docs/context/rules (reached after a 308 from
docs.cursor.com/en/context/rules), accessed 2026-09-13.

**Levels**

- Project rules: `.cursor/rules`, files "must use the .mdc extension". A plain `.md`
  there is ignored, because it carries no frontmatter. Rules can be organized into
  subdirectories (the docs show `frontend/components.mdc`); the page I read does not
  describe nested `.cursor/rules` directories in subprojects as a separate behavior, so I
  record that as not stated.
- User rules: "global to your Cursor environment. Used by Agent (Chat)", configured
  through Customize then Rules, not through a file path the docs name.
- `AGENTS.md`: "a simple markdown file for defining agent instructions" at the project
  root, offered as an alternative to `.cursor/rules`, "with support for nested
  implementations in subdirectories".

**Rule types**, keyed off the `alwaysApply` and `description` frontmatter fields:

1. Always Apply: "Apply to every chat session"
2. Apply Intelligently: the agent decides from the `description`
3. Apply to Specific Files: activated when a file matches a glob, e.g.
   `src/components/**/*.tsx`
4. Manual: "Included only when you @-mention the rule in chat"

**Precedence**

Not stated on the page I read. There is no documented conflict order between user rules,
project rules, and `AGENTS.md`. This is the weakest-specified hierarchy of the four
vendors.

**Not found**

Legacy `.cursorrules` is not mentioned on this page. Memory storage is not addressed. Hook
and agent locations are not on this page.

---

### Vendor: Google Gemini CLI

Source: the official repo `google-gemini/gemini-cli`, SHA
`9c1b0a610534d6f8120964cf2672c07807d8fc90` (branch `main`, last push 2026-09-13,
Apache-2.0, 106,955 stars). Files: `docs/cli/gemini-md.md`, `docs/cli/skills.md`,
`docs/cli/auto-memory.md`, `docs/hooks/index.md`, `docs/core/subagents.md`.

**Levels, in load order**

1. Global: `~/.gemini/GEMINI.md`.
2. Environment and workspace: "The CLI searches for `GEMINI.md` files in your configured
   workspace directories and their parent directories."
3. Just-in-time: "When a tool accesses a file or directory, the CLI automatically scans
   for `GEMINI.md` files in that directory and its ancestors up to a trusted root."

**Precedence**

Concatenation, like the other two: "It loads various context files from several locations,
concatenates the contents of all found files, and sends them to the model with every
prompt." Order is global, then workspace, then JIT. No override semantics are stated.

**Nesting**

JIT discovery is the nesting mechanism, and it is the most aggressive of the four: it
fires on tool access rather than on launch or on read, walking ancestors up to a trusted
root. The footer shows how many context files are loaded.

**Imports and inspection**

`@file.md` syntax, relative or absolute. `/memory show` prints the full concatenated
memory; `/memory reload` rescans.

**Configurable filename**

Unique to Gemini among these four: `context.fileName` in `settings.json` accepts a list,
and the docs' own example is `["AGENTS.md", "CONTEXT.md", "GEMINI.md"]`.

**Skills**

Four tiers, lowest to highest precedence: built-in, extension, user (`~/.gemini/skills/`
or the `~/.agents/skills/` alias), workspace (`.gemini/skills/` or the `.agents/skills/`
alias). Within a tier, "the `.agents/skills/` alias takes precedence over the
`.gemini/skills/` directory", and the reason is stated: "The `.agents/skills/` alias
provides an interoperable path for managing agent-specific expertise that remains
compatible across different AI tools."

**Agents**

`.gemini/agents/*.md` (project, shared) and `~/.gemini/agents/*.md` (personal). Subagent
access can be governed by a `.toml` policy file in `~/.gemini/policies/`.

**Hooks**

In `settings.json`, merged across three layers: `.gemini/settings.json` (project),
`~/.gemini/settings.json` (user), `/etc/gemini-cli/settings.json` (system). A
`SessionStart` event exists ("When a session begins (startup, resume, clear)") with the
stated use "Inject Context". Environment variables include `GEMINI_PROJECT_DIR` and
`GEMINI_PLANS_DIR`.

**Memory**

Two systems. `GEMINI.md` is the hand-written one. Auto Memory is experimental and off by
default (`experimental.autoMemory`), and its design is a review inbox rather than direct
writes: it mines idle transcripts from `~/.gemini/tmp/<project>/chats/` (sessions need 10
or more user messages and 3 hours idle), drafts unified-diff `.patch` files and `SKILL.md`
drafts into a project-local inbox, and applies nothing without approval through
`/memory inbox`. Approved global patches "target only your personal `~/.gemini/GEMINI.md`
file"; private patches target the project memory directory. Skills promote to
`~/.gemini/skills/` or `.gemini/skills/`. Project `GEMINI.md` files are explicitly out of
scope: "Project or workspace shared instructions in project `GEMINI.md` files are not
auto-extractable." A lock file in the project memory directory serializes runs.

---

## Patterns across this slice

Y = present as a real file or an enforced rule. P = partial, named but thin, or named and
not shipped. N = not found.

| # | Primitive | LifeOS | agent-os | superpowers | SuperClaude | BMAD | context-eng | icm-architect |
|---|---|---|---|---|---|---|---|---|
| 1 | Law | Y | N | Y | Y | P | Y | Y |
| 2 | State surface | Y | P | P | P (stale) | Y | P (not shipped) | P (filesystem) |
| 3 | Index or map | Y | Y | N | Y | P (disk) | N | Y |
| 4 | Capture inbox | Y | N | N | N | N | P | N |
| 5 | Durable memory | Y | P | N | P (MCP) | Y | P | P |
| 6 | Dated log | Y | Y | Y | N | Y | P (not shipped) | N |
| 7 | Records | Y | Y | Y | P | Y | Y | Y |
| 8 | Skills | Y | P | Y | Y | Y | P | Y |
| 9 | Roles | Y | N | P | Y | Y | P | N (by design) |
| 10 | Task graph | P | P | Y | P | Y | P (not shipped) | Y (numbering) |
| 11 | Handoff ledger | N | N | Y | P (MCP) | Y | N | P |
| 12 | Evidence | Y | N | Y | P | Y | P | Y (walk test) |
| 13 | Gates | Y | Y | Y | N | Y | N | Y |
| 14 | Boundary | Y | P | Y | N | Y | P | Y |
| 15 | Maintenance loop | Y | Y | Y | P (claimed) | Y | P | Y |
| 16 | Tool projections | P (1) | P (1) | Y (9) | P (1) | Y (6) | P (1) | Y (rule) |
| 17 | Multi-project routing | Y | Y | N | N | Y | P | Y |
| 18 | Factory/product | P | Y | N | N | Y | Y | Y |
| 19 | Generated index | Y | Y | N | Y | P | N | Y |

What every system shares: all seven put durable behavior in plain markdown files on disk
rather than in code, and all seven treat the directory layout itself as the mechanism, not
as documentation of a mechanism. All seven separate a stable reference layer from a
per-run artifact layer, even the three that never name the distinction. All seven put
records in dated or slugged folders rather than in a database, and six of the seven derive
some state by scanning what exists on disk rather than by reading a status field.

Where they split, and the split is sharp. The first fault line is whether the workspace
holds a person or holds a project: LifeOS and icm-architect model a human (identity,
goals, voice, a principal), while agent-os, BMAD, superpowers, and context-eng model a
codebase and carry no user profile at all. The second is enforcement. LifeOS and BMAD
enforce their rules with hooks and machine-readable status fields, superpowers enforces
with one synchronous SessionStart hook plus an eval harness, and agent-os, SuperClaude,
and context-eng enforce with prose the model may ignore. The third is where the law lives:
five repos ship one law file, BMAD deliberately ships none and makes the help skill
re-derive routing from disk on every request, and agent-os ships none at all and injects
standards on demand instead. The fourth is memory: only LifeOS and BMAD keep durable
memory in the workspace in a form a human can open, SuperClaude exports it entirely to one
third-party MCP server, and superpowers refuses the primitive on purpose because it holds
that git is the record. The fifth is cross-tool reach: superpowers (nine projections) and
BMAD (six documented paths) are built to be portable, and the other five are effectively
Claude Code monocultures. The last split is honesty about limits. icm-architect and BMAD
name where their method loses and what evidence would change a rule; the rest do not, and
two of them ship a law that points at files the repo does not contain.

---

## Instruction-file hierarchy comparison

| | Claude Code | Codex | Cursor | Gemini CLI |
|---|---|---|---|---|
| Levels | 4 plus inline: managed policy, user `~/.claude/CLAUDE.md`, project `./CLAUDE.md` or `./.claude/CLAUDE.md`, local `./CLAUDE.local.md`, plus `claudeMd` inside managed settings | 2: global `~/.codex/AGENTS.override.md` then `AGENTS.md`; project, every dir from Git root to cwd, `AGENTS.override.md` then `AGENTS.md` | 3 named: user rules (UI-configured, no documented path), project `.cursor/rules/*.mdc`, root `AGENTS.md` | 3: global `~/.gemini/GEMINI.md`, workspace dirs and their parents, just-in-time on tool access |
| Precedence | Concatenation, root down to cwd; `CLAUDE.local.md` appended after `CLAUDE.md` per dir; contradictions resolve arbitrarily; managed policy cannot be excluded | Concatenation, root down; "Files closer to your current directory override earlier guidance because they appear later"; user chat overrides everything; 32 KiB cap | Not stated on the rules page. `alwaysApply` and glob matching decide activation, not conflict order | Concatenation of global, then workspace, then JIT. No override semantics stated |
| Nesting | Ancestors load at launch; descendants load when Claude reads a file in that dir; `claudeMdExcludes` globs skip ancestors | One file per directory, Git root down to cwd; nearest wins; OpenAI's own repo has 88 files | `AGENTS.md` supports "nested implementations in subdirectories"; nested `.cursor/rules` behavior not stated | JIT scans the accessed dir and its ancestors up to a trusted root, on tool access rather than at launch |
| Skills | `~/.claude/skills/<name>/SKILL.md`, `.claude/skills/`; commands are the legacy form of the same mechanism | Not stated in the doc I read. De-facto `.agents/skills/` per third-party sources | Not on the rules page | 4 tiers: built-in, extension, `~/.gemini/skills/` or `~/.agents/skills/`, `.gemini/skills/` or `.agents/skills/`; the `.agents/` alias wins within a tier |
| Agents | `~/.claude/agents/*.md`, `.claude/agents/*.md`; subagent memory in `agent-memory/<name>/` | Not stated | Not on the rules page | `.gemini/agents/*.md`, `~/.gemini/agents/*.md`; access governed by `.toml` in `~/.gemini/policies/` |
| Hooks | `settings.json` at any layer: user, project, local, managed. `InstructionsLoaded` hook logs what loaded | Not stated | Not on the rules page | `settings.json` merged across `.gemini/`, `~/.gemini/`, `/etc/gemini-cli/`; `SessionStart` exists for context injection |
| Memory | `~/.claude/projects/<project>/memory/` with `MEMORY.md` index plus topic files; first 200 lines or 25 KB load per session; keyed to the git repo; machine-local; relocatable via `autoMemoryDirectory` | `~/.codex/config.toml` for config. Memory location not stated | Not addressed | Two systems: `GEMINI.md` hand-written; Auto Memory (experimental, off by default) mines idle transcripts from `~/.gemini/tmp/<project>/chats/` into a review inbox of `.patch` and `SKILL.md` drafts, approved via `/memory inbox` |
| Cross-vendor file | Reads `CLAUDE.md`, not `AGENTS.md`. Bridge with `@AGENTS.md` or `ln -s AGENTS.md CLAUDE.md` | `AGENTS.md` is the native name | `AGENTS.md` offered as an alternative to `.cursor/rules` | `context.fileName` in settings accepts a list; the docs' own example is `["AGENTS.md", "CONTEXT.md", "GEMINI.md"]` |

Three things are true across all four vendors. Every one concatenates rather than
overrides, so "precedence" means position in a prompt, not replacement. Every one loads the
nearest file last, so proximity to the work is the only universal ranking. And no vendor
guarantees compliance: Claude Code's docs say so outright, and the recommended fix in both
Claude Code and Gemini CLI is a hook, not a stronger instruction file.

---

## Names people actually use

Counts are over the seven repos plus the four vendor conventions, 11 sources total. A name
counts once per source.

**1. Law file.** `CLAUDE.md` 8 (LifeOS, superpowers, SuperClaude, context-eng,
icm-architect template, BMAD as a one-line pointer, Claude Code, Cursor via rules
alternative). `AGENTS.md` 6 (superpowers as a symlink, SuperClaude, BMAD, icm-architect as
the non-Claude option, Codex, Cursor, and accepted as a `context.fileName` value by Gemini
CLI). `GEMINI.md` 2 (superpowers, Gemini CLI). `CLAUDE.local.md` 1. `AGENTS.override.md` 1
(Codex). `.cursor/rules/*.mdc` 1. `.claude/rules/*.md` 1. `LIFEOS_SYSTEM_PROMPT.md` 1.
`core/RULES.md` and `core/PRINCIPLES.md` 1. `CONTEXT.md` 2 (icm-architect at two layers,
accepted by Gemini CLI's example).

**2. State surface.** `sprint-status.yaml` 1. `stories.yaml` 1. Spec frontmatter `status`
1. `progress.md` 1 (superpowers SDD ledger). `TASK.md` 2 (SuperClaude, context-eng, and
the name propagated between them). `PLANNING.md` 2, same pair. `LIFEOS_STATE.json` 1.
`STATE/work.json` 1. `roadmap.md` 1. `_index/log.md` 1. `00-tracker.md` 1.
`.memlog.md` 1.

**3. Index or map.** `index.yml` 1 (agent-os, generated). `MEMORY.md` 1 (Claude Code auto
memory, explicitly an index). `PROJECT_INDEX.json` and `PROJECT_INDEX.md` 1.
`FILE-MAP.md` 1. `ARCHITECTURE_SUMMARY.md` 1. `00_START-HERE.md` 1.
`module-manifest.toml` 1 (BMAD, with a `knowledge` key naming the real routing doc).
`marketplace.json` 1.

**4. Capture inbox.** `MEMORY/INBOX` 1. `INITIAL.md` 1. `/memory inbox` as a
project-local directory 1 (Gemini CLI). `KNOWLEDGE/_harvest-queue/` 1 (LifeOS).

**5. Durable memory.** `MEMORY/KNOWLEDGE/` 1. `MEMORY/WISDOM/` 1. `KNOWLEDGE.md` 1.
`memory/<topic>.md` 1 (Claude Code). `_bmad/config.toml` and `config.user.toml` 1.
`agent-os/standards/` 1. `examples/` 1. `_shared/` 1. `references/` 2 (icm-architect,
superpowers). `USER/PRINCIPAL/` and `USER/TELOS/` 1.

**6. Dated log.** `docs/superpowers/plans/YYYY-MM-DD-<name>.md` 1.
`agent-os/specs/YYYY-MM-DD-HHMM-<slug>/` 1. `.memlog.md` 1. `CHANGELOG.md` 3 (agent-os,
SuperClaude, BMAD). `OBSERVABILITY/*.jsonl` 1. `CREATION-LOG.md` 1. `last_updated`
frontmatter 2 (LifeOS `pai-freshness-v1`, SuperClaude root files). `modified` frontmatter
1 (Claude Code auto memory).

**7. Records.** `shape.md` 1. `plan.md` 1. `standards.md` 1. `references.md` 1.
`PRPs/<feature>.md` 1. `docs/superpowers/specs/<dated>-design.md` 1.
`_bmad-output/planning-artifacts/` and `implementation-artifacts/` 1. `SPEC.md` 1.
`ISA.md` 1. `DELETION_RATIONALE.md` 1. `VERIFICATION/` 1. `SYSTEMUPDATES/` 1.

**8. Skills and commands.** `SKILL.md` 6 (LifeOS 56, superpowers 14, BMAD 28,
icm-architect 1, context-eng 1, plus the vendor conventions of Claude Code and Gemini
CLI). `skills/` 5. `commands/` 4. `.claude/commands/<ns>/` 1. `commands/sc/` 1.
`Workflows/` 1 (LifeOS, inside each skill). `workflows/` 1 (Claude Code).
`customize.toml` 1 (BMAD, a skill's own override schema).

**9. Roles.** `agents/<name>.md` 4 (LifeOS 8, SuperClaude 20, context-eng sub-template 2,
Gemini CLI convention). `skills/bmad-agent-<role>/` 1 (five personas). Prompt-file roles
without an agent format 1 (superpowers: `code-reviewer.md`, `implementer-prompt.md`,
`task-reviewer-prompt.md`, `re-review-prompt.md`,
`plan-document-reviewer-prompt.md`, `spec-document-reviewer-prompt.md`).
`modes/MODE_*.md` 1. `personas` frontmatter key 1.

**10. Task graph.** `sprint-status.yaml` 1. `stories.yaml` 1. Epic files 1. Numbered plan
tasks inside a plan file 2 (superpowers, agent-os). `NN_` folder prefixes 1
(icm-architect, where numbering *is* the graph). `TASK.md` 2. Private GitHub Issues 1
(LifeOS). `UpgradesSystem` queue 1.

**11. Handoff or claim ledger.** `<workspace>/progress.md` with an ownership first line 1
(superpowers). Spec frontmatter `status` 1 (BMAD). `.memlog.md` 1 (BMAD). Serena MCP
checkpoints 1 (SuperClaude). Stage `output/` as the declared input of the next stage 1
(icm-architect). None in LifeOS, agent-os, or context-eng.

**12. Evidence or receipts.** `verification-before-completion` skill 1.
`scripts/review-package` diff artifact 1. Reverted-attempt `.patch` in
`implementation-artifacts` 1 (BMAD). `RULES/Verification.md` seven named rules 1
(LifeOS). Interceptor screenshot requirement 1. Pasted session transcript as a PR
requirement 1 (superpowers). Three-test rule 1 (context-eng). The walk test 1
(icm-architect). `VERIFICATION/` 1.

**13. Gates.** Hook names as gates 1 (LifeOS: `ISAGate`, `PublicPushGate`,
`DeployRegistrationGate`, `MemoryHealthGate`, `StopGates`, `VerificationGate`).
"Human check" as a required contract section 1 (icm-architect). READY FOR DEVELOPMENT and
implementation-readiness gates 1 (BMAD). Plan mode as a prerequisite 1 (agent-os).
"Plan means stop" 1 (LifeOS). Propose-before-moving 1 (icm-architect).
Human-reviews-the-diff 1 (superpowers). PreToolUse hook named as the only hard
enforcement 1 (Claude Code docs).

**14. Boundary.** `_`-prefixed folders 1 (icm-architect: `_meta`, `_system`, `_shared`,
`_config`, `_templates`, `_index`, `_archive`). `.user.toml` gitignored vs `.toml`
committed 1 (BMAD). `settings.local.json` 2 (Claude Code, context-eng).
`CLAUDE.local.md` 1. `skills/_<name>/` for private skills 1 (LifeOS). Four named zones
with three-layer enforcement 1 (LifeOS `SystemUserBoundary.md`). A git-ignored per-plan
workspace 1 (superpowers). Symlink into `~/.config/` to keep private data out of the
public tree 1 (LifeOS).

**15. Maintenance loop.** `RULES/SelfHealing.md` as a routing table 1.
`handlers/Rebuild*.ts` 1. `/index-standards` and `sync-to-profile.sh` 1. doctor and
update flows 1 (BMAD). "fix sprint status" repair from inferred true state 1 (BMAD).
Restructure mode with five file roles 1 (icm-architect). `writing-skills` plus an
external eval harness 1 (superpowers). Monthly PM-agent doc pruning, claimed 1
(SuperClaude). `consolidate-memory` style index pruning 1 (Claude Code, via the
`MEMORY.md` read-limit error that tells Claude to rewrite the index).

**16. Tool projections.** `.claude/` 7. `.agents/` 4 (superpowers, BMAD, agent-os,
Gemini CLI alias). `.codex/` or `.codex-plugin/` 2. `.cursor/` or `.cursor-plugin/` 2.
`.gemini/` 1. `.opencode/` 1. `.pi/` 1. `.devin-plugin/`, `.kimi-plugin/`,
`.hermes-plugin/` 1 each. `.cline/`, `.bob/`, `.agent/`, `.adal/` 1 each (BMAD's table).
The single highest-leverage name in this category is `.agents/skills/`, which Gemini CLI
documents as a deliberate interoperability alias and BMAD uses as the default for
everything that is not Claude Code.

**17. Multi-project routing.** `profiles/` with an inheritance chain 1 (agent-os).
Umbrella form 1 (icm-architect). Per-project `_bmad/` plus modules 1. `PROJECTS.md`
registry with routing aliases 1 (LifeOS). Ancestor-to-cwd concatenation 4 (all vendors).
`claudeMdExcludes` for monorepos 1.

**18. Factory/product split.** `_shared/` vs `output/` 1. `profiles/` vs `specs/` 1.
`_bmad/` vs `_bmad-output/` 1. `PRPs/templates/` vs `PRPs/<feature>.md` 1. SYSTEM vs USER
zones 1. `_templates/` 3.

**19. Generated index.** `index.yml` 1. `FILE-MAP.md` 1. `PROJECT_INDEX.json` 1.
`ARCHITECTURE_SUMMARY.md` 1. `PRINCIPAL_TELOS.md` as an auto-generated derivative 1.
Disk-as-membership-list 1 (BMAD, the strongest form: no index file at all).

---

## Uncertainties

- **superpowers star count.** `gh api repos/obra/superpowers` returned
  `stargazers_count: 286065` on 2026-09-13. That would place it among the most-starred
  repositories on GitHub. I report the API value as read and flag it rather than adjusting
  it. Forks (25,596) and open issues (363) are consistent with very large adoption, so the
  order of magnitude is plausible even if the exact figure surprises me.
- **LifeOS `MEMORY/` tree is inferred from documentation, not observed.** The directory is
  a symlink to private user data and is never in the repo. Every subdirectory name I list
  comes from `DOCUMENTATION/SystemUserBoundary.md` and
  `DOCUMENTATION/Memory/MemorySystem.md` at the read SHA. A real install could differ.
- **`MemorySystem.md` was truncated.** The curl of that file ended with
  `curl: (23) Failure writing output to destination` after roughly 16 KB. I read the
  architecture section and the capture pipeline; anything past that in the file is unread.
- **LifeOS install-time behavior not traced.** I read `CLAUDE.template.md` and the tree,
  not `install.sh` or `Tools/*.ts`. Whether the installed `~/.claude/` matches the
  template exactly, and what `OverlaySystem.ts` and `ScanConflicts.ts` do to an existing
  install, is untested.
- **agent-os multi-tool support is claimed but not visible.** `README.md` says it works
  alongside Cursor and Antigravity, but `scripts/project-install.sh` at this SHA writes
  only `.claude/commands/agent-os/`. Installation docs live at buildermethods.com, which
  I did not read because it is not a repo. Another installer path may exist.
- **BMAD `_bmad/` tree is assembled from docs and module manifests, not from an install.**
  I did not run `npx bmad-method install`. The `_bmad/config.toml`, `config.user.toml`,
  `custom/`, and `scripts/` paths come from `docs/customize/customize-bmad.md` and
  `skills/bmad/references/setup.md`; `_bmad-output/` from
  `skills/bmad/assets/config.template.toml`; `_bmad/<module>/config.yaml` from a CIS
  agent's own activation step 5. The complete `_bmad/` contents after a real install are
  not verified.
- **BMAD module clones were read from disk, not from GitHub.** CIS, GDS, BMB, BMAD Loop,
  and TEA were read at
  `<external-modules>\{cis,gds,bmb,bmad-loop,tea}`. These are
  shallow clones already on this machine; I did not verify that each matches its upstream
  default branch at the version its own manifest declares. The coordinator supplied CIS
  0.3.2, GDS 0.7.2, BMB 2.2.2, and BMAD Loop 0.11.1; each matched its manifest. TEA's
  version was not supplied and its `package.json` reads 1.24.0. GDS is the one mismatch:
  `package.json` says 0.7.2 while `src/module.yaml` says `module_version: 0.7.0`.
- **`bmad-loop` internals are read from docs and one installer module, not traced.**
  Artifact names (`journal.jsonl`, `state.json`, `stop-request.json`, `.bmad-loop/runs/`)
  come from string literals in `install.py`, `runs.py`, `journal.py`, and
  `escalation.py`, and from `docs/setup-guide.md` and `docs/FEATURES.md`. I did not read
  `engine.py`, `statemachine.py`, or `gates.py`, so the exact gate sequence is
  documentation-level, not code-level. No script from any clone was run.
- **BMAD version is inferred.** The main repo at the read SHA has no `VERSION` file. I
  pin the era from `bmad-loop`'s `deferred-work-format.md`, which names "BMAD-METHOD
  6.10.1-next.33+". The precise version of the main-repo checkout is not established.
- **Codex skills and memory locations are not stated by OpenAI.** The AGENTS.md page names
  only `~/.codex/config.toml`. I record `.agents/skills/` as a de-facto Codex path on
  third-party evidence (BMAD's table, superpowers' `.codex-plugin/`), not on an OpenAI
  source. Codex prompt and memory storage: not found.
- **Cursor precedence is unspecified in the source I read.** `cursor.com/docs/context/rules`
  does not state a conflict order between user rules, project `.mdc` rules, and
  `AGENTS.md`, and does not mention `.cursorrules` or memory. Both docs.cursor.com URLs I
  tried 308-redirected; I followed the redirect chain to `cursor.com/docs/context/rules`.
  Other Cursor pages may carry the missing detail; I did not enumerate the whole docs site.
- **The ICM paper itself is unread.** `SKILL.md` cites arXiv:2603.16021 (Van Clief &
  McDermott). Everything I attribute to "the ICM method" comes from the skill and its
  references, not from the paper. I also did not confirm that "JV" on GitHub is Jake Van
  Clief beyond the initials plus the self-citation in `SKILL.md`.
- **`ktnCodes/icm-template`** (58 stars, branch `master`, last push 2026-04-14) is a
  plausible second ICM source I chose not to read in full, on star count and the
  RinDig self-citation. If a second opinion on ICM structure is wanted, that is the repo
  to read.
- **No `gh` rate limit was hit.** All tree and metadata calls succeeded on the first
  attempt. Raw file reads went through `curl` to `raw.githubusercontent.com` rather than
  WebFetch, to get byte-exact file content instead of a model summary; the URL, host, and
  SHA are identical either way. Doc-site pages (Claude Code, agents.md, ChatGPT learn,
  Cursor) went through WebFetch, so those are model-summarized and the direct quotes in
  those sections carry slightly more risk of paraphrase than the repo quotes do.
- **Nothing was cloned, installed, or executed.**
