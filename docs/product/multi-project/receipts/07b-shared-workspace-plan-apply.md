# Shared workspace plan and apply acceptance

Evidence-record: 07b
Date: 2026-09-23
Issue: [#14](https://github.com/vivary-dev/Vivary-New/issues/14)
Candidate source: `a80009403ab671fc6df71bfe644e70d58bb9bc07`
Verification-result: passed

The owner selected GPT-6 Luna for bounded independent review alongside Sol's
implementation and verification work. This assignment overrides the
repository's default Astra reviewer choice for this continuation. Luna
approved the seven hosted cases.

## Contract and candidate

The original creator owns both file plans and writes. The CLI and Native callers
use its new-folder plan and existing-folder adoption operations. The Native
owner action adds project access, a saved review, and an approval bound to that
review. Its app-binding `planHash` differs from the creator report's
`plan_hash`. Each has its own scope.

PR #47 accepted the new-folder path. The bundled CLI and managed Native bridge
returned the same ordered five-file plan, exact contents, byte counts, hashes,
target, and selected options. Preview and wrong-hash refusal left the target
absent. Apply created the reviewed bytes and registered the project. An exact
cross-caller retry left file bytes and modification times unchanged. The hosted
Create journey opened the project, files, and earlier conversation.

The current Zo checkout was at `a80009403ab671fc6df71bfe644e70d58bb9bc07`.
The normal Workbench app build and Windows package came from
`df4aedc998580a5040ffb670dfdba821541bff9a`. A source comparison found
no Workbench, desktop runtime, or creator code change between those commits.
The bundled Linux creator came from
`1d6ea72b8cebbb703108969a0be3d1b931826a35`. Its creator, core, and
Tropo inputs match the current checkout. The Windows package is the unpublished
candidate in the [first-launch receipt](23b-windows-desktop-acceptance.md),
not the public prerelease.

## Current existing-folder proof on Zo

Seven cases ran through one normal Workbench app and browser composition at a
time, with a bundled creator and disposable existing folders. Native actions
used the browser's authenticated owner context. Luna independently reviewed
these seven cases. No new model call was needed.

- The Native and CLI previews used the same physical folder and coding preset.
  Their root, selected preset and reason, creator plan hash, conflicts, replay
  and privacy fields, and full content plan matched. The retained `STATE.md`
  contained binary bytes, and preview changed no file bytes or modification times.
- A second fixture applied the matching plan. Each created or patched file
  matched its reviewed UTF-8 bytes. The binary retained file kept its hash and
  modification time. Submitting the same approval again reported replay and
  changed no file bytes or modification times.
- A noncontract existing `.vivary/workspace.toml` appeared as a conflict.
  Apply refused with HTTP 409 and changed no fixture files.
- Replacing a coding review with a writing review gave a new operation ID.
  The old approval refused with HTTP 409 and changed no files.
- Changing the retained binary file after review made the old approval return
  a refusal. That attempt made no additional writes.
- A private one-shot test shim let the creator finish an approved apply, then
  hid only its result from the app. The app kept the operation pending.
  After restart, the same registered project and operation resumed. Retrying
  returned `replayed: true` and left every file hash and modification time
  unchanged.
- A separate one-shot test shim interrupted the bundled creator after two
  writes. After restart, the app preserved the pending operation. The owner
  action returned three recovery actions. Confirming the reviewed recovery
  hash restored original file hashes and removed planned creates.

The two fault shims ran only in isolated proof processes. They are not product
code or evidence that a real fault occurred in a normal session. Earlier
focused creator and service tests cover transaction exclusion, journal limits,
partial writes, and refusal when possible completion makes rollback unsafe.

## Packaged Windows journey

The same `df4aedc` package used for issue #8 opened a new disposable
project. This run reused issue #8's isolated application profile under the
existing Windows account. Issue #8
already proved separate privacy approval, exact setup bytes, renderer response
loss and retry, and an authorized Codex/Astra turn that read the resulting
guidance and context. This run tested the affected existing-folder branches.

A noncontract workspace configuration appeared in the visible conflict review,
and **Confirm and apply** was disabled. The five original fixture files kept
their hashes and modification times. The conflicting file was renamed into a
retained backup. A coding preview then showed the proposed content. Changing
the retained binary `STATE.md` invalidated that approval with a visible
refusal and no additional writes.

A fresh review and approved Apply wrote four exact proposed files, including
the reviewed patch to an `AGENTS.md` file with a BOM and CRLF line endings.
The retained binary state, unrelated note, and conflict backup stayed
unchanged. The app showed success. A persisted creator completion receipt
bound the same operation ID and creator report hash. The first Apply HTTP
response was not captured by the observation tool, so this result rests on
the visible app state, disk bytes, and creator receipt. Restart reopened the
same project and displayed its applied setup state. No post-restart Native HTTP
response was captured. A final comparison found all 2,011 original-profile
files unchanged, no extra files there, and no task-owned application process.

## Acceptance boundary

These checks satisfy issue #14's shared plan, exact approval, refusal, repeat
request, recovery, and existing project identity conditions for this candidate.
The [desktop acceptance register](../desktop-acceptance-status.md) tracks the
separate [issue #15](https://github.com/vivary-dev/Vivary-New/issues/15)
GUI creation and reconnect scope. Issue #23 still owns full desktop and
self-hosted release acceptance. No global CLI installation, VCS host, or
conductor was part of this setup path. Private screenshots, fixture data,
request records, and profile comparisons remain outside tracked source.

