# Planning audit and current execution risks

Recorded: 2026-09-05. This audit checks the plan's ability to guide work; it is
not product acceptance, a security certification, or a release result.

## Findings and dispositions

| Finding | Correction | Evidence or remaining owner |
| --- | --- | --- |
| Empty frontier and output files required before their own creation | Separate 36 outcome contracts from bounded packets; outputs are deliverables; independent contract packets can start | Generated graph, execution contract, packets 02a/03a/10a/10b, CI guard |
| Every future feature marked as missing information | Outcomes use planned/in-progress/done; only an exact packet prerequisite uses needs-info | Guard checks status and named Needs |
| Human PR review treated as blanket permission for preparatory work | Keep merge approval separate; contracts and fixtures use existing implementation authority | Execution contract and independent packet dependencies |
| BrowserPod proof scheduled after migration and architecture choices | Move compatibility inspection and the first live pod probe ahead of import | 10a and 10b; actual toolchain proof remains open |
| Historical implementation hidden by “not started” logs | Record preserved host/readiness work and historical verification; leave real BrowserPod and native runtime proof open | Native owner inventory and outcome 10 log |
| Optional connectors appear to block every start | Outcome edges gate full completion; packet edges gate starts; native/skip paths can proceed independently | Capability matrix and execution contract; full optional release coverage retained |
| Existing native tasks, sessions, plans, messaging, and automations omitted | Add an explicit native-owner inventory and require reuse before adding state | Native owners and source references |
| Manual graph could drift while checks stayed green | Generate table, completion edges, active packets, and frontier from the same records | Graph renderer and adversarial guard fixtures |
| Scope preservation checked only as ticket count | Validate 36 outcome owners and S-00A plus every S-00 through S-13 mapping | Capability matrix and guard |
| Old GitHub maps and local handoffs advertised another frontier | Canonical authority map; preserve old bodies and decisions as history; route active entry points to this program | Issue authority map and PR #328; do not dispatch a legacy issue by its old priority alone |

## Risks that still need implementation evidence

| Risk | Smallest next evidence | What it blocks |
| --- | --- | --- |
| Native coding-runtime behavior is not proved by the Habitat toolchain and filesystem fixtures | Observe the selected coding runtime and its lifecycle in the authorized environment | Real coding-runtime integration claims; BrowserPod is unavailable and inactive |
| An isolated execution copy is not automatically the user's existing project folder | Trace selected project to execution copy and guarded write-back, using supported native transfer primitives first | Real brownfield mutation and save claims |
| Browser origin and storage key are not a user authorization boundary | Two synthetic users, scoped key selection, denied cross-user requests, and reload recovery | Multi-user and persistence claims |
| Workbench source and old assets need path-specific rights and restore proof | Private source manifest, license disposition, byte restoration, and history receipt | Real-source import/publication and any retirement |
| Cross-origin isolation may affect login, sidebar, or preview | Browser regression checks on the exact selected origin | Broad header change and deployment |
| Factory, mailbox, and heartbeat need real authority and disconnect behavior | Deterministic fixtures first; approved configured activation later | Live unattended or outbound operations |
| Earlier token-savings benchmark and dogfood commitments can get lost | Bind old issue requirements to outcomes 36, 23, and 24 | Comparative claims and final release acceptance |
| The real scanner is still Level 1/5 | Implemented services plus a live all-checks 100% result | Release readiness and agent-ready announcements |

This audit establishes no BrowserPod execution, real-source preservation,
new artifact release, or 100% result. New findings repair the owning packet
and its evidence. They do not silently change product direction or stop
unrelated ready work.

## Verification checkpoint

[CI](https://github.com/vivary-dev/vivary/actions/runs/33990271792) passed all jobs, including the 17 adversarial planning-guard tests,
graph validation, line endings, diff hygiene, site build, and Windows checks.
That audit completed outcome 01 and inspection packets 02a and 10a.
[03a's later receipt](receipts/03a-registry-contract.md) records completed registry
contract inspection. Current dispatch belongs to [the generated graph](graph.md).
[02b](receipts/02b-restoration-fixture.md) subsequently proved all 33 synthetic
restoration cases in Habitat. BrowserPod is unavailable; 10b is inactive.

The [HoH comparison](research/hoh-alignment.md) adds acceptance refinements
without advancing implementation status. Runtime-enforced roles, frozen
candidates, claim-level QA, and evidence-fed replanning remain unverified.

[03b](receipts/03b-registry-contract-model.md) now records actual Habitat model
verification and independent QA corrections. Its results do not establish the
production HoH cycle or filesystem enforcement. Packet 02b supplies bounded
synthetic filesystem evidence.

[03c](receipts/03c-registry-transaction-mapping.md) completed the native
transaction and adapter map after independent review.

[Packet 12a's receipt](receipts/12a-root-vcs-observation-contract.md) records the
accepted trusted root/VCS observation inspection. Follow [the generated
frontier](index.md) under [the loop-first
direction](design.md#direction-decision-2026-09-06). Real-source preservation
and production registry enforcement remain open.

## PR 328 review checkpoint

The [review receipt](receipts/pr-328-code-review.md) records all 40 thread dispositions, the corrected authorization and planning boundaries, and the 38/57 registry, 16/47 restoration, 33 planning, and five independent checks. Product outcomes remain subject to their own exit evidence.

The [late-review receipt](receipts/pr-328-late-review.md) records the six subsequent
validation fixes and their failing/passing regression evidence.

## Dependency findings from the Zo audit (2026-09-11)

These findings remain open under the all-issues goal. The audit inspected the
pinned workbench lockfile before installation. Restricted verification does not
close release security. The configured local deny-list was unavailable.

- xlsx: high; [Prototype Pollution in sheetJS](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6).
- xlsx: high; [SheetJS Regular Expression Denial of Service (ReDoS)](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
- @anthropic-ai/sdk: moderate; [Claude SDK for TypeScript has Insecure Default File Permissions in Local Filesystem Memory Tool](https://github.com/advisories/GHSA-p7fg-763f-g4gf).
- uuid: moderate; [uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- pdfjs-dist: high; [PDF.js: Arbitrary JavaScript execution upon opening a malicious PDF ](https://github.com/advisories/GHSA-hq66-cqwq-w95j).
- @tiptap/core: moderate; [Tiptap: mergeAttributes() turns an own __proto__ key into inherited executable DOM attributes](https://github.com/advisories/GHSA-cp6q-959q-f8rh).
- @tiptap/core: high; [Tiptap: Quadratic ReDoS in block and inline Markdown attribute parsing](https://github.com/advisories/GHSA-j95f-988m-3j2f).

Resolve these at the supported package/framework owner, then rerun the audit
and affected behavior checks. Preserve framework upgrade rules; do not patch
installed framework code or silently waive advisories.

## Zo build findings (2026-09-11)

The pinned workbench build completed successfully after seven test-only doctor
annotations were repaired. The same build reported these remaining findings:

- Production authentication and persistent SQL configuration are absent in the
  isolated proof environment. Outcome 27 owns actual deployment configuration
  and its verification. The 05b fixture uses synthetic authentication and a
  disposable database; its passing behavior cannot close deployment readiness.
- The native `node-pty` binary was not prepared by the scripts-disabled install.
  Outcomes 10 and 16 own terminal/runtime support. Review and build the pinned
  native module offline, then prove actual terminal behavior before acceptance.
- Framework initialization reported no auto-discovered template actions.
  Outcome 06 owns proving that the built application's intended actions are
  registered and usable. Trace the warning against the emitted static registry
  and the actual runtime before classifying it as a defect or a build-only warning.
- Some minified chunks exceed 500 kB. Outcome 05 owns inspecting the actual
  browser loading behavior and deciding whether focused splitting is warranted.
  A warning alone is not evidence of failed user-visible performance.

Build logs remain in `.tmp/05b/zo-runtime/build-02/`. These findings are retained
under the one goal for all issues; a successful 05b fixture does not waive them.
