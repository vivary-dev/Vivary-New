# Project chat and draft continuity acceptance

Evidence-record: 17a
Date: 2026-09-24
Issue: [#9](https://github.com/vivary-dev/Vivary-New/issues/9)
Latest verified source: `12c8b35448b4d37bac3337109f2fab8a5e07c909`
Hosted result: five final focused cases passed on clean `12c8b354`, with the original Python runtime from `079fba00`
Packaged Windows result: focused `12c8b354` restart, history, archive, and draft checks passed in an isolated profile
On-screen keyboard unsent-draft case: passed on `12c8b354` with manual input, refresh, and changed-port restart
Delivery status: issue #9 and PR #88 remain open while later review fixes receive independent review and affected retesting

## Result

Vivary saves Native and Code conversation drafts in authenticated Native
application state under owner, organization, project, surface, and conversation
keys. The same state owner retains the active project, conversation, and surface.
A draft is not a message. Opening one never sends it or creates a second
conversation. Native still owns saved messages and queued follow-ups. Code still
owns its run events.

A draft save compares its observed revision. A successful send or explicit
Discard leaves a versioned empty record. Delayed edits cannot reuse an older
revision to restore cleared text. A Native message or queued follow-up settles a
pending send only after its submission ID appears in Native's saved thread.
Code checks the same ID in its saved user event. If delivery is uncertain,
Vivary keeps the draft pending and asks the user to review the conversation
before restoring its text for editing.

The maintained Core composer patch accepts a host-owned draft for the actual
thread. The opt-in Toolkit patch preserves line breaks, Unicode, and surrounding
whitespace in that draft. Other Toolkit consumers keep their prior text
callback and restore behavior. The desktop close path waits for the renderer to
save dirty drafts before stopping its local server. It leaves the window open
when a save fails or times out.

An unsent conversation without a Native thread row remains discoverable after
another conversation becomes active. The same authenticated Native application
state owner keeps an ID and timestamp marker for each draft. The marker contains
no text. History reads the authoritative draft record to display its preview and
its Draft or Review send status. A cleared record no longer appears as a
draft-only history row. Native keeps completed message history in its own
thread store. Code keeps the first accepted draft ID with its run. Reopening
that run uses the original ID for later drafts and pending-send reconciliation.
Older runs recover that ID from their accepted user event when available.

## Hosted journey

A normal Workbench build from clean `250b402f` ran with the unchanged original
Python runtime from `079fba00`. The source qualification matters because this
journey did not rebuild Python. The GUI saved different unsent drafts in two
projects and restored each exact conversation ID and text after sidebar
switches. An unavailable project folder kept its selected conversation and draft visible
while disabling send. The 390-pixel view had no horizontal overflow and kept
the send controls visible.

A disposable local responder handled one Native send. The accepted user message
and reply remained in the same conversation. Its saved submission ID reconciled
the pending draft to empty. A follow-up draft then survived refresh. Explicit
Discard cleared that draft without hiding the sent history. A delayed first
save followed by a newer edit saved each revision once. Discard also waited
for an in-flight save before writing its empty record.

The deterministic Code fixture accepted one user event for one submission ID.
It completed its normal reviewed approval and form controls without a real
model call. A bare-root restart on a different local port restored the selected
project, Code surface, conversation, and unsent Code text. After the Native
journey, another bare-root restart on a new port restored the other project's
Native draft. Switching back showed the same sent Native history with an empty
composer. The local responder received one request across the journey.

The first full private runner stopped after these product steps because its
message locator matched both a history title and the message body. It remains
recorded as a failed driver result. A focused continuation used its retained
disposable profile, checked the message body, and passed the remaining refresh
and restart assertions. No product change followed that selector failure.

## Draft-history regression after review

The first packaged candidate did not make draft-only Native conversations
discoverable once another conversation replaced the active selection. A started
Code run also kept its temporary draft ID only in the current selection, so a
follow-up could become unreachable when history reopened that run. Both
failures were reproduced in the original isolated Windows profile. The saved
draft records remained intact.

The reviewed `eb63459f` fix uses ID-only Native application-state markers and
the run's accepted draft ID. The current Workbench build reused unchanged
original Python runtime `079fba00`. A private hosted run saved two unsent Native
drafts and two unsent Code drafts in one project. The authenticated POST list
returned both IDs for each surface. The GUI reopened each Native ID with its
exact text and reopened the first Code draft with its exact text. The
deterministic Code fixture accepted one user event tied to that original ID.
Its later follow-up draft remained under the same ID after selecting another
conversation. A retained-profile continuation reopened that run and its draft,
then restarted on a different local port and reopened the same Code follow-up
and both Native draft-only conversations. No Native responder request or real
model call occurred in this regression.

The first `34d92872` browser driver did not capture GET list responses. Its
next run exposed a real HTTP 405 because the list used a GET-oriented query
against a POST-only action. The `eb63459f` build used the existing
authenticated POST action caller and returned HTTP 200. A subsequent driver
stopped when it expected the restored Code draft to be editable while the
fixture's default Claude runtime was unavailable. Its text was exact and
visible. Selecting fixture Codex enabled the editor without rewriting the
draft. Another continuation stopped on an outdated runtime-choice assertion.
Keep those runs failed. The passing continuation uses their retained
disposable profile. It does not claim that Code runtime choice itself is
stored as part of the draft. The second unsent Code draft was listed and
saved, but this composition did not reopen that second Code draft after
restart.

The first `eb63459f` Windows retest reopened a legacy Code follow-up from
the isolated profile. It then saved a new Code draft and showed its history
entry. Selecting the older run displayed a generic draft load error before
any draft read reached the local server. Retry restored the older text. The
candidate was stopped after capturing that failure, so it does not pass the
new packaged journey.

A follow-up working tree reproduced the error by interrupting Native session
refresh before the Code draft read. Waiting for session readiness removed the
false error and automatically restored the older draft when the session
recovered. Other focused hosted checks restored the unassigned Native view
from a bare root while keeping the project selected, refused restoration of
an archived owned thread, and retained an optimistic draft-only thread after
its Native thread lookup returned 404. A delayed archive response did not
navigate away from a newer selected conversation. An oversized Code prompt
returned to its editable saved draft without a Code send action. These checks
used a dirty Workbench build and the unchanged original Python runtime from
`079fba00`. They do not replace a clean-source packaged Windows retest.

## Focused interruption checks

One draft save returned HTTP 503. The GUI kept the text and showed Retry. Retry
saved the same draft. A separate test dropped the browser response after the
server had saved the draft. Retry received a revision conflict, showed Reload
saved draft, and reopened the exact server text without another send. This
injection models a lost response. It does not claim a physical network outage.

The renderer close function ran immediately after typing, with no intentional
autosave wait. It acknowledged the save, and refresh retained the exact text.
When a save returned HTTP 503, that function refused close. The visible Retry
saved the text, and a second close check passed. This proves the renderer half
of the close contract. The packaged EXE close result is recorded below.

A new Native conversation's draft initialization returned HTTP 200 while its
browser response was held. The user chose Code during that wait. Releasing the
late response left the Code route selected. The test used a copied disposable
application profile and made no model call.

## Packaged Windows journey

The unpublished Windows ZIP contains a clean source snapshot of `250b402f`.
It has 3,108 files, is 221,505,755 bytes, and has SHA-256
`8a287f4fdf199b1b0017e4dddc3ac91c09911595c022297fcefb157cccad9b79`.
The original runtime came from that source. Workbench was built separately
from the same clean commit, while its prebuilt metadata still reports
`sourceCommitVerified: false`.

The Windows run used an isolated application profile and a disposable local
responder. No real model call was requested.

The actual EXE created two projects through the GUI. Each reviewed a five-file
creation preview. Alpha's Native chat saved a Unicode draft with a real
Shift+Enter line break. Beta's Code chat saved different unsent text with a
simulated Codex model.

A normal close and bare-root reopen changed the local port from 57541 to
60810. It restored Beta's exact Code draft and conversation. Switching to
Alpha restored its exact Native conversation and multiline text.

An empty SQLite transaction blocked a draft save for 53.09 seconds and
changed zero rows. Alt+F4 kept the application open and showed **Draft not
saved** with **Keep working**. After the test lock was released, **Retry draft**
saved the retained text.

Another normal close and bare-root reopen changed the port from 60810 to
61376 and restored Alpha's conversation and recovered text. A Native GUI send
then received one local fixture reply. Refresh kept the sent history in the
same conversation with an empty composer. A later Native follow-up was saved
and explicitly discarded. Refresh left the follow-up absent while retaining
the reply.

Beta's saved Code draft was submitted once. Its user text reached a Code run,
then the fixture was deliberately stopped at the first approval. Refresh kept
the accepted user message with Codex stopped and an empty composer. This does
not claim a completed Code fixture turn.

A later unsent Code follow-up was saved, explicitly discarded, and absent
after refresh while the accepted history remained. A read-only audit of the
disposable profile found one Code user event, one Native user message, and
three cleared empty draft records. At the 02:07:36 UTC preservation
checkpoint, before the Code send and later discards, all 2,011 original-profile
files retained their hashes and counts, with no missing or extra files. A
post-run preservation check remains pending.

The Windows on-screen keyboard appeared, but the automation helper could not
inject text into its higher-integrity window. A later manual tap delivered
`x`, which appeared as a submitted user message with a local fixture reply.
Whether the user also pressed Send is unconfirmed. This observation does not
prove unsent keyboard draft saving or automatic sending. Desktop control also paused when other user
input was detected. An initial app process disappeared before project
creation without a diagnosed cause, so this receipt does not classify it as a
product crash. Issue #9 remains in progress until the keyboard case and final
delivery review are resolved.

## Verification and limits

Focused draft tests, Workbench typecheck and production build, desktop close
unit tests, and the exact-source maintained local gate passed. The installed
Core and Toolkit packages matched their pinned patches and lockfile hashes.
The hosted GUI also saved and reopened a Shift+Enter line break with Unicode.
A separate draft retained leading and trailing newlines and spaces in Native
state. Earlier builds had joined the lines. These checks ran against the
opt-in composer patch named above.

The private handoff retains event logs, screenshots, synthetic fixtures, and
qualified segment results. The ordinary user Vivary profile and provider accounts were not used for
these simulated journeys. The Windows run did copy a prior isolated synthetic
fixture profile. The earlier Windows evidence is partial because unsent
keyboard draft saving remains unverified. The `eb63459f` package was built,
but its first draft-history retest failed before a draft read. Acceptance of
the follow-up clean-source package remains pending, so earlier EXE results do
not certify the later fixes.
This receipt does not claim a completed Code fixture turn, published release,
or all of parent outcome 17. The private handoff retains the original Windows
record and its qualified follow-up results.


## Clean `12c8b354` result and later review

The clean `12c8b354` Workbench build passed five focused hosted cases. Two
unassigned Native drafts survived switching and a bare-root restart from port
55300 to 55301 with exact IDs and text. Session-readiness recovery, optimistic
Native restoration, delayed archive navigation, and the full 8,001-character
Code local refusal passed. The hosted build reused the original Python runtime
from `079fba00`. Its fixture Native provider and Code runner were synthetic.
No real model execution is claimed.

The unpublished `12c8b354` Windows ZIP has SHA-256
`8c1f9ee3c1c6a04a9ae71ea8865d69a462e9be895d45ce9ee22022528f166d84`.
The original runtime matches the source. The separately built Workbench prebuilt
metadata reports `sourceCommitVerified: false`, so source identity rests on the
recorded clean build and package checks, not that metadata field. In the isolated
Windows profile, normal close and bare-root restart changed the local port from
65038 to 61143. Both project Native drafts and both Code draft and follow-up
records reopened with exact IDs and text and no Retry error. The selected
unassigned Native draft reopened with its exact ID and GUI-edited text while
Alpha stayed selected. The other unassigned draft reopened from its visible
history row. The archived Native thread remained absent from the rail. A
read-only audit found six tested drafts unsent, one accepted Code user, three
accepted Native users, and one synthetic Native provider request. All 2,011
original-profile files remained unchanged. The candidate and fixture processes
were closed. The private `issue9-final-windows-rest-receipt.json` records the
corrected captures and cleanup.

The unassigned fixture rows and initial placeholder drafts were created through
supported authenticated APIs. The GUI appended `-GUI-A` and `-GUI-B`, then the
restart checks used those complete edited values. Earlier `issue9-12c8` named
screenshots captured stale initial state because of a saver binding error. They
are retained with that limitation. The corrected `issue9-final-*` captures,
live UI observations, and read-only owner audit support the Windows result.

A separate manual on-screen keyboard check entered lowercase `x` without
pressing Enter or Send. The same conversation ID and unsent `x` survived refresh
on port 65191 and a normal close and bare-root restart on port 56950. The
composer showed Draft saved. The final owner audit found seven tested drafts
unsent, with the Code and Native accepted-user counts and synthetic provider
request count unchanged. Candidate processes and fixture ports were closed.
The keyboard remained over the app during the captures. The unobscured composer,
accessibility tree, and owner audit support the result. The earlier `x` plus
Enter observation is a separate normal sent-history case. Private evidence is
listed in `issue9-osk-receipt.json`.

PR #88 subsequently received six valid review findings on the `12c8b354`
source: definite Code owner rejections, cleared draft-index growth, desktop
selection writes during close, hosted page unload transport, older Code runs
with saved follow-ups, and failed unmounted draft saves. Follow-up source fixes
are in review. The proposed page unload path requests keepalive only when the
full serialized UTF-8 body is at most 48,000 bytes. Browsers also limit the
aggregate in-flight keepalive budget. Larger or rejected requests use ordinary
transport. A beforeunload prompt helps if the user stays on the page, but it
cannot guarantee persistence after the user confirms leaving. The later fixes
and this receipt do not promote those changes
to accepted Windows behavior. Issue #9 stays open until independent review,
affected hosted and packaged retesting, required checks, and the reviewed merge
into `dev` finish. This result does not close parent outcome 17 or authorize a
release.
