# 20f runtime resource profile receipt

Evidence-record: 20f
Date: 2026-09-08
Verification kind: runtime
Result: Passed for the frozen no-model synthetic process proof and canonical source application.

## Accepted evidence

The reviewed archive has SHA-256
`b380f892a455ba418c3f561028f3f7cc4b0e03248892ca41bedbf5cd35839bb9`
and 196,622 bytes. Its outer result passed, names the
`vivary.20f-resource-proof/v1` schema, and binds source-freeze SHA-256
`033b85b04f01dda5a8c11b88ac6c8facae0051947d538398086a59990b3c22b1`.
The embedded Linux result has SHA-256
`e4a229caad8526ea8ab2510954cc13dfa496b87848f26a5115e1a9914b5d1df4`.

The proof made zero model calls and zero container mutations. It did not stage
a remote run or change the v4 gate. The two pre-existing Habitat containers
remain exited with PID zero. The archive labels its scope
`synthetic-process-topology-only` and its resource proposal `proposal-only`.

The profile revision is `20f-worker-probe-v1`, with purpose
`no-model-worker-probe`. It set a 128 MiB worker cap, a 256 MiB controller cap,
and a 128 MiB outside-cleanup-owner cap. Their Linux total is 512 MiB. The
proof also declared 512 MiB for the Windows job, 512 MiB for platform overhead,
and a 1536 MiB reserve. These are the experiment's admission values. They do
not measure a native Docker or WSL requirement.

The output record is 15,250 Linux bytes plus 5,621 Windows bytes, totaling
20,871 bytes. That is below the 1 MiB profile cap. The profile kept the
five-second cleanup grace and a 240-second proof deadline.

## Phase evidence

All 43 tests passed with zero failures, errors, and skips. The resource-profile
suite ran 24 tests in 0.756 seconds. The native-host suite ran 19 tests in
1.304 seconds.

| Phase | Result | Duration | Cleanup result |
| --- | --- | ---: | --- |
| Planner MCP | Passed | 0.927 s | Both units absent after 0.146 s |
| Developer MCP | Passed | 1.024 s | Both units absent after 0.141 s |
| QA MCP | Passed | 0.982 s | Both units absent after 0.135 s |
| Controller death | Passed | 1.286 s | Both units absent after 0.125 s |
| Worker OOM | Passed | 1.392 s | Both units absent after 0.182 s |

Each cleanup record confirms the unit and cgroup were absent within the shared
grace period. Final child cleanup also passed in 0.193 seconds.

Planner and QA exposed only `list_files` and `read_text`. Developer also
received `write_text`, limited to the synthetic candidate. Each role rejected
traversal and writes outside that file. The specification remained unchanged.

The controller-death phase killed the captured controller identity, PID 879
with start-time ticks 2785. The outside owner sent SIGTERM to worker PID 886,
with start-time ticks 2801, and the worker stopped inside the grace period.
Its terminal worker snapshot binds cgroup device 23 and inode 3986.

The worker-OOM phase binds its terminal worker cgroup to device 23 and inode
4090. The worker reached its 134,217,728-byte cap. Its `memory.events` counters
changed from zero to `max: 37`, `oom: 1`, and `oom_kill: 1`. The controller and
cleanup owner recorded no OOM event.

## Reviewed corrections and source status

The reviewed driver source corrected fixture aliasing so phase inputs do not
share a mutable fixture. It also corrected the terminal-counter race. The
driver captures the terminal cgroup counters before cleanup and binds them to
the post-fault process identity and cgroup device and inode. The accepted
archive contains the resulting provenance records.

The lead applied the two reviewed sources to the canonical tree with the local
reviewed application helper. The application record has SHA-256
`455119cf0357f095f422a9e4eb2385f3643fc872f87875b52adc1c78e992a5f1`.
It verifies the archive hash, null preimages, and these resulting source hashes:

| Canonical source | SHA-256 |
| --- | --- |
| `tools/hoh/resource_profile.py` | `a22c074d9742e83c69d0ac8839ae01115d71814f236a2bbd59a7a22873f37ae5` |
| `tools/tests/test_hoh_resource_profile.py` | `9a66fe8c4b046d2d15d5cbcb5dfca46c5cedefea2663078cb91caa284f6fd153` |

This record completes the frozen-source and archive pairing. Packet 20f is done.

Earlier failed 20f archives remain private provenance. They document rejected
attempts and cleanup. They do not contribute to this acceptance and do not
change the archive, source-freeze, or result hashes above.

## Remaining boundary

This proof establishes bounded process containment, MCP tool access, fault
handling, resource observations, and exact cleanup for synthetic work. It does
not prove native Docker isolation, daemon cgroup ancestry, reference or proxy
budgets, measured WSL overhead, live invocation cleanup, production
authentication, or model behavior. The unresolved components remain explicit
in the archived proposal. No publication, push, merge, spend, container start,
or model invocation is part of this result.
