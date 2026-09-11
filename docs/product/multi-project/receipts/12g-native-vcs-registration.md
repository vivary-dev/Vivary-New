# 12g receipt: Live Git references in Native registration

Evidence-record: 12g

Status: Complete for the bounded Linux registration boundary.

Verified: 2026-09-09.

## Accepted behavior

The existing Python observation wire now carries strict no-VCS or Git application
references. The Node receiver validates that union, and the Native facts resolver
passes the observed repository, checkout and mutation-owner values to the existing
registration action. Missing, extra, malformed or contradictory fields refuse.
The private protocol remains version 1. An old child that omits VCS fields fails
closed. The existing inspect refusal remains unchanged.

Ordinary and nested Git projects share the expected repository and checkout IDs.
Linked worktrees share the repository ID and retain distinct checkout IDs.
No-VCS roots retain null VCS values. Aliased roots deduplicate through the existing
decision engine. Registration does not initialize Git, change project files,
start a runtime or grant mutation authority.

The actual Native SQLite proof checks complete project, binding, receipt and
revision rows before and after each operation. Current grants, exact folder
custody and live application identities remain required. Changed authority,
replaced Git administration, unresolved identities after provider restart and
forged action fields refuse. Identity comparison inside the transaction prevents
a changed observation from committing the earlier request.

## Observed verification

Trial05 passed all 56 tests without skips:

| Suite | Tests |
| --- | ---: |
| Native VCS registration | 1 |
| Root-provider VCS wire | 3 |
| Existing Native registration | 6 |
| Existing root-provider reads | 2 |
| Core lifecycle, reads and VCS identity | 44 |

All five tool, argument and installed-Native preflights also passed. Independent
review replayed the archived validators against 14 Native operation witnesses
and 14 Core witness records covering 49 identity operations. The Native witness
contains five projects, five bindings and six receipts, with alias deduplication.
The Core evidence retains the explicit foreign-observer branch injection and
administration-replacement fixture limits from 12e. It does not prove arbitrary
cross-process races or remount behavior.

The proof used the existing Habitat checkout and pinned installed dependencies.
It invoked real Python/Git observation, the actual stdio boundary and Native
SQLite in disposable fixtures. No model, account credential, network Git,
production runtime, new container or dependency installation was involved.

## Resource and cleanup evidence

Windows and Linux each had an enforced 512 MiB aggregate job limit. Linux used
zero swap, at most 64 tasks and one CPU. Node heaps were capped at 192 MiB.
Admission required 2.5 GiB available host memory, with a 1536 MiB reserve during
execution. Each workload phase had a 180-second limit. The service and host limits
were 940 and 980 seconds, with 70 seconds reserved for cleanup. Phase output was
bounded at 1 MiB and the final evidence export at 8 MiB.

Peak Windows commit was 27,377,664 bytes. Peak Linux memory was 250,761,216 bytes.
All OOM and PID-limit counters remained zero. The Windows observer recorded 209
samples, a maximum 351 ms gap and minimum available physical memory of
2,896,867,328 bytes. No observer failure occurred.

All ten phase process groups were absent. The exact inventory contained 162
entries, including 129 files and 33 directories totaling 128,104,243 file bytes.
Export, a second identical inventory and the removal allowlist matched before
cleanup. The stage was removed. Independent final checks verified the service
was not found, the cgroup was absent, and the stage was absent. No Windows helper
remained and no helper required forced settlement. Host, runtime, owner and
archive receipts all passed.

## Evidence and source application

Lead and independent Astra review accepted the 107-entry, 1,233,796-byte private
archive at `.tmp/hoh-proof/12g/reviewed-evidence.zip` in the preserved Littleagent
checkout. All 105 payload hashes match. Archive SHA-256:
`e4d564cae2172392c241840268f54679ea153570eb8206b58f177ec0cd34b3b8`.

The archive binds all 76 snapshot sources, installed dependencies, drivers,
exact outputs, full witnesses and cleanup evidence. Its snapshot manifest is
`86456af927647174ca2d01acbc4e2649e2405d33535804d87f1970c7c19c857c`.

The five accepted files match canonical and Habitat. The independently reviewed
copy checked each frozen Habitat preimage before writing and verified every
resulting hash. Its bounded helper closed with zero remaining processes.

| Source | SHA-256 |
| --- | --- |
| packages/core/vivary_core/root_provider_stdio.py | 651a5cd466ec0f4e283aa06916183ff39b9f3945b4d2e12e60a5b4817c5b192d |
| packages/workbench/server/native-registry.mjs | ae151975f767301f25eff7956da6b06e87cadbaeafc3a9de57188e2af7da56be |
| packages/workbench/server/root-provider.mjs | 4f8a1480033bdf2263492d2af1e64a557de118d9ab6ed11720165010165287e4 |
| packages/workbench/tests/native-vcs-registration.test.mjs | dc8f77731220531677c3053a28b18a74f62a5e17385d47c7c04a713c0f029730 |
| packages/workbench/tests/root-provider-vcs.test.mjs | 8cd570016daf160ced50030f83977e5021878806d896bce8e6cd9d091703ec7b |

Four earlier failed archives remain preserved. Trials01 and02 stopped during
setup. Trial03 exposed the missing nested Git layout in the wire adapter.
Trial04 passed all tests but failed its Windows cleanup contract after redundant
stop/reset commands forced console helpers. Trial05 is the accepted run.

After the accepted source copy, the lead retired 102 byte-verified local files
totaling 7,723,216 bytes. These were the Native proof duplicates, five private
source copies, review JSON and one generated Python cache. The cache was exported
and verified separately before removal. The success and failure archives remain.

## Remaining work

Outcome 12 remains open. Windows and Jujutsu identity, automatic reconciliation,
production integration and shared-repository mutation enforcement are unproved.
These registration references do not grant runtime activation or project writes.
Continue the executable graph frontier. No push, merge or publication occurred.
