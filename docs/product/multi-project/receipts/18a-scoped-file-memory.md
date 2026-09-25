# Scoped file memory acceptance

Evidence-record: 18a
Date: 2026-09-25
Issue: [#21](https://github.com/vivary-dev/Vivary-New/issues/21)
Latest verified source: `17e2996e8fa8001cc8d041c1933e0a4f3fd16aba`
Hosted result: the 11-step journey passed three runs in a row on `17e2996e` (runs `run-17e2996-01` to `03`), with Workbench and the bundled Python runtime built from that clean commit. The build record `issue21-build-17e2996e.json` exited 0, and the runtime manifest names commit `17e2996e8fa8`. It had also passed three runs in a row on the earlier `4fbc54ef` (runs 06, 07, and 08). A local fake model provider drove Full chat, so no real model was called there. Git was not on the app's PATH.
Real-agent result: one Codex account ran two model turns on `17e2996e` (run `codex-17e2996-01`), and the same check passed earlier on `4fbc54ef` (run `codex-4fbc54e-04`). No real Claude Code turn ran, and no real Native-provider Full chat turn ran.
Packaged Windows result: not run.
Delivery status: [PR #93](https://github.com/vivary-dev/Vivary-New/pull/93) is open from branch `feat/scoped-file-memory`. Commits `52ea347` and `8ce1a34` after the verified source change only documentation and one test. The lead reported that the hosted journey passed three runs and the real Codex check passed on `2324e7f`, which holds the pre-merge review fixes. Those runs are not recorded in this receipt. The second review's fixes after `2324e7f` are covered by unit tests until the lead reruns hosted QA. The work is not accepted.

## Result

A project fact is one Markdown file with `source` and `confirmed`
frontmatter, saved in `.vivary/knowledge/` or a folder the `memory` role
names. Tropo types it as `vivary_fact`. The Memory section in Project details
remembers, corrects, and forgets facts through their files. Code and Full chat
load the project's instructions, state, and facts at the start of every
message. Project chats lose Native's owner-wide `resources`, `save-memory`,
`delete-memory`, and `chat-history` tools and its database tools `db-schema`,
`db-query`, `db-exec`, and `db-patch`. Personal and legacy chats keep them.

## Hosted journey

Each run used Workbench and the bundled runtime built from `17e2996e` on Zo
and passed the same 11 steps:

- The GUI created a thin project, Alpha, and registered a plain folder, Beta,
  that had no Git and no Vivary files.
- Alpha remembered "Relay budget". The file
  `.vivary/knowledge/relay-budget.md` held `source` and `confirmed`
  frontmatter, and `vivary check --public` reported 0 errors and no finding on
  the fact.
- Beta remembered "Deploy window" in its own `.vivary/knowledge/`.
- After an app restart, a Personal chat request carried no project block and
  kept Native's tools.
- A fresh Alpha Full chat request's system prompt carried Alpha's fact only.
  The fake provider removed the Full chat sentence about Native's owner-wide
  tools, hashed the rest, and that revision equaled the panel's last-load
  revision. The request's tools excluded `resources`,
  `save-memory`, `delete-memory`, and `chat-history`, and the block stated
  that those tools are unavailable.
- A fresh Beta chat carried Beta's fact only.
- Correct rewrote the same file. The already open Alpha chat's next request
  carried the corrected fact with a new revision.
- Forget showed the disclosure and deleted the file. The next request said no
  facts are saved.
- Renaming Beta's folder made the memory read refuse with 403 or 409.
- The Memory panel fit a 390-pixel viewport.
- No page errors appeared.

Core's compact resources context note still appears in project chat prompts.
Core cannot remove it per request, so the block says the tools are
unavailable.

## Real-agent check

Run `codex-17e2996-01` used one Codex account with model `gpt-6-astra`. After
a restart, a fresh Codex conversation answered "The relay budget is 43 credits
per week". Its transcript had no tool events and showed the note "Loaded
project context ctx-…: 1 fact from .vivary/knowledge, instructions from
AGENTS.md, .vivary/context.md, state from STATE.md." After a Correct in the
panel, the same resumed Codex thread loaded changed context, its note said the
context changed since the last turn, and it answered "47 credits per week".

Claude Code was not signed in on Zo, so no real Claude turn ran. Claude's
prompt path is covered by unit tests only. Real Native-provider Full chat
turns remain [issue #50](https://github.com/vivary-dev/Vivary-New/issues/50).

## Observations

- One journey run (04) got "The result is uncertain" on folder registration,
  with "SqliteError: database is locked" in the server log. Three later runs
  did not repeat it.
- One Codex run (03) got a "This fact changed after you opened it" conflict
  when the panel had loaded its view immediately after an app restart and the
  file had not changed. A replay on the same data made four clean
  corrections. The cause is not isolated. Stale file metadata on Zo's 9p
  filesystem right after the restart is suspected. The panel's "Use current
  version" recovers.

Journey script bugs fixed during QA are not product findings.

## Final fixes

The last code commit, `17e2996e`, rolls back a Code turn's context revision
when the turn fails, stops, or is interrupted, so the next resumed Codex turn
sends the full block. Only the Full chat block names Native's owner-wide tools.
The revision is the SHA-256 of the Code form of the block, so Code and Full chat
loads of the same content share one revision. The hosted journey and the Codex
check above ran on this commit.

## Pre-merge review fixes

A pre-merge review of PR #93 and the Codex GitHub reviewer found issues that
the next commits fix. The hosted journey and Codex check above predate them,
and unit tests cover them until those checks run again:

- Project chats also lose Native's database tools, which could read the
  owner-scoped resources table.
- Memory privacy fails closed. A positive `.gitignore` rule matches without
  regard to case, including letter-bracket rules, and Remember checks the
  exact new file name against the rules. Correct and Forget refuse an ignored
  fact file. Doctor's own matching is unchanged.
- A resumed Codex thread gets the full block every turn, like Claude. The
  unchanged-line branch and its revision rollback are removed.
- The context cache is reused only when the files it depends on did not change
  around the engine call, and invalid answers are never cached.
- The block escapes control characters in paths, reserves room for
  instructions, bounds every path list, names law files past the first three,
  and says facts come from files that anyone who can write to the project can
  change.
- A locked or unreadable fact file becomes a skipped entry or a fixed message,
  and non-portable Windows paths are refused.

## Second review fixes

A second review of `3e21310` and `2324e7f` found places where memory failed
open or said the wrong thing. Unit tests cover these fixes until the lead
reruns hosted QA:

- The engine reports the Markdown file names it checked in each memory folder.
  The Workbench loads, corrects, and forgets only those, so a file past the
  engine's first 200 names or created during its call is skipped as not
  checked. This replaces the earlier claim that only ignored files are not
  loaded or changed.
- The engine reads `.gitignore` with or without a byte order mark, and a
  positive rule with a bracket it cannot parse matches.
- Law files past the first three are named only when they could load. A
  private, boundary, protected, or non-portable law file is never named.
- Forget notices never mention a draft, and a Forget of a removed file says it
  was already removed.
- A lock is EBUSY, EPERM, or EACCES on Windows and EBUSY elsewhere. Elsewhere
  EACCES and EPERM are a permission refusal with their own wording.
- The settings message and paths escape C1 controls and the Unicode line and
  paragraph separators, and every memory write failure has fixed wording.

## Not run

- Windows packaged acceptance.
- The narrow-browser journey on a real phone.
- The journey with optional semantic providers enabled.
