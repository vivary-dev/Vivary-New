# Vivary Workbench

Vivary is a local desktop product. The working GUI currently runs in a browser;
desktop packaging is the next delivery increment under
[outcome 23](../../docs/product/multi-project/tickets/23-package-and-prove-app.md).
Zo is the current development and preview host, not a product dependency.

Work stays on `feat/vivary-gui` until Jeff uses the product and approves promotion.
The [program frontier](../../docs/product/multi-project/index.md) owns remaining work.

## Run locally from source

Build with the pinned dependencies, then start the application:

```console
pnpm --dir packages/workbench build
pnpm --dir packages/workbench start
```

Open the URL printed by the launcher. Local mode requires no Vivary login,
signup, Zo account, paid auth service, or remote database. The server listens
only on the numeric loopback address. A Native session is created internally so
actions and saved runs retain their existing identity boundary.

The default data directory is `~/.vivary/workbench`. It contains the local
SQLite database, saved runs, workspace files, and a generated private session
secret. The launcher preserves that secret across restarts. Keep this directory
out of source control.

```console
node packages/workbench/bin/start.mjs --port 5173 --data-dir /path/to/data
node packages/workbench/bin/start.mjs --workspace /path/to/workspace
```

The application uses the user's existing Claude Code installation and CLI login
on the same computer. Model access is separate from opening Vivary. The current
source launcher still requires Node 22.22.0 or newer and the built dependencies;
it is not yet a standalone desktop installer.

## Working agent surface

The `/agent` route uses Agent-Native's Claude Code executor and conversation
renderer. It supports messages, bounded follow-ups, Sonnet/Opus/Fable selection,
real tool events, Stop, saved run history, and a workspace file inspector.
The installed driver provides Read, Glob, Grep, Edit, and Write. Each invocation
is a fresh CLI process with bounded prior user and assistant context.

On Zo on 2026-09-12, the real production app passed Sonnet file creation/readback,
a Fable follow-up on that file, Opus cancellation after a tool result, and both
idle and active-run restart checks. Native records and file bytes persisted.
The private handoff preserves those results and earlier failed checks.

Runs are limited to two minutes. The inspector lists Markdown, text, and JSON
files up to 64 KiB. Shell execution, selected-project agent work, the multi-agent
factory workflow, and the full installed-platform matrix remain unfinished.
The current GUI has one local owner.

## Development preview

The optional `bin/serve-preview.sh` launcher serves the same app through the
existing private Zo proxy. It requires `PORT`, a persistent `VIVARY_DATA_DIR`,
the exact external HTTPS `APP_URL`, and
`VIVARY_TRUSTED_PROXY=zo-owner-only`. Keep that service private. This mode also
opens without a Vivary login or signup; Zo's existing access boundary applies
only to that development preview.

Run one supervised production Node process with process-group termination.
Shutdown stops active runs; startup reconciles interrupted records before
accepting another message. SQLite and workspace files stay in persistent local
storage. The supported configuration declares that a remote database is not
required. Multi-instance deployment and project-root recovery are unfinished.

## Existing project services

The preserved Workbench implementation is included beside the agent surface.
Normal startup mounts its registry, catalog, readiness, and activity services
through `server/plugins/01-project-services.mjs`.

A server-owned `VIVARY_PROJECT_INSTALLATION_FILE` configures the Python executable,
Core stdio provider, allowed location references, and an existing Native
organization grant. Browser requests supply location references, never executable
paths or installation authority. Missing configuration returns an unavailable
state. This setup is not yet connected to the agent's workspace selection.

Reuse Core, Tropo, Strato, Ozone, Exo, and create-vivary when connecting the GUI.
Agent-Native retains session, transcript, action, and connection ownership.
Paperclip is not a required dependency merely because its former service slot
was reused for development.

## Source and checks

`source-provenance.json` records the historical Littleagent shell capture.
Later changes are recorded in Git. Private history and evidence remain separate
from public publication review.

From this package directory:

```console
pnpm typecheck
node --test tests/local-code-agent.test.ts tests/code-host-lifecycle.test.ts
node --test tests/local-access.test.ts tests/startup.test.mjs
pnpm test:project-services
pnpm build
pnpm doctor
```

The retained `/workbench` and `/chat` routes are unfinished project integration
surfaces. Navigation exposes the working agent route.
