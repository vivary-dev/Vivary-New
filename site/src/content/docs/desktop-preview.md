---
title: "Windows prerelease installation"
description: "Download, verify, install, preserve data, and review the limits of the Windows portable prerelease."
editUrl: "https://github.com/vivary-dev/Vivary-New/edit/dev/docs/desktop-preview.md"
---

Verified 2026-09-21. This is an unsigned Windows x64 portable preview of Vivary.
It includes the latest application changes merged through PR #76. It is available
from the [GitHub prerelease](https://github.com/vivary-dev/Vivary-New/releases/tag/desktop-preview-2026-09-21). The repository and download are public.
The complete desktop and self-hosted web acceptance journey remains unfinished.

## Download and verify

Download `Vivary-windows-x64-250aaa0.zip` and its `.zip.sha256` companion from
the release Assets list. The automatic Source code archives do not contain a
ready-to-run desktop application.

The ZIP is 236,048,361 bytes. Its SHA-256 must be:

```text
2b5b0c51bc0c85d8a3383783906dddb21e093a3787413717aa120f61df14946d
```

In PowerShell, from the download folder:

```powershell
$expected = (Get-Content .\Vivary-windows-x64-250aaa0.zip.sha256).Split(' ')[0].Trim()
$actual = (Get-FileHash .\Vivary-windows-x64-250aaa0.zip -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw 'Vivary archive checksum mismatch' }
```

If you already use GitHub CLI, download the pinned assets with:

```console
gh release download desktop-preview-2026-09-21 --repo vivary-dev/Vivary-New --pattern Vivary-windows-x64-250aaa0.zip --pattern Vivary-windows-x64-250aaa0.zip.sha256
```

## Install and launch

1. Extract the entire ZIP to a new, writable folder, such as `C:\Apps\Vivary\250aaa0`.
2. Keep all extracted files together. Do not move `Vivary.exe` out of `Vivary-win32-x64`.
3. Open `Vivary-win32-x64\Vivary.exe` in File Explorer.
4. Choose a project, use **Open folder**, or create a disposable project with **New project**.
5. Open **Runtime settings** to inspect the installed coding runtime and its readiness before sending a message.

There is no MSI or setup wizard in this release. Extraction is the installation
step. The application bundles Node, Python, and the original Vivary runtime.
It does not require a source checkout or a separate global Node or Python install.
Clean-profile first-run acceptance remains open, so report missing-runtime errors.

Vivary opens locally without a Vivary account. Claude Code, Codex, and model
provider access require their own supported installation and authentication.
Use your existing runtime subscription, tools, skills, and configured connections.
Bundling Vivary does not include model-provider credentials or paid service access.

The executable is unsigned. Windows may display an unknown-publisher warning.
Verify the download before deciding whether to run it. Keep Defender enabled.
No exclusion or file-association change is part of installation.

## Your data

The desktop keeps application data under `%USERPROFILE%\.vivary\workbench`.
This includes the database, run history, and managed projects. Electron stores
window and browser state separately under `%APPDATA%\Vivary` on Windows.
Existing folders registered with **Open folder** remain at their original paths.
Coding runtimes keep credentials and their own session data in their supported locations.

The desktop does not honor a caller-supplied `VIVARY_DATA_DIR` as a separate test
profile. Do not use that variable to claim isolation from your existing profile.
Use disposable projects for preview testing.

## Upgrade, backup, and rollback

1. Finish or stop active work, then close Vivary normally.
2. Copy `%USERPROFILE%\.vivary\workbench` and `%APPDATA%\Vivary` to a private backup location.
3. Back up registered external project folders separately if you need a complete recovery copy.
4. Verify and extract the new ZIP into a separate versioned folder.
5. Launch the new executable. Confirm your projects and saved conversations remain available.
6. Keep the previous package until you accept the replacement.

Backups can contain credentials, private conversations, and project content.
Keep them private. Never attach them to a GitHub issue or upload them as release assets.

Rollback across database migrations has not completed acceptance. Do not assume an
older executable can safely read a profile changed by a newer version. Preserve
the current profile before attempting recovery, and use a matching pre-upgrade
backup when returning to an older package. Changes since that backup require
separate preservation. This preview does not provide an automatic migration rollback.

To remove only the portable application, close it and remove its extracted
version folder. Keep the profile and registered project folders to preserve data.
There is no uninstaller or automatic update mechanism in this artifact.

## Try the changed experience

### Existing folders and setup preview

**Open folder** uses the Windows chooser. Cancel returns control to the app.
If the chooser times out, close it and use **Open folder** again. Browser access
to the same host does not supply the desktop chooser.

In a project, open **Details**, then **Preview Vivary setup**. Expand each file
to inspect its exact proposed contents, unchanged files, and any reported conflicts.
Existing `AGENTS.md` guidance remains visible when the plan proposes appending
the managed Vivary block. Previewing does not write the proposed files.
Applying setup to an existing folder is not available in this GUI yet.

### Project-owned page preview

Start your project's page using its normal command, then open **Preview** and enter
its HTTP or HTTPS URL. Vivary displays the owning project above the address field.
Preview embeds an already running page. It does not start a development server.

Closing and reopening Preview within the same project retains the page.
Switching projects clears the URL, embedded page, and new-tab target. Returning
to the first project also starts empty. This prevents another project's page from
appearing under the wrong owner.

Some pages and sign-in flows refuse embedding. In browser access, use
**Open preview in a new tab** when appropriate. This Windows executable blocks
arbitrary preview URLs from opening externally, so that button is not a working
desktop fallback. Copy the address into your normal browser instead. The preview
accepts HTTP and HTTPS addresses, not local file URLs.

### Project search and health

Use **Search** beside Files to find a file name or text inside the selected
project. Results open files at the matching line. Search also supports regular
expressions and reports invalid patterns. Switching projects clears old results.
This is project-file search. It does not establish full chat-content or semantic search.

Open **Details**, then **Check project health** to view the bundled Doctor's
findings. Non-Git writing and research projects remain valid project types.
Warnings and failed checks stay distinct. Search and health have earlier
candidate evidence, but this release's visual review did not repeat those journeys.

The creator also prevents cooperating apply/recovery processes on the same host
from overlapping work in one physical folder. That protection does not cover
arbitrary editors, older binaries, or another machine.

### Coding runtimes and original commands

New Code conversations can select the supported runtime and model. Saved
conversations retain their runtime and native session identity. Codex integration
includes its catalog, configured tools, action approvals, permission modes,
follow-ups, progress, and Stop. Earlier Windows candidates exercised real Codex
journeys. This exact artifact's visual review did not repeat paid model calls.

The bundled command launcher is available for command-line inspection:

```powershell
& 'C:\Apps\Vivary\250aaa0\Vivary-win32-x64\resources\original-runtime\bin\vivary.cmd' --help
& 'C:\Apps\Vivary\250aaa0\Vivary-win32-x64\resources\original-runtime\bin\vivary.cmd' adopt --help
```

The included creator contains approved adoption-request replay and bounded journal
fixes. Inspect its help and review plans before mutations. These backend changes
do not add a general GUI Apply button or publish newer PyPI/npm packages.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Checksum differs | Do not run that archive. Download both assets again and compare. |
| No window after launching from a terminal | Try File Explorer. An inherited `ELECTRON_RUN_AS_NODE=1` can make Electron run as Node. Remove that variable only from the launch shell and retry. |
| Windows asks which app should open a file | Cancel. Recheck that you launched the extracted `.exe`. Do not change file associations. |
| Folder selection times out | Close the chooser, then choose Open folder again. |
| Browser Open folder fails | Use the Windows app's folder chooser. |
| Existing project says Unavailable | Restore access to its original folder and refresh. The app retains its saved conversations. |
| Runtime is unavailable | Check that the supported coding runtime is installed and authenticated separately, then inspect Runtime settings. |
| Embedded preview is blank | Confirm the page server is running and the address uses HTTP or HTTPS. In browser access, try its new-tab link. In the Windows app, copy the address into your browser. |
| Setup content extends beyond the panel | Scroll horizontally, widen the panel, or maximize it. |

Remote access is a separate authenticated self-hosting configuration. This ZIP
does not publish your laptop to the internet. Consult the
[Workbench setup](https://github.com/vivary-dev/Vivary-New/blob/dev/packages/workbench/README.md) before enabling remote access.

## Verification and known limits

The exact source commit is `250aaa0567104541127767501de3bcf0d1c3549b`.
Its source tree matches merge commit `b4f52297f46e7751f38efd14f510b1323156dc67`.
The tag identifies the packaged source, rather than later documentation commits.
`resources\workbench\build.json` reports `sourceDirty: false`, version `0.0.0`,
and channel `private-preview`. These internal development labels remain in the
reviewed binary. The GitHub artifact is publicly downloadable as a prerelease.

The prebuilt Workbench metadata reports `sourceCommitVerified: false`. Separate
asset comparisons support the packaging record but do not establish complete
compiler-input provenance. The executable is unsigned.

The exact-candidate GitHub CI run passed seven jobs, including Windows governed
verification and Windows/Linux orientation proof. The separate Entire gate failed
because it recorded zero of one required reviewer approvals. Its CI subcheck passed.
This release does not relabel that gate as passing.

Direct Windows evidence covers download verification, launch with the preserved
profile, saved navigation/conversation visibility, and chooser recovery. Browser
evidence covers setup preview, zero changed fixture hashes, project-owned preview
retention and clearing, Files/chat navigation, reload persistence, and a 390-pixel layout.
The owner approved the screenshots and requested this prerelease.

Native restart and minimum-width testing on this candidate, a complete native
existing-folder registration journey, conflict cases, clean-profile onboarding,
upgrade/removal acceptance, real Native-provider turns, automations, full adoption,
search/memory coverage, self-hosted phone access, and integrated debugging remain
outside this bounded review. Browser evidence does not establish native acceptance.

See the [acceptance register](https://github.com/vivary-dev/Vivary-New/blob/dev/docs/product/multi-project/desktop-acceptance-status.md)
and [remaining release work](https://github.com/vivary-dev/Vivary-New/issues/23). For a bug report, include the
release tag, OS version, reproduction steps, and sanitized screenshots or errors.
Do not include credentials, profile databases, or private transcripts.
