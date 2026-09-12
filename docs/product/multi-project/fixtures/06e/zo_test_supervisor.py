#!/usr/bin/env python3
"""Run one bounded 06e C5 test in an isolated Zo sandbox."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / ".tmp/06e/zo-test"
APP = ROOT / ".tmp/05b/zo-runtime/app"
MEMORY_STOP = 1536 * 1024**2
TASK_STOP = 64
HOST_RESERVE = 1536 * 1024**2
OUTPUT_STOP = 8 * 1024**2
SAMPLE_SECONDS = 0.25
TOTAL_BUDGET = 300
LIMITS = {"activity": 90, "component": 75, "mutant": 75}
STATUSES = {"reserved", "finished", "refused"}
PROFILE = {
    "schema": "vivary.06e-zo-c5-test-profile/v1",
    "sandbox": {
        "uid": 1000, "gid": 1000, "userNamespace": True, "pidNamespace": True,
        "networkNamespace": "private-loopback-only", "capabilities": "none",
        "noNewPrivileges": True, "app": "read-only-05b-snapshot",
        "proofInputs": "read-only-06e-snapshot",
        "writable": ["/work", "/tmp", "/home"],
    },
    "supervision": {
        "kind": "external-observer", "enforcement": "monitored-stop",
        "memoryStopBytes": MEMORY_STOP, "taskStopCount": TASK_STOP,
        "sampleMilliseconds": 250, "cpuCount": 2, "swapTotalBytes": 0,
        "hostReserveBytes": HOST_RESERVE, "combinedOutputStopBytes": OUTPUT_STOP,
    },
    "deadlinesSeconds": LIMITS,
    "cleanupSeconds": 5,
    "attemptsPerRun": 1,
    "totalSecondsIncludingCleanup": TOTAL_BUDGET,
}


class Refusal(Exception):
    pass


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json_atomic(path: Path, value) -> None:
    temporary = path.with_name(path.name + ".new")
    with temporary.open("x") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def validate_ledger(value) -> list:
    assert isinstance(value, list)
    names = set()
    for entry in value:
        assert isinstance(entry, dict)
        assert set(entry) >= {"name", "chargedSeconds", "status"}
        assert entry["name"] in LIMITS and entry["name"] not in names
        names.add(entry["name"])
        charge = entry["chargedSeconds"]
        assert isinstance(charge, (int, float)) and not isinstance(charge, bool)
        assert math.isfinite(charge) and charge >= 0
        assert entry["status"] in STATUSES
    return value


def meminfo() -> dict[str, int]:
    values = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        match = re.fullmatch(r"([^:]+):\s+(\d+) kB", line)
        if match:
            values[match.group(1)] = int(match.group(2)) * 1024
    assert {"MemAvailable", "SwapTotal"} <= set(values)
    return values


def namespace(name: str) -> str:
    return os.readlink(f"/proc/self/ns/{name}")


def process_table() -> dict[int, dict[str, int]]:
    result = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / "stat").read_text().rsplit(")", 1)[1].split()
            status = (entry / "status").read_text().splitlines()
            result[int(entry.name)] = {
                "parent": int(stat[1]), "pgrp": int(stat[2]), "started": int(stat[19]),
                "rss": next((int(line.split()[1]) * 1024 for line in status if line.startswith("VmRSS:")), 0),
                "threads": next((int(line.split()[1]) for line in status if line.startswith("Threads:")), 1),
            }
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return result


def observe_owned(table: dict[int, dict[str, int]], group: int, identities: dict[int, int]) -> set[int]:
    for pid, data in table.items():
        if data["pgrp"] == group:
            identities.setdefault(pid, data["started"])
    owned = {pid for pid, started in identities.items() if pid in table and table[pid]["started"] == started}
    while True:
        additions = {pid for pid, data in table.items() if data["parent"] in owned}
        if additions <= owned:
            return owned
        for pid in additions:
            identities.setdefault(pid, table[pid]["started"])
        owned |= additions


def sandbox_command(name: str, work: Path, cpus: list[int]) -> tuple[list[str], dict[str, str]]:
    args = [
        "/usr/bin/bwrap", "--unshare-user", "--uid", "1000", "--gid", "1000",
        "--unshare-pid", "--die-with-parent", "--cap-add", "CAP_SYS_ADMIN",
        "--cap-add", "CAP_NET_ADMIN", "--ro-bind", "/usr", "/usr",
        "--symlink", "usr/bin", "/bin", "--ro-bind", "/lib", "/lib",
        "--ro-bind", "/lib64", "/lib64", "--proc", "/proc", "--dev", "/dev",
        "--tmpfs", "/tmp", "--tmpfs", "/home", "--dir", "/home/test", "--dir", "/etc",
        "--ro-bind", str(APP), "/app", "--bind", str(work), "/work",
        "--dir", "/proof",
        "--ro-bind", str(BASE / "boundary_exec.py"), "/proof/boundary_exec.py",
        "--ro-bind", str(BASE / "assert_runtime_activity_mutant.mjs"),
        "/proof/assert_runtime_activity_mutant.mjs",
        "--ro-bind", str(BASE / "source-freeze.json"), "/proof/source-freeze.json",
        "--ro-bind", str(BASE / "component-dependencies.json"),
        "/proof/component-dependencies.json",
        "--ro-bind", str(BASE / "build-04-inputs.json"), "/proof/build-04-inputs.json",
    ]
    if name in {"component", "mutant"}:
        args += [
            "--ro-bind", str(BASE / "runtime-activity-component.test.mjs"),
            "/app/tests/runtime-activity-component.test.mjs",
        ]
    if name == "mutant":
        args += [
            "--ro-bind", str(BASE / "Conversation.missing-key.tsx"),
            "/app/app/components/workbench/Conversation.tsx",
        ]
    args += [
        "--chdir", "/app", "--", "/usr/bin/unshare", "--net",
        "/usr/bin/setpriv", "--bounding-set=-all", "--inh-caps=-all",
        "--ambient-caps=-all", "--no-new-privs", "/usr/bin/python3",
        "/proof/boundary_exec.py", name,
    ]
    environment = {
        "PATH": "/usr/bin:/bin", "HOME": "/home/test", "TMPDIR": "/tmp",
        "LANG": "C.UTF-8", "CI": "true",
        "VIVARY_EXPECTED_AFFINITY": ",".join(map(str, cpus)),
        **{f"VIVARY_HOST_{kind.upper()}_NS": namespace(kind)
           for kind in ("user", "pid", "net", "mnt")},
    }
    return args, environment


def signal_owned(
    group: int, owned: set[int], identities: dict[int, int], sig: signal.Signals,
) -> list[int]:
    table = process_table()
    current = {
        pid for pid in owned
        if pid in table and table[pid]["started"] == identities.get(pid)
    }
    group_members = {pid for pid in current if table[pid]["pgrp"] == group}
    attempted = []
    if group_members:
        try:
            os.killpg(group, sig)
            attempted.extend(sorted(group_members))
        except ProcessLookupError:
            pass
    for pid in sorted(current - group_members):
        try:
            os.kill(pid, sig)
            attempted.append(pid)
        except ProcessLookupError:
            pass
    return attempted


def settle_child(
    child: subprocess.Popen,
    identities: dict[int, int],
    stop_immediately: bool,
) -> tuple[set[int], list[int], list[int]]:
    deadline = time.monotonic() + 5
    term_signaled = []
    forced = []
    table = process_table()
    owned = observe_owned(table, child.pid, identities)
    if stop_immediately and owned:
        term_signaled = signal_owned(child.pid, owned, identities, signal.SIGTERM)
    while time.monotonic() < deadline - 0.5:
        table = process_table()
        owned = observe_owned(table, child.pid, identities)
        if not owned:
            return set(), term_signaled, forced
        time.sleep(0.05)
    table = process_table()
    owned = observe_owned(table, child.pid, identities)
    if owned and not term_signaled:
        term_signaled = signal_owned(child.pid, owned, identities, signal.SIGTERM)
        time.sleep(0.25)
    table = process_table()
    owned = observe_owned(table, child.pid, identities)
    if owned:
        forced = signal_owned(child.pid, owned, identities, signal.SIGKILL)
    while time.monotonic() < deadline:
        owned = observe_owned(process_table(), child.pid, identities)
        if not owned:
            break
        time.sleep(0.02)
    try:
        child.wait(timeout=max(0.01, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        pass
    return observe_owned(process_table(), child.pid, identities), term_signaled, forced


def run(name: str) -> int:
    assert name in LIMITS
    assert BASE.is_dir(), "run prepare_zo_tests.py prepare before dispatch"
    ledger_path = BASE / "budget.json"
    with (BASE / "budget.lock").open("a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        ledger = validate_ledger(json.loads(ledger_path.read_text()))
        assert not any(entry["name"] == name for entry in ledger), f"attempt already used: {name}"
        requested = LIMITS[name] + 5
        assert sum(entry["chargedSeconds"] for entry in ledger) + requested <= TOTAL_BUDGET
        run_dir = BASE / name
        run_dir.mkdir(exist_ok=False)
        entry = {"name": name, "chargedSeconds": requested, "status": "reserved"}
        ledger.append(entry)
        write_json_atomic(ledger_path, ledger)

        started = time.monotonic()
        work = run_dir / "work"
        stdout_path = run_dir / "stdout.log"
        stderr_path = run_dir / "stderr.log"
        child = None
        identities: dict[int, int] = {}
        samples = []
        remaining: set[int] = set()
        term_signaled: list[int] = []
        forced: list[int] = []
        failure = None
        refusal = None
        observer_max_gap = 0.0
        child_returncode = None
        profile_sha256 = None
        source_freeze_sha256 = None
        boundary_sha256 = None
        cpus = sorted(os.sched_getaffinity(0))[:2]
        admission_memory = None
        command = None
        environment = None

        try:
            stdout_path.touch(exist_ok=False)
            stderr_path.touch(exist_ok=False)
            if len(cpus) != 2:
                raise Refusal("cpu-admission")
            memory = meminfo()
            admission_memory = memory
            if memory["SwapTotal"] != 0:
                raise Refusal("swap-not-zero")
            if memory["MemAvailable"] < MEMORY_STOP + HOST_RESERVE:
                raise Refusal("host-reserve")
            source_freeze = BASE / "source-freeze.json"
            source_freeze_sha256 = sha(source_freeze)
            frozen = json.loads(source_freeze.read_text())
            supervisor_key = "docs/product/multi-project/fixtures/06e/zo_test_supervisor.py"
            assert sha(Path(__file__)) == frozen["proofTools"][supervisor_key]
            profile = dict(PROFILE)
            profile.update(
                sourceFreezeSha256=source_freeze_sha256,
                supervisorSha256=sha(Path(__file__)),
                boundaryExecSha256=sha(BASE / "boundary_exec.py"),
                mutantWrapperSha256=sha(BASE / "assert_runtime_activity_mutant.mjs"),
            )
            write_json_atomic(run_dir / "profile.json", profile)
            profile_sha256 = sha(run_dir / "profile.json")
            work.mkdir()
            (work / "proof").mkdir()
            command, environment = sandbox_command(name, work, cpus)
            with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
                child = subprocess.Popen(
                    command, cwd=ROOT, env=environment, stdout=stdout, stderr=stderr,
                    start_new_session=True, preexec_fn=lambda: os.sched_setaffinity(0, cpus),
                )
                previous = time.monotonic()
                observed = False
                while child.poll() is None:
                    now = time.monotonic()
                    gap = now - previous
                    previous = now
                    observer_max_gap = max(observer_max_gap, gap)
                    table = process_table()
                    owned = observe_owned(table, child.pid, identities)
                    observed = observed or bool(owned)
                    host = meminfo()
                    supervisor = table.get(os.getpid())
                    assert supervisor is not None
                    sample = {
                        "seconds": round(now - started, 3),
                        "rssBytes": supervisor["rss"] + sum(table[pid]["rss"] for pid in owned),
                        "tasks": supervisor["threads"] + sum(table[pid]["threads"] for pid in owned),
                        "processes": len(owned) + 1,
                        "hostMemAvailableBytes": host["MemAvailable"],
                        "hostSwapTotalBytes": host["SwapTotal"],
                    }
                    samples.append(sample)
                    if gap > 1:
                        failure = "observer-gap"
                    elif host["SwapTotal"] != 0:
                        failure = "swap-not-zero"
                    elif host["MemAvailable"] < HOST_RESERVE:
                        failure = "host-reserve"
                    elif sample["rssBytes"] > MEMORY_STOP:
                        failure = "memory-stop"
                    elif sample["tasks"] > TASK_STOP:
                        failure = "task-stop"
                    elif sample["seconds"] > LIMITS[name]:
                        failure = "deadline"
                    elif stdout.tell() + stderr.tell() > OUTPUT_STOP:
                        failure = "output-stop"
                    if failure:
                        break
                    time.sleep(SAMPLE_SECONDS)
                child_returncode = child.poll()
                if not observed:
                    failure = failure or "unobserved-process"
                if time.monotonic() - started > LIMITS[name]:
                    failure = failure or "deadline"
        except Refusal as error:
            refusal = str(error)
            failure = "admission-refused"
        except Exception as error:
            failure = f"supervisor-error:{type(error).__name__}"
            try:
                with stderr_path.open("ab") as stream:
                    stream.write((str(error) + "\n").encode("utf-8", "replace")[:4096])
            except OSError:
                pass
        finally:
            if child is not None:
                remaining, term_signaled, forced = settle_child(
                    child, identities, stop_immediately=failure is not None,
                )
                child_returncode = child.poll()
            if term_signaled:
                failure = failure or "cleanup-intervention"
            if forced:
                failure = failure or "forced-cleanup"
            if remaining:
                failure = failure or "cleanup-present"

        elapsed = time.monotonic() - started
        output_bytes = sum(
            path.stat().st_size for path in (stdout_path, stderr_path) if path.is_file()
        )
        if elapsed > LIMITS[name]:
            failure = failure or "deadline"
        if output_bytes > OUTPUT_STOP:
            failure = failure or "output-stop"
        if child is not None and child_returncode != 0:
            failure = failure or "child-failed"
        boundary = work / "boundary.json"
        if child is not None:
            try:
                attestation = json.loads(boundary.read_text())
                assert attestation["accepted"] is True and attestation["mode"] == name
                boundary_sha256 = sha(boundary)
            except Exception:
                failure = failure or "boundary-attestation"
        result = {
            "schemaVersion": 1, "name": name, "returncode": child_returncode,
            "failure": failure, "refusal": refusal, "elapsedSeconds": elapsed,
            "admissionMemory": admission_memory, "command": command,
            "environment": environment,
            "deadlineSeconds": LIMITS[name], "cpuAffinity": cpus,
            "samples": samples, "observerMaxGapSeconds": observer_max_gap,
            "outputBytes": output_bytes, "cleanupAbsent": not remaining,
            "ownedIdentities": [
                {"pid": pid, "start": start} for pid, start in sorted(identities.items())
            ],
            "remainingPids": sorted(remaining), "termSignaledPids": term_signaled,
            "forcedPids": forced, "workRetained": work.exists(),
            "profileSha256": profile_sha256,
            "sourceFreezeSha256": source_freeze_sha256,
            "boundarySha256": boundary_sha256,
        }
        entry.update(
            status="refused" if refusal else "finished",
            chargedSeconds=elapsed,
            resultFailure=failure,
        )
        write_json_atomic(ledger_path, ledger)
        write_json_atomic(run_dir / "result.json", result)
        print(json.dumps({key: value for key, value in result.items() if key != "samples"}, sort_keys=True))
        return 0 if failure is None else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("name", choices=tuple(LIMITS))
    args = parser.parse_args()
    raise SystemExit(run(args.name))
