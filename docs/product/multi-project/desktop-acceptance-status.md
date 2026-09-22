# Desktop acceptance status

Updated 2026-09-22. This page is the current tracked acceptance register for the
Windows desktop and self-hosted Workbench. GitHub issues still own task
scope and lifecycle. Dated receipts preserve detailed evidence. This page states
what a new contributor or tester can rely on now.

## Release boundary

The [public Windows prerelease](https://github.com/vivary-dev/Vivary-New/releases/tag/desktop-preview-2026-09-22) contains the tested `9884670`
application. Stable desktop and self-hosted web acceptance remain incomplete.
The repository and download are public. No access invitation is required.

Exact source: `98846706227432e26f519d1b546889261eb08ff1`, the merged PR #78 commit.
ZIP size: 236,072,825 bytes.
SHA-256: `e9c0abf09e9e5a66c1dbea9ec3e05d479829138d35372b10c90a34124d1b81a0`.

The executable is unsigned and retains `version: 0.0.0`, `channel: private-preview`,
and prebuilt Workbench `sourceCommitVerified: false`. The tag pins the binary's
source, not later documentation commits. See the [install guide](../../desktop-preview.md).

Earlier archives remain available. Dated sections preserve their own candidate
evidence and do not imply retesting on the replacement.

### September 22 browser-link and lifecycle review of `9884670`

- Native Windows confirmation showed the complete URL and default Cancel choice.
  Explicit Cancel dismissed it without opening a preview tab.
- Confirmed Open launched Chrome at the exact path, query, and fragment.
  Interaction with the resulting page passed.
- Switching projects cleared the prior preview. Graceful close stopped all
  observed app processes and released the old listener. Restart retained the
  selected project and an empty Preview.
- Backups of 48 application-profile and 1,678 Electron-profile files passed hash
  verification before launch. Existing projects remained available.
- The archive checksum and clean source identity matched. Packaged `main.mjs`
  matched the source byte for byte. Distribution review found no profiles,
  authentication databases, or private continuity files.
- Twenty-seven desktop/startup tests and six applicable GitHub CI jobs passed
  on the reviewed fix head. The site job skipped. Source tests and simulated
  Electron events remain separate from the actual Windows checks above.

This bounded review does not repeat earlier full UI or model-runtime journeys.
Clean-profile onboarding, complete existing-folder registration, upgrade/removal
acceptance, Native-provider turns, and automations remain open. Historical Entire
trail-approval failures remain recorded. GitHub and Entire source refs were
verified separately from those approval results.

### September 21 visual review of `250aaa0`

- Direct Windows: checksum verification, launch with the existing profile,
  saved projects/conversation visibility, and real folder-chooser timeout recovery.
- Browser against the packaged app: setup proposals preserving existing guidance,
  unchanged fixture hashes, page owner label, interactive embedded page,
  same-project retention, cross-project clearing, Files/chat navigation, reload,
  and a 390-pixel layout with readable address-validation errors.
- The owner approved the screenshots, then authorized a GitHub prerelease.
- Seven [candidate GitHub CI jobs](https://github.com/vivary-dev/Vivary-New/actions/runs/35671130849) passed,
  including Windows governed verification and Windows/Linux orientation proof.
  The separate Entire gate failed on missing recorded reviewer approval, zero of one.

Native restart, minimum-width behavior, full native registration, conflict cases,
clean-profile first run, upgrade/removal acceptance, and real model turns remain
unrun on this exact candidate. Browser evidence does not establish native acceptance.
Setup code requires horizontal scrolling at ordinary split-panel width.
Browser Open folder still needs the desktop chooser. Setup preview has no GUI Apply.

The older-candidate evidence below remains relevant only to the scope it records.

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

### Codex integration candidate `3dd5aa8`

This later candidate was built and packaged on Zo and tested locally in the Windows
EXE. It has not replaced the published `26798df` archive. Its ZIP contains 3,107
files, is 234,930,723 bytes, and has SHA-256
`e53b3389f819322be2d7841f297ce0f613aafc036ff0297d11724bd46a7c26b8`.
Its full source commit is `3dd5aa8a7de4125b8508ed43ad69cef4a74f3975`.

The Windows journey verified:

- Codex subscription model discovery, including three consecutive refreshes, and
  recovery of a saved draft's historical `default` choice to GPT-6-Astra.
- An approved Codex turn read `PROBE.md`, copied it to `RESULT.txt`, and read the
  result back. Independent disk hashes matched. The UI exposed command details.
- A follow-up recalled the exact file marker without tools. The native Codex
  session ID stayed unchanged.
- Denial started no model or tools and created no output file.
- Stop from another project paused the Codex run. Its recorded worker and
  descendants exited, and the delayed output file stayed absent.
- Restart retained the selected project, transcript, runtime/model, and paused
  status. Closing the EXE removed the application processes and released its port.
- Runtime settings listed five Codex models and the configured connection names.
  Names establish configuration, not successful calls through every connection.

Earlier local candidates `6e86971` and `ab8ae26` exposed Windows discovery cleanup
races. A valid model catalog could be discarded when taskkill found an already
exited launcher or its pipes were still closing. The final candidate waits for
confirmed completion and keeps genuinely unconfirmed cleanup blocked. The failed
local packages were removed after shutdown; their receipts remain on Zo.

Evidence is retained on Zo under `.tmp/38-codex-integration/`, including native
screenshots, file hashes, transcript events, native-session identity, and process
snapshots. These checks used the existing authorized Windows profile. They do not
establish clean-profile installation or complete the broader issue #38 scope.

### Native Codex candidate `2f4a5df`

Commit `2f4a5df6b23a81789961bea1199fd20cec74df55` replaces the earlier
per-message launch approval and two-minute limit with native Codex action approvals.
Send starts a turn immediately. Runtime settings offer Normal, Read only, and YOLO.
Each turn keeps the permission mode selected when it starts. Progress and actual
subagent activity appear in compact cards, with the main answer as ordinary text.

The Zo production build and remote checks below passed. Its Windows ZIP contains
3,108 files, is 234,956,990 bytes, and has SHA-256
`b757e8d94711412ac1bb3b9420615972d5bb72e6e9dd3882b6469ee7940e23e8`.
The downloaded ZIP hash was verified and the replacement EXE launched on Windows.
The exact EXE verified immediate Send,
continuation of the existing native session, and a file copy with independently
matching SHA-256 hashes. The configured Node REPL returned `4` for `2+2`. One real
child appeared in a compact card with its public result. A local command completed
after 125.19 seconds and wrote the expected file. Screenshots and execution events
are retained on Zo in `.tmp/38-codex-integration/v2-windows-proof.json` and the
adjacent `v2-01` / `v2-02` screenshots.

After the unintended Escape pause, resumed Windows QA verified native command
Allow once and Decline. The allowed command wrote `ALLOW_PROBE`, and the denied
output file stayed absent. A second command reached its started marker. Stop from
another project ended its observed process, PID 22904. Its delayed output file
stayed absent beyond the command's 90-second delay. Closing the EXE through its UI
left no candidate process running. `v2-windows-proof.json` retains these results.

Read only performed a real file read, and the operating system denied its write.
The target file stayed absent. The setting persisted across restart. YOLO wrote
and read an authorized fixture outside the project without an approval prompt.
Normal was restored after these checks.
Windows QA also exposed two presentation defects: overlapping same-name tools
could merge, and pending native approvals could show a stopped-agent warning.

### Focused replacement retest `98515c9`

Commit `98515c91f4a8731c677e209498f49400a6f95a4c` preserves separate tool
inputs/results by native call identity. Native approval waits stay active, including
reopened conversations. The run-state API includes the phase needed by the client.
The first correction in `a1486b0` omitted that API field. Its failed hosted receipt
is retained, and the boundary regression now verifies the actual serialized state.

The final production build, all 75 focused tests, and type checking passed.
The 12 unchanged Native regressions also passed. Logs are `v4-build-run.log`,
`v4-all-tests.log`, `v4-types.log`, and `v3-native-regressions.log` under
`.tmp/38-codex-integration/`.

The replacement Windows archive contains 3,108 files and is 234,957,073 bytes.
Its downloaded SHA-256 matched
`160573c0632c103000502adc4625a0550c0b3dbdd97e69cebfda85d2c7362bd5`.
In the actual EXE, a Normal-mode approval stayed pending without a false stopped
warning, including after a Ctrl+R reload. The output file was absent before
approval. Allow once wrote `FINAL_98515C9`, and the final answer arrived in the
same native session. The saved output popover also displayed the retained result.
`v4-windows-proof.json` and adjacent screenshots retain this affected retest.

The earlier `2f4a5df` journey supplies the broader Windows proof above. The final
EXE retest covers the changed approval/display behavior, not a replay of every
journey. The final EXE preserved its completed answer and model after restart.
Shutdown left no candidate processes. Superseded local packages were removed, leaving
one extracted candidate and its ZIP. Profile and evidence were preserved. This is
bounded Codex prototype acceptance, not complete desktop acceptance.

The `3dd5aa8` results remain historical evidence for the earlier implementation.
They do not establish acceptance of the replacement execution policy or activity UI.
These candidates do not replace the published `26798df` private preview archive.

### Project-health candidate `43ae417`

Commit `43ae4171a56ab89069420a5512d1f735351e608a` is merged `dev` after
[PR #66](https://github.com/vivary-dev/Vivary-New/pull/66), which added the
"Check project health" block to the Details panel for
[issue #18](https://github.com/vivary-dev/Vivary-New/issues/18). The candidate
was built and packaged on Zo and tested on the laptop on 2026-09-18. It has not
replaced the published `26798df` archive, and no prerelease was opened. Its ZIP
contains 3,111 files, is 222,950,043 bytes, and has SHA-256
`b4ace1eb58b1715ccebcf40228af6c24840d980562fcb58198e79035b9e3f6db`. The laptop
verified that hash before extracting the folder.

The fixture was a disposable `writing` workspace created with the bundled
runtime, plus one ordinary note and an unknown `author` field in
`.vivary/context.md`, with no Git repository.

| Step | Result on `43ae417` |
| --- | --- |
| First launch | Pass. "Connected host" shown, loopback server on 127.0.0.1 |
| Runtime readiness | Claude Code ready, proven by the tool turn below. Codex showed "Check needed" because the laptop's npm Codex CLI 0.148.0 could not parse the configuration written by the Codex desktop app; a laptop environment gap, not the build. Codex readiness on this candidate is therefore not established |
| Register existing folder | Pass on the second attempt. The first attempt showed the generic "The folder could not be connected. Try again." after the native picker stayed open past the client action timeout; see [issue #68](https://github.com/vivary-dev/Vivary-New/issues/68) |
| Details shows "Not checked yet" | Pass |
| Check project health | Pass. `Healthy · 4 typed notes, 0 links` with one W202 warning, identical to headless `doctor --json` |
| Break and recover | Pass. `Needs attention · 5 typed notes, 0 links` with one E101 error and the W202 warning kept, identical to headless; removing the record and clicking Check again returned to Healthy |
| Narrow window | Pass at 488 px, the Electron default frame minimum; the health block, its warning, and Check again stayed reachable and clickable |
| Real tool turn | Pass. The Claude Code runtime wrote the requested file |
| Approval | Not rerun on `43ae417`, last proven on `98515c9` with Codex Normal mode |
| Denial | Not rerun on `43ae417`, last proven on `98515c9` with Codex Normal mode |
| Stop from another project | Pass. Writes stopped at 26 files and stayed there |
| Restart persistence | Pass. Project, three turns, and "Not checked yet" restored |
| Second-instance reuse | Pass. The second EXE exited, leaving one main process and one listener |
| Shutdown cleanup | Pass twice. No candidate-owned vivary, node, or python process remained, and the port was released |

Exact health comparison: headless `doctor --json` returned `ok: true`, no
errors, one warning
`tropo finding: .vivary/context.md:4: warning W202: unknown field 'author' for type 'project'`,
4 graph nodes, and 0 edges. The Details panel showed `Healthy · 4 typed notes,
0 links` with the identical warning line. With `changes/bad.md` missing its
`slice` field, headless returned `ok: false`, one error
`tropo finding: changes/bad.md:1: error E101: missing required field 'slice' for type 'change'`,
the same warning, and 5 nodes; the panel showed `Needs attention · 5 typed
notes, 0 links` with the same error and warning. An earlier expectation of
three notes was wrong; both surfaces count four (`AGENTS.md`, `STATE.md`,
`.vivary/context.md`, `notes/idea.md`).

Approval and denial were not rerun because this candidate launches the Claude
Code runtime with `auto-edit` permission mode and file tools only, so writes
inside the project never prompt, and Codex was not runnable on the laptop, as
the readiness row records. That is a laptop environment gap, not a build defect. Rerunning both with the Codex runtime in
Normal mode against a path outside the project remains due on this candidate.

Evidence is retained privately on Zo under
`.tmp/09a-windows-43ae417/laptop-evidence/`, with `doctor-headless.json` and
`doctor-headless-broken.json` one level up. These checks used the existing
authorized Windows profile and do not establish clean-profile acceptance.

## Defects fixed during Windows acceptance

| Finding | Current behavior |
| --- | --- |
| W01: Explorer extraction failed on long Python cache paths | Packaged Python omits runtime pip metadata and bytecode caches. Distlib's launcher license remains included. |
| W02: an invalid rename returned a generic server error | Project-boundary failures return a clear client error, such as `Choose a file inside the selected project.` |
| W03: project-name rules were hidden behind native validation | The form explains the ASCII character set, length, start/end rules, and Windows reserved names. |
| W04: Usage queried before `token_usage` existed | The metrics path creates its table before querying. A disposable empty-database regression returns empty metrics. |
| W05: CLI model aliases opened Native provider setup | The Code composer hides that picker and keeps the effective CLI engine/model visible as read-only text. |

## Remote Codex verification, 2026-09-16

The final `98515c9` hosted fixture held native approval for 4.5 seconds, reloaded
the pending conversation, and held it for another 4.5 seconds. Neither state showed
a false stopped warning. After approval, the final answer arrived. Native forms,
activity-card expansion through completion, and restart parity passed with no page
errors. The receipt is `native-ui-fixture-20260916T174242/receipt.json` under
`.tmp/38-codex-integration/`. This focused run skipped the earlier 125-second check.

The private preview was refreshed to `98515c9` output. Unauthenticated actions
still returned 401, and unauthenticated external access redirected with 302.
[PR #59](https://github.com/vivary-dev/Vivary-New/pull/59) merged into `dev` as
`b81dcd76a80613ae248eebacfb5f7d5a0269c1a7` on 2026-09-16. The merge tree matches
tested head `f21328ba21ad5a381d9c6f49247a5d3984fb0f03`; GitHub and Entire refs
were verified at the merge. All 62 applicable Linux workflow steps passed on Zo,
the approved CI host. Evidence is retained in `.tmp/zo-ci-codex-f21328b/`,
including the step logs, results, final proof, and merge proof. GitHub Actions
did not start because of billing. Windows governed-platform and orientation
workflow jobs were not run; the Windows UI evidence above remains separate.
The merge does not publish a new download or complete the broader desktop issues.

The `2f4a5df` production build passed on Zo. All 70 focused Codex, runtime,
approval, transcript, and lifecycle tests passed, with no failures or skips.
All 12 Native patch/storage regressions and type checking also passed. Evidence
is retained under `.tmp/38-codex-integration/` in `v2-all-tests.log`,
`v2-native-regressions.log`, `v2-types.log`, and `build-receipt.json`.

Real GPT-6-Astra turns through the production app verified immediate Send,
continuation of one native Codex session, context retention, restart/history,
fixed model identity, and saved permission settings. The earlier two-turn receipt
is `native-code-journey.json`. The latest build then displayed one actual Astra
subagent and its public result. Native child identity and completion events
establish delegation. Reopening the completed conversation preserved the card and
exact result on desktop and narrow layouts. `real-subagent-journey.json` and
`reopen-real-subagent.log` retain that result. An earlier native child receipt
marked `uiAccepted: false` records the rendering defect before this fix.

The deterministic production UI fixture separately verified:

- Command Allow once, file Decline, permission approval, question validation, and
  submitted MCP form values, including changing a visible checked default to false.
- One subagent card from native-shaped start/completion events for one child.
  Empty wait events created no extra cards.
- A card opened during a pending action remained open through completion and an
  actual live-to-history component remount. Restart retained the activity content.
- A turn remained active for 125.15 seconds, then stopped from another project.
- Desktop and 390px layouts in light and dark themes, no horizontal overflow,
  no browser errors, and cleanup of the test application.

The receipt and screenshots are in
`.tmp/38-codex-integration/native-ui-fixture-20260916T165256/`.
This fixture simulates Codex protocol events. It proves application handling of
those events, not real model execution, subagent execution, or external MCP calls.

Earlier remote checks verified runtime/model selection, saved choices, recovery of
legacy and retired draft models, and retained history when a folder was unavailable.
Codex file commands remain unverified on Zo because its restricted-network sandbox
failed with `bwrap: loopback: Failed RTM_NEWADDR`. The sandbox stayed enabled.
Windows candidates `3dd5aa8` and `2f4a5df` provide actual file-tool proof above.
A repeated Zo folder-fixture rename later failed with `EXDEV`. History stayed
readable, but that fixture could no longer prove folder recovery. Earlier successful
recovery evidence remains dated separately. No project grant was replaced to hide
the failure.

OpenCode Go separately completed a read-only file turn through its CLI using
`opencode-go/glm-5.3-flash`. It is not integrated into Vivary by this increment.
Broader issue #38 integration, real Native-provider acceptance in #50, and
automations in #51 remain open.

## Capability and acceptance gaps

| Area | Verified now | Still required |
| --- | --- | --- |
| Code conversations | Windows `2f4a5df` file work, session continuity, MCP call, real subagent card, 125.19-second command, native Allow/Decline, active-command Stop, and shutdown | Linked conversations, and broader cross-runtime work under [issue #38](https://github.com/vivary-dev/Vivary-New/issues/38) |
| Codex CLI | Subscription turns, file tools, MCP call, child public result, long command, native action decisions, and command cancellation in local `2f4a5df`. Remote rendering checks | Further connection-specific journeys and broader issue #38 scope. The published `9884670` includes this integration, with real-turn evidence from earlier candidates |
| Native conversations | Project-scoped storage, history controls, saved-head repair, and deterministic-provider journeys | Access to an approved real Native provider and accepted real-provider Native turns ([issue #50](https://github.com/vivary-dev/Vivary-New/issues/50)) |
| Models and providers | Codex model choices come from its catalog; saved conversations keep their model; CLI choices do not enter Native provider setup | Broader provider modes and other runtime catalogs in their owning issues |
| Automations | Settings can display the automation surface | Real creation, execution, recovery, and lifecycle acceptance remain under [issue #51](https://github.com/vivary-dev/Vivary-New/issues/51), blocked on issue #50 |
| Projects | Managed five-file creation, saved selection, reconnection review, unavailable-folder handling, Windows `43ae417` registration of an existing non-Git folder, and native `250aaa0` chooser timeout recovery | Full populated-folder adoption/apply, conflict-case review, and the remaining setup/pattern journey |
| Files and continuity | Read/Edit/Save/Rename, conflicts, restart draft, completed history, clean shutdown, and project-file search with line navigation included in `250aaa0` | Chat-content search, scoped memory, and remaining restart/draft cases in their owning issues |
| Original Vivary | Bundled ten-verb CLI and packaged Python. Managed creation uses the packaged creator. The Details health check matched headless Doctor in the Windows `43ae417` EXE | Complete GUI/agent flows for every original operation on the final product journey |
| Web and preview | Authenticated Zo preview and `250aaa0` browser checks for project-owned preview retention/clearing and a 390-pixel layout. Native `9884670` confirmed external browser opening | Clean self-hosted setup, responsive real-phone connection, revocation/reconnect, and integrated agent debugging |
| Distribution | Public `9884670` portable prerelease, licenses, checksum, anonymous download verification, Windows process cleanup, and restart. Earlier runtime journeys remain separately recorded | Clean-profile acceptance under [issue #8](https://github.com/vivary-dev/Vivary-New/issues/8), upgrade/removal behavior, the remaining desktop/web journey, and stable-release approval |

The Windows checks used an existing authorized profile. They do not establish a
clean-profile first-run journey. Credentials are never bundled. Claude Code, Codex,
and Native provider accounts remain separate from access to Vivary. The accepted
current distribution may be a versioned archive or an installer. Signing and an
installer are future distribution choices. They are not requirements for the current
Windows milestone.
macOS is later roadmap work outside the active Windows milestone.

## Historical packaging evidence boundaries

The following build and CI notes describe the September 16 candidate. The current `9884670` evidence and the earlier `250aaa0` checks are recorded above.

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
