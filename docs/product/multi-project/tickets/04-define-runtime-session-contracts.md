---
type: outcome
---
# 04: Define runtime, session, action, and tool contracts
Status: in-progress
Blocked-by: [02, 03]
Unlocks: [09, 10, 16, 17, 20, 21, 22, 29, 30]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Current progress

Updated 2026-09-10. Packets 04a through 04d are accepted for bounded readiness,
activity, preparation and synthetic first-start behavior. The complete runtime
contract still needs production fencing, real adapters, scoped chat/history,
role/tool permissions, runtime parity, cancellation/resume and remaining
compaction cases. Outcome 02 is also unfinished.
See the [04d limits](../receipts/04d-project-native-start.md).

## Goal

Define one app-owned contract for runtime capability, project binding, session lifecycle, actions, events, cancellation, tools, and receipts while native runtimes keep their own state.

## Context

Read [the native owner inventory](../native-owners.md) before adding any run, session, task, plan, messaging, scheduler, or resource infrastructure.

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own the proposed app service contracts and fixtures. Read `design.md`, `migration.md`, Littleagent S-00A, S-00, S-04 through S-07, and its version-matched Agent-Native research. Reuse framework types where their installed version proves the behavior.

## Done condition

Fixtures distinguish installed, configured, authenticated, bound, runnable, and verified. Every session binds actor, project, root or checkout, runtime, execution location, and policy revision. Tool grants and errors are explicit.

Bind each iteration to its model, harness, runtime, policy, and role-contract versions. Enforce planner/developer/QA read, write, and tool permissions through supported runtime capabilities; mark unavailable enforcement explicitly. Validate each role output against a versioned schema with a bounded retry budget and a recorded failure after exhaustion. A prompt instruction alone does not establish the boundary. Runtime choice remains configurable between recorded iterations.

Under [decision four](../design.md#direction-decision-2026-09-06), adapters share
one versioned role-permission contract, prompt handoff, receipt schema, and usage
field definitions. Verify that contract on Claude Code and Codex using the
owner's subscriptions without requiring a model API key. Required enforcement,
receipt shape, policy, and fixture baseline must match; runtime/model versions,
native flags, measured usage, and generated candidates can differ. Missing
authentication or required enforcement leaves that runtime's proof incomplete.
A single-runtime receipt cannot pass this cross-runtime acceptance.

Under the [context and response decision](../design.md#context-and-response-decision-2026-09-07),
distinguish active-context tokens, per-response limits, and cumulative run usage.
Resolve compaction through each native runtime's verified model capacity and
headroom. Start from native defaults and evaluate a 250k threshold as a candidate,
not a universal limit. Preserve selected response and reasoning settings. Native compaction retains session ownership; existing task records
retain accepted decisions, artifact references, and outstanding work. The
[research and verification proposal](../research/context-compaction.md) defines
the cases to prove before claiming this behavior. These criteria remain unimplemented.

## Verify

Refuse planner or QA artifact writes, wrong-role tools, malformed outputs, exhausted retries, and stale configuration bindings. Verify these permissions in the actual adapter, not just a synthetic object.

Run schema and lifecycle tests for create, stream, cancel, resume, stale binding, unsupported capability, and denied tool use. Prove the app does not invent a second transcript or runtime state owner.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-05: Refined acceptance after the owner-requested [HoH comparison](../research/hoh-alignment.md). These criteria remain unimplemented and unverified.

- 2026-09-06: [Decision four](../design.md#direction-decision-2026-09-06) adds the shared adapter acceptance above. Packet [20a](../packets/20a-headless-loop-proof.md) supplies the first runtime evidence; its required continuation supplies parity evidence. Unimplemented and unverified.

## Next packet

[04a](../packets/04a-project-runtime-readiness.md) has accepted read-only Native
action and controlled component evidence in its [receipt](../receipts/04a-project-runtime-readiness.md).
[04b](../packets/04b-project-native-activity.md) has accepted exact-reference Native
run activity evidence in its [receipt](../receipts/04b-project-native-activity.md). Complete conversation history, lifecycle, role/tool enforcement
and cross-runtime acceptance remain open.

- 2026-09-08: Accepted 04b bounded Native activity and controlled rendering after 8/8 Native and 6/6 component cases, full-row witnesses, independent review and cleanup. The next thread-preparation contract is under review; lifecycle and production provenance remain open.

[04c](../packets/04c-project-native-preparation.md) now owns durable start intent
and exact private Native thread preparation. Its required successor 04d must
prove separately admitted harness start and uncertainty recovery.

- 2026-09-08: Accepted private 04c thread preparation after 13 named Native database cases, full-row evidence, independent review and cleanup; see its [receipt](../receipts/04c-project-native-preparation.md). Native harness start remains a separate 04d successor under contract review; parent outcome stays incomplete.

- 2026-09-08: [04d](../packets/04d-project-native-start.md) is ready after accepted 04c preparation. It owns a private receiving seam and one actual public Native synthetic first start; production host fencing and real adapter execution remain open.

- 2026-09-09: Accepted [04d's receipt](../receipts/04d-project-native-start.md)
  after 25 preparation/start cases, complete database witnesses, independent
  review and cleanup. Canonical and Habitat contain the same four accepted
  source files. Production host fencing, real runtime adapters, project chat,
  external-runtime quiescence and cross-runtime acceptance remain open.
