# 19a: Connect an approved external pattern catalog after its hold is lifted
Type: packet
Parent: 19
Status: needs-info
Depends-on: [07c, 08a]
Owner: Root-assigned Workbench template-wrapper writer after external owner release
Scope: Discover the external installed template capability and connect its plans and receipts through the existing setup UI without copying its implementation.
Verification-kind: runtime
External-gates: [template-installer]
Needs: The external owner must complete program tickets 01-06, explicitly lift the template-installer hold, supply an approved source packet and compatible installed API. Root must accept 07c/08a.
Timebox: One coherent user-visible increment with focused checks and review.

## Goal

After the external prerequisites are satisfied, let users preview and install
approved catalog patterns using the same visible project setup workflow.

## Context

Read [ENGINEERING.md](../../../../ENGINEERING.md), the [current design](../design.md),
[Agent-Native ownership](../native-owners.md), and the [original source map](../research/original-vivary-product-map.md).
Agent-Native owns application actions, runs, and conversations. The original
creator owns setup operations, and Tropo owns project retrieval. The coordinating
agent (`root`) assigns one source writer before activation. Follow the live
repository delivery rules.

Read [outcome 19](../tickets/19-integrate-template-program.md) and its
[external dependency](../external-dependencies.md#held-template-installer-program).
This packet records future work only. Research, repository migration, or general
permission to continue does not lift the external program's specific hold.

## Owned files

- Existing Workbench capability detection and template wrapper integration.
- Native catalog selection, plan preview, result, and recovery UI.
- Wrapper tests against the external program's installed conformance fixture.
- No copied external catalog, transport, installer, or template engine.

## Done condition

An unavailable or held capability stays disabled with a clear explanation and
no project writes. After release, the wrapper consumes the approved API, previews
its versioned content/effects, binds the selected authorized project, and records
the actual result. Retry/recovery retains project usability without the GUI.

External catalog semantics/content and transport remain externally owned. Built-in
patterns from 07c stay independently usable. Selecting a template activates no
model, provider, scheduled loop, remote repository, or extra agent. Any oracle or
maintenance metadata retains its separately approved meaning.

## Verify

Use the supplied conformance fixture after the hold is lifted. Cover unavailable,
held, incompatible, successful, changed-plan, and interrupted-install outcomes.
Exercise external selection and preview/apply in the existing GUI alongside
continued built-in setup. Record the actual fixture command after API selection.

```console
pnpm --dir packages/workbench typecheck
node --test packages/workbench/tests/creation-provider.test.mjs
git diff --check
```

## Stop conditions

Do not install, copy, publish, or activate the external program before its named
release conditions. Do not make this packet a prerequisite for built-in creation,
file editing, ordinary memory, or ongoing GUI delivery.

## Log

- 2026-09-13: Added to the combined implementation plan. Prerequisites are
  unresolved. No implementation or runtime acceptance is claimed.
