# Original Vivary and the GUI integration gaps

Source study: 2026-09-13. This document records source behavior and integration
gaps. It does not establish a release or add runtime acceptance. The existing
[program frontier](../index.md) and [06f packet](../packets/06f-workbench-source-integration.md)
own delivery.

## What Vivary provides

Vivary gives an external agent a portable project contract, relevant context,
work limits, and records of outcomes. Project files remain authoritative. The
original role packages do not provide a general coding-agent executor.

The [CLI front door](../../../../packages/vivary/vivary_cli.py) routes ten verbs
to the existing packages. It imports the selected component in the same process:

| CLI verbs | Owner | Responsibility |
| --- | --- | --- |
| `create`, `adopt`, `doctor`, `capabilities` | create-vivary | Set up or inspect the project contract |
| `find`, `check` | Tropo | Retrieve context and validate the project graph |
| `decide` | Strato | Evaluate the next permitted step |
| `review`, `impact` | Ozone | Review graph relationships and supplied evidence |
| `control` | Exo | Coordinate claims, dependencies, and handoffs |

Native remains the app's owner of execution, runs, conversations, credentials,
and schedules. A2A connects agents across apps. It does not replace the project
contract or the coding runtime. See [Native ownership](../native-owners.md).

## Templates and the project filesystem

The source contains two generations of workspace setup. The public `init` path
in [create_vivary.py](../../../../packages/create-vivary/create_vivary.py),
`scaffold_thin_workspace`, creates exactly five files by default:

```text
project/
  AGENTS.md
  STATE.md
  .gitignore
  .vivary/
    context.md
    workspace.toml
```

`AGENTS.md` routes the agent to `context.md`. The context contract describes
retrieval, privacy, evidence, and human authority. `workspace.toml` declares the
preset, state file, private/runtime paths, optional projections, and typed record
schemas. `STATE.md` starts with empty state headings rather than invented project
knowledge. Existing project files can stay where the user keeps them.

Four presets exist: `coding`, `second-brain`, `knowledge-work`, and `writing`.
They share the five-file base. Preset selection does not populate a large starter
project or activate a model. Optional `.agents` and `.claude` skill projections
require explicit selection.

The retained legacy scaffold creates more structure: module indexes, change and
decision records, verification records, human gates, private placeholders, and
agent skills. Its six [Strato templates](../../../../packages/strato/templates/)
are `AGENTS.md`, `SOUL.md`, `USER.template.md`, `MEMORY.template.md`,
`STATE.template.md`, and `bug-risk-playbook.md`. Legacy preset starters describe
a codebase, knowledge base, knowledge-work workbench, or manuscript system.

Thin initialization copies none of those legacy templates. The
[asset sync script](../../../../packages/create-vivary/tools/sync_assets.py) and
[distribution manifest](../../../../packages/create-vivary/MANIFEST.in) identify
`create_vivary_assets` as a source-only legacy archive. Restoring every archived
file would change the chosen five-file baseline.

Additional records appear when real work needs them:

```text
.vivary/records/{modules|changes|decisions|verification|gates}/<slug>.md
```

`record_workspace` consumes supplied Markdown and a verified Task Capsule. It
plans one record change, binds approval to that plan, and validates the result.
It does not generate the content or seed a knowledge base.

Private files and runtime state have separate paths. The thin ignore policy
covers `.vivary/private/`, `.vivary/runtime/`, and `*.vivary-tmp`. These directories
are not eagerly created. Governed receipts use `.vivary/evidence/`. Optional CLI
run receipts and semantic memory have distinct purposes and activation rules.

## Adopting an existing folder

`plan_adopt` and `adopt_workspace` preserve the existing project layout. They
keep existing state and valid thin context/configuration, append marked sections
to `AGENTS.md` and `.gitignore`, and refuse conflicting managed content.

Apply requires the reviewed plan hash. The implementation rechecks folder
identity and relevant file bytes, writes privacy rules first, and journals
changes for recovery. It does not move source files, copy the legacy templates,
or enable providers. See the [adoption guide](../../../guides/adopt-project.md).

The existing `adopt_workspace` docstring overstates preservation by saying files
are never opened for writing. Approved managed appends and recognized generated
adapter replacements do write existing files. The implementation and plan are
the relevant behavior.

## Context, execution, review, and memory

The source supports this caller-driven sequence:

1. **Tropo reads the project.** Markdown, frontmatter, and references form a graph.
   Bounded retrieval ranks relevant files. `governed_find` observes source and
   compiles a Task Capsule containing context, scope, required checks, and unknowns.
2. **Strato evaluates the request.** Given the capsule, actor, scope, clock, and
   budgets, it returns `act`, `stop`, `request_gate`, or `blocked`.
3. **An external agent does the work.** The caller runs tools and required checks.
   The original role packages do not spawn that agent or execute those checks.
4. **The caller records results.** An integrity receipt binds supplied outcomes
   to the capsule and workspace. Its existence alone does not prove execution.
5. **Ozone reviews and Exo coordinates.** Ozone checks supplied context/evidence.
   Exo manages claims, dependencies, completion, and handoffs when required.

Sources: [Tropo](../../../../packages/tropo/tropo.py),
[Strato](../../../../packages/strato/strato.py),
[receipt creation](../../../../packages/core/vivary_core/receipt.py),
[Ozone](../../../../packages/ozone/ozone.py), and
[Exo](../../../../packages/exo/exo.py).

Exo's Orchestrator, Scout, Researcher, Builder, Verifier, Reviewer, and Archivist
roles are operational contracts. They are not configured model identities or a
worker scheduler. Small existing CLI writes, such as claiming an item, do not
constitute a general file editor.

Core is a contract and policy kernel with explicit I/O adapters. Its evidence
store persists receipts, and its evidence-sync adapter can write and push Git
refs. Calling all of Core pure would hide those effects.

Files remain the memory source of truth. Tropo's optional local lexical vectors
need no embedding API. The optional [Cognee adapter](../../../../packages/memory-cognee/vivary_cognee.py)
can use providers under its explicit activation policy. A GUI transcript is not
a replacement for project context, state, or durable records.

The later [headless loop prototype](../../../../tools/hoh_loop.py) sequences
planner, developer, and QA stages. Its [20c evidence](../packets/20c-headless-loop-preparation.md)
has a separate scope. It is not evidence that the GUI exposes a complete factory.

## What the GUI still needs

The Native UI already has Settings, provider and CLI readiness, registered project
folders, bounded Code runs, transcripts, and Stop. The accepted application
journeys remain recorded in 06f. These source gaps remain:

| Capability | Source finding | Existing outcome |
| --- | --- | --- |
| Create from a preset | Folder selection only registers a root. The existing creator composition is not mounted in normal startup. | [07: Create projects](../tickets/07-create-new-projects.md) |
| Adopt an existing folder | No GUI adoption plan/apply flow calls the original adopter. | [08: Adopt projects](../tickets/08-adopt-existing-projects.md) |
| Navigate and edit files | The inspector reads only JSON, Markdown, and text with size/count/depth limits. It cannot show `workspace.toml`. Workbench Files remains a placeholder. | [11: Workspace editor](../tickets/11-finish-workspace-editor.md) |
| Use original governed context | The Code send path submits the prompt/history to Native without an explicit Tropo, Strato, Ozone, or Exo sequence. | [06f: App integration](../packets/06f-workbench-source-integration.md) |
| Show plans and evidence | Workbench Plan and Evidence remain placeholders. | [Program graph](../graph.md) |
| Run the suite on another computer | Desktop packaging includes Electron, Node, and compiled Workbench, but not the original Python runtime and package closure. | [23: Package the app](../tickets/23-package-and-prove-app.md) |

Code owners: [project navigation](../../../../packages/workbench/app/components/projects/ProjectNavigation.tsx),
[creator composition](../../../../packages/workbench/server/creation_workspace.py),
[Code actions and file inspection](../../../../packages/workbench/server/local-code-agent.ts),
[Workbench panels](../../../../packages/workbench/app/routes/workbench.tsx), and
[desktop packaging](../../../../packages/desktop/package.mjs).

## Recommended next integration

Connect Create and Adopt to the original implementations, with a visible file
plan, result checks, and registration through the existing Native project
registry. The four presets are the compatibility base. Follow the later
[workspace setup direction](../design.md#workspace-setup-direction-2026-09-13)
for useful starter content and independent agent guidance. The current preset
names do not define mandatory GUI categories. Resolve the local package
dependency closure as part of that slice so it also works outside the source
checkout.

Then finish file navigation/editing and connect context selection and recorded
outcomes around Native execution. Present real plan and evidence records through
the existing panels. Preserve user files and enforce the original privacy rules
at retrieval boundaries. Scale checks under [ENGINEERING.md](../../../../ENGINEERING.md).

The separately held [external template program](../tickets/19-integrate-template-program.md)
does not block the built-in presets. It still owns catalog discovery and external
template delivery. Continue within the existing program and Native ownership.
