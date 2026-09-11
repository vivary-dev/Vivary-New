# 12e receipt: Application VCS references under live custody

Evidence-record: 12e

Status: Complete for the bounded Linux lifecycle and explicit inert migration.

## Accepted behavior

The existing private lifecycle record now stores application root, repository
and checkout UUIDs. No-VCS roots store null VCS references. Git aliases share
the same root identity; separate roots in one monorepo share repository and
checkout references while retaining distinct root IDs. Linked worktrees share
a repository reference and retain distinct checkout references.

Reuse requires the same live observer and held physical identities. Every
enrolled-root comparison includes observer lifetime, root, repository, checkout
and mutation-owner identity. Replacement refuses permanently for that owner.
Normal rename, content changes and dirty/detached state preserve IDs while
descriptor custody holds. The writer reinspects after metadata commit before
returning current identity. All results retain mutation_authorized=False.

Strict v1/v2 parsing rejects malformed, mixed, duplicate and inconsistent
records. Opening or copying saved state restores no custody. Explicit v1
migration preserves IDs and locator references, advances the revision once,
and records unresolved VCS references. It invokes no project observation or Git
operation and allocates no application identity. A repeated migration is byte
stable. Read-only alias inspection allocates nothing and saves no locator.

Locator order is canonical at construction and decoding. Source review caught
and corrected an ordering mismatch before execution.

## Observed verification

All 44 Linux tests passed without skips: 24 existing lifecycle tests, six read
compatibility tests and 14 VCS/migration tests. The corrected suite ran in
6.187 seconds with Python 3.12.3 and Git 2.43.0. Git fixtures use real descriptors
and topology, isolated configuration, disabled hooks/signing/credentials and
bounded subprocesses. No network operation or user repository was involved.

The exported witnesses contain 49 operations, 21 full project/Git tree
manifests and 27 exact serialized state payloads. Every digest and comparison
was independently checked. Only the named fixture injection that replaces Git
administration during commit changes project/Git bytes. The v1/v2 examples show
revision 7 advancing to 8 with historical IDs preserved and verification inert.

A labeled foreign-observer-lifetime injection proves first and permanent
refusal with unchanged saved IDs. This is a branch check using a modified
capture from the real observer; it is not evidence of an actual remount or
arbitrary concurrent rollback.

Linux descendants shared a 256 MiB kernel cgroup limit, zero swap, a 16-task
ceiling and one-core CPU quota. Peak aggregate memory was 59211776 bytes;
all OOM counters were zero. The service limit was 150 seconds, with a 120-second
test supervisor and 1 MiB captured streams. A conservative 128 MiB Windows
parent allowance was outside the cgroup. Dispatch retained a 1536 MiB host
reserve. The 768 MiB per-process address-space ceiling is separate from the
stricter aggregate physical-memory limit.

Process group 872 was absent, the service collected, and the exact Habitat
stage was removed. Local cleanup removed 13 byte-verified duplicate files
totaling 752859 bytes and the three-file source stage. Shared dependencies and
the existing checkouts remain.

## Evidence and review

Independent Astra review accepted the final 42-entry, 400016-byte archive and
all 41 manifest payload hashes. SHA-256:
`d86eefa1caaa49507a361d51fa59e67fb1c7990f922664f6183d144a37bdd4fc`.

It retains the earlier missing-file failure and the passing but incomplete
44-test capture. The missing accepted read test was transferred only after
comparing the full dependency inventory. Independent review then required
serialized witnesses and a foreign-lifetime case; the fixture correction and
passing rerun close those findings without further production-module changes.

Final source hashes:

| Source | SHA-256 |
| --- | --- |
| root_identity_lifecycle.py | 603d6024584b5a614c2b2110174e3aaaaa2fcaa1342201e35b9af60b88aa6d6f |
| test_root_identity_lifecycle.py | f48214eac9af6796573918d0214b88cfd8a71b4cbd3ecde926e20e8f87a5035a |
| test_root_vcs_identity_lifecycle.py | a427f78e355eb959c2beb24ec96110d883e273e6117eafc43c7c7a8ea6c33941 |

## Remaining work

Native VCS integration, restart reconciliation, Windows/Jujutsu identity and
shared-repository mutation serialization remain open. The lifecycle writer lock
protects private metadata, not repository effects. Outcome 12 is still in
progress. Continue the current executable graph frontier; accepted identity
references do not by themselves grant a runtime or mutation capability.
