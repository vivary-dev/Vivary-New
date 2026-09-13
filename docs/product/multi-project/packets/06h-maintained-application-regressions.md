# 06h: Make the maintained application regression checks reliable
Type: packet
Parent: 06
Status: ready-for-agent
Depends-on: [03c]
Owner: Coordinating Codex, sole existing-test maintenance writer
Scope: Correct named obsolete fixture assumptions and environment setup in the maintained application checks.
Verification-kind: runtime
Timebox: One focused test-maintenance change with no new proof framework.

## Goal

Run the application's supported regression checks with meaningful failures,
without depending on retired proof scratch or a particular agent's machine.

## Context

Read [the desktop target](../desktop-release.md) and the precise failures in
[the salvage receipt](../receipts/salvage-handoff-2026-09-12.md).
CI passes but the broad Zo run did not. Keep those statements distinct.
The temporary runner omitted the two mutation suites' heap arguments. A GUI
fixture references retired scratch. Registry metadata assumes no actions folder.
Core permission fixtures and creator timestamp failures need separate diagnosis.

## Owned files

- Existing Workbench tests, package scripts, and their small shared setup helpers.
- Creator legacy Doctor snapshot tests only for a reproduced timestamp issue.
- Core permission fixtures only for a supported non-root test environment.

## Done condition

Every maintained check has a documented ordinary command and cleans up its
children. Correct the metadata assertion to inspect the private registry actions,
not the absence of unrelated app actions. Supply existing required test options.
Historical proof-only tests stay reachable as history and leave the product
regression command through an explicit source disposition.
Permission tests run where permissions are enforced. Unsupported environments
are identified without changing refusal behavior or masking product failures.

## Verify

Run the affected existing suites after each correction. Preserve original logs.
Run the final maintained command once in its supported environment. Do not replay
old C5 campaigns or make all historical experiments part of every feature test.

```console
pnpm --dir packages/workbench test:registry-actions
pnpm --dir packages/workbench test:registry
pnpm --dir packages/workbench test:shell
git diff --check
```

## Stop conditions

Do not weaken filesystem, privacy, or authorization assertions to make a host
pass. A test removal needs a named obsolete assumption and replacement coverage.
Do not build a new verifier, evidence archive system, or test runner product.

## Log

- 2026-09-13: Converted named recovery-test failures into bounded maintenance.
  Existing application checks and historical evidence remain unchanged.
