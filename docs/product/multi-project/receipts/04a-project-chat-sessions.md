# Project conversation verification

Evidence-record: 04a
Date: 2026-09-14

[Issue #6](https://github.com/vivary-dev/Vivary-New/issues/6) and
[PR #43](https://github.com/vivary-dev/Vivary-New/pull/43) own acceptance and delivery.
The repair and review follow-up pass the affected Native journeys. PR #43 records
the final Zo CI result and integration commit.

## Verified behavior

- The private hosted Code runtime completed a first request and a reopened follow-up
  in each of two projects and Personal workspace. All six turns returned their
  expected markers without file changes. Wrong-project conversation URLs were refused.
- Desktop and actual 390px navigation retained project identity and history.
- An isolated normal application with a local deterministic Builder responder
  created distinct Native scopes for two projects and Personal. Alpha and Personal
  reopened and continued with retained context. Legacy history remained under Unassigned.
- Cross-scope Native GET, PUT, and send requests returned 404 without reaching the
  responder. An unavailable project retained its authorized Native history. Its send
  requests were refused before provider execution.
- The Native request guard now uses the parsed request context. Reading the already
  consumed HTTP body had caused a real send hang.

## Original Native acceptance blockers, 2026-09-14

Beta's saved thread contains its assistant reply, but its `headId` points to the
preceding user message. Reopening therefore hides the reply. Independent source
analysis found unsequenced client snapshot saves and a server merge that accepts
an older incoming head while retaining both messages. Navigation as streamed text
appears can expose this ordering. The supported Builder stream reached completion.

The installed Core 0.176.5 also overwrites the host's `composerDisabled` value in
`MultiTabAssistantChat`. The unavailable-project composer accepted typing and a
send attempt, then remained Thinking while the server refused the request.

Both fixes belong in Native's existing owners. The public chat surface exposes no
snapshot-save override. Forcing a latest-message head in Vivary could corrupt
intentional branches. No dependency patch was authorized at this checkpoint. The later explicit approval below supersedes that restriction.
The official [0.179.0](https://registry.npmjs.org/@agent-native/core/-/core-0.179.0.tgz)
and [0.179.1-nightly-20260914231825](https://registry.npmjs.org/@agent-native/core/-/core-0.179.1-nightly-20260914231825.tgz) registry artifacts still
contain the saved-head behavior and lack the per-thread draft restoration seam
needed by [issue #9](https://github.com/vivary-dev/Vivary-New/issues/9).

## Checks and limits

The 91 affected tests, TypeScript, production build, 24 CI workflow tests, guide,
planning, navigation, line-ending, and diff checks passed. All seven CI checks
passed on the final PR head `ff3ae49d9a51dfeeaff7735797312001c16aad4c`.
CI does not establish Native acceptance.

At the time of the isolated issue #6 fixture checks, the private preview ran
candidate `53a5fcdeb8aaed3b19ccc62ccc2be146ffee599a` without a configured
Native provider. The later [issue #7 receipt](23a-bundled-original-runtime.md)
records the refreshed preview composition.
The isolated responder proves application behavior, not an actual hosted Native
model run. All disposable fixture processes stopped. No credentials or user files
were copied. Windows product acceptance remains under issue #8.


## Maintained Core repair, 2026-09-15

Jeff approved a versioned Core dependency patch for the saved-head and disabled-composer defects. Core remains pinned to 0.176.5. Native retains storage, execution, authentication, and scope ownership.

The server checks the browser's observed head revision inside the existing SQL compare-and-swap retry. Stale snapshots contribute messages without moving the saved selection. Current-revision branch changes remain supported. Browser snapshots save in order and retain their original observation across imports and remounts. The host composerDisabled setting reaches the composer.

Zo verification passed: 11 patch regression tests, 71 affected application tests, 24 CI contract tests, type checking, frozen-lockfile installation, a production build, and independent source review. The normal application completed six deterministic Native turns across two projects and Personal workspace, including reopen/follow-up, stale snapshots, malformed input, project isolation, unavailable history/composer, and phone layout.

The existing private preview was refreshed without changing access, provider settings, or application data. Its saved Code reply and follow-up reopened. The Native turns used a local deterministic responder, not a paid provider. PR #43 owns final CI and merge. Windows and restart/draft acceptance remain under #8 and #9.


The stale-snapshot PUT returns headApplied=false and retains the current reply
after reloading. Malformed snapshot PUT returns 400. Cross-project GET, PUT,
and send probes return 404 without provider execution. Unavailable Alpha retains
readable history and a disabled editor. Its direct send probe returns 404 with
the provider-request count unchanged. This is refusal evidence, not a claim that
the HTTP probe returned the guard's unit-tested 409 response.

Independent review found a raw-data fallback that could bypass validation after
a failed merge. The corrected patch rejects invalid client snapshots before
writing. A SQLite regression confirms that malformed input leaves the stored
bytes unchanged. The independent re-review found no remaining actionable issue.

The private service retains its Node 24 runtime. The new server bundle reuses the
same-version SQLite binary from the previous verified preview, which opens a
database under Node 24. The isolated browser journey passes on that exact bundle.
Source tests use Node 22. These results do not establish a real hosted Native
provider turn, Windows acceptance, or final PR CI.


## Review follow-up and Zo CI, 2026-09-16

Old Native bookmarks omit a history parameter. The application now checks the
authenticated legacy scope before opening them. A match opens Unassigned. A 404
continues through the selected project's normal scope checks. Other lookup errors
show Retry history. This preserves both legacy and project links without moving
messages or weakening access checks.

Project Native rows again expose Rename, Pin, Unpin, and Archive through Native's
existing callbacks. Code rows have no Native action menu. Failed changes preserve
a Retry change action. A successful archive clears the route only while that
conversation is still selected.

The expanded normal-app journey repeats all six Native turns and the saved-head,
scope, unavailable-project, and phone checks. It also verifies legacy bookmarks,
project bookmark recovery after a refused lookup, rename persistence, failed Pin
and retry, Unpin persistence, Archive persistence, and route clearing. Independent
source review and the five chat-scope tests pass.

Jeff explicitly approved Zo CI after GitHub Actions could not start because of
account billing. All 61 selected Linux steps passed on repair commit `71b49a1`,
including the test, orientation, review, and site jobs. Zo's temporary filesystem
supports the timestamp and physical-identity fixtures that its shared filesystem
cannot represent. Tests and product checks were not weakened. The PR records the
final follow-up commit's CI receipt separately from this baseline.

GitHub Actions and Windows jobs remain unrun. Native model turns used the local
deterministic provider. This evidence does not establish Windows product
acceptance, a paid hosted Native model turn, or restart/draft acceptance.
