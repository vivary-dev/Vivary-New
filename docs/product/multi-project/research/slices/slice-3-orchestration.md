# Slice 3: multi-agent orchestration workspaces

Supplied research input. Read the [source reconciliation](../workspace-research-reconciliation.md) before using
its claims or delivery order. The accepted plan is the program frontier.

Structural read of 11 systems where several agents, or several sessions of one
agent, take work, claim it, hand it off, and leave evidence. All facts come from
files in the repositories named, or from Anthropic's own docs for the Claude Code
convention. Accessed 2026-09-13.

Repository note: `steveyegge/beads` redirects to `gastownhall/beads`, and
`steveyegge/gastown` redirects to `gastownhall/gastown`. The `gh api` call on the
old path returns `full_name: gastownhall/beads`. Both repos are cited under the
new owner. The slice also picked up `ruvnet/ruflo`, which is the renamed
`claude-flow`; the repo README still ships the old package names
(`@claude-flow/cli`, `claude-flow`, `ruflo`) as one release train.

---

### gastownhall/gastown

- URL https://github.com/gastownhall/gastown, 18,045 stars, last push
  2026-09-10, MIT, SHA read `649b832b7672bc7a2dbef26f5983aba6198b819b`
- Purpose: a workspace manager that runs many Claude Code instances at once as
  named roles across several project repositories, coordinated through tmux, a
  shared issue graph, and an agent mail system.
- Entry files the agent is told to read, in order: `AGENTS.md` says "See
  **CLAUDE.md** for complete agent context" and adds "Run `gt prime` after
  compaction, clear, or new session"; full context is injected by `gt prime` at
  session start, not read from a file. Role-specific context comes from
  `templates/polecat-CLAUDE.md` and `templates/witness-CLAUDE.md`, rendered per
  worker with `{{rig}}` and `{{name}}`.
- Layout, top two levels, trimmed:
  ```
  AGENTS.md              CLAUDE.md pointer + two managed blocks
  .beads/                issue graph: config.yaml, PRIME.md, README.md, backup/*.jsonl
  .beads/backup/         issues.jsonl, dependencies.jsonl, comments.jsonl,
                         events.jsonl, labels.jsonl, config.jsonl, backup_state.json
  .runtime/setup-hooks/  01-git-config.sh
  templates/             polecat-CLAUDE.md, witness-CLAUDE.md, agents/opencode.json.tmpl
  pr-sheriff-evidence/   one dir per run: evidence.json, report.md, merge-gate-check.txt
  docs/concepts/         convoy, heartbeats, identity, integration-branches,
                         molecules, polecat-lifecycle, propulsion-principle
  docs/design/           mail-protocol, escalation, scheduler, dolt-storage,
                         ledger-export-triggers, persistent-polecat-pool, ...
  docs/glossary.md       the role and work-unit vocabulary
  internal/, cmd/, plugins/, scripts/
  ```
- Primitives present:
  1. Law: `AGENTS.md` plus per-role `templates/polecat-CLAUDE.md`.
  2. State surface: not a file. `gt prime` injects it, and liveness lives in
     three heartbeat stores (`docs/concepts/heartbeats.md`).
  3. Index or map: `docs/glossary.md` and `.beads/PRIME.md`.
  5. Durable memory: the agent bead. `docs/glossary.md` says a Polecat has "a
     permanent agent bead, CV chain, and work history that accumulates across
     assignments".
  6. Dated log: `.beads/backup/events.jsonl`; `interactions.jsonl` is
     gitignored as "runtime, not versioned".
  7. Records: `docs/design/*.md` design records, `pr-sheriff-evidence/*/report.md`.
  8. Skills or procedures: Formulas. `docs/glossary.md`: "TOML-based workflow
     source template", instantiated as Protomolecule then Molecule.
  9. Roles: Mayor, Deacon, Dogs, Boot, Polecat, Refinery, Witness, Crew, all
     defined in `docs/glossary.md`, with per-role context templates in `templates/`.
  10. Task graph: `.beads/` beads with dependencies, epics, Molecules (chained
      beads), Wisps (ephemeral beads), and Convoys (work orders grouping beads).
  11. Handoff or claim ledger: three mechanisms. The **Hook** is "a special
      pinned Bead for each agent" and is the claim. `gt sling` puts work on a
      Hook. `gt mail` is persistent messaging, `gt nudge` is immediate delivery
      into another agent's live session, and `/handoff` refreshes a session.
      `gt seance` queries previous sessions.
  12. Evidence or receipts: `pr-sheriff-evidence/<run-id>/` holds
      `evidence.json` (`"schema_version": "pr-sheriff-evidence/v1"`,
      `policy_version`, `run_id`, `subject` with base_sha/head_sha/diff_summary,
      `repo_policy`, `action_plan`), `report.md`, and `merge-gate-check.txt`.
  13. Gates: the report.md line `Gate summary: 12 pass, 2 not_applicable, 0
      waived, 0 fail`, plus `Human approvals: not_required for kind/bug
      implementation` and `Merge path allowed: true`.
  14. Boundary: `.beads/.gitignore` is the sharpest example in the whole slice.
      It ignores `dolt/`, `bd.sock`, `.exclusive-lock`, `daemon.*`,
      `interactions.jsonl`, `push-state.json`, `export-state/`, `redirect`,
      `ephemeral.sqlite3`, `.beads-credential-key`, and `backup/`, while keeping
      `config.yaml` and `metadata.json` tracked.
  15. Maintenance loop: Patrol. Deacon runs continuous patrol cycles, Dogs are
      "the Deacon's crew of maintenance agents", and Boot "checks the Deacon
      every 5 minutes".
  16. Tool projections: `.claude/` and `.cursor/` at repo root;
      `templates/agents/opencode.json.tmpl` projects to OpenCode.
  17. Multi-project routing: **Town** (`~/gt/`) holds many **Rigs**, each a
      project git repo with its own Polecats, Refinery, Witness, and Crew.
- Primitives absent that I would expect: no single state file a human can read.
  No capture inbox for unprocessed human input (mail is agent-to-agent, with
  `gt mail send --human` as the outbound path). No committed per-session
  transcript.
- Loop: `templates/polecat-CLAUDE.md` states the polecat contract as: receive
  work via your hook (formula checklist + issue), work the formula steps in
  order, complete and self-clean with `gt done`, and the Refinery merges from
  the merge queue. `gt done` "pushes your branch, submits to MQ, nukes sandbox,
  exits session." The propulsion rule is GUPP: "If there is work on your Hook,
  YOU MUST RUN IT." The named failure is the "Idle Polecat Heresy", a polecat
  that finished but did not run `gt done`.
- Memory split: per-agent durable identity in the agent bead and CV chain;
  per-session ephemeral sandbox and worktree at
  `{{rig}}/polecats/{{name}}/`; per-machine in gitignored `.beads/` runtime
  files (`push-state.json` is commented "runtime, per-machine"); shared durable
  in Dolt under `refs/dolt/data`.
- Human gates: `gt mail send --human` reaches the overseer. The PR sheriff
  report carries a `Human approvals:` field. Escalation is documented in
  `docs/design/escalation.md`; a polecat whose `gt done` fails escalates to
  Witness.
- Evidence of real use: strong. Recent merge commits name branches
  `polecat/mutant/gt-pr-sheriff-...`, `polecat/enclave/gt-4472-post-...`,
  `polecat/shiny/gt-rwip+f8c7f8`, with commit author names `mutant`, `enclave`,
  `shiny`, `coder`, matching the polecat identity model. Commit subjects carry
  bead ids, e.g. `fix: fail closed for gt done outside polecat worktree
  (gt-rwip)`. Six committed `pr-sheriff-evidence/` run directories.
- Generalizes: the Hook as a pinned per-agent claim record; the
  evidence-directory-per-run shape with a machine-readable `evidence.json` plus
  a human-readable `report.md`; the strict separation of durable issue data from
  runtime sockets and locks in one `.gitignore`; a role vocabulary written down
  in a glossary so agents and humans use the same words.
- Idiosyncratic: the Mad Max naming (Polecat, Refinery, Witness, Deacon, Rig,
  Town, Wasteland), tmux as the session substrate, and the three-heartbeat-store
  arrangement that exists because `bd agent heartbeat` was never shipped.
- Sources:
  - https://github.com/gastownhall/gastown/blob/main/AGENTS.md (roles, mail, nudge)
  - https://github.com/gastownhall/gastown/blob/main/docs/glossary.md (GUPP, MEOW, NDI, roles, work units)
  - https://github.com/gastownhall/gastown/blob/main/templates/polecat-CLAUDE.md (polecat contract, `gt done`, worktree discipline)
  - https://github.com/gastownhall/gastown/blob/main/docs/concepts/heartbeats.md (three heartbeat stores)
  - https://github.com/gastownhall/gastown/blob/main/.beads/.gitignore (runtime vs durable boundary)
  - https://github.com/gastownhall/gastown/blob/main/pr-sheriff-evidence/gt-pr-4322-fixup/evidence.json (evidence schema)
  - https://github.com/gastownhall/gastown/blob/main/pr-sheriff-evidence/gt-4468fx-pr4468-stale-heartbeat/report.md (gate summary, verdict)

---

### gastownhall/beads

- URL https://github.com/gastownhall/beads, 27,114 stars, last push 2026-09-13,
  MIT, SHA read `f56632adcfabed7da6ed0aabe4e760066b472c46`
- Purpose: a dependency-aware issue tracker that lives in the repo and is
  designed for coding agents to claim work from, with atomic claims and an
  exclusive merge slot.
- Entry files: `AGENTS.md` first ("For project overview and quick start, see
  AGENTS.md"), then `AGENT_INSTRUCTIONS.md` for operational detail. `bd init`
  writes a managed block into the host project's own `AGENTS.md` or `CLAUDE.md`
  from `internal/templates/agents/defaults/beads-section.md`, delimited by
  `<!-- BEGIN BEADS INTEGRATION -->` and `<!-- end-beads-agent-instructions -->`.
- Layout written into a target project:
  ```
  .beads/
    config.yaml      tracked; issue-prefix, sync-branch, sync.remote
    metadata.json    tracked
    issues.jsonl     passive export, refreshed by the pre-commit hook
    dolt/            gitignored; the actual database
    ephemeral.sqlite3 gitignored; wisps and molecules
    .exclusive-lock, *.lock, bd.sock, daemon.*  gitignored runtime
  AGENTS.md / CLAUDE.md   with the managed beads block appended
  .claude/skills/beads/   plugin-shipped skill, commands, resources
  ```
  Plus, in the beads repo itself: `release-gates/*.md` (60+ files),
  `.agent/workflows/resolve-beads-conflict.md`, `plugins/beads/agents/task-agent.md`.
- Primitives present:
  1. Law: `AGENTS.md`, `AGENT_INSTRUCTIONS.md`, and the injected managed block.
     The block is explicit about its own authority: "The managed Beads block is
     task-tracking guidance, not permission to override repository, user, or
     orchestrator instructions."
  3. Index: `docs/cli-reference/index.md`, `docs/multi-agent/index.md`.
  6. Dated log: Dolt history, one Dolt commit per write command.
  7. Records: `engdocs/decisions/2026-07-17-docs-release-pin.md`,
     `PROPOSAL-*.md` at root.
  8. Skills or procedures: `.claude/skills/beads-docs/SKILL.md` with
     `references/verification.md`; **Formulas** (`bd formula list`,
     `bd mol pour <name>`), and `.beads/formulas/beads-release.formula.toml`.
  9. Roles: `plugins/beads/agents/task-agent.md`, "Autonomous agent that finds
     and completes ready tasks". `docs/multi-agent/coordination.md` is blunt
     that there is no registry: "Beads has no agent registry, assignees are
     plain strings."
  10. Task graph: beads with `discovered-from` and blocking dependencies,
      epics, parent/child (`bd-epic.1`), `bd ready` for the unblocked frontier,
      `bd swarm create` for epic fan-out molecules.
  11. Handoff or claim ledger: `bd update <id> --claim` is atomic, first claim
      wins, repeating your own claim is idempotent. `bd ready --claim --json`
      claims the first matching ready issue. Release is
      `bd assign <id> ""` plus `bd update <id> --status open`. Sequential
      handoff is `bd comment` then `bd assign` to the next agent.
      `bd mail` delegates to an orchestrator-provided mail provider
      (`mail.delegate`, e.g. `gt mail`).
  12. Evidence: `release-gates/<bead-id>-gate.md`. Each one names a builder
      bead, a deploy bead, a review bead with a verdict, the exact commits, the
      branch, who evaluated it and when, a scope section with
      `git diff --stat` output, and a gate criteria table.
  13. Gates: the same `release-gates/` files, with lines like "Review bead:
      be-6yo1, verdict **PASS**, recorded on commit `15c6d0a...`". Also
      `bd human <id>` "to flag for human decisions", and `bd gate`.
  14. Boundary: `.beads/.gitignore`, and `engdocs/EXCLUSIVE_LOCK.md`.
  15. Maintenance loop: `bd doctor` (detects orphaned issues by
      cross-referencing open issues against git history), `bd stale`,
      `bd orphans`, `bd lint`, `bd compact`, `bd gc`, `bd find-duplicates`.
  16. Tool projections: `internal/templates/agents/defaults/` ships
      `beads-section.md`, `beads-section-codex.md`, `beads-section-minimal.md`.
  17. Multi-project routing: `BEADS_DIR` points many code worktrees at one
      external beads workspace; `docs/multi-agent/bucket-federation.md` and
      `federation.md` cover cross-repo.
- Primitives absent: no state surface file, no capture inbox, no durable
  per-user memory (`bd memories` exists as a command but the block does not
  describe a user-profile store).
- Loop: the managed block states it for agents: check `bd ready`, claim
  atomically with `bd update <id> --claim`, work, file discovered work with
  `--deps discovered-from:<parent-id>`, close with `bd close <id> --reason`.
  Session completion starts "File issues for remaining work". Commit messages
  carry the bead id in parentheses so `bd doctor` can find orphans, and
  agent-prepared commits add an `Agent-Signature:` trailer
  (`engdocs/AGENT_SIGNING.md`).
- Memory split: per-project durable in Dolt under `refs/dolt/data`;
  per-machine in gitignored `.beads/` runtime files; per-session ephemeral in
  `ephemeral.sqlite3` for wisps and molecules. Worktrees share one `.beads/`
  workspace by default (`docs/reference/worktrees.md`).
- Human gates: three named agent context profiles in the managed block.
  Conservative (the default) forbids git commit, push, and Dolt remote sync
  unless asked. Minimal keeps pointers. Team-maintainer lets agents close beads,
  run quality gates, commit, and push, "Only when the repository explicitly opts
  in", and "A current 'do not commit' or 'do not push' instruction still wins."
- Evidence of real use: strong. Recent commits authored by `Bee` alongside human
  authors, bead ids in subjects (`wy-y52syc`, `#6212`), and a `migration slot
  claim` commit. 60+ committed `release-gates/` files.
- Generalizes: atomic claim as a single command with first-writer-wins;
  `discovered-from` as a dependency type so side-quests stay linked instead of
  becoming TODO comments; the merge slot as a named single-holder lock;
  graduated agent authority profiles in the instruction file; the gate file as a
  per-change committed receipt.
- Idiosyncratic: Dolt as the storage engine and `refs/dolt/data` as the sync
  channel, which is why the JSONL export is explicitly demoted; the
  `bd`/`bv`/`gt` three-binary split.
- Sources:
  - https://github.com/gastownhall/beads/blob/main/docs/multi-agent/coordination.md (atomic claim, merge slot, handoff, fan-out)
  - https://github.com/gastownhall/beads/blob/main/internal/templates/agents/defaults/beads-section.md (injected law, agent loop, context profiles, session completion)
  - https://github.com/gastownhall/beads/blob/main/AGENT_INSTRUCTIONS.md (commit convention, orphan detection, agent signature)
  - https://github.com/gastownhall/beads/blob/main/plugins/beads/agents/task-agent.md (role definition)
  - https://github.com/gastownhall/beads/blob/main/docs/reference/worktrees.md (shared .beads across worktrees, BEADS_DIR)
  - https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md (Dolt is source of truth, JSONL is an export)
  - https://github.com/gastownhall/beads/blob/main/release-gates/be-23f3-gate.md (gate record shape)
  - https://github.com/gastownhall/beads/blob/main/docs/cli-reference/mail.md (mail delegation)

---

### ruvnet/ruflo

- URL https://github.com/ruvnet/ruflo, 72,284 stars, last push 2026-09-13, MIT,
  SHA read `b02c0cacec225deea01f586b66a9694393369432`
- Purpose: a coordination layer installed into a project that spawns and routes
  swarms of Claude Code and Codex agents, with shared memory namespaces, hooks,
  and a governance policy plane.
- Entry files: `CLAUDE.md` at root (byte-identical concept to `AGENTS.md`,
  which also exists), plus `CLAUDE.local.md` and `SKILL.md`. `v3/CLAUDE.md`
  scopes the v3 package tree. The README states the CLI install writes
  `.claude/`, `.claude-flow/`, `CLAUDE.md`, helpers, and settings into the
  workspace, while the plugin install writes zero files.
- Layout, as installed and as in-repo:
  ```
  CLAUDE.md, AGENTS.md, CLAUDE.local.md, SKILL.md
  .claude/           agents/, skills/, commands/, checkpoints/<epoch>.json,
                     helpers/ (swarm-comms.sh, swarm-hooks.sh, swarm-monitor.sh,
                     memory.cjs, session.cjs, checkpoint-manager.sh,
                     auto-memory-hook.mjs, standard-checkpoint-hooks.sh),
                     settings.json
  .agents/           README.md, config.toml, skills/agent-*/SKILL.md (~98 of them)
  .harness/          README.md, manifest.json, mcp-policy.json
  memory/            agents/README.md, sessions/README.md (the rest gitignored)
  plugins/           one dir per plugin: agents/*.md, skills/*/SKILL.md,
                     commands/*.md, docs/adrs/0001-*.md, scripts/smoke.sh
  docs/dream-cycles/ 2026-07-19-swarm-sota.md and siblings
  gitignored runtime: .swarm/, .hive-mind/ (incl. hive.db*), .ruv-swarm/,
                     .claude-flow/, .agentic-flow/, agentdb.rvf.lock
  ```
- Primitives present:
  1. Law: `CLAUDE.md` "Behavioral Rules (Always Enforced)".
  5. Durable memory: AgentDB (`agentdb.rvf` committed, `.lock` ignored),
     `memory/agents/`, `memory/sessions/`, and named memory namespaces.
     `plugins/ruflo-swarm/docs/adrs/0001-swarm-contract.md` records that the
     swarm plugin "claims `swarm-state`" as its namespace; the coordinator agent
     is told to "Store coordination decisions in memory namespace 'swarm'".
  6. Dated log: `docs/dream-cycles/<date>-<topic>-sota.md`,
     `.claude/checkpoints/<epoch>.json`.
  7. Records: per-plugin `docs/adrs/0001-*.md` with id, status, date, authors,
     Context, Decision, Consequences, Verification, Implementation status.
  8. Skills: ~98 `.agents/skills/agent-*/SKILL.md` plus per-plugin skills.
  9. Roles: `plugins/*/agents/*.md` with YAML frontmatter
     (`name`, `description`, `model`), e.g. `coordinator`, `architect`,
     `memory-specialist`, `session-specialist`.
  10. Task graph: MCP-level, not file-level. `swarm_init`, `agent_spawn`,
      `agent_execute`, Claude Code's own `Task`/`TaskList`/`TaskGet`/`TaskUpdate`.
      GOAP planning via a `ruflo-goals` plugin.
  11. Handoff or claim ledger: named in the loop and in policy, not as a
      committed file. `CLAUDE.md`: "A lease or work claim coordinates ownership;
      it never grants authority." Also "Never allow two writers in one worktree.
      Give every writing agent an isolated worktree and explicit file
      ownership," and "Only the integration owner edits shared manifests and
      lockfiles."
  12. Evidence: `CLAUDE.md` names a `receipt` step and requires "Bind tests,
      benchmarks, policy decisions, and handoffs to an exact clean commit or
      immutable dirty-worktree snapshot." Per-plugin `scripts/smoke.sh` is
      "smoke-as-contract" with a fixed pass count, e.g. "11 passed, 0 failed".
      `benchmarks/results/memory-recall-baseline-20260520T203616Z.md`.
  13. Gates: "verification gates" in swarm config; "separately authorized
      publish" as the terminal loop step; the self-promotion ban: "Darwin,
      Flywheel, MetaHarness, memory, and neural systems may propose and evaluate
      candidates, but cannot self-promote or expand tools, network, secrets,
      spend, concurrency, or release authority."
  14. Boundary: `.harness/mcp-policy.json` is a default-deny MCP policy with an
      audit log, a dangerous-pattern list, and a per-turn call budget.
      `.harness/manifest.json` pins sha256 fingerprints of `mcp-policy.json`
      and `.claude/settings.json`. The `.gitignore` separates every runtime
      swarm and hive database from the repo.
  15. Maintenance loop: `post-task` hooks with `--train-neural true`, the
      autopilot `/loop` heartbeat (270s, cache-aware), and the dream-cycle docs.
  16. Tool projections: `.claude/`, `.agents/`, and a Codex dual-mode track.
      The README notes the two install paths produce different MCP tool names
      (`mcp__plugin_ruflo-core_ruflo__memory_store` versus bare `memory_store`).
  17. Multi-project routing: federation (`federation init`, `federation join`,
      `federation_send`, `federation_trust`, `federation_audit`) rather than a
      parent directory of projects.
- Primitives absent: no state surface file, no capture inbox, no per-user
  profile store, and no committed task or claim file. The task graph and the
  claims are MCP and database state.
- Loop: `CLAUDE.md` gives it verbatim: "recall -> inspect -> route -> plan ->
  execute -> test -> validate -> benchmark -> optimize -> receipt -> handoff ->
  separately authorized publish." The coordinator agent's own cycle is swarm
  init, `hooks session-start --session-id`, `hooks route --task`, monitor and
  reassign stalled work, `hooks session-end --export-metrics true`. A standing
  rule forbids polling: "Never continuously check status after spawning a swarm,
  wait for results."
- Memory split: per-project in AgentDB and the gitignored `.swarm/`,
  `.hive-mind/hive.db`; per-session in `.claude/checkpoints/<epoch>.json` and
  `memory/sessions/`; per-agent in `memory/agents/`; namespaces
  (`swarm`, `swarm-state`) partition shared memory by concern.
- Human gates: publish is "separately authorized". Spend, concurrency, network,
  secrets, and release authority cannot be self-expanded. The MCP policy is
  default-deny.
- Evidence of real use: recent commits are authored by `rUv`, `ruvnet`, `ruv`
  (the maintainer's identities), not by distinct agent identities. Committed
  `.claude/checkpoints/1767754460.json` and dated dream-cycle docs show the loop
  ran. No agent-named commit authors found.
- Generalizes: the explicit one-writer-per-worktree rule with named file
  ownership and a single integration owner for shared manifests; the statement
  that a claim coordinates but does not authorize; binding every piece of
  evidence to an exact commit or an immutable snapshot; a fingerprint manifest
  over the security-relevant config files.
- Idiosyncratic: the 98-skill `.agents/skills/agent-*` catalogue; neural
  training on task outcomes; three-tier model routing with a $0 deterministic
  codemod tier; the MetaHarness posture scoring.
- Sources:
  - https://github.com/ruvnet/ruflo/blob/main/CLAUDE.md (loop, worktree ownership, lease wording, self-promotion ban, anti-drift defaults)
  - https://github.com/ruvnet/ruflo/blob/main/.gitignore (runtime state dirs)
  - https://github.com/ruvnet/ruflo/blob/main/.harness/README.md (policy, manifest, witness)
  - https://github.com/ruvnet/ruflo/blob/main/.harness/manifest.json (fingerprints)
  - https://github.com/ruvnet/ruflo/blob/main/plugins/ruflo-swarm/docs/adrs/0001-swarm-contract.md (namespace claim, smoke-as-contract)
  - https://github.com/ruvnet/ruflo/blob/main/plugins/ruflo-swarm/agents/coordinator.md (role definition and session lifecycle)
  - https://github.com/ruvnet/ruflo/blob/main/README.md (what init writes; plugin vs CLI install)

---

### entireio/cli and entireio/skills

- URLs https://github.com/entireio/cli (5,090 stars, last push 2026-09-13, MIT,
  SHA `8a43e78f1e7f8567e2bd77b058c5155893e58cb0`) and
  https://github.com/entireio/skills (221 stars, last push 2026-09-05, MIT,
  SHA `fe5266f76d846222c73b080ce39fd803dd705198`). Settled on these two of the
  30 repos in the `entireio` org; `entire-io` is an unrelated empty user account.
- Purpose: a git-native recorder that captures every coding-agent session as a
  checkpoint indexed alongside commits, plus a cross-agent skill set that reads
  those checkpoints to hand work from one agent to another.
- Entry files: `AGENTS.md` (architecture and command layout), `CLAUDE.md`, and
  `.github/copilot-instructions.md`. The skills repo has no root law file; each
  `skills/<name>/SKILL.md` is self-contained with a `name` and `description`
  frontmatter pair.
- Layout written into a target project:
  ```
  .entire/
    settings.json         tracked: enabled, strategy ("manual-commit"),
                          strategy_options.checkpoint_remote {provider, repo},
                          checkpoints.primary {type: "git-refs"}
    runners/*.json        tracked: trail-confidence, trail-drift, trail-review,
                          trail-risk, trail-security, trail-summary
    .gitignore            ignores tmp/, settings.local.json, metadata/,
                          current_session, logs/, redactors/local/
  .git/entire-sessions/   active session state (StateStore), never committed
  git ref entire/checkpoints/v1   the permanent record
  shadow branch           ephemeral full-state snapshots
  ```
  Tool projections in the CLI repo itself: `.claude/`, `.codex/`, `.cursor/`,
  `.gemini/`, `.opencode/`, `.pi/`, `.ferrata/`, plus `.worktreeinclude`.
- Primitives present:
  1. Law: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`.
  5. Durable memory: the checkpoint store. A checkpoint holds a transcript, a
     summary, attribution, and `TokenUsage` including `SubagentTokens`.
  6. Dated log: session ids are date-prefixed
     (`2025-12-01-8f76b0e8-b8f1-4a87-9186-848bdd83d62e`); `entire session list`
     returns `started_at`, `last_active`, `turns`, `files_touched`.
  7. Records: `docs/architecture/*.md` (15 files) including
     `sessions-and-checkpoints.md`, `checkpoint-signing.md`,
     `ref-checkpoint-backend.md`.
  8. Skills: `skills/<name>/SKILL.md` in the skills repo: `session-handoff`,
     `session-crosslink`, `recall`, `replay`, `review`, `what-happened`,
     `explain`, `search`, `teach`, `address-findings`, `session-to-skill`,
     `using-entire`. Each carries `evals/<case>/prompt.md` and
     `graders/*.md` so the trigger behavior is testable.
  9. Roles: `.claude/agents/dev.md`, `reviewer.md`, `test-doc.md`;
     `.claude/skills/agent-integration/{implementer,researcher,test-writer}.md`.
  11. Handoff or claim ledger: `skills/session-handoff/SKILL.md` is the most
      precisely specified handoff procedure in the slice, and it deliberately
      has **no handoff file**. It resolves the worktree with
      `entire session current --json`, picks a session from
      `entire session list --json`, streams the transcript with
      `entire session info <id> --transcript`, and writes a six-section summary:
      Task Overview, Current State, Important Discoveries, Next Steps, Context
      to Preserve, and Unanswered Question. "Empty sections are a feature; pad
      them only if you have real content." A checkpoint handoff enumerates every
      contributing session (`--session-index N`), capped at the 8 most recent.
      `session-crosslink` attaches one session to several repos' HEAD commits.
  12. Evidence: the checkpoint itself, attached to a commit. Signing is
      documented in `docs/architecture/checkpoint-signing.md`.
  13. Gates: `session-crosslink` requires preview-then-confirm: "Do NOT run
      `entire session attach` without showing the preview table first...
      previewing wrong means amending the wrong commit."
  14. Boundary: `.entire/.gitignore` splits tracked settings and runners from
      `current_session`, `metadata/`, `logs/`, and `redactors/local/`. Active
      session state lives under `.git/`, outside the worktree entirely.
      `checkpoint explain --repo <owner/name>` reads a foreign checkpoint over
      HTTP so it "never enters this repo's object store, ref namespace, or
      `tokens profile`."
  15. Maintenance loop: `entire doctor` (scan-and-fix, plus `trace`, `logs`,
      `bundle`); stop-time backfill of transcripts, summaries, and attribution.
  16. Tool projections: seven, one per agent runtime, plus an
      `entireio/external-agents` repo of standalone agent binaries.
  17. Multi-project routing: `session adopt` moves an active session between
      repos or worktrees; `session-crosslink` spans repos; checkpoints push to a
      separate repo (`entireio/cli-checkpoints`).
- Primitives absent: no task graph, no claim or lock, no state surface file, no
  capture inbox. Entire records what happened; it does not assign work.
- Loop: per session, hooks capture; at stop time, condense and backfill; per
  commit, index the checkpoint against the commit. The handoff skill's startup
  rules are strict: no clarifying questions, no exploratory `git log`/`git
  status`/`ps aux`, and no "Would you like me to continue?" The one exception is
  an unanswered question from the prior agent, which must be put to the user.
- Memory split: per-session in `.git/entire-sessions/` and the ephemeral shadow
  branch; per-commit in the persistent ref `entire/checkpoints/v1`; per-machine
  in `.entire/settings.local.json` and `logs/`; cross-repo in the control plane
  and the checkpoints repo.
- Human gates: preview-then-confirm before `session attach` amends a commit.
  Auth is explicit (`entire auth login`, jurisdictional tokens).
- Evidence of real use: commits from human authors (`Stefan Haubold`, `Peyton
  Montei`, `computermode`) with an active checkpoints repo
  (`entireio/cli-checkpoints`, pushed 2026-09-13). The skills repo ships 10
  eval cases with graders, which is evidence the handoff skill is exercised.
- Generalizes: the six-section handoff summary schema, with permission to leave
  sections empty; deriving the handoff from the recorded transcript instead of
  asking the departing agent to write a file; keeping the durable record in git
  refs so it survives branch churn; preview-then-confirm before any operation
  that rewrites history.
- Idiosyncratic: the control plane, jurisdictional token exchange, and the
  forge-prefix namesquatting guard on repo refs.
- Sources:
  - https://github.com/entireio/cli/blob/main/AGENTS.md (command layout, session resume/adopt/current, checkpoint explain)
  - https://github.com/entireio/cli/blob/main/docs/architecture/sessions-and-checkpoints.md (Session and Checkpoint structs, ephemeral vs persistent, `.git/entire-sessions/`, `entire/checkpoints/v1`, TokenUsage)
  - https://github.com/entireio/cli/blob/main/.entire/settings.json (tracked config, git-refs backend, checkpoint remote)
  - https://github.com/entireio/cli/blob/main/.entire/.gitignore (runtime boundary)
  - https://github.com/entireio/skills/blob/main/skills/session-handoff/SKILL.md (handoff procedure and summary schema)
  - https://github.com/entireio/skills/blob/main/skills/session-crosslink/SKILL.md (cross-repo attach, preview gate)

---

### Vendor: Anthropic Claude Code

- URLs https://code.claude.com/docs/en/sub-agents,
  https://code.claude.com/docs/en/claude-directory,
  https://code.claude.com/docs/en/checkpointing. Read 2026-09-13. Docs have no
  commit SHA; the subagents page reports a live frontmatter table.
- Purpose in one sentence: the vendor's own file convention for defining
  subagents, isolating them in worktrees, giving them persistent memory, and
  scripting multi-subagent orchestration.
- Entry files the agent is told to read: project `CLAUDE.md` is "Loaded into
  context at the start of every session"; `~/.claude/CLAUDE.md` is the user-level
  equivalent; `.claude/rules/*.md` hold scoped rules.
- On-disk shapes:
  ```
  your-project/
    CLAUDE.md            committed
    .mcp.json            committed
    .worktreeinclude     committed; gitignored files to copy into new worktrees
    .claude/
      settings.json      committed
      settings.local.json  gitignored
      rules/*.md         committed
      skills/<name>/SKILL.md  committed, plus bundled support files
      commands/*.md      committed
      output-styles/
      agents/*.md        committed; subagent definitions, scanned recursively
      workflows/*.js     scripts that spawn and coordinate many subagents
      agent-memory/<agent-name>/MEMORY.md   committed, Claude-written
  ~/.claude/
    CLAUDE.md, settings.json, keybindings.json, themes/   local
    projects/<project>/memory/MEMORY.md   local; main-session auto memory
    rules/, skills/, commands/, output-styles/, agents/, workflows/, agent-memory/
  ~/.claude.json         local
  ```
- Primitives present:
  1. Law: `CLAUDE.md` at both levels, plus `.claude/rules/*.md`.
  3. Index: `MEMORY.md` at `~/.claude/projects/<project>/memory/MEMORY.md`
     functions as the auto-memory index.
  5. Durable memory: two separate stores. Main-session auto memory at
     `~/.claude/projects/<project>/memory/MEMORY.md` (local), and per-subagent
     memory at `.claude/agent-memory/<agent-name>/MEMORY.md` (committed).
     Subagents opt in with `memory: user | project | local` in frontmatter. The
     docs are explicit that these do not mix: "each subagent reads and writes
     its own MEMORY.md, not yours." Only the first 200 lines, capped at 25KB, of
     a subagent's MEMORY.md load into its system prompt.
  8. Skills: `.claude/skills/<name>/SKILL.md` plus bundled files.
     `disable-model-invocation: true` makes a skill user-only;
     `user-invocable: false` hides it from the `/` menu.
  9. Roles: `.claude/agents/<name>.md`, Markdown with YAML frontmatter.
     Required: `name`, `description`. Optional and relevant here:
     `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`,
     `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`,
     `isolation`, `color`, `initialPrompt`, `experimental`.
  10. Task graph: not a file convention. Orchestration is code:
      `.claude/workflows/*.js`, "a script the runtime executes to spawn and
      coordinate many subagents," each file becoming a `/<name>` command, and
      "written by Claude and saved here from `/workflows` rather than authored
      from scratch."
  11. Handoff: session-level, not file-level. `/rewind` restores code,
      conversation, or both; "Summarize from here" and "Summarize up to here"
      compress context; `/branch` and `claude --continue --fork-session` fork a
      session.
  12. Evidence: checkpoints, but explicitly bounded. Snapshots cover only edits
      made by Claude's file-editing tools, keep the 100 most recent checkpoints
      per session, and are swept about 30 days after a session last saved one
      (`cleanupPeriodDays`). The docs state plainly that checkpointing is "Not a
      replacement for version control."
  14. Boundary: `settings.json` committed versus `settings.local.json`
      gitignored; `~/.claude/` marked local throughout; `.worktreeinclude`
      names which gitignored files to carry into a worktree.
  16. Tool projections: this *is* the projection other systems target.
  17. Multi-project routing: nested `.claude/agents/` directories are found by
      walking up from cwd to the repo root, and "the definition closest to the
      working directory wins." Cross-scope precedence runs managed settings,
      then `--agents` flag, then project, then user, then plugin.
- Primitives absent: no state surface, no capture inbox, no dated log
  convention, no task graph, no claim or lock, no gate file, and no maintenance
  loop beyond the retention sweep. Anthropic ships the containers; the
  orchestration systems above supply the work-tracking primitives.
- Loop: per turn, a checkpoint before each prompt that starts a turn. At
  startup, load `CLAUDE.md`, rules, and the auto-memory `MEMORY.md`; load
  workflows so each becomes a slash command. Maintenance cadence: the retention
  sweep at roughly 30 days.
- Memory split: per-user in `~/.claude/`, per-project in `.claude/` (committed)
  and `settings.local.json` (not), per-subagent in
  `.claude/agent-memory/<agent-name>/`, per-session in the checkpoint store
  attached to the conversation.
- Human gates: `permissionMode` per subagent, with values `default`,
  `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual`.
- Evidence of real use: every other Claude-Code-targeting system in this slice
  writes into these exact paths.
- Generalizes: separating a subagent's memory from the main session's memory,
  and committing the former while keeping the latter local; per-agent worktree
  isolation as a one-line frontmatter flag; nearest-definition-wins so a
  monorepo subdirectory can override a root role.
- Idiosyncratic: the 200-line/25KB MEMORY.md injection cap; the specific
  limitation that subagent edits are usually not restored by rewind, so git is
  the only recovery path for parallel agent work.
- Sources:
  - https://code.claude.com/docs/en/sub-agents (directories, precedence, frontmatter table, `isolation: worktree`, `memory:`)
  - https://code.claude.com/docs/en/claude-directory (full directory contents, committed/gitignored/local badges, `workflows/`, `agent-memory/`, `.worktreeinclude`)
  - https://code.claude.com/docs/en/checkpointing (retention, 100-checkpoint cap, subagent-edit limitation, `/branch`)

---

### Yeachan-Heo/oh-my-claudecode

- URL https://github.com/Yeachan-Heo/oh-my-claudecode, 39,129 stars, last push
  2026-09-13, MIT, SHA read `5281b19e0d64f8e6dc6767f2130299a88af2dc71`
- How I found it: `gh api search/repositories` with
  `q='agent handoff worktree claim in:name,description,readme' sort=stars`.
  Described as "Teams-first Multi-agent orchestration for Claude Code".
- Purpose: an orchestration layer over Claude Code that routes work to 19 named
  agent roles through four canonical workflow stages, with a `.omc/` state root
  holding plans, handoffs, and per-session state.
- Entry files: `CLAUDE.md`, wrapped in `<!-- OMC:START -->` and
  `<!-- OMC:VERSION:5.4.0 -->` so the layer can rewrite its own block, plus
  `AGENTS.md`. Detail is deferred: "Detailed agent catalog, tools, team
  pipeline, commit protocol, and full skill registry live in the `wiki` skill."
- Layout:
  ```
  CLAUDE.md              managed block, XML-tagged sections
  agents/*.md            19 roles: planner, executor, verifier, critic, analyst,
                         architect, code-reviewer, code-simplifier, debugger,
                         designer, document-specialist, explore, git-master,
                         qa-tester, scientist, security-reviewer, test-engineer,
                         tracer, writer
  .omc/                  state root (see below)
  .omx/plans/<plan>/*.md  committed planning artifacts incl. ownership-matrix.md
  .clawhip/project.json  {project, repo_name}; .clawhip/state/prompt-submit.json
  commands/, skills/, bridge/, benchmark/, .codex/, .claude-plugin/
  ```
  The `.omc/` state root, per `CLAUDE.md`: `.omc/state/`,
  `.omc/state/sessions/{sessionId}/`, `.omc/notepad.md`,
  `.omc/project-memory.json`, `.omc/plans/`, `.omc/research/`, `.omc/logs/`,
  `.omc/artifacts/`, `.omc/handoffs/`, `.omc/ultragoal/`. It relocates to
  `$OMC_STATE_DIR/{project-id}/`, or to a parent `.omc/` when a
  `.omc-workspace` marker anchors a multi-repo workspace.
- Primitives present:
  1. Law: `CLAUDE.md` managed block with `<operating_principles>`,
     `<delegation_rules>`, `<model_routing>`, `<failure_mode_guards>`,
     `<execution_protocols>`, `<worktree_paths>`.
  2. State surface: `.omc/notepad.md` and `.omc/state/`.
  3. Index: the `wiki` skill; `CLAUDE.md` is the router.
  5. Durable memory: `.omc/project-memory.json`, plus a two-tier persistence
     marker: `<remember>` lasts 7 days, `<remember priority>` is permanent.
  6. Dated log: `.omc/logs/`, `.omc/state/sessions/{sessionId}/`,
     and a timestamped context snapshot referenced by the ownership matrix
     (`.omc/context/source-overall-aggressive-cleanup-20260521T053809Z.md`).
  7. Records: `.omx/plans/<plan>/` holds PRD, test spec, ownership matrix,
     inventory, and a `generated-artifact-policy.md`.
  8. Skills: `.omc/skills/**`, called out as "the intentional committable
     exception" inside an otherwise ignored state root. Workflows are
     `/oh-my-claudecode:<name>`.
  9. Roles: 19 files in `agents/`. Canonical Tier-0 chain is
     `plan -> execute -> review -> verify` mapped to roles
     `planner -> executor -> reviewer -> verifier`.
  10. Task graph: `.omx/plans/<plan-name>/` plus lanes. The ownership matrix
      defines Lane 0 through Lane 3 with an owner per lane.
  11. Handoff or claim ledger: two artifacts, and this is the clearest
      plain-file claim ledger in the slice.
      `.omx/plans/source-overall-cleanup/ownership-matrix.md` is titled
      "Exclusive Ownership Matrix" and its Rules section reads: "One active owner
      per file or serialized module family. No parallel edits to
      `src/tools/state-tools.ts`; it starts in Lane 2 and can move to Lane 3
      only via explicit handoff. Test files may be owned independently from
      source files." Each lane is a table of file paths with a purpose column and
      a named owner role. Separately, `.omc/handoffs/` is a runtime handoff
      directory that agents must re-read after resume or compaction.
  12. Evidence: `.omc/artifacts/`, and a named anti-pattern:
      "No fake completion: TODO-style placeholder notes, `test.skip`/`.only`,
      stub tests, and unimplemented branches are blockers, not evidence."
  13. Gates: "Never self-approve in the same active context; use `code-reviewer`
      or `verifier` for the approval pass," and "Before concluding: zero pending
      tasks, tests passing, verifier evidence collected." Release is
      maintainer-only (`omc release`).
  14. Boundary: the whole `.omc/` tree is "ignored operational artifacts by
      default" except `.omc/skills/**`. Direct writes are allowed only to
      `~/.claude/**`, `.omc/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`.
  15. Maintenance loop: `.omx/plans/source-overall-cleanup/` is itself a
      maintenance campaign, with a Lane 0 "Baseline / inventory lock" owned by
      "planner/verifier only; no source edits".
  16. Tool projections: `.claude-plugin/`, `.codex/`, `bridge/`, `.clawhip/`.
  17. Multi-project routing: the `.omc-workspace` marker file anchors a
      multi-repo workspace so child repos share one parent `.omc/`.
- Primitives absent: no capture inbox. No per-user profile file distinct from
  project memory.
- Loop: per turn, delegate by rule; hooks inject `<system-reminder>` tags with
  recognized patterns (`hook success: Success`, `[MAGIC KEYWORD: ...]`, "The
  boulder never stops" for continuation mode). On resume or compaction, and
  inside a linked worktree, the guard is explicit: "re-check `git status --short
  --branch`, current cwd, and relevant `.omc/state/` or `.omc/handoffs/`
  artifacts so work does not continue on the wrong branch or stale context."
- Memory split: per-project in `.omc/project-memory.json` and `.omc/notepad.md`;
  per-session in `.omc/state/sessions/{sessionId}/`; per-workspace via
  `OMC_STATE_DIR` or `.omc-workspace`. A stated hazard: "In linked git
  worktrees, local `.omc/` state is removed with the worktree unless centralized
  via `OMC_STATE_DIR`."
- Human gates: `AskUserQuestion` is mandatory when approval or preference is
  needed and the tool is available, "one focused question with 2-4 options".
  Release is maintainer-only. No self-approval.
- Evidence of real use: recent commits authored by `Bellman` and touching
  `acquireRecoveryClaim`, `releaseRecoveryClaim`, `publishEmergencyFileExclusive`,
  and `acquireStateFileLockSync` (with `OMC_TEST_FLOCK_AVAILABLE`). That is a
  file-lock claim mechanism under active repair, which is itself evidence the
  concurrency is real. The `.omx/plans/source-overall-cleanup/` artifacts are
  committed.
- Generalizes: the ownership matrix as a committed table of file path to owning
  lane, with an explicit rule that a contested file moves lanes only by explicit
  handoff; the separation of an authoring pass from a review pass in different
  lanes with no self-approval; naming placeholder code as a blocker rather than
  evidence; re-reading handoff artifacts on resume before editing.
- Idiosyncratic: the retired-skill list kept in the law file (13 names "removed,
  not aliased"); the magic-keyword hook protocol; `.clawhip/` and `.omx/`
  alongside `.omc/`, three state roots from three tool generations.
- Sources:
  - https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/CLAUDE.md (`.omc/` state root, handoffs, delegation, no self-approval, failure-mode guards, remember tiers)
  - https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/.omx/plans/source-overall-cleanup/ownership-matrix.md (exclusive ownership rules, lanes, per-file owners)
  - https://github.com/Yeachan-Heo/oh-my-claudecode/tree/main/agents (19 role files)
  - https://github.com/Yeachan-Heo/oh-my-claudecode/blob/main/.clawhip/project.json (project identity)

---

### openai/openai-agents-python

- URL https://github.com/openai/openai-agents-python, 29,404 stars, last push
  2026-09-12, MIT, SHA read `fbd2dbcaaf74a2c447c6d3fa9d5645d83fd7e292`
- Purpose: a library where handoff is an in-process control transfer between
  agent objects, wrapped in a repository whose own `.agents/` workspace is a
  fully specified multi-agent development protocol.
- Two separate reads are needed here, and they answer different questions.

**As a library.** Nothing durable lands on disk. A handoff is a tool the model
can call. `examples/handoffs/message_filter.py` expresses it as
`handoffs=[handoff(spanish_agent, input_filter=spanish_handoff_message_filter)]`,
where the filter receives a `HandoffInputData` carrying `input_history`,
`pre_handoff_items`, and `new_items`, and returns a rewritten copy;
`handoff_filters.remove_all_tools` strips tool messages from the transferred
history. The whole run is wrapped in `with trace(workflow_name="Message
filtering")`, which sends traces to a service, not to a file. A second example,
`examples/customer_service`, shows the same shape with a triage agent.
Persistence is opt-in via a session object, documented in
`.agents/references/session-persistence.md` and `examples/memory/`.

**As a workspace.** `.agents/` in the repo root is the interesting artifact.
```
AGENTS.md
.agents/references/*.md    18 files, each a contract for one subsystem
                           (runstate-schema, session-persistence,
                           run-item-lifecycle, tool-identity, ...)
.agents/skills/<name>/     13 skills, each with SKILL.md, agents/openai.yaml,
                           and often references/, scripts/, templates/
```
- Primitives present, for the workspace:
  1. Law: `AGENTS.md` plus `.agents/references/` as the subsystem contracts.
  3. Index: `.agents/references/README.md`.
  7. Records: the 18 reference files.
  8. Skills: 13, including `implementation-kickoff`, `implementation-strategy`,
     `maintainer-review`, `code-change-verification`, `runtime-behavior-probe`,
     `sensitive-logging-audit`, `pr-draft-summary`, `release-candidate-prep`.
  9. Roles: `.agents/skills/<name>/agents/openai.yaml` binds each skill to an
     agent definition.
  10. Task graph: the **ExecPlan**. `implementation-kickoff` says "For a
      multi-step task, create and maintain the repository's required ExecPlan",
      and classifies it as operational: "An ExecPlan, review packet, ledger,
      trace, or temporary report is operational-only by default even when
      repository policy requires creating it; do not add it to the shipped-path
      manifest."
  11. Handoff: the **PR handoff packet**, a structured in-conversation object
      rather than a file. Section 6 requires "a self-contained packet containing
      the original requirement, implementation scope contract, important
      decisions and intent, complete changed-path inventory including untracked
      files, final diff and statistics, compatibility notes, issue references,
      and takeover provenance." It is invalidated on any change: "If the diff,
      scope, base, behavior claim, issue relationship, or provenance changes
      after generation, regenerate the entire PR handoff."
  12. Evidence: `python .agents/skills/implementation-kickoff/scripts/
      validate_handoff.py --repo <worktree> --base <final-base>
      --expected-branch <branch> --shipped-path-manifest <manifest>`. The
      manifest "contains one exact repository-relative shipped path per line and
      excludes operational artifacts", and the staged set is compared
      "byte-for-byte" against it, with "any missing or unexpected path" a hard
      stop. High-risk review adds `review_state.py --complete-diff-output
      <complete.diff>` and a "strict packet/ledger protocol". The validator's
      own limits are stated: it "checks Git topology and repository cleanliness;
      it does not replace semantic review or fingerprint verification."
  13. Gates: three review tiers (lightweight, ordinary, high-risk) selected by
      `$implementation-final-review`; `$code-change-verification` runs after a
      clean review. Authority is bounded up front: explicit invocation
      authorizes worktree creation, rebase, branch creation, staging, and one
      local commit, and "never authorizes push, pull-request creation, or any
      GitHub mutation."
  14. Boundary: the shipped-path manifest versus operational artifacts is the
      boundary, and it is enforced by a script.
  15. Maintenance loop: `docs-sync`, `release-candidate-prep`,
      `test-coverage-improver` skills.
  16. Tool projections: `.agents/` with per-skill `agents/openai.yaml`.
- Primitives absent: no state surface, no capture inbox, no durable memory, no
  dated log, no committed claim ledger, no multi-project routing.
- Loop: eight numbered steps. Establish the task boundary; create a detached
  worktree from a freshly fetched `origin/main`; implement with **no commits at
  all** through testing and review fixes; re-fetch and replay onto the new base
  via a named temporary stash; run the review tier and verification; generate
  the PR handoff; re-fetch once more, then create the branch and exactly one
  commit; validate and hand off. The worktree stays in place afterward, and the
  report must "State explicitly that nothing was pushed and no pull request was
  created." A resume rule exists: "If the current directory is a worktree
  previously created for this same task in the current conversation, resume it."
- Memory split: per-task in one detached worktree under "the configured Codex
  worktree root"; nothing per-user or per-project persists.
- Human gates: no push, no PR creation, no GitHub mutation. The skill must not
  start "during an investigation-only phase or before a required user approval".
  A missing commit author identity is a hard stop: "Never invent an email
  address."
- Evidence of real use: 13 skills with scripts and paired tests
  (`test_validate_handoff.py`, `test_prepare.py`, `test_inventory.py`),
  which means the protocol's tooling is itself under test.
- Generalizes: keeping the task diff uncommitted until the very end, so the
  final commit is the only commit and review applies to exactly what ships; the
  shipped-path manifest compared byte-for-byte against the staged set; declaring
  planning artifacts operational-only so they never leak into the deliverable;
  replay-onto-latest-base as a required step rather than a courtesy;
  no-collision rules that pick a new worktree path instead of deleting an
  existing one.
- Idiosyncratic: the detached-HEAD trick used specifically so that the branch
  name suggestion from `$pr-draft-summary` is authoritative and temporary names
  cannot become output.
- Sources:
  - https://github.com/openai/openai-agents-python/blob/main/.agents/skills/implementation-kickoff/SKILL.md (worktree protocol, handoff packet, validator, manifest, gates, failure behavior)
  - https://github.com/openai/openai-agents-python/blob/main/examples/handoffs/message_filter.py (HandoffInputData, input_filter, trace)
  - https://github.com/openai/openai-agents-python/tree/main/.agents/references (18 subsystem contracts incl. session-persistence.md, runstate-schema.md)
  - https://github.com/openai/openai-agents-python/tree/main/.agents/skills (13 skills with agents/openai.yaml)

---

### crewAIInc/crewAI

- URL https://github.com/crewAIInc/crewAI, 58,449 stars, last push 2026-09-11,
  MIT, SHA read `894898f84c4ac0a89f24bf7bee6c381eb0e67f51`
- Purpose: a framework where roles and tasks are declared in YAML and bound to
  Python decorators, run as a sequential or hierarchical process.
- Entry files: none for an agent. The template `README.md` addresses a human and
  names four files to edit: `config/agents.yaml`, `config/tasks.yaml`,
  `crew.py`, `main.py`.
- Layout written by `crewai create` (from
  `lib/cli/src/crewai_cli/templates/crew/`):
  ```
  config/agents.yaml    role, goal, backstory per agent, with {topic} templating
  config/tasks.yaml     description, expected_output, agent per task
  crew.py               @CrewBase class; @agent and @task methods bind to the
                        YAML by key; @crew returns Crew(process=Process.sequential)
  main.py               inputs
  knowledge/user_preference.txt
  skills/.gitkeep
  tools/custom_tool.py
  .gitignore            .env, __pycache__/, .DS_Store
  pyproject.toml, README.md
  ```
  A `flow` template adds `crews/<name>/` subdirectories, one config pair per crew.
- Primitives present:
  5. Durable memory: `knowledge/user_preference.txt`, a plain text file in the
     scaffold. Runtime memory goes to a database path resolved by
     `crewai_core.paths.db_storage_path`, outside the project.
  9. Roles: `config/agents.yaml`. Exactly three fields per agent: `role`,
     `goal`, `backstory`. The researcher entry reads
     `goal: Uncover cutting-edge developments in {topic}`.
  10. Task graph: `config/tasks.yaml`. Fields: `description`,
      `expected_output`, `agent`. Ordering is positional, and the process is
      `Process.sequential`. There is no dependency field; context flows because
      the reporting task's description says "Review the context you got".
  12. Evidence: one line in the template, `output_file='report.md'` on the
      reporting task. The README confirms it: "will run the create a `report.md`
      file with the output".
  16. Tool projections: an empty `skills/` directory with a `.gitkeep`.
- Primitives absent, and this is the point: no law file, no state surface, no
  index, no capture inbox, no dated log, no decision records, no claim or lock,
  no handoff artifact, no gates, no maintenance loop, no multi-project routing.
  Between runs the only things that persist are `report.md`, the knowledge file,
  and whatever the out-of-project storage directory holds.
- Loop: `crewai run` assembles the crew from YAML and executes tasks in
  declaration order. No startup read, no maintenance cadence.
- Memory split: per-project in `knowledge/`; runtime memory in a storage
  directory outside the project (`db_storage_path`, overridable with
  `CREWAI_STORAGE_DIR`); nothing per-session on disk in the scaffold.
- Human gates: none in the scaffold.
- Evidence of real use: none specific to a multi-agent workspace. The templates
  are the product.
- Generalizes: declaring a role as three fields (role, goal, backstory) and a
  task as three fields (description, expected_output, agent) in YAML that a
  human can diff, with code holding only the binding. `expected_output` as a
  required field on every task is a useful discipline.
- Idiosyncratic: `{topic}` and `{current_year}` placeholders interpolated at
  kickoff; the decorator-to-YAML-key binding.
- Sources:
  - https://github.com/crewAIInc/crewAI/blob/main/lib/cli/src/crewai_cli/templates/crew/config/agents.yaml
  - https://github.com/crewAIInc/crewAI/blob/main/lib/cli/src/crewai_cli/templates/crew/config/tasks.yaml
  - https://github.com/crewAIInc/crewAI/blob/main/lib/cli/src/crewai_cli/templates/crew/crew.py
  - https://github.com/crewAIInc/crewAI/blob/main/lib/cli/src/crewai_cli/templates/crew/README.md
  - https://github.com/crewAIInc/crewAI/blob/main/lib/cli/src/crewai_cli/templates/crew/.gitignore

---

### langchain-ai/new-langgraph-project

- URL https://github.com/langchain-ai/new-langgraph-project, 293 stars, last
  push 2026-08-25, MIT, SHA read `f7e2ee300d483b5c0602d57518f3351ad5d55850`
- Purpose: the official starter template for a LangGraph project, a graph
  defined in code with a declared entry point.
- Entry files: none for an agent. `langgraph.json` is the machine entry point.
- Layout, complete (27 tracked paths):
  ```
  langgraph.json    {"graphs": {"agent": "./src/agent/graph.py:graph"},
                     "dependencies": ["."], "env": ".env",
                     "image_distro": "wolfi"}
  src/agent/graph.py  Context TypedDict, State dataclass, one node, compiled graph
  tests/unit_tests/, tests/integration_tests/
  .env.example, Makefile, pyproject.toml, uv.lock
  .github/workflows/{unit-tests,integration-tests}.yml
  .gitignore          last line: .langgraph_api/
  ```
- Primitives present:
  10. Task graph: the graph itself, as code. `StateGraph(State,
      context_schema=Context).add_node(call_model).add_edge("__start__",
      "call_model").compile(name="New Graph")`. Nodes and edges, not tickets.
  14. Boundary: `.langgraph_api/` in `.gitignore` is the local runtime
      persistence directory. That single line is the only on-disk persistence
      evidence in the template.
- Primitives absent: everything else. No law file, no roles, no handoff, no
  claim, no evidence, no gates, no memory split, no tool projections, no
  multi-project routing. This is a library template with no on-disk workspace
  shape; checkpointer configuration is not in the template at all, and
  `State`/`Context` are the only persistence contract shown.
- Loop: not stated.
- Memory split: per-run state in the `State` dataclass, threaded through the
  graph; local server state in the ignored `.langgraph_api/`.
- Human gates: none.
- Evidence of real use: none. It is a scaffold.
- Generalizes: separating a `Context` (set at assistant creation or invocation)
  from a `State` (threaded through the run) is a clean two-tier split that
  file-based systems reproduce as law-versus-state-surface.
- Idiosyncratic: `langgraph.json` as a deploy manifest naming
  `path.py:variable`.
- Sources:
  - https://github.com/langchain-ai/new-langgraph-project/blob/main/langgraph.json
  - https://github.com/langchain-ai/new-langgraph-project/blob/main/src/agent/graph.py
  - https://github.com/langchain-ai/new-langgraph-project/blob/main/.gitignore

---

### google/adk-samples

- URL https://github.com/google/adk-samples, 10,308 stars, last push
  2026-09-12, Apache-2.0, SHA read `17f314a1aaba4f70390c69b14ff096a4deda6643`
- Purpose: a monorepo of ADK agent samples across six languages, with a shared
  `.agents/skills/` toolkit for keeping the samples consistent.
- Entry files: none per sample. The repo-level `.agents/skills/` carries the
  conventions.
- Layout of one sample, `python/agents/memory-bank/`:
  ```
  app/agent.py, app/agent_engine_app.py, app/fast_api_app.py
  app/app_utils/{memory_config,deploy,telemetry,typing}.py
  tests/unit/, tests/integration/
  Dockerfile, Makefile, pyproject.toml, uv.lock, README.md, .gitignore
  ```
  Repo-level, the interesting part:
  ```
  .agents/skills/<name>/SKILL.md + scripts/*.py + tests/*.py
    align-recipe-pyproject, extract-python-environment-variables,
    generate-manifest, generate-python-runnability-test,
    make-python-recipe-deployable (with resources/templates/)
  skills/, tools/, core/, contrib/, docs/
  python/agents/  18 samples; also go/, java/, kotlin/, typescript/
  ```
- Primitives present:
  5. Durable memory: a managed cloud service, not files. `memory_config.py`
     builds a `MemoryBankConfig` with managed topics
     `USER_PERSONAL_INFO`, `USER_PREFERENCES`, `KEY_CONVERSATION_DETAILS`,
     `EXPLICIT_INSTRUCTIONS`, plus custom topics. The README explains the
     mechanism: an `after_agent_callback` sends session events to Memory Bank
     after each turn, and `PreloadMemoryTool` "injects relevant memories into
     the system instruction at the start of each turn".
  8. Skills: `.agents/skills/<name>/SKILL.md` with executable scripts and
     pytest files beside them.
  15. Maintenance loop: the skills are the loop. `align-recipe-pyproject`,
      `generate-manifest`, and `generate-python-runnability-test` exist to keep
      18+ samples structurally consistent.
  17. Multi-project routing: the monorepo holds many samples across six
      language roots, but each sample is self-contained with its own
      `pyproject.toml` and no inherited instruction file.
- Primitives absent: no law file per sample, no state surface, no roles as
  files, no task graph, no claim, no handoff, no evidence artifact, no gates.
  Session and memory persistence are entirely off-disk. This is the clearest
  case in the slice of a system that has no on-disk workspace shape at all: the
  durable record is a Vertex AI Memory Bank keyed by user and topic.
- Loop: per turn, `PreloadMemoryTool` reads and `after_agent_callback` writes;
  Memory Bank consolidates between sessions. No startup file read.
- Memory split: per-user memory in the managed Memory Bank, scoped by topic;
  no per-project, per-machine, or per-session file.
- Human gates: none in the sample.
- Evidence of real use: 18 Python samples plus five other language roots, with
  a skills toolkit built to maintain them.
- Generalizes: naming the *topics* memory is allowed to hold
  (personal info, preferences, key conversation details, explicit instructions)
  rather than letting memory accrete freely. That is a schema for durable
  memory that transfers directly to a file-based `USER.md`.
- Idiosyncratic: memory as a billed managed service with server-side
  consolidation, which means nothing is reviewable in a diff.
- Sources:
  - https://github.com/google/adk-samples/blob/main/python/agents/memory-bank/README.md (cross-session memory, callbacks, PreloadMemoryTool)
  - https://github.com/google/adk-samples/blob/main/python/agents/memory-bank/app/app_utils/memory_config.py (managed topic enum, customization config)
  - https://github.com/google/adk-samples/tree/main/.agents/skills (repo-level maintenance skills)
  - https://github.com/google/adk-samples/tree/main/python/agents (18 samples)

---

## Patterns across this slice

Legend: Y present as a named file or folder, P partial or present only as a
convention/API, N not found. Columns are abbreviated.

| # | Primitive | gastown | beads | ruflo | entire | ClaudeCode | omc | openai | crewAI | langgraph | adk |
|---|-----------|---------|-------|-------|--------|------------|-----|--------|--------|-----------|-----|
| 1 | Law | Y | Y | Y | Y | Y | Y | Y | N | N | N |
| 2 | State surface | P | N | N | N | N | Y | N | N | N | N |
| 3 | Index or map | Y | Y | P | P | Y | Y | Y | N | N | N |
| 4 | Capture inbox | N | N | N | N | N | N | N | N | N | N |
| 5 | Durable memory | Y | P | Y | Y | Y | Y | N | Y | N | P |
| 6 | Dated log | Y | P | Y | Y | N | Y | N | N | N | N |
| 7 | Records | Y | Y | Y | Y | N | Y | Y | N | N | N |
| 8 | Skills | Y | Y | Y | Y | Y | Y | Y | P | N | Y |
| 9 | Roles | Y | Y | Y | Y | Y | Y | Y | Y | N | N |
| 10 | Task graph | Y | Y | P | N | N | Y | P | Y | P | N |
| 11 | Handoff / claim | Y | Y | P | Y | P | Y | P | N | N | N |
| 12 | Evidence | Y | Y | P | Y | P | Y | Y | P | N | N |
| 13 | Gates | Y | Y | Y | Y | P | Y | Y | N | N | N |
| 14 | Boundary | Y | Y | Y | Y | Y | Y | Y | P | P | N |
| 15 | Maintenance loop | Y | Y | Y | Y | P | Y | Y | N | N | Y |
| 16 | Tool projections | Y | Y | Y | Y | Y | Y | Y | P | N | P |
| 17 | Multi-project | Y | Y | P | Y | Y | Y | N | P | N | P |

Every system in this slice that actually coordinates multiple agents has a law
file, named roles as separate files, and a declared boundary between runtime
state and durable record; the three that lack all of them (crewAI, the LangGraph
template, adk-samples) are libraries whose agents never outlive a process. The
single sharpest dividing line is where the durable record lives: gastown and
beads put it in a database synced over a dedicated git ref, Entire puts it in git
refs directly, oh-my-claudecode and ruflo put it in a mostly-gitignored state
directory with one committable exception, and the library scaffolds put it
nowhere or in a cloud service. Not one of the eleven has a capture inbox, which
is a genuine gap: these systems all assume work arrives already shaped as a
ticket or a prompt, never as raw unprocessed input. Roles converge hard on
Markdown with YAML frontmatter, and Anthropic's `.claude/agents/*.md` is the de
facto schema even for tools that also target Codex and Cursor. Claims split into
two families: a database-backed atomic claim (beads `--claim`, first writer
wins) and a plain-file ownership table (oh-my-claudecode's ownership matrix, one
owner per file per lane), with ruflo sitting in between by stating the rule in
prose and enforcing it through worktree isolation. Handoff splits the same way:
either a persistent message and a pinned work item (gastown's mail plus Hook),
or a reconstructed summary with a fixed section schema (Entire's six sections,
openai-agents' PR packet), and notably the two most rigorous handoff
specifications both refuse to write a handoff file, deriving it instead from the
recorded transcript or the live diff. Evidence is the primitive where the
serious systems are most alike and most distinctive: gastown, beads, and
openai-agents all bind a verdict to exact commit SHAs and keep a machine-readable
artifact beside a human-readable one, and all three treat a missing or extra file
path as a hard stop rather than a warning. Per-agent worktrees are nearly
universal among the coordinating systems, and three of them independently
arrived at the same rule, that one worktree has exactly one writer. Gates cluster
on the same three actions everywhere: push, publish, and merge, with beads
encoding this as three named authority profiles and openai-agents as a flat
prohibition on any GitHub mutation. Finally, the systems that have been run hard
show it in their repair history rather than their docs: oh-my-claudecode's recent
commits are all lock-acquisition bug fixes, and gastown's heartbeat doc exists
because a Deacon refreshed one store while another aged past threshold.

## Task, claim, and handoff shapes

| System | Task record format | Claim or lock mechanism | Handoff artifact | Evidence artifact | Durable vs runtime |
|---|---|---|---|---|---|
| gastownhall/gastown | Bead in Dolt; Molecule = chained beads; Wisp = ephemeral bead; Convoy = work order grouping beads; Formula = TOML template | **Hook**, a pinned bead per agent; `gt sling` assigns onto a Hook; GUPP forces execution; `.beads/.exclusive-lock`; three heartbeat stores for liveness | `gt mail` (persistent, survives restart), `gt nudge` (into a live session), `/handoff` (session refresh), `gt seance` (query predecessor sessions) | `pr-sheriff-evidence/<run-id>/{evidence.json,report.md,merge-gate-check.txt}`; evidence.json has schema_version, policy_version, run_id, subject.base_sha/head_sha, diff_summary.paths, action_plan | Durable: Dolt `refs/dolt/data`, `.beads/config.yaml`, agent bead + CV chain, committed evidence dirs. Runtime: `dolt/`, `bd.sock`, `daemon.*`, `interactions.jsonl`, `ephemeral.sqlite3`, `push-state.json`, polecat sandbox and worktree |
| gastownhall/beads | Bead: id, title, description, type (bug/feature/task/epic/chore/question/docs), priority 0-4, status, assignee (plain string), labels, `--acceptance`, `--design`, deps incl. `discovered-from`, parent/child `bd-epic.1`. `.beads/issues.jsonl` is an export, not the sync channel | `bd update <id> --claim` atomic, first wins, idempotent on repeat; `bd ready --claim --json`; release by clearing assignee + status open; `bd merge-slot acquire/release` = one-holder exclusive primitive named `<prefix>-merge-slot`; `engdocs/EXCLUSIVE_LOCK.md` | `bd comment` then `bd assign <next-agent>`; `bd mail` delegating to the orchestrator's provider; session-completion protocol files follow-up beads | `release-gates/<bead>-gate.md`: builder bead, deploy bead, review bead + verdict + commit, commit list, branch, evaluator + date, `git diff --stat` scope, gate criteria table; `Agent-Signature:` commit trailer; bead id in commit subject for `bd doctor` orphan detection | Durable: Dolt under `refs/dolt/data`, `.beads/config.yaml`, `metadata.json`, release-gate files. Runtime/per-machine: `dolt/`, `ephemeral.sqlite3` (wisps, molecules), `sync-state.json`, `export-state/`, `redirect`, all `*.lock` |
| ruvnet/ruflo | MCP-level: `swarm_init`, `agent_spawn`, `agent_execute`, plus Claude Code `Task`/`TaskList`/`TaskGet`/`TaskUpdate`; GOAP goals | Stated, not filed: "A lease or work claim coordinates ownership; it never grants authority"; enforced by one-writer-per-worktree and explicit file ownership; one integration owner for shared manifests | `handoff` is a named step in the loop; `.claude/checkpoints/<epoch>.json`; memory namespaces (`swarm`, `swarm-state`) carry coordination decisions | `receipt` step in the loop; evidence bound "to an exact clean commit or immutable dirty-worktree snapshot"; per-plugin `scripts/smoke.sh` with fixed pass counts; `.harness/manifest.json` sha256 fingerprints | Durable: `agentdb.rvf`, `memory/agents/`, `memory/sessions/`, `.harness/*`, plugin ADRs, dream-cycle docs. Runtime: `.swarm/`, `.hive-mind/hive.db*`, `.ruv-swarm/`, `.claude-flow/`, `agentdb.rvf.lock` |
| entireio/cli + skills | None. Entire records; it does not assign | None | No file. `session-handoff` skill reconstructs a six-section summary from the transcript: Task Overview, Current State, Important Discoveries, Next Steps, Context to Preserve, Unanswered Question. Checkpoint handoff enumerates all contributing sessions, capped at 8 | Checkpoint on the commit: transcript, summary, attribution, `TokenUsage` incl. `SubagentTokens`; `checkpoint-signing.md`; `.entire/runners/trail-*.json` | Durable: git ref `entire/checkpoints/v1`, `.entire/settings.json`, `.entire/runners/*.json`, remote checkpoint repo. Runtime: `.git/entire-sessions/` StateStore, ephemeral shadow branch, `.entire/{tmp,metadata,logs,current_session}`, `settings.local.json` |
| Claude Code (vendor) | None as a file convention; `.claude/workflows/*.js` scripts spawn and coordinate subagents | None. `isolation: worktree` in subagent frontmatter gives per-agent isolation instead | Session-level: `/rewind`, "Summarize from here", "Summarize up to here", `/branch`, `--continue --fork-session` | Checkpoints: pre-turn file snapshots, 100 most recent per session, swept ~30 days, and explicitly "Not a replacement for version control"; subagent edits usually not restored | Durable/committed: `CLAUDE.md`, `.claude/{settings.json,rules,skills,commands,agents,workflows}`, `.claude/agent-memory/<agent>/MEMORY.md`, `.worktreeinclude`. Local: `~/.claude/**`, `.claude/settings.local.json`, `~/.claude/projects/<project>/memory/MEMORY.md` |
| oh-my-claudecode | `.omx/plans/<plan>/` PRD + test spec + inventory; lanes 0-3 each with one owner | **`ownership-matrix.md`**: "One active owner per file or serialized module family", per-lane tables of file paths, contested file "can move to Lane 3 only via explicit handoff"; runtime file locks (`acquireStateFileLockSync`, `acquireRecoveryClaim`) | `.omc/handoffs/` (runtime), plus the ownership matrix's explicit-handoff rule; on resume, re-read `.omc/state/` and `.omc/handoffs/` before editing | `.omc/artifacts/`; verifier evidence required before completion; placeholder code, `test.skip`/`.only`, stub tests named as blockers not evidence; no self-approval in the same context | Durable/committed: `CLAUDE.md`, `agents/*.md`, `.omx/plans/**`, `.omc/skills/**` (the stated exception). Runtime/ignored: `.omc/{state,logs,artifacts,handoffs,research,plans,ultragoal}`, `notepad.md`, `project-memory.json`; removed with a linked worktree unless `OMC_STATE_DIR` centralizes them |
| openai-agents (workspace) | **ExecPlan**, required for multi-step work, classified operational-only and barred from the shipped-path manifest | No claim file. Isolation instead: one dedicated detached worktree per task under the Codex worktree root; collisions are never reused or deleted; resume the same worktree within a conversation | **PR handoff packet**: original requirement, scope contract, decisions and intent, complete changed-path inventory incl. untracked, final diff and statistics, compatibility notes, issue refs, takeover provenance; fully regenerated if diff, scope, base, claim, issue link, or provenance changes | `validate_handoff.py --repo --base --expected-branch --shipped-path-manifest`; manifest is one repo-relative path per line, compared byte-for-byte with the staged set, any mismatch a hard stop; high-risk adds `review_state.py --complete-diff-output` and a packet/ledger protocol | Durable: exactly one commit on one branch, local, unpushed. Operational-only (never shipped): ExecPlan, review packet, ledger, trace, temporary report, worktree path, validator output |
| crewAI | `config/tasks.yaml`: `description`, `expected_output`, `agent`; order is positional; `Process.sequential`; no dependency field | None | None | `output_file='report.md'` on the task | Durable: `report.md`, `knowledge/user_preference.txt`. Runtime: memory DB at `db_storage_path`, outside the project |
| LangGraph template | Graph nodes and edges in `src/agent/graph.py`; `State` dataclass + `Context` TypedDict | None | None | None | Durable: nothing in the template. Runtime: `.langgraph_api/` (gitignored) |
| adk-samples | None | None | None | None | Durable: Vertex AI Memory Bank, off-disk, topic-scoped. Runtime: in-process session events |

## Names people actually use

Counts are systems in this slice that use that exact name.

1. **Law**: `CLAUDE.md` (6: gastown, beads, ruflo, entire, Claude Code, omc),
   `AGENTS.md` (6: gastown, beads, ruflo, entire, openai-agents, omc),
   `.claude/rules/*.md` (1), `.github/copilot-instructions.md` (1),
   `CLAUDE.local.md` (1), `SKILL.md` at root (1),
   `templates/polecat-CLAUDE.md` and `templates/witness-CLAUDE.md` (1),
   `.beads/PRIME.md` (1). Managed-block delimiters:
   `<!-- BEGIN BEADS INTEGRATION -->` / `<!-- end-beads-agent-instructions -->`,
   `<!-- OMC:START -->` / `<!-- OMC:VERSION:5.4.0 -->`.
2. **State surface**: `.omc/notepad.md` (1), `.omc/state/` (1),
   `gt prime` as a command rather than a file (1). Nothing else.
3. **Index or map**: `docs/glossary.md` (1), `MEMORY.md` as index (1: Claude
   Code), `docs/cli-reference/index.md` and `docs/multi-agent/index.md` (1),
   `.agents/references/README.md` (1), the `wiki` skill (1).
4. **Capture inbox**: none found in any of the eleven. The closest are
   `gt mail inbox` and `bd mail inbox`, which are agent-to-agent message
   queues, not folders for unprocessed human input.
5. **Durable memory**: `MEMORY.md` (2: Claude Code at two scopes, plus
   `.claude/agent-memory/<agent>/MEMORY.md`), `memory/agents/` and
   `memory/sessions/` (1), `agentdb.rvf` (1),
   `.omc/project-memory.json` (1), `knowledge/user_preference.txt` (1),
   agent bead + CV chain (1), Vertex AI Memory Bank managed topics (1),
   checkpoint transcript + summary (1).
6. **Dated log**: `docs/dream-cycles/<date>-<topic>-sota.md` (1),
   `.claude/checkpoints/<epoch>.json` (1), `events.jsonl` (1),
   `interactions.jsonl` (1, gitignored), `.omc/logs/` (1),
   `.omc/state/sessions/{sessionId}/` (1), date-prefixed session ids (1),
   `benchmarks/results/<name>-<ISO8601>.md` (1),
   `.omc/context/<slug>-<ISO8601>.md` (1).
7. **Records**: `docs/adrs/0001-*.md` (1), `engdocs/decisions/<date>-<slug>.md`
   (1), `PROPOSAL-*.md` (1), `docs/design/*.md` (1),
   `docs/architecture/*.md` (1), `.agents/references/*.md` (1),
   `.omx/plans/<plan>/*.md` (1).
8. **Skills or procedures**: `SKILL.md` is universal (8 systems), under
   `.claude/skills/<name>/`, `.agents/skills/<name>/`, `skills/<name>/`, or
   `.omc/skills/`. Also `commands/*.md` (4), Formulas as
   `*.formula.toml` (2: beads, gastown), Protomolecule and Molecule (2),
   `.agent/workflows/<name>.md` (1), `.claude/workflows/*.js` (1),
   `evals/<case>/prompt.md` + `graders/*.md` (1).
9. **Roles or agent definitions**: `.claude/agents/<name>.md` (4),
   `agents/<name>.md` at repo root (2), `plugins/*/agents/*.md` (2),
   `.agents/skills/<name>/agents/openai.yaml` (1),
   `config/agents.yaml` (1), `templates/<role>-CLAUDE.md` (1),
   `.gemini/agents/` and `.codex/agents/*.toml` (1).
   Named roles seen: mayor, deacon, dog, boot, polecat, refinery, witness,
   crew, coordinator, architect, planner, executor, reviewer, verifier,
   critic, analyst, debugger, designer, explore, git-master, qa-tester,
   scientist, security-reviewer, test-engineer, tracer, writer,
   memory-specialist, session-specialist, task-agent, dev, test-doc,
   implementer, researcher, test-writer, pr-sheriff, deployer, researcher,
   reporting_analyst.
10. **Task graph**: `.beads/` + `issues.jsonl` (2), Bead / Epic / Molecule /
    Wisp / Convoy / Hook (2), `config/tasks.yaml` (1),
    `.omx/plans/<plan>/` with Lane 0-3 (1), ExecPlan (1),
    `StateGraph` nodes and edges (1), MCP `Task`/`TaskList` (2).
11. **Handoff or claim ledger**: `ownership-matrix.md` (1),
    `.omc/handoffs/` (1), Hook as pinned per-agent bead (1),
    `gt mail` / `gt nudge` / `gt seance` / `/handoff` (1),
    `bd update --claim` / `bd ready --claim` / `bd merge-slot` (1),
    `bd assign` + `bd comment` (1), `session-handoff` SKILL.md (1),
    `session-crosslink` SKILL.md (1), PR handoff packet (1),
    "lease or work claim" in prose (1), `.exclusive-lock` (2),
    `acquireStateFileLockSync` / `acquireRecoveryClaim` (1).
12. **Evidence or receipts**: `release-gates/<bead-id>-gate.md` (1),
    `pr-sheriff-evidence/<run-id>/{evidence.json,report.md,merge-gate-check.txt}`
    (1), `validate_handoff.py` + shipped-path manifest (1),
    `review_state.py --complete-diff-output` (1),
    `scripts/smoke.sh` with a fixed pass count (1),
    `.omc/artifacts/` (1), `.entire/runners/trail-*.json` (1),
    `Agent-Signature:` commit trailer (1), `output_file='report.md'` (1),
    checkpoint attached to a commit (1).
13. **Gates**: `release-gates/` (1), `Gate summary:` and `Final verdict:` lines
    in report.md (1), `bd human <id>` and `bd gate` (1), three agent context
    profiles Conservative/Minimal/Team-maintainer (1),
    `permissionMode` frontmatter (1), review tiers
    lightweight/ordinary/high-risk (1), `AskUserQuestion` requirement (1),
    "separately authorized publish" (1), `gt mail send --human` (1),
    preview-then-confirm before `session attach` (1), maintainer-only
    `omc release` (1).
14. **Boundary**: `.gitignore` inside the state directory (3: `.beads/.gitignore`
    twice, `.entire/.gitignore`), `settings.local.json` (2),
    shipped-path manifest versus operational artifacts (1),
    `.omc/skills/**` as the committable exception (1),
    `.worktreeinclude` (2: Claude Code convention, entireio/cli uses it),
    `.harness/mcp-policy.json` default-deny (1),
    `.langgraph_api/` (1), `redactors/local/` (1).
15. **Maintenance loop**: Patrol / Deacon / Dogs / Boot (1),
    `bd doctor` / `stale` / `orphans` / `lint` / `compact` / `gc` /
    `find-duplicates` (1), `entire doctor` with `trace`/`logs`/`bundle` (1),
    `post-task --train-neural` and `/loop` heartbeat (1),
    `docs/dream-cycles/` (1), `.omx/plans/source-overall-cleanup/` (1),
    `align-recipe-pyproject` / `generate-manifest` /
    `generate-python-runnability-test` (1), `docs-sync` (1),
    the ~30-day retention sweep (1).
16. **Tool projections**: `.claude/` (8), `.codex/` (4), `.cursor/` (3),
    `.agents/` (4), `.gemini/` (1), `.opencode/` (2), `.pi/` (1),
    `.ferrata/` (1), `.clawhip/` (1), `.omx/` (1), `.entire/` (1),
    `.harness/` (1), `.claude-plugin/` (4), `.codex-plugin/` (1),
    `.cursor-plugin/` (1), `gemini-extension.json` (1).
    Projection templates: `internal/templates/agents/defaults/beads-section.md`,
    `beads-section-codex.md`, `beads-section-minimal.md`,
    `templates/agents/opencode.json.tmpl`.
17. **Multi-project routing**: Town holding Rigs (1), `BEADS_DIR` (1),
    `.omc-workspace` marker + `OMC_STATE_DIR` (1),
    nearest `.claude/agents/` wins by walking up to the repo root (1),
    `session adopt` and `session-crosslink` (1),
    federation (`federation init`/`join`/`trust`/`audit`) (2),
    `CREWAI_STORAGE_DIR` (1), monorepo language roots (1).

## Uncertainties

- `gastownhall/gastown` `.beads/backup/issues.jsonl` is in the tracked tree but
  the GitHub contents API returned nothing for it, almost certainly a size
  limit. I therefore did **not** read a raw bead record, and every field I list
  for a bead comes from `internal/templates/agents/defaults/beads-section.md`,
  `docs/multi-agent/coordination.md`, and `docs/cli-reference/*` in the beads
  repo, not from a JSONL line. The exact JSONL key names are unverified.
- I did not read `engdocs/EXCLUSIVE_LOCK.md` or `docs/design/mail-protocol.md`.
  The merge slot and mail claims rest on `docs/multi-agent/coordination.md`,
  `docs/cli-reference/mail.md`, and gastown's `AGENTS.md`. The mechanism behind
  `.beads/.exclusive-lock` is therefore named but not explained here.
- `ruvnet/ruflo` `memory/agents/README.md` and `memory/sessions/README.md` are
  un-ignored by negation patterns in `.gitignore` but the contents API returned
  invalid base64 for both, so I could not read them. What those two directories
  contain is inferred from the `.gitignore` negations and the CLAUDE.md memory
  section, not read.
- I did not find a `ruflo init` template directory in the tree, so the list of
  files written into a target project comes from the repo README's comparison
  table (`.claude/`, `.claude-flow/`, `CLAUDE.md`, helpers, settings), not from
  the template source. The `.swarm/` and `.hive-mind/` shapes come from
  `.gitignore` lines only; I never saw their schemas.
- Anthropic's docs carry no commit SHA, so those citations are not stable in the
  same way the repo citations are. The `claude-directory` page is a React
  component and I read its `FILE_TREE` data structure rather than rendered prose,
  which is why badges are quoted as `committed`, `gitignored`, `local`.
- I looked for an Anthropic doc on multi-session team features and found only
  session-level primitives (`/branch`, `--fork-session`, `session adopt` is
  Entire's, not Anthropic's). If a teams or multi-session feature exists in the
  docs, I did not locate it.
- For crewAI I read `lib/crewai/src/crewai/utilities/paths.py` only to find it
  deprecated in favor of `crewai_core.paths`; I did not open `crewai_core.paths`,
  so the actual default storage directory path is unverified. I state only that
  it resolves outside the project.
- GitHub code search for `filename:HANDOFF.md` returned 20 repos. I did not
  audit them individually; both search-found systems I recorded (gastown,
  oh-my-claudecode) came from the repository search instead, and both are far
  better documented than a bare HANDOFF.md would have been. The 20 HANDOFF.md
  repos remain unexamined.
- No `gh` rate limit was hit. No repository was cloned, installed, or run.
- Evidence-of-use claims rest on the 15 most recent commits per repo plus
  committed artifacts. That is a thin window; a repo could have heavy agent
  traffic outside it, or the agent-looking committer names in gastown and beads
  (`mutant`, `enclave`, `shiny`, `coder`, `Bee`) could be human pseudonyms. The
  branch naming (`polecat/<name>/<bead-id>`) matches the documented polecat
  model, which is why I rate gastown's evidence strong rather than certain.
