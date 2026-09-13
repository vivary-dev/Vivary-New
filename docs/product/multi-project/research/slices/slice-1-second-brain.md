# Slice 1: personal knowledge, second brain, and LLM wiki workspaces

Supplied research input. Read the [source reconciliation](../workspace-research-reconciliation.md) before using
its claims or delivery order. The accepted plan is the program frontier.

Structural read of 12 public repositories plus the Karpathy LLM Wiki gist. All
files read on 2026-09-13 at the commit SHA recorded per repo. Primary sources
only: repository files fetched through the GitHub contents API and the gist raw
endpoint. No repo was cloned, installed, or executed.

Repos examined: 12. Full records: 11 (one plugin skipped with a note).

---

## Spec source: Karpathy's LLM Wiki gist

Not a repo. Read in full at
https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw
(11,985 bytes, accessed 2026-09-13). The gist API endpoint returned HTTP 502
twice. The raw endpoint served the document.

The document calls itself "an idea file, it is designed to be copy pasted to
your own LLM Agent" and says it is "intentionally abstract. It describes the
idea, not a specific implementation."

**Three layers it names:**

- Raw sources. "These are immutable - the LLM reads from them but never modifies
  them. This is your source of truth."
- The wiki. "a directory of LLM-generated markdown files... The LLM owns this
  layer entirely." Named page kinds: summaries, entity pages, concept pages,
  comparisons, an overview, a synthesis.
- The schema. "a document (e.g. CLAUDE.md for Claude Code or AGENTS.md for
  Codex) that tells the LLM how the wiki is structured." Co-evolved by human and
  LLM.

**Operations it prescribes, with reads and writes:**

| Operation | Reads | Writes |
|---|---|---|
| Ingest | the new raw source, existing wiki pages | a summary page in the wiki, the index, "relevant entity and concept pages across the wiki", an entry appended to the log. "A single source might touch 10-15 wiki pages." |
| Query | relevant wiki pages (index first) | nothing by default, optionally files the answer back as a new wiki page. Output forms named: markdown page, comparison table, Marp slide deck, matplotlib chart, canvas. |
| Lint | the wiki | nothing stated, produces findings. Checks named: contradictions between pages, stale claims superseded by newer sources, orphan pages with no inbound links, important concepts lacking their own page, missing cross-references, data gaps fillable by web search. |

**Two special files:**

- `index.md`, content-oriented. "each page listed with a link, a one-line
  summary, and optionally metadata like date or source count. Organized by
  category (entities, concepts, sources, etc.). The LLM updates it on every
  ingest." On query the LLM reads the index first, then drills in. Stated to
  work "at moderate scale (~100 sources, ~hundreds of pages)" without embedding
  RAG.
- `log.md`, chronological and append-only. Prescribed entry prefix
  `## [2026-04-02] ingest | Article Title`, justified by
  `grep "^## \[" log.md | tail -5`.

**Never-write rule:** raw sources only. Stated once, twice: "immutable", "never
modifies them".

**Optional pieces:** a CLI search engine (names qmd), Obsidian Web Clipper for
capture, a fixed attachment folder such as `raw/assets/`, graph view, Marp,
Dataview over frontmatter, git for history.

Everything downstream in this slice is a hardening of this six-noun vocabulary:
`raw/`, `wiki/`, schema file, `index.md`, `log.md`, three operations.

Sources:
- Gist full text, https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw (accessed 2026-09-13)

---

### AgriciDaniel/claude-obsidian

- URL https://github.com/AgriciDaniel/claude-obsidian, 14,870 stars, last push
  2026-09-10T17:44:23Z, MIT, SHA `32ac5a02c4e082e4a5628ca810776375e134708e`
- Purpose: a distributable Agent Skills package plus Python core that turns an
  Obsidian vault into a transactional, source-cited LLM wiki with provenance
  ledgers.
- Entry files in stated order (`AGENTS.md`, "Bootstrap"): 1. `AGENTS.md`. In a
  dev checkout also root `CLAUDE.md`. 2. the selected skill in full. 3. only the
  references that skill routes to. 4. resolve the user vault, and if
  `wiki/hot.md` exists "read it silently".
- Layout, top two levels, trimmed:

```
AGENTS.md  CLAUDE.md  GEMINI.md  ZCODE.md  WIKI.md  README.md  Makefile
.claude-plugin/{plugin.json,marketplace.json}
.cursor/rules/claude-obsidian.mdc   .windsurf/rules/claude-obsidian.md
.github/copilot-instructions.md
agents/{wiki-ingest.md,wiki-lint.md,verifier.md}
claude_obsidian/*.py            # transaction, ledgers, gates, page_schema, ...
config/{adapters,capabilities,product-contract,release-allowlist}.json
hooks/{hooks.json,README.md}    scripts/*.py|*.sh
skills/<15 names>/SKILL.md      templates/vault/   examples/sample-vault/
```

  The vault shape is declared in `WIKI.md`: `inbox/`, `.raw/` with
  `.manifest.json`, `wiki/` holding `index.md`, `log.md`, `hot.md`,
  `overview.md`, `sources/`, `entities/`, `concepts/`, `questions/`,
  `canvases/`, `meta/ledgers/{source-ledger.json,claim-ledger.json}`, plus
  `.obsidian/` and an ignored `.vault-meta/`.
- Primitives present:
  1. Law: `AGENTS.md`, mirrored as `CLAUDE.md`, `GEMINI.md`, `ZCODE.md`,
     `.cursor/rules/claude-obsidian.mdc`, `.windsurf/rules/claude-obsidian.md`,
     `.github/copilot-instructions.md`.
  2. State surface: `wiki/hot.md`, "bounded recent context, never a transcript",
     may hold recent facts, changed pages, active threads, unresolved questions.
  3. Index: `wiki/index.md` plus `wiki/overview.md`. Methodology MOCs may
     satisfy the navigation invariant instead.
  4. Capture inbox: `inbox/`, "visible capture intake; never deleted
     automatically". The core "may propose deletion but never executes it".
  5. Durable memory: `wiki/entities/`, `wiki/concepts/`, and the two ledgers
     under `wiki/meta/ledgers/`.
  6. Dated log: `wiki/log.md`, newest first, one entry per logical operation
     rather than per file write.
  7. Records: `claim-ledger.json` carries assessment
     (`accepted|provisional|contested|unsupported|deprecated`). Page types
     `question` and `comparison` in `claude_obsidian/page_schema.py`.
  8. Skills: 15 at `skills/<name>/SKILL.md`, frontmatter restricted to `name`
     and `description`.
  9. Roles: `agents/wiki-ingest.md`, `agents/wiki-lint.md`, `agents/verifier.md`.
  11. Claim ledger: present in the provenance sense (`claim-ledger.json`), not
     as work ownership. `.vault-meta/` holds locks, journals, queues.
  12. Evidence: SHA-256 source identity, independence keys, "High-risk accepted
     claims need two independent sources", `make test` after behavioral changes.
  13. Gates: "Destructive repairs, remote egress, and canonical research merges
     require explicit consent". `transaction apply` needs an
     `--approved-plan-sha256` bound to the resolved vault root. No agent may
     push, tag, or publish without owner approval. SessionStart context
     injection off unless `CLAUDE_OBSIDIAN_SESSION_CONTEXT=1`.
  14. Boundary: `.vault-meta/` ignored runtime state, `.raw/` create-only, and
     product repo and user vault are explicitly separate roots.
  15. Maintenance loop: `wiki-lint` (read-only, deterministic), `doctor`,
     `transaction recover`, `wiki-fold` (extractive rollup of log entries),
     explicit `checkpoint`.
  16. Tool projections: `.claude-plugin/`, `.cursor/rules/`, `.windsurf/rules/`,
     `GEMINI.md`, `ZCODE.md`, `.github/copilot-instructions.md`, installed by
     `scripts/setup-multi-agent.sh --host <name>`.
  17. Multi-project routing: vault resolution order is `--vault`, then
     `CLAUDE_OBSIDIAN_VAULT`, then nearest `.claude-obsidian.json`, then an
     unambiguous vault at or above cwd, else fail closed.
- Primitives absent: 10, task graph. No tickets, board, or dependency plan.
- Loop: startup reads `AGENTS.md`, the skill, the references, then `hot.md`. Per
  turn, one logical knowledge operation is one transaction: read targets and
  record expected SHA-256, let parallel workers return drafts and evidence only,
  merge into one `claude-obsidian.transaction.v1` bundle, inspect, apply once,
  report the operation ID and changed paths. Maintenance: "Run `lint` after
  meaningful operation batches."
- Memory split: per-project is the vault (`wiki/`, `.raw/`, ledgers), and
  per-session is `.vault-meta/` (ignored locks, journals, queues) plus
  `wiki/hot.md` as the deliberately bounded carry-over. No per-user or
  per-machine file found.
- Human gates: egress destinations and request budget, destructive repairs,
  merging research into canonical pages, Git checkpoints, any publish or push,
  and session context injection.
- Evidence of real use: 1,476 forks, 20 open issues, and 12 of the last 100
  commits authored as "Claude". The rest by the owner under three name spellings.
- Generalizes: the transaction bundle with expected hashes and an approval hash
  bound to a resolved root. The separation of ledgers (evidence identity) from
  prose (pages). The rule that "parallel workers never apply bundles or edit
  shared pages". The `configured` versus `verified` capability distinction.
- Idiosyncratic: LYT/PARA/Zettelkasten routing modes that change where new pages
  land without migrating old ones. The release-artifact rule that a public
  default branch must be built from a distribution-clean artifact.
- Sources:
  - AGENTS.md, https://raw.githubusercontent.com/AgriciDaniel/claude-obsidian/32ac5a02c4e082e4a5628ca810776375e134708e/AGENTS.md (2026-09-13)
  - WIKI.md, https://raw.githubusercontent.com/AgriciDaniel/claude-obsidian/32ac5a02c4e082e4a5628ca810776375e134708e/WIKI.md (2026-09-13)
  - skills/wiki-ingest/SKILL.md, https://raw.githubusercontent.com/AgriciDaniel/claude-obsidian/32ac5a02c4e082e4a5628ca810776375e134708e/skills/wiki-ingest/SKILL.md (2026-09-13)
  - .cursor/rules/claude-obsidian.mdc, https://raw.githubusercontent.com/AgriciDaniel/claude-obsidian/32ac5a02c4e082e4a5628ca810776375e134708e/.cursor/rules/claude-obsidian.mdc (2026-09-13)
  - examples/sample-vault/wiki/index.md and wiki/log.md, same SHA (2026-09-13)

---

### eugeniughelbur/obsidian-second-brain

- URL https://github.com/eugeniughelbur/obsidian-second-brain, 4,438 stars, last
  push 2026-09-06T20:40:00Z, MIT, SHA
  `d631fd67aea0afe2b1e44fa5496bc04629348456`
- Purpose: a platform-neutral command library that installs into seven agent
  CLIs and writes notes into a user's Obsidian vault under one note spec.
- Entry files: the repo's own `CLAUDE.md` governs work on the source. The vault
  loads `_CLAUDE.md`, "Loaded by Claude Code on every session that touches it",
  whose Section 0 points at `references/ai-first-rules.md`. `AI-FIRST.md` is the
  standalone, copy-pasteable version of that spec.
- Layout, top two levels, trimmed:

```
CLAUDE.md  AI-FIRST.md  SKILL.md  architecture.md  README.md  install.sh
commands/<47 *.md>
references/{ai-first-rules.md,folder-map.md,freshness-policy.md,vault-schema.md,
            write-rules.md,claude-md-template.md,bases/*.base.template}
adapters/{claude-code,codex-cli,gemini-cli,opencode,hermes,pi,agent-skills,
          grok-bot}/adapter.sh
hooks/{hooks.json,load_vault_context.py,obsidian-recall.py,obsidian-bg-agent.sh,
       validate-ai-first.sh}
scripts/{bootstrap_vault.py,vault_health.py,heal_links.py,freshness_lint.py,
         link_graph.py,merge_notes.py,export_okf.py,eval/}
examples/sample-vault/{_CLAUDE.md,Daily/,Projects/,people/,Ideas/,wiki/logs/}
integrations/{obsidian-mcp-server,obsidian-plugin,telegram-journal}
```

- Primitives present:
  1. Law: repo `CLAUDE.md`. Vault `_CLAUDE.md`. `AI-FIRST.md` as a portable
     spec. `references/ai-first-rules.md` called "the canonical vault-write spec
     and is non-negotiable".
  3. Index/map: `_CLAUDE.md` Sections 2 to 4 (folder structure, active projects,
     key relationships) plus `references/folder-map.md`, which resolves note
     type to folder and forbids hardcoding folder names in a command.
  4. Capture inbox: `raw/` with `articles`, `transcripts`, `pdfs`, `videos`
     subfolders per the folder map. `/obsidian-capture`, `/obsidian-ingest`.
  5. Durable memory: `people/`, `Projects/`, `Knowledge/`, each note carrying
     `ai-first: true` frontmatter and a `## For future agent` preamble.
  6. Dated log: `Daily/YYYY-MM-DD.md` and `wiki/logs/`.
  7. Records: `Decisions/` or `wiki/decisions/`, with Obsidian-style vaults
     using an `ADR-YYYY-MM-DD - Title.md` prefix inside `Knowledge/`.
  8. Skills: 47 command files under `commands/`, one `.md` each, plus `SKILL.md`.
  9. Roles: scheduled background agents via `hooks/obsidian-bg-agent.sh` and
     `hooks/obsidian-bg-agent.hook.yaml`.
  10. Task graph: `Boards/` kanban per project, `/obsidian-task`,
     `/obsidian-board`, `/obsidian-board-hygiene`.
  12. Evidence: every external claim carries a recency marker
     `(as of 2026-04, example.com/source)`. Source URLs preserved verbatim.
     Confidence values `stated | high | medium | speculation`. Also
     `scripts/eval/{retrieval_eval.py,behavior_eval.py}` and
     `tests/test_smoke.py`.
  15. Maintenance loop: `/obsidian-health`, `/obsidian-reindex`,
     `/obsidian-merge`, `/obsidian-reconcile`, `/obsidian-graduate`,
     `scripts/heal_links.py`, `scripts/freshness_lint.py`, and scheduled agents
     that "maintain the vault while you sleep" (README description).
  16. Tool projections: eight adapters compiling one `commands/` source into
     Claude Code commands, native `SKILL.md` trees, a `GEMINI.md` or `AGENTS.md`
     dispatcher with an auto-generated routing table, and a Pi package.
  17. Multi-project routing: partial. `folder-map.md` rule 1 makes each vault's
     `_CLAUDE.md` authoritative over the defaults.
- Primitives absent or partial: 2, no single state surface file (`/obsidian-
  catchup` and `Boards/` carry that job), 11, no handoff or claim ledger, 13, no
  named vault-side approval gate, only repo-side PR rules. 14, boundary is thin
  (`dist/` gitignored, `.env.example`).
- Loop: startup loads vault context through `hooks/load_vault_context.py` and
  `hooks/obsidian-recall.py`. Per turn, every vault write must pass
  `hooks/validate-ai-first.sh`, whose check 5 rejects em dashes, en dashes,
  smart quotes, and Unicode math substitutions. Maintenance runs on a schedule
  through the background-agent hook.
- Memory split: per-user identity, hours, and time zone in `_CLAUDE.md` Section
  1. Per-project in `Projects/<name>.md`. Per-session in `wiki/logs/` and
  `Daily/`. No per-machine file found.
- Human gates: none stated for vault writes. Repo side: contributors open a PR,
  the maintainer may push to `main` directly.
- Evidence of real use: 557 forks, 16 open issues, a sample vault with dated
  fictional content (2026-04-27), 53 owner commits and 20 by a second
  contributor in the last 100.
- Generalizes: the AI-first note spec is the cleanest statement in this slice of
  why notes must be self-contained, and its `## For future agent` header is
  defended on greppability rather than taste. The folder-map indirection (never
  hardcode a folder, resolve it from the vault's own law file) is reusable
  anywhere commands are shared across differently shaped workspaces.
- Idiosyncratic: the eight-way adapter build with a parity test. The banned-
  Unicode check enforced on vault writes.
- Sources:
  - CLAUDE.md, https://raw.githubusercontent.com/eugeniughelbur/obsidian-second-brain/d631fd67aea0afe2b1e44fa5496bc04629348456/CLAUDE.md (2026-09-13)
  - AI-FIRST.md, .../AI-FIRST.md (2026-09-13)
  - examples/sample-vault/_CLAUDE.md, .../examples/sample-vault/_CLAUDE.md (2026-09-13)
  - references/folder-map.md, .../references/folder-map.md (2026-09-13)

---

### Astro-Han/karpathy-llm-wiki

- URL https://github.com/Astro-Han/karpathy-llm-wiki, 2,225 stars, last push
  2026-07-23T16:57:44Z, MIT, SHA `eafcc77001e496cc43499e4923b663aec722c813`
- Purpose: a single Agent Skill that implements the gist literally, with a
  grounding invariant and a Python evidence checker.
- Entry files: `SKILL.md` is the whole law and names itself "the Schema layer".
  It routes to `references/{raw,article,archive,index}-template.md` only when the
  exact format is needed.
- Layout, top two levels, trimmed:

```
SKILL.md  README.md  LICENSE
references/{raw-template.md,article-template.md,archive-template.md,
            index-template.md}
scripts/check_evidence.py   tests/test_check_evidence.py
examples/{ai-coding-tools-index.md,claude-code-statusline-landscape.md,
          log-sample.md,README.md}
```

  The user's workspace is `raw/<topic>/` and `wiki/<topic>/<article>.md`, one
  level of topic subdirectory only, plus `wiki/index.md` and `wiki/log.md`.
- Primitives present:
  1. Law: `SKILL.md`.
  3. Index: `wiki/index.md`, "One row per article, grouped by topic, with link +
     summary + Updated date".
  5. Durable memory: `wiki/<topic>/` articles.
  6. Dated log: `wiki/log.md`, append-only, format
     `## [YYYY-MM-DD] ingest | <primary article title>` with `- Disposition:`,
     `- Raw:`, and optional `- Updated:` lines.
  7. Records: `Status: Disputed` and `Status: Outdated` blocks written into
     articles rather than rewriting history. Archive pages as point-in-time
     snapshots that are never cascade-updated.
  8. Skills: the skill itself, with four templates in `references/`.
  12. Evidence: the Grounding Invariant. "Every load-bearing fact in wiki/ -
     numbers, dates, direct quotes - exists verbatim in the raw/ files linked by
     that article's Raw field." Compile establishes it by locate-before-write.
     `scripts/check_evidence.py` verifies it by grepping high-signal literals in
     the linked raws. `tests/test_check_evidence.py` tests the checker.
  13. Gates: lint is split into three authority levels. Safe Fixes are applied
     automatically (index sync, internal links, Raw references, See Also).
     Mechanical Reports and Judgment Reports are reported and never auto-fixed.
     Archiving a query answer happens only "When the user explicitly asks".
  14. Boundary: `raw/` immutable. The invariant is justified by it: "Because
     raw/ is immutable, a verified article stays verified".
  15. Maintenance loop: Lint, plus Cascade Updates after every ingest, which
     search the full wiki for the source's key entities and aliases rather than
     trusting the index.
  16. Tool projections: partial. The repo description claims Claude Code, Cursor,
     and Codex compatibility through the Agent Skills format. No per-tool
     directories exist.
- Primitives absent: 2 state surface, 4 a distinct inbox (sources are filed into
  `raw/<topic>/` immediately, no staging area), 9 roles, 10 task graph, 11
  handoff, 17 multi-project routing.
- Loop: startup is lazy. Initialization "Triggers only on the first Ingest" and
  creates only what is missing. Query and Lint refuse to auto-create and tell the
  user to run an ingest first. Ingest is Fetch, then Triage (New, Update,
  Disputed, or No material), then Compile, then Cascade, then Post-Ingest
  (`index.md` and `log.md`). A No-material ingest keeps the raw file, writes only
  the log line `## [YYYY-MM-DD] ingest | no material: <path>`, and stops. Lint
  appends `## [YYYY-MM-DD] lint | <N> issues found, <M> auto-fixed`.
- Memory split: per-project only. Nothing per-user, per-machine, or
  per-session. The wiki is the only durable store.
- Human gates: archiving a query answer. Every Judgment Report and Mechanical
  Report finding. Any link fix with zero or multiple candidate targets.
- Evidence of real use: 261 forks, 4 open issues, 28 commits all by one author,
  and four committed example outputs including a dated
  `2026-03-19-claude-code-statusline-landscape.md`.
- Generalizes: the Grounding Invariant plus a cheap deterministic re-checker is
  the strongest verification idea in the slice, and it works because the source
  layer is immutable. The three-tier lint authority (auto-fix, mechanical report,
  judgment report) is directly portable. So is the explicit "No material"
  disposition, which gives the agent permission to not write.
- Idiosyncratic: the single-level topic directory cap. The rule that a value must
  be written exactly as found ("if the source says 42K, write 42K, not 42,000").
- Sources:
  - SKILL.md, https://raw.githubusercontent.com/Astro-Han/karpathy-llm-wiki/eafcc77001e496cc43499e4923b663aec722c813/SKILL.md (2026-09-13)
  - references/index-template.md and references/raw-template.md, same SHA (2026-09-13)

---

### ballred/obsidian-claude-pkm

- URL https://github.com/ballred/obsidian-claude-pkm, 1,861 stars, last push
  2026-02-18T02:01:08Z, MIT, SHA `ef1e4da2f30789334aa08c756f66913570f937a5`
- Purpose: a GTD-flavored productivity vault template where Claude runs daily,
  weekly, and monthly review routines against a goal cascade.
- Entry files: `vault-template/CLAUDE.md`, which ends by pointing at
  `@.claude/rules/` and references `@Goals/2. Monthly Goals.md` inline for
  current focus. A `session-init.sh` SessionStart hook runs before that.
- Layout, top two levels, trimmed:

```
README.md  docs/{SETUP_GUIDE,CUSTOMIZATION,WORKFLOW_EXAMPLES,TROUBLESHOOTING}.md
scripts/{setup.sh,setup.bat,customize.sh}   github-actions/claude.yml
vault-template/
  CLAUDE.md  CLAUDE.local.md.template  FIRST_RUN
  Daily Notes/  Goals/  Projects/  Templates/  Archives/
  .claude/agents/{note-organizer,weekly-reviewer,goal-aligner,inbox-processor}.md
  .claude/skills/<13>/SKILL.md
  .claude/rules/{markdown-standards,productivity-workflow,project-management,
                 task-tracking}.md
  .claude/hooks/{session-init.sh,auto-commit.sh,skill-discovery.sh}
  .claude/{settings.json,output-styles/coach.md,scripts/statusline.sh}
```

- Primitives present:
  1. Law: `vault-template/CLAUDE.md` plus four files under `.claude/rules/`.
  2. State surface: partial. "Current Focus" in `CLAUDE.md` is a pointer to
     `Goals/2. Monthly Goals.md`, and today's daily note carries ONE Big Thing.
  3. Index: partial. `CLAUDE.md` holds three routing tables (directory purpose,
     skills, agents) but there is no separate index file.
  4. Capture inbox: `Inbox/` (marked optional), plus the `#inbox` tag, plus
     "Uncategorized notes in root directory", all three enumerated as inbox
     sources by `inbox-processor.md`.
  5. Durable memory: `Goals/` cascade, `Projects/` each with its own `CLAUDE.md`,
     and the uncommitted `CLAUDE.local.md`.
  6. Dated log: `Daily Notes/YYYY-MM-DD.md`.
  8. Skills: 13 under `.claude/skills/<name>/SKILL.md`.
  9. Roles: four subagents with frontmatter declaring `tools:`, `model:`, and
     `memory: project`.
  10. Task graph: the Cascade, "3-Year Vision -> Yearly Goals -> Projects ->
     Monthly Goals -> Weekly Review -> Daily Tasks", each arrow annotated with
     the skill that operates it.
  14. Boundary: `CLAUDE.local.md.template` exists so personal mission, schedule,
     and private goals stay out of the committed `CLAUDE.md`.
  15. Maintenance loop: `/review` as a smart router that auto-detects daily,
     weekly, or monthly, plus the `check-links` skill, the `note-organizer`
     agent, and `.claude/hooks/auto-commit.sh`.
  17. Multi-project routing: each folder under `Projects/` carries its own
     `CLAUDE.md`.
- Primitives absent: 7 decision records, 11 handoff, 12 evidence or receipts, 13
  named gates. Nothing in this repo verifies that a routine actually ran.
- Loop: startup is a real script. `session-init.sh` exports `VAULT_PATH`,
  `TODAY`, `YESTERDAY`, `CURRENT_WEEK`, and `DAILY_NOTE`, detects a `FIRST_RUN`
  marker file and prints the onboarding banner, then warns if no `CLAUDE.md` is
  found at the vault root. Per turn, skills use session task tools for progress.
  Cadence is explicit and time-boxed: morning 5 min, evening 5 min, weekly 30 min
  on Sunday, monthly 30 min at month end.
- Memory split: per-user private context in `CLAUDE.local.md` (gitignored),
  per-project in `Projects/<name>/CLAUDE.md`, shared in `CLAUDE.md`, and
  per-session in the daily note. A `<claude-mem-context>` block at the end of
  `CLAUDE.md` is marked auto-generated by a third-party tool.
- Human gates: none named. `/push` is user-invoked, and the auto-commit hook
  runs on lifecycle events.
- Evidence of real use: 124 forks, 11 open issues, 16 owner commits in the last
  100 plus two outside contributors. `CLAUDE.md` carries "Last Updated:
  2026-02-15, System Version: 3.1".
- Generalizes: the goal cascade as a dependency chain where each level names the
  skill that maintains it. The split of committed law from an uncommitted
  personal overlay. A first-run marker file that makes onboarding idempotent.
- Idiosyncratic: the GTD two-minute rule encoded as a flowchart inside an agent
  definition. An output style named `coach` that changes the agent's posture
  rather than its capabilities.
- Sources:
  - vault-template/CLAUDE.md, https://raw.githubusercontent.com/ballred/obsidian-claude-pkm/ef1e4da2f30789334aa08c756f66913570f937a5/vault-template/CLAUDE.md (2026-09-13)
  - vault-template/.claude/agents/inbox-processor.md, same SHA (2026-09-13)
  - vault-template/.claude/hooks/session-init.sh, same SHA (2026-09-13)
  - vault-template/CLAUDE.local.md.template, same SHA (2026-09-13)

---

### ArtemXTech/personal-os-skills

- URL https://github.com/ArtemXTech/personal-os-skills, 534 stars, last push
  2026-04-05T21:02:29Z, MIT, SHA `0c0cf5a0271a9a51031bfaddd84a89e9d7378dbb`
- Purpose: a published marketplace of six Claude Code skills that pull outside
  material (Granola meetings, NotebookLM sources, Wispr Flow dictation, past
  Claude sessions) into an Obsidian vault. It is a skill package, not a workspace
  people work inside. The record below is shortened accordingly.
- Entry files: `CLAUDE.md`, which governs how to publish a skill into this repo,
  not how to operate a vault.
- Layout, top two levels, trimmed:

```
CLAUDE.md  README.md  .claude-plugin/marketplace.json
docs/{memory-skills-readme.md,memory-skills-setup.md,tasknotes/}
skills/{granola,notebooklm,notebooklm-import,recall,sync-claude-sessions,
        tasknotes}/SKILL.md  (+ scripts/, templates/, workflows/)
```

- Primitives present: 1 law (`CLAUDE.md`), 8 skills (six `SKILL.md` trees with
  `scripts/`, `templates/`, and `workflows/` subfolders), 6 a dated log read
  rather than written (`recall` scans "native Claude Code JSONL files by date"),
  16 tool projection (`.claude-plugin/marketplace.json`).
- Primitives absent: 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 17. This repo
  carries no vault, so it defines no vault shape.
- Loop: the `recall` skill is the interesting part. It has three modes,
  temporal (date expressions against session JSONL), topic (BM25 through `qmd`),
  and graph (an HTML graph of sessions as nodes connected to the files they
  touched), and every run ends with "the One Thing - a concrete, highest-leverage
  next action synthesized from the results".
- Memory split: per-session, taken from Claude Code's own transcript store and
  optionally indexed into `qmd` by a SessionEnd hook.
- Human gates: none found.
- Evidence of real use: 91 forks, 10 open issues, 16 commits all by the owner.
- Generalizes: treating the harness's own session transcripts as an ingestible
  source, and ending a recall with one prescribed next action rather than a list.
- Idiosyncratic: bindings to three specific commercial capture apps.
- Sources:
  - CLAUDE.md, https://raw.githubusercontent.com/ArtemXTech/personal-os-skills/0c0cf5a0271a9a51031bfaddd84a89e9d7378dbb/CLAUDE.md (2026-09-13)
  - skills/recall/SKILL.md, same SHA (2026-09-13)

---

### Roasbeef/obsidian-claude-code

Skipped. This is an Obsidian plugin (`manifest.json`, `src/main.ts`, `src/views/`,
esbuild config) that embeds the Claude Agent SDK inside the Obsidian app, not a
workspace people file notes into. It ships a `CLAUDE.md` about building the
plugin and one `skills/vault-search`. 216 stars, last push 2026-01-28, no
license field. Tree read at `main` on 2026-09-13.

---

### songzhuozhu/obsidian-llm-wiki

- URL https://github.com/songzhuozhu/obsidian-llm-wiki, 121 stars, last push
  2026-04-19T11:25:35Z, MIT, SHA `f9ddf3c11533d1aaaa7fb3577f37481ad79560d6`
- Purpose: a bilingual pair of wiki workspaces with a four-step ingest that
  parks sources in `pending_review` until a human approves, then archives them.
- Entry files: `inspool-wiki-en/AGENTS.md`, which calls itself "the single
  authoritative rule entry point for the `inspool-wiki-en/` workspace".
  `CLAUDE.md` sits beside it. Every command file starts by re-reading
  `AGENTS.md`.
- Layout, top two levels, trimmed:

```
.claude/{commands/{inspool,ingest_raw,approve_ingest,query_wiki,lint_wiki}.md,
         skills/{defuddle,json-canvas,obsidian-bases,obsidian-cli,
                 obsidian-markdown}/SKILL.md}
.claude-en/  (same tree, English)
.codex/ and .codex-en/  (same commands re-emitted as skills/<name>/SKILL.md)
inspool-wiki-en/{AGENTS.md,CLAUDE.md,raw/,wiki/}
inspool-wiki-zh/{AGENTS.md,CLAUDE.md,raw/,wiki/}
README.md  README.en.md
```

  Inside a workspace: `raw/unprocessed/`, `raw/processed/`, `raw/assets/`,
  `raw/index.md`. `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`,
  `wiki/synthesis/`, `wiki/meta/`, `wiki/index.md`, `wiki/log.md`.
- Primitives present:
  1. Law: `inspool-wiki-en/AGENTS.md` and its zh twin.
  2. State surface: partial. `raw/index.md` is "a processing-state index", a
     queue view rather than a focus view.
  3. Index: `wiki/index.md`, explicitly "a directory view, not a normal content
     page", kept separate from the workflow queue in `raw/index.md`.
  4. Capture inbox: `raw/unprocessed/`, drained into `raw/processed/` only after
     approval.
  5. Durable memory: `wiki/entities/`, `wiki/concepts/`, `wiki/synthesis/`,
     `wiki/meta/`.
  6. Dated log: `wiki/log.md`, `## [YYYY-MM-DD] action | title` with actions
     `init`, `ingest`, `approve`, `query`, `lint`, `refactor`.
  7. Records: `wiki/synthesis/` pages carry sections "Summary of Conclusions",
     "Conflicts and Disagreements", "Current Judgment", "Open Questions".
  8. Skills: five commands mirrored into four tool directories.
  11. Handoff and claim state: raw frontmatter carries `processing_status`
     (`unprocessed | pending_review | processed`), `reviewed_at`, `processed_at`,
     `processed_into`, and `ingest_group`. This is the closest thing in the slice
     to a work ledger, and it lives in the source files themselves.
  12. Evidence: "Pages under `wiki/sources/` are evidence nodes in the graph",
     knowledge pages link to local source pages rather than external URLs, and
     frontmatter carries `supports` and `contradicts`.
  13. Gates: approval is a first-class operation. "Do not move raw files into
     `processed/` during ingest. The move from `unprocessed/` to `processed/`
     must wait for user approval." Step 10 of approve runs a localized self-check
     for stale `raw/unprocessed/...` strings and, if it fails, "do not treat the
     approval as complete".
  14. Boundary: `raw/` bodies are read-only. Only path moves and a small set of
     workflow frontmatter fields may change. "Agents must not use them as an
     excuse to tamper with the source body."
  15. Maintenance loop: a 14-item lint list, including checks that `raw/index.md`
     matches disk, that nothing sat in `pending_review` too long, and that
     related raw notes were not split across ingest units.
  16. Tool projections: `.claude/`, `.claude-en/`, `.codex/`, `.codex-en/`.
  17. Multi-project routing: two sibling workspaces, each with its own law file,
     the language preference declared per workspace.
- Primitives absent: 9 roles, 10 task graph.
- Loop: per turn, Ingest runs eleven numbered steps ending in "Tell the user
  clearly that ingest completed and approval is now required", with the ordering
  constraint that raw files may be marked `pending_review` only after the wiki,
  log, and raw index updates all succeed. Approve runs twelve steps. Query reads
  the index first and writes back into `wiki/synthesis/` only "when the user
  agrees". Lint is periodic, result written to `wiki/log.md`.
- Memory split: per-project, one workspace per language. No per-user or
  per-session file.
- Human gates: the approve step. Writing a query answer back into the wiki. Any
  reorganization of user-created classification subfolders.
- Evidence of real use: 25 forks, 0 open issues, 6 commits. Committed `raw/` and
  `wiki/` directories exist in both workspaces. This is the smallest project in
  the slice by activity.
- Generalizes: the two-phase ingest with an explicit `pending_review` state
  stored in the source file's own frontmatter. The rule that a directory
  transition is a workflow state, not a semantic path, so every reference to it
  must be repaired when it moves. The ingest-unit selection rules (subfolder,
  then `ingest_group`, then user instruction, then one file) with a 2 to 5 file
  batch recommendation.
- Idiosyncratic: the parallel English and Chinese workspaces. The rule that
  user-created subfolders under `concepts/`, `entities/`, and `synthesis/` are an
  organizational layer the agent must tolerate but never reorganize.
- Sources:
  - inspool-wiki-en/AGENTS.md, https://raw.githubusercontent.com/songzhuozhu/obsidian-llm-wiki/f9ddf3c11533d1aaaa7fb3577f37481ad79560d6/inspool-wiki-en/AGENTS.md (2026-09-13)
  - .claude-en/commands/approve_ingest.md, same SHA (2026-09-13)
  - .claude-en/commands/ingest_raw.md, same SHA (2026-09-13)

---

### kmikeym/obsidian-claude-starter

- URL https://github.com/kmikeym/obsidian-claude-starter, 79 stars, last push
  2025-10-09T05:23:56Z, MIT, SHA `03f450115a58a1f04c04770656f4f34a5f81d85a`
- Purpose: a small starter vault where Claude works against two hand-written
  thinking frameworks rather than any ingest pipeline.
- Entry files: `Template/CLAUDE.md`. `Home.md` tells a new user to read
  `README`, fill `Mission`, then review `SKIF` and `Priority Stack Protocol`.
- Layout, top two levels, trimmed:

```
README.md  LICENSE
Template/CLAUDE.md  Template/README.md  Template/OBSIDIAN-SETUP.md
Template/0.Map of Contents/Home.md
Template/1.Daily Notes/{_Daily Note Template.md,_Example Daily Note.md}
Template/2.Frameworks/{SKIF.md,Priority Stack Protocol.md,High Agency.md,
                       Mission.md,_Framework Template.md}
Template/.obsidian/
```

- Primitives present:
  1. Law: `Template/CLAUDE.md`, a preferences file ("Be direct and concise",
     "Challenge my assumptions"), not a workflow contract.
  2. State surface: the "Current Focus" section of `Home.md`.
  3. Index: `0.Map of Contents/Home.md`, the numbered-folder MOC pattern.
  5. Durable memory: `Mission.md`, which `CLAUDE.md` points at for goals.
  6. Dated log: `1.Daily Notes/` with a template and a worked example.
  8. Procedures: `2.Frameworks/` holds SKIF and the Priority Stack Protocol as
     prose frameworks. There is no `SKILL.md` and no slash command.
  10. Task graph: partial. The Priority Stack Protocol is a seven-level
     prioritization scheme, not a dependency graph.
- Primitives absent: 4, 7, 9, 11, 12, 13, 14, 15, 16, 17.
- Loop: none stated. `CLAUDE.md` describes posture ("When Creating Notes", "When
  Analyzing My Notes", "When Using Frameworks") rather than an ordered procedure.
- Memory split: per-user only, in `Mission.md` and `CLAUDE.md`.
- Human gates: none.
- Evidence of real use: 15 forks, 0 open issues, 3 commits, last push October
  2025. The template still contains its own instruction callouts and placeholder
  entries such as `[[Project Name 1]]`, so no committed evidence of operation.
- Generalizes: numbered top-level folders that force a reading order, and a
  single Home dashboard that names the onboarding sequence.
- Idiosyncratic: SKIF and the Priority Stack Protocol are this author's personal
  frameworks and carry no meaning elsewhere.
- Sources:
  - Template/CLAUDE.md, https://raw.githubusercontent.com/kmikeym/obsidian-claude-starter/03f450115a58a1f04c04770656f4f34a5f81d85a/Template/CLAUDE.md (2026-09-13)
  - Template/0.Map of Contents/Home.md, same SHA (2026-09-13)

---

### pbeens/obsidian-agents.md

- URL https://github.com/pbeens/obsidian-agents.md, 20 stars, last push
  2026-05-01T19:34:58Z, MIT, SHA `1501ab0f64579fbbb95f7c5777193c5be75795ec`
- Purpose: one person's working `AGENTS.md` for a real Obsidian vault, published
  with the six local skills and four Python scripts it calls.
- Entry files stated: "Read `AGENTS.md` first, then `tasks.md` when active work
  is being tracked." A tip at the top adds: "If `AGENTS2.md` exists in the root,
  read it for additional local maintenance and privacy rules."
- Layout, top two levels, trimmed:

```
AGENTS.md  README.md
scripts/{append_daily_clippings.py,copy_clean_source_to_clipboard.py,
         refresh_all_tags.py,repair_mojibake.py}
skills/{all-tags-maintenance,archive-by-created-date,
        entity-people-projects-tasks,meeting-transcript-summary,
        morning-update,web-page-to-raw}/SKILL.md
```

  The vault it describes but does not ship: `tasks.md`, `_raw/`, `_transcripts/`,
  `people/`, `people/_new/`, `projects/`, `Topic Pages/`, `Bases/`,
  `Daily Notes/`, `Clippings/`, `ALL-TAGS.txt`, `All Tasks.md`.
- Primitives present:
  1. Law: `AGENTS.md`, tool-neutral, with an explicit "Keep `AGENTS.md` concise
     and durable. Do not turn `AGENTS.md` into a session log or changelog."
  2. State surface: `tasks.md`, "active work, blockers, and handoff notes".
  3. Index: the Folder Map section of `AGENTS.md`, plus a standing rule that a
     folder with multiple documents and no index gets a minimal `README.md`, and
     that creating or moving a document updates the nearest index in the same
     change.
  4. Capture inbox: `_raw/` for clips, `_transcripts/` for `.srt` and `.txt`
     recordings, both explicitly transient.
  5. Durable memory: `people/`, `projects/`, and `ALL-TAGS.txt` as the controlled
     tag vocabulary ("consult `ALL-TAGS.txt` first and reuse an existing tag").
  6. Dated log: `Daily Notes/`, with a precise definition, "a note whose filename
     is only a date", and a warning not to treat dated-plus-words filenames as
     daily notes.
  8. Skills: six `skills/<name>/SKILL.md` plus four scripts, with a rule for when
     to create each ("When a workflow repeats or is likely to repeat, propose a
     new skill... When a workflow needs deterministic cleanup, linking,
     conversion, or validation, propose a script").
  10. Task graph: partial. `tasks.md` plus `All Tasks.md` plus `Bases/` views.
  11. Handoff: `tasks.md` explicitly holds handoff notes, and "Mark completed
     items before ending a session."
  13. Gates: "Ask before major structural changes, mass renames, or folder
     moves". New people pages land in `people/_new/` "for manual review".
     `archive-by-created-date` moves happen "after confirming the plan".
  14. Boundary: `AGENTS2.md` is named as the place for local maintenance and
     privacy rules and is deliberately not in the repo.
  15. Maintenance loop: `all-tags-maintenance` rebuilds `ALL-TAGS.txt`,
     `archive-by-created-date` moves notes into `YYYY/MM/`,
     `scripts/repair_mojibake.py` is quarantined to its own explicit task.
- Primitives absent: 7 decision records, 9 roles, 12 evidence, 16 tool
  projections (the file is tool-neutral by design), 17 multi-project routing.
- Loop: startup is `AGENTS.md` then `tasks.md`. Ingest is a named chain: "Run
  `vault-ingest` on `_raw/`" followed by `entity-people-projects-tasks`, with
  delta tracking through a `.manifest.json`, then promotion into `Clippings/` or
  `Topic Pages/`, then a numbered pointer appended at the bottom of the relevant
  daily note under `## Stuff to Process`, which the file marks "required... not
  optional". Session end is marking completed items in `tasks.md`.
- Memory split: per-project is the vault. Per-session is `tasks.md`. Private and
  machine-local rules are pushed into the unshipped `AGENTS2.md`.
- Human gates: structural changes, mass renames, folder moves, archival plans,
  and every new person page (staged in `people/_new/`).
- Evidence of real use: 3 forks, 0 open issues, 6 commits by the owner. The rules
  read as scar tissue: preserve `- [ ]` and `- [x]` verbatim, do not rewrite done
  dates or recurrence icons, do not round-trip a daily note through terminal text
  output, preserve inline hashtags when copying task rollups, copy task wording
  exactly rather than paraphrasing. Each of those is a bug someone hit.
- Generalizes: append-only transcript processing ("append the summary block...
  Do not rewrite other lines"). A controlled tag vocabulary consulted before any
  new tag. Staging new entity pages in a `_new/` folder for review. The rule that
  a repeated workflow becomes a skill and a deterministic one becomes a script.
- Idiosyncratic: the mojibake repair script, and the instruction to skip
  secondary people on social-media threads.
- Sources:
  - AGENTS.md, https://raw.githubusercontent.com/pbeens/obsidian-agents.md/1501ab0f64579fbbb95f7c5777193c5be75795ec/AGENTS.md (2026-09-13)
  - skills/ tree listing at the same SHA (2026-09-13)

---

### kepano/kepano-obsidian

- URL https://github.com/kepano/kepano-obsidian, 4,508 stars, last push
  2026-01-09T00:01:53Z, MIT, SHA `473697347a0eaac790a6596229c741b3915f3b77`
- Purpose: a personal Obsidian vault template organized bottom-up by note type.
  It is the pre-agent baseline for this slice.
- Entry files: none for an agent. A full tree scan at this SHA found no
  `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, or `.cursor/`. The only
  root Markdown file is `Readme.md`, addressed to a human: "Take the parts you
  like and tailor them to your needs."
- Layout, top two levels, trimmed:

```
Readme.md  .obsidian/{app,core-plugins,daily-notes,templates,types,zk-prefixer}.json
Categories/<22 .md>     # Albums, Books, Clippings, People, Projects, Recipes, ...
Templates/<~40 Template.md + Bases/>
Notes/  References/  Clippings/  Daily/  Attachments/
```

- Primitives present:
  3. Index: `Categories/` is a type-level index, one page per note type, that
     routes to everything else.
  4. Capture inbox: `Clippings/` holds web captures as a distinct layer from
     `Notes/` and `References/`.
  5. Durable memory: `References/` (one page per person, place, work, thing) and
     `Notes/` (evergreen).
  6. Dated log: `Daily/YYYY-MM-DD.md`.
  8. Procedures: `Templates/` holds roughly forty per-type note templates plus
     `Templates/Bases/`. These are output shapes, not instructions to an agent.
- Primitives absent: 1, 2, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17. Nothing here
  addresses an agent at all.
- Loop: none. Templates are applied by the human through Obsidian's template
  plugin.
- Memory split: per-user only.
- Human gates: not applicable.
- Evidence of real use: 364 forks, 6 open issues, 87 owner commits, and real
  dated content (`Daily/2023-09-12.md`, `Notes/2023 Japan Trip.md`).
- Generalizes: the type-per-template and type-per-category discipline. Several
  repos in this slice reimplement it as `wiki/sources|entities|concepts` with a
  `type:` frontmatter field.
- Idiosyncratic: categories tuned to one person's interests (board games, jazz,
  recipes).
- Sources:
  - Readme.md, https://raw.githubusercontent.com/kepano/kepano-obsidian/473697347a0eaac790a6596229c741b3915f3b77/Readme.md (2026-09-13)
  - Full recursive tree at the same SHA, filtered for agent instruction files (2026-09-13)

---

### SamurAIGPT/llm-wiki-agent

Added from GitHub topic `second-brain`. 3,516 stars, pushed 2026-09-08, carries
`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`.

- URL https://github.com/SamurAIGPT/llm-wiki-agent, 3,516 stars, last push
  2026-09-08T10:00:26Z, MIT, SHA `5c5e056435b317f0fa9bef327ae86a76b2a3073a`
- Purpose: a runnable wiki repo where the agent instruction file is the whole
  schema and a few Python tools handle the deterministic checks.
- Entry files: `AGENTS.md`, subtitled "Schema & Workflow Instructions".
  `CLAUDE.md` and `GEMINI.md` sit beside it for other runtimes.
- Layout, top two levels, trimmed:

```
AGENTS.md  CLAUDE.md  GEMINI.md  README.md  pyproject.toml  requirements.txt
.claude/commands/{wiki-ingest,wiki-query,wiki-lint,wiki-graph}.md
raw/.gitkeep
wiki/{index.md,log.md,overview.md}   # sources/, entities/, concepts/, syntheses/
graph/.gitkeep
tools/{ingest.py,query.py,lint.py,health.py,heal.py,refresh.py,build_graph.py,
       pdf2md.py,file_to_md.py}
docs/automated-sync.md   examples/cjk-showcase/raw/2026-04-13-reflection.md
```

- Primitives present:
  1. Law: `AGENTS.md`, mirrored to `CLAUDE.md` and `GEMINI.md`.
  2. State surface: partial. `wiki/overview.md`, "living synthesis across all
     sources", updated on every ingest when warranted.
  3. Index: `wiki/index.md`, with an exact format block (Overview, Sources,
     Entities, Concepts, Syntheses) and a placeholder header committed.
  4. Capture inbox: `raw/`, "Immutable source documents - never modify these".
  5. Durable memory: `wiki/entities/` and `wiki/concepts/`, TitleCase filenames.
  6. Dated log: `wiki/log.md`, format `## [YYYY-MM-DD] <operation> | <title>`,
     operations `ingest`, `query`, `health`, `lint`, `graph`, `report`. The
     committed file even ships the parse command,
     `grep "^## \[" wiki/log.md | tail -10`.
  7. Records: `wiki/syntheses/` for saved query answers, plus
     `wiki/lint-report.md`, `wiki/health-report.md`, `graph/graph-report.md`.
  8. Skills: four slash commands under `.claude/commands/`, plus plain-English
     shorthand triggers (`ingest <file>`, `query: <question>`, `health`, `lint`,
     `build graph`).
  12. Evidence: `tools/health.py` runs deterministic, zero-LLM checks for empty
     or stub files, index-to-disk sync, and log coverage ("source pages missing a
     corresponding `ingest` entry in `wiki/log.md`").
  13. Gates: query asks before filing an answer. Lint asks before saving a
     report. Rule HG-WA-01, "Graph layer MUST NOT auto-create pages from broken
     links - report only", justified as "LLM ingest produces hallucinated
     wikilinks; auto-creating amplifies noise" (verbatim). The proposed
     auto-link feature has an explicit `draft -> stable` promotion gate.
  14. Boundary: `raw/` immutable, `graph/` generated.
  15. Maintenance loop: an explicit cost-tiered cadence. Health is free, zero LLM
     calls, "Every session, before other work". Lint costs tokens, "Every 10-15
     ingests". "Run `health` first - linting an empty file wastes tokens."
  16. Tool projections: three instruction files plus `.claude/commands/`.
- Primitives absent: 9 roles, 10 task graph, 11 handoff, 17 multi-project
  routing.
- Loop: Ingest is ten ordered steps ending in "Post-ingest validation - check for
  broken `[[wikilinks]]`, verify all new pages are in `index.md`, print a change
  summary". Query is four steps and asks before filing. Health runs first every
  session. Lint periodically. Graph on demand.
- Memory split: per-project only. `wiki/` is durable, `graph/` is rebuildable.
- Human gates: filing a query answer, saving a lint or health report, and page
  creation from broken links (forbidden outright).
- Evidence of real use: 397 forks, 4 open issues, four human contributors plus
  `github-actions[bot]` in the last 100 commits, one committed CJK example
  source dated 2026-04-13. The committed `wiki/index.md` and `wiki/log.md` are
  empty scaffolds, so the shipped repo is a template rather than a populated
  wiki.
- Generalizes: the health-versus-lint split along a cost axis, with a table
  naming scope, LLM calls, cost, frequency, checks, tool, and run order. Log
  coverage as a structural check (every source page must have an ingest log
  entry) turns the log into a verifiable artifact rather than a narrative.
  Naming hallucinated wikilinks as the reason for a no-auto-create rule is the
  most honest failure-mode statement in the slice.
- Idiosyncratic: graph-topology lint checks (god nodes at degree > mu+2sigma,
  fragile bridges, isolated communities, phantom hubs) that need `graph.json`.
- Sources:
  - AGENTS.md, https://raw.githubusercontent.com/SamurAIGPT/llm-wiki-agent/5c5e056435b317f0fa9bef327ae86a76b2a3073a/AGENTS.md (2026-09-13)
  - wiki/index.md and wiki/log.md, same SHA (2026-09-13)

---

### zosmaai/pi-llm-wiki

Added from GitHub topic `second-brain`. 576 stars, pushed 2026-09-12, carries
`AGENTS.md` and a vault-layer `SKILL.md`.

- URL https://github.com/zosmaai/pi-llm-wiki, 576 stars, last push
  2026-09-12T02:33:35Z, MIT, SHA `7c67575b83758ffec4cca9a2d2be45fb1b61c541`
- Purpose: the same pattern implemented as a TypeScript extension for the pi and
  oh-my-pi agent hosts, where immutability is enforced by a hook rather than
  requested in prose.
- Entry files: two laws for two audiences. Root `AGENTS.md` governs work on the
  package. `skills/llm-wiki/SKILL.md` governs the vault and opens "You are a
  disciplined wiki maintainer."
- Layout, top two levels, trimmed:

```
AGENTS.md  CHANGELOG.md  package.json  biome.json  astro.config.mjs
extensions/llm-wiki/{index.ts,lib/{tools,metadata,guardrails,utils,
                                   source-packet,host}.ts}
skills/llm-wiki/{SKILL.md,templates/{INDEX.md,LOG.md,DASHBOARD.md,config.yaml,
                 pages/{source,entity,concept,synthesis,analysis}.md}}
prompts/wiki-*.md            # source of truth, pi reads these
commands/wiki-*.md           # generated mirror, oh-my-pi reads these
mcp/{index.ts,operations.ts,exec.ts,model-lane.ts}
.claude-plugin/{plugin.json,marketplace.json,hooks/hooks.json,.mcp.json}
hosts/codex.config.toml.example   plans/wiki-root-restructure.md   docs/
```

  The vault is one dot-directory, `WIKI_ROOT/.llm-wiki/`, holding `config.json`,
  `templates/`, `raw/sources/SRC-*/`, `raw/trajectories/TRJ-*/`, `wiki/` with
  `sources entities concepts syntheses analyses cases skills`, `meta/` with
  `registry.json backlinks.json index.md log.md events.jsonl qmd/`, plus
  `outputs/` and `.discoveries/`.
- Primitives present:
  1. Law: `AGENTS.md` (package) and `skills/llm-wiki/SKILL.md` (vault), the only
     repo here that separates the two cleanly by file.
  2. State surface: partial. `templates/DASHBOARD.md` and a status line the
     extension injects.
  3. Index: `meta/index.md` human-readable, backed by `meta/registry.json`
     (master page catalog) and `meta/backlinks.json` (inbound link map), both
     auto-rebuilt on `turn_end`.
  4. Capture inbox: `raw/sources/SRC-YYYY-MM-DD-NNN/` packets, each with
     `manifest.json`, `original/`, `extracted.md`, `attachments/`, written only
     through `wiki_capture_source`.
  5. Durable memory: `wiki/entities/`, `wiki/concepts/`, plus `wiki/skills/`
     ("generalizes across many trajectories") and `wiki/cases/` ("one concrete
     past run").
  6. Dated log: `meta/log.md`, generated from `meta/events.jsonl`, which is
     "append-only authoritative activity state".
  7. Records: `wiki/analyses/` for durable query answers, `wiki/syntheses/` for
     cross-cutting analysis, `wiki/cases/` for past runs.
  8. Skills: twelve `wiki-*` prompts, plus distilled `wiki/skills/` pages that
     the wiki itself produces.
  11. Handoff: `raw/trajectories/TRJ-*/packet.json` stores the full tool-call
     sequence of a completed task. "pi's observational-memory keeps prose for
     context-compaction survival - it does not persist the structured tool-call
     sequence." This is session-to-session work memory, distinct from every
     other repo in the slice.
  12. Evidence: `meta/events.jsonl` is the authoritative record and everything
     else under `meta/` is "generated projections". The file is called out for
     backup because "meta/log.md and wiki/log.md cannot reconstruct it".
  13. Gates: partial. Guardrails are enforcement rather than approval. Trajectory
     capture is opt-in and off by default (`/wiki-trajectories on`), and when off
     "the tools are absent entirely - no system-prompt cost".
  14. Boundary: "Guardrails block `.llm-wiki/raw/**` and `.llm-wiki/meta/**`
     edits at the tool_call hook level." The SKILL.md comparison table states the
     shift plainly: blocking raw edits was "Skill says 'don't'" before and is
     "Extension enforces immutability" now.
  15. Maintenance loop: metadata auto-rebuilds on `turn_end` after any
     `wiki/**` edit. `wiki_reindex` rebuilds the QMD search index, and
     `wiki_distill_skills` promotes trajectories into reusable skill pages.
     Also `/wiki-lint`, `/wiki-retro`, `/wiki-status`, `/wiki-digest`.
  16. Tool projections: `prompts/` is the source and `commands/` its generated
     mirror with a parity test. `.claude-plugin/` and `hosts/codex.config.toml.
     example` extend it to other runtimes.
  17. Multi-project routing: `wiki_recall` "searches both your personal wiki
     (`~/.llm-wiki/`) and the project wiki (`.llm-wiki/` in the current
     directory), merging results".
- Primitives absent: 9 roles, 10 task graph.
- Loop: "Call `wiki_recall` at the START of every task". Per turn the extension
  rebuilds metadata on `turn_end`. "Call `wiki_retro` at task end to save new
  insights". Three memory tools are separated by what they store:
  `wiki_capture_trajectory` (replayable tool-call packet),
  `wiki_retro` (durable prose insight), `wiki_observe` (timestamped running
  note).
- Memory split: per-user `~/.llm-wiki/`, per-project `<cwd>/.llm-wiki/`, merged
  at recall. Per-session is `meta/events.jsonl` plus trajectory packets. No
  per-machine store, and the SKILL.md warns "Do not place secrets or private
  machine paths in manual event details".
- Human gates: the trajectories toggle. Everything else is enforced by hook
  rather than approved by a person.
- Evidence of real use: 43 forks, 3 open issues, 67 owner commits plus
  dependabot and GitHub Actions traffic, a CHANGELOG, and a design doc at
  `plans/wiki-root-restructure.md`.
- Generalizes: moving "never edit raw" from prose into a `tool_call` hook that
  cannot be talked out of. Declaring one file authoritative and everything else a
  rebuildable projection. Separating a replayable tool-call packet from a prose
  insight so that skill distillation is possible at all. Making an
  experimental memory feature opt-in specifically to avoid system-prompt cost.
- Idiosyncratic: the pi and oh-my-pi dual-host build. Open Knowledge Format
  v0.2. The QMD SQLite index with its don't-edit-the-WAL caveat.
- Sources:
  - AGENTS.md, https://raw.githubusercontent.com/zosmaai/pi-llm-wiki/7c67575b83758ffec4cca9a2d2be45fb1b61c541/AGENTS.md (2026-09-13)
  - skills/llm-wiki/SKILL.md, same SHA (2026-09-13)
  - Full recursive tree at the same SHA (2026-09-13)

---

## Patterns across this slice

Y means present and named in a file. P means partial. N means not found.
Columns are abbreviated repo names.

| # | Primitive | cl-obs | 2nd-brain | karpathy-w | pkm | pos | inspool | kmikeym | pbeens | kepano | samurai | pi-wiki |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Law | Y | Y | Y | Y | Y | Y | Y | Y | N | Y | Y |
| 2 | State surface | Y | P | N | P | N | P | Y | Y | N | P | P |
| 3 | Index or map | Y | Y | Y | P | N | Y | Y | Y | Y | Y | Y |
| 4 | Capture inbox | Y | Y | P | Y | N | Y | N | Y | Y | Y | Y |
| 5 | Durable memory | Y | Y | Y | Y | N | Y | P | Y | Y | Y | Y |
| 6 | Dated log | Y | Y | Y | Y | P | Y | Y | Y | Y | Y | Y |
| 7 | Records | Y | Y | Y | P | N | Y | N | N | N | Y | Y |
| 8 | Skills | Y | Y | Y | Y | Y | Y | P | Y | P | Y | Y |
| 9 | Roles | Y | P | N | Y | N | N | N | N | N | N | N |
| 10 | Task graph | N | Y | N | Y | N | N | P | P | N | N | N |
| 11 | Handoff or claim ledger | P | N | N | N | N | Y | N | Y | N | N | Y |
| 12 | Evidence or receipts | Y | Y | Y | N | N | Y | N | N | N | Y | Y |
| 13 | Gates | Y | P | Y | N | N | Y | N | Y | N | Y | P |
| 14 | Boundary | Y | P | Y | Y | N | Y | N | Y | N | Y | Y |
| 15 | Maintenance loop | Y | Y | Y | Y | N | Y | N | Y | N | Y | Y |
| 16 | Tool projections | Y | Y | P | P | Y | Y | N | N | N | Y | Y |
| 17 | Multi-project routing | Y | P | N | Y | N | Y | N | N | N | N | Y |

Every repo except the pre-agent baseline has a law file, a dated log, and a way
to file durable knowledge, and nine of eleven carry an index. The three-noun
core from the gist, `raw/` plus `wiki/` plus a schema file, survives every
reimplementation intact. What varies is how hard the immutability of `raw/` is
enforced, running from prose ("never modify these") through a create-only
transaction mode to a `tool_call` hook that blocks the write. The split that
matters most is verification: five repos ship something that can fail
(`check_evidence.py`, `health.py`, a claim ledger with independence keys,
`validate-ai-first.sh`, guardrails), and the rest ask the model to be careful.
The second split is who the workspace is for: the wiki repos treat a source as
the unit of work and have no task graph at all, while the productivity vaults
(ballred, second-brain) have boards and goal cascades but no evidence layer, and
almost nothing has both. Gates cluster around exactly three moments, letting a
synthesized answer become a durable page, moving a source out of the staging
area, and sending anything over the network. Every repo that has run for a while
has developed a maintenance operation with a stated cadence, and the two most
recently active ones have started pricing it (health free and every session,
lint expensive and every ten to fifteen ingests). The log format from the gist,
`## [YYYY-MM-DD] operation | Title`, propagated verbatim into four independent
repos, including the `grep "^## \[" log.md | tail -5` justification. The newest
work is pushing past the gist in one direction, storing what the agent did
(trajectories, cases, distilled skills) alongside what the agent read, which
turns the wiki into a memory of work and not only a memory of sources.

## Names people actually use

Counts are over the 11 full-record repos plus the gist, one count per project
that uses the name.

1. **Law**: `AGENTS.md` 5 (gist, claude-obsidian, inspool, pbeens, samurai,
   pi-wiki counted once each where it is the operative file), `CLAUDE.md` 6
   (gist, claude-obsidian, second-brain, pkm, kmikeym, samurai), `_CLAUDE.md` 1
   (second-brain vault side), `SKILL.md` as the law itself 2 (karpathy-w,
   pi-wiki), `GEMINI.md` 3, `ZCODE.md` 1, `.cursor/rules/*.mdc` 1,
   `.windsurf/rules/*.md` 1, `.github/copilot-instructions.md` 1,
   `.claude/rules/*.md` 1, `AGENTS2.md` (private overlay, named but unshipped) 1,
   `CLAUDE.local.md` 1, `AI-FIRST.md` (portable spec) 1.
2. **State surface**: `wiki/hot.md` 1, `tasks.md` 1, `wiki/overview.md` 3
   (claude-obsidian, samurai, and the gist's "an overview"), `Home.md` "Current
   Focus" 1, `raw/index.md` as a queue view 1, `DASHBOARD.md` 1,
   `Goals/2. Monthly Goals.md` 1.
3. **Index or map**: `index.md` / `wiki/index.md` 6 (gist, claude-obsidian,
   karpathy-w, inspool, samurai, pi-wiki as `meta/index.md`), `Categories/` 1,
   `0.Map of Contents/Home.md` 1, `registry.json` + `backlinks.json` 1,
   `references/folder-map.md` 1, a Folder Map section inside the law file 2
   (pbeens, pkm), per-folder `README.md` 1.
4. **Capture inbox**: `raw/` 6, `raw/unprocessed/` 1, `.raw/` 1, `inbox/` 1,
   `Inbox/` 1, `_raw/` 1, `_transcripts/` 1, `Clippings/` 2 (kepano, pbeens),
   `raw/sources/SRC-*/` 1, `raw/assets/` 2 (gist, inspool).
5. **Durable memory**: `entities/` 5, `concepts/` 5, `sources/` 5, `people/` 3,
   `projects/` / `Projects/` 4, `References/` 1, `Knowledge/` 1,
   `ALL-TAGS.txt` 1, `source-ledger.json` + `claim-ledger.json` 1,
   `wiki/skills/` and `wiki/cases/` 1.
6. **Dated log**: `log.md` / `wiki/log.md` 6, `meta/log.md` 1, `Daily/` 2,
   `Daily Notes/` 2, `1.Daily Notes/` 1, `wiki/logs/` 1, `events.jsonl` 1,
   `CHANGELOG.md` 3.
7. **Records**: `syntheses/` or `synthesis/` 3, `analyses/` 1, `questions/` 1,
   `Decisions/` and `wiki/decisions/` 1, `ADR-YYYY-MM-DD - Title.md` 1,
   `lint-report.md` / `health-report.md` / `graph-report.md` 1,
   `Status: Disputed` and `Status: Outdated` inline blocks 1, `cases/` 1.
8. **Skills**: `skills/<name>/SKILL.md` 6, `.claude/skills/` 3,
   `.claude/commands/` 3, `commands/` 3, `prompts/` 1, `.codex/skills/` 1,
   `2.Frameworks/` 1, `references/*-template.md` 2, `Templates/` 1,
   `scripts/*.py` as the deterministic half 3.
9. **Roles**: `agents/*.md` 1, `.claude/agents/*.md` 1, background agent hook 1.
   Named roles seen: `wiki-ingest`, `wiki-lint`, `verifier`, `note-organizer`,
   `weekly-reviewer`, `goal-aligner`, `inbox-processor`.
10. **Task graph**: `Boards/` 1, `All Tasks.md` 1, `tasks.md` 1, the goal
    cascade in `Goals/` 1, `Priority Stack Protocol.md` 1.
11. **Handoff or claim ledger**: `processing_status: pending_review` in raw
    frontmatter 1, `ingest_group` 1, `claim-ledger.json` 1,
    `raw/trajectories/TRJ-*/packet.json` 1, `tasks.md` handoff notes 1.
12. **Evidence or receipts**: `scripts/check_evidence.py` 1, `tools/health.py` 1,
    `source-ledger.json` with SHA-256 and independence keys 1,
    `hooks/validate-ai-first.sh` 1, `scripts/eval/` 1, `Raw:` field 1,
    recency marker `(as of YYYY-MM, source)` 1, `supports` / `contradicts`
    frontmatter 2, `confidence: stated|high|medium|speculation` 1.
13. **Gates**: `approve_ingest` command 1, `--approved-plan-sha256` 1,
    `people/_new/` staging 1, "ask the user if they want the answer filed" 3,
    three-tier lint authority 1, `draft -> stable` promotion gate 1,
    "Ask before major structural changes" 1.
14. **Boundary**: `.vault-meta/` 1, `.llm-wiki/meta/**` guardrail 1,
    `CLAUDE.local.md` 1, `AGENTS2.md` 1, `dist/` gitignored 1,
    `graph/` generated 1, `.gitignore` in every repo.
15. **Maintenance loop**: `lint` 6, `health` 1, `doctor` 1, `heal_links.py` 1,
    `check-links` 1, `wiki-fold` 1, `wiki_reindex` 1, `/obsidian-reconcile` 1,
    `all-tags-maintenance` 1, `archive-by-created-date` 1, `refresh.py` 1,
    `transaction recover` 1, cascade updates 1.
16. **Tool projections**: `.claude/` 5, `.claude-plugin/` 4, `.codex/` 2,
    `.cursor/` 1, `.windsurf/` 1, `.github/copilot-instructions.md` 1,
    `adapters/<platform>/adapter.sh` 1, `commands/` as a generated mirror of
    `prompts/` 1, `hosts/codex.config.toml.example` 1.
17. **Multi-project routing**: `.claude-obsidian.json` vault marker 1,
    `~/.llm-wiki/` personal plus `.llm-wiki/` project 1, per-project
    `CLAUDE.md` under `Projects/` 1, sibling `inspool-wiki-en` and
    `inspool-wiki-zh` each with its own `AGENTS.md` 1, `CLAUDE_OBSIDIAN_VAULT`
    environment variable 1.

## Uncertainties

- The GitHub gists API returned HTTP 502 on three attempts across two calls. The
  gist text came from the raw endpoint via `curl` instead, 11,985 bytes, which I
  read in full. I did not get the gist's revision SHA, so the citation is to the
  unpinned raw URL as of 2026-09-13.
- I read instruction and entry files, not every file. Skill bodies I did not open
  may contain primitives I marked absent. Specifically: I opened 1 of 15 skills
  in claude-obsidian, 1 of 47 commands in obsidian-second-brain, 0 of 13 skills
  in ballred, 2 of 5 commands in songzhuozhu, and 0 of 12 prompts in pi-llm-wiki.
- Two claims rest on directory listings rather than file contents: that
  kepano-obsidian has no agent instruction file (a full recursive tree at the SHA
  showed only `Readme.md` at root and no dotfile rules directory), and that
  `pbeens/obsidian-agents.md` ships no vault (the tree holds only `AGENTS.md`,
  `README.md`, `scripts/`, and `skills/`. `tasks.md`, `_raw/`, `people/`, and
  `AGENTS2.md` are described in `AGENTS.md` but not committed).
- "Evidence of real use" is weak across the slice. I counted forks, open issues,
  and commit-author names from the last 100 commits per repo. Commit-author names
  are self-reported. The 12 commits authored as "Claude" in claude-obsidian are
  the only direct signal of agent authorship I found, and I did not verify commit
  trailers.
- The extra-repo rule asked for GitHub topics `llm-wiki` or `second-brain` with
  commits in the last 90 days. Both additions came from `second-brain`. The
  `llm-wiki` topic search returned many hits pushed within hours of the query,
  several with 0 to 3 stars and names suggesting automated repo creation. I did
  not investigate whether that topic is being spammed, and I picked neither.
- `zosmaai/pi-llm-wiki` targets the pi and oh-my-pi hosts. I read its
  `skills/llm-wiki/SKILL.md` for the vault layer but did not verify the
  extension's TypeScript guardrail implementation, so "enforced at the tool_call
  hook level" is the skill file's claim, not something I confirmed in code.
- `ArtemXTech/personal-os-skills` is borderline for this slice. It is a skill
  package with no vault, so most primitive rows are N by construction rather than
  by omission.
