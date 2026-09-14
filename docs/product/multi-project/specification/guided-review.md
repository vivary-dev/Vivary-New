# A guided design review

This guide helps Jeff review the proposed Vivary experience before application implementation. It presents the existing specification in smaller pieces. The full contracts remain available in the same HTML document. It does not turn a diagram or a browser selection into an accepted product decision.

## Start with a real task

Imagine returning to a project tomorrow. You open its conversation, see where the work stopped, inspect a file and ask the agent to continue. Vivary keeps those activities in one workspace. You choose when to open extra information.

You do not need to understand every internal module before reviewing that experience. Start with the walkthrough. Decide whether the proposed flow matches how you want to work. Then inspect one module or source document when a detail matters.

## What you have already decided

- One project conversation workspace replaces the competing Agent, Files, Workbench and Full chat destinations.
- Projects and their conversations organize navigation.
- Files open only when requested, with formatted reading and explicit editing/saving.
- Panels resize, close and reopen without losing work.
- Supported installed harnesses supply the available model choices. Groups use harness names such as Claude Code and Codex.
- Switching harnesses creates a linked conversation and preserves access to exact recorded source history. It does not automatically send a message.
- Preparing a handoff is a separate agent workflow.
- Agent profiles are optional and user-authored.
- Background work, approvals, denial and Stop must remain visible and understandable.
- A local desktop instance uses that computer's projects. A remote browser connects to the explicitly selected, authenticated host.

These decisions do not need another vote. The application has not yet implemented the unified experience.

## One choice before the first interface slice

### D1: Should project details start open on a wide desktop?

**Recommendation: header first.** Show project name, host/root state, selected harness/model and activity in the conversation header. Keep the details panel closed until requested. Remember the choice separately on each client.

This gives the conversation more room. It adds one click when you want the full project details. Missing-folder recovery, pending approval and Stop remain visible even with the panel closed.

**Alternative: compact details panel open.** Show the same header plus a narrow project details panel on a wide desktop. This makes supporting information immediately visible but uses horizontal space. It is still closable, and it never opens a file automatically.

Both options preserve the decisions above. On phones, panels start closed. Exact widths and breakpoints are adjustable engineering defaults, not a decision Jeff must make now.

## A decision for the later handoff slice

### D2: When should an agent update the handoff document?

**Recommendation: manual by default, with a stale indicator.** Code marks the record out of date when its covered work changes. Updating the narrative happens when you request it.

**Optional later choice: named completion checkpoints.** A project can opt into an update at a stated checkpoint within an authorized workflow. The interface must show that behavior and preserve the applicable approval policy. A new follow-up still needs its required decision.

This choice does not block the first workspace-layout implementation. It must not create unbounded background model calls or silently turn a plan into standing authority.

## Decisions the engineer should handle

Component composition, exact panel sizes, accessible keyboard behavior, adapter-version checks, draft storage boundaries and meaningful regression checks belong to implementation. Explain a tradeoff when it changes what Jeff can do or puts his work at risk. Do not ask him to select an internal library merely to make progress.

The existing release and later-scope split remains intact. Full kanban, factory workflows, research specialists, email intake and heartbeat are retained later capabilities. Ordinary plan and writing documents can still use the file surface. Reviewing this guide does not reopen the milestone or approve publishing.

## Principles in everyday language

### Keep the project identity steady

A project is more than its folder path. A folder can move while the project's conversations and decisions still belong together. File operations need a valid authorized folder. Reading retained history still needs authorization, even when the folder is missing.

### Give each kind of information one owner

A file owns its saved text. A draft holds unsaved edits. Native's appropriate thread, Code or harness owner keeps its conversation and run records. A panel displays information without taking ownership of it. This is what lets us replace the editor without rebuilding history or permissions.

### Separate a request from permission and completion

An agent can propose work. Approval authorizes the stated request. Execution performs it. Verification checks the result. These are different events. A confident response is not proof that a file changed correctly.

### Make replacement happen at a clear boundary

A harness is the installed agent tool, such as Claude Code. A model is a choice available through that tool. An adapter is the integration that connects a supported harness to the existing lifecycle. A new CLI needs that integration and compatibility evidence. It does not get to redefine project identity or permissions.

### Keep history, context and resume distinct

History is the recorded conversation. Context is the material actually supplied to a model for one turn. Native resume continues a supported harness session using its own state. Linking history does not guarantee that a smaller model receives all of it.

### Preserve work when something fails

A failed save keeps the draft. A failed switch keeps the original conversation. A timeout with a possible effect needs reconciliation before retry. Recovery should explain the next safe action rather than hide the problem or repeat work blindly.

## Standards and evidence

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) supplies testable accessibility criteria, including keyboard use, visible focus, contrast and reflow. We should use Level AA as a proposed acceptance target for the affected application flows. This guide and its screenshots do not establish full conformance.

The [W3C window-splitter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) informs keyboard resizing and pane controls. It is guidance with an explicit review caveat, not a certification of our implementation.

[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) provides security-verification requirements. Relevant controls can inform authenticated remote access, authorization, input handling and error behavior. Applicability and verification belong to the implementation issue. No ASVS assessment or compliance claim is made here.

Clear ownership, explicit effects and replaceable adapters are engineering principles supported by the existing architecture and source review. They are not a claim that one industry standard prescribes every Vivary design choice. We will test the actual behavior through the private hosted build, then the intended Windows artifact.

## How we review together

Start with the walkthrough and D1. Tell me what feels confusing, missing or awkward in that flow. I will connect your feedback to the relevant source contract and explain the consequence in ordinary language.

Choices and notes inside the HTML guide are only local drafts. Use Prepare reply, then copy the text into our conversation. The guide does not submit approval, start agents, change GitHub issues or update project files. Browser storage may be unavailable, so the copyable reply remains the reliable way to share your review.

An answer to D1 selects a layout default. It does not automatically approve all 120 actions or start application work. We will confirm the implementation slice from the reviewed design and live issue.
