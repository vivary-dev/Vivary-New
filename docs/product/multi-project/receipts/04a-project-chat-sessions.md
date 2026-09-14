# Project conversation verification

Evidence-record: 04a
Date: 2026-09-14

[Issue #6](https://github.com/vivary-dev/Vivary-New/issues/6) and
[PR #43](https://github.com/vivary-dev/Vivary-New/pull/43) own acceptance and delivery.
The PR remains draft. Native reopening has an unresolved framework defect.

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

## Native acceptance blockers

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
intentional branches. Do not patch private runtime internals or hide these failures.
The official [0.179.0](https://registry.npmjs.org/@agent-native/core/-/core-0.179.0.tgz)
and [0.179.1-nightly-20260914231825](https://registry.npmjs.org/@agent-native/core/-/core-0.179.1-nightly-20260914231825.tgz) registry artifacts still
contain the saved-head behavior and lack the per-thread draft restoration seam
needed by [issue #9](https://github.com/vivary-dev/Vivary-New/issues/9).

## Checks and limits

The 91 affected tests, TypeScript, production build, 24 CI workflow tests, guide,
planning, navigation, line-ending, and diff checks passed. Seven CI checks passed
on `53a5fcdeb8aaed3b19ccc62ccc2be146ffee599a`. CI does not establish Native acceptance.

The private preview runs that build. Native has no configured provider there.
The isolated responder proves application behavior, not an actual hosted Native
model run. All disposable fixture processes stopped. No credentials or user files
were copied. Windows product acceptance remains under issue #8.
