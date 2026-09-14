# Vivary workbench

Vivary is a local desktop workspace for conversations, project files, and agent
work. It opens without a Vivary account. Model accounts and provider keys are
configured separately in Settings.

## Target workspace, decided 2026-09-14

Jeff rejected the four peer Agent, Files, Workbench and Full chat destinations.
Follow the [unified workspace contract](../../docs/product/multi-project/unified-workspace.md)
and its [research](../../docs/product/multi-project/research/agent-workspace-ergonomics.md).
One project conversation owns the center. Project context is compact; files and
other surfaces open on request in resizable, closable panels. Keep explicit file
reading/editing and existing drafts. A grouped harness/model picker uses supported
installed CLIs and their available models. Switching harness creates a linked
conversation; preparing a handoff is a separate agent workflow.

This is the target design under issue #38. The current application still has the
older routes. Do not treat earlier component acceptance as acceptance of that
navigation or claim the consolidation is already running in the preview.

## Visual direction

Compose the pinned Agent-Native shell, chat, settings, and Toolkit components.
The default palette uses layered charcoal surfaces and a bright green primary
action. Keep the user's selected light, dark, or system theme and Native
appearance. Inter carries controls and prose. Source previews may use monospace.

Use these colors for the default dark appearance through semantic tokens:

| Role | Color |
| --- | --- |
| Navigation | `#0C100E` |
| Workspace | `#121715` |
| Raised surfaces | `#1C2420` |
| Quiet borders | `#35423B` |
| Main text | `#EDF4EF` |
| Primary action | `#B8F263` |

Primary actions use a dark `#142014` label. Muted text stays readable at
`#A6B4AB`, and input borders are stronger than panel dividers. Reserve bright
green for the primary action, links, selection, and keyboard focus. Use surface
depth to separate navigation, the workspace, and the composer or file panel.

Light mode uses a deeper `#346C2B` primary with a white label so controls and
links stay readable on pale surfaces. Scope the Vivary palette to Native's
default appearance. The other appearance presets keep their own colors.
Configure tokens in `app/global.css` and use them in app panels. Preserve Native
component behavior, spacing, and appearance persistence.

Keep project choice and conversation history in the workspace navigation, with
Settings available as a secondary utility. Use the Native composer and transcript.
Project files open explicitly in the optional surface host. Markdown renders as
a document; Edit opens source with explicit Save. Rename changes one filename in
its current folder. Native app state retains drafts across panel closure,
navigation and reload. A changed file requires review before another save.
A requested document can maximize and restore. Narrow layouts use a focused
surface with a clear return to the same conversation. The existing routes are
transitional implementation, not the target navigation. Personal workspace's
existing file limitations remain until it is connected as a project.

Keep one primary action per view. Use short labels, visible focus, matching
loading skeletons, and clear unavailable states. Preserve focus and drafts
through queries and navigation. Do not replace Native setup with a decorative
provider selector or duplicate its credential storage.

## Application behavior

Native owns sessions, runs, conversations, provider secrets, resources, and
preferences. Vivary connects those records to its existing project registry.
Choosing a project changes the agent's working directory and the history and
files displayed for that project.

Show actual runtime status and actual tool results. Project identity checks
do not imply an operating-system sandbox. The CLI's permission policy governs
its tools. Do not present the unfinished factory workflow as available.

## Visual acceptance

Exercise normal local startup, provider and runtime settings, project selection,
conversation restoration, tool output, file inspection, keyboard focus, saved
appearance, and narrow layouts. Check default dark and light contrast, visible
focus, and an alternate Native appearance. Test a completed flow, fix its
failures, and repeat the affected journey. Keep screenshots that show meaningful
results.
