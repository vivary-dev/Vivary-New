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

Windows and macOS installers, signing, upgrades, and their installed smoke tests
remain unfinished. The current package is a private preview, not a release.
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
separately.

## Package

```console
npm --prefix packages/desktop run package
```

The packager writes a dated directory under `dist/`. It includes only the desktop
entry, compiled Workbench output, startup scripts, ordinary Node, licenses, and
build metadata. It does not copy source checkouts, runtime data, credentials, or
the development preview service.

Build on the target operating system and architecture. The script uses that
host's Node executable and the native modules from its Workbench build. It does
not cross-compile SQLite or imply that another platform has passed testing.
Linux requires the usual Electron desktop libraries, including GTK 3.

There is one application instance per user. The window starts its own local
server, waits for the actual app route, and uses parent-child IPC for graceful
shutdown. POSIX also cleans the owned process group if the server exits.
Windows has a live-process tree fallback; crash cleanup on Windows still needs
an actual platform test.
