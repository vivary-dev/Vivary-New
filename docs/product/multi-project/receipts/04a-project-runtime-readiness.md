# 04a receipt: Current project runtime readiness

Evidence-record: 04a

Status: Complete for the read-only Native action and controlled component proof.

## Accepted behavior

The selected-project panel queries readiness using the current project, binding
revision, policy revision and opaque catalog scope. Native authorization,
registry facts and trusted root/runtime observations resolve the request.
Ambiguous or stale bindings refuse. Evidence from another actor, root, location
or configuration cannot strengthen the result.

Installed, configured, authenticated, bound, runnable and verified remain six
separate observations. Package presence and declared capabilities do not prove
execution. The production runtime and action mount remain unconfigured. Reads
create no session or run and do not instantiate a runtime adapter.

All awaited root/evidence callbacks finish before the final registry comparison
and final Native authorization. This is a checked observation, not an atomic
filesystem/database/authorization snapshot or a run grant. The consumer hides
cached output while selection or access changes and refuses malformed results.

## Observed verification

The Habitat Native database and authenticated GET proof passed one outer TAP
test containing 11 named cases in 5.622 seconds. It covered strict transport,
matching/missing/misbound evidence, ambiguous bindings, stale claims, authority
loss and registry/root changes across awaits. Core was 0.176.5, Node 22.23.2,
Python 3.12.3, SQLite 3.53.2 and better-sqlite3 12.11.1. Reported maximum child
RSS was 250472 KiB; that is not aggregate memory. All three owned process groups
were absent and the exact Habitat proof stage was removed.

The Windows proof passed one outer TAP test containing five cases using real
React 19.2.8 and React Query 5.102.8 with controlled Native hook boundaries.
It exercised pending selection, delayed old results, revocation, malformed and
mismatched responses, and unavailable transport. Node 24.19.0 exited naturally
with status zero in a 1.785-second supervised job. Raw stderr was empty.

The fixture closed both ports on 52 native MessageChannels created by React's
bundled act helper and restored its globals. The 104 close calls alone do not
prove OS cleanup: natural worker exit and zero active job processes supply that
evidence. The job capped four concurrent members, 768 MiB committed memory,
10 percent CPU and 45 seconds. Peak job commit was 258527232 bytes. Its lifetime
counter of six is diagnostic, not a concurrent-process peak. One Python parent
was outside the job. No container or model was started.

## Failures and correction provenance

Dependency preparation first refused a normal package-local command-shim
directory. The corrected freeze inventories its regular bytes while continuing
to reject nested packages and links. No dependency was installed or edited.

The first Windows attempt failed on a sandbox child-spawn permission error.
The second passed all five case assertions but timed out because the bundled
React helper left message ports open. Both attempts are failed evidence and
both ended with zero active job processes. Their complete private records are
preserved in the final archive.

Only the component test changed after the Native proof: it tracks actual native
MessageChannels, closes their ports, restores globals and uses explicit fixture
JSX configuration. The five behavioral cases stayed unchanged. Independent
source review accepted that correction before the passing rerun. Native evidence
retains its original six-file freeze; the archive separately stores the revised
Windows component source. Product source did not change between these proofs.

## Evidence, cleanup and remaining work

Independent Astra review accepted the final 54-entry, 551569-byte evidence
archive and its manifest-covered payloads. SHA-256:
`1b65fe3db2fe7e2f60196b7dffe7bcf60549397415f85688310c48bd611a6dda`.
It includes both passing runs, failure provenance, exact sources, tool versions,
dependency hashes and cleanup records. Local duplicate proof files and the
six-file staging tree were removed after byte verification. Shared dependencies
and reusable proof supervision remain available for the next packet.

Full Workbench build/typecheck and browser verification remain deferred for RAM
headroom and are not claimed by this receipt. The isolated fixture compilation
does not establish those checks. Production configuration, real runtime lifecycle,
complete conversation history, enforced roles and cross-runtime parity remain
open. Outcome 04 is not complete. [04b](../packets/04b-project-native-activity.md)
owns the next bounded read-only Native run-activity slice.
