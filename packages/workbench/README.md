# Vivary Workbench application services

This private, unreleased package composes the preserved Littleagent workbench
shell with Vivary application services beside the existing Python packages.
[The program frontier](../../docs/product/multi-project/index.md) owns current
work; [release status](../../README.md#release-status) owns shipped behavior.

## Shipped workspace composition

`server/creation_workspace.py` supplies `ShippedWorkspaceOperations` and
`shipped_creation_composition` to the existing private Python stdio provider.
Trusted startup code supplies parents, namespace custody, and the recovery preview
directory. Requests cannot choose imports, executables, or authority.
The adapter calls create-vivary's preview, thin scaffolder, and Doctor, then Tropo
check. Core retains exact-byte verification, custody, receipt admission, and recovery.
The [integration map](../../docs/product/multi-project/contracts/shipped-workbench-integration.md)
owns remaining GUI and loop seams. Source composition does not activate GUI creation.

## Local shell

### GUI chat titles

The app's `server/plugins/00-chat-title.mjs` overrides the native title endpoint
with DeepSeek. It registers before native bootstrap so title requests cannot
fall through to the framework's Anthropic title handler. The server requires a
native session and organization, then resolves `DEEPSEEK_API_KEY` through the
native scoped secret resolver. Configure that key through the workspace vault.

Only the first 500 characters of visible message text reach DeepSeek; hidden
context and mention metadata are stripped. The request uses `deepseek-flash`
with thinking disabled, a 64-token output limit, and a five-second timeout.
Missing credentials or provider failure return a sanitized local title.
The native client keeps responsibility for manual renames and title persistence.

This is a GUI backend feature. It does not change the development harness or
runtime preparation/start. The current read-only conversation view has no
composer, so end-to-end automatic titles still require that chat integration.
Packet [05b](../../docs/product/multi-project/packets/05b-deepseek-chat-titles.md)
owns the source and focused proof; it does not establish production activation.

### Shell evidence

Packet [05a](../../docs/product/multi-project/receipts/05a-workbench-shell.md)
preserved 24 selected source files before adapting the native providers, chat,
two-pane layout, mobile navigation, and expandable work panels. The app uses
Core 0.176.5 and Toolkit 0.19.3. `source-provenance.json` maps each imported or
composed file to its captured bytes and adaptation.

The native build, TypeScript check, six preview tests, and security doctor pass
in the existing Habitat app directory. A private Windows browser fixture
rendered that exact Linux output with a labeled synthetic session and 503 native
API responses. This proves the shell's layout and unavailable interaction;
configured authentication, persistent production storage, project registration,
and connected model execution remain separate work.

Run the package scripts with Node 22.22.0 or newer:

```console
pnpm build
pnpm typecheck
pnpm test:shell
pnpm run doctor
```

Project editing and conversation input remain unavailable until their actual
capability binding exists. Both conversation routes use the selected-project
readiness panel and provide no composer or run controls. Server authorization
remains mandatory for readiness observations. The unsafe legacy editor is
preserved privately but is not imported into the executable app.

Publication rights, production configuration, and six inherited transitive
vulnerability advisories remain recorded in 05a. A successful build does not
establish production readiness.

The registration store composes Agent-Native's public database, portable schema,
and migration APIs with the existing registry decision engine. The trusted caller
installs a policy/root resolver and ID allocator. The store reloads its own records
inside a native transaction and persists the accepted registration atomically.
Native sessions, tasks, transcripts, connections, and schedules keep their owners.

`createRegistryStore({ resolveFacts, allocateIds, evaluate })` provides `register`
and `exportProject`. The resolver receives an operation and cloned request; it
returns only the nine named policy/root facts listed in the store. Registry
revision, bindings, projects, and operation receipts always come from storage.
The allocator runs only for a new authorized registration after existing records
have been checked. Native migrations run before the application serves requests.

Packet [06a](../../docs/product/multi-project/packets/06a-native-registry-storage.md)
owns the Windows SQLite proof, exact source hashes, and limits. Its tests use
synthetic identities. The observer's private lifetime handles are not wired to
this store. Production registration still needs durable identity, configured
authorization, transport validation, deployment storage, and application wiring.

## Bounded database proof

The test loader can reuse an already installed Core 0.176.5 package without
changing package files, links, or global environment. Set the two private process
variables to an existing Core `package.json` and an absolute disposable proof root:

```console
node --test packages/workbench/tests/registry-store.test.mjs
```

`VIVARY_TEST_CORE_PACKAGE_JSON` selects the existing dependency package.
`VIVARY_REGISTRY_PROOF_ROOT` contains every temporary test database. Each child
runs with a minimal environment and an explicit `file:` database URL. Tests wait
for child exit before checking cleanup containment and removing their case tree.
The loader is test-only; product modules retain normal package imports.

No dependency installation, hosted database, authentication setup, Linux proof,
application publishing, or package release is performed by this command.

## Internal registry actions

`createRegistryActions({ authorizeContext, resolveFacts, allocateIds, evaluate })`
composes native registration/export entries around the same store. Trusted
application code supplies these callbacks. Caller request fields cannot supply
authority, policy, root observations, or stored records. Each invocation receives
an immutable snapshot of selected native context fields. The current resolver
continues to run at the store's authorization boundaries.

The app entry validates input with the same schema before forwarding to native
`entry.run`. This preserves the registry's exact request types before Core's
gateway argument coercion. Native authorization, strict output validation, and
audit remain in the native entry. Responses contain only the contract's public
output. Registration audit records omit inputs and keep private visibility.

These definitions live in `server/`, with no auto-discovered `actions/` directory.
Their metadata disables HTTP, agent/MCP tools, extension calls, and public
exposure. They are callable only through explicit trusted application composition
at this checkpoint. Native parsed-input validation cannot detect duplicate raw
JSON keys, so public transport still needs the boundary recorded by 03c.

Packet [06b](../../docs/product/multi-project/packets/06b-native-registry-actions.md)
owns the focused Windows proof. With the same private dependency and disposable
proof-root variables, run:

```console
node --test packages/workbench/tests/registry-actions.test.mjs
```

The test-only loader additionally reuses installed Zod 4.5.4. Each scenario runs
in a separate native process and disposable SQLite tree. The suite proves actual
native validation, metadata, authorization, output rejection, storage composition,
caller isolation, and audit behavior. Production authentication, durable root
identity, application discovery, public transport, and GUI integration remain open.

## Opt-in registration HTTP mount

`mountRegistryHttp` installs raw request validation and the existing native
registration entry at its native action path. Trusted application code supplies
owner and organization resolution. The guard checks exact paths, POST/JSON,
actual byte limits, strict UTF-8 and JSON, and the existing action schema before
native parsing. Explicit refusal responses prevent the inspected native bridge
from treating validation exceptions as completed-request disconnects.

Packet [06c](../../docs/product/multi-project/packets/06c-native-registry-http.md)
owns the Windows loopback HTTP-to-SQLite proof. With the same private dependency
and disposable proof-root variables, run:

```console
node --test packages/workbench/tests/registry-http.test.mjs
```

The loader reuses installed H3 2.0.1-rc.31. The ten scenarios exercise a real
listener and native mount with synthetic trusted authentication. The test server
uses a fresh H3 instance, not a built Nitro application. Configured application
authentication, trusted root identity, GUI registration, and Linux storage remain
follow-on work. Export and all agent/MCP/extension surfaces remain internal.

## Selected-project runtime readiness

The conversation panel consumes the read-only Native readiness action using all
current catalog claims. It shows installed, configured, authenticated, bound,
runnable and verified observations separately and hides stale output during
selection or access changes. Missing production composition stays unavailable.
The [04a receipt](../../docs/product/multi-project/receipts/04a-project-runtime-readiness.md)
records actual Native action and controlled React/Query evidence. These reads do
not start a runtime or authorize a run. [04b](../../docs/product/multi-project/packets/04b-project-native-activity.md)
has accepted bounded Run activity rendering and Native reads in its
[receipt](../../docs/product/multi-project/receipts/04b-project-native-activity.md).
Full build, browser, history fidelity and lifecycle acceptance remain open.

Private thread preparation is verified in the [04c receipt](../../docs/product/multi-project/receipts/04c-project-native-preparation.md). It does not start a harness or make production project chat available.
