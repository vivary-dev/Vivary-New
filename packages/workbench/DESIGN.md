# Vivary workbench

Vivary is a local desktop workspace for conversations, project files, and agent
work. It opens without a Vivary account. Model accounts and provider keys are
configured separately in Settings.

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

Keep navigation, project choice, conversation history, and Settings visible.
Use the Native rich composer and tool transcript. Project files appear in the Files sidebar. Clicking a file opens a full-page
reading surface. Markdown renders as a document; Edit opens the source editor
with explicit Save. Rename changes one filename in its current folder. Native
app state retains drafts across navigation and reload. A changed file requires
review before another save. Narrow layouts use the Native navigation drawer
to select files. This interaction was clarified by Jeff on 2026-09-14 in issue #12.
Personal workspace retains its existing read-only file drawer until connected
as a project.

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
