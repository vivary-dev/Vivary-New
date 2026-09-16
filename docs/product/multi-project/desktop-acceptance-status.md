# Desktop acceptance status

Updated 2026-09-16. This page is the current tracked acceptance register for the
private Windows desktop and self-hosted Workbench. GitHub issues still own task
scope and lifecycle. Dated receipts preserve detailed evidence; this page states
what a new contributor or tester can rely on now.

## Release boundary

**Vivary is not ready for public release.** The current Windows x64 portable folder
is a private development candidate built from source commit
`26798df3b1b4e4f6dd6c3e9eb798a9817ccaab1a`. It is unsigned, has no installer or
upgrade path, and has not passed the complete desktop and self-hosted web release
journey. No desktop package has been published.

The exact private archive tested on Windows was 236,023,078 bytes with SHA-256
`a987fac00c20fe3b613baabe7b4f2c3d60c87f6a097cd2f8cb1454adf8593a6c`.
Those values identify evidence; they are not a download or release promise.

## Verified on the tested Windows candidate

- Windows Explorer extracted all 3,110 files, including at a deep destination.
  Every extracted file matched the archive.
- Explorer launched the application with bundled Node, Python, SQLite, and the
  original Vivary command runtime. No global Node or Python was required.
- A second launch reused the existing window and instance. Idle and active close
  stopped the owned process tree and released the loopback port.
- Saved project selection, completed Code history, and an unsent file draft
  survived package restarts. An interrupted turn reopened as stopped rather than
  falsely complete.
- Managed project creation produced the exact five guidance files. Bundled Python
  preview and create used the packaged runtime.
- Project files opened, edited, saved, and renamed. Conflict, traversal, collision,
  Unicode, and draft-recovery checks preserved source files on refusal.
- Usage opened on a fresh database and supported 7-, 30-, and 90-day ranges plus
  Workspace scope with no usage records.
- Claude Code readiness, approval, file-tool output, follow-up, Stop from another
  project, recorded engine/model identity, and restart history were exercised.
- The Code composer shows a read-only identity such as `Claude Code · sonnet`.
  The unrelated Native cloud-provider Model picker is deliberately hidden.

## Defects fixed during Windows acceptance

| Finding | Current behavior |
| --- | --- |
| W01: Explorer extraction failed on long Python cache paths | Packaged Python omits runtime pip metadata and bytecode caches. Distlib's launcher license remains included. |
| W02: an invalid rename returned a generic server error | Project-boundary failures return a clear client error, such as `Choose a file inside the selected project.` |
| W03: project-name rules were hidden behind native validation | The form explains the ASCII character set, length, start/end rules, and Windows reserved names. |
| W04: fresh Usage opened before `token_usage` existed | The metrics path creates its table before querying and returns an empty result. |
| W05: CLI model aliases opened Native provider setup | The Code composer hides that picker and keeps the effective CLI engine/model visible as read-only text. |

## Capability and acceptance gaps

| Area | Verified now | Still required |
| --- | --- | --- |
| Code conversations | Real Claude Code file read, earlier read/write/follow-up proof, approvals, Stop, history, and runtime identity | A supported user-facing Claude/Codex selector and full adapter-reported catalog under [issue #38](https://github.com/vivary-dev/Vivary-New/issues/38) |
| Codex CLI | Installation and account status can show **Ready** | Codex cannot currently be selected for a new Code conversation in the packaged UI; no packaged Codex turn is accepted |
| Native conversations | Project-scoped storage, history controls, saved-head repair, and deterministic-provider journeys | Access to an approved real Native provider and accepted real-provider Native turns ([issue #50](https://github.com/vivary-dev/Vivary-New/issues/50)) |
| Models and providers | Runtime settings separates local CLI readiness from Native provider setup | User-facing provider/model selection must reflect the selected harness without routing CLI aliases into cloud setup |
| Automations | Settings can display the automation surface | Real creation, execution, recovery, and lifecycle acceptance remain under [issue #51](https://github.com/vivary-dev/Vivary-New/issues/51), blocked on issue #50 |
| Projects | Managed five-file creation, saved selection, reconnection review, and unavailable-folder handling | Full populated-folder adoption/apply and the rest of the setup/pattern journey |
| Files and continuity | Read/Edit/Save/Rename, conflicts, restart draft, completed history, and clean shutdown | File search, chat-content search, scoped memory, and remaining restart/draft cases in their owning issues |
| Original Vivary | Bundled ten-verb CLI and packaged Python; managed creation uses the packaged creator | Complete GUI/agent flows for every original operation on the final product journey |
| Web and preview | Private authenticated Zo preview and basic isolated page preview | Clean self-hosted setup, responsive real-phone connection, revocation/reconnect, and integrated agent debugging |
| Distribution | Exact unsigned Windows x64 portable artifact, licenses, checksum, and process cleanup | Clean-profile acceptance under [issue #8](https://github.com/vivary-dev/Vivary-New/issues/8), plus installer/signing, upgrades/removal, public download, macOS, and release approval |

The Windows checks used an existing authorized profile. They do not establish a
clean-profile first-run journey. Credentials are never bundled. Claude Code, Codex,
and Native provider accounts remain separate from access to Vivary.

## Evidence boundaries

The candidate's Workbench output was built in a clean isolated checkout and 620
compiled files matched the fresh build; the Windows SQLite binding and runtime marker
were the two expected target replacements. Package metadata still records the
prebuilt Workbench output as `sourceCommitVerified=false`, so byte equivalence and
the clean checkout provide confidence without claiming compiler-input provenance.
Sensitive-path review was filename based. These limits do not invalidate the tested
journeys, but they remain part of the artifact record.

Do not infer public readiness from this page, a Git merge, or an issue closure.
Final acceptance remains with the [desktop release journey](desktop-release.md#acceptance-journey)
and its live milestone issues.
