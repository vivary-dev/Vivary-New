---
type: packet
---
# 04a: Show current runtime readiness for the selected project

Parent: 04
Status: done
Depends-on: [03c, 05a, 06d]
Owner: Sol runtime_readiness_writer owns the action, schema, Conversation consumer and focused fixtures; GPT-6 lead owns dispatch, acceptance and evidence.
Scope: Authorized read-only readiness observations through a Native action. No runtime instantiation, session store, conversation hydration or run controls.
Verification-kind: runtime
Verification-result: passed
Evidence: [04a runtime receipt](../receipts/04a-project-runtime-readiness.md)
Timebox: One consumed readiness contract, Native action/database and component proof, independent review and cleanup.

## Goal

Replace the selected project's unconditional runtime message with current,
authorized blockers while keeping conversation execution unavailable.

## Context

Read outcome 04, native-owners.md, the native-runtime source-map module,
project-catalog.mjs, native-registry.mjs, ProjectContext.tsx and Conversation.tsx.
The current catalog/selection consumer exists under 06e; its broader scoped-chat
acceptance remains open. This packet does not depend on enabling that chat seam.

Installed Core 0.176.5 publicly exports harness inventory reads, including
listAgentHarnesses, getAgentHarnessEntry and isAgentHarnessPackageInstalled.
Verify exact installed exports and types before using them. Package presence is
resolved relative to Core and cached for that process; it is not a CLI, login or
execution-location probe. Declared sandbox/resumable/approvals/hostTools/fileEvents
capabilities are not proven role/tool enforcement. Workbench has harness: false.
Registry visibility/register-project authority does not authorize a run.

## Owned files

New files: packages/workbench/server/project-runtime-readiness.mjs,
packages/workbench/app/lib/runtime-readiness-schema.ts,
packages/workbench/tests/project-runtime-readiness.test.mjs and
packages/workbench/tests/runtime-readiness-component.test.mjs.

Modify only the existing Conversation.tsx consumer and, if the actual installed
public harness import requires it, the smallest test-only addition to
tests/native-http-dependency-loader.mjs. Propose other required files to the lead.
Leave ProjectContext, catalog, Native auth, registration, creation, root provider,
database schemas, package dependencies, agent config and styles unchanged.
Another writer is implementing the private creation bridge; do not edit its files.
Read the workspace TypeScript guidance before editing typed files. Preserve the
existing semantic layout and layout-matching Skeleton behavior.

## Read contract and action

Use a strict schema-derived request/result contract. Browser fields are expected
claims only: projectId, expected binding and policy revisions, and the current
opaque catalog scope key. The existing catalog exposes those values. Never accept
actor, organization, root/path, credentials, runtime configuration or authority
flags from the browser. Bind the query to all claims so cached/delayed results
cannot cross a project or authorization change.

After current Native readScope authorization, resolve only this actor's authorized
collection/device/project bindings and granted location references. Inspect current
roots through the existing trusted provider. Recheck Native scope and registry
revision/binding facts across asynchronous reads. Refuse stale, inaccessible or
ambiguous binding claims; the catalog's available-project projection does not
choose one trusted execution binding. Never select an arbitrary matching root.

The ephemeral result distinguishes installed, configured, authenticated, bound,
runnable and verified with explicit unavailable/unknown states and concise blocker
codes. Evidence must match the current actor/project/root/runtime/execution-location
and policy binding before supporting a stronger state. Keep package declarations,
trusted configuration, authentication observations and accepted runtime proof
separate. Missing evidence cannot become false success through a default or a
capability declaration. This read observation never grants execution authority.

Use trusted installation configuration and injected read-only evidence resolvers;
their production defaults remain unconfigured/unknown. Do not add a readiness,
session, run, transcript or lifecycle table. Do not turn planned 20a evidence into
configured product behavior. Preserve native response/compaction defaults.

Export a Native defineAction and mount function following project-catalog.mjs.
Use the actual authenticated Native GET action transport, a strict path/method/query
boundary, appId workbench, delegated callers disabled and no agent/MCP tool exposure.
Do not add a duplicate JSON endpoint or partial production plugin. Current app
composition has no configured non-test catalog/runtime mount; prove the mount in
the controlled composition and preserve action-unavailable behavior in the app.
Do not claim production readiness until that separate composition is configured.

At trusted construction, inventory registration may happen once if required by
the public API. The read-only action must not register adapters or mutate registry
state per request. Never instantiate adapters, create sessions, start/stop/resume
runs, probe paid endpoints or read credential values. Return no binding/root/path,
email, package-path, session or secret payload beyond the selected safe claims.

## Consumer

Conversation uses the Native action hook with the current project and catalog
claims. Clear/hide stale output while access or the new selection is being checked;
validate the response boundary and render only a matching current result. A missing
mount, revoked access or malformed response displays an honest readiness failure.
Use plain blockers and existing panel/Skeleton geometry. Do not add chat hydration,
an input box, model selector, start button, fake capability status or inline AI.

## Done condition

Exercise the actual Core 0.176.5 database and authenticated Native action transport
in existing Habitat with labeled synthetic root/runtime evidence. Prove unauthorized,
stale-scope/revision and ambiguous binding requests refuse; authority changes during
await cannot disclose another scope; missing evidence remains unknown; declared
capabilities alone never yield runnable/verified; malformed queries and alternate
methods/suffixes fail. A registered fixture whose adapter constructor throws can
prove that inventory does not instantiate a runtime. Prove no run/session state is
created, and preserve existing registry data across reads.

Drive the real React/React Query consumer with controlled Native hook boundaries
for selection changes, delayed old results, revocation, malformed responses and
unavailable action transport. Keep that evidence distinct from a browser or native
history proof. Run the existing Workbench typecheck/build when resource headroom
allows; checkpoint accepted partial proof without claiming the unfinished checks.

Freeze exact source/dependency hashes, test count, child limits, fixture scope and
cleanup before the lead dispatches the single runtime lane. Export full logs,
independently review the final archive, remove contained temporary resources and
update the graph, source router and existing handoff.

## Verify

Use existing dependencies and the packet's exact reviewed Habitat runner. Source
work may continue while builds are deferred for the owner's gaming headroom.

```console
node --test --test-concurrency=1 packages/workbench/tests/project-runtime-readiness.test.mjs
node --test --test-concurrency=1 packages/workbench/tests/runtime-readiness-component.test.mjs
python scripts/check_multi_project_plan.py --check
python scripts/check-source-navigation.py --check
git diff --check
```

## Stop conditions

No model calls, runtime/session lifecycle, user-project effects, credential copying,
account/spending changes, production configuration or publication. No alternate
transcript, run owner or private Native chat-context patches. Outcome 04's actual
adapter enforcement, cancellation/resume and cross-runtime parity remain open.

## Log

- 2026-09-07: Prepared from independent Astra contract analysis and Sol's concrete
  consumer/mount inventory. The lead retained expected catalog revisions/scope in
  the request and the unconfigured production mount boundary. No runtime ran.
- 2026-09-07: Independent Astra review accepted dispatch. The named Sol writer
  owns source only; the lead freezes and dispatches the single runtime lane.

- 2026-09-07: Independent source review withheld acceptance. The correction
  must finish root and evidence callbacks before the final registry
  comparison and Native authorization check. Readiness describes checked
  observations, not an atomic filesystem/database snapshot or a run grant.
  The proof must declare existing test dependency coordinates, account for
  the esbuild service, and expose all successful child checks and cleanup.
  No source acceptance, proof execution or production activation is claimed.

- 2026-09-07: Corrected source passed independent Astra review and the six
  files were applied to the existing canonical checkout with nine frozen
  local dependencies. Eleven Native action cases and five component cases
  remain unexecuted. Native transport and Windows component proof drivers
  are in preparation. The separate Windows supervisor self-test observed
  normal drain and termination of an exact descendant after its parent
  exited, with zero active job processes afterward. That small supervisor
  check is not evidence that readiness or its consumer works.

- 2026-09-07: Accepted 11 Native action cases and five real React/Query cases, independent source/evidence review and exact cleanup. The receipt preserves both failed UI attempts and the fixture correction. Full build/typecheck and browser acceptance remain deferred. Continue 04b.
