# 06b internal native registry action receipt

Evidence-record: 06b
Date: 2026-09-07
Verification-kind: runtime
Result: All 12 Windows native action tests, independent source/archive review, and bounded cleanup passed.

The [packet](../packets/06b-native-registry-actions.md) owns this internal native
action composition. It uses the accepted [06a store](06a-native-registry-storage.md).
The store, registry decision engine, and native packages remain unchanged.

## Native application boundary

`createRegistryActions` constructs register and portable-export entries with
Core's `defineAction`. Trusted application code supplies authorization, current
facts, ID allocation, and the existing evaluator. The action returns only the
decision's public output; effects and private record changes stay inside storage.

Native action code coerces top-level numeric strings before schema validation.
The registry's R1 forbids that coercion. An app-owned entry first validates with
the exact schema passed into `defineAction`, then calls the native entry's `run`.
It changes no native source or runtime contract. Malformed requests receive a
generic error without echoing their supplied values.

Native authorization requires exactly `true` from the installed guard. Missing
user, organization, or caller identity is denied. Each call snapshots selected
native identity and audit reference fields into a frozen object. Caller-supplied
authority fields do not enter that snapshot. A separate store instance closes
over each invocation's context, while storage rechecks current facts before and
after writes. The callback contract is trusted composition, not a configured
production authentication service.

Both entries remain outside an `actions/` directory. Native metadata explicitly
sets `http`, `agentTool`, `mcpTool`, and `toolCallable` to false, with no
`publicAgent` exposure. Export is read-only. Registration keeps native audit,
disables input recording, and explicitly retains private visibility.

Core's already-parsed action input cannot recover duplicate raw JSON keys. This
receipt does not claim strict public HTTP, tool discovery, installed application
behavior, production authentication, or durable root identity composition.

## Windows verification

All 12 focused tests passed with no skips, failures, or cancellations in
28.460 seconds. Each scenario ran in a separate process using existing locked
dependencies and a disposable file-backed SQLite database. Workers received a
minimal environment and an explicit database URL; they used synthetic identities.

```console
node --test packages/workbench/tests/registry-actions.test.mjs
```

| Case | Observed result |
| --- | --- |
| Native entry metadata | Every HTTP/tool/extension exposure flag is false; no public declaration or discovery directory |
| Native registration, replay, export | Atomic registration persists; replay allocates nothing; portable export omits binding and local fields |
| Foreign-actor export | No binding disclosure |
| Numeric strings, malformed types, unknown authority, IDs, revisions | Generic refusal before authorization, fact resolution, or allocation; request unchanged |
| Unicode and content identity | Invalid Unicode, overlong code-point count, and malformed or extra digest fields rejected; 200 supplementary characters accepted |
| Missing trusted context | Native authorization denies before fact resolution |
| False, missing, or non-boolean authorization | Denied; only exact true permits the handler |
| Current policy refusal and post-insert revocation | Public refusal; all partial registration records roll back |
| Concurrent caller contexts | Frozen context per invocation; mutating the original object cannot change accepted actor or collection |
| Overbroad trusted producer output | Native strict output validation rejects the extra private field |
| Native audit privacy | Private success metadata with null request input |
| Native audit insert failure | Registration commits; the completed operation still replays without changing registry records |

The audit failure test creates a test-only SQLite trigger on the native audit
table after an initial successful audit. Further audit inserts fail while the
native wrapper preserves the committed registration and receipt. It does not
replace native audit with an application table or treat audit as the registry
transaction boundary.

Runtime capture verified Windows x64, Node 24.19.0, Core 0.176.5, Zod 4.5.4,
Drizzle 0.45.2, better-sqlite3 12.11.1, and SQLite 3.53.2. It records hashes for
the native action, audit, database, and resolved dependency entry files. No
dependency installation, model call, new development checkout, or Habitat file
was needed. Linux driver verification remains open.

## Source, review, and cleanup

The action module hash is `58ee38c42c39a80fd01d15af88488442a848e36455ae89118dcf52a26a57b675`; the focused test hash is `85154e0df083e0f9ce03017ec1124cd87df088f9b77170603e8efdb00e76f8bb`. A separate GPT-6 reviewer checked the source, actual native coercion behavior, shared-schema validation, context isolation, native guard/output/audit composition, and exposure flags. The review found no blocking issue in this internal scope.

The private archive contains 18 unique entries and 40,137 bytes, SHA-256 `6b3fc749c3b8021521cc55c99ea46bed59c304ea37ae2c398f4322f6ff1fa3d3`. The reviewer independently verified all 17 manifest sizes/hashes, matched all 13 archived source files against current canonical bytes, and checked the retained 12-test runtime log. The implementation writer did not supply independent acceptance.

After review, cleanup rechecked the final archive hash and exact target, rejected reparse points and unexpected files, and removed only the owned staging tree: eight files, 37,865 bytes, and three directories. The target was verified absent. Each test had already removed its database tree after the worker exited. The final archive, sidecar, logs, and cleanup receipt remain private; no Habitat files were created.

Source navigation, tracked line endings, and diff checks passed. The graph writer renders the completed packet and verifies the canonical planning graph.

Outcome 06 remains in progress for trusted production policy/root composition,
raw transport, app discovery and GUI wiring, project switching, and deployment
verification. These are executable follow-on work, not a blanket pause.
