# Project creation and approved background work

Issue [#35](https://github.com/vivary-dev/Vivary-New/issues/35) owns explicit background approval. The associated repair under [#15](https://github.com/vivary-dev/Vivary-New/issues/15) enables managed project creation in the hosted source runtime.

## Delivered behavior

New project previews the original creator's exact five-file plan before creating, registering, and selecting a separate managed folder. Cancel writes nothing. Concurrent create calls have one owner through apply and registration. Retry checks reject unexpected content, symbolic links, and hardlinks. Existing folders and stale grants are preserved.

Each Code message becomes a pending Native run request. The global approval card shows its exact instruction, project, runtime, capabilities, and two-minute limit. Approval starts that turn. Denial starts no model or tools and excludes the denied text from future model context. Pending, running, and completed outcomes remain visible, with the appropriate decision, Stop, and conversation controls.

Approval binds the request to its owner, organization, project, root, binding revision, runtime, and model. It revalidates after asynchronous checks before claiming the one-worker slot. Consumed decisions cannot launch again. Pending requests survive host restart. Interrupted work never resumes automatically.

## Verification

- Hosted UI: Preview, Cancel, Preview, Create, automatic project selection, and file inspection passed.
- Hosted denial: the exact pending request was visible, Deny completed without a 401, and its requested file was absent.
- Hosted real Sonnet turn: Read, Write, and Read completed in the new project. Working, Open conversation, and Stop were visible while the browser was on Settings.
- The same completed conversation reopened with its tool transcript and exact file result. A replayed consumed approval returned 409 without adding events.
- A follow-up remained pending through a real service restart. Its request ID, project, and conversation were unchanged, and no worker started.
- A fresh browser restored that pending conversation. Approval completed the follow-up in the same run, retaining the first file line and appending the second. The record contained two independently approved user turns.
- Phone-width, actual Chromium-close, and Stop acceptance: PENDING.
- All 53 focused Node checks, 3 managed creator Python checks, 7 original creator checks, and direct app typechecking passed. Production builds and plan, source-navigation, workflow, line-ending, and diff checks passed. Final CI is recorded on the PR.

The long hosted browser job timed out after 300 seconds. It is not accepted as a completed test. Separate Native-record/file checks and a short actual browser reopen established the completed run and visible transcript.

## Review and corrections

Independent review covered the owner transport, approval lifecycle, and creation boundary. Findings corrected transcript replay after staging, concurrent creator rollback, extra-content and hardlink retry acceptance, and shared rejected-session handling. Phone-width testing also found and corrected a draft URL that did not follow the newly saved conversation. Real production testing found and corrected the bundled creator bridge path.

The early mobile attempts launched no model work. One test expected the navigation
sheet to remain open after selection, another read the initial draft URL too soon,
and the next exposed the real draft URL convergence defect. These attempts are
preserved as failures. Their passing steps do not establish browser-close or Stop
acceptance.

## Scope limits

The source-hosted creator uses the original Python implementation. Bundling that runtime remains #7, and actual Windows/Electron acceptance remains #8. The managed new-project flow does not reconnect an unavailable historical folder grant or finish every existing-folder setup case under #15. Broader Full chat session coverage, unsent draft portability, provider-session storage, and factory scheduling retain their own issues.
