# 09b: Expose original project read tools in Native
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/19
Parent: 09
Status: in-progress
Depends-on: [09a, 23a]
Owner: Root-assigned original-command and Native action integrator
Scope: Expose find, check, doctor, and capabilities through the bundled original packages.
Verification-kind: runtime
Timebox: One shared read-tool increment with app, agent, and installed checks.

## Goal

Let the application and its agent retrieve project context and inspect workspace
health through the same deterministic actions and original Vivary operations.

## Context

Read [the desktop release plan](../desktop-release.md), [ENGINEERING.md](../../../../ENGINEERING.md),
and [Native ownership](../native-owners.md). The original command router remains
`packages/vivary/vivary_cli.py`. GUI integration does not change command meanings.
Native owns tool discovery and execution. These actions make no model calls.

## Owned files

- `packages/vivary/vivary_cli.py` only for a demonstrated shared-output gap.
- `packages/tropo/tropo.py` and `packages/create-vivary/create_vivary.py` retain their operations.
- New deterministic actions in `packages/workbench/actions/` and their small server adapter.
- Existing `packages/workbench/server/project-services.mjs` for authorized root resolution.
- Focused original-command/action tests and the relevant existing GUI presentation.

## Done condition

Expose find, check, doctor, and capabilities with bounded typed inputs and results.
Resolve the selected project server-side. Caller-supplied paths cannot grant access.
Invoke the bundled original package closure from 23a without a global installation,
network requirement, or GUI-only implementation. Use the original structured output.

The GUI and agent consume the same action result, including findings, source paths,
limits, unsupported capabilities, and meaningful command failures. Context remains
project-scoped and excludes private sources. Source links resolve within that grant.
Check and Doctor findings are observations, not permission to repair or execute work.
Read sanitized execution receipts through the original logs helper using the
application's configured private receipt location. Do not turn arbitrary log
paths or provider credentials into project-search inputs.
An unavailable package or root is a clear error rather than an empty success.

## Verify

Compare action results with the equivalent installed original commands on one
coding and one notes project. Exercise the GUI and registered Native tool surface.
Check two-project isolation, revoked access, malformed inputs, bounded output, and
unchanged authored files. Do not require a model call to prove deterministic tools.

```console
python -B -m pytest packages/vivary/tests/test_vivary_cli.py packages/tropo/tests/test_tropo.py -q
pnpm --dir packages/workbench typecheck
git diff --check
```

## Current implementation

`server/project-read.ts` is the one read module. The Details panel calls it through
`vivary-project-read-owner` with a project ID, and the Native agent calls it through
`vivary-project-read`, whose project comes from the chat's pinned scope. Access
refusals throw. Whether the original command produced a report is part of the value.
Doctor runs `vivary doctor --public`, which checks the workspace without
reading notes. Find and check run `vivary find|check --public`, which reaches
Tropo's privacy-filtered facade. The original runner schedules reads in parallel and runs a
write alone within its project. Callers wait instead of seeing a busy error, and a
command that cannot start within 30 seconds returns a retryable message.

## Stop conditions

Do not enable Doctor repair, install optional providers, add a search database,
accept arbitrary shell arguments, or create a second CLI or executor.

## Log

- 2026-09-13: Drafted for the desktop release. The Native actions are not implemented.

- 2026-09-24: Claimed on `feat/project-read-tools` from merged `dev` `0c8c7eb`.
  Dependencies #18 and #7 are closed.

## Shared desktop and web behavior

Expose the same deterministic read actions through desktop and mobile-friendly web sessions. File and context results remain scoped to the selected host and project.
