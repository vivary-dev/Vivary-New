# Populated-folder adoption acceptance

Evidence-record: 08a
Date: 2026-09-23
Issue: [#17](https://github.com/vivary-dev/Vivary-New/issues/17)
Accepted source and packaged candidate: `f024979c4cf8371485054a337388d066bb75b43c`
Hosted result: passed
Packaged Windows result: passed

## Result

The GUI can register a populated folder without changing it, then preview and
approve adoption through the existing creator operation. Preview shows proposed
writes, retained files, conflicts, unsupported file counts, and expected
validation findings. Cancel makes no change. Apply checks the approved inputs
again and writes only the reviewed content.

Ordinary folders such as `projects`, `decisions`, and `modules` stay untyped
unless an existing schema declares their meaning. Frontmatter containing
`type: project` alone does not assign a schema. Ordinary Markdown stays
available to the existing Markdown index. PDFs and other non-Markdown files
remain in the folder but are not added to that index. The preview counts files
in scanned folders separately from the heuristic used to suggest a workspace
type. Hidden and dependency directories retain their scan exclusions.

Preview validates existing and proposed Markdown under the configuration that
Apply will use. Nested schemas remain authoritative. Changes to validated
content or effective pack policy invalidate an old approval. Incompatible
legacy root schemas and root-only packs require a reviewed migration. Old
incomplete adoption journals still validate and recover with their originally
approved content. The [shared operation receipt](07b-shared-workspace-plan-apply.md)
covers replay, lost response, and reviewed recovery.

## Hosted acceptance

The representative S2 fixture recreated the documented PARA shape with 400
ordinary Markdown notes and 12 PDFs. The original research fixture was not
available. On source `7153a020af8b08bebbc61beac219941150a3251b`, the normal
Workbench and bundled creator registered without writing, previewed and
cancelled, then reviewed privacy and setup as separate approvals. The ignore
file and four setup files matched their Native review. All 412 original files
kept their hashes, lengths, and modification times. The final tree had 417
files. Files and guidance opened after Apply and after restart with the same
selected project. The review controls remained usable at 390 pixels. Doctor
reported 403 nodes, zero edges, and zero broken links. These plain notes did
not require graph edges. No model call was requested.

Source `f024979` changed only the inventory count and its explanatory wording
after that S2 journey. Independent review accepted carrying forward the S2
result for that scenario. A fresh Workbench and creator build at `f024979`
passed the mixed-schema hosted GUI case. Preview reported four Markdown and
two other files. It showed E101 for a declared decision missing its required
date and disabled approval. An ordinary note with `type: project` frontmatter
and a valid declared decision had no findings. Cancel preserved all six
existing files, and the findings remained readable at 390 pixels.

An earlier mixed-case driver stopped because the old preview reported one
Markdown and one other file. That run is failed evidence, not acceptance.

## Packaged Windows acceptance

The unpublished Windows ZIP was built from clean `f024979` source. It contains
3,108 files, is 221,480,193 bytes, and has SHA-256
`2774ca79f70cc2500197fe16abd6b6e072ac225f4e4ffec80107e7598b42e48b`.
Workbench metadata reports `sourceCommitVerified: false`. The source build
and package identity are recorded separately from that metadata limit.

The actual EXE used the native folder picker to register the S2 copy.
Preview counted 400 Markdown and 12 other files. Cancel wrote nothing.
Privacy approval created only the reviewed `.gitignore`. A fresh setup
preview counted 400 Markdown and 13 other files and showed four proposed
setup files. Separate approval applied those four files with the Native
preview hashes. Native Apply returned HTTP 200 for the same project.
Files opened the adopted project and its guidance.

A second populated folder exercised configured validation. Preview counted
four Markdown and two other files, displayed the missing-date E101 finding,
disabled approval, and left all six originals unchanged after Cancel. The
normal application restart retained the S2 project identity and readable
guidance. All 423 visible files across both fixture folders kept their bytes and
modification times across restart. All 418 original fixture files retained
their hashes, lengths, and modification times through the Windows journey.
The 2,011 recorded files in the original installed profiles also remained
unchanged. The candidate closed with no observed processes. No model call
was requested.

The post-restart Native HTTP response was not captured. The selected GUI
route, readable guidance, and unchanged disk state support the restart result
without claiming that response.

## Verification and limits

From the repository root on Zo, the eight applicable creator scripts in
`.github/workflows/ci.yml` passed on clean `f024979`: 370 tests passed and eight
were skipped. Exact-workflow Workbench state transport and maintained checks,
Native doctor, repository contracts, and `git diff --check` also passed.
The unchanged Tropo direct runner had passed 204 tests during source review.
The private continuation handoff holds test logs, disposable fixture manifests,
GUI captures, and the Windows evidence manifest. Those records are not shipped
in this repository.

This acceptance does not add PDF extraction, semantic indexing, folder
renaming, model execution, or a release of the desktop app. Parent packet 08
and final desktop and web acceptance remain open.
