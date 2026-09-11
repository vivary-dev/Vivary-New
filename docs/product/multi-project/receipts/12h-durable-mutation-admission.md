# 12h receipt: Durable mutation admission

Evidence-record: 12h

Status: Complete for bounded Linux durable admission.

Verified: 2026-09-09.

## Accepted behavior

The private mutation-admission action reserves one verified no-VCS root key or
the complete sorted Git checkout and repository key set. It uses authenticated
actor, collection and device scope, a current explicit `project-mutator` grant,
the stored binding location and fresh root observation. The existing registrar
role retains its original behavior and receives no mutation capability.

The SQLite transaction checks matching receipts before new admission, reloads
current binding and intersecting reservation state, and uses the existing
decision model. Successful admission advances the scoped registry revision,
inserts one active reservation and all claims, advances each selected key's
fence high-water, and records one pending receipt atomically. Retries reconcile;
changed digests conflict. Uncertain owners take precedence over busy owners.
Injected failures roll back every write.

No project or VCS effect, reservation release, reconciliation, production runtime,
public mutation endpoint or external-process fencing is demonstrated or enabled.

## Observed verification

Trial04 passed five suites without failures or skips:

| Suite | Tests |
| --- | ---: |
| Mutation admission | 1 |
| Registry actions | 13 |
| Registry store | 18 |
| Native VCS registration | 1 |
| Native registry compatibility | 6 |

The focused suite emitted 42 exact mutation witnesses. Independent review
verified 22 SQL snapshot hashes, five atomic admission deltas and 37 unchanged
refusal/replay snapshots. It checked restart persistence, fence high-water,
linked-worktree and cross-collection contention, independent processes,
mixed-condition refusal order and transaction-failure rollback. Every operation
preserved its recorded project/Git and provider state.

The focused fixture injects observed root facts. The separate unchanged Native
VCS suite retains real Python/Git observation through the existing stdio boundary
and verifies 14 registration operations. No separate final SQLite integrity
check was run.

## Resource and cleanup evidence

The proof reused installed Habitat dependencies and a disposable candidate
snapshot. Linux had a 512 MiB cgroup, zero swap, 64 tasks and one CPU. Node heaps
were capped at 192 MiB. The Windows owner had a 512 MiB aggregate commit limit,
one permitted CPU and below-normal priority. Admission retained the 1536 MiB
host reserve and 2.5 GiB warm threshold. Phase output was bounded at one MiB;
each phase had 180 seconds and outer cleanup retained 70 seconds.

Linux peak memory was 475,377,664 bytes with no OOM or memory-limit event.
Windows peak job commit was 30,076,928 bytes. Its maximum observer gap was 365 ms.
Every phase group settled; the stage and service cgroup were removed. The owner
reported zero active helpers and no forced members. All 42 recorded Windows
process identities are absent. Numeric PID 5612 was reused by a later svchost
process; the identity receipt preserves that distinction.

Trial01's observer refusal and trials02–03's fixture failures remain archived
separately. Their failed results have not been relabeled. The two stopped stages
were removed only after exact archived-inventory comparisons and bounded cleanup.

## Evidence and application

Lead and independent evidence review accepted the private archive at
`.tmp/hoh-proof/12h/reviewed-evidence.zip` in the preserved Littleagent checkout.
Its 119 members contain 118 verified hash bindings. Archive SHA-256:
`764e2f7a8ff633ca1ad4b13055bbbec415a6b8680fea0c35093a80960a6e9180`.

The archive binds the seven candidate postimages, 75 snapshot sources, installed
dependencies, four proof drivers, exact commands, suite outputs and cleanup.
Candidate freeze SHA-256:
`5e303749dbb4a8e8c7e0873eae8502c68a840ef58339cea1024e2ed9076b66d6`.

All seven accepted files now match canonical and the existing Habitat checkout.
The serial application verified six existing preimages and the new fixture's
absence before any writes, retained rollback bytes, flushed each write, and
checked every final hash. Independent review verified the source payload and
raw command captures against both application receipts.

The earlier 06e source freeze was archived and retired explicitly as unrun
before application. Its 86 source bindings remain preserved. No 06e build or
browser success is claimed by that retirement. The five pending C5 files remain
unchanged in each environment. Fresh 06e Native, build and browser evidence is
still required for their integrated dependency closure.

The application archive has 42 verified bindings. SHA-256:
`45324f6653bd2a9de391ea7e34fc797e372945e111757ed0e69f6313ee936590`.
Both application owners passed with zero forced or remaining helpers. The
maximum measured observer gaps were 274.643 ms for the absence check and
262.760 ms for application. Minimum available host memory was 3,039,535,104 and
3,225,501,696 bytes respectively, above the 1536 MiB reserve. Both exact services,
cgroups and stages were absent. Each attempt used one bounded Habitat activation
and started no application runtime.


| Applied source | SHA-256 |
| --- | --- |
| packages/workbench/server/db/migrations.mjs | dde80bf76bcdd9f396d2664547dcf5e3fcb8495c711dd7a84356be28fa2e11c4 |
| packages/workbench/server/db/schema.mjs | 88692196350de4a997539fc4c71ddf5caa4f128ee82671053e4054d930ef3b5f |
| packages/workbench/server/native-registry.mjs | 28ac07b84c96e9bf2d601fbf2d15a509562f030b075df5be1b582df3100fd407 |
| packages/workbench/server/registry-actions.mjs | 10767e710fd263cbe877afc741136b6bc7eb838af6ad85515c8bb169ae82c0ae |
| packages/workbench/server/registry-store.mjs | 18453eb98598aeec82baf319d0802481492e0e12c60b84f2da590b0ce2375f92 |
| packages/workbench/tests/mutation-admission.test.mjs | 85752e1b3a160e542ec9f9a98fc269a7f2888a93320ab7b0705b4c04b2f6a09a |
| scripts/registry_contract_model.mjs | d03d48654cca36648960c17d0180229b000f59fd4980b2c97c28f3b1686a950d |
