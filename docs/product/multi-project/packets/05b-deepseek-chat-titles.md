---
type: packet
---
# 05b: Generate native chat titles with DeepSeek

Parent: 05
Status: in-progress
Depends-on: [05a]
Owner: Root orchestrates the interrupted recovery. Plan is `/root/plan_continuation`, Implement is `/root/implement_continuation`, QA is `/root/qa_continuation`, and Verify is `/root/verify_continuation`. Independent QA and Verify accepted the exact-state resume source. The receipt retains earlier role assignments. GUI runtime acceptance remains pending.
Scope: Internal Vivary GUI conversation titles through its native title endpoint, DeepSeek request adapter, Native history consumer, and observable GUI behavior. No development-loop or runtime preparation/start changes.
Verification-kind: runtime
Verification-result: failed
Evidence: [Title receipt](../receipts/05b-deepseek-chat-titles.md)
Timebox: The endpoint phase retains its separate four-attempt, 240-second limit. GUI work consumed 143.2972104549408 active seconds across the original run, closed manual continuation, and interrupted recovery. No phase started. The interrupted recovery retains 1056.7027895450592 active seconds, including 156.7027895450592 for preparation, export, and cleanup. Unused build/browser attempts remain capped at 600/300 seconds. The correction allows four total inspection wrapper launches, including the failed first launch, and three actual helper hash invocations.

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
The following limits belong to the existing endpoint phase.
Use the existing Habitat dependencies read-only and the previously verified
Node 22.23.2 binary. Bind exact scratch and executable paths in private
`.tmp/05b` configuration before runtime. No install, model call, or new checkout.
Require 2560 MiB warm RAM, 2048 MiB commit headroom, and 10 GiB disk; preserve
1536 MiB host RAM. One heavy job; stop at 95 percent included usage. Enforce
512 MiB each for Linux/Windows, zero Linux swap, 64 tasks, one CPU, private
network, read-only source/dependencies, 250 ms observer, one-second observation
gap, 1 MiB output, and five-second owned cleanup. Export evidence before removing
contained scratch; preserve shared Docker and unrelated Habitat activity.

## GUI proof preparation

The source candidate passed independent QA and Verify in local commit `b26a5e7`.
Prepare an executable build/browser owner before admitting GUI runtime work.
Plan is `/root/plan_issue`; `/root/implement_gui` supplied the first backend and
browser draft. `/root/implement_gui_guard` owns their rework and the containment
controller. `/root/qa_gui` reviewed the backend/browser source. Root performs
controller QA; `/root/review_doctor_fix` provides separate verification.
Source review does not close this packet.

The proposed phase allows one build and one browser attempt, no automatic retries,
and 1,200 seconds aggregate. Build gets 600 seconds, with bundling capped at 300;
browser gets 300; binding, transfer, export, and cleanup share the remaining 300.
The build uses the established 2,048 MiB Linux and 512 MiB Windows limits, a
512 MiB Node heap, and 4 GiB warm RAM admission. The browser uses 512 MiB Linux,
1,024 MiB Windows, and 3 GiB warm RAM admission. Both require 4 GiB commit headroom,
10 GiB disk, the 1,536 MiB host reserve, and the existing observer/cleanup limits.
Review and bind this phase before dispatch. Its ledger must not reset or consume
the endpoint phase, 20j, or 06e's immutable build grant.

Use the real built `/chat`, Native chat transport and thread persistence, a
registered synthetic engine, and the injected fake title provider. Native's
plugin engine option alone does not select its interactive engine in 0.176.5.
Prove public registry resolution and refuse other engine/model selections.
Installed dependencies remain read-only. Only the two known Vite/Nitro cache
directories receive task-owned writable mounts inside the service namespace.
The Windows browser keeps its Chromium sandbox and a fresh profile.

The proof must distinguish account/organization changes followed by reload from
in-place switching. The app has no organization-switch control. Observe the
entire hydration/history transition for foreign text and verify stored titles
through Native persistence, including the delayed-generation/manual-rename race.
No GUI build, browser, or model call has run during this preparation.

The complete inert launcher proposal passed source QA, independent Verify, and
static in-memory composition. Automatic approval review rejected executable
root-owned WSL dispatch and process management without authority for that exact
scope. Applying the reviewed launcher and admitting its one bounded proof remain
the recorded gate from that review. The proposal stops owned processes and exports evidence; it has no
filesystem deletion operation. The receipt owns the frozen source hashes.

On 2026-09-11 Jeff authorized verification: "ok please do verification i stopped
because i went to bed no need to ask now its started for today". This approves
applying the reviewed launcher and its one 1,200-second GUI proof under the bounds
above. The launcher was applied. Fresh resource admission and exact source and
toolchain bindings still precede dispatch; the old packet budgets remain intact.
Preparation found that Habitat disables Windows automount, requiring source
transport that does not depend on an existing Windows mount. It also corrected a nonexistent private 06e path to the
canonical 06e decision record for preservation only. Neither preparation issue
allocated a GUI attempt or changed the separate 06e grant.

Automatic approval review also rejected the narrower bridge mount and the
mount-free bootstrap writer. Those changes did not land; partial heartbeat edits
were reversed. The coherent applied launcher remains unable to prepare source in
the current Habitat configuration. The exact remaining decision is permission to
implement the mount-free bootstrap and create its two reviewed Python helpers
and configuration file in the named task-owned Habitat directory. The private
`.tmp/05b/gui-bootstrap-review.md` records that operation and its bounds. No GUI
attempt has been allocated.

After the exact three-file bootstrap approval request and restart discussion,
Jeff answered "ok go on" on 2026-09-11. This approves implementing the mount-free
bootstrap and creating the three reviewed files in the directory named by the
private review record. It preserves the existing GUI proof limits. Source QA,
independent Verify, frozen bindings, and fresh admission still precede dispatch.

The mount-free candidate passed root source QA and independent Verify and was
committed as `45c6648`. The first three-file transfer succeeded. Binding preparation
then failed at the dependency inventory's 100,000-entry cap, before GUI allocation.
A metadata-only scan counted 124,017 entries. The corrected dependency-specific
cap is 150,000. Source QA and independent Verify accepted that correction, with
memory, time, byte, CPU, and link-handling limits unchanged.

The original bootstrap remains frozen. Automatic approval review rejected the
two-line change naming a corrected versioned bootstrap, requiring explicit
approval for that destination. The private `.tmp/05b/gui-bootstrap-review.md`
contains the exact recovery proposal. No GUI build or browser proof has run.
After approval, apply the two fixed-name changes and private target update,
checkpoint and bind the reviewed source, then perform fresh runtime admission.

Jeff approved the exact second-directory recovery proposal on 2026-09-11:
"please keep going and you have approval and a tool to call that doesnt stop
the whole turn". The two fixed-name changes and private target update were
applied. Retain the first bootstrap unchanged. Continue source verification,
binding preparation, and the existing bounded GUI proof. Use inline questions
for any later missing decision while continuing independent work.

The corrected binding check passed. The approved run then stopped after
68.56507468223572 seconds because fresh build admission failed after Habitat
preparation. No build or browser phase started. Owned process cleanup and the
evidence export passed independent verification. Preserve the ledger, staged
source, both bootstraps, and failed evidence.

The existing controller cannot resume a closed allocation. The proposed manual
continuation preserves the 1,200-second total, subtracts the 68.56507468223572
seconds already consumed, and retains one unused build and browser attempt.
Excluding the pause changes its absolute-deadline contract and needs explicit
approval. The private review record specifies the exact control-record amendments
and separate outputs. The controller-only continuation passed independent source
QA, Verify, and its focused source checker. It preserves the original ledger
prefix and separately binds the changed Windows controller and continuation
commit. The staged application and Linux helpers retain their frozen bindings.
On 2026-09-11 Jeff answered the pending exact deadline amendment with "just do
everything". This authorizes its one-time continuation and three control-record
amendments under the stated limits. That answer was bound to the reviewed source
checkpoint, fresh admission passed, and `--continue-run` dispatched once. Do not
invoke either closed allocation or freeze new source bindings. The approval did
not authorize a second continuation or automatic retry.

The authorized continuation stopped after 66.38113021850586 seconds at fresh build
RAM admission. Neither phase started. Its control amendments, process cleanup,
and evidence export passed their recorded checks. Independent Verify accepted
the failure evidence. A later read-only check confirmed all three preserved
control archives and the unchanged owner, configuration, and source binding.
The continuation is closed. Correcting preparation memory containment and any
further manual recovery require review before dispatch. Keep both failed results
and exports, the four-event ledger, and all control archives intact.

Jeff approved the pending recovery on 2026-09-11: "approved for everything just
document and keep updating the state and handoff and git". This authorizes the
memory-contained inspection service, recovery control amendments, source and
verification work, state/handoff updates, and local atomic commits. It resolves
the two automatic-review objections recorded in the receipt. Complete source QA
and independent Verify, bind the approved remaining budget and reviewed candidate,
then obtain fresh admission before recovery dispatch. Existing resource limits,
frozen inputs, and restrictions on installs, paid calls, and outward actions remain.

The completed recovery controller passed source QA, independent Verify, and its
focused checker at SHA-256
`df91b41c6cddf4794ec6ebe43d87f71399507574c7aa4cf7fc13e20a51fc4e5c`.
Its `--recover-run` operation reuses the staged application and frozen helpers.
It claims the remaining allocation before preparation, limits the three existing
hash inspections to a memory-accounted service, and preserves both failed runs.
Actual inspection limits, memory peak, OOM counters, cleanup, build, and browser
behavior remain runtime acceptance checks.

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

The reviewed recovery at `f581155` stopped after 8.351005554199219 seconds
because the inspection service could not traverse a frozen-input ancestor with
its empty capability set. Process cleanup passed; no build/browser phase or
control amendment was acknowledged. The recovery ledger is open, with its failed
result and logs retained. Root and the assigned agents are reviewing the smallest
interrupted-recovery correction. Remaining time is 1056.7027895450592 seconds,
including 156.7027895450592 seconds overhead; previous consumed time is retained.

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

The endpoint budget remains four 60-second allocations and 240 seconds total. One
allocation is consumed and three remain. The 512 MiB limit cannot expand. That
test profile disables Native services and cannot prove the GUI flow. The current
Habitat inventory has no installed browser executable. Windows Playwright
Chromium 1234 is installed for a future bounded proof, but no browser check has
run. A future GUI proof needs a new exact build and browser admission for these
bytes. The frozen 06e one-request, 1,200-second build grant cannot be reused.

The prepared next shipped integration packet is 20k; it remains blocked because
20j exhausted its budget without accepted context proof. This correction does not
change either packet.
