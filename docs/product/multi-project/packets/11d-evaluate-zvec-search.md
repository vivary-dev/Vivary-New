# 11d: Evaluate optional local semantic search
Type: packet
Parent: 11
Status: needs-info
Depends-on: [11c]
Owner: Root-assigned search integrator
Scope: Compare pinned zvec-grep with existing exact search on a small local corpus.
Verification-kind: runtime
Needs: Accept 11c. Approve the local model download and select numeric time, memory, disk, and corpus limits before running.
Timebox: One bounded comparison and an adopt, defer, or reject decision.

## Goal

Determine whether optional semantic search finds useful project sources that
exact search misses, at an acceptable local cost. This is not a first-exe blocker.

## Context

Read [the desktop release plan](../desktop-release.md), [ENGINEERING.md](../../../../ENGINEERING.md),
and [the source evaluation](../research/zvec-evaluation.md). Keep the existing
Native action/tool owner and Tropo retrieval semantics. No new agent runtime.
Upstream Windows CI is evidence of targeting, not installed Vivary acceptance.

## Owned files

- Existing search actions in `packages/workbench/actions/` and their server owner.
- `packages/tropo/tropo.py` only if a demonstrated retrieval seam needs adaptation.
- `packages/desktop/package.mjs` only for the accepted dependency packaging boundary.
- The concise evaluation note and focused existing search/package checks.

## Done condition

Pin the package, native dependency, model revision, and primary source versions.
Compare ripgrep, BM25, and one small local hybrid model on fixed code/text queries.
Record useful source matches, cold download/index cost, warm latency, peak memory,
and disk use. Select actual limits before the run. Vendor benchmarks are not proof.

Prove Windows x64 execution with the packaged Node boundary, including Unicode
paths, restart, changed/deleted files, and a missing or stale index. Results open
the owning file at a valid location. Other architectures remain explicitly unproved.
Respect project grants and privacy exclusions. Indexes are disposable derived data.
Exact search remains usable when optional indexing is disabled or fails.

## Verify

Use a disposable, explicitly selected corpus within the agreed resource limits.
Keep remote embeddings off. Check cross-project exclusion and revocation.
Prefer direct execution. Contain native failures outside the GUI process.

```console
pnpm --dir packages/workbench typecheck
git diff --check
```

## Stop conditions

Stop at the selected resource limit or a privacy/packaging failure. Do not install
globally, change agent configs, start a daemon, download a model, or send content
remotely without that operation's authority. Do not delay the first desktop release.

## Log

- 2026-09-13: Drafted as an optional follow-up. No dependency, model, or index installed.
