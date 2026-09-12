# Vivary Workbench

This private application adds a GUI to the existing Vivary packages. Work stays
on `feat/vivary-gui` until Jeff uses the product and approves promotion.
The [program frontier](../../docs/product/multi-project/index.md) owns remaining
work. Passing checks for one feature do not establish a finished product.

## Current agent preview

The `/agent` route uses Agent-Native's Claude Code executor and conversation
renderer. It supports messages, bounded conversation follow-ups, Sonnet/Opus/Fable
selection, real tool events, Stop, saved run history, and a workspace file inspector.
The installed driver provides Read, Glob, Grep, Edit, and Write. Each invocation
is a fresh CLI process with bounded prior user and assistant context.

On Zo on 2026-09-12, the actual application passed:

- Sonnet read the README, wrote a file, read it back, and displayed it in the GUI.
- Fable continued the same conversation and changed the same file.
- Opus produced a file-tool result; Stop settled its run to paused.
- An idle service restart retained the Native session, run history, and file bytes.
- Restart during a real file-tool run stopped it and retained a paused transcript.
- Anonymous action access returned 401. The external service required Zo owner login.

The checks used the existing CLI subscription, normal Native authentication, and
the supervised production build. They did not use synthetic tool responses.
Typechecking, the four focused agent/lifecycle tests, the build, and Native Doctor
passed. The private handoff retains the browser results and earlier failed checks.

Runs are limited to two minutes. The inspector lists Markdown, text, and JSON
files up to 64 KiB. Shell execution, selected-project agent work, the multi-agent
factory workflow, and multi-user workspace isolation are unfinished.
The current GUI is a single-owner preview.

## Run the private hosted preview

Build with the pinned dependencies, then run `bin/serve-preview.sh` with `PORT`
and a private `VIVARY_DATA_DIR`. That directory must contain `auth-secret`,
`auth.sqlite`, `code-runs/`, and `workspace/`. Keep runtime data and secrets out
of Git. The auth secret is generated once and readable only by the service owner.

Run one supervised production Node process with process-group termination.
Shutdown stops active runs. Startup reconciles interrupted records before
accepting another message. Do not use a development server or cluster for this
hosted preview.

The present hosted setup combines Zo owner-only access with Native sign-in.
Email verification is skipped for the private preview. Do not expose this setup
publicly: all code and file actions currently share one owner's workspace.

SQLite and workspace files live in persistent Zo storage. Native still displays
its production-local-database warning. Multi-instance storage and project-root
recovery remain unfinished; the single-process restart check does not accept them.

The installable local application must open without signup or a Vivary account.
Hosted access and coding-provider sign-in have separate responsibilities.
Use the user's existing runtime subscriptions; do not require a paid auth
service or a separate model API key for the CLI path. Local setup and hosted
sign-in usability are the next access increment.

## Existing project services

The preserved Workbench implementation is included beside the new preview.
Normal startup can mount its registry, catalog, readiness, and activity services
through `server/plugins/01-project-services.mjs`.

A server-owned `VIVARY_PROJECT_INSTALLATION_FILE` configures the Python executable,
Core stdio provider, allowed location references, and an existing Native
organization grant. Browser requests supply location references, never executable
paths or installation authority. Missing configuration returns an unavailable
state. The project service does not grant model or write authority by itself.

The preserved private source at commit `1d1018c` records the original configuration
example and accepted project-registration checks. This hosted preview does not
yet connect that project selection to the agent. Root recovery must use Core's
custody contracts before a saved project can regain access after restart.

Reuse the existing Core, Tropo, Strato, Ozone, Exo, and create-vivary implementations
when connecting the GUI. Agent-Native retains session, transcript, action, and
connection ownership. Check any existing Paperclip integration before replacing
it; Paperclip is not a new required dependency merely because its old service slot
was reused.

## Source and checks

`source-provenance.json` records the historical Littleagent shell capture.
Later changes are recorded in Git. The private source checkpoint preserves the
original implementation and evidence; public publication review remains separate.

Use Node 22.22.0 or newer and the pinned package dependencies:

```console
pnpm typecheck
node --test tests/local-code-agent.test.ts tests/code-host-lifecycle.test.ts
pnpm test:project-services
pnpm build
pnpm doctor
```

The retained `/workbench` and `/chat` routes are unfinished project integration
surfaces. The preview navigation exposes the working agent route.
