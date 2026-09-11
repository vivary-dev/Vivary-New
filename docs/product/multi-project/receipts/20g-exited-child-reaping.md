# 20g exited-child reaping receipt

Evidence-record: 20g
Date: 2026-09-08
Verification kind: runtime
Result: Passed the isolated lifecycle proof, canonical source application, and Habitat synchronization.

## Accepted evidence

The reviewed archive `20g/reviewed-evidence.zip` has 46 entries and 2,021,370
bytes. Its SHA-256 is
`1f44d8b80e3924f37763019762cafb9014304cbc236bac8eb49b4dd93ac416b0`.
Every archived file matches its manifest hash. The archive binds the transferred
source bytes, driver versions, test results, exported fixtures, and cleanup inputs.

The old supervisor rejected a zero-exit parent after its child had reached Linux
state `Z`. That state means the child exited and its exit record awaits collection.
The regression verifies the child's state, the parent's zero exit, no timeout,
and the child's absence from `/proc` before asserting acceptance. The red result
fails that acceptance assertion with `accepted: false` and
`orphaned_descendants: true`. It records one expected failure and zero errors.

The correction calls the existing nonblocking reaper for members observed in
state `Z`, then reads the process group again. Remaining members still enter the
existing orphan rejection and cleanup path. The correction adds two lines.
It adds no wait period and changes no deadline, output handler, or kill policy.

## Runtime checks

The accepted green run uses LF source bytes and passes all five selected
`ProtocolTests` methods in 9.949 seconds, with zero failures, errors, or skips.

| Test | Observed requirement |
| --- | --- |
| `test_exited_adopted_child_is_reaped_before_success` | Accept the zero-exit parent after reaping its exited child. |
| `test_closed_pipe_descendant_is_detected_killed_and_reaped` | Reject the live child and preserve the five-second cleanup grace. |
| `test_deadline_stops_stalled_process_group_after_five_second_grace` | Stop the stalled group and verify every recorded PID is absent. |
| `test_iteration_deadline_persists_expiry_and_refuses_clock_reversal` | Preserve expiry and reject clock reversal. |
| `test_iteration_deadline_detects_masked_wall_rollback_and_boot_change` | Reject masked wall-clock rollback and a changed boot identity. |

The runtime selection does not include a separate late-output test. Source review
confirms that the existing late-output handling and acceptance predicate did not
change. The proof made zero model calls and recorded no Linux OOM events.

## Limits and cleanup

The Linux service enforced 256 MiB memory, zero swap, one CPU, and 64 tasks.
Its runtime limit was 80 seconds with a five-second stop timeout. The Windows
Job Object enforced 512 MiB, and the outer command deadline was 90 seconds.
Admission required at least 3 GiB of available physical memory and commit
headroom. The host observer checked physical memory every 250 ms and stopped
the owned helpers below the 1536 MiB reserve.

The driver retained at most 512 KiB of Windows stream output, split between
384 KiB for work and 128 KiB for cleanup. Each control result had a 128 KiB cap.
Fixture exports had a 1 MiB total cap and a 128 KiB per-file cap. Source transfer
and cleanup inputs each had a 2 MiB cap. These are proof limits, not measured
requirements for a Native build or model session.

The LF green run reached 36,483,072 Linux memory bytes and 90,849,280 Windows
job commit bytes. Minimum observed host physical memory was 3,737,563,136 bytes.
The host captured 7,735 stream-output bytes. The host observer and cleanup
reported no failure. Linux memory evidence consists of the enforced cgroup,
its recorded peak, and its event counters.

The final Windows snapshot contains one process, the member supervisor, and zero
active helpers. Settlement took 25.527 ms inside the five-second window. The
Linux service and cgroup were absent. Cleanup removed the packet stage only
after matching every source and fixture byte to the saved export.

The red run's Windows snapshot predates final settlement and records two active
helpers. It establishes the reproduced behavior and Linux cleanup. The accepted
terminal Windows evidence comes from the corrected green run.

## Source and driver provenance

| Source | Red SHA-256 | Accepted LF green SHA-256 |
| --- | --- | --- |
| `tools/hoh_loop.py` | `1ce78b1188a46ec24b22a10df1376460697c733239d0fadc4a383ac9976c74d7` | `db4e77bf86bab62f6c548520673e78772babf17e8b6fc6b021edf16f634c3562` |
| `tools/tests/test_hoh_loop.py` | `ee3a01c8c74a43ae94277b0110bef2ce2b7eb58bc42fd7ade38cf43712974fbc` | `77093dbdc12ecc5aa3614b3df5c18ae40684874c9844169875d7eb7066f6d3ca` |

The test's decoded lines are identical across red and green. Its green bytes are
the exact CRLF-to-LF normalization of the red bytes. Other transferred sources
are unchanged except for the two-line supervisor correction.

The archive keeps `driver/red` and `driver/green` separate. Each matches its own
trial manifest. The historical red driver remains available inside the preserved
CRLF archive, whose SHA-256 is
`2dee1d5fc39928b325ed1835728d6d2efc86763f4f0f18c8dfb8b3bbd2e524eb`.
That archive also preserves the rejected fixture export and the earlier Windows
snapshot. The accepted LF archive includes it once, with no rewritten trial data.

The lead applied the accepted bytes to the canonical tree. The application
record `20g/canonical-application.json` has SHA-256
`6be66f7368adb241f286967688a50b4505cdd445f92f196582c9f25af4633620`.
It binds the accepted archive and verifies both preimages and resulting hashes.
The canonical test preimage was
`b12115e8159b936dd767e648798a57671adf2aec693199a491921bb5e857c9b6`,
before adding the regression. Both resulting canonical hashes match the LF green
column above.

The Habitat application record `20g/habitat-application.json` has SHA-256
`1333f380c0d5e5ded0df57acdf08a31be4c551504398068d8c55d8b4b0bfc768`.
It verifies the same two source hashes after synchronization. Its Windows job
also reports zero active helpers and one member supervisor. Packet 20g is done.

## Trial 12 remains separate

[06e build trial 12](06e-project-selection.md) returned zero and failed its
orphaned-descendant predicate. Its record identifies a child but omits the
child's process state. The state remains unknown. The 20g regression proves
that the supervisor could reject an already-exited child. It does not establish
that trial 12's child had exited.

A later 06e build must establish whether this correction resolves that failure.
This receipt does not accept the build, browser fixture, outcome 20, or live v4
execution. It authorizes no model call, container start, credential change,
publication, or merge.
