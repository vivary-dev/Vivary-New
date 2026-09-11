# 12c registry read-observation receipt

Evidence-record: 12c
Date: 2026-09-07
Verification-kind: runtime
Result: Windows request boundaries, all 21 Habitat tests, independent review, evidence export, and bounded cleanup passed.

The [packet](../packets/12c-registry-read-observation.md) owns the bounded
composition. It adds no production registry, persisted root identity, public
action, or mutation capability.

## Implementation

`RegistryReadObserver` composes the existing `PhysicalRootObserver` with an
injected trusted resolver. `ResolvedReadScope` holds one immutable policy and
locator snapshot. The resolver owns authentication, read grants, inspection
authority, and the complete relevant binding inventory. No configured production
resolver is claimed by this packet.

The request supplies location, register/rebind operation, and expected policy
revision. These operations request filesystem reads. The adapter changes no
registry record. Mutation operations are denied before the resolver or filesystem.
Missing grants, membership, capabilities, inventory completeness, and matching
policy are explicit refusals. Policy is rechecked around physical observations.

Issued handles belong to one service instance. Inspection revalidates the exact
physical capture before constructing an immutable private observation view.
Closed, foreign, revoked, replaced-root, and changed-content evidence is refused.
The handle rejects pickling; neither it nor the view supports ordinary JSON
serialization. Trusted consumers must not turn lifetime IDs into durable bindings.
These serialization restrictions do not sandbox trusted in-process code.

## Verification boundaries

Windows ran the focused unittest command: nine boundary tests passed and twelve
Linux physical tests were explicitly skipped. This establishes no Windows
physical-identity support.

The lead ran all 21 tests in the existing Habitat checkout. All passed with
zero failures, errors, or skips in 1.14275 seconds. The verified environment
used Python 3.11.16, Git 2.43.0, Node 22.23.2, and tmpfs for disposable fixtures.

```console
python -B -m unittest discover -s packages/core/tests -p test_registry_observe.py -v
```

| Physical or boundary case | Observed result |
| --- | --- |
| No-VCS and ordinary Git | Private read-only observation; oracle accepts registration |
| Two authorized aliases | Same root ID; oracle detects existing registration |
| Renamed root and updated trusted locator | Same held identity; oracle accepts rebind |
| Linked Git worktrees | Shared repository ID, distinct checkout IDs |
| Changed content or replaced root | Prior handle refuses inspection |
| Changed, revoked, or mid-capture policy | Prior authority cannot produce a view |
| Other-actor relevant topology | Inspected for overlap; caller receives no read grant |
| Incomplete inventory, unsafe overlap, or failed foreign scan | Explicit refusal |
| Unverified Jujutsu metadata | No fallback to a Git or no-VCS view |
| Foreign service, changed scope, or closed handle | No adoption of prior identity |
| Mutation request, caller authority, malformed revision | Refused before filesystem work |

Selected observations feed the existing Node registry oracle through a private
test-only conversion. Its `registry` effect is an in-memory decision description.
The tests never apply a database transaction, persist a root ID, or create an
application binding. Fresh handles and successful decisions do not prove a
production workflow.

The physical tests compare project and administrative bytes, modes, sizes, and
write timestamps around read calls. Access times are excluded. Test setup creates
synthetic Git repositories and linked worktrees; teardown removes only those
fixtures after observers close. No development checkout or dependency was added.

## Source and review

The lead transferred the two new files and verified their hashes before testing.
The lead also checked the existing physical observer dependency.

| Tested source | SHA-256 |
| --- | --- |
| `packages/core/vivary_core/registry_observe.py` | `7fd4a3d04ae89236ad8caef228d7d3b4c1c4771cdc5e548f0c39d85241a5b9b4` |
| `packages/core/tests/test_registry_observe.py` | `ce67ed752fabfd31601df8c54a94b23833cde230bf8a592491402ee495ea7946` |
| `packages/core/vivary_core/physical_observe.py` | `fc4c1835fec15669cf727ad0a73fd38cb8c53527ffede36f8791345a72d770b8` |

The GPT-6 lead independently reviewed the source and tests. The review found no
blocking issue in authority checks, capture revalidation, private handles,
mutation refusal, or bounded inventory handling. A second GPT-6 reader independently reviewed the same boundary and found no blocking issue. The implementation writer did
not supply this independent acceptance.

## Evidence and cleanup

The lead verified the final private ZIP: three entries and 1,898 bytes, SHA-256

424686b4a74d970946590f6f85a6a83d2a76e7724491b04bf2465fb863b950f7.

The adjacent manifest records its entries. The lead verified the existing oracle
and fixture hashes against current Habitat bytes, alongside the three source
hashes above. The registry oracle hash is
e9eb2a1a75c176b196d1be47f2e54219ac0803e5121ba0c3292e242c378143d5.
The registry fixture hash is
f56a56bdbb43b4fb28af1fe7bf7d0c86208e67cf78e121a7d873eda47bebd35a.

The lead checked the exact Habitat staging directory's two files, removed that
directory, and verified it absent. Windows cleanup compared all four staging
files with retained canonical copies, verified the final archive hash, and
removed only those four files and their directory: 35,646 bytes. Private evidence
includes the Windows cleanup receipt. Existing services, checkout, dependencies,
and runtime tools remain outside the removal list.

Source navigation, tracked line endings, and diff checks passed. The graph writer
renders the completed packet and checks the generated frontier.
Outcome 12 remains in progress for durable restart identity, production resolver
and registry integration, Windows identity, Jujutsu, and effect enforcement.
