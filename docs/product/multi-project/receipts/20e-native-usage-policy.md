# 20e native usage-policy receipt

Evidence-record: 20e
Date: 2026-09-07
Verification-kind: inspection
Result: Passed. Recommendation prepared and inspected. Jeff subsequently approved the experiment. Implementation and live acceptance require separate evidence.

## Subsequent approval

On 2026-09-07 Jeff approved `20a-observed-usage-v1` for experimentation, with
configurable, versioned settings that can change between evidence-based trials.
The [decision](../design.md#experimental-policy-and-continuous-execution-decision-2026-09-07)
records that authority. [20a's usage contract](../packets/20a-headless-loop-proof.md#usage-contract)
owns the active rules. Its implementation is in progress. This receipt preserves
the proposal as inspected. Statements below about pending approval, unchanged
source, and unimplemented controls describe that historical inspection, not
the subsequent task state. No live acceptance follows from approval.

## Historical recommendation

Approve policy `20a-observed-usage-v1` for packet 20a only. Replace its unsupported
hard token guarantee with a 100,000 reported-token stopping target, one active CLI
invocation, and explicit launch and time limits. Keep native compaction and
response defaults. Continue through the existing Claude subscription.

This policy can exceed 100,000 actual tokens. A response already in progress,
native retries, and unreported helper requests have no verified token maximum.
Process cancellation cannot recall provider work already submitted. The owner
must accept that exposure. No percentage or finite token allowance for it is
supported by the evidence.

At this inspection checkpoint, the proposed contract was not active.
20a was `needs-info`, and its packet and executable admission checks were
unchanged. The subsequent approval above supersedes that status and permits
continuous implementation and verification without a separate conversation.
It does not turn this inspection into runtime acceptance or authorize paid usage.

## Control evidence

The canonical worktree was clean on `docs/context-compaction-policy` at
`84596ca4fabeeaa4ea5551e784da69eb1f05d992` before this packet's claim.
The reused Habitat checkout had the same commit. The existing dev container
reported Python 3.11.16 and Claude Code 2.1.241. No dependency was installed.

The [20c receipt](20c-headless-loop-preparation.md) owns accepted source hashes
and its two 62-test offline passes. This session matched all five inspected
implementation/test files to those hashes and ran 15 selected existing tests.
Every test passed, with no skips, in 12.704 seconds. Native calls used doubles.
Only the test-output directory changed through the runner's temporary-directory
factory. Test assertions and product code were unchanged.

| Control | What it guarantees or reports | Evidence and limit |
| --- | --- | --- |
| Active context | Native runtime owns compaction and model headroom | [Accepted decision](../design.md#context-and-response-decision-2026-09-07). No comparison rerun. No cumulative-usage guarantee |
| Response length | Native runtime owns the model's response defaults | Accepted decision. Neither an output cap nor context capacity bounds repeated inputs |
| Agentic turns | Proposed `--max-turns 10` per single-input print invocation | [CLI reference](https://code.claude.com/docs/en/cli-reference#cli-flags) documents a turn limit. Installed argument validation recognizes it. Neither observation proves 2.1.241 stops correctly. Ten turns are not ten provider requests |
| CLI launches | Proposed maximum 29, concurrency one, across all 20a paths | Coordinator can count durable admissions. Not yet implemented. This caps process launches, not native retries or helper requests |
| Elapsed time | Existing one-hour iteration deadline survives resume and refuses clock uncertainty | `IterationDeadline` and selected tests. Proposed ten-minute invocation and one-hour packet deadlines need implementation and offline checks |
| Cumulative usage | The normalization helper sums supplied base input, cache reads, cache writes, and output once | `normalize_claude_usage` and two accounting tests. Field validation proves supplied numbers, not complete native/provider accounting |
| Cancellation | Existing process wrapper signals its process group, waits five seconds, then kills and reaps remaining processes | Existing real Linux subprocess test passed. Provider cancellation and submitted-request charges remain unverified |
| Coordinator retry | Existing schema path allows at most two attempts and reserves before each dispatch | Existing retry test passed. Proposed policy must additionally forbid retry after uncertain usage or a native error |
| Native retries | Runtime owns internal retry behavior | Retry count, usage coverage, and request amplification remain unverified. A CLI-launch counter cannot bound them |
| Auxiliary requests | Proposed isolation excludes model-driven subagents and extra model tools | Actual native isolation remains 20a acceptance. Background helper and compaction usage coverage is unknown. No all-request accounting claim |
| Dollar budget | Installed help exposes `--max-budget-usd` for print mode | No verified conversion to subscription tokens or included allowance. Excluded from admission authority |

This inspection consulted current official documentation only for turn limits
and usage scope. It is newer than the pinned CLI and cannot establish installed
behavior. The CLI reference warns that help omits some supported flags.

The negative control `--vivary20e-unknown-option --help` also returned help with
exit zero. Help therefore cannot prove flag recognition. The no-prompt command
`claude --max-turns` exited one with `option '--max-turns <turns>' argument missing`.
Installed argument validation recognizes the flag. Enforcement remains untested.
Do not upgrade to obtain later behavior.

The [usage guide](https://code.claude.com/docs/en/agent-sdk/cost-tracking) documents
distinct scopes for final `usage` and `modelUsage`, duplicate assistant message
IDs, placeholder streamed output counts, and zeroed or undercounted error
results. Those warnings inform the proposed conservative rules. They do not
prove the same fields or coverage in the installed CLI. Live 20a must record
its observed mapping. SDK documentation does not authorize replacing the CLI.

Installed `--bare` help excludes OAuth and reads API-key authentication. Do not
use it to suppress helpers on the subscription path. Keep authentication native,
disable unneeded customizations through supported configuration, and verify the
explicit tool allowlist and credential boundary before any live call.

## Exact proposed replacement for 20a's usage contract

Apply this entire section only after the owner approves `20a-observed-usage-v1`.
At that point, update 20a's conflicting Needs, Scope, acceptance, verification,
stop conditions, and command descriptions together. Do not change 20b's policy
by implication. The following is proposed replacement contract text.

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

   Ten turns and these durations are proposed starting
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
    or token overruns require a separately authorized continuation. Compaction,
    a new process, a new receipt root, and session resume never reset totals.

11. Once reported usage reaches 100,000, launch nothing further. At exactly
    100,000, completed work can be accepted only if every required proof check
    already passed. Above it, record an overrun and leave 20a acceptance open.
    Missing usage also leaves acceptance open. Preserve partial candidate and
    test evidence. A successful 20a receipt may claim completion within the
    reported target and observed controls only. It cannot claim total provider
    consumption below 100,000 or complete invisible-request coverage.

Approval replaces a hard token guarantee with this stopping policy. It accepts
unknown token overrun exposure within bounded local execution. It does not
promise that all three healthy iterations and both faults fit the initial limits.
Failed proof acceptance does not automatically buy another attempt.

## Hypotheses and scenario checks

The policy walkthroughs below are paper examples. No simulator or production
implementation of the replacement policy ran. Existing tests support only the
identified controls. The numbers illustrate decisions, not predicted consumption.

| Hypothesis or scenario | Observable result required by the proposal | Evidence and verdict |
| --- | --- | --- |
| A turn cap proves a token ceiling | Ten turns still permit repeated inputs and internal requests | Rejected by control scope. Native request multiplicity remains unknown |
| Healthy call, prior total 20,000, final input/cache/output 2,000/500/300/200 | Settle 3,000 once. Packet total 23,000. Admit the next declared stage if other checks pass | Paper arithmetic. Existing cache-once normalization test passes |
| Schema retry after a successful native invocation reports 3,000 | Charge 3,000, consume its slot, then claim a distinct second attempt | Existing retry/reservation mechanics pass. Stricter proposed native-success gate remains to implement |
| Native request retries happen within one CLI launch | Preserve the same slot and deadline. Include reported retries without claiming invisible work is covered | Paper walkthrough. No native retry experiment ran |
| Duplicate streamed messages and a final report | Count unique comparable usage once. Replace the active provisional total with the final total | Official scope warning. Installed reconciliation remains unverified |
| Prior total 98,000, active observed usage 2,500 | Stop at observed total 100,500. Keep the overrun visible. Do not launch a successor | Paper example disproves the claim that observation prevents overrun |
| Termination is delayed or ignored | After five seconds, kill/reap local owned processes. No successor. Remote processing may continue | Existing Linux process-group test passes. Provider stop behavior is unknown |
| Missing field, crash result with zeros, or final report below known observations | Preserve partial usage, unresolved claim, and packet stop. No schema retry or refund | Existing null/uncertain-reservation and replay tests pass. Proposal's terminal accounting latch remains to implement |
| Crash after dispatch claim but before invocation is confirmed | Keep the slot consumed and block replay despite possible zero actual usage | Existing crash-after-claim test passes. Conservative loss of remaining allowance is intentional |
| Resume fault occurs after settled developer checkpoint | Reconcile bindings and recover the committed artifact, without another developer call | Existing accepted-developer recovery test passes. Proposed counters and packet deadline must survive too |
| Resume with missing ledger, changed policy, or elapsed deadline | Refuse continuation without recreating a balance or extending time | Existing ledger/policy/deadline tests pass |
| Hidden helper consumes unreported tokens | Label coverage unknown even after a coherent final report. Never claim complete provider usage | Accepted exposure only if the owner approves this proposal. Unmeasured |
| Native turn limit or time limit prevents completing the tiny fixture | Preserve evidence and leave proof open | Proposed limits are policy choices. Their task fitness has not been tested |

## Implementation boundary after approval

20a must implement the policy before using it. Its accepted preparation does
not already provide an observed-usage admission mode. `ClaudeAdapter` still
refuses even fabricated positive maximum evidence. `UsageLedger` requires a
verified maximum, and `HeadlessLoop` reserves it before every attempt. Preserve
those semantics until an explicit, versioned policy change passes review.

The minimum change belongs in the existing adapter, protocol/ledger, sequencer,
and their tests. It must cover serial claims, launch/deadline persistence,
stream/final reconciliation, terminal unknown usage, subscription-only
configuration, and native process/worker cleanup. Retain native sessions and
the existing role-tool architecture. Missing authenticated isolation and actual
MCP tool enforcement remain live-proof prerequisites. Approval removes only
the unsupported token-bound prerequisite, not those verification requirements.

## Independent review and verification

The independent `usage_review` agent inspected the source and challenged the
draft contract. The writer corrected five findings: count only 29 legitimate
launches, enforce subagent exclusion, define terminal success exactly, include
the stop grace in elapsed-time claims, and distinguish the normalization helper
from an implemented native adapter. Review also corrected an interpretation of
the newer SDK documentation. Its version note applies to a pricing field, not
proof that older versions lack whole-tree usage. Installed coverage stays unknown.

The help negative control rejected a separate hypothesis that help success
proves flag support. Missing-argument validation supplied the narrower evidence.
The proposed policy has no executed implementation or live usage result.

Verification commands:

```console
python -B scripts/check_multi_project_plan.py --render
python -B scripts/check_multi_project_plan.py --check
python -B scripts/check-source-navigation.py --check
python -B scripts/check_line_endings.py
git diff --check
```

All common checks pass. Source navigation reports 16 records, 23 edges, 11
locators, and zero broken references. The private Markdown/HTML handoff replaces
its predecessor. The existing document renderer and plan freshness check pass.
Writing lint passed at 1.85 for the receipt and 1.33 for the handoff against
the 2.0 target. The first receipt/handoff lint runs and a missing legacy
handoff anchor failed. Edits corrected them before final verification. The source adapter, active 20a packet,
and native-default decision remain byte-identical to the starting commit.
The final independent recheck passed with no unresolved contract blocker.

## Cleanup and retained evidence

The logical archive `final-evidence.zip` retains the verification runner, its
15-test output and source hashes, help/argument evidence, and cleanup record.
The archive contains 6 entries and 28,219 bytes. Every entry
passed ZIP integrity and byte-for-byte read-back verification against its input.
The embedded manifest records evidence sizes and hashes. Archive SHA-256:
`51c70217c8f5a93b86b40bfcba84eb18e6ddb7dd94850a58125f8365fdd64af4`.

Habitat used only `/tmp/vivary-20e`. Initial cleanup removed some outputs, then
encountered a test-created read-only directory. Restoring owner write permission
on directories inside that exact tree allowed removal of the remaining 558 files
and 672,349 bytes. The path is absent, and no test process remains. These numbers
describe the final cleanup pass, not the complete initially created tree.

All 381 pre-existing files under `.claude/agents` and `.runtime-tools` match their
initial SHA-256 manifest. Windows disposable helpers are removed after export
verification. Existing Habitat services, checkout, and dependencies remain for
reuse. They predate 20e. No new container, checkout, worktree, model session,
install, or server was created. No following packet, push, publication, spend,
or merge occurred.
