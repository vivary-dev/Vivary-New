# 12d application root identity lifecycle receipt

Evidence-record: 12d
Date: 2026-09-07
Verification-kind: runtime
Result: All 24 Habitat lifecycle tests, independent source/runtime/archive review, and bounded cleanup passed.

The [packet](../packets/12d-root-identity-lifecycle.md) owns durable application
records with live descriptor verification. It does not establish durable
physical identity continuity or automatic recovery after owner restart.

## Record and verification ownership

`RootIdentityLifecycle` composes the existing `PhysicalRootObserver`. Trusted
application code supplies the device namespace, scope, complete locator
inventory, and private metadata path. The record directory must be outside
project scope. The implementation adds no project marker or project-file write.

Each application root receives an independent UUID. The bounded JSON record
contains only those application IDs, locator references, a revision, a schema,
the device namespace, and `unavailable-without-live-custody`. Observer IDs,
filesystem handles, physical paths, and verification authority are never saved
in that record. Native registry rows and the 12c read adapter remain unchanged.

The owner holds an exclusive local `flock` and pins its metadata directory,
writer-lock file, and current record file. State imports use exact fields,
duplicate-key rejection, byte and record limits, identifier validation, and
nonblocking file opens. Nonregular files, links, malformed records, excessive
nesting, and wrong-device imports cannot acquire an active identity owner.

Live inspection obtains a fresh physical capture from the same observer and
compares its current custody with the application record. A rename, path alias,
or content edit can preserve the application ID. Replacement permanently
invalidates the owner. Metadata commits are followed by another root inspection
before a verified result is issued. The result grants no mutation authority and
does not supply durable VCS administrative IDs or current application policy.

## Restart and uncertainty

A new process can reopen the application records, but it cannot reconstruct
descriptor custody from them. Inspection returns `identity-unverified` with
`identity-reconciliation-required`. Enrollment also refuses while prior records
remain unresolved. Copying a project and its record, importing records, or
matching the same path does not silently attach or allocate a replacement ID.

The default epoch reader fingerprints the current Linux boot, mount namespace,
and mount configuration. A changed or missing epoch permanently invalidates
the owner, even if its earlier value returns. A platform capable of restoring
storage without changing those observations must invalidate its owner through
its trusted epoch policy. The implementation does not claim to detect every
storage rollback or to prove never-reused filesystem identity.

Writes use a private temporary file, file sync, atomic replacement, and directory
sync. The owner rechecks known state and lock identity immediately before
replacement. This detects cooperative stale changes; it is not atomic
compare-and-swap against an adversarial process with the same operating-system
user. The private metadata directory must remain under the trusted application's
control. After uncertainty, old application records remain evidence requiring
reconciliation; they never become authority merely because their bytes match.

If metadata permissions change during commit, the owner returns a refusal.
When cleanup also fails, `pending_cleanup` names the retained private temporary
file. Its contents still declare verification unavailable. This is explicit
cleanup evidence, not a completed root registration or an accepted binding.

## OS seam investigation

The existing Habitat container was running with its expected checkout mount.
Read-only probes found tmpfs at the disposable locations and an ext-family
filesystem at the checkout. `name_to_handle_at` produced opaque handles on all
three surfaces; `open_by_handle_at` returned `EPERM` under the existing user.
The packet added no capability and changed no mount or service.

Linux documents opaque file handles as an identity-comparison mechanism, but
reopening them requires `CAP_DAC_READ_SEARCH`; mount IDs can also be reused.
The probe therefore does not treat its successful handle encoding as proof of
restart or remount continuity. [Linux system-call reference](https://www.man7.org/linux/man-pages/man2/open_by_handle_at.2.html)

The kernel's export interface delegates file-handle encoding and decoding to
each filesystem. Its default encoding includes an inode and generation value.
This supports investigating a future platform-specific recovery path; it does
not establish that this container can provide one. [Linux 6.6 export interface](https://www.kernel.org/doc/html/v6.6/filesystems/nfs/exporting.html)

Actual tmpfs fixtures retained the observed handle across rename and a new
process, and changed it after deletion and recreation. Those observations are
retained privately with the exact probe source. No fixture remounted a filesystem
or performed a block-device or virtual-machine snapshot restore.

## Runtime verification

The first enrollment test failed against the temporary implementation skeleton
for the intended missing verified-enrollment behavior. After implementation and
review fixes, all 24 tests passed in 1.061 seconds with zero errors, failures, or
skips. The final suite ran in the existing Habitat container using Python
3.11.16, Linux 6.6.87.2, and tmpfs fixtures. The selected-source transfer contains
41 exact Python source files; it is a temporary test input, not another checkout.

```console
python -B packages/core/tests/test_root_identity_lifecycle.py
```

| Case | Observed result |
| --- | --- |
| Enrollment and serialization | Application record persists; verification stays unavailable in saved bytes; live result cannot be pickled |
| Rename, alias, content edit | One application ID remains valid under live custody; inspection changes no project bytes |
| Delete and recreate | Old ID remains recorded; verification and implicit reenrollment refuse |
| Replacement during metadata commit | Post-commit root inspection refuses to issue a verified result |
| New process | Existing records reopen unverified; no implicit reattachment or new ID |
| Copied project and imported state | Old ID preserved as unverified evidence |
| Restored, replaced, or edited metadata | Current owner invalidated; earlier or matching bytes cannot revive it |
| Writer-lock and metadata-directory replacement | Current owner refuses before further work |
| Epoch change or loss | Permanent refusal, including return of the earlier epoch value |
| Cross-process writer | Second active owner denied by the actual local lock |
| Malformed imports and limits | Duplicate keys, wrong device, extra fields, oversized/deep JSON, record and alias limits refuse without rewriting input |
| Links and FIFO | Symlinks not followed; FIFO rejected without waiting for a writer |
| Private state inside project scope | Refused without creating metadata in the project |
| Real metadata permission failure | No verified result; project bytes unchanged |
| Permission loss after temporary write | Refusal retained; orphan temporary metadata named explicitly |
| State or lock change during temporary-file sync | Detected before replacement; changed state is not overwritten |

The epoch-change case injects a changed trusted epoch while leaving the actual
mount untouched. It proves the invalidation branch only. Restore cases copy
ordinary fixture files and record bytes; they do not claim filesystem-snapshot
or virtual-machine rollback coverage. Windows imported the module and explicitly
skipped every Linux physical test; Windows identity remains unsupported.

## Review, export, and cleanup

The accepted 12d lifecycle module hash is `65c25497885cb1af06a6a00da4edc3acd3e01ddc0900e5d8812b893721cc15c2`; the test hash is `e23f8aada4842a21e6f4523b1b4e83e827bc533a40bc79c82824e74661a5a33e`.
Independent review found a cleanup exception path and requested a pre-commit
state recheck. Both were fixed and proved with actual fixture mutations. The
lead accepted the final source and independently replayed all 24 tests with
zero skips in 1.001 seconds, then matched the exact running source hashes.

The private archive contains 53 entries and 193,381 bytes, SHA-256
`09226dbbdf812a304cb45c5bf323273cb6b12bdf50308c40974630e101d44fc4`.
The lead independently verified all 52 payload hashes and sizes, all 41 current
canonical source matches, and the final runtime log before cleanup.

Guarded cleanup verified every Habitat task file against the accepted source
manifest, then removed the two exact owned task directories: 43 files, 619,277
bytes, and six directories. Earlier tmpfs probe fixtures were also absent.
Windows cleanup rechecked the final archive and exact staging inventory, rejected
reparse points, and removed 12 owned files, 107,777 bytes, and two directories.
Both environments' task targets were verified absent. The archive, sidecars,
cleanup records, source-review backups, and reviewed doctor-annotation evidence
remain private. Global mounts, services, accounts, and capabilities were unchanged.

Source navigation, tracked line endings, and diff checks passed. The graph writer
records the completed packet and runs the canonical common planning checks.

Outcome 12 remains in progress for automatic reconciliation, durable VCS
administrative identity, Windows support, trusted runtime/policy composition,
and effect enforcement. [06d](../packets/06d-native-root-registration.md)
subsequently completed the bounded native registry composition with explicit
restart refusal. [06e](../packets/06e-project-selection.md) owns GUI selection.
