<p align="center">
  <img src="https://shieldcn.dev/header/glow.svg?title=Vivary&amp;subtitle=Your+projects.+Your+agents.+Your+machine.&amp;mode=dark&amp;font=geist&amp;width=500&amp;height=140&amp;align=center&amp;bg=101713&amp;accent=b5ef4a&amp;glow=b5ef4a&amp;titleColor=eaf3e7&amp;subtitleColor=bdc9bb&amp;radius=12&amp;watermark=false" alt="Vivary. Your projects, agents, and workspace on your own machine." width="1100">
</p>

<p align="center">
  <a href="#release-status"><img src="https://shieldcn.dev/badge/status-in%20development-b5ef4a.svg?mode=dark&amp;variant=default&amp;font=geist" alt="Status: in development"></a>
  <a href="https://github.com/vivary-dev/Vivary-New/milestone/1"><img src="https://shieldcn.dev/badge/desktop-Windows%20first-b5ef4a.svg?mode=dark&amp;variant=default&amp;font=geist" alt="Desktop target: Windows first"></a>
  <a href="LICENSE"><img src="https://shieldcn.dev/badge/license-MIT-b5ef4a.svg?mode=dark&amp;variant=default&amp;font=geist" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://github.com/vivary-dev/Vivary-New/milestone/1">Release queue</a> ·
  <a href="CONTRIBUTING.md">Contribute</a> ·
  <a href="docs/product/multi-project/design.md">Product design</a> ·
  <a href="docs/ORIGINAL-CLI.md">Original CLI reference</a>
</p>

<h1 align="center">Vivary</h1>

<h3 align="center">A workspace for working with agents on your own projects.</h3>

<p align="center">
Vivary brings agent chat, project files, tools, and memory into one desktop app.
</p>

<p align="center">
The product target is a Windows desktop app and a responsive web client connected
to the same Vivary instance. That instance can run on your computer or a suitable
server. Your agents, credentials, files, and history stay on the host.
</p>

## The experience we are building

- Open a project and work with an agent that can read files, edit them, and run tools.
- Return to project conversations, search past sessions, and keep useful memory in files.
- Use supported installed coding harnesses and their tools, with workspace guidance in files.
- Preview the site or dashboard you are building and let the agent inspect and debug it.
- Connect a phone browser to your self-hosted instance when you choose to enable remote access.

Local desktop use needs no Vivary account. Remote access requires explicit setup
and authentication. Provider accounts are separate.

## Release status

**In development. A complete, accepted Windows release is not available yet.**

| Available in the prototype | Still required for release |
| --- | --- |
| One unified workspace, multiple saved Code conversations, optional panels, saved selection and appearance | Reliable Native project sessions and draft restoration across restarts |
| File navigation, formatted reading, explicit Edit/Save/Rename, and conflict recovery | File and conversation search, scoped memory, and complete workspace operations |
| Electron with bundled Node/Python and the original ten-verb command runtime | Actual Windows GUI launch, folder selection, agent use, and shutdown acceptance |
| Basic isolated web preview | Responsive remote access and integrated preview/debugging |

The bundled CLI passed a Windows create/retry check. The Electron GUI remains unverified.
The [desktop acceptance record](packages/desktop/README.md#current-acceptance)
states what has been exercised. The
[GitHub milestone](https://github.com/vivary-dev/Vivary-New/milestone/1) owns remaining
work and acceptance. Mac distribution is optional later work.

## Start here

This is the private development repository for the app. Development and hosted
preview run on Zo. Zo is not a product dependency.

| You want to… | Start with |
| --- | --- |
| Build or run the GUI from source | [Workbench setup](packages/workbench/README.md#run-from-source) |
| Run or package the desktop shell | [Desktop setup](packages/desktop/README.md#development) |
| Pick up an issue and contribute | [Contributor guide](CONTRIBUTING.md) |
| Understand the product and implementation | [Interactive guide](docs/product/multi-project/specification/README.md#open-the-guided-reader), [release status](docs/product/multi-project/desktop-release.md#what-exists-and-what-is-missing), and [source map](docs/product/multi-project/source-map/index.md) |
| Enable agent-session recording | [Entire setup](docs/ENTIRE.md) |
| Use the original published command tools | [Original CLI reference](docs/ORIGINAL-CLI.md) |

Agent-Native owns conversations, runs, actions, and connectors. Vivary connects
those capabilities to project workspaces and the original Vivary tools.
The [engineering policy](ENGINEERING.md) keeps implementation focused on completed
user workflows.

GitHub issues own task scope, acceptance, dependencies, and status. Contributors
use topic branches from `dev`, reviewed PRs into `dev`, and accepted promotions to
`main`. Follow the [contributor workflow](CONTRIBUTING.md#active-repository).

## Original Vivary

The original CLI, package history, and release tables are preserved in the
[original CLI reference](docs/ORIGINAL-CLI.md). Those published packages do not
constitute a release of the desktop app.

MIT. See [LICENSE](LICENSE).
