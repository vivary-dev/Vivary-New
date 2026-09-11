---
type: packet
---
# 05b: Generate native chat titles with DeepSeek

Parent: 05
Status: done
Depends-on: [05a]
Owner: GPT-6 lead, sole writer; independent agent reviews composition and evidence.
Scope: Internal Vivary GUI conversation titles through its native title endpoint, DeepSeek request adapter, and deterministic tests. No development-loop or runtime preparation/start changes.
Verification-kind: runtime
Verification-result: passed
Evidence: [Title receipt](../receipts/05b-deepseek-chat-titles.md)
Timebox: Four Habitat attempts, at most 60 seconds each and 240 seconds total, including retries.

## Goal

Use DeepSeek to generate titles for conversations inside the Vivary GUI.

## Context

Jeff requested DeepSeek API generation for chat titles on 2026-09-10. This is
separate from 20j's deterministic creation/context packet and exhausted budget.
Jeff clarified: "no this is internal to the vivary gui". The GUI backend owns
this small model task. It is not a provider for the development harness, a change
to the main conversation model, or a model call for this development session.
After the exact backend payload and approval objection were explained, Jeff
answered "dont ask justt do it". This authorizes implementing that GUI backend
call. Verification uses a fake provider and makes no live DeepSeek request.
Use the installed native title request and thread storage. Preserve manual
renames, strip hidden context, and return a readable fallback if DeepSeek fails.
Runtime preparation/start and its guard changes are outside this narrowed scope.

The current conversation UI has no composer. Endpoint integration does not
activate that UI or establish production readiness. Paid calls and account
configuration retain their explicit gates. No model credentials are read by tests.

## Owned files

Own the workbench title handler/plugin, focused tests,
this packet/receipt, package README, and generated
frontier. Test the installed H3/native mount with a fake upstream and synthetic
authentication; verify failure, hidden context, scope isolation, and rate limits.
Review native manual-rename protection at its existing owner.

## Done condition

Prove native title-route dispatch, sanitized bounded requests, fallback behavior,
scoped credentials, and manual-rename protection in GUI conversation history.
Native manual-rename behavior remains owned by the unchanged client and has
source inspection evidence. Runtime acceptance here covers the backend, not an
active GUI composer, real authentication deployment, or a paid provider request.

## Stop conditions

The specific implementation approval is recorded above. Bind and prove the
runtime configuration before executing tests. Keep live paid tests gated.
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
node --max-old-space-size=192 --import packages/workbench/tests/register-native-dependencies.mjs --test --test-concurrency=1 packages/workbench/tests/chat-title.test.mjs
python scripts/check_multi_project_plan.py --check
git diff --check
```

The first rejected patch did not land. The subsequently approved implementation
passed all eight tests on its first Habitat attempt.

## Log

### Current progress

Core 0.176.5 hardcodes Anthropic in the title endpoint; native chat model
configuration does not change it. The client already suppresses generated titles
after a manual rename. Workbench runtime guards currently require a literal
default title. Independent source review confirmed the supported mount order:
register the title middleware synchronously, then await native bootstrap.

Automatic approval review rejected the first code patch before any product file
changed. Jeff then explicitly authorized the narrowed GUI backend implementation.
The backend passed eight tests against installed H3/native request context with
a fake provider, including the actual five-second timeout and concurrent request
isolation. The production plugin imported and mounted its route. Independent
source review found no blocking findings. Runtime preparation/start is unchanged.

One 60-second allocation was used; the parent completed in 20.322 seconds with
cleanup accepted. Verified evidence was archived and the exact Linux scratch
removed. Habitat subsequently stopped; Ubuntu remained running. No live secret
lookup or provider request occurred. The current read-only GUI still needs its
chat composer integration before users can observe automatic titles.

The prepared next shipped integration packet is 20k; it still requires accepted
20j context proof and resolved Habitat clock behavior. Those failures retain
their separate status and are not changed by this backend acceptance.
