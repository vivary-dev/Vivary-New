# 07d receipt: Staged creation and interrupted publication

Evidence-record: 07d

Status: Complete for the Linux engine under controlled fixture custody.

## Accepted behavior

The Core creation engine composes the existing creation authority with injected
receipt, namespace and thin-workspace operations. It verifies accepted preview
bytes, reuses the existing scaffolder, Doctor and Tropo, syncs staged files and
directories, and publishes through Linux renameat2(RENAME_NOREPLACE). Every
occupied target is preserved. Unsupported atomic publication refuses.

Each filesystem callback has a one-shot lifetime and checks current binding and
namespace continuity immediately before execution. Retained or duplicate callbacks,
revoked authority and disconnected admissions refuse. Paths must be canonical,
link-free and nonoverlapping in either direction; hard-linked staged files refuse.
The unconfigured namespace owner refuses before receipt or filesystem effects.

Preparing receipts permit rebuilding only their recorded private stage. Publishing
receipts reconcile an exact target only under continuous fixture custody. Ambiguous
rename, sync or receipt completion keeps recovery required and preserves the target.
Published replay is historical and never recreates a missing project. Success is
created-unregistered; registration remains separately authorized.

## Runtime evidence

All 23 tests passed with zero skips in the existing Habitat checkout using Python
3.12.3. The suite timer was 4.990 seconds; the complete supervised run was 5.599
seconds, with maximum child RSS 57,796 KiB. The run used nice priority 10, a 768 MiB
address-space limit, a 120-second deadline and the existing owned-process supervisor.
It started no container, model call or user-project operation.

Actual fresh worker processes terminated at five points: after preparing intent,
during partial scaffolding, after prepared, after publishing and after rename.
Fresh workers recovered through supervisor-owned fixture state. Losing that state
refused post-rename reconciliation. A real destination created immediately before
rename survived the no-replace syscall. Other cases cover exact bytes, occupied
targets, changed options, revocation, competing operations, hard links, path
overlap, delayed callbacks, transport ambiguity and unsupported publication.

Receipt persistence and custody in this suite are labeled fixtures. The proof
does not establish native database composition, production custody, host restart,
power-loss durability, registration, GUI behavior or all of outcome 07.

## Review, failed attempts and cleanup

Independent Astra review accepted the corrected source and reopened all 53 payload
hashes in the 54-entry evidence archive. All 20 source/dependency files and three
drivers matched current bytes. Archive SHA-256:
`35d126548def2817af05db744ac89d15aa2299d84f0eeea210a616c243f659bc`
(340,869 bytes).

The first preflight refused an unused dependency that was absent in Habitat.
The manifest was corrected to the static import closure before tests ran. The
first actual suite exposed four fixture setup errors; explicitly provisioning the
private stage parent through its namespace owner fixed those cases. A later WSL
mkdir invocation returned an error after creating an empty directory, before any
runner transfer or launch. A separate process/contents audit found no owned process
or uncertainty; exact empty-directory removal restored the stage. Its cause was
not established. Those failures and source versions remain in the final archive.

The passing run confirmed process-group absence, empty fixtures, successful local
evidence readback and exact staging removal. The final private archive is the
evidence owner. After archive acceptance, 25 duplicate evidence/source files
(144,045 bytes) and the empty Windows source staging tree were removed. The sole
retained 07d evidence archive is 340,869 bytes. Reviewed implementation remains
in the existing Habitat checkout.
No source checkout, credentials, account settings or native defaults were replaced.

## Next integration

[07e](../packets/07e-native-creation-admission.md) supplies the internal Native
receipt snapshot and ordered effect-admission boundary. A later private transport
composes it with Python; protected production custody and GUI creation remain open.
Historical receipt output alone never grants an effect.
