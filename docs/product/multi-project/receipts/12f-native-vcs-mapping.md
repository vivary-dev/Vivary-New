# 12f receipt: Native VCS-reference integration mapping

Evidence-record: 12f

Status: Passed source inspection, independent review and canonical documentation
checks on 2026-09-08. Runtime integration and parent outcomes remain open.

## Result and limits

The [transaction map](../contracts/project-registry-transaction-map.md#native-vcs-reference-integration-12f-inspection)
now traces application VCS references through the existing lifecycle, Python
wire, Node validator, Native authorization, registry transaction and public
projection. It preserves the original 03c text and adds one bounded section,
including an expected-case table. No product source changed and no case ran.

Three application gaps prevent a verified Git result reaching registration:

1. Python `serve` returns `identity-unverified` for every non-`none` layout.
2. Node's strict `replySchema` has no repository, checkout or VCS fields.
3. The Native facts resolver constructs `vcs: none` and copies only root/content
   identity from a successful observation.

The existing registry model, binding columns and receipt JSON already carry
the registry's Git VCS shape. The smallest forwarding change belongs in those
three application modules. It needs no new framework API or VCS table.

One separate semantic gap affects future proof claims: registration replay
checks root, project, binding and binding revision, but does not compare the
saved binding VCS, receipt VCS and current root VCS. A new-key duplicate likewise
returns its existing binding by scoped root identity. Current lifecycle custody
refuses physical administration replacement before those paths. That does not
establish how a validly shaped but inconsistent stored VCS object should be
handled. Outcome 03 owns that decision; this inspection invents neither a refusal
code nor a new invariant. The private successor proposal names it before any
claim of VCS-consistent replay.

Application IDs remain inert without live custody. Provider readiness means
process availability; it is not root verification. No production configuration,
GUI Git readiness, runtime start, recovery, mutation, fencing, Windows/Jujutsu or
release acceptance is established here. The live locator-update method has no
wire operation; relocation/rebind stays outside the first forwarding successor.

## Source and acceptance baseline

The existing private handoff resolved the canonical Vivary and preserved
Littleagent checkouts. Their observed HEADs were respectively
`84596ca4fabeeaa4ea5551e784da69eb1f05d992` and
`5bc8f7e7374e4a6b7e58026f6e10e19e5e386b13`.

Relevant Core additions and `packages/workbench/` are untracked in the canonical
checkout, so HEAD alone does not identify their accepted bytes. The source
hashes and accepted evidence archives below provide that distinction. The
canonical planning files also contain concurrent edits; no 04d/06e/20f state was
accepted or modified by this writer. Preserved Workbench and lockfile changes
were not implementation inputs for the mapping.

Prerequisites were done/passed with their own receipts: [03c](03c-registry-transaction-mapping.md),
[06d](06d-native-root-registration.md), and [12e](12e-vcs-identity-lifecycle.md).
Their historical runtime results were read, not rerun.

The retained 06d archive hash was rechecked against its accepted receipt:
`ddd6d6cd56dc2c16949c88920c8d8b22a13fcabb8b41d5acbc0c246c521f46d4`.
Thirteen relevant source entries were read directly from that archive and hashed
without extraction. Seven match current source exactly; six differ as described
below. The 12e archive hash likewise matches its accepted receipt:
`d86eefa1caaa49507a361d51fa59e67fb1c7990f922664f6183d144a37bdd4fc`.
Current 12e lifecycle and two named implementation-test hashes match that receipt.
12f did not repeat either archive's full historical payload or runtime review.

| Difference from 06d | Accepted 06d source SHA-256 | Current disposition |
| --- | --- | --- |
| `root_identity_lifecycle.py` | `65c25497885cb1af06a6a00da4edc3acd3e01ddc0900e5d8812b893721cc15c2` | Current hash below is accepted by 12e; application VCS references and inert v2 migration replace 06d's root-only lifecycle |
| `root_provider_stdio.py` | `6d864d40527cf37f353ca03e8376a7bd343ffb54f37c8eddfa4c65e938b6c357` | Current source adds 06e `inspect`/`available`; the existing non-none refusal and registration projection remain unchanged |
| `root-provider.mjs` | `fc9cb5a8d78a1f795cb4304fadd85b063c651a284dc01aebd9de354393a59b53` | Current source adds `available`, operation matching and `inspect`; accepted `observed` shape still has no VCS fields |
| `native-registry.mjs` | `cc32d5b795c6dcc8e7ae7efa3fba31524d7655f7656588ccac58e5196461d91a` | Current source adds `readScope` and extracts shared auth callbacks; registration still constructs `none` |
| `db/schema.mjs` | `dd56672d946c66bd44d438560219db26392cd13176ef551b9f309ec2253cc3a1` | Current source adds creation receipt fields/index; original binding VCS columns are unchanged |
| `db/migrations.mjs` | `52d79357d96a155cbbd4cedd14e8bfab5d26cb38dab567fd8ff72e6601469b10` | Current source appends creation receipt migration v2; original registration schema is unchanged |

The current-only read helpers were inspected to avoid overwriting or misnaming
shared source. They are not used as accepted 06e behavior. Differences were
compared as text against archive entries; no baseline was restored over a writer.

## Current application source ledger

Paths are relative to the canonical checkout. The map's source keys and line
references bind to these exact SHA-256 values.

| Source | SHA-256 | Inspection scope |
| --- | --- | --- |
| `packages/core/vivary_core/root_identity_lifecycle.py` | `603d6024584b5a614c2b2110174e3aaaaa2fcaa1342201e35b9af60b88aa6d6f` | L:29-132, 181-240, 289-391, 449-731: schema, custody, allocation, migration, enrollment and live projection |
| `packages/core/vivary_core/physical_observe.py` | `fc4c1835fec15669cf727ad0a73fd38cb8c53527ffede36f8791345a72d770b8` | P:47-70, 379-510, 525-620: physical vs application identity, topology, inventory, overlap and failure propagation |
| `packages/core/vivary_core/registry_observe.py` | `7fd4a3d04ae89236ad8caef228d7d3b4c1c4771cdc5e548f0c39d85241a5b9b4` | 1-185: private lifetime-bound read owner; not the application UUID provider |
| `packages/core/vivary_core/root_provider_stdio.py` | `b127aa191332a07dbcdba0c2cfab27421fc43c3a3a05f65bc3cb055e35403116` | W: whole file; exact configuration, request and non-none response refusal |
| `packages/workbench/server/root-provider.mjs` | `3a79a409730f10000d6c4f931e51033b9dca2fe0090729b3e4e0e5698ce0db5a` | N: whole file; strict response validation, operation/sequence/locator matching and child lifetime |
| `packages/workbench/server/native-registry.mjs` | `30f7901c41563096caf4d2ac614021eae92b1f95b18eb9179550d2e263998c26` | A: whole file; installation grant, current app-role checks, no-VCS projection and output surface |
| `packages/workbench/server/registry-store.mjs` | `df36b4f77e3d454691b6e28063614fe533b8fb79740d8f900115493d3597ca86` | S: whole file; nine trusted facts, scoped reads, reauthorization and one SQL transaction |
| `packages/workbench/server/registry-actions.mjs` | `58ee38c42c39a80fd01d15af88488442a848e36455ae89118dcf52a26a57b675` | H: whole file; strict input/output, context snapshot, native authorization and private audit |
| `packages/workbench/server/registry-http.mjs` | `2732e42f4fe5c42d29e08c9196a85d48351b90350d85b7ca7439938e6de001ec` | H: whole file; raw byte/UTF-8/JSON guard before native parsed dispatch |
| `packages/workbench/server/db/schema.mjs` | `0d60703328bd42f7a1034113873f4f6e54d9bf321b869987ce2feb6fef862c70` | D: whole file; existing VCS columns and root/operation uniqueness |
| `packages/workbench/server/db/migrations.mjs` | `919db39c3b2798bdc248c43e4c94f912ac013cbbb0d39110abf7ce95d7d3834b` | D: whole file; registration migration v1 and separate creation additions |
| `packages/workbench/server/db/index.mjs` | `c0506fd5984cd28bc70499df29267f5e88e8bcd2c2a4081fe20ccb1c61b807f6` | Whole file; existing typed app client through `createGetDb(schema)` |
| `scripts/registry_contract_model.mjs` | `e9eb2a1a75c176b196d1be47f2e54219ac0803e5121ba0c3292e242c378143d5` | M:251-307, 529-554, 559-733; shape, scoped authorization, receipt, replay and registration decisions |
| `packages/core/tests/test_root_vcs_identity_lifecycle.py` | `a427f78e355eb959c2beb24ec96110d883e273e6117eafc43c7c7a8ea6c33941` | Named cases at 252-732; accepted 12e topology, replacement, migration and serialization witnesses |
| `packages/core/tests/test_root_identity_lifecycle.py` | `f48214eac9af6796573918d0214b88cfd8a71b4cbd3ecde926e20e8f87a5035a` | Hash compared to accepted 12e; compatibility coverage taken from its receipt, not rerun or re-reviewed |
| `packages/core/tests/test_root_identity_reads.py` | `62097cecc3965b8851b7d3ff11f21199bfc660e299c5019ba29531ebbd2b9db5` | Named cases at 46-103; read-only allocation, alias and custody limits |
| `packages/workbench/tests/native-registry.test.mjs` | `1343763e11faccb1dbbe9780f9ec46404ec5bc43c51623148969c45e9231b3f8` | Six named groups; 148-267 traces native HTTP/roles, no-VCS SQL state, replay and revocation; identical to 06d archive |
| `packages/workbench/tests/root-provider-read.test.mjs` | `5e606e33dc0e20059964feaa7d2ed27ddf13f4cbf7009a5197ad83c854fe72cd` | Named cases at 38-88; current-only 06e source, no acceptance claim |
| `packages/workbench/tests/registry-store.test.mjs` | `6090cbb3ca8fad08f36031de4bb141c4fcae9850623263818c0e83d1eb415e11` | Synthetic fact source at 38-51, snapshot/cleanup, and named atomicity/replay/contender cases; no physical identity proof |
| `scripts/tests/test_registry_contract_model.mjs` | `e73a7c6e0ebaf7d79bd5502ae91dffb4dd867d7f4578c45c73b28fe17593fd60` | Bounded replay/VCS search and 455-473 scoped replay test; no claim of a VCS-consistency regression test |

## Installed Native evidence

The preserved checkout contains `@agent-native/core` **0.176.5**. No installation,
import, CLI, network lookup or provider call was needed. Version-matched docs and
public exports establish the existing composition points; they do not prove
production configuration or a fresh runtime result.

| Existing public seam | Evidence |
| --- | --- |
| `defineAppRoles` / `getOrgContext` from `@agent-native/core/org` | Package export at 223; `dist/org/index.js`:3,7; app-role declaration at `app-roles.d.ts`:105,114; implementation at `app-roles.js`:127-158 resolves current membership plus assignment in one query. Docs at `organizations-teams-permissions.mdx`:169-235 describe the overlay. Documentation examples use `org-team`; the inspected `org` export is independently present |
| `getSession`, `getH3App`, `mountActionRoutes` from `@agent-native/core/server` | Package export at 67; server barrel at 11,58,70 and declarations at 11,59,66. `action-routes.js`:400-447 resolves supplied native owner/org callbacks; 480-538 parses and dispatches with native caller context. 06d owns the observed session proof and known unauthenticated-response limitation |
| `defineAction` from `@agent-native/core/action` | Package export at 91; `dist/action.js`:80-124, 322-382 composes input validation, authorization, handler, output validation and best-effort after-handler audit. H wraps strict prevalidation before native argument coercion |
| `createGetDb` and `runMigrations` from `@agent-native/core/db` | Package export at 108; DB barrel at 22-23; `create-get-db.d.ts` and implementation expose the existing app client. `server-database.mdx`:196-248 names app ownership and migration use. 06d/06a receipts, rather than declarations, own bounded SQLite transaction evidence |

The search was limited to the imported org, action, server and database seams
needed by registration. It establishes no general absence of other Native VCS
features. No Native runtime/session/transcript/connection owner is replaced.

All following paths are relative to the preserved installed Core package:

| Source | SHA-256 |
| --- | --- |
| `package.json` | `937ec79fc0e2d1b105e1b422c2460ea2276c51709576e5604917f46a2e4bf539` |
| `dist/action.js` | `fac0f06649c2f6e4a6554f551b583490b4e4281d2901353402da4a789ef9cf43` |
| `dist/org/index.js` | `37bdb25e08693fb66f9e3ea84473bc52f9d6c7d8f0662cce3ea9145487e89cfc` |
| `dist/org/app-roles.js` | `a3789e760dc5d5a162b9db24df3357411ed0e3fda8767217b108f0cb2ddb0f37` |
| `dist/org/app-roles.d.ts` | `3eb9e25f5ec25e1d7c1626574d0f24d0de2e3a901e5ebfe451920a652bb6f3ff` |
| `dist/server/index.js` | `1518cd3a43d085ec8f5508e24d190e8301fdd2a67d58889806679e8fe20849b3` |
| `dist/server/index.d.ts` | `5e3690174dfabd749c084f02a1c716e4ab3110becdee3adf2f157efa277ee00c` |
| `dist/server/action-routes.js` | `f4a2820a0e68145a1c1101d15c4868a5f2d22a41aca198b7496859a1486344dc` |
| `dist/db/index.js` | `3abb72918a2a126519a382af52e19968d35dcfbfad72b848d77965dc5dd4c23c` |
| `dist/db/create-get-db.d.ts` | `5906b3304965bb9e2f5ad8feaf4193d3a7b48907b9952cbc2cba44e588e958fa` |
| `dist/db/create-get-db.js` | `296ff7c031fbc8c4a55b1ed47bb776dc12bf840480803b9888b15a0ad50713a8` |
| `docs/content/organizations-teams-permissions.mdx` | `e947ee759cdf4a2882978ad0f21a912819525cb7a430f6535ff5bbd8023413a1` |
| `docs/content/server-database.mdx` | `dd8ff85e56a6a4093e9b159f5317ad3de0baaefe1c28ef52d1075cfe7a3a1dfa` |

## Inspection commands and verification status

Read-only command families used, with roots resolved before substantive reads:

```console
git rev-parse HEAD
git status --short
rg --files packages/core packages/workbench -g AGENTS.md
rg -n 'repository_id|checkout_id|mutation_owner|unresolved' packages/core/vivary_core/root_identity_lifecycle.py
rg -n 'result.layout|response.update' packages/core/vivary_core/root_provider_stdio.py
rg -n 'replySchema|noVcs|async function facts|async function reauthorize|async function loadRegistration' packages/workbench/server/root-provider.mjs packages/workbench/server/native-registry.mjs packages/workbench/server/registry-store.mjs
rg -n 'vcs|receipt|superseded-operation|replayed' scripts/registry_contract_model.mjs
rg -n '"version"|"./org"|"./server"|"./action"|"./db"' node_modules/@agent-native/core/package.json
```

Targeted `Get-Content`/`Select-Object` reads covered the ledger's ranges and the
owning contracts. `Get-FileHash -Algorithm SHA256` bound source and archive bytes.
Read-only .NET ZIP entry streams supplied the accepted 06d baselines; SHA-256 and
`Compare-Object` distinguished exact matches from later additions without
extracting or running the package. The hashes above are source identity, not a
claim that untouched tests ran during this inspection.

Writer static checks passed: all 33 current application/Native ledger hashes
matched, the contract preimage remained unchanged, and the canonical 12f receipt
was absent. The two-document overlay resolved all 20 local links and anchors,
with zero missing targets or machine-specific paths. `git diff --no-index --check`
reported no whitespace errors (exit 1 denotes the expected content difference).
The contract diff is 114 inserted lines: one routing paragraph plus the new
integration section, with no original line deleted.

Independent review by `record_decisions` verified all 33 ledger hashes, both
accepted archive hashes, preservation of the original 03c text, and five traces:
no-VCS success, the Git forwarding gap, linked-worktree sharing, lost custody,
and replay/scope refusal. The cited public exports support the Native seam map.
Two corrections were applied: the app-role query locator now includes its join,
and the private successor describes the inherited output limit as 1 MiB combined
stdout/stderr per supervised command. No behavioral or ownership finding remains.
After canonical application, planning checks passed for all 36 outcomes, source
navigation passed with 23 edges, 11 locators and 16 records, line-ending checks
passed for 443 tracked files with four existing legacy exceptions, and
`git diff --check` passed. These checks establish document consistency only.

The independent reviewer verified the final private archive: 39 unique entries,
38 payload hashes, 589510 payload bytes and all 33 source-ledger matches. Its
177778-byte ZIP has SHA-256 `c0f82306acc6f263d33c0a83ad5938df211b2b60ece2ed5668a932809f2acb38`.
The archived reviewed receipt predates this closure metadata; its content hash
remains the accepted inspection source. No runtime resource was created.

## Next packet and retained resources

A private, unclaimed successor draft proposes the existing three-module Git
registration bridge plus focused wire and Native/SQLite tests. It requires a
recorded outcome-03 replay/duplicate decision, a lead-owned shared-source handoff,
and exact Habitat proof preflight before execution. A missing predicate belongs
in the existing oracle/store owner, never a parallel VCS authorization layer.

The reviewed successor is retained privately as proposed 12g. It depends on
[03d](../packets/03d-vcs-replay-consistency.md) passing. The planning validator
permits publication as executable work only after that prerequisite is done.
The lead retains one reviewed draft until then, with no implementation claim.

The lead verified all four private staging files byte-for-byte against the
accepted archive, confirmed the canonical contract and closure receipt, then
removed those exact redundant files and their empty directory. One verified
177778-byte inspection ZIP remains. Existing accepted archives, shared
dependencies and other packets' resources remain unchanged. No runtime process,
server, container, database, checkout, installation or test fixture was created.
