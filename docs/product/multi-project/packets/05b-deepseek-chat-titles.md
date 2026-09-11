---
type: packet
---
# 05b: Generate native chat titles with DeepSeek

Parent: 05
Status: needs-info
Depends-on: [05a]
Owner: GPT-6 lead, sole writer; independent agent reviews composition and evidence.
Needs: Jeff's explicit approval of the proposed DeepSeek title payload and mutable-title guard change after automatic approval review rejected the code patch.
Scope: Native title endpoint, DeepSeek request adapter, mutable title compatibility, and deterministic tests. No live model call or chat activation.
Verification-kind: inspection
Verification-result: pending
Evidence: [Title receipt](../receipts/05b-deepseek-chat-titles.md)
Timebox: Four Habitat attempts, at most 60 seconds each and 240 seconds total, including retries.

## Goal

Use DeepSeek for automatic native chat titles and preserve runtime identity when
a thread's display title changes.

## Context

Jeff requested DeepSeek API generation for chat titles on 2026-09-10. This is
separate from 20j's deterministic creation/context packet and exhausted budget.
Use the installed native title request and thread storage. Preserve manual
renames, strip hidden context, and return a readable fallback if DeepSeek fails.
Titles are display text, not runtime identity. Keep owner, organization,
visibility, project scope, session, and receipt bindings intact.

The current conversation UI has no composer. Endpoint integration does not
activate that UI or establish production readiness. Paid calls and account
configuration retain their explicit gates. No model credentials are read by tests.

## Owned files

Own the workbench title handler/plugin, focused tests, the title clauses in
runtime preparation/start, this packet/receipt, package README, and generated
frontier. Test the installed H3/native mount with a fake upstream and synthetic
authentication; verify failure, hidden context, scope isolation, and rate limits.
Review native manual-rename protection at its existing owner.

## Done condition

Prove native title-route dispatch, sanitized bounded requests, fallback behavior,
scoped credentials, manual-rename protection, and renamed runtime-thread replay.
The current inspection checkpoint does not meet those runtime conditions.

## Stop conditions

The code patch requires the specific approval recorded in the receipt. Do not
retry it indirectly. After approval, bind and prove the runtime configuration
before changing Verification-kind to runtime or executing tests.
Use the existing Habitat dependencies read-only and the previously verified
Node 22.23.2 binary. Bind exact scratch and executable paths in private
`.tmp/05b` configuration before runtime. No install, model call, or new checkout.
Require 2560 MiB warm RAM, 2048 MiB commit headroom, and 10 GiB disk; preserve
1536 MiB host RAM. One heavy job; stop at 95 percent included usage. Enforce
512 MiB each for Linux/Windows, zero Linux swap, 64 tasks, one CPU, private
network, read-only source/dependencies, 250 ms observer, one-second observation
gap, 1 MiB output, and five-second owned cleanup. Export evidence before removing
contained scratch; preserve shared Docker and unrelated Habitat activity.

## Verify

```console
git diff -- packages/workbench/server/project-runtime-preparation.mjs packages/workbench/server/project-runtime-start.mjs
python scripts/check_multi_project_plan.py --check
git diff --check
```

Read back the proposed new file paths to confirm the rejected patch did not land.
After code approval, name and record the focused test command before runtime.

## Log

### Current progress

Core 0.176.5 hardcodes Anthropic in the title endpoint; native chat model
configuration does not change it. The client already suppresses generated titles
after a manual rename. Workbench runtime guards currently require a literal
default title. Independent source review confirmed the supported mount order:
register the title middleware synchronously, then await native bootstrap.

Automatic approval review rejected the code patch. No product file changed and
no runtime, secret lookup, or provider call occurred. The next step is the
specific owner approval described in the receipt, followed by implementation
and deterministic proof. Existing 20j failures retain their separate status.
