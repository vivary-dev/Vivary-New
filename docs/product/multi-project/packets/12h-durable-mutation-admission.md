---
type: packet
---
# 12h: Persist bounded mutation admission
Parent: 12
Status: done
Depends-on: [12g, 03d, 12e, 06d]
Owner: Sol owns the isolated source candidate. Astra owns packet acceptance, serial application, runtime evidence, and cleanup acceptance.
Scope: Internal no-VCS and Git mutation admission through the existing registry decision, action, store, and live root observation owners. No project or VCS effect, write-back, reservation release, reconciliation, Windows, Jujutsu, or cross-device fencing.
Verification-kind: runtime
Verification-result: passed
Evidence: [12h runtime receipt](../receipts/12h-durable-mutation-admission.md)
Timebox: One six-module admission and storage change, one focused fixture, one supervised Habitat proof, independent review, and cleanup.

## Goal

Persist one mutation owner and fencing token for a verified project root. Return
an admission record that a later effect adapter can recheck without claiming
that any project or VCS bytes changed.

## Context

Read project-registry R9 through R12, the transaction map, outcome 12, and
packet 12g. The accepted 12g provider supplies current application root,
content, repository, checkout, and Git-owner facts. The registry model already
decides admission. Extend the existing action and store instead of adding a
second coordinator or decision engine.

The action must receive authenticated scope and a current `mutate-project`
capability from the Native policy owner. Add the explicit `project-mutator`
role. It is a superset for the same actor: it may register, read the actor-scoped
catalog, and invoke the internal mutation admission. Preserve the existing
`project-registrar` assignment and behavior exactly. A disposable Native proof
fixture may assign both roles to synthetic identities. Never change an existing
account assignment or expose mutation admission through an external caller.

## Owned files

Prepare isolated candidates for:

- `packages/workbench/server/registry-actions.mjs`
- `packages/workbench/server/registry-store.mjs`
- `packages/workbench/server/db/schema.mjs`
- `packages/workbench/server/db/migrations.mjs`
- `packages/workbench/server/native-registry.mjs`
- `scripts/registry_contract_model.mjs`: export the existing key-derivation
  function and rename its internal call only; preserve its body and decision rules
- New `packages/workbench/tests/mutation-admission.test.mjs`

Keep `root-provider.mjs`, registration tests, lockfiles, framework packages,
and every 06e file read-only. Pin each
canonical preimage before candidate edits.

The 06e build owns the active canonical source freeze. Prepare and review 12h
under `.tmp/vivary-12h`. A lead-reviewed, hash-pinned 12h candidate may run in
the existing Habitat proof stage while 06e keeps canonical application frozen.
It must reuse the installed dependency tree, write no persistent or canonical
file, and receive its own exact cleanup. After 06e closes its freeze, the lead
rereads current canonical hashes, rebases if needed, and applies the accepted
files serially. Runtime evidence must name the candidate source bytes and
environment; it does not prove persistent application. Final readback follows
canonical application.

## Done condition

1. Add one strict internal `admit-mutation` action. Accept only the contract
   request fields and return only `code`, `bindingId`, sorted `keys`, `fence`,
   and `ownerOperationId` on success. Disable HTTP, agent-tool, MCP, and public
   discovery. Keep audit input private.
2. Resolve the requested binding inside the authenticated actor, collection,
   and device scope. Use its stored `locationRef` for a fresh observation.
   Never accept a caller path, root ID, VCS ID, reservation, or fence.
3. Derive one root key for no VCS. Derive the sorted checkout and repository
   keys for Git. Refuse unsupported layouts and owner mismatches as read-only.
4. Store one reservation parent, its complete unique key claims, and one fence
   high-water per key. The high-water survives reservation release, expiry,
   retry, and process restart. This packet does not implement those lifecycle
   transitions.
5. In one database transaction, handle a matching receipt first. Then reload
   the binding, registry revision, intersecting reservations, and selected-key
   high-waters. Recheck current policy, binding, root, location, VCS, content,
   overlap, requested owner, and expected registry revision. Use the existing
   exported `deriveMutationKeys` callback to fetch the complete intersecting state
   before the final decision. Do not evaluate new admission against a speculative
   empty reservation set, alter request revisions, or duplicate the policy engine.
   Preserve register/export compatibility when the optional callback is absent;
   mutation admission must remain unavailable without that trusted callback.
6. Choose one fence greater than every selected key's high-water. Atomically
   advance the scoped registry revision once, insert one active reservation and
   every key claim, advance every selected high-water to that fence, and insert
   one pending intent receipt. Commit all changes or none.
7. Return `reconciliation-required` for a same-operation pending or uncertain
   receipt. Return `operation-conflict` for the same operation key with a
   different digest. An uncertain intersecting owner takes precedence over
   `busy`. Never allocate a second owner for a retry.
8. Keep project, binding, root-provider state, Git state, and project files
   unchanged. A successful admission proves durable intent only. Outcomes 04,
   11, and 17 retain effect-boundary fencing, file evidence, and recovery.
9. Obtain independent source and evidence review. Retain one verified archive
   and remove only the exact 12h proof root, processes, and temporary files.

## Verify

The focused fixture uses the configured SQLite owner and the existing registry
model. Fixture setup may initialize real Git repositories and linked worktrees
inside its disposable proof root before the service snapshots. After those
snapshots, the admission service runs no Git command and changes no project or
Git byte. The fixture records exact SQL rows and project/Git trees before and
after each operation.

Prove these accepted paths:

- no-VCS admission reserves one root key
- ordinary Git admission reserves the sorted checkout and repository keys
- a restart retains the active reservation, pending receipt, and high-water
- a historical high-water produces one greater fence for every selected key
- disjoint repositories can both admit

Prove these refusal and concurrency paths:

- linked worktrees and nested roots sharing a repository produce one admitted
  owner and one `busy` contender, with no partial loser key; repeat across
  collections on the same device to prove globally shared repository keys
- an uncertain intersecting owner returns `reconciliation-required`
- same-key retries reconcile, while digest changes conflict
- stale registry, binding, policy, content, root, location, or VCS facts make no
  database change
- wrong mutation owner, unsupported VCS, unsafe overlap, foreign scope,
  revocation, and safe-integer exhaustion make no database change
- injected failures at the reservation, key claims, high-waters, receipt, and
  revision roll back the complete transaction
- independent processes cannot both reserve one shared key set

Run exactly five test phases under the packet's bounded Habitat supervisor: the
focused fixture, registry actions, registry store, Native VCS registration, and
Native registry compatibility. The commands below identify the five suites.
The reviewed supervisor invokes each through the existing Native dependency
bootstrap, with its owned case root, provider script and Python executable as
fixture arguments. Node's test harness runs the same source-defined cases.
Freeze and record that complete executable and argument list, the fixture
environment and the owned temporary root before dispatch:

```console
node --max-old-space-size=192 --test packages/workbench/tests/mutation-admission.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-actions.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/registry-store.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-vcs-registration.test.mjs
node --max-old-space-size=192 --test packages/workbench/tests/native-registry.test.mjs
```

Record actual commands and counts in the receipt.
The focused fixture emits one bounded `VIVARY_12H_MUTATION_WITNESS` JSON line
with its schema, finite cases, exact before/after SQL rows, and project/Git
inventory hashes. Inspect database rows, process settlement, cleanup, and
unchanged project/Git trees. Do not treat a source check or database row as
evidence of external-process fencing.

## Runtime and cleanup limits

Reuse the existing Habitat checkout and installed dependencies. The lead freezes
the exact commands, source hashes, dependency hashes, proof root, process list,
finite phase count, one MiB combined output cap per phase, and cleanup allowlist
before dispatch.
Use a 512 MiB Linux cgroup with zero swap, 64 tasks, and one CPU. Give every Node
parent and child `--max-old-space-size=192`. Allow at most 512 MiB for the Windows
host-side supervisor, preserve a 1536 MiB host reserve, and require 2.5 GiB free
before a warm start. Require 10 GiB free disk. Give each phase at most 180
seconds. Freeze a 70-second outer cleanup reserve and a 5-second termination
grace for each owned process. Keep one heavy job active and stop the owned job if
any limit or reserve fails. Remove only the contained 12h proof root after
evidence export and process-absence checks.

## Stop conditions

No project mutation, service-time Git command, runtime start, write-back,
reservation release, reconciliation, production activation, credential use,
network Git, dependency installation, new persistent checkout, publication,
push, or merge. Fixture-only Git initialization and linked-worktree creation are
allowed before the unchanged-tree snapshots. Do not grant mutation to
`project-registrar`. Do not claim cross-device fencing from a database
reservation.

Hold canonical application while 06e owns its source freeze. A bounded candidate
snapshot proof in the existing Habitat stage is allowed before that freeze ends
when the shared inputs and preimages remain pinned and the lead has accepted the
candidate. Hold Habitat runtime dispatch when the toolchain, source hashes,
resource limits, or exact cleanup owner is unverified. Continue isolated source
review while either gate is closed.

## Log

- 2026-09-09: All listed dependencies are done and passed. Sol claimed isolated
  source preparation. The lead selected `project-mutator` as the Native
  capability owner and permitted a bounded candidate snapshot proof before 06e
  releases canonical application. Runtime proof remains pending. No project or
  VCS effect is authorized.

- 2026-09-09: Early source review found that evaluating an empty reservation set
  could return a stale-registry refusal before checking a busy or uncertain owner.
  The lead assigned the existing key function's export and internal rename to
  12h. Its body and all model decisions remain unchanged. Mixed-condition tests
  must prove the corrected refusal ordering.

- 2026-09-09: Accepted trial04 after 39 tests, 42 mutation witnesses, 14 Native VCS operations, independent source/evidence review and exact cleanup. Retired the unrun 06e freeze before applying all seven files serially to canonical and Habitat; independent application review passed. Durable intent is complete for this packet. Project effects, release, reconciliation, platform expansion and external-process fencing remain open.
