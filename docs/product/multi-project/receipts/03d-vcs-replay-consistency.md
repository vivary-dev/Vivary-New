# 03d VCS consistency runtime receipt

Evidence-record: 03d
Date: 2026-09-08
Verification-kind: runtime
Verification-result: passed
Source-application: verified

The frozen Habitat snapshot passed independent acceptance. This receipt covers
synthetic VCS decisions through the registry model, Native SQLite store, and
Native action boundary. The [packet](../packets/03d-vcs-replay-consistency.md)
records the seven applied sources and canonical verification.

## Evidence identity

The retained archive is `.tmp/hoh-proof/03d/reviewed-evidence.zip` in the preserved
Littleagent workspace. Its size is 199,831 bytes. The reviewer verified every one
of its 43 manifest entries and found no unlisted members. The archive remains
unchanged. This receipt records independent acceptance separately and binds it
to the archive by SHA-256.

| Artifact | SHA-256 |
| --- | --- |
| `reviewed-evidence.zip` | `4248daac13c3f28dfe2e9e62cace8c6ca7f9c2b13c2f16a4a4ead3f3ee5bf356` |
| `evidence/native/reviewed-source.json` | `c8a443d8cab38b45687a8005e0de02c1a946cbdb6245b881637de3eeb41cb25f` |
| `evidence/native/result.json` | `d55cb8a835910964bb7b6f37b5603b082c67ea25d84b597bf210d2785e6b7fb3` |
| `evidence/native/cleanup.json` | `c806c932a2301d28770f54375027c4e433e47bd84a01c51c056b03f6e682eeb0` |
| `evidence/native/stdout.log` | `2d8d342eb81569dacd4fd0ec3e121a87259b068455f3c9a827e94f7742d63d3c` |

The seven archived sources match the freeze and runtime source hashes. The ten
dependency hashes and six Native input hashes also match their archived bytes
and before/after runtime records. The preserved original source hashes did not
change during the proof.

## Runtime results

All three commands use `--max-old-space-size=192 --test --test-concurrency=1
--test-reporter=tap`. The exact executable and absolute test paths are recorded
in `result.json` under each phase's `deadline_audits` command record.

| Phase | Test target | Passed | Failed | Skipped | Process seconds |
| --- | --- | ---: | ---: | ---: | ---: |
| Oracle | `scripts/tests/test_registry_contract_model.mjs` | 47 | 0 | 0 | 0.548 |
| Storage | `packages/workbench/tests/registry-store.test.mjs` | 18 | 0 | 0 | 81.876 |
| Actions | `packages/workbench/tests/registry-actions.test.mjs` | 13 | 0 | 0 | 23.438 |
| Total | Three serial phases | 78 | 0 | 0 | |

The actual fixture contains 65 cases. All seven deliberate mutants were killed.
The replay-consistency mutant fails `rebind-replay-vcs-changed`. The duplicate
consistency mutant fails `duplicate-root-stale-vcs`. The test source asserts
these exact failure IDs.

The oracle covers complete VCS equality, key-order independence, registration
and rebind replay, stale requested revisions, and the safe-integer boundary.
Authority, policy, identity verification, request digest, receipt status, and
malformed-input precedence remain covered. Matching replay and duplicate
registration also pass through the actual Native store and action.

## Row and action witnesses

The reviewer decoded the two TAP witness records from raw stdout. Both match
the structured runtime results and their recorded witness hashes exactly.

| Witness | Decision | Registry rows changed | Allocator calls |
| --- | --- | ---: | ---: |
| `native-replay-receipt-vcs-mismatch` | `superseded-operation` | 0 | 0 |
| `native-replay-binding-vcs-mismatch` | `superseded-operation` | 0 | 0 |
| `native-replay-observed-root-vcs-mismatch` | `superseded-operation` | 0 | 0 |
| `native-duplicate-binding-vcs-mismatch` | `stale-binding` | 0 | 0 |
| `native-action-duplicate-binding-vcs-mismatch` | `stale-binding` | 0 | 0 |

Every before/after snapshot includes all registry project, binding, receipt,
and revision rows. The synthetic setup changes precede the measured operation.
Each storage refusal has exactly `output: {code}`, `effects: []`, and
`recordChanges: {}`. Both duplicate mismatches also supply a stale requested
registry revision.

Native action output accepts only the bounded registration refusal. An added
private field fails strict validation. Export rejects `stale-binding` under its
unchanged schema. Native audit remains a separate after-handler record outside
the unchanged registry-row assertion.

## Resource limits and cleanup

Fresh admission recorded 5.93 GiB available RAM against the required 2.5 GiB.
The Linux cgroup enforced 512 MiB memory, zero swap, one CPU, and 64 tasks.
Each child Node invocation includes its 192 MiB heap flag. Peak Linux cgroup
memory was 153,735,168 bytes, with no OOM or memory-limit events.

Each phase used its own absolute 180-second Linux `CLOCK_BOOTTIME` deadline,
with at most five seconds of stop grace. The frozen service limit was 610 seconds
and the launch wait limit was 650 seconds. Total recorded runtime was 106.244
seconds. No phase timed out or reported orphaned descendants or late output.

The supervisor allowed 1 MiB combined stdout/stderr per phase. The final capture
contains 38,160 stdout bytes and zero stderr bytes. Each inner Native worker has
separate 512 KiB stdout and stderr buffers, totaling a 1 MiB allowance per worker.
The declared 512 MiB Windows parent allowance was not an enforced Windows job cap.

The hash-bound cleanup records confirm absence of process groups 916, 933, and
1500. They also confirm absence of `vivary-03d-proof.service`, its cgroup, and
the exact private proof stage. No case entries, retained stage entries, or
cleanup errors remain. These are the exported run's cleanup observations. This
review did not restart Habitat or claim that shared Habitat activity had stopped.

## Independent acceptance and remaining work

GPT-6 Astra independently accepts the frozen source/runtime pairing. The review
found no blocking behavior or evidence-integrity issue. It checked actual TAP
counts, named mutant failures, SQL witnesses, strict action output, archive
binding, resource records, and exact cleanup. Earlier source review remains an
input, with the two predicates and Native witness setup inspected again here.

This proves synthetic identity decisions and Native SQL/action behavior. It
does not prove physical Git identity, production authentication, filesystem
effects, reservation or fencing, outcome completion, or release acceptance.

The lead applied all seven accepted sources after verifying every original
canonical preimage and unchanged proof dependency. Readback matched every
accepted hash. The canonical oracle passed all 47 tests, including all seven
mutation checks. Source navigation and line-ending checks passed. The private
application record preserves the before/after hashes. The 04d and 06e freezes
now require explicit dependency reconciliation before either proof runs again.
Earlier archives remain unchanged. The accepted archive supplies these bytes:

| Canonical target | Accepted SHA-256 |
| --- | --- |
| `docs/product/multi-project/contracts/project-registry.md` | `13bf52b7e15f00abf8708ac70bffe40548129eea86ae267108cd79a59800e8fd` |
| `scripts/registry_contract_model.mjs` | `a392fa5bce0d8e3921a3b91710f6e2debafe3dc6d8dde4f4df53a4863e1e5aeb` |
| `docs/product/multi-project/fixtures/project-registry.json` | `f941ed54fcae3bd5192b77a299ca4af07b1caf47d42d752e172c30e9a3fb6909` |
| `scripts/tests/test_registry_contract_model.mjs` | `6fe5f938003fde0961cf9fb8648145410031c12e11e30f67324a6f6db2598070` |
| `packages/workbench/server/registry-actions.mjs` | `897e70b50267c611fdc42145fc91717f52e5db2738243b682d6f419d50e05e06` |
| `packages/workbench/tests/registry-actions.test.mjs` | `4931b2eee87fb31623b76879af9fb8955d33be55b744dc92eb95402bed3333de` |
| `packages/workbench/tests/registry-store.test.mjs` | `d84e3fd1cce8c20ec88f301b7f4074256bc4c1311b52bf349df08fc6810ddca4` |

Documentation checks establish receipt identity, links, counts, hash
transcription, and packet status. They do not rerun or replace the Native proof.
