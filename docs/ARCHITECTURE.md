# Vivary architecture

This is the high-level design for the desktop and self-hosted product in `vivary-dev/Vivary-New`. It describes the system that contributors change and the boundaries they must preserve. The [module catalog](product/multi-project/specification/modules.md) owns detailed responsibilities and source entry points. The [desktop acceptance register](product/multi-project/desktop-acceptance-status.md) owns proof by candidate. GitHub issues own task scope and lifecycle.

## Purpose and owner intent

Jeff's [desktop release decision](product/multi-project/desktop-release.md) calls for one Vivary instance on a user-controlled computer or suitable server. A local desktop window and a responsive browser connect to that host. The host keeps agents, project files, credentials, history, and memory. Local desktop use needs no Vivary account. Remote browser access requires explicit setup and authentication. Zo hosts development and a private preview. It is not a required user service.

The [unified workspace decision](product/multi-project/design.md#unified-workspace-decision-2026-09-14) puts one selected project conversation at the center. A project can have several independent conversations. Files, details, search, and preview open as optional panels. Supported installed coding runtimes retain their own tools, models, permissions, and sessions. Vivary binds their work to the selected project. A cross-runtime link and a maintained handoff remain separate product capabilities, not an implicit transfer of a live run. The [interaction contract](product/multi-project/unified-workspace.md) owns those details.

The original Vivary engine remains available as standalone commands and through bounded application operations. A project keeps its own folder and conventions. The original five-file workspace contract, plain authored files, and optional version control let a user continue work without the GUI. The [original CLI reference](ORIGINAL-CLI.md) owns command and release status.

The original design reduces active agent context. `AGENTS.md` routes to `.vivary/context.md`, and `STATE.md` is read when state matters. Typed records arise from actual work. Core keeps evidence, provenance, receipts, and authority explicit. Optional semantic retrieval can suggest candidates, but it does not become authored truth. [Original CLI architecture](#original-engine) explains the package boundaries.

## Success criteria

The [desktop release journey](product/multi-project/desktop-release.md#acceptance-journey) defines observable success. A person can install and open the Windows package without a source checkout or Vivary account, create and adopt projects, and run authorized work in each. They can inspect actual tool results, stop work, close the app, and reopen the same project and conversation. They can save a project fact, retrieve it in a fresh session, correct it, and remove it from active memory. They can find an older chat by message content and search project files by filename, exact text, and regex. They can use all ten original command verbs through the installed operations. A desktop and phone browser can connect to the same authenticated private host, and a project preview can support an observed error and authorized repair.

These are release criteria, not a claim that the full journey passes. The [acceptance register](product/multi-project/desktop-acceptance-status.md#capability-and-acceptance-gaps) names the tested source and platform for each accepted slice and the remaining gaps. Hosted, simulated-provider, and packaged Windows evidence have different limits.

## System structure

```mermaid
flowchart LR
  Person[Person] --> Desktop[Electron desktop]
  Person --> Browser[Authenticated browser]
  Desktop --> Host[Workbench host on loopback]
  Browser --> Host
  Host --> Registry[Project registry and scoped actions]
  Host --> Native[Agent-Native sessions and runs]
  Host --> Original[Bundled original Python engine]
  Native --> CLI[Supported installed coding CLI]
  Registry --> Files[Authorized project folders]
  Original --> Files
  CLI --> Files
  Host --> Data[Private application data]
  Native --> Data
```

The Electron process starts a local Workbench server, opens its loopback origin, and manages shutdown. The browser client presents the same host state. The Workbench launcher chooses local, hosted, or private-proxy access and locates private data. The source owners are [`packages/desktop/main.mjs`](../packages/desktop/main.mjs), [`packages/workbench/bin/start.mjs`](../packages/workbench/bin/start.mjs), and [`server/local-access.ts`](../packages/workbench/server/local-access.ts). The browser does not run agents or mount a phone's files.

Workbench composes Agent-Native's application, chat, run, action, and storage owners. Native keeps transcripts and run lifecycle. Workbench keeps project identity and authorized root bindings, then resolves those bindings for actions and sends. The registry uses Native's database with Workbench project, binding, revision, receipt, and mutation tables. See the [project registry](product/multi-project/source-map/modules/project-registry/index.md), [`project-services.mjs`](../packages/workbench/server/project-services.mjs), and [`db/schema.mjs`](../packages/workbench/server/db/schema.mjs). An observed path is not by itself a project identity or a write grant.

The selected coding runtime owns execution, tools, model access, and native session continuity. Workbench currently supports Claude Code and Codex through Native Code records and the local Code host. Codex uses its app-server and account-effective model catalog. Workbench relays native approvals, progress, child activity, and Stop. Native provider chat uses Native's chat owner with a project send guard. The [harness adapter contract](product/multi-project/specification/harness-adapters.md), [Native owner map](product/multi-project/native-owners.md), and [runtime source map](product/multi-project/source-map/modules/native-runtime/index.md) describe the distinct owners.

### Original engine

The original engine remains a package family, not another agent loop. `vivary-core` owns pure validation and projection while callers retain execution, persistence, and human approval. Tropo observes, builds typed graph context, and retrieves. Strato evaluates policy. Ozone verifies evidence and proposes gated repairs. Exo projects claims, dependencies, and handoffs. `create-vivary` creates and adopts workspaces. The optional MCP and semantic-memory adapters are outside the default package path. The `vivary` front door routes ten verbs to their package owners. The Workbench bundles this Python runtime and calls its established commands rather than reimplementing their decisions. See [the command reference](COMMANDS.md) and [package manifests](../packages).

### The shared seam: vivary-core

Core is a library shared by Tropo, Strato, Ozone, and Exo. It owns deterministic
evidence projection, bounded task capsules, receipt validation, policy decisions,
and control-state projection. Callers retain clocks, execution, state persistence,
and human approval. Unknown, conflicting, or omitted evidence stays visible.
Observed ambiguity does not become permission to act. The [Core contract](../packages/core/README.md)
owns the detailed schemas and refusal rules.

### Package dependency map

This map shows direct source-manifest dependencies; omitted arrows are deliberately
absent. In particular, the `vivary` meta-package receives Core transitively, while MCP
and memory remain optional and outside that meta-package.

```mermaid
flowchart BT
    core["vivary-core"]
    tropo["vivary-tropo"] --> core
    strato["vivary-strato"] --> core
    ozone["vivary-ozone"] --> core
    ozone --> tropo
    exo["vivary-exo"] --> core
    exo --> tropo
    memory["vivary-memory-cognee"] --> core
    memory --> tropo
    mcp["vivary-mcp"] --> tropo
    mcp --> sdk["official MCP SDK"]
    create["create-vivary"] --> tropo
    npm["@vivary/create"] -. installs / dispatches .-> create
    suite["vivary meta-package"] --> create
    suite --> tropo
    suite --> strato
    suite --> ozone
    suite --> exo
```

The [package manifests](../packages) own dependency version floors. Each
shipping package declares the Core dependency it imports. The meta-package
receives Core through its component dependencies. Source versions and published
versions remain distinct in the [CLI release status](ORIGINAL-CLI.md#release-status).

### Distribution names

The package names remain part of the original engine's architecture. The
[original CLI release status](ORIGINAL-CLI.md#release-status) owns published
versions. A changed source version is not evidence of a registry release.

- npm: `@vivary/create` launches the workspace creator.
- PyPI: `vivary`, `vivary-core`, `vivary-tropo`, `vivary-strato`, `vivary-ozone`,
  `vivary-exo`, `create-vivary`, `vivary-memory-cognee`, and `vivary-mcp`.

The optional memory and MCP distributions remain outside the default path.
Coordinated releases publish Core before its dependent role packages.

## Runtime flows

1. **Select a project.** Workbench resolves the authenticated actor, stable project ID, current binding, policy revision, and observed root. Project selection changes the files and history shown. A missing folder leaves authorized history available but blocks file-dependent execution. [Project registry](product/multi-project/source-map/modules/project-registry/index.md) owns the identity contract.
2. **Send and continue.** A Native chat send rechecks its pinned project scope before model or attachment work. A Code send starts or resumes the selected native session against its bound project. Native stores the resulting run and transcript. A model choice or project switch cannot silently move an active run. [`native-chat-project.ts`](../packages/workbench/server/native-chat-project.ts), [`local-code-agent.ts`](../packages/workbench/server/local-code-agent.ts), and the [session model](product/multi-project/desktop-release.md#one-understandable-model) own this flow.
   Each project message also loads the project's context when it starts. [`project-memory.ts`](../packages/workbench/server/project-memory.ts) reads the law files, the state file, and the fact files in the memory folders from the admitted project only, and renders one block of at most 8,000 characters. A Code send puts the full block before the engine prompt on every turn, for new runs, Claude follow-ups (each a fresh CLI session), and resumed Codex threads. A resumed Codex thread therefore accumulates one block per turn, up to 8,000 characters each. That cost is accepted so a thread never depends on an earlier block that Codex may have compacted away. Only Full chat blocks name Native's owner-wide tools. The transcript keeps only the typed message, and one note per turn, which the Code view shows, names the loaded revision and whether it changed. The panel's last load is recorded only after the send passes its refusals and claims the host slot. Full chat returns the block from Native's `extraContext` on every send. Its three Vivary hooks, the send guard (`prepareRequest`), `extraContext`, and `resolveActionSurface`, each classify the pinned chat scope again rather than sharing one match. A change to a fact file therefore applies from the next message, in new and open conversations, and after a restart. A reply already running keeps what it started with.
3. **Approve, deny, or stop.** Native owns an action request and its execution lifecycle. Workbench checks the owner, project, run, and exact request before relaying a decision. Stop targets the owned running work. Client closure does not itself approve or replay an action. The [coding permission decision](product/multi-project/design.md#native-coding-permissions-and-activity-2026-09-16) and [authority module](product/multi-project/specification/modules.md#m05-authority-and-approvals) own the rules.
4. **Read and change project files.** Scoped file actions list and read bounded content. Explicit Save and Rename check the selected project and file revision. Project memory is the only caller of the file service's exclusive Create and version-checked Remove, which reuse the same link refusal, per-project mutation queue, and conflicts. The Memory section in Project details calls two owner actions, `vivary-project-memory` and `vivary-project-memory-write`. It shows the memory folder and why it applies, the role assignments, when changes apply, each fact with its source and file, the exact block the next message receives, and the last load in this app session. Remember, correct, and forget write the owning file, and forget states what it cannot erase. Neither action is an agent tool. The Search panel walks one authorized project with caps, private-file exclusions, and continuation. It does not use a persistent index or a shell search process. [`project-files.ts`](../packages/workbench/server/project-files.ts), [`project-search.ts`](../packages/workbench/server/project-search.ts), and the [write-back map](product/multi-project/source-map/modules/project-writeback/index.md) own the behavior and limits.
5. **Call the original engine.** The bundled Python runtime receives a bounded command and a selected project root. The seven project read reports, Doctor, Check, Find, Capabilities, Receipts, Review, and Impact, share one server module for the Details panel and the Native tool. Review findings carry a rule code that the app renders from a closed sentence table, so an unknown rule makes the report unreadable instead of passing text through. The agent tool gets its project from the chat's pinned scope, not model-supplied input. Public Doctor, Find, and Check use the privacy-filtered CLI path. For issue #20, the CLI's public Review and Impact build their graph only from the documents in Tropo's privacy-filtered snapshot, before any rule runs. A link to a private note therefore reads exactly like a link to a missing id, findings carry no free-text message, and a private, missing, or unknown Impact target gets one `target_unavailable` refusal. Only the Structure and Editorial packs have a public form, because Context budget reads routing files from disk. Ozone loads one Tropo engine per process on first use, so the plain and public paths share its facade errors, and public note ids longer than 256 characters are left out and counted. Decide and control run through a separate server module, shown to the owner in the Evaluate section of Project details, where the owner picks whether to evaluate as themself or as the project's agent and every result states it was not saved and shows a refusal from Strato, Exo, or Vivary as an alert, including a refusal Core reports inside an ordinary result, [`project-evaluate.ts`](../packages/workbench/server/project-evaluate.ts), behind the `vivary-project-evaluate` agent tool and an owner action. The runner, not the caller, binds the actor: a tool call is always this project's agent, an opaque id hashed from the owner's actor id and the project id, and the owner chooses to evaluate as themself or as that agent. [`governed-request.ts`](../packages/workbench/server/governed-request.ts) is the only writer of the actor, contributor authority, project scope, and clocks, and the clocks are taken after the project lock is held. Input that names a server-owned field is refused by name, never overwritten. The agent may run decide, claim, release, expire_leases, and dependencies only, and may not submit a receipt, a verdict, or an execution log, because Native cannot verify them. Results carry `persisted: false` and are never saved. Host paths cross that boundary only as `.` and `./` project paths, and only at the absolute-path positions Core, Strato, and Exo declare. Each position names Core's capsule or claim spelling, so decoding restores claim ids and capsule fingerprints, and any other string is text that is redacted on the way out and never rewritten on the way in. An agent's scope and capsule paths are checked by their text alone, never on disk, so a claim cannot reveal whether a private file exists. A Windows device-namespace root is refused. Native has no capsule producer, so an agent decide without an owner-supplied capsule ends in Strato's own refusal. Governed writes retain their own plan, authority, and receipt rules. [`original-runtime.ts`](../packages/workbench/server/original-runtime.ts), [`project-read.ts`](../packages/workbench/server/project-read.ts), and the [issue #19 receipt](product/multi-project/receipts/09b-original-read-tools.md) record the delivered slice.
6. **Preview a project.** A reviewed local command starts a project process. The app presents its page in an isolated frame and supports Stop. The selected coding runtime can inspect and repair the project through its supported browser tools. The [preview receipt](product/multi-project/receipts/11e-live-project-preview.md) states what passed on Zo and what still needs packaged or platform proof.

## Data and trust boundaries

| Data or effect | Owner and boundary |
| --- | --- |
| Project files and authored memory | Stay in the user's authorized folder. Workspace roles identify authored knowledge. Authored facts are one Markdown file per fact in `.vivary/knowledge/` or the folders the `memory` role names. In a thin workspace Tropo types them as `vivary_fact`, which requires a source and a confirmed date, at both its private and public compose paths. `.vivary/memory/` is disposable semantic-provider state, not an authored note store, and provider forget never touches authored facts. Memory folders, law files, and the state file never use `.git`, `.vivary/memory`, the engine's declared private, runtime, and capability storage paths, or boundary role paths, compared without regard to case. Paths with a part Windows cannot use (a trailing dot or space, a device name, a colon, a backslash, or a control character) are refused. A memory folder, law file, state file, or fact file that the workspace's `.gitignore` files ignore is not loaded or changed. Neither is a fact file the engine did not check. Both sides list a memory folder the same way: the first 200 `.md` names of regular files and links, secret-looking names left out, in UTF-16 order, from at most 4,000 scanned entries. The engine checks the regular files among them whose paths the Workbench answer schema accepts, at most 3,000 paths and 96 KiB of JSON in all. The Workbench skips a link as linked, a name the engine can never report as unsupported, and a file created after the check as not checked, and Correct and Forget refuse each. Remember checks the exact new file name, so no fact is saved where the rules would ignore it. For memory the engine matches fail-closed: memory treats a path as private when any positive rule could match it and ignores negations, so it may refuse a file Git would re-include. The owner can choose a memory folder that no rule matches. A rule matches in exact case or without regard to case, a run of two or more stars reads the same whatever its length, as in Git, and a run not bounded by slashes crosses `/`, a rule and a path match as code points or as UTF-8 bytes, and a trailing `/` also matches a file. Each `.gitignore` is read as bytes: a UTF-8 byte order mark is skipped, lines split only on a newline, with one carriage return before it dropped, and an entry ends at its first NUL. Memory reads a bracket body itself only when it holds plain members and ranges, such as `[._]` or `[a-v]`, with an optional leading `!` or `^`. A body that holds a backslash, starts with `]`, `!]`, or `^]`, or holds a POSIX class, an equivalence class, or a collating symbol, a negated body holding an ASCII capital letter outside a range, such as `[!B]`, an unescaped `[` that never closes, a set Python cannot compile, and a rule longer than 256 characters make the rule match everything under its folder. Matching tracks reachable positions without backtracking, and each context read spends from a fixed matching budget. When the budget runs out, every path not yet decided counts as private, the answer sets `privacy_limited`, and the context block and the panel say the ignore rules were too costly to check in full. The budget is 20 million units: each positive rule and path pair costs its rule length plus 64 (a negated rule is skipped without a charge), and each match step costs the path positions it visits. A read that loads more than 2,000 rules from the `.gitignore` files it consults stops the same way. The budget bounds the work a read does, not its time on every machine. On Zo the slowest case measured, 1,999 rules against 200 files, stopped at the budget in about 1.7 seconds. Outside brackets a backslash escapes the next character. A differential test checks this against `git check-ignore`. The engine checks `.gitignore` files only. It does not read `.git/info/exclude` or global Git excludes, so a rule kept only there does not make memory private. Agents receive facts as labeled information in the per-message project block, never as instructions. Project chats do not get Native's owner-wide `resources`, `save-memory`, `delete-memory`, or `chat-history` actions, or its database tools `db-schema`, `db-query`, `db-exec`, and `db-patch`, because those stores have no project column and SQL could read the owner-scoped resources table. Native drops the framework prompt lines that name the tools, but its resources context note stays in the prompt, so the Full chat project block says the tools are unavailable. Personal and legacy chats keep them. |
| Project identities and bindings | Workbench registry tables in private Native-backed application data. The server checks actor, collection, device, policy, and observed root before effects. |
| Conversations, runs, and approvals | Native records in private application data. Workbench stores references and project scope rather than copying full transcripts into a second store. |
| Unattended automation runs | Scheduled, event, webhook, and Run now runs execute in the Vivary server process with no one present to approve a step. The owner decided on 2026-09-26 that they are local-only, and the maintained Core patch enforces it with an allowlist. A run gets 12 Native tools: `resources`, `save-memory`, `delete-memory`, `chat-history`, `manage-progress`, `manage-notifications`, `manage-jobs`, `manage-automations`, and four lookups over files bundled with Core. It cannot send email or messages, reach the web or other agents, call MCP tools, change settings, jobs, or automations, or read or change agent profiles, remote agent manifests, or MCP configuration. It cannot pass an argument its tool does not declare. Notifications from a run reach the in-app inbox only. An automation that lists MCP tools fails before any model call, because an approval cannot be granted after the fact in an unattended run. A run can still read and change other resources, memory, chat history, and progress. Two outward paths stay, and only the owner sets them from a chat or the app: reply delivery to the automation's delivery platform and dispatch to a paired execution host. Interactive chats keep their tools. The [patch notes](../packages/workbench/patches/README.md#local-only-automation-runs) own the allowlist and the refusals. |
| CLI credentials and logs | Stay in each provider's supported location. Vivary references native sessions. A coding runtime runs commands its agent chooses. [`local-runtime-setup.ts`](../packages/workbench/server/local-runtime-setup.ts) builds the Codex launch and the CLI status checks from the host environment without any credential-shaped name, in any letter case. A name is withheld when it contains PASSWORD, PASSWD, SECRET, TOKEN, APIKEY, CREDENTIAL, CONNECTION_STRING, CONNECTIONSTRING, COOKIE, or WEBHOOK, when one of its `_`-separated words is KEY, KEYS, PASS, PAT, or DSN, when its last word is AUTH, or when a URL or URI word follows a word that ends in DB or starts with DATABASE, DATASOURCE, POSTGRES, PG, MYSQL, MARIADB, MONGO, REDIS, KV, BROKER, AMQP, or CLOUDAMQP. It is also withheld when it is `MCP_SERVERS`, `MYSQL_PWD`, `DOCKER_AUTH_CONFIG`, `GIT_CONFIG_PARAMETERS`, or `BW_SESSION`, when it starts with `OP_SESSION_`, or when it belongs to Git's `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_n`, and `GIT_CONFIG_VALUE_n` group, which is withheld whole because Git needs complete pairs. Five names that match stay, because tools need them and they hold no secret: `GCM_CREDENTIAL_STORE`, `GCM_AZREPOS_CREDENTIALTYPE`, `NUGET_CREDENTIALPROVIDERS_PATH`, `COOKIECUTTER_CONFIG`, and `TIKTOKEN_CACHE_DIR`. That covers Native provider keys, the sign-in secret, secret-store keys, and the conventional names of integration secrets. A credential under an unconventional name still passes. Proxies, locale, and most toolchain paths pass through, including a proxy URL that carries a user name and password. A path whose name matches the rule, such as `PASSWORD_STORE_DIR`, is withheld. A user's own token variables, such as `GITHUB_TOKEN`, are withheld too, so each CLI uses its own login. Claude Code turns receive only Agent-Native's short allowlist. The filter controls what a runtime inherits, not what it can reach. The runtime runs as the same operating-system user, so a determined command can still read the private data folder, including the sign-in secret file and the database, and the environment of the Vivary processes that started it. App-invoked original command receipts go to private application data. |
| Credentials in shown, stored, and model-bound text | Issue #97. Vivary replaces a credential with a placeholder before text reaches a model, storage, a log, or the screen. [`credential-redaction.ts`](../packages/workbench/server/credential-redaction.ts) holds the values Vivary knows: credential-named server environment settings, named by the same rule as the coding runtime filter, values in the Agent-Native secret store, legacy credential settings, and the credential environments and headers in `mcp.config.json`. A JSON bundle adds its credential-named fields, a `Bearer` value adds its token, and a URL adds its password and its credential-named query values, or its whole address when the setting is a webhook. Values under 16 characters, numbers, booleans, hosts, ports, `file:` URLs, base URLs, and paths in settings named for a path, file, or folder are not held. The set reloads at startup, after each secret write or delete, and before each Native chat send and each Code send. An exact held value, or its URL-encoded, JSON-escaped, or base64 form, becomes `[redacted NAME]`. Pattern rules turn formats Vivary does not hold into `[redacted credential]`: `sk-`, Stripe live, GitHub, GitLab, `AKIA`, `AIza`, and `xox` tokens, JSON Web Tokens, `Bearer` tokens that look like tokens, URL passwords, and credential-named assignments such as `OPENROUTER_API_KEY=...`. Assignments skip names that print ordinary data: identifiers, names, paths, addresses, expiry times, pagination tokens, and public, cache, storage, and idempotency keys. A webhook-named assignment whose value is a URL is redacted. Every rule scans a line in linear time. The maintained Core patch applies the registered redactor to a whole Native tool result before truncation, so the model, the screen, and the run journal share one redacted string, and to tool error text, the recovered-result ledger on write and replay, every run event before it is kept or stored, the saved provider-failure message, saved and forked threads, earlier turns the browser sends back, automation run errors and last errors, and Code transcript events and run records. A streamed text, thinking, or tool-input delta keeps back its last word or two, up to the longest held form plus 256 characters and at most 16,384, so a value split across deltas is redacted whole. Vivary redacts the per-message project context block, Codex approval cards, original command output and component receipts, and every server stdout and stderr write. For Codex and Claude Code runs, the host sends the coding worker salted fingerprints of the held forms, never the values, because the CLI it starts can read the worker's memory. A fingerprint is a form's length, 20 bits of a keyed rolling hash of its first 16 characters, a salted SHA-256 digest, and its placeholder. A credential typed into a chat reaches the model in the turn it is typed. Later turns, saved threads, and forks get the placeholder. Limits: pattern matching misses hex, reversed, line-split, and partial prints, compressed or custom encodings, base64 of values Vivary does not hold, and secrets with no known format, and it does no entropy detection. It can redact text that only looks like a credential, and a model that rewrites a file it read can write the placeholder back. Events stored before this change keep their text. The Codex or Claude CLI still sends raw tool output to its own provider and keeps its own session files. The worker still inherits the server environment until issue #98 removes it, and anything that can read the worker can test guesses against a fingerprint's digest, which finds a weak held value of 16 or more characters. Core's `captureError` forwards a raw error message to a configured tracking or error-reporting provider, which stays inactive without telemetry. The desktop startup error dialog shows server startup errors, which are Vivary's own messages, without redaction. The [patch notes](../packages/workbench/patches/README.md#credential-redaction) own the Core call sites. |
| Search results and indexes | Project file search reads the authorized folder with bounded work. A future derived index is rebuildable and belongs in private application data. |
| Preview processes | Start only from reviewed project commands. Preview content is isolated from privileged Workbench state. Stop and host shutdown own cleanup. |

The local desktop server binds to loopback and opens without a Vivary login. Hosted mode uses Native authentication. The private Zo preview uses its owner-login proxy boundary. Remote access to a user's host remains an explicit, authenticated setup requirement, with real-phone and revocation acceptance still open. [`local-access.ts`](../packages/workbench/server/local-access.ts) owns request checks. The [host decision](product/multi-project/design.md#host-and-browser-access-decision-2026-09-13) owns the product boundary.

The Electron window accepts its local server origin, isolates the renderer, denies browser permissions and downloads, and routes a small set of setup links externally. A project grant does not bypass CLI-native permissions. A prompt containing a path is not filesystem isolation. The selected harness may send supplied model context to its provider. Local storage does not imply offline model inference. The [runtime isolation decision](product/multi-project/design.md#runtime-ownership-and-isolation) and [desktop host](../packages/desktop/main.mjs) own those limits.

## Delivery and known gaps

The unified workspace, project registration and selection, scoped Code and Native history, bounded files and search, reviewed project preview, bundled original CLI, and selected original operations have implemented and tested slices. The [acceptance register](product/multi-project/desktop-acceptance-status.md) states their candidate-specific evidence. A passing component or source check does not complete the desktop and browser release journey.

Issue #19's five project read reports entered `dev` in PR #89. Its receipt records hosted fake-provider proof and the Windows packages, including the final `e6ccddf5` package, which passed the panel reads and the agent turn. PR #94 recorded that result, and the owner closed issue #19 on 2026-09-26. PR #90 added [route-question research](product/multi-project/research/tropo-find-route-questions.md) only. It did not change Tropo's public path refusal or MCP privacy rules.

Issue #20 adds public Review and Impact to the project read tool and adds a second agent tool, `vivary-project-evaluate`, for decide and four control operations, with an owner Evaluate panel. PR #95 merged it into `dev` as `7fb73bd`, and the owner closed issue #20 on 2026-09-26. Its [receipt](product/multi-project/receipts/09c-original-review-control-tools.md) records three review rounds and a 22-step hosted fake-provider journey that passed three runs in a row on `33cbcbb`. The unpublished `1249572d` Windows package passed the panel checks and a 14-check agent turn with a fake provider. No real provider turn has run. Native has no capsule producer, so an agent decide needs a capsule the owner hands over, and the server copies the workspace fingerprint from that capsule, which makes Strato's workspace match a self-consistency check only. Ozone's Tropo floor and the front door's Ozone floor must rise when those packages release, because the public paths need Tropo's `public_graph`. The bundled app ships all packages from one source tree and is not affected.

Issue #21's scoped file memory is implemented. Code and Full chat load each project's instructions, state, and facts per message. Its [receipt](product/multi-project/receipts/18a-scoped-file-memory.md) records an 11-step hosted journey that passed three runs in a row on the final code commit `285f65c` with a fake provider, a real Codex check that passed on `22d4cc0`, and a packaged Windows Full chat journey on the `90ab1eb` merge. No real Claude or Native-provider turn has run, and no Code run was part of the Windows check. Chat-content search, a generic grouped harness catalog, linked cross-harness conversations, concurrent root runs, and complete GUI/agent coverage of all original operations remain open. Real Native-provider turns passed under issue #50 on the unpublished `265a7ede` Windows package, with OpenRouter and the project read and evaluate tools, and its [receipt](product/multi-project/receipts/50-real-native-provider.md) records the limits that remain. Automations passed their lifecycle journey under issue #51 on the unpublished `c096528a` Windows package, and the [#51 receipt](product/multi-project/receipts/51-automation-lifecycle.md) records the journey and the limits that remain. Authenticated phone routing, revocation and reconnect, packaged preview behavior, upgrade and removal, and final Windows acceptance remain release work. The [release target](product/multi-project/desktop-release.md), [module catalog](product/multi-project/specification/modules.md), and live issues own the precise current status.

## Maintaining this document

This page owns the full-product structure, data owners, trust boundaries, and cross-component flows. Detailed contracts and source paths live in the [module catalog](product/multi-project/specification/modules.md) and [source map](product/multi-project/source-map/index.md). Product decisions live in [design.md](product/multi-project/design.md). GitHub issues own goals, acceptance, dependencies, and lifecycle. Update those owners with this page when their facts change.

For a relevant source, configuration, or documentation change, update this page in the same commit. When the change alters architecture, revise the affected description, diagram, flow, boundary, or gap. When an internal change leaves the described architecture true, update **Last change review** with the concrete changed area, why the description still holds, and the evidence checked. A timestamp or whitespace change is not a review. The [maintenance skill](../.agents/skills/maintain-hldd/SKILL.md) gives the review steps. The staged checker, `python scripts/check_hldd.py --staged`, and the branch checker, `python scripts/check_hldd.py --base <ref> --head HEAD`, enforce a substantive document update. They do not judge architectural truth. Human and agent review do that. No commit hook rewrites this page automatically.

The application bundles this document at build time and exposes it through
Settings > Documentation. The reader uses the existing read-only Markdown
component. Its text remains available offline. Source and detailed-reference
links open online through the browser or desktop's existing confirmation flow.
No documentation route reads arbitrary host files.

## Last change review

The #97 receipt and a Credentials row in the acceptance register record the packaged Windows redaction
check on `88b60dd9`. Documentation only, so the design description holds.

Issue #97 second review. Pagination names are exempt only when a TOKEN name has a whole PAGE, NEXT, CONTINUATION, or
CURSOR word, so names such as NEXTAUTH_SECRET and CURSOR_API_KEY redact again. Webhook-named assignments with a URL
value redact, and a dotted held value with digits in its last label is held rather than read as a host. The redaction
tests run once in CI, in the sequential maintained suite. The credentials row states the webhook rule.

Issue #97 review fixes. A reviewer measured the URL password pattern at 30 seconds for a 256 KB line, so every redaction
pattern is now bounded and held values are found by a rolling hash on the server as in the coding worker. The
recovered-result ledger, tool-input deltas, earlier turns the browser sends back, forked threads, automation last errors,
and Codex approval cards are redacted, and the held set reloads after each secret write. The credentials row states the
new name filter, the path and query rules, the delta holdback, the added token formats, and the tracking and fingerprint
limits.

Issue #97 now covers Code runs. The host sends the coding worker salted fingerprints of the held credentials, the worker
registers a redactor built from them, and the Core patch redacts Code transcript events and run records before they are
written. The credentials row in the data and trust boundaries table states the fingerprint contents and the limits that
remain, and the patch notes and the Workbench README describe the change.

Issue #97 adds credential redaction to Native chat, tool and provider error text, run events, saved threads, automation run
errors, the project context block, original commands and receipts, and server output. The data and trust boundaries table
gains a row that names the held values, the pattern rules, each redacting surface, and the limits. The patch notes, the
Workbench README, and the Windows install guide describe the change. Code runs follow in a separate commit.

Issue #51 is closed. PR #116 merged into `dev` as `c39e22f`, and the owner accepted the packaged
automation run on 2026-09-27. Its receipt, the acceptance register, the release target, and the
Workbench README now record the merge and closure. Documentation only, so the design description
holds.

`.gitattributes` now disables only the trailing-whitespace rule for maintained pnpm patches
under `packages/workbench/patches/`. A patch writes a blank source line as a single-space context
line, and the #51 Core patch is the first to change text next to blank lines, so CI's
`git diff --check` flagged those required spaces. Repository tooling only, so the design
description holds.

The #51 receipt, the acceptance register, and the release target record the packaged Settings
retest on `f0c3cac0` and correct which commits had independent reviews. Documentation only, so
the design description holds.

Issue #51's receipt records the packaged automation lifecycle run on the unpublished
`c096528a` package, the Zo check with no client connected, the three defects fixed on the
branch, the review rounds, and follow-up issues #108 through #115. The acceptance register,
the release target, the Workbench README, the delivery section above, and the Windows
install guide now point at it. The install guide gains an Automations section and four
troubleshooting entries. The data and trust boundaries table already describes the
local-only automation boundary. Documentation only, so the design description holds.

Issue #51 review fixes for the Settings prompt handoff. The hook no longer
treats a project list that is still loading as Personal workspace. A prompt sent
then waits for the projects, up to Core's eight-second buffer, and switches away
from the saved project before the Native chat opens. If the projects never load,
it switches nothing and shows the could-not-switch alert. A missing or unreadable
saved project also counts as not Personal. Core's immediate rejections, a
disabled composer or a failed thread create, now show the not-delivered alert at
once through the public `AGENT_CHAT_SUBMIT_RESULT_EVENT`. Prompts sent together
share one project switch, so the second request cannot make the first fail. The
alert moved to
[`SettingsPromptAlert.tsx`](../packages/workbench/app/components/layout/SettingsPromptAlert.tsx).
It moves focus to the prompt text, selected, and returns focus on Dismiss. It
also says when the browser blocks the clipboard. The handoff still routes an
existing Core flow into the existing Native chat, so the design description
holds. Evidence: `settings-chat-handoff-component.test.mjs` grew from 4 to 8
cases. On the previous commit, the 4 new cases and the extended alert case fail,
and all 8 pass on this one. The CI node steps, the workbench typecheck, and the
maintained checks pass on Zo.

Issue #51 fixes the Settings controls that ask the agent. New automation on
Settings > Agent > Automations, including its empty-state and Organization
forms, and the Resources create menu's Create Automation, Schedule Task, and
describe paths for Create Skill and Create Custom Agent call Core's
`sendToAgentChat`. It posts the prompt to this window and buffers it for eight
seconds. `Layout.tsx` mounts the workspace, and with it every chat, only outside
`/settings`, so nothing received the prompt and it was lost. The new
[`settings-chat-handoff.ts`](../packages/workbench/app/lib/settings-chat-handoff.ts)
hook, mounted by `Layout.tsx`, listens only under `/settings`. It switches an
active project to Personal workspace and opens
`/?runtime=native&history=project`, where Core's Native chat replays the
buffered prompt into a new Personal thread and appends its context once. A
failed switch, or a prompt that no chat claims within the buffer, shows an alert
with the prompt and Copy prompt. The change routes an existing Core flow into the
existing Native chat and adds no component, flow, or trust boundary, so the
design description holds. Evidence: the new
`settings-chat-handoff-component.test.mjs` renders `Layout` with Core's real
`sendToAgentChat`. It fails on the previous `Layout.tsx` and passes its 4 cases
on this one. The CI node steps, the workbench typecheck, and the maintained
checks pass on Zo. A local-mode `bin/start.mjs` check on Zo with a fake provider
and headless Chromium had project Alpha active, submitted New automation, and
reached a Personal Native thread in 0.6 seconds. The model received the prompt
with one context block, the reply rendered, no alert appeared after 9 seconds,
and the database recorded the thread under Personal workspace. The Organization
form took the same route and carried its organization context.

Issue #51 review fixes for the Run now change. The in-process runner now
registers with its app id and handles only that app's rows and legacy rows with
no app. Another app's rows that share the database keep self-dispatch and are
not ended late. A failed in-process run is logged once. A queued row can still
start up to the claim lease after the click, 15 minutes by default or 1.5 times
`AGENT_BACKGROUND_RUN_HARD_TIMEOUT_MS`, and only a process with a registered
runner ends older rows. The reviewed startup window does not occur, because the
readiness gate holds the actions, agent-chat, A2A, and MCP paths until the
plugin init that registers the runner settles. Core still owns automation
execution, and no Vivary component, flow, or trust boundary changes, so the
design description holds. The same commit closes a bypass of the local-only
refusals: a run could pass an argument named `path=jobs/x.md`, which Core's
CLI bridge read as a second `--path` flag after the check had passed. Runs now
pass only declared argument names without `=` or a leading `-`, and the bridge
passes a run's values inline. Runs also cannot read configuration files or use
a memory name with a path in it. Evidence: `automation-run-now.test.mjs` grew from 3
to 8 cases, 3 of the new cases failed on the previous patch, and all 8 pass.
The CI node step, the workbench typecheck, and the maintained checks pass on Zo.
A local-mode `bin/start.mjs` check on Zo repeated the local-only results,
refused a run's crafted `path=jobs/crafted.md` argument, and found only the two
test automations under `jobs/` in the database afterward. A
Run now sent the moment the restarted server accepted a connection returned
HTTP 200 and ran in process, with no redelivery or self-dispatch error in the
log. The
[patch notes](../packages/workbench/patches/README.md#in-process-run-now)
record the details.

Issue #51 makes unattended automation runs local-only, as the owner decided on
2026-09-26. This changes a trust boundary, so the data and trust boundaries
table gains an automation-run row. Scheduled, event, webhook, and Run now runs
now get 12 allowlisted Native tools instead of the whole background surface.
They cannot send email, reach the web or other agents, call MCP tools, or change
settings, jobs, automations, agent profiles, remote agent manifests, or MCP
configuration. An automation that lists MCP tools fails before any model call.
Interactive chats keep their tools. Reply delivery and paired-host dispatch stay
as owner-configured outward paths. Evidence: the new
`automation-local-only.test.mjs` failed 7 of 7 on the previous patch and passes
7 of 7 on this one, and the CI node step, the workbench typecheck, and the
maintained checks pass on Zo. A local-mode `bin/start.mjs` run on Zo with a
fake Builder gateway and no real provider key showed Run now offering the
allowlist (11 tools, because this build has no `source-search` corpus),
refusing a scripted `web-request`, automation define, and `jobs/` write with
nothing sent or written, and failing an MCP automation with the named error
and no model request, while an ordinary chat kept `web-request`,
`call-agent`, and `resources`. The
[patch notes](../packages/workbench/patches/README.md#local-only-automation-runs)
record the allowlist, the refusals, and the configuration paths a run cannot
change.

Issue #51 changes the maintained Core patch so Automations > Manage > Run now
runs inside the server process that owns the recurring-jobs timer. Before, Core
sent Run now back to itself over HTTP, which needs an app URL and `A2A_SECRET`
that the packaged app does not set, so every click failed and the queued-run
sweep retried the row forever. Where an in-process runner is registered, the
sweep now ends that app's queued row once it is older than the claim lease (15
minutes by default, or 1.5 times `AGENT_BACKGROUND_RUN_HARD_TIMEOUT_MS`), so a
row can still start up to that long after the click. The interruption message
no longer blames a serverless worker. This page describes automations only as release
work that depends on Native execution. Core still owns automation storage,
claims, and execution, and the change adds no Vivary component, flow, or trust
boundary, so the design description holds. Evidence: the new
`automation-run-now.test.mjs` failed on the previous patch and passes on this
one, the workbench typecheck and maintained checks pass on Zo, and a local-mode
`bin/start.mjs` run on Zo with no provider key returned HTTP 200 for Run now.
Its row left `running` with a thread, ended at the model step with "No LLM
provider is connected", and the log had no redelivery retry. The
[patch notes](../packages/workbench/patches/README.md#in-process-run-now)
record the change.

Issue #50 is closed. PR #100 merged into `dev` as `8a5d262`, and the owner
accepted the packaged run on 2026-09-26. Its receipt, the acceptance register,
and the release target now record the merge and closure, link the seven
follow-up issues, and mark issue #51's prerequisite as met. Documentation only,
so the design description holds.

Issue #50's receipt, the acceptance register, the release target, the Workbench
README's Native provider setup, and the delivery section above record the packaged
Windows run. Documentation only, so the design description holds.

The packaged Windows run for issue #50 found a third defect. Core replays the
earlier turns of a Native chat with generated tool-call ids, `history_tc_<n>`
and `continuation_tc_<n>`. Some providers reached through OpenRouter keep only
the first nine characters of an id, so those ids collided and every follow-up
after a turn with several tool calls ended with `provider_unavailable`. A
direct replay of the logged request confirmed that ids differing within nine
characters pass. The maintained Core patch now generates nine-character
alphanumeric ids, `h` or `c` plus eight base-36 digits. Core still drops the
provider's in-stream error text and shows only "Engine stream error", and the
Send button has no accessible name. Both are recorded for their own issues. No
flow, owner, or boundary changed.

Issue #50 found two defects that stopped real Native providers in the
packaged app. Agent-Native bakes the names in `packages/workbench/package.json`
`dependencies` and `optionalDependencies` into the built server, and treats an AI SDK engine as installed
only when its packages are on that list. Vivary declared none of them, so every
AI SDK provider, OpenRouter included, read as not installed in the package
although its code was bundled. The workbench now declares `ai` and the seven
provider packages core maps (`@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/groq`,
`@ai-sdk/mistral`, `@ai-sdk/cohere`, `ai-sdk-ollama`, and
`@openrouter/ai-sdk-provider`) at the versions already locked through core.
`@ai-sdk/anthropic` stays out, because core hides that engine and Claude runs
on its native engine. Second, the Native picker never offered a custom model
saved in Settings, and a new chat took the first model of the first configured
provider. The maintained Core patch now marks whether a stored setting or an
app default chose the current model, or Core detected the engine. A chosen,
configured provider and model become the new-chat default, and the chosen model
is listed even when the built-in list lacks it. A detected engine keeps Core's
order, no model is added to a provider without a key, and with the Builder
gateway lane Builder stays first. A project's stored composer pick yields when
the chosen engine or model in Settings changes. Open chats are pinned to it
first, so a chat already open keeps its model for the rest of the session. Native still owns engines, credentials, and requests, so no flow, owner,
or boundary changed.

Packets 09b and 09c now record the owner's acceptance of #19 and #20 as
done, with `Verification-result: passed`, and the generated graph and frontier
follow. The delivery section above already states both closures, and no
structure, flow, or boundary depends on packet status, so the description
holds.

A Codex tool shell could read the credentials in the server environment.
`resolveVivaryRuntimeCommand` built the Codex launch from a copy of that whole
environment and removed only two credentials, `CODEX_API_KEY` and
`OPENAI_API_KEY`. The environment holds the Native provider keys that
Agent-Native reads, and the sign-in secret and database URLs that
`bin/start.mjs` sets. With no dedicated secret-store key, Agent-Native derives
the key that encrypts saved provider credentials from that sign-in secret. A
deployment can add more: Agent-Native reads well over a hundred credential
names, from database tokens to OAuth client secrets.

`codingRuntimeEnvironment` now builds the launch for Codex runs, the Codex
model list, and the CLI status checks. It withholds every credential-shaped
name by rule, compared in upper case because Windows environment names are
case-insensitive, and keeps ordinary settings. Review round 2 widened the rule
to fragments inside names, such as `PGPASSWORD`, to `MCP_SERVERS` and
password-bearing database URLs, and made Git's config pairs leave together,
because a split pair makes Git exit with status 128. Round 3 added the
Bitwarden and 1Password session variables, broker and datasource URLs, and
`GIT_CONFIG_PARAMETERS`, kept five tool settings the rule matched, and replaced
the database URL pattern with a linear check over the name's words. Claude Code turns were already
limited to Agent-Native's allowlist, because Vivary passes Claude Code no
environment. The status check for Claude Code now also runs without
`ANTHROPIC_API_KEY`, which its turns never receive either.

The CLI credentials and logs row states the rule and two limits. A user's own
token variables no longer reach coding runtimes. A same-user command can still
read the private data folder and its parent processes' environments, so the
filter stops inheritance, not access. On Linux a process shows the environment
it started with. The coding worker that starts Codex still starts with the
whole server environment, including the sign-in secret, because it reads MCP
settings from the database and decrypts their header secrets. Moving that
read into the server would let the worker start without credentials. No
flow, owner, or package dependency changed. Evidence on Zo: at `7fb73bd` one real Codex turn with random dummy
values reported every seeded credential readable in its tool shell. With the
rule, the launch carried none of them, the tool shell reported each unreadable
except one name the host's own interactive shell setup defines outside Vivary,
and an ordinary variable still arrived. The launch tests cover mixed-case
names, ordinary settings that must stay, and every provider in Agent-Native's
provider list.

Issue #20 exposes Ozone review and impact, Strato decide, and Exo control to
the owner and the Native agent. Flow 5 and the delivery gaps above describe
it. The review, by layer:

- Engine: Tropo adds `public_graph`, which builds nodes and edges only from its
  privacy-filtered document snapshot and counts ids over 256 characters as
  `unsafe_identifier`. Ozone adds `public_review` for the Structure and
  Editorial packs and `public_impact`, whose private, missing, or unknown
  target raises Tropo's `TargetUnavailableError`. Findings drop Ozone's
  free-text message, and a broken-edge finding drops its target. Ozone loads
  one cached Tropo engine on first use for both paths, and a missing Tropo
  keeps the front door's install hint. The front door adds `review --public`
  and `impact --public`. Plain review and impact output is unchanged. Strato,
  Exo, and Core policy code did not change. Their new tests only pin that the
  agent actor is accepted as a contributor and refused as an owner.
- Workbench service: `project-read.ts` gains review and impact rows that parse
  every field strictly and accept only rules from Ozone's public rule list.
  `original-runtime.ts` moves review and impact to the read schema and decide
  and control to a governed schema. `vivary-original-command` keeps create,
  adopt, and pattern-state. The runner binds the actor from the caller, and a
  tool call runs the read verbs and the governed commands only.
  `governed-request.ts` derives the agent id, builds the whole Strato or Exo
  document, and holds the positional path codec. `project-evaluate.ts` checks
  the boundary, runs the evaluation, and names Strato or Exo as the refuser
  when Core refuses inside an ordinary result. An agent's paths are checked by
  text only, so no agent result depends on which files exist.
- Actions: `vivary-project-evaluate` is an agent tool with `readOnly: false`,
  because control takes the project's write lock, `dedupe: false`, and a
  70-second timeout. `vivary-project-evaluate-owner` is the owner action. Both
  are registered in the owner and Native action lists. The #21 review below
  says the Full chat model sees one Vivary tool. From #20 it sees two,
  `vivary-project-read` and `vivary-project-evaluate`.
- Panel: Project details gains Review and Impact sections after Find, and an
  Evaluate panel with Decide and Control. The panel has no actor, project,
  authority, or clock field, names who evaluated each result, repeats the
  server notice, and shows every refusal as an alert.
- Documents: the 09c packet log, the receipt, the acceptance register, the
  release target, and the Native owner map describe the same slice.

The data and trust boundaries table holds without a new row. An evaluation
saves nothing and returns `persisted: false`, so no new data owner exists.
Each child run's receipt goes to the private receipt log under the existing
CLI credentials and logs row. Refusals before a run write no request file and
no receipt. Project files are not written, and the hosted journey checks the
tree hash. Ozone already depended on Tropo, so the package dependency map is
unchanged. Flow 5's sentence that governed writes keep their own plan,
authority, and receipt rules holds, because no Strato, Exo, or Core policy
code changed.

Evidence: the Tropo, Ozone, front-door, Strato, Exo, and Core control Python
suites, and the Workbench `project-evaluate`, `project-evaluate-form`,
`project-read`, `original-runtime`, `native-actions`, and
`native-chat-project` tests, with `typecheck`. The evaluate tests run real
Strato and Exo through Python, and a differential test matches the codec to
Core's own path normalizers on six Windows roots. A three-model review of
`e96871d` and a two-model review of `24461c0` found the issues that
`5aa6aa6`, `24461c0`, and `33cbcbb` fix, and a third review of `33cbcbb`
found no new issues. On `33cbcbb` the packet's pytest command passed 275 tests,
the Tropo and front-door suites passed 291 with 215 subtests, the CI tsx lists
passed 69 and 383, the CI node lists passed 28 and 12, and `typecheck` passed.
The 22-step hosted journey passed three runs in a row on `33cbcbb`. The
[receipt](product/multi-project/receipts/09c-original-review-control-tools.md)
holds that evidence. The unpublished `1249572d` Windows package, built from
`1249572`, which adds only documentation to `33cbcbb`, passed the panel checks
and a 14-check agent turn with a fake provider.

Issue #21 adds scoped file memory. The runtime flows, the data-boundary row,
and the known gaps above describe it. The review, by layer:

- Engine: Tropo adds the built-in `vivary_fact` type for `.vivary/knowledge`
  and the memory role paths after every owner table and overlay merged, in
  both `_compose` and the public config path, so Doctor and Note check agree.
  An owner type that names a fact folder by path or basename wins, and a
  role path without `/` types only the root-level folder. `workspace_context`
  reports roles, the state file, the effective memory folders, and the
  declared protected paths from configuration. The creator adds which memory
  folders, law files, state file, fact files, and candidate new files the
  `.gitignore` files ignore, with fail-closed matching, every `.gitignore`
  it consulted, and the Markdown file names it checked in each memory folder. The bridge serves this as the read-only `context` operation,
  and no absolute host path leaves it. No public CLI verb or Doctor output
  changed, and Doctor keeps its own matching.
- Workbench service: `project-memory.ts` caches that answer by the digest of
  `.vivary/workspace.toml`, with a fingerprint of every consulted `.gitignore`
  (a missing one counts) and the file names in each memory folder. It reuses
  an answer only when the fingerprints taken before and after the engine call
  match and the fingerprint still holds, never caches an invalid answer, and
  logs a bridge failure without a host path. It refuses reserved, protected,
  boundary, ignored, non-portable, linked, and blocked paths, compares paths
  without regard to case, skips ignored and unreadable fact files, and renders
  one block of at most 8,000 characters: header, state, a 1,500-character
  floor for instructions, facts up to 4,000 characters, then the rest for
  instructions. Law files past the first three are named only when policy and
  privacy allow them, so a private, boundary, protected, or non-portable one is
  never named.
  When the instruction room is too small for the files, one line names them
  instead, and when that does not fit the section is left out, so the block
  never cuts facts. Each fact field is
  clamped to the panel's save limits (title 120, text 500, source 200), and
  every path is escaped, neutralized, and bounded, with "and N more" lists.
  Writes admit folders from the cached listings and read no fact, law, or
  state file. `project-files.ts` gains a capped folder listing, a listed-file
  read, a content digest, exclusive Create that removes the folders it made
  when it refuses, and version-checked Remove. Unlink and rename, including
  the file tree's Rename, retry a lock, then return a fixed message. A lock is
  EBUSY, EPERM, or EACCES on Windows and EBUSY elsewhere. Elsewhere EACCES and
  EPERM are a permission refusal with its own fixed message. The last load is kept per
  project binding.
- Runs: Code sends put the full block before the engine prompt every turn,
  record `projectContextRevision`, and append a `note` event that Native's
  transcript builder renders. `renderForRun` and `recordLoad` are separate, so
  a refused send leaves the last load alone. Full chat wires `extraContext`
  and `resolveActionSurface`, each classifying the pinned scope as the send
  guard does, and denies the memory, resources, chat-history, and database
  actions. A test resolves the surface against the names Native registers.
  A request-scoped surface makes Native downgrade trusted production code
  execution to sandboxed. Workbench runs Full chat with code execution off,
  so nothing changes today, and a test pins that.
- Panel: the Memory section in Project details uses two owner actions that
  are not agent tools, so the Full chat model still sees one Vivary tool. It
  keeps the owner's draft on every write conflict and turns a Correct whose
  file vanished into a Remember, stays busy until the list reloads, starts
  Forget with focus on Cancel, marks shortened and skipped facts with their
  reasons, reads again when Project details opens, and says the preview is
  the Code form.
- Documents: the Tropo specification, the original CLI reference, the
  module catalog, the Native owner map, the write-back source map, and the
  18a packet log describe the same slice.

Evidence: Tropo, creator, bridge, Cognee forget, project-files,
project-memory, local-code-agent (`started.json` prompts and Native's
transcript builder), project-read, and typecheck. The native chat unit tests
cover the `extraContext` and action-surface closures with stubbed scope and
project reads. The hosted journey with the recording fake provider covers the
real Full chat request, including a restart, and one real Codex conversation
recalled and then corrected a fact. The
[receipt](product/multi-project/receipts/18a-scoped-file-memory.md) holds that
evidence and its observations. The `90ab1eb7` Windows package later passed
the Full chat memory journey.

After that QA, `17e2996e` made a resumed Codex turn send the full block
again when the run's previous turn failed, stopped, or was interrupted, by
rolling that turn's revision back. The review below replaced this with the
full block on every turn. Only the Full chat block names Native's owner-wide
tools. The revision is the hash of the Code form, so both surfaces share it.
A plain folder's panel no longer links to a missing `workspace.toml`, and the
bridge's host-path scrub keeps URLs. The hosted journey passed three more
runs and the real Codex check passed again on `17e2996e`, which includes these
changes. The fake provider now drops the Full chat tools sentence before it
hashes the block, because the revision covers the Code form.

The pre-merge review of PR #93 then changed behavior the hosted journey and
the Codex check exercised: the database tools denial, fail-closed memory
privacy and the Remember name check, the full block on every Codex turn, the
cache trust rule, the block budget, and the Windows path and lock handling.
Unit tests covered these changes first. The lead then reported that the hosted
journey passed three runs and the real Codex check passed on `2324e7f`, which
holds them.

The second review of `3e21310` and `2324e7f` closed gaps where memory failed
open or said the wrong thing. The creator's `context` answer now reports the
Markdown file names it checked in each memory folder, at most 200 of at most
4,000 scanned entries. The creator's `_CONTEXT_LISTED_FILES` and
`_CONTEXT_SCANNED_ENTRIES` sit beside a comment naming the Workbench's
`CONTEXT_BOUNDS.factsPerLocation` and `MAX_FOLDER_ENTRIES`, which hold the same
numbers. The Workbench loads, corrects, and forgets only those files, so a
file past the engine's list or created during its call is skipped as not
checked. A Forget of a file that a complete listing no longer has reports it
as already removed without reading it. The engine reads `.gitignore` with or
without a byte order mark and treats a positive rule with a bracket it cannot
parse as matching. Omitted law files are named only when policy and privacy
allow them, and
the instruction section fits its room. Conflict notices depend on the action,
so a Forget never mentions a draft. `settings.message` and every path escape
C0 and C1 controls and the Unicode line and paragraph separators. A path list
always shows its first item, shortened with its reason kept. Every memory
write failure, including a missing project folder or a folder listing error,
becomes a fixed message without a host path. A backslash in a memory folder is
non-portable, a Remember path over the 512 characters the Workbench answer
schema accepts is refused before the engine call, and the panel compares a taken title by the file name
it makes. The lead then reported that the hosted journey passed three runs,
after a fix to a race in the journey helper, and the real Codex check passed
on `865f39e`, which holds this round.

The third review of `865f39e` narrowed what the second one added. The bracket
rule it added fired on ordinary sets such as GitHub's Vim template
`[._]*.s[a-v][a-z]` or `[.]env` and on an escaped `foo\[bar`, so one root rule
could make every memory folder private. Only a POSIX class, an equivalence
class, or a collating symbol inside a bracket expression, or an unescaped `[`
that never closes, now counts as uncertain. The engine and the Workbench list
a memory folder with one rule set, so secret-looking names and bare `.md` no
longer push facts out of the checked set. The engine leaves out links and any
name the Workbench answer schema would refuse, so one odd file name cannot fail
the whole answer, and it caps `checked_files` at 3,000 paths and 96 KiB of
JSON. The Workbench compares checked paths exactly, reports links as linked
and uncheckable names as unsupported, and no longer tells the owner to retry
when retrying cannot help. Path lists count their ", and N more" inside their
limit, and fact text turns vertical tab, form feed, return, NEL, and the
Unicode line and paragraph separators into spaces. Unit tests cover this
round. The lead then reported that the hosted journey passed three runs and
the real Codex check passed on `a7251ea`, which holds this round.

The fourth review of `a7251ea` checked the bracket rule against Git 2.54.
Inside a bracket Git reads `\x` as a literal `x` and a `]` right after `[`,
`[!`, or `[^` as a member, while Python's `re` reads `[\d]` as a digit and
ends the set early, so rules such as `[\d]raft.md` or `[!][:alpha:]]*.md`
ignored files that memory still loaded. A bracket body with a backslash or
that starts with `]`, `!]`, or `^]` now counts as uncertain, so the rule
matches. Doctor's matcher is unchanged. Fact text now escapes every C0 and C1
control that it does not turn into a space, as titles and sources do. On
Windows the Workbench listing confirms a link-typed directory entry with
`lstat`, so only a real symbolic link or a junction counts as a link. Python's
`is_symlink()` leaves a junction out, so the engine does not check it and the
Workbench skips it as linked, which fails closed. The lead then reported that
the hosted journey passed three runs and the real Codex check passed on
`05bed13`, which holds this round.

The fifth review of `05bed13` compared memory's matcher with Git 2.54 and
found it still failed open in forms that predate that commit: negations such as
the `*` then `!*/` whitelist idiom, `[!a-z]*.md` against `Bob.md` on
case-sensitive Git, `mem**/*.md` against `mem/x.md`, `?` and bracket members
against multibyte names, and a lone carriage return, form feed, NEL, U+2028, or
U+2029 starting a new rule. Patching Git's grammar case by case had failed three
rounds, so memory's matcher now can only over-match. It ignores negations,
matches in exact case or without regard to case, reads an unbounded `**` as
crossing `/`, matches code points or UTF-8 bytes, and splits `.gitignore` lines
as Git does. A differential test in `test_init_thin.py` runs every case in
`MEMORY_PRIVACY_DIFFERENTIAL_CASES` through `git check-ignore --no-index` with
`core.ignorecase` false and true when Git is on PATH, and fails when Git
ignores a file that memory would load. Over-ignoring only counts. Against the
previous matcher it reports 19 such files. Doctor's matcher is unchanged. The
panel refuses control characters the context block would escape, so a
500-character panel fact is never cut. Unit tests and the differential test
cover this round. The lead then reported that the hosted journey passed three
runs and the real Codex check passed on `aa568d9`, which holds this round.

The sixth review of `aa568d9` ran randomized differentials against Git 2.54
and 2.43 and found three narrow forms that still failed open, plus a stall.
Git skips a whole run of stars before it decides whether the run is bounded,
so `***/foo` ignores `foo`. With `core.ignorecase` Git lowercases the path but
compares a literal member of a negated bracket as written, so `[!B]x.md`
ignores `Bx.md`. Git ends an entry at its first NUL. Memory now reads a run of
two or more stars the same whatever its length, treats a negated bracket with
an ASCII capital literal as uncertain, and ends an entry at a NUL. Rules such
as `a**` repeated ten times took minutes against an 81-character path in the
regex matcher, so memory's matcher now tracks reachable positions without
backtracking, and a rule over 1,024 characters is uncertain. The differential
test gains these rows and a seeded cross product of bracket bodies, letter
case, star runs of one to four, and four placements. On Zo's Git 2.39.5 it
checks 368 generated cases and 2,944 paths with no misses and 429
over-ignored, and 37 table cases and 90 files with no misses and 7
over-ignored. Against the previous matcher it misses 8 generated and 9 table
files. The same round also anchors a rule with a leading `/` to its folder, so
`/top.md` no longer matches `sub/top.md`. That over-match was safe but broader
than Git. The lead then reported that the hosted journey passed three runs and
the real Codex check passed on `0e9ae6b`, which holds this round.

The seventh review of `0e9ae6b` ran about 16,000 randomized cases against Git
2.54 in both case modes with no misses, and found the total matching cost had
no cap. Forty long rules against long, deep paths cost about 0.35 s per probe,
so a cold settings read over 3,000 paths could take minutes. Each context read
now spends from a fixed budget, `_MEMORY_MATCH_BUDGET`, counted in path
positions visited. When it runs out, every path not yet decided counts as
private and the answer sets `privacy_limited`, which the context block and the
panel report. The read also parses each `.gitignore` once and decides each
folder once, and a rule over 256 characters is uncertain. On Zo a typical
workspace with 2,128 fact files spends about 2.5 million of the 20 million
units in under a second, and 40 hostile rules against 238 long paths stop at
the budget in about a second instead of 73 seconds. The differential test gains
rows that use the repository's root `.gitignore`. Unit tests and the
differential test cover this round. The lead then reported that the hosted
journey passed three runs on `1bd2242`, which holds this round.

The final review of `1bd2242` found a regression and an unbounded cost.
The round skipped the either-case pass for a rule without cased characters,
but under `core.ignorecase` Git folds the path letter before it tests a
bracket range, so a range with uncased ends such as `[@-_]` still matches
letters. A rule with a bracket now always gets the either-case pass. The
budget also missed the fixed work of each rule and path pair: 600 distinct
rules against 300 paths took 10.8 seconds and 5,000 took 146 seconds without
touching it. Each positive rule and path pair now costs its rule length plus 64 units, the bracket
check and the parsed rule are cached per rule, and a read that loads more
than 2,000 rules stops and fails closed. On Zo 600 rules against 300 files now
take about 0.85 seconds and decide every listed file (a folder lists at most 200), and 5,000 rules stop at the
rule limit at once. The slowest case measured, 1,999 rules against 200 files,
stopped at the budget in about 1.7 seconds. The differential test gains rows
and a generated dimension for letter-free rules built from such ranges. Unit
tests and the differential test cover this round. The hosted journey and the
Codex check have not run on it.

The Codex GitHub reviewer then left 21 findings on the later pushes. The fixes
after `3205557`:

- Every memory write passes the binding it read from to project files, which
  refuse a different binding as `project-changed`. Remember also checks the new
  file against the fresh answer's memory folders and protected paths. The
  Details view and the Full chat block resolve the project again after the load
  and show the unavailable form when the binding changed. A Code send compares
  `policyRevision` too.
- A locked unlink or rename reads the file again before each retry and stops
  with `changed` when another program saved it meanwhile.
- Node has no `openat`, so a parent folder swapped for a link between the path
  check and a write can redirect it. After an exclusive create, a save's rename,
  or a file tree Rename, project files confirm the file is inside the root with
  no link on its path. A create or Rename removes the file it wrote, only when
  its path still reaches that same file without a link, and refuses.
  A save refuses, but the replaced file cannot be restored. Deletes work the
  same way: Remove, which Forget uses, and a Rename's source delete record the
  device and inode of the file whose version they checked, check every path
  component for a link again right before each unlink attempt, and delete only
  that file. Node also has no `unlinkat`, so a swap in the moment between that
  last check and the unlink can still redirect it. File identities are compared
  as bigints, so NTFS file IDs above 2^53 cannot collide.
- One load reads at most 4 MiB of fact and omitted law files, counting every
  file it reads, whether or not the file loads. Files past that
  are skipped with reason `read-limit`. Omitted law files are named only when they
  pass the same no-link, bounded-text admission as the first three.
- A `.gitignore` too large to hash or with several hard links keys the settings
  memo on its size, mtime, inode, and link count, so an edit re-probes.
- The creator bounds `ignore_files` at 4,000 and fails closed past it, scrubs
  UNC and extended-length Windows paths, returns `invalid` for a
  `.vivary/workspace.toml` that is a link or a folder, and probes folder privacy
  with an unlikely name. Tropo compares normalized owner folders, so
  `folder = "./facts"` wins over the role `facts`.
- A confirmed date must be a real calendar date. The panel clears its view when
  the project becomes unavailable and does not name a refused folder as the
  storage location. Remove also takes the file's identity a few system calls after its version
check, so a save by another program inside that window can be the file
Forget deletes. A follow-up covers taking the identity from the version check.

The lead then reported that the hosted journey passed three runs and the real
Codex check passed on `22d4cc0`, which holds these fixes.

Final verification of `22d4cc0` found two warnings and four nits:

- The cleanup after the post-write check deleted by path, so a folder swapped
  for a link after the write sent the delete to an unrelated file of the same
  name. Project files now keep the device and inode of each file they write.
  Before a cleanup delete they check every path component again and the file's
  identity, and they leave the file in place when either fails. A create and a
  Rename also confirm the binding after the write, and remove what they wrote
  when that check itself fails because the project became unavailable.
- The read bound counted only files that loaded, and a binary file was read
  twice. Each listed file is now read once, and every byte read counts.
- A write that finishes after the project became unavailable no longer
  refreshes the panel or reopens a draft.
- Tropo keeps a trailing `/` when it compares owner folders, since `type_for`
  does not match an owner folder written that way, so the fact type still
  covers it. Confirmed dates accept years 0 to 99. A lock error while a retry
  re-reads the file becomes the fixed locked message.

Unit tests cover these fixes. The hosted journey and the Codex check have not
run on them.

The review follow-up strengthens maintenance enforcement and documentation
navigation. Date-only bullets and emphasis do not count as substantive reviews.
Required sections must be visible prose headings, outside comments and fenced
examples. Git-index and history tests cover both cases. The document reader
resolves reference destinations in rendered links so ordinary activation,
middle-click, and browser context menus use the same target. Its sidebar footer
keeps Documentation, Settings, and search within the supported panel width.
The maintained CI test list now includes documentation-link behavior.

These corrections preserve the product intent, component ownership, and
acceptance boundaries above. The original package inventory and dependency map
remain part of this canonical design. Tests, the built reader, and source-link
checks establish the maintenance and navigation changes. Final Windows read-tool
acceptance remains with issue #19.

The multi-project evidence brief now links to stable architecture sections and
the owning Core, Exo, front-door, capability-status, and MCP contracts. Those
references replace line ranges invalidated by this consolidation. The linked
contracts and dispatch source confirm the same package boundaries. This reference
repair changes no runtime behavior or acceptance claim.
