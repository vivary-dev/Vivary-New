"""Linux half of the 05b proof. Filesystem deletion is deliberately unavailable.

Product subprocesses require the named, non-root service and verified cgroup.
Bookkeeping reads bindings, exports evidence, or emits an exact cleanup plan.
"""

from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import queue
import resource
import select
import signal
import stat
import subprocess
import sys
import tarfile
import threading
import time


spec = importlib.util.spec_from_file_location("gui_guard", Path(__file__).with_name("gui_proof_controller.py"))
if spec is None or spec.loader is None:
    raise RuntimeError("05b controller source is unavailable")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
MIB = guard.MIB


def json_file(path, expected=None):
    raw = guard.read_regular(path, guard.MAX_BINDING_BYTES)
    if expected is not None:
        guard.require(hashlib.sha256(raw).hexdigest() == expected, "Linux control binding changed")
    return guard.parse_json(raw)


def write_json(path, value):
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(value, sort_keys=True) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def bookkeeping_limits():
    guard.require(sys.platform == "linux", "Linux bookkeeping requires Linux")
    resource.setrlimit(resource.RLIMIT_AS, (512 * MIB, 512 * MIB))
    resource.setrlimit(resource.RLIMIT_FSIZE, (64 * MIB, 64 * MIB))
    os.sched_setaffinity(0, {min(os.sched_getaffinity(0))})
    signal.alarm(90)


def toolchains(config):
    bookkeeping_limits()
    node = Path(config["linuxNode"]["path"])
    deps = Path(config["dependencyRootLinux"])
    guard.require(node.stat().st_size == config["linuxNode"]["bytes"]
                  and guard.stream_digest(node) == config["linuxNode"]["sha256"], "Linux Node changed")
    for package, key in (("core", "corePackageJsonSha256"), ("toolkit", "toolkitPackageJsonSha256")):
        manifest = (deps / "@agent-native" / package / "package.json").resolve(strict=True)
        guard.require(manifest.is_relative_to(deps), "Native manifest escaped dependencies")
        guard.require(guard.stream_digest(manifest) == config["nativePackages"][key], "Native package changed")
    for name in (".vite-temp", ".nitro"):
        destination = deps / name
        guard.require(stat.S_ISDIR(guard.no_link(destination).st_mode), "selective cache destination is absent")
    return {"node": {"bytes": node.stat().st_size, "sha256": guard.stream_digest(node)},
            "dependencies": guard.tree_summary(deps, allow_links=True)}


def load_run(scratch, run_id, runtime_hash):
    guard.require(scratch == scratch.resolve() and scratch.name == "vivary-05b-gui-proof", "scratch alias refused")
    guard.no_link(scratch)
    runtime = json_file(scratch / ".control/runtime.json", runtime_hash)
    guard.require(runtime["runId"] == run_id, "Linux run identity differs")
    config = json_file(scratch / ".control/config.json", runtime["configSha256"])
    guard.require(config["scratchLinux"] == str(scratch) and config["profile"] == guard.PROFILE, "Linux profile differs")
    owner = json_file(scratch / ".owner.json")
    guard.require(owner == {"runId": run_id, "configSha256": runtime["configSha256"]}, "scratch owner differs")
    return config, runtime


def stage(config_path, config_hash, run_id, runtime_hash):
    """Create one owned projection from a bounded archive. Never replace a path."""
    bookkeeping_limits()
    guard.require(os.getuid() == 0, "projection ownership setup requires root")
    config_raw = guard.read_regular(Path(config_path), guard.MAX_CONFIG_BYTES)
    guard.require(hashlib.sha256(config_raw).hexdigest() == config_hash, "stage configuration changed")
    config = guard.parse_json(config_raw)
    scratch = Path(config["scratchLinux"])
    guard.linux_path(str(scratch), "scratch")
    guard.require(scratch.name == "vivary-05b-gui-proof" and scratch.parent == scratch.parent.resolve(), "stage scratch differs")
    guard.require(not scratch.exists() and not scratch.is_symlink(), "stage scratch already exists")
    raw = sys.stdin.buffer.read(40 * MIB + 1)
    guard.require(len(raw) <= 40 * MIB, "source transport archive exceeded its cap")
    payload = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        members = archive.getmembers()
        guard.require(len(members) <= guard.MAX_FILES + 10, "projection member count exceeded")
        for member in members:
            guard.relative_name(member.name, "projection member")
            guard.require(member.isfile() and not member.issparse() and not member.pax_headers
                          and member.name not in payload and member.size <= guard.MAX_SOURCE_FILE_BYTES,
                          "invalid projection member")
            stream = archive.extractfile(member)
            guard.require(stream is not None, "projection member could not be read")
            payload[member.name] = stream.read(member.size + 1)
            guard.require(len(payload[member.name]) == member.size, "projection member is truncated")
    guard.require(payload.get(".control/config.json") == config_raw, "projection configuration differs")
    runtime_raw = payload.get(".control/runtime.json", b"")
    guard.require(hashlib.sha256(runtime_raw).hexdigest() == runtime_hash, "projection runtime binding differs")
    runtime = guard.parse_json(runtime_raw)
    guard.require(runtime["runId"] == run_id and runtime["configSha256"] == config_hash, "projection identity differs")
    binding_raw = payload.get(".control/source-binding.json", b"")
    guard.require(hashlib.sha256(binding_raw).hexdigest() == runtime["sourceBindingSha256"], "projection source binding differs")
    binding = guard.parse_json(binding_raw)
    expected_members = {".control/config.json", ".control/runtime.json", ".control/source-binding.json", ".control/authority.json"}
    guard.require(hashlib.sha256(payload.get(".control/authority.json", b"")).hexdigest()
                  == runtime["authoritySha256"], "projection authority differs")
    for name, expected in binding["sources"].items():
        if name.startswith(guard.APP + "/"):
            projected = "app/" + name[len(guard.APP) + 1:]
        else:
            guard.require(name.startswith(guard.FIXTURE + "/"), "projection source owner differs")
            projected = "harness/" + name[len(guard.FIXTURE) + 1:]
        guard.relative_name(projected, "projected source")
        expected_members.add(projected)
        content = payload.get(projected)
        guard.require(content is not None and len(content) == expected["bytes"]
                      and hashlib.sha256(content).hexdigest() == expected["sha256"], "projected source bytes differ")
    guard.require(set(payload) == expected_members, "projection includes unexpected members")
    scratch.mkdir(mode=0o755)
    write_json(scratch / ".owner.json", {"runId": run_id, "configSha256": config_hash})
    for name, content in payload.items():
        target = scratch / name
        target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(content)
        target.chmod(0o444)
    (scratch / "app/node_modules").mkdir(mode=0o555)
    (scratch / ".owner.json").chmod(0o444)
    plans = guard.containment_plan(config, run_id)["phases"]
    writable = set()
    for plan in plans.values():
        writable.update(plan["properties"]["ReadWritePaths"])
        writable.update(item["source"] for item in plan["privateWritableBindMounts"])
    for name in sorted(writable, key=lambda value: len(Path(value).parts)):
        target = Path(name)
        guard.require(target.is_relative_to(scratch) and target != scratch, "writable directory escaped scratch")
        if target == scratch / "app/.agent-native/nitro-preset":
            target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            with target.open("xb"):
                pass
            target.chmod(0o600)
        else:
            target.mkdir(mode=0o700, parents=True, exist_ok=True)
            target.chmod(0o700)
        os.chown(target, 1000, 1000)
    verify_source(scratch, runtime)
    print(json.dumps({"staged": True, "runId": run_id, "files": len(binding["sources"])}))


def verify_source(scratch, runtime):
    binding = json_file(scratch / ".control/source-binding.json", runtime["sourceBindingSha256"])
    for name, expected in binding["sources"].items():
        if name.startswith(guard.APP + "/"):
            relative = "app/" + name[len(guard.APP) + 1:]
        else:
            guard.require(name.startswith(guard.FIXTURE + "/"), "unexpected source owner")
            relative = "harness/" + name[len(guard.FIXTURE) + 1:]
        source = guard.checked_path(scratch, relative)
        guard.require(source.stat().st_size == expected["bytes"]
                      and guard.stream_digest(source, guard.MAX_SOURCE_FILE_BYTES) == expected["sha256"],
                      "projected source changed")
        guard.require(not source.stat().st_mode & 0o222, "projected input has writable permission bits")


def boundary(config, runtime, phase):
    scratch = Path(config["scratchLinux"])
    plan = guard.containment_plan(config, runtime["runId"])["phases"][phase]
    guard.require(os.getuid() == 1000 and os.getgid() == 1000, "service identity differs")
    membership = Path("/proc/self/cgroup").read_text().strip()
    guard.require(membership == "0::/system.slice/" + plan["unit"], "service cgroup differs")
    cgroup = Path(plan["cgroup"])
    limits = {key: (cgroup / key).read_text().strip()
              for key in ("memory.max", "memory.swap.max", "pids.max", "cpu.max")}
    guard.require(limits == {"memory.max": str(guard.PROFILE[phase + "LinuxMiB"] * MIB),
                            "memory.swap.max": "0", "pids.max": "64", "cpu.max": "100000 100000"},
                  "service cgroup limits differ")
    status = Path("/proc/self/status").read_text()
    guard.require("NoNewPrivs:\t1\n" in status, "NoNewPrivileges is absent")
    interfaces = [line.split(":", 1)[0].strip() for line in Path("/proc/net/dev").read_text().splitlines() if ":" in line]
    guard.require(interfaces == ["lo"], "service has an external network interface")
    expected_mounts = [(Path(config["dependencyRootLinux"]), True), (scratch / "app", True),
                       (scratch / "app/node_modules", True), (scratch / "harness", True)]
    expected_mounts += [(Path(name), False) for name in plan["properties"]["ReadWritePaths"]]
    expected_mounts += [(Path(item["destination"]), False) for item in plan["privateWritableBindMounts"]]
    flags = {}
    for path, readonly in expected_mounts:
        flags[str(path)] = bool(os.statvfs(path).f_flag & os.ST_RDONLY)
        guard.require(flags[str(path)] == readonly, "service mount flags differ")
    mount_lines = Path("/proc/self/mountinfo").read_text().splitlines()
    for item in plan["privateWritableBindMounts"]:
        matches = [line.split() for line in mount_lines if line.split()[4] == item["destination"]]
        guard.require(len(matches) == 1 and "rw" in matches[0][5].split(","), "selective private mount is missing")
        source_stat = os.stat(item["source"])
        destination_stat = os.stat(item["destination"])
        guard.require((source_stat.st_dev, source_stat.st_ino) == (destination_stat.st_dev, destination_stat.st_ino),
                      "selective cache mount targets another directory")
    verify_source(scratch, runtime)
    return {"unit": plan["unit"], "cgroup": membership, "limits": limits,
            "mountReadOnly": flags, "networkInterfaces": interfaces, "uid": os.getuid()}


class ServiceInput:
    """Consume owner heartbeats and forward only bounded browser RPC frames."""

    def __init__(self, phase):
        self.phase = phase
        self.stop = threading.Event()
        self.fresh = threading.Event()
        self.lock = threading.Lock()
        self.started = time.monotonic()
        self.last_heartbeat = None
        self.last_stamp = 0.0
        self.failure = None
        self.closing_requested = False
        self.eof_at = None
        self.total_bytes = 0
        self.last_id = 0
        self.outgoing = queue.Queue(maxsize=guard.TRANSPORT["maximumPendingRequests"])
        self.child = None
        self.reader = threading.Thread(target=self.read_frames, daemon=True)
        self.writer = None

    def __enter__(self):
        self.reader.start()
        return self

    def __exit__(self, *_):
        self.stop.set()
        for thread in (self.reader, self.writer):
            if thread is not None and thread.ident is not None:
                thread.join(timeout=1)
                guard.require(not thread.is_alive(), "service input thread did not stop")

    def fail(self, error):
        with self.lock:
            if self.failure is None:
                self.failure = str(error)[:4096]

    def check(self):
        with self.lock:
            guard.require(self.failure is None, "service input failed: " + str(self.failure))
            now = time.monotonic()
            if self.eof_at is not None:
                guard.require(self.phase == "browser" and self.closing_requested and now - self.eof_at <= 5,
                              "service input ended outside bounded browser close")
                return
            guard.require(self.last_heartbeat is not None and now - self.last_heartbeat <= 1,
                          "Linux observer lost its owner")

    def wait_fresh(self):
        guard.require(self.fresh.wait(timeout=max(0, 1 - (time.monotonic() - self.started))),
                      "service owner heartbeat missing before dispatch")
        self.check()

    def accept(self, raw):
        message = guard.parse_json(raw)
        guard.require(isinstance(message, dict), "service frame is not an object")
        if message.get("schema") == guard.HEARTBEAT_SCHEMA:
            guard.exact(message, {"schema", "atUnixSeconds"}, "heartbeat frame")
            stamp = message["atUnixSeconds"]
            guard.require(type(stamp) in (int, float) and math.isfinite(stamp), "heartbeat timestamp differs")
            with self.lock:
                if 0 <= time.time() - stamp <= 1 and stamp > self.last_stamp:
                    self.last_stamp = stamp
                    self.last_heartbeat = time.monotonic()
                    self.fresh.set()
            return
        guard.require(self.phase == "browser" and not self.closing_requested, "unexpected product input")
        identity = message.get("id")
        guard.require(type(identity) is int and identity == self.last_id + 1
                      and identity <= guard.TRANSPORT["maximumRequests"] and isinstance(message.get("action"), str),
                      "service RPC identity or request cap differs")
        self.last_id = identity
        self.outgoing.put_nowait(raw)
        if message["action"] == "close":
            with self.lock:
                self.closing_requested = True

    def read_frames(self):
        pending = bytearray()
        descriptor = sys.stdin.fileno()
        try:
            while not self.stop.is_set():
                ready, _, _ = select.select([descriptor], [], [], 0.1)
                if not ready:
                    continue
                chunk = os.read(descriptor, 65536)
                if not chunk:
                    guard.require(not pending, "service input ended within a frame")
                    with self.lock:
                        self.eof_at = time.monotonic()
                    self.check()
                    self.outgoing.put_nowait(None)
                    return
                self.total_bytes += len(chunk)
                guard.require(self.total_bytes <= guard.TRANSPORT["maximumTotalTransportBytes"],
                              "service aggregate input cap exceeded")
                pending.extend(chunk)
                while True:
                    newline = pending.find(b"\n")
                    if newline < 0:
                        break
                    guard.require(newline + 1 <= guard.TRANSPORT["maximumFrameBytes"], "service frame cap exceeded")
                    raw = bytes(pending[:newline + 1])
                    del pending[:newline + 1]
                    self.accept(raw)
                guard.require(len(pending) < guard.TRANSPORT["maximumFrameBytes"], "service frame cap exceeded")
        except BaseException as error:
            self.fail(error)

    def attach(self, child):
        guard.require(self.phase == "browser" and self.child is None and child.stdin is not None,
                      "service backend stdin ownership differs")
        self.child = child
        os.set_blocking(child.stdin.fileno(), False)
        self.writer = threading.Thread(target=self.write_frames, daemon=True)
        self.writer.start()

    def write_frames(self):
        descriptor = self.child.stdin.fileno()
        try:
            while not self.stop.is_set():
                try:
                    raw = self.outgoing.get(timeout=0.1)
                except queue.Empty:
                    continue
                if raw is None:
                    return
                remaining = memoryview(raw)
                while remaining and not self.stop.is_set():
                    _, ready, _ = select.select([], [descriptor], [], 0.1)
                    if ready:
                        try:
                            written = os.write(descriptor, remaining)
                        except BlockingIOError:
                            continue
                        guard.require(written > 0, "backend stdin stopped accepting input")
                        remaining = remaining[written:]
        except BaseException as error:
            self.fail(error)
        finally:
            self.child.stdin.close()


def inside(scratch, run_id, runtime_hash, phase):
    config, runtime = load_run(scratch, run_id, runtime_hash)
    guard.require(phase in ("build", "browser"), "unknown Linux phase")
    guard.require(runtime.get("heartbeatTransport") == guard.HEARTBEAT_SCHEMA, "service heartbeat transport differs")
    with ServiceInput(phase) as service_input:
        run_inside(scratch, run_id, config, runtime, phase, service_input)


def run_inside(scratch, run_id, config, runtime, phase, service_input):
    plan = guard.containment_plan(config, run_id)["phases"][phase]
    evidence = scratch / "evidence" / phase
    service_input.wait_fresh()
    observed = boundary(config, runtime, phase)
    service_input.check()
    write_json(evidence / "boundary.json", observed)
    environment = plan["environment"]
    os.environ.clear()
    os.environ.update(environment)
    os.chdir(scratch / "app")
    started = time.monotonic()
    deadline = min(started + guard.PROFILE[phase + "Seconds"],
                   started + runtime["deadlineUnixSeconds"] - time.time())
    finished = threading.Event()
    diagnostics = [0]

    def observe():
        previous = time.monotonic()
        while not finished.wait(0.25):
            try:
                now = time.monotonic()
                guard.require(now - previous <= 1, "Linux observation gap exceeded")
                service_input.check()
                guard.require(now < deadline and diagnostics[0] <= MIB, "Linux command deadline or diagnostic cap exceeded")
                previous = now
            except BaseException:
                os._exit(90)

    observer = threading.Thread(target=observe, daemon=True)
    observer.start()
    results = []
    try:
        if phase == "browser":
            built = json_file(scratch / "evidence/build/result.json")
            guard.require(built["passed"] is True and built["runId"] == run_id, "browser lacks this run's successful build")
            guard.require(guard.tree_summary(scratch / "app/build", maximum_bytes=128 * MIB)
                          == built["build"], "built renderer or assets changed")
            service_input.check()
            child = subprocess.Popen(plan["backendArgv"], stdin=subprocess.PIPE, env=environment, start_new_session=True)
            service_input.attach(child)
            write_json(evidence / "process-group.json", {"pid": child.pid, "pgid": child.pid})
            code = child.wait(timeout=max(0.01, deadline - time.monotonic()))
            guard.require(code == 0, "proof backend failed")
            service_input.check()
        else:
            node = config["linuxNode"]["path"]
            health_source = (
                "import {checkNativeDependencies} from "
                + json.dumps(str(Path(config["dependencyRootLinux"]) / "@agent-native/core/dist/cli/native-dependencies.js"))
                + ";if(process.versions.node!=='22.23.2')throw Error('Node version differs');"
                + "const result=checkNativeDependencies(process.cwd());"
                + "if(result.status!=='healthy')throw Error('Native SQLite is not healthy');"
                + "console.log(JSON.stringify({node:process.versions.node,sqlite:result.status}));"
            )
            commands = [[node, "--input-type=module", "-e", health_source]] + [item["argv"] for item in plan["commands"]]
            for ordinal, command in enumerate(commands):
                service_input.check()
                verify_source(scratch, runtime)
                command_deadline = min(deadline, time.monotonic() + (300 if ordinal == len(commands) - 1 else 600))
                child = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                         stderr=subprocess.STDOUT, env=environment, start_new_session=True)
                write_json(evidence / f"process-group-{ordinal}.json", {"pid": child.pid, "pgid": child.pid})
                read_error = []

                def drain():
                    try:
                        with (evidence / f"command-{ordinal}.log").open("xb") as output:
                            while chunk := child.stdout.read(65536):
                                diagnostics[0] += len(chunk)
                                guard.require(diagnostics[0] <= MIB, "Linux diagnostics exceeded one MiB")
                                output.write(chunk)
                    except BaseException as error:
                        read_error.append(str(error))

                reader = threading.Thread(target=drain, daemon=True)
                reader.start()
                while child.poll() is None:
                    guard.require(not read_error and time.monotonic() < command_deadline, "build command failed its bound")
                    time.sleep(0.05)
                reader.join(timeout=1)
                guard.require(not reader.is_alive() and not read_error, "build output did not settle")
                results.append({"ordinal": ordinal, "argv": command, "exit": child.returncode})
                guard.require(child.returncode == 0, "build command failed")
                verify_source(scratch, runtime)
        result = {"runId": run_id, "phase": phase, "passed": True, "commands": results,
                  "elapsedSeconds": time.monotonic() - started}
        if phase == "build":
            result["build"] = guard.tree_summary(scratch / "app/build", maximum_bytes=128 * MIB)
        write_json(evidence / "result.json", result)
    except BaseException as error:
        write_json(evidence / "failure.json", {"runId": run_id, "phase": phase,
                   "error": type(error).__name__, "message": str(error)[:4096], "commands": results})
        raise
    finally:
        finished.set()
        observer.join(timeout=1)
        guard.require(not observer.is_alive(), "Linux observer did not stop")


def assert_absent(config, runtime):
    for phase in ("build", "browser"):
        unit = guard.containment_plan(config, runtime["runId"])["phases"][phase]["unit"]
        status = subprocess.run(["systemctl", "show", unit, "-p", "ActiveState", "-p", "LoadState", "-p", "MainPID"],
                                capture_output=True, timeout=3, check=False)
        guard.require(len(status.stdout) + len(status.stderr) < 8192 and status.returncode == 0, "unit observation failed")
        values = dict(line.split("=", 1) for line in status.stdout.decode().splitlines())
        guard.require(values == {"ActiveState": "inactive", "LoadState": "not-found", "MainPID": "0"}, "owned unit remains")
        guard.require(not Path("/sys/fs/cgroup/system.slice", unit).exists(), "owned cgroup remains")
    scratch = config["scratchLinux"]
    for line in Path("/proc/self/mountinfo").read_text().splitlines():
        mount = line.split()[4].replace("\\040", " ")
        guard.require(mount != scratch and not mount.startswith(scratch + "/"), "owned scratch still has a mount")


def owned_files(scratch, maximum=64 * MIB):
    files = []
    total = 0
    visited = 0
    pending = [scratch]
    while pending:
        directory = pending.pop()
        with os.scandir(directory) as entries:
            for entry in entries:
                visited += 1
                guard.require(visited <= 20000, "scratch inventory limit exceeded")
                path = directory / entry.name
                mode = guard.no_link(path).st_mode
                if stat.S_ISDIR(mode):
                    pending.append(path)
                else:
                    guard.require(stat.S_ISREG(mode), "special scratch file refused")
                    total += path.stat().st_size
                    guard.require(total <= maximum, "scratch byte limit exceeded")
                    files.append(path)
    return sorted(files)


def export(scratch, config, runtime):
    assert_absent(config, runtime)
    files = owned_files(scratch / "evidence")
    digest = hashlib.sha256()
    count = 0

    class Stream:
        def write(self, data):
            nonlocal count
            count += len(data)
            guard.require(count <= 64 * MIB, "Linux evidence archive exceeds its cap")
            digest.update(data)
            return sys.stdout.buffer.write(data)

        def flush(self):
            sys.stdout.buffer.flush()

    with tarfile.open(mode="w|", fileobj=Stream(), format=tarfile.USTAR_FORMAT) as archive:
        for path in files:
            archive.add(path, arcname=path.relative_to(scratch).as_posix(), recursive=False)
    sys.stdout.buffer.flush()
    write_json(scratch / ".control/linux-export.json", {"runId": runtime["runId"], "bytes": count, "sha256": digest.hexdigest()})


def cleanup_plan(scratch, config, runtime):
    assert_absent(config, runtime)
    acknowledgement = guard.parse_json(sys.stdin.buffer.read(8193))
    guard.exact(acknowledgement, {"runId", "linuxArchiveSha256", "finalArchiveSha256"}, "export acknowledgement")
    archived = json_file(scratch / ".control/linux-export.json")
    guard.require(acknowledgement["runId"] == runtime["runId"]
                  and acknowledgement["linuxArchiveSha256"] == archived["sha256"], "export readback differs")
    guard.digest(acknowledgement["finalArchiveSha256"], "final archive digest")
    files = owned_files(scratch, maximum=512 * MIB)
    return {"schema": "vivary.05b-gui-cleanup-plan/v1", "runId": runtime["runId"],
            "scratch": str(scratch), "unitsAbsent": True, "mountsAbsent": True,
            "fileCount": len(files), "bytes": sum(path.stat().st_size for path in files),
            "tree": guard.tree_summary(scratch, maximum_bytes=512 * MIB),
            "filesystemDeletionAvailable": False,
            "requires": "Explicit approval of exact retained scratch deletion and fresh ownership verification."}


def main():
    mode, *arguments = sys.argv[1:]
    if mode == "inspect":
        config_path, config_hash = arguments
        print(json.dumps(toolchains(json_file(Path(config_path), config_hash)), sort_keys=True))
        return
    if mode == "stage":
        stage(*arguments)
        return
    scratch_text, run_id, runtime_hash, *remaining = arguments
    scratch = Path(scratch_text)
    config, runtime = load_run(scratch, run_id, runtime_hash)
    if mode == "inside":
        guard.require(len(remaining) == 1, "Linux phase argument is missing")
        inside(scratch, run_id, runtime_hash, remaining[0])
        return
    bookkeeping_limits()
    if mode == "export":
        export(scratch, config, runtime)
    elif mode == "cleanup-plan":
        print(json.dumps(cleanup_plan(scratch, config, runtime), sort_keys=True))
    elif mode == "absent":
        assert_absent(config, runtime)
        print(json.dumps({"absent": True}))
    elif mode == "toolchains":
        print(json.dumps(toolchains(config), sort_keys=True))
    else:
        raise guard.Refusal("unknown Linux controller operation")


if __name__ == "__main__":
    main()
