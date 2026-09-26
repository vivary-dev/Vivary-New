# Maintained Native chat patch

Jeff approved this dependency patch on September 15, 2026, for
[project conversations, issue #6](https://github.com/vivary-dev/Vivary-New/issues/6).
This approval supersedes the earlier restriction against patching Core for those
defects. Later feature work extends the same maintained patch as described below.
Native still owns conversations, storage, requests, and execution.

`pnpm-workspace.yaml` applies `@agent-native__core@0.176.5.patch` to the pinned
Core package. Issue #9 also applies `@agent-native__toolkit@0.19.3.patch` to the
pinned Toolkit package. The lockfile records both patch hashes. Install with
`pnpm install --frozen-lockfile` from `packages/workbench`.

## Behavior

Each saved conversation repository has a server-owned `_vivaryHeadRevision`.
Legacy repositories start at zero. Changing the selected message increments the
revision. Saving more content under the same selected message does not.

A browser snapshot supplies the revision it observed. Native merges its message
content, but accepts a different selected message only when that revision still
matches. This preserves replies after a delayed save while allowing an intentional
branch change from the current revision. A stale branch selection must reopen
the current conversation before retrying. Clients that omit the revision can
still save content, but cannot move the saved selection.

The check runs inside the existing database compare-and-swap retry, so another
writer cannot bypass it between reading and saving. The server ignores any
revision embedded in the incoming repository. Invalid snapshots fail before a
write. No database table or separate history store is added.

The browser queues snapshots by endpoint, scope, and thread. Each snapshot keeps
the observation from which it was made. Acknowledgements can advance that same
observation. A later import or remounted conversation has its own observation.

The multi-tab wrapper also honors the host's disabled-composer setting. Existing
server checks still refuse execution against unavailable projects.

## Verification

From the repository root, run:

```sh
node --test packages/workbench/tests/native-thread-save*.test.mjs
pnpm --dir packages/workbench exec tsc --noEmit -p tsconfig.json
```

The tests cover stale and concurrent writes, deliberate branch changes, retained
messages, invalid input, save order, and observation changes across remounts.
The SQLite test uses a disposable database. CI runs these tests against the
installed package, so an unapplied patch fails the checks.

Before accepting a patch revision, build the application and exercise two
projects plus Personal workspace. Reopen and continue their Native chats,
replay an older snapshot, and confirm that an unavailable project's history
remains readable while its composer is disabled. Use the existing isolated
responder for deterministic tests. Keep those results separate from real
provider execution and Windows acceptance.

## Removal and rollback

Remove the patch only after an upstream release passes the same regression and
application checks. Remove its `patchedDependencies` entry, update the pinned
Core version and lockfile, and keep the regression coverage for the replacement
behavior. Do not edit files in an installed dependency directory.

Rolling back this patch restores the known save-order and composer defects.
The extra repository field requires no schema migration. Keep the private
preview's prior build available until its replacement passes verification.

## Chosen Native model default

Issue #50 changes Core's model picker. Core added the current model to its
provider's picker group only when that group had no built-in models, and a new
chat took the first model of the first configured group. A custom model, such
as an OpenRouter id saved in Settings, was never offered, and a new chat could
run on another, possibly paid, model.

`list-agent-engines.js` now reports `current.chosen`. It is true when a stored
setting or an app default chose the current model, and false when Core detected
the engine or fell back to an engine's default model. Both chat surfaces pass it
to `buildChatModelGroups` in `chat-model-groups.js`. When the chosen provider is
configured, its group is listed first with the chosen model first, added when
the built-in list lacks it. The multi-tab chat that Vivary uses then selects it
for a new chat. A detected engine, or a chosen one without a key, keeps Core's
order, and a model is never added to a group without a key. With the Builder
gateway lane, Builder models stay first and the chosen model is only listed.

`MultiTabAssistantChat.js` stores a project's composer pick with the Settings
choice that was current when it was picked. When the chosen engine or model in
Settings changes, a pick stored under an earlier choice, or under none, is
cleared, so new chats follow Settings. Every open chat that was following the
pick, including the routed active chat, is pinned to it first, so it keeps its
model for the rest of the session. Pins live in memory, so after a reload an
open chat follows Settings. Another window on the same project pins its own open
chats to the removed pick, drops it, and refreshes when it sees the clear. Two
clears happen without a model change in Settings: the first load after this
patch, when a pick from before it has no Settings stamp, and a key save that
makes a saved but unusable choice usable. Core's `useChatModels` hook keeps its
own selection rules. Vivary does not use it.

`chosenSettingsKey` and `storedPickYieldsToSettings` in `chat-model-groups.js`
hold the rule, so it is tested without React. Run
`node --test packages/workbench/tests/chat-model-groups.test.mjs`. The packaged
Windows journey for #50 checks the React wiring.

## Replayed tool-call ids

Issue #50 changes `dist/client/agent-chat-adapter.js`. When a Native chat sends
a follow-up, Core replays the earlier turns and gives every earlier tool call a
new id, `history_tc_<n>` for history and `continuation_tc_<n>` for a continued
run. Some providers reached through OpenRouter keep only the first nine
characters of a tool-call id. `history_tc_1` and `history_tc_2` then collide,
and the provider ends the stream with `provider_unavailable`. On the packaged
Windows app with `stealth/space-bunny-alpha`, every follow-up after a turn with
several tool calls failed this way, while ids that differ within nine
characters passed.

`replayToolCallId` now makes each replayed id a one-letter prefix, `h` or `c`,
and eight base-36 digits, such as `h00000001`. The ids are nine alphanumeric
characters, which also meets the strictest known rule, and the prefix keeps
history and continuation ids apart. `assistantUiMessagesToStructuredHistory` is
exported so the test can replay a turn. Run
`node --test packages/workbench/tests/replay-tool-call-ids.test.mjs`.

## In-process Run now

Issue #51 changes how Core starts Automations > Manage > Run now.
`queueAutomationRunNow` in `dist/jobs/run-now.js` writes a `running` history
row and then sends an HTTP request back to the app's own process-run route. In
production, that self-dispatch needs an app URL and an `A2A_SECRET` to sign the
request. The packaged app has no app URL in local mode and no `A2A_SECRET` in
hosted mode. Every Run now click therefore failed and left an unclaimed
`running` row. The 30-second queued-run sweep then retried that row forever
with "Could not redeliver queued run". Scheduled runs were not affected,
because the in-process recurring-jobs timer starts them.

`run-now.js` now exports `setInProcessAutomationRunner`. When a runner is
registered, Run now calls it without waiting for the run and returns its
receipt. Without a runner, Core keeps the self-dispatch, so development,
Netlify, and other serverless hosts behave as before. `agent-chat-plugin.js`
lifts the process-run route's worker into `runQueuedAutomationRun`. It
registers that function only in the branch that starts the in-process
recurring-jobs timer. The route and the runner both reach
`runQueuedAutomation`, whose claim in `run-history.js` lets only one delivery
of a row run. A failed run is recorded on its row and logged. It never becomes
an unhandled rejection.

With a runner registered, the sweep passes a queued row to the runner only
while the row is younger than the claim lease. The lease is 1.5 times the
background run's hard timeout, 15 minutes by default. The sweep claims an
older row and ends it as an error instead of running it, so a request never
runs long after it was made. An unclaimed row gets the error code
`automation_run_not_started` and a message that says it did not start and why.
A row that a worker claimed and then lost keeps the interruption message.

That interruption message told desktop users that a serverless worker may have
timed out. It now reads "The run stopped before it recorded a result, for
example because the app quit or its worker restarted. No delivery was
confirmed." `run-history.js` owns the text and `scheduler.js` imports it.
History rows also report `claimedAt`.

Run `node --test packages/workbench/tests/automation-run-now.test.mjs`. The test
uses a disposable SQLite database with `NODE_ENV=production` and no app URL or
`A2A_SECRET`. It checks that Run now reaches a registered runner, that Run now
still fails without one, and that the sweep ends old rows instead of running
them.

Upstream can take this change without Vivary-specific edits. It adds exports
and changes behavior only on hosts that start the in-process timer. Upstream
may prefer to pass the runner through the plugin options instead of a module
registry. Remove this part of the patch after an upstream release passes the
same test and a packaged Run now check.

## Local-only automation runs

The owner decided on 2026-09-26 (issue #51) that unattended automation runs are
local-only. That covers scheduled runs, event and webhook triggers, and Run now.
Interactive chats do not change.

Before this change, every run got the background surface that
`getBackgroundActionEntries` in `dist/server/agent-chat-plugin.js` builds. It
held the template actions, `web-request`, `web-search`, `core-send-email`,
`call-agent`, the 36 add-on actions, and the MCP tools an automation listed.
Nobody is present during a run to approve or deny a step, so a model-chosen
outward call ran unreviewed.

`dist/jobs/unattended-surface.js` is new. Its `restrictActionsForUnattendedRun`
keeps 12 tools and wraps each one with a refusal check:

- `resources`, `save-memory`, `delete-memory`, `chat-history`
- `manage-progress`, `manage-notifications`, `manage-jobs`, `manage-automations`
- `docs-search`, `framework-search`, `source-search`, `get-framework-context`

The four lookups read files bundled with Core only. The list is an allowlist,
not a denylist, so a tool that a later Core release adds stays out of runs until
someone reviews it. Both background entry points, the recurring-jobs scheduler
and the event and webhook dispatcher, use `getBackgroundActionEntries`, and Run
now reuses the scheduler's dependencies.

Some kept tools refuse part of their work in a run:

- `manage-jobs` lists only. Create, update, and delete are refused.
- `manage-automations` runs `list`, `list-events`, and `list-hosts` only.
  `define`, `update`, `delete`, `fire-test`, and `run-now` are refused.
  `fire-test` would emit `test.event.fired`, which fires event automations. This
  replaces the narrower "an automation cannot run another automation" check.
- `resources` refuses `write`, `promote`, and `delete` on the paths Core reads as
  configuration. The scheduler and the dispatcher load automations from `jobs/`.
  Custom agent profiles under `agents/` set a model and tools. Remote agent
  manifests under `remote-agents/`, and legacy `agents/*.json`, hold the URLs
  that `call-agent` reaches from an interactive chat. In local file mode, the
  workspace control files `agent-native.json`, `mcp.config.json`, and
  `.mcp.json` set the data mode and the MCP servers. The check ignores case and
  a leading slash. Other resources, including `AGENTS.md`, `instructions/`,
  `skills/`, `LEARNINGS.md`, and `memory/`, stay writable. Core loads those into
  prompts as text, like memory.
- `manage-notifications` sends to the in-app inbox only. The webhook, Slack, and
  email channels take a model-supplied `webhookUrl` or `emailRecipients`.
- `chat-history` refuses `open`, which only drives the app window.

The wrapper forces `caller: "automation"` into the tool context. Each kept tool
also checks that caller itself (`triggers/actions.js`, `jobs/tools.js`,
`server/agent-chat/script-entries.js`, and `notifications/actions.js`), so a
tool reached some other way enforces the same limits.

An automation that lists `mcpTools` fails before any model call. Its history
row reads "This automation lists MCP tools (names). Automation runs cannot call
MCP tools. Nothing ran. No delivery was confirmed." with the error code
`automation_mcp_tools_refused`. The run is refused rather than sent through
approval because approval cannot be granted after the fact in an unattended
run. The runner passes no approval callbacks, the approval stop reaches the
model as text, the run manager marks the run completed, and history recorded a
success for a step that never ran. `getJobMcpActionEntries` is gone, and the
`backgroundMcpTools` plugin option no longer has an effect.

A run's system prompt is the framework prompt filtered by
`filterFrameworkPromptToSurface` to the 12 tools, plus a two-line note that the
run is local-only. It no longer carries the template action list, so the model
is not told about tools it lacks. Its resources block also leaves out the
workspace apps list, which tells the model to use `call-agent`. Both dependency
blocks drop
`getInitialToolNames`, so all 12 tools load up front and no `tool-search` is
attached.

The user-visible text now says what a run can do. The Run now confirmation,
the Automations settings summary, and the MCP tools label in automation details
changed in `localization/default-messages.js` and in the matching
`defaultValue` strings in the client components. The other locale files do not
carry these keys. The `manage-automations` description says that Run now uses
the same local-only tools and that `define` cannot promise email, web, MCP,
settings, or automation steps. `mcpTools` is no longer listed among the
`define` options. It stays in the tool schema and in the app, where the label
warns that runs cannot use it. The `manage-jobs` description says that
recurring jobs cannot call MCP tools.

Two outward paths stay, and the owner configures both:

- Reply delivery. When an automation has `deliveryPlatform` and
  `deliveryDestination`, `background-automation-runner.js` sends the final
  reply there.
- A paired execution host. When an automation has `executionHostId`,
  `scheduler.js` queues the run on that host instead of running it here.

Only an interactive chat or the app can set either field, and a run can no
longer change automations. An inbox notification still emits
`notification.sent`, which can fire an event automation the owner defined.
That run is local-only too.

Run `node --test packages/workbench/tests/automation-local-only.test.mjs`. It
uses a disposable SQLite database. It checks the exact 12 keys against stand-ins
for every dropped tool, a future tool, and an MCP tool. It also checks the MCP
refusal, the `manage-automations`, `manage-jobs`, `resources`, and
`chat-history` refusals with no `jobs/` write, `fire-test` emitting nothing,
notifications reaching the inbox and no registered channel, and a source pin on
the plugin.

A live check on Zo ran `bin/start.mjs` in local mode against a fake Builder
gateway, with no real provider key. The Run now request offered 11 tools, the
allowlist without `source-search`, which Core registers only when its source
corpus is bundled. The run's scripted `web-request` call got "Unknown tool"
and never reached the fake server. Its `manage-automations` define and its
`jobs/` write were refused, and no automation was added. Run now on an
automation that lists an MCP tool ended with the named error and made no model
request. An ordinary chat still received `web-request`, `call-agent`, and
`resources`, and defined that MCP automation.

Upstream could take this as an opt-in plugin option, because its hosted
templates rely on email, web, and MCP tools in automations. It would also need
a way to approve an MCP step before a run starts. Remove this part of the patch
only when an upstream release offers a local-only mode that passes the same
test.

## Codex integration

The September 16, 2026 integration adds an explicit `codexCli` option to Core's
existing executor. Other Core consumers keep their existing launch behavior.
Vivary supplies the resolved executable and environment to the native app-server
transport, retains Codex configuration, and skips host MCP overlays. Credentials,
skills, tools, and configured connections remain owned by Codex.

Per-run permissions are Normal, Read only, or YOLO. Normal allows workspace writes
with native action approvals; Read only cannot approve broader access; YOLO removes
the shell sandbox and approval prompts. Normal and Read only validate their effective
sandbox boundaries. Connected services retain their own access settings. Global
Codex configuration is unchanged. Each conversation retains its selected model.
Each turn captures the permission mode selected when it starts. The adapter
explicitly selects the default collaboration mode.

The executor records the native session ID and resumes it for follow-ups. It has no
fixed turn deadline. Stop interrupts native work before bounded process-tree cleanup;
Windows launches use an executable and argument array without shell dispatch.
Native command, file, permission, and input requests return to the live app-server
request. Restart does not replay them. Actual subagent identities, lifecycle, and
public results remain separate from the main assistant answer. Tool events pair by
native call ID within their turn, with fallback for historical records without IDs.
Codex image-view items record the inspected screenshot path as a paired tool
input and result. The protocol item has no image bytes, so this does not render
the screenshot pixels in the conversation.

Run the maintained transport, transcript, approval, and discovery tests:

```sh
pnpm --dir packages/workbench exec tsx --test tests/codex-executor.test.mjs tests/codex-app-server.test.ts tests/codex-transcript.test.mjs tests/codex-active-state.test.mjs tests/codex-approval.test.ts tests/codex-models.test.ts tests/local-runtime-setup.test.ts
```

The optional `VIVARY_CODEX_POLICY_PROBE` test setting points to an installed Codex
executable. It checks effective permission rendering without starting a model turn.
Successful rendering does not establish operating-system sandbox execution. See the
[Workbench integration record](../README.md) for actual hosted and Windows proof.

## Host-owned conversation drafts

Issue #9 adds an opt-in `hostComposerDraft` interface to the existing chat
components. Vivary supplies a draft for the actual selected thread, waits for
that state before enabling the composer, and uses an explicit reset key when
restoring or clearing it. Routine autosave acknowledgements do not reset the
editor. The host ignores initial empty callbacks while the editor restores saved
text. Vivary supplies Core's route-controlled thread adapter so the editor and
page observe the same selected conversation. Saved host selection loads before
the chat mounts. Consumers that omit the draft interface retain Core's existing
behavior.

Host mode disables the browser and toolkit draft stores. Vivary persists text
through its authenticated `vivary-chat-draft` action and Native application
state. The key includes the owner, project, chat surface, and conversation.
Drafts are not messages and restoring one does not start execution. A conversation
with only an unsent draft may not have a Native thread row yet. If Native reports
that row missing, authenticated draft state retains its exact conversation ID.
Native also retains an ID that its own lifecycle marks as newly created, before
the first draft or message has been saved. An unknown missing ID keeps the normal
not-found behavior. In host mode, the Native thread hook allocates the initial
conversation ID. The tab wrapper defers to that ID instead of allocating another.
Existing thread rows still load their message history normally, even when they
also have an unsent draft. Vivary lists ID-only markers from the same
authenticated application-state owner so an unsent conversation stays in
history after another one becomes active. The marker holds an ID and timestamp,
never draft text or a second transcript. History derives its short preview and
Draft or Review send status from the authoritative draft record. Cleared drafts
stop appearing as draft-only rows. A started Code run exposes its first accepted
draft ID so later follow-ups reopen through run history. Older runs recover
that ID from a saved user event when one exists.

Each write compares the revision it observed. A cleared draft remains as an
empty tombstone, so a delayed save cannot recreate it. Before a send, the same
record retains a unique submission ID. Native carries that ID through its
existing queue and into the saved user message. A matching persisted message
or queued item settles the draft. An in-memory queue acknowledgement alone
cannot establish persistence. Code chat carries the same submission ID and
conversation key through its existing send action into the owned user event.
Reconciliation reads those existing run events without adding a transcript store.

If delivery remains uncertain, the UI retains a pending draft and offers Retry.
Restoring its text requires an explicit action with a duplicate-send warning.
Normal Discard draft also persists a tombstone. Request audit metadata remains
enabled, while the draft action excludes text inputs from the audit record.

The Toolkit patch adds `preserveDraftText` only for Core's host draft mode. It
reports line breaks, Unicode, and surrounding whitespace from the editor's
actual document. It restores that plain text with hard breaks so one saved line
break remains one visible line break. Consumers without host drafts keep
Toolkit's existing trimmed callback and paragraph restore behavior. Core keeps
the text-change callback stable while reading the latest host state. That
prevents a render from resetting the autosave timer or restoring stale editor
text after Discard.

The desktop close path waits for pending draft saves. If a save fails or times
out, the window remains open for retry. A browser can refuse navigation while
it has unsaved text, but its unload event cannot promise an awaited save. The
packaged desktop close and changed-port reopen passed on the unpublished
`250b402f` candidate. On-screen keyboard input remains unverified under #9.

Run the focused state and ownership checks with:

```sh
pnpm --dir packages/workbench test:chat-draft
```

These checks are included in `test:maintained`. Hosted restart and packaged
close checks are recorded in the [continuity receipt](../../../docs/product/multi-project/receipts/17a-chat-restart-and-drafts.md).
A follow-up under review gates host draft reads until the Native session is
ready. It verifies the exact owned thread before restoring a saved selection,
retains the unassigned Native history kind, and restores a Code draft after a
known local send refusal. The first `eb63459f` packaged retest exposed the
pre-read race. The focused follow-up checks passed on a dirty hosted build.
Clean-source packaged acceptance remains open.

The Windows keyboard case remains open under issue #9.
