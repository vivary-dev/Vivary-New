# 20j creation and context verification

Evidence-record: 20j
Verification-kind: runtime
Verification-result: failed

## Initial evidence

- `git branch --show-current`: `docs/context-compaction-policy`, exit 0.
- `git rev-parse HEAD`: `84596ca4fabeeaa4ea5551e784da69eb1f05d992`, exit 0.
- `git diff --cached --stat`: empty, exit 0.
- First sandboxed CIM and `wsl --list --running --quiet` reads failed with
  access denied. Those readings did not admit runtime.
- Elevated read-only preflight, 2026-09-11 02:16:33 UTC: available RAM
  4,343,701,504 bytes, commit headroom 10,765,684,736 bytes, free disk
  158,747,062,272 bytes. WSL running inventory was empty, exit 0.
- Included usage API: weekly 88 percent used. The other Codex window was
  unavailable. No reset consumed. No model process launched.

## Open verification

The prior revision of both seam regressions passed after their observed failures.
The corrected iteration-pairing assertion has not had a new runtime run. The full
loop suite did not pass. Packet acceptance remains open.

## Runtime evidence

Private `.tmp/20j/attempts.jsonl` records the original six batches totaling
290.581 seconds, followed by the separately approved rerun described below.
Each phase has a log, source manifest, resource samples, and cleanup result.
The runner is `docs/product/multi-project/fixtures/20j/run_habitat.py`.

| Phase argument | Result | Evidence |
|---|---|---|
| `red` | Runtime failed before tests | Missing default Windows mount, exit 2. |
| `corrected` | Runtime failed before tests | Proof mount did not survive separate WSL invocations, exit 2. |
| `red-mounted` | Runtime failed before tests | Existing checkout read-only assertion failed, exit 1. |
| `red-ready` | Runtime failed before tests | Windows/9p heartbeat rename failed, observer stopped the unit, exit 90. |
| `green` | Intended failing-before result | Both new tests failed on unchanged code: missing composition module and raw specification projection. Exit 1. The phase label predates this correction and does not mean a passing result. |
| `suites` | Mixed runtime result | Both changed seams, 45 Core tests, and 55 workbench tests passed. Three loop checks failed. Batch exit 1. |
| `loop-recheck` | Runtime failed | Four loop checks stopped on clock rollback. The integration assertion mispaired iterations and was corrected afterward. Batch exit 1. |

The `suites` batch used actual generated disposable workspaces and synthetic role
adapters. `ShippedCompositionTests` compares all five files byte for byte against
`create_vivary.main(["init", target, "--json", "--no-wizard"])`, calls shipped
Doctor and Tropo check, then exercises two planner stages receiving governed capsules.
The prior assertion compared a capsule with the first receipt returned by the
filesystem. Its later iteration-pairing correction has only source review and
retained-evidence verification, not a fresh runtime pass.
These are real filesystem integrations with synthetic authority and role adapters.
They do not prove production authentication or an enabled GUI creation route.

Exact final commands, relative to the bound source root:

```console
python3 -B tools/tests/test_shipped_composition.py
python3 -B -m unittest discover -s packages/core/tests -p test_creation*.py
python3 -B tools/tests/test_hoh_loop.py
node --max-old-space-size=192 --import packages/workbench/tests/register-native-dependencies.mjs --test --test-concurrency=1 packages/workbench/tests/creation-provider.test.mjs packages/workbench/tests/creation-effect-port.test.mjs packages/workbench/tests/creation-receipts.test.mjs
```

The command summary in `.tmp/20j/suites.log` records exit codes 0, 0, 1, and 0.
The Node summary records 55 passed, zero failed. Core records 45 passed.
The loop records 63 tests and three errors. One error explicitly detected wall
clock rollback. Two failed planner receipts record exit -15, timeout, and confirmed
process cleanup. Their cause remains unproved. Do not relabel them passed.

## Source changes and deletions

`creation_workspace.py` supplies shipped operations through the existing trusted
stdio composition. The two Core creation fixtures now inherit those operations.
Removed their duplicated normal plan, recovery-plan, scaffold, and Doctor wiring.
No template generator existed in Core, and none was deleted. Core's authority,
custody, byte comparison, receipt admission, rollback, and default refusal remain.
The byte-comparison regression and 55 workbench checks prove this replacement.

`tools/hoh/context.py` calls governed Tropo through the existing process owner and
checks the shipped capsule integrity and exact project scope. The coordinator
projects that capsule instead of the specification and records its fingerprint.
The specification stays available to QA. No new dependency, model call, registry,
queue, scheduler, or transcript store was added.

## Review, resources, and cleanup

Independent source review checked shipped signatures, capsule integrity, scope,
and receipt binding. The omitted workbench source binding was added before the
final batch. Guard review found path, serialization, ownership, and cleanup gaps.
They were corrected before product tests ran.
The final run recorded 1,020 host samples with at least 4,188,176,384 bytes of
available RAM. Included weekly usage was 90 percent. The other usage window was
unavailable. This agent made no reset or paid model request.
All seven runs reported their named service unloaded, MainPID zero, and cgroup absent.
Process cleanup is accepted separately from test acceptance. Disposable retained
files were archived, the archive hash matched the source stream, and the exact
packet scratch tree was removed after confirming its proof mount and cgroup absent.
`.tmp/20j/archive.json` records 40,325,120 bytes, 15,379 archive members, and
SHA-256 `f3bdba4320feb73bb244a568a9046c838402003a878bcc9e42576093cf188629`.
Windows retains this one archive, phase logs, manifests, resource samples, and
the private helper/configuration. Shared Habitat checkout, tools, Docker services,
and the preserved Littleagent checkout were not changed.

## Documentation checks

Program render and `--check` passed. `git diff --check` passed.
`check_line_endings.py` failed on the pre-existing CRLF
`docs/product/multi-project/fixtures/project-registry.json`. No formatting sweep
was performed. The first program check caught private environment paths in the
proof helper and packet. They were moved to private configuration and recheck passed.

## Approved rerun and remaining failure

The owner answered "Approve one bounded rerun" after the original six batches.
`python docs/product/multi-project/fixtures/20j/run_habitat.py loop-recheck` ran
under that additional 180-second bound. Its five-second clock preflight had a
731 ns offset spread. The batch took 123.904 seconds and exited 1 with cleanup
accepted. Total runtime across seven batches was 414.485 seconds. No additional
runtime attempt remains authorized.

The loop rerun had one assertion failure and three errors across 63 tests.
Its three failed retrieval receipts all record `ClockError: wall clock moved
backward`, exit -15, timeout, no orphaned descendants, and confirmed cleanup.
The fourth loop failure raised the same clock error directly before a stage.
This proves why dispatch stopped, not what caused the underlying clock movement.
The separate two-test integration run had one failure because its unordered
receipt selection compared different iterations. The assertion now checks both
iterations by ID. Read-only examination of 35 retained complete planner receipts
found zero mismatches against their own capsules. The corrected test has not been
rerun against a newly created workspace.

The first post-change batch remains a recorded pass for both integration tests.
The later failures remain failures. Neither batch establishes a fully passing
loop suite or production GUI readiness. Resolve clock behavior and authorize a
further bounded check before accepting 20j or starting 20k.

The account usage API returned zero percent before the rerun and one remaining
reset credit. This agent did not call the reset tool. Earlier 88-90 percent
observations remain historical readings.

## Local commits

- `22a54e1`: packet claim and initial receipt.
- `86ce5dd`: exact creation-preview API, existing API documentation, and test.
- `9135ce1`: existing workbench package metadata and lockfile. No install or bump.
- `faf1d40`: creation composition, its required Core/database source, and tests.
- `09f0f0d`: governed planner context, its existing bounded runtime imports,
  prompts, and tests. Native-model execution remains unproved.

These commits capture the required pre-existing source dependencies as well as
the new integration. Unrelated dirty files remain outside these commits. The
quarantine evaluator and wizard-test changes were deliberately left unstaged.
