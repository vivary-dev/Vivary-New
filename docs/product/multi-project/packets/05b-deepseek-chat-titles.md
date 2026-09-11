---
type: packet
---
# 05b: Generate native chat titles with DeepSeek

Parent: 05
Status: in-progress
Depends-on: [05a]
Owner: Root orchestrates. Source recovery used Plan `/root/plan_issue`, Implement `/root/implement_issue`, QA `/root/qa_issue`, and Verify `/root/verify_issue`. GUI source uses Plan `/root/plan_gui`, Implement `/root/implement_gui`, QA `/root/qa_gui`, and Verify `/root/review_doctor_fix`. Source QA and Verify are ready; GUI runtime acceptance remains pending.
Scope: Internal Vivary GUI conversation titles through its native title endpoint, DeepSeek request adapter, Native history consumer, and observable GUI behavior. No development-loop or runtime preparation/start changes.
Verification-kind: runtime
Verification-result: pending
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

The workbench conversation panel renders the read-only `Conversation` component.
The `/chat` source candidate now composes Native's public `AgentChatSurface` with
a fixed app-owned scope and an authenticated account/organization mount gate.
This source change does not prove title generation or production readiness. Paid
calls and account configuration retain their explicit gates. No model credentials
are read by tests.

## Owned files

Own the workbench title handler/plugin, focused tests, `/chat` route, this
packet/receipt, package README, and generated frontier. Test the installed
H3/native mount with a fake upstream and
synthetic authentication. Verify failure, hidden context, scope isolation, and
rate limits. Review native manual-rename protection at its existing owner. The
Workbench `Conversation`, project controls, and root remain owned by 06e.

## Done condition

Retain the accepted backend proof, then prove the user-visible title flow in the
Native conversation history. The first visible user message generates a title.
The title persists after reload and thread switching. A manual rename wins if
generation returns later. Provider failure produces and persists a local fallback.
No hidden context reaches DeepSeek. Authentication refusal does not fall through
to Anthropic. User, organization, and thread boundaries cannot rename another
conversation. Cached history from another user or organization must not render
while authorization is unresolved. Real authentication deployment and a paid
provider request remain outside this packet's acceptance.

Core 0.176.5 publicly exports `AgentChatSurface` and its props from
`@agent-native/core/client/chat`; the shipped docs show page-mode composition.
Its props expose a storage key, scope, and scoped history isolation. This
identifies the existing component to compose, not activation proof or a complete
authentication and storage contract. Use the ordinary internal `/chat` flow over
the project coding runtime. Do not absorb this work into 06e. That packet owns
the Workbench `Conversation` and selected-project behavior, mounts no composer in
that panel, and still has open build and browser gates.

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

The first rejected patch did not land. The subsequently approved backend
implementation passed all eight tests on its first Habitat attempt. Do not rerun
those tests for this process correction. GUI acceptance is pending.

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
source review found no blocking backend findings. Runtime preparation/start is
unchanged, including the literal guards in project activity read, preparation,
and start.

One 60-second allocation was used; the parent completed in 20.322 seconds with
cleanup accepted. Verified evidence was archived and the exact Linux scratch
removed. Habitat subsequently stopped; Ubuntu remained running. No live secret
lookup or provider request occurred. This is narrow backend evidence. It does not
prove any user-visible title behavior.

The accepted GUI plan assigned `/chat` a fixed Native workspace-app scope with ID
`vivary-workbench-chat-v1`. The first candidate used that value as a fixed storage
key. Source QA rejected it because a prior account's cached active thread could
render before server authorization completed.

The corrected candidate keeps the fixed app scope. It derives both the React key
and storage key from the authenticated normalized email and resolved live
organization ID with collision-safe encoding. Native ownership uses the required
session email, so the route does not depend on optional `userId`. The organization
email must match that normalized identity. Empty or mismatched identity fails
closed. The chat unmounts while organization identity loads, refreshes, fails, or
disagrees with the session. It disables
automatic active-thread restoration, starts a fresh empty thread after each mount,
and leaves saved conversations and titles accessible through Native History.

Core 0.176.5's public query-client factory sets a 30-second stale time and disables
focus refetch. Standard window focus therefore preserves the mounted draft. An
actual organization invalidation intentionally unmounts it while the active
organization resolves. Page mode, scoped history isolation, app chat, native
header and tabs, chat-only behavior, disabled code access, and no URL thread
synchronization remain unchanged. The Workbench conversation remains read-only.
No build, browser, model, or runtime check has run against these changed bytes.

The 05b budget remains four 60-second allocations and 240 seconds total. One
allocation is consumed and three remain. The 512 MiB limit cannot expand. That
test profile disables Native services and cannot prove the GUI flow. The current
Habitat inventory has no installed browser executable. Windows Playwright
Chromium 1234 is installed for a future bounded proof, but no browser check has
run. A future GUI proof needs a new exact build and browser admission for these
bytes. The frozen 06e one-request, 1,200-second build grant cannot be reused.

The prepared next shipped integration packet is 20k; it remains blocked because
20j exhausted its budget without accepted context proof. This correction does not
change either packet.
