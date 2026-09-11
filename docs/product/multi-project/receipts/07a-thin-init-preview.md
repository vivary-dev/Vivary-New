# 07a receipt: Exact thin workspace preview

Evidence-record: 07a

Status: Complete. Source review, Habitat execution and independent archive verification passed.

## Result

`plan_thin_workspace` returns the ordered file contents and UTF-8 byte lengths
from the same generator used by thin workspace creation. Each file has a content
hash. The portable content digest excludes the target location; the plan digest
binds the normalized target, options and complete file preview.

Preview validates absent or empty destinations without creating anything.
Caller-owned adapter lists are snapshotted before validation so callbacks cannot
silently change the options after the files have been generated. Existing apply
and rollback behavior remains in the existing scaffolder.

## Executed proof

The final focused Habitat run passed seven tests with no skips. It covered stable
preview, exact equality with generated files across presets and adapters, optional
active context, changed inputs, occupied targets, real Linux symlinks, and mutable
caller input. Generated fixtures passed actual Doctor and Tropo checks.

The existing suite ran 194 tests: 192 passed and two Windows-only cases were
skipped on Linux. The final run took 16.853 seconds. Before implementation, the
focused checks failed because the preview API did not exist.

An earlier existing-suite run exposed two legacy wizard tests that attempted
optional backend installation. Both attempts failed; subsequent read-only package
inspection found no new installed distribution. Those tests now mock the installer
because they test storage configuration and validation. This is test isolation,
not proof that optional backend installation works.

## Review, preservation and cleanup

Independent review found the caller-mutation case; a regression test verifies the
fix. The lead reviewed the source and execution evidence. A separate reviewer
verified ZIP integrity, unique membership, all 24 payload sizes and hashes, and
all four final source files against the canonical checkout.

Archive SHA-256:
`2cfc4179470af0fc3b9529a4bb9c8ada621a3512f126569f531e18e946aae501`.
The archive is 212,983 bytes. It preserves baseline and final sources, runtime
results, review evidence and proof helpers in the private evidence store.

Habitat test fixtures cleaned themselves. Five empty Windows preview directories
from an initial ACL-limited run were individually verified and removed without
recursive deletion. The review fixture cleanup also passed. Synced source files
remain in the existing Habitat checkout; evidence remains available for review.

## Limits and next work

This is a source API acceptance. A preview hash grants no filesystem authority.
Bound apply, parent custody, interrupted-creation recovery, Native registration
and GUI acceptance remain required under outcome 07. No model call, production
project creation, account configuration, publication or release occurred.
