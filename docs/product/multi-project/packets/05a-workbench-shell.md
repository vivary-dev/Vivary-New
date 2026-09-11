---
type: packet
---
# 05a: Preserve and compose the native workbench shell

Parent: 05
Status: done
Depends-on: [02c, 03c]
Owner: GPT-6 record_decisions, sole GUI and provenance writer. The lead independently reviews evidence.
Scope: Private preservation of selected Littleagent GUI source, then a locally buildable native shell in packages/workbench. No model run, file write-back, production authentication, publication, or replacement native services.
Verification-kind: runtime
Verification-result: passed
Evidence: [Shell integration receipt](../receipts/05a-workbench-shell.md)
Timebox: One bounded shell unit through preservation, native composition, build, browser smoke, review, and cleanup. Checkpoint without discarding remaining acceptance.

## Goal

Preserve the existing two-pane workbench before adapting it into Vivary's app
package. Compose native providers, chat, navigation, and UI controls. Make
unfinished project, task, session, and editing behavior explicit.

## Context

Read outcome 05, the preservation contract, 02c and 03c receipts, native owners,
the source S-01 design and accessibility findings, and the installed Core docs.
Preserve five custom GUI files and 19 bounded composition/configuration files.
The private capture manifest owns the exact selection, hashes, classifications,
and provenance. Source originals remain unchanged.

## Owned files

This packet owns its packet and receipt, packages/workbench/app, app build
configuration, and the package-local provenance record. Coordinate package.json
with the 06c writer before changes. Outcome 06 owns registry services and HTTP
entry points. This packet does not change their authority contracts.

## Done condition

1. Reject links and changing source files. Scan selected bytes without printing
   matches. Record licenses and history references privately. Restore the
   selected bytes through the existing preservation engine and verify hashes.
2. Report the native composition and build plan to the lead before importing
   source. Record source-to-target hashes and every adaptation. Preserve unsafe
   legacy editing code as evidence without enabling its known data-loss paths.
3. Build a local shell with project navigation, task/session regions, native
   conversation, a full-chat route, and expandable work panels. Unsupported
   operations must have truthful empty or unavailable states.
4. Verify the package build and focused checks in the existing Habitat app.
   Export its exact renderer output to the existing Windows browser in a private
   loopback fixture. The lead approved this bounded browser arrangement on
   2026-09-07. Check desktop/mobile layout,
   keyboard focus, pane switching, native providers, and console failures.
5. Independently review the actual evidence. Export a verified private archive
   and update outcome 05 without claiming the whole parent complete.

## Verify

Run the selected preservation verifier from the private input directory:

```console
node restore-selected.mjs engine.mjs input habitat-proof
python capture.py --verify-originals
```

Run the package-local build and existing focused checks after wiring them:

```console
npm run build
npm run test:shell
```

Record the bounded browser commands and observed results in the receipt.
Run the common planning checks after each status checkpoint.

## Stop conditions

Use public Core and Toolkit composition seams. No dependency patch, private
runtime import, second transcript store, task queue, model call, credential copy,
paid environment, outbound message, deployment, or publication is authorized.
Verify installed versions before choosing build wiring. Reuse existing caches
and the lead's verified Habitat development checkout. No new checkout or worktree.

Scratch is confined to the named private 05a staging and proof directories.
After a verified export, remove only this packet's contained disposable copies
and stop only its owned server processes. Retain the final archive and minimum
failure evidence. Existing source, dependencies, runtime tools, and unrelated
services remain outside cleanup.

## Log

- 2026-09-07: Claimed after the lead selected GUI preservation and native shell
  integration. Dependencies 02c and 03c are complete. Registry HTTP work in 06c
  is independent enabling work and does not gate source preservation or a shell.

- 2026-09-07: Scoped preservation, native shell composition, frozen Habitat
  build/typecheck/preview tests/doctor, and exported-renderer browser proof passed.
  The lead independently accepted visual evidence and every retained archive
  payload/source hash. Task-owned cleanup is complete; the existing Habitat app
  and dependencies remain for the next packet. Parent outcome 05 remains open.
