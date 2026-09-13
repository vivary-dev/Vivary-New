# Workspace research reconciliation

Reviewed 2026-09-13 against the existing creator, Tropo, and Workbench source.
The [supplied synthesis](workspace-primitives-and-templates.md) and its six slices
are research inputs. Their embedded decisions do not record Jeff's approval.
Original copies remain in ignored task storage on Zo. Imported copies replace
machine-specific locators and link this correction record. Example links from
other repositories are displayed as paths to avoid broken navigation here.

## Accepted direction

Use optional file roles and composable patterns to describe a workspace.
Keep editable files, the existing creator/adopter, and Native runtime ownership.
Separate project memory, explicitly shared owner preferences, and machine state.
Use the existing program graph for implementation and deliver GUI journeys with
their supporting operations.

A role describes what a file does. It does not require a new file, grant access,
or prove that the assigned path exists. One file can serve several roles.
`STATE.md` retains its authored content and human/orchestrator ownership.
Generated views need defined inputs and a preservation policy before replacing it.

## Corrections that affect implementation

| Supplied claim | Source finding and plan consequence |
| --- | --- |
| Every workspace needs five universal roles | The research supports a useful vocabulary. Optional and absent roles remain valid. The thin contract already protects private and runtime paths. |
| State should immediately become generated | `_thin_state_doc` creates authored focus and next-action sections. `plan_adopt` preserves existing state. Packet 11b must define view inputs and migration. |
| The governed loop produces nothing without Git | A temporary non-Git workspace supported ordinary context lookup, a zero-claim capsule, decision recording, and Doctor. Git-backed content attestations remain a separate capability. |
| Owner memory is missing because record requires Git | Record validation checks capsule scope and integrity, not Git presence or nonempty claims. The real gaps are named owner context and fresh-session loading. |
| Populated notes folders cannot be adopted | Ancestor folder names can infer governed types and then fail required-field checks. Other populated folders work. Packet 08a fixes this narrower failure. |
| An edgeless graph proves retrieval is useless | Ordinary retrieval remains available. Relationships and content attestations serve different purposes. Packet 09a checks useful non-code retrieval and Doctor severity. |
| Human review and never deleting memory are universal conventions | The compared systems permit ordinary writes and removal. Vivary keeps review for authority and instruction changes. Forgetting active context and retaining history are separate decisions. |
| Persistent memory is always unsynced | The earlier Letta study includes cloud MemFS synchronization. Vivary's local storage direction does not depend on a universal vendor rule. |
| GUI work follows all merge/split and memory scenarios | Jeff selected visible product delivery. Setup, adoption, and memory packets include their own GUI acceptance. Merge/split does not block initial setup. |

The source owners are [create_vivary.py](../../../../packages/create-vivary/create_vivary.py)
for thin creation, adoption, Doctor, and recording, and
[tropo.py](../../../../packages/tropo/tropo.py) for configuration and retrieval.
The [file-memory comparison](file-memory-and-persistence.md) owns the earlier
primary-source study. No new vendor behavior is established by this reconciliation.

## Implementation order

| Packet | Observable result |
| --- | --- |
| [07a](../packets/07a-workspace-role-contract.md) | Compatible descriptive roles and patterns in workspace configuration |
| [07b](../packets/07b-shared-workspace-plan-apply.md) | One file-content preview/apply contract used by CLI and GUI |
| [07c](../packets/07c-builtin-patterns-reconfiguration.md) | Useful editable patterns and supported reconfiguration (S1) |
| [08a](../packets/08a-populated-folder-adoption.md) | Adoption that preserves ordinary notes and mixed content (S2) |
| [08b](../packets/08b-project-merge-split.md) | Reviewed merge/split with stable references and recovery (S3/S4) |
| [09a](../packets/09a-noncode-context-doctor.md) | Useful non-code context and actionable Doctor findings (S6/S7) |
| [11a](../packets/11a-authorized-workspace-file-editing.md) | Workspace file editing through authorized project actions |
| [11b](../packets/11b-generated-project-views.md) | Derived views with explicit inputs and preserved authored state |
| [18a](../packets/18a-scoped-file-memory.md) | Scoped file memory that the next run actually reloads (S5) |
| [19a](../packets/19a-held-external-pattern-catalog.md) | Optional external catalog after its existing gate is resolved |

Packet dependencies govern execution order. Source preparation can proceed where
its inputs exist. Hosted mutation acceptance still depends on its actual auth
boundary. A successful configuration test does not establish a working setup GUI,
reconfiguration, memory recall, or completion of all seven scenarios.
