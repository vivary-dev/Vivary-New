# Original project read tools acceptance

Evidence-record: 09b
Date: 2026-09-24
Issue: [#19](https://github.com/vivary-dev/Vivary-New/issues/19)
Latest verified source: `bd12e62058a9f4bbaf48eab0d796565ac64f70ab`
Hosted result: the 12-step journey passed on `bd12e620`, with Workbench and the bundled Python runtime built from that commit. Its first run on that build stopped at the first step, described below. The journey also passed on `9c026639`, `366ce16c`, `8576af0e`, `cc54be25`, and three times on `e87099d1`. A local fake model provider drove the agent, so no real model was called.
Packaged Windows result: the unpublished `e87099d1` package passed the full panel, agent, isolation, missing-folder, restart, and no-Git journey. The unpublished `8576af0e` package then passed the journey's affected steps on the same profile. The unpublished `bd12e620` package opened that profile and passed the checks listed below. Its panel reads and agent turn wait for a time when the owner is away from the laptop.
Delivery status: PR #89 into `dev` carries this work. Merge and issue closure wait for the owner's Entire trail approval.

## Result

The Details panel and the Native agent read five reports about the selected
project: Doctor, the note check, context find, optional capabilities, and the
sanitized command receipt log. Both call one module,
`packages/workbench/server/project-read.ts`, and receive the same result. The
agent tool `vivary-project-read` has no project field. Its project comes from
the chat's pinned scope. The panel's owner action names a project ID, which the
existing project-services admission resolves. Neither path accepts a host path.

Doctor, find, and check run the front door's `--public` path. Doctor checks the
workspace's files and settings without reading notes. Find and check read
through Tropo's privacy-filtered facade. A Git worktree uses its ignore rules. A
Vivary workspace without Git uses the workspace policy. Any other folder, or a
Git worktree on a host without Git, gets a clear refusal from find and check
instead of results.

The original runner runs reads in parallel and runs a write alone within its
project. A caller waits at the processor-sized ceiling, and a command that
cannot start within 30 seconds returns a retryable message. Each child writes
its receipt to a private file of its own, and the app appends it to the shared
log. The agent's tool call keeps caller `tool`. Project services match it to
its chat's project through the scope the request carries, and resolve that
project alone. The runner's policy table lets a tool call run the five reads
and nothing else.

## Review

A four-model panel reviewed `3c87c010`, and its accepted items were fixed in
`a18ebc1`. A second four-model panel reviewed `486f7a50` and found seven
issues, all fixed by `cc54be25`:

- Doctor reported findings from Git-ignored notes, with their paths and field
  values. `vivary doctor --public` now skips the note walk.
- Receipt totals counted only the latest 40 records. `logs --json` now adds a
  whole-log summary.
- Run failures reached project-read as untyped error codes. The runner now
  returns them as typed values.
- The chat resolver relabeled a tool call as an HTTP caller. It now keeps
  caller `tool` with an explicit read admission.
- The Core parent-walk guard caught every error and had no test. It now checks
  the rendered thread before the lookup, and a test covers it.
- A missing receipt log was detected by matching Python's stderr text. The
  runner now reports it.
- Parallel Python children could overwrite each other's receipt on Windows.
  Each child now writes its own file.

A third panel reviewed `8576af0e`. Fixes landed in `0ba213c`, `12a3735`,
and `208f565`:

- Public Doctor still named module folders that Git ignores. It now counts
  module index problems without naming them.
- Run folder cleanup could turn a finished write into an error. Cleanup now
  retries and never decides a command's outcome.
- Tool admission reached shared gates. One entry point in project services
  now admits a chat's tool call for its own project alone.

A fourth panel reviewed `366ce16c`. Fixes landed in `f3974ee`, `d9f4bc2`,
and `9c026639`:

- Public Doctor copied a Tropo exception that named an outer folder's host
  path. Public messages became fixed sentences.
- A governed write whose component recorded nothing still succeeded. It now
  fails with the receipt error.
- The send guard and the tool matched a chat to its project by two rules.
  Both now use the chat scope id.

A fifth panel reviewed `9c026639`. Fixes landed in `8842bba`, `7394a03`,
and `bd12e62`:

- Public Doctor's privacy still relied on each message calling a helper.
  Doctor now records each problem as a rule, and public output prints only a
  sentence from a closed table. A test fails when a rule has no public
  sentence.
- The chat match took its scope id from the caller. It now reads the scope
  from the request.
- A crash between the receipt append and cleanup could append a receipt
  twice. The app now deletes a receipt once it is appended, and a folder
  whose receipt was not appended waits for the next sweep.
- Shutdown returned before a stopped command wrote its receipt. It now
  waits for the receipt.
- Tests read the policy table they checked. They now spell out each
  expected receipt source, and the table carries a tool column that the
  runner enforces.

## Hosted journey

Each hosted run built Workbench and the bundled Python runtime from the tested
commit on Zo. The journey registered a Git coding project and created a Second
brain notes project through the GUI. The coding project holds two Git-ignored
files, one of them a decision with an invalid field value. Every run passed the
same 12 steps:

- A personal chat refused project reads.
- Each project's panel ran all five reads at once, and every report equaled the
  bundled CLI's output for the same project.
- A check finding link opened its file inside the project.
- The panel fit a 390-pixel viewport.
- The agent ran Doctor, check, and find in one turn and received the panel's
  exact reports.
- A model-supplied project ID, malformed input, and a path-like question were
  refused.
- The notes chat read only its own project.
- A missing folder showed Unavailable, the server answered 409, and the
  restored folder read again.
- Receipts listed the app's own find and check runs.
- Authored files stayed byte-identical in both projects.

On `8576af0e` and later, no report named the Git-ignored decision or its
value. The Python test for `doctor --public` creates a real workspace in a Git
repository with a Git-ignored note that has an invalid value. Plain Doctor
names the note, and public Doctor does not.

The first run on `bd12e620` stopped at its first step. The runtime menu's
Native chat choice did not open a chat within 30 seconds, and the page showed
no error. The next run on the same build passed all 12 steps. The crash repro
on that build opened 24 Native chat turns without the failure.

## Agent panel crash

Repeated hosted runs showed the Native agent panel's error boundary after a
refused tool turn. A focused repro reached it on its third turn. Core's
assistant message component walked to a parent entry that the thread store no
longer held. The existing Core patch now stops the walk at a parent the rendered
thread does not hold, without catching other errors. The repro ran 32 turns
each on `cc54be25`, `8576af0e`, `366ce16c`, and `9c026639`, and 24 turns on
`bd12e620`, with no error boundary and no page error.
The remaining console errors are 404 responses from Core's thread lookup before
a new thread row exists and from Core's `available-clis` route, which Workbench
does not mount. The build before the Core change shows the same responses.

## Packaged Windows journey

Each unpublished Windows ZIP has 3,108 files. Their Workbench metadata reports
`sourceCommitVerified: false`, so source identity rests on the clean build and
package receipts.

| Candidate | Bytes | SHA-256 |
| --- | --- | --- |
| `e87099d1` | 223,729,572 | `7b09249f23b5987fe87c9d9d1b8c681932c1855c16dd9cb310225c714c52e177` |
| `8576af0e` | 223,730,222 | `6a57fa91666df3bf90e6214f882409bc0686374cc64b341dd868d53ecdc7032e` |
| `bd12e620` | 223,732,283 | `442475042220d70957d5057f7a5515292b5025e65f4449029824c1fa79adfaac` |

The `e87099d1` EXE ran with an isolated application profile, no provider
credentials, and a local fake model provider. The GUI created two projects.
RelayService received two notes, a Git-ignored private note, and an `.env`
file, then became a Git worktree. FieldNotes stayed a Vivary workspace without
Git. With Git on the path:

- Check reported one private file excluded. Find for "gamma relay" returned
  `notes/relay.md` and `docs/routes.md` but not the private note that contains
  the same words. Result links opened their files.
- Optional features listed the Coding preset. Receipts listed 16 entries with
  no invalid lines.
- The agent ran Doctor, check, and find in one turn, and no tool result held a
  drive path, user folder, or candidate folder.
- A model-supplied project ID, a find without a query, a dash-leading query,
  and a path-like question were each refused. The panel stayed usable.
- FieldNotes check covered 4 notes, and find returned only `field-log.md`.
- Renaming the RelayService folder showed Unavailable. Restoring its name and
  choosing Retry read it again.

A restart with only `C:\Windows\System32` and `C:\Windows` on the path kept
both projects and the chat. RelayService check and find showed the refusal
that names the missing Git requirement. FieldNotes check covered 4 notes with
no errors, and find returned `field-log.md`.

The `8576af0e` EXE then opened the same profile, as an upgrade would. Before
launch, RelayService received a Git-ignored note whose `status` field holds a
deal name. The package's bundled `vivary doctor` named that note, and
`vivary doctor --public` did not.

- Project health showed Healthy with no findings. Nothing in the window named
  the private note.
- Note check covered 5 notes with no errors and 2 private files excluded.
- Receipts showed 3 of 29 commands failed. The shared log held 29 valid lines,
  including receipts that child commands wrote to their own files, and no
  per-run directory remained.
- The agent ran Doctor, check, and find in one turn through the tool admission.
  No tool result named the private note or held a host path. Refused input
  showed one period per message, and the panel stayed usable.
- Without Git, Project health still showed Healthy, and Note check showed the
  Git refusal. The chat survived the restart.

The `bd12e620` EXE opened the same profile and restored both projects and the
RelayService chat with its history.

- The package's bundled `vivary doctor` named the Git-ignored deal note.
  `vivary doctor --public` returned `ok` with no errors, no warnings, and no
  host path.
- Opening the project ran `adopt --json`. Its child wrote its receipt to a
  private file, and the app appended it to the shared log. The log held 42
  valid lines, and no per-run folder remained.

The panel reads and the agent turn did not run on this package. The retest
drives the window with typed keys, and the owner was using the laptop.

Each normal close left no Vivary process within 20 seconds, and the provider
and app ports closed. Both fixture folders matched their snapshots from before
each run in hashes, sizes, and modification times.

During the `e87099d1` run, an accessibility click on the find field shifted the
whole window up by about 40 pixels. A hosted probe then moved keyboard focus to
the same field at four window sizes, and only the Details panel's own scroll
container moved. The shift came from the automation's scroll-into-view request,
not from the app.

## Verification and limits

On `bd12e620`, the Workbench checks read their commands from `ci.yml` and
passed: typecheck, `tsc`, the two tsx lists (57 of 57, and 261 of 262 with one
existing skip), the two node lists (28 of 28 and 12 of 12), and
`test:maintained`. The runner and read tests passed five repeated runs. Line
endings and `git diff --check` were clean. The vivary CLI suite passed 18 of
18 on `8842bba`, which holds the last Python change.

`test_create_vivary.py` fails on Zo with or without this work, so it ran on
the Windows laptop from a clean export of `bd12e620`. Its 74 Doctor tests
passed with one skip.

A Zo restart rolled back the hosted run files for `486f7a50`, so this receipt
does not count them. The Windows runs used fixtures and a fake provider. They do
not claim a real model's tool choices. The hosted and Windows runs used
synthetic projects, not the ordinary user profile. The private handoff keeps
the screenshots, provider logs, and snapshot files.
