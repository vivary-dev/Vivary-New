# 04d receipt: One synthetic Native first start

Evidence-record: 04d

Status: Complete for the private synthetic Native composition.

## Accepted behavior

An exact current preparation admits at most one first Native start. The new
receiving seam holds the preparation operation through consumption and final
revalidation. Callback handles expire when that invocation closes. The start
receipt binds the prepared thread, scoped identity, adapter configuration and
allocated Native session/run IDs. Only a verified settlement exposes the exact
seven-field activity reference.

Malformed input, revoked authority, changed preparation, collisions and foreign
incarnations refuse. Uncertain effects quarantine the operation and suppress
retry and reference resolution. Closing preparation admission while a start is
pending now quarantines the start receipt. Failed quarantine cannot reopen
admission. Retained, early, repeated and substituted host callbacks cannot create
an additional Native effect.

## Observed verification

Verified: 2026-09-09 UTC.

The final Habitat run passed all 13 unchanged preparation cases and 12 start
cases, with no failed, skipped, cancelled or todo tests. It used installed Core
0.176.5, Node 22.23.2 and the existing SQLite adapter. The outer verifier
recomputed every Native delta from complete database rows across eight stores.
Preparation produced 63 snapshots and 59 observations. Start produced 148
snapshots and 150 observations.

The positive start produced one session, one completed run and four exact events,
with no additional thread. Early callbacks produced no start receipt or Native
effect. Repeated and substituted callbacks produced one bounded start followed
by host-invalid quarantine. Retained callbacks rejected after healthy completion
with identical database snapshots after drain. All eight host modes left identical
SQL state between their final observation and the next fixture reset. The
pending-start closure regression retained effect-uncertain quarantine, and replay
left every store and all seven effect metrics unchanged.

The start witness retained 1680003 decoded bytes in a 156724-byte gzip/base64
envelope. Strict decoding checks the raw length and SHA-256, compressed stream
completion, and absence of trailing data. The existing output limits remain.
Raw witness SHA-256:
`4f8495c02e39e89e8348b9a7f10b78f6dbfb189fa8bf8fe4749e572dcd2a1dee`.

## Resources and cleanup

The supervised run took 79.095 seconds. Linux enforced 512 MiB aggregate memory,
zero swap, one CPU and 64 tasks. Peak memory was 252674048 bytes and all memory
event counters were zero. Each Node heap was limited to 192 MiB. The Windows
driver declared a 512 MiB allowance for admission. That allowance was not an
enforced Windows Job cap. The host reserve was 1536 MiB.

The proof used the existing BOOTTIME supervisor, bounded per-phase deadlines and
1 MiB combined output capture. Both workers exited naturally. All 54 completion
drains and owned retention timers settled. The service, cgroup, process groups
and exact Habitat stage were absent afterward. Original Habitat product inputs
were unchanged.

## Corrections and independent review

Eighteen earlier attempts remain failed evidence. Corrections repaired fixture
API assumptions, strict receipt expectations, host callback invocation, bounded
witness encoding and TAP stream ordering. Trial17 exposed the pending-start
closure bug described above. Trial18 passed behavior assertions but its witness
transport interleaved two output streams. One ordered parent write preserved
both streams and the final trial19 passed all verifier gates.

Astra independently verified every archive payload hash and reparsed both raw
TAP witnesses using the archived validators. The decoded witnesses and summaries
matched the final result. Source review and actual evidence review found no
blocking issue within this packet's synthetic composition scope.

The accepted archive contains 45 entries and 621879 bytes. Its SHA-256 is
`47d2bbdf7d9cd2f69406f8676440d93a1a8e409f29027d7b1d419981cd61e3ce`.
The lead applied the four exact accepted source files to the canonical checkout
and verified their hashes. After the accepted 06e browser proof released its
build binding, the lead applied the same four files to Habitat on 2026-09-09.
The bounded copy checked every absent/original preimage before writing, then
verified all four postimage hashes. Its helper exited with zero active helpers.
This records source application, not a new runtime acceptance. One accepted archive,
the failed attempts and the small proof source/export stage remain private until
that dependency reconciliation and authorized duplicate cleanup finish.

## Accepted source hashes

| Source | SHA-256 |
| --- | --- |
| packages/workbench/server/project-runtime-preparation.mjs | `f11c4f210c925d1f42cb933186e781d58bb3fad41c2b8e4fa937414c19424c99` |
| packages/workbench/server/project-runtime-start.mjs | `eecf99a3ecc0176a0ccc9d2b334e8b233c144dee0fe78cc37dc28b045acf94cd` |
| packages/workbench/server/runtime-start-receipts.mjs | `2377dd43b0f8cc096da0336f818e7c19082be24774347d892b910f12a59583d3` |
| packages/workbench/tests/project-runtime-start.test.mjs | `338217aaa879764c75438cf62bff2c3cc1aac12ef81e428387ad021415b41044` |

## Remaining work

Parent 04 remains open. Production host fencing, a real runtime adapter, scoped
project chat, GUI launch and external-runtime stop/quiescence require subsequent
packets. This fixture makes no model call, configures no production runtime and
does not change Native defaults. The outcome contract and generated frontier own
the next implementation work.
