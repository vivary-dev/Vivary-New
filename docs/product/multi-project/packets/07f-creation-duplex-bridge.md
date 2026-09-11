---
type: packet
---
# 07f: Keep creation effects inside correlated Native admission

Parent: 07
Status: done
Depends-on: [07d, 07e]
Owner: Sol creation_apply_writer owns the private bridge and focused fixtures; GPT-6 lead owns dispatch, acceptance and evidence.
Scope: A private Native/Python creation bridge with injected trusted composition and lifecycle. Production activation remains unavailable.
Verification-kind: runtime
Verification-result: passed
Evidence: [07f runtime receipt](../receipts/07f-creation-duplex-bridge.md)
Timebox: One duplex bridge, bounded adversarial proof with explicit process accounting, independent review and exact cleanup.

## Goal

Run the accepted Python creation engine against the existing Native receipt port
without separating permission admission from the effect it admits.

## Context

Read 07d and 07e, their receipts, creation_apply.py, creation_authority.py,
creation-receipts.mjs and the existing root-provider pair. The root provider owns
root observation, accepts one pending request and does not prove writer-descendant
quiescence. Leave that pair unchanged. Native registry registration grants do not
authorize create-child. Use a separately injected current creation-facts resolver
and the same trusted host coordinator as the receipt port.

## Owned files

New files: packages/workbench/server/creation-provider.mjs,
packages/core/vivary_core/creation_provider_stdio.py,
packages/workbench/tests/creation-provider.test.mjs, and one reviewed Python
fixture composition under packages/core/tests/fixtures/. Core imports Core only;
the fixture composition may inject the existing scaffolder and Tropo.

The lead owns this packet, receipt and source map. Do not edit 07d/07e owners,
root-provider files, database schema, HTTP/actions or GUI. Propose a demonstrated
seam correction to its owner before changing it. Another writer must not edit
these files concurrently.

## Composition and lifetime

Python exposes a serving function accepting trusted composition. Its normal
entrypoint defaults to unavailable. Do not add caller-selected module imports,
fixture modes, executables, paths or authority flags to the protocol. Host startup
configuration supplies coordinates; apply requests contain only validated claims.

Native receives an injected owned-worker lifecycle with bounded framed I/O and
stopAndConfirmQuiescent. The default refuses. A production adapter must prove all
possible writer descendants stopped or fenced; sending a kill or observing the
direct child's exit is insufficient. Reuse an existing proved lifecycle if its
scope matches; do not invent a general process-tree supervisor in this packet.

Use strict bounded UTF-8 JSONL, exact schemas, a protocol version, connection-local
monotone identifiers and exact parent correlation. Allow one apply, one receipt
RPC and one nested authority read. Reject a second apply and nested mutations.
Do not add a queue, journal, database, portable admission token or file-byte frame.

Flow: Python requests current authority and receipt operations. Native admits an
effect through 07e and sends a correlated invoke inside its actual callback.
Python invokes the retained synchronous execute function while admit_and_execute
is still on the stack. Its current-binding inspection may request fresh Native
facts through the nested read lane while Native awaits the effect. That read must
not reacquire the held mutation scope. After the effect settles, Python reports
its exact correlated completion; Native settles admission and returns its result.
Python returns the saved local execute return object to 07d, preserving the
engine's identity-based completion sentinel. A wire boolean is not that object.
Phase transition is a later separate receipt RPC.

After failure during admission, keep the Native effect pending until the lifecycle
owner confirms quiescence. Then return recovery with the durable phase unchanged.
Unknown quiescence quarantines custody and makes the provider unusable. Never
automatically fail a receipt, retry, restart, reconnect, register or delete a target.
Reject old-connection, unsolicited, duplicate and cross-effect replies.

Use explicit configurable transport limits with conservative verified fixture
defaults: 16 KiB frames, 5 s ordinary RPC, 20 s effect, 60 s apply and 5 s stop
confirmation. A deadline triggers stopping; it never grants custody release.
Validate bounds at startup and freeze exact values in evidence. These are bridge
limits, not model response, compaction or permanent product limits.
After the correlated effect invoke, replace or suspend the outer admit RPC's
ordinary timer under the effect deadline. Nested authority reads retain their
own ordinary timeout, and the absolute apply deadline continues to run.

## Done condition

Use actual configured Native database adapters and one reviewed Python child in
existing Habitat. The child fixture has no callback-spawned descendants; verify
its PID absence after real stop/exit. Label this a bounded child-protocol proof.
Native-parent-death fencing and arbitrary writer descendants remain production
host obligations and are not satisfied by this fixture.

Prove a real 07d callback performs nested current-facts reads without deadlock and
preserves the local sentinel. Prove pre-admission revocation yields zero effects,
and competing phase changes and completed revocation stay blocked until effect
settlement. Use controlled filesystem fixtures; never user project roots.

Reject malformed, oversized and partial frames; duplicate, stale, cross-effect
and cross-connection messages; effect completion before invocation; nested writes
and a second apply. Exercise hang, EOF or kill before effect, during effect,
after filesystem effects before completion and after completion before final
reply. Preserve preparing/publishing uncertainty; callback failure never claims
filesystem rollback. A lifecycle refusal must not release custody or report a
successful apply. Verify the unconfigured provider performs zero effects.

For the quarantine test, let stop-confirmation expire and prove that the Native
effect and scope remain pending. Then the trusted fixture lifecycle owner must
independently establish actual child quiescence and deliver that evidence through
its local lifecycle seam, draining the pending callback into recovery without
retrying apply. This is teardown after proof, not a timeout-based custody release.
Never leave an unbounded test pending or accept a wire claim of quiescence.

Every process, fixture and timeout is bounded in the reviewed runner. Export exact
source, dependency hashes, full logs and quiescence/cleanup evidence. Independently
inspect the final archive before removing contained test resources.

## Verify

After exact Habitat toolchain and current resource preflight, run the focused
suite with existing dependencies and no model calls. The lead freezes test count,
source hashes, memory/output limits and cleanup before dispatch.

```console
node --test --test-concurrency=1 packages/workbench/tests/creation-provider.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Stop conditions

No production namespace activation, user-project writes, paths or authority flags
from request JSON, credential copying, account/spending changes, model calls,
publication, push, merge or legacy deletion. Keep created-unregistered behavior.
A missing production lifecycle adapter does not block this controlled proof, and
the controlled proof does not authorize a production adapter.

## Log

- 2026-09-07: Drafted from independent Astra architecture review. The lead chose
  injected trusted lifecycle and a child-only fixture proof; production parent-death
  and descendant fencing remain explicit obligations. Dispatch waits for 07e
  runtime acceptance and final source review of this packet.
- 2026-09-07: Astra review clarified nested admission deadlines and independently
  confirmed quarantine teardown. Both corrections are included before dispatch.

- 2026-09-07: Claimed by the named Sol writer for source implementation.
  Parent owns the single runtime lane. Freeze exact owned files and obtain
  independent review before any Habitat dispatch.

- 2026-09-07: The source author froze the four owned files for independent Astra
  review. Twenty-seven test cases are declared but have not run. The lead has
  prepared the bounded Habitat transfer/proof drivers for review; no source
  transfer, runtime execution or production composition has occurred.

- 2026-09-07: Independent source review withheld acceptance. The correction
  must retain the actual Native admitted callback and write-scope custody
  until trusted worker quiescence on every failure path, including a valid
  completion followed by a protocol fault. Tests must observe callback
  settlement, close the authority-read lane before admission, and prove
  that a startup protocol fault cannot restore a ready state. A Sol writer
  owns the correction; fresh frozen-source review precedes execution.

- 2026-09-07: The fourth source freeze passed independent Astra review and
  was applied to the existing canonical and Habitat checkouts. Its first
  bounded run passed 31 of 34 cases in 43.877 seconds; acceptance remains
  withheld. The actual versions were Node 22.23.2, Python 3.12.3, Native
  Core 0.176.5, SQLite 3.53.2 and better-sqlite3 12.11.1. Maximum child RSS
  was 137920 KiB, not aggregate process memory. All three supervised groups
  were independently absent. The retained synthetic fixture and complete
  frozen source/evidence closure were exported to one verified 395219-byte
  failure archive (SHA-256
  `9a1fb984c30e511e7b5c51829c35c66580bd3b1458db801895bb605c39130d0c`).
  Its exact temporary stage and byte-verified duplicate logs were removed.
  Test-only corrections preserve Python initialization time, arm fault
  deadlines at the relevant phase, establish actual host contention before
  revocation, and retain the original failure if cleanup also fails. They
  passed focused review and were applied; the second run is not yet started.
  The lead deferred it when free RAM fell to 2.75 GiB.

- 2026-09-07: The corrected run passed all 34 cases. Independent source and
  archive review accepted the bounded child-protocol evidence; all owned
  groups and exact temporary stages are absent. See the runtime receipt
  for injected-fixture and production-host claim limits.
