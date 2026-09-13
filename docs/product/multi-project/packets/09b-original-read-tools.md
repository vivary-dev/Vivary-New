# 09b: Expose original project read tools in Native
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/19
Parent: 09
Status: needs-info
Depends-on: [09a, 23a]
Owner: Root-assigned original-command and Native action integrator
Scope: Expose find, check, doctor, and capabilities through the bundled original packages.
Verification-kind: runtime
Needs: Accept 09a behavior and 23a package closure. Select bounded structured inputs and outputs.
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

## Stop conditions

Do not enable Doctor repair, install optional providers, add a search database,
accept arbitrary shell arguments, or create a second CLI or executor.

## Log

- 2026-09-13: Drafted for the desktop release. The Native actions are not implemented.
