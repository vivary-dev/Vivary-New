# Vivary workbench

Vivary is a local desktop workspace for conversations, project files, and agent
work. It opens without a Vivary account. Model accounts and provider keys are
configured separately in Settings.

## Visual direction

Compose the pinned Agent-Native shell, chat, settings, and Toolkit components.
Use a neutral application surface with the user's selected light, dark, or
system theme and Native color palette. Inter carries controls and prose;
source previews may use monospace.

Keep navigation, project choice, conversation history, and Settings visible.
Use the Native rich composer and tool transcript. The files pane opens beside
the conversation and closes with its Close button or Escape. Narrow layouts
use the Native navigation drawer and explicit pane controls.

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
appearance, and narrow layouts. Test a completed flow, fix its failures, and
repeat the affected journey. Keep screenshots that show meaningful results.
