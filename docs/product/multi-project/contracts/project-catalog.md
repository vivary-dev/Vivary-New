# Project catalog and selection contract

Version: 1
Owner: Workbench project application services, packet 06e
Status: approved implementation scope, verification pending

The [registry contract](project-registry.md) owns identity, registration,
idempotency, export, and mutation. This contract adds a read model for selecting
an authorized project. It creates no identity, authority, or execution binding.

## C1: One authority owner

Use the current native session, organization membership, and explicitly assigned
Workbench `project-registrar` role through the 06d access resolver. An organization
owner without that app role is denied. This role permits the bounded registration
catalog for its installed collection. It does not imply portable export, file
mutation, or model execution. The client supplies no actor, collection, device,
root identity, policy, or capability fields.

Read the trusted scope before and after asynchronous database/root work. Refuse
the whole response if the native grant is removed or its scope changes. A missing
configured owner is unavailable. A missing or invalid session is unauthorized.
Do not preserve a cached success response through either condition.

## C2: Scoped projection

The catalog request is an empty object. Query project bindings by the current
actor, collection, and device together. Include only bindings whose location
reference remains in the current trusted grant. Join portable records only from
those selected bindings. Never read an arbitrary client project ID and project
its record before checking that binding scope.

Return the collection/device registry revision needed by the existing registration
precondition and the current policy revision. These are concurrency tokens, not
claims that every collection record is visible to the caller.

The response may contain only:

- Authorized configured locations: opaque location reference, trusted display
  label, and observed availability.
- Authorized registered projects: project ID, user-authored display name,
  binding revision, and observed availability.
- The current policy/registry revisions and an opaque selection-scope key that
  changes with the actor, collection, device, or policy revision.

Do not return physical paths, native account identifiers, root IDs, credentials,
private custody handles, foreign project labels/counts, receipt contents,
repository administration, or file contents. The trusted installation supplies
the configured-location labels. Labels do not choose or resolve a filesystem path.
Portable export retains its independent capability and action.

## C3: Actual availability

An available location requires a successful current non-enrolling inspection from
the trusted root provider under the [read-only availability contract](root-availability-read.md).
It creates no UUID, identity record, alias, receipt, or project file. An unenrolled
healthy location can be offered for registration. Process readiness alone does not establish root custody. A project
is available only when its scoped binding matches that observed root identity.
Lost custody, root replacement, missing roots, or provider failure leave an
authorized record unavailable. A revoked location grant removes it from the
projection altogether. No result authorizes reading or changing project files.

## C4: Registration and recovery

The form submits the existing registration schema and action. It accepts a
display name and one of the returned location references. It cannot submit a
raw filesystem path. All existing registration fields and policy/registry
preconditions retain their current meaning.

Generate one operation ID for one immutable registration attempt. Preserve it
and its original request through an uncertain transport result so a retry uses
the same idempotency key. A changed name/location or an explicitly fresh attempt
gets a new operation ID. A definitive stale/retry result requires a refreshed
catalog and a new attempt. Do not silently edit an old request's preconditions.
Registration, duplicate registration, and replay use the existing store/oracle.
Do not write project files, initialize VCS, or create a runtime during registration.

## C5: Selection and native conversation scope

Selected project IDs are references in native application state, never authority.
Resolve the selected ID against each current catalog. Clear the active project
and its conversation scope when it disappears, becomes unavailable, or the
catalog cannot verify current access. Ignore stale selection reads or responses
from an older selection scope.

For this inert stage, both conversation routes show the existing 04b **Run
activity** projection through Native's stateless `AgentConversation`. The activity
response supplies the exact verified Native thread ID and scope. It does so only
after the final authority, reference, Native identity, root and binding checks.
The scope type is `vivary-project-runtime-v1`. Its ID is the existing binding
identity digest owned by 04b, 04c and 04d. Neither this response identity nor a
selected project ID grants access.

Key the renderer by that exact thread and scope, including the reference revision
and run when either changes. Refuse responses that do not match the current
catalog claim. Clear the display during a selection or access check and ignore
late results from an older claim. Both routes retain one shared ProjectContext.
Do not discover other threads, copy transcripts, create another thread/session
store, or infer runtime availability from registration. No composer is mounted.

This proves selection-bound Run activity isolation, not complete conversation
history or Core's `isolateHistoryByScope` behavior. Full conversation fidelity and
production runtime composition remain with outcome 04 and the Native owners.

Verified 2026-09-09 against installed Core 0.176.5 public exports and source:
`AgentConversation` renders only supplied messages. `AssistantChat` imports a
sessionStorage snapshot keyed by API URL and thread ID before its custom history
loader completes. Scope is absent from that key, and a cached larger repository
can prevent a smaller current projection from replacing it. No public prop
disables that cache or reports authoritative restore completion. This corrects
the earlier C5 component assumption. It does not claim that setting
`composerDisabled` or `isolateHistoryByScope` resolves the cache behavior.

## C6: Native data and transport

Expose reads through a native GET action and writes through the existing native
registration action. UI uses `useActionQuery` and `useActionMutation`. Keep
native authorization, strict output validation, private audit, and current grant
checks in the action path. Do not add a duplicate CRUD API or accept authority
from browser session fixtures.

## C7: Evidence

Use two configured physical roots, actual scoped native membership/app roles,
the real custody provider, and actual registry SQLite persistence in Habitat.
Prove registration/replay/duplicate, scoped catalog isolation, project switching,
revocation during reads, lost custody, and root replacement. Browser proof must
exercise actual action responses and label any synthetic test login clearly.
No fixture establishes production authentication, connected model behavior,
file write-back, or release readiness.
