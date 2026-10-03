# Desktop process exit after normal cleanup

Date: 2026-10-02, America/Denver. Active Windows checks ran on October 3 UTC.
Issue: [#138](https://github.com/vivary-dev/vivary/issues/138)
Candidate source: `5ce5468c95f3858dce712b89fb4fa135f916fb45`
Base: `c17a8cae993d6abb3a87c4949b2a047abb462224`

## Change and candidate

The dedicated desktop launcher sets the existing standalone process marker before loading the server. Its lifecycle exits after local-work cleanup and, on success, Nitro close. On this candidate, rejected cleanup waited for other stops before exiting with failure. Hosted lifecycle ownership stays with its host. The desktop's 15-second fallback remained configured, but review subsequently found that Windows failure exit could remove the live server PID needed by `taskkill /T`. Windows failure-fallback preservation remains pending. The [Windows fallback review](https://github.com/vivary-dev/vivary/pull/173#discussion_r4170897427) and [owner handoff](https://github.com/vivary-dev/vivary/pull/173#issuecomment-5964016108) track the separate correction. The successful normal-quit observations below remain evidence for this candidate. This candidate includes the merged #139 scheduler lease patch.

Zo built Workbench and packaged Windows x64 from the same clean source. The ZIP is 222,623,411 bytes with SHA-256 `d8952c3b4c141824ffb3d2d12804f1c82b5d031fb52e30ab486068946f7ae1f3`. Archive integrity passed. Metadata records `sourceDirty: false`, zero tracked overlays, and `commitMatchesPackagedSource: true`. Node is 24.19.0, Electron 44.3.0, and Python 3.12.14. Workbench output remains `prebuilt` with `sourceCommitVerified: false`. The separate clean-source build record supplies that relationship. The verified candidate is a private preview with no release publication.

## Windows observations

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

## Fixture corrections and verification

The first webhook evidence helper incorrectly required an equal attempt count and reported a false failure. It was corrected against `packages/workbench/tests/automation-quit.test.mjs`, in the case that returns an interrupted webhook call to the queue. Read-only validation of the recorded before and after states passed for both journeys. A control removing persisted interruption was rejected. No application fix or repeated provider call was needed for this correction.

An offline schedule-pause helper failed before mutation because its requested `closeDbExec` export was absent. Pause was not verified, and the schedule remained enabled. The webhook was created and closed before the next launch's first scheduler tick. The recorded state showed one current active webhook run and the previous scheduled run already interrupted.

The actual built server exited normally in 62.09 ms on `5ce5468c`. Three hosted application checks and 43 targeted regressions passed. GitHub reported nine jobs green on that revision, and Entire trail98 recorded one approval. Final CI on the later acceptance documentation commit remains pending and must be reported separately.

## Evidence boundary

The held Builder response was synthetic and loopback. Application startup, SQLite writes, dispatch, interruption, requeue, lease release, and Windows shutdown used the real packaged application. No real provider or tool side effects are claimed. Stuck Windows cleanup was not exercised. The existing controlled regressions did not establish preservation of the Windows fallback after cleanup rejection. That review finding requires separate regression coverage and acceptance.

Webhook relaunch and redelivery, full #139 Windows acceptance, and #140 and #141 remain separate. Historical receipts retain their named-candidate evidence. This receipt does not establish a finished desktop release. Package records, process observations, SQLite snapshots, gateway logs, and corrected validation stay private. No private host path, profile identity, credential, or raw webhook payload is included here.

## Subsequent Windows parent-loss correction

The first parent-loss implementation passed 12 Zo cases and three targeted mutations, but its three new native Windows cases failed. Windows killed the non-detached fixture server when its intermediary parent died, before cleanup could run. The fixture now detaches its server and descendant on Windows. A negative control must leave the descendant alive when only the server is killed. Native Windows execution remains a distinct gate.

A controlled native Electron comparison then found the same problem in the production launch options. It used an unchanged copy of the packaged Electron 44.3.0 executable, SHA-256 `c86ca45c26e900916a285830bb6c2a84716d1a60266046777ce5bc399b05df87`, ordinary Node 24.19.0, and owned fixture processes. Killing only the Electron parent with the previous launch options killed the server before its disconnect callback. The detached descendant survived. With server detachment enabled, disconnect was recorded, both processes remained alive one second later, and the real 15-second self-tree fallback removed both by 15,444.20 ms. Recorded fixture processes were checked and cleared after each case.

The production correction detaches the server on Windows while preserving IPC, hidden windows, the normal parent fallback and its PID guard. These fixture observations establish the Windows launch boundary and tree operation. Fresh packaged idle, scheduled, webhook, preview-descendant and parent-loss acceptance remain pending. No synthetic dependency response is claimed as a real provider response.
