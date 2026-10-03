# Desktop quit and Windows crash cleanup

Date: 2026-10-03. Issue: [#138](https://github.com/vivary-dev/vivary/issues/138).
Tested runtime source: `d8cb7665a2d09a0ab46af137db25938ca0f23c8f`.
Base: `c17a8cae993d6abb3a87c4949b2a047abb462224`.

**Blocked: normal quit passes, but an unexpected server exit leaves an actual preview tree alive.** The [server-first P1](https://github.com/vivary-dev/vivary/pull/173#discussion_r4171749360) remains unresolved. This receipt is not merge or release acceptance.

## Candidate and normal quit

Zo built Workbench from clean source, checked the real built server, and packaged Windows x64 from that same revision. The built server exited normally in 18.29 ms. Browser access, owner sign-in, and hosted MCP application checks passed. The ZIP is 222,625,228 bytes with SHA-256 `b7b387d1209098bea4b1c0d7fa62a54052653119902ee06f52523b743aef762a`. Transfer hash, archive bounds and packaged source metadata passed. Metadata reports clean source, zero overlays and a matching source snapshot. Workbench output remains marked prebuilt with `sourceCommitVerified: false`. The separate clean-source build receipt supplies that relationship. Runtimes are Node 24.19.0, Electron 44.3.0 and Python 3.12.14.

| Fresh d8cb7665 journey | Main exit | All observed package processes gone | Result |
| --- | ---: | ---: | --- |
| Idle, normal window close | 302.63 ms | 607.83 ms | Passed |
| Active scheduled run, normal window close | 391.24 ms | 634.77 ms | Passed |
| Active webhook, normal window close | 443.78 ms | 729.21 ms | Passed |

The schedule and webhook used separate fresh profiles. Each check required a real running automation and linked running agent plus an open response stream before closing the app. SQLite then recorded the same run as interrupted and the agent as aborted for shutdown. The scheduled run lease was deleted, with no held lease remaining. The same webhook task returned from processing to pending, refunded its claimed attempt from 1 to 0, kept its dispatch count, and had no completion time. The held response was synthetic and loopback. Application dispatch, persistence and shutdown were real. No provider or tool side effects are claimed.

The first scheduled attempt stopped in its read-only observer before active-run proof because the fresh profile had not created its lazy automation tables. Later inspection of the same database confirmed their creation. The observer now treats only missing startup tables as empty collections. It still requires a running run and agent before quit and every persisted outcome afterward. That failed attempt and its cleanup remain recorded separately. An unexecuted webhook attempt sharing the scheduled profile was canceled to avoid ambiguous stream attribution.

## Reproduced server-first failure

The actual packaged application revalidated an existing registered test root through its supported GET catalog route. Its original directory and grants were unchanged. The approved preview action started a real pnpm script, which started a Node HTTP preview and an ordinary non-detached Node child. The same server also ran a real Code worker connected to an offline synthetic Codex CLI. Its original-runtime adapter started the actual bundled Python catalog command, briefly suspended by the existing bounded external observer.

After recording the live process identities, the observer terminated only the server. It did not use a tree kill or terminate Electron for this observation. Electron was still alive five seconds later.

| Process class | State after 5,004.02 ms |
| --- | --- |
| Desktop server, pnpm launcher and command shell | Gone |
| Code worker and synthetic CLI | Gone |
| Bundled Python command | Gone |
| Actual preview Node and its non-detached Node child | **Still alive** |
| Two related console hosts | Still alive |

The preview chain was server -> pnpm -> command shell -> preview Node -> Node child. The Python observer recorded exit 558 ms after suspension, before its 60-second resume deadline and the command's 30-second deadline. The process-tree result itself is the failure evidence. The observer's final wrapper exit was confirmed separately during cleanup.

Libuv's per-process job protects direct non-detached children, but that did not clear the complete shell-launched preview chain in this observation. The test does not establish that detaching the server introduced this failure compared with the earlier launch configuration. It does establish that the current package fails server-first descendant cleanup. [Pinned Node implementation](https://github.com/nodejs/node/blob/v24.19.0/deps/uv/src/win/process.c#L65).

Proof and failure receipts were written before manual cleanup. That separate cleanup removed the recorded survivors, closed the owned Electron process and confirmed observer exit. It is not product cleanup evidence. The original five fixture files retained their hashes. Six temporary fixture files were removed. Three pnpm-generated files were copied to private evidence, hash-checked and removed by exact path. The original registered directory and grant remained intact. The synthetic CLI mode was restored.

## Regression and CI evidence

The launch correction follows a separate behavioral regression that exercised the real fork call. It first produced 19 passes and one failure at the Windows detachment assertion, then all 20 cases passed. Independent source and documentation review found no actionable issue before the new native crash observation.

Native Windows [job 111130614007](https://github.com/vivary-dev/vivary/actions/runs/37097593805/job/111130614007) passed all 13 lifecycle cases, including controlled pending and rejected cleanup, real tree kills, parent loss before and during shutdown, successful cleanup, and a root-only-kill control requiring its detached descendant to survive. Its combined suite had 25 passes and one unrelated skip. Earlier targeted mutations detected missing fallback creation, missing tree dispatch and parent loss after a prior shutdown request. These controlled cases do not substitute for packaged preview cleanup.

The same clean source passed the selected Zo guards, workbench and maintained waves. The site wave failed only its dependency audit. The GitHub run had eight successful jobs and a failed site job. The separate [PR #176](https://github.com/vivary-dev/vivary/pull/176) proposes a temporary GHSA exception, not a dependency fix. Its separate owner approval is not supplied by this work. No audit waiver was applied here.

## Remaining work and handoff

The bounded wave ends at a reproduced source defect. Normal quit with an active real preview and active-preview cleanup after abrupt Electron loss were not run. The new P1 remains open. A clean earlier observation of idle parent loss cleared all seven package processes in 384.85 ms, but it does not establish either active-preview journey.

The next owner must choose and review a source fix for server-first preview cleanup, add the failing regression before that fix, and repeat the failed case with both preview processes gone while Electron remains observable. Preserve the original PID identities and record the outcome before any manual cleanup. Then rebuild the exact candidate and complete active-preview normal quit and parent-loss checks, along with normal automation persistence, final CI and review. The existing registered test root is usable. A native chooser is not the blocker. Its earlier POST-to-405 helper error was corrected to the supported GET route.

All test processes and the external observer were closed. Private receipts, logs, script versions and checksums retain the observations. The controller owns the next source-fix and merge decision and the final supported local Entire capture refresh. The existing checkpoint recorded at 03:29 UTC does not cover this later validation. No merge, release, deployment or branch deletion occurred.

## Historical 5ce5468c acceptance

The following observations retain their original candidate boundary.

Date: 2026-10-02, America/Denver. Active Windows checks ran on October 3 UTC.
Issue: [#138](https://github.com/vivary-dev/vivary/issues/138)
Candidate source: `5ce5468c95f3858dce712b89fb4fa135f916fb45`
Base: `c17a8cae993d6abb3a87c4949b2a047abb462224`

### Change and candidate

The dedicated desktop launcher sets the existing standalone process marker before loading the server. Its lifecycle exits after local-work cleanup and, on success, Nitro close. On this candidate, rejected cleanup waited for other stops before exiting with failure. Hosted lifecycle ownership stays with its host. The desktop's 15-second fallback remained configured, but review subsequently found that Windows failure exit could remove the live server PID needed by `taskkill /T`. Windows failure-fallback preservation remains pending. The [Windows fallback review](https://github.com/vivary-dev/vivary/pull/173#discussion_r4170897427) and [owner handoff](https://github.com/vivary-dev/vivary/pull/173#issuecomment-5964016108) track the separate correction. The successful normal-quit observations below remain evidence for this candidate. This candidate includes the merged #139 scheduler lease patch.

Zo built Workbench and packaged Windows x64 from the same clean source. The ZIP is 222,623,411 bytes with SHA-256 `d8952c3b4c141824ffb3d2d12804f1c82b5d031fb52e30ab486068946f7ae1f3`. Archive integrity passed. Metadata records `sourceDirty: false`, zero tracked overlays, and `commitMatchesPackagedSource: true`. Node is 24.19.0, Electron 44.3.0, and Python 3.12.14. Workbench output remains `prebuilt` with `sourceCommitVerified: false`. The separate clean-source build record supplies that relationship. The verified candidate is a private preview with no release publication.

### Windows observations

Normal window close requested quit. Timing starts at that request. The observer followed candidate process identities.

| Journey | Main process exit | All observed candidate processes gone |
| --- | ---: | ---: |
| Earlier `042dce25` idle baseline | 16,359.15 ms | 16,687.44 ms |
| Combined `5ce5468c` idle | 4,181.73 ms | 4,456.45 ms |
| Combined `5ce5468c` active scheduled run | 329.85 ms | 582.87 ms |
| Combined `5ce5468c` active webhook run | 309.92 ms | 559.27 ms |

Every combined observation ended with no surviving candidate process. These measurements establish the named runs, rather than a close-time guarantee. Before both active quits, SQLite held actual running automation and agent rows, and the local gateway recorded an open response stream. Its stream closed during shutdown.

After scheduled quit, the same run was `interrupted` with `background_automation_interrupted` and a non-null finish time. Its agent was `aborted` for `shutdown`. The run lease was deleted. The global scheduler lease's owner and expiry fields were null before and after quit. This observes #139's run-lease release at quit, without establishing its complete two-automation Windows journey.

After webhook quit, the same run was interrupted with that error and its agent aborted for shutdown. The same task changed from `processing` to `pending`. Its `attempts` changed from 1 to 0, refunding the claimed attempt. `dispatch_attempts` stayed 1 and `completed_at` stayed null. This matches Core's existing quit regression that requires a normal quit not to spend an attempt.

### Fixture corrections and verification

The first webhook evidence helper incorrectly required an equal attempt count and reported a false failure. It was corrected against `packages/workbench/tests/automation-quit.test.mjs`, in the case that returns an interrupted webhook call to the queue. Read-only validation of the recorded before and after states passed for both journeys. A control removing persisted interruption was rejected. No application fix or repeated provider call was needed for this correction.

An offline schedule-pause helper failed before mutation because its requested `closeDbExec` export was absent. Pause was not verified, and the schedule remained enabled. The webhook was created and closed before the next launch's first scheduler tick. The recorded state showed one current active webhook run and the previous scheduled run already interrupted.

The actual built server exited normally in 62.09 ms on `5ce5468c`. Three hosted application checks and 43 targeted regressions passed. GitHub reported nine jobs green on that revision, and Entire trail98 recorded one approval. Final CI on the later acceptance documentation commit remains pending and must be reported separately.

### Evidence boundary

The held Builder response was synthetic and loopback. Application startup, SQLite writes, dispatch, interruption, requeue, lease release, and Windows shutdown used the real packaged application. No real provider or tool side effects are claimed. Stuck Windows cleanup was not exercised. The existing controlled regressions did not establish preservation of the Windows fallback after cleanup rejection. That review finding requires separate regression coverage and acceptance.

Webhook relaunch and redelivery, full #139 Windows acceptance, and #140 and #141 remain separate. Historical receipts retain their named-candidate evidence. This receipt does not establish a finished desktop release. Package records, process observations, SQLite snapshots, gateway logs, and corrected validation stay private. No private host path, profile identity, credential, or raw webhook payload is included here.

## Historical parent-loss correction evidence

The complete earlier section below records the boundary investigation before the fresh d8cb7665 packaged journeys. Its pending-acceptance statements describe that earlier point in the work. The current results and unresolved server-first defect above supersede those status statements. The failed native cases and fork comparison remain evidence.

### Subsequent Windows parent-loss correction

The first parent-loss implementation passed 12 Zo cases and three targeted mutations, but its three new native Windows cases failed. Windows killed the non-detached fixture server when its intermediary parent died, before cleanup could run. The fixture now detaches its server and descendant on Windows. A negative control must leave the descendant alive when only the server is killed. Native Windows execution remains a distinct gate.

A controlled native Electron comparison then found the same problem in the production launch options. It used an unchanged copy of the packaged Electron 44.3.0 executable, SHA-256 `c86ca45c26e900916a285830bb6c2a84716d1a60266046777ce5bc399b05df87`, ordinary Node 24.19.0, and owned fixture processes. Killing only the Electron parent with the previous launch options killed the server before its disconnect callback. The detached descendant survived. With server detachment enabled, disconnect was recorded, both processes remained alive one second later, and the real 15-second self-tree fallback removed both by 15,444.20 ms. Recorded fixture processes were checked and cleared after each case.

The production correction detaches the server on Windows while preserving IPC, hidden windows, the normal parent fallback and its PID guard. These fixture observations establish the Windows launch boundary and tree operation. Fresh packaged idle, scheduled, webhook, preview-descendant and parent-loss acceptance remain pending. No synthetic dependency response is claimed as a real provider response.
