# Shipped Vivary integration map

Reader: workbench and loop implementers. Owner: packet 20j.
Update each row when its packet establishes a different integration boundary.
The source inspection below was performed on 2026-09-11 UTC against the owner's
2026-09-10 instruction. The shipped package owns behavior when callers disagree.
`packages/vivary/vivary_cli.py:80` owns the front-door `ROUTES` table.
The front door has no `verify` verb. Use the standalone Ozone command for that seam.

| Seam | Current file and function | Shipped owner | Envelope reference in docs/COMMANDS.md | Gap and planned packet |
|---|---|---|---|---|
| Workspace creation | `packages/workbench/server/creation_workspace.py:16`, `ShippedWorkspaceOperations`; Core `CreationApply.apply` and workbench `startCreationProvider` | `create_vivary.plan_thin_workspace` at `create_vivary.py:715` and `scaffold_thin_workspace` at `:751` | create-vivary / Commands and flags; source preview API in the package README | 20j supplies shipped operations used by the stdio proof. No duplicated generator exists in Core. Production lifecycle composition and GUI activation still need their trusted host wiring. |
| Brownfield adoption | Workbench has no adoption caller; creation provider accepts only greenfield claims | `create_vivary.plan_adopt` at `:5398`, `adopt_workspace` at `:6394` | Brownfield plan/apply; `plan_hash`, `--yes --plan`, separate recovery hash | Bind the reviewed plan and current authority to GUI apply without a second transaction engine. 08a. |
| Doctor and privacy | `CreationApply._verify_workspace` at `creation_apply.py:659` calls injected checks | `create_vivary.doctor_workspace` at `:1187`; `tropo check` | Doctor compatibility report; schema_version 2 | Shipped doctor is used during creation in 20j. Selected-project GUI health and adoption checks still need a caller. 08a. |
| Planner context | `tools/hoh/context.py:18`, `retrieve_planner_context`; `tools/hoh_loop.py`, `HeadlessLoop._run` planner block | `tropo.py:6204`, `cmd_find`; Core capsule compiler | Governed machine-readable envelopes; `tropo find --governed --json`, `vivary.task-capsule/v0` | 20j retrieves a capsule per stage and binds its fingerprint in receipts. Raw specification projection is removed. Corrected-test rerun and loop acceptance remain open after clock rollback. |
| Developer decision gate | `tools/hoh/workflow.py:203`, `evaluate_phase`; `HeadlessLoop._run` local planner gate | `strato.py:253`, `decide_governed` | `strato decide --governed`; `vivary.strato-decision-request/v0` and decision/refusal envelopes | Assemble the exact request from the capsule and preceding QA evidence. Refuse developer dispatch on blocked policy. 20k. |
| QA verification | `HeadlessLoop._run` calls `evaluate_phase`; local test evidence and phase decisions | `ozone.py:1304`, `verify_governed` | `ozone verify --governed`; `vivary.ozone-verification-request/v0` | Convert named checks into a shipped execution receipt and evaluate the declared gate after QA. 20l. |
| Claims and handoffs | `HeadlessLoop._role_call` at `:1039`; `Workflow.handoff` at `workflow.py:110` | `exo.py:823`, `governed_control`; Core `request_claim` and `create_handoff` | `exo control --governed`; `vivary.exo-control-request/v0`, result and refusal | Compose governed operations into the existing coordinator and persisted receipts. Preserve runtime budget accounting. 20m. |
| JSONL run receipts | `tools/hoh_loop.py:233`, `ReceiptStore.append`, stores hashed JSON details and an index | Shipped CLI `--receipt`; front door `vivary logs` | Receipt commands; `vivary.run_receipt.v1` | Add bounded command diagnostics without replacing the existing role accounting or creating a transcript store. 20n. |
| Visible STATE.md | `create_vivary.py:5160`, `_thin_state_doc`, creates the document; GUI has no state reader | Shipped scaffold/adoption owns initialization; state updates need an explicit owning operation | create-vivary init/adopt/record; no automatic STATE.md runtime update envelope | Specify bounded update authority and expose the same visible document to GUI and headless callers. 09a. |

## Evidence limits

20j supplies the shipped creation operations and planner retrieval adapter. The
prior test revision passed a disposable-workspace run. Later verification exposed a test
iteration-pairing bug, corrected without another runtime run, and repeated clock
rollback stopped the broader loop suite. The packet remains unaccepted. Read the
[20j receipt](../receipts/20j-shipped-creation-and-context.md) for each result.

This table records source inspection. It does not prove configured GUI creation,
runtime dispatch, or production authentication. The 20j receipt separately records
regressions and real disposable-workspace runs. Planned IDs after 20k reserve the
sequence and are not executable packets until their start inputs are prepared.

The existing five-file generator is already the single owner. Core's expected-byte
comparison, namespace custody, authority binding, receipts, and rollback are distinct
responsibilities and must remain. Only duplicated fixture composition is removed.

The loop remains a development tool using the owner's planning, development, and
independent QA method. Deterministic adapters prove sequencing without a model call.
The loop never requires its own model API key.
