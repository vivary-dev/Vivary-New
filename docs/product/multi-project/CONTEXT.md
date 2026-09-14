# Vivary multi-project language

Vivary helps people and their agents work in portable filesystem workspaces. The workbench coordinates projects while each runtime retains its own agent loop.

## Language

**Workspace**: A bounded collection of files, instructions, knowledge, and operating context usable by an agent. A Vivary workspace can operate independently of the GUI.

**Workspace collection**: A user's collection of registered projects and optional shared knowledge, presented together in the workbench. It is not itself a required repository.

**Project**: A named unit of work with a stable identity and an explicitly selected filesystem root. A project can contain code, research, writing, or a Brain and does not require version control.

**Project registration**: The association between a project identity and its authorized root in a collection. Registration does not move, adopt, publish, or take ownership of the files.

**Managed project**: A registered project using Vivary's workspace contract. Management describes the available Vivary operations, not permission to rewrite existing project conventions.

**Checkout**: A version-controlled working copy associated with a project. A project can use multiple checkouts, while a folder without version control has no checkout.

**Workspace template**: A versioned package of workspace content and declarations installed into a chosen project. It is independent of the repository host, task tracker, and coding runtime.

**Adoption**: Adding the bounded Vivary contract to an existing project through a previewed, conflict-aware change. Existing instructions, history, tooling, and files remain owned by the project.

**Execution copy**: A scoped snapshot or working copy made available to the selected local or sandboxed runtime. It is distinct from the authoritative project root. File changes reach that root only through an explicit, revision-checked write-back operation. Storage inside an execution environment does not prove access to an existing device folder.

**Runtime binding**: The association of a session with a particular agent runtime, project root, execution location, and applicable authority.

**Session**: An interaction owned by a selected runtime and referenced by the workbench. Resuming a session preserves its project and execution binding.

**Brain**: An optional knowledge workspace containing sourced knowledge and evidence from work. Shared learning requires an explicit scope beyond any project's private Brain.

**Learning proposal**: An evidence-backed suggested change to knowledge, instructions, or skills. A proposal is distinct from an accepted change and never grants itself authority.

**Repository host**: A service such as GitHub or Gitea that stores a remote repository. Hosting is separate from local version control.

**Task source**: The system that owns a project's tasks, such as native framework tasks, files, or Beads. Workbench views reference that owner instead of maintaining competing task truth.

**Workbench**: Vivary's primary graphical work environment for projects, sessions, plans, files, previews, and evidence. Agent-Native is its application foundation, not the user's required project framework.

## Conversation workspace language

**Conversation**: A user-visible sequence of messages and results in one project, referenced through its actual Native owner. It is not a new universal transcript store.

**Harness**: The agent tool that owns its reasoning loop, tools and native session behavior, such as Claude Code or Codex. A model is a choice within a harness, not the harness itself.

**Harness adapter**: A supported integration that connects a harness to the existing Native lifecycle and declares its capabilities. Installation and registration alone do not establish runnable support.

**Model choice**: An identified model exposed through a selected harness and account on a particular host. A displayed name does not establish entitlement or readiness.

**Host**: The user-controlled computer or server that owns Vivary's execution, files and authoritative application state. A connected browser is a client of that host.

**Panel**: A requested, closable view beside or below the conversation, such as files, plans or preview. Panel visibility does not own or change an agent's execution.

**History link**: A reference from one conversation to authorized source history at a declared completed-event boundary. It does not copy a transcript or transfer native resume state.

**Supplied context**: The bounded material actually sent to a model for one turn, with its sources, summaries and omissions. It is distinct from all recorded history available to the application.

**Native resume**: Continuation through the originating harness's supported session state. Reconstructing a prompt from prior messages is replay, not native resume.

**Handoff**: A reviewed continuation record describing the goal, actual state, decisions, evidence, unfinished work and next action. Preparing it is a separate workflow from linking conversations.

**Candidate**: A particular version of proposed changes and its evidence, awaiting acceptance or rejection. A later version is a different candidate.

**Approval**: An authorization for a specific request and applicable scope or revisions. A linked conversation, model response or completed run does not grant approval.

**Acceptance**: A decision that a declared outcome meets its verification conditions. It is separate from runtime completion and from permission to execute.

**Uncertain effect**: An operation whose effect may have occurred but has not been reconciled. It must not be represented as failure-with-no-effect or automatically repeated.

**Agent profile**: Optional user-authored instructions or configuration selected for agent work. A profile is separate from the harness, model and deterministic authority.
