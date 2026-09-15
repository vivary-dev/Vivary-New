# Vivary desktop

This package opens Vivary in a native desktop window and starts the existing
Workbench runtime on the user's computer. It has no dependency on Zo or a cloud
control plane. Opening Vivary requires no login or signup.

The desktop package includes ordinary Node alongside Electron. Native SQLite
modules stay on the Node ABI used to build Workbench. The renderer has no Node
access, uses Electron's sandbox, and can navigate only to its own loopback server.
See [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Current acceptance

PR #43's latest head `ff3ae49d9a51dfeeaff7735797312001c16aad4c` passed
all seven CI checks. The recorded Native persistence and composer defects keep
that PR in draft.

Issue #7 bundles the original runtime and preserves the existing command router.
Packaging source `e6f38f9ffcd2fbcd50d49c93864924fa238a9ff1` predates the
reviewed preview-only adapter repair. Its artifacts are retained test candidates.
Its relocated Linux bundle passed all ten verbs, receipt defaults, and a local
email draft. The packaged window passed project creation, Doctor, private
receipts, and normal shutdown. The clean-host build needs no ambient Python
packaging tools; standalone launchers preserve redirected Unicode output.

The private web preview also passed actual project creation, formatted file
reading, Doctor, control, and foreign-identity rejection. A project created
before its latest refresh remained available afterward. Some older roots remain
unavailable; [issue #15](https://github.com/vivary-dev/Vivary-New/issues/15)
owns explicit recovery. PR #43's held session changes remain in that private
preview composition; they have not been merged.

The private Linux x64 package has been exercised outside the source checkout.
It opened the GUI, created local SQLite/workspace data, restored a conversation
and file after reopening, and stopped the local server when closed.

A real Sonnet request through the packaged window performed Read, Write, and
Read, with the resulting file visible in the GUI. It reused the existing Claude
Code CLI login. Model credentials are not included in the application.

The restored Native UI also passed system-folder selection for two projects,
separate drafts and history, a selected-project file change, Settings navigation,
and reopening with the project, completed transcript, and appearance intact.
Stop remained available while the selected folder was missing and preserved the
paused conversation when that folder returned. Unsent text drafts still need
recovery across a changed local port.

The preceding e6f38f9 Windows x64 Electron folder was assembled on Linux and
structurally verified. Its application, Node and Python binaries are x64 PE
files; it contains seven original components, six relative UTF-8 MZ launchers and 46
runtime license files. It has not been executed on Windows. Windows and macOS
installers, signing, upgrades, and installed smoke tests remain unfinished.
The current package is a private preview, not a release.
The [installation outcome](../../docs/product/multi-project/tickets/23-package-and-prove-app.md)
owns that remaining work.

## Development

Build Workbench first, then install this package's locked development tools:

```console
pnpm --dir packages/workbench build
npm --prefix packages/desktop ci
```

Packaging the original runtime also requires host Python 3.12 with `venv` and
`ensurepip`. It does not require global setuptools. The first package build
needs outbound HTTPS for the hash-pinned runtime and build-tool wheels; verified
downloads are reused from the desktop package's `.tmp` cache.

Packaging captures the recorded Git commit and tracked working-tree changes
before downloads and wheel construction. Stage new source files with `git add`
first; untracked files are excluded. Later checkout edits cannot change the
captured inputs. `build.json` records whether that snapshot matches the commit.
The existing Workbench `.output` is copied once and labeled `prebuilt`; its
compilation from the recorded commit is not asserted.

Set `VIVARY_DESKTOP_NODE` to the absolute path of ordinary Node, then run:

```console
npm --prefix packages/desktop start
```

The desktop uses `~/.vivary/workbench` for its database, run history, and workspace.
Electron stores its window/browser state in the operating system's normal Vivary
application-data directory. The user installs and signs into their model CLI
separately. Native Settings shows provider configuration and installed CLI
status. Open folder uses the system directory chooser to connect a project;
Vivary keeps the selected folder and its conversations separate from other
projects.

## Package

```console
npm --prefix packages/desktop run package
```

The packager writes a dated directory under `dist/`. It stages the desktop
entry, compiled Workbench output, startup scripts, ordinary Node, the original
Vivary runtime, licenses, and build metadata. It does not copy a source
checkout, runtime data, credentials, or the development preview service.

### Bundled original runtime

The desktop bundles CPython 3.12.14 from the
[python-build-standalone `20260901` release](https://github.com/astral-sh/python-build-standalone/releases/tag/20260901).
The runtime archives are fixed inputs:

| Target | Archive | SHA-256 |
| --- | --- | --- |
| Linux x64 | `cpython-3.12.14+20260901-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz` | `72748da13197c1fb161e3afeef20a6a385ff24f2165e6e2758e47008e7faba4c` |
| Windows x64 | `cpython-3.12.14+20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz` | `7c45c9622400d578709a9b2cddbe8124cc21d382409d9f13406d706d28e31b14` |

Package-time downloads stay under `packages/desktop/.tmp/original-runtime` and
are reused only after their hashes match. This includes the following build-only
Python tools:

| Tool | Version | SHA-256 |
| --- | --- | --- |
| [pip](https://pypi.org/project/pip/26.0.1/) | 26.0.1 | `bdb1b08f4274833d62c1aa29e20907365a2ceb950410df15fc9521bad440122b` |
| [setuptools](https://pypi.org/project/setuptools/84.0.0/) | 84.0.0 | `51a52592b3b99e102b609654876bd65f19f999935166d1352678931132b0c670` |

Each build then:

1. Creates a temporary isolated build environment under the same `.tmp`
   directory, installs only the verified local pip and setuptools wheels, and
   checks that pip vendors distlib 0.4.0.
2. Builds fresh pure-Python wheels from the owned `vivary`, `create-vivary`,
   `core`, `tropo`, `strato`, `ozone`, and `exo` sources without an
   index or build isolation.
3. Installs those wheels into the staged interpreter without an index or
   dependency download.
4. Writes relocatable component launchers and correct installed-wheel `RECORD`
   entries.
5. Removes the temporary build environment.
6. Copies and hashes the reviewed managed-project bridge.
7. Writes the runtime manifest and license inventory.

The build tools remain package-time inputs. They do not add a first-launch
installer or a new runtime dependency.

The distributed application needs no global Python, source checkout, or
first-launch install. The existing `vivary_cli` router continues to own create,
adopt, doctor, capabilities, check, find, decide, review, impact, and control.
Its logs and email-draft helpers remain available through the bundled CLI.

Linux component commands resolve the bundled sibling `python3`. Windows uses
pip's vendored distlib 0.4.0 console launcher and its supported
`<launcher_dir>` interpreter path. Every standalone and component launcher
passes `-I -X utf8 -B` so redirected Unicode output has the same encoding
contract as the application adapter. See the first-party
[distlib launcher source](https://github.com/pypa/distlib/blob/0.4.0/PC/launcher.c).
Electron Packager copies the staged Python tree with verbatim relative symlinks.

The manifest records the target, source revision, interpreter and component
versions, wheel hashes, launchers, bridge hash, and license paths. The package
includes each component's MIT license, the repository MIT license for the
bridge, CPython and pip notices, and the release-pinned
[python-build-standalone aggregate licenses](https://github.com/astral-sh/python-build-standalone/blob/20260901/python-licenses.rst).
That aggregate is 105,875 bytes with SHA-256
`e43fb936c6655d7996dba480d7ebdea492d6040ec388eb8ed9d1000f72de8cab`.

Workbench reaches this runtime through a deterministic server adapter. It:

- accepts one of ten typed verbs;
- keeps Create and Adopt in preview mode because a local-stat folder grant does
  not authorize mutation through an ordinary pathname;
- resolves and revalidates the selected project grant;
- invokes `python -I -X utf8 -B -m vivary_cli` without a shell;
- bounds time, input, and output;
- exposes bounded text search for Find and the structure pack for Review; and
- derives app receipts from `VIVARY_DATA_DIR`, without accepting a caller path.

The standalone bundled CLI keeps the complete original command flags and the
original `.vivary/receipts.jsonl` default. The adapter is neither a model tool
nor another daemon. Existing-folder application through the GUI remains under
issues #14 and #15, with an identity-preserving apply path. The managed New
Project flow uses its separate reviewed creator. See the
[runtime verification](../../docs/product/multi-project/receipts/23a-bundled-original-runtime.md).
The corrected Linux artifact passed its relocated ten-command checks and
packaged-Electron journey. The hosted preview passed create, Doctor, control
and foreign-identity rejection. Clean-host preparation assembled both Linux
x64 and Windows x64 original runtimes. The full Windows x64 Electron folder
also passed structural verification. Actual Windows execution remains open
under issue #8.

The default command builds the supported target for its host: Linux x64 or
Windows x64. Other architectures and macOS remain later release work. The build
uses that host's Node executable and Workbench native modules. Linux requires
the usual Electron desktop libraries, including GTK 3 and its GSettings schemas.

There is one application instance per user. The window starts its own local
server, waits for the actual app route, and uses parent-child IPC for graceful
shutdown. POSIX also cleans the owned process group if the server exits.
Windows has a live-process tree fallback; crash cleanup on Windows still needs
an actual platform test.

## Windows x64 portable preview

A Linux build host can also assemble the unsigned Windows x64 folder:

```console
npm --prefix packages/desktop run package -- --windows-x64
```

This mode requires Workbench output built with Node 24.15.0 (ABI 137) and
`better-sqlite3` 12.11.1. It verifies pinned official Windows Node and SQLite
assets, replaces the binding only in the staged copy, and asks Electron Packager
for Windows x64. It uses the build host's `tar` command for the one SQLite entry.
The source checkout and its installed native modules stay intact.

[Node checksums](https://nodejs.org/dist/v24.15.0/SHASUMS256.txt) and the
[SQLite release](https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.11.1)
are the asset authorities. [Electron Packager](https://github.com/electron/packager/blob/v20.3.0/README.md)
supports cross-platform packaging. A successful package build establishes an
artifact, not Windows runtime acceptance.

The folder must stay together: `vivary.exe` uses its sibling `resources` files.
Windows users need their own installed Claude Code CLI and subscription login.
The package does not include credentials. Explorer launch, CLI discovery/login,
file tools, restart persistence, and cleanup during an active run still need
actual Windows checks before this becomes a supported release.
