#!/usr/bin/env python3
"""Dispatch and supervise the single bounded 06e C5 browser attempt."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / ".tmp/06e/zo-browser"
APP = ROOT / ".tmp/05b/zo-runtime/app"
BROWSER = (
    ROOT
    / ".tmp/05b/zo-runtime/chromium-02/work/browsers/"
    "chromium-1243/chrome-linux64"
)
NAME = "browser-01"
EXECUTION_SECONDS = 360
CLEANUP_SECONDS = 5
TOTAL_SECONDS = 365
MEMORY_STOP = 8 * 1024**3
TASK_STOP = 256
HOST_RESERVE = 1536 * 1024**2
ADMISSION_MEMORY = MEMORY_STOP + HOST_RESERVE
OUTPUT_STOP = 8 * 1024**2
SAMPLE_SECONDS = 0.25
MAX_OBSERVER_GAP = 1.0
FORBIDDEN_CHROMIUM_FLAGS = {
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu-sandbox",
    "--no-zygote-sandbox",
}
STATUSES = {"reserved", "finished", "refused"}
HEAVY_LOCK = Path("/tmp/vivary-heavy-job.lock")


class Refusal(Exception):
    pass


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_atomic(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".new")
    with temporary.open("x") as stream:
        os.fchmod(stream.fileno(), 0o600)
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


def validate_ledger(value) -> list[dict]:
    assert isinstance(value, list)
    assert len(value) <= 1
    for entry in value:
        assert isinstance(entry, dict)
        assert set(entry) >= {"name", "chargedSeconds", "status"}
        assert entry["name"] == NAME
        assert entry["status"] in STATUSES
        charge = entry["chargedSeconds"]
        assert isinstance(charge, (int, float)) and not isinstance(charge, bool)
        assert math.isfinite(charge) and charge >= 0
    return value


def meminfo() -> dict[str, int]:
    values = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        match = re.fullmatch(r"([^:]+):\s+(\d+) kB", line)
        if match:
            values[match.group(1)] = int(match.group(2)) * 1024
    assert {"MemAvailable", "SwapTotal", "SwapFree"} <= set(values)
    return values


def process_table() -> dict[int, dict]:
    result = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / "stat").read_text().rsplit(")", 1)[1].split()
            status = (entry / "status").read_text().splitlines()
            result[int(entry.name)] = {
                "parent": int(stat[1]),
                "pgrp": int(stat[2]),
                "started": int(stat[19]),
                "rss": next(
                    (
                        int(line.split()[1]) * 1024
                        for line in status
                        if line.startswith("VmRSS:")
                    ),
                    0,
                ),
                "threads": next(
                    (
                        int(line.split()[1])
                        for line in status
                        if line.startswith("Threads:")
                    ),
                    1,
                ),
            }
        except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError):
            pass
    return result


def observe_owned(
    table: dict[int, dict],
    group: int,
    identities: dict[int, int],
) -> set[int]:
    for pid, data in table.items():
        if data["pgrp"] == group:
            identities[pid] = data["started"]
    owned = {
        pid
        for pid, started in identities.items()
        if pid in table and table[pid]["started"] == started
    }
    while True:
        additions = {
            pid
            for pid, data in table.items()
            if data["parent"] in owned and pid not in owned
        }
        if not additions:
            return owned
        for pid in additions:
            identities[pid] = table[pid]["started"]
            owned.add(pid)


def process_identity(pid: int, deadline: float | None = None) -> dict:
    stop = deadline if deadline is not None else time.monotonic() + 2
    while time.monotonic() < stop:
        table = process_table()
        if pid in table:
            return {"pid": pid, "start": table[pid]["started"]}
        time.sleep(0.01)
    raise RuntimeError(f"cannot read launched process identity: {pid}")


def signal_owned(
    group: int,
    owned: set[int],
    identities: dict[int, int],
    sig: signal.Signals,
) -> list[int]:
    table = process_table()
    current = {
        pid
        for pid in owned
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


def sandbox_command(work: Path) -> list[str]:
    args = [
        "/usr/bin/bwrap",
        "--unshare-user",
        "--uid",
        "1000",
        "--gid",
        "1000",
        "--unshare-pid",
        "--die-with-parent",
        "--cap-add",
        "CAP_SYS_ADMIN",
        "--cap-add",
        "CAP_NET_ADMIN",
        "--ro-bind",
        "/usr",
        "/usr",
        "--symlink",
        "usr/bin",
        "/bin",
        "--ro-bind",
        "/lib",
        "/lib",
        "--ro-bind",
        "/lib64",
        "/lib64",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--tmpfs",
        "/tmp",
        "--tmpfs",
        "/home",
        "--dir",
        "/home/test",
        "--dir",
        "/etc",
        "--ro-bind",
        str(ROOT),
        "/source",
        "--ro-bind",
        str(APP),
        "/app",
        "--ro-bind",
        str(BROWSER),
        "/browser",
        "--bind",
        str(work),
        "/work",
        "--chdir",
        "/source",
    ]
    if Path("/etc/fonts").exists():
        args.extend(["--ro-bind", "/etc/fonts", "/etc/fonts"])
    args.extend(
        [
            "--",
            "/usr/bin/unshare",
            "--net",
            "/usr/bin/setpriv",
            "--bounding-set=-all",
            "--inh-caps=-all",
            "--ambient-caps=-all",
            "--no-new-privs",
            "/usr/bin/python3.11",
            "-I",
            "-B",
            "/source/docs/product/multi-project/fixtures/06e/prepare_zo_browser.py",
            "verify-boundary",
            "/work/input.json",
        ]
    )
    return args


def fixed_environment() -> dict[str, str]:
    return {
        "PATH": "/usr/bin:/bin",
        "HOME": "/home/test",
        "TMPDIR": "/tmp",
        "LANG": "C.UTF-8",
        "CI": "true",
        "NODE_ENV": "production",
        "AGENT_MODE": "production",
        "AGENT_NATIVE_DISABLE_RECURRING_JOBS": "true",
        "AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS": "true",
    }


def config_for() -> dict:
    source_manifest = BASE / "source-manifest.json"
    tool_manifest = BASE / "tool-manifest.json"
    traffic_manifest = BASE / "traffic-manifest.json"
    profile = BASE / "profile.json"
    backend = ROOT / "docs/product/multi-project/fixtures/06e/c5_browser_backend.mjs"
    browser = ROOT / "docs/product/multi-project/fixtures/06e/c5_browser.mjs"
    source_value = json.loads(source_manifest.read_text())
    node = Path("/usr/bin/node")
    chromium = BROWSER / "chrome"
    playwright = (
        APP
        / "node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/package.json"
    )
    return {
        "schema": "vivary.06e-c5-browser-input/v1",
        "appRoot": "/app",
        "sourceRoot": "/source",
        "scratchRoot": "/work",
        "evidenceRoot": "/work/evidence",
        "backendPath": "/source/" + backend.relative_to(ROOT).as_posix(),
        "backendSha256": sha(backend),
        "browserPath": "/source/" + browser.relative_to(ROOT).as_posix(),
        "browserSha256": sha(browser),
        "nodeExecutable": "/usr/bin/node",
        "nodeSha256": sha(node),
        "nodeBytes": node.stat().st_size,
        "playwrightPackageJson": (
            "/app/node_modules/.pnpm/playwright@1.63.0/node_modules/"
            "playwright/package.json"
        ),
        "playwrightPackageJsonSha256": sha(playwright),
        "chromiumExecutable": "/browser/chrome",
        "chromiumSha256": sha(chromium),
        "sourceManifestPath": "/source/.tmp/06e/zo-browser/source-manifest.json",
        "sourceManifestSha256": sha(source_manifest),
        "sourceBindingSha256": source_value["bindingSha256"],
        "toolManifestPath": "/source/.tmp/06e/zo-browser/tool-manifest.json",
        "toolManifestSha256": sha(tool_manifest),
        "trafficManifestPath": "/source/.tmp/06e/zo-browser/traffic-manifest.json",
        "trafficManifestSha256": sha(traffic_manifest),
        "profilePath": "/source/.tmp/06e/zo-browser/profile.json",
        "profileSha256": sha(profile),
        "proofToken": secrets.token_hex(32),
        "deadlineSeconds": EXECUTION_SECONDS,
    }


def validate_prepared_inputs() -> None:
    preparation = json.loads((BASE / "preparation.json").read_text())
    assert preparation["schema"] == "vivary.06e-c5-browser-preparation/v1"
    expected = {
        "source-manifest.json": preparation["sourceManifestSha256"],
        "tool-manifest.json": preparation["toolManifestSha256"],
        "traffic-manifest.json": preparation["trafficManifestSha256"],
        "profile.json": preparation["profileSha256"],
    }
    for name, digest in expected.items():
        assert re.fullmatch(r"[0-9a-f]{64}", digest)
        assert sha(BASE / name) == digest
    source = json.loads((BASE / "source-manifest.json").read_text())
    profile = json.loads((BASE / "profile.json").read_text())
    assert source["schema"] == "vivary.06e-c5-source/v1"
    assert source["bindingSha256"] == preparation["sourceBindingSha256"]
    assert profile["sourceBindingSha256"] == source["bindingSha256"]
    assert profile["trafficManifestSha256"] == preparation["trafficManifestSha256"]
    listed = {entry["path"]: entry for entry in source["files"]}
    for path in (
        Path(__file__),
        Path(__file__).with_name("prepare_zo_browser.py"),
        Path(__file__).with_name("c5_browser_runner.mjs"),
    ):
        sandbox_path = "/source/" + path.relative_to(ROOT).as_posix()
        assert listed[sandbox_path] == {
            "path": sandbox_path,
            "sha256": sha(path),
            "bytes": path.stat().st_size,
        }

    tools = json.loads((BASE / "tool-manifest.json").read_text())
    assert tools["schema"] == "vivary.06e-c5-tools/v1"
    tool_paths = {entry["path"] for entry in tools["files"]}
    assert {
        "/usr/bin/nohup",
        "/usr/bin/python3.11",
        "/usr/bin/bwrap",
        "/usr/bin/unshare",
        "/usr/bin/setpriv",
        "/usr/bin/node",
        "/browser/chrome",
    } <= tool_paths
    for entry in tools["files"]:
        sandbox_path = entry["path"]
        if sandbox_path.startswith("/app/"):
            host = APP / sandbox_path.removeprefix("/app/")
        elif sandbox_path.startswith("/browser/"):
            host = BROWSER / sandbox_path.removeprefix("/browser/")
        else:
            host = Path(sandbox_path)
        assert host.resolve() == host
        info = host.stat()
        assert host.is_file() and not host.is_symlink() and info.st_nlink == 1
        assert entry == {
            "path": sandbox_path,
            "sha256": sha(host),
            "bytes": info.st_size,
        }


def reserve() -> tuple[Path, dict]:
    assert BASE.is_dir(), "run prepare_zo_browser.py prepare before dispatch"
    ledger_path = BASE / "budget.json"
    lock_path = BASE / "budget.lock"
    assert ledger_path.is_file() and lock_path.is_file()
    with lock_path.open("r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        ledger = validate_ledger(json.loads(ledger_path.read_text()))
        assert not ledger, f"attempt already consumed: {ledger}"
        entry = {
            "name": NAME,
            "chargedSeconds": TOTAL_SECONDS,
            "status": "reserved",
            "reservedAtUnixNs": time.time_ns(),
            "reservedAtMonotonic": time.monotonic(),
        }
        ledger.append(entry)
        write_json_atomic(ledger_path, ledger)
        try:
            required = [
                "dependency-tree.json",
                "browser-tree.json",
                "source-manifest.json",
                "tool-manifest.json",
                "traffic-manifest.json",
                "profile.json",
                "preparation.json",
            ]
            assert all((BASE / name).is_file() for name in required)
            validate_prepared_inputs()
            run_dir = BASE / NAME
            run_dir.mkdir(mode=0o700, exist_ok=False)
            work = run_dir / "work"
            work.mkdir(mode=0o700)
            write_json_atomic(work / "input.json", config_for())
            write_json_atomic(
                run_dir / "intent.json",
                {
                    "schema": "vivary.06e-c5-browser-dispatch-intent/v1",
                    "name": NAME,
                    "executionSeconds": EXECUTION_SECONDS,
                    "cleanupSeconds": CLEANUP_SECONDS,
                    "totalSeconds": TOTAL_SECONDS,
                    "supervisorSha256": sha(Path(__file__)),
                    "runtimeAdmittedBySource": False,
                },
            )
        except Exception as error:
            elapsed = time.monotonic() - entry["reservedAtMonotonic"]
            failure = f"reservation-error:{type(error).__name__}"
            entry.update(
                status="refused",
                chargedSeconds=elapsed,
                resultFailure=failure,
            )
            write_json_atomic(ledger_path, ledger)
            write_json_atomic(
                BASE / "reservation-failure.json",
                {
                    "schema": "vivary.06e-c5-browser-reservation-failure/v1",
                    "name": NAME,
                    "failure": failure,
                    "message": str(error)[:4096],
                    "chargedSeconds": elapsed,
                },
            )
            raise
    return run_dir, entry


def dispatch() -> dict:
    run_dir, entry = reserve()
    log_path = run_dir / "supervisor.log"
    with log_path.open("xb") as log:
        child = subprocess.Popen(
            [
                "/usr/bin/nohup",
                "/usr/bin/python3.11",
                "-I",
                "-B",
                str(Path(__file__).resolve()),
                "run-reserved",
                "--run-dir",
                str(run_dir),
            ],
            cwd=ROOT,
            env={"PATH": "/usr/bin:/bin", "HOME": str(ROOT), "LANG": "C.UTF-8"},
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
        )
        identity = process_identity(child.pid)
        record = {
            "schema": "vivary.06e-c5-browser-dispatch/v1",
            "name": NAME,
            "supervisor": identity,
            "reservedAtUnixNs": entry["reservedAtUnixNs"],
            "reservedAtMonotonic": entry["reservedAtMonotonic"],
            "logPath": str(log_path),
        }
        write_json_atomic(run_dir / "dispatch.json", record)
    return record


def admission_snapshot(table: dict[int, dict]) -> dict:
    host = meminfo()
    controller = table.get(os.getpid())
    assert controller is not None
    disk = shutil.disk_usage(BASE)
    return {
        "recordedAtUnixNs": time.time_ns(),
        "memory": host,
        "disk": {
            "path": str(BASE),
            "totalBytes": disk.total,
            "usedBytes": disk.used,
            "freeBytes": disk.free,
        },
        "includedUsage": {
            "controllerPid": os.getpid(),
            "controllerStart": controller["started"],
            "rssBytes": controller["rss"],
            "tasks": controller["threads"],
        },
        "unknownMetrics": [
            "enforceable-cgroup-memory-limit",
            "enforceable-cgroup-task-limit",
            "per-process-private-memory",
        ],
    }


def validate_runner_result(path: Path) -> dict:
    value = json.loads(path.read_text())
    assert value["schema"] == "vivary.06e-c5-runner-result/v1"
    assert value["passed"] is True
    assert value["shutdown"] == {
        "browserExitedNaturally": True,
        "backendExitedNaturally": True,
        "providerStopMode": "public-close-sigkill",
        "providerAbsent": True,
        "displayStopMode": "public-stop-sigterm",
        "displayFallback": False,
        "httpClosedNaturally": True,
        "cleanupIntervention": False,
        "stageCount": value["shutdown"]["stageCount"],
    }
    assert isinstance(value["shutdown"]["stageCount"], int)
    assert value["shutdown"]["stageCount"] > 0
    return value


def supervise(run_dir: Path, dispatch_record: dict) -> int:
    assert run_dir == BASE / NAME
    assert dispatch_record["supervisor"] == process_identity(os.getpid())
    dispatch_started = dispatch_record["reservedAtMonotonic"]
    total_deadline = dispatch_started + TOTAL_SECONDS
    work = run_dir / "work"
    stdout_path = run_dir / "stdout.log"
    stderr_path = run_dir / "stderr.log"
    result_path = run_dir / "result.json"

    child = None
    identities: dict[int, int] = {}
    samples = []
    chromium_launches: dict[tuple[int, int], dict] = {}
    admission = None
    failure = None
    refusal = None
    returncode = None
    observer_max_gap = 0.0
    supervisor_term: list[int] = []
    supervisor_kill: list[int] = []
    remaining: set[int] = set()
    command = None
    cpus: list[int] = []
    launched_at = None
    heavy_lock = HEAVY_LOCK.open("a+")

    try:
        fcntl.flock(heavy_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        table = process_table()
        admission = admission_snapshot(table)
        memory = admission["memory"]
        if memory["SwapTotal"] != 0 or memory["SwapFree"] != 0:
            raise Refusal("swap-not-zero")
        if memory["MemAvailable"] < ADMISSION_MEMORY:
            raise Refusal("warm-memory-admission")
        cpus = sorted(os.sched_getaffinity(0))[:4]
        if len(cpus) != 4:
            raise Refusal("cpu-admission")
        if time.monotonic() >= total_deadline:
            raise Refusal("dispatch-budget-expired")

        command = sandbox_command(work)
        environment = fixed_environment()
        stdout_path.touch(mode=0o600, exist_ok=False)
        stderr_path.touch(mode=0o600, exist_ok=False)
        with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
            launched_at = time.monotonic()
            child = subprocess.Popen(
                command,
                cwd=ROOT,
                env=environment,
                stdout=stdout,
                stderr=stderr,
                start_new_session=True,
                preexec_fn=lambda: os.sched_setaffinity(0, cpus),
            )
            identities[child.pid] = process_identity(child.pid)["start"]
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
                controller = table.get(os.getpid())
                if controller is None:
                    failure = "controller-unobserved"
                    break
                for pid in owned:
                    try:
                        raw = Path(f"/proc/{pid}/cmdline").read_bytes()
                        if len(raw) > 65536:
                            failure = "process-argv-limit"
                            break
                        argv = [
                            part.decode("utf-8", "strict")
                            for part in raw.split(b"\0")
                            if part
                        ]
                        if (
                            argv
                            and argv[0] == "/browser/chrome"
                            and not any(arg.startswith("--type=") for arg in argv)
                        ):
                            key = (pid, identities[pid])
                            chromium_launches.setdefault(
                                key,
                                {"pid": pid, "start": identities[pid], "argv": argv},
                            )
                            if any(
                                arg.split("=", 1)[0] in FORBIDDEN_CHROMIUM_FLAGS
                                for arg in argv
                            ):
                                failure = "chromium-sandbox-disabled"
                    except (FileNotFoundError, PermissionError, UnicodeDecodeError):
                        pass
                sample = {
                    "secondsSinceDispatch": round(now - dispatch_started, 3),
                    "secondsSinceLaunch": round(now - launched_at, 3),
                    "rssBytes": controller["rss"]
                    + sum(table[pid]["rss"] for pid in owned),
                    "tasks": controller["threads"]
                    + sum(table[pid]["threads"] for pid in owned),
                    "processes": len(owned) + 1,
                    "hostMemAvailableBytes": host["MemAvailable"],
                    "hostSwapTotalBytes": host["SwapTotal"],
                    "hostSwapFreeBytes": host["SwapFree"],
                    "owned": [
                        {"pid": pid, "start": identities[pid]}
                        for pid in sorted(owned)
                    ],
                }
                samples.append(sample)
                scan_gap = time.monotonic() - now
                observer_max_gap = max(observer_max_gap, scan_gap)
                output_bytes = stdout_path.stat().st_size + stderr_path.stat().st_size
                if gap > MAX_OBSERVER_GAP or scan_gap > MAX_OBSERVER_GAP:
                    failure = failure or "observer-gap"
                elif host["SwapTotal"] != 0 or host["SwapFree"] != 0:
                    failure = "swap-not-zero"
                elif host["MemAvailable"] < HOST_RESERVE:
                    failure = "host-reserve"
                elif sample["rssBytes"] > MEMORY_STOP:
                    failure = "memory-stop"
                elif sample["tasks"] > TASK_STOP:
                    failure = "task-stop"
                elif now - launched_at > EXECUTION_SECONDS:
                    failure = "execution-deadline"
                elif now >= total_deadline:
                    failure = "cumulative-deadline"
                elif output_bytes > OUTPUT_STOP:
                    failure = "output-stop"
                if failure:
                    break
                time.sleep(SAMPLE_SECONDS)
            returncode = child.poll()
            if not observed:
                failure = failure or "unobserved-process"
    except BlockingIOError:
        refusal = "heavy-job-active"
        failure = "admission-refused"
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
        cleanup_deadline = min(total_deadline, time.monotonic() + CLEANUP_SECONDS)
        if child is not None:
            table = process_table()
            remaining = observe_owned(table, child.pid, identities)
            if returncode is None:
                returncode = child.poll()
            if returncode is not None and remaining:
                failure = failure or "cleanup-present"
            if failure is not None and remaining:
                supervisor_term = signal_owned(
                    child.pid, remaining, identities, signal.SIGTERM
                )
            while remaining and time.monotonic() < cleanup_deadline - 0.5:
                time.sleep(0.05)
                remaining = observe_owned(process_table(), child.pid, identities)
            if remaining:
                supervisor_kill = signal_owned(
                    child.pid, remaining, identities, signal.SIGKILL
                )
            while remaining and time.monotonic() < cleanup_deadline:
                time.sleep(0.02)
                remaining = observe_owned(process_table(), child.pid, identities)
            try:
                child.wait(timeout=max(0.01, cleanup_deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                failure = failure or "cleanup-deadline"
            returncode = child.poll()
        heavy_lock.close()

    elapsed = time.monotonic() - dispatch_started
    output_bytes = sum(
        path.stat().st_size for path in (stdout_path, stderr_path) if path.is_file()
    )
    if elapsed > TOTAL_SECONDS:
        failure = failure or "cumulative-deadline"
    if output_bytes > OUTPUT_STOP:
        failure = failure or "output-stop"
    if child is not None and returncode != 0:
        failure = failure or "child-failed"
    if child is not None and not chromium_launches:
        failure = failure or "chromium-launch-unobserved"
    if any(
        arg.split("=", 1)[0] in FORBIDDEN_CHROMIUM_FLAGS
        for launch in chromium_launches.values()
        for arg in launch["argv"]
    ):
        failure = failure or "chromium-sandbox-disabled"
    if remaining:
        failure = failure or "cleanup-present"
    if supervisor_term:
        failure = failure or "supervisor-cleanup-intervention"
    if supervisor_kill:
        failure = failure or "supervisor-forced-cleanup"

    runner_result = None
    runner_result_path = work / "evidence/runner-result.json"
    if child is not None and returncode == 0:
        try:
            runner_result = validate_runner_result(runner_result_path)
        except Exception as error:
            failure = failure or f"runner-result:{type(error).__name__}"

    result = {
        "schema": "vivary.06e-c5-browser-supervisor-result/v1",
        "name": NAME,
        "returncode": returncode,
        "failure": failure,
        "refusal": refusal,
        "elapsedSecondsIncludingDispatchAndCleanup": elapsed,
        "executionDeadlineSeconds": EXECUTION_SECONDS,
        "cleanupSeconds": CLEANUP_SECONDS,
        "cumulativeDeadlineSeconds": TOTAL_SECONDS,
        "admission": admission,
        "cpuAffinity": cpus,
        "command": command,
        "environment": fixed_environment() if command else None,
        "samples": samples,
        "observerMaxGapSeconds": observer_max_gap,
        "outputBytes": output_bytes,
        "ownedIdentities": [
            {"pid": pid, "start": start}
            for pid, start in sorted(identities.items())
        ],
        "chromiumLaunches": list(chromium_launches.values()),
        "forbiddenChromiumFlags": sorted(FORBIDDEN_CHROMIUM_FLAGS),
        "cleanupAbsent": not remaining,
        "remainingPids": sorted(remaining),
        "supervisorTermSignaledPids": supervisor_term,
        "supervisorKillSignaledPids": supervisor_kill,
        "passingRunSupervisorEscalation": bool(supervisor_term or supervisor_kill),
        "runnerResultSha256": sha(runner_result_path)
        if runner_result is not None
        else None,
        "providerStopMode": (
            runner_result["shutdown"]["providerStopMode"]
            if runner_result is not None
            else None
        ),
        "displayStopMode": (
            runner_result["shutdown"]["displayStopMode"]
            if runner_result is not None
            else None
        ),
    }
    if failure is None:
        assert result["passingRunSupervisorEscalation"] is False
        assert result["cleanupAbsent"] is True
        assert result["providerStopMode"] == "public-close-sigkill"
        assert result["displayStopMode"] == "public-stop-sigterm"

    write_json_atomic(result_path, result)
    ledger_path = BASE / "budget.json"
    ledger = validate_ledger(json.loads(ledger_path.read_text()))
    assert len(ledger) == 1 and ledger[0]["status"] == "reserved"
    ledger[0].update(
        status="refused" if refusal else "finished",
        chargedSeconds=elapsed,
        resultFailure=failure,
        resultSha256=sha(result_path),
    )
    write_json_atomic(ledger_path, ledger)
    print(
        json.dumps(
            {
                key: value
                for key, value in result.items()
                if key not in {"samples", "command", "environment", "ownedIdentities"}
            },
            sort_keys=True,
        ),
        flush=True,
    )
    return 0 if failure is None else 1


def run_reserved(run_dir: Path) -> int:
    assert run_dir == BASE / NAME
    deadline = time.monotonic() + 10
    dispatch_path = run_dir / "dispatch.json"
    while not dispatch_path.is_file() and time.monotonic() < deadline:
        time.sleep(0.01)
    assert dispatch_path.is_file(), "durable dispatch record missing"
    dispatch_record = json.loads(dispatch_path.read_text())
    assert dispatch_record["schema"] == "vivary.06e-c5-browser-dispatch/v1"
    assert dispatch_record["name"] == NAME
    with (BASE / "budget.lock").open("r+") as lock:
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.01)
        ledger = validate_ledger(json.loads((BASE / "budget.json").read_text()))
        assert len(ledger) == 1 and ledger[0]["status"] == "reserved"
        assert ledger[0]["reservedAtUnixNs"] == dispatch_record["reservedAtUnixNs"]
        return supervise(run_dir, dispatch_record)


def self_test() -> dict:
    assert ADMISSION_MEMORY == int(9.5 * 1024**3)
    assert TOTAL_SECONDS == EXECUTION_SECONDS + CLEANUP_SECONDS
    validate_ledger([])
    validate_ledger(
        [{"name": NAME, "chargedSeconds": 365, "status": "reserved"}]
    )
    validate_ledger(
        [{"name": NAME, "chargedSeconds": 365.25, "status": "finished"}]
    )
    table = {
        10: {"parent": 1, "pgrp": 10, "started": 100, "rss": 1, "threads": 1},
        11: {"parent": 10, "pgrp": 10, "started": 101, "rss": 1, "threads": 1},
        12: {"parent": 1, "pgrp": 99, "started": 102, "rss": 1, "threads": 1},
        13: {"parent": 11, "pgrp": 99, "started": 103, "rss": 1, "threads": 1},
    }
    identities = {12: 102}
    assert observe_owned(table, 10, identities) == {10, 11, 12, 13}
    table[13]["parent"] = 1
    assert observe_owned(table, 10, identities) == {10, 11, 12, 13}
    table[11]["started"] = 201
    assert observe_owned(table, 10, identities) == {10, 11, 12, 13}
    assert identities[11] == 201
    assert all(
        table[pid]["started"] == identities[pid]
        for pid in observe_owned(table, 10, identities)
    )
    assert all(flag.startswith("--") for flag in FORBIDDEN_CHROMIUM_FLAGS)
    return {
        "schema": "vivary.06e-c5-browser-supervisor-self-test/v1",
        "status": "ok",
        "runtimeStarted": False,
        "filesystemWritten": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "operation",
        choices=("dispatch", "run-reserved", "self-test"),
    )
    parser.add_argument("--run-dir")
    args = parser.parse_args()
    if args.operation == "dispatch":
        assert args.run_dir is None
        print(json.dumps(dispatch(), sort_keys=True))
        return 0
    if args.operation == "run-reserved":
        assert args.run_dir is not None
        return run_reserved(Path(args.run_dir).resolve())
    assert args.run_dir is None
    print(json.dumps(self_test(), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
