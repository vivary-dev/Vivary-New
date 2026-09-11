---
type: packet
---
# 12g: Carry live application Git references into Native registration

Parent: 12
Status: done
Depends-on: [12f, 03d, 12e, 06d]
Owner: Complete. Sol implemented the boundary and fixtures. Lead and independent Astra accepted source, runtime evidence and cleanup.
Verification-kind: runtime
Verification-result: passed
Evidence-record: 12g
Evidence: [12g runtime receipt](../receipts/12g-native-vcs-registration.md)
Scope: Existing private observation wire and Native registration composition for bounded Linux no-VCS/Git fixtures.
Timebox: One three-module forwarding change, focused integration fixtures and supervised Linux proof.

## Goal

Preserve 12e's current-custody application repository and checkout references
through the existing Python provider, Node validator and Native facts resolver.
Use the existing action, decision engine, binding columns and transaction receipt.
Retain no-VCS behavior, current authorization and lost-custody refusal.

## Context

Read accepted 12f map/receipt, 12e and 06d packet/receipts, the transaction
contract R4-R5/R7-R10, and the three production files below. Follow package
instructions and existing focused tests. Use the installed Native dependency graph.

All four dependencies must be done/passed before the lead claims implementation.
[03d](03d-vcs-replay-consistency.md) owns complete VCS consistency for completed
register/rebind replay and new-key duplicate registration. Its accepted contract,
oracle/action behavior and Native evidence are a start gate here. Do not add
another comparison rule in a provider or bypass an unresolved 03d result.

The lead freezes current source hashes and serializes ownership of the Python
wire, Node provider and Native registry with the 06e writer. Accepted 06e/04d
completion is not a start gate. Preserve all current read-helper/auth composition
changes; review their compatibility without claiming the whole 06e outcome.

## Owned files

Production changes are limited to:

- `packages/core/vivary_core/root_provider_stdio.py`
- `packages/workbench/server/root-provider.mjs`
- `packages/workbench/server/native-registry.mjs`

Add focused integration tests:

- `packages/workbench/tests/native-vcs-registration.test.mjs`
- `packages/workbench/tests/root-provider-vcs.test.mjs`

Existing lifecycle, registry, wire-read and no-VCS integration tests are read-only
compatibility inputs. Reuse their fixture helpers only where the owning files
already expose them; do not edit another writer's tests or duplicate an entire
Native harness. The lead owns the packet, receipt, map updates and evidence driver.
Any necessary shared-helper edit needs an explicit ownership amendment first.

You are not alone in the codebase. Preserve 04d, 06e and 20f edits. Do not change
the lifecycle schema, physical observer, registry oracle/store, database schema,
migrations, app routes, runtime start, framework packages or dependency lockfiles
under this three-module scope.

## Bounded implementation requirements

1. Extend the existing private wire in lockstep at producer and consumer. The
   packet's implementation design must specify its version policy and exact
   discriminated response shapes before edits. Reuse registry `none`/`git` VCS
   vocabulary and 12e application ID formats; never forward raw physical IDs,
   captures, paths, grants or a serialized verification flag as authority.
2. Construct successful Git registration observations only from a completed live
   12e result with the full valid application tuple and `mutation_authorized=False`.
   Missing, contradictory, unresolved or unsupported VCS data refuses. Preserve
   complete configured-inventory observation and sibling uncertainty.
3. Preserve strict duplicate-key/UTF-8/byte limits, unknown-field rejection,
   operation/sequence/locator matching, deadlines, one pending exchange and child
   failure/exit closure. Never restart a child or adopt an old response as custody.
   Existing `inspect` behavior is a compatibility constraint; do not enable GUI
   Git availability as a side effect of registration forwarding.
4. Map only fresh validated application VCS facts into the existing resolver's
   trusted root. Keep current Native membership/app-role checks before and after
   observation, fixed grant scope and policy, and the store's three resolution
   boundaries. Caller request schema and public registration output stay unchanged.
5. Store application IDs through existing binding fields and receipt JSON, with
   the existing transaction/uniqueness/replay owners. Add no VCS table or registry.
   Content revision remains a fresh observation, not a new registration column.
6. Private lifecycle enrollment precedes registry acceptance and can save inert
   application references even if later authorization or SQL refuses. Observe and
   report that separately; do not describe a failed registration as changing no
   private metadata unless the actual case proves it. Project and Git bytes must
   remain unchanged during service operations.

## Done condition

In one verified disposable Linux proof root, use real Git setup and actual
Native actions/SQLite. Fixture setup may initialize repositories/create linked
worktrees only within that contained root; no user repository is touched.

Prove no-VCS compatibility, ordinary Git, alias deduplication, nested monorepo
roots, linked worktrees, and equal-content independent repositories. Export exact
live application tuples and SQL binding/receipt values proving the required
equalities and differences. Dirty/detached updates retain IDs while custody holds;
changing facts within a registration transaction refuses or rolls back.

Prove current role/member revocation before dispatch and across observation,
root or Git-administration replacement before/final reauthorization, provider
exit/restart, unresolved persisted records, malformed VCS replies, forged caller
fields, wrong sequence/locator/operation, and unverified sibling inventory.
Record the settled outcome-03 replay/duplicate cases with exact expected outputs.
Preserve valid replay without new registry rows, revision change or ID allocation.

Snapshot every relevant SQL row and the complete project/Git tree immediately
before each service operation. Setup mutations are outside that interval.
Capture private lifecycle metadata separately, including permitted enrollment
changes on later refusal. No rejection may claim a committed registration when
the transaction rolls back. No success may grant mutation or restore custody.

An independent reviewer verifies the code, adversarial cases, captured values,
archive manifest/hashes and exact cleanup before the lead records acceptance.
The result closes only this registration bridge, not outcome 12 or release gates.

## Verify

After freezing the required package/proof-root environment, run these selected
targets through the bounded supervisor, with explicit child heap flags as above:

```console
node --max-old-space-size=192 --test packages/workbench/tests/native-vcs-registration.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/root-provider-vcs.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-registry.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/root-provider-read.test.mjs
python -B -m pytest packages/core/tests/test_root_vcs_identity_lifecycle.py packages/core/tests/test_root_identity_lifecycle.py packages/core/tests/test_root_identity_reads.py -q
```


The lead supplies the existing Habitat checkout, installed Python/Node/Git/Core
paths, supported proof mount, supervisor, exact source hashes and current RAM/
disk/usage headroom. No installation, new checkout or container is authorized.
Use no credentials, network Git, account connection or model call.

Use the existing bounded Native proof profile as an initial experiment:
512 MiB aggregate Linux cgroup, zero swap, 64 tasks, one CPU, explicit 192 MiB
heap flags for every Node parent and child, plus 512 MiB Windows parent allowance
and 1536 MiB host reserve. Admission requires 2.5 GiB fresh available memory and
the existing 10 GiB free-disk check. The Windows amount is an allowance, not an
enforced job cap. Record current host commit headroom separately when available.

Each selected test phase has an absolute Linux BOOTTIME deadline of 180 seconds
and at most five seconds of termination grace, with at most 1 MiB combined
exported stdout/stderr. Keep every inner worker capture bounded and account for
its aggregate buffers separately. Before launch, freeze the finite phase count,
commands, source/dependency hashes, evidence locations and outer service deadline
covering those phases and cleanup. Never reset an active phase's deadline.

Preflight verifies the actual tools, mount and limit enforcement, then admits the
first bounded trial. It does not require these exact new tests to have passed
under this profile already. If headroom or enforcement is unavailable, hold only
runtime dispatch and continue independent source work. Bound every descendant
Git/Node/Python process and confirm settlement before cleanup or another trial.

Run the two focused new suites, the unchanged six-group Native registration
suite, the existing root-provider read suite, and the exact 12e compatibility
tests selected by source impact. Record actual counts and failures; do not use
skips to satisfy missing Git, platform or mount prerequisites. Run the canonical
plan/source-navigation/line-ending/diff checks after lead application.

Export reviewed sources, resolved dependency hashes, output/event logs, exact
identity/SQL/tree witnesses and cleanup evidence. Reuse one ticket scratch
directory and one verified final evidence export. The lead's packet must include
an exact disposable-root/process cleanup inventory before runtime dispatch.

## Stop conditions

No production activation, GUI readiness, live inventory update/rebind, automatic
migration/reconciliation, Windows/Jujutsu support, project mutation, reservation
or fencing, runtime start, network Git, account/credential changes, paid usage,
scheduled jobs, publication, push or merge. Unsupported layouts remain refused.
Do not widen product claims because the registry vocabulary can represent them.

Source ownership conflict, an unaccepted 03d prerequisite, or a verified
observer inability to support a required topology must return to the named lead/
owner before dependent edits. Continue independent source design and fixture
preparation without claiming runtime acceptance or creating a parallel service.

The lead owns this packet, its evidence receipt and parent/frontier metadata.
Before runtime dispatch, record the exact contained disposable root, process
identities and cleanup allowlist in the private freeze. Cleanup follows export
and verified process absence; shared caches and other packets remain untouched.

## Log

- 2026-09-08: Prepared from the independently accepted 12f successor. The reviewed 03d packet now owns the registry prerequisite. Proposed proof admission uses the existing Native bounds with an explicit first-trial experiment and finite phases. No implementation or execution authorized by this private draft.

- 2026-09-08: Independent review accepted the dependent packet against the exact 12f predecessor archive. Published for future claim after 03d passes; no implementation or runtime dispatch occurred.

- 2026-09-08: Canonical validation requires every executable packet start dependency to be done. The lead therefore retains this reviewed successor privately until 03d passes. Explicit existing test commands address the validator command requirement. No needs-info status or new human gate was introduced.

## Accepted implementation boundary

The lead verified all four start dependencies as done and passed on 2026-09-08.
03d is applied to the canonical checkout and Habitat with exact hash readback.
This packet is authorized for bounded implementation under the existing program.

Retain private protocol version 1 and the existing ready, unavailable and inspect
frames. Extend only the strict observed response with a required none/git VCS
union. Both ends ship together. An old child missing VCS must fail closed.
Do not silently treat a missing field as no-VCS. A successful Git tuple requires
current lifecycle custody, application repository/checkout IDs and the existing
Git mutation owner. Never forward raw physical IDs or a claimed verification flag.

Use the installed Native dependency loaders in the two new test files. Existing
fixture functions are private to their test files. Keep new fixtures focused on
the wire and actual Native SQLite registration rather than duplicating the HTTP
test harness. Preserve the existing no-VCS and read compatibility inputs.

- 2026-09-08: Lead accepted the reviewed successor after 03d application. A fresh
  read-only review confirmed satisfied dependencies and the three existing source
  owners. Implementation may start when its named writer finishes the current
  packet. No runtime dispatch or parent outcome completion is claimed.

- 2026-09-09: The lead applied five source-reviewed files to canonical with exact
  preimages. Discovery04 verified the installed Habitat tools and Native SQLite.
  Independent review accepted the bounded drivers and 76-file snapshot. Two
  setup attempts stopped before service or test launch. The first exposed WSL
  shell argument expansion. The second exposed `install` refusing `/dev/stdin`.
  Both failed archives passed independent hash review. The first stage required
  reviewed recovery. The second cleaned its stage automatically. Both have zero
  remaining helpers and their archived local duplicates are removed. The writer
  is replacing the small-file transfer step before another reviewed trial.
  Product runtime acceptance remains pending.

- 2026-09-09: Trial03 reached Native registration and exposed rejection of the
  existing nested-project Git layout. The lead applied the independently reviewed
  three-layout correction and direct nested/linked wire assertions. Trial04 passed
  all 56 tests and complete Native/Python identity witnesses. Its overall proof
  failed when cleanup tried to stop an already removed service and forced three
  console helpers. The disposable stage and all helpers are absent. Four failed
  archives remain preserved. Cleanup repair and independent evidence review are
  in progress. No packet completion or Habitat source application is claimed.

- 2026-09-09: Trial05 passed all 56 tests, all five preflights and complete
  Native/Core identity witnesses. Lead and independent review accepted the full
  archive, limits and cleanup. No forced or remaining helpers, service, cgroup
  or stage remained. All five accepted sources match canonical and Habitat after
  a separately reviewed copy. Packet 12g is complete within its Linux fixture
  boundary. The receipt owns exact hashes and remaining outcome 12 work.
