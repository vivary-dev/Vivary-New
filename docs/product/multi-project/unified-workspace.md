# Unified project workspace

[Issue #38](https://github.com/vivary-dev/Vivary-New/issues/38) owns acceptance and lifecycle. The [research report](research/agent-workspace-ergonomics.md) supplies evidence and limitations. Jeff selected this direction on 2026-09-14 after inspecting the private application. This is the target interaction contract; the existing four-route shell has not yet been consolidated.

## Product decisions

One conversation workspace replaces Agent, Files, Workbench and Full chat as peer destinations. Projects and their conversations organize the left navigation. The main area holds the selected conversation, its activity and one composer. A compact context view shows the project and execution environment. Large file or tool surfaces do not open automatically when a project is selected.

Vivary is a visual workspace over supported user-selected harnesses. A conversation runtime is either a coding harness session or an existing Native agent thread. The grouped harness picker governs new coding conversations; it does not convert or relabel preserved Native history. Agent profiles are optional user-authored resources. The application must not require choosing a predefined researcher, planner or coder persona. Planning, documentation, research and creative artifacts belong alongside code in the same project.

A single model picker groups choices by harness name, such as Claude Code, Codex and OpenCode, with appropriately sized brand marks and accessible text. Its catalog comes from supported registered CLIs and their available models on the selected execution host. A cross-harness selection starts a linked conversation without a handoff wizard. Preparing and maintaining a handoff is a separate agent workflow.

## Workspace composition

Default desktop state:

```text
Projects / conversations | Project > Conversation                 Context toggle
                        | Host and folder / branch when present  Files  Changes
Project A               |---------------------------------------+--------------
  Conversation 1        |                                       | Project
  Conversation 2        | Conversation and recorded activity     | Host / folder
Project B               |                                       | Branch, if Git
                        |                                       | Linked history
New conversation        |                                       | Sources
                        | Context attachments                   | Handoff status
                        | Composer                              |
                        | Harness / model picker       Send     |
```

The compact context inspector is the only proposed default right-side content on a wide desktop. It is closable; hiding it leaves identity in the conversation header. It never selects a file on the user's behalf. A saved preference can keep all right-side content closed. On narrow screens the inspector starts closed. The inspector's initial desktop visibility and exact width are design proposals to judge in the layout study; the single-workspace and opt-in file behavior are user decisions.

Requested file state:

```text
Projects / conversations | Same conversation           | README.md       Close
                        | Same scroll position        | Files / document tabs
                        | Same active run              | Formatted document
                        | Same unsent draft            | Edit / Save / Rename
                        | Composer remains reachable   | Maximize / restore
```

Files opens a contextual browser, then a selected file opens in reading mode. Edit explicitly changes to source editing. Save and Rename reuse the existing project actions. A document can maximize for sustained work and restore without navigating to another application. Reading does not automatically attach a file to the model. Add to conversation is explicit and names the file in the composer context.

Other surfaces use the same open/close/activate contract. Plans and documents are editable project resources. Changes presents actual changes, and Preview presents a supported running project. A terminal may use a bottom drawer when the supported Native integration exists. Do not expose a nonfunctional terminal or debugging button to imply those integrations are complete. Context-sensitive unavailability explains a concrete missing prerequisite.

Settings remains accessible as a secondary utility. Removing the four competing destinations does not mean every configuration page must render inside the transcript.

## Panel interaction contract

Use the installed Toolkit resizable components. Proposed desktop starting dimensions are 240 px for project navigation and 260 px for compact context. A requested document starts wider, but preserves at least a usable 360 px conversation region. These are initial test values, not fixed product requirements or research-derived optima.

- Both sidebars resize with pointer and keyboard controls. Every open panel has a visible Close control and an obvious reopening control.
- Closing a panel never ends a run, sends a message, discards a draft or forgets a selected resource. Maximize is reversible.
- Remember safe layout preferences per client. Opening a phone must not overwrite the desktop's preferred widths. Clamp restored widths to the actual available space.
- Restore focus to the opener when a panel closes. Resizing must not steal editor or composer content. Escape closes an appropriate transient overlay, not the current run.
- Collapse panels before compressing the conversation below its usable minimum. At 390 px, show one focused primary surface with navigation and tools available on request. Returning to the conversation preserves scroll and draft.
- Active work, pending approval and Stop remain discoverable with either sidebar closed. Completed and denied work move to history rather than permanent global banners.

The [W3C splitter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) informs keyboard and accessibility behavior; validate the actual component and its caveats. Do not treat a splitter role or a passing typecheck as accessibility proof.

## Model picker and switching

The picker presents a grouped list, not two separate setup forms. Group headings identify the harness, use a small reviewed logo or a neutral fallback, and expose readiness when it affects selection. Rows show the models available through that harness. Different registered instances remain distinguishable by a short account/endpoint label when needed, without exposing credentials.

The server catalog must distinguish registered, installed, authenticated, supported and ready. Reuse the runtime registry and documented harness APIs. A package being installed is not proof that its CLI can launch, its account is authenticated or its model list is current. Unknown model enumeration is a visible unsupported capability, not permission to invent a universal catalog. Refresh after installation/login/configuration changes and make a manual refresh available.

Same-harness selection changes the model in the existing conversation only when the harness supports that operation. A cross-harness selection creates a new conversation under the same project and links the exact recorded source history through its last completed event. The original remains accessible. Preserve the unsent draft without silently submitting it. A failed switch leaves the original selection and draft usable with Retry.

An active or approval-pending run is not transferred by selecting another model. Existing approval remains tied to its original request, harness, project and runtime. A new linked conversation may be opened without granting execution permission; before a conflicting write can start, the existing run's state must be made clear. Switching and approval are distinct actions.

Three facts must be visible on demand: recorded history available, context supplied for this turn, and harness-native session continuity. These are not interchangeable. Paginated read tools retrieve exact existing messages and artifact references. Do not copy transcripts into another app-state store, replay raw tool calls as new commands, or share opaque resume state between harnesses. If full context exceeds capacity or an event type cannot be translated, describe what is omitted or summarized and retain access to the original.

## Prepare handoff

This action submits a named workflow to the existing agent conversation. It does not happen automatically just because the user picks another harness. The agent reviews the actual project and updates the designated existing handoff/documentation surface. Deterministic actions gather facts, check scope and versions, validate required fields, and write through existing conflict-aware file owners.

Proposed handoff fields: goal, current source/file versions, decisions, changes, checks with actual outcomes, unfinished work, risks, linked source conversation/event boundary, and the next concrete action. A dirty working tree is a legitimate reported state. No automatic clean, discard, commit, merge or deletion is part of preparing a handoff.

Freshness is explicit. A reviewed handoff records the project version and completed-event boundary it covers. Later changes can mark it Out of date deterministically. Updating its narrative consumes agent work and follows normal authorization. A failed update retains the previous readable version and shows Retry; it does not report a fresh handoff. An ongoing conversation can update the handoff at agreed checkpoints without creating a new file or a duplicate transcript for every turn.

## Unavailable folders and activity

Missing local folder and revoked access are different states. A missing folder leaves authorized conversation history readable, retains drafts and offers Locate folder or Retry. File-dependent execution is disabled. Revoked authorization must continue to protect transcript and file content. Neither case silently selects another project.

Show one scoped recovery message in the workspace, with the actual selected project identified. Keep the navigation and conversation frame. A denied request is an outcome in its conversation history. A compact activity control can lead back to other ongoing work; it must not cover unrelated work with a stale terminal outcome.

## Existing implementation owners

Source baseline: `ea5e5da838c9ceb44b71c8ea58bda5913aabd775` in `vivary-dev/Vivary-New`. Paths below are relative to `packages/workbench`.

| Owner | Reuse and change boundary |
| --- | --- |
| `app/root.tsx:126-147` | Preserve Native/query/appearance/project/file-draft providers. Consolidation occurs below these owners. |
| `app/routes/agent.tsx:38-139`, `142-367`, `402-470` | Extract the current project and coding-conversation composition into the center of the unified workspace. Preserve active-run, approval and draft ownership. |
| `app/routes/files.tsx:43-184` | Extract the existing document surface for optional panes. Reuse `FileDraftProvider` and save/rename actions. |
| `app/routes/workbench.tsx:13-59` | Retire the duplicate read-only conversation projection; reuse suitable preview/layout pieces. |
| `app/routes/chat.tsx:13-50` | Preserve existing Native SQL thread identity, storage key and authorized access. Display legacy conversations through the same shell with their actual runtime identity. Do not silently convert them into coding runs or maintain a competing Full chat destination. |
| `app/components/layout/Layout.tsx:46-57`, `83-176` | Replace route-based competing conversation layouts with one controlled workspace composition. |
| `app/components/layout/Sidebar.tsx:147-160` | Replace route-dependent history/file swaps with stable projects and conversations plus explicit surface controls. |
| `app/components/projects/ProjectContext.tsx:38-167` | Keep the existing project selection owner. Separate unavailable-folder execution state from authorized history visibility. |
| `app/components/layout/CodeHistory.tsx:21-31`, `77` | Remove the blanket folder-availability history gate without weakening authorization. |
| `actions/vivary-code-state.ts:30-34`; `server/code-project.ts:11-17` | Separate authenticated project metadata/history reads from live folder resolution. The current read action fails with 409 before loading history when the folder is absent. Keep owner, organization and current project-grant checks on reads. File access and execution still require an available authorized root. |
| `server/project-runtime-readiness.mjs:5-9`, `71-81`; `server/project-services.mjs:142-158` | Extend the existing project-scoped readiness owner with supported adapter model discovery. Preserve binding and policy revision checks. Installation, authentication, authorization and runnable state remain distinct. |
| `server/local-code-agent.ts:286-304` | Replace hardcoded engine/model choices by consuming the existing readiness owner and its supported catalog. Do not create a competing readiness service. |
| `server/local-code-agent.ts:66-77`, `366-388` | Add only necessary linked-conversation references; retain Native as transcript/run/session owner. |
| Toolkit public UI exports | Compose `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle`; do not add another panel library. |

The installed Native registry includes harness registration and package detection primitives. Those are discovery seams, not proof of model enumeration or runnable account state. Confirm each adapter's documented model and session interfaces before wiring the catalog. Existing Native agent resources can hold optional profiles; their instructions are not a substitute for deterministic action permissions.

## Implementation sequence

1. Consolidate the shell and navigation using existing conversations, files, project state and approvals. Preserve old `/agent`, `/files`, `/workbench` and `/chat` links as adapters into the canonical workspace. Opening a surface must not remount the conversation or create another session.
2. Finish project/session binding under #6, including authorized legacy Native history and non-code conversations. Establish durable links without merging transcript stores.
3. Implement the supported harness/model catalog and one-selection linked-conversation behavior. Verify exact-history access, context disclosure, failed switching and same-harness compatibility separately.
4. Add the explicit handoff workflow and freshness checks over existing files and Native history references. Connect #9 restart/drafts and #21 scoped memory where they own the behavior.
5. Complete surface integrations under their owners: #13 search, #31 supported preview/debugging, #30 responsive browser use, then #7/#8 packaged local acceptance. Do not wait for every future surface before testing the coherent shell.

Each implementation unit gets focused checks and affected real hosted verification. Use independent review when its risk or complexity warrants it. Each PR still requires applicable CI and an independent approval under CONTRIBUTING.md before sequential merge. Refresh the private preview for completed application changes. No public release or main promotion follows from this design. Research does not close #38 or reopen completed #12 backend work merely to rename its acceptance.

## Acceptance journeys

| Journey | Required result |
| --- | --- |
| Open an existing project | One workspace appears; metadata is compact and no file opens automatically. |
| Open a previous conversation | Existing history, harness identity and unsent draft remain intact. No duplicate session. |
| Open a file, edit, close and reopen | Formatted read view first; explicit edits and recoverable draft survive. Composer and run are unchanged. |
| Resize and close panels | Pointer and keyboard work; focus returns; minimum chat space and remembered widths remain usable. |
| Use a 390 px viewport and 200% zoom | Navigation, composer, context, approval and Stop remain reachable without crushed columns. |
| Make a folder unavailable | Authorized history remains readable; one recovery path; no fallback or lost draft. Revocation still denies access. |
| Select another harness | One linked conversation in the same project; exact source history accessible; no automatic send, persona or full handoff wizard. |
| Select an unavailable model | Accurate readiness state and supported recovery; no invented capability or silent fallback. |
| Prepare handoff, then change files | Existing designated document updates with actual evidence; later changes mark it stale; failure retains previous content. |
| Close all panels during work | Active work and Stop remain visible; no hidden execution or lost approval. |
| Use a non-Git writing/research project | Plans and documents work normally; Git-specific controls explain absence only when relevant. |

The first layout study demonstrates composition and panel interactions only. It does not exercise models, CLIs, real project mutation, persistence, approvals or cross-harness imports. The hosted application remains on the last verified build until implementation is completed and refreshed.
