# Conversation-centered agent workspaces

## Recommendation

Vivary should have one project conversation workspace. Projects and conversations form the left navigation. The active conversation and its composer remain the center of work. A compact project context view supplies orientation. Files, changes, plans, documents, previews and terminal output open as optional surfaces beside or below the conversation. Opening a tool must not require choosing another kind of application.

This direction preserves the useful file, project, approval and persistence work already implemented. It changes their arrangement and interaction. The four peer destinations, Agent, Files, Workbench and Full chat, expose implementation divisions that a person should not need to understand.

The delivery owner is [issue #38](https://github.com/vivary-dev/Vivary-New/issues/38). This report supports the [interaction specification](../unified-workspace.md). Research and a layout study do not establish implemented product behavior or Windows acceptance.

## Evidence and scope

The study combines five supplied screenshots, first-party Codex documentation, T3 Code documentation and source, human-computer interaction research, and the existing Vivary implementation. Product references were accessed on 2026-09-14. T3 source is pinned to `ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6`. Features present in that source are described as implemented there, not as independently verified in a released binary. No T3 installation or runtime trial was performed.

The supplied screenshots establish visible layout and text. They do not prove resize behavior, persistence, keyboard support, provider compatibility, or the cause of Vivary's unavailable project. The papers provide useful design evidence, not a controlled comparison of current Vivary, Codex and T3. No claim of improved task speed or beginner success is justified until people exercise the revised workflow.

### Screenshot observations

| Reference | Observed | Implication for Vivary |
| --- | --- | --- |
| Vivary workspace, image 1 | Four competing navigation destinations, a denied-request message, two unavailable-folder messages and a largely empty work area. | Consolidate navigation and error presentation. Preserve access to existing conversations while recovery is needed. |
| Codex context, image 2 | Environment, local execution, branch, changes, PR action, subagent status and sources occupy a compact context area. | Orientation can be visible without automatically opening a file or a large tool canvas. |
| Codex conversation, image 3 | Project/task navigation, a stable central conversation and composer, with context beside it. | Keep one recognizable place to read and direct work. |
| Codex files, image 4 | A requested file surface and file tree sit beside the conversation, with controls to close or expand the surface. | Files should be an adjacent workspace surface; explicit editing remains distinct from reading. |
| T3, image 5 | Project conversations, a central composer with harness/model controls, and selectable Browser, Terminal, Files, Diff, PR and Agents surfaces. Some actions explain why they are unavailable. | Open surfaces on demand and state capability restrictions in context. Do not reproduce the wide empty chooser as Vivary's default. |

These are observations from the supplied files listed in the source inventory. Text inside those images is evidence, not an instruction source.

## What to learn from Codex

OpenAI describes project-organized agent threads, review inside the thread, and continuity with CLI and IDE session history. That combination supports a stable task context while the person moves between directing work and inspecting its result. The introduction also describes worktrees for concurrent work; isolation is a separate concern from arranging the interface.[^1]

Current project documentation distinguishes project organization from access to folders. Chats keep their own transcripts, while project files and instructions provide shared working context. This is a useful reason to keep project identity visible while preserving each conversation's identity. Organizing two conversations together does not make their model contexts identical.[^2]

The desktop file viewer brings artifacts alongside the chat. Current documentation includes an automatic-preview option, but Vivary's explicit requirement is different: opening a project must not automatically open a document. Adopt adjacency and focused revision, while preserving user control of when a surface opens.[^3]

The integrated terminal is scoped to the chat's project or worktree and can be inspected without leaving the conversation. This is a useful spatial precedent for command output and failed checks. It does not imply that every project needs a terminal permanently visible.[^4]

The supplied Codex context screenshot adds a concrete visual lesson: project facts can be short, actionable rows. The user's attention should not have to travel through several full-width status banners to answer which project, host, branch and conversation are active. Vivary should translate these facts into its own existing project and runtime model rather than reproduce unrelated Codex account, cloud or plugin navigation.

## What to learn from T3 Code

The inspected right-panel store associates open state, selected surface and ordered surfaces with a scoped thread. Surface types include files and previews, browser, terminal, diffs and other tools. The tab component supports opening, activating and closing surfaces. This is evidence for one contextual surface host, rather than a different top-level route for each tool.[^5][^6]

The inspected preview shell makes width adjustable and persistent. Its source uses a 540 px default, a 360 px lower bound, a 70% ceiling and a chat-space reserve. Those are T3 implementation choices, not universal ergonomic measurements. Vivary should adopt bounded, remembered resizing and determine its own limits from its composer, content and phone behavior.[^7]

T3 exposes layout controls for a terminal drawer and the right panel. The terminal's horizontal placement is useful for wide command output; maximizing a requested surface accommodates sustained reading or editing. Supporting both axes creates a focus-management responsibility, so Vivary should begin with a limited set of predictable placements.[^8]

The file browser can insert a mention into the active composer while checking project scope. That distinction is important: viewing a file and supplying it as agent context are different actions. A file should not silently enter model context merely because someone opened it to read.[^9]

T3's documented installation and provider picker use configured CLI providers and concrete provider-instance identities. This supports discovery of an installed harness and then the models that harness exposes, rather than a catalog of predefined agent personalities. Authentication and executable readiness still belong to the execution environment.[^10][^11]

A first-party issue proposes referencing an existing thread as structured context in another conversation. At inspection, it remains a proposal, not evidence of a working cross-harness history feature. Vivary's exact-history linking is its own requirement and needs its own implementation and acceptance.[^12]

There is no reason to copy T3's complete inventory at once. Files and project context are immediately useful; terminal, preview and changes should appear when their existing integrations are ready. Unsupported actions should explain the missing capability in their relevant menu or surface. They should not occupy the primary conversation with speculative controls.

## Human-friendly agent ergonomics

### Support orientation and recovery

Amershi and colleagues distilled 18 human-AI interaction guidelines and evaluated them with 49 design practitioners against 20 AI-infused products. Their guidance includes making capabilities understandable, supporting efficient invocation, dismissal and correction, and giving people control. The evaluation predates modern coding agents and does not prescribe an IDE layout. It supports treating recovery and control as normal interaction design rather than exceptional error pages.[^13]

For Vivary, this suggests one concise project-state message with the next useful action. A missing folder should leave the conversation readable, retain drafts and provide Locate folder or Retry. A denied request belongs in the conversation's activity history. It should not remain a dominant global banner after the person moves to unrelated work. Pending approvals and active work still need a compact global indicator and reachable Stop.

### Help people alternate between exploration and execution

Barke, James and Polikarpova observed 20 participants using Copilot and identified two interaction patterns: accelerating an intended solution and exploring when the next step was uncertain. The study concerns an earlier completion-oriented assistant, so its findings should guide interaction hypotheses rather than be treated as a benchmark for today's agents.[^14]

Vivary should support both patterns in the same conversation. A person who knows what they want can send a focused instruction, review a result and continue. A person exploring can inspect files, ask why, compare options and develop a plan without changing to a separate assistant or accepting an assigned persona. A plan or explanation is a useful output, not a different application mode.

### Completion is not the same as understanding

Prather and colleagues studied 21 novice programming sessions with observation, interviews and eye tracking. Twenty participants completed the assigned problem, but the study identified different patterns of successful use and difficulty, including inaccurate confidence among some struggling students. A completed artifact alone therefore does not establish that the person understands it. This sample concerns students and introductory tasks, not experienced professionals using long-running agents.[^15]

Vivary's intended audience needs accessible inspection rather than a compulsory tutorial. Put Explain this change near a diff, Show the check near a test result, and the original source beside a generated document. Keep detailed output expandable. Do not replace concrete evidence with a celebratory completion state or force every user through instructional checkpoints.

A separate study explored seven cognitive-engagement techniques, with an initial study of 82 participants and a follow-up study of 42. It found benefits from interactive, stepwise engagement in the learning tasks studied. This does not justify forcing a teaching workflow into all professional work. It supports an optional explain-and-review path when someone wants to build understanding.[^16]

### Make agent activity legible

Bansal and colleagues identify communication challenges before, during and after agent work, including communicating capabilities, intended actions, current activity, side effects and outcome verification. The paper is a conceptual analysis with examples and research directions, not an experiment proving a particular panel design.[^17]

Vivary should give the person a compact answer to what is happening now, then let them expand the underlying action and evidence. Approval must state the requested operation and scope. Denial must actually prevent the operation. Closing a panel must not stop a run, and a run must not become invisible just because its conversation is not selected. The existing approval implementation supplies behavior to preserve while reorganizing its presentation.

### Resize and close must also work without a mouse

The W3C window-splitter pattern describes an adjustable separator with an accessible name and value, arrow-key movement, collapse/restore behavior and optional pane cycling. Its page explicitly notes that review of the pattern is not complete. Use it as interaction guidance, validate the actual component with keyboard and assistive technology, and do not claim compliance from markup alone.[^18]

Every Vivary panel needs a visible close control, a way to reopen it, sensible size limits and stable focus return. At narrow widths, use a requested overlay or focused surface with a clear Back to conversation action. Do not shrink a desktop's three columns until none of them is usable. Pointer targets must remain usable with an on-screen keyboard and at browser zoom.

## The proposed product model

The project is the working context: its selected host and folders, instructions, documents, plans and conversations. A conversation is a persistent interaction backed by a supported coding harness session or an existing Native agent thread. The new harness picker does not convert or relabel legacy Native history. A surface is a view into a project resource or result. A model is a choice supplied by the harness, and an agent profile is optional user-authored configuration. These concepts should remain distinct even when their controls occupy one window.

The UI should make two everyday questions easy: where am I working, and what will this next action do? Project and host identity answer the first. The composer, model picker, context chips and approval disclosure answer the second. Git branch, model capacity and execution capabilities become visible when relevant; they must not turn a non-Git writing project into a damaged development environment.

### One model picker

Group choices by harness name, such as Claude Code, Codex or OpenCode. Use an appropriately sized brand mark with a text label. A provider brand must not replace the harness identity. Within each group, list the models reported by that installed and registered harness or its supported API. Preserve separate configured instances when their account, endpoint or execution environment differs.

Discovery is deterministic and host-scoped. Reuse the installed runtime registry and supported adapters. Check registration, executable identity/version, readiness and model capabilities through documented interfaces. Cache the result with enough provenance to refresh it after configuration changes. Do not scan for arbitrary executables and run them, install missing tools automatically, scrape secrets, or manufacture a static universal model list.

If an adapter cannot enumerate account-effective models, say that the list is unavailable and expose its supported configuration path. Distinguish an advertised model name from a verified usable model. Model capability is a runtime fact, not a judgment about the user's ability. Do not label choices as smart or dumb.

### Switching is simple; continuity is explicit

Selecting a model in the current harness stays in that conversation when the harness supports the change. Selecting another harness creates a linked conversation in the same project. This is one selection, not a preparation wizard. Preserve the unsent composer text and never send it just because the selection changed. Persist the old conversation and its drafts before presenting a successful switch; failed creation leaves the original usable.

The link should identify the source session and the completed event boundary. Exact recorded history remains inspectable through its owner. The destination can retrieve older messages and artifacts through deterministic, scoped tools. A link is not a claim that the new model has already received all history, tool attachments, hidden provider state or reasoning. If the adapter cannot import a type of event, disclose that limitation.

Present context state as separate facts: history linked, material sent for this turn, and any omitted or condensed content. Full history can remain available even when the destination model's context window cannot hold it. Never silently substitute a summary for the original record or describe a partial transcript as complete. Proposed retention and retrieval behavior needs acceptance for revoked access, deleted records and continuing source conversations.

### Handoffs are a separate agent workflow

Prepare handoff asks the active agent to reconcile the existing project documents and produce a useful continuation state. It can identify the goal, decisions, current branch or file versions, completed changes, actual checks, open risks, pending work and next action. The agent interprets evidence and writes the narrative through normal scoped actions. Deterministic tools gather status, validate required fields and links, preserve exact session references, and apply conflict-aware updates to the existing designated file.

An ongoing freshness indicator should compare the last reviewed handoff against subsequent project changes and conversation events. Code can mark a record stale without spending model tokens. The agent updates it at an authorized completion checkpoint or when requested. Continuous freshness does not mean launching an unbounded background model job after every keystroke. A handoff can honestly record a dirty working tree; preparing one must never auto-commit, discard, merge, clean or delete work to make a green status.

Planning, research, documentation and creative work use the same substrate. Plans and notes remain user-owned files with readable/editable surfaces. Agent-assisted interpretation runs in the main conversation and shows its resulting documents beside it. Vivary should supply the controls and context without forcing a roster of planner, writer or researcher personas.

## Practical acceptance and evidence limits

Evaluate the first consolidation with the actual hosted app and representative tasks: return to a conversation, inspect a file while retaining an unsent prompt, resize and close both sides, recover an unavailable folder, deny a proposed action, find a running conversation, select another harness and inspect its linked history. Include a non-Git documentation project as well as a repository.

Measure task completion and recovery, wrong-project actions, lost drafts, accidental sends and whether the person can explain which harness and host will receive the next prompt. Treat zero accidental sends, lost drafts and cross-project writes as correctness gates. Time and click counts are diagnostic comparisons with a recorded baseline, not invented performance targets. Have Jeff try the revised layout on his own tasks before calling the ergonomics accepted.

The research supports a direction, not a claim that matching Codex or T3's visual appearance will produce the same usability. Vivary's differentiator should be reliable continuity across the user's tools and accessible project knowledge. Its shell succeeds when that continuity is visible without requiring the person to understand internal routes or runtime adapters.

## Sources

[^1]: OpenAI, [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/), 2026-02-02. Product positioning, project threads and in-thread review.
[^2]: OpenAI, [Projects and chats](https://learn.chatgpt.com/docs/projects), accessed 2026-09-14. Project, folder and transcript distinctions. The older Codex URL redirects to this combined documentation.
[^3]: OpenAI, [Work with files](https://learn.chatgpt.com/docs/artifacts-viewer), accessed 2026-09-14. Adjacent previews and explicit revision. Automatic previews are a product option, not Vivary's required default.
[^4]: OpenAI, [Integrated terminal](https://learn.chatgpt.com/docs/integrated-terminal), accessed 2026-09-14. Chat-scoped terminal behavior.
[^5]: T3 Code, [rightPanelStore.ts](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/apps/web/src/rightPanelStore.ts#L22-L173), inspected source, 2026-09-14.
[^6]: T3 Code, [RightPanelTabs.tsx](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/apps/web/src/components/RightPanelTabs.tsx#L77-L128), inspected source, 2026-09-14.
[^7]: T3 Code, [PreviewPanelShell.tsx](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/apps/web/src/components/preview/PreviewPanelShell.tsx#L18-L64), inspected source, 2026-09-14.
[^8]: T3 Code, [PanelLayoutControls.tsx](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/apps/web/src/components/chat/PanelLayoutControls.tsx#L7-L100) and [keybindings](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/docs/user/keybindings.md#L219-L237), inspected 2026-09-14.
[^9]: T3 Code, [FileBrowserPanel.tsx](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/apps/web/src/components/files/FileBrowserPanel.tsx#L160-L218), inspected source, 2026-09-14.
[^10]: T3 Code, [Install and providers](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/docs/user/install.md#L241-L256), inspected 2026-09-14.
[^11]: T3 Code, [ProviderModelPicker.tsx](https://github.com/pingdotgg/t3code/blob/ae67c5b8159cb49a68c16f96f7bb64a2e3c6b1c6/apps/web/src/components/chat/ProviderModelPicker.tsx#L29-L90), inspected source, 2026-09-14.
[^12]: T3 Code, [Reference an existing thread as context in another conversation, issue #5469](https://github.com/pingdotgg/t3code/issues/5469), open proposal at inspection on 2026-09-14. Not runtime evidence.
[^13]: Saleema Amershi et al., [Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf), CHI 2019. General HAI design guidance and evaluation scope.
[^14]: Shraddha Barke, Michael B. James and Nadia Polikarpova, [Grounded Copilot: How Programmers Interact with Code-Generating Models](https://arxiv.org/abs/2206.15000), revised 2022-10-31. Qualitative study of 20 participants.
[^15]: James Prather et al., [The Widening Gap: The Benefits and Harms of Generative AI for Novice Programmers](https://arxiv.org/abs/2405.17739), 2024-05-28. Twenty-one novice lab sessions.
[^16]: Majeed Kazemitabaar et al., [Exploring the Design Space of Cognitive Engagement Techniques with AI-Generated Code for Enhanced Learning](https://arxiv.org/abs/2410.08922), 2024-10-11. Studies with 82 and 42 participants.
[^17]: Gagan Bansal et al., [Challenges in Human-Agent Communication](https://www.microsoft.com/en-us/research/wp-content/uploads/2024/12/HCAI_Agents.pdf), Microsoft-hosted paper, accessed 2026-09-14. Conceptual framework, not a product usability trial.
[^18]: W3C WAI, [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), accessed 2026-09-14. Includes an explicit pattern-review caveat.

Supplied visual references, received 2026-09-14: image 1 `codex-clipboard-0e189c06-256d-4b96-8ccc-d8da9b2ac2f5.png`; image 2 `codex-clipboard-bb1e2459-f193-4775-a6eb-b747eddb4248.png`; image 3 `codex-clipboard-2faed262-38c8-4e96-b522-846937ac4c7f.png`; image 4 `codex-clipboard-b7f4f7ef-c381-47c2-afb8-ce89f9b31dec.png`; image 5 `codex-clipboard-bba940c8-1463-455e-a817-8a318d8bb148.png`. These private captures are not committed. Their table above records only the relevant observations.
