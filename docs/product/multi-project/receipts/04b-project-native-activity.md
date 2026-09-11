# 04b receipt: Exact-project Native run activity

Evidence-record: 04b

Status: Complete for bounded synthetic Native reads and the controlled component.

## Accepted behavior

The read-only Native action resolves one exact thread, harness session and run
from current project authority and a trusted reference. It validates association
and owner fields, then repeats Native, reference, root, registry and authority
checks before returning activity. Missing production composition refuses.
Native continues to own threads, sessions, runs, events and transcripts.

The controlled Conversation consumer uses the installed public normalizer and
renderer. Selection changes, stale responses, revoked access, malformed payloads,
missing transport and oversized activity hide the old output. The display is
Run activity; no composer or runtime control is enabled.

Synthetic fixtures admit at most 256 events and 512 KiB before the public
all-events helper runs. Responses allow 128 items, 8 KiB per item and 256 KiB
including the envelope. Overflow returns activity-too-large without clipping.
This does not bound arbitrary production database reads or provide full history.

## Observed verification

Eight Native cases passed in 9.981 seconds on Core 0.176.5 and Node 22.23.2.
All four Native tables were compared by complete sorted rows and canonical
all-column hashes across four accepted reads. Registry snapshots were unchanged.
All 14 synthetic runs finalized and their retention timers cleared. The worker
exited naturally, its process groups were absent, and the Habitat stage was removed.

Six React/React Query component cases passed in a 20.348-second Windows job.
The compiled manifest records 1419 physical inputs and the three public Core
entry hashes. The fixture uses controlled hooks and inert LinkeDOM browser shims;
it preserves the actual public Native renderer. MessageChannels were closed,
the worker exited naturally, active job processes reached zero, and its exact
temporary module directory was absent without supervisor cleanup.

The Native job enforced 512 MiB aggregate memory, zero swap, 64 tasks and one
CPU. Peak was 248987648 bytes with no OOM event. Node heap was 192 MiB, with
90-second test and 2 MiB combined stdout/stderr capture limits. Dispatch budgeted another 512 MiB for
the Windows parent/transfer outside the cgroup and retained 1536 MiB host reserve.

The component job enforced 768 MiB aggregate commit, four active processes,
10 percent CPU and 60 seconds. Peak commit was 532873216 bytes. Its combined
capture bound was 4 MiB, Node heap 192 MiB, and the separate Python allowance
128 MiB. Dispatch retained the same 1536 MiB host reserve. Six total processes
over the job lifetime is a diagnostic, not its maximum concurrent count.

## Corrections and independent review

Earlier attempts exposed fixture counter/timer errors, bundler and data-URL
memory pressure, missing LinkeDOM state, and a split TAP manifest line. The
corrected fixture stops esbuild before importing an exact temporary file and
closes its resources. The driver joins only the observed manifest continuations.
The final ordinary run passed; it does not depend on a post-hoc reclassification.

Independent review required removal of a premature generic string cap that
masked the semantic byte refusal, plus complete Native row evidence. Both
changes passed the fresh Native and component runs on identical final sources.
Astra accepted the final delta with no remaining findings and checked all 65
payload hashes in the 66-entry, 2389916-byte archive. SHA-256:
`9d895e21ef19f57b2bdad06f886c145d086f35727babbe8c7b6890d0100320a0`.

The earlier incomplete archive is retained inside it. Exact cleanup removed
25 byte-verified duplicate files totaling 3397453 bytes, including the seven-file
source stage and the duplicate prior archive. Only the final private export
remains; shared dependencies and existing checkouts are retained for reuse.

## Final source hashes

| Source | SHA-256 |
| --- | --- |
| packages/workbench/app/components/workbench/Conversation.tsx | 5d88866de600339716c5025d601c1ccfd20523023e7c66bd44dfcc91e729df14 |
| packages/workbench/app/lib/runtime-activity-schema.ts | 2d87f343817a6c160ce5888c1f76551471391a2ba221d98ec012a3400efab5ba |
| packages/workbench/server/project-runtime-activity.mjs | 38bcb3ccab13b91330cba0968d790291a1505f77ba284dff6a3d95f475d62c58 |
| packages/workbench/tests/native-http-dependency-loader.mjs | b68f61aac85f3af917758bb20a89f0ef27f636d5bb8dcab16a57257297be588d |
| packages/workbench/tests/project-runtime-activity.test.mjs | 1185f1d7fa820a6db47beed47d1d93484d58db11cd3c810a13c6c7c072252406 |
| packages/workbench/tests/runtime-activity-component.test.mjs | b1b087e934e971e2892209ac77ed488564da7ffd512edffdbebc4dcc89b499b5 |

## Remaining work

Production reference provenance, lifecycle, role enforcement, complete history,
a public bounded Native event read, full build/typecheck, browser acceptance and
cross-runtime proof remain open. [04c](../packets/04c-project-native-preparation.md) now owns durable start intent
and exact private thread creation under the reviewed host-settlement contract. 04d must separately admit a harness start and handle
the observed pre-save adapter-session uncertainty. Outcomes 04 and 06e stay open.

Capture-limit correction: adapting the accepted driver exposed that its actual
ceiling is 2 MiB combined stdout/stderr, rather than the earlier 1 MiB per-stream
description. Both observed streams are below 1 MiB. Independent review accepted
this documentary correction without rerunning the unchanged fixture; the archive
and driver hashes remain unchanged. The next 04c driver enforces 1 MiB combined.
