---
type: packet
---
# 20f: Prove a configurable resource profile without model calls

Parent: 20
Status: done
Depends-on: [10c, 20c]
Owner: Sol runtime_readiness_writer; Astra independent review; lead canonical writes and evidence acceptance.
Scope: Add a pure typed resource profile and verify a small credential-free worker experiment in existing Habitat. Preserve the live 20a launcher and runtime defaults.
Verification-kind: runtime
Verification-result: passed
Evidence: [20f runtime resource profile receipt](../receipts/20f-runtime-resource-profile.md)
Timebox: One bounded implementation and review unit. Each admitted proof uses the frozen limits below.
Authority: Lead reviewed this bounded no-model experiment on 2026-09-08. Claim before implementation and freeze reviewed sources before execution. No live runtime authority is granted.

## Goal

Make the resource calculation inspectable and test the 128 MiB worker hypothesis.
Prove that an outside cleanup owner survives controller death and stops the
packet's processes. Keep every live v4 admission control unchanged.

This packet can establish a process-based worker resource result. It cannot
establish Docker isolation, Claude requirements, proxy requirements, or live
invocation cleanup. Those facts remain prerequisites to replacing v4 admission.

## Context

Canonical paths are relative to the existing Vivary worktree. Private paths
are relative to the preserved Littleagent source checkout named by the handoff.
Read the canonical `AGENTS.md` and `docs/product/multi-project/execution-contract.md`.

| Source | Required reading and established fact |
| --- | --- |
| `docs/product/multi-project/packets/20a-headless-loop-proof.md` | Isolation, usage, deadline, and account authority remain owned by 20a. |
| `docs/product/multi-project/receipts/20a-headless-loop-proof.md` | Read version four preparation through stopped-container resource inventory. V4 has zero calls. Prior unknown accounting remains unknown. |
| `docs/product/multi-project/design.md` | Read the resource and model decision dated 2026-09-07. Admission needs the complete job budget plus at least 1536 MiB reserve. |
| Private `.tmp/vivary-continuation/20a-resource-envelope.proposal.md` | Source-grounded resource proposal. Its smaller limits are hypotheses. |
| Private `.tmp/vivary-continuation/20a-resource-inventory.json` | Observation dated 2026-09-08. Reference and proxy are exited with PID zero. Docker reports systemd cgroups v2. |
| Private `.tmp/vivary-continuation/run_v4_mode.py` | `resources(True)` omits `MemoryBudgetMiB`, so the declared-budget check refuses. Its separate 6 GiB comparison is a legacy threshold. |
| Private `.tmp/vivary-continuation/resource_preflight.ps1` | Admission uses unrounded available memory, declared job MiB, reserve, and 10 GiB disk. It does not enforce runtime limits. |
| `tools/hoh/native_host.py` | Read `plan`, `create_command`, `verify_container_inspection`, `verified_habitat_owner`, `launch_verifier`, and `_cleanup_names`. |
| `tools/hoh/role_mcp.py` and `tools/tests/test_hoh_native_host.py` | Reuse `serve`, `RoleTools`, and the actual Unix socket fixture. `serve` accepts an explicit `RoleView`. The CLI assumes `/role`. |
| `tools/hoh/protocol.py` and `tools/hoh_loop.py` | Reuse existing absolute BOOTTIME bindings and stop semantics. Do not add a clock implementation. |

Docker inventory values `Memory=0`, `MemorySwap=0`, and `PidsLimit=null` mean
unspecified limits. They do not prove zero usage or disabled swap. The engine's
4107522048-byte total memory report is neither Windows free RAM nor a measured
incremental WSL budget. A build was active during that inventory.

The native host and worker each have a hardcoded 1 GiB Docker memory limit.
Both use two CPUs, 128 PIDs, and a 64 MiB `/tmp`. The verifier requires those
values. No explicit swap limit appears in that command. Reference and proxy
limits are unspecified. Their complete simultaneous live budget is unproved.

## Owned files

The implementation writer owns only these files:

- `tools/hoh/resource_profile.py`, a new pure module with typed profiles,
  deterministic hashing, phase accounting, and resource observation validation.
- `tools/tests/test_hoh_resource_profile.py`, focused contract and refusal tests.
- Private `.tmp/vivary-continuation/run_20f_resource_proof.py`, one reviewed
  Windows admission, transfer, outside-owner launch, export, and cleanup driver.
- Private `.tmp/vivary-continuation/20f_resource_probe.py`, one reviewed Habitat
  helper with fixed worker, controller, observer, and fault modes.

The lead owns the canonical packet, `receipts/20f-runtime-resource-profile.md`,
parent log, graph, source-navigation entries if required, and existing handoff.
Evidence uses `Evidence-record: 20f`. Generated graph files remain generated.

Keep `native_host.py`, its existing tests, `role_mcp.py`, `protocol.py`,
`hoh_loop.py`, and `resource_preflight.ps1` read-only. Keep all v4 launch gates,
staging manifests, trial settings, and the durable ledger read-only. No existing
runtime imports the new profile module in this packet.

Use the existing Habitat checkout named by the handoff. Reuse one private
proof directory, `.tmp/hoh-proof/20f`, in each existing checkout. Do not create
another checkout, dependency tree, service framework, scheduler, or ledger.
Coordinate with the lead before transferring files or running a heavy proof.
Other agents own 04d and 06e. Do not revert or absorb their changes.

## Resource profile contract

Use frozen Python dataclasses and standard-library JSON. Keep one versioned
profile contract. The module must perform no process launch, Docker call,
filesystem write, account lookup, trial admission, or environment mutation.

Define these strict serialized records. Reject missing or extra keys, duplicate
JSON keys, booleans used as integers, nonfinite numbers, and unknown revisions.

| Record | Exact fields |
| --- | --- |
| Profile | `schema`, `revision`, `purpose`, `components`, `phases`, `host_budget`, `observer`, `deadline_seconds`, `stop_grace_seconds`, `combined_output_bytes` |
| Component | `id`, `kind`, `memory_bytes`, `swap_bytes`, `cpu_quota_us`, `cpu_period_us`, `pids`, `parent_id` |
| Phase | `id`, `active_component_ids` |
| Host budget | `windows_job_bytes`, `incremental_platform_bytes`, `platform_basis`, `platform_evidence_sha256`, `reserve_bytes` |
| Observer | `sample_interval_ms`, `maximum_gap_ms`, `stop_headroom_bytes` |

Use schema `vivary.runtime-resource-profile/v1`, revision
`20f-worker-probe-v1`, and purpose `no-model-worker-probe`. Component kinds are
`worker`, `controller`, and `cleanup-owner`. Do not accept a native-launch purpose.
Use explicit byte values in serialization. The table below displays MiB.

The configured numbers may change only between evidence-preserving experiments
with a new revision and independent review. Require positive memory, CPU, and PID bounds,
unique IDs, known phase members, and an acyclic parent relation. Set swap to zero.
Reject a component under multiple parents, a cleanup owner inside a workload
ancestor, or a phase without a cleanup owner. Require reserve of at least
1610612736 bytes and the existing five-second stop grace.

Calculate each phase from its complete concurrent set. A bounded parent covers
its descendants, so count it once. Sum disjoint top-level caps. Verify that
descendants have that actual ancestry before relying on the parent. A grouping
label alone cannot remove a component from the sum. Reject unbounded components
and missing parent observations. Add Windows job and incremental platform
allowances exactly once to the maximum Linux phase total.

Hash canonical UTF-8 JSON with sorted keys, compact separators, and no NaN.
Return a SHA-256 digest with the validated profile. Never accept a caller's
claimed digest instead of recomputing it. Round bytes upward only when passing
whole MiB to the existing preflight. Retain exact bytes in evidence.

Set `platform_basis` to `declared-experiment-allowance` for this experiment.
`platform_evidence_sha256` may be null before the first measurement. That absence
does not block a no-model probe with a declared allowance, verified process caps,
fresh host headroom, and active outside observers. It prevents any claim that the
platform allowance is measured or enforced. Missing observations remain unknown.

Only the fixed `no-model-worker-probe` purpose can use this experimental basis.
An actual result may support a later measured proposal. It never changes the
basis or authority of an already admitted experiment. Bind the observer settings
to the profile digest along with every resource limit.

Expose a small pure API with these responsibilities:

1. Parse and validate a profile into its frozen type.
2. Return its canonical digest and calculated per-phase and maximum job bytes.
3. Compare a complete observed cgroup snapshot against a phase and profile.
4. Derive a no-model admission request when the declared experimental allowance,
   process boundaries, observer readiness, and source freeze all match.

Return named refusal reasons with the component or field that failed. Do not
build a general policy engine, arbitrary shell-command planner, or runtime registry.
Represent Docker inventory in refusal fixtures only. The new module cannot
convert a process probe result into native launch authority.

Emit a typed, non-executable resource proposal alongside the proof result.
Include the profile digest, measured component observations, evidence hashes,
and explicit unresolved live components. Its type and serialized purpose must
state `proposal-only`. It cannot be passed to `HabitatNativeHost.runner` or a
trial admission API. Proposed Docker arguments, if included, are source-contract
examples only. This packet does not run or validate them against live Docker.

## Bounded no-model experiment

The proposed Linux topology has three disjoint sibling cgroups. The cleanup
owner remains outside both cgroups it may stop.

| Component | Memory cap | CPU quota per 100000 microseconds | PID cap |
| --- | --- | --- | --- |
| Credential-free worker | 128 MiB | 50000 | 32 |
| Probe controller and ordinary observers | 256 MiB | 25000 | 16 |
| Outside cleanup owner | 128 MiB | 25000 | 16 |

Every group has `memory.swap.max=0`. The Linux sum is 512 MiB and one CPU.
Use a 512 MiB Windows Job Object for all packet Windows processes. Disable
breakaway and confirm actual membership before execution. Use the job-wide
committed-memory limit, not a per-process limit. Record that Windows commitment
and resident working set are different measurements. Declare another
512 MiB for incremental WSL and platform overhead. This exploratory allowance
equals the complete capped Linux workload, doubling its budget contribution.
It is a conservative experiment choice, not an observed requirement or global
WSL limit. Docker containers stay stopped and dependency installation is excluded.

The complete initial job budget is 512 MiB Linux plus 512 MiB Windows plus
512 MiB platform allowance, totaling 1536 MiB. Adding the 1536 MiB reserve
requires 3072 MiB available physical memory before launch. Also require at least
3072 MiB unused Windows commit capacity. Calculate both from the frozen profile.
These conditions admit the experiment that tests the allowance. They do not
require its own measurement to exist first.

Before the heavy proof, collect a bounded read-only baseline in the already
running Habitat environment. Record Windows physical availability and commit
headroom, WSL total and available memory, cgroup mounts, and exact task-process
membership. Take a ten-second baseline with the packet's observers active and
no worker running. Freeze the baseline's process identities and counter meanings.
Include all observer processes in their declared caps. A snapshot or baseline
does not prove a future overhead bound. Do not substitute the engine's total
memory for available host headroom.

The Windows outside observer samples raw physical availability and unused commit
capacity every 250 milliseconds. The Linux outside owner samples cgroup counters
and `/proc/meminfo` at the same interval. Use persistent observers rather than
launching PowerShell or WSL for each sample. An observation gap above 1000
milliseconds or loss of either mandatory observer triggers owned cleanup.

Set `stop_headroom_bytes` to 1879048192, or 1792 MiB. Stop if physical availability
or unused commit capacity falls below that value. This retains a 256 MiB early
stop margin above the 1536 MiB reserve. Trigger on one sample, without averaging
or retry. An observed breach of the reserve is a failed resource experiment,
even when cleanup succeeds. Keep the existing five-second cleanup deadline.

Require at least 1280 MiB Linux `MemAvailable` before workload launch, covering
the 1024 MiB Linux-plus-platform allowance and a 256 MiB local margin. Stop if
Linux `MemAvailable` falls below 256 MiB or more than 1024 MiB below baseline.
That threshold is the 512 MiB Linux cap plus the 512 MiB platform allowance.
When Windows exposes a reliable aggregate WSL working-set counter, bind its
process identities and stop if its increase exceeds 1024 MiB. A changed identity
invalidates that counter. Record its absence or invalidation explicitly and
retain mandatory physical, commit, and Linux observers. No missing optional
counter may become zero or a claim of measured platform overhead.

Shared WSL or unrelated application growth may trigger these conservative stops.
Stop only this packet's work. Never reclaim another application's memory or
change shared WSL settings to make the experiment fit. Sampling and cleanup
latency mean these observers cannot guarantee continuous host reserve or a hard
WSL memory ceiling. Cgroup memory limits bound the owned Linux groups. The
Windows Job Object bounds its owned processes' aggregate committed memory.

Freeze the exact source, test, driver, profile, available prior evidence, and dependency
hashes before admission. Read profile bytes once. Bind the preflight result to
that digest before any launch. The launched driver must verify the same digest,
the explicit budget, `Allowed`, `BudgetDeclared`, `Heavy`, and reserve. Reject
manifest changes during preflight or between admission and launch.

Run only when the lead's other heavy job is complete and cleaned up. Use fresh
`resource_preflight.ps1 -Heavy -MemoryBudgetMiB <calculated MiB> -ReserveMiB 1536`.
Keep the 10 GiB disk condition. Never use rounded `FreeRAMGiB` for comparison.

Use existing systemd cgroups v2 support. Verify the exact group paths and
`/proc/<pid>/cgroup` membership for every owned Linux process. Capture each
group's `memory.max`, `memory.swap.max`, `cpu.max`, `pids.max`, `memory.current`,
`memory.peak`, and `memory.events`. Record ancestor paths and finite ancestor
limits. Count all packet helpers, including sampling and export helpers.

A limit around `docker exec` constrains the client, not the daemon-owned
container. This proof performs no Docker create, start, exec, update, or stop.
It may repeat bounded read-only inspection of the two recorded stopped IDs.
If either ID, image, or exited state changes, leave it alone and defer that check.

Use explicit allowlisted environment values, an empty task-owned home, and
synthetic files. Do not mount or inspect authentication state. Invoke the existing
`serve` function with a task-owned `RoleView` and Unix socket. Do not modify
`/role` to satisfy the CLI's fixed path. Use the existing BOOTTIME guardian with
one absolute deadline. Keep Python isolated from ambient package paths.

Complete these phases serially, with cleanup between phases:

1. Planner MCP initialization, tool listing, permitted reads, write refusal,
   and traversal refusal against synthetic files.
2. Developer initialization, permitted candidate read/write, unchanged
   specification, and rejection of writes outside the existing candidate file.
3. QA initialization, permitted reads, and write refusal. Verify exact read logs.
4. Controller-death fault with a harmless live worker. Kill only the captured
   controller identity and prove the outside owner stops the worker.
5. Worker OOM fault using a fixed harmless allocator inside the 128 MiB worker
   cgroup. Prove the limit and outside-owner cleanup without exhausting the host.

Each phase lasts at most 30 seconds plus the existing five-second stop grace.
The entire admitted experiment lasts at most 240 seconds plus five seconds
for cleanup. Persist absolute boot identity and expiry before the first launch.
Resume cannot refresh a phase or experiment deadline. Reuse the existing clock
implementation and preserve its early stop on boot mismatch or invalid evidence.

Retain at most 1 MiB combined stdout and stderr for the entire experiment.
Read streams incrementally. Overflow triggers owned cleanup and failure.
Cap evidence export at 8 MiB and temporary synthetic files at 4 MiB. Refuse
an existing output path or unreviewed source mismatch instead of overwriting it.

## Outside cleanup ownership

Before any worker starts, the outside owner holds the frozen profile digest,
absolute deadlines, exact unit names and cgroup paths, and controller identity.
Bind process identity to PID, boot identity, and start time. A reused PID is
not ownership. Keep the ownership record bounded and exclusive to this proof.
It is temporary test evidence, not another durable runtime store.

The outside owner monitors controller exit, worker exit, memory pressure, and
the absolute deadline. It must survive the controller's SIGKILL and worker OOM.
On any stop condition, request termination of owned groups, escalate within
five seconds, reap where it is the parent, and verify all owned groups empty.
The Windows parent independently observes the outside owner and performs exact
unit cleanup if that owner exits before verified settlement. Neither fallback
may rely on the dead controller's `finally` block.

Prove systemd unit ownership and membership before signaling or stopping it.
Refuse unrelated units, cgroups, processes, container IDs, or a changed owner
record. Do not use a shared slice limit, Docker prune, WSL shutdown, or broad
process-name killing. Stop and preserve evidence if exact cleanup is uncertain.

Collect memory peaks and events before collecting units, then verify unit,
cgroup, process, socket, and temporary-stage absence. The OOM phase expects a
worker `oom_kill` increase. Healthy phases require no OOM. The controller and
outside owner require no OOM in every phase. Expected worker OOM does not
license automatic retry or a larger limit.

This is evidence for the synthetic process topology only. Live Docker cleanup
still needs exact invocation container ownership transferred before creation,
verified daemon cgroup ancestry, and actual controller-death and OOM proofs.
The existing `_cleanup_names` implementation cannot run after its owner dies.

## Verify

Write focused failing tests before the profile implementation. Test refusal for
missing budgets, zero or negative bounds, booleans, duplicate keys, unknown
revisions, changed digests, cyclic parents, double counting, missing components,
unbounded inventory values, wrong swap policy, and cleanup ancestry overlap.
Include equal-bound and one-byte-over-bound cases and upward MiB conversion.
Verify that a null prior platform-evidence hash permits only the declared
no-model experiment when all caps and observers are ready. Verify reserve,
early stop, growth, stale-observer, and optional-counter behavior separately.
Test an admission digest changed during preflight. Assert no refusal performs
a process call or mutation.

Read-only baseline assertions must preserve the live 1 GiB host and worker
commands and existing inspection behavior. Do not rewrite their tests to pass
smaller bounds. Run the existing native-host tests unchanged.

Run the following commands through the reviewed bounded Habitat driver after
source hashes match. The outer driver owns admission and cleanup for every
command, including test processes. A bare shell command is not proof containment.

```console
python3 -B -m unittest discover -s tools/tests -p test_hoh_resource_profile.py -v
python3 -B -m unittest discover -s tools/tests -p test_hoh_native_host.py -v
```

The Windows proof entry point is created by this packet:

```console
python .tmp/vivary-continuation/run_20f_resource_proof.py --profile .tmp/hoh-proof/20f/profile.json --freeze .tmp/hoh-proof/20f/reviewed-source.json
```

Make this command default to the five fixed no-model phases. It must have no
bootstrap, live, auth, arbitrary-command, or container-start option. The profile
and freeze are lead-reviewed outputs, not guessed missing inputs. Freeze the
test count after implementation. Require that exact count, zero skips, all
expected phase markers, bounded output, and independently verified cleanup.

The lead runs existing planning checks when publishing and closing the packet:

```console
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

Verify the canonical ledger and all frozen v4 inputs are byte-identical before
and after every actual proof. Read only their bounded hashes and required
accounting state. Do not export credential material. Preserve prior accounting
and unresolved history exactly. Never import bootstrap or launch-staging helpers
that perform top-level actions into the probe.

## Done condition

Close 20f only after profile checks, the actual no-model phases, independent
review, fixes, export verification, and exact cleanup pass. Missing prior live
profile measurements do not block this declared experiment. If fresh headroom,
mandatory observations, or process containment are unavailable, name that exact
runtime prerequisite and leave runtime acceptance open. A source-only result is
not a passed runtime packet.

The receipt binds exact profile/source hashes, observed budgets, phase outputs,
fault timing, memory events, cleanup identities, ledger hashes, and archive
manifest hashes. Mark the worker result process-based. Record sample intervals
and gaps. A sampled peak cannot replace kernel peak evidence. A measured peak
does not establish that every future workload fits the cap.

Report the host, Linux, and optional WSL observations as distinct time series.
Record observed minima, peaks, sample gaps, stop thresholds, and cleanup timing.
The experiment can falsify its allowance through an observed threshold breach.
A pass shows only that this fixture completed within observed conditions and
enforced process caps. It cannot isolate shared WSL overhead perfectly, bound
future workloads, or establish native Claude or Docker memory requirements.
Keep the declared platform allowance labeled experimental after a single pass.

The next live-resource revision still needs these concrete facts:

- A native Claude host retains its 1024 MiB cap. Its required working memory and
  safe headroom under the intended fixture remain unknown.
- Reference/proxy finite bounds, tmpfs charges, swap settings, actual cgroup
  ancestry, and complete concurrent phase accounting remain unproved.
- A source-reviewed lifecycle must remove reference overlap or include its full
  cap. Never reuse stale auth or identity observations across roles.
- Exact native container custody and cleanup must survive controller death and
  OOM. Process-only proof does not meet that requirement.
- Windows/WSL/Docker incremental memory and commit requirements need observed
  evidence or enforced bounds. This packet cannot change global host settings.
- Frozen trial and source changes require the existing typed continuation and
  reconciliation API. Do not rewrite admitted v4 input files or ledger bytes.

Only a later accepted live-resource revision may replace the 6 GiB comparison
and supply the correct explicit budget to the existing v4 launcher. Preserve
model choice, native context/compaction/response defaults, turns, timeouts,
usage policy, reported-token target, included-only access, and one active call.

The next integration packet must own `native_host.py`, its existing boundary
tests, and the v4 wrapper and freeze owners together. It must bind a reviewed
profile through plan construction, Docker arguments, actual inspection, and
`verified_habitat_owner` without weakening that exact owner check. It also owns
reference/proxy lifecycle accounting and outside-owner container custody. Its
acceptance requires actual resource observations and controller-death cleanup
for that Docker topology before live admission changes. The lead materializes
that packet after reading this receipt. No new account or credential prerequisite
blocks its source implementation. Existing account limits apply to actual calls.

## Stop conditions

Stop the affected runtime operation on low reserve, insufficient commit or disk,
missing declared allowance, a competing heavy job, source/profile drift, missing
cgroup support, ancestry mismatch, output overflow, deadline expiry, unexpected
OOM, a mandatory observer gap, an observed growth threshold breach, or uncertain
cleanup. Preserve that failed experiment. Continue independent
source review without running a larger or live experiment.

No container creation or startup, account changes, authentication probes, model
calls, launch-slot claims, ledger writes, live threshold changes, global WSL or
Docker settings, dependency installs, or unrelated process cleanup are in scope.

## Log

- 2026-09-08: Private draft grounded in the resource proposal, stopped-container
  inventory, 20a packet and receipt, and existing native-host and MCP sources.
  Implementation and no-model execution have not started.
- 2026-09-08: Removed the circular requirement for prior overhead measurements.
  The initial no-model experiment declares a 1536 MiB total job budget, preserves
  1536 MiB reserve, and binds outside observer thresholds. Live acceptance stays separate.

- 2026-09-08: Lead accepted the bounded no-model experiment after removing a circular prior-measurement gate. Initial platform overhead is a declared experimental allowance under outside observation, not a measured guarantee. Ready for the serial implementation writer after current work; live v4 gates remain unchanged.

- 2026-09-08: Claimed for serial Sol implementation while 04d source and fixture are frozen under independent review. Stage the pure module and tests privately; no canonical code writes or proof execution until lead review and admission. Live v4 files and accounting stay unchanged.

- 2026-09-08 Habitat availability checkpoint: Pure resource-profile module and 24 test methods passed source review after exact experiment admission and cgroup ancestry corrections. Outside-owner probe drivers are in progress; neither unit nor live probe acceptance is claimed. Habitat remains stopped after repeated `HCS_E_CONNECTION_TIMEOUT` availability failures. No test process launched; shared WSL/Docker were not restarted. Runtime requires restored availability and fresh resource admission.

- 2026-09-08 frozen source preparation checkpoint: The profile, module, tests, Windows supervisor and Habitat probe passed independent source review and are frozen. Recorded remote preimages are historical expectations and must be verified before launch. Eight inert AST-only parser tests passed after duplicate-record, numeric-type and BOOTTIME-duration corrections. Two inert output-accounting tests passed against the actual extracted helpers: retained workload bytes stop at 384 KiB per platform while the 128 KiB cleanup reserve remains usable and overflow keeps the proof failed. Linux locking is stubbed in these serial tests and awaits runtime proof. Neither the 24 unit tests, 19 existing host tests nor five process phases have run. No resource proposal has runtime evidence; v4 admission and accounting remain unchanged. Private source freeze: `20f/reviewed-source.json`; SHA-256 `89fb9267c350ead3fbabbccb8d717c2784454130c163db13da1db56a4ca73569`. Repeated no-op Habitat startup checks returned `HCS_E_CONNECTION_TIMEOUT`, including after a successful Habitat-only terminate command. No test started. Two unrelated Hermes containers remained running; shared WSL/Docker restart was not attempted. Runtime requires restored Habitat and fresh packet-specific resource admission.

- 2026-09-08: The reviewed no-model proof passed and its archive is bound in the
  [20f receipt](../receipts/20f-runtime-resource-profile.md). The lead applied
  the two archive-bound sources and verified their preimages and hashes in the
  canonical application record. This completes 20f. The proof does not change
  v4 admission, containers, model policy, or ledger state.
