"""Run the deterministic 05b title test without model or dependency access."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import threading
import time


ROOT = Path(__file__).resolve().parents[5]
PROOF = ROOT / ".tmp/05b"
CONFIG_PATH = PROOF / "habitat.json"
CONFIG = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
SCRATCH = CONFIG["scratch"]
UNIT = "vivary-05b-proof"
MIB = 1024 * 1024
ATTEMPT_SECONDS = 60
MAX_ATTEMPTS = 4
MAX_CUMULATIVE_SECONDS = 240
DISABLED_PLUGINS = (
    "agent-chat,auth,context-xray,core-routes,integrations,observational-memory,"
    "onboarding,org,resources,sentry,terminal"
)
CONFIG_KEYS = {
    "schema",
    "scratch",
    "checkout",
    "node",
    "nodeSha256",
    "corePackageJson",
    "corePackageJsonSha256",
}
EXPECTED_NODE_SHA256 = "3517c2df0b2f8cd7f422b4b8450ef81c6889f08eb03e281d6de9079b15e6a327"
EXPECTED_CORE_PACKAGE_SHA256 = (
    "937ec79fc0e2d1b105e1b422c2460ea2276c51709576e5604917f46a2e4bf539"
)


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(MIB):
            digest.update(chunk)
    return digest.hexdigest()


def validate_config():
    if CONFIG_PATH.is_symlink() or not CONFIG_PATH.is_file():
        raise RuntimeError("05b Habitat configuration is not a regular file")
    if not isinstance(CONFIG, dict) or set(CONFIG) != CONFIG_KEYS:
        raise RuntimeError("05b Habitat configuration shape differs")
    if CONFIG["schema"] != "vivary.05b-habitat-config/v1":
        raise RuntimeError("05b Habitat configuration schema differs")
    for name in ("scratch", "checkout", "node", "corePackageJson"):
        value = CONFIG[name]
        path = PurePosixPath(value) if isinstance(value, str) else PurePosixPath()
        if not path.is_absolute() or ".." in path.parts:
            raise RuntimeError("05b Habitat path is not absolute and normalized: " + name)
    if PurePosixPath(CONFIG["scratch"]).name != "vivary-05b-proof":
        raise RuntimeError("05b Habitat scratch binding differs")
    if PurePosixPath(CONFIG["node"]).name != "node":
        raise RuntimeError("05b Node executable binding differs")
    if PurePosixPath(CONFIG["corePackageJson"]).name != "package.json":
        raise RuntimeError("05b Core package binding differs")
    if CONFIG["nodeSha256"] != EXPECTED_NODE_SHA256:
        raise RuntimeError("05b Node digest binding differs")
    if CONFIG["corePackageJsonSha256"] != EXPECTED_CORE_PACKAGE_SHA256:
        raise RuntimeError("05b Core package digest binding differs")


def load_20j_guard():
    path = ROOT / "docs/product/multi-project/fixtures/20j/run_habitat.py"
    spec = importlib.util.spec_from_file_location("vivary_20j_resource_guard", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("20j resource guard cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def source_manifest():
    names = {
        "docs/product/multi-project/fixtures/05b/run_habitat.py",
        "docs/product/multi-project/fixtures/20j/run_habitat.py",
        "packages/workbench/tests/chat-title.test.mjs",
        "packages/workbench/tests/native-http-dependency-loader.mjs",
        "packages/workbench/tests/register-native-dependencies.mjs",
    }
    server = ROOT / "packages/workbench/server"
    names.update(path.relative_to(ROOT).as_posix() for path in server.rglob("*.mjs"))
    manifest = {}
    for name in sorted(names):
        path = ROOT / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError("05b source is not a regular file: " + name)
        manifest[name] = sha256_file(path)
    return manifest


def inside(attempt):
    validate_config()
    if sys.platform == "win32" or not attempt.isdigit() or not 1 <= int(attempt) <= MAX_ATTEMPTS:
        raise RuntimeError("05b inside invocation differs")
    temporary = Path(SCRATCH) / ("attempt-" + attempt)
    temporary.mkdir(mode=0o700)
    source_root = ROOT
    checkout = Path(CONFIG["checkout"])
    cgroup = Path("/sys/fs/cgroup") / Path("/proc/self/cgroup").read_text().split(
        "::", 1
    )[1].strip().lstrip("/")
    limits = {
        name: (cgroup / name).read_text().strip()
        for name in ("memory.max", "memory.swap.max", "pids.max", "cpu.max")
    }
    expected_limits = {
        "memory.max": "536870912",
        "memory.swap.max": "0",
        "pids.max": "64",
        "cpu.max": "100000 100000",
    }
    if limits != expected_limits:
        raise RuntimeError("05b cgroup limits differ")
    import pwd

    if os.getuid() != pwd.getpwnam("agent").pw_uid or os.getuid() == 0:
        raise RuntimeError("05b service user differs")
    if not os.statvfs(source_root).f_flag & os.ST_RDONLY:
        raise RuntimeError("05b source mount is writable")
    if not os.statvfs(checkout).f_flag & os.ST_RDONLY:
        raise RuntimeError("05b dependency checkout is writable")

    retained_path = str(Path(CONFIG["node"]).parent) + os.pathsep + "/usr/bin:/bin"
    os.environ.clear()
    os.environ.update(
        PATH=retained_path,
        HOME=str(temporary / "home"),
        TMPDIR=str(temporary / "tmp"),
        XDG_CACHE_HOME=str(temporary / "cache"),
        XDG_CONFIG_HOME=str(temporary / "config"),
        DATABASE_URL="file:" + str(temporary / "title.sqlite"),
        NODE_ENV="test",
        PYTHONDONTWRITEBYTECODE="1",
        VIVARY_TEST_CORE_PACKAGE_JSON=CONFIG["corePackageJson"],
        AGENT_NATIVE_DISABLED_PLUGINS=DISABLED_PLUGINS,
    )
    for name in ("home", "tmp", "cache", "config"):
        (temporary / name).mkdir(mode=0o700)

    toolchain = {
        CONFIG["node"]: CONFIG["nodeSha256"],
        CONFIG["corePackageJson"]: CONFIG["corePackageJsonSha256"],
    }
    for name, expected in toolchain.items():
        path = Path(name)
        if path.is_symlink() or not path.is_file() or sha256_file(path) != expected:
            raise RuntimeError("05b toolchain binding differs: " + name)
    manifest_path = PROOF / ("attempt-" + attempt + "-source.json")
    binding = json.loads(manifest_path.read_text(encoding="utf-8"))
    if (
        not isinstance(binding, dict)
        or set(binding) != {"schema", "configSha256", "sources"}
        or binding["schema"] != "vivary.05b-source-binding/v1"
        or binding["configSha256"] != sha256_file(CONFIG_PATH)
        or binding["sources"] != source_manifest()
    ):
        raise RuntimeError("05b source or configuration binding differs")
    manifest = binding["sources"]

    heartbeat = PROOF / "heartbeat"
    output_path = temporary / "command.log"

    def observe():
        while True:
            try:
                complete = heartbeat.read_text().rsplit("\n", 1)[0]
                lines = [line for line in complete.splitlines() if line]
                if time.time() - float(lines[-1]) > 1:
                    os._exit(90)
                if output_path.exists() and output_path.stat().st_size > MIB:
                    os._exit(93)
            except Exception:
                os._exit(91)
            time.sleep(0.25)

    threading.Thread(target=observe, daemon=True).start()
    command = [
        CONFIG["node"],
        "--max-old-space-size=192",
        "--import",
        str(source_root / "packages/workbench/tests/register-native-dependencies.mjs"),
        "--test",
        "--test-concurrency=1",
        str(source_root / "packages/workbench/tests/chat-title.test.mjs"),
    ]
    print(json.dumps({"command": command, "cwd": str(source_root)}), flush=True)
    started = time.monotonic()
    with output_path.open("xb") as output:
        run = subprocess.run(
            command,
            cwd=source_root,
            stdout=output,
            stderr=subprocess.STDOUT,
            timeout=ATTEMPT_SECONDS - 5,
            check=False,
        )
    if output_path.stat().st_size > MIB:
        raise RuntimeError("05b output limit exceeded")
    output = output_path.read_text(encoding="utf-8", errors="replace")
    print(output, end="" if output.endswith("\n") else "\n", flush=True)
    result = {
        "schema": "vivary.05b-title-test-result/v1",
        "attempt": int(attempt),
        "command": command,
        "exit": run.returncode,
        "elapsed": time.monotonic() - started,
        "limits": limits,
        "sourceFiles": len(manifest),
        "modelCalls": 0,
        "output": str(output_path),
    }
    (temporary / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result), flush=True)
    return run.returncode


def outside():
    validate_config()
    if sys.platform != "win32":
        raise RuntimeError("05b outside guard requires Windows")
    PROOF.mkdir(parents=True, exist_ok=True)
    attempts_path = PROOF / "attempts.jsonl"
    history = [
        json.loads(line)
        for line in attempts_path.read_text(encoding="utf-8").splitlines()
        if line
    ] if attempts_path.exists() else []
    if len(history) >= MAX_ATTEMPTS:
        raise RuntimeError("05b attempt limit reached")
    used = sum(item["allocatedSeconds"] for item in history)
    if used + ATTEMPT_SECONDS > MAX_CUMULATIVE_SECONDS:
        raise RuntimeError("05b cumulative runtime limit reached")

    attempt = len(history) + 1
    manifest_path = PROOF / f"attempt-{attempt}-source.json"
    log = PROOF / f"attempt-{attempt}.log"
    result_path = PROOF / f"attempt-{attempt}.json"
    evidence_paths = (manifest_path, log, result_path)
    if any(path.exists() or path.is_symlink() for path in evidence_paths):
        raise RuntimeError("05b attempt evidence already exists")

    manifest = source_manifest()
    config_sha256 = sha256_file(CONFIG_PATH)
    binding = {
        "schema": "vivary.05b-source-binding/v1",
        "configSha256": config_sha256,
        "sources": manifest,
    }
    manifest_raw = (json.dumps(binding, sort_keys=True) + "\n").encode("utf-8")

    guard = load_20j_guard()
    before = guard.resources()
    if (
        before["ram"] < 2560 * MIB
        or before["commit"] < 2048 * MIB
        or before["disk"] < 10 * 1024 * MIB
    ):
        raise RuntimeError("05b resource admission refused")
    job = guard.bind_job()
    if not job:
        raise RuntimeError("05b Windows job was not created")
    if source_manifest() != manifest or sha256_file(CONFIG_PATH) != config_sha256:
        raise RuntimeError("05b source or configuration changed during admission")
    manifest_path.write_bytes(manifest_raw)

    mounted = SCRATCH + "/source"
    script = mounted + "/docs/product/multi-project/fixtures/05b/run_habitat.py"
    service = [
        "systemd-run",
        "--unit=" + UNIT,
        "--wait",
        "--pipe",
        "--collect",
        "--service-type=exec",
        "--uid=agent",
        "-p", "MemoryMax=536870912",
        "-p", "MemorySwapMax=0",
        "-p", "TasksMax=64",
        "-p", "CPUQuota=100%",
        "-p", "RuntimeMaxSec=60",
        "-p", "TimeoutStopSec=5",
        "-p", "KillMode=control-group",
        "-p", "PrivateNetwork=yes",
        "-p", "NoNewPrivileges=yes",
        "-p", "ProtectSystem=strict",
        "-p", "ProtectControlGroups=yes",
        "-p", "ReadOnlyPaths=" + CONFIG["checkout"],
        "-p", "PrivateTmp=yes",
        "-p", "ReadWritePaths=" + SCRATCH,
        "/usr/bin/python3",
        "-B",
        script,
        "--inside",
        str(attempt),
    ]
    bootstrap = (
        "set -eu; source_root=\"$1\"; scratch=\"$2\"; mount_root=\"$3\"; shift 3; "
        "if [ -L \"$scratch\" ]; then exit 72; fi; "
        "install -d -m 0700 -o agent -g agent \"$scratch\"; "
        "if [ \"$(readlink -f -- \"$scratch\")\" != \"$scratch\" ]; then exit 72; fi; "
        "install -d -m 0700 -o agent -g agent \"$mount_root\"; "
        "if mountpoint -q \"$mount_root\"; then exit 73; fi; "
        "mount -t drvfs \"$source_root\" \"$mount_root\" -o ro; "
        "trap 'umount \"$mount_root\"' EXIT; \"$@\""
    )
    command = [
        "wsl.exe", "-d", "habitat", "-u", "root", "--exec",
        "sh", "-c", bootstrap, "05b", str(ROOT), SCRATCH, mounted,
        *service,
    ]
    entry = {
        "schema": "vivary.05b-title-test-attempt/v1",
        "attempt": attempt,
        "allocatedSeconds": ATTEMPT_SECONDS,
        "started": time.time(),
        "before": before,
        "manifestSha256": hashlib.sha256(manifest_raw).hexdigest(),
        "configSha256": config_sha256,
        "command": command,
    }
    with attempts_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(entry, sort_keys=True) + "\n")
        stream.flush()
        os.fsync(stream.fileno())

    heartbeat = PROOF / "heartbeat"

    def tick():
        with heartbeat.open("a", encoding="utf-8") as stream:
            stream.write(str(time.time()) + "\n")
            stream.flush()

    tick()
    started = time.monotonic()
    samples = []
    process = None
    failure = None
    code = 90
    try:
        with log.open("xb") as output:
            process = subprocess.Popen(
                command,
                stdout=output,
                stderr=subprocess.STDOUT,
                creationflags=0x08000000,
            )
            last = time.monotonic()
            while process.poll() is None:
                now = time.monotonic()
                reading = guard.resources()
                samples.append({"elapsed": now - started, **reading})
                if now - last > 1:
                    raise RuntimeError("05b Windows observer gap exceeded")
                if reading["ram"] < 1536 * MIB:
                    raise RuntimeError("05b host reserve breached")
                if now - started > ATTEMPT_SECONDS + 5:
                    raise RuntimeError("05b outer deadline exceeded")
                if log.stat().st_size > MIB:
                    raise RuntimeError("05b output limit exceeded")
                tick()
                last = now
                time.sleep(0.25)
            code = process.returncode
    except Exception as error:
        failure = f"{type(error).__name__}: {error}"
    finally:
        subprocess.run(
            ["wsl.exe", "-d", "habitat", "-u", "root", "--exec", "systemctl", "stop", UNIT + ".service"],
            capture_output=True,
            timeout=10,
            check=False,
        )
        if process is not None:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        status = subprocess.run(
            [
                "wsl.exe", "-d", "habitat", "-u", "root", "--exec", "systemctl", "show",
                UNIT + ".service", "-p", "ActiveState", "-p", "MainPID", "-p", "LoadState",
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        absent = subprocess.run(
            [
                "wsl.exe", "-d", "habitat", "-u", "root", "--exec", "test", "!", "-e",
                "/sys/fs/cgroup/system.slice/" + UNIT + ".service",
            ],
            capture_output=True,
            timeout=10,
            check=False,
        )
        clean = (
            "ActiveState=inactive" in status.stdout
            and "MainPID=0" in status.stdout
            and "LoadState=not-found" in status.stdout
            and absent.returncode == 0
            and (process is None or process.poll() is not None)
        )
        result = {
            **entry,
            "completed": True,
            "elapsed": time.monotonic() - started,
            "exit": code,
            "failure": failure,
            "samples": samples,
            "cleanupAccepted": clean,
            "unitStatus": status.stdout,
            "log": str(log),
        }
        result_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key not in {"samples", "command"}}))
    return code if clean else 91


if __name__ == "__main__":
    validate_config()
    if len(sys.argv) == 3 and sys.argv[1] == "--inside":
        raise SystemExit(inside(sys.argv[2]))
    if len(sys.argv) != 1:
        raise SystemExit("usage: python docs/product/multi-project/fixtures/05b/run_habitat.py")
    sys.path.insert(0, str(ROOT / "tools"))
    from hoh.protocol import _exclusive_file_lock

    PROOF.mkdir(parents=True, exist_ok=True)
    with _exclusive_file_lock(PROOF / "run.lock"):
        raise SystemExit(outside())
