# 06e addendum: Non-enrolling root availability

Evidence-record: 06e
Owner: Root lifecycle and native provider composition
Status: Approved bounded implementation. Runtime verification in progress.

The [catalog contract](project-catalog.md) needs current availability without
creating identity. The accepted [12d lifecycle](../receipts/12d-root-identity-lifecycle.md)
and [06d provider](../receipts/06d-native-root-registration.md) retain ownership
of durable records and explicit registration enrollment.

## Read contract

`RootIdentityLifecycle.inspect_location(location_ref)` acquires or validates
transient physical custody for a configured locator. It does not allocate an
application UUID, add a saved alias, save a record, or write project files.
The owner's startup writer lock remains part of trusted installation setup.
An availability request creates no metadata, even for a healthy unenrolled root.

The result contains the opaque locator reference, content revision, layout and
an optional application root ID. A null root ID means the root is physically
observable but has no enrolled application identity. A non-null ID requires
continuous custody of its existing record. An alias read may report that known
ID without saving a locator association.

Imported or restarted records, replacement of an enrolled root, uncertain epoch,
metadata changes and incomplete observations remain unavailable. Reads never
reconcile those records. Registration retains the existing `enroll` behavior.

## Private provider protocol

`provider.inspect(locationRef)` sends a bounded `inspect` command through the
existing private stdio owner. It returns one of these shapes:

```json
{"code":"available","locationRef":"location-example","rootId":null,"contentRevision":"opaque-content-revision","version":1,"sequence":1}
```

```json
{"code":"identity-unverified"}
```

Successful reads of enrolled roots contain their application UUID instead of
null. Response framing may retain the verified protocol version and sequence.
These fields remain private transport data. The catalog projects its own strict
public schema and never forwards root IDs or protocol fields to the GUI.

The Node transport binds every reply to its sequence, locator and operation.
An enrollment reply cannot satisfy an inspection request, or the reverse.
Unknown fields, invalid UTF-8, malformed IDs, excessive bytes, timeouts and loss
of the owner remain refusal conditions. `provider.observe` still means the
existing authorized registration enrollment operation.

## Catalog meaning

An available result with no root ID can enable registration for an authorized
configured location. A registered project is available only when a non-null
verified application root ID matches its scoped binding. Native access checks
run before and after asynchronous database and root work.

The catalog never writes a lifecycle record or registration receipt. Neither
availability nor selected project state authorizes a file effect.

## Verification

The focused physical proof checks metadata absence, existing metadata bytes and
timestamps, no UUID allocation, no alias persistence, read-only metadata
permissions, and restart/replacement refusal. Run the original 24 lifecycle
tests to preserve enrollment behavior. Provider tests verify the real Python
wire and reject replies for the wrong operation.
