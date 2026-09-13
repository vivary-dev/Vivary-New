# Letta Code patterns for Vivary workspaces

Research: 2026-09-13. This note compares official Letta documentation and source
with the [original Vivary product map](original-vivary-product-map.md).
Letta source pointers use commit
[`1ec6a43`](https://github.com/letta-ai/letta-code/commit/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339).
No Letta installation or runtime trial was performed. The Vivary design below is a proposal.

## Persistent identity is separate from a conversation

A Letta agent has an identity, personality, memory, model/tool configuration, and
one or more conversations. Conversations share that agent's memory. Separate
agents provide separate identities and memory. This supports continuity without
treating every chat as a different assistant.
Source: [Stateful agents](https://docs.letta.com/concepts/stateful-agents).

Letta also supports local agents without an account. Its documented local state
directory is `~/.letta/lc-local-backend`, with an agent's memory repository under
`memfs/<agent-id>/memory`. Model inference remains a separate choice: selecting
a remote provider still sends prompts there.
Source: [Self-hosting](https://docs.letta.com/self-hosting).

## Memory has distinct loading levels

Letta documents MemFS as an agent-owned Git repository projected onto the execution
computer. In the documented layout, `system/` files enter the system prompt, while
other files remain discoverable through a tree and load when relevant. Markdown
descriptions help the agent choose a file. Local agents commit locally. Cloud
agents also push changes so other computers can receive them.

MemFS does not include a vector index by default. File tools can search memory,
and conversation-history search is a separate surface. This is evidence that
useful continuity does not require adding an embedding service first.
Source: [MemFS](https://docs.letta.com/concepts/memfs).

Source has a format distinction that matters before copying paths: the conditional
`memfs-v2` subagent prompts use root Markdown and `MEMORY.md` indexes instead of
the documented `system/` layout. These are versioned implementation choices.
Sources: [format selection](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/agent/subagents/index.ts#L409-L424),
[v2 initialization prompt](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/agent/subagents/builtin/init-v2.md#L56-L85).

## Initialization studies the folder

`/init` asks the main agent to load the `initializing-memory` skill. Its helper
passes Git context and the memory location. The fast `init` subagent reads
existing instructions, a package manifest when present, and README files.
It updates an existing memory topic in place rather than duplicating it.
Sources: [command helper](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/cli/helpers/init-command.ts#L93-L119),
[init prompt](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/agent/subagents/builtin/init.md#L28-L43).

The prompt directs the agent to derive structure from actual project needs, use
the project's name, and write compact discovery paths. Agent persona and user
preferences stay distinct from project conventions. It offers a small initial
memory hierarchy, then expects learning through use.
Source: [init hierarchy](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/agent/subagents/builtin/init.md#L56-L86).

The inspected `/init` path initializes agent memory. It does not define a catalog
of finished second-brain or wiki workspaces. Its broader skill can inspect old
coding sessions, but explicitly requires approval before analyzing those sessions.
Source: [initialization workflow](https://github.com/letta-ai/letta-code/blob/1ec6a43ff4a799217dd2114f0d49d9d7b33b6339/src/skills/builtin/initializing-memory/SKILL.md#L200-L236).

## Skills, tools, and roles are different things

Letta discovers skills from project `.agents/skills`, agent MemFS `skills/`,
computer `~/.letta/skills`, and bundled sources. Skills contain instructions and
optional scripts or references. Tools execute the work under runtime permissions.
Installing instructions alone does not configure credentials or grant API access.
Source: [Skills](https://docs.letta.com/configuration/skills).

Built-in subagents include `fork`, `general-purpose`, `history-analyzer`, `init`,
`memory`, `recall`, and `reflection`. Most fresh invocations have separate context,
while a fork inherits parent context. An existing persistent agent can also be
called by its agent ID. Custom Markdown definitions select instructions, tools,
and models. The harness performs the actual launch and returns results.
Source: [Subagents](https://docs.letta.com/configuration/subagents).

Letta's optional dreaming runs background memory maintenance. Its additional
agent review consumes tokens and is not human approval. This is an optional
maintenance workflow, not a prerequisite for initializing useful project files.
Source: [Memory and dreaming](https://docs.letta.com/configuration/memory).

## Comparison with original Vivary

The [original source study](original-vivary-product-map.md) establishes these boundaries:

| Concern | Existing Vivary | Design implication |
| --- | --- | --- |
| Starter files | Four presets share the five-file contract. Legacy richer templates remain archived. | A complete first-use workspace needs additional deliberate content. |
| Project knowledge | Project files, state, typed records, and Tropo context are authoritative. | Keep knowledge editable and portable in the user's folder. |
| Adoption | Original adoption plans managed changes while preserving existing content. | Extend that plan for selected starter files. Do not invent another writer. |
| Roles and execution | Strato, Ozone, and Exo describe governance. Native owns runs, tools, and conversations. | Role guidance must map to real Native capabilities before the UI promises workers. |

## Proposal: compose a workspace around the work

Start with what the user wants to accomplish, their existing folder, and the first
useful output. Offer suggested starting points that the user can mix, rename,
or omit. A programming language can suggest commands or a skill when relevant.
It should not determine the whole project layout or exclude non-code work.

Keep the five-file contract as the shared base. Add selected content through the
original creator/adopter's visible file plan. Prefill instructions, navigation,
and usable templates from the stated purpose. Mark unknown facts as unknown.
Do not fabricate journal entries, project history, research findings, or personal details.

| Starting point | Example files to offer | First useful workflow |
| --- | --- | --- |
| Second brain | `START-HERE.md`, `inbox/README.md`, `projects/index.md`, `templates/daily-note.md` | Capture one note, connect it to a project, and choose a next action. |
| Knowledge base or LLM wiki | `sources/index.md`, `wiki/index.md`, `templates/source-note.md`, `templates/concept-note.md` | Import a chosen source, preserve its origin, and create a cited concept page. |
| Research, writing, or client work | `brief.md`, `sources/index.md`, `drafts/README.md`, `templates/review.md` | Clarify the brief, collect evidence, draft, and review against the brief. |
| Software or mixed project | Existing layout plus selected architecture, commands, and review guidance | Inspect the actual toolchain, make one scoped change, and check it. |

These filenames are examples, not a required schema. An adopted vault or repository
keeps its own names and structure. Wiki guidance should distinguish source material
from synthesis, link claims to sources, and record unresolved contradictions.
Instructions should tell the agent where and when to read or write, with one owner
for each durable fact. Add reusable skills when a workflow needs them.

Keep persistent agent preferences distinct from project instructions and transient
conversation history. Reuse Native identities, scoped resources, skill discovery,
and execution. Connect Vivary's existing context and record owners around that
runtime. Switching projects must select the matching guidance and permitted files.

Implement Create/Adopt and file editing as one useful journey before adding
automatic memory consolidation. Acceptance should show the planned files, useful
prefilled guidance, preservation of existing work, and an agent using those files.
Adding files beyond the five-file seed requires creator integration. The source
study does not claim that integration already exists.

The [external template program](../tickets/19-integrate-template-program.md) stays
held until its owning prerequisites and approval are satisfied. This proposal
concerns built-in workspace setup. It does not authorize external template
installation, another runtime, scheduled agents, or any authentication change.
