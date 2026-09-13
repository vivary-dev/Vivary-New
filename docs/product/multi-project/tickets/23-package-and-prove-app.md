# 23: Package and prove installed application behavior
Type: outcome
Status: in-progress
Blocked-by: [09, 10, 13, 29]
Unlocks: [24, 25, 26, 27]

Execution: Start only a bounded packet listed in [the graph](../graph.md). Parent dependencies gate completion, not independent preparatory work.

## Goal

Produce installable application artifacts and prove that packaged behavior matches source behavior across supported platforms and headless entry points.

## Context

Program context: [design](../design.md), [migration](../migration.md), [release](../release.md), and [evidence](../evidence.md).

Own app manifests, packaging, installers, artifact checks, and installed smoke fixtures. Read `release.md` and the existing Vivary release workflow. Pin dependencies through the repository's security process.

## First desktop increment

Jeff prioritized local desktop delivery on 2026-09-12. Prepare the desktop shell
for the working agent surface during packet 06f. It must start its own local
runtime, open without login or signup, keep files and state on the user's machine,
and reuse their installed CLI model access. Zo is only the development/preview
host. This bounded increment does not accept the full platform release matrix.

The private Linux x64 desktop preview now bundles Electron, ordinary Node, and
Workbench. Actual package checks proved no-login startup, a Sonnet Read/Write/Read
file task, local state restoration after reopening, healthy local configuration,
and server shutdown on quit.
The Windows x64 portable folder also builds with verified target Node/SQLite
assets. Its structure and metadata pass inspection; Windows runtime behavior
remains unverified. See [desktop package](../../../../packages/desktop/README.md).
Windows/macOS installers and the full release matrix remain unaccepted.

Follow the [2026-09-13 testing decision](../design.md#hosted-and-desktop-testing-decision-2026-09-13):
test the latest application changes on the private hosted Zo version first, then
build Electron packages for further local testing on Jeff's laptop. Include
local files, native dialogs, persistence, and shutdown in the desktop journey.

## Done condition

Clean environments can install, open, upgrade, and remove the app as documented. Installed GUI and headless operations use the same contracts. Artifacts carry versions, licenses, and provenance.

## Verify

Build exact artifacts in the prescribed project environment. Run package checks and installed smokes on supported platforms. Record platform gaps without claiming coverage.


Run the [canonical common planning checks](../execution-contract.md#maintaining-the-graph)
after changing this outcome's metadata. These checks validate planning documents;
they do not prove the behavior above.

## Log

- 2026-09-05: Initial public plan recorded. Implementation has not started.

- 2026-09-05: Preserve unresolved earlier dogfood, tutorial, and token-savings benchmark requirements through [the issue authority map](../issue-authority.md). Pilot cost metrics do not replace the separate comparative token-savings protocol.

- 2026-09-12: The first private Linux x64 desktop package passed startup, actual
  Sonnet file tools, reopen persistence, local configuration, and shutdown checks.
  Windows/macOS packaging and installed platform acceptance remain open.

- 2026-09-12: Added Windows x64 portable cross-packaging and checked target binary
  types, pinned Node, ABI metadata, and preservation of source native modules.
  This is artifact assembly evidence only; Windows execution remains unverified.

- 2026-09-13: Jeff confirmed hosted Zo testing before Electron delivery and
  further local laptop testing. Existing platform evidence keeps its scope.

## Desktop delivery scope

The [desktop release queue](../desktop-release.md) assigns bounded work for this
outcome and preserves the broader completion contract. A successful Windows
artifact requires its specified sessions, memory, search, and original-tool
journeys. Earlier source and Linux evidence retain their recorded scope.

## Shared desktop and self-hosted browser delivery

Jeff clarified on 2026-09-13 that phone users connect through a responsive web
client to their own Vivary instance, including a suitable server host. Agents,
files, credentials and history remain on that host. Packet 23d supplies explicit
authenticated access and client behavior. Packet 23c accepts it alongside the
Windows artifact and packet 11e live preview. Mac distribution remains optional
later work and is not a dependency of this release. Existing evidence is unchanged.
