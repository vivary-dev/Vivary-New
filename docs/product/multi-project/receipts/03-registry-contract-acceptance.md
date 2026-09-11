# 03 Registry contract acceptance

Evidence-record: 03
Date: 2026-09-10
Verification-kind: inspection
Verification-result: passed
Scope: Parent contract acceptance from previously accepted model, mapping and durable-admission evidence.

## Acceptance boundary

Outcome 03 defines project registry and authority contracts. The
[registry contract's remaining owners](../contracts/project-registry.md#remaining-implementation-owners)
assign this outcome executable contract agreement and an explicit
storage/transaction mapping before closure. This receipt accepts that scope.

The outcome's serialization requirement is satisfied by complete-key mutation
admission and rejection of conflicting owners. Rule R11 defines that reservation
contract. Rule R12 separately assigns actual effect-boundary fencing to outcome
04 and cross-process recovery to outcome 17. This acceptance does not claim that
a reservation row can fence an external writer or that project/VCS effects ran.

## Done-condition coverage

The [03a inspection](03a-registry-contract.md) defined the original 57 cases.
[03b](03b-registry-contract-model.md) executed all 57 exact decisions, 25 tests,
contender/crash schedules and deliberate faulty implementations. The current
fixture retains those cases. Its later additions do not substitute for that
accepted evidence.

| Required coverage | Fixture examples | Accepted evidence |
| --- | --- | --- |
| External roots and no-VCS folders | `register-external-no-vcs`, `no-vcs-mutation-reserves-root` | 03a contract and 03b exact decisions |
| Git worktrees and monorepos | `register-linked-worktree`, `register-monorepo-subproject` | 03b exact decisions and contender schedules |
| Path moves and missing roots | `explicit-move-keeps-project-id`, `same-path-replacement-root-refused`, `missing-root-preserves-records` | 03b exact decisions |
| Duplicate registration and shared repository identity | `duplicate-root-different-operation`, `canonical-path-alias-converges`, `same-content-other-root-is-new` | 03b convergence and [03d](03d-vcs-replay-consistency.md) Native store/action checks |
| Concurrent mutation ownership | `git-mutation-reserves-common-and-checkout`, `other-worktree-repository-busy`, `monorepo-other-project-checkout-busy`, `uncertain-writer-not-expired-away` | 03b contender/crash schedules and [12h](12h-durable-mutation-admission.md) durable complete-key admission |

## Verification-clause coverage

| Required verification | Evidence and limit |
| --- | --- |
| Portable identity round-trips separately from local paths and secrets | 03b verifies the portable export allowlist, selected content identity and injected local/credential sentinel exclusions. The deliberate trusted-object-export mutant fails. Native portable export transport remains a separate integration concern. |
| Duplicate operations converge | 03b proves canonical alias and operation replay behavior. 03d passed 78 oracle/store/action tests against 65 fixture cases and rejected stale VCS replay without registry writes. |
| Shared repository mutations serialize | 12h atomically reserves the complete repository/checkout key set, rejects intersecting owners, persists fence high-water values, reconciles retries and rolls back injected failures. Independent review accepted linked-worktree, cross-collection and separate-process contention across 42 witnesses. No project or VCS effect was performed. |
| Storage and transaction responsibilities are mapped | [03c](03c-registry-transaction-mapping.md) records the independently reviewed Native transaction/action mapping. 03d and 12h later exercise the mapped store and action responsibilities within their accepted scopes. |

The only parent dependency, [outcome 01](../tickets/01-reconcile-migration-boundaries.md),
is complete. Outcome 03's own packets 03a through 03d are complete.

## Review and remaining owners

This is a review of accepted receipts and their stated limits, not a fresh
runtime execution or revalidation of every historical archive member. It does
not certify all current implementation bytes or change another outcome's scope.

Actual external-writer fencing and runtime permissions remain with outcome 04.
Registration/selection UI remains with 06. Git/Jujutsu identity adapters remain
with 12. Write-back, recovery and handoff behavior remain with 11, 17 and 29.
Deployment, production bootstrap and the planner/developer/QA cycle are not
accepted by this receipt.

Independent review checked every Done/Verify clause and the R11/R12 ownership
boundary. The lead accepted the roll-up on 2026-09-10. No production-integration
requirement was removed from its owning outcome.
