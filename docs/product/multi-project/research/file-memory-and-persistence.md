# File memory and optional persistence layers

Research: 2026-09-13. This extends the [Letta study](letta-code-workspace-patterns.md)
with official Claude Code and Hermes documentation and source. No agent runtime,
installer, model, session export, or integration was exercised.
The implementation recommendations below are proposals, not completed capabilities.

## Keep three kinds of information distinct

| Kind | Example | Purpose |
| --- | --- | --- |
| Durable knowledge | Confirmed preference, project convention, decision with rationale | Help future work without replaying a conversation. |
| Work state | Current task, blocker, next action | Resume unfinished work and change as that work progresses. |
| Transcript or version history | Messages, tool output, previous file revisions | Recover what happened and inspect provenance. |

A history store can preserve a wrong assumption as faithfully as a useful fact.
Selecting, correcting, and retrieving knowledge are separate from retaining history.
The products below implement those responsibilities differently.

## Letta: agent memory as a context repository

Letta separates agent-owned memory from conversation history. MemFS projects a Git
repository into files. Its documented `system/` files load into the prompt, while
other files are discovered through an index and read when relevant. A vector index
is not required by default. Local agents keep their repository locally.
Source: [MemFS](https://docs.letta.com/concepts/memfs).

Agents can edit or remove memory files, then commit changes. Saved memory affects
later prompt compilation rather than rewriting the already-running turn. `/init`
studies the existing project and updates memory. `/remember` records a lesson.
Sources: [memory prompt](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/agent/prompts/letta_local_memfs.md),
[Memory and dreaming](https://docs.letta.com/configuration/memory).

The [earlier source study](letta-code-workspace-patterns.md#memory-has-distinct-loading-levels)
records Letta's conditional memory-format variants. Copy the separation of compact
context and retrievable files only after choosing Vivary's own existing file owners.

## Claude Code: authored instructions and selected learnings

`CLAUDE.md` contains persistent instructions. Auto memory contains notes Claude
selects while working. Its repository-scoped directory is
`~/.claude/projects/<project>/memory/`, shared by worktrees of that repository.
The files are machine-local, without automatic cross-machine sharing.

The first 200 lines or 25 KB of auto memory's `MEMORY.md`, whichever comes first,
load at conversation start. Detailed topic files load through file tools when
needed. This limit does not truncate ordinary `CLAUDE.md` files.

Users can inspect, edit, or delete auto-memory Markdown through `/memory` or an
editor. `/init` generates starting project instructions and suggests improvements
when `CLAUDE.md` already exists. To reuse `AGENTS.md`, a `CLAUDE.md` import avoids
keeping two copies of the same instructions.
Source: [Claude Code memory](https://code.claude.com/docs/en/memory).

Transcripts are separate JSONL files containing messages and tool results.
Transcript retention and auto-memory retention differ.
Source: [Claude application data](https://code.claude.com/docs/en/claude-directory#application-data).

## Hermes: bounded notes plus searchable sessions

Hermes stores curated `MEMORY.md` and `USER.md` under its home directory's
`memories/`. Their documented default limits are 2,200 and 1,375 characters.
Both enter the system prompt as a frozen session-start snapshot. Writes persist
immediately, but that snapshot changes at the next session.

These stores hold selected facts and preferences. The `memory` tool supports
add, replace, and remove. Over-capacity writes fail instead of silently dropping
entries. Conversation search uses separate SQLite/FTS session history.
Source: [Hermes persistent memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/).

Pinned [store source](https://github.com/NousResearch/hermes-agent/blob/422bc9bde9d212ab3741fbc45a871a3938436d59/tools/memory_tool_store.py)
locks and re-reads before mutation, rejects ambiguous replacement matches, and
refuses unreadable or incompatible existing content. The
[tool source](https://github.com/NousResearch/hermes-agent/blob/422bc9bde9d212ab3741fbc45a871a3938436d59/tools/memory_tool.py#L132-L169)
also stages unattended background replacements/removals. This is source behavior,
not evidence of the Hermes version installed on Jeff's machines.

Hermes reads project `AGENTS.md` guidance separately and seeds a missing global
`SOUL.md` without overwriting an existing one. Profiles separate agent homes.
Copying curated memory and starting with fresh sessions are distinct operations.
Sources: [context files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files),
[personality](https://hermes-agent.nousresearch.com/docs/user-guide/features/personality),
[profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles).

## What optional persistence tools add

| Tool | Primary responsibility | Boundary for Vivary |
| --- | --- | --- |
| Git | Records file changes and supports recovery. | History does not select relevant knowledge for a prompt. |
| Jujutsu | Adds change and operation history, including undo/restore, over an optional Git backend. | Colocated Git/Jujutsu mutating operations need coordination. |
| Entire | Captures agent sessions and checkpoints, with an optional GitHub mirror. | Provenance and transcripts are separate from curated memory. Capture can include sensitive session data. |
| Beads | Tracks a persistent issue graph and provides remembered insights through `bd remember` and `bd prime`. | An optional task/memory adapter with its own data owner, not a version-control backend. |

Sources: [Git version control](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control),
[Jujutsu Git compatibility](https://docs.jj-vcs.dev/latest/git-compatibility/),
[Jujutsu operation log](https://docs.jj-vcs.dev/latest/operation-log/),
[Entire](https://docs.entire.io/), [Entire security](https://docs.entire.io/security),
[Beads source and documentation](https://github.com/gastownhall/beads).

Beads documents Dolt as its authoritative backend, with embedded single-writer
operation or an optional server. `.beads/issues.jsonl` is an export, not the
authoritative database or a sufficient backup. Beads can operate without Git.
Source: [Beads](https://github.com/gastownhall/beads).

Choose one owner for each fact or task. If Beads owns a task, link to it from
Markdown instead of maintaining two editable task records. Keep optional history
capture and remote synchronization explicit. The private Entire-only branch rule
remains a delivery constraint. It does not prove active session capture.

## Proposal: start with files and the existing runtime

Keep the original `AGENTS.md`, `.vivary/context.md`, and `STATE.md` responsibilities.
Use a compact entrypoint to link durable project knowledge, current work, and
reusable skills. Add focused files only when they carry useful content. Preserve
the user's existing vault or repository layout instead of imposing another tree.
Source boundary: [original Vivary map](original-vivary-product-map.md).

Use ordinary read/search tools to retrieve linked details. A vector database,
background learner, and separate conductor are not prerequisites for that slice.
The missing product work is explicit Native integration: resolve the active
project, load its permitted guidance, and expose supported file changes.
Saving Markdown alone does not make the agent read it.

Offer visible save, correct, and forget operations using the existing file-editing
path. Save a durable lesson in its owning file. Replace the superseded statement
rather than appending a contradiction. Show the resulting text and when the
running agent will reload it. Protect manual edits with the same conflict handling
used by the workspace editor.

Forgetting an active note should remove it from future memory retrieval. Explain
separately whether copies remain in transcripts, Git history, Entire checkpoints,
or backups. Do not label active-file deletion as complete historical erasure.
Keep personal notes and credentials out of shared project history.

Initialize from the selected folder and the user's stated purpose. Preview useful
guidance and starter files through the original creator/adopter, preserving existing
content. The [workspace patterns](letta-code-workspace-patterns.md#proposal-compose-a-workspace-around-the-work)
apply to second brains, wikis, writing, and mixed projects without mandatory language packs.

A separate always-running conductor needs a concrete scheduling or coordination
requirement. Reuse Native runs, conversations, actions, and supported delegation
first. The documentation-only [Bellamente/AgentLTM path](../../../bellamente-memory/README.md)
and optional Cognee integration are separate enhancements. WikiSkill's existing
instruction/skill improvement requirements remain outside basic file continuity.

Do not automatically install a global Vivary CLI merely to read or edit memory.
Where Create/Adopt requires original Vivary code, resolve that dependency through
the application's packaging and supported creator composition. CLI availability
and version can be shown as an integration capability. Basic file continuity
should not require a separate CLI installation, Git, Jujutsu, Entire, or Beads.

## Limits and next proof

This research does not establish an implemented Vivary memory engine or automatic
cross-provider memory synchronization. A focused product check should save one
confirmed fact, start a fresh conversation, retrieve it, correct it, and forget it
without crossing project scope. Native remains the execution owner.
The [external template hold](../tickets/19-integrate-template-program.md), local
no-login product direction, and pending authentication approval are unchanged.
