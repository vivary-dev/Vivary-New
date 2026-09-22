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
pnpm --dir packages/workbench install --frozen-lockfile
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
and local coding-runtime readiness. Appearance is saved through Native application state.
If an appearance save fails, Settings keeps the visible choice and provides
Retry. Theme and palette retries remain independent when both saves fail.
Saved appearance loads once when the app opens, so changing the theme cannot
restore an older saved value over an unsaved choice.
Coding runtimes shows installed CLI account status and links to official
installation and sign-in instructions.

Code conversations use local CLI accounts. Native conversations use Native's
configured providers. Model access is separate from opening Vivary.

For a new Code conversation, choose **Claude Code** or **Codex** from **Runtime**.
The choice survives reload. Runtime setup remains available when the selected
CLI is not ready. Sending a message starts the turn. After the conversation
starts, its runtime stays fixed. Start a new conversation to use another runtime.
Codex model discovery is implemented. Linked history and broader cross-runtime
integration remain separate issue #38 work.

The Code composer keeps runtime/model identity visible and hides Native's cloud
provider picker. Codex reports its available models through its app-server API.
Choose one before starting. Vivary records that model with the conversation.
Older conversations retain their recorded model, including an unknown historical
CLI default. A saved draft with an unavailable model switches to Codex's reported
default before it can start.

The Codex integration requires ChatGPT subscription authentication and the built-in
OpenAI provider. API-key fallback and custom providers are not enabled. Vivary
uses the same resolved executable for readiness and execution, including Windows
npm installations. Credentials stay in Codex's existing store.

Codex loads its own configuration, skills, and configured connections. Vivary does
not inject Native's separate MCP catalog. The settings page lists connection names,
not credentials or a claim that each connection is reachable. Connection tools can
operate outside the shell's filesystem sandbox and retain their own access rules.

Codex uses its native app-server protocol for execution and approval requests.
Choose **Normal**, **Read only**, or **YOLO** in Runtime settings. Normal allows
project work and asks about actions requiring broader access. Read only prevents
local file edits and permission expansion. YOLO gives commands full host access
without approval prompts. Connected services retain their own access settings.
There is no Plan mode. A settings change applies to the next turn; active work
keeps the permissions recorded when it started. Global Codex configuration is
unchanged.

Approval cards show the requested command, file changes, access, or questions.
The response goes back to the live Codex request. Vivary does not execute the
approved command itself. Allow once and Decline apply to that request. Additional
permission grants last for the current turn. Persistent command rules and session
approval shortcuts are not exposed by this adapter.

Commentary appears in smaller Progress cards. Actual native subagent events have
separate Subagent activity cards with their recorded identities and statuses.
Final answers retain the main text style. Reopening history uses the same event
classification; consecutive assistant messages alone never imply subagents.

A new Codex run records its native session ID. Follow-ups resume that exact session.
Historical Vivary runs without an ID use the existing bounded-history prompt once,
then record the native session for subsequent turns. Runtime and model changes
require a new conversation. Linked conversations remain separate issue #38 work.

The published `26798df` Windows preview does not include these source changes.
The `2f4a5df` Windows EXE verified subscription file work, native-session continuity,
a configured MCP call, one actual subagent and its public result, and a command
completing after 125.19 seconds. Native Allow/Decline, Read only read/write controls,
YOLO fixture access, cross-project cancellation of a running command, mode
persistence, and shutdown also passed. Normal was restored after mode testing.

Final candidate `98515c9` corrects overlapping tool identity and pending-approval
presentation. Its production build, 75 focused tests, and type checking passed.
The 12 unchanged Native regressions passed separately. The simulated hosted protocol test and actual Windows retest held and reloaded
native approval without a false stopped warning. The Windows test then approved
a real file write and received its final answer. Saved output
remained inspectable. The final EXE preserved its answer and model after restart.
Shutdown left no candidate processes. Superseded local packages were removed.

These are bounded Codex prototype results across recorded candidates. The final
EXE retest does not repeat every earlier journey. The private preview serves the
final output with authentication preserved. PR #59 merged into `dev` on September 16,
2026 as `b81dcd7`. The exact reviewed head `f21328b` passed all 62 applicable Zo CI
steps, including Linux tests, orientation, graph review, and site checks. GitHub
Actions did not run because of billing; Windows CI jobs were not part of the Zo run.
The acceptance register owns candidate details and remaining release gates.

OpenCode Go credentials and a real read-only OpenCode CLI turn were checked
separately. OpenCode is not exposed by this Vivary selector. These CLI checks do
not establish Native provider access. Issue #38 retains runtime/model integration,
and issue #50 retains real Native-provider acceptance.

Claude Code supplies Read, Glob, Grep, Edit, and Write. Codex supplies its command,
file, and connection tools. Vivary sets this integration's approval and sandbox
bounds; Codex enforces the selected shell sandbox except in YOLO mode. Choosing a project alone is not an
operating-system sandbox.

[DeepSeek Flash titles for both chat surfaces](../../docs/product/multi-project/tickets/05-integrate-workbench-shell.md#planned-chat-titles)
are planned. The existing Full chat adapter remains; this increment does not
extend it to coding conversations.

## Projects and conversations

The desktop's Open folder action uses the system directory chooser. The server
connects that folder through the existing Native-backed project registry.
Folder selection expires after two minutes. The app identifies an expired
selection and asks you to close the chooser before trying again. A selection
returned after the chooser expires does not register a project.
New project previews the original creator's five guidance files before creating
a separate folder under the app data directory's `projects` folder. It then
registers and selects that project. Cancel writes nothing. Existing files and
unavailable folder grants are preserved. Browser startup can also connect its
initial folder with `--workspace`.

The canonical `/` workspace keeps the selected conversation in the center.
Project details, files, and page preview open only when requested. Panels can
resize, close, reopen, and expand for focused work. The old Agent, Files,
Workbench, and Full chat URLs redirect to this workspace.

Page preview shows its owning project and host. **Review command** discovers
installed launchers for the project's `dev`, `start`, and `preview` package scripts.
It shows the command, script, folder, and address before **Approve and start**.
The Native owner action rechecks that review before execution. It refuses
scripts with pre/post hooks.

Starting never downloads a package manager. The process runs with the host account's file access and a limited
environment. It is not an operating-system sandbox.

**Stop preview command** targets only the process owned by that project and caller.
The app keeps ownership until shutdown, even when the folder connection changes.
On POSIX hosts, an unexpected launcher exit also stops its process group.
On Windows, cleanup after the launcher has already exited remains unsupported.
The app reports that failure without targeting a saved PID. Use commands that
remain in the foreground. Packaged Windows acceptance remains under issue #8.

A lost start response can check the same request without launching twice.
An explicit start refusal permits a fresh review. An uncertain response keeps
the same request. Restarting Vivary does not recover or kill a process from a saved PID.

Closing and reopening the panel preserves its page. Changing projects, host scope,
or folder binding unloads it. Returning can restore a still-owned running preview
after checking the project binding. A manually opened address stays selected while
the owned command's status changes. Failed manual navigation does not reopen the
previous page.

**Open running page** accepts an existing HTTP or HTTPS address without claiming
its process. Local process start and inspection use numeric `127.0.0.1` addresses.
You must confirm that the browser runs on the displayed host before embedding
a host-local page. Phone-to-host routing belongs to issue #30.

The live frame uses a separate, temporary credential store, sandbox restrictions,
and no referrer. Browsers without credentialless-frame support cannot embed it.
Project modules can execute in their own origin. Vivary rejects its own origin
as a preview and refuses framing through response headers, including redirects.
Preview pages do not receive personal browser cookies or privileged Node access.
The panel reports blocked embedding without opening your personal browser.

**Attach preview to chat** adds the selected project, host, and address to the
open Code conversation. It preserves your draft and sends nothing. Send your
request to ask the selected coding runtime to inspect the page, capture a
screenshot, and report console errors or failed requests through its supported
tools. Missing browser tools remain unavailable. Attachment alone grants no
installation, file-editing, or credential permission.

Each preview attachment belongs to its project, folder binding, and conversation.
Native chat excludes these attachments.

For a selected registered folder, **Details > Preview Vivary setup** shows exact
proposed guidance content, retained files, and conflicts. Select the workspace
type or use automatic detection, then expand each file to review its full content.
**Confirm and apply** authorizes only that saved review. **Cancel** discards the
review without changing project files. Changing the type requires another preview.
Refreshing rebuilds an unapproved preview from current files and options. A changed
folder binding invalidates an unapproved review. Approved requests remain preserved
and cannot execute through a different binding.

The Native owner action `vivary-project-adoption` stores the reviewed target,
project binding, policy revision, options, content hash, and original request ID
in private application settings. Apply revalidates project access and delegates
to the original creator's request-aware adoption. Folder selection and the content
hash alone do not grant write permission. The public `vivary-original-command`
action still accepts adoption previews only. Agent and tool callers cannot invoke
the setup action.

A lost response retains the original request across reload and restart.
**Retry approved request** checks the creator's completion record without repeating
completed writes. **Review recovery** shows the creator's proposed restoration
for incomplete writes and requires a separate confirmation. Possible completed
work cannot be rolled back. Do not delete recovery records to force another apply.
Successful setup retains the registered project ID and provides links to files
and chat.

If the folder lacks ignore rules for private recovery records, the first preview
shows only the proposed `.gitignore` change. **Confirm privacy preparation**
authorizes that exact change. Existing ignore text remains intact. No setup
files, recovery journal, or completion receipt are written by this step.
The saved request survives reload and restart. **Retry privacy preparation**
checks the reviewed result after a lost response without repeating the write.
If later external edits prevent reconciliation, the request stays pending. Restore
the reviewed folder and ignore state before retrying. Vivary does not discard an
approval whose write result remains uncertain. An interrupted append can leave
part of the proposed ignore text. Review the file and restore the reviewed state
before retrying. Preparation never replaces or truncates existing ignore text.

The approved ignore change remains if you cancel later setup or recover an
incomplete setup. **Review Vivary setup** creates a fresh review before any
other files can change. Setup still needs its own **Confirm and apply**.
Changed inputs require another preview. Existing runtime records, tracked runtime
paths, unsafe files, or conflicting ignore rules block privacy preparation.
Vivary does not remove existing files from Git tracking.

Retryable setup requires ignore protection for `.vivary/runtime/`, including
its temporary records. These records can contain original file contents. Git
ignore rules do not exclude them from ordinary folder backups or synchronization.
See the [creator contract](../create-vivary/README.md#retrying-an-approved-adoption-request).
The runtime's 256 KiB combined output limit rejects oversized previews in full.
Full [issue #14](https://github.com/vivary-dev/Vivary-New/issues/14) and
[issue #15](https://github.com/vivary-dev/Vivary-New/issues/15) acceptance remains
open. The new two-confirmation journey still requires packaged Windows testing.

Search opens beside Files and finds file names, literal text, or a regular
expression inside the selected project only. Results show the path, line,
column, and an excerpt; choosing one opens the file at that line. Each request
stops at explicit limits (50,000 entries, 2,000 files read, 200 matches, 20
per file, a 1.5 s budget, 200 ms per file for a regular expression) and says
which limit it hit; More results continues from where it stopped, and for a
tree that does not change between pages nothing is repeated or skipped.
Limits are soft deadlines checked between filesystem operations. Filename
mode lists names from directory entries and reads nothing. Content search
applies the file panel's skip list and secret rules, skips links it sees,
verifies a file's identity when opening it, and skips binary, oversized,
and overlong content. A superseded query is abandoned by the panel while the
server finishes its bounded page; a pattern that is too slow skips that file
and the status line says so. There is no index, shell, or bundled search
binary. Coding agents search
the same folder through their own tools: Claude Code's Grep and Glob run in
the project directory, and Codex uses its sandboxed shell there.

Selecting a project selects its working directory, Code history, and files.
Personal workspace opens the app's default folder. Native owns the actual runs
and transcripts. Project-bound Native history includes the maintained saved-head repair and history
controls. Deterministic-provider journeys do not replace an approved real Native-provider
turn. The runtime admits one active Code request at a time. Code supports tool output,
follow-ups, visible history, approvals, and Stop. Its current engine/model identity is
read-only; switching remains planned. The active-run control stays available in
Settings and when a project folder becomes unavailable.

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
The composer keeps unsent text in browser storage, so drafts survive project
switching and navigation. A file draft survived a packaged desktop restart with a
new loopback port in the tested Windows candidate. Completed Code transcripts remain
in Native's persistent run store. Broader Native per-thread draft acceptance remains
owned by the restart-continuity issue.

Local folder grants persist in server-only Native settings. Startup reopens
and rechecks the canonical path, device, inode, and creation time. Filesystems
that omit creation time retain its zero value. Exact saved stamps still apply.
Detected missing or replaced folders remain unavailable without deleting records.
Without creation times, inode reuse during downtime can hide a replacement.
This mode supplies ordinary local access. Content snapshots, VCS custody, and
strict mutation evidence belong to the existing Core providers.

Code work continues on the host after navigation or browser closure, until the
agent completes, fails, or the user selects Stop. There is no fixed turn deadline.
The global control shows running work and native requests, including when another
project is selected. Open conversation returns to the same run and transcript.
Decline and Stop remain available if its folder becomes unavailable.

Host restart marks unfinished work and former launch-approval records interrupted.
It never replays pending actions or old unsent instructions. Saved history remains
readable. Start a new turn explicitly to continue.

Each Code invocation uses a separate ordinary Node worker around Native's
executor. Stop interrupts the native turn before bounded process-tree cleanup.
Startup and cleanup still have time limits. Unverified cleanup blocks further
runs, including after restart.

Open **Files** to browse the project tree and select a file. Markdown opens as
formatted content. Text and source files open for reading. Choose **Edit** to
change text, **Save** to write it, or **Rename** to change its name. Saving checks
the disk version and preserves the draft when a conflict or failure needs recovery.
Binary or unsupported files and files beyond the bounded size limit are refused.
Viewing a file does not send its content to a model.

**Review connection** can recover one recorded managed-folder binding after an
explicit review. Cancel changes nothing. It does not relocate a folder or grant
an arbitrary path. External-folder relocation, full existing-folder setup, file
search, factory orchestration, and complete Windows release acceptance remain unfinished.

### Current acceptance and gaps

The [desktop acceptance register](../../docs/product/multi-project/desktop-acceptance-status.md)
distinguishes the tested private candidate from the complete release target. In
particular, real Native-provider access and turns remain under issue #50, and
automation execution/recovery remains under issue #51. The current settings surfaces
alone are not execution proof. Codex selection and file execution passed on the
locally tested candidate. Broader issue #38 integration, clean-profile setup, search,
memory, existing-folder adoption, and final self-hosted access remain open.

## Development preview

Zo is the implementation and private preview host. It is not a product
dependency. Before testing, identify the served source and any held PR composition.
Refresh it only at an authorized idle point, preserving its command, private access,
and data. A source merge alone does not update a running build. Recheck folder
availability after refresh. An unavailable project keeps history and offers reviewed
recovery. Never replace its grant silently to make a preview appear healthy. The optional `bin/serve-preview.sh` launcher serves the same app
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
Zo host. The maintained Native adapter supplies per-run configuration while keeping
restricted networking and workspace writes. No global CLI configuration change or
sandbox bypass was applied. File-tool proof comes from the Windows candidate;
Zo verified real context-only turns and native-session continuity.
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

The maintained regression checks (issue #22, packet 06h) run from this
directory under Node 22, the CI pin recorded in `.node-version`. The native
SQLite module is built for the Node major that ran `pnpm install`; a mismatch
fails fast with one sentence naming it.

```console
pnpm test:maintained
```

That runs the registry, project-services, shell, mutation, and chat-title
suites in sequence with disposable proof roots and a disposable database.
Set `VIVARY_REGISTRY_PROOF_ROOT`, `VIVARY_12H_PROOF_ROOT`,
`VIVARY_17A_PROOF_ROOT`, or `VIVARY_TEST_CORE_PACKAGE_JSON` to absolute paths
only when a task needs to own them. Core creates an empty `data/` directory
under the working directory, which is ignored here.

Exercise changed flows through normal startup. The private handoff preserves
actual browser and desktop results, including failed attempts. These checks do not
establish the complete desktop/web release journey or macOS runtime acceptance.
