---
type: packet
---
# 24c: Inspect and exercise pinned Zvec direct search
Parent: 24
Status: in-progress
Depends-on: [24b]
Owner: Astra accepts; Sol implements the isolated candidate; Terra independently reviews source and runtime evidence.
Scope: One private Habitat Node/npm stage, pinned local package installation and disposable direct-rg query. No repository indexing, model calls, shared helper changes or product integration.
Verification-kind: runtime
Verification-result: pending
Evidence: [Zvec direct-search receipt](../receipts/24c-zg-direct-search.md)
Timebox: One corrected private-toolchain request with 600 seconds including refusal and cleanup. Private trials: two requests/1,200 allocated seconds; all 24c phases: eight requests/2,580 allocated seconds. All eight requests are consumed; no automatic retry.

## Current progress

The corrected private trial ran at 01:16 UTC on 2026-09-11. Cold and warm
admission passed, with 4,719,230,976 bytes available physical memory after Habitat
activation. Toolchain staging and preparation passed. The copied tree matched the
known ownership mapping; restoration reproduced the complete original Node
metadata and all 2,464 npm entries, followed by sealing and read-only verification.

Installation launched but the Linux heartbeat guard failed. Its captured output
says `Windows heartbeat stopped`; the dispatcher received one failure line rather
than its expected two-line framing. Installation completion and partial state are
unknown. Query never launched and no model call ran. The Windows owner recorded
an observer gap of 5,784 ms and forced 43 members. The cause of the pause is not
established; this is not evidence of a package timeout.

Independent review rejects runtime and clean settlement. All three named units
and cgroups are absent, both stages are retained, and all 46 recorded process
identities are absent. One numeric PID was reused by an unrelated Node process;
that process is not task-owned cleanup. Windows peak was 45,211,648 bytes under
512 MiB, with zero remaining helpers. Process absence does not erase forced
settlement. Eight 24c requests are consumed, with 2,580 allocated seconds across
their separate phases. No retry is authorized by this exhausted source packet.

## Goal

Run the released `zg query --mode direct --rg` command against one disposable
text fixture without loading a model or creating an index. Prove actual CLI
startup, expected output, resource boundaries and cleanup before considering
another retrieval mode or product integration. The existing preserved search
evaluation owns the research and source-owner findings.

## Context

Keep Tropo as the graph, type and record owner. Plain `vivary find` uses Tropo's
Python record ranking; workspace `rg` is a separate developer tool. This packet
does not add an adapter, backend selector or new graph. The parent
[documentation outcome](../tickets/24-write-product-docs-guides.md) remains open.

## Owned files

Consumed candidate source is `.tmp/vivary-continuation/24c-private-toolchain-corrected/`.
Its review manifest binds the dispatcher, phase worker, accepted bridge/owner,
prior inventory evidence and this packet. Independent source acceptance and
phase authority are separate artifacts beside that manifest. Exclusive Windows
evidence belongs in `.tmp/hoh-proof/24c-private-toolchain-corrected/`.

The new Linux directory is `vivary-zg-rg-24c-private-corrected` under the verified Habitat
work root; reviewed source binds its absolute location. All parent paths must
be canonical and the new directory absent before creation. Retain that exact
directory and private toolchain as evidence after process cleanup. Retention is
explicit, bounded and does not authorize later deletion. Helper source uses
the separate `vivary-zg-rg-24c-private-corrected-source` directory under the
verified Habitat work root. Both new paths must be absent; earlier similarly named stages
are retained and must not be reused.

Only these four unit identities belong to the new request:

- `vivary-zg-rg-24c-private-corrected-toolchain.service`
- `vivary-zg-rg-24c-private-corrected-prepare.service`
- `vivary-zg-rg-24c-private-corrected-install.service`
- `vivary-zg-rg-24c-private-corrected-query.service`

Verify each unit and cgroup absent before dispatch. Cleanup may stop only a unit
whose launch intent this request recorded. Earlier sources, stages and evidence
remain unchanged.

## Execution boundaries

Compose the accepted Windows Owner, resource observer, small-file upload and
piped heartbeat. No new controller or Windows binary readback is needed.
Cold and warm admission require 2,560 MiB available physical memory and commit
headroom, 10 GiB disk, and a 1,536 MiB host reserve throughout. Windows retains
512 MiB, one CPU and 16 processes. Sampling stays at 250 ms, with a maximum
1,000 ms observer gap. Reject an observed Windows peak above its exact cap.
The global 600-second deadline includes the existing 70-second cleanup reserve.

Linux phases each retain 512 MiB memory, zero swap, one CPU and 64 tasks. Work
limits are 180 seconds for toolchain staging, 45 for preparation, 180 for install
and 45 for query; the shared remaining deadline also applies. Each systemd
maximum adds only its five-second stop grace. Use the accepted nonce/sequence
heartbeat and stop within one second of loss. Keep output bounded, a 256 MiB
file-size limit, and the existing 2 GiB/100,000-entry disk observer with bounded
scans. This disk boundary is monitored, not a filesystem quota.

One fixed root helper may copy only the accepted Node file and npm directory
from the stopped source container into the new private toolchain. Use the local
Docker transport with isolated configuration, preserve source-container identity
before/after, and never start or modify that container. Before changing any
ownership, verify Node and the full npm tree against the accepted inventory with
only uid/gid mapped to the observed copy ownership 0/0. Check every other field,
path, type and content unchanged. Then restore archived uid/gid under an opaque,
root-exclusive parent and require the complete original Node metadata and npm
tree hash to match. Finally set root ownership and remove write bits, validating
the sealed tree again. Record copy-observed, restored-original and sealed states
separately. Use no-follow, opened-file identity checks for Node hashing. Maintain
heartbeat, deadline and bounded traversal checks through all transformations.
Only this fixed helper may access the Docker socket; no agent-user phase may.
Do not weaken the original-metadata acceptance check or modify earlier stages.

Preparation, installation and query run as the agent user with no capabilities,
the exact private toolchain bound read-only, hidden user homes/Windows mounts,
and only their owned working directory exposed. Preserve HOME and scope npm
configuration/cache, XDG, Zvec, Hugging Face and temporary paths to that directory.
No credentials are copied or passed. A verified private Node/npm root replaces
the earlier system-toolchain requirement; it does not install a global toolchain.

Only package installation may use network. Staging, preparation and query use
a private network, IP denial and AF_UNIX-only socket families. Pin and verify
the same five npm integrity values: `@zvec/zvec-grep@0.2.2`, `@zvec/zvec@0.7.1`,
`@vscode/ripgrep@1.18.0`, `@zvec/bindings-linux-x64@0.7.1` and
`@vscode/ripgrep-linux-x64@1.18.0`. Ignore install scripts and omit optional
dependencies. Other resolved transitives belong to the captured package lock;
do not claim they were frozen before installation. Never enable hooks after a
failure automatically.

No repository content, persistent index, embedding model, model service, provider
key, paid resource, shared-helper change or outbound disclosure is included.

## Done condition

Independent source review accepts the exact candidate, packet and prior evidence
bindings plus meaningful inert checks. Runtime accepts the staged toolchain,
verified package integrity and expected fixture text, preserves the fixture,
and leaves Zvec/XDG/Hugging Face state empty. The stopped source container is
unchanged. All launched units/cgroups and the Windows process tree settle
naturally, with zero forced members, zero helpers and accepted resource evidence.
The exact owned stage is retained. Independent review accepts the actual runtime
and cleanup. This does not establish semantic-search benefit or product adoption.

## Verify

```console
C:/Python314/python.exe -I -B -m json.tool .tmp/hoh-proof/24c-private-toolchain-corrected/runtime-review.json
```

The source passed 22 inert checks before dispatch. Its exact packet is retained
as `packet-at-dispatch.md` beside the runtime review. The command above only
displays review data; it does not establish acceptance. Verify the original
source/authority and actual attempt bindings, phase outputs, Windows owner and
unit settlement. Do not rerun the consumed dispatcher. A later phase requires
its own concrete scope, source review and bounded authority.

Run the [canonical planning checks](../execution-contract.md#maintaining-the-graph)
and preserved readiness/index/plan/docs checks after updating owning evidence.

## Stop conditions

Stop owned work on resource, observer, deadline, packet/source binding, container
identity, staged integrity, permission, output or cleanup failure. Preserve the
attempt and retained stage. A consumed request cannot be rerun under the same
authority. Source review of a fix does not silently renew a request. Do not
relax isolation, use a model/index, enable install hooks or touch shared helpers
to make the fixture pass.

## Log

- 2026-09-10: Prepared under D36. Six inert checks passed. Independent review found missing libc validation and floating runtime wrappers; both were corrected. Final independent source review accepted the corrected trial. Runtime remains pending.

The reviewed read-only diagnostic passed. Its exact failed-unit journal reports
that systemd could not set up mount namespacing because the requested Windows
proof-directory mount source was missing. This identifies the failing path;
it does not establish whether the host drive mapping or namespace order caused
its absence. Inspect and reuse the existing Habitat source/heartbeat transport
before designing a successor. No installation or query was retried.

## Corrected transport decision and budget, 2026-09-10

Lead implementation choice under D36: keep the existing Habitat boundary and
upload the bound Linux source through the accepted small-file transfer. Run a
small Windows child inside the existing Job to forward nonce/sequence heartbeat
frames over stdin. The Linux reader refuses EOF or a one-second stall; package
children receive DEVNULL. This composes the existing guard without changing its
runtime API or relying on a Windows drive mount. The [systemd documentation](https://github.com/systemd/systemd/blob/main/man/systemd.exec.xml)
supports hiding home contents while selectively binding owned Linux paths.

The alternative was to repair and depend on the Windows mount mapping. The
selected upload/pipe path removes that dependency and keeps Windows directories
hidden. Source and setup costs are small and bounded; resource limits are unchanged.
This choice is within D36's existing authority for routine isolated local setup.
It is not a new user decision, model authorization or shared-service change.

The original one-request phase remains failed and exhausted. This reviewed
correction has one new request and 360 cumulative seconds, including refusal and
cleanup: two total requests across both phases. The corrected evidence directory
is `.tmp/hoh-proof/24c-zg-rg-corrected/`, with a new owned Linux directory named
`vivary-zg-rg-24c-corrected` below the verified Habitat work root. The dispatcher
binds the original failed request and records both phase and total counts.
No further retry is allowed under this revision without another reviewed change.

Cold and warm admission remain 2,560 MiB physical/commit plus 10 GiB disk.
The Windows Job and each Linux phase remain 512 MiB, with zero Linux swap, one
CPU, 64 Linux tasks, 16 Windows processes and 1,536 MiB host reserve. The existing
250 ms observer and one-second gap limit remain. The 70-second cleanup reserve
is inside the total. Observed Windows peak commit must not exceed its configured
limit. Each Linux command remains bounded in output and runtime; the monitored
2 GiB disk/100,000-entry condition remains a monitor, not a filesystem quota.

The corrected units execute only the transferred Linux path. All phases hide
Windows mounts and home contents, exposing only the owned Linux stage. Only npm
installation has network access. Direct query remains network-denied, model-free
and scoped to the disposable fixture. Missing Node/npm still refuses without
automatic bootstrap; the five package pins/SRIs and ignored install scripts remain.

Eight inert checks cover unit isolation, control-pipe exclusion from package
children, split/foreign/repeated frames, EOF/stall refusal and actual local
nonblocking-pipe support. Final source review must accept the exact adopted
packet and bindings before dispatch. Original failure evidence remains immutable.
The corrected result must retain primary phase/receipt/bridge exit information;
a missing receipt cannot replace the original error with only a JSON parse failure.

## Bounded npm inventory source accepted, 2026-09-10

The missing-toolchain refusal remains preserved. A separate metadata-only phase
will inventory the npm tree in the stopped, previously accepted Habitat source
container. It will neither start that container nor install packages. The source
manifest and independent acceptance bind 18 inert checks and the existing owner.

D36 covers this local setup investigation. The lead adopts one request with a
180-second cumulative budget, including cleanup. Cold and warm admission require
2,560 MiB physical memory and commit headroom, 10 GiB disk and 1,536 MiB reserve.
Both Linux and Windows retain 512 MiB caps; Linux uses zero swap, one CPU and
32 tasks. The streamed archive is limited to 256 MiB and 20,000 entries. The
parser checks paths, links, file hashes and its absolute deadline. The running
Linux unit reports actual limits. Acceptance also requires the observed Windows
peak within its cap and verified owner/unit settlement.

The sole output is a bounded npm version/tree manifest with stopped-container
identity before and after. No Node binary transfer, package install, query,
model or index is included. This phase has used its single request; the failed result is recorded below. Existing search
attempts remain failed and exhausted. Source and authority are under
`.tmp/vivary-continuation/24c-toolchain-inventory/`; exclusive runtime evidence
belongs in `.tmp/hoh-proof/24c-toolchain-inventory/`.

## npm inventory failure, 2026-09-10

The inventory request ran at 23:44 UTC on 2026-09-10. Cold and warm
admission passed; warm physical memory was 2,692,935,680 bytes against the
2,684,354,560-byte gate. The fixed Docker inspection returned literal backslash-n
separators, while the parser required line breaks. The request failed before
the npm archive command. No container start, install, query or model ran.

Independent review accepted cleanup separately from the failed inventory.
The running inspection unit reported 512 MiB memory, zero swap, one CPU and
32 tasks. The exact service/cgroup and Windows owner settled. The failed request
is exhausted. The isolated format correction is now source-accepted with one
separate metadata phase under D36, as recorded below. Build and agent-cycle gates remain
unchanged; their pending requests remain unused.

## Corrected npm inventory source, 2026-09-10

The isolated inventory correction passed independent source review and
19 inert checks. Its fixed Docker template emits actual line breaks;
the tests exercise that template against the captured field values and preserve
the original malformed-output refusal. Original source and runtime evidence stay
unchanged. The new source binds both the prior failure and its cleanup review.

Under D36, the lead adopts one corrected metadata-only request with a 180-second
phase limit, at most two inventory requests and 360 cumulative seconds across
both phases. The corrected request later passed, as recorded below. Resource, stopped-container,
streaming, path/link, deadline and cleanup limits are unchanged, including
10 GiB disk admission. No install, query, model or source-container start is
included. Current source and authority are in
`.tmp/vivary-continuation/24c-toolchain-inventory-corrected/`; new evidence belongs
in `.tmp/hoh-proof/24c-toolchain-inventory-corrected/`.

## Corrected npm inventory accepted, 2026-09-10

The corrected npm inventory passed at 23:54 UTC on 2026-09-10, followed
by independent runtime and cleanup acceptance. It identified npm 10.9.8 with
2,464 entries and 10,899,866 regular-file bytes. The 12,704,768-byte archive was
streamed under the accepted owner, hashed and parsed; the temporary archive is
absent and its bounded manifest remains. Source-container identity matched
before and after, and the container stayed stopped.

Cold and warm admission passed. Inspection, archive and final inspection each
reported the exact cgroup, 512 MiB memory, zero swap, one CPU and 32 tasks.
Windows peak, observer and natural process/unit cleanup passed independent QA.
No Node binary transfer, installation, query, model or index ran.

The next source unit composes a private Node/npm stage with the existing pinned
package installation and disposable direct-rg query. Verify the accepted Node
hash and npm tree before changing permissions, then keep that private toolchain
read-only during agent-user phases. Retain the exact stage as evidence after
process cleanup. Only installation may use network. A separate reviewed source
and phase budget are required before runtime; no request is adopted here.

Evidence: `.tmp/hoh-proof/24c-toolchain-inventory-corrected/` contains the result,
stream-bound npm manifest, Windows owner and independent runtime review.
The npm tree SHA-256 is `4d31e48a8a61da7f0c9b8e314b7fe34bb7a018661ad9c573a1543d3f388509d7`.

## Private toolchain staging failure, 2026-09-11

The private-toolchain request ran at 00:24 UTC on 2026-09-11 and
failed during staging: the copied Node metadata/content did not match the
expected record. The failure receipt did not retain the differing field.
Preparation, package installation and querying never ran. The request is
consumed; do not rerun its source or authority. The frozen dispatch packet is
preserved with its runtime evidence.

Independent review accepted cleanup separately: only the toolchain unit ran,
the bridge sent 16 frames, all 26 recorded Windows PIDs are absent, and the
unit/cgroup settled. Windows peak was 44,589,056 bytes within 512 MiB, with a
262 ms observer gap and zero forced/terminated members. The Linux receipt
records limits before work; its early peak is not a whole-phase peak. The exact
owned stage remains retained. Container/copy logs remain in that stage and were
not separately captured in Windows evidence; their contents are not inferred.

Next, inspect the exact retained Node metadata/hash, npm entry identity and
bounded existing logs read-only. Identify the difference before changing any
comparison or preparing another installation attempt. No query success, model,
index, changed source container or weakened guard is accepted by this failure.

## Inspection accepted and ownership correction selected, 2026-09-11

The read-only retained-stage inspection passed at 00:46 UTC on 2026-09-11.
Independent review accepted runtime and cleanup: all 32 Windows PIDs were
absent, with zero forced members or helpers. The inspected Node differed only
in uid/gid, both 0 instead of 1000. An offline derivation changed only uid/gid
to 0 across all 2,464 accepted npm entries and reproduced the complete observed
tree hash. Contents and other recorded fields match, subject to SHA-256 collision
resistance. The inspection made no target changes. Its request is consumed.

The original private trial remains failed before installation. No package
installation, query, model or index has run. Current reads of its retained
container logs are later observations, not contemporaneously exported evidence.

D36 covers routine isolated setup. The lead selects one corrected 600-second
request in a new stage, conditional on independent source review, exact phase
authority and fresh admission. It verifies the known copy ownership first,
restores the archived ownership while the stage is root-exclusive, then checks
the full original metadata and contents before sealing the private toolchain.
Source preparation alone does not authorize dispatch.
