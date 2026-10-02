# Windows coding descendants after Stop

Issue [#133](https://github.com/vivary-dev/vivary/issues/133) records the Windows
process ancestry gap. This receipt separates automated proof, scanner cost,
and packaged acceptance.

## Behavior

The Code host observes descendants while a run is active and retains their PIDs
and creation times after a parent exits. Each scan starts one second after the
previous scan completes. Scans never overlap. Stop cancels active observation,
terminates the worker tree, and checks the recorded identities even if the tree
termination command succeeded. Immediately before final verification, it saves
the accumulated cleanup target so a restart during that scan retains the
refusal. A clean scan lifts the temporary refusal.

The existing cleanup strip names survivors. End them acts only on listed
identities traced through observed live ancestry and checks the PID and creation
time again before ending a process. A possible relationship through historical
ancestry alone does not authorize termination.

## Automated proof

The first test-only commit, `d2b7f27f`, recorded three expected failures for lost
ancestry, PID reuse, and survivors after a successful tree stop. The second,
`0921607d`, adds the independent review case for saving cleanup state before a
final scan and replaces the pending check's failure wording with neutral text.
All 44 host tests and 25 cleanup-refusal tests pass, and `pnpm typecheck` exits
successfully. Nine targeted mutations fail at their intended behavioral or text
assertions. Passing controls and a final unchanged source check separate those
results from a superseded private harness attempt. Independent review found the
pre-scan persistence gap, which is now fixed. The next round found no remaining
production issue, and its documentation timing correction is closed.

## Scanner cost

On 2026-10-02, 20 sequential scans through bundled Node v24.19.0 observed
428 to 442 Windows processes. Timing includes PowerShell startup, the CIM query,
output transfer, and the production parser.

| Measurement | Time |
| --- | --- |
| Median | 899.405 ms |
| 95th percentile | 1,125.661 ms |
| Maximum | 1,134.342 ms |

The private measurement copied the unchanged scanner from commit `d2b7f27f`.
The source file blob in that commit is
`ac20ed5eb0dbf72cc0a144602750441b020b958c`. The copied scanner region matched it.
No raw process rows were retained. These measurements describe scanner latency
under the laptop's load at the time. They do not measure CPU consumption, active
app overhead, or stress conditions. At the measured median, a one-second delay
after completion implies about 1.90 seconds between scan starts.

## Packaged Windows acceptance

A new package with this change has not yet completed acceptance. The planned
journey uses the production Code worker and scanner with an external synthetic
CLI. It starts an intermediary and a real detached child, waits for the
intermediary to exit, then exercises Stop and End them through the app. A
separate process using the same executable serves as the positive control.

## Limits

- An ancestry chain formed and lost entirely between observations can be missed.
  Failed periodic scans keep prior identities and retry, so failures lengthen
  the observation gap.
- Active observations live in memory until final cleanup verification begins.
  An abrupt host exit before that point can lose them, including during tree
  termination.
- The host retains at most 200 tracked identities and 200 traced identities.
  Overflow or an unavailable final scan refuses another Code run.
- The query requests only PID, parent PID, creation time, and process name.
  It never requests command lines, paths, or owners.
- This work does not use Windows Job Objects.
