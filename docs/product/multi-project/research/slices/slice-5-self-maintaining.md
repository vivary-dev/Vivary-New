# Slice 5: self-learning, self-healing, self-growing loops in file-based agent workspaces

Supplied research input. Read the [source reconciliation](../workspace-research-reconciliation.md) before using
its claims or delivery order. The accepted plan is the program frontier.

Research date: 2026-09-13. All claims trace to a file or page listed under the
system's Sources line. Where a source did not state something, the record says
"not found" rather than inferring it.

Scope note: this slice records file operations, triggers, and gates. It does not
record benchmark numbers, and it does not compare products.

Systems recorded: 13.

---

### WikiSkill (arXiv 2608.27454)

- URL: https://arxiv.org/html/2608.27454. Not a repo. Page read 2026-09-13, sections 3.1 and 3.2. No license or star data applies.
- Purpose: an agent improves its own skill files across training iterations by writing execution traces to an immutable layer, consolidating those traces into wiki pages, and proposing one gated skill edit per iteration.
- Layers:
  - Raw traces: `raw/`, holding immutable execution traces from rollouts.
  - Durable knowledge: `wiki/`, with `wiki/patterns/` (one Markdown file per failure mode or successful strategy), `wiki/index.md` (catalog of current patterns), `wiki/logs.md` (evolution log), and `wiki/skill-impact.md` (skill impact tracker).
  - Active procedures: `skills/`, with `skills/{skill_name}/SKILL.md` (procedural content) and `skills/{skill_name}/PURPOSE.md` (maps the skill back to the wiki patterns that motivated it).

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| Inference (skill provisioning) | Each iteration k | Active skill set S(k-1), injected into the system prompt | Immutable traces into `raw/` | None. The inference agent is barred from reading the Wiki layer | Not applicable, traces are immutable |
| Wiki Maintainer (consolidate) | After training rollouts complete | Sampled raw traces plus the existing wiki W(k-1) | New pages under `wiki/patterns/`, patch-based edits to existing pattern pages, `wiki/index.md`, appends to `wiki/logs.md` | None. The wiki is ungated | None. The wiki never rolls back |
| Skill Proposer (promote) | After wiki maintenance | `wiki/index.md`, `wiki/skill-impact.md`, a training-outcome summary, and specific pattern pages and raw traces fetched on demand in a multi-turn ReAct loop | One atomic proposal targeting a single skill, as a create or a patch-based edit | Proposal is atomic and single-skill by construction | The proposal is reverted by the gate below |
| Validation gate and rollback | After the proposal is applied | Candidate skill set S(k)' evaluated on a held-out validation split | `wiki/skill-impact.md`, with the proposal metadata, the diff, the validation score, and the accept or reject outcome | Automatic numeric gate: keep the candidate only if validation reward exceeds the best reward so far, otherwise revert to S(k-1) | Revert the active skill set to the previous iteration. The wiki is kept |

- Never written automatically: the raw trace layer is never modified after a rollout. The inference agent never writes to `wiki/`.
- Evidence of real use: benchmark only. The paper reports training iterations over a validation split. No agent-authored commit history was available to read.
- Generalizes: the split between a knowledge layer that only accumulates and a procedure layer that can be reverted. Losing a skill edit does not lose the lesson that motivated it, because the pattern page survives. The single-skill-per-iteration rule keeps the diff small enough to attribute a score change to it.
- Idiosyncratic: the gate is a numeric reward on a validation split. A personal workspace has no such split, so the gate has to be something else.
- Sources:
  - https://arxiv.org/html/2608.27454 sections 3.1 and 3.2, accessed 2026-09-13.

---

### karpathy llm-wiki gist

- URL: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f. Gist, not a repo. Star and license data not applicable. Read 2026-09-13.
- Purpose: a personal wiki that an LLM maintains, where sources are ingested into structured pages and the whole set is periodically checked for contradictions and gaps.
- Layers:
  - Raw traces: `raw/`, holding source material (articles, PDFs, images, data).
  - Durable knowledge: `wiki/`, holding summary, entity, and concept pages, plus `index.md` (the catalog) and `log.md` (append-only chronological record).
  - Active procedures: a schema file such as `CLAUDE.md` configures the wiki structure, conventions, and workflows. There is no separate skills layer.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| ingest | User-initiated, one source at a time preferred | A source file in `raw/` | New or updated pages in `wiki/`, `index.md`, appends a line to `log.md` | User reviews the summary and the proposed wiki updates before they are filed | Not found |
| query | User asks a question | `index.md` first to find relevant pages, then those pages | Optionally files the answer as a new wiki page | User decides whether the result is worth filing | Not found |
| lint | Periodic health check | All wiki pages | Flagged issues: contradictions, stale claims, orphans, gaps | Report only. Lint does not repair | Not applicable, lint writes no page content |
| compile | Not separately documented in the gist beyond the ingest and index update path | - | - | - | - |

- Never written automatically: the gist frames every wiki update as reviewed before filing. Specific error-recovery procedures are not detailed.
- Evidence of real use: none found beyond the gist itself. It is a published convention, not a maintained repository.
- Generalizes: the `index.md` plus `log.md` pair. One file answers "what exists", the other answers "what happened and when". The log line format `## [DATE] operation | title` reappears in two independent repos below.
- Idiosyncratic: lint is defined as a reasoning pass over prose, not a deterministic checker. Two repos below split that into a deterministic engine plus a separate reasoning step.
- Sources:
  - https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f, accessed 2026-09-13.

---

### Voyager (MineDojo/Voyager)

- URL: https://github.com/MineDojo/Voyager. 7,195 stars, last push 2024-04-03, MIT. Read at SHA `55e45a880755d0c8c66ca7fb5fe7962ac8974f89`.
- Purpose: an agent writes JavaScript programs to solve tasks, and any program that passes verification is stored as a named skill and retrieved later by semantic similarity.
- Layers:
  - Raw traces: `{ckpt_dir}/action/chest_memory.json`, `{ckpt_dir}/curriculum/completed_tasks.json`, `{ckpt_dir}/curriculum/failed_tasks.json`, `{ckpt_dir}/curriculum/qa_cache.json`, and an `events` directory. Traces live beside the skills, not above them.
  - Durable knowledge: there is no separate wiki layer. The curriculum task lists are the closest thing.
  - Active procedures: `{ckpt_dir}/skill/code/{name}.js` (the program), `{ckpt_dir}/skill/description/{name}.txt` (a one-line generated description), `{ckpt_dir}/skill/skills.json` (the authoritative map of name to code and description), and `{ckpt_dir}/skill/vectordb/` (a Chroma store over the descriptions).

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| add_new_skill (capture and promote in one step) | Called after a program passes the critic's verification for a task | `info["program_name"]`, `info["program_code"]` | `skill/code/{name}.js`, `skill/description/{name}.txt`, `skill/skills.json`, and a Chroma embedding keyed by program name | The critic agent's pass is the only gate. There is a hardcoded exception that refuses to store any task starting with "Deposit useless items into the chest at" | None. A rewritten skill overwrites the `skills.json` entry and the vectordb id; the old file is kept on disk under a versioned name `{name}V{i}.js` |
| retrieve_skills | Before an action attempt | Chroma similarity search over descriptions, top k (default 5) | Nothing | None | Not applicable |
| generate_skill_description | Inside add_new_skill | The program code plus the `skill` prompt | Returns a comment-wrapped description used as the embedding text | None | Not applicable |
| Consistency check (repair) | SkillManager construction | `skills.json` count versus `vectordb._collection.count()` | Nothing. It raises an assertion | Hard assert that refuses to start when the two disagree, with a message telling the user to delete the vectordb directory | Manual: delete the vectordb directory and rebuild |

- Never written automatically: nothing prunes the skill library. There is no delete path in `SkillManager`. A superseded skill keeps its old `.js` file under a `V2`, `V3` name while `skills.json` points at the newest code.
- Evidence of real use: three checkpoint skill libraries committed at `skill_library/trial1`, `trial2`, `trial3`, each with dozens of generated `.js` and `.txt` files, plus three linked community checkpoint repos in `skill_library/README.md`. Last push 2024-04-03.
- Generalizes: the skill file and its retrieval description are separate artifacts, and the description is generated from the code rather than hand-written. The index and the file set are checked for agreement at startup and the process refuses to run when they disagree.
- Idiosyncratic: retrieval is a vector store, not a Markdown index, so there is no file surface for the index. The gate is an environment-executed verification, which a prose workspace does not have.
- Sources:
  - https://github.com/MineDojo/Voyager/blob/55e45a8/voyager/agents/skill.py, accessed 2026-09-13.
  - https://github.com/MineDojo/Voyager/blob/55e45a8/skill_library/README.md, accessed 2026-09-13.

---

### Letta (MemFS and dreaming)

- URL: https://docs.letta.com. Vendor docs. Pages read 2026-09-13: `concepts/memfs` and `configuration/memory`. `guides/agents/memfs` returned 404.
- Purpose: an agent's memory is a git-backed filesystem checked out on the machine, and a background pass consolidates lessons from recent conversation into it.
- Layers:
  - Raw traces: conversation history, reachable separately via `letta messages search`. Not a directory under the memory root.
  - Durable knowledge: `$MEMORY_DIR`, with `system/` (loaded into the system prompt every turn, holding `persona.md` and `human.md`) and `reference/` (stays out of context until needed). Files are Markdown with YAML frontmatter carrying a `description`.
  - Active procedures: `$MEMORY_DIR/skills/{name}/SKILL.md`, versioned with the rest of the agent's memory.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| Ordinary file edit (capture) | Agent decides during a turn | Files under `$MEMORY_DIR` | Files under `$MEMORY_DIR`. Edits stay local until committed and pushed | Not found | Git, since the memory dir is a repo |
| Dreaming / sleep-time (consolidate) | After a set number of completed agent steps, or when the context window is compacted. Configured with `/sleeptime` in the CLI or Dream settings in the app | Recent conversations | MemFS. The docs do not name which files or blocks the dream pass edits | Optional "Agent reviews before applying": a second background conversation reviews and revises the proposed updates. The docs state this increases token use and does not require user approval | Git history of the memory repo. No dream-specific revert is documented |
| `/init` | User command | The current project | Bootstraps or refreshes memory for the project | User-invoked | Not found |
| `/doctor` (repair) | User command | Memory placement, duplication, token usage | Audit findings | Report. Not documented as auto-fixing | Not applicable |
| `/remember` | User command | The instruction text | A memory file | User-authored by definition | Not found |
| MemFS Search | Agent query | Installed search mod over `$MEMORY_DIR`, keyword, semantic, or hybrid | Nothing | None | Not applicable |

- Never written automatically: the file tree is always in the system prompt but non-`system/` file bodies are not loaded until needed, so a dream pass that edits `reference/` does not silently change every future turn's prompt. What dreaming refuses to do is not stated in the docs beyond "does not interrupt active work".
- Evidence of real use: vendor product documentation. No repository was read.
- Generalizes: only one directory (`system/`) is always in context, and the rest of the tree is addressable but cold. That is a cheap way to keep an index in context without keeping the knowledge in context.
- Idiosyncratic: the memory root is a real git checkout projected onto the host, so versioning and rollback come from git rather than from a bespoke journal.
- Sources:
  - https://docs.letta.com/concepts/memfs, accessed 2026-09-13.
  - https://docs.letta.com/configuration/memory, accessed 2026-09-13.

---

### Anthropic Claude Code auto memory

- URL: https://code.claude.com/docs/en/memory. Vendor docs, read 2026-09-13.
- Purpose: Claude writes notes to itself about a user's corrections and preferences, into a per-repository directory indexed by one file.
- Layers:
  - Raw traces: session transcripts under the Claude config directory, deleted after `cleanupPeriodDays`. The memory directory is explicitly excluded from that retention sweep.
  - Durable knowledge: `~/.claude/projects/<project>/memory/`, containing `MEMORY.md` (the index, one line per memory) plus one topic file per memory, for example `user_role.md` and `feedback_testing.md`. Overridable with `autoMemoryDirectory` in `settings.json`.
  - Active procedures: `CLAUDE.md` (human-written, at managed policy, `~/.claude/CLAUDE.md`, `./CLAUDE.md` or `./.claude/CLAUDE.md`, and `./CLAUDE.local.md`), plus `.claude/rules/*.md` with optional `paths:` frontmatter for path-scoped loading.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| Auto memory write (capture) | Claude decides mid-session that a fact would be useful in a future conversation. On by default | The conversation. `MEMORY.md` to track what is stored where | A topic file under the memory directory, plus an index line in `MEMORY.md`. A `modified` ISO 8601 frontmatter field is stamped on any file that already has frontmatter | None. It writes without asking. Disable with `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | Manual. The files are plain Markdown the user can edit or delete via `/memory` |
| Index prune (prune) | After Claude writes `MEMORY.md`, Claude Code measures the file against 200 lines and 25KB | `MEMORY.md` | Nothing directly. It returns a reminder to shorten, or, when over the limit, an error telling Claude to rewrite the index | Enforced by the harness, not by the model | Not applicable |
| Load | Start of every conversation | First 200 lines or 25KB of `MEMORY.md`, whichever comes first | Nothing | Content past the threshold is dropped on load | Not applicable |
| `/doctor` trim (repair) | User command | A checked-in `CLAUDE.md` | Proposes trims: cuts what Claude can derive from the codebase, keeps pitfalls, rationale, and conventions that differ from tool defaults | Proposal, user applies | Not applicable |
| `/init` | User command | The codebase, plus Cursor, Copilot and, with `CLAUDE_CODE_NEW_INIT=1`, `AGENTS.md`, Devin, Windsurf, and Cline rules | A starting `CLAUDE.md`. With the new flow, presents a reviewable proposal before writing any files | Suggests improvements rather than overwriting an existing file | Not applicable |

- Never written automatically: Claude skips anything derivable from the codebase (architecture, file paths, debugging fixes) and anything the CLAUDE.md files already say. It does not save every session. It never adds frontmatter to a file that has none. Topic files are not loaded at startup, only on demand.
- Evidence of real use: vendor documentation with per-version behavior notes (v2.1.206, v2.1.214, v2.1.234, v2.1.239), which indicates a shipped and iterated feature.
- Generalizes: one bounded index file plus unbounded topic files, with the harness enforcing the index bound and refusing a write that would silently truncate. The four note types (`user`, `feedback`, `project`, `reference`) recorded as a frontmatter `type` field give the prune pass something to sort on.
- Idiosyncratic: memory is machine-local and keyed by git repository identity, shared across worktrees. It is deliberately not synced.
- Sources:
  - https://code.claude.com/docs/en/memory, accessed 2026-09-13.

---

### OpenAI Codex memories

- URL: https://developers.openai.com/codex/memories (308 redirect to https://learn.chatgpt.com/docs/customization/memories.md). Vendor docs, read 2026-09-13.
- Purpose: Codex generates memories from past chats in the background and can inject them into future sessions.
- Layers:
  - Raw traces: prior chats. Memory generation waits until a chat is idle long enough to avoid summarizing work still in progress.
  - Durable knowledge: `~/.codex/memories/`, under the Codex home controlled by `CODEX_HOME`. The docs describe the contents as summaries, durable entries, recent inputs, and supporting evidence from prior chats. Exact per-file names were not given on the page read.
  - Active procedures: `AGENTS.md`. Codex builds an instruction chain at startup, reading `AGENTS.override.md` if present and otherwise `AGENTS.md`, in the Codex home and then in each directory along the path, plus any `project_doc_fallback_filenames`.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| Generate memories (capture and consolidate) | A chat goes idle. Runs in the background, not at the end of every chat | Prior chat content | Files under `~/.codex/memories/` | Off by default. `memories.generate_memories` enables it. `memories.disable_on_external_context` excludes chats that used MCP tools or web search. `memories.min_rate_limit_remaining_percent` skips generation near rate limits. Secrets are redacted from generated memory fields | Not found |
| Use memories | Session start | Existing memories | Injected into the session | `memories.use_memories` | Not found |
| Per-chat control | User command | - | - | `/memories` controls per-chat behavior | Not applicable |

- Never written automatically: nothing at all when memories are off, which is the default. Short-lived and active sessions are skipped. Chats with external context are skipped when that setting is on. The docs instruct that required team rules belong in `AGENTS.md` or checked-in documentation, and that memories are a recall layer, not the only source for rules that must always apply.
- Evidence of real use: vendor documentation with named config keys and separate extract and consolidation models (`memories.extract_model`, `memories.consolidation_model`).
- Generalizes: the idleness trigger. Waiting for a chat to go quiet is a cheap proxy for "the work is finished and safe to summarize", and it avoids consolidating a half-done task. Also the explicit doctrine that automatic memory is recall, and the checked-in file is law.
- Idiosyncratic: off by default, and disabled by region (the page notes European Economic Area, United Kingdom, and Switzerland handling). No page read documented a view or delete command beyond `/memories`.
- Sources:
  - https://learn.chatgpt.com/docs/customization/memories.md (from https://developers.openai.com/codex/memories), accessed 2026-09-13.
  - https://developers.openai.com/codex/guides/agents-md, referenced via search result summary, accessed 2026-09-13.

---

### eugeniughelbur/obsidian-second-brain

- URL: https://github.com/eugeniughelbur/obsidian-second-brain. 4,438 stars, last push 2026-09-06, MIT. Read at SHA `d631fd67aea0afe2b1e44fa5496bc04629348456`.
- Purpose: a Claude Code plugin of roughly 47 slash commands that capture into, consolidate, audit, and repair an Obsidian vault of Markdown notes.
- Layers:
  - Raw traces: daily notes, dev logs, and captures. The operation log is `Logs/YYYY-MM-DD.md` when a `Logs/` directory exists, otherwise a single `log.md`.
  - Durable knowledge: the vault itself, in two supported shapes resolved by `references/folder-map.md`: wiki-style (`wiki/concepts/`, `wiki/decisions/`, `wiki/projects/`, `wiki/logs/`) or Obsidian-style (`Knowledge/`, `Ideas/`, `Projects/`). `index.md` is the vault index. `_CLAUDE.md` at the vault root is the operating manual and holds the vault path.
  - Active procedures: `commands/*.md` in the plugin, and rules in `references/ai-first-rules.md`, `references/freshness-policy.md`, and `_meta/taxonomy.md` in the vault.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| `/obsidian-capture`, `/obsidian-daily`, `/obsidian-log` | User command | Conversation | Daily notes and capture notes | User-invoked | Git, if the vault is a repo. Not provided by the plugin |
| `/obsidian-health` (repair, read-first) | User command | `_CLAUDE.md`, then `scripts/vault_health.py --json`, plus `scripts/link_graph.py --lint` and `scripts/freshness_lint.py --json` | Appends one line to `Logs/YYYY-MM-DD.md` or `log.md`. Note edits only after the gates below | Findings are split into critical, warning, and info. Safe fixes (missing frontmatter, unwrapping code-fence-wrapped notes, obvious duplicates, creating concept-gap pages) are offered. Destructive fixes (archiving, merging, resolving contradictions) are listed and require explicit confirmation. Tag-synonym rewrites are per note with explicit confirmation and never batched unattended. `tag_not_in_taxonomy` is informational and never auto-fixed | Not provided. The freshness policy states "never delete: restamp, convert, or mark superseded" |
| `/obsidian-learn` (consolidate and promote) | User command, scope `recent` (30 days, default), `all`, or a topic | Daily notes, ADRs, emerge and synthesize reports, dev logs | A report at `YYYY-MM-DD - Learnings Review.md` with `type: learnings-review`, an operation log line, and a daily-note summary | Classifies each learning Active, Stale, Superseded, or Promoted. A learning that appeared 3 or more times becomes a promotion candidate for `_CLAUDE.md`, and promotion requires user confirmation | Not applicable, the report is additive |
| `/obsidian-emerge` (consolidate) | User command, default last 30 days | Daily notes, dev logs, decisions, ideas in range, via parallel subagents | Offers to save `YYYY-MM-DD - emerge.md` with `type: emerge`, plus a daily-note line | Offered, not automatic | Not applicable |
| `/obsidian-graduate` (promote) | User command | An idea note plus related projects, people, and past decisions | A project note with `graduated-from: "[[Idea Note]]"`, kanban board cards, `status: graduated` on the original idea | User picks the idea | The original idea note is kept, not deleted |
| `/obsidian-reindex` (repair) | User command | `_CLAUDE.md`, then `vault_ops.index_coverage` before and after | `.obsidian-semantic-index.json` only. It does not modify Markdown notes | Preserves the builder's exit status and stderr. On nonzero exit it stops and shows the error rather than reporting success | Rebuild is incremental and idempotent |
| Session-end consolidation | Hermes `on_session_end` hook, `hooks/obsidian-hermes-session-end.sh` | Stdin JSON payload, `_CLAUDE.md` | Runs the `obsidian-nightly` pass headlessly: close the day, reconcile conflicting entity and concept claims, synthesize cross-source patterns, heal orphan links, rebuild `index.md`, append a line to `log.md` | Ships inert. Requires both `OBSIDIAN_VAULT_PATH` and `OBSIDIAN_HERMES_HOOK_ENABLED=1`. No-ops when `.extra.interrupted` is true. The prompt says "Add/update/link only, never delete, archive, or merge" | None. Prevention only |
| Post-compaction background pass | Claude Code `PostCompact` hook, `hooks/obsidian-bg-agent.sh`, async, 10s timeout | Vault | Same class of consolidation writes | Opt-in, per the hook's own trust caveat | None |
| AI-first validation | Claude Code `PostToolUse` on `Write\|Edit\|MultiEdit\|NotebookEdit\|create_file`, `hooks/validate-ai-first.sh`, 10s timeout | The written file | Validation result | Enforces the `references/ai-first-rules.md` schema at write time | Not applicable |
| Session context load | Claude Code `SessionStart`, `hooks/load_vault_context.py` | Vault | Context into the session | None | Not applicable |

- Never written automatically: no command deletes. The nightly and session-end prompt is add, update, link only. `_meta/taxonomy.md` is human-curated and is never edited by `/obsidian-health`. Freshness fixes restamp, convert to a pointer, or mark superseded, and never delete. `/obsidian-reindex` never touches Markdown.
- Evidence of real use: 4,438 stars, pushed 2026-09-06, a `CHANGELOG.md`, a `FORK_INSIGHTS.md`, CI and OpenSSF scorecard workflows, eight runtime adapters (Claude Code, Codex, Gemini, Hermes, opencode, Grok, Pi, generic agent skills), and a committed sample vault including `examples/sample-vault/wiki/logs/2026-04-27 — Tide retention rebuild.md`.
- Generalizes: three things. First, the deterministic scan runs as a script and the reasoning runs after it, so the report cannot invent findings. Second, a finding class is explicitly declared not an error (`wanted_note` is a demand-ranked wishlist, and "the goal is to triage the backlog, never to drive the count to zero"). Third, a promotion threshold stated as a number: a learning seen 3 or more times becomes a candidate rule.
- Idiosyncratic: multilingual trigger phrases in every command's frontmatter (`triggers_en`, `triggers_es`, `triggers_pt`, `triggers_zh`). The two-flag inert hook is a response to a specific risk (unattended writes), not a general pattern.
- Sources:
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/commands/obsidian-health.md, accessed 2026-09-13.
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/commands/obsidian-learn.md, accessed 2026-09-13.
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/commands/obsidian-graduate.md, accessed 2026-09-13.
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/commands/obsidian-emerge.md, accessed 2026-09-13.
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/commands/obsidian-reindex.md, accessed 2026-09-13.
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/hooks/hooks.json, accessed 2026-09-13.
  - https://github.com/eugeniughelbur/obsidian-second-brain/blob/d631fd6/hooks/obsidian-hermes-session-end.sh, accessed 2026-09-13.

---

### AgriciDaniel/claude-obsidian

- URL: https://github.com/AgriciDaniel/claude-obsidian. 14,870 stars, last push 2026-09-10, MIT. Read at SHA `32ac5a02c4e082e4a5628ca810776375e134708e`.
- Purpose: the same wiki shape as the karpathy gist, but every vault mutation goes through a hash-checked, journaled transaction with an explicit approval hash, and lint is a deterministic engine that is forbidden from repairing anything.
- Layers:
  - Raw traces: `.raw/` in the vault, with `.raw/.manifest.json` and `.raw/captured/*` payloads. Raw source payloads are create-only.
  - Durable knowledge: `wiki/`, with `wiki/concepts/`, `wiki/entities/`, `wiki/sources/`, `wiki/questions/`, `wiki/folds/`, `wiki/canvases/`, plus `wiki/index.md`, `wiki/log.md`, `wiki/hot.md` (a hot cache), and `wiki/overview.md`. Ledger contracts live under `.vault-meta/`, including `.vault-meta/mode.json` and `.vault-meta/lint-allowlist.json`.
  - Active procedures: `skills/*/SKILL.md` in the product root, with `wiki-ingest`, `wiki-lint`, `wiki-fold`, `wiki-query`, `wiki-retrieve`, `wiki-mode`, `wiki-cli`, `save`, `think`, `autoresearch`, `defuddle`, `canvas`. Python engine at `claude_obsidian/` (`gates.py`, `checkpoint.py`, `transaction.py`, `lint_engine.py`, `ledgers.py`, `page_schema.py`).

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| capture | Skill invocation | A source | `.raw/captured/*` only. Create-only | Operation type is an enforced authority: a `capture` bundle cannot write anywhere else | Transaction rollback |
| ingest (consolidate) | Skill invocation | `.raw/` payload | Coupled writes required: source capture when applicable, pages, ingestion and evidence records, indexes or MOCs, `wiki/log.md`, `wiki/hot.md`, optional overview | Transaction contract below | Transaction rollback |
| lint (repair, detect only) | `python3 claude-obsidian.py lint --vault VAULT`, read-only either way | All wiki pages, honoring `.gitignore` inside the vault and skipping dot-prefixed directories | Nothing. It returns findings to stdout or chat | "Never auto-fix a lint result." The skill forbids writing the Markdown rendering into the vault. `--strict` only changes the exit code. Allowlisted findings are treated as policy, not as proof the target exists | Not applicable |
| lint repair | Separate operation after the user chooses specific findings | Re-reads each target and records its expected SHA-256 | Approved fixes plus a regenerated report or index | Draft only the selected changes. Never delete or merge pages without explicit consent. Build one repair bundle with a new operation ID, inspect it, show exact changed paths, apply only after that separate review, then re-run lint read-only and compare | Transaction rollback, plus the re-run comparison |
| fold (prune by rollup) | Explicit user request only. "Do not perform fold-of-folds or trigger a fold automatically" | A bounded range of `wiki/log.md` entries, size `2^k` with default `k=4`. Child pages read only when the log lacks context, target 0 to 10 reads, hard ceiling 15 | `wiki/folds/{FOLD_ID}.md` in create mode, a catalog entry in `wiki/index.md`, one new top-of-file entry in `wiki/log.md`. It does not update `wiki/hot.md` | Structural ID derived only from inputs: `fold-k{K}-from-{EARLIEST-DATE}-to-{LATEST-DATE}-n{COUNT}`. If that file exists the operation is a no-op. Preview by default. Pre-write checks: deterministic ID and exact entry count, frontmatter and table bijection, numeric traceability, a source citation for every outcome and theme, and no change to any child, source, or ledger. A fold adds no new evidence so it cannot upgrade claim assessments | Transaction rollback. The identical bundle and ID are idempotent |
| transaction inspect and apply | Every state-changing skill | Every expected target's SHA-256, or `null` when it must be absent | One `claude-obsidian.transaction.v1` bundle applied once | Seven-step contract: resolve vault, hash all targets, workers draft but never write, build one bundle, `transaction inspect`, show destructive, external, or canonical-merge proposals to the user, then `transaction apply --approved-plan-sha256 HASH` with the exact hash from inspect. The approval hash binds the plan to the canonical resolved vault root and cannot be reused for another vault | Exit 75 means the vault changed or another operation holds the lock: re-read, rebuild, inspect a new bundle. Validation failure means no write occurred. An interrupted apply is recovered or rolled back by the next apply, or by `transaction recover`. The engine rejects an operation it could not roll back under its size limits |
| checkpoint | Separate explicit command, `python3 CORE checkpoint OPERATION_ID --vault VAULT` | The applied operation | Git history | "Never commit from a generic lifecycle hook." Git is opt-in and separate from apply | Git |
| Session hooks | `SessionStart` matching `startup\|resume\|clear\|compact` and `Stop`, both 5s timeout, both `claude-obsidian.py hook ...` | Vault state | Session-start and stop bookkeeping. Not a consolidation pass | The hooks are bookkeeping. Mutations go through transactions | Not applicable |

- Never written automatically: lint never repairs. Fold never modifies, moves, or deletes a child entry or its page, never runs automatically, and never updates `wiki/hot.md`. Workers never write, only the orchestrator applies. Query is read-only and delegates persistence to Save. `setup` and `migration` accept only the exact tracked template paths and are not escape hatches for arbitrary root, plugin, snippet, or metadata files. Git is never committed from a lifecycle hook.
- Evidence of real use: 14,870 stars, pushed 2026-09-10, `CHANGELOG.md`, `RELEASE_MANIFEST.json`, `SHA256SUMS`, `config/release-allowlist.json`, a test suite with lint fixtures and migration fixtures, and a committed sample vault.
- Generalizes: four things. First, read the expected SHA-256 of every target before drafting and bind the approval to those hashes, so a concurrent edit fails the operation instead of clobbering it. Second, make the operation type an enforced authority over which paths it may touch, rather than a label. Third, split detect from repair so a health check can never quietly edit. Fourth, derive a rollup's ID from its inputs so re-running it is a no-op instead of a duplicate.
- Idiosyncratic: the confinement relies on POSIX directory descriptors and `fcntl.flock`, so Windows users must run it under WSL rather than native Windows or Git Bash. Size limits (64 MiB per file, 128 MiB per operation, 1,024 writes, 1,024 UTF-8 bytes per path) exist so every accepted operation stays recoverable.
- Sources:
  - https://github.com/AgriciDaniel/claude-obsidian/blob/32ac5a0/skills/wiki-lint/SKILL.md, accessed 2026-09-13.
  - https://github.com/AgriciDaniel/claude-obsidian/blob/32ac5a0/skills/wiki-fold/SKILL.md, accessed 2026-09-13.
  - https://github.com/AgriciDaniel/claude-obsidian/blob/32ac5a0/skills/wiki/references/operation-transactions.md, accessed 2026-09-13.
  - https://github.com/AgriciDaniel/claude-obsidian/blob/32ac5a0/hooks/hooks.json, accessed 2026-09-13.

---

### danielmiessler/LifeOS (Cortex)

- URL: https://github.com/danielmiessler/LifeOS. 19,005 stars, last push 2026-09-04, MIT. Read at SHA `5e2f2e8c0abde612da0e99c16c0d07d4ec21b88c`.
- Purpose: hooks capture events into typed directories while a background reviewer periodically rewrites the always-loaded memory files to their full desired next state, with per-write snapshots and shrink guards.
- Layers:
  - Raw traces: Claude Code's own `projects/` transcript storage (30-day retention) is the source of truth for transcripts. Hook-written streams land in `MEMORY/OBSERVABILITY/*.jsonl` (`memory-writes.jsonl`, `reviewer-runs.jsonl`, `reviewer-fires.jsonl`, `tier-b-writes.jsonl`, `identity-proposals.jsonl`, `proposal-replies.jsonl`, `memory-retrievals.jsonl`, `memory-health.jsonl`).
  - Durable knowledge: `~/.claude/LIFEOS/MEMORY/` with `KNOWLEDGE/{People,Companies,Research}/`, `IDEAS/`, `LEARNING/` (including `LEARNING/SIGNALS/` and `LEARNING/SYNTHESIS/`), `WISDOM/FRAMES/` and `WISDOM/PRINCIPLES/`, `WORK/`, `SECURITY/`, `VOICE/`, `BENCHMARKS/`, plus `STATE/` and `OBSERVABILITY/`.
  - Active procedures: the hot layer `USER/PRINCIPAL/PRINCIPAL_MEMORY.md` and `USER/DIGITAL_ASSISTANT/DA_MEMORY.md`, loaded into every prompt, plus the Tier C curated files `PRINCIPAL_IDENTITY.md`, `DA_IDENTITY.md`, `WRITINGSTYLE.md`, `DEFINITIONS.md`, `CANONICAL_CONTENT.md`, `RESUME.md`, and the routing files `PROJECTS.md`, `CONTACTS.md`, `USER/CONFIG/OPERATIONAL_RULES.md`.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| Hook capture | Per-event hooks (Algorithm, SatisfactionCapture, WorkCompletionLearning, EventLogger, Pulse voice, SecurityPipeline) | The event | `WORK/`, `LEARNING/SIGNALS/`, `LEARNING/`, `OBSERVABILITY/`, `VOICE/`, `SECURITY/` | Tier classifier. Tier D is default-deny on everything not enumerated | Not applicable, append-only streams |
| Harvest (consolidate) | Periodic | Session transcripts | `SessionHarvester` to `LEARNING/`, `SessionHarvester --mine` to `KNOWLEDGE/_harvest-queue/`, `KnowledgeHarvester` to `KNOWLEDGE/`, `LearningPatternSynthesis` to `LEARNING/SYNTHESIS/`, `WisdomCrossFrameSynthesizer` to `WISDOM/PRINCIPLES/` | Tier B logs an audit row per write to `tier-b-writes.jsonl` | Not found beyond git |
| MemoryReviewer (consolidate as curation) | Stop hook, AND-gated on three conditions from `USER/CONFIG/memory-review.json`: `turn_count >= 8` per session, `minutes_since_last_review >= 30` global across sessions, and `idle_minutes >= 2`. A new UserPromptSubmit before Stop cancels the pass (debounce) | The current entries of the target file (`readCurrentMemorySnapshot`) plus recent conversation | Returns a `memory` item with `op: "set"` and a full `entries[]` list, routed to `MemoryWriter.setEntries` as a replace. Cap 48 entries of 256 chars | Tier A writes are automatic. The reviewer prompt requires superseding contradictions, merging duplicates, consolidating before adding at 80 percent full (39 of 48), writing declarative facts not directives, and an explicit do-not-save list (task progress, SHAs, PR numbers, anything stale in 7 days) | Per-write snapshot, see below |
| Forgetting (prune) | Same reviewer pass | Same | Omission. A stale fact is dropped by leaving it out of the returned set; a contradicted fact is superseded by dropping the old and writing the new | Two in-lock guards. `ESUSPECT_SHRINK` blocks a result that is near-empty (fewer than 3 entries) or drops more than 50 percent with zero additions, while allowing large consolidation that adds as it drops. `ESUSPECT_EROSION` blocks a single write that net-drops 2 or more entries and logs the full delta. Both are opted out with `allowDrastic: true` | `snapshotBeforeWrite` copies the prior file to a ring buffer at `MEMORY/OBSERVABILITY/memory-snapshots/<file>__<ts>.md`, last 30 per file. Recover with `bun LIFEOS/TOOLS/MemoryRestore.ts {list \| restore <snap> \| latest <principal\|da>}` |
| Proposal (promote, gated) | Reviewer emits a `proposal` item with a `target_kind` discriminator | Conversation | A row in `MEMORY/OBSERVABILITY/pending-proposals.jsonl`, status `pending → sent → accepted/rejected/edited/auto-applied` | Confidence thresholds: 0.70 and above auto-applies silently to the target file; 0.40 to 0.69 surfaces on the Pulse dashboard and the inline memory line for accept, reject, or edit; below 0.40 is discouraged. The dispatcher validates `(target_kind, target_file)` against the closed allowlist `PROPOSAL_KIND_TO_FILES`, and `pinProposalTargetFile` overrides the model's free-text path with the canonical one, so a hallucinated path cannot be persisted (`EINVAL_ITEM`) | Reject or edit via `bun LIFEOS/TOOLS/ProposalDecide.ts` |
| MemoryHealthCheck (repair, detect) | `MemoryHealthGate.hook.ts` on the Stop chain, every turn end, non-blocking | Hook files and registrations in both `settings.system.json` and `settings.json`, state and hot-layer files, reviewer and retrieval evidence, proposal backlog, observability retention, optional-index integrity | A row per invocation to `memory-health.jsonl`. Exit 0, 1, 2 for ok, warn, critical | Missing evidence never produces green. The latest reviewer run overrides prior successes: failed, parse-failed, timed-out, malformed, or schema-invalid evidence is critical | Not applicable |
| Liveness guard (self-healing) | `MemoryDeltaSurface.hook.ts` touches `MEMORY/STATE/delta-surface-heartbeat` every run | The heartbeat file and `memory-health.jsonl` | A `<lifeos-memory-health>` block that nags every turn until fixed | `MemoryHealthCheck` lists the hook in `REQUIRED_HOOKS` for both settings files and goes critical with `delta-surface-dead` when memory writes run more than 24h past the heartbeat. This bounds detection of a silently unregistered hook to 24 hours | Manual re-registration |
| Cortex CLI | `bun LIFEOS/TOOLS/Cortex.ts` with `status`, `search`, `timeline`, `get`, `export`, `rebuild`, `remember`, `propose` | Canonical Markdown and JSONL | Only `remember` and `propose` write, and both require an explicit `--allow-write` plus a recognized `--adapter` | Adapter calls are read-only by default. `remember` accepts `memory\|idea\|knowledge`; `propose` accepts only `proposal` | Delegates to `MemorySystem.add()` so mutation tiers, proposal approval, target pinning, audit trail, snapshots, and shrink guard stay authoritative |

- Never written automatically: Tier D covers everything not enumerated, explicitly including `.env`, `settings.json`, `hooks/`, code, `CLAUDE.md`, `LIFEOS_SYSTEM_PROMPT.md`, `Algorithm/`, and `skills/`. Claude Code's own auto memory is disabled by design (`autoMemoryEnabled: false` in shipped settings, plus deny rules on that path). The memory-line sample text passes an instruction-shape filter and renders a withheld placeholder instead, because memory items can originate from external content and echoing them verbatim into context is an injection channel. Cortex leaves transcript bytes untouched and sanitizes only its own copy of `<private>` spans.
- Evidence of real use: 19,005 stars, pushed 2026-09-04. The memory doc carries dated incident entries: a cross-vendor audit wiped the live file with an empty `op:"set"`, which produced the shrink guard; public issue #1761 reported 12 durable rules dying in 48 hours from slow erosion, which produced the erosion guard; public issue #1711 produced per-session cadence state; public PR #1563 produced target-file pinning; a five-day dead hook surface produced the heartbeat. A verified benchmark artifact is committed at `LIFEOS/MEMORY/BENCHMARKS/cortex-benchmark-v1-20260802.json`.
- Generalizes: three things. First, curation as full-set replace rather than append, so forgetting is omission and the cap can never jam. Second, a snapshot ring buffer before every automatic overwrite, which makes an individual write reversible at finer granularity than a git commit. Third, tier the destinations rather than the content: type says where an item belongs, tier says whether the write is allowed, and the two are never collapsed.
- Idiosyncratic: the confidence thresholds (0.70 auto-apply, 0.40 to 0.69 human review) are tuned to this one reviewer prompt. The three-condition AND-gated cadence with a per-session turn counter and a global minutes clock exists because a per-session cap would let N sessions run N reviews per window.
- Sources:
  - https://github.com/danielmiessler/LifeOS/blob/5e2f2e8/LifeOS/install/LIFEOS/DOCUMENTATION/Memory/MemorySystem.md, accessed 2026-09-13.
  - https://github.com/danielmiessler/LifeOS/tree/5e2f2e8/LifeOS/install/LIFEOS/TOOLS (file listing for `MemoryReviewer.ts`, `MemoryRestore.ts`, `MemoryHealthCheck.ts`, `SkillDriftLint.ts`, `SkillHygieneGate.ts`, `Reflect.ts`, `Cortex.ts`), accessed 2026-09-13.

---

### NousResearch/hermes-agent

- URL: https://github.com/NousResearch/hermes-agent. 245,075 stars, last push 2026-09-13, MIT. Read at SHA `422bc9bde9d212ab3741fbc45a871a3938436d59`.
- Purpose: a file-based memory pair plus a skills directory, maintained by a background curator that archives rather than deletes and runs on inactivity rather than a cron.
- Layers:
  - Raw traces: session transcripts and trajectories (`save_trajectories` parameter). Not a directory under the memory root.
  - Durable knowledge: `~/.hermes/memories/MEMORY.md` (agent notes) and `~/.hermes/memories/USER.md` (user profile), profile-scoped by `get_hermes_home()`. Entries are `§`-delimited chunks. Defaults are a 2,200-character limit for `MEMORY.md` and 1,375 for `USER.md`.
  - Active procedures: `~/.hermes/skills/`, with curator scheduler state at `~/.hermes/skills/.curator_state`. `AGENTS.md` at the repo root and per-directory `AGENTS.md` files supply instructions; subdirectory `AGENTS.md` hints append to a tool result rather than the system prompt.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| `memory` tool (capture) | Agent decides during a turn. Single tool with `add`, `replace`, `remove`, or a batch `operations` list | `MEMORY.md`, `USER.md` | The same two files, via `MemoryStore._write_file` using an atomic temp-file plus rename, with `fcntl` on Unix and `msvcrt` on Windows | Character caps enforced from config (`memory_char_limit`, `user_char_limit`). Approval paths (gateway, Desktop, `/memory`) load an on-disk store with the same caps so approvals enforce identical limits | Not found. The file is plain Markdown |
| Frozen prompt snapshot | Session start | `MEMORY.md`, `USER.md` | Nothing | Both files enter the system prompt as a frozen snapshot at session start. Mid-session writes hit disk but never change the prompt, which preserves the prefix cache | Not applicable |
| Curator (consolidate, prune) | Inactivity-triggered, no cron daemon. `maybe_run_curator()` fires when the agent is idle and the last run is older than `interval_hours`. Defaults: `interval_hours` 7 days, `min_idle_hours` 2, `stale_after_days` 14, `archive_after_days` 30 | Skill usage timestamps, `.curator_state` | Auto-transitions lifecycle states from activity timestamps. Optionally forks an agent that may pin, archive, consolidate, or patch skills via `skill_manage`. Persists scheduler state to `.curator_state` | Only curator-managed skills are touched. Pinned skills bypass all auto-transitions. The LLM consolidation fork is opt-in (`DEFAULT_CONSOLIDATE = False`); the deterministic inactivity prune always runs when the curator is enabled. The fork uses the auxiliary client and never touches the main session's prompt cache. `set_paused(True)` stops it | "never delete, only archive (recoverable)". Recover with `hermes curator restore` |
| Journey edit and delete | User command: CLI `hermes journey`, TUI `/journey` overlay, or desktop | `agent/learning_graph.py` node ids: a skill's name, or `memory:<source>:<index>` where source is `memory` or `profile` | Deleting a skill archives it. Deleting a memory rewrites its file | User-initiated. A stale node id raises "memory node id is stale, refresh the graph" rather than editing the wrong entry | Skill: `hermes curator restore`. Memory: not found |

- Never written automatically: the curator never deletes a skill. Pinned skills are never auto-transitioned. Non-curator-managed skills are never touched. The system prompt is byte-stable for the life of a conversation, so nothing reloads memories mid-conversation; anything that must inject mid-conversation rides a user message or a tool result.
- Evidence of real use: 245,075 stars, pushed the same day as this research. A large ecosystem of third-party repos referencing it. A `.github/workflows/skills-index-freshness.yml` workflow, which is itself an index-staleness check in CI. An `archive-skill-confirm-dialog.tsx` in the desktop app, so archiving is a confirmed UI action there.
- Generalizes: three things. First, an inactivity trigger with an idle floor and an interval ceiling, which needs no scheduler. Second, archive instead of delete plus a named restore command, so pruning is always reversible. Third, a pin flag that exempts an item from every automatic transition, which is the cheapest possible human override.
- Idiosyncratic: the prompt-cache invariant drives the design. Memory enters as a frozen snapshot and nothing reloads it, which means a mid-session memory write is invisible until the next session. That tradeoff only makes sense where prefix caching is the dominant cost.
- Sources:
  - https://github.com/NousResearch/hermes-agent/blob/422bc9b/agent/curator.py, accessed 2026-09-13.
  - https://github.com/NousResearch/hermes-agent/blob/422bc9b/agent/learning_mutations.py, accessed 2026-09-13.
  - https://github.com/NousResearch/hermes-agent/blob/422bc9b/tools/memory_tool.py, accessed 2026-09-13.
  - https://github.com/NousResearch/hermes-agent/blob/422bc9b/agent/AGENTS.md, accessed 2026-09-13.

---

### conorbronsdon/agent-context-os

- URL: https://github.com/conorbronsdon/agent-context-os. 24 stars, last push 2026-09-11, MIT. Read at SHA `15b5acace6830e4cac58e56cf1a102ea6557e762`. Found by GitHub code search `gh search code "dream path:.claude/commands"`; chosen because it was the only result with a separate apply command (`dream-apply.md`), which means the propose and apply steps are distinct artifacts.
- Purpose: a curator pass writes a reviewable proposal artifact to disk, and a separate command walks each proposal and applies only the ones a human individually accepts.
- Layers:
  - Raw traces: `sessions/YYYY-MM-DD.md` session logs, plus `state/decisions.md`, `state/blockers.md`, `state/current.md`, plus the work repo's git log.
  - Durable knowledge: `$MEMORY_DIR`, resolved by `.context-os/memory-directory`, containing `MEMORY.md` (the index), `ARCHIVE.md` (the tombstone table), topic files named `project_*.md`, `reference_*.md`, `env_*`, `feedback_*`, `user_*`, and `archive/` for retired files. Proposal artifacts live at `$MEMORY_DIR/.dreams/{ISO-timestamp}/` with `inputs.json`, `proposals.json`, and `REPORT.md`.
  - Active procedures: `.claude/commands/*.md`, `.agents/skills/*/SKILL.md`, `.claude/hooks/*.sh`, `.ssot.yaml`, and a `.github/workflows/ssot.yml` CI check.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| capture, start, update, end | Explicit commands and skills | Session state | `sessions/`, `state/` | User-invoked | Git |
| `/dream {curator}` (consolidate, propose only) | Explicit user command. `disable-model-invocation: true`, so the model cannot call it | Content curators (`rot`) read `$MEMORY_DIR/*.md` project and reference files, `state/*.md`, session logs selected by filename date over the last 14 days, and `git log --since="14 days ago"`. Structural curators (`merge`, `split`, `lint`) read every detail file, `MEMORY.md`, `ARCHIVE.md`, and optionally 30 days of memory-repo git log | `$MEMORY_DIR/.dreams/$TS/inputs.json`, `proposals.json`, `REPORT.md`. Nothing else | `python3 scripts/dream/validate-memory.py resolve` runs before any read or write. It verifies `.context-os/memory-directory`, rejects non-canonical or symlinked paths, requires `MEMORY.md` and `.context-os-repository`, binds the marker to git's resolved common directory identity so linked worktrees are safe, requires the memory dir to be its own git repo, refuses any memory remote, and requires tracked, staged, and untracked memory state to be clean before the pass. "Be conservative, empty-evidence proposals get rejected at apply time." Every proposal carries `id`, `action`, `reasoning`, a non-empty `evidence` array, and `confidence` | The pass writes no memory content, so there is nothing to roll back |
| `/dream-apply {ts\|latest}` (promote, prune, repair) | Explicit user command. `disable-model-invocation: true` | The validated `proposals.json` and `REPORT.md` | Applies only accepted proposals to `$MEMORY_DIR` | `python3 scripts/dream/validate-memory.py artifact` rejects malformed timestamps, path traversal, absolute or control-character arguments, symlinked artifact components, missing `proposals.json` or `REPORT.md`, malformed or colliding proposal schemas, unknown or roadmap actions, empty evidence, unsafe control-file targets, and any proposal filename outside the validated memory root. It also requires the memory repo to be clean. Then each proposal is shown and answered through `AskUserQuestion` with Accept, Reject, Edit then accept, Skip rest. Option order is by confidence: high orders Accept first, medium orders Reject first to force reading, and `flag` orders Reject first with Accept as opt-in | Memory dir is its own git repo, required clean before both commands, so any applied set is a reviewable diff |
| archive action | Accepted `archive` proposal | `python3 scripts/dream/validate-memory.py archive-state "{target}" --today "{today}"` | Five steps, all required: classify fresh, resume, or complete; append one row to `ARCHIVE.md` only when `append_row` is true; insert `archived: {date}` as the last frontmatter line only when `insert_stamp` is true; `mkdir -p "$MEMORY_DIR/archive"` then `git -C "$MEMORY_DIR" mv`; then remove the line from `MEMORY.md` | Root and destination collisions, missing targets, duplicate rows or stamps, and mismatched stamp dates fail closed for manual review. Before archiving, count how many live memories link to the target; heavy inbound linkage is evidence it is still load-bearing | "Never `rm` an archived file." It stays readable under `archive/` for on-demand recall. A partially applied archive is detected and resumed by the `archive-state` classifier rather than reapplied |
| merge and split actions | Accepted structural proposal | Targets plus `MEMORY.md` | Merge writes the survivor, `git rm`s each absorbed file, appends its tombstone to `ARCHIVE.md`, applies `index_changes` to `MEMORY.md`, and redirects dangling wikilinks to the survivor. Split writes each child, `git rm`s the original when it is not among the children, appends a tombstone naming the children, applies index changes, and repoints live links at whichever child carries the fact | "Never remove a memory file without a tombstone. A silent deletion is unrecoverable except by git archaeology" | `git rm` inside the memory repo, so the content is recoverable from memory git history, and the tombstone row names where it went |
| Link repair | Part of the archive action | Grep for the slug; do not assume the proposal enumerated the links | Three directions: inbound live files get links to `slug.md` redirected to `archive/slug.md`, and wiki links converted to Markdown links, excluding `MEMORY.md`; outbound links inside the moved file get links to `x.md` redirected to `../x.md`; unresolved `[[links]]` pointing at nothing are left alone as deliberate placeholders | The exclusion of `MEMORY.md` exists because step 5 owns that line and rewriting it early breaks step 5's excerpt match | Same as archive |
| Index size check (prune trigger) | After any merge, split, or add | `wc -l $MEMORY_DIR/MEMORY.md` | Nothing | Over 100 lines, tell the user and suggest a follow-up `/dream merge` pass | Not applicable |
| `/reconcile` (repair, detect) | Explicit user command, user-only because its optional fix mode can write and commit | `git rev-list --left-right --count`, `git status --short`, `git stash list`, `git log --all --oneline --since="24 hours ago" --graph`, recently modified Markdown | Report. Optional fixes are proposed and separately approved | "It never pulls, rebases, or moves the working tree. Sync divergence is reported, not fixed." The stated reason: an auto-rebase in a shared checkout can strand other sessions' worktree bases, which is the situation the command is run to diagnose | Not applicable in scan mode |
| `/recover` (repair, detect) | Explicit user command | `git worktree list --porcelain`, per-worktree `status`, `branch --show-current`, `log`, and `git branch --no-merged "$DEFAULT"` | Report. Cleanup is separately gated | Read-only by default. Without a lock, heartbeat file, or process evidence, a recently touched worktree is classified "unknown activity" and never "orphaned". Each candidate is classified CLEAN, HAS COMMITS, HAS CHANGES, or BOTH. The default branch is detected, never hardcoded | Not applicable in scan mode |
| `session-start.sh`, `ssot-guard.sh`, `branch-hygiene.sh`, `worktree-guard.sh` | Claude Code hooks | Repo state | Guard decisions | `.ssot.yaml` plus a CI workflow enforce single-source-of-truth rules | Not applicable |

- Never written automatically: both dream commands set `disable-model-invocation: true`, so the model cannot start either one. `flag` proposals write nothing, they only surface. `/reconcile` never pulls or rebases. `/recover` never removes a worktree without approval. No memory file is ever removed without a tombstone row. Archived files are never deleted. Both commands refuse to run when the memory repo is dirty, so host auto-memory changes are never swept into a curator diff.
- Evidence of real use: 24 stars, pushed 2026-09-11, a `CHANGELOG.md`, release and validate CI workflows, and `x-source` plus `x-source-version` frontmatter on each command pointing at a `maintainer-core` upstream at a specific commit. The archive procedure documents its own failure mode by name: skipping `mkdir -p` kills the step at exit 128 after the row and the stamp have already been written.
- Generalizes: the strongest pattern in this slice. The consolidate pass writes a proposal artifact to disk and touches nothing else; a second, separately invoked command validates that artifact with an executable checker and applies one proposal at a time through a human answer. The confidence level changes the button order rather than the permission, so a medium-confidence proposal forces the reviewer to read before accepting. The `inputs.json` file makes the run reproducible. The session-log selection by filename rather than mtime exists because a git history rewrite resets mtime on every tracked file.
- Idiosyncratic: the memory directory is required to be its own git repo with no remote. The `archive-state` three-way classifier (fresh, resume, complete) exists because the archive action has five steps and can die between them.
- Sources:
  - https://github.com/conorbronsdon/agent-context-os/blob/15b5aca/.claude/commands/dream.md, accessed 2026-09-13.
  - https://github.com/conorbronsdon/agent-context-os/blob/15b5aca/.claude/commands/dream-apply.md, accessed 2026-09-13.
  - https://github.com/conorbronsdon/agent-context-os/blob/15b5aca/.claude/commands/reconcile.md, accessed 2026-09-13.
  - https://github.com/conorbronsdon/agent-context-os/blob/15b5aca/.claude/commands/recover.md, accessed 2026-09-13.

---

### year-of-ai/2005

- URL: https://github.com/year-of-ai/2005. 0 stars, last push 2026-09-12, no license declared. Read at SHA `738d453ef29827969d32fca6e98eed559d1f2c3e`. Found by GitHub code search `gh search code "consolidate path:.claude/commands"`; chosen because its commit history shows an agent author committing on a schedule, which is direct evidence of an unattended loop rather than a documented intention.
- Purpose: a self-growing Markdown knowledge base that runs growth cycles, mines its own telemetry for friction, edits its own prompt layer, and eventually merges a whole lineage of sibling repos into one.
- Layers:
  - Raw traces: `telemetry/evolution.jsonl.gz` (the just-closed generation) and `telemetry/learnings.jsonl` (already-captured learnings). The repo's own `CLAUDE.md` calls `telemetry/` "the historical growth ledger, append-only record, do not rewrite".
  - Durable knowledge: content directories per taxonomy category, plus `INDEX.md`, `TIMELINE.md`, `README.md`, and `seed.md` (which carries the Concept Definition and an Evolution Log in section 8).
  - Active procedures: `.github/prompts/*.prompt.md` (canonical playbooks), `.github/skills/*/SKILL.md`, `.github/agents/*.agent.md`, `.github/instructions/content.instructions.md`, mirrored by `.claude/commands/*.md`, `.claude/skills/*/SKILL.md`, and `.claude/agents/*.md`. Lifecycle state in `lifecycle.yml`.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| `/grow` (capture) | Scheduled growth tick. Commits are authored by `claude-grow` | `seed.md` for subject, scope, taxonomy, source strategy | Content files at `<category-slug>/<topic-slug>.md` with `title`, `date`, `category` frontmatter, plus a knowledge-table row in the README | The curator agent must confirm a topic in scope from 2 or more authoritative sources, must not duplicate an existing knowledge-table row, and must not write speculatively or editorially. It is a leaf worker: it does the content work itself, spawns no subagents, and never pushes to GitHub directly | Git |
| `/learn` (consolidate into the prompt layer) | Per-cycle, off the growth critical path. Window defaults to "since last replant or distill" | `telemetry/evolution.jsonl.gz` and `telemetry/learnings.jsonl` | At most 3 minimal edits to the canonical `.github/` prompt layer, biased toward removing work (embed known facts, delete redundant steps, tighten thrash), one record per edit in the learnings ledger | Scope is framework files plus `telemetry/learnings.jsonl` only, never content, `seed.md`, or `lifecycle.yml` state. Safe-class edits open an auto-merged PR; structural edits stay open for review | Git, plus the PR review for structural edits |
| `/distill` (promote to a portable seed) | Lifecycle phase must be `distill` (lineage at or above `distill_at_members`, `state.distilled_at` null) or `--force` | Every lineage member's `seed.md` section 8 Evolution Log, lifecycle state, content quality, framework, and the driver's merged-PR failure ledger | Concept-agnostic cycle improvements to the live framework, a `seed-package/` (README, `seed.template.md`, `lifecycle.template.yml`, `MANIFEST.md` naming the minimal load-bearing framework files), sets `state.distilled_at`, appends a `### Distillation` Evolution Log entry | Phase gate on `lifecycle.yml`, or explicit `--force` | Git |
| `/consolidate` (prune by merge) | Lifecycle phase must be `consolidate` (lineage at or above `consolidate_at_members`, this repo is the newest member). `--dry-run` plans without creating or archiving | `lifecycle.yml` for `consolidation.naming_rule` and `consolidation.layout`, `.github/prompts/consolidate.prompt.md` as the canonical playbook | Creates a consolidated repo named by the rule, one top-level directory per member holding its content, its `seed.md` with the Evolution Log preserved verbatim, and its `README.md`; a range-spanning root `seed.md`, `README.md`, `lifecycle.yml` with `status: consolidated`, and the verbatim `.github/` and `.claude/` layers so it can keep growing; a master INDEX and TIMELINE | `check-lifecycle` must report phase `consolidate`. Finalize this repo first if it is still growing. Verify no files lost before publishing | "Retire members: status `consolidated`, README banner pointing to the new repo, push, then archive on GitHub. Never delete" |
| `/pollinate` | After a `/learn` or `/distill` edit | Framework edits | Fans the edits across the lineage | Not read | Git |
| `/replant`, `/evolve`, `/encode-seed`, `/publish`, `/update-readme`, `/deep-dive` | Lifecycle commands | Varies | Varies | Not read | Git |

- Never written automatically: `/learn` never touches content, `seed.md`, or `lifecycle.yml` state. Consolidation never deletes a member repo, it archives it. Evolution Logs are preserved verbatim through a merge. The curator never pushes to GitHub; publishing is the orchestrator's job via the `publish-session` skill.
- Evidence of real use: commits authored by `claude-grow` on a roughly three-day cadence through 2026-09-12, with messages of the form `content: growth tick (Haiku -> Sonnet -> Opus)`. Caveat: this repo's own `CLAUDE.md` states that in June 2026 the framework was consolidated into `year-of-ai/year-of-ai.github.io` and the lineage continued in `year-of-ai/2005-2011`, so what remains here is content plus Pages config, and the `.claude/` directory is described as legacy and pending removal. The commands recorded above are read from this repo at the SHA above; the live framework was not read.
- Generalizes: the `/learn` loop is the only example in this slice where a system edits its own instruction files from its own telemetry, with a hard cap on the number of edits (3), a stated bias toward deletion, a ledger row per edit, and a split between auto-merged safe edits and human-reviewed structural edits.
- Idiosyncratic: the lineage model, where a workspace spawns successors and eventually merges a whole family into one repo, only makes sense for a fleet of sibling knowledge bases.
- Sources:
  - https://github.com/year-of-ai/2005/blob/738d453/.claude/commands/learn.md, accessed 2026-09-13.
  - https://github.com/year-of-ai/2005/blob/738d453/.claude/commands/distill.md, accessed 2026-09-13.
  - https://github.com/year-of-ai/2005/blob/738d453/.claude/commands/consolidate.md, accessed 2026-09-13.
  - https://github.com/year-of-ai/2005/blob/738d453/.claude/agents/curator.md, accessed 2026-09-13.
  - https://github.com/year-of-ai/2005/blob/738d453/CLAUDE.md, accessed 2026-09-13.

---

### steeltanuki/sebastian-ai

- URL: https://github.com/steeltanuki/sebastian-ai. 0 stars, last push 2026-07-06, MIT. Read at SHA `945fa7b4110904488d0b1049cb44ed79d596a41a`. Found by GitHub code search `gh search code "consolidate path:.claude/commands"`; chosen as the smallest complete loop in the set, useful as a floor for what a minimal implementation contains.
- Purpose: weekly journal entries are consolidated into durable category files, the raw entries move to an archive, and the index is kept in sync.
- Layers:
  - Raw traces: `memory/journal/` weekly files, and `memory/journal/archive/YYYY-MM.md` after consolidation.
  - Durable knowledge: category files under `memory/`, `memory/finance/expenses/YYYY-MM.md`, `memory/finance/summary.md`, and the timeline ladder `memory/journal/timeline/YYYY-MM.md`, `.../YYYY.md`, `.../LIFE.md`.
  - Active procedures: `CLAUDE.md` holds the durability rules, `INDEX.md` is the catalog.

| Operation | Trigger | Reads | Writes | Gate | Rollback |
|---|---|---|---|---|---|
| `/consolidate` | Explicit weekly command | Journal entries in `memory/journal/` for the current week that have not yet been consolidated | Category files under `memory/`, a week-summary section in `memory/journal/timeline/YYYY-MM.md`, expense rows in `memory/finance/expenses/YYYY-MM.md`, `INDEX.md` when a new category file is created | "Consolidate only durable information, per the rules in CLAUDE.md": a durable habit, preference, or fact, not a one-off event. Update in place rather than duplicating. Expense dedup skips a row with the same date, amount, and merchant | Git. The command ends by running `git add -A && git commit -m "consolidate journal week of YYYY-MM-DD"` |
| Month and year close (promote by distillation) | When a consolidation closes a month or a year | The month's timeline file, then the year's | A month section in `memory/journal/timeline/YYYY.md`, a refreshed current-year section in `LIFE.md` (rewrite, do not append), a final paragraph in `LIFE.md` on year close, and a collapse of that year's monthly finance tables into one yearly table | Rewrite versus append is specified per target | Git |
| Compaction check (prune) | Same pass | Any category file touched, or any file listed in `INDEX.md` | Compresses older entries or splits the file into a subfolder with its own files, then updates `INDEX.md` to match | Threshold: roughly 100 lines | Git |
| Archive | Same pass | The consolidated raw entries | `memory/journal/archive/YYYY-MM.md`, append | "append, never delete" | Git |

- Never written automatically: nothing runs without the user typing the command. Raw entries are moved to an archive file, never deleted.
- Evidence of real use: none found. 0 stars, no issues read, one push in July 2026. Recorded here as a minimal reference implementation, not as a proven system.
- Generalizes: the ~100-line compaction threshold on any file listed in the index, which matches agent-context-os's 100-line check on `MEMORY.md` and Claude Code's 200-line index bound. Also the timeline ladder: week rolls into month, month into year, year into a single life file, each level a rewrite of the level above rather than an append.
- Idiosyncratic: finance-specific dedup and table-collapse rules.
- Sources:
  - https://github.com/steeltanuki/sebastian-ai/blob/945fa7b/.claude/commands/consolidate.md, accessed 2026-09-13.

---

## Operations across systems

Y means the system implements it. Partial means it exists but only in a limited form, or only detects without acting. N means not found. The trigger is in parentheses.

| System | capture | consolidate | promote | prune | repair | rollback |
|---|---|---|---|---|---|---|
| WikiSkill | Y (every iteration, automatic) | Y (after rollouts, automatic) | Y (after wiki maintenance, one skill per iteration) | N | N | Y (validation score below best, automatic revert of skills only) |
| llm-wiki gist | Y (user-initiated ingest) | Y (ingest, user-reviewed) | N | N | Partial (periodic lint, report only) | N |
| Voyager | Y (after critic verification) | N | Y (same step as capture) | N | Partial (startup assert on index/file disagreement, manual fix) | Partial (old file kept under a V2 name; no revert path) |
| Letta | Y (agent file edits) | Y (dreaming: N completed steps, or context compaction) | Partial (`skills/` under `$MEMORY_DIR`, no documented promotion pass) | N | Partial (`/doctor` audit) | Y (git-backed memory repo) |
| Claude Code auto memory | Y (Claude decides mid-session, on by default) | Partial (index rewrite prompted by the 200-line/25KB limit) | N (auto memory and CLAUDE.md stay separate) | Y (harness reminder, then error on index over limit) | Partial (`/doctor` proposes CLAUDE.md trims) | N (manual edit or delete via `/memory`) |
| OpenAI Codex memories | Y (chat idle, background, off by default) | Y (separate `consolidation_model`) | N (docs direct rules to `AGENTS.md` instead) | N | N | N |
| obsidian-second-brain | Y (capture, daily, log commands) | Y (`/obsidian-emerge`, `/obsidian-learn`, plus session-end and PostCompact hooks) | Y (`/obsidian-learn` at 3+ occurrences, `/obsidian-graduate`, both confirmed) | Partial (learnings classified Stale, archive suggested, never automatic) | Y (`/obsidian-health` scripts, `/obsidian-reindex`, safe fixes offered, destructive fixes confirmed) | N (policy is add, update, link only; never delete) |
| claude-obsidian | Y (`capture`, create-only into `.raw/`) | Y (`ingest`, transaction-gated) | Partial (canonical merge is a separate approved transaction) | Y (`wiki-fold`, explicit only, additive rollup) | Y (`wiki-lint` detect, then a separate approved repair bundle) | Y (transaction journal, exit 75 retry, `transaction recover`, optional `checkpoint` to git) |
| LifeOS Cortex | Y (per-event hooks) | Y (MemoryReviewer on Stop, AND-gated on 8 turns, 30 min, 2 min idle) | Y (proposals with `target_kind`; 0.70+ auto-applies, 0.40 to 0.69 human-reviewed) | Y (forgetting by omission in a full-set replace) | Y (`MemoryHealthCheck` on every Stop, plus a 24h hook-liveness heartbeat) | Y (snapshot ring buffer, last 30 per file, `MemoryRestore.ts`) |
| hermes-agent | Y (`memory` tool mid-turn) | Y (curator fork, opt-in, inactivity-triggered) | Partial (curator may pin or patch skills) | Y (deterministic inactivity prune: stale at 14 days, archive at 30) | N | Y (archive not delete, `hermes curator restore`) |
| agent-context-os | Y (capture, start, update, end) | Y (`/dream {rot\|merge\|split\|lint}`, explicit, proposal artifact only) | Y (`/dream-apply`, one proposal at a time via `AskUserQuestion`) | Y (archive, merge, split actions, each tombstoned) | Y (`/dream lint`, `/reconcile`, `/recover`, all detect-first; plus three-direction link repair inside archive) | Y (memory dir is its own clean git repo; `archive-state` classifier resumes a half-applied archive) |
| year-of-ai/2005 | Y (`/grow` on a schedule, agent-authored commits) | Y (`/learn` per cycle from telemetry) | Y (`/distill` at a lifecycle phase gate; `/learn` edits the prompt layer, max 3 edits) | Y (`/consolidate` merges a lineage and archives members) | N | Y (git, plus PRs left open for structural edits) |
| sebastian-ai | Y (journal entries) | Y (`/consolidate`, weekly, explicit) | Y (month and year close distillation) | Y (~100-line compaction check; archive by append) | N | Y (git commit at the end of the pass) |

Totals across 13 systems: capture 13 Y. Consolidate 11 Y, 1 partial, 1 N. Promote 6 Y, 4 partial, 3 N. Prune 6 Y, 2 partial, 5 N. Repair 5 Y, 5 partial, 3 N. Rollback 7 Y, 1 partial, 5 N.

---

## The minimum loop

Every credible system in this set shares exactly three operations and one boundary.

Capture writes a dated, append-only trace that nothing later rewrites. Consolidate reads that trace plus the current durable set and writes durable knowledge. An index file lists what exists and a log file lists what happened. That is the whole floor: `raw/` or `sessions/`, a knowledge directory, `index.md`, `log.md`.

The boundary every one of them draws is between knowledge and procedure. Knowledge accumulates and is cheap to be wrong about. Procedure changes behavior and is expensive to be wrong about, so it is gated. WikiSkill states this most plainly: when a skill is rolled back the wiki persists and compounds. Codex states the same thing as doctrine, that memories are a recall layer and `AGENTS.md` is where rules that must always apply live.

They diverge first on who approves the promotion. Three answers appear. An automatic numeric gate on a held-out score (WikiSkill, and Voyager's critic). A confidence threshold that splits automatic from human (LifeOS at 0.70). A human answering one proposal at a time (agent-context-os, claude-obsidian, obsidian-second-brain). Which one a workspace can use depends entirely on whether it has a runnable score. Most do not, so most end up at the third.

---

## Names people actually use

Counts are across the 13 systems recorded above.

Raw trace layer:
- `raw/` (3: WikiSkill, llm-wiki gist, claude-obsidian as `.raw/`)
- `sessions/YYYY-MM-DD.md` (1: agent-context-os)
- `telemetry/*.jsonl` (1: year-of-ai)
- `OBSERVABILITY/*.jsonl` (1: LifeOS)
- `memory/journal/` (1: sebastian-ai)
- `Logs/YYYY-MM-DD.md` (1: obsidian-second-brain)
- Host transcript store reused as the trace layer (2: LifeOS, Claude Code auto memory)

Durable knowledge layer:
- `wiki/` (4: WikiSkill, llm-wiki gist, claude-obsidian, obsidian-second-brain in wiki mode)
- `memory/` or `$MEMORY_DIR` or `~/.codex/memories/` or `~/.hermes/memories/` (5: agent-context-os, Letta, Codex, hermes-agent, sebastian-ai)
- `~/.claude/projects/<project>/memory/` (1: Claude Code auto memory)
- `LIFEOS/MEMORY/` (1: LifeOS)
- `Knowledge/`, `Ideas/`, `Projects/` (1: obsidian-second-brain in Obsidian mode)

Index file:
- `index.md` or `INDEX.md` (5: WikiSkill as `wiki/index.md`, llm-wiki gist, claude-obsidian, obsidian-second-brain, sebastian-ai)
- `MEMORY.md` as the index (3: Claude Code auto memory, agent-context-os, hermes-agent)
- `skills.json` (1: Voyager)
- `TIMELINE.md` alongside `INDEX.md` (1: year-of-ai)

Log file:
- `log.md` (3: llm-wiki gist, claude-obsidian, obsidian-second-brain)
- `logs.md` (1: WikiSkill, as `wiki/logs.md`)
- Line format `## [YYYY-MM-DD] operation | summary` appears in 2 independently (llm-wiki gist, obsidian-second-brain).

Active procedure layer:
- `skills/{name}/SKILL.md` (5: WikiSkill, Letta, claude-obsidian, hermes-agent, year-of-ai)
- `CLAUDE.md` / `AGENTS.md` / `_CLAUDE.md` as the instruction file (7: llm-wiki gist, Claude Code, Codex, obsidian-second-brain, agent-context-os, year-of-ai, sebastian-ai)
- `.claude/commands/*.md` (4: obsidian-second-brain, agent-context-os, year-of-ai, sebastian-ai)
- `seed.md` (1: year-of-ai)

Archive and tombstone:
- `ARCHIVE.md` plus an `archive/` directory (1: agent-context-os)
- `memory/journal/archive/YYYY-MM.md` (1: sebastian-ai)
- `wiki/folds/` (1: claude-obsidian)
- `MEMORY/OBSERVABILITY/memory-snapshots/` (1: LifeOS)
- Curator archive recoverable by command (1: hermes-agent)

Command names for the consolidate operation:
- `dream` (2: agent-context-os, plus a false positive at glittercowboy/plugin-freedom-system where `/dream` means ideation, not consolidation)
- `consolidate` (3: agent-context-os as a dream curator concept, year-of-ai, sebastian-ai; and 10 further hits in the code search not recorded here)
- `learn` (2: obsidian-second-brain as `/obsidian-learn`, year-of-ai as `/learn`)
- `ingest` (2: llm-wiki gist, claude-obsidian)
- `curator` (3: hermes-agent, year-of-ai agent, agent-context-os prompt directory `scripts/dream/prompts/`)
- `emerge`, `synthesize`, `distill`, `reconcile`, `fold`, `reviewer` (1 each)

Command names for the repair operation:
- `lint` (3: llm-wiki gist, claude-obsidian, agent-context-os as a dream curator)
- `health` (2: obsidian-second-brain `/obsidian-health`, LifeOS `MemoryHealthCheck`)
- `doctor` (2: Letta, Claude Code)
- `reconcile` (2: agent-context-os, obsidian-second-brain `/obsidian-reconcile`)
- `recover` (2: agent-context-os, claude-obsidian `transaction recover`)
- `reindex` (1: obsidian-second-brain)

Index size thresholds found: 200 lines or 25KB (Claude Code `MEMORY.md`), 100 lines (agent-context-os `MEMORY.md`), ~100 lines (sebastian-ai, any indexed file), 48 entries of 256 chars (LifeOS hot layer), 2,200 and 1,375 characters (hermes-agent `MEMORY.md` and `USER.md`), 200 lines as a target for `CLAUDE.md` (Claude Code).

Promotion thresholds found: 3 or more occurrences (obsidian-second-brain `/obsidian-learn`, and its `/obsidian-health` concept-gap rule of a term mentioned 3+ times across different notes), confidence 0.70 (LifeOS auto-apply) and 0.40 (LifeOS discouraged floor), 2 or more authoritative sources (year-of-ai curator), at most 3 edits per cycle (year-of-ai `/learn`), one skill per iteration (WikiSkill).

---

## Uncertainties

- `https://docs.letta.com/guides/agents/memfs` returned 404. MemFS git commit, push, versioning, and rollback commands were described only at the level of "edits remain local until committed and pushed" on `concepts/memfs`. The exact `letta` CLI subcommands for commit, diff, and revert were not read. The dreaming page does not name which files or memory blocks a dream pass edits, so that row is recorded as "not documented".
- The Codex memories page is served from `learn.chatgpt.com` after a 308 from `developers.openai.com/codex/memories`. The page named the directory `~/.codex/memories/` and described its contents as summaries, durable entries, recent inputs, and supporting evidence, but did not give per-file names. No view or delete command beyond `/memories` was documented on the page read. Regional availability (European Economic Area, United Kingdom, Switzerland) was mentioned in a search result title but the body text on that restriction was not read in full.
- The karpathy gist was read through WebFetch, which summarizes through a model rather than returning raw text. The four operation names, the `raw/` and `wiki/` directories, `index.md`, `log.md`, and the log line format are reported by that summary. A `compile` operation was named in the task brief but the summary did not separate it from the ingest and index-update path, so its row is left blank rather than guessed.
- The WikiSkill record is from the rendered HTML of sections 3.1 and 3.2, also through WebFetch. Directory names (`raw/`, `wiki/patterns/`, `wiki/logs.md`, `wiki/skill-impact.md`, `wiki/index.md`, `skills/{name}/SKILL.md`, `skills/{name}/PURPOSE.md`) are as reported there. No repository accompanying the paper was located, so none of it was verified against code.
- `year-of-ai/2005` states in its own `CLAUDE.md` that the framework moved to `year-of-ai/year-of-ai.github.io` in June 2026 and that its `.claude/` directory is legacy and pending removal. The command files recorded above therefore describe the loop as of that SHA, not necessarily the live framework. The live framework repo was not read. The `claude-grow` commit cadence through 2026-09-12 is direct evidence that some loop still runs against this repo.
- `glittercowboy/plugin-freedom-system` (214 stars) surfaced in the `/dream` search and was read, but its `/dream` is a plugin ideation router that writes to `plugins/[Name]/.ideas/`. It implements no memory consolidation, so it is excluded from the system count and recorded here as a naming collision.
- GitHub code search queries `"MEMORY.md" consolidate`, `"consolidate" "MEMORY.md" path:SKILL.md`, `"link check" vault path:AGENTS.md`, and `"rebuild index" "second brain"` all returned zero results. The productive queries were `dream path:.claude/commands` and `consolidate path:.claude/commands`.
- No gh rate limit was hit.
- LifeOS has `SkillHygieneGate.ts`, `SkillDriftLint.ts`, and `Reflect.ts` in `LIFEOS/TOOLS/`, which appear to be a skill-layer maintenance path parallel to the memory path. Those files were not read, so the LifeOS record covers the memory loop only and its promote row does not include whatever those tools do to skills.
- hermes-agent's rollback for a deleted memory entry (as opposed to an archived skill) was not found. `learning_mutations.py` says deleting a memory rewrites its file, with no snapshot mentioned.
- Nothing in this report was cloned, installed, or executed.
