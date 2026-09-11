# 06d receipt: Native registration with live physical custody

Evidence-record: 06d

Status: Complete. Runtime proof, independent source/execution/archive review, and exact cleanup passed.

## Result

Six focused groups passed on the existing Linux Habitat runtime with no skips.
Real native legacy session records, organization membership and assigned app
roles fed the native HTTP action, existing registry transaction engine and SQLite.
Two physical no-VCS roots produced distinct durable application root IDs. Their
files remained byte-identical, with no added project metadata.

The private stdio provider composes the [12d lifecycle](12d-root-identity-lifecycle.md).
Its isolated Python interpreter holds custody for its lifetime. Trusted app
configuration fixes the executable, complete locator inventory and private state
path. Protocol requests carry locator references only.

The transport bounds messages, validates responses, checks sequence and UTF-8,
and enforces deadlines. Unexpected output or owner exit closes it. It does not
restart the owner or cache verification.

## Native authority and persistence

The app's explicit `project-registrar` role overlays existing native organization
membership. Organization ownership alone grants no registration permission.
The installation grant fixes collection, device, policy revision and location
references. It creates no second member roster.

Actor IDs derive from the native
organization and normalized authenticated email, matching native membership's
identity convention. The app's registry actor field contains no email.

Native HTTP authenticates each request once. Every resolver reads current native
membership and app role again before and after custody work. This does not prove
immediate session revocation inside an already running HTTP request.

Only application UUIDs enter registry bindings. The existing native actions,
strict JSON parser, decision engine, SQL transaction and replay receipts remain
the owners.

This unit adds no duplicate CRUD route, network service, queue, transcript store
or auth system. The registration mount stays absent without configuration.
Provider readiness means process availability. Every operation still checks roots.

## Executed proof

- Registration of two physical roots through actual native session resolution,
  native organization lookup, assigned app capability, HTTP action and SQLite.

- Replay preserves the stored result. Duplicate root registration returns the
  existing project. Distinct roots keep distinct application IDs.

- Removing app capability during observation, removing membership while an app
  assignment remains, and revoking capability before dispatch prevent changes.

- Replacing a root or restarting the custody owner returns identity-unverified
  without changing projects, bindings, receipts or revisions.

- Duplicate wire fields, wrong sequence, caller-supplied path, boolean sequence,
  excessive bytes, invalid UTF-8, unexpected stderr, wrong locator and stalled
  subprocesses fail closed. Simultaneous calls cannot consume each other's reply.

- An unverified Git inventory blocks sibling roots. A first test incorrectly
  expected the sibling to remain available. The corrected assertion follows the
  existing complete-inventory rule. No service change weakened that behavior.

The final suite took 6.431 seconds: six passed, zero failed, cancelled or skipped.
Earlier launch checks located the existing Node and Python executables before the
minimal environment could run them. No dependency or runtime was installed.

## Limits

This proof uses synthetic local native legacy sessions and native member/role
rows. It does not configure production authentication or create a real account.

The optional Better Auth tables are absent in that fixture. The log retains
native email-check warnings and the failed Better Auth fallback on the revoked
session. The known native exception adapter returns 404 for that unauthenticated
request. It does not dispatch registration or change SQL records.

No durable Git administration identity, automatic restart reconciliation, project
mutation, GUI catalog or switching behavior is claimed. The app shell and catalog
work continues through 05a and the dependent GUI packet.

## Review and cleanup

The lead reviewed source without a blocking finding, replayed all six groups in
6.791 seconds, and verified every archive payload and canonical source. Native
doctor passed all ten guards.

Exact cleanup removed 47 files totaling 1,617,878 bytes across 14 Habitat
directories, then 12 Windows staging files totaling 49,658 bytes. Both targets
are absent. The archive, independent replay log and review/cleanup receipts remain.

The verified 63-entry archive contains 50 sources, native environment, focused
test logs and reviewed proof helpers. Its SHA-256 is
`ddd6d6cd56dc2c16949c88920c8d8b22a13fcabb8b41d5acbc0c246c521f46d4`.
The archive excludes the disposable session database and physical fixture
contents. Cleanup preserves native dependencies and the existing checkout.
