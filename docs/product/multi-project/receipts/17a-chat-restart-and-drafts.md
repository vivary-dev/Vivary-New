# Project chat and draft continuity acceptance

Evidence-record: 17a
Date: 2026-09-24
Issue: [#9](https://github.com/vivary-dev/Vivary-New/issues/9)
Hosted source: `250b402fd07a22a0596b8a4c60889f1101d6905e`
Hosted result: passed through the qualified main, continuation, and focused journeys below
Packaged Windows result: continuity cases passed
On-screen keyboard input: pending

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
inject text into its higher-integrity window. This leaves keyboard input
unverified rather than proving a draft-input failure. Desktop control also paused when other user
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
qualified segment results. The original fixture profiles and unrelated
accounts were not used. The Windows evidence is partial because keyboard input
remains unverified.
This receipt does not claim a completed Code fixture turn, published release,
or all of parent outcome 17. The private handoff retains the original Windows
record and its qualified follow-up results.
