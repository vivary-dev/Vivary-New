---
type: packet
---
# 04b: Read Native run activity for an exact project binding

Parent: 04
Status: done
Depends-on: [04a]
Owner: Sol runtime_readiness_writer owns the activity action, schema, Conversation consumer and focused fixtures. Astra lead owns dispatch, acceptance, evidence and canonical records.
Scope: An authenticated Native run-activity action and controlled renderer with trusted fixture composition. Production remains unconfigured.
Verification-kind: runtime
Verification-result: passed
Evidence: [04b runtime receipt](../receipts/04b-project-native-activity.md)
Timebox: One exact-reference contract, two focused suites, independent evidence review, and exact cleanup.

## Goal

Show Native run activity only when current project authority resolves one exact
Native thread, session, and run. Preserve Native ownership of those records.
Label the display **Run activity**. This packet does not provide complete
conversation history, user prompts, or original per-event timestamps.

## Context

Read 04a, 06e, native-owners.md, the native-runtime source map, and the existing
catalog and readiness contracts. Use installed Core 0.176.5 public exports.
Confirm the required signatures before implementation without reopening these
settled architecture choices.

Use `getThread`, `getAgentHarnessSession`, `getAgentHarnessBackgroundRun`, and
`listAgentHarnessBackgroundTranscriptEvents` for exact Native reads. Supply
explicit trusted owner and organization wherever the API accepts them.
Independently validate returned identities even when a helper filters them.

`getThread` does not authorize its caller. `listThreads` can return owned threads,
explicit user or organization shares, and threads with matching-organization
visibility. Bare public visibility alone is not the established access rule.
List summaries omit the owner and exclude empty threads. They cannot establish
this packet's exact association.

`listAgentHarnessSessions` applies its SQL owner limit before in-memory thread
and organization filtering. It cannot establish uniqueness here. Do not use
latest-session selection, list discovery, or workspace-path matching.

Native start records thread, run, owner, organization, and opaque resume state.
It does not establish a Vivary project association, create the corresponding
chat thread, or enforce an optional workspace reference. Mutable metadata and
thread scope are comparison inputs only. Neither provides provenance or authority.

The public transcript helper reads all run events after sequence zero without a
row or byte limit. Its projection omits user prompts and uses the session update
time for projected timestamps. A bounded response does not bound that database
read. The fixture acceptance boundary below addresses this concrete limitation.

## Owned files

Create these canonical Workbench files after the lead dispatches implementation:

- `packages/workbench/server/project-runtime-activity.mjs`
- `packages/workbench/app/lib/runtime-activity-schema.ts`
- `packages/workbench/tests/project-runtime-activity.test.mjs`
- `packages/workbench/tests/runtime-activity-component.test.mjs`

Modify `packages/workbench/app/components/workbench/Conversation.tsx` to consume
activity while preserving 04a readiness. If public imports require it, make the
smallest test-only change to
`packages/workbench/tests/native-http-dependency-loader.mjs`.

The lead owns the packet, receipt, source map, graph, and handoff. Record the
reference contract in the existing native-runtime source-map owner.

Leave ProjectContext, catalog, Native authorization, registration, creation,
root providers, database schemas, dependencies, configuration, and styles unchanged.
Propose demonstrated required seam corrections to their owners before editing
outside this list. You are not alone. Preserve others' edits and obtain exclusive
ownership of Conversation before changing it.

## Exact reference contract

Inject a trusted `resolveReference` callback at service construction. Its default
returns unconfigured before any Native thread, session, run, or event read.
Use a fixture-only configured resolver. Add no reference table, adoption action,
lookup fallback, or production plugin.

The resolver receives the current server-authorized binding identity and returns
one strict reference or unavailable. Its exact fields are:

- `schemaVersion`, fixed to `1`
- `referenceRevision`, a positive safe integer
- `bindingIdentityDigest`, a SHA-256 digest of the canonical identity below
- `nativeThreadId`, `nativeSessionId`, `nativeRunId`, and `harnessName`

Reject extra fields, malformed values, multiple references, and mismatched
digests. Native IDs never come from browser query values. Missing records or
changed associations refuse. They never authorize adoption, repair, creation,
or selection of another record.

Canonical identity includes the authenticated Native owner and organization,
actor, collection, device, project, exact binding ID and revision, observed root
identity, execution-location reference, policy revision, harness identity, and
runtime configuration revision. Specify stable field order and encoding in the
owning contract. A digest identifies this tuple. It does not authorize it.

The fixture uses Native thread scope type `vivary-project-runtime-v1` and scope
ID equal to that digest. Verify both against the trusted reference. Custom scope
does not inherit Native's special `workspace-app` or `desktop-app` write guard.
Mutable scope must never let a caller associate an arbitrary run with a project.

Verify the exact thread owner, organization, ID, and scope. Verify the exact
session owner, organization, thread, session ID, run ID, and harness. Verify the
background run identifies that same session and run. Reject absent identity
fields or inconsistent records. Exclude opaque resume state, workspace paths,
emails, credentials, and internal Native metadata from the browser payload.

## Action and consistency boundary

Export a Native `defineAction` and mount function following
`project-runtime-readiness.mjs`. Name it `vivary-project-runtime-activity`.
Use app ID `workbench`, strict output validation, GET only, delegated callers
disabled, and no agent or MCP tool exposure. Reject extra or duplicate query
keys, alternate methods, and path suffixes. Add no duplicate JSON route.

Accept only 04a's expected catalog claims: `projectId`,
`expectedBindingRevision`, `expectedPolicyRevision`, and `scopeKey`.
The server resolves owner, organization, roots, runtime, and Native references.
The query key includes every request claim.

Authorize through existing Native `readScope`, load the registry binding, inspect
its root, and resolve the reference before reading activity. Refuse inaccessible,
unavailable, stale, or ambiguous bindings. Registration authority alone does not
establish Native run provenance.

After awaited Native reads, re-read exact Native identities and the trusted
reference. Reinspect the root and compare all identity fields and revisions.
Finish these callbacks before the final registry comparison and Native scope
authorization. On mismatch or revocation, discard activity. Do not await another
resolver or Native read after that final authorization.

This proves checked observations across the read interval. It does not establish
an atomic filesystem, registry, and Native snapshot or prevent revocation after
the final check. The fixture freezes event writers except during explicit
mutation tests. A returned projection does not promise the run cannot append
another event.

## Bounded fixture acceptance and open integration gap

Use the installed all-events helper only inside the reviewed synthetic proof.
Each fixture run contains at most 256 stored events and 512 KiB of encoded event
payloads. Seed through existing Native fixture APIs and verify totals before
dispatching the read. Freeze event writers during normal reads. Reject an
over-budget fixture before calling the helper.

Return at most 128 normalized activity items and 256 KiB of UTF-8 JSON for the
complete successful action response. Bound each projected item's encoded payload
to 8 KiB. Count actual serialized bytes, including envelope overhead. If any cap
is exceeded, return a small `activity-too-large` refusal with no activity items.
Do not clip text or split tool-call/result pairs to force success.

These response checks occur after the helper materializes events. They protect
the outgoing response only. Request deadlines, process memory limits, and
`Promise.race` do not establish database cancellation or bounded database reads.

Production remains unconfigured. The controlled mount exists only in the reviewed
fixture composition. Do not add a production mount or request-selectable fixture
flag. Fixture seeding is test-only and never creates real runtime sessions.

Keep one concrete integration gap open: Native needs a public authenticated
event-read contract with enforced row and byte budgets, an explicit sequence
cursor, overflow behavior, and documented cancellation or resource ownership.
A later production packet must verify that contract before enabling arbitrary
live-run reads. Do not patch Native internals, read private Native tables from
product code, or add a second transcript store to close the gap.

04b acceptance requires proof of the capped synthetic dataset and response
refusals. It does not require solving this upstream production integration gap.

## Controlled consumer

Use public `normalizeCodeAgentTranscriptForConversation` and `AgentConversation`
from installed Core. Verify supported import and render shapes before adapting
Conversation. Do not assume the separate `@agent-native/code-agents-ui` package
is installed.

Define a strict safe activity projection containing only fields required by the
normalizer. Test text and tool events without forwarding whole session/run
objects. Preserve Native semantics. Do not fabricate user turns or display the
projected timestamps as original event times.

Render supplied messages with loading and error state. Omit the composer and all
follow-up or lifecycle controls. Hide old activity immediately when selection,
claims, or access changes. Earlier query responses must never render for a new
selection. Validate result claims and projection before rendering.

Preserve 04a readiness and layout-matching Skeleton behavior. Missing action
transport, absent reference, oversize activity, and malformed responses each show
an honest unavailable state. Do not poll, invoke a model, or start a run.

## Done condition

Use actual Core 0.176.5 SQL session/run/event reads and authenticated Native GET
action transport in existing Habitat. Use two synthetic projects, separate
fixture roots, explicit synthetic identities, and existing dependencies.
Snapshot Native and registry state before and after reads.

The service suite must demonstrate:

- An exact reference yields only its run's text and tool activity without Native
  record mutation or project registration.
- Same-owner different-project records cannot substitute. Different owner,
  organization, thread, session, run, harness, or scope refuses.
- Missing, multiple, malformed, stale-revision, or wrong-digest references refuse.
  Mutable metadata and actor-owned discovery never establish provenance.
- Registry, policy, root, runtime configuration, reference, or Native identity
  changes during awaited reads discard results. Final revocation discloses nothing.
- Unconfigured composition performs zero Native activity reads. Strict transport
  rejects delegated callers, malformed claims, duplicate keys, methods, and suffixes.
- Dataset caps are checked before the all-events read. Item count, per-item bytes,
  and total response bytes each refuse without partial items. Test boundary values.
- Reads create no session, run, thread, event, or project reference. They invoke
  no adapter constructor, credential resolver, lifecycle method, or model provider.

The component suite uses real React and React Query with controlled Native hook
boundaries and the installed public renderer. Demonstrate selection changes,
late old results, revocation, malformed payloads, unavailable action transport,
oversize refusal, and Native text/tool rendering. Assert that no composer or
run-control element is available. This is component proof, not browser proof.

Freeze the declared test count after source review and before runtime dispatch.
Run the two focused suites serially. Cap each suite at 120 seconds, each supervised
Node child's old-space at 192 MiB, and each captured output stream at 1 MiB.
Account for the test launcher, Node test isolation, database worker, component
bundler service, and outer supervisor. Freeze the actual process ceiling from the
reviewed runner. Do not call a Node heap cap an aggregate RSS limit.
Stop on output overflow, deadline, or uncertain process cleanup.

Run Workbench typecheck/build through existing scripts as a separate serial step
when the lead's resource preflight permits. Record unfinished build or browser
checks explicitly. Preserve 06e's open browser gates. The lead dispatches the sole
runtime lane and records toolchains, source/dependency hashes, process limits,
logs, state comparisons, and cleanup evidence.

Independently inspect evidence bytes before removing exact task-owned proof
resources. Retain one private verified archive. Update canonical status only for
the accepted bounded activity proof.

## Verify

The lead freezes the actual Native loader environment and component dependency
manifest before these commands. Run each through the reviewed bounded supervisor;
the commands below name the real suite entrypoints, not permission to bypass it.

```console
node --test packages/workbench/tests/project-runtime-activity.test.mjs
node --test packages/workbench/tests/runtime-activity-component.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Stop conditions

No model calls, credentials, real runtime sessions, account or spending changes,
user-project effects, Native record adoption, new dependencies, production mount,
publication, push, or merge. Do not alter root-provider or creation files.

Outcome 04's start, stream, cancellation, resume, role enforcement, complete
conversation history, and cross-runtime parity remain open. The next lifecycle
packet owns trusted reference creation and lifecycle authority. The bounded
Native event-read integration gap remains open until its public API and
production composition have evidence.

## Log

- 2026-09-07: Lead accepted the independently prepared bounded activity contract and claimed one Sol writer after 04a acceptance. Production remains unconfigured; full-history fidelity and the public bounded event-read seam remain open. No runtime has run for 04b.

- 2026-09-08: Applied the reviewed six-file source freeze, then ran the first Native proof under a 768 MiB cgroup cap, zero swap, and one-core CPU limit. It timed out at 90 seconds with a 242765824-byte aggregate cgroup peak and no OOM event. The 35-second direct-worker diagnostic passed the first four named cases and exposed a fixture counter error at the registry-race check. Source inspection also found Core's five-minute in-memory run-retention timers keeping the worker alive. Both owned services collected; all owned process groups were absent. Preserved exact failed sources, logs, databases, and cleanup evidence under the private `04b/native-failed-01` record, then removed only the verified fixture stage. The fixture correction and full Native/component rerun remain pending; this packet is not complete.

### 2026-09-08 bounded proof checkpoint

Eight Native cases passed in 9.803 seconds under a reduced 512 MiB aggregate cgroup cap, zero swap and one core. Peak memory was 236613632 bytes; all 14 synthetic runs finalized and their retention timers cleared. The worker exited naturally, owned groups were absent and the exact Habitat stage was removed. Product sources are unchanged across the later component fixture corrections.

Component attempts remain failed evidence. Releasing esbuild before import and replacing the data URL with an exact temporary module removed the observed memory failures; the latest attempt peaked at 534564864 bytes under the 768 MiB Windows job cap and exited naturally with zero job processes. It exposed missing browser location state in LinkeDOM. The temporary module directory is absent. The six cases remain unaccepted.

The reviewed Windows supervisor enforces 60 seconds, 768 MiB aggregate commit, four active processes and 10 percent CPU. Node heaps remain 192 MiB. Its combined capture bound is 4 MiB to accommodate the physical bundle-input evidence; this supersedes the earlier 1 MiB stream instruction for this component proof only. The Python parent has a conservative 128 MiB allowance outside the job. Each dispatch additionally reserves 1536 MiB of available host memory. Native capture and its separate fixture limits are unchanged.

- 2026-09-08: Accepted the corrected eight Native and six component cases after independent source/archive review. Full-row witnesses and semantic byte refusals close both P2 findings. Exact process and duplicate cleanup is complete. Production and full build/browser gates remain open; the receipt owns final evidence.

- 2026-09-08: Corrected the final Native runner description to its observed 90-second test deadline and enforced 2 MiB combined stdout/stderr ceiling. Each actual stream was below 1 MiB. Independent review confirmed the unchanged evidence remains accepted; no runtime rerun or archive mutation was needed.
