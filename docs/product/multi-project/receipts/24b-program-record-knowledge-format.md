# Program record knowledge-format receipt

Evidence-record: 24b
Status: accepted
Date: 2026-09-10

## Accepted change

All 80 current program records use YAML for their sole `type`, with the remaining
planning fields and body preserved. The canonical parser reuses Tropo and rejects
missing, malformed, duplicate, nonmapping, non-string and wrong-class types, body
type declarations, and YAML aliases of body-owned planning keys. Unknown nested
custom metadata remains readable. Receipt and external-gate body parsing stays intact.

The preserved index renderer guards and size-checks each record, then validates,
parses and hashes the same saved bytes. It no longer maintains a second metadata
parser or mixes fields from one read with a hash from another.

## Verification

- The developer ran 83 canonical planning tests and four preserved renderer tests successfully.
- Independent QA accepted the parser and migration, then verified four renderer regressions including oversize-before-parse and concurrent-mutation handling.
- Lead reran those four tests with an explicit task-owned temporary root; all passed and that directory was empty afterward.
- Lead ran the private migration verifier successfully for all 80 records. Normalized fields, titles, IDs, body content and canonical graph/index bytes matched their pre-migration state.
- Final canonical planning, source-navigation, readiness, complete-index, plan/PRD and HTML/link checks passed after completion updates. The known line-ending failure remains the frozen registry fixture, with 4,115 CRLF lines preserved under its source custody.

The initial sandboxed fixture runs failed with Windows access-denied errors
before behavior was exercised. Elevated runs reached the actual tests. No runtime
environment or product model was invoked by this packet.

Private evidence is under the preserved `.tmp/vivary-continuation/24b/`.
`preimage-semantic-manifest.json` is a historical capture made before migration;
its capture-time status is not current progress. `acceptance.json` owns the
accepted result and code hashes. The live migration verifier detects later body
changes intentionally. Do not rerun the migration after normal ticket edits or
replace its captured expectations to hide those edits.

## Remaining scope

This accepts the outcome/packet class only. Frozen contracts and other Markdown
classes were not converted. This is not full-repository OKF conformance, installed
workspace enforcement, a zvec-grep installation, or product learning acceptance.
Outcome 24's installed-guide conditions and dependencies remain unchanged.
