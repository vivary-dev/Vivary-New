# Vivary desktop

This package opens Vivary in a native desktop window and starts the existing
Workbench runtime on the user's computer. It has no dependency on Zo or a cloud
control plane. Opening Vivary requires no login or signup.

The desktop package includes ordinary Node alongside Electron. Native SQLite
modules stay on the Node ABI used to build Workbench. The renderer has no Node
access, uses Electron's sandbox, and can navigate only to its own loopback server.
See [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Current acceptance

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

A Windows x64 portable folder has also been assembled and its target binaries
and metadata checked. It has not been executed on Windows. Windows and macOS
installers, signing, upgrades, and installed smoke tests remain unfinished. The current package is a private preview, not a release.
The [installation outcome](../../docs/product/multi-project/tickets/23-package-and-prove-app.md)
owns that remaining work.

## Development

Build Workbench first, then install this package's locked development tools:

```console
pnpm --dir packages/workbench build
npm --prefix packages/desktop ci
```

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

The packager writes a dated directory under `dist/`. It includes only the desktop
entry, compiled Workbench output, startup scripts, ordinary Node, licenses, and
build metadata. It does not copy source checkouts, runtime data, credentials, or
the development preview service.

The default command builds for the current operating system and architecture,
using that host's Node executable and Workbench native modules.
Linux requires the usual Electron desktop libraries, including GTK 3 and its
GSettings schemas.

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
