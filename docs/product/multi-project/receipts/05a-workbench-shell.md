# 05a workbench shell receipt

Evidence-record: 05a
Date: 2026-09-07
Verification-kind: runtime
Result: Passed the scoped shell proof. Independent visual and archive verification accepted; task-owned cleanup complete.

The [owning packet](../packets/05a-workbench-shell.md) bounds this evidence.
Outcome 05 remains in progress. This packet does not establish a connected
project, authenticated production application, or runnable model session.

## Source preservation and composition

The private capture preserved 24 selected Littleagent source files, 59,555 bytes,
including the five custom workbench files and 19 composition/configuration inputs.
The capture rejected links and changes during reading, found no listed sensitive
patterns, and recorded per-path history references. The five custom GUI files
were untracked; their selected working bytes are preserved without inventing
commit history. The final original-byte check passed for all 24 files.

The existing preservation engine restored the selection in Habitat and verified
repeat, interruption/resume, conflict refusal, and unchanged source behavior.
The lead independently accepted that archive and its restored-byte evidence.
Selected source history, hosted records, resources, assets, and the remainder
of outcome 02 are outside this capture. No source license was found; rights for
public distribution remain unresolved. Private preservation and integration are
the current scope.

`packages/workbench/source-provenance.json` maps 24 imported or composed target
files to hashes and adaptations. The app preserves the S-01 two-pane layout,
safe iframe preview, native query/session/theme/chat providers, shared full-chat
route, and Toolkit controls. It adds mobile project/task/session disclosure and
expandable Files, Web, Plan, and Evidence panels. The legacy editor is retained
only in private preservation evidence because its draft/save behavior is unsafe.

## Observed verification

The existing Habitat app directory uses Node 22.23.2 and pnpm 11.23.0. The frozen
lock contains 1,116 package snapshots. Installation used a task-specific empty
home, the existing configured egress proxy, and disabled lifecycle scripts.
Core 0.176.5 and Toolkit 0.19.3 resolve their declared auth/editor versions;
the source workspace's stale overrides are absent. Seventeen missing `hasBin`
fields were restored from integrity-verified installed package manifests without
changing versions or integrity values. The existing TypeScript 7.0.2 compiler
and its 20 platform packages were checked against source hashes and registry
metadata; none were younger than 72 hours or declared install lifecycle hooks.

The exact reviewed better-sqlite3 12.11.1 prebuilt Linux x64 binding was fetched
through prebuild-install 7.1.3 from its official release. Its Node ABI is 127;
an actual in-memory SQLite query passed. The binding hash is recorded privately.
No dependency source or native package was patched.

| Check | Observed result |
| --- | --- |
| Native `agent-native build` | Passed client, SSR, and Nitro builds in Habitat |
| Native `agent-native typecheck` | Passed with TypeScript 7.0.2 |
| Focused preview tests | Six passed in Habitat |
| Native `agent-native doctor` | All ten guards ran; no findings |
| Final source linkage | 21 compiled source/configuration/lock files matched Windows and Habitat |
| Browser fixture | Eight observations passed; no page or renderer errors |
| Original source | All 24 captured files unchanged |

The browser used the exact exported Habitat client/SSR output, the existing
Windows Chromium/Playwright installation, and a private loopback renderer.
The lead approved this arrangement because Habitat had no installed browser.
All native API endpoints returned 503. The session response was explicitly
synthetic. A signed-out response triggered the native sign-in redirect and hid
the application chrome; the sign-in page itself was a labeled fixture endpoint.
This is not evidence of configured authentication.

The probe verified desktop layout, panel switching/collapse, mobile pane
switching, mobile project/task/session access, the full-chat route, and the
keyboard skip link. All 56 console errors were expected 503 resource failures.
Native mounting still attempted its own readiness/state calls, including engine
management; the fixture refused them. No native API server or model run started.

Core 0.176.5 overwrites the host's `composerDisabled` flag inside its multi-tab
chat. The shared Conversation component therefore places the unavailable native
surface inside a visibly dimmed standard `inert` boundary. Its explanation stays
outside. Programmatic editor focus was refused; pointer input, typing, and Enter
changed no text and caused no mutation request. Both conversation routes share
this guard. It is a UI availability boundary, not server authorization. A future
verified capability binding must own activation and preserve backend checks.

The lead independently inspected the final desktop, mobile panel, expanded mobile
navigation, and keyboard-focus screenshots and accepted this scoped shell proof.
The preserved client entry retains native app-base-path handling. Non-root
deployment navigation and connected history were not exercised by this fixture.

## Retained evidence

The private owner-local 05a proof directory retains these verified archives and
their hash manifests. The packet does not publish their contents.

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Selected source preservation | 58,764 | `ba9ca145dbbaeb97a9df051bf86d8dbfa95bdbe0b3ed3cab2099045ba26c67b7` |
| Habitat restore evidence | 108,111 | `b0bb550038bafeb428e8b2d71ec08946bc8ce7ffc1c4efcd0eb71b8b598fa431` |
| Final shell evidence | 4,630,657 | `42ec4588de56b2701bfa3675d6495ac9c4bbc75fce362c01127e435aecefbe79` |

The shell archive has 23 payloads plus its bundle manifest. Its nested frozen
renderer/log archive has 216 verified payloads, 4,447,118 bytes, and SHA-256
`41380dcb117ea85d84f422f96ad1dba257d65d130e8c40f0acb6635159aac799`.
The final-source-linkage report binds the current source hashes, exported
renderer, browser probe, and browser result. Review screenshots remain directly
inspectable beside the archive.

## Limits and next work

The native production preflight reports absent auth-secret and persistent-database
configuration even though compilation and typechecking return success. No
production-ready claim follows from those exit codes. The pre-compiler native
dependency audit records three high and three moderate advisories across optional
XLSX/PDF support, the SDK filesystem memory tool, UUID, and Tiptap. This shell
does not prove those advisory paths safe. The added compiler's metadata was
checked separately. The program's complete release security gate remains open.

Outcome 06 owns configured native authorization, durable root custody, registry
actions, and transport. The next UI slice should compose those verified seams
for real registration and project selection. No separate task/session/transcript
store, arbitrary disk editor, or fabricated runnable conversation is introduced.

## Independent acceptance and cleanup

The lead independently verified all 23 outer payloads, all 216 nested renderer
and log payloads, and the 21 current canonical source hashes. Each recorded byte
count and SHA-256 matched. The private lead-archive-verification receipt records
that check independently of this writer's report.

Cleanup removed the two temporary Windows dependency junctions themselves,
preserving their source dependency target. The old preliminary Windows build,
generated manifest, and 05a staging tree were removed. The named Habitat transfer
files, temporary proof logs, task home, and failed WSL transfer copy were removed
after export. The current Habitat app source, frozen dependencies/cache, build,
and runtime tools remain available for the next integration packet. The private
cleanup receipt verifies that the final archive's hash and size remain unchanged.
No task-owned browser or renderer process remains running.

Packet 05a is complete. Outcome 05 retains its broader dependency and connected
application acceptance requirements. Packet 06e can now compose the native root
registration owner into usable project selection after the 06d seam is accepted.
