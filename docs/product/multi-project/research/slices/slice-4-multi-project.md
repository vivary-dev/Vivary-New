# Slice 4: one agent, many projects

Supplied research input. Read the [source reconciliation](../workspace-research-reconciliation.md) before using
its claims or delivery order. The accepted plan is the program frontier.

Structural read of vendor conventions and public repositories where a single root folder
holds several projects under a shared instruction layer. Accessed 2026-09-13. Every repo
claim cites a file in that repo at a pinned commit SHA.

Scope note: this is a structural survey only. Traction, pricing, and market questions were
covered by a separate survey and are not repeated here.

## Method and search record

Tooling: `gh` 2.87.3 (authenticated), `gh api` for metadata and git trees, `gh api
repos/O/R/contents/PATH?ref=SHA` for file content, WebFetch for vendor docs. No repository
was cloned, installed, or executed.

Searches run, with outcome:

| Query | Outcome |
| --- | --- |
| `gh search code 'path:AGENTS.md "projects/"'` | zero results, the `path:` prefix inside the query string is not honored by `gh search code` |
| `gh search code --filename=AGENTS.md 'projects/'` | 25 results, nearly all single-repo project files, no multi-project roots |
| `gh search code '"PROJECTS-INDEX"'` | 30 results, one relevant (`starmynd-org/infinite-brain-os`, `projects/INDEX.md`), the rest were Rails and Vue `projects/index` view files |
| `gh search repos --topic personal-os` | 20 results, the most productive single query, five of the nine repos below came from it |
| `gh search repos --topic agent-workspace` | 15 results, mostly commercial agent apps (Agenta, tutti, solo), one relevant (`jimy-r/agent-workspace-architecture`) |
| `gh search repos --topic ai-workspace` | 15 results, all commercial chat or workspace UIs, none relevant |
| `gh search repos --topic claude-code --topic second-brain` | 15 results, two relevant (`ballred/obsidian-claude-pkm`, `phuryn/pm-brain`), several high-star repos with no committed instruction files at all |
| `gh search code --filename=CLAUDE.md 'monorepo packages'` | 30 results, found `skmtc/skmtc` and `palantir/osdk-ts` |
| `gh search code --filename=AGENTS.md 'nearest AGENTS.md'` | 20 results, found `safe-global/safe-wallet-monorepo` |
| Tree scan of vercel/next.js, cloudflare/workers-sdk, withastro/astro, grafana/grafana, denoland/deno, openai/openai-python, supabase/supabase | zero committed `CLAUDE.md` or `AGENTS.md` in any of them |

Two negative findings worth recording. First, the large vendor-owned monorepos most often
named as examples do not commit agent instruction files at all, so the nested-instruction
pattern in open source lives in mid-size repos. Second, the `ai-workspace` and
`agent-workspace` GitHub topics are dominated by commercial products, not file-based
workspaces, so topic search alone does not find this slice.

Selection rule for repos: a root holding two or more distinct work units, with at least one
instruction file at the root and either a per-unit instruction file or a routing file that
maps a request to a unit. Repos with no commits in 2026 were excluded except where they are
the canonical reference for the pattern.

---

# Vendor conventions

### Vendor: Anthropic, Claude Code

- Docs read: `https://code.claude.com/docs/en/memory` and
  `https://code.claude.com/docs/en/large-codebases`, accessed 2026-09-13
- Root file: `CLAUDE.md` or `.claude/CLAUDE.md` at the project root. User-scope file is
  `~/.claude/CLAUDE.md`. Managed policy file is `C:\Program Files\ClaudeCode\CLAUDE.md` on
  Windows, `/etc/claude-code/CLAUDE.md` on Linux and WSL.
- Leaf file: `CLAUDE.md` in any subdirectory.
- Precedence: files are concatenated, not overridden. The docs state that "All discovered
  files are concatenated into context rather than overriding each other" and that content
  is "ordered from the filesystem root down to your working directory," so "instructions
  closer to where you launched Claude are read last." Within a directory,
  `CLAUDE.local.md` is appended after `CLAUDE.md`. Load order is managed policy, then user,
  then project, then local.
- Load timing splits by direction. Ancestor files load at launch. Subdirectory files load
  on demand: "Claude also discovers `CLAUDE.md` and `CLAUDE.local.md` files in
  subdirectories under your current working directory. Instead of loading them at launch,
  they are included when Claude reads files in those subdirectories."
- Include mechanism: `@path/to/import`, relative to the importing file, recursive to a
  "maximum depth of four hops." Import parsing skips code spans and fenced blocks, so
  `` `@README` `` is literal text. An import resolving outside the working directory
  triggers a one-time approval dialog.
- Shared skills: repository root `.claude/skills/`, user `~/.claude/skills/`, or a plugin
  in an internal marketplace. Per-project skills: `<package>/.claude/skills/`. The
  monorepo page states that for skills many directories share, "place them in the
  repository root's `.claude/skills/` so they load from any starting directory."
- Session-to-project binding: the launch directory. The monorepo page tabulates it. Start
  at the repository root and you get "Root only; subdirectory files load on demand when
  Claude reads there." Start in a subdirectory and you get "That directory's plus every
  ancestor's," with file access limited to that subtree.
- Path-move fragility: an `@path` import breaks silently on a move. A `paths:` glob in
  `.claude/rules/` breaks on a rename. A per-directory `CLAUDE.md` travels with its
  directory and is the move-safe option, which is the structural argument for the leaf file
  over a central rule.
- Escape hatch for a root you do not want: `claudeMdExcludes`, a glob list matched against
  absolute paths, settable at user, project, local, or managed scope, arrays merging across
  scopes. Managed policy files cannot be excluded.
- Cross-tool bridge: "Claude Code reads `CLAUDE.md`, not `AGENTS.md`." The documented
  bridge is a `CLAUDE.md` containing `@AGENTS.md` plus Claude-specific content below it, or
  a symlink where no extra content is needed. The docs note that on Windows a symlink needs
  Administrator or Developer Mode, so the import is the portable choice.
- Auto memory is keyed per repository at `~/.claude/projects/<project>/memory/` with a
  `MEMORY.md` index, and "The `<project>` path is derived from the git repository, so all
  worktrees and subdirectories within the same repo share one auto memory directory.
  Outside a git repo, the project root is used instead." That last clause is the
  multi-project failure mode: a non-git container root gets one memory store for every
  project under it.
- Also relevant: `--add-dir` loads a sibling's skills but not its `CLAUDE.md` unless
  `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` is set. The `additionalDirectories`
  setting loads neither, ever.

### Vendor: OpenAI, agents.md and Codex

- Docs read: `https://agents.md` and
  `https://learn.chatgpt.com/docs/agent-configuration/agents-md` (the
  `developers.openai.com/codex/guides/agents-md` URL 308-redirects here), accessed
  2026-09-13
- Root file: `AGENTS.md` at the repo root, with `~/.codex/AGENTS.md` as the global layer
  and `AGENTS.override.md` taking priority over `AGENTS.md` at each level.
- Leaf file: `AGENTS.md` inside each package. agents.md states: "Place another AGENTS.md
  inside each package. Agents automatically read the nearest file in the directory tree, so
  the closest one takes precedence and every subproject can ship tailored instructions."
- Precedence: concatenation with position as the override mechanism. "Codex concatenates
  files from the root down, joining them with blank lines," and "Files closer to your
  current directory override earlier guidance because they appear later in the combined
  prompt." Also "Codex includes at most one file per directory."
- Discovery direction: root down to the current directory only. Codex does not search
  below the working directory.
- Size cap: `project_doc_max_bytes`, default 32 KiB. "Codex skips empty files and stops
  adding files once the combined size reaches the limit." In a deep multi-project root this
  is a real truncation risk that Claude Code does not have at the same threshold.
- Three-tier override: "explicit user chat prompts override everything," then the nearest
  file, then default behavior.
- Scale reference: agents.md reports the openai monorepo "currently maintaining 88 separate
  AGENTS.md files."
- Include mechanism: not found. Nothing in either page documents a path-include or import
  directive for `AGENTS.md`.
- Skills location: not covered on these pages.

### Vendor: GitHub Copilot coding agent

- Docs read:
  `https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions`,
  accessed 2026-09-13
- Three file types: a repository-wide `copilot-instructions.md` in the `.github` directory,
  one or more `NAME.instructions.md` files "within or below the `.github/instructions`
  directory" carrying an `applyTo` glob in frontmatter, and agent instructions as "one or
  more `AGENTS.md` files, stored anywhere within the repository" or alternatively "a single
  `CLAUDE.md` or `GEMINI.md` file stored in the root of the repository."
- Precedence: "the nearest `AGENTS.md` file in the directory tree will take precedence."
  Note the asymmetry: `AGENTS.md` is unlimited and nestable, while `CLAUDE.md` and
  `GEMINI.md` are recognized as a single root file only.
- Path-specific and repository-wide instructions combine rather than replace: when both
  apply, "the instructions from both files are used."
- Scope precedence across layers: "Personal instructions take the highest priority.
  Repository instructions come next, and then organization instructions." The page does not
  state precedence between `copilot-instructions.md` and a root `AGENTS.md`.
- Monorepo guidance: not found. The page carries no monorepo section.

### Vendor: Cursor

- Docs read: `https://cursor.com/docs/context/rules`, accessed 2026-09-13
- Root file: "Project rules live in `.cursor/rules` as `.mdc` files and are
  version-controlled."
- Nested `.cursor/rules` in subdirectories: not documented on this page. The scoping
  mechanism Cursor documents is the `globs` frontmatter field, not directory nesting.
  Nested `AGENTS.md` is separately documented as supported: "You can place `AGENTS.md`
  files in any subdirectory of your project."
- Four activation modes: Always Apply, Apply Intelligently (agent decides from the
  description), Apply to Specific Files (glob match), Apply Manually (`@rule-name`).
- Include mechanism: `@filename.ts` inside a rule pulls that file into the rule's context.
- Precedence across layers: "Team Rules, Project Rules, User Rules."
- Path-move fragility: highest of the vendors surveyed, because a Cursor rule's scope is a
  glob string in a central file rather than the rule file's own location. Renaming
  `src/components/` orphans every rule scoped to it, with no error.

### Vendor: VS Code with Copilot

- Docs read:
  `https://code.visualstudio.com/docs/copilot/customization/custom-instructions`, accessed
  2026-09-13
- Four recognized formats: `.github/copilot-instructions.md`, `*.instructions.md` with
  `applyTo`, `AGENTS.md`, and `CLAUDE.md`.
- Nested `AGENTS.md`: supported but experimental, behind the `chat.useNestedAgentsMdFiles`
  setting. The docs warn: "Nested AGENTS.md files is experimental and might change or be
  removed."
- Combination order: "If you have multiple instruction files in your project, VS Code
  combines and adds them to the chat context, no specific order is guaranteed." This is the
  weakest precedence guarantee of any vendor here. A multi-project root that relies on
  leaf-wins ordering cannot rely on it in VS Code.
- Instruction search locations: workspace `.github/instructions` and `.claude/rules`, user
  profile `~/.copilot/instructions` and `~/.claude/rules`. The `.claude/rules` entries mean
  a Claude-shaped rules directory is read by two tools.
- Multi-root workspace behavior for instruction discovery: not found. The page does not
  address it, which is a gap for anyone using a `.code-workspace` file as their
  multi-project root.

### Vendor: Nx

- Docs read: `https://nx.dev/docs/getting-started/ai-setup`, accessed 2026-09-13
- Setup is a single command: `npx nx configure-ai-agents`. It writes "Agent rules:
  `AGENTS.md`, `CLAUDE.md`, and equivalents," an MCP server config, and Nx agent skills.
- Supported agents: `claude`, `codex`, `copilot`, `cursor`, `gemini`, `opencode`.
- Root versus per-project placement: not stated. The page names the files collectively
  without distinguishing scope, so whether Nx writes a per-project `AGENTS.md` cannot be
  confirmed from this page.
- Routing substitute: Nx replaces the routing file with a queryable graph. "Graph-aware
  exploration of project dependencies and relationships. AI gets structured data instead of
  grepping through files." This is the only vendor in the survey that answers "which
  project does this request belong to" with a tool call rather than a markdown index.
- Skills cover workspace exploration, code generation, task execution, CI monitoring, and
  cross-project impact assessment.

### Vendor: Turborepo

- Docs read: `https://turborepo.dev/docs/guides/ai`, accessed 2026-09-13
- Guidance for `AGENTS.md`, `CLAUDE.md`, or per-package instruction files: not found. The
  page does not mention them.
- What it does recommend: install the Turborepo agent skill, use git worktrees so "multiple
  AI agents in parallel on the same repository" can work without conflicts, add a
  `description` field to each task in `turbo.json` so "AI can quickly grasp what each task
  does without reading implementation details", and fetch docs as Markdown.
- The `turbo.json` task description is the interesting primitive: a routing hint that lives
  in the build config rather than in a markdown instruction file, and that therefore cannot
  go stale relative to the task list.

---

# Repository records

### starmynd-org/infinite-brain-os

- URL `https://github.com/starmynd-org/infinite-brain-os`, 248 stars, last push
  2026-08-26, MIT, SHA `004c6b9924972a21bcf339af9297ed3dea828840`, default branch `main`
- Purpose: a git-backed markdown operating system for running a business with AI agents,
  where every unit of work is one of eleven declared entity types.
- Entry files, in the order the root file dictates: `AGENTS.md` or `CLAUDE.md`, then
  `knowledge/ai-architecture/canon/doctrine-card.md`, then
  `_system/retrieval-routing-map.md`, then the target namespace's `INDEX.md`, then
  `knowledge/ai-architecture/canon/core-doctrine.md` and `_system/README.md` for
  architecture work. `START-HERE.md` is the human entry point.
- Layout, top two levels, trimmed: `AGENTS.md`, `CLAUDE.md`, `START-HERE.md`,
  `PROVENANCE.yml`, `sync-adapters.sh`, `_system/` (roughly 60 rule and schema files),
  `knowledge/<namespace>/`, `entities/{agents,commands,rules,skills}/`, `projects/`,
  `departments/`, `sessions/{active,closed,logs,reviews,templates}/`, `intake/`,
  `memory/`, `outputs/`, `data/`, `parties/`, `tools/`, `secrets/`, `swarms/Sprints/`,
  `synthesis/`, `workflows/`, `automations/n8n/`, `repo-registry/`, `.claude/`,
  `.codex/`, `.obsidian/`, `docs/`
- Primitives present:
  1. Law: `AGENTS.md` and `CLAUDE.md`, byte-parallel, with the root stating they "mirror
     each other and must be edited together."
  2. State surface: `sessions/active/` holds the open session record. There is no single
     always-current focus file.
  3. Index or map: `_system/retrieval-routing-map.md` for namespaces,
     `_system/namespaces/INDEX.md` as the namespace catalog, `projects/INDEX.md` for
     projects, `departments/INDEX.md` for departments, `START-HERE.md` for humans.
  4. Capture inbox: `intake/` with `sources/`, `routing/`, `schemas/`, `processed/`.
  5. Durable memory: `memory/`, described in the root as "reviewed lessons," distinct from
     session logs.
  6. Dated log: `sessions/logs/` for transcripts, `swarms/Sprints/` for execution
     artifacts.
  7. Records: `_system/canon-changelog-rules.md`, `sessions/reviews/` for closeouts,
     `outputs/` for produced artifacts with lineage.
  8. Skills or procedures: `entities/skills/` canonical, `workflows/` for agentic
     procedures, `automations/n8n/` for deterministic ones, `.claude/commands/` and
     `.codex/commands/` as projections.
  9. Roles or agent definitions: `entities/agents/`, projected to `.claude/agents/` (12
     files) and `.codex/agents/`.
  10. Task graph: `projects/{name}/PLAN.md` with an inline task checklist per the entity
      table, `swarms/Sprints/` for parallel work.
  11. Handoff or claim ledger: `sessions/active/` plus `sessions/closed/` as the pass
      mechanism, governed by `_system/session-ledger-rules.md`.
  12. Evidence or receipts: `sessions/reviews/`, `swarms/Sprints/` receipts, and
      `_system/validate.sh` output.
  13. Gates: promotion to `canon` requires operator approval. The root states "Canon is
      never self-approved by an agent" and "Promotion moves forward through review, never
      by an agent's own declaration."
  14. Boundary: `secrets/` holds references not values. `.gitignore` excludes
      `tools/*/runtime/` and `outputs/_runtime/` as "Tool runtime planes: operational
      substrate, never git canon."
  15. Maintenance loop: `_system/freshness-review-rules.md`,
      `_system/contradiction-review-rules.md`, `workflows/improve-loop.md`,
      `workflows/monthly-canon-review.md`, `workflows/weekly-review.md`,
      `_system/validate.sh`.
  16. Tool projections: `.claude/{commands,agents,skills,rules}` and
      `.codex/{commands,agents,skills}` are generated copies of `entities/`.
      `sync-adapters.sh` regenerates them and exists because "your OS does not support
      symlinks (Windows native, restricted CI)." The root rule is blunt: "edit the
      canonical file, then run `bash sync-adapters.sh`. Never edit a shim."
  17. Multi-project routing: two layers. Inside one repo, `knowledge/<namespace>/` plus the
      routing map. Across repos, `_system/multi-brain-workspace-contract.md`.
- Primitives absent: no single always-current state file naming the active focus, status,
  and blockers. No per-project instruction file: a project is a `PLAN.md`, and the rules
  come entirely from the root plus the routed namespace.
- Routing: `_system/retrieval-routing-map.md` is the routing file and it routes by task
  class, not by folder. The contract states "The map routes; namespaces own their internal
  load order. After this map names a namespace, enter through its `INDEX.md` and sequence
  the canon read via its `canon/agent-load-order.md`." Cost control is explicit: "Load the
  primary sequence in order, stop when the task is answerable, and open secondary
  namespaces only when the task genuinely crosses into them. Never pre-load a whole row."
  Tasks that touch no knowledge domain skip the map entirely. For unmatched tasks: "Match
  to the nearest class and confirm via `_system/namespaces/INDEX.md`," and a map change is
  "a contract change, not an improvisation."
- The multi-repo case is the closest match in the survey to this slice. A parent workspace
  is "a thin folder a person opens in Claude Code whose `.claude/` layer routes between
  several brain repos mounted under a `brains/` folder." Rule MBW-1: "The person opens the
  parent workspace, never a brain in isolation. Each brain under `brains/` stays an
  independent repo with its own remote and lifecycle," and "`brains/*` is git-ignored
  except a placeholder readme, so the brains sync independently and no embedded-repo
  tracking occurs." Rule MBW-2 sets the default destination: "The router sends real,
  shared, or canon-reading work to the shared brain by default. Experimental, unpolished,
  or personal work that could break what others rely on starts in the person's individual
  brain." Rule MBW-3 is one idempotent `/start` command that clones or refreshes every
  brain and then runs `/sync`.
- Memory split: per-user in `knowledge/personal-operator/`, per-project in
  `projects/{name}/PLAN.md`, reviewed cross-cutting lessons in `memory/`, per-session in
  `sessions/`. Per-machine: not found as a separate surface, which is a gap given the
  multi-host contract it references.
- Human gates: canon promotion, and per the multi-brain contract, shared-brain core changes
  go through a proposal branch rather than a direct push.
- Evidence of real use: commits are authored under the name "Infinite Brain OS" (five most
  recent between 2026-07-16 and 2026-08-26), including "Finish the scrub: drift is a real
  client name, not a placeholder," which is a de-identification pass on content from a live
  deployment. The 2026-07-24 commit message is "Infinite Brain OS starter re-release:
  multi-brain parent workspace pattern," dating the pattern.
- Generalizes: routing by task class rather than by folder, the canonical-plus-projection
  split with a regeneration script, the "never pre-load a whole row" retrieval budget, the
  rule that changing the routing map is a contract change, git-ignoring mounted child repos
  so a parent can hold them without nesting `.git`.
- Idiosyncratic: the eleven-entity ontology, the eight-key frontmatter contract enforced by
  a validator, the four-state lifecycle, the Obsidian vault layer, and a house style ban on
  em and en dashes enforced by that same validator.
- Sources: `AGENTS.md`, `CLAUDE.md`, `START-HERE.md`, `_system/retrieval-routing-map.md`,
  `_system/multi-brain-workspace-contract.md`, `projects/INDEX.md`,
  `departments/INDEX.md`, `sync-adapters.sh`, `.gitignore`, all at
  `https://github.com/starmynd-org/infinite-brain-os/blob/004c6b9924972a21bcf339af9297ed3dea828840/<path>`,
  accessed 2026-09-13

### vincentmumme/personalos-boilerplate

- URL `https://github.com/vincentmumme/personalos-boilerplate`, 19 stars, last push
  2026-08-25, MIT, SHA `59c2043ea39f8df2d68f793cf3eb1873ebe970ae`, default branch `main`
- Purpose: a public boilerplate for a markdown personal operating system, generated by
  export from a private reference instance, written in German.
- Entry files: root `AGENTS.md` for maintainers of the boilerplate itself, for an installed
  instance, `core/AGENTS.md` names the mandatory read order as `INDEX`, `USER`, `SOUL`,
  `system/index`, `skills/RESOLVER`.
- Layout, top two levels, trimmed: root `AGENTS.md`, `START-HERE.md`, `core/` (the
  mandatory foundation, containing `AGENTS.md`, `CLAUDE.md`, `projects/index.md`,
  `skills/` with one folder per skill, `system/`), `modules/` (optional domains and
  infrastructure), `reference/` (generated composition of core plus module payloads),
  `blueprints/` (public replacements and extra module text, with its own `AGENTS.md` and
  `CLAUDE.md`), `policy/export-policy.json`, `onboarding/`, `docs/`, `examples/`
- Primitives present:
  1. Law: root `AGENTS.md` for the repo, `core/AGENTS.md` for the installed system, with
     `core/CLAUDE.md` and `blueprints/CLAUDE.md` as parallel files.
  2. State surface: `skills/priority-dashboard/` derives one. Not a static file.
  3. Index or map: `core/INDEX.md` as the system map and canonical owner list,
     `docs/system-map.md` for the repo, `core/projects/index.md` as the projects owner
     index, `core/skills/index.md` and `core/skills/manifest.json` for skills.
  4. Capture inbox: not found as a folder. Capture goes through `skills/log/` and
     `skills/analyse-call/`.
  5. Durable memory: `core/USER.md` for the person, `core/SOUL.md` for shared behavior.
  6. Dated log: `skills/log/SKILL.md` writes session results.
  7. Records: `core/system/contracts/core/personalos-mutation-contract.md` governs every
     mutation.
  8. Skills or procedures: `core/skills/<name>/SKILL.md`, each shipping a
     `routing-eval.jsonl` next to it, several with `scripts/run.py` and a matching
     `test_run.py`.
  9. Roles or agent definitions: not found as a separate folder.
  10. Task graph: `skills/task-manager/`, with actions, tasks, waiting, blockers, and
      attention triggers as the vocabulary in `RESOLVER.md`.
  11. Handoff or claim ledger: not found.
  12. Evidence or receipts: `skills/pos-verify/` is the verification skill, and the
      resolver requires it: "Mutierende Skills folgen dem zentralen Mutation Contract und
      enden mit `pos-verify`."
  13. Gates: root `AGENTS.md` states no file is written before the user picks a path and
      confirms a plan ("Schreibe keine Datei, bevor der Nutzer einen Weg gewählt und deinen
      kurzen Plan bestätigt hat"), and every export sync "endet mit Audit, Tests und
      menschlicher Freigabe."
  14. Boundary: hard list in root `AGENTS.md`. Secrets, private ids, absolute private
      paths, live state, and active automations may not enter the boilerplate, and every
      new source file needs an explicit export classification.
      `policy/export-policy.json` classifies the private instance "fail-closed."
  15. Maintenance loop: each index file carries its own `## Maintenance` section stating
      when to add a row. `RESOLVER.md`: overlapping routes "werden vor der Freigabe
      aufgelöst und mit realistischen Nutzerformulierungen getestet."
  16. Tool projections: `core/CLAUDE.md` and `blueprints/CLAUDE.md` beside the matching
      `AGENTS.md`. `reference/` is a generated third copy and the root warns it must not
      become "drei Wahrheiten."
  17. Multi-project routing: `core/projects/index.md` plus `core/skills/RESOLVER.md`.
- Primitives absent: no capture inbox folder, no roles layer, no handoff ledger, no dated
  log directory. Notably no per-project instruction file: a project is a namespace plus a
  record, and the rules stay central.
- Routing: two distinct routers. `core/skills/RESOLVER.md` is an intent-to-skill table with
  four numbered routing rules, the first being "Der spezifischste passende Skill gewinnt"
  (the most specific matching skill wins) and the third naming the fallback
  `system/frameworks/core/context-routing-and-truth-propagation`. Project scoping comes
  from `core/projects/index.md`: "Jedes Project besitzt genau einen Namespace
  `projects/<slug>/` und einen gleichnamigen Hauptrecord," with actions, decisions,
  interactions, domain truth, repositories, assets, and finance explicitly staying with
  their own owners. The authority rule in `core/AGENTS.md` settles override direction:
  "`/system` besitzt die allgemeine Systemlogik. Skills führen konkrete Abläufe aus und
  besitzen keine konkurrierende Systemverfassung. Fachliche Wahrheit liegt bei ihrem
  Domain- oder Entity-Owner." So system logic wins on process, the domain owner wins on
  fact, and a skill can never override either.
- Memory split: per-user `core/USER.md`, shared behavior `core/SOUL.md`, per-project the
  project main record, per-machine handled by the `multi-host` and `backup-git` modules,
  with the rule "richte pro PersonalOS-Repository genau einen automatischen Git-Writer
  ein" (exactly one automatic git writer per repository).
- Human gates: path choice and plan confirmation before any write, export approval.
- Evidence of real use: a single commit, "chore: prepare PersonalOS Boilerplate v0.1.0"
  on 2026-08-25. The boilerplate is generated from a private instance, so real use is
  claimed in `policy/export-policy.json` and the maintainer section but not visible as
  history. Lowest evidence of the nine.
- Generalizes: the ownership model, where every fact has exactly one canonical owner and
  cross-cutting concerns stay with their owner rather than being copied into each project,
  the explicit three-way authority rule, shipping a `routing-eval.jsonl` next to each skill
  so routing is testable rather than asserted, the mandatory-core plus optional-modules
  split with no module active by default.
- Idiosyncratic: German prose, a template-variable frontmatter (`{{user_name}}`,
  `{{install_date}}`), and a generated `reference/` tier that exists only for composition.
- Sources: `AGENTS.md`, `core/AGENTS.md`, `core/projects/index.md`,
  `core/skills/RESOLVER.md`, tree listing, all at
  `https://github.com/vincentmumme/personalos-boilerplate/blob/59c2043ea39f8df2d68f793cf3eb1873ebe970ae/<path>`,
  accessed 2026-09-13

### jimy-r/agent-workspace-architecture

- URL `https://github.com/jimy-r/agent-workspace-architecture`, 12 stars, last push
  2026-09-13, MIT, SHA `2905a3aabda0f4e30c65327728bece3279602416`, default branch `main`
- Purpose: a documented, redacted snapshot of one person's multi-project agent workspace,
  published as patterns plus forkable sample scaffolding.
- Entry files, in the order `AGENTS.md` states: `PATTERNS.md`, then
  `META_ARCHITECTURE.md`, then `WORKFLOW.md`, then `samples/`, then `learn/` and
  `teardowns/`. Humans start at `README.md`, contributors at `CONTRIBUTING.md`. For a
  model, `docs/llms.txt` is the link map and `docs/llms-full.txt` inlines the core
  documents in one fetch.
- Layout, top two levels, trimmed: `AGENTS.md`, `CLAUDE.md`, `PATTERNS.md`,
  `META_ARCHITECTURE.md`, `WORKFLOW.md`, `STYLE_GUIDE.md`, `ADOPTION.md`,
  `EVALUATION.md`, `samples/` (`CLAUDE.md.example`, `CONTEXT.md.example`, `.claude/`,
  `board/`, `roles/` with 19 role files plus `_template.md` and `_validate.py`,
  `example-project/`, `scripts/`, `tasks/`, `tests/`), `learn/` (seven numbered lessons),
  `teardowns/` (dated analyses of other published systems), `scripts/`, `docs/`
- Primitives present:
  1. Law: `AGENTS.md` and `CLAUDE.md` at root, and the root states "the two carry the same
     rules." For a workspace, `samples/CLAUDE.md.example`.
  2. State surface: `samples/board/board.example.md`, plus `tasks/todo.md` per the sample
     law file.
  3. Index or map: `docs/llms.txt`, `docs/workspace-map.html`, `META_ARCHITECTURE.md`.
  4. Capture inbox: `tasks/To Do Notes.md`, reached by the phrase shortcut "add to tasks."
  5. Durable memory: `tasks/lessons.md`, and per-project `CONTEXT.md` for entity facts.
  6. Dated log: `teardowns/` files are dated. Session logs are not in the public sample.
  7. Records: `EVALUATION.md`, `docs/self-score.md`, `docs/history.md`.
  8. Skills or procedures: `samples/.claude/skills/` with 10 skills including `orient`,
     `review-queue`, `verify-completion`, `terse-mode`,
     `samples/.claude/scheduled-tasks/` with four including `consolidate-memory` and
     `morning-brief`.
  9. Roles or agent definitions: `samples/roles/` with 19 canonical role files, validated
     by `samples/roles/_validate.py`, `samples/.claude/agents/` holds bindings that compose
     a role with a project's `CONTEXT.md`.
  10. Task graph: `samples/board/board.example.md` plus
      `samples/board/agent-queue.SKILL.example.md`.
  11. Handoff or claim ledger: `samples/board/agent-queue.SKILL.example.md` is the
      delegation queue.
  12. Evidence or receipts: the grounding rule in `samples/CLAUDE.md.example` requires a
      `path:line` citation for any load-bearing claim about workspace state, and an
      `[unverified]` tag otherwise, `samples/scripts/audit_checks/run_all.py` and
      `samples/.claude/skills/verify-completion/`.
  13. Gates: "Ask before destructive actions, delete, force-push, mass-rewrite all need
      confirmation", "Verify the plan with the user before implementing", branch protection
      requiring the redaction check on every PR.
  14. Boundary: the redaction rule in `AGENTS.md` mandates scrubbing every changed file for
      personal identifiers, credentials "never, not even as placeholders", and "absolute
      paths that reveal a machine layout", using the placeholders `<workspace>`, `<home>`,
      `<project>`. The credential rule is the Iron Law: credentials live only in the
      password manager and files reference them by item name.
      `samples/.claude/hooks/protect-files.py` enforces at the tool layer.
  15. Maintenance loop: `samples/.claude/scheduled-tasks/consolidate-memory/SKILL.md`, the
      self-improvement loop appending to `tasks/lessons.md` after every user correction,
      `scripts/check_freshness.py`, `docs/self-score.md`.
  16. Tool projections: `samples/.claude/` for agents, hooks, scheduled tasks, skills, and
      `settings.example.json`, runtime-neutral content in `AGENTS.md`.
  17. Multi-project routing: the sample law file describes the shape directly.
- Primitives absent: no routing table that maps a request to a project. The sample workspace
  law describes the multi-project layout and a phrase-to-destination table, but nothing maps
  "work on the writing project" to a directory.
- Routing: the clearest statement of the two-file-per-project pattern in the survey.
  `samples/CLAUDE.md.example` describes the workspace as "Multi-project workspace with
  personal admin, a side project, health records, and a writing project. Each subdirectory
  has its own `CLAUDE.md` and `CONTEXT.md`." The division of labor is explicit and unusual:
  `CLAUDE.md` carries instructions, `CONTEXT.md` carries facts. `CONTEXT.md.example` says
  it holds "Entity facts about this project. Loaded by role bindings under `.claude/agents/`
  (via `@` includes) to compose a canonical role with project-specific context," and its
  see-also names `CLAUDE.md.example` as "workspace-level working context (separate scope)."
  So the override mechanism is not leaf-instructions-beat-root. It is a canonical role plus
  a project fact file composed into a subagent at the leaf. Precedence between root and leaf
  instruction files is not stated, which matters because the workspace is the user's home
  directory rather than a repo.
- Memory split: per-user in the workspace `CLAUDE.md` and `tasks/lessons.md`, per-project in
  that project's `CONTEXT.md`, per-session in `tasks/todo.md` with a review section
  appended on completion. Per-machine: not found, and the redaction rule actively forbids
  machine-layout paths in committed files.
- Human gates: destructive actions, plan approval before implementing, PR redaction check.
- Evidence of real use: heaviest of the nine. Five commits on 2026-09-13 alone, including
  "docs: release v1.17.0, the twenty-first-audit drain (#149)", which implies twenty-one
  prior self-audit cycles. Numbered PRs up to #151. Commits reference a
  `Co-Authored-By` trailer convention for Claude-assisted work.
- Generalizes: separating instructions from facts into two files per project, so a role
  definition stays canonical and only the facts change per project, the `path:line`
  grounding rule with an `[unverified]` escape valve and an explicit warning not to
  over-tag, the phrase-to-destination shortcut table with a rule for growing it, credentials
  by password-manager item name only, the token-discipline framing that "Context cost is
  size times steps."
- Idiosyncratic: the 19-role catalog spanning accountant to nutritionist, which only makes
  sense in a life-and-work workspace, the teardown genre, the public-redaction discipline,
  which exists because this specific workspace is published.
- Sources: `AGENTS.md`, `CLAUDE.md`, `samples/CLAUDE.md.example`,
  `samples/CONTEXT.md.example`, tree listing, all at
  `https://github.com/jimy-r/agent-workspace-architecture/blob/2905a3aabda0f4e30c65327728bece3279602416/<path>`,
  accessed 2026-09-13

### pedroromeroluna/peter-brain

- URL `https://github.com/pedroromeroluna/peter-brain`, 7 stars, last push 2026-08-26,
  MIT, SHA `33088ae7c742b8cdd34965e4a8f386ae04216dad`, default branch `main`
- Purpose: a PARA-structured second brain in markdown, driven by Claude Code slash
  commands and subagents, written in Spanish.
- Entry files: `.claude/CLAUDE.md` is the law. `bootstrap.md` runs first on a fresh install
  to replace the `[usuario]` placeholder.
- Layout, top two levels, trimmed: `.claude/` (`CLAUDE.md`, `agents/` with three,
  `commands/` with nine, `settings.json`, `mcp-config.json`), `PARA/` (`projects/`,
  `areas/`, `resources/`, `archives/`), `inbox/backlog.md`, `mission-control.md`,
  `recurring/` (`tasks.md`, `runs/`), `skills/debrief/SKILL.md`, `bootstrap.md`
- Primitives present:
  1. Law: `.claude/CLAUDE.md`.
  2. State surface: `mission-control.md`, a Dataview-driven kanban over "`PARA/projects/*/todo.md`
     y `PARA/areas/*/todo.md`."
  3. Index or map: the structure block inside `.claude/CLAUDE.md`, `mission-control.md`
     doubles as the cross-project view.
  4. Capture inbox: `inbox/backlog.md`, the one file exempt from the write-confirmation
     rule.
  5. Durable memory: `knowledge.md` per project or area.
  6. Dated log: `log.md` per project or area, `recurring/runs/` for recurring-task runs.
  7. Records: `log.md` carries the closeout, `skills/debrief/SKILL.md` produces it.
  8. Skills or procedures: `.claude/commands/` with nine (`capture`, `debrief`,
     `para-init`, `process-inbox`, `run-task`, `show-tasks`, `start-project`,
     `review-recurring`, `read-meeting-notes`), plus `skills/debrief/SKILL.md`.
  9. Roles or agent definitions: `.claude/agents/` with `executor-agent.md`,
     `research-agent.md`, `writer-agent.md`.
  10. Task graph: `todo.md` per project or area, with priority and date markers parsed by
      `mission-control.md`.
  11. Handoff or claim ledger: not found.
  12. Evidence or receipts: `recurring/runs/` logs executions.
  13. Gates: the strongest per-write gate in the survey. "NUNCA modifiques archivos sin
      mostrar primero al usuario qué vas a escribir y esperar confirmación," with
      `inbox/backlog.md` the sole exception. Reading outside the declared focus also needs
      a question first.
  14. Boundary: not found as a separate private tier.
  15. Maintenance loop: `/review-recurring`, `/process-inbox`, and the projects-to-archives
      move rule.
  16. Tool projections: `.claude/` only, no second runtime.
  17. Multi-project routing: `PARA/projects/<name>/` and `PARA/areas/<name>/` with a
      documented optional per-folder `CLAUDE.md`.
- Primitives absent: no boundary tier for private or machine-local content, no handoff
  ledger, no root `AGENTS.md`, so this workspace is Claude-only. And the per-project
  `CLAUDE.md` is documented but not shipped: the tree contains only
  `PARA/projects/.gitkeep`, so no example leaf instruction file exists to read.
- Routing: this repo answers "how does the agent know which project a session is in" more
  directly than any other in the survey, by asking. The law file mandates a first-message
  flow regardless of what the user typed: run `ls PARA/areas/` to pre-fetch the area list,
  then show a single `AskUserQuestion` with those areas as options and "Other" for a
  project name, then "Leé **solo** los archivos de ese proyecto/área (`todo.md` primero,
  `knowledge.md` si hace falta contexto)." Two files stay globally readable without asking:
  `inbox/backlog.md` and `recurring/tasks.md`. Anything outside the declared focus requires
  a question. The override rule is stated as progressive disclosure: "el contexto raíz se
  mantiene lean. Cada proyecto/área puede tener su propio `CLAUDE.md` con detalles
  específicos que se cargan solo cuando trabajás en esa carpeta." That is a restatement of
  the Claude Code subdirectory-on-demand load behavior as a design principle.
- Memory split: per-project or per-area `knowledge.md`, `todo.md`, and `log.md`, called
  "la trinidad", per-user nothing separate beyond the law file, per-session nothing
  persistent, per-machine nothing, though git is treated as optional ("si no está
  disponible en la máquina, el versionado se saltea y se dice en una línea").
- Human gates: every file write outside the capture inbox, every read outside the declared
  session focus.
- Evidence of real use: five commits, most recent 2026-08-26, authored by the owner. No
  agent-authored commits found. Per-project content is absent from the repo, which is
  consistent with a template that keeps the owner's real brain private.
- Generalizes: forcing an explicit focus declaration at session start rather than inferring
  it, naming a small global-read allowlist so the focus rule does not make capture
  impossible, the three-file-per-project trinity separating knowledge, tasks, and log,
  aggregating cross-project status by parsing the per-project task files rather than
  maintaining a second copy, making git optional and saying so in one line rather than
  erroring.
- Idiosyncratic: Spanish output with English command files, Obsidian Dataview as the
  dashboard runtime, and auto-commit after every modification with a
  `[name] acción breve` message format.
- Sources: `.claude/CLAUDE.md`, `mission-control.md`, tree listing, all at
  `https://github.com/pedroromeroluna/peter-brain/blob/33088ae7c742b8cdd34965e4a8f386ae04216dad/<path>`,
  accessed 2026-09-13

### ballred/obsidian-claude-pkm

- URL `https://github.com/ballred/obsidian-claude-pkm`, 1861 stars, last push
  2026-02-18, MIT, SHA `ef1e4da2f30789334aa08c756f66913570f937a5`, default branch `main`
- Purpose: a template that scaffolds a goal-cascade PKM system into an Obsidian vault
  driven by Claude Code skills.
- Entry files: `vault-template/CLAUDE.md`, with `/onboard` for first run and `/adopt` to
  scaffold onto an existing vault.
- Layout, top two levels, trimmed: `vault-template/` containing `CLAUDE.md`,
  `Daily Notes/`, `Goals/`, `Projects/`, `Templates/`, `Archives/`, `Inbox/`, and
  `.claude/skills/` including `adopt/CLAUDE.md`
- Primitives present:
  1. Law: `vault-template/CLAUDE.md`.
  2. State surface: `Goals/2. Monthly Goals.md`, pulled into the law file by
     `## Current Focus` with the line "See @Goals/2. Monthly Goals.md for this month's
     priorities." This is the only `@` import found in any repo in the survey.
  3. Index or map: the directory table inside the law file, plus the skill and agent
     tables.
  4. Capture inbox: `Inbox/`, marked optional.
  5. Durable memory: `Goals/` as the cascade from three-year vision to weekly.
  6. Dated log: `Daily Notes/` with a `YYYY-MM-DD.md` convention.
  7. Records: `Archives/` for completed or inactive content.
  8. Skills or procedures: eleven skills tabulated in the law file with their slash
     invocations, including `review` described as a "Smart router, auto-detects
     daily/weekly/monthly based on context."
  9. Roles or agent definitions: four agents tabulated (`note-organizer`,
     `weekly-reviewer`, `goal-aligner`, `inbox-processor`), plus a `coach` output style.
  10. Task graph: markdown checkboxes in daily notes and per-project milestone and
      next-action lists. The law file distinguishes them from transient UI: "Session tasks
      are temporary progress indicators, your actual to-do items remain as markdown
      checkboxes in daily notes."
  11. Handoff or claim ledger: not found.
  12. Evidence or receipts: not found.
  13. Gates: not found as named approval points.
  14. Boundary: not found.
  15. Maintenance loop: `/weekly`, `/monthly`, `/upgrade` ("Update to latest version,
      preserving your content"), and the `note-organizer` agent's link fixing.
  16. Tool projections: `.claude/skills/` only.
  17. Multi-project routing: `Projects/<Project Name>/CLAUDE.md`, one per project.
- Primitives absent: no gates, no boundary tier, no receipts, no handoff. The template
  optimizes for a single user working alone with high trust.
- Routing: the directory table declares `Projects/` as "Active projects with their own
  `CLAUDE.md`." There is no routing table mapping a request to a project, and no stated
  precedence between the vault `CLAUDE.md` and a project's. Routing is implicit in the
  Claude Code subdirectory-on-demand rule. The finding worth recording is what the leaf
  file actually contains. `Projects/Example Project/CLAUDE.md` holds project state, not
  project rules: overview, goal, started date, target completion, "Status: Active, 25%
  Complete", current focus, key decisions made, resources, a weekly routine, milestones as
  checkboxes, current challenges, and next actions. Nothing in it changes agent behavior.
  So the per-project `CLAUDE.md` here is a state surface that happens to be named like a
  law file, and it gets loaded into context by the file-name convention rather than by any
  index.
- Memory split: per-user in the vault `CLAUDE.md` plus `Goals/`, per-project in the
  project's own `CLAUDE.md`, per-session in `Daily Notes/`, per-machine nothing.
- Human gates: not found.
- Evidence of real use: 1861 stars, five commits shown between 2026-02-15 and
  2026-02-18, including an external contributor PR ("Merge pull request #10 from
  DavidROliverBA/feature/check-links-skill"). No commits since 2026-02-18, so it is
  outside the 90-day window and is included as the clearest instance of the
  per-project-file pattern rather than as an active project.
- Generalizes: using the per-project instruction file as the project's state page, which
  makes the vendor load-on-demand rule do routing work for free, the cascade that binds
  daily work to a three-year horizon through a named skill at each level, a `review` skill
  that routes to the right cadence instead of making the user pick.
- Idiosyncratic: the Obsidian tag vocabulary (`#priority/high`, `#active`), the numbered
  filenames inside `Goals/`, and the assumption of a single human owner with no approval
  gates at all.
- Sources: `vault-template/CLAUDE.md`,
  `vault-template/Projects/Example Project/CLAUDE.md`, tree listing, all at
  `https://github.com/ballred/obsidian-claude-pkm/blob/ef1e4da2f30789334aa08c756f66913570f937a5/<path>`,
  accessed 2026-09-13

### danielmiessler/LifeOS

- URL `https://github.com/danielmiessler/LifeOS`, 19005 stars, last push 2026-09-04,
  MIT, SHA `5e2f2e8c0abde612da0e99c16c0d07d4ec21b88c`, default branch `main`
- Purpose: an installable personal AI harness with a named digital assistant, a dashboard,
  and a documented component architecture. Only the multi-project part is recorded here per
  the brief.
- Entry files: `LifeOS/install/CLAUDE.template.md`, installed to `~/.claude/CLAUDE.md`,
  which the file itself calls "the **routing table**". Above it sits
  `LIFEOS/LIFEOS_SYSTEM_PROMPT.md`, loaded through `--append-system-prompt-file`.
- Layout, relevant parts only: `LifeOS/install/CLAUDE.template.md`,
  `LifeOS/install/USER/PROJECTS.md`, `LifeOS/install/USER/TELOS/PRINCIPAL_TELOS.md`,
  `LifeOS/install/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md`,
  `LifeOS/install/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md`,
  `LifeOS/install/USER/CONFIG/OPERATIONAL_RULES.md`,
  `LifeOS/install/LIFEOS/DOCUMENTATION/` (per-subsystem docs),
  `LifeOS/install/LIFEOS/PULSE/Observability/CLAUDE.md` (one nested leaf file)
- Primitives present, restricted to the multi-project layer:
  1. Law: `LIFEOS/LIFEOS_SYSTEM_PROMPT.md`, with an explicit precedence statement in the
     template: "When this file and the system prompt disagree, the system prompt wins."
  3. Index or map: `CLAUDE.template.md` is itself the routing table, "Everything below is
     **on-demand** lookup."
  5. Durable memory: five identity files under `USER/`, of which `PROJECTS.md` is one.
  17. Multi-project routing: `USER/PROJECTS.md`.
- Routing: `PROJECTS.md` is the only alias-based project router found in the survey. Its
  own description: "A compact table of every project you work on. The DA reads this at
  startup to route aliases ('my blog' → specific repo) and pick the right context for any
  project reference." The table columns are Project, Path, URL, Deploy, Stack, and a
  separate `## Routing Aliases` table maps phrases like "my site", "the blog", "the
  workspace", "that project" to a target. So a project here is an external directory
  referenced by path (`~/code/example`), not a subfolder of the root. The root does not
  contain the projects. It contains pointers to them. That is the opposite topology from
  every other repo in this survey and it means no leaf instruction file is inherited at
  all: a session in `~/code/example` gets that repo's own `CLAUDE.md` plus the user-scope
  one, and the projects table only exists to resolve names.
- Include mechanism and a concrete vendor-limit finding: the template uses `@` imports and
  documents a constraint the Claude Code docs do not state the same way. "Claude Code does
  not follow transitive `@`-imports from inside imported files, so each identity file must
  be listed here at top level." The five identity imports ship commented out and an
  installer script (`skills/LifeOS/Tools/ActivateImports.ts`) uncomments them once the user
  scaffold is populated. The memory docs say imports recurse "with a maximum depth of four
  hops," so either the doc or this file is wrong, or the limitation applied to an older
  version. Flagged under Uncertainties.
- Nested instruction files: exactly one, at
  `LifeOS/install/LIFEOS/PULSE/Observability/CLAUDE.md`, for a subsystem rather than a user
  project. Per-project instruction files: not found.
- Memory split: per-user in the five `USER/` identity files, per-project in each external
  repo, per-machine not found, per-session handled by the Cortex memory subsystem
  documented under `DOCUMENTATION/Memory/MemorySystem.md`.
- Human gates: the file notes "hard prohibitions, security protocol" live in the system
  prompt, not read here.
- Evidence of real use: 19005 stars, active. Recent commits include community triage
  ("docs: credit 29 community contributors from the 2026-09-03 triage") and outside
  contributors. Versioned releases (7.40.4). Freshness is tracked in frontmatter:
  `PROJECTS.md` carries `provenance: template`, `last_updated`, `last_updated_by:
  bootstrap-template`, `convention: pai-freshness-v1`, and a visible warning that the file
  is a placeholder until `/interview` runs.
- Generalizes: the alias table, which is the cheapest possible router and the only one that
  handles "the blog" as an input, frontmatter provenance fields that mark a file as
  un-personalized so an agent does not treat placeholder content as fact, stating the
  precedence between the system prompt and the routing file in the routing file itself,
  keeping the root a table of pointers so projects stay independent repos.
- Idiosyncratic: the "DA" and "principal" vocabulary, the TELOS identity model, a
  retired-subsystem section kept inline for history, and a maturity-model target.
- Sources: `LifeOS/install/CLAUDE.template.md`, `LifeOS/install/USER/PROJECTS.md`, tree
  listing, all at
  `https://github.com/danielmiessler/LifeOS/blob/5e2f2e8c0abde612da0e99c16c0d07d4ec21b88c/<path>`,
  accessed 2026-09-13

### safe-global/safe-wallet-monorepo

- URL `https://github.com/safe-global/safe-wallet-monorepo`, 588 stars, last push
  2026-09-13, GPL-3.0, SHA `848de60ab15be1c95502fd4f92a2b8187992d60f`, default branch
  `dev`
- Purpose: the Yarn 4 workspace monorepo holding Safe's web and mobile wallet apps and
  their shared packages.
- Entry files: root `AGENTS.md`. Root `CLAUDE.md` is one line: "Read @AGENTS.md for
  comprehensive guidelines on contributing to this repository."
- Layout, top two levels, trimmed: `AGENTS.md`, `CLAUDE.md`, `.claude/` (`commands/` with
  nine speckit commands, `skills/` with five `design.*` skills, `settings.json`,
  `launch.json`), `apps/web/`, `apps/web/e2e/`, `apps/web/cypress/`,
  `apps/web/.storybook/`, `apps/web-tanstack/`, `apps/tx-builder/`, `apps/mobile/`,
  `packages/`, `config/`, `docs/ai/`, `turbo.json`. Every one of those subtrees carries its
  own `AGENTS.md` plus a one-line `CLAUDE.md`.
- Primitives present:
  1. Law: root `AGENTS.md`, nine nested `AGENTS.md` files, each shadowed by a one-line
     `CLAUDE.md`.
  3. Index or map: the `## Nested guidance` table in the root `AGENTS.md`, plus a
     `### Key Entry Points` table of "Stable architectural landmarks for fast orientation"
     mapping area to path to purpose.
  7. Records: `docs/ai/` holds the cross-cutting conventions (`testing-conventions.md`,
     `code-navigation.md`, `when-to-extract-a-function.md`) referenced by both root and
     leaf files.
  8. Skills or procedures: `.claude/skills/design.*` (five) and `.claude/commands/speckit.*`
     (nine), both at root only.
  10. Task graph: not in-repo, GitHub issues, with PR numbers in commit subjects.
  12. Evidence or receipts: the required pre-implementation regression checklist, quoted
      below, is the strongest receipt requirement found in the survey.
  13. Gates: "Do NOT commit without a clean scoped-check pass", `SKIP_VERIFY=1` "only with
      the user's explicit say-so."
  15. Maintenance loop: "When a workspace, script, generated path, test framework, or
      architecture boundary changes, update the nearest AGENTS.md in the same PR, and
      prefer replacing old rules over appending exceptions."
  16. Tool projections: the one-line `CLAUDE.md` beside every `AGENTS.md`.
  17. Multi-project routing: the nested guidance table.
- Primitives absent: no state surface, no capture inbox, no durable user memory, no roles
  layer, no handoff ledger. Expected for a team code monorepo rather than a personal
  workspace.
- Routing: the best-documented leaf mechanism in the survey, and it names the projection
  problem explicitly. "This monorepo uses nested AGENTS.md files. Agents working in a
  subtree automatically load the nearest one, for Claude Code this works via a one-line
  pointer `CLAUDE.md` next to each AGENTS.md, so every new AGENTS.md needs one. Start at
  root for cross-cutting rules, then drop into the relevant subtree." The table then gives
  subtree, file, and a Covers column. Placement rule for new content: "When adding new
  guidance, place it in the most-specific subtree it applies to." Leaf files point back up
  for cross-cutting rules: `apps/mobile/AGENTS.md` opens "For monorepo-wide rules
  (Turborepo, theme system, Workflow, regression checklist, Security), see the root
  `../../AGENTS.md`." Leaf files also cross-reference siblings when an edit
  crosses a boundary: "Edits to `packages/**` affect both platforms and are NOT covered by
  app verify scripts, see `../../packages/AGENTS.md`." The Covers
  column carries real override content, for example `apps/tx-builder/` is marked "MUI v6 +
  Vite, web styling rules do not apply," so the table itself states an override rather than
  leaving it to concatenation order.
- A boundary hazard is documented rather than hidden: `yarn verify:changed` "does not
  auto-detect the workspace: it defaults to web and silently skips files outside
  `apps/<workspace>/`, so a mobile-, web-tanstack-, packages-, or config-only change gets a
  false green pass." That is a multi-project tooling trap written into the law file.
- Memory split: per-project in each subtree's `AGENTS.md`, cross-cutting in root `AGENTS.md`
  and `docs/ai/`. No per-user or per-machine tier, since nothing here is personal.
- Human gates: a clean scoped verify pass before commit, explicit user say-so to skip
  verify, and the required checklist, which must be pasted into the response before
  implementing, with a mandated final section "State what you will NOT verify. Be explicit.
  This exposes false confidence."
- Evidence of real use: heavy. Five commits 2026-09-10 to 2026-09-11 from five different
  named humans, PR numbers in the 8650 to 8693 range.
- Generalizes: the one-line pointer file as the cheapest possible tool projection, plus the
  rule that every new leaf law file needs one, a routing table whose Covers column states
  the override rather than relying on load order, leaf files that link back up for
  cross-cutting rules and sideways for boundary crossings, requiring the instruction file
  nearest the change to be updated in the same PR, naming the false-green risk of a
  workspace-unaware verify script.
- Idiosyncratic: the specific verify-script behavior, the speckit command set, and the
  Safe-specific theme token rules.
- Sources: `AGENTS.md`, `CLAUDE.md`, `apps/mobile/AGENTS.md`, `apps/mobile/CLAUDE.md`,
  tree listing, all at
  `https://github.com/safe-global/safe-wallet-monorepo/blob/848de60ab15be1c95502fd4f92a2b8187992d60f/<path>`,
  accessed 2026-09-13

### palantir/osdk-ts

- URL `https://github.com/palantir/osdk-ts`, 90 stars, last push 2026-09-13, no license
  field set, SHA `e37d2eb6e54fd7e34b380d9d611caf2ea0118d85`, default branch `main`
- Purpose: the pnpm monorepo for Palantir's Ontology SDK TypeScript packages.
- Entry files: root `CLAUDE.md`. `.github/copilot-instructions.md` exists as a third
  projection.
- Layout, relevant files: root `CLAUDE.md`, `.github/copilot-instructions.md`,
  `.claude/skills/add-new-component/SKILL.md`, `.claude/skills/contribute/SKILL.md`,
  `packages/<pkg>/AGENTS.md` and `packages/<pkg>/CLAUDE.md` pairs (`cbac-components`,
  `react-components`, `react`), deep source-level files at
  `packages/client/src/CLAUDE.md` and four more under
  `packages/client/src/observable/`, and template copies at
  `packages/create-app.template.typescript-library.beta/templates/AGENTS.md` and
  `.claude/CLAUDE.md`
- Primitives present:
  1. Law: root `CLAUDE.md`, per-package `CLAUDE.md`, source-directory `CLAUDE.md`,
     per-package `AGENTS.md`.
  7. Records: `.changeset/<name>.md`, one per PR, and `etc/<package>.report.api.md` API
     reports that must be committed.
  8. Skills or procedures: `.claude/skills/add-new-component/` and
     `.claude/skills/contribute/`, both invoked by name from a leaf file.
  12. Evidence or receipts: the committed API report from `pnpm turbo check-api`, the
      `dprint check` pre-commit hook, and CI failing on a missing changeset.
  13. Gates: "NEVER use `any` without asking the user first", "NEVER disable gpg signing
      unless explicitly requested". The `contribute` skill "adds a failing-test-first gate
      for bug fixes (TDD), an API-change checkpoint when the diff touches public props."
  15. Maintenance loop: the API-report regeneration step and the changeset-per-PR rule.
  16. Tool projections: three at root, `CLAUDE.md`, `AGENTS.md` at package level, and
      `.github/copilot-instructions.md`.
  17. Multi-project routing: per-package file pairs, no routing table.
- Primitives absent: no index or routing file, no state surface, no roles, no task graph in
  repo. An agent finds the right leaf by reading a file in that directory, nothing more.
- Routing: no table. Discovery is entirely the vendor's nearest-file rule. Two findings
  make this record worth keeping. First, `CLAUDE.md` and `AGENTS.md` at the same package
  path are written for different audiences. `packages/react-components/CLAUDE.md` opens
  "This documentation provides guidance for developing in `@osdk/react-components`" and
  covers contributor workflow. `packages/react-components/AGENTS.md` opens "Pre-built,
  Ontology-aware React components" and is written for an agent in a consumer's project:
  install commands, peer-version pinning recipes read out of the shipped `CHANGELOG.md`,
  and a table of install-time errors with causes and fixes. So the same filename convention
  carries opposite intent at the same path. Second, the leaf file states its own precedence
  against skills and asks for conflicts to be reported: "If a skill ever conflicts with
  this file or `CONTRIBUTING.md`, those win, flag the conflict." That is the only explicit
  leaf-versus-skill precedence rule found in the survey, and it runs the opposite direction
  from what a reader might assume, since the same file also says "Do not improvise the
  workflow, follow the skill."
- Depth is notable: `CLAUDE.md` appears as deep as
  `packages/client/src/observable/internal/links/CLAUDE.md`, so the unit is a source
  directory rather than a package. The deep files carry mechanism notes that would be
  wrong to hoist, for example the instruction in
  `packages/client/src/observable/CLAUDE.md` not to abstract the
  `process.env.NODE_ENV !== "production"` logging guard because it is written that way to
  be removed at build time.
- Memory split: nothing per-user or per-machine. Per-package in the leaf files, global in
  root.
- Human gates: asking before `any`, gpg signing, the TDD gate and API-change checkpoint
  inside the `contribute` skill.
- Evidence of real use: active. Five commits on 2026-09-11 from four named humans, PR
  numbers near 4017, and a five-part PR series.
- Generalizes: splitting the two filename conventions by audience rather than by tool, so
  `AGENTS.md` documents the package for downstream agents while `CLAUDE.md` documents it
  for contributors, putting an instruction file at the source-directory level where the
  reason for a local convention lives, stating leaf-versus-skill precedence in the leaf and
  asking the agent to flag conflicts instead of silently picking.
- Idiosyncratic: the changeset-per-branch rule, the `dprint` formatting instruction with a
  `git ls-files --modified` scope command, and the prerelease peer-pinning recipe.
- Sources: root `CLAUDE.md`, `packages/react-components/CLAUDE.md`,
  `packages/react-components/AGENTS.md`,
  `packages/client/src/observable/CLAUDE.md`, tree listing, all at
  `https://github.com/palantir/osdk-ts/blob/e37d2eb6e54fd7e34b380d9d611caf2ea0118d85/<path>`,
  accessed 2026-09-13

### skmtc/skmtc

- URL `https://github.com/skmtc/skmtc`, 19 stars, last push 2026-09-01, Apache-2.0, SHA
  `629a3bc51af502c740ef2b2da00b0c5a39462369`, default branch `main`
- Purpose: a Deno workspace monorepo that generates code artifacts from OpenAPI v3
  documents.
- Entry files: `deno/CLAUDE.md`, the workspace root file. Note it is not at the repo root.
- Layout: 51 `CLAUDE.md` files, all under `deno/`, at every level from `deno/CLAUDE.md`
  through `deno/core/parse/v3-0/_merge-all-of/CLAUDE.md`. One `.cursor/rules/deno.mdc` at
  `deno/`. No `AGENTS.md` anywhere.
- Primitives present:
  1. Law: 51 nested `CLAUDE.md` files. Each opens with the identical `/init`-generated
     header "This file provides guidance to Claude Code (claude.ai/code) when working with
     code in this repository."
  6. Dated log: an auto-generated activity log is embedded inside at least one instruction
     file. `deno/cli/commands/CLAUDE.md` begins with a `<claude-mem-context>` block
     carrying a dated table of session summaries with ids, times, titles, and read counts,
     marked "This section is auto-generated by claude-mem. Edit content outside the tags."
  13. Gates: "**Always release through `deno task release`**... **Never publish a workspace
      package by hand**" because manual publishing "skips the cascade and silently leaves
      downstream `@skmtc/*` consumers pinned to the old version."
  16. Tool projections: `deno/.cursor/rules/deno.mdc` alongside the Claude files.
  17. Multi-project routing: nesting only, no index.
- Primitives absent: no routing table, no state surface, no skills, no roles, no receipts
  beyond CI, no boundary tier. And notably no `AGENTS.md`, so this workspace is
  Claude-plus-Cursor only.
- Routing: none. 51 files at arbitrary depth with no index and no cross-links is the
  maximum-nesting endpoint of this pattern, and it exposes two failure modes worth naming.
  First, duplication: `deno/CLAUDE.md` and `deno/core/CLAUDE.md` both explain the release
  cascade, in overlapping but not identical wording, so a change to the release process has
  to be found in two places. Second, drift into state: a memory tool writing dated session
  summaries into `deno/cli/commands/CLAUDE.md` turns an always-loaded instruction file into
  a growing log, which is exactly the context cost the nesting was supposed to avoid. Both
  are visible in the files themselves.
- Memory split: per-directory in the leaf files. The `claude-mem` block is per-session
  content written into a per-directory file, which is the wrong tier for it.
- Human gates: the release path.
- Evidence of real use: active through 2026-09-01, single maintainer, PR-based with
  review-response commits ("fix(core): address review on the insertion-target change").
  The `claude-mem` block is direct evidence of agent sessions writing into the repo.
- Generalizes: the negative lesson. Nesting scales the number of files, not the coherence
  of the rules, and without an index or a placement rule the same fact gets restated at
  several depths. Also worth generalizing: putting the instruction root at the workspace
  directory (`deno/`) rather than the repo root, so a session started in the workspace
  loads the right file.
- Idiosyncratic: Deno and JSR release cascade specifics, and the `claude-mem` integration.
- Sources: `deno/CLAUDE.md`, `deno/core/CLAUDE.md`, `deno/cli/commands/CLAUDE.md`, tree
  listing, all at
  `https://github.com/skmtc/skmtc/blob/629a3bc51af502c740ef2b2da00b0c5a39462369/<path>`,
  accessed 2026-09-13

### Also read, not recorded in full

`phuryn/pm-brain` (822 stars, pushed 2026-05-20, MIT, SHA
`6dcc1a712f7b5246fbb0d34477e0c2c9df47e9df`) is not a multi-project root, but it carries one
distinction directly relevant to this slice, so it is noted here. Its root `CLAUDE.md`
states: "This `CLAUDE.md` is the **repo-level** operating manual... It is NOT the brain's
own operating manual. The brain has its own `CLAUDE.md` inside `example-brain/CLAUDE.md`
and inside any working directory the skill is invoked in." That is an explicit separation
between the law for the tool's own repo and the law for an instance of the tool, at two
different depths of the same tree, and it is the cleanest statement of that distinction
found in the survey. Its `AGENTS.md` is a three-line router by agent identity rather than by
subtree: "If you are **Claude**... read `CLAUDE.md`. If you are a **different agent**
(Cursor, Codex, Aider, GitHub Copilot, others): start with `README.md`."
Source:
`https://github.com/phuryn/pm-brain/blob/6dcc1a712f7b5246fbb0d34477e0c2c9df47e9df/CLAUDE.md`
and `.../AGENTS.md`, accessed 2026-09-13.

---

## Patterns across this slice

Legend: Y present, P partial, N absent. Columns are abbreviated repo names.

| # | Primitive | ibos | pos-bp | awa | peter | pkm | LifeOS | safe | osdk | skmtc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Law | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| 2 | State surface | P | P | Y | Y | Y | N | N | N | N |
| 3 | Index or map | Y | Y | Y | P | P | Y | Y | N | N |
| 4 | Capture inbox | Y | N | Y | Y | Y | N | N | N | N |
| 5 | Durable memory | Y | Y | Y | Y | Y | Y | N | N | N |
| 6 | Dated log | Y | Y | P | Y | Y | P | N | N | P |
| 7 | Records | Y | Y | Y | Y | Y | N | Y | Y | N |
| 8 | Skills or procedures | Y | Y | Y | Y | Y | Y | Y | Y | N |
| 9 | Roles or agents | Y | N | Y | Y | Y | Y | N | N | N |
| 10 | Task graph | Y | Y | Y | Y | P | N | N | N | N |
| 11 | Handoff or claim ledger | Y | N | Y | N | N | N | N | N | N |
| 12 | Evidence or receipts | Y | Y | Y | P | N | N | Y | Y | N |
| 13 | Gates | Y | Y | Y | Y | N | P | Y | Y | Y |
| 14 | Boundary | Y | Y | Y | N | N | N | N | N | N |
| 15 | Maintenance loop | Y | Y | Y | Y | Y | N | Y | Y | N |
| 16 | Tool projections | Y | Y | Y | P | P | P | Y | Y | Y |
| 17 | Multi-project routing | Y | Y | Y | Y | Y | Y | Y | Y | P |

Every root in this slice has exactly two things in common: one law file the agent is told to
read first, and a rule, stated or inherited, for how a second file deeper in the tree
modifies it. Nothing else is universal. The clean split is between personal roots and code
monorepos, and it runs along the state axis. All five personal roots carry a state surface,
a capture inbox, and durable memory, none of the four code monorepos carry any of the three.
The monorepos carry receipts and gates instead, because their work product is reviewed by
other people and the personal roots' work product is not. The second split is over whether
routing is written down. Four repos ship a routing artifact that maps a request to a
destination (`infinite-brain-os` by task class, `personalos-boilerplate` by intent to skill,
`safe-wallet-monorepo` by subtree, `LifeOS` by alias), and five rely entirely on the
vendor's nearest-file rule, which means a request has to already know its own directory.
The repos with no routing artifact are also the repos with the most instruction files, which
is the wrong correlation: `skmtc` has 51 law files and no index, and its two deepest
failure modes, duplicated release rules and a session log growing inside an always-loaded
file, both trace to that absence. Boundary is the rarest primitive at three of nine, and all
three are repos whose owner publishes the workspace, which suggests boundary discipline is
driven by an audience rather than by hygiene. Only two repos answer "which project is this
session in" with a mechanism rather than an assumption: `peter-brain` asks the user at the
first message and refuses to read outside the answer, and `LifeOS` resolves an alias table.
Finally, the leaf instruction file is doing two incompatible jobs across this set. In
`safe-wallet-monorepo` and `osdk-ts` it carries rules that override the root. In
`obsidian-claude-pkm` it carries project state, with no rules at all. Both work, because the
vendor loads the file either way, but they are different primitives wearing the same
filename, and a workspace that mixes them will not know whether a leaf file is authoritative.

## Inheritance and precedence comparison

| Source | Root file | Leaf file | Precedence rule | Include mechanism | Shared skills | Per-project skills | Path-move fragility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `CLAUDE.md` or `.claude/CLAUDE.md`, user `~/.claude/CLAUDE.md` | `CLAUDE.md` in any subdirectory | Concatenated root-down, closest read last, ancestors at launch, subdirectories on demand | `@path`, 4 hops max, skips code spans, external paths prompt once | repo root `.claude/skills/`, `~/.claude/skills/`, or a plugin | `<dir>/.claude/skills/` | low for per-directory files, high for `@path` imports and `paths:` globs |
| Codex | `AGENTS.md`, global `~/.codex/AGENTS.md`, `AGENTS.override.md` beats `AGENTS.md` | `AGENTS.md` per package | Concatenated root-down to cwd, later wins, one file per directory, 32 KiB cap | not found | not covered | not covered | low |
| GitHub Copilot | `.github/copilot-instructions.md`, root `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` | `AGENTS.md` anywhere, `.github/instructions/*.instructions.md` with `applyTo` | "the nearest `AGENTS.md` file in the directory tree will take precedence", path-specific and repo-wide combine, personal beats repository beats organization | `applyTo` glob frontmatter | not covered | `AGENTS.md` per directory | low for `AGENTS.md`, high for `applyTo` globs |
| Cursor | `.cursor/rules/*.mdc` at project root | nested `.cursor/rules` not documented, nested `AGENTS.md` supported | Team, then Project, then User rules, within rules, the four activation modes decide | `@filename` inside a rule | `.cursor/rules/` | via `globs` frontmatter, not placement | high, rule scope is a glob string in a central file |
| VS Code with Copilot | `.github/copilot-instructions.md`, root `AGENTS.md` or `CLAUDE.md` | nested `AGENTS.md`, experimental, behind `chat.useNestedAgentsMdFiles` | "no specific order is guaranteed" | `applyTo` glob | `.github/instructions`, `.claude/rules`, `~/.copilot/instructions`, `~/.claude/rules` | nested `AGENTS.md` | high, ordering is not guaranteed so a move can change effective rules silently |
| Nx | `AGENTS.md`, `CLAUDE.md` "and equivalents" written by `nx configure-ai-agents` | root versus per-project placement not stated | not stated | not stated | Nx agent skills installed by the same command | not stated | low, the project graph resolves names rather than paths |
| Turborepo | none documented | none documented | not applicable | not applicable | Turborepo agent skill | `description` field per task in `turbo.json` | low, config-resident |
| starmynd-org/infinite-brain-os | `AGENTS.md` and `CLAUDE.md`, mirrored, edited together | none, a project is a `PLAN.md`, rules stay central | Root law, then doctrine card, then routing map, then namespace `INDEX.md`, canon beats derived, map changes are contract changes | none in the instruction files, wikilinks between nodes | `entities/skills/` canonical | none | high, `_system/retrieval-routing-map.md` and `_system/namespaces/` both hardcode namespace names, the multi-brain contract git-ignores `brains/*` so a mount move is invisible to git |
| vincentmumme/personalos-boilerplate | `core/AGENTS.md` with `core/CLAUDE.md` | none per project, `modules/` carry their own text | `/system` owns process logic, domain owner owns fact, skills own neither, most specific skill wins | `[[wikilink]]` | `core/skills/` | `modules/` runbooks | high, `RESOLVER.md` and every `index.md` hardcode paths, the generated `reference/` tier multiplies the breakage |
| jimy-r/agent-workspace-architecture | `samples/CLAUDE.md.example` at the workspace | `CLAUDE.md` plus `CONTEXT.md` per subdirectory | not stated between root and leaf, a role is canonical and `CONTEXT.md` supplies facts, composed via `@` includes in `.claude/agents/` | `@` includes inside role bindings | `samples/.claude/skills/` | per-project `.claude/agents/` bindings | high, role bindings `@`-include a project's `CONTEXT.md` by path |
| pedroromeroluna/peter-brain | `.claude/CLAUDE.md` | optional `CLAUDE.md` per project or area, documented but not shipped | "el contexto raíz se mantiene lean", leaf loads only when working in that folder | none | `.claude/commands/`, `skills/` | per-folder `CLAUDE.md` | medium, `mission-control.md` parses `PARA/*/*/todo.md` by glob, so a rename drops a project from the board silently |
| ballred/obsidian-claude-pkm | `vault-template/CLAUDE.md` | `Projects/<name>/CLAUDE.md`, carrying state not rules | not stated | `@Goals/2. Monthly Goals.md` | `.claude/skills/` | none | high, the `@` import names a numbered filename with spaces |
| danielmiessler/LifeOS | `CLAUDE.template.md` installed to `~/.claude/CLAUDE.md`, system prompt above it | one subsystem file only, projects are external repos with their own | "When this file and the system prompt disagree, the system prompt wins" | `@` imports, and the file states transitive imports are not followed, so each must be listed at top level | `LIFEOS/` skills at user scope | each external repo's own | medium, `PROJECTS.md` stores absolute-style paths per project but they are data in a table, so a move is a one-row edit |
| safe-global/safe-wallet-monorepo | `AGENTS.md` with a one-line `CLAUDE.md` pointer | `AGENTS.md` plus one-line `CLAUDE.md` in nine subtrees | Nearest wins by vendor rule, the root table's Covers column states overrides explicitly ("web styling rules do not apply"), leaf files link back up for cross-cutting rules | `@AGENTS.md` in the pointer file, relative markdown links elsewhere | root `.claude/skills/` and `.claude/commands/` | none, per-subtree rules live in the `AGENTS.md` | medium, the nested guidance table lists nine paths and the cross-references between leaves are relative links, so a subtree rename breaks the table and the links |
| palantir/osdk-ts | `CLAUDE.md`, `.github/copilot-instructions.md` | `CLAUDE.md` and `AGENTS.md` per package, `CLAUDE.md` per source directory | "If a skill ever conflicts with this file or `CONTRIBUTING.md`, those win, flag the conflict" | none | root `.claude/skills/` | invoked by name from a leaf file | low, files travel with their directory and there is no index to break |
| skmtc/skmtc | `deno/CLAUDE.md` at the workspace, not the repo root | 50 more `CLAUDE.md` at every depth | vendor rule only, nothing stated | none | none | none | low for the files, but the release rules are duplicated across depths so a move leaves a stale copy |

## Names people actually use

Counts are across the nine repository records plus `phuryn/pm-brain`, ten repos total.

1. Law: `CLAUDE.md` 9, `AGENTS.md` 6, `.claude/CLAUDE.md` 2, `core/AGENTS.md` 1,
   `AGENTS.override.md` (vendor only), `.cursorrules` 0,
   `.github/copilot-instructions.md` 1, `LIFEOS_SYSTEM_PROMPT.md` 1,
   `CLAUDE.template.md` 1, `CLAUDE.md.example` 1
2. State surface: `mission-control.md` 1, `board.example.md` 1, `Goals/2. Monthly Goals.md`
   1, `sessions/active/` 1, `skills/priority-dashboard/` 1, `tasks/todo.md` 1
3. Index or map: `INDEX.md` 5 (`projects/INDEX.md`, `departments/INDEX.md`,
   `_system/namespaces/INDEX.md`, `core/INDEX.md`, `example-brain/INDEX.md`),
   `index.md` 3 (`core/projects/index.md`, `core/skills/index.md`,
   `blueprints/projects/index.md`), `START-HERE.md` 2, `PROJECTS.md` 1,
   `retrieval-routing-map.md` 1, `RESOLVER.md` 2, `system-map.md` 1,
   `META_ARCHITECTURE.md` 1, `docs/llms.txt` 1, `workspace-map.html` 1,
   `PROJECTS-INDEX.md` 0 found in any public repo
4. Capture inbox: `inbox/` 2 (`intake/` 1 as a variant), `Inbox/` 1,
   `inbox/backlog.md` 1, `tasks/To Do Notes.md` 1
5. Durable memory: `memory/` 1, `USER.md` 2, `SOUL.md` 1, `knowledge/` 2,
   `knowledge.md` 1, `Goals/` 1, `tasks/lessons.md` 1, `CONTEXT.md` 1,
   `PRINCIPAL_IDENTITY.md` 1, `PRINCIPAL_TELOS.md` 1, `DA_IDENTITY.md` 1
6. Dated log: `Daily Notes/` 1, `log.md` 1, `sessions/logs/` 1, `recurring/runs/` 1,
   `teardowns/<date>-<slug>.md` 1, `<claude-mem-context>` block inside a `CLAUDE.md` 1,
   `docs/history.md` 1
7. Records: `.changeset/<name>.md` 1, `etc/<pkg>.report.api.md` 1,
   `sessions/reviews/` 1, `outputs/` 1, `canon-changelog-rules.md` 1,
   `personalos-mutation-contract.md` 1, `EVALUATION.md` 1, `docs/self-score.md` 1,
   `Archives/` 1, `archives/` 1
8. Skills or procedures: `SKILL.md` 8, `.claude/skills/` 6, `.claude/commands/` 4,
   `skills/` 3, `entities/skills/` 1, `workflows/` 1, `automations/n8n/` 1,
   `.claude/scheduled-tasks/` 1, `.codex/skills/` 1, `routing-eval.jsonl` beside a
   `SKILL.md` 1
9. Roles or agents: `.claude/agents/` 4, `roles/` 1, `entities/agents/` 1,
   `.codex/agents/` 1, `output-styles/` 1
10. Task graph: `todo.md` 3, `PLAN.md` 1, `board.example.md` 1, `tasks.md` 1,
    `swarms/Sprints/` 1, `task-manager/SKILL.md` 1
11. Handoff or claim ledger: `agent-queue.SKILL.example.md` 1, `sessions/active/` plus
    `sessions/closed/` 1, `session-ledger-rules.md` 1
12. Evidence or receipts: `pos-verify/SKILL.md` 1, `verify-completion/SKILL.md` 1,
    `recurring/runs/` 1, `validate.sh` 1, `audit_checks/run_all.py` 1,
    the pasted regression checklist 1, committed API report 1, `path:line` citation rule 1
13. Gates: prose rules in the law file 8, `operator-human-queue-contract.md` 1,
    `promotion-path-rules.md` 1, `SKIP_VERIFY=1` opt-out 1, `redaction-check.yml` 1
14. Boundary: `.gitignore` entries 3, `secrets/` 1, `policy/export-policy.json` 1,
    `tools/*/runtime/` 1, `outputs/_runtime/` 1, redaction placeholders
    `<workspace> <home> <project>` 1, `brains/*` git-ignored 1
15. Maintenance loop: `sync-adapters.sh` 1, `consolidate-memory/SKILL.md` 1,
    `check_freshness.py` 1, `freshness-review-rules.md` 1,
    `contradiction-review-rules.md` 1, `improve-loop.md` 1,
    `monthly-canon-review.md` 1, `/upgrade` skill 1, a `## Maintenance` section inside
    each index file 1
16. Tool projections: `.claude/` 8, `.codex/` 1, `.cursor/rules/*.mdc` 1,
    `.github/copilot-instructions.md` 1, one-line `CLAUDE.md` pointing at `AGENTS.md`
    10 instances in one repo, `.obsidian/` 1, `reference/` (generated) 1
17. Multi-project routing: `projects/<slug>/` 4, `PARA/projects/<name>/` 1,
    `Projects/<Name>/` 1, `knowledge/<namespace>/` 1, `brains/<name>/` 1,
    `apps/<name>/` and `packages/<name>/` 2, a nested-guidance table 1,
    a routing-alias table 1, `departments/<name>/` 1

Two naming notes. `PROJECTS-INDEX.md` as a literal filename returned no relevant hit in
public code, the convention people actually use is `INDEX.md` or `index.md` inside a
`projects/` folder. And the single most common per-project artifact is not an instruction
file at all: it is a `todo.md` or `PLAN.md`, appearing in five of ten repos, which means the
per-project file people write most often is a task list, and the per-project instruction
file is the rarer choice.

## Uncertainties

- Transitive `@` imports. The Claude Code memory doc says "Imported files can recursively
  import other files, with a maximum depth of four hops." `LifeOS/install/CLAUDE.template.md`
  says "Claude Code does not follow transitive `@`-imports, so each must be listed here
  directly" and ships five commented imports plus an activation script built around that
  claim. One of the two is wrong, or the limitation applied to an older version. Not
  resolved. Anyone relying on nested imports across a multi-project root should test it on
  their own version rather than trusting either source.
- Nx root versus per-project placement. `https://nx.dev/docs/getting-started/ai-setup` names
  the files `nx configure-ai-agents` writes but does not say whether it writes a per-project
  `AGENTS.md`. Could not confirm from the doc. Would need to run the command or read the
  generator source.
- Cursor nested rules. The Cursor rules page documents nested `AGENTS.md` and does not
  document nested `.cursor/rules`. Absence on that page is not proof the feature does not
  exist. Recorded as "not documented" rather than "not supported."
- Cursor doc retrieval. `docs.cursor.com/en/context/rules` 308-redirects to `cursor.com/docs`
  and the content was read from `cursor.com/docs/context/rules`. The quoted strings are from
  that page's rendering, the site is a single-page app so exact section boundaries could not
  be verified against a raw source.
- VS Code multi-root workspaces. The custom-instructions page does not address instruction
  discovery in a `.code-workspace` multi-root setup. This is the one vendor mechanism that
  maps most directly onto the slice and it is undocumented. Not resolved.
- Turborepo. No AGENTS.md guidance was found at `turborepo.dev/docs/guides/ai`.
  `turborepo.dev/docs/guides/ai-agents` and `turborepo.com/docs/guides/ai-agents` both 404
  or redirect to a 404. A search result referenced `turborepo.dev/agents.md` as an
  agent-facing discovery file for the docs site itself, not as monorepo guidance. Recorded
  as "not found," not as "does not exist."
- `personalos-boilerplate` real use. The repo has one commit and is generated from a private
  instance, so every claim about how it behaves in use comes from its own documentation
  rather than from history. Lowest-confidence record in the set.
- `peter-brain` per-project instruction files. The law file documents an optional per-folder
  `CLAUDE.md`, but `PARA/projects/` contains only `.gitkeep`, so the pattern is stated and
  not demonstrated. The precedence behavior is inferred from the vendor rule, not from the
  repo.
- Star counts on the `second-brain` topic search. Several repos returned very high star
  counts (14870, 4637, 4438) with recent pushes but no committed instruction files and
  generic descriptions. I did not investigate whether those counts are organic. None were
  included as records.
- GitHub code search coverage. `gh search code` returns a capped, ranked subset, not an
  exhaustive index, and it does not index every repository. Repos matching this slice
  certainly exist that these queries did not surface. The nine records are a sample, not a
  census.
- No rate limits were hit. All `gh api` and `gh search` calls succeeded on the first
  attempt.
