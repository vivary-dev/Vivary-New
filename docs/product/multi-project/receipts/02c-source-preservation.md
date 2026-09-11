# 02c selected source-preservation receipt

Evidence-record: 02c
Date: 2026-09-07
Verification-kind: runtime
Result: Selected capture, Windows and Habitat restoration, export replay, independent review, and bounded cleanup passed.

The [owning packet](../packets/02c-source-preservation.md) names eight source and
configuration files. They remain under Littleagent ownership. Private capture
does not import source, establish publication rights, or complete outcome 02.

## Captured scope

The capture contains 54,083 bytes across eight regular files. Every selected
file is untracked, and no selected path has a reachable Git commit.
The private companion records source coordinates, source HEAD, file hashes,
byte lengths, path-history results, and before/after classifications.
Source HEAD is context for the capture. It does not preserve these untracked bytes.

The package manifest records framework dependencies. The three configuration
files explain harness enablement, focused tests, and TypeScript path resolution.
This is a source slice, not a standalone installation or a buildable app export.

No conventional root license file or Workbench package license field was found.
The reviewed disposition permits private preservation only. Publication rights,
app import, generated files, installed dependencies, runtime state, hosted records,
and all unselected source remain outside this packet.

## Capture checks

Every selected path component was checked for links before reading. A bounded
pattern scan found no listed provider token, private key, bearer literal, JWT,
or non-placeholder email. The first scan stopped before copying because it
flagged four test addresses. A value-free check confirmed reserved `.test`
domains, and the corrected scan accepted them. The scan does not establish
that every possible kind of private information is absent.

The capture compared file size, modification time, and identity around each read.
It then repeated selected hashes, metadata, Git status, and history after staging.
The originals matched. No source file was written.

## Filesystem restoration

The verifier calls the existing `restoreSourcePreservation` function. Its source
root contains only the eight staged files. It never inventories the Littleagent
checkout, credentials, Git administration, or installed packages.

| Check | Windows and Habitat result |
| --- | --- |
| Restore into an empty disposable target | `restored`, eight matching files |
| Repeat with the completed receipt | `already-restored`, identical receipt bytes |
| Interrupt after three outputs | `incomplete`, exactly three owned outputs |
| Resume the unchanged partial target | `restored`, eight matching files |
| Change a separate partial output | `target-conflict`, unchanged target, receipt, and temporary tree |
| Recheck the staged source after each call | All eight hashes and lengths match |

Windows used Node `v24.19.0`. Habitat used Node `v22.23.2` on Linux
`6.6.87.2-microsoft-standard-WSL2` in the existing development environment.
Both runs restored all eight files and passed the same refusal and recovery checks.
The lead executed the Habitat command and returned its result and three receipts.

These checks prove the selected byte restoration and refusal paths in those
environments. They do not prove general Windows alias handling, concurrent-writer
safety, application behavior, or a native model run. No new development checkout,
worktree, container, or dependency was created for this proof.

The copied preservation engine matches the canonical script:
`76ad9a5a16899ce5b903488b564324f23470242510afee65b51395457eeb6a68`.
The bounded verifier hash is
`8be3966eb5c235d161383e64f0c20c5fc6aca8532d4e4fb7819a97775b9ceded`.
The byte-level capture manifest hash is
`8eb30394e18b2eed61e14ff04bea85dc22fed1717f9f50309386ab5946132e45`.

The prepared Habitat input archive contains eleven regular entries and 30,326
bytes. Every entry passed byte comparison against its input. Its hash is
`af5093200eb4fd3c9cc7dcc699807aa3395bd2f3d369c48f761f29adec05636d`.
The archive contains selected source, manifest, engine, and verifier only.

## Final private export

The private final ZIP contains 29 entries and 52,382 bytes. Its SHA-256 is
`fef6052875170794971b700fed4dee50ff007e884500a6ba606c1640a69fa207`.
The adjacent private manifest records every entry's size and hash.

Export verification compared every ZIP entry with its input. A fresh extraction
then reran the complete restoration verifier through the archived engine.
All eight source files and 54,083 bytes restored again, including the repeat,
interruption, recovery, and changed-partial refusal checks.
The source originals still matched before export.

The ZIP preserves selected source bytes, capture and restore helpers, the exact
engine, manifests, private provenance, both platform reports, and their receipts.
It excludes raw dependency trees, credentials, Git metadata, and unrelated data.

## Independent review and cleanup

The GPT-6 lead independently verified all 29 archive entries and all eight
original source hashes. The lead accepted this bounded evidence checkpoint.

Windows cleanup removed the exact task staging directory after checking the
retained archive hash and rejecting reparse points. It removed 101 files and
660,351 bytes. The final ZIP and its sidecar remain in ignored private storage.
The sidecar records independent review and cleanup results.

Cleanup of the exact Habitat task directory and input archive is complete.
The retained private cleanup record confirms both paths absent; a later check
of the stopped container confirmed that result. The verified archive is unchanged.
Existing services, checkout, dependencies, runtime tools and agent definitions
remain outside the removal list.
