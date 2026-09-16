# Maintained Native chat patch

Jeff approved this dependency patch on September 15, 2026, for
[project conversations, issue #6](https://github.com/vivary-dev/Vivary-New/issues/6).
This approval supersedes the earlier restriction against patching Core for these
two defects. Native still owns conversations, storage, requests, and execution.

`pnpm-workspace.yaml` applies `@agent-native__core@0.176.5.patch` to the pinned
Core package. The lockfile records the patch hash. Install with
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

Run the maintained transport, transcript, approval, and discovery tests:

```sh
pnpm --dir packages/workbench exec tsx --test tests/codex-executor.test.mjs tests/codex-app-server.test.ts tests/codex-transcript.test.mjs tests/codex-active-state.test.mjs tests/codex-approval.test.ts tests/codex-models.test.ts tests/local-runtime-setup.test.ts
```

The optional `VIVARY_CODEX_POLICY_PROBE` test setting points to an installed Codex
executable. It checks effective permission rendering without starting a model turn.
Successful rendering does not establish operating-system sandbox execution. See the
[Workbench integration record](../README.md) for actual hosted and Windows proof.
