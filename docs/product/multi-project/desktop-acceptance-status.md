# Desktop acceptance status

Updated 2026-09-16. This page is the current tracked acceptance register for the
private Windows desktop and self-hosted Workbench. GitHub issues still own task
scope and lifecycle. Dated receipts preserve detailed evidence. This page states
what a new contributor or tester can rely on now.

## Release boundary

**Vivary is not ready for public release.** The current Windows x64 portable folder
is a private development candidate built from source commit
`26798df3b1b4e4f6dd6c3e9eb798a9817ccaab1a`. It is available as an unsigned
[private Windows development preview](https://github.com/vivary-dev/Vivary-New/releases/tag/desktop-preview-2026-09-16).
Repository access is required to download it. The preview is incomplete and has
not passed the complete desktop and self-hosted web release journey.

The exact private archive tested on Windows was 236,023,078 bytes with SHA-256
`a987fac00c20fe3b613baabe7b4f2c3d60c87f6a097cd2f8cb1454adf8593a6c`.
Use those values to verify the downloaded ZIP. The prerelease tag identifies the
tested `26798df` binary. It is not a suite version and does not imply that a newer
source merge rebuilt the archive.

## Windows evidence by candidate

### Broad `31d9afc` acceptance pass

The broad Windows journey ran on the `31d9afc` candidate. It verified Explorer
launch and extraction, bundled runtime use, managed project creation, project files,
Usage ranges and Workspace scope, approvals, a real Claude Code follow-up, Stop from
another project, restart recovery, draft persistence, second-instance reuse, and idle
and active process cleanup.

Observed application processes used the packaged Node and Python runtimes. The test
profile also had developer tools installed, so this does not prove a clean Windows
profile with no global Node or Python. Clean-profile acceptance remains open.

Usage opened successfully against the preserved application profile, which had no
Native usage records and reproduced the missing-table failure before W04. Separately,
the focused automated regression starts with a disposable empty database, returns
empty metrics, and proves that the metrics path creates `token_usage` before querying.

### Focused final `26798df` retest

The final `26798df` candidate retested the W05 containment and the artifact/lifecycle
seams most likely to regress. Windows Explorer extracted all 3,110 files at a deep
destination, and every extracted file matched the archive. A new Code conversation
showed plain `Claude Code · sonnet` identity with no Model button or provider path.
Runtime settings showed Claude Code and Codex as Ready, while the UI correctly offered
no unsupported Codex selection.

One approved Claude Code turn read the managed project's 79-byte `STATE.md`. Its raw
output matched disk and all five project files stayed unchanged. The completed
conversation retained its engine/model identity. A second Explorer launch reused the
same application window and retained that conversation. Final shutdown removed every
observed application process and released the listening port.

The focused final retest did not replay every broad `31d9afc` journey. W01 through W04
retain their broad `31d9afc` Windows evidence. W05 and the final artifact/lifecycle
seams have direct `26798df` Windows evidence.

## Defects fixed during Windows acceptance

| Finding | Current behavior |
| --- | --- |
| W01: Explorer extraction failed on long Python cache paths | Packaged Python omits runtime pip metadata and bytecode caches. Distlib's launcher license remains included. |
| W02: an invalid rename returned a generic server error | Project-boundary failures return a clear client error, such as `Choose a file inside the selected project.` |
| W03: project-name rules were hidden behind native validation | The form explains the ASCII character set, length, start/end rules, and Windows reserved names. |
| W04: Usage queried before `token_usage` existed | The metrics path creates its table before querying. A disposable empty-database regression returns empty metrics. |
| W05: CLI model aliases opened Native provider setup | The Code composer hides that picker and keeps the effective CLI engine/model visible as read-only text. |

## Capability and acceptance gaps

| Area | Verified now | Still required |
| --- | --- | --- |
| Code conversations | Real Claude Code file read, earlier read/write/follow-up proof, approvals, Stop, history, and runtime identity | A supported user-facing Claude/Codex selector and full adapter-reported catalog under [issue #38](https://github.com/vivary-dev/Vivary-New/issues/38) |
| Codex CLI | Installation and account status can show **Ready** | Codex cannot currently be selected for a new Code conversation in the packaged UI. No packaged Codex turn is accepted |
| Native conversations | Project-scoped storage, history controls, saved-head repair, and deterministic-provider journeys | Access to an approved real Native provider and accepted real-provider Native turns ([issue #50](https://github.com/vivary-dev/Vivary-New/issues/50)) |
| Models and providers | Runtime settings separates local CLI readiness from Native provider setup | User-facing provider/model selection must reflect the selected harness without routing CLI aliases into cloud setup |
| Automations | Settings can display the automation surface | Real creation, execution, recovery, and lifecycle acceptance remain under [issue #51](https://github.com/vivary-dev/Vivary-New/issues/51), blocked on issue #50 |
| Projects | Managed five-file creation, saved selection, reconnection review, and unavailable-folder handling | Full populated-folder adoption/apply and the rest of the setup/pattern journey |
| Files and continuity | Read/Edit/Save/Rename, conflicts, restart draft, completed history, and clean shutdown | File search, chat-content search, scoped memory, and remaining restart/draft cases in their owning issues |
| Original Vivary | Bundled ten-verb CLI and packaged Python. Managed creation uses the packaged creator | Complete GUI/agent flows for every original operation on the final product journey |
| Web and preview | Private authenticated Zo preview and basic isolated page preview | Clean self-hosted setup, responsive real-phone connection, revocation/reconnect, and integrated agent debugging |
| Distribution | Exact unsigned Windows x64 portable artifact, licenses, checksum, and process cleanup | Clean-profile acceptance under [issue #8](https://github.com/vivary-dev/Vivary-New/issues/8), upgrade/removal behavior, the remaining desktop/web journey, and release approval |

The Windows checks used an existing authorized profile. They do not establish a
clean-profile first-run journey. Credentials are never bundled. Claude Code, Codex,
and Native provider accounts remain separate from access to Vivary. The accepted
current distribution may be a versioned archive or an installer. Signing and an
installer are future distribution choices. They are not requirements for the current
Windows milestone.
macOS is later roadmap work outside the active Windows milestone.

## Evidence boundaries

The candidate's Workbench output was built in a clean isolated checkout and 620
compiled files matched the fresh build. The Windows SQLite binding and runtime marker
were the two expected target replacements. Package metadata still records the
prebuilt Workbench output as `sourceCommitVerified=false`, so byte equivalence and
the clean checkout provide confidence without claiming compiler-input provenance.
Sensitive-path review was filename based. These limits do not invalidate the tested
journeys, but they remain part of the artifact record.


GitHub Actions run 35059510035 did not start because account billing or spending
restricted Actions. Separately recorded Zo Linux gates do not establish the unrun
GitHub Windows governed-platform or orientation jobs. [Issue #22](https://github.com/vivary-dev/Vivary-New/issues/22)
owns maintained regression checks. The direct Windows UI journeys above are runtime
evidence, not a substitute claim for those CI jobs. No billing or account change was made.

Do not infer public readiness from this page, a Git merge, or an issue closure.
Final acceptance remains with the [desktop release journey](desktop-release.md#acceptance-journey)
and its live milestone issues.
