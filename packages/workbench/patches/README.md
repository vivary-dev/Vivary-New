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

## Server-replayed tool-call ids

Issue #107 changes `dist/agent/thread-data-builder.js`. Two server paths resume
a run from saved thread data with its tool calls: the chained background
continuation in `agent/production-agent.js` and a sub-agent's continue mode in
`server/agent-teams.js`. Both call `threadDataToEngineMessages` with
`includeToolCalls`, which copied each saved tool-call id into the replayed call
and its result. A call saved without a provider id is stored as
`<runId>:tc_<n>`, and run ids created within about a day share their first
nine characters, so these replays met the collision in the previous section.

The replay now gives each call a new id, the prefix `r` and eight base-36
digits from one counter for the whole replay, and the call's result carries the
same id. Two turns that saved the same id replay with two ids.

No code on either path matches a replayed id back to a saved one. The seeding helpers pair
a call with its result inside the replayed messages and match earlier work by
tool name and input. Saved thread data keeps its ids, because the browser
matches a reconnecting stream's `tc_<n>` against the saved `<runId>:tc_<n>`.
`thread-data-builder.js` keeps its own copy of the one-line
`replayToolCallId`, because importing the client adapter into server code would
load its browser dependencies. The same test file covers this replay.

## Native stream errors

Issue #101. OpenRouter reports a provider failure inside the stream as an error
chunk, `{"error":{"code":502,"message":"...","metadata":{...}}}`. The AI SDK
turns it into an `error` part followed by a `finish` part with no text. Core's
engine kept the last stop it saw, so the provider's text was dropped and the
chat showed only "Engine stream error", with Dismiss and Copy and no Retry.

The patch changes these files:

- `agent/engine/ai-sdk-engine.js` keeps the first error stop that carries a
  code. An error stop with no code stays when the later stop is also an error
  with no code. A chunk that fails the provider's schema has no code, so a
  stream that goes on to a normal finish still ends the turn normally, and a
  provider error after it still shows its message and code.
- `agent/engine/translate-ai-sdk.js` turns a provider's plain-object error into
  its message, its code, and the upstream provider's name, for example
  "Provider returned error (code 502, from Google)", with the error code
  `provider_stream_error`. An error chunk that fails the provider's schema,
  such as one with no message, still holds the object and is read the same
  way. Any other chunk that fails to parse reads "The model provider sent a
  response that could not be read", never shows the chunk, and offers no
  Retry, because the turn may have finished normally after it.
- `agent/production-agent.js`, `agent/thread-data-builder.js`, and
  `client/sse-event-processor.js` treat `provider_stream_error` as final.
- `client/chat/run-recovery.js` and `client/chat/message-components.js` offer
  Retry for `provider_stream_error`.

The translation reads only these fields of the provider's object: `message`,
`code`, `type` when there is no code, `metadata.provider_name` when it starts
with a letter and holds at most 64 letters, spaces, periods, and hyphens, and
a numeric `statusCode` and a boolean `isRetryable` on the object, which
OpenAI's Responses stream sets. The translation cannot tell a status an SDK
derived from one the provider sent, so a numeric `statusCode` on any provider
object classifies as that status. The name holds no digits, because the client reads the
shown text for statuses, and a name such as "401 unauthorized" would swap the
error card for the provider setup card. A name with a digit is left out, and
the text keeps the message and code. The rest of `metadata` can hold the
upstream provider's raw response, so it is never shown and never classified.
`classifyProviderError` sees the message, the code, and that status. A
classification it finds, such as `http_429` for an in-stream `"code":429` or
`http_<status>` for a derived status, still replaces the code. An upstream
body that says "overloaded" or "timed out" no longer does.

The code is final in every check that reads an error's message: the engine
retry (`isRetryableError`), the in-process resume of a main chat turn
(`isResumableEngineError`), the background continuation
(`isRecoverableContinuationError`), the turn the server saves
(`isInternalContinuationError`), and the client's automatic continuation
(`isAutoRecoverableError`). Each returns on the code before any text match,
because a provider's message can name 502, a timeout, a closed stream, or an
unavailable service. Before this, the server retried the turn three more times
over about 15 seconds, the client then continued it on its own, and a turn that
the server saved, for example after a reload, kept no error, or no reply when
no text had streamed.

Retry shows on the error card and on the inline notice under the last failed
message, which is what remains after Dismiss. Each Retry takes one click per
error. A second click on the card or the notice before the chat re-renders
does nothing, and a different error gets a fresh Retry. Retry calls
`retryAfterRunError` in
`AssistantChat.js`, the same retry the credential card uses. It adds a visible
user turn, "Retry the previous request from a clean approach...", followed by
the last user message's text, and keeps the failed turn and the rest of
history. It is not a verbatim resend.

The in-stream code is not read as an HTTP status, because `http_502` would buy
the same silent retries and automatic continuation. Whether a transient
in-stream 502 should retry on its own is a separate decision.

These limits were declined in review:

- An in-stream 401, 402, or 403 gets a Retry that repeats the failure, and a
  rejected key is not recorded, because the object carries no HTTP status.
  OpenRouter sends those as HTTP statuses before the stream, which take the
  classified path.
- An in-stream rate-limit phrase from another AI SDK provider, such as
  "Rate limit reached" with no status and no 429, no longer retries on its own.
  Those normally arrive as HTTP 429 before the stream.
- A message queued during the failed run is sent first when the run ends. The
  failed turn is then no longer the last message and keeps no Retry. This is
  upstream behavior.

The run manager already sends the engine's `errorCode` on the run's `error`
event, and the redaction hook already covers that event, so the provider's text
reaches the screen with held credentials replaced.

Run `pnpm --dir packages/workbench test:native-chat`.
`tests/native-stream-errors.test.ts` runs Core's OpenRouter engine against a
loopback fake. One table checks the engine's final stop for an OpenRouter
error chunk, one with no message, OpenRouter's documented mid-stream shape, an
error with a type and no code, provider names that are not plain or are too
long, an unknown chunk followed by a normal finish, an unknown chunk and the
provider's error chunk in both orders, and a last chunk that fails its schema
or is not JSON. No metadata or raw chunk may reach the stream. The
error chunk then runs through `startRun` with Vivary's redactor and a held
synthetic value in the provider message. A second table runs six turns through
`startRun`, with and without streamed text, with messages that name a closed
stream or an unavailable service, and with metadata that names an overload or
a timeout. Each must keep `provider_stream_error` after one provider request,
save a turn that keeps the error, and neither continue nor resume. A last case
checks that an error with its own HTTP status keeps `http_<status>`.
`tests/native-chat-components.test.mjs` passes an error event through
`processEvent` into `RunErrorRecoveryCard`. The turn must end instead of
continuing, the card must show the message and a Retry that reaches the retry
handler once for a double click, and an unclassified code must still get no
Retry. The inline notice must offer Retry for this code on the last message
only, and reach the handler once for a double click. A provider name of "401
unauthorized" must be left out of the text, and the card must stay the error
card with its Retry. Before the first review round, every case that round
added failed except the documented shape, the provider name cases, and the
status case, which already held. Before the second, the unknown chunk ahead of
the provider's error, the status-like name, and the inline double click failed.

Upstream could take these changes as they are. Remove this part of the patch
only when an upstream release shows an in-stream provider error with its
message and a Retry, and passes the same tests.

## Send button name

Issue #102. The Toolkit composer's Send button holds only an arrow icon. Its
label lived only in the hover tooltip, so the accessibility tree showed an
unnamed button, and screen readers and automation could not identify it. The
Toolkit patch adds `aria-label: sendButtonTooltip` to the button in
`dist/composer/TiptapComposer.js`. `sendButtonTooltip` already reads "Send
message", or "Queue message" when `willQueue` is set, through the composer's
translation adapter, so the name matches the tooltip in each state. The Stop
button is Core's and already has a name.

Run `pnpm --dir packages/workbench test:native-chat`.
`tests/native-chat-components.test.mjs` renders the Toolkit composer, with the
real Tiptap editor, inside the assistant runtime and tooltip providers. It
reads the send button's accessible name, "Send message" and then "Queue
message" with `willQueue`. linkedom has no text selection, computed style, or
viewport size, so the test supplies an empty selection, an empty style, and a
fixed size. The name was empty on the previous patch. In the packaged Windows
app, the accessibility tree showed an unnamed button after "Use microphone" on
build `d5c960ce` and "Send message" on build `32f02b54`. The queue state was
not reached there, so the test covers it.

Upstream could take this change as it is. Remove this part of the patch when
an upstream Toolkit release names the button and passes the same test.

## Native usage cost

Issue #103. Core priced every Native turn from its own table. A model the table
did not know matched a catch-all entry and was priced at Sonnet's $3 input and
$15 output per million tokens. In the packaged run for #50,
`stealth/space-bunny-alpha`, which OpenRouter lists at $0, recorded 48.31¢.
OpenRouter reports each call's cost in its last stream chunk, and the AI SDK
passes it on the step's `finish-step` part, but Core read usage only from the
`finish` part and dropped the cost.

The patch changes these files:

- `agent/engine/ai-sdk-engine.js` reads OpenRouter's
  `providerMetadata.openrouter.usage.cost` from the step's `finish-step` part
  and adds it to the step's `usage` event as `costUsd`, including 0. A missing,
  negative, or non-numeric cost adds nothing. `agent/engine/types.d.ts`
  declares the field.
- `agent/production-agent.js` passes `costUsd` from the agent loop to
  `onUsage`, and the loop calls the new `onModelCall` as each model call
  starts, with `retry` set when the call retries a failed attempt. The new
  `createTurnUsage` sums a turn's usage over its model calls and internal
  continuations. A retry replaces the attempt it retries, so a rate-limited
  attempt adds no call. The turn records the sum as a reported cost, in
  centicents rounded as `calculateCost` rounds, only when every call it counts
  reported a cost. Otherwise the turn passes no cost and the store decides.
- `usage/store.js` gives Sonnet ids their own price entry and removes the
  catch-all. `recordUsage` records `cost_source = 'unavailable'` with a cost of
  0 when the caller passed no cost and the table has no price for the model.
  `calculateCost` returns 0 for such a model, because traces and integration
  budgets also call it, and the new `hasTablePrice` says whether the table
  prices a model. The table setup, which runs once per process, also converts
  the old guesses. It sets every `estimated` row whose model the table does not
  price to `unavailable` with a cost of 0, so the #50 turns read Unknown after
  the upgrade. It changes no other row, and a second run changes nothing. A
  failed conversion, such as one by a database role without UPDATE on the
  table, logs a warning and lets setup finish, so usage still records. The
  next process start tries again.
- `usage/metrics-store.js` counts the calls whose cost is unknown, as
  `unknownCostCalls`, in the Usage tab's totals, today's figure, the daily
  figures, and the workflow and model rows. Recent rows carry `costSource`. A
  workflow or model row with calls of unknown cost sorts before the others, so
  the row limit does not drop it while the totals count its calls.
- `usage/alerts-store.js` counts the calls of unknown cost in each alert
  rule's window, as `unknownCostCalls`.
- `client/settings/UsageSection.js` shows a figure whose calls all have an
  unknown cost as "Unknown". A figure with both shows the known amount and the
  count, for example "12.30¢ + 1 unknown". Every figure adds only known costs.
  A cost alert shows its count the same way, for example "$0.00 + 1 unknown of
  $5.00". A token alert does not, because every call's tokens are known.
- `integrations/webhook-handler.js` sums an integration run's usage with
  `createTurnUsage`. The handler settles a run after it delivers the reply, or
  in its catch path when delivery fails, and both points call one step. Once
  the run started a model call, whether its agent loop finished or threw, that
  step passes the run's usage record to the new exported
  `recordAndSettleIntegrationUsage`, which writes the usage row and settles the
  run's budget reservations from that one record. A run that failed before its
  first model call, such as one whose engine did not resolve, settles nothing,
  and the handler releases its reservations. The settlement runs in a
  `finally` block, so a row that fails to write is logged and the reservations
  still settle. The row takes the reported
  cost by the chat turn's rule, so a free model's integration run on
  OpenRouter records $0 as reported. Without a reported cost the row keeps the
  table price or Unknown. Its tokens are the sum of the run's usage events, as
  a chat turn counts them, so a run whose agent loop failed after it used
  tokens now records a row too. The budget settles by three rules. A run whose
  calls all reported a cost settles at that cost, so a free model on
  OpenRouter settles at 0. A run with no reported cost settles at its table
  cost for a priced model, and at 0 when it used no tokens. A run that used
  tokens of an unpriced model and has no reported cost settles at its budget
  reservation, `INTEGRATION_RUN_RESERVATION_MICROS` or $5 by default, so a
  budget cap still fills. The function is exported so the test can call it as
  the handler does.

These limits remain:

- Only the main chat turn and an integration run record a reported cost in
  the usage table. Custom agent calls, background automations, and agent teams
  still record without one, so a free model on those paths shows Unknown
  rather than $0.
- A turn passes no cost when any call it counts reported no cost. A call cut
  off by Stop, by a dropped connection, or by an in-stream provider error
  after text reports none, and so does a call whose stream ends with no usage
  chunk. The table prices that turn, or it shows as Unknown.
- A retry replaces the attempt it retries. OpenRouter can bill output that an
  attempt streamed before it failed, and a turn whose retry reports a cost
  leaves that output out.
- An integration run of an unpriced model whose provider reports no cost,
  such as a model reached through a provider other than OpenRouter, fills a
  budget cap at the $5 reservation per run, however little it cost.
- The engine reads `usage.cost` only. OpenRouter reports the upstream charge
  for a request made with the owner's own provider key separately, in
  `cost_details.upstream_inference_cost`, and that charge is not added.
- Engine models that the table never priced lost the Sonnet estimate and
  record Unknown when the provider reports no cost. They include Cohere's
  default `command-r-plus-08-2024` and `command-r`, Ollama's default
  `llama3.1` and its other local ids, and Builder's `auto`, whose credit figure
  also reads Unknown.
- Traces price spans with `calculateCost`, so an unpriced model's span shows 0
  rather than Unknown. The daily trend chart plots known costs only.
- Usage alerts sum known costs, so an unknown cost never triggers a spend
  alert. The alert row shows how many calls it left out.
- The model list shows four rows. When more than four models have calls of
  unknown cost, it still shows four.
- The conversion reads the distinct models of `estimated` rows at every
  process start, one extra query on a large hosted table.

Run `pnpm --dir packages/workbench test:native-chat`.
`tests/native-usage-cost.test.ts` runs Core's OpenRouter engine against a
loopback fake whose last chunk reports usage with a cost of 0, a positive cost,
or no cost, and the engine's usage event must carry that cost. Nine turns run
through the agent loop and `createTurnUsage` into the usage table. A reported 0
records 0 as reported, a reported positive cost records it, a reported cost wins
over the table's Sonnet price, an unpriced model with no reported cost records
an unknown cost, and Sonnet with no reported cost keeps its $3 and $15 price. A
rate-limited first attempt followed by a retry that reports 0 records 0 as
reported. Three turns whose first call reports a cost record an unknown cost,
because the second call is stopped, cut off by an in-stream provider error
after text, or ends with no usage chunk. The Usage tab's metrics must count the
unknown call in every figure and leave it out of the known cost, and an
unpriced model must keep its row among six models. A second run of the table
setup over old rows must mark only the unpriced model's estimate unknown. When
a database trigger refuses the conversion, setup must log it and usage must
still record, and the next start must convert the row. A daily cost alert must
count the unknown call. Six integration runs go through the agent loop and
`createTurnUsage` into `recordAndSettleIntegrationUsage`, as the handler wires
them, and each must settle its budget and write its usage row from the same
record. A reported cost of 1.23¢ or 0 settles at that cost and records it as
reported, whether or not the table prices the model. Sonnet with no reported
cost settles at 6,000 currency micros and records its table price. An unpriced
run with zero tokens settles at 0 and writes no row, and an unpriced run with
tokens settles at its $5 reservation and records an unknown cost. When a
database trigger refuses the usage row, the failure must be logged and the
budget must still settle. Three claimed integration tasks run through
`processIntegrationTask`. In two of them the agent loop's first call reports
usage and an in-stream provider error cuts off its second call, so the loop
throws. Whether the fallback reply is delivered or its delivery fails, the
task must record Sonnet's table price in its row and settle at 6,000 currency
micros. The third task's engine does not resolve, and it must complete with
no row and no charge.
`tests/native-chat-components.test.mjs` renders the Settings Usage tab and must
show "12.30¢ + 1 unknown" for the total, "Unknown" for the unpriced model, and
"$0.00 + 1 unknown of $5.00" for a cost alert.

On the first patch for #103 every case of that round failed except the engine
case with no reported cost, and the turn cases failed because
`createTurnUsage` did not exist yet. On the second patch, the retried and
stopped turns, the model list, the old rows, both alert cases, and the budget
case failed. The budget case failed because the settlement function was not
exported. On the third patch, the two cut turns recorded the first call's cost
as reported, the refused conversion stopped usage from recording, and the
budget settled every unpriced run at its reservation and ignored a reported
cost. On the fourth patch, the six integration run cases failed because
`recordAndSettleIntegrationUsage` did not exist yet. On the fifth patch, the
handler's catch path wrote no row and settled nothing after a loop that threw,
and the task whose engine did not resolve ended as delivery-pending, because
the handler read the run's usage record, which the run never created. The refused
row case already passed, because the row writer logged its own failure.

Upstream could take these changes as they are. Remove this part of the patch
when an upstream release records a provider's reported cost and an unknown cost
for an unpriced model, and passes the same tests.

## Stopped replies

Issue #106. In the packaged run for #50, a Stop during a long turn looked late,
and the stopped reply carried no stopped label. The investigation found that
Stop already reaches the model request and Vivary's tools within milliseconds.
The run route calls `abortRunDurably`, which aborts the run's signal, and the
signal reaches `streamText` and each tool step's `ctx.signal`. The #50 click
most likely landed late, because the test harness read the accessibility tree
for seconds before each click. No record of the click time exists. The label
was missing for two reasons. The server's saved turn ignored the run's
terminal `{ type: "done", reason: "user" }` event, and the client showed the
stopped notice only under the last reply and only when it had no text.

The patch changes these files:

- `agent/thread-data-builder.js` sets `custom.userStopped` in
  `buildAssistantMessage` when the run ends with `done` and reason `user`, as
  the live client's `processEvent` does. The run store emits that event when
  the owner stops a run. That covers Stop in the chat, the stuck banner's
  Cancel and Retry (`user_stuck_cancel` and `user_stuck_retry`), and the stop
  of an agent team's background run. `foldAssistantTurn` already merges
  `custom`, so the flag also reaches a turn the client saved first. A later
  run that folds onto the same turn keeps the flag only when it was stopped
  too.
- The same file carries `userStopped` over in a client save, as it carries the
  run duration. The merge keeps one copy of a turn whole, usually the client's
  heavier copy. When assistant-ui cancels a stopped run, the client's copy can
  lose the flag, and the #50 turn's saved copy had none. The flag carries over
  only between copies of the same run, so a copy of a later run in the same
  turn does not take it.
- The same file saves a turn that the owner stopped before any text,
  reasoning, or tool call, with no content and the flag. `buildAssistantMessage`
  no longer drops it as empty, and a client save keeps an empty reply that
  carries the flag while it still drops other empty replies. The next
  request's history leaves the empty reply out, as the live chat's history
  does.
- `client/chat/repo-helpers.js` keeps such a reply when the chat loads a saved
  thread. `dropEmptyAssistantMessages` dropped every empty reply.
- `client/chat/message-components.js` shows "The agent stopped before
  finishing" under every stopped reply, with or without text and after later
  turns. It reuses the `agentChat.error.stopped` string, so no locale file
  changes. A missing-response warning inside a stopped reply is hidden, and
  the stopped notice shows under the reply in its place. Once its run has
  ended, a stopped reply with no content shows the notice alone, where the
  message view rendered nothing for a reply without content.
- `client/AssistantChat.js` keeps a list of the runs the owner stopped in the
  chat, by run id and turn id, and the message view reads it. Sending the next
  message clears the older stop marker but not this list. assistant-ui writes
  a cancelled run back over the live reply without the flag, so in the live
  chat the notice rests on this list. When both the stop and a reply know a
  run id, the run ids decide. Stop flags only the stopped run's own reply, and
  nothing when that reply is not among the chat's messages yet.
- `agent/run-manager.js` gives a run that a newer turn displaces in memory
  the reason `displaced`, which ends it with `done` and no reason, so its
  reply is not labeled.

These limits remain:

- A turn saved before this patch, such as the #50 turn, keeps no label. Its
  client copy has the status `incomplete` with the reason `cancelled`, which
  assistant-ui also sets for other cancels, so the patch does not read it as a
  Stop.
- A reply stopped before any content shows no footer, so it has no timestamp
  or Regenerate button. The owner sends the question again instead.
- A Stop sent before the client knows the run id goes to the turn route, which
  only writes a turn marker. The running run finds it on its next check, which
  can take about 3 seconds. The investigation measured 1,979 ms.
- A tool that ignores its signal keeps running after Stop, although the loop
  stops waiting for it at once.
- While a reloaded chat follows a run, the run's reply is not among the
  chat's messages, so a Stop labels nothing in the live chat. The saved turn
  carries the flag, and the notice shows after a reload.

Run `pnpm --dir packages/workbench test:native-chat`.
`tests/native-stop.test.ts` starts a turn through `startRun` and the agent
loop against a loopback fake OpenRouter and presses Stop with
`abortRunDurably(runId, "user")`, the run route's own call. While the model
streams its reply, the run must end and the model connection must close
within 500 ms, with one provider request and one terminal event, `done` with
reason `user`. In 13 runs on Zo the run ended 68 to 206 ms and the connection
closed 85 to 216 ms after Stop, most of it while the engine's AI SDK stream
settled, and the time grows with host load. During a tool step that honors
its signal, the signal must fire within 50 ms and the run must end within
500 ms. In the same runs they took 0 to 1 ms and 2 to 8 ms. The saved turn
must keep its text or its tool call and set `userStopped`, and a client save
of a heavier copy without the flag must keep the flag and the client's
content. A later run that finishes the same turn must drop the flag, and a
client copy of that run must not take it. A run that a newer turn displaces
must end with `done` and no reason and save no flag. A Stop while OpenRouter
sends only its keep-alive comments must end the run within 500 ms, and the
saved turn must hold no content and set `userStopped`. A client save of the
empty cancelled copy after the server's save, and of the flagged copy before
it, must keep the question and the stopped reply, and the next request's
history must leave the empty reply out. Each test that waits for
a run to end fails after 10 seconds when the run never ends. The script's
`--test-force-exit` then ends the file, which the run's own timers would keep
open. `tests/native-chat-components.test.mjs` renders Core's assistant
message for a reloaded thread with two stopped replies that have text and a
finished reply between them, and the notice must show under both stopped
replies only. A stopped reply that holds a missing-response warning must show
the notice instead of the warning. The test also mounts Core's whole chat
against a fake chat server. After a Stop on a live reply with text and the
next message, the notice must stay under the stopped reply. After a Stop
while the chat follows a run, the previous finished reply must stay
unlabeled. The test builds a thread whose second turn the owner stopped before
any content, with Core's builder and client-save merge, and reloads it in the
whole chat. The earlier turn and the question must show, followed by the
notice. On the first patch for #106 the timing cases passed and the label
cases failed, and with only its first and third changes the client save case
still failed. On the patch before these review fixes, the live reply, the
reply with the warning, the finished reply before a followed run, the later
run in the same turn, and the displaced run failed. On the patch before the
Codex review fixes, the turn stopped before any content was not saved, both
client saves kept only the question, and the reload showed no notice. A patch
without the load change, or without the view change, still showed no notice
after the reload.

Upstream could take these changes as they are. Remove this part of the patch
when an upstream release labels every stopped reply after a reload and passes
the same tests.

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
of a row run. A failed run is recorded on its row and logged once, by
`runQueuedAutomationRun`. It never becomes an unhandled rejection.

The plugin registers the runner with its `appId`. The runner takes only rows
of that app and legacy rows with no app, which are the rows
`runQueuedAutomation` accepts. Another app's rows that share the database keep
self-dispatch, and this process does not end them late.

The runner registers after several awaits in the plugin's init, but no Run now
can arrive before it. The plugin passes its init promise to `trackPluginInit`
with the `/_agent-native/actions`, agent-chat, A2A, and MCP paths, and the
readiness gate in `framework-request-handler.js` holds requests on those paths
until that promise settles. In a live check on Zo, a Run now sent the moment
the restarted server accepted a connection returned HTTP 200 and ran in
process. That check cannot tell the gate from an init that had already
finished.

With a runner registered, the sweep passes a queued row of the runner's app
to the runner only while the row is younger than the claim lease. The lease
is 1.5 times the background run's hard timeout: 15 minutes by default, or 1.5
times `AGENT_BACKGROUND_RUN_HARD_TIMEOUT_MS`. A queued row can therefore still
start up to the claim lease after the click. The sweep claims an older row and
ends it as an error instead of running it. Only a process with a registered
runner ends old rows, and only rows of its app. Elsewhere the sweep keeps
redelivering them. An unclaimed row gets the error code
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
them. It also checks that another app's row is neither run nor ended, that a
failed run is not logged a second time, that a second delivery of a claimed
row returns `skipped` and leaves the row unchanged, and that a failure inside
the real `runQueuedAutomation` lands on the row as an error. A source pin
checks that the installed plugin registers the runner once, with its app id,
in the branch that starts the in-process timer, and that `trackPluginInit`
holds the actions and agent-chat paths.

Upstream can take this change without Vivary-specific edits for a process that
serves one app. It adds exports and changes behavior only on hosts that start
the in-process timer. A process holds one runner, so a process that mounts the
agent-chat plugin for two apps keeps only the last registration, and the other
app's Run now falls back to self-dispatch. Upstream would need one runner per
app for that case, and may prefer to pass the runner through the plugin options
instead of a module registry. Remove this part of the patch after an upstream
release passes the same test and a packaged Run now check.

## In-process webhook automations

Issue #113 makes webhook automations work in the packaged app, as the owner
decided on 2026-09-27. A call to `/_agent-native/automations/webhook/<token>`
is stored in `integration_pending_tasks`, and Core then sent the task to its own
process-task route over HTTP. That needs an app URL in local mode and an
`A2A_SECRET` in hosted mode, and the packaged app has neither. The caller still
got HTTP 202, the task never ran, and the retry sweep sent it again about every
90 seconds without end.

`integration-durable-dispatch.js` now exports
`setInProcessIntegrationTaskRunner(runner, { platforms, appId })`, a sibling of
the Run now registry. When a runner is registered for the task's platform,
`dispatchPendingIntegrationTask` records the dispatch as `in-process`, starts
the runner without waiting, and returns `in-process`. The webhook route and the
retry sweep both call that function, so both reach the runner. Without a
runner, Core keeps the self-dispatch.

The webhook branch of the process-task route is lifted into
`dist/integrations/automation-webhook-task.js`.
`runClaimedAutomationWebhookTask` runs a claimed task, marks it completed,
retryable, or failed, logs a failure, and dispatches the next queued call for
the same automation. The route and `runAutomationWebhookTaskInProcess` both use
it. The in-process runner claims the task first with `claimPendingTask`, so a
second delivery returns `skipped`. It leaves a task of another app that shares
the database pending, unclaimed, for that app's own process.

`agent-chat-plugin.js` registers the runner only where it starts the in-process
recurring-jobs timer, and only after `initTriggerDispatcher`, because the
dispatcher's dependencies are null before then. The plugin's `trackPluginInit`
paths now include `/_agent-native/automations/webhook`, so the readiness gate
holds a webhook call until the runner is registered.

The retry sweep reset a `processing` task after 5 minutes, while a background
run can last 10. An `in-process` task now gets the Run now claim lease as its
cutoff: 1.5 times `AGENT_BACKGROUND_RUN_HARD_TIMEOUT_MS`, 15 minutes by
default, and never less than the 5-minute default. A live run is not reset,
and a task whose process was killed mid-run is reset and delivered again
after the lease, about 15 minutes after its claim. A pending task, accepted
before a quit and never started, runs at the sweep's first pass at least 90
seconds after the quit. The first pass comes 10 seconds after startup and later
passes every 60 seconds, so for a start more than about 80 seconds after the
quit that is about 10 seconds after the start, and for a sooner start 70 to 130
seconds after it. A normal quit returns a task whose run it interrupted to
pending (see "Automation runs at quit"), so that task runs the same way. Either
way the call runs once to completion. A run cut off by a quit or a kill leaves its history row reading
that the run stopped before it recorded a result, so one call can show two
history rows. The rerun starts from the
beginning, so it can repeat a local step the cut-off run already took, such as
a memory write. Until the rerun, later calls for the same automation wait
behind it, because tasks of one automation run in order. A prompt reset at
startup is not safe here: the automation's own "running" status also holds a
rerun back until the hard timeout passes, and a second server on the same data
folder could still own the claim.

A pending task older than 24 hours is expired instead of run, so a build that
starts after a long gap, or after an older build left calls pending, does not
replay old payloads. The sweep fails the task and writes an errored history row
with the code `automation_webhook_expired`. An automation with 20 calls waiting
or running answers new calls with HTTP 429 and `Retry-After: 60`, so a caller in
a loop cannot queue unlimited runs. A repeated event id still gets its 200
duplicate. The count is not atomic with the insert, so the cap can pass by a
call or two. The registry's optional `acceptsTask`, `expireTask`, and
`maxTaskAgeMs` carry the app check and the expiry to the sweep, which also
leaves another app's task untouched instead of moving its `updated_at`. Those
untouched rows stay first in the sweep's `updated_at` order, so when a full
page held any, the sweep reads the next page, up to 10 pages a pass. The expiry
fails a task only if its `updated_at` still matches what the sweep read, so a
task claimed in between runs instead of expiring.

`dispatchAutomationWebhookTask` in `triggers/dispatcher.js` required a stored
API key for the active engine setting before every webhook run. Scheduled runs
have no such check. The key feeds only the condition classifier, so the check
now applies only to an automation with a condition. Before, a webhook run
failed with "No API key is available for this automation." for an owner whose
key came from the launch environment under another engine, a Builder gateway,
or a keyless local model. Event triggers keep the old check.

The condition classifier calls Anthropic's API directly with a small Claude
model, whatever provider runs the automation, and it sends the webhook payload
there. It now takes only an Anthropic key, from the owner's settings or the
launch environment. Before, it took the active provider's key, so an
OpenRouter key was sent to Anthropic, rejected, and the call skipped without a
word. Without an Anthropic key, or when Anthropic rejects it with 401 or 403,
the call fails at once instead of retrying three times. The automation's
history gets an errored row, with the code `automation_condition_key_missing`
or `automation_condition_key_rejected` and a message that names the cause, and
its last status reads as an error. A network error or other answer is retried
as before. A call that fails all three attempts for another reason also gets an
errored history row, `automation_webhook_failed`. Defining a condition is not
refused, so an owner without an Anthropic key learns of the problem from the
first call's history row.

The Automations details dialog showed only the path. `AgentJobsTab.js` now
shows the full URL with the page's origin, from `automationWebhookUrl` in
`client/integrations/webhook-url.js`, and a "Who can call it" line. The page
origin cannot tell a local server from an owner-only proxy, so
`dist/shared/automation-webhook-reach.js` holds the reach that the host sets,
and the page config carries it to the browser, like the Builder offers switch.
Vivary's `server/plugins/00-webhook-reach.ts` sets it from the access mode.
Local mode reads "Reachable only from this computer while Vivary is open."
Private-proxy mode reads "Reachable only through your private Zo access."
Hosted mode reads "Anyone with this URL can start this automation." Without a
host setting, `isLoopbackWebhookUrl` picks the local or the public wording,
because `isNonPublicWebhookUrl` also counts LAN and plain HTTP hosts, which
other computers can reach.

The token is an app secret. Credential redaction holds every stored secret, so
the token becomes a placeholder in tool results, threads, logs, and run events.
The agent therefore cannot show the URL, and the owner copies it from the
details dialog. The payload still reaches the run fenced as untrusted data, and
the run gets the local-only surface described below.

Run `node --test packages/workbench/tests/automation-webhook.test.mjs`. It uses
a disposable SQLite database with `NODE_ENV=production`, no app URL,
`A2A_SECRET`, or provider key, a fake engine, and Core's automations handler on
a loopback port. It checks that an accepted call runs once with one history
row and its thread, that a wrong token gets 404 and queues nothing, that a
repeated event id runs once and gets a 200 duplicate, that a task left pending
by a quit runs once through the sweep, that a 6-minute-old `in-process` task is
not reset while one past the lease is recovered and runs once, that a claimed
task is skipped, that another app's task stays pending, that a condition still
needs a key, the URL helpers, and a source pin on the registration. It failed
10 of 10 on the previous patch. Review fixes add cases for a condition with only
an OpenRouter key and one whose Anthropic key is rejected, each failing at once
with an errored history row and a stubbed Anthropic endpoint, a 25-hour-old
call expired without a run, the 429 cap with its duplicate answer, another
app's task left untouched by the sweep, and the reach in the page config. Those
7 cases fail on the first version of this patch.

A live check on Zo ran `bin/start.mjs` in local mode with a fake Builder
gateway, no stored provider key, and a 40-second hard timeout. A call to a new
webhook automation got 202 and ran once, with one history row and its thread.
Its model request carried the fenced payload and the 11-tool local-only
surface. The same event id got a 200 duplicate and no run, and a wrong token got
404. A call whose run was cut off by stopping the server ran once more after the
restart, when the sweep passed the 5-minute floor, and its first history row
reads as interrupted. The token appeared in no server output, provider log, or
data file.

Upstream could take the registry as it is, because nothing changes until a
host registers a runner. The same limits as Run now apply: one runner per
process.

## Builder.io offers in local mode

Issue #104. The owner decided on 2026-09-27 that the local app offers no
Builder.io: no free credits and no Connect Builder.io button. Owners use their
own provider keys. Self-hosted mode keeps Core's offers for now. Core has no
option for this, so the patch adds one switch.

`dist/shared/builder-offers.js` exports `setBuilderOffersEnabled` and
`builderOffersEnabled`, and the `./server` entry re-exports both. Offers are on
unless a host turns them off. The server keeps the value on `globalThis`,
because Core can load twice. `resolvePublicAppOriginConfig` adds
`builderOffers: false` to the page config that every document carries, so the
browser reads the same value without a request. It is the same for every
visitor, which the cached page shell requires. Each surface reads the switch
when it renders or builds text, never at module load, because the host sets it
after Core loads. Vivary's `server/plugins/00-builder-offers.ts` turns the
offers off when `VIVARY_ACCESS_MODE` is `local`.

With the switch off:

- The chat's missing-access card reads "Connect AI. Add your own provider
  keys." and shows the provider-key form at once, with no Builder.io button
  and no toggle. A rejected Builder credential shows the same key form instead
  of Reconnect Builder.io.
- `BuilderConnectPopover` and `BuilderConnectCard` render nothing, which
  removes every connect button built on them, in the chat, Settings,
  Connections, and voice setup. `FileStorageSetupCard` keeps its "Use custom
  storage keys" path, which the upload instructions send the model to, and
  drops only its Builder part.
- Settings drops the Builder.io card from the LLM, hosting, database, uploads,
  and authentication rows, and hides Browser Automation and Background Agent,
  which hold only that card. The LLM summary reads "Add your own provider
  keys." Voice settings drop the Builder Gemini option and the Builder wording.
- First-run onboarding goes from the intro to the key form.
- The code-access panel drops its "Use Builder" link. The code-required
  dialog drops its Builder.io agent and connect options and keeps Desktop.
- The remaining Builder wording goes too: the `FeatureNotConfiguredError`
  default message, the background agent and file upload errors in
  `core-routes-plugin.js`, and the editor image upload error.
- Core's composer adapters pass `builder.offersEnabled` to Toolkit. The
  Toolkit patch adds it with a default of true. The model picker keeps its
  add-keys action and drops Connect Builder.io, and voice mode setup drops its
  Builder.io button and says to add your own keys.
- The server surfaces are listed in the next paragraph.

The model and the server drop Builder too. `connect-builder` and
`activate-browser` are not registered, and `get-framework-context` loses its
`builder` and `browser` topics. The framework prompts replace the Builder code
handoff with a sentence that source edits belong to a coding agent, and leave
Builder tools out of the plan-mode list. The web search, upload-image, and
file-storage card descriptions name only provider keys and custom storage.
Missing-provider, web search, upload, transcription, and realtime voice errors
point to the owner's own keys. `llmMissingCredentialsMessage()` returns "No LLM
provider is connected. Add your own provider key in Settings.", which keeps the
prefix that the chat's recovery card matches. Its callers in the run store, the
production agent, the engines, and the run manager call it when they report
the error. Core builds its tool list and prompts when the agent-chat plugin
starts, so Vivary's plugin sets the switch when its module loads.

Run `node --test packages/workbench/tests/builder-offers.test.mjs
packages/workbench/tests/builder-offers-component.test.mjs`. The component test
bundles Core's `run-recovery.js` and `FileStorageSetupCard.js` with esbuild,
with Core's real provider-key form, and renders them with the local page
config. The missing-access card shows no Builder text or button and shows the
key field. The storage card shows its custom-key path and no Builder text.
Control renders with offers on show Builder text. The unit test checks the switch, the page config, and each server
surface with the switch off and on, and pins the client and Toolkit call sites.

Upstream could take the switch as an option, because nothing changes until a
host turns it off. Remove this part of the patch only when an upstream release
offers the same option and passes the same tests.

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
- `resources` refuses `read`, `effective`, `write`, `promote`, and `delete` on
  the paths Core reads as configuration. The scheduler and the dispatcher load automations from `jobs/`.
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
- `chat-history` refuses only `open`, which drives the app window. Search,
  rename, pin, unpin, and archive stay allowed because they change local
  thread metadata only.
- `save-memory` and `delete-memory` refuse a name that holds `/`, `\`, or `..`,
  because the scripts build `memory/<name>.md` from the name as given.
- Reads count too. `mcp.config.json`, `.mcp.json`, `agents/`, and
  `remote-agents/` can hold server headers or tokens that a run could copy into
  memory.

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
`backgroundMcpTools` plugin option no longer has an effect. The runner's
`assertRequestedMcpToolsAvailable` is gone too, because the refusal fires
first for every automation that lists MCP tools.

A review of the first version found a bypass. The CLI bridge in
`server/agent-chat/script-entries.js` turns each argument into a `--name value`
pair, and `scripts/parse-args.js` reads `--name=value` and lets a later flag
win. A run could call `resources` with `path: "notes/ok.md"` and an extra
argument named `path=jobs/x.md`. The refusal checked `notes/ok.md`, and the
write script received `jobs/x.md`. A value that starts with `--` could do the
same. The run surface now refuses an argument that the tool's input schema
does not declare, and every kept tool refuses an argument name that holds `=`
or starts with `-`. For an automation caller only, the bridge also refuses
those names and passes each value inline as `--name=value`, so a value that
starts with `--` stays a value. Interactive chats keep the older bridge form.
There, a value that starts with `--`, such as Markdown front matter, is still
read as a flag and stored as `true`. That is a separate follow-up.

The run surface is built from Core's own tool groups only, so a template or
tool action that reuses a kept name cannot replace Core's checked entry.

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
the plugin. Later cases cover the crafted argument names on `resources`,
`save-memory`, `delete-memory`, and `manage-automations`, a value that starts
with `--`, `JOBS/` and `./jobs/` paths, unsafe memory names, and a read of
`mcp.config.json`, refused for a run and allowed for a chat. The resources
cases read back the stored path and content.

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

## Settings automation status

Issue #115. Settings > Agent > Automations is Core's page. Its Details dialog
showed LAST CHECKED as a dash while the scheduler checked every minute, and it
offered Open thread on some past runs, which did nothing in Vivary.

LAST CHECKED read the automation's `lastCheck` front matter field. The
scheduler writes that field only when an identity check skips the automation,
and the event and webhook dispatcher writes it only when it declines a call or
an event, so a healthy automation kept it empty. The scheduler records its own
check in `automation_scheduler_health`: every tick that holds the scheduler
lease writes the app's `<appId>:global` row before it scans.
`list-automations.js` and `list-recurring-jobs.js` now read that row once per
call through `getAutomationSchedulerHealth`. For an enabled entry with a valid
schedule, they report the later of its stored `lastCheck` and the row's
`last_checked_at`. Event, webhook, and paused entries keep their stored value,
because the scheduler does not check them. A heartbeat from before the
entry's resource was created, its `created_at`, does not count, so a new
entry keeps its stored value, usually empty, until the next check. Pausing
and resuming keep the created time, so a resumed automation shows the last
check at once, although that check read it while it was paused and skipped
it. Checks run about once a minute, so that value is at most about a minute
older than the resume, or older while a scheduled run holds the lease. The
field keeps its name and ISO
format, so the client is unchanged. A heartbeat whose row records an error in
`last_error` is not a check, so the lists ignore it: a sweep writes that error
in its `finally` when its scan failed. The value is informative only, so a
failed read of the row is logged and each entry keeps its stored value instead
of failing the list. Only the lease holder writes the heartbeat, so LAST
CHECKED stops advancing while a process that has gone still holds the lease.
It also stands still while a scheduled run is in progress, up to the run's
10-minute limit, because the sweep that started the run holds the lease until
the run ends and every other tick fails to take it. That is honest, because no
check runs then. The sweep writes the heartbeat again when it ends. The Details
dialog shows the list entry captured when it opened (`AgentJobsTab.js`), and the
list query has no refresh interval, so LAST CHECKED in Details can lag behind
the heartbeat until the Automations tab reloads. The packaged check on the
unpublished `9e921ca0` package saw this right after a tick. This patch does not
change that.

The Details dialog showed Open thread on a run with an error and a thread. The
control sent Core's `agent-chat:open-thread` window event, which only Core's
`MultiTabAssistantChat` handles, and Vivary does not mount it on Settings. The
run's thread also has no chat scope, and every Vivary history list shows only
threads of its own scope, so no page could open it. The owner decided on
2026-09-29 that run threads are not openable from Settings.
`AutomationDetailsDialog.js` no longer renders the control, and the desktop
guide says so.

Settings lists no next run for a paused automation, because both list actions
return none for a disabled entry. The stored value can be in the past, and the
agent's `manage-automations list` still returns it. The page offers schedule,
event, and webhook triggers, and both the packaged app and the hosted server
run all three in process, so that part of #115 needed no patch change.

Run `node --test packages/workbench/tests/automation-status.test.mjs`. It uses
a disposable SQLite database with `NODE_ENV=production`. It records a
heartbeat, then lists a scheduled automation, one whose recorded skip is later
than the heartbeat, an event automation, a paused automation, and two legacy
recurring jobs, and checks each LAST CHECKED value. Another app's heartbeat on
the same database does not count. It pins that a paused automation lists no
next run. It bundles the Details dialog with esbuild, renders it with a
successful, an interrupted, and an errored run, and checks that none offers
Open thread. The LAST CHECKED and Open thread cases failed on the previous
patch. A review round added three cases. A list on a fresh database, before
any heartbeat, keeps each stored value. A read that fails, because the health
table was moved away, is logged once per list, and both lists keep the stored
values. A heartbeat recorded with an error does not count, and the next good
check counts again. The last two failed on the patch before the fallback.
A fourth review round added a case: an automation and a legacy job created
after the heartbeat keep their stored value, and a resumed automation shows
the heartbeat. The first two failed on the patch before this round's fix. The
other fixtures are backdated an hour, so they predate the heartbeat.

Upstream could take the LAST CHECKED change as it is, because it changes only
a read-only field. Removing Open thread is Vivary's choice: a host that mounts
Core's chat beside the page can open an unscoped thread. Remove the LAST
CHECKED part when an upstream release reports the scheduler's check and passes
the same test. Remove the Open thread part only when Vivary can open a run
thread, by giving it a scope or a route that loads it, and the test expects
the control.

## Automation runs at quit

Issue #114. A normal quit during an automation run left the run's history row
`running` and the scheduler lease held by the old process. The next launch
could not take the lease until it expired, up to 10 minutes after the last
renewal, and the row became an error only then. Vivary's shutdown did nothing
for automations, and Core had no way to stop them.

`scheduler.js` now exports `stopRecurringJobs({ timeoutMs })`, and
`@agent-native/core/jobs` exports it too. Vivary's one shutdown owner,
`stopLocalWork` in `server/plugins/02-local-code-lifecycle.ts`, calls it beside
the Code host, original command, and preview stops. It calls the automation
stop first and starts every stop even when another throws as it is called. It
reports a failed stop only after all of them settle, so it always waits for
the automation stop, and a failed stop cannot end the CLI host while
automations are still stopping. That owner runs on the
desktop's IPC shutdown and on a signal or Nitro `close` in the CLI host. The
stop works in this order:

1. It closes the scheduler and the runner, synchronously. A timer tick returns
   before it takes the lease, a sweep that was still scanning starts no job,
   and `runQueuedAutomation` leaves a queued Run now row unclaimed for the next
   start. The runner exports `isBackgroundAutomationsClosed`, and four more
   places check it. `executeJob` returns `skipped` before it marks the
   automation running, so a due job stays due, a direct `runJobNow` starts
   nothing, and a Run now row it had already claimed reads interrupted. For
   an automation on a paired execution host, `executeJob` checks again after
   the mark, right before it queues the run on that host, because the stop
   cannot abort a run there. If a quit began during the mark, it writes back
   the fields the mark replaced without moving the next run, so a scheduled
   job stays due and a claimed Run now row reads interrupted. A quit that
   begins while `dispatchRemoteAutomation` looks up the host and writes its
   bookkeeping still queues the run. The event handler checks it for each
   matching trigger before the identity
   check, any write, and the condition classifier, so the event is lost as
   after a crash. It checks again right before the dispatch, for a handler
   that passed the first check before the quit began. The in-process webhook
   runner returns `skipped` before its claim, and Core's process-task route
   answers a webhook task with `skipped: "app-quitting"` before its claim, so
   the call stays queued, unclaimed, with its attempts unchanged. A run whose
   setup was already past those checks is aborted as soon as it starts, before
   the model.
2. It aborts every in-process background run that is still running with the
   reason `shutdown`. Scheduled runs, Run now, and event and webhook runs all
   go through `runBackgroundAutomation`, which keeps the ids of the runs it
   started. A run that already completed and is saving its thread is not
   aborted, so it records its own success.
3. Each run records its own outcome. The runner's completion callback turns a
   `shutdown` abort into the interrupted error. It checks the abort reason
   alone, because a run that reached a soft-timeout boundary reads completed
   after the quit's abort. The runner writes the
   history row as `interrupted` with the message "The run stopped before it
   recorded a result, for example because the app quit or its worker
   restarted. No delivery was confirmed." and the code
   `background_automation_interrupted`, the values Core already derived for a
   stale row. It does not report the interruption as a fault. For a scheduled
   run or Run now, `executeJob` then writes `lastStatus: error` and the same
   message on the automation. A scheduled run's next run moves to the next
   occurrence after the quit, and a Run now keeps its next run.
4. The sweep that holds the lease releases it in its existing `finally`, with
   its own owner id.

The stop waits for the sweeps, the queued runs, the runs it interrupted, and
the writes that record a trigger run's outcome, or for `timeoutMs`, whichever
comes first. The runner exports `trackBackgroundAutomationWork`, and the
dispatcher's `dispatchAgentic`, the in-process webhook runner
`runAutomationWebhookTaskInProcess`, and the process-task route put their work
in it, so the stop also waits for the automation's last status and the webhook
task's row on either path. The route tracks its claim, which follows a passed
closed check with no await between them, and then its call to
`runClaimedAutomationWebhookTask`. The desktop and the CLI host register the
in-process runner, so a webhook task reaches the route only on a host without
it, such as a deployment without the in-process timer. The runner's wait
drains the tracked work rather than reading it once: after each pass it waits
again for work tracked during that pass, until none is left. So a route call
whose claim was saving when the stop began is waited for through its run and
its requeue. That call still dispatches, as a run whose setup was past the
closed checks does (step 1): its run is aborted before the model, records an
interrupted history row and a thread, and the task goes back to the queue.
The stop passes its own promise to the wait, so no pass starts after the stop
returns and a pass still waiting then ends. Work that keeps arriving cannot
hold the stop past `timeoutMs`. The event handler's reads, identity check, and
classifier call are not tracked, and its second check covers a handler that is
past its first check when the quit begins. The declarations of the three
runner exports are in its `.d.ts`.
Vivary passes 10 seconds, the Code host's shutdown wait, so `stopLocalWork`
still ends 5 seconds before the desktop ends the server's process tree. A later
call returns the first stop. On the desktop the server calls no exit after
`stopLocalWork` settles, so the desktop's kill still ends it 15 seconds after
the shutdown message. The packaged check timed each normal quit at 15.5 to 15.9
seconds, with the automation rows written within 40 ms.

The hard-kill fallback does not change. The stop writes nothing itself and
never clears a lease by row id, so it cannot free another process's lease. Its
flag and run list are process state that only the stop sets, so a killed
process leaves the database as before: the row reads `running` until the
liveness ceiling, 15 minutes after the run started, or the stale-run reset, the
automation reads running, and the lease holds until 10 minutes after its last
renewal. When the bound expires, the stop returns and writes nothing more. A
run that settles later still records itself, as any run end does, while the
process lives, and one that never settles is left as after a kill. No
startup recovery was added, because clearing a lease or ending rows at launch
is unsafe when two processes share a database. The lease length, the renewal,
the liveness ceiling, and the claim lease are unchanged. While a dead process's
lease holds, Settings shows the automation's next run about a minute out,
because the list actions report the next occurrence from now once the stored
one has passed. Nothing runs until the lease expires.

Trigger runs record their outcome through the dispatcher, which catches the
run's error and writes the automation's last error from its message, without
the final sentence. An event has no queue, so an event whose run a quit
interrupted does not run again, as after a crash. A webhook call goes back to
the queue, as the owner decided on 2026-09-29. `dispatchAgentic` reports the
interruption without rethrowing, so the event handler keeps going through its
matching triggers, and `dispatchAutomationWebhookTask` returns `interrupted`.
`runClaimedAutomationWebhookTask` then calls `markTaskRetryable` with the
interrupted message and `resetAttempts`, because the host stopped the run, and
it does not start the next queued call. The task reads `pending` with its
payload kept. This write happens only in the run's settle path, after the run
recorded itself interrupted, never from the stop and never by task id, so a
second process on the same database cannot run the call while the first run
still works. The next launch's retry sweep runs it at its first pass at least
90 seconds after the quit, and the calls queued behind it follow in order. The
owner sees the interrupted history row and later a second row for the same
call. The rerun starts from the beginning, as after a crash. A run that
outlasts the bound, or a kill between the history row and the task write,
leaves the task `processing`, and the sweep delivers it again about 15 minutes
after its claim. A task the process-task route claimed records another
dispatch outcome, so the sweep delivers it again 5 minutes after its claim, or
16 minutes for a background-function claim. The route answers an interrupted
call with `retrying: "app-quitting"` instead of `"automation-active"`. An event
or a webhook call that arrives during the quit starts no run (step 1).

Run `node --test packages/workbench/tests/automation-quit.test.mjs`. Each
quitting or killed process is a child that runs
`tests/automation-quit-process.mjs` against the test's disposable SQLite
database, with `NODE_ENV=production` and a fake engine. The test process plays
the next launch. It checks that a quit during a scheduled run and a Run now
marks both rows interrupted with the message once and the code, writes each
automation's last status and next run, releases the lease, and returns only
after both runs settled. After the stop, a tick takes no lease and writes no
heartbeat, and a queued Run now stays unclaimed. The next launch runs both due
automations at its first tick. A killed child keeps the lease, which expires
about 10 minutes out and blocks the next scan, and its run reads interrupted
only past the liveness ceiling. A stop in a second process leaves the first
process's lease alone. A run that ignores its abort holds the stop only until
the bound and stays `running`. A source pin checks that `stopLocalWork` calls
the stop with 10 seconds, the Code host's wait, and that the package entry
exports the scheduler's own function. Eight of the nine cases failed on the
previous patch. The hard-kill case passed on both.

A review round added trigger cases. A child quits with an event run and
webhook call A in flight and call B queued, and exits as soon as the stop
returns, as the CLI host does. The event's automation reads its error, both
tasks read `pending` with their payloads and no spent attempt, only A has a
history row, and the next launch's retry sweep runs A and then B once each.
Both cases failed on the previous patch: the event's automation still read
running and call A was left `processing`, because the stop returned before the
dispatcher's writes. A second child quits with only an event run in flight, so
no other work holds the stop open for the dispatcher's write. After the stop, an event, a direct Run now, and a queued
webhook call start no run and write nothing, and a Run now claimed just before
the stop reads interrupted with no thread. Those three cases failed on the
patch before the closed checks. Three more pin a sweep that is scanning when
the stop begins, which dispatches nothing, leaves its job due, and releases the
lease, a second stop call, which returns the first, and a run still preparing
when the stop begins, which is interrupted before the model. A quit that lands
after a run completed, while its thread save is pending, leaves the history
row a success and the agent run completed. A quit that lands after a
one-second soft timeout ended a run's turn reads interrupted, not cut off.
Both failed on the patch before the running filter and the reason check.

A second review round added route and event cases. A child quits with a
webhook call's run in flight through Core's process-task route and exits as
soon as the stop returns. The task reads `pending` with its payload, no spent
attempt, and the interrupted message, and its one history row reads
interrupted. After the stop, the route answers a queued webhook call with
`skipped` and leaves it unclaimed with no history row, and an event whose
trigger has a condition reaches neither the classifier nor a write. Those three
failed on the patch before this round's fix: the task stayed `processing`, the
route wrote an interrupted run and a thread, and the handler called the
classifier and recorded a skip. The child answers the classifier itself, never
over the network. An event whose condition check began before the stop and
matched after it starts no run, which pins the second check. The after-stop
event cases wait for the dispatcher's handler to finish, not for a fixed delay.
A run the owner stopped just before the quit keeps its `user` abort reason and
reads as an error, not interrupted, which a status filter weaker than `running`
would break.

A third review round added two cases. A child starts the stop while the
route's claim of a webhook call is saving and exits as soon as the stop
returned and the claim saved. The task reads `pending` with its payload, no
spent attempt, and the interrupted message, and its one history row reads
interrupted. A second child tracks work that keeps arriving during the stop.
The stop waits for it until its bound, and no pass of its wait starts after
the stop returns. Both failed on the patch before this round's fix: the task
stayed `processing`, and the stop returned after the first piece of work.

A fourth review round added three cases. Two load the lifecycle plugin with
stand-ins for its four stops. One stop throws as it is called, and another
rejects. Through the Nitro `close` hook and through the signal handler, every
stop still starts, the automation stop first, and the failure is reported
only after the automation stop settled. Both failed on the previous
`stopLocalWork`, which used `Promise.all`: the preview stop never started, the
hook rejected first, and the throw left the signal handler. In the third, a
child holds the running mark of a scheduled run and a Run now for
automations on a paired execution host until both are saving, then starts
the stop. Nothing is queued on the host, the scheduled run stays due with no
history row, the Run now row reads interrupted with no thread, and the next
launch queues the due run. It failed on the patch before this round's fix,
which queued both runs on the host.

The plugin's import and Core's timer must share one copy of `scheduler.js` in
the server bundle, or the stop would close a scheduler that never runs. Both
resolve to the same Core file. The unpublished `9e921ca0` package holds one
copy: the scheduler's lease warning and the stop's message check are in one
Core chunk, `index.mjs` imports that chunk once, and a quit during a run left
the row interrupted 18 ms after the quit. The
[#114 and #115 receipt](../../../docs/product/multi-project/receipts/114-automation-quit-and-status.md)
records the check.

Upstream could take the stop as it is, because nothing changes until a host
calls it. Remove this part of the patch when an upstream release offers a stop
with the same order and fallback that passes the same test.

## Credential redaction

Issue #97 adds a text redaction hook. The owner asked on 2026-09-26 that
credentials never appear in anything Vivary shows, stores, or sends to a model,
even when an agent, a tool, or a provider error prints one. No existing Core
hook can change a tool result or a run event, so the patch adds one.

`dist/audit/redact.js` exports `setTextRedactor`, `redactText`,
`redactTextInValue`, and `textRedactionHoldback`, and the `./audit` entry
re-exports them. A host registers one function that takes text and returns
text, and can pass `holdback`, a function that returns how many trailing
characters a streamed delta keeps back. `redactText` applies the redactor, and
returns text unchanged when none is registered. `redactTextInValue` applies it
to every string in a plain object or array, and returns the same value when
nothing changed. If the redactor throws or returns something other than text,
the text is withheld as `[text withheld because redaction failed]`. Vivary's
`server/plugins/00-credential-redaction.ts` registers `redactCredentials` from
`server/credential-redaction.ts`, with a holdback that covers its longest held
form plus 256 characters, at most 16,384.

Core calls the hook in these places:

- `agent/production-agent.js` redacts a whole tool result before truncation, so
  the model, the `tool_done` event, the loop journal, and the read cache get one
  redacted string and a credential that crosses the limit is found whole. Every
  tool error result passes through `finalizeToolErrorResult`, which now redacts
  after `sanitizeToolErrorText`. Warnings appended to a result are redacted too.
  `structuredHistoryToEngineMessages` and the plain `history` fallback redact the
  earlier turns the browser sends back, so a credential typed in an earlier
  message reaches the model as its placeholder.
- `agent/run-store.js` redacts a recovered tool result in `writeLedgerEntry`
  before it is stored, and again in `readLedgerEntry`, so a row stored before
  this change is not replayed raw.
- `agent/run-manager.js` redacts every run event in `emitRunEvent`, before it is
  kept in memory, sent to subscribers, or inserted into `agent_run_events`. That
  covers tool starts and results, provider errors, and the terminal event, which
  `send` also redacts when it stashes it. A `text`, `thinking`, or
  `tool_input_delta` delta keeps back its last word, and the word before it when
  only spaces or tabs separate them, up to the host's holdback. Text and thinking
  share one slot, flushed before any other event. Each tool call's input has its
  own slot, flushed before any event that is not a delta, so input streamed for
  two calls at once stays whole. Everything held goes out when the run ends and
  when it is aborted. The last word or two appears a moment later while text
  streams. The joined text is unchanged apart from redaction.
- `server/credential-provider.js` redacts the provider error message it saves
  after a 401.
- `chat-threads/store.js` redacts `thread_data`, the title, and the preview in
  `updateThreadData`, a catch-all for browser saves and automation runs, and in
  the row `forkThread` inserts, because the source row can predate redaction and
  a snapshot comes from the browser. It redacts each string of the parsed
  repository and keeps the stored text as sent when nothing matched.
- `jobs/run-history.js` redacts the error of a finished automation run, and
  `jobs/scheduler.js` redacts the last error it stores in the automation's file.
- `cli/code-agent-runs.js` redacts a Code transcript event's message and
  metadata before `appendCodeAgentTranscriptEvent` writes it, and the title,
  subtitle, details, progress, and metadata of a run record before it is
  created or updated. The Vivary server and the coding worker each register a
  redactor. The worker's is built from salted fingerprints the host sends with
  the start request, so the host never sends the worker the values.
- `secrets/storage.js` exports `onAppSecretsChanged`. `writeAppSecret` and
  `deleteAppSecret` call its listeners after the write, and Vivary reloads its
  held set from them.

Run `pnpm test:credential-redaction`. CI runs it once, in the maintained
Workbench checks on Linux. The Windows CI job runs no Node tests, so a
platform-neutral test file is covered on Windows only when run there. It runs
`tests/credential-redaction.test.ts`, `tests/native-redaction.test.ts`,
`tests/code-run-redaction.test.ts`, and `tests/code-run-worker.test.ts` one
file at a time with random synthetic values and disposable SQLite databases.
The Native test registers Vivary's redactor and drives the agent loop with a
fake engine whose tools return a held value from an action, from an MCP-shaped
result, from a thrown error, and across the 50,000-character result limit. It
runs `startRun` with text, thinking, and tool-input deltas that split held
values, including one of 403 characters, with a thrown provider error, and with
an abort. It also checks the ledger, the saved provider failure, saved and
forked threads, earlier turns, an automation run error, and an automation's
last error. `tests/code-run-worker.test.ts` forks the real coding worker source
through tsx with a stub Claude CLI that reads a project file holding a held
value and a `ghp_` token, and checks the start request, the transcript file,
every file under the code-runs folder, the Code state, and the follow-up prompt.
It loads Core's server modules, which take several seconds, so it runs only in
this sequential suite.

Upstream could take the hook as it is, because nothing changes until a host
registers a redactor. Remove this part of the patch only when an upstream
release offers the same call sites and passes the same tests.

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

## Errors thrown after a request body is read

Issue #142. Core mounts framework routes, the Native chat POST among them,
through `getH3App(...).use`. Its wrapper in `server/framework-request-handler.js`
catches a handler's error and first asks `isClientAbortError` whether the
client left. That check counted any destroyed request stream as a client
abort. Node destroys a request stream once its body has been read to the end,
so every error a POST handler threw after reading its body was dropped as an
abort. h3 then answered 404 "Cannot find any route matching", and Core's chat
client posted the same turn nine times. The Native chat send guard's refusals
(#91) never reached the browser.

The patch changes that file in two places:

- `isClientAbortError` counts a destroyed request only when its body did not
  complete, and a destroyed response as before. A client that leaves after
  sending its body still destroys the response, so it is still an abort and is
  not logged as a server error.
- The JSON error response keeps the fields of an h3 error's `body`, as h3's own
  error response does, beside `error`. The guard's `errorCode` and
  `retryable: false` reach the chat client, which then shows the refusal once
  and does not send it again. A `stack` in that body is left out, so a stack
  still appears only when `AGENT_NATIVE_DEBUG_ERRORS=1`.

Run the focused checks with:

```sh
pnpm --dir packages/workbench exec tsx --test tests/native-chat-route-errors.test.ts tests/native-chat-project.test.ts
```

`native-chat-route-errors.test.ts` serves a route mounted through Core's
wrapper over a Node HTTP server and reads the body before the handler throws,
as Core's chat handler does. It is part of `test:native-chat`.

Every framework route mounted this way changes the same way. An
unauthenticated POST to a Native action throws its owner error after reading
the body, so it used to answer 404 and now answers 401.
`registry-http.test.mjs` pinned the old 404 with a comment naming this defect,
and now expects 401. The request is refused either way.

## Sidebar row menus from the keyboard

Issue #131. The Toolkit's chat history rows open a Radix dropdown menu from
their "Chat options" button. Its Rename, Pin, and Delete entries, and Vivary's
Archive, were plain buttons with `role="menuitem"` inside the menu content.
Radix moves focus, answers the arrow keys and typeahead, and handles Enter and
Space only for registered `DropdownMenu.Item` entries, so a keyboard user who
opened the menu could reach none of them.

The Toolkit patch changes `dist/chat-history/ChatHistoryList.js` and its types:

- A new `ChatHistoryMenuItem` wraps `DropdownMenu.Item` around the same button
  and classes, so the entry looks the same and Radix's keyboard navigation
  reaches it. `onSelect` runs on click, Enter, or Space.
- Rename, Pin, and Delete use it. `chat-history` exports it, and the
  `renderAdditionalRowActions` note says to render app entries with it.

Vivary's Archive entry in `ProjectHistory.tsx` is a `ChatHistoryMenuItem`.
Archive removes its row and the menu trigger that focus would return to. After
a confirmed archive, once the row is gone, focus moves to the row that took its
place, else the row before it, else New conversation (`app/lib/row-focus.ts`).
A failed archive asks for no move, and focus in a text field stays.

`native-chat-components.test.mjs` opens a row menu from the keyboard and checks
that every entry is a Radix item, and `row-focus.test.mjs` covers the focus
choice. A browser run of the built app walked the menu with the arrow keys and
typeahead, renamed with Enter, and archived, with focus landing on the next
row, the previous row, and New conversation, at 1280 and 390 px.
