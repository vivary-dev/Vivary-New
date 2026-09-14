# Vivary Workbench

Vivary's local desktop opens without a Vivary account, signup, Zo account, or
remote database. The app uses the pinned Agent-Native shell,
conversation components, settings, actions, provider storage, and run records.

Follow the root [contributor workflow](../../CONTRIBUTING.md) for branches,
review, and integration in private Vivary-New. Live
[GitHub issues](https://github.com/vivary-dev/Vivary-New/milestone/1) own task scope,
acceptance, dependencies, and status, including the planned self-hosted browser
experience. The [program frontier](../../docs/product/multi-project/index.md)
provides synchronized implementation and evidence references.
A working agent conversation does not complete the factory workflow or the
installed-platform matrix.

## Run from source

Build with the pinned dependencies, then start the application:

```console
pnpm --dir packages/workbench build
pnpm --dir packages/workbench start
```

Open the URL printed by the launcher. The server listens on numeric loopback.
Native creates an internal local owner so actions and saved records retain
their existing identity boundary.

The default data directory is `~/.vivary/workbench`. It contains the SQLite
database, saved runs, personal workspace, and generated private session secret.
Keep this directory out of source control and preserve its secret on restart.

```console
node packages/workbench/bin/start.mjs --port 5173 --data-dir /path/to/data
node packages/workbench/bin/start.mjs --workspace /path/to/workspace
```

Source startup requires Node 22.22.0 or newer and built dependencies. The
[private desktop package](../desktop/README.md) bundles its own Node runtime.

## Settings and models

Settings provides Native appearance, provider keys, integrations, resources,
and model controls. Appearance is saved through Native application state.
If an appearance save fails, Settings keeps the visible choice and provides
Retry. Theme and palette retries remain independent when both saves fail.
Saved appearance loads once when the app opens, so changing the theme cannot
restore an older saved value over an unsaved choice.
Coding runtimes shows installed CLI account status and links to official
installation and sign-in instructions.

Agent uses the user's local Claude Code or Codex installation and account.
Full chat uses Native's configured model providers. Model access is separate
from opening Vivary; changing providers does not require a Vivary login.

Claude Code supplies Read, Glob, Grep, Edit, and Write. Codex uses its own
workspace-write permission policy and can run commands. Runtime permissions
belong to the installed CLI; choosing a project is not an operating-system
sandbox.

[DeepSeek Flash titles for both chat surfaces](../../docs/product/multi-project/tickets/05-integrate-workbench-shell.md#planned-chat-titles)
are planned. The existing Full chat adapter remains; this increment does not
extend it to coding conversations.

## Projects and conversations

The desktop's Open folder action uses the system directory chooser. The server
connects that folder through the existing Native-backed project registry.
New project previews the original creator's five guidance files before creating
a separate folder under the app data directory's `projects` folder. It then
registers and selects that project. Cancel writes nothing. Existing files and
unavailable folder grants are preserved. Browser startup can also connect its
initial folder with `--workspace`.

Selecting a project selects its working directory, Code history, and file
inspector. Personal workspace opens the app's default folder. Native owns the
actual runs and transcripts. The app supports a rich composer, model choice,
tool output, follow-ups, visible history, and Stop. The active-run control stays
available in Settings and when a project folder becomes unavailable.

Project selection and conversation pointers use Native application state.
Personal workspace is stored as the scoped value
`{ scopeKey, projectId: null }`. The reader still accepts a missing value or
the older `null` value as Personal workspace.
If a selection save fails, the page keeps the requested project visible and
shows Retry. Retry rechecks project availability and owner scope before saving.
The choice remains unsaved until that write succeeds.

State writes reuse Native's public in-memory session. A Native session may omit
its token. In that case, the app uses Native's standard cookie-backed state
writer. When Native supplies a token, the client sends it only on an exact
same-origin application-state PUT or a named project/agent action POST. The
preview bridge accepts that header
only after its existing request and owner checks pass. A rejected token is not
replayed while Native refreshes the session. Rejected tokens stay only in page memory so every action and state control
blocks stale retries. Tokens are never written to disk, browser storage, or logs.
Native's composer keeps unsent text in browser storage, so drafts survive
project switching and navigation. A desktop restart that changes the loopback
port does not yet restore those unsent text drafts. Completed transcripts
remain in Native's persistent run store.

Local folder grants persist in server-only Native settings. Startup reopens
and rechecks the canonical path, device, inode, and creation time. Filesystems
that omit creation time retain its zero value. Exact saved stamps still apply.
Detected missing or replaced folders remain unavailable without deleting records.
Without creation times, inode reuse during downtime can hide a replacement.
This mode supplies ordinary local access. Content snapshots, VCS custody, and
strict mutation evidence belong to the existing Core providers.

Each Code message first becomes a pending request in Native's run store.
The approval card shows the exact instruction, project, runtime, and two-minute
limit. Approve background work starts that turn on the host, where it can
continue after navigation or browser closure. Deny starts no model or tools.
Every follow-up needs a new decision. Denied instructions do not enter later
agent context.

The global control shows pending requests, running work, and the latest outcome.
Open conversation returns to the same run and transcript. Deny and Stop remain
available if its folder becomes unavailable. Host restart preserves pending
requests and history, marks interrupted execution honestly, and never starts
work automatically.

Each Code invocation uses a separate ordinary Node worker around Native's
executor. A two-minute work deadline requests cancellation, followed by forced
cleanup of the owned worker processes. Unverified cleanup blocks further
admission, including after restart. Native CLI permission and containment
capabilities still apply to its tools.

The current inspector displays Markdown, text, and JSON files up to 64 KiB.
A complete editor, recovery for relocated folders, factory orchestration, and
the full installed-platform matrix remain unfinished.

## Development preview

Zo is the current implementation and private preview host. It is not a product
dependency. The optional `bin/serve-preview.sh` launcher serves the same app
through the existing private Zo proxy and requires `PORT`,
`VIVARY_DATA_DIR`, the exact external HTTPS `APP_URL`, and
`VIVARY_TRUSTED_PROXY=zo-owner-only`. Keep that service private.

For a session-cookie investigation, set `VIVARY_SESSION_DIAGNOSTICS=1` in the
server environment. The default is off. Each checked request logs only Cookie
header presence, expected cookie-name presence, and the candidate token count.
The count includes candidate cookies and an eligible private-preview header.
It does not count authenticated owners or establish owner authentication.
Raw cookies and tokens are never logged. Disable the flag when the
investigation ends.

Use one supervised Node process. Terminal shutdown awaits Code cleanup and Native
close hooks before exiting. Shutdown stops active runs; startup marks
interrupted Native records before accepting another message. SQLite and files
stay in local persistent storage. Multi-instance deployment is unsupported.

Codex 0.153.4 cannot start its default restricted-network sandbox on the current
Zo host. A bounded diagnostic confirmed that its network-enabled profile retains
filesystem and PID containment, but Native 0.176.5 exposes no per-run profile
override. No global CLI configuration or sandbox bypass was applied.
This is a development-host compatibility gap, not a requirement to run Vivary
on Zo.

## Source and checks

`source-provenance.json` records the historical Littleagent shell capture.
Git records later changes. Private history, local evidence, and public delivery
remain separate.

Use the existing relevant checks:

```console
pnpm typecheck
pnpm test:project-services
node --test tests/local-root-provider.test.mjs tests/local-registry-model.test.mjs
node node_modules/tsx/dist/cli.mjs --test tests/local-code-agent.test.ts tests/local-runtime-setup.test.ts tests/code-execution-host.test.ts
pnpm build
pnpm run doctor
```

Exercise changed flows through normal startup. The private handoff preserves
actual browser and desktop results, including failed attempts. These checks do
not establish completion of the remaining roadmap or Windows/macOS runtime
acceptance.
