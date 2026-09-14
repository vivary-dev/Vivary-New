# Vivary visual specification

Status: proposed architecture and operating manual for Jeff's review, 2026-09-14. This specification does not claim that its features are implemented. Application implementation waits for this review under [issue #38](https://github.com/vivary-dev/Vivary-New/issues/38).

## Start with the work

Vivary is one visual workspace over the projects and supported agent tools on a user-controlled host. Select a project, continue its conversation, and open files, plans or previews when needed. A person can write, research, plan or code through the same workspace. A project does not need Git, a Brain, a preset persona or a Vivary account for local use.

The interface stays stable when the chosen harness changes. A registered adapter translates that harness's supported lifecycle and events through Agent-Native. A future CLI needs an adapter and compatibility evidence. Installation alone never establishes support.

## Read this specification

| Need | Read |
| --- | --- |
| Understand the whole system | [System and data diagrams](system.md) |
| Find each module, its contracts and replacement boundary | [Module catalog](modules.md) |
| Inspect every declared user action | [Action catalog](actions.md) |
| Understand harness installation, selection, resume and replacement | [Harness adapter contract](harness-adapters.md) |
| Follow interactions, approvals and recovery step by step | [Journeys and state diagrams](journeys.md) |
| Find all 36 outcomes and current release relationships | [Coverage and delivery map](coverage.md) |
| Give an LLM exactly the context for one change | [Contributor operating manual](operating-manual.md) |
| Agree on the meaning of a term | [Shared vocabulary](../CONTEXT.md) |
| Inspect the selected workspace layout | [Unified workspace interaction contract](../unified-workspace.md) |
| Review the research behind the interface | [Agent workspace ergonomics](../research/agent-workspace-ergonomics.md) |

The interactive [drawing room](atlas.html) is a generated companion view of [feature-map.json](feature-map.json). It lets a reviewer select a module and inspect its connected modules and actions. The generated atlas.html opens directly in a browser without a server or network dependency. atlas.fragment.html supplies the in-conversation view. The Markdown diagrams remain readable without either viewer. The JSON owns only this specification's module/action inventory. It does not own task status or replace GitHub issues. Regenerate it with `node docs/product/multi-project/specification/render-atlas.mjs`.

## Completeness boundary

This revision specifies the known product program: all 36 retained outcomes, issue #38's unified workspace, and the required desktop/browser issue set. The action catalog covers the declared controls and operations, including recovery. It does not pretend to enumerate future third-party features or every arbitrary request someone can type into an agent. Such requests use the same scoped action, permission and artifact contracts.

Each action inherits the shared preconditions and failure rules in the action catalog. Each module names its data owner, permitted calls, replacement boundary and acceptance scenario. Later capabilities have explicit scope and acceptance proposals, not fake enabled controls or invented implementation dates. Unsettled adapter-specific APIs remain evidence requirements before their implementation issue can start.

## Source and authority

- User decisions: one conversation workspace, optional panels, exact linked history, separate handoff workflow, supported installed harnesses and live models, and complete specification before application building resumes.
- Product architecture and constraints: [design.md](../design.md), [capability-matrix.md](../capability-matrix.md), [native-owners.md](../native-owners.md) and the 36 linked outcomes.
- Current implementation: the source owners in the module catalog. The research baseline is dev tree ea5e5da, with Native Core 0.176.5 and Toolkit 0.19.3. Documentation changes do not update the running application.
- Delivery: live GitHub issues own goals, acceptance, dependencies, assignment and lifecycle. Issue numbers and outcome numbers are separate namespaces. Always write "issue #35" or "outcome 35".
- Product acceptance: actual hosted application checks precede Windows artifact checks. A diagram, mockup, package build or CI pass is not product acceptance.

Older source-map gap paragraphs retain pre-integration assumptions. The concrete source locators here and the recent component receipts distinguish existing implementations from remaining end-to-end gaps. Do not infer that Native has no runtime or store from an older negative finding.

## Design synthesis

Two independent candidates were compared. Candidate A emphasized the workspace and linked-conversation flow. Candidate B covered the full product through a stable core and replaceable boundary adapters. B is the organizing basis, with A's precise panel, draft, focus, history and failure behavior included.

The independent same-family review agreed with that choice. The synthesis rejects a universal replacement runtime, a plug-in-defined permission system, a second transcript store, and a plan service that competes with the selected task/plan owner. Native references remain opaque. Link metadata uses an existing suitable owner where possible. Client layout preferences are distinct from shared project records. Uncertain effects are explicit, and linking never starts a run.

## Review gate

The specification is ready for implementation planning when Jeff can follow an action from its visible control through its module, data owner, authorization, result and recovery. Module replacement must have an example that preserves these contracts. Every retained outcome needs a mapped action or an explicitly nonvisual acceptance contract. Review findings must be resolved before calling this specification complete. Jeff's design acceptance is separate from merging reviewed documentation.
