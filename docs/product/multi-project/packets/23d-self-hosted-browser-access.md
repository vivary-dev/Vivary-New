# 23d: Connect a responsive browser to a self-hosted Vivary instance
Type: packet
GitHub-issue: https://github.com/vivary-dev/Vivary-New/issues/30
Parent: 23
Status: needs-info
Depends-on: [06g, 04a, 17a]
Owner: Root-assigned shared client and host-access integrator
Scope: Connect desktop and phone browsers to one explicitly selected user-controlled Vivary host.
Verification-kind: runtime
Needs: Reliable state, project session binding, and draft restoration accepted.
Timebox: One host connection and responsive-client increment using existing Native owners.

## Goal

The linked GitHub issue owns task scope and acceptance. This packet identifies
implementation boundaries and evidence. Open the same project and conversation
from a phone browser while agents and files remain on the selected host.

## Context

Read the live GitHub issue, [the release snapshot](../desktop-release.md), and
[Native ownership](../native-owners.md). Preserve the existing architecture and
accepted evidence while implementing the issue's current requirements.

## Owned files

- Existing Workbench shell, project/session navigation, composer, and settings.
- Existing startup and local-access owners only for the explicit remote access mode.
- Existing Native session/state/action adapters and focused tests.
- Host setup instructions and the accepted connection's browser-facing routes.

## Implementation boundaries

Local desktop remains account-free and loopback-only by default. Remote browser
access is explicit, authenticated, and revocable. Preserve the private Zo owner
boundary. Do not treat this feature request as permission to expose a live service.
Use one host identity and its existing Native records. Agents, provider credentials,
files, logs, and history remain there. Browser folder selection refers to that host,
not the phone. No managed cloud account, native phone app, or second sync store.

The shared shell must work with touch, a narrow viewport, and an on-screen keyboard.
Keep project identity, composer, Stop, history, settings, and errors reachable.
Reconnection must preserve drafts without automatically sending or changing hosts.
Resolve live-preview links through this selected host's authenticated access path.
A loopback address on the host must not accidentally target the phone.

## Done condition

The live issue's acceptance passes against the actual selected private instance.
A desktop browser and real phone browser open and continue the same authorized
project conversation. Revoked and unauthenticated clients cannot read records or
invoke actions. Unavailable-host and interrupted-connection states recover honestly.

## Verify

Use existing tests for access and state boundaries. Exercise the real shared UI
at desktop and phone widths, then the actual phone connection, without creating
another browser test framework. Keep desktop artifact acceptance separate.

```console
pnpm --dir packages/workbench exec tsx --test tests/local-access.test.ts
pnpm --dir packages/workbench typecheck
```

## Stop conditions

Do not expose a service, bypass authentication, copy personal browser credentials,
or enable paid or scheduled work through this ticket. Preserve existing user
files, private state and historical evidence. Unsupported browser capabilities
remain unaccepted until demonstrated through a supported interface.

## Log

- 2026-09-13: Added from Jeff's explicit self-hosted mobile-browser requirement.
  The first host is a user-controlled computer. A suitable Linux server can use
  the same client contract. No remote service was exposed or tested by this plan.

### First source slice, 2026-09-30

The desktop adds optional device pairing through a dedicated loopback ingress and
local IPC approval. Grants and explicit configuration persist across restart. The
outer admission boundary protects Native authentication, and revocation ends the
device's responses without ending unrelated host work. Settings and connection UI
identify the host and expose failure/retry states. The Workbench README owns setup
and focused test commands. This is source implementation, not full issue acceptance.
Protected transport setup, isolated remote previews, an exact Windows package and
the actual phone journey remain outstanding.

### Isolated preview source candidate

The next source slice adds embedded-only remote preview through a separate HTTPS
port and loopback listener. It retains existing project command review/start/stop
and requires a verified owned connection, a preview-only grant and credentialless
framing. One preview identity per app document requires a guarded real refresh
for another project or launch. Unknown socket ownership and unsupported browsers
remain denied. Transport stays off until explicitly configured. Focused source
checks do not establish Windows, actual-phone or live transport acceptance.
