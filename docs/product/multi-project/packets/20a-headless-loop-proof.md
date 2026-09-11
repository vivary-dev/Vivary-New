---
type: packet
---
# 20a: Prove the Claude Code headless loop on files

Parent: 20
Status: in-progress
Depends-on: [10c, 20c]
Owner: GPT-6 implementation lead
Scope: Implement the approved, configurable, versioned 20a-observed-usage-v1 experiment in the existing 20c coordinator and adapter, then verify one Claude Code proof. Initial acceptance uses three healthy iterations and two isolated fault runs within a 100,000 reported-token stopping target. Native isolation, included-only access, and coherent usage remain live preflight requirements. No Codex parity, GUI, Agent-Native server, new scheduler, or paid API key.
Verification-kind: runtime
Timebox: Checkpoint at each bounded verified unit and context boundary. Continue implementation and independent work under the execution contract. Each admitted trial retains its configured runtime deadlines and stop conditions.

## Current progress

Updated 2026-09-10. This is the current execution priority under the loop-first decision.

**Accepted:** The isolated native host/worker source and its Windows/Linux
resource controllers passed independent source review. The seven inert Windows
admission and cleanup tests passed. The candidate includes CPU/PID verification,
zero-swap limits, bounded observation and cleanup, and fixed failure handling.

**Remaining:** The no-model container exercise has not run. The complete reference
and proxy lifecycle and sizing remain unaccepted. Native V4 bootstrap and a full
planner → developer → independent QA cycle have not completed. Source preparation
does not establish that the agent loop works.

**Next:** With reviewed bindings and fresh 6 GiB warm admission, exercise the new
host/worker pair, including controller death and worker OOM. Keep the existing
reference and proxy stopped and unchanged. The two-request, 1,200-second budget
has used zero requests. Preserve the native usage ledger, including the invocation
whose usage is unknown. See the [resource receipt](../receipts/20a-headless-loop-proof.md#reviewed-container-drivers-2026-09-10).

## Goal

Prove the file-based planning, development, and QA loop with the owner's Claude
Code subscription. Bind each stage to the exact fixture, candidate, prompt,
observation, and receipt state that produced it. The claimable
[20c preparation](20c-headless-loop-preparation.md) keeps the
[loop-first direction](../design.md#direction-decision-2026-09-06) executable.
The approved experiment replaces the unsupported hard-token prerequisite.

Packet 20a proves one runtime against the common role and receipt contract. It
does not prove cross-runtime acceptance. Packet 20b owns the Codex run and the
field-by-field parity comparison.

## Context

Read [the direction decision](../design.md#direction-decision-2026-09-06),
[the alignment brief](../research/hoh-direction-brief.md) sections 1, 3, and 8,
[the HoH comparison](../research/hoh-alignment.md), outcome
[20](../tickets/20-run-bounded-factory.md), [the execution contract](../execution-contract.md),
`packages/core/vivary_core/receipt.py` for fingerprint binding, and
[10c](10c-habitat-fallback-proof.md) for the environment. The HoH role prompts
are in the paper's PDF appendix A.2 (arXiv 2609.01481v1, pages 22 to 25). The
HTML omits them. The Fusepoint repository (`Flesymeb/fusepoint`, branch
`gameloop`, `.gameloop/receipts/`) supplies the reference record shapes.

Packet 20c's [accepted preparation receipt](../receipts/20c-headless-loop-preparation.md)
records per-stage bindings, explicit acceptance, and two independently checked
62-test strict offline passes. Its dependency is complete. Packet 20a implements
the approved observed-usage policy before attempting live acceptance.
The [workflow input contract](20c-headless-loop-preparation.md#workflow-input)
defines the required configuration files for the commands below. Bind native
session references before starting a run. Prove the selected adapter creates
or resumes only that session and rejects identity mismatches.
The implementation defines the runtime-neutral role, transition, and receipt
interface in `tools/hoh/protocol.py`. Habitat has Claude Code `2.1.241`. The Claude adapter
maps only capabilities verified from that installed CLI onto the interface.
Record the version, model, subscription, and exact live-preflight flags. Do not
copy flags from a newer host CLI or assume a flag the Habitat command has not
verified.

The sequencer owns prompt assembly, schema validation with one retry, hashes,
test execution, no-progress detection, receipt writes, and Git stage
checkpoints. Follow appendix A.2 when the paper conflicts with its prose. The
sequencer also enforces the configurable iteration deadline and stop grace
bound by the active policy. Their initial values match the one-hour and
five-second settings tested by 20c. Its remaining duration covers every CLI,
role-tool worker, and test process; resume cannot reset that deadline. The
planner sees only the specification, its prompt, and prior public evidence. It
cannot mount or inspect candidate production code. The developer receives its
development document and a writable candidate tree. QA receives the
specification, development document, public deterministic evidence, and a
frozen read-only candidate. Planner and QA have read-only tool permissions.
Only the developer role receives candidate write authority.

Enforce those views with separate mounts or materialized role trees plus CLI
tool permissions. A working directory or prompt instruction alone is not an
enforcement boundary. Mount the specification, oracle, and common prompts
read-only for every role that can see them. The sequencer rejects a changed
frozen candidate, oracle, or prompt instead of accepting its report.

The trusted sequencer may run as the Habitat WSL control process. Keep the
authenticated CLI host separate from the credential-free role tool filesystem.
The full source bundle and proof
tree are control-process views only. Give each role a minimal projection of its
declared files. The planner must not inherit the source bundle, candidate trees,
raw developer logs, or another receipt root. Its public receipt index may expose
only approved detail files. Never mount the Docker socket inside a model-driven
container. Give the CLI host a proxy-only network and the role tool worker no
external network. Give both explicit CPU, memory,
process, capability, and no-new-privileges limits. The existing offline
preflight proves the image tools and authentication state only. It does not
prove this live execution design.

Private candidate and detailed receipt directories are proof outputs. They are
not a scheduler, memory service, native session record, or replacement
transcript store. Each role receives `<receipt-dir>/index.md` and opens details
under that same receipt root. Record each assembled prompt's bytes and SHA-256
hash. The tracked 20a receipt summarizes the private runtime evidence and binds
its claims to hashes and command output.

Run in the Habitat sandbox through its allowlist proxy. Use the owner's existing
subscription authentication without copying credentials. The offline 10c
container cannot run the coding agent.

## Usage contract

Jeff approved `20a-observed-usage-v1` for experimentation on 2026-09-07 in the
[policy and execution decision](../design.md#experimental-policy-and-continuous-execution-decision-2026-09-07).
This section owns the active contract. The
[20e receipt](../receipts/20e-native-usage-policy.md) retains the inspected
proposal, its documented capabilities, and historical implementation limits.
Approval permits implementation and verification. Live acceptance remains open.

All numbers and policy choices below are initial, configurable trial settings.
They are not permanent product limits. Persist a versioned policy configuration
with a unique trial identity and a canonical configuration hash. Bind that
configuration to the existing ledger, workflow, native sessions, and receipts.
Do not silently select defaults for missing required settings.

| Setting | Initial `20a-observed-usage-v1` value |
| --- | --- |
| Reported-token stopping target | 100,000 |
| Active invocation claims | 1 |
| Declared launch slots | 29 |
| Healthy iterations | 3 |
| Resume and regression fault iterations | 1 each |
| Schema retries per stage | 1 |
| Optional live preflight launches | 1 |
| Native turns per invocation | 10 |
| Invocation deadline | 600 seconds |
| Packet deadline | 3,600 seconds |
| Iteration deadline | 3,600 seconds |
| Local stop grace | 5 seconds |

The eleven rules below define this revision. Their numeric references denote
the settings above. Make policy settings explicit in configuration, validate
their relationships, and bind their exact values before admission. Preserve
the native compaction and response defaults. Token accounting is separate from
active context and response length.

Change settings or policy only between trials after recording evidence and a
new configuration revision. Preserve prior totals, unresolved claims, receipts,
and recovery state. A new trial ID cannot clear a stop, replay an unknown call,
or extend an admitted deadline. Reconcile any prior stop and record the next
trial's authority before dispatch. Evidence-based revisions are authorized by
the decision above, within existing account, spending, and security limits.
An unresolved accounting or authority gate still blocks the dependent call.
Changed proof counts require matching declared stages and acceptance evidence.
Neither reaching a limit nor failing a test automatically increases settings.

Keep the existing 20a `usage.json` as the durable accounting owner; the recorded
implementation path appears in the experimental revision below.
Extend the existing ledger and coordinator, retain the hard-reservation mode,
and do not introduce another store or model loop. Configuration edits within
an admitted trial must fail closed. Record supported configuration syntax and
its verified invocation in the implementation receipt before any live command.

1. Packet 20a uses a 100,000 reported-token stopping target. It has no guaranteed
   maximum on actual cumulative input and output, including native retries and
   auxiliary requests. Keep native compaction, response, model, and reasoning
   settings. Use existing included Claude subscription access only. Verify its
   authentication path without copying credentials. Do not introduce an API key,
   enable paid overflow, buy credits, or change account settings. If included-only
   operation cannot be established, stop the live operation and name that fact.

2. Use one durable packet ledger at the existing 20a `usage.json` path. Bind it
   to this policy revision, packet, source baseline, runtime version, model,
   native session, role, and attempt. All healthy, fault, schema-retry, and
   model-calling preflight paths share it. Before dispatch, atomically claim a
   unique invocation ID and a launch slot. There can be only one active claim.
   Never represent an estimate as `whole_invocation_maximum_tokens`. Extend the
   existing coordinator ledger explicitly for this policy, without another store
   or model loop. Keep the hard-reservation path for policies that require it.

3. Admit only while reported usage is below 100,000, no invocation is unresolved,
   and fewer than 29 launches have been claimed. Allow at most three healthy
   iterations and one iteration for each of the two existing faults. Each role
   has one initial attempt and at most one schema retry. One optional live
   preflight launch shares these limits. Healthy work has nine role stages,
   resume has three, and regression stops before QA after two. Two attempts for
   each of those fourteen stages plus one preflight give 29 launches. Every
   launch must name one of those declared stage/attempt IDs or the sole preflight.
   Unused slots never authorize extra work. Never recycle a
   claimed slot after a crash, cancellation, or failed start.

4. Start a persisted 60-minute packet deadline at the first model admission.
   Limit each invocation to ten minutes and preserve the existing one-hour
   iteration deadline. Use the earliest termination-request deadline. Confirmed
   local exit can take the additional five-second stop grace. Apply the existing clock and
   boot-identity checks. Resume never extends any deadline. Run one prompt with
   print mode and text input per invocation. Set `--max-turns 10`, use streamed
   JSON output, and keep the native session ID bound to the stage. Do not queue
   further user inputs, reset a native session to refresh counters, or launch
   native background agents. Disable all built-in tools with `--tools ""`.
   Expose only the role's scoped MCP tools through `--strict-mcp-config` and the
   explicit configuration. Verify that customizations cannot add Agent, Task,
   subagent, arbitrary shell, or provider-calling tools. Any subagent or background
   task event is terminal. Keep unavoidable native helper coverage labeled unknown.

   Ten turns and these durations are initial experimental
   limits for the small fixture. Task fitness is unmeasured. Reaching a limit
   leaves work unfinished instead of increasing the limit automatically.

5. Before the optional first live preflight, verify configuration, process
   isolation, watchdogs, durable counters, and refusal/recovery paths offline.
   That preflight is the sole bootstrap exception to previously observed final
   usage fields. Give it the same accounting and time controls and no write
   tools. It may establish the installed event shape. A missing, invalid, or
   inconsistent result stops all later live calls. If the preflight is omitted,
   supply prior evidence for this exact installed runtime and event mapping.
   A helper response cannot prove native turn-limit enforcement. Record that
   behavior as unverified until an authorized run actually reaches the limit.

6. Count each final invocation report once. Normalize input as `input_tokens`
   plus `cache_read_input_tokens` plus `cache_creation_input_tokens` when the
   installed mapping confirms these are separate. Add `output_tokens` once.
   Preserve raw usage, `num_turns`, and available per-model usage. Keep missing
   fields null. Label the accepted total `reported`, with native helper/retry
   coverage unknown. Four present fields alone do not establish full accounting.
   With subagents excluded, use the final main-loop usage as the required baseline.
   Include any separately reported, disjoint auxiliary usage after verifying its
   scope. Never add overlapping main-loop and per-model totals. Unexplained
   contradictions between them stop admission. Do not convert dollars into tokens.

7. During a call, use attributable usage events only as an early stop signal.
   Deduplicate message IDs and replace cumulative updates instead of summing them.
   Do not count assistant output placeholders as final output. Combine settled
   prior invocations with a nonoverlapping observed lower bound for the current
   one. Stop when this reaches 100,000. Final usage replaces that invocation's
   provisional observation, rather than being added again. Reject a final report
   below a verified comparable observation. Unavailable live output counts leave
   the time watchdog active and the total visibly partial.

8. On the token target, deadline, cancellation, native turn-limit error, native
   failure, or uncertain usage, persist a stop before dispatching anything else.
   Request termination, wait at most five seconds, then kill and reap the owned
   process group and credential-free tool workers. Verify no owned process remains.
   Failed cleanup blocks further calls. These actions limit local execution.
   They do not guarantee that a provider request stops or is uncharged. Native
   retries share the active invocation and its clock. They do not receive extra
   launch slots, fresh time, or assumed zero usage.

9. Require exactly one terminal native result, normal success subtype, exit code
   zero, completed command, matching bound session/request identity, and coherent
   required usage before settling the invocation's reported charge. Duplicate
   or missing terminal results, any native error subtype, a nonzero exit, or
   mismatched identity latch unknown accounting and stop the packet.

   A schema-invalid role response
   may use its one retry only if the native invocation otherwise succeeded,
   usage settled, bindings and fixed inputs match, and every admission check passes.
   A native error, crash, missing final report, missing field, negative count,
   impossible decrease, or unbound result records `unknown` accounting and stops
   the packet. Preserve known partial usage and the unresolved invocation ID.
   Block the whole remaining allowance administratively. This hold is not a
   numeric claim about consumed tokens. Never refund an unknown call as zero or
   use a fabricated finite reservation. Unknown coverage of invisible native
   helpers is the accepted policy limitation, distinct from a missing required
   invocation report.

10. Recovery first reconciles the existing ledger, receipt chain, candidate,
    policy, deadlines, stage, and native session. A fully settled developer
    checkpoint can recover deterministically without a second developer call.
    An outstanding claim or uncertain invocation cannot be replayed. Read-only
    reconciliation may attach a recovered final report, but cannot clear a
    packet stop or silently grant another call. Expired deadlines, uncertainty,
    or token overruns stop the trial. Any next trial requires explicit recorded
    reconciliation and admission under the approved experiment authority. An
    unresolved unknown invocation remains blocked and cannot be replayed. Compaction,
    a new process, a new receipt root, and session resume never reset totals.

11. Once reported usage reaches 100,000, launch nothing further. At exactly
    100,000, completed work can be accepted only if every required proof check
    already passed. Above it, record an overrun and leave 20a acceptance open.
    Missing usage also leaves acceptance open. Preserve partial candidate and
    test evidence. A successful 20a receipt may claim completion within the
    reported target and observed controls only. It cannot claim total provider
    consumption below 100,000 or complete invisible-request coverage.

The approved experiment replaces a hard token guarantee with this stopping policy. It accepts
unknown token overrun exposure within bounded local execution. It does not
promise that all three healthy iterations and both faults fit the initial limits.
Failed proof acceptance never automatically starts another attempt. Record
its evidence and reconcile accounting before an explicitly versioned next trial.

Record `vendor_usage_raw`, normalized input, output, cache, and budget fields
for each invocation. `aggregate_input_tokens` includes separately reported
cache input exactly once. `budget_counted_tokens` adds aggregate output once.
Missing fields remain `null`. Record `claude_agentic_turns` separately from
`codex_top_level_turns`, which is `null` for 20a. Never compare them as one unit.

## Fixture and execution layout

The tracked fixture contains a testable specification, its fixed oracle, and
incomplete starter behavior. Keep all desired behavior in the initial
specification and tests. The planner selects unmet product work from evidence.
It never creates, weakens, or rewrites the oracle to make an iteration pass.

The tracked starter is expected red. `tools/tests/test_hoh_loop.py` must pass by
running its product tests in an initial disposable copy and matching the exact
declared failing test IDs and observations. An arbitrary failure is a harness
failure. Only the completed disposable candidate must make every product test
pass. Never require the tracked starter's product test command to exit green.
Use the standard-library `unittest` runner. Do not install `pytest`.

Mount a read-only source bundle at `/opt/vivary-hoh-source`, outside the proof
tree. Set `HABITAT_TASK_HOST_ROOT` to the verified persistent Habitat work root,
then bind `${HABITAT_TASK_HOST_ROOT}/vivary-hoh-proof` to the container path
`/tmp/vivary-hoh-proof`. Verify the actual source, target, filesystem, and
options before any model call. Do not bind the production checkout. Mount
only the existing Claude authentication volume into the trusted CLI host. Do
not expose it through a role filesystem or a model-selected tool. Leave every
other `/tmp` path on its normal temporary filesystem.

Use a verified separation boundary. One supported composition to prove is a
Claude host with all built-in tools disabled and only explicit, scoped MCP
tools whose worker filesystem has no authentication mount or credential
environment. The worker may read its public inputs and perform role-authorized
candidate operations. It may not execute arbitrary commands in the authenticated
host. Keep native session/authentication handling in the CLI. Do not create new
credential storage or copy authentication into a tool worker.

Before acceptance, use a synthetic credential canary to prove every model tool
cannot read it through paths, links, environment variables, process files, or
shell execution. The CLI must still authenticate through its existing native
state. Missing isolation stops the runtime proof. Deterministic candidate tests
run in a credential-free, network-disabled sandbox, never in the trusted WSL
control process.

Materialize the tracked fixture from the read-only bundle into a private Git
repository in the persistent proof tree. Create one initial commit with fixed
commit metadata, record its commit and tree hashes, and never write through its
baseline checkout. Every healthy or fault run uses a distinct disposable fixture copy from that
commit. Reuse existing test worktrees when present. Do not create another
development checkout or Git worktree. A later run may restore or rematerialize the
baseline only when the resulting commit, tree, and common file hashes equal the
20a receipt.

Use these explicit private paths in Habitat:

| Run | Project path | Receipt root |
| --- | --- | --- |
| Healthy Claude proof | `/tmp/vivary-hoh-proof/20a/claude/healthy/project` | `/tmp/vivary-hoh-proof/20a/claude/healthy/receipts` |
| Resume fault | `/tmp/vivary-hoh-proof/20a/claude/resume-fault/project` | `/tmp/vivary-hoh-proof/20a/claude/resume-fault/receipts` |
| Regression fault | `/tmp/vivary-hoh-proof/20a/claude/regression-fault/project` | `/tmp/vivary-hoh-proof/20a/claude/regression-fault/receipts` |

Do not run a fault against the healthy project or receipt root. Never use
`git reset` or `git clean` on the Vivary checkout or another user project.
Keep the baseline and evidence after the task container stops. Before export,
resolve the absolute preserved Littleagent checkout as `LITTLEAGENT_ROOT` and
record that value privately. Choose `evidence.tar.gz` and `manifest.json` as
the output filenames. Run each host-side check separately and require a match
for each exact path before writing either file:

```console
git -C "$LITTLEAGENT_ROOT" check-ignore -v -- .tmp/hoh-proof/20a/evidence.tar.gz
git -C "$LITTLEAGENT_ROOT" check-ignore -v -- .tmp/hoh-proof/20a/manifest.json
```

Verify each resolved output stays inside that checkout's `.tmp/hoh-proof/20a/`.
Apply the same separate ignore and containment checks to every temporary output
path before creating it. A match on another filename is insufficient. Refuse
existing output files; preserve prior evidence rather than overwriting it.
Export a hash-bound evidence archive
and manifest to `${LITTLEAGENT_ROOT}/.tmp/hoh-proof/20a/`. Never resolve that
relative suffix against the Vivary checkout. Include mount evidence, the baseline bundle, receipt
indexes and details, candidate bindings, raw usage records, and command output.
Exclude authentication data and provider transcripts. Record the archive and
manifest hashes in the tracked 20a receipt.

## Owned files

- Consume the fixture, prompts, protocol, sequencer, adapter, and tests accepted
  by [20c](20c-headless-loop-preparation.md). Make only bounded fixes needed by
  live enforcement, with regression tests. Any changed fixture or prompt hash
  establishes a new baseline before all three healthy iterations and both faults.
- Create `docs/product/multi-project/receipts/20a-headless-loop-proof.md`.
- Update this packet's status and log, then regenerate the graph.
- Update `CHANGELOG.md` at closure and run the approved canonical site sync.
  Commit its generated changelog and `llms-full.txt` mirrors with the receipt.
- At 20a closure, materialize
  `docs/product/multi-project/packets/20b-codex-loop-parity-proof.md` from the
  tracked continuation contract below. Set `Depends-on: [20a]` and its status
  from verified Codex prerequisites in the same change that marks 20a done.

The private baseline, candidate worktrees, detailed receipts, and CLI output
are runtime outputs. Do not commit them as product source.

The owner's [multi-agent phase decision](../design.md#multi-agent-phase-decision-2026-09-06)
also requires different runtimes within one workflow. This single-runtime proof
and 20b's parity run establish baseline behavior only. Before closing the parity
work, prepare its bounded mixed-stage continuation with explicit session and
handoff evidence; do not call separate Claude and Codex runs mixed-stage acceptance.

## Required 20b continuation

Before 20a closes, create packet 20b with `Parent: 20`, `Depends-on: [20a]`,
owner `GPT-6 parity implementation lead`, and a bounded checkpoint timebox. Set
`Status: ready-for-agent` only when its native authentication and required
pre-call budget bound are verified. Otherwise set `Status: needs-info` and
name the missing capability and runtime integration maintainer in `Needs`.
In the same graph-valid update, mark 20a done, bind its receipt, and render the
graph. Make 20b the frontier only if it is ready. An unfinished 20a is a start
gate, not a reason to mark 20b `needs-info`.

Packet 20b owns only `tools/hoh/codex.py`,
`tools/tests/test_hoh_codex.py`, its packet and receipt, the graph update,
`CHANGELOG.md`, and its generated site changelog and `llms-full.txt` mirrors.
It may make bounded adapter-registration changes in `tools/hoh/protocol.py` or
`tools/hoh_loop.py` when required. It must not change the common schema,
transition semantics, role prompts, fixture oracle, or Claude adapter to make
parity pass. It uses the shared tests-only `tools/tests/hoh_fault_probe.py`.

The packet runs Codex `0.143.0` through the live-preflighted Habitat adapter. It
uses the same expected-red harness contract, role-specific views, tool
permissions, immutable baseline commit, tree, specification, oracle, and prompt
hashes as 20a. It never starts from Claude's modified project. Restore the 20a
baseline and evidence from the verified persistent bind or the ignored
Littleagent archive, then compare every hash before the first Codex model call.
Keep native Codex authentication outside every model tool's filesystem and
environment. Prove the same credential-canary refusals with the installed
adapter. Do not assume that read-only mounts deny reads or that a Claude flag
exists in Codex. Do not expose the Docker socket to a role container.

Give 20b a separate 100,000-token ceiling covering healthy, fault, retry, and
preflight calls. Apply the 20a usage field definitions and cache mapping rule.
Preserve `vendor_usage_raw` and normalize input, output, cache read, and cache
write fields without double counting. Require and reserve a verified maximum
whole-invocation charge before each call. Keep the original hard-reservation
refusal and incomplete-accounting rules for 20b. The approved 20a observed-usage
experiment does not replace 20b's policy by implication. Missing enforcement blocks only live Codex execution.
Record `codex_top_level_turns` while
`claude_agentic_turns` is `null`. Record prompt bytes and SHA-256. All model
calls atomically advance `/tmp/vivary-hoh-proof/20b/usage.json`. Repeating the
budget argument in a new process verifies the ceiling without resetting spend.

Run three healthy Codex iterations and both fault cases in the corresponding
`/tmp/vivary-hoh-proof/20b/codex/` project and receipt roots. Require the
completed candidate's product tests to pass. Use these exact verification and
runtime commands:

```console
findmnt -T /tmp/vivary-hoh-proof -o TARGET,SOURCE,FSTYPE,OPTIONS
findmnt -T /opt/vivary-hoh-source -o TARGET,SOURCE,FSTYPE,OPTIONS
python tools/tests/test_hoh_loop.py
python tools/tests/test_hoh_codex.py
python tools/hoh_loop.py --project /tmp/vivary-hoh-proof/20b/codex/healthy/project --iterations 3 --workflow /tmp/vivary-hoh-proof/20b/codex/healthy/workflow.json --run-id codex-healthy --receipt-dir /tmp/vivary-hoh-proof/20b/codex/healthy/receipts --iteration-timeout-seconds 3600 --reported-token-budget 100000 --usage-ledger /tmp/vivary-hoh-proof/20b/usage.json
python -m unittest discover -s /tmp/vivary-hoh-proof/20b/codex/healthy/project/tests -p 'test_*.py'
python tools/tests/hoh_fault_probe.py resume --workflow /tmp/vivary-hoh-proof/20b/codex/resume-fault/workflow.json --run-id codex-resume-fault --project /tmp/vivary-hoh-proof/20b/codex/resume-fault/project --receipt-dir /tmp/vivary-hoh-proof/20b/codex/resume-fault/receipts --iteration-timeout-seconds 3600 --reported-token-budget 100000 --usage-ledger /tmp/vivary-hoh-proof/20b/usage.json
python tools/tests/hoh_fault_probe.py regression --workflow /tmp/vivary-hoh-proof/20b/codex/regression-fault/workflow.json --run-id codex-regression-fault --project /tmp/vivary-hoh-proof/20b/codex/regression-fault/project --receipt-dir /tmp/vivary-hoh-proof/20b/codex/regression-fault/receipts --iteration-timeout-seconds 3600 --reported-token-budget 100000 --usage-ledger /tmp/vivary-hoh-proof/20b/usage.json
```

The resume probe must continue from the same committed developer checkpoint or
classify the run as a restart and leave the first run incomplete. The regression
probe injects one implementation fault before the QA freeze and never changes
the oracle or prompts. Both probes preserve healthy evidence.

The 20b receipt compares required keys, types, nullability, stage bindings,
evidence categories, prompt hashes, usage accounting, and unavailable-value
semantics across both runtimes. Runtime, model, flags, values, plans, candidate
hashes, observations, and outcomes may differ. Claude agentic turns and Codex
top-level turns remain separate. Make no runtime quality claim. Missing Codex
authentication changes only 20b to `needs-info`, with the exact restoration
owner. A missing, failed, or partial Codex run leaves parity incomplete. Never
substitute an API key or fabricate evidence.

Before 20b exports, check each exact output separately and require a match:

```console
git -C "$LITTLEAGENT_ROOT" check-ignore -v -- .tmp/hoh-proof/20b/evidence.tar.gz
git -C "$LITTLEAGENT_ROOT" check-ignore -v -- .tmp/hoh-proof/20b/manifest.json
```

Verify each resolved output stays inside that checkout's `.tmp/hoh-proof/20b/`.
Check every temporary output path the same way before creating it. Refuse
existing output files. Then export
there. The tracked receipt binds both restored 20a evidence and new
20b evidence. Update the canonical changelog with the actual proof status and
generate its site mirrors before closing either runtime packet.

The 20b owner retains the persistent proof tree until independent parity review
and a restore-and-hash check of both exported archives pass. Then that owner
prepares an itemized cleanup receipt: exact task paths and container names,
stopped-process evidence, reachable baseline commits, archive/manifest hashes,
and the restoration result. The owner authorized cleanup of task-owned temporary
resources. Verify the evidence export before removing exact contained temporary
paths. No authentication volume, image, proxy, production mount, legacy data,
or other agent's data is a cleanup target. Any retained resource names its owner
and removal condition in the existing receipt. The archives remain the evidence
input for outcome 04; their later removal needs that owner's acceptance and a
separate approved operation.

At 20a closure, move this continuation contract into the canonical 20b packet
and replace this section with a link to 20b in the same graph-valid update.
Canonical 20b then becomes the only owner of its detailed contract.

## Done condition

1. The Claude Code adapter completes three iterations from the immutable
   baseline in one healthy disposable project. The runtime, model, role
   definitions, runtime policy, specification, oracle, and prompts stay fixed.
2. The green sequencer harness proves the tracked starter has the exact declared
   expected-red product-test result. Only the completed disposable candidate has
   a green product-test result.
3. Before each role and after each iteration, the receipt records the baseline
   commit and tree hashes plus the specification, oracle, and three role-prompt
   hashes. A mismatch halts the run.
4. Each iteration binds the starting candidate hash, development-document hash,
   developer result hash, frozen QA candidate hash before and after assessment,
   deterministic test output, and QA evidence-report hash. The two frozen
   candidate hashes must match.
5. Evidence entries distinguish verified, unmet, and failed behavior and cite
   an observation. Iteration two preserves every verified iteration-one
   behavior, selects at least one unmet item, and shows a failed observation
   changing the plan.
6. Each role reads the `index.md` under its exact receipt root. The receipt
   records every detail file opened plus the prompt bytes and SHA-256 hash for
   each role and iteration.
7. Mount and permission evidence proves that the planner cannot access the
   candidate tree, the developer can write only the candidate, and QA can read
   only the frozen candidate and public evidence.
8. The resume fault stops the sequencer once after the committed developer checkpoint and
   before QA. Starting the sequencer again with the same fault project and
   receipt root resumes the same run without rerunning the developer or
   accepting an unassessed candidate. Classify this as `resume`. If bindings do
   not prove safe continuation, classify it as `restart`, create a new
   disposable run, and keep the interrupted run incomplete.
9. The regression fault uses its own disposable project. A controlled harness
   fault changes only candidate implementation before the QA freeze so a
   previously passing behavior fails. The sequencer halts, names the regression,
   and preserves the healthy proof. It does not change the oracle or prompts.
10. Every live call binds raw and normalized usage, native turns, a declared
    launch claim, policy revision, configuration hash, trial, and session.
    The initial proof must complete at or below the configured 100,000 reported
    target. Overrun or missing required usage leaves acceptance open. Prove
    persisted launch/deadline controls, provisional/final reconciliation,
    unknown-accounting refusal, and recovery. Separate deterministic checks
    from observed native enforcement and unmeasured helper/retry coverage.
11. The receipt records wall time and the subscription used. No API-key spend,
    unit result, or fake-adapter result can replace live evidence.
12. The mount record and exported evidence archive preserve the baseline,
    healthy proof, and both fault results after the task container stops.
13. Record line count and function size per iteration. State the proof's limits:
   one project, one fixture, three iterations, no equal-token long-session
   comparison, no Codex parity, and no broader quality-decay measurement.
14. Before closing 20a, create packet 20b with the prescribed Codex adapter,
    three iterations, both isolated fault runs, and common-schema comparison.
    Mark 20a done and set 20b's status from its verified prerequisites in one
    graph-valid update. An unsupported Codex budget bound keeps 20b `needs-info`.

## Verify

First implement the versioned configuration and all eleven usage rules. Run
the deterministic sequencer, adapter, and fixture tests before any model call:

```console
python tools/tests/test_hoh_loop.py
```

Before a model call, verify the persistent proof bind and read-only source
bundle. Then reuse the baseline and prepare the three Claude fixture copies
at the paths above without creating a development checkout or Git worktree:

```console
findmnt -T /tmp/vivary-hoh-proof -o TARGET,SOURCE,FSTYPE,OPTIONS
findmnt -T /opt/vivary-hoh-source -o TARGET,SOURCE,FSTYPE,OPTIONS
```

The commands below retain the initial trial values. They are execution
templates, not evidence that the observed-usage mode is implemented. Bind each
workflow to the same verified policy configuration and ledger. The retained
`--reported-token-budget 100000` argument checks the configured stopping target
in observed mode. It cannot prove a hard actual-token ceiling or reset usage.
Document the implemented policy-selection syntax in the receipt before use.
Run the healthy proof and the completed candidate's product tests only after
offline controls, included-only authentication, and role isolation pass:

```console
python tools/hoh_loop.py --project /tmp/vivary-hoh-proof/20a/claude/healthy/project --iterations 3 --workflow /tmp/vivary-hoh-proof/20a/claude/healthy/workflow.json --run-id claude-healthy --receipt-dir /tmp/vivary-hoh-proof/20a/claude/healthy/receipts --iteration-timeout-seconds 3600 --reported-token-budget 100000 --usage-ledger /tmp/vivary-hoh-proof/20a/usage.json
python -m unittest discover -s /tmp/vivary-hoh-proof/20a/claude/healthy/project/tests -p 'test_*.py'
```

The tests-only fault probe calls the sequencer's tested public Python API. It
stops after a committed developer checkpoint for resume and injects one known
candidate fault before the QA freeze for regression. Run:

```console
python tools/tests/hoh_fault_probe.py resume --workflow /tmp/vivary-hoh-proof/20a/claude/resume-fault/workflow.json --run-id claude-resume-fault --project /tmp/vivary-hoh-proof/20a/claude/resume-fault/project --receipt-dir /tmp/vivary-hoh-proof/20a/claude/resume-fault/receipts --iteration-timeout-seconds 3600 --reported-token-budget 100000 --usage-ledger /tmp/vivary-hoh-proof/20a/usage.json
python tools/tests/hoh_fault_probe.py regression --workflow /tmp/vivary-hoh-proof/20a/claude/regression-fault/workflow.json --run-id claude-regression-fault --project /tmp/vivary-hoh-proof/20a/claude/regression-fault/project --receipt-dir /tmp/vivary-hoh-proof/20a/claude/regression-fault/receipts --iteration-timeout-seconds 3600 --reported-token-budget 100000 --usage-ledger /tmp/vivary-hoh-proof/20a/usage.json
```

Record each invocation, checkpoint, injected hash, usage sample, and result in
the receipt. Do not add a production fault flag to `tools/hoh_loop.py`.

A second reader traces each tracked receipt claim to a private hash or captured
command output. Then run the common planning checks from
[the execution contract](../execution-contract.md#maintaining-the-graph).

## BOOTTIME experimental revision

The next prepared trial selects `20a-observed-usage-v3` under the owner's
evidence-based policy-revision authority above. It retains v2's 300,000 reported
token target and the initial launch, duration, turn, retry, and proof counts.
Its explicit `clock_policy` is `linux-boottime-capped-wall-v1`.

This Linux-only policy uses `CLOCK_BOOTTIME` for elapsed time. Persist the
original absolute BOOTTIME expiry and a nonincreasing effective expiry. Wall
time may shorten that expiry; a later wall correction cannot restore time.
Keep the same boot identity across packet, invocation, iteration, worker,
authenticated host, and oracle guards. Missing BOOTTIME, a boot change, or
BOOTTIME reversal refuses execution. Earlier strict-clock policies retain their
original behavior. Do not change WSL, Docker, kernel clock, or time-service settings.

Persist bounded aggregate clock observations and wall backsteps. A correlation
delta alone does not identify NTP or another cause. Reject role-output callbacks
and worker requests after expiry, including buffered output and resumed processes.
Native compaction, model, response, and reasoning defaults remain unchanged.

The unused v2 preparation has no claims, clock, or stop. Revise it only through
`UsageLedger.revise_unstarted`, checking the exact prior state and preparation
digests. Preserve it as an abandoned preparation, separate from actual trial
history. Retain the first trial's stop and all 14,369 reported tokens in the same
ledger. The private preparation records name that existing live ledger;
new preparation directories contain a reference to it, never another ledger.

The private v3 driver requires independently reviewed, hash-bound Habitat test
and no-model transport evidence. Its final preparation receipt and unchanged
v2 inventory gate bootstrap. Policy selection and successful no-model checks do
not constitute a native trial. The receipt below owns current execution evidence.

## Stop conditions

Use no paid API key, GUI, Agent-Native server, change under `packages/`,
scheduled job, or network beyond Claude Code's provider through the Habitat
proxy. Use no more than three healthy iterations and the two named fault runs.
Apply the earliest configured invocation, iteration, or packet deadline.
The initial settings are ten minutes per invocation and one hour per packet
and iteration, followed by at most five seconds of local stop grace. Context
boundaries require checkpoints and never reset accounting or deadlines.
Stop admission on a spent target, undeclared or exhausted launch, unresolved
claim, native error, uncertain required usage, changed policy binding, or clock
uncertainty. Any subagent/background-task event, credential-canary exposure,
failed role isolation, or failed owned-process cleanup is terminal for the trial.
Preserve evidence and continue independent work. Revise experimental settings
between reconciled trials only, under the usage contract.

Stop if fixture tests cannot run, the installed CLI cannot enforce the role's
authority, the proxy cannot reach Claude Code, usage cannot be bound to the
role, two consecutive iterations make no candidate or evidence progress, or any
frozen candidate, oracle, or prompt hash changes. Preserve all healthy evidence
when a fault run stops.

If existing Claude Code subscription authentication is missing, change only
20a to `needs-info`. Add a `Needs` field naming restoration of that Habitat
authentication and its human or environment owner. Never substitute an API key,
copy credentials, fabricate a run, or mark 20a complete. Stop only the
packet-owned task container after the session. Do not remove the persistent
proof tree, 20a evidence archive, or manifest before 20b restores and verifies
them.

## Log

- 2026-09-06: Packet created from the scoped effect of [the direction decision](../design.md#direction-decision-2026-09-06). Implementation has not started.
- 2026-09-06: Corrected the execution boundary to one Claude Code proof in one context window. Codex parity moves to packet 20b, which is materialized only when 20a closes so the packet dependency and generated frontier remain valid.
- 2026-09-06: Review tightened the expected-red starter oracle, planner isolation, tests-only fault probe, usage ceiling, and durable evidence handoff. No runtime implementation started.
- 2026-09-06: PR #335 review required pre-admission token reservations and credential isolation. The installed Claude CLI has no documented whole-invocation token bound, so live calls remain stopped and this packet needs that concrete capability or an approved policy alternative. Offline tools and subscription authentication passed. The execution contract permits independent available work.
- 2026-09-06: Packet 20c owns claimable deterministic preparation while only this live proof remains blocked. Export checks now bind every actual archive, manifest, and temporary output path before writing it.
- 2026-09-06: Packet 20c froze its implementation and closed its independent
  source findings, but its strict Habitat acceptance remains `needs-info` after
  repeated wall-clock reversals. Packet 20a keeps its own distinct
  pre-admission token-bound prerequisite and does not start while 20c is open.

- 2026-09-07: Jeff approved `20a-observed-usage-v1` as a configurable, versioned
  experiment and continuous GPT-6-led work through outcome 28 dependencies.
  This packet is in progress for implementation. The usage contract replaces
  the unsupported hard-token prerequisite. Native proof remains unaccepted.

- 2026-09-07: The [implementation receipt](../receipts/20a-headless-loop-proof.md) records observed-usage controls, 119 Habitat checks, six corrected stream lifecycle checks, and the separate constrained role-tool proof. Native-model acceptance remains open.

- 2026-09-07: Selected the explicit BOOTTIME clock policy for the next inert preparation after measured wall reversals, reviewed source, final focused checks, and actual no-model process/worker pause proofs. Existing hard-clock policies and prior accounting remain unchanged.

## Native launch resource continuation, 2026-09-10

The owner explicitly authorized resuming bounded Habitat runs and clarified that
the intended result is Vivary's planner, developer and independent QA workflow.
The existing loop-first decision selects this packet. The design records the
answer and authority; registry and GUI work remain independent where possible.

The unchanged historical V4 launcher omits the required explicit memory-budget argument.
Its existing reference and proxy containers have unbounded memory settings, and
controller-death cleanup is incomplete. Preserve the 6 GiB gate while repairing
these concrete prerequisites. Do not substitute a small arbitrary budget.

The isolated native-host candidate requires MemorySwap to equal its 1 GiB
memory cap. Canonical source was restored to the original bytes because 06e
still owns that freeze. The candidate and its Windows/Linux controllers have
passed source review, with seven inert Windows checks. Their Habitat container
exercise remains unrun. The V4 freeze is unchanged and accepts none of these
new bytes. Later application requires a reviewed preparation revision.

The isolated host/worker resource drivers have since passed source review and
seven inert Windows checks. The next step is their bounded no-model runtime
exercise after fresh 6 GiB warm admission. Reference/proxy sizing and lifecycle
remain deferred, with both existing helpers stopped and unchanged. The following
allowances describe the earlier proposal, not completed runtime verification. Proposed enforced caps
are 1,024 MiB each for the host and worker, 512 MiB for the reference, 256 MiB for
the proxy, 256 MiB for the Linux controller and 128 MiB for its outside cleanup
owner. With 512 MiB Windows containment and a declared 512 MiB platform allowance,
the job totals 4,224 MiB. These values are experimental bounds, not measured
requirements. Preserve the additional 1,536 MiB reserve and 6 GiB physical gate.

Before execution, independently review the complete supervisor, source freeze,
all concurrent cgroups, zero-swap settings, output bounds and cleanup custody.
Exercise startup, controller death and worker OOM without model calls. Preserve
the exact existing reference/proxy IDs and configuration, then restore them to
their captured stopped state. Require physical and commit headroom, a 250 ms
observer with at most a one-second gap, a 1,792 MiB pressure-stop threshold and
settlement within five seconds. Confirm unchanged ledger bytes.

The no-model experiment permits at most two admission requests or 1,200 elapsed
seconds from the first request, whichever expires first. Count refused and failed
requests across scripts and sessions. Each request has a 240-second work deadline
plus five seconds for settlement. Record its attempt before any WSL call; an
unresolved attempt prevents another launch. Zero requests have run at this source
checkpoint. This experiment does not claim or reset native-model accounting.

After resource acceptance, revise the frozen launch inputs through the existing
preparation contract. Preserve all native model, context, compaction, invocation,
deadline and included-access requirements, along with the immutable unknown-usage
history. Native bootstrap and the first complete three-role cycle remain unrun.

## Source isolation and first container exercise, 2026-09-10

Fresh Native10 source admission exposed a shared dependency: the 06e owner
closure still binds the original canonical native-host bytes. Preserve that
accepted closure. The reviewed zero-swap source and its tests are now isolated
under the preserved checkout's
`.tmp/vivary-continuation/20a-native-resource/candidate/`. Their reviewed hashes
are unchanged; exact canonical preimages were restored. The resource exercise
must stage that candidate over a small isolated source snapshot. It must not
update the existing Habitat source or frozen V4 inputs.

The first no-model exercise is narrowed to the new invocation host and worker.
Keep the existing reference and proxy stopped and unchanged. Their allowances
remain reserved in the conservative 4,224 MiB budget, but this exercise cannot
accept their sizing or lifecycle. Docker ignores a zero memory-swap setting;
the proposed helper update does not establish an exact configuration rollback.
See [Docker's resource documentation](https://docs.docker.com/engine/containers/resource_constraints/#--memory-swap-details).

Prove the owned pair's caps, controller-death and worker-OOM cleanup first.
Runtime acceptance of the complete live profile, helper lifecycle, Windows
observer integration and native-model bootstrap remains open. All existing attempt,
deadline, reserve and 6 GiB admission limits remain unchanged.

## Reviewed V4 helper owner, 2026-09-10

The preserved `.tmp/vivary-continuation/20a-v4-helper-lifecycle-candidate/`
core and no-model lifecycle driver passed independent source review. All 25
core and 15 driver inert checks passed. Exact custody includes the native audit,
full helper configuration and every attempt/profile/custody journal identity.
Only a durable owned start grants stop authority. Failed cleanup invokes
serialized fallback; a missing journal grants no stop authority.

Normal success waits for the owner unit to become inactive. Primary cleanup
has at most three seconds; fallback receives only the remainder of the same
five-second absolute expiry. Command timeouts normalize to a bounded timeout
result. Expiry records unsettled and blocks success. Five seconds cannot
guarantee that primary cleanup and fallback both finish.

Jeff answered **Authorize the exact helper change** on 2026-09-10: reference
512 MiB and proxy 256 MiB, memory-swap equal to each memory cap, bounded use and
both left stopped with caps retained. Source acceptance is separate from that
authority. Profile and custody runtime-promotion flags remain blocked.

The original no-model host/worker exercise has zero of two requests used and a
1,200-second cumulative budget. It must pass first, while helpers still match
its stopped uncapped preimage. The helper lifecycle phase then has at most two
requests and 1,200 cumulative seconds, with 240 seconds of work and five seconds
of cleanup per live case. Both phases require fresh 6 GiB warm physical memory,
5,760 MiB commit headroom, 10 GiB disk and the existing 1,536 MiB host reserve.
The helper review binds this packet and requires a separately reviewed pair
acceptance before dispatch. No phase has executed.

The lifecycle cases cover partial cap failure, primary abort, exact outer
Windows controller loss, heartbeat cleanup, serialized fallback and durable
journal export. Cap faults cannot be replayed after persistent convergence;
request two may reuse only exact accepted first-request fault coverage. The
no-unowned-stop case remains inert-only because deliberately losing ownership
of a shared running helper is unsafe. A passing lifecycle result retains this
declared limitation and cannot accept the complete planner/developer/QA cycle.
