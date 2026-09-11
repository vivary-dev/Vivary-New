# 12b physical-root observer receipt

Evidence-record: 12b
Date: 2026-09-07
Verification-kind: runtime
Result: Passed. The bounded Linux physical-capture implementation passed independent review and all 23 Habitat tests. Production mutation and durable restart identity remain unaccepted.

## Implemented boundary

`PhysicalRootObserver` is a private local service API in
`packages/core/vivary_core/physical_observe.py`. Its constructor accepts a trusted
device namespace, authorized topology scope, and configured locator mapping.
It accepts no caller-provided root IDs, checkout IDs, observation maps, or
mutation-owner selection. Integration with authenticated policy and the complete
relevant-binding inventory remains the connection owner's responsibility.

Linux directory descriptors pin each identity during one observer instance.
Aliases and renames can converge within that lifetime. Replacement is distinct
while the preceding handle remains open. `revalidate` accepts only captures
issued by that exact instance. Restart, closed handles, or uncertain continuity
refuse observation. These are private lifetime-scoped identities. They do not
establish durable registry identity or cross-process contention after restart.

The implementation derives a common Git repository key from held common
administration and a checkout key from held private administration plus its
working-root association. No-VCS roots have only their root key. Every capture
has `mutation_authorized=False`. Keys are evidence for future composition, not
an acquired reservation or permission to write.

## Read-only probes and explicit limits

The implementation reuses `workspace_observe._default_run_git` for bounded
`rev-parse`, `symbolic-ref`, and cached `ls-files` queries. Its existing runner
disables optional locks, ambient Git overrides, and fsmonitor execution. No
status, object fetch, filter, hook, or Jujutsu command is required. Config includes
are refused before native probes. The fixtures compare project and Git
administrative bytes, modes, sizes, and write timestamps around read probes.
Access timestamps are excluded from product-state comparisons.

The inventory includes ignored and untracked bytes, relevant modes, directory
entries, and administrative state. It rejects unsupported links, hardlinks,
special files, incomplete reads, configured bounds, and detected capture changes.
Descriptor-relative opens prevent an intermediate content symlink from redirecting
a read. Root aliases must resolve within the trusted scope.

A path absent from the cached index establishes `dirty_state="untracked-content"`.
It can include ignored files and does not claim Git porcelain dirtiness.
Otherwise the result is `unverified`. The adapter does not claim Git cleanliness
from raw bytes or run clean filters. Staged changes, attributes, and line-ending
rules remain outside that narrow classification.

The final physical fixtures ran on tmpfs. The code also identifies ext-family,
XFS, Btrfs, and overlay filesystems, but those branches have no physical proof
in this packet. Windows, unsupported filesystems, Jujutsu,
bare repositories, and unverified metadata remain explicit refusals. Colocation
never silently chooses Git as Jujutsu's mutation owner. Complete stable captures
do not close the interval before a later effect. Registry transactions, durable
continuity, policy composition, and effect fencing remain outside this packet.

## Verification checkpoint

Windows reports Python 3.14.3 and Git 2.54.0.windows.1. The focused command ran
23 tests. Two boundary checks passed and 21 Linux physical cases were skipped.

```console
python -B -m unittest discover -s packages/core/tests -p test_physical_observe.py -v
```

The first run reached both boundary assertions, but unnecessary test temporary
directory cleanup failed under the Windows sandbox. The boundary test now uses
an existing path and performs no filesystem operation. The rerun exited zero.
The exact empty temporary directory was removed and verified absent.

The first Habitat run passed all 21 tests before independent review. The lead
review accepted the bounded Linux identity scope and requested a bound on
retained captures and immutable scope with validated locator updates. Those
corrections add two tests. Removed locator grants now produce an explicit denied
result. The existing `max_entries` setting also bounds retained captures without
discarding prior evidence. Final source and Habitat verification follow below.

The lead transferred the final source into the existing Habitat checkout and
verified both hashes before testing. Habitat reports Python 3.11.16, Git 2.43.0,
and tmpfs for the task's temporary fixtures. Jujutsu is absent from `PATH`.
The final command ran all 23 tests with zero skips and zero failures in
1.772 seconds. This proves the named synthetic filesystem/Git cases on tmpfs.
It does not prove a product workflow, Windows identity, or Jujutsu support.

The separate GPT-6 lead reviewed the source, checked the corrections, and ran
the final Habitat verification. No live model call, database, new container,
development checkout, or dependency installation was needed.

| Final tested source | SHA-256 |
| --- | --- |
| `packages/core/vivary_core/physical_observe.py` | `fc4c1835fec15669cf727ad0a73fd38cb8c53527ffede36f8791345a72d770b8` |
| `packages/core/tests/test_physical_observe.py` | `b24224ce68bac5e8a58ce556640803746e824228303f9d360d942679718f0716` |

The graph, source-navigation, line-ending, and diff checks validate document
consistency. They establish no extra physical behavior. The earlier Windows
skips remain separate from the complete Habitat run.

## Cleanup and next work

The implementation writer created no Habitat checkout, environment, or model
session. Linux tests create disposable synthetic fixture repositories and
linked worktrees only. Their observer handles close before fixture cleanup.
The Windows writer removed five staging files totaling 64,317 bytes.
The staging directory is absent. The lead retained final test, source-hash,
environment, and cleanup evidence in the Littleagent task evidence directory
`.tmp/hoh-proof/12b`. The empty Habitat directory
`/tmp/vivary-12b-checks` was removed and verified absent.
Test-owned temporary children closed their handles and removed themselves. Existing Habitat services, checkout,
`.claude/agents`, and `.runtime-tools` remain in place.

Outcome 12 remains open for the unsupported platform and Jujutsu paths, durable
identity across restart, production registry composition, and cross-process
mutation enforcement. Packet completion cannot close those product gates.
