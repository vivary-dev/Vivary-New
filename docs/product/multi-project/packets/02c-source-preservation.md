---
type: packet
---
# 02c: Preserve and restore the selected native-host source

Parent: 02
Status: done
Depends-on: [02b, 10c]
Owner: GPT-6 preservation writer, sole writer. The lead independently reviews evidence.
Scope: Private capture and restoration of eight selected Littleagent S-00A source and configuration files. No product import.
Verification-kind: runtime
Verification-result: passed
Evidence: [Source preservation receipt](../receipts/02c-source-preservation.md)
Timebox: One bounded preservation unit through capture, restore, review, export, and cleanup.

## Goal

Preserve the untracked native host, readiness action, test, and runtime screen.
Include the package manifest and three configuration files needed to interpret them.
Verify restored bytes through the existing preservation engine.

## Context

Read the [preservation contract](../contracts/source-preservation.md),
[02b receipt](../receipts/02b-restoration-fixture.md),
[source boundary receipt](../receipts/01-migration-boundaries.md), and source app instructions.
The source owner remains Littleagent. Its selected paths are:

- `apps/workbench/server/agent-runtime-host.ts`
- `apps/workbench/actions/runtime-readiness.ts`
- `apps/workbench/tests/native-runtime-host.test.ts`
- `apps/workbench/app/routes/runtime.tsx`
- `apps/workbench/package.json`
- `apps/workbench/agent-native.config.ts`
- `apps/workbench/vitest.config.ts`
- `apps/workbench/tsconfig.json`

## Owned files

This packet owns its packet, [receipt](../receipts/02c-source-preservation.md),
the outcome-02 checkpoint, and ignored private capture helpers and evidence.
The active graph writer regenerates the index and graph after coordination.
The implementation uses `restoreSourcePreservation` from
`scripts/prove_multi_project_source_preservation.mjs` without changing that engine.

## Done condition

1. Check the exact source paths without following links. Scan selected bytes for
   credentials and personal data without printing matched values.
2. Record source hashes, lengths, working-tree classes, reachable path history,
   source ownership, license findings, and explicit exclusions privately.
3. Stage only selected regular files. The engine inventories that staged source,
   never the complete source checkout or credential directories.
4. Restore into an empty disposable directory. Verify all eight hashes and lengths,
   completed-repeat behavior, interruption recovery, and unchanged staged inputs.
5. Compare selected originals and their Git classifications before and after the
   proof. Reject an input change rather than silently accepting a mixed snapshot.
6. Verify the final private archive by reading every entry and comparing its
   manifest. Record the archive hash in the public receipt without publishing bytes.

## Verify

Use existing Windows tools for capture and the verified Habitat environment for
the bounded filesystem restoration. A Windows probe may identify platform limits.
Record each environment separately. No dependency installation is needed.
The private receipt records exact commands, original coordinates, manifests, and
restore outputs. Run the [common planning checks](../execution-contract.md#maintaining-the-graph)
after the graph writer renders the new packet.

From the private capture directory, run the exported verifier against its
copied engine and selected input. The receipt binds every copied engine byte
to the canonical script.

```console
node restore-selected.mjs engine.mjs input habitat-proof
python capture.py --verify-originals
```

## Stop conditions

No selected source file is modified. Do not copy `.git`, `.env`, credentials,
installed dependencies, runtime state, or unrelated files. Create no development
checkout or worktree. Do not publish or import the captured source into Vivary.
Private preservation does not establish publication rights or close outcome 02.

Retain one verified private export. Remove only this packet's disposable staging,
restore targets, and stopped verification helpers after export and independent review.
Preserve existing runtime tools, agent definitions, services, and other packet outputs.

## Log

- 2026-09-07: Claimed under the owner's continuous implementation authority.
  Eight untracked source and configuration files were captured privately.

- 2026-09-07: Windows and Habitat restoration, archive replay, independent review,
  and bounded staging cleanup passed. The verified private export is retained.
