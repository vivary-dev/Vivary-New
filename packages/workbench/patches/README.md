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
also have an unsent draft.

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
packaged desktop close journey remains an acceptance requirement under #9.

Run the focused state and ownership checks with:

```sh
pnpm --dir packages/workbench test:chat-draft
```

These checks are included in `test:maintained`. Real application restart and
packaged desktop acceptance remain separate requirements under issue #9.
