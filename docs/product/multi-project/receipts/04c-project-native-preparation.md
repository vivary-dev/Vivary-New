# 04c receipt: Durable project thread preparation

Evidence-record: 04c

Status: Complete for private same-incarnation preparation and controlled Native database fixtures.

## Accepted behavior

The private service records a strict, self-contained authorized intent in the
existing receipt namespace and creates its exact private Native thread once.
It preserves the 04b identity encoding. A candidate becomes prepared only after
both host completion layers and fresh authority validate. Matching replay reads
the verified settlement; conflicting intent, uncertain effects and foreign
incarnations refuse without adopting or retrying Native creation.

Invalid host completion closes admission for the entire service incarnation,
including queued work and final reads. Failed quarantine cannot reopen it.
Cancellation before creation is inert afterward; cancellation after uncertain
creation makes no rollback claim. Registration and creation receipt namespaces
remain compatible, and preparation leaves their creation columns null.

## Observed verification

All 13 named cases passed in 9.243 seconds using Core 0.176.5, Node 22.23.2 and
the existing better-sqlite3 12.11.1 adapter. The outer verifier checked 63 complete
database snapshots and 59 labeled observations, including every column and row,
canonical row hashes and snapshot hashes. The 373366-byte decoded witness has
SHA-256 `d75f1eb3838fa2d9e14c8c94599018cc3984358de56752b9b618c979c3902497`.

Eight stores were compared: Native threads, harness sessions, runs and events,
plus registry projects, bindings, receipts and revisions. Native session, run
and event stores remained empty in every snapshot. Ten schema initialization
witnesses were empty before setup. The fixture initializes Native-owned schemas
through the public chat/session owners and a hash-pinned private run-store schema
initializer. That private seam is fixture-only; no harness or model starts.

The final run verified all three source hashes, twelve dependency hashes and
two Native schema source hashes before/after. Worker cleanup and natural exit
passed. All owned process groups were absent, the exact service was collected,
and all 21 entries in the Habitat stage were removed with no cleanup errors.

The job enforced 512 MiB aggregate Linux memory, zero swap, 64 tasks and one CPU.
Peak memory was 224444416 bytes (214.05 MiB); every memory event counter was zero.
Node heap was 192 MiB. The test deadline was 120 seconds, with a 90-second worker
deadline and 1 MiB combined stdout/stderr capture per supervised phase. Dispatch
budgeted 512 MiB for the Windows transfer/controller and retained 1536 MiB host
reserve. No accounts, credentials, dependencies or runtime defaults changed.

## Corrections and independent review

Source review caught a concurrent admission-closure gap; checks after awaited
work and before final settlement now preserve closure across operations. Two
controlled interleavings and an actual delayed successful Native write exercise
that fix. Fixture corrections centralized subscenario metric deltas while
preserving whole-case zero-effect assertions.

The first behavior attempt passed eight cases before a fixture counter assertion
failed. The second passed all thirteen, but its outer parser omitted Node TAP
escaping. Strict per-chunk decoding fixed the parser; replay verified the saved
rows, then the fresh third run passed every postflight gate. The two earlier
attempts remain failed records inside the final archive.

Astra independently accepted the final source delta, parser correction and all
38 payload hashes in the 39-entry, 659355-byte archive. Archive SHA-256:
`1c8e3fd462914595304212bb474d7fef460b6c08cbeee667ced63f3f0728aff3`.
Exact duplicate cleanup removed 13 files totaling 1868346 bytes, including the
three-file source stage and duplicate prior archives. One private export remains.

## Final source hashes

| Source | SHA-256 |
| --- | --- |
| packages/workbench/server/project-runtime-preparation.mjs | 9d587f9e2045e2e07b6b69e74a6c7c22c4f782090fbce896034d407f96dbf866 |
| packages/workbench/server/runtime-preparation-receipts.mjs | 16c67e8b839b99cd2884a7cf42ccb01b2809bbe3445bbf2ccd375ddd0a23f6c4 |
| packages/workbench/tests/project-runtime-preparation.test.mjs | 1a365a509e15e7fbd1aa972c6bddb7286f50360dd7ee572cce50c852e5c8e814 |

## Remaining work

Production composition remains unavailable. Receipt CAS and same-incarnation
fixtures do not prove process-death fencing or exclusive host custody. Roles
are recorded intent, not real-runtime permission enforcement. Preparation creates
no Native session/run reference and cannot enable 04b activity or scoped chat.

The next dependent 04d contract must admit harness start under fresh authority,
prove exact Native references and handle adapter creation before durable Native
save. Its public-API, role and custody gaps are documented in the current private
proposal; it is not yet an executable packet. The lead continues that contract
while 06e full build/browser and 20a observed runtime work remain open. Parent
outcome 04 and the complete project chat workflow remain incomplete.
