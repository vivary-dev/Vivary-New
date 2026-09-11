# 06c native registration HTTP receipt

Evidence-record: 06c
Date: 2026-09-07
Verification-kind: runtime
Result: All 10 Windows HTTP tests, independent source/archive review, and bounded cleanup passed.

The [packet](../packets/06c-native-registry-http.md) owns the opt-in raw request
boundary around [06b native actions](06b-native-registry-actions.md) and the
accepted [06a SQLite store](06a-native-registry-storage.md).

## Native mount and request validation

`mountRegistryHttp` uses public `getH3App` middleware and `mountActionRoutes`
at the native registration action path. The existing registration entry gains
POST metadata only in this explicit composition. Export stays internal; agent,
MCP, extension, and public-agent exposure remain disabled.

The guard requires the exact action path, POST, JSON, and uncompressed content.
It bounds the declared length and actual streamed bytes to 8,192, decodes UTF-8
strictly, applies the existing strict JSON parser, and validates with the same
action schema before native body parsing. It reads a clone so native dispatch
can still read the original request. Overflow cancels the clone without waiting
for the other tee branch. Refusals return an explicit, non-cacheable response.

That response matters in the inspected Core version. Its request bridge can
classify thrown errors as client disconnects when the Node request is already
marked destroyed after a normal body read. The first suite reproduced a
duplicate-key request falling through to registration. The final app boundary
returns refusal responses directly; it does not patch the native bridge. The
archive preserves the failed suite and original throwing guard beside the fix.

Trusted application composition must supply native owner and organization
resolvers, authorization, current registry facts, and ID allocation. Caller body
fields cannot supply those values. Native dispatch retains authentication,
authorization, output validation, private audit, and atomic operation replay.

## Windows runtime proof

All 10 tests passed with zero skips, cancellations, or failures in 51.496 seconds.
Each scenario runs a real loopback Node HTTP listener on an ephemeral port,
Core's public mount on a fresh H3 instance, native action dispatch, and disposable
file-backed SQLite. Test callbacks use synthetic identities and a synthetic
token. They do not configure an actual account or authentication provider.

```console
node --test packages/workbench/tests/registry-http.test.mjs
```

| Case | Observed result |
| --- | --- |
| Registration and replay | HTTP success, trusted context, private native audit, one atomic receipt, no replay allocation |
| Duplicate JSON keys | Plain, escaped, and nested duplicates return 400 before auth or storage |
| Request types and authority | Numeric strings and caller-supplied authority return 400 before callbacks |
| Encoding and syntax | Invalid UTF-8, unpaired Unicode, BOM, and malformed JSON return 400 |
| Declared size | Length over 8,192 returns 413 |
| Actual streamed size | Chunked overflow returns 413 within the request deadline, without hanging |
| Method and media | PUT/GET return 405; unsupported type or content encoding returns 415 |
| Native authentication and authorization | Missing authentication returns observed native 404; denied authorization returns 403; neither reaches storage |
| Mount boundary | Suffixes, encoded suffixes, neighboring routes, and unmounted export return 404 |
| Application base | Base-prefixed and root action mounts both reject duplicates and preserve registration/replay |

Malformed raw requests assert zero authorization, fact-resolution, or allocation
calls and empty registry tables. Workers use a minimal environment, a 45-second
process deadline, and 10-second request deadlines. Listeners close before native
database shutdown; the parent waits for worker exit before deleting each test
database tree. Natural process exit avoids a reproduced Windows native-handle
shutdown assertion caused by forced exit after successful requests.

Runtime capture records Windows x64, Node 24.19.0, Core 0.176.5, H3 2.0.1-rc.31,
Zod 4.5.4, Drizzle 0.45.2, better-sqlite3 12.11.1, and SQLite 3.53.2, with native
source and dependency hashes. Workers disable unrelated default plugin startup
only in their private process configuration. No dependency installation, model
call, new checkout, hosted listener, or Habitat file was needed.

The proof uses a Nitro-shaped object holding a real H3 instance. It does not
claim an installed or built Nitro application, browser integration, production
authentication, durable physical-root identity, or Linux native-driver support.
Missing authentication safely refuses access, but a 401 response remains
unproved because the inspected native bridge returns 404 in this case.

## Evidence and review

The HTTP module hash is `2732e42f4fe5c42d29e08c9196a85d48351b90350d85b7ca7439938e6de001ec`; the test hash is `62008e42a43fcc372a3cf3e5f7a03e0852979a8640b7d1609120b029118288c4`.
The lead independently reviewed the middleware and real HTTP test setup and
found no blocking issue within this scope. The lead independently checked all
20 payload hashes and sizes, all 14 current canonical source matches, and the
retained final 10-test runtime log before accepting the export.

The private archive contains 21 entries and 49,734 bytes, SHA-256
`05a36551d59b10a8c88c1b218b9df7218615515b4f3b9e694bbfdfee5bbd35af`.
Its manifest covers 14 frozen canonical code/fixture files, runtime environment,
accepted and failed suite logs, the original throwing guard, and export helpers.
Package and README files are excluded from this byte gate because concurrent
05a shell composition owns their continuing build changes.

Cleanup then rechecked the exact target and archive hash, rejected unexpected
files and reparse points, and removed only the owned staging tree: seven files,
36,261 bytes, and three directories. The target was verified absent. The final
archive, sidecar, logs, and cleanup receipt stay private; no Habitat cleanup was
needed. Source navigation, tracked line endings, and diff checks are recorded
with the graph writer's final common planning verification.

Outcome 06 remains in progress for trusted policy/root composition, configured
application and GUI registration, project switching, and deployment verification.
