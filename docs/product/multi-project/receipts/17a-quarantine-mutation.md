# 17a receipt: Quarantine a durable mutation admission

Evidence-record: 17a

Status: Complete for the bounded quarantine transition and serial application.

Verified: 2026-09-09.

## Accepted candidate behavior

The private `quarantine-mutation` action reauthorizes the current Native mutator,
then resolves the historical admission from its scoped receipt. It validates
the receipt envelope, reservation parent, complete claims and exact fence
high-waters. It does not observe or substitute a live root and needs no current
binding. The existing model owns authorization, lifecycle, revision and replay
decisions. The store owns SQL envelope integrity and guarded persistence.

The first transition atomically advances the scoped registry revision and
changes the existing reservation and receipt from active/pending to
uncertain/uncertain. Claims, fences and all other receipt and parent fields stay
unchanged. Exact authorized repeats replay without writes before stale revision
and increment-limit checks. Malformed, foreign, revoked or inconsistent requests
refuse without writes. Three injected write failures roll back the transaction.
Contenders remain blocked by the uncertain owner.

The action remains private: no HTTP, agent-tool, MCP or extension entry, public
discovery, timer, release, cancellation, reconciliation or project/VCS effect.
Quarantine does not prove external-process fencing or permission to replay.

## Observed verification

Trial08 passed six preflights and seven suites without failures or skips:

| Suite | Assertions |
| --- | ---: |
| Registry contract model | 49 |
| Mutation quarantine | 1 |
| Mutation admission | 1 |
| Registry actions | 13 |
| Registry store | 18 |
| Native VCS registration | 1 |
| Native registry compatibility | 6 |

Independent review validated all 89 assertions, the complete 40-case quarantine
witness and the unchanged 14-operation Native VCS witness. The model fixture has
83 cases. Quarantine checks cover no-VCS and Git admissions, restart persistence,
safe-integer replay, historical identity after root/binding changes, scope and
policy refusal, corrupted claims and high-waters, mixed lifecycle states,
rollback, contenders and an independent-process single-transition race.
SQL and project/Git snapshots establish the claimed changes and preservation.

## Resources, cleanup and provenance

Application tests ran in the bounded Habitat snapshot. Linux limits were
512 MiB memory, zero swap, 64 tasks and one CPU. Node heaps were 192 MiB.
Peak Linux memory was 478,543,872 bytes with zero OOM, memory-limit or PID-limit
events. The Windows owner retained its 512 MiB Job, one CPU, below-normal
priority, 2,560 MiB admission threshold and 1,536 MiB reserve. Its 840 observer
samples had a maximum gap of 292 ms and minimum available memory of 2081.37890625 MiB.
The warm wait admitted immediately, so memory recovery is not established.

All 13 phase groups settled. The stage, unit and cgroup were removed after exact
inventory checks. No Windows helper needed a forced stop. All 43 recorded Windows
identities are absent. The Job accounted for 207 processes overall. A later
read-only check found Habitat already stopped and did not activate it.
The 99 archived native copies were retired, removing 10,623,524 logical bytes.

The private archive in the preserved Littleagent checkout is
`.tmp/hoh-proof/17a/reviewed-evidence.zip`, with 123 members and 122 verified
hash bindings. SHA-256:
`fa15187c2a10b83add4cbc86126ffea55e9a470931c09d7f86e079b84f0937fc`.
It preserves 79 snapshot sources, nine candidate postimages, proof drivers,
commands, raw outputs, witnesses and cleanup records. Source freeze SHA-256:
`d2eefb35eaf9edcff9c49aaae1bb2c0ea93b00697d7cf27b62637d90ccd8131b`.

Trials 01 through 05 retain their distinct proof or fixture failures and exact
recovery evidence. Trials 06 and 07 refused warm-memory admission before staging.
Those records remain failures or refusals. This receipt accepts only trial08.
Two later application preflights refused warm admission before checker or
receiver dispatch. A third fresh preflight passed without running application
tests or starting the app.

## Application and final acceptance

The fresh preapplication check passed with no runtime or application execution.
Its Windows owner reported zero active helpers, no forced members, a 263 ms
maximum observer gap and 3,156,545,536 bytes of minimum available host memory.
Receipt SHA-256:
`f74e826d6d183885ca357da432882f99797a4b16d4931374275f503cc012383f`.

The held 06e build freeze was never run. Its 91-bindings source archive has SHA-256
`aba79b8b9ff78cec56d6abc52bf1adee4f8ee9a4f8f4acc487cd8efbcce62268`.
The retirement released source ownership without claiming a build result.
Retirement receipt SHA-256:
`477eeae4de7dea93c0477141517c0a5f43fe97c9ad3035563ed543fd7726e643`.

The application controller reread the eight existing preimages and the required
absence in both targets before writing. It kept the canonical rollback archive,
flushed each of the nine writes and verified every final hash. The rollback archive
has SHA-256 `d629782a7e3e97528eea5e90cf82bded9ca2e3b3bcf973c32b07a120169d44bd`.

The canonical application receipt has SHA-256
`d9317860b477c43ef1632349716344f420dbba46182ab100e30a4c9241abb2b3`.
The persistent Habitat receipt has SHA-256
`90889381886948c954297dda754ff5380166d929457827b52239cb382972d429`.
Habitat readback matched all nine candidate postimages. The application owner
reported zero active helpers, no forced members, a 266 ms maximum observer gap
and 3,006,816,256 bytes of minimum available host memory. It ran no tests and
started no application runtime.

The final activity check found Habitat stopped. It did not activate or stop the
distribution. Its Windows owner passed and closed with zero active helpers and
no forced members. Both recorded Windows process identities are absent. The
activity receipt has SHA-256
`37ec3230b042112990d2512e0f4b4a4a8ea01dc068e99493c56032b04e8fa309`.
Its absence receipt has SHA-256
`07f63d95b20ac425fd26897dea6f0df6d65d312a4e13e21e92be896cf3ea9257`.

Root and independent Native review accepted the exact serial application and
cleanup. The review has SHA-256
`1bdbf1d61d58f19810feb77f33961f78616d5242f15a08d0d72a5f6d7ad8c7da`.
The application archive has 69 members and 68 verified hash bindings. It is
369,536 bytes with SHA-256
`370b8a32c7de700645230c5e710895607cc327d7befae5041f472f4e69ac31a7`.
It binds the accepted candidate, application receipts, rollback archive, source,
reviews, refused preflights, successful preflight and final activity evidence.
The runtime archive remains separate. The application integrity receipt has
SHA-256 `ec8a6ce13fffafa61efd6554d5d80c09a928e17c531fc9a36d88afdbf4f8c7b5`.

The final application acceptance is
`.tmp/hoh-proof/17a/final-application-acceptance.json` in the preserved
Littleagent checkout. It is 2,632 bytes with SHA-256
`5e182a234be2dfdd5b7d303960595a859688e7042bf5ffbca374efecd4f09050`.

| Applied source | SHA-256 |
| --- | --- |
| `docs/product/multi-project/contracts/project-registry-transaction-map.md` | `070e7fd53bae21c9ad607c36e8b7ba66ee1928459a976ba7f4d907a7a12aada7` |
| `docs/product/multi-project/contracts/project-registry.md` | `76f28bad036ae0ed8c308d909f69ee3252d1795926abed3a075c9bc52cf65adf` |
| `docs/product/multi-project/fixtures/project-registry.json` | `85362a24eb5a214a0dd5a1178ef1bf94526f91fc7495d7e0549c4976726e8958` |
| `packages/workbench/server/native-registry.mjs` | `015f03a3cb83f0f6504c6def4746432a590235646e91d59a64535d6378c5f282` |
| `packages/workbench/server/registry-actions.mjs` | `977cbdd7557f7fd974ec07b08b613076da2b26e532efb5f66c2439a852e5de3a` |
| `packages/workbench/server/registry-store.mjs` | `22cf10ce448aa714fbdd01af7254ad8bc592190b98edeb5a1ae89ccb44e3b00e` |
| `packages/workbench/tests/mutation-quarantine.test.mjs` | `27af9c88f7d0c84d3f3f05f0390feb266a6034a1f824e0d7be3dfcebabe4ae38` |
| `scripts/registry_contract_model.mjs` | `7366e2bf5beba588877c120135b2042a067e161b7a9e706afc42e736d793c8f1` |
| `scripts/tests/test_registry_contract_model.mjs` | `5cd51044a05391f2102ef86c188626572bf392d8a527b8ee48952b7868747110` |

This receipt completes packet 17a. It does not complete outcome 17. No fresh C5
persistent comparison, 06e Native refresh, build or browser proof is accepted by
this receipt. Those gates remain open and require their own evidence.
