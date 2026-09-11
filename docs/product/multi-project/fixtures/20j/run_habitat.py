"""Bounded deterministic 20j proof, with no model or dependency installation."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[5]
UNIT = "vivary-20j-proof"
CONFIG = json.loads((ROOT / ".tmp/20j/habitat.json").read_text())
SCRATCH = CONFIG["scratch"]
MIB = 1024 * 1024
PHASES = {"red", "red-mounted", "red-ready", "green", "suites", "workbench", "corrected", "final", "loop-recheck"}


def resources():
    class Memory(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [
            (k, ctypes.c_ulonglong) for k in ("total", "available", "page_total",
                "page_available", "virtual_total", "virtual_available", "extended")]
    value = Memory()
    value.length = ctypes.sizeof(value)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(value)):
        raise OSError("host resource observation failed")
    return {"ram": value.available, "commit": value.page_available,
            "disk": shutil.disk_usage(ROOT).free}


def bind_job():
    from ctypes import wintypes as w
    class Basic(ctypes.Structure):
        _fields_ = [("p_time", ctypes.c_longlong), ("j_time", ctypes.c_longlong),
                    ("flags", w.DWORD), ("minimum", ctypes.c_size_t), ("maximum", ctypes.c_size_t),
                    ("active", w.DWORD), ("affinity", ctypes.c_size_t), ("priority", w.DWORD), ("scheduling", w.DWORD)]
    class Extended(ctypes.Structure):
        _fields_ = [("basic", Basic), ("io", ctypes.c_ulonglong * 6),
                    ("process_memory", ctypes.c_size_t), ("job_memory", ctypes.c_size_t),
                    ("peak_process", ctypes.c_size_t), ("peak_job", ctypes.c_size_t)]
    api = ctypes.WinDLL("kernel32", use_last_error=True)
    api.CreateJobObjectW.restype = w.HANDLE
    api.GetCurrentProcess.restype = w.HANDLE
    api.SetInformationJobObject.argtypes = [w.HANDLE, w.INT, w.LPVOID, w.DWORD]
    api.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
    job = api.CreateJobObjectW(None, None)
    limits = Extended()
    limits.basic.flags = 0x2000 | 0x200
    limits.job_memory = 512 * MIB
    if not job or not api.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
        raise OSError("Windows job limit setup failed")
    if not api.AssignProcessToJobObject(job, api.GetCurrentProcess()):
        raise OSError("Windows job assignment failed")
    return job


def inside(phase):
    if phase not in PHASES:
        raise ValueError("unknown proof phase")
    temporary = Path(SCRATCH) / phase
    temporary.mkdir(mode=0o700)
    os.environ.update(TMPDIR=str(temporary), VIVARY_20J_SCRATCH=str(temporary),
                      VIVARY_HOH_TEST_ROOT=str(temporary), HOH_TEST_ARTIFACT_ROOT=str(temporary),
                      PYTHONDONTWRITEBYTECODE="1", HOME=str(temporary),
                      XDG_CACHE_HOME=str(temporary / "cache"), XDG_CONFIG_HOME=str(temporary / "config"))
    cgroup = Path("/sys/fs/cgroup") / Path("/proc/self/cgroup").read_text().split("::", 1)[1].strip().lstrip("/")
    limits = {name: (cgroup / name).read_text().strip() for name in
              ("memory.max", "memory.swap.max", "pids.max", "cpu.max")}
    assert limits == {"memory.max": "536870912", "memory.swap.max": "0", "pids.max": "64", "cpu.max": "100000 100000"}, limits
    import pwd
    assert os.getuid() == pwd.getpwnam("agent").pw_uid != 0
    assert os.statvfs(ROOT).f_flag & os.ST_RDONLY
    assert os.statvfs(CONFIG["checkout"]).f_flag & os.ST_RDONLY
    print(json.dumps({"limits": limits, "uid": os.getuid(), "source_read_only": True}), flush=True)
    os.environ["PYTHONPATH"] = os.pathsep.join(str(ROOT / p) for p in (
        "packages/core", "packages/create-vivary", "packages/tropo", "tools"))
    heartbeat = ROOT / ".tmp/20j/heartbeat"
    manifest = json.loads((ROOT / ".tmp/20j" / (phase + "-source.json")).read_text())
    for name, expected in manifest.items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError("source binding mismatch: " + name)
    print(json.dumps({"verified_source_files": len(manifest)}), flush=True)
    if phase == "loop-recheck":
        clock_samples = []
        for _ in range(21):
            clock_samples.append({"wall_ns": time.time_ns(), "monotonic_ns": time.monotonic_ns()})
            time.sleep(.25)
        (temporary / "clock-preflight.json").write_text(json.dumps(clock_samples))
        offsets = [s["wall_ns"] - s["monotonic_ns"] for s in clock_samples]
        if max(offsets) - min(offsets) > 100_000_000:
            raise RuntimeError("clock preflight was not stable within 100 ms")
    def observe():
        while True:
            try:
                lines = [line for line in heartbeat.read_text().rsplit("\n", 1)[0].splitlines() if line]
                if time.time() - float(lines[-1]) > 1:
                    os._exit(90)
                if sum(p.stat().st_size for p in temporary.glob("command-*.log")) > MIB:
                    os._exit(93)
            except Exception:
                os._exit(91)
            time.sleep(.25)
    threading.Thread(target=observe, daemon=True).start()
    commands = [["/usr/bin/python3", "-B", "tools/tests/test_shipped_composition.py"]]
    if phase == "loop-recheck":
        commands.append(["/usr/bin/python3", "-B", "tools/tests/test_hoh_loop.py"])
    if phase == "suites":
        node = CONFIG["node"]
        with open(node, "rb") as handle:
            assert hashlib.file_digest(handle, "sha256").hexdigest() == "3517c2df0b2f8cd7f422b4b8450ef81c6889f08eb03e281d6de9079b15e6a327"
        os.environ["PATH"] = str(Path(node).parent) + os.pathsep + os.environ["PATH"]
        os.environ["VIVARY_TEST_CORE_PACKAGE_JSON"] = str(Path(CONFIG["checkout"]) / "packages/workbench/node_modules/@agent-native/core/package.json")
        os.environ["VIVARY_TEST_PYTHON"] = "/usr/bin/python3"
        for variable in ("VIVARY_REGISTRY_PROOF_ROOT", "VIVARY_CREATION_PROOF_ROOT", "VIVARY_12H_PROOF_ROOT", "VIVARY_17A_PROOF_ROOT"):
            directory = temporary / variable.lower()
            directory.mkdir()
            os.environ[variable] = str(directory)
        os.environ["DATABASE_URL"] = "file:" + str(temporary / "suite.sqlite")
        loader = str(ROOT / "packages/workbench/tests/register-native-dependencies.mjs")
        files = [str(ROOT / "packages/workbench/tests" / name) for name in (
            "creation-provider.test.mjs", "creation-effect-port.test.mjs", "creation-receipts.test.mjs")]
        commands += [
            ["/usr/bin/python3", "-B", "-m", "unittest", "discover", "-s", "packages/core/tests", "-p", "test_creation*.py"],
            ["/usr/bin/python3", "-B", "tools/tests/test_hoh_loop.py"],
            [node, "--max-old-space-size=192", "--import", loader, "--test", "--test-concurrency=1", *files],
        ]
    results = []
    phase_deadline = time.monotonic() + (165 if phase == "loop-recheck" else 280)
    for ordinal, command in enumerate(commands):
        print(json.dumps({"command": command, "cwd": str(ROOT)}), flush=True)
        if phase == "loop-recheck":
            output_path = temporary / f"command-{ordinal}.log"
            with output_path.open("wb") as output:
                run = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                                     timeout=max(1, phase_deadline - time.monotonic()), check=False)
            print(output_path.read_text(), flush=True)
        else:
            run = subprocess.run(command, cwd=ROOT, timeout=max(1, phase_deadline - time.monotonic()), check=False)
        results.append({"command": command, "exit": run.returncode})
        (temporary / "results.json").write_text(json.dumps(results))
    print(json.dumps({"results": results}), flush=True)
    return int(any(r["exit"] for r in results))


def outside(phase):
    if phase not in PHASES:
        raise ValueError("unknown proof phase")
    proof = ROOT / ".tmp/20j"
    proof.mkdir(parents=True, exist_ok=True)
    attempts = proof / "attempts.jsonl"
    history = [json.loads(line) for line in attempts.read_text().splitlines()] if attempts.exists() else []
    limit = 7 if phase == "loop-recheck" else 6
    duration = 180 if phase == "loop-recheck" else 300
    if len(history) >= limit or sum(r.get("elapsed", 300) for r in history) + duration > 1800:
        raise RuntimeError("packet runtime budget exhausted")
    before = resources()
    if before["ram"] < 2560 * MIB or before["commit"] < 2048 * MIB or before["disk"] < 10 * 1024 * MIB:
        raise RuntimeError(f"admission refused: {before}")
    job = bind_job()
    assert job
    mounted = SCRATCH + "/source"
    script = mounted + "/docs/product/multi-project/fixtures/20j/run_habitat.py"
    command = ["wsl.exe", "-d", "habitat", "-u", "root", "--exec", "systemd-run", "--unit=" + UNIT,
               "--wait", "--pipe", "--collect", "--service-type=exec", "--uid=agent",
               "-p", "MemoryMax=536870912", "-p", "MemorySwapMax=0", "-p", "TasksMax=64",
               "-p", "CPUQuota=100%", "-p", "RuntimeMaxSec=" + str(duration), "-p", "TimeoutStopSec=5",
               "-p", "KillMode=control-group", "-p", "PrivateNetwork=yes", "-p", "NoNewPrivileges=yes",
               "-p", "ProtectSystem=strict", "-p", "ProtectControlGroups=yes",
               "-p", "ReadOnlyPaths=" + CONFIG["checkout"],
               "-p", "PrivateTmp=yes",
               "-p", "ReadWritePaths=" + SCRATCH,
               "/usr/bin/python3", "-B", script, "--inside", phase]
    bootstrap = ('set -eu; source_root="$1"; mount_root="$2"; shift 2; '
                 'if mountpoint -q "$mount_root"; then exit 73; fi; '
                 'mount -t drvfs "$source_root" "$mount_root" -o ro; '
                 'trap \'umount "$mount_root"\' EXIT; "$@"')
    command = command[:6] + ["sh", "-c", bootstrap, "20j", str(ROOT), mounted] + command[6:]
    log = proof / (phase + ".log")
    if log.exists():
        raise RuntimeError("phase evidence already exists")
    started = time.monotonic()
    manifest = {}
    for folder in ("packages/core", "packages/create-vivary", "packages/tropo", "packages/workbench/server", "tools/hoh", "tools/tests"):
        for path in (ROOT / folder).rglob("*.py"):
            if not any(p in {"node_modules", "__pycache__", ".venv"} for p in path.parts):
                manifest[path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    for name in ("tools/hoh_loop.py", "tools/hoh/prompts/planner.md", "docs/product/multi-project/fixtures/20j/run_habitat.py"):
        manifest[name] = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    for folder in ("packages/workbench/server", "packages/workbench/tests"):
        for path in (ROOT / folder).rglob("*.mjs"):
            manifest[path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    (proof / (phase + "-source.json")).write_text(json.dumps(manifest))
    entry = {"phase": phase, "started": time.time(), "before": before, "command": command, "elapsed": 300}
    with attempts.open("a") as f:
        f.write(json.dumps(entry) + "\n")
    heartbeat = proof / "heartbeat"
    def tick():
        with heartbeat.open("a") as stream:
            stream.write("\n" + str(time.time()) + "\n")
    tick()
    failure = None
    samples = []
    proc = None
    try:
        with log.open("wb") as output:
            proc = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT, creationflags=0x08000000)
            last = time.monotonic()
            while proc.poll() is None:
                now = time.monotonic()
                reading = resources()
                samples.append({"elapsed": now - started, **reading})
                if now - last > 1 or reading["ram"] < 1536 * MIB or now - started > duration + 5 or log.stat().st_size > MIB:
                    raise RuntimeError("observer, reserve, deadline, or output limit failed")
                tick()
                last = now
                time.sleep(.25)
            code = proc.returncode
    except Exception as exc:
        failure = str(exc)
        code = 90
    finally:
        subprocess.run(["wsl.exe", "-d", "habitat", "-u", "root", "--exec",
                        "systemctl", "stop", UNIT + ".service"], capture_output=True, timeout=10)
        if proc is not None:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
        status = subprocess.run(["wsl.exe", "-d", "habitat", "-u", "root", "--exec", "systemctl",
                                 "show", UNIT + ".service", "-p", "ActiveState", "-p", "MainPID", "-p", "LoadState"],
                                capture_output=True, text=True, timeout=10)
        absent = subprocess.run(["wsl.exe", "-d", "habitat", "-u", "root", "--exec", "test", "!", "-e",
                                 "/sys/fs/cgroup/system.slice/" + UNIT + ".service"], timeout=10)
        clean = ("ActiveState=inactive" in status.stdout and "MainPID=0" in status.stdout
                 and "LoadState=not-found" in status.stdout and absent.returncode == 0
                 and (proc is None or proc.poll() is not None))
        result = {**entry, "elapsed": time.monotonic() - started, "exit": code,
                  "failure": failure, "samples": samples, "cleanup_accepted": clean,
                  "unit_status": status.stdout, "log": str(log)}
        (proof / (phase + ".json")).write_text(json.dumps(result, indent=2))
        history.append({k: v for k, v in result.items() if k != "samples"})
        attempts.write_text("".join(json.dumps(row) + "\n" for row in history))
    print(json.dumps({k: v for k, v in result.items() if k not in {"samples", "command"}}))
    return code if clean else 91


if __name__ == "__main__":
    phase = sys.argv[2] if sys.argv[1] == "--inside" else sys.argv[1]
    if phase not in PHASES:
        raise SystemExit("unknown proof phase")
    if sys.argv[1] == "--inside":
        raise SystemExit(inside(phase))
    sys.path.insert(0, str(ROOT / "tools"))
    from hoh.protocol import _exclusive_file_lock
    proof = ROOT / ".tmp/20j"
    proof.mkdir(parents=True, exist_ok=True)
    with _exclusive_file_lock(proof / "run.lock"):
        raise SystemExit(outside(phase))
