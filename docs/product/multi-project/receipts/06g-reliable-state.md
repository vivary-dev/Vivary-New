# Reliable state verification

Evidence-record: 06g
Date: 2026-09-14

Implementation and review: [issue #5](https://github.com/vivary-dev/Vivary-New/issues/5)
and [PR #34](https://github.com/vivary-dev/Vivary-New/pull/34).
The PR checks own final-head CI status.

## Verified behavior

- The private hosted browser saved state through the existing Native session.
  Invalid tokens, missing Origin, cross-site requests, and use of the state
  header on an unrelated action route returned 401. Unauthenticated external
  ingress returned 403 after its owner-gate redirect.
- Hosted project and conversation selections restored from plain `/agent`.
  Personal and project workspaces restored separate conversation draft IDs.
  Theme and palette survived reload and an actual service restart.
- The original private preview was restored to its existing app data with
  diagnostics off. Personal selection saved and reloaded without warnings;
  appearance controls loaded without a saved-preference warning.
- The normal loopback app opened without a Vivary login. Project selection,
  its exact conversation pointer, theme, and palette survived a same-data
  server restart. Preferences also loaded in a fresh browser context.
- An injected project write failure retained the requested workspace. Retry
  saved it. Focused component checks also covered stale reads, Personal
  save/remount, missing or revoked projects, and changed owner scope.
- Independent injected theme and palette failures retained both visible
  choices. Retry wrote both successfully. The initial appearance read ran once
  per provider mount, so a theme change did not reload an older saved value.
- At 390 by 844 pixels, navigation, conversation, runtime settings, and workspace
  file controls were visible without horizontal overflow. Keyboard Enter opened
  navigation and Escape closed it and returned focus to the exact opening button.

## Checks and boundaries

The 23 server authentication tests and 9 client transport tests passed, along
with direct app/server TypeScript checks, the production build, plan checks,
workflow validation, and line-ending/diff checks. Independent source reviews
covered the owner boundary, latest selection, Personal serialization, appearance
retry, and the supported mobile focus callback.

Hosted project verification used the normal app with temporary app data. An
older Zo 9p folder grant had a changed filesystem identity and remained
unavailable. Its data and grant were preserved. The recovery case is recorded
under [GUI setup issue #15](https://github.com/vivary-dev/Vivary-New/issues/15#issuecomment-5658845980).

This verifies saved conversation pointers. Unsent message text remains in
Native's browser storage; further draft continuity belongs to
[issue #9](https://github.com/vivary-dev/Vivary-New/issues/9).
No model turn was submitted. Windows and Electron product acceptance remain
under [issue #8](https://github.com/vivary-dev/Vivary-New/issues/8).

One Native localization write returned 401 during a fresh local startup in the
focused keyboard run. It produced no page error or saved-state warning; the
project, conversation, and appearance checks passed. Localization behavior was
not changed by this repair.
