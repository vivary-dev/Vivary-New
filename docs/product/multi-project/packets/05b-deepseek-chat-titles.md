---
type: packet
---
# 05b: Generate native chat titles with DeepSeek

Parent: 05
Status: done
Depends-on: [05a]
Owner: Root coordinates execution directly on Zo. Implement owns source fixes; QA and Verify independently review source and runtime evidence. QA and Verify accepted build 04 and browser 15. Local atomic commits preserve accepted work; private Entire setup remains pending.
Scope: Internal Vivary GUI conversation titles through its native title endpoint, DeepSeek request adapter, Native history consumer, and observable GUI behavior. No development-loop or runtime preparation/start changes.
Verification-kind: runtime
Verification-result: passed
Evidence: [Title receipt](../receipts/05b-deepseek-chat-titles.md)
Timebox: The Zo allocation is 900 seconds of setup and 1800 seconds of verification, with durable cumulative accounting and at most four build and fifteen total browser attempts under budget revision 9. Preserve the closed laptop ledger separately: 214.56320595741272 active seconds consumed, 985.4367940425873 unspent. No laptop build or browser attempt started; do not replay or reset that ledger.

## Accepted result

Updated 2026-09-11. Build 04 and browser 15 passed on Zo. All twelve browser
checks passed, including generated history titles, reload persistence, delayed
manual-rename protection, provider fallback, real window focus, account and
organization cache privacy, current-scope refusal, and read-only Workbench.
Three raw Native observer cancellations have exact successful authorized
replacement reads; there are zero fatal request failures or page errors.

Natural backend exit 0 passed after the unchanged Native retention timers
expired. The fixture closed both ports of the captured React SSR channel and
observed both public close events. Audit cleanup, database closure, HTTP shutdown,
display shutdown and all six ordered runner stages passed. The supervisor
returned 0 after 322.754664 seconds with no failure and complete
owned process cleanup. Independent QA and Verify accepted the raw evidence.

The tested snapshot contains 80 exact app inputs, 212 build outputs and six
fixture files. The README was then corrected as a documentation-only delta:
tested SHA-256 `cdbf2d6053d7649439a39ee1316088b112a141285f67faa427126b448f31a837`;
current SHA-256 `996e9d2865ba4ab2c8d348f3352b6eab6950da7839362feb7ffadc515e36c06d`. No product code or build output changed after
the accepted runtime proof. The original tested manifest remains preserved.

Accepted changes are preserved through local atomic Git commits on Zo.
Private GitHub remains at `2e714f56f62b3fb17411c556947081067dee41ab`.
The earlier automatic rejection applied to a combined commit-and-GitHub-push
command. Local commits are authorized separately. The owner now selected private
Entire hosting until the work is ready for GitHub; its sign-in/setup is pending.
Seven dependency advisories remain open. Tests used synthetic providers and
identities; this acceptance does not establish production readiness.

## Historical organization-scope correction

Source review found that Native's account-owner history predicate is not restricted
to the active organization. Full chat must therefore derive its workspace-app
scope from the confirmed organization ID. The existing account/org cache key,
identity-loading mount gate, Native ownership checks, and all GUI assertions stay
required. Native continues to permit the owner's deliberate old-scope or unscoped
API access; changing that account authority is outside this GUI correction.
Legacy constant-scope rows are preserved without retagging or deletion. They are
not automatically listed by the new organization-qualified Full chat scope. No
production-data migration has been performed or claimed.

Budget revision 4 admits one clean rebuild for this product correction: four
build attempts total, eight browser attempts total, and the unchanged 1800-second
verification ceiling. The six browser failures and three builds remain charged;
236.457777354 verification seconds have been consumed. Isolation, resource stop
thresholds, cleanup, setup/probe budgets, and browser assertions are unchanged.
Preserve build 03 outputs and the pre-revision ledger. Independent source review
and exact-input verification are required before build 04 and browser 07.

## Historical headed-browser continuation

Browser 08 passed fallback persistence, then timed out waiting for a real blur
or hidden event after headless Chromium brought a second tab forward. No focus
assertion is waived. Use the installed Xvfb display server and headed Chromium
inside the existing private filesystem/PID/network sandbox. Pin Xvfb, xauth and
xkbcomp; generate private display authorization; disable X TCP listening; inherit
no host display. The same observer and owned cleanup cover the display server.
First run a bounded 30-second inert two-page display probe under the remaining
120-second probe budget. It must prove actual blur/focus and preserve a draft
without synthetic events or focus emulation before another full browser run.

Revision 5 permits ten total browser attempts with four total builds and the
unchanged 1800 verification seconds. Eight failed browser attempts and every
previous charge remain intact; current verification consumption is 361.05706319499586.
No new build, dependency install, paid call, deployment or privilege is admitted.
Each new run requires source QA, exact bindings, live resource checks and a
successful real-focus probe. Preserve the pre-revision ledger.

The saved browser 08 ledger contains 332 asset and 396 non-asset attempts, with
repeated Native application/status polling during the focus wait. The full
journey has ten document loads. The next fixture admits at most 1024 non-asset
requests and 4096 static requests, preserving the 128 MiB asset-byte ceiling,
8 MiB per-response limit, 16 pending requests and all runtime stop thresholds.
This is a bounded allowance for the complete observed Native flow; it does not
remove request accounting or classify repeated requests as successful proof.
Selected-thread history navigation must wait for its exact sharing read to finish
before New chat. Unexpected aborts remain failures; no exemption is broadened.

## Historical navigation-matched focus verification

Browser 09 stopped before Chromium because the fixture manifest allowlist omitted
two new display files. The exact entries are now admitted and every preparation
runs the real manifest/config validators. Browser 10 passed title, rename and
fallback checks, then failed real focus after application navigations. The inert
probe used setContent and did not cover that sequence. Match the probe to real
navigation/reload, disable the driver override after the last navigation, establish
actual foreground/editor focus, and retain trusted blur/refocus assertions. Treat
this as a proposed working correction, not a uniquely proven cause of the old failure.

The next fixture also admits the exact existing Native sharing metadata GET for
chat_thread resources, preserving Native authorization and the bounded synthetic
DB. It supplies no fake response and changes no provider or global permission
policy. General Native group branches may lazily initialize local tables; do not
claim every possible path is write-free. Unexpected transport aborts remain failures.

Revision 6 admits at most twelve browser attempts and four builds within the
unchanged 1800 verification seconds. Ten failed attempts remain charged; current
verification use is 388.15092520399776. The 120-second probe budget and all isolation,
resource, request and cleanup limits remain unchanged. Probe 03 must pass the
navigation-matched real-focus sequence before browser 11. Preserve browser 10's
six fixture files and its exact configuration, and the pre-revision ledger.

## Sharing-request cancellation correction

Browser 12 retained the failure assertion and captured passive request evidence.
Independent QA and Verify matched all three canceled reads to Native's query
observer unsubscribe path. The initial creation reads finished normally. During
history restoration, each canceled read has a distinct same-document replacement
that completes with HTTP 200 and verified owner authorization. The exact built
bundle maps the captured stack to caller-signal forwarding, query cancellation,
observer removal and unsubscribe. This corrects the earlier initial-send hypothesis.

Preserve raw failures. The next fixture may classify only this demonstrated
lifecycle when exact request/fetch identity, short bounded ages, the Native abort
stack, a successful same-document replacement and its owner response all agree.
Missing or ambiguous evidence, unrelated failures and unreplaced cancellations
remain fatal. Keep all title, scope, privacy, focus and Workbench assertions.

Revision 7 permits fourteen total browser attempts and four builds within the
unchanged 1800 verification seconds. All twelve failures remain charged;
456.6324903400018 seconds have been used. The 36-entry pre-revision ledger is
preserved with SHA-256
`afbfc8750ae0f05623fe12adf08114221028d36fd5fb315e0bb250055af0cb19`.
Setup, probe, resource, isolation and request limits are unchanged. This is a
reviewed correction under the owner's standing instruction to fix problems and
continue; it grants no new spending, public action or total runtime allocation.
No app/build, backend, provider, permission or scope change is needed.

## Natural shutdown after Native retention

Source review identified the shutdown mismatch in Core 0.176.5. Its run manager
schedules a referenced 300-second timeout for each completed run; the callback
only removes two in-memory cache entries. Handles are not retained and no public
run-cache disposer is exported. The final proof run ends near 30 seconds, so a
300-second outer deadline expires before its cache timer. Do not intercept,
shorten, clear or unref those Native timers to make the proof exit.

Revision 8 permits exactly 360 seconds for the next run within the unchanged 1800-second
verification allocation and existing fourteen-attempt cap. Stop the audit cleanup
job through its public lifecycle function before closing the database, then let
Native's cache timers expire. Success requires actual backend exit code 0 and a
complete ordered runner journal; a supervisor kill remains failure. Preserve
bounded resource-type counts and audit/database cleanup receipts.

The Zo MCP transport has a 300-second call ceiling. Use the reviewed one-shot
`.tmp/05b/dispatch-zo-gui.py` launcher after source QA and Verify. It pins its own,
supervisor, validator, config and manifest hashes, verifies manifest files, and
writes an exclusive durable intent and process-identity receipt. The same
supervisor reserves the existing ledger and enforces resource/deadline/cleanup
limits. Dispatch success is not runtime acceptance; read the authoritative
supervisor and inner receipts. No scheduled job, permanent service, additional
budget, provider call or public action is created.

## Goal

Use DeepSeek to generate titles for conversations inside the Vivary GUI.

## Current execution decision

Zo remains the selected execution environment. The following paragraphs record
the original transfer decision and its historical source checkpoint. Current
runtime acceptance and the still-pending private synchronization are described
in [Accepted result](#accepted-result).

On 2026-09-11, the owner directed moving execution to Zo because the laptop
could not provide adequate resources. The owner confirmed an existing T3 Code
connection, requested more intensive reviews, then requested a handoff with the
work on GitHub first. This supersedes Habitat for the next execution of this
packet. Preserve local evidence and unrelated changes. Publish the reviewed app
source checkpoint to its private GitHub delivery branch, then supply a private handoff
for the Zo/T3 session. No merge, public app deployment, or paid model call is
part of this handoff. The Windows/WSL controller remains historical evidence;
it is not the Zo runner. Keep independent environment, source and runtime review.

After review identified unresolved public redistribution rights in the imported
shell, the owner approved creating `vivary-dev/vivary-workbench-handoff` as a
private repository. The repository was created and its private visibility
verified on 2026-09-11. The public upstream remains unchanged. Sync the exact
delivery commit to Zo and verify the checkout before calling the handoff current.

Source delivery `29f7686ff40acfd00624875bd25ae3c795c67c7c` was pushed to the
private repository and cloned on Zo. The local, GitHub and Zo commit identities
matched, the Zo checkout was clean, and plan/source-navigation checks passed
from its actual files. A portable handoff with verified state, evidence hashes
and next steps is present on Zo. Raw private logs/configuration archives remain
on the laptop after automatic approval review blocked that exact export.
Private scratch is now ignored by repository policy, rather than relying on a
laptop-global ignore. This completed the original source synchronization and
portable handoff. The later accepted build/browser result and current uncommitted
changes supersede that checkpoint.

## Zo execution continuation

On 2026-09-11, after the source handoff, the owner instructed "do it entirely".
This authorizes remaining dependency setup, implementation, build, tests, fixes,
and independent review directly on Zo, followed by the already-authorized
private GitHub synchronization. The earlier no-install constraint belongs to
the closed laptop run; its evidence and consumed time remain unchanged.

The new Zo profile uses a private filesystem and PID/network namespaces,
UID/GID 1000, zero capability sets, no-new-privileges, and four inherited CPU
cores. Verification has loopback-only networking. Installation alone may access
the package registry with a frozen lockfile and lifecycle scripts disabled.
Only task-owned copied inputs and scratch are writable. No credentials are
mounted. Memory and task counts use a 250 ms external observer with stop
thresholds of 8 GiB aggregate RSS and 256 tasks; these are measured thresholds,
not kernel-enforced cgroup limits. A direct allocation probe showed Zo subgroup
cgroup limits did not enforce their configured values, so they are not accepted
as containment proof.

The new allocation is 900 seconds for setup and 1800 seconds for verification,
with at most three reviewed build attempts (600 seconds each). Initial policy
allowed three browser attempts. Budget revision 2 permits five total browser
attempts (300 seconds each), preserving all prior charges and the same 1800-second
verification ceiling. A failed attempt requires a diagnosed cause
and reviewed correction. The supervisor persists cumulative accounting and
permits one heavy job at a time. Preserve every browser acceptance assertion;
navigation may be corrected to match the installed native controls after review.
QA and Verify must independently accept the profile and results before closure.

Budget revision 2 is a reversible proof-method continuation under the owner's
complete-on-Zo and all-issues instructions. Attempts 01–03 stay failed and
charged; the pre-revision ledger is preserved with SHA-256
`e60f27a8c17eaa7057875887b61f9cef53e41d883a8767b0e44bd84dacf18cc8`.
The build cap, setup/probe budgets, isolation, sampling, cleanup and acceptance
assertions are unchanged. Independent review must accept each correction.

Attempt 04 adds bounded observations of history attachment/visibility, chat
access loading, menus and render errors around the menu transition. This tests
whether the history mounts and disappears, the surface remounts, or rendering
fails. The same source and built assets contain the exact history selector.
No product change is justified by the timeout alone. A repeated failure without
new diagnostic evidence cannot consume attempt 05.

Budget revision 3 preserves all five failed browser attempts and the same
1800-second verification ceiling. It allows at most eight total browser attempts;
the build cap stays three. Attempt 05 passed the history opening and reload
assertions with no hydration errors, then exposed a New chat selector that also
matched a tab. The next reviewed correction selects the actual create button.
Only existing same-origin read requests canceled by a successfully completed,
explicit fixture navigation may be classified separately from transport failures.
All title, privacy, persistence and real menu checks remain required. Each
remaining attempt requires a concrete diagnosed correction and independent review.

The dependency audit found seven distinct advisories (four high, three moderate)
and the named local deny-list was unavailable. Those findings remain issues to
resolve in the all-issues goal; restricted acquisition is not release clearance.

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
an organization-qualified app scope and an authenticated account/organization mount gate.
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
those tests for this process correction. Build 04 and browser 15 now pass;
the [receipt](../receipts/05b-deepseek-chat-titles.md#current-result) owns acceptance.

## Log

### Historical progress before browser 15

Updated 2026-09-11. The owner reaffirmed fixing all problems, obtaining review
and continuing automatically. All current coding, builds, tests and fixes run
directly on Zo under the existing all-issues goal.

Pinned setup, SQLite preparation, doctor, build 04 and eight endpoint tests pass.
Browsers 13 and 14 pass the full inner browser checks, including strict cancellation
classification. Both overall runs fail natural shutdown. Browser 14's public audit
stop and database close pass, but a React SSR MessageChannel remains a candidate
exit blocker. Track and close only that exact renderer-owned channel after requests
settle; preserve its allocation evidence, global constructor restoration and public
port-close events. Keep Native's five-minute cache timers unchanged.

Revision 9 retains fourteen failed overall attempts and four builds, allowing one
further browser attempt within the unchanged 1800 verification seconds.
Consumption is 1116.9277641060035 seconds; probe use is 44.14757724199808 of 120.
Use the existing reviewed one-shot dispatcher with a 360-second limit plus five
seconds cleanup after exact source QA, rebinding, read-only preflight and Verify.
All browser, app and build bytes remain frozen; no provider or permission changes.

The tested source is a reviewed working tree. Automatic approval review blocked
commit/push; GitHub remains at the last synchronized checkpoint. A fresh private
synchronization approval is pending while independent Zo verification continues.
See the [receipt](../receipts/05b-deepseek-chat-titles.md) for exact evidence.

### Historical laptop recovery

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
