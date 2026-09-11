"""Run one Zo proof phase with private filesystems and measured stop thresholds."""
import argparse
import hashlib
import fcntl
import re
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / ".tmp/05b/zo-runtime"
PNPM = Path("/root/.cache/node/corepack/v1/pnpm/10.33.2")
MEMORY_STOP = 8 * 1024**3
PROCESS_STOP = 256
FORBIDDEN_CHROMIUM_FLAGS = {"--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu-sandbox", "--no-zygote-sandbox"}
PROFILE = {
    "schema": "vivary.05b-zo-profile/v1",
    "sandbox": {"uid": 1000, "gid": 1000, "pidNamespace": True,
                "network": "loopback-only", "filesystem": "private-ro-source",
                "capabilities": "none", "noNewPrivileges": True},
    "supervision": {"kind": "external-observer", "enforcement": "monitored-stop",
                    "memoryStopBytes": MEMORY_STOP, "processStopCount": PROCESS_STOP,
                    "sampleMilliseconds": 250, "cpuCount": 4, "swapTotalBytes": 0},
}


def persist_ledger(destination, value):
    temporary = destination.with_suffix(".new")
    with temporary.open("w") as stream:
        stream.write(json.dumps(value, indent=2) + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(destination)
    descriptor = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def process_table():
    result = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / "stat").read_text().rsplit(")", 1)[1].split()
            status = (entry / "status").read_text().splitlines()
            rss = next((int(line.split()[1]) * 1024 for line in status
                        if line.startswith("VmRSS:")), 0)
            result[int(entry.name)] = {
                "parent": int(stat[1]), "started": int(stat[19]),
                "rss": rss, "threads": next((int(line.split()[1]) for line in status
                                           if line.startswith("Threads:")), 1),
            }
        except (FileNotFoundError, ProcessLookupError):
            pass
    return result


def owned_processes(table, identities):
    owned = {pid for pid, started in identities.items()
             if pid in table and table[pid]["started"] == started}
    while True:
        additions = {pid for pid, data in table.items() if data["parent"] in owned}
        if additions <= owned:
            return owned
        owned |= additions


def command_for(phase, work, command, browser):
    app = BASE / "app"
    args = ["bwrap", "--unshare-user", "--uid", "1000", "--gid", "1000",
            "--unshare-pid", "--die-with-parent", "--cap-add", "CAP_SYS_ADMIN",
            "--cap-add", "CAP_NET_ADMIN", "--ro-bind", "/usr", "/usr",
            "--symlink", "usr/bin", "/bin",
            "--ro-bind", "/lib", "/lib", "--ro-bind", "/lib64", "/lib64",
            "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
            "--tmpfs", "/home", "--dir", "/home/test", "--dir", "/etc",
            "--ro-bind", str(BASE / "source"), "/source",
            "--bind", str(work), "/work",
            "--ro-bind", str(PNPM), "/pnpm",
            "--bind" if phase in ("install", "build", "hooks") else "--ro-bind",
            str(app), "/app", "--chdir", "/app"]
    if Path("/etc/fonts").exists():
        args += ["--ro-bind", "/etc/fonts", "/etc/fonts"]
    if phase in ("install", "acquire"):
        args += ["--ro-bind", "/etc/resolv.conf", "/etc/resolv.conf"]
    if browser:
        args += ["--ro-bind", str(browser.resolve()), "/browser"]
    args += ["--", "/usr/bin/unshare"]
    if phase not in ("install", "acquire"):
        args += ["--net"]
    args += ["/usr/bin/setpriv", "--bounding-set=-all", "--inh-caps=-all",
             "--ambient-caps=-all", "--no-new-privs"] + command
    return args


def run(args):
    assert args.phase in ("probe", "install", "acquire", "hooks", "build", "browser", "tests")
    assert re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", args.name)
    assert 0 < args.seconds <= {"install": 900, "acquire": 300, "hooks": 300, "build": 600, "browser": 300, "tests": 300, "probe": 30}[args.phase]
    if args.phase == "install":
        assert args.command == ["/usr/bin/node", "/pnpm/bin/pnpm.cjs", "install",
                                "--frozen-lockfile", "--ignore-scripts",
                                "--registry=https://registry.npmjs.org",
                                "--store-dir=/work/pnpm-store", "--reporter=append-only"]
    if args.phase == "acquire":
        assert args.command == ["/usr/bin/node",
            "/app/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/cli.js",
            "install", "chromium", "--no-shell", "--no-remove", "--no-progress"]
    BASE.mkdir(parents=True, exist_ok=True)
    budget_lock = (BASE / "budget.lock").open("a+")
    fcntl.flock(budget_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    ledger_path = BASE / "budget.json"
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else []
    category = "setup" if args.phase in ("install", "acquire", "hooks") else "probe" if args.phase == "probe" else "verification"
    limit = {"setup": 900, "verification": 1800, "probe": 120}[category]
    spent = sum(item["chargedSeconds"] for item in ledger if item["category"] == category)
    assert spent + args.seconds + 5 <= limit, f"{category} budget cannot admit this deadline"
    assert args.phase not in ("build", "browser") or sum(item["phase"] == args.phase for item in ledger) < 3
    run_dir = BASE / args.name
    run_dir.mkdir()
    work = run_dir / "work"
    work.mkdir()
    app = BASE / "app"
    assert app.is_dir()
    if args.config:
        config = json.loads(Path(args.config).read_text())
        (work / "input.json").write_text(json.dumps(config, indent=2) + "\n")
        profile = dict(PROFILE)
        profile.update(candidateHead=config["candidateHead"],
                       sourceBindingSha256=config["sourceBindingSha256"])
        (work / "zo-profile.json").write_text(json.dumps(profile, indent=2) + "\n")
        assert hashlib.sha256((work / "zo-profile.json").read_bytes()).hexdigest() == config["profileSha256"]
    cpus = sorted(os.sched_getaffinity(0))[:4]
    assert len(cpus) == 4
    environment = {
        "PATH": "/usr/bin:/bin", "HOME": "/home/test", "TMPDIR": "/tmp",
        "LANG": "C.UTF-8", "CI": "true", "PNPM_HOME": "/tmp/pnpm",
        "CC": "/usr/bin/gcc", "CXX": "/usr/bin/g++",
        "NODE_ENV": "production" if args.phase == "browser" else "development",
        "AGENT_MODE": "production", "AGENT_ENGINE": "vivary-proof",
        "AGENT_NATIVE_DISABLE_RECURRING_JOBS": "true",
        "AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS": "true",
        "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
        "PLAYWRIGHT_BROWSERS_PATH": "/work/browsers",
    }
    supervisor_sha256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    launch = command_for(args.phase, work, args.command, Path(args.browser) if args.browser else None)
    entry = {"name": args.name, "phase": args.phase, "category": category,
             "chargedSeconds": args.seconds + 5, "status": "reserved"}
    ledger.append(entry)
    persist_ledger(ledger_path, ledger)
    started = time.monotonic()
    failure = None
    identities = {}
    samples = []
    outer_pid_namespace = os.readlink("/proc/self/ns/pid")
    observed_pid_namespaces = set()
    chromium_launches = {}
    with (run_dir / "stdout.log").open("xb") as out, (run_dir / "stderr.log").open("xb") as err:
        child = subprocess.Popen(launch, env=environment, stdout=out, stderr=err,
                                 start_new_session=True,
                                 preexec_fn=lambda: os.sched_setaffinity(0, cpus))
        try:
            previous_sample = started
            while True:
                now = time.monotonic()
                if now - previous_sample > 1:
                    failure = "observer-gap"
                previous_sample = now
                table = process_table()
                if child.pid in table:
                    identities.setdefault(child.pid, table[child.pid]["started"])
                owned = owned_processes(table, identities)
                identities.update({pid: table[pid]["started"] for pid in owned})
                for pid in owned:
                    try:
                        observed_pid_namespaces.add(os.readlink(f"/proc/{pid}/ns/pid"))
                    except (FileNotFoundError, PermissionError):
                        pass
                if args.phase == "browser":
                    for pid in owned:
                        if pid in chromium_launches:
                            continue
                        try:
                            raw = Path(f"/proc/{pid}/cmdline").read_bytes()
                            assert len(raw) <= 65536
                            argv = [part.decode("utf-8", "strict") for part in raw.split(b"\0") if part]
                            if not argv or argv[0] != "/browser/chrome" or any(arg.startswith("--type=") for arg in argv):
                                continue
                            current_stat = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
                            if int(current_stat[19]) != identities[pid]:
                                continue
                            chromium_launches[pid] = {"pid": pid, "started": identities[pid], "argv": argv}
                            if any(arg.split("=", 1)[0] in FORBIDDEN_CHROMIUM_FLAGS for arg in argv):
                                failure = "chromium-sandbox-disabled"
                        except FileNotFoundError:
                            pass
                sample = {"seconds": round(time.monotonic() - started, 3),
                          "rssBytes": sum(table[p]["rss"] for p in owned),
                          "processes": len(owned),
                          "threads": sum(table[p]["threads"] for p in owned)}
                samples.append(sample)
                if time.monotonic() - previous_sample > 1:
                    failure = "observer-scan-gap"
                if sample["rssBytes"] > MEMORY_STOP:
                    failure = "memory-stop"
                elif sample["threads"] > PROCESS_STOP:
                    failure = "task-stop"
                elif sample["seconds"] > args.seconds:
                    failure = "deadline"
                elif out.tell() + err.tell() > 8 * 1024**2:
                    failure = "output-stop"
                if failure or child.poll() is not None:
                    break
                time.sleep(.25)
        except Exception as error:
            failure = "observer-error:" + type(error).__name__
        finally:
            cleanup_ok = False
            owned = set(identities)
            cleanup_deadline = time.monotonic() + 5
            try:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=max(.01, cleanup_deadline - time.monotonic()))
                owned = owned_processes(process_table(), identities)
                for pid in owned:
                    try:
                        fresh = process_table().get(pid)
                        if fresh and fresh["started"] == identities[pid]:
                            os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                while owned and time.monotonic() < cleanup_deadline:
                    time.sleep(.1)
                    owned = owned_processes(process_table(), identities)
                cleanup_ok = not owned
            except Exception as error:
                failure = "cleanup-error:" + type(error).__name__
    if not any(sample["processes"] for sample in samples):
        failure = failure or "unobserved-process"
    if args.phase == "browser":
        if not chromium_launches:
            failure = failure or "chromium-launch-unobserved"
        elif any(arg.split("=", 1)[0] in FORBIDDEN_CHROMIUM_FLAGS for launch in chromium_launches.values() for arg in launch["argv"]):
            failure = failure or "chromium-sandbox-disabled"
    result = {
        "phase": args.phase, "name": args.name, "returncode": child.returncode,
        "launcherPid": child.pid,
        "supervisorSha256": supervisor_sha256,
        "failure": failure, "elapsedSeconds": time.monotonic() - started,
        "cpuAffinity": cpus, "samples": samples,
        "outerPidNamespace": outer_pid_namespace,
        "observedPidNamespaces": sorted(observed_pid_namespaces),
        "chromiumLaunches": list(chromium_launches.values()),
        "cleanupAbsent": cleanup_ok, "remainingPids": sorted(owned),
        "supervision": PROFILE["supervision"],
        "network": "registry-acquisition" if args.phase == "install" else "pinned-browser-acquisition" if args.phase == "acquire" else "loopback-only",
    }
    entry.update(status="finished", chargedSeconds=result["elapsedSeconds"])
    if sum(item["chargedSeconds"] for item in ledger if item["category"] == category) > limit:
        failure = "budget-overrun"
        result["failure"] = failure
    persist_ledger(ledger_path, ledger)
    (run_dir / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "samples"}), flush=True)
    return 0 if child.returncode == 0 and not failure and cleanup_ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase")
    parser.add_argument("name")
    parser.add_argument("--seconds", type=int, required=True)
    parser.add_argument("--browser")
    parser.add_argument("--config")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    parsed = parser.parse_args()
    if parsed.command[:1] == ["--"]:
        parsed.command.pop(0)
    raise SystemExit(run(parsed))
