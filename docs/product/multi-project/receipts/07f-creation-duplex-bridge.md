# 07f receipt: Correlated Native/Python creation bridge

Evidence-record: 07f

Status: Complete for the bounded Linux child-protocol proof with trusted fixture composition.

## Accepted behavior

The private bridge composes the existing Native receipt/effect port with the
existing Python creation engine. One-use apply claims, strict bounded JSONL,
connection-local identifiers and exact parent correlation keep receipt operations,
effect invocation and nested current-authority reads in their intended lanes.
The Python engine retains its actual synchronous completion object. A wire result
does not replace that identity sentinel. Core imports Core; the fixture injects
the existing scaffolder and Tropo.

An admitted callback and its held Native mutation scope remain pending until the
trusted lifecycle confirms quiescence on failure. A timeout initiates stopping;
it does not release custody. Duplicate or malformed terminal input invalidates
provisional success, while expected empty EOF after a valid final reply does not.
Startup faults cannot restore a ready state. Neither entrypoint configures a
production worker by default. No retry, receipt rollback, registration or target
deletion was added.

## Runtime evidence

The corrected Habitat run passed all 34 cases with zero failures, cancellations or
skips in 24.587 seconds, including its toolchain preflight. It used Node 22.23.2,
Python 3.12.3, Core 0.176.5, SQLite 3.53.2 and better-sqlite3 12.11.1.

Actual Native database/Python cases exercised creation, nested authority reads,
the local completion sentinel, pre-admission refusal, preparing/publishing
uncertainty, real scope contention and quarantine teardown. They independently
confirmed the Python fixture PID was absent before removing its case directory.
Final published-receipt/EOF/duplicate-reply cases used injected frozen receipts
and fake lifecycle I/O. Those cases prove bridge handling, not another database
publication or real subprocess execution.

The first run passed 31 of 34. Test corrections retained normal Python startup
time, armed short fault deadlines at the operation phase, established actual
scope contention before revocation, and preserved the original error if cleanup
also failed. Only the test file changed between the failed and passing runs.
An intervening transfer preflight refused an omitted source preimage before
starting tests. The reviewed archived preimage was then bound explicitly.

The conservative child-process budget included the Node CLI, Node test-file
process, Native database worker and Python fixture; orchestration processes were
additional. Maximum reported child RSS was 137992 KiB, not aggregate memory.
Normal bridge limits were 16 KiB frames, 5-second RPC, 20-second effect,
60-second apply and 5-second stop confirmation; focused fault profiles were
separately frozen. These are configurable transport settings, not model limits.

## Independent review and cleanup

Independent Astra review accepted the source and the final archive, verified all
52 manifest-covered payloads, and checked the four source/27 dependency hashes
against the run result. The final archive has 53 entries and is 745443 bytes.
SHA-256:
`9238570f9c6f346086204d25d75f6ca803df06bc22f8195695c03adb0c418ba6`.
It includes the first failed run, its retained synthetic fixture, correction
provenance and exact cleanup evidence.

The version, SQLite and test process groups 744, 745 and 752 were independently
confirmed absent. All cases, the copied Node binary and the exact Habitat proof
stage were removed after evidence readback. After archive acceptance, 13 local
proof/source duplicates totaling 522195 bytes were removed. Reviewed code remains
in the existing canonical and Habitat checkouts. No container was started, no
model was called and no user project was written.

## Remaining integration

Bounded lifecycle startup and whole-writer quiescence remain trusted host
requirements. Native-parent-death fencing and arbitrary writer descendants are
not proved by this child fixture. Production remains unconfigured. Protected
production custody, trusted registration and creation GUI delivery remain open;
Outcome 07 is not complete. Follow the current program frontier for executable
work while the next creation integration packet is prepared.
