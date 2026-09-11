"""Validate 05b GUI bindings and provide non-dispatch containment components.

The CLI only inspects source. Executable root dispatch is unavailable following
approval-review rejection. Its unapplied proposal is retained for review.
"""

from __future__ import annotations

import argparse
import base64
import contextlib
import ctypes
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import queue
import re
import secrets
import shutil
import socket
import stat
import subprocess
import sys
import tarfile
import threading
import time
from typing import Any
from urllib.parse import unquote, urlsplit


MIB = 1024 * 1024
MAX_FILES = 4096
MAX_SOURCE_BYTES = 32 * MIB
MAX_SOURCE_FILE_BYTES = 4 * MIB
MAX_CONFIG_BYTES = 64 * 1024
MAX_BINDING_BYTES = MIB
MAX_LEDGER_BYTES = 64 * 1024
FIXTURE = "docs/product/multi-project/fixtures/05b"
APP = "packages/workbench"
SOURCE_DIRECTORIES = (f"{APP}/app", f"{APP}/server", f"{APP}/actions", f"{APP}/public")
SOURCE_FILES = (
    f"{APP}/package.json", f"{APP}/pnpm-lock.yaml", f"{APP}/agent-native.config.ts",
    f"{APP}/react-router.config.ts", f"{APP}/tsconfig.json", f"{APP}/vite.config.ts",
    f"{FIXTURE}/gui_backend.mjs", f"{FIXTURE}/gui_browser.mjs",
    f"{FIXTURE}/gui_proof_controller.py",
    f"{FIXTURE}/gui_proof_linux.py",
)
FORBIDDEN_PARTS = frozenset({
    ".git", ".env", "node_modules", ".pnpm", ".cache", "cache", "caches",
    ".generated", ".react-router", ".agent-native", ".output", "build",
    "dist", "coverage", "__pycache__", ".ssh", "credentials", "secrets",
})
PROFILE = {
    "aggregateSeconds": 1200, "buildSeconds": 600, "bundlingSeconds": 300,
    "browserSeconds": 300, "transferExportCleanupSeconds": 300,
    "buildLinuxMiB": 2048, "buildWindowsMiB": 512,
    "browserLinuxMiB": 512, "browserWindowsMiB": 1024, "nodeHeapMiB": 512,
    "buildWarmRamMiB": 4096, "browserWarmRamMiB": 3072,
    "minimumCommitMiB": 4096, "minimumDiskGiB": 10, "hostReserveMiB": 1536,
    "maximumIncludedUsagePercent": 95, "linuxSwapMiB": 0, "linuxTasks": 64,
    "cpuPerEnvironment": 1, "observerMilliseconds": 250,
    "maximumObservationGapMilliseconds": 1000, "maximumOutputMiB": 1,
    "ownedProcessCleanupSeconds": 5, "maximumBuildAttempts": 1,
    "maximumBrowserAttempts": 1, "automaticRetries": 0,
}
TRANSPORT = {
    "maximumFrameBytes": 12 * MIB, "maximumRequestBodyBytes": 256 * 1024,
    "maximumResponseBodyBytes": 8 * MIB, "maximumAssetBytes": 128 * MIB,
    "maximumPendingRequests": 16, "maximumRequests": 512,
    "requestDeadlineMilliseconds": 15000, "requestBodyRequired": True,
    "maximumTotalTransportBytes": 256 * MIB,
    "maximumDiagnosticBytes": MIB,
    "maximumSnapshotBytes": 8 * MIB, "maximumDatabaseBytes": 8 * MIB,
}
PRIVATE_PATH_KEYS = (
    "profileProposal", "endpointLedger", "sourceBinding", "runtimeAuthority",
    "admission", "attemptLedger", "scratchWindows", "toolchainBinding",
    "preservedBinding", "export", "runtimeRecord",
)
CONFIG_KEYS = {
    "schema", "candidateHead", *PRIVATE_PATH_KEYS, "profileProposalSha256",
    "scratchLinux", "dependencyRootLinux", "linuxNode", "nativePackages",
    "windowsRuntime", "profile",
}


class Refusal(ValueError):
    """The supplied files do not meet the source inspection contract."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Refusal(message)


def exact(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    require(isinstance(value, dict) and set(value) == keys, f"{label}: fields differ")
    return value


def digest(value: Any, label: str) -> str:
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None,
            f"{label}: expected a SHA-256 digest")
    return value


def plain_integer(value: Any, label: str, minimum: int = 0) -> int:
    require(type(value) is int and value >= minimum, f"{label}: invalid integer")
    return value


def relative_name(value: Any, label: str) -> str:
    require(isinstance(value, str) and value != "", f"{label}: empty path")
    parsed = PurePosixPath(value)
    require(not parsed.is_absolute() and parsed.as_posix() == value,
            f"{label}: expected a normalized relative POSIX path")
    require(all(part not in {".", ".."} for part in parsed.parts)
            and "\\" not in value and ":" not in value
            and all(ord(character) >= 32 for character in value),
            f"{label}: unsafe path")
    return value


def linux_path(value: Any, label: str) -> PurePosixPath:
    require(isinstance(value, str), f"{label}: expected a path")
    parsed = PurePosixPath(value)
    require(parsed.is_absolute() and len(parsed.parts) >= 3
            and parsed.as_posix() == value and ".." not in parsed.parts
            and re.fullmatch(r"/[A-Za-z0-9_./-]+", value) is not None,
            f"{label}: unsafe Linux path")
    return parsed


def no_link(path: Path) -> os.stat_result:
    result = path.lstat()
    require(not stat.S_ISLNK(result.st_mode)
            and not getattr(result, "st_file_attributes", 0) & 0x400,
            "link or reparse point refused")
    return result


def checked_path(root: Path, name: str, *, missing_leaf: bool = False) -> Path:
    relative_name(name, "bound path")
    path = root
    no_link(path)
    for index, part in enumerate(PurePosixPath(name).parts):
        path /= part
        if missing_leaf and index == len(PurePosixPath(name).parts) - 1 and not path.exists():
            require(not path.is_symlink(), "dangling link refused")
            return path
        no_link(path)
    require(path.resolve().is_relative_to(root), "bound path escaped the repository")
    return path


def read_regular(path: Path, limit: int) -> bytes:
    before = no_link(path)
    require(stat.S_ISREG(before.st_mode) and before.st_size <= limit,
            "input is not a bounded regular file")
    with path.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
                == (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns),
                "input changed before reading")
        raw = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    final = no_link(path)
    require(len(raw) == before.st_size and len(raw) <= limit
            and (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
                == (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
            and (final.st_dev, final.st_ino, final.st_size, final.st_mtime_ns)
                == (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns),
            "input changed while reading")
    return raw


def parse_json(raw: bytes) -> Any:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            require(key not in result, "duplicate JSON field")
            result[key] = value
        return result

    def invalid_constant(value: str) -> None:
        raise Refusal("nonfinite JSON number")

    return json.loads(raw.decode("utf-8"), object_pairs_hook=unique,
                      parse_constant=invalid_constant)


def stream_digest(path: Path, maximum: int = 512 * MIB) -> str:
    before = no_link(path)
    require(stat.S_ISREG(before.st_mode) and before.st_size <= maximum, "toolchain file limit exceeded")
    result = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino) == (opened.st_dev, opened.st_ino), "toolchain file replaced")
        while chunk := stream.read(MIB):
            size += len(chunk)
            require(size <= maximum, "toolchain file grew beyond its limit")
            result.update(chunk)
        after = os.fstat(stream.fileno())
    final = no_link(path)
    require(size == before.st_size
            and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
            == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
            == (final.st_dev, final.st_ino, final.st_size, final.st_mtime_ns),
            "toolchain file changed while hashing")
    return result.hexdigest()


def tree_summary(root: Path, *, allow_links: bool = False, maximum_bytes: int = 4 * 1024 * MIB,
                 maximum_entries: int = 100000) -> dict[str, Any]:
    require(root.absolute() == root.resolve(), "toolchain root has an alias")
    require(stat.S_ISDIR(no_link(root).st_mode), "toolchain root is not a directory")
    pending = [root]
    entries = []
    total = 0
    while pending:
        directory = pending.pop()
        with os.scandir(directory) as children:
            for child in children:
                require(len(entries) < maximum_entries, "toolchain entry limit exceeded")
                path = directory / child.name
                relative = path.relative_to(root).as_posix()
                relative_name(relative, "toolchain member")
                metadata = path.lstat()
                if stat.S_ISLNK(metadata.st_mode):
                    require(allow_links, "toolchain link refused")
                    target = os.readlink(path)
                    require(path.resolve(strict=False).is_relative_to(root), "dependency link escaped its root")
                    record = {"path": relative, "kind": "link", "target": target}
                else:
                    no_link(path)
                    if stat.S_ISDIR(metadata.st_mode):
                        pending.append(path)
                        record = {"path": relative, "kind": "directory"}
                    else:
                        require(stat.S_ISREG(metadata.st_mode), "special toolchain file refused")
                        total += metadata.st_size
                        require(total <= maximum_bytes, "toolchain byte limit exceeded")
                        record = {"path": relative, "kind": "file", "bytes": metadata.st_size,
                                  "sha256": stream_digest(path)}
                entries.append(record)
    canonical = json.dumps(sorted(entries, key=lambda item: item["path"]),
                           sort_keys=True, separators=(",", ":")).encode()
    return {"entries": len(entries), "bytes": total, "sha256": hashlib.sha256(canonical).hexdigest()}


def load_config(root: Path, name: str, expected_sha256: str) -> tuple[dict[str, Any], str]:
    digest(expected_sha256, "configuration digest")
    require(relative_name(name, "configuration").startswith(".tmp/05b/gui-"),
            "configuration must be a private GUI file")
    raw = read_regular(checked_path(root, name), MAX_CONFIG_BYTES)
    actual = hashlib.sha256(raw).hexdigest()
    require(actual == expected_sha256, "configuration digest differs")
    config = exact(parse_json(raw), CONFIG_KEYS, "configuration")
    require(config["schema"] == "vivary.05b-gui-proof-config/v1", "configuration schema differs")
    require(isinstance(config["candidateHead"], str)
            and re.fullmatch(r"[0-9a-f]{40}", config["candidateHead"]) is not None,
            "candidate commit is invalid")
    require(config["profile"] == PROFILE
            and all(type(value) is int for value in config["profile"].values()),
            "GUI profile differs")
    paths = []
    for key in PRIVATE_PATH_KEYS:
        value = relative_name(config[key], key)
        prefix = ".tmp/05b/" if key == "endpointLedger" else ".tmp/05b/gui-"
        require(value.startswith(prefix), f"{key}: private path differs")
        paths.append(value)
    require(len(set(paths)) == len(paths), "private paths overlap")
    require(config["endpointLedger"] == ".tmp/05b/attempts.jsonl", "endpoint ledger moved")
    require(config["attemptLedger"] == ".tmp/05b/gui-attempts.jsonl", "GUI attempt ledger moved")
    scratch = linux_path(config["scratchLinux"], "scratch")
    dependencies = linux_path(config["dependencyRootLinux"], "dependencies")
    require(scratch.name == "vivary-05b-gui-proof" and dependencies.name == "node_modules",
            "Linux ownership names differ")
    require(not scratch.is_relative_to(dependencies) and not dependencies.is_relative_to(scratch),
            "scratch and dependencies overlap")
    node = exact(config["linuxNode"], {"path", "bytes", "sha256"}, "Linux Node")
    require(linux_path(node["path"], "Node").name == "node", "Node executable name differs")
    plain_integer(node["bytes"], "Node size", 1)
    digest(node["sha256"], "Node digest")
    native = exact(config["nativePackages"],
                   {"corePackageJsonSha256", "toolkitPackageJsonSha256"}, "Native packages")
    for key, value in native.items():
        digest(value, key)
    runtime = exact(config["windowsRuntime"], {
        "node", "nodeVersion", "nodeSha256", "playwrightPackageJson", "playwrightVersion",
        "playwrightPackageJsonSha256", "playwrightCorePackageJson",
        "playwrightCorePackageJsonSha256", "chromium", "chromiumFileVersion", "chromiumSha256",
    }, "Windows runtime")
    for key, value in runtime.items():
        if key.endswith("Sha256"):
            digest(value, key)
        else:
            require(isinstance(value, str) and value and not any(ord(c) < 32 for c in value),
                    f"{key}: invalid text")
    require(runtime["nodeVersion"] == "24.19.0" and runtime["playwrightVersion"] == "1.62.1"
            and runtime["chromiumFileVersion"] == "151.0.7922.34", "Windows versions differ")
    proposal = read_regular(checked_path(root, config["profileProposal"]), MAX_CONFIG_BYTES)
    require(hashlib.sha256(proposal).hexdigest()
            == digest(config["profileProposalSha256"], "proposal digest"), "proposal changed")
    require(parse_json(proposal).get("authority") == "proposed-not-authorized",
            "the profile proposal cannot supply runtime authority")
    return config, actual


def source_inventory(root: Path) -> dict[str, dict[str, Any]]:
    """Read only the explicit app and harness projection, never repository internals."""
    names = set(SOURCE_FILES)
    visited = 0
    for directory in SOURCE_DIRECTORIES:
        parent = checked_path(root, directory, missing_leaf=True)
        if not parent.exists():
            require(directory.endswith(("/actions", "/public")), "required source directory missing")
            continue
        pending = [parent]
        while pending:
            current = pending.pop()
            require(stat.S_ISDIR(no_link(current).st_mode), "source directory changed")
            with os.scandir(current) as entries:
                for entry in entries:
                    visited += 1
                    require(visited <= MAX_FILES, "source metadata inventory limit exceeded")
                    lower = entry.name.lower()
                    require(lower not in FORBIDDEN_PARTS and not lower.startswith(".env.")
                            and not lower.endswith((".pem", ".key", ".p12", ".pfx", ".sqlite", ".db")),
                            "source projection contains excluded data")
                    path = current / entry.name
                    mode = no_link(path).st_mode
                    if stat.S_ISDIR(mode):
                        pending.append(path)
                    else:
                        require(stat.S_ISREG(mode), "special source file refused")
                        names.add(path.relative_to(root).as_posix())
    require(len(names) <= MAX_FILES, "source file count exceeded")
    result = {}
    total = 0
    for name in sorted(names):
        raw = read_regular(checked_path(root, name), MAX_SOURCE_FILE_BYTES)
        total += len(raw)
        require(total <= MAX_SOURCE_BYTES, "source byte limit exceeded")
        result[name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    return result


def proposed_binding(config: dict[str, Any], config_sha256: str,
                     sources: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {"schema": "vivary.05b-gui-source-binding/v1",
            "candidateHead": config["candidateHead"], "configSha256": config_sha256,
            "sources": sources}


def verify_binding(root: Path, config: dict[str, Any], expected: dict[str, Any]) -> str:
    raw = read_regular(checked_path(root, config["sourceBinding"]), MAX_BINDING_BYTES)
    require(parse_json(raw) == expected, "reviewed source binding differs from current files")
    return hashlib.sha256(raw).hexdigest()


def ledger_state(raw: bytes) -> dict[str, Any]:
    """Validate a future append-only GUI journal without writing or reserving time.

    A started allocation is consumed even when its finish event is absent. A
    future dispatcher must append and fsync under an exclusive lock before work.
    One journal permits one run, one build, and one browser, including failures.
    """
    require(len(raw) <= MAX_LEDGER_BYTES, "GUI ledger byte limit exceeded")
    require(not raw or raw.endswith(b"\n"), "partial GUI ledger event")
    lines = raw.splitlines()
    require(len(lines) <= 6 and all(lines), "GUI ledger event count differs")
    if not lines:
        return {"started": False, "allocatedSeconds": 0, "buildConsumed": False,
                "browserConsumed": False, "completed": False}
    records = [parse_json(line) for line in lines]
    start = exact(records[0], {
        "event", "runId", "startedUnixSeconds", "deadlineUnixSeconds",
        "allocatedSeconds", "configSha256", "sourceBindingSha256", "authoritySha256",
    }, "GUI run allocation")
    require(start["event"] == "run-start" and start["allocatedSeconds"] == 1200,
            "GUI run allocation differs")
    require(isinstance(start["runId"], str)
            and re.fullmatch(r"[a-f0-9]{12}", start["runId"]) is not None, "GUI run ID differs")
    for key in ("configSha256", "sourceBindingSha256", "authoritySha256"):
        digest(start[key], key)
    first = start["startedUnixSeconds"]
    deadline = start["deadlineUnixSeconds"]
    require(type(first) in (int, float) and math.isfinite(first) and first > 0,
            "GUI start time is invalid")
    require(type(deadline) in (int, float) and math.isfinite(deadline)
            and deadline == first + 1200, "cumulative GUI deadline differs")
    phases: dict[str, bool | None] = {}
    active = None
    previous = first
    completed = False
    for record in records[1:]:
        require(not completed, "events follow GUI run completion")
        event = record.get("event") if isinstance(record, dict) else None
        fields = {"event", "atUnixSeconds"}
        if event == "phase-start":
            exact(record, fields | {"phase", "allocatedSeconds"}, "phase allocation")
            phase = record["phase"]
            require(phase in ("build", "browser") and phase not in phases and active is None,
                    "GUI phase was retried or overlapped")
            require(phase == "build" or phases.get("build") is True,
                    "browser started without successful build cleanup")
            require(record["allocatedSeconds"] == (600 if phase == "build" else 300),
                    "GUI phase allocation differs")
            phases[phase] = None
            active = phase
        elif event == "phase-finish":
            exact(record, fields | {"phase", "exit", "cleanupAccepted"}, "phase completion")
            require(record["phase"] == active and active is not None,
                    "completion has no active phase")
            require(type(record["exit"]) is int and type(record["cleanupAccepted"]) is bool,
                    "phase completion fields differ")
            phases[active] = record["exit"] == 0 and record["cleanupAccepted"]
            active = None
        elif event == "run-finish":
            exact(record, fields | {"exportSha256", "cleanupAccepted"}, "GUI completion")
            require(active is None and type(record["cleanupAccepted"]) is bool,
                    "GUI completion has active or unknown cleanup")
            digest(record["exportSha256"], "export digest")
            completed = True
        else:
            raise Refusal("unknown GUI ledger event")
        at = record["atUnixSeconds"]
        require(type(at) in (int, float) and math.isfinite(at) and previous <= at <= deadline,
                "GUI event exceeds the cumulative deadline or reverses time")
        previous = at
    return {"started": True, "allocatedSeconds": 1200, "runId": start["runId"],
            "deadlineUnixSeconds": deadline, "buildConsumed": "build" in phases,
            "browserConsumed": "browser" in phases, "activePhase": active,
            "completed": completed}


def containment_plan(config: dict[str, Any], run_id: str) -> dict[str, Any]:
    require(re.fullmatch(r"[a-f0-9]{12}", run_id) is not None, "invalid proposed run ID")
    scratch = PurePosixPath(config["scratchLinux"])
    deps = PurePosixPath(config["dependencyRootLinux"])
    app = scratch / "app"
    node = config["linuxNode"]["path"]
    cli = str(deps / "@agent-native/core/bin/agent-native.js")
    common_environment = {
        "PATH": str(PurePosixPath(node).parent) + ":/usr/bin:/bin",
        "HOME": str(scratch / "home"), "TMPDIR": str(scratch / "tmp"),
        "XDG_CACHE_HOME": str(scratch / "cache"),
        "XDG_CONFIG_HOME": str(scratch / "config"),
        "NODE_OPTIONS": "--max-old-space-size=512",
        "ROLLDOWN_WORKER_THREADS": "1", "NODE_ENV": "production",
        "DO_NOT_TRACK": "1",
        "AGENT_MODE": "production", "AGENT_NATIVE_DISABLE_RECURRING_JOBS": "true",
        "AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS": "true",
    }
    phases = {}
    for phase in ("build", "browser"):
        unit = f"vivary-05b-gui-{phase}-{run_id}.service"
        writable = [scratch / name for name in ("home", "tmp", "cache", "config", f"evidence/{phase}")]
        if phase == "build":
            writable += [app / name for name in (
                ".cache/vite", ".generated", ".react-router", ".agent-native/nitro-preset",
                "build", ".output",
            )]
        properties = {
            "MemoryMax": str(PROFILE[f"{phase}LinuxMiB"] * MIB), "MemorySwapMax": "0",
            "TasksMax": "64", "CPUQuota": "100%",
            "RuntimeMaxSec": str(PROFILE[f"{phase}Seconds"]), "TimeoutStopSec": "5",
            "KillMode": "control-group", "PrivateNetwork": "yes", "PrivateTmp": "yes",
            "PrivateMounts": "yes", "NoNewPrivileges": "yes", "ProtectSystem": "strict",
            "ProtectHome": "tmpfs", "InaccessiblePaths": ["/mnt", "/media", "/run/user"],
            "ProtectControlGroups": "yes", "ProtectKernelTunables": "yes",
            "ProtectKernelModules": "yes", "RestrictSUIDSGID": "yes",
            "CapabilityBoundingSet": "", "UMask": "0077",
            "RestrictAddressFamilies": "AF_UNIX", "ReadOnlyPaths": [str(app), str(deps)],
            "BindReadOnlyPaths": [str(scratch), str(deps), node,
                                  str(deps) + ":" + str(app / "node_modules")],
            "ReadWritePaths": [str(path) for path in writable],
        }
        private_mounts = []
        if phase == "build":
            private_mounts = [
                {"source": str(scratch / "cache/vite-config"), "destination": str(deps / ".vite-temp")},
                {"source": str(scratch / "cache/nitro"), "destination": str(deps / ".nitro")},
            ]
        phases[phase] = {
            "unit": unit, "user": "agent", "cwd": str(app), "properties": properties,
            "privateWritableBindMounts": private_mounts,
            "environment": dict(common_environment),
            "windowsAggregateMiB": PROFILE[f"{phase}WindowsMiB"],
            "windowsJobMustIncludeController": True,
            "windowsCpuEquivalent": 1, "windowsKillOnJobClose": True,
            "cgroup": f"/sys/fs/cgroup/system.slice/{unit}",
        }
    phases["build"]["commands"] = [
        {"argv": [node, cli, "doctor"], "deadline": "remaining build allocation"},
        {"argv": [str(deps / ".bin/react-router"), "typegen"], "deadline": "remaining build allocation"},
        {"argv": [node, cli, "typecheck", "--singleThreaded"], "deadline": "remaining build allocation"},
        {"argv": [node, cli, "build"], "deadline": "min(300 seconds, remaining build allocation)"},
    ]
    phases["browser"]["environment"].update({
        "AGENT_ENGINE": "vivary-proof",
        "DATABASE_URL": "file:" + str(scratch / "evidence/browser/native-chat.sqlite"),
    })
    phases["browser"]["backendArgv"] = [
        node, str(scratch / "harness/gui_backend.mjs"), str(app),
        str(scratch / "evidence/browser"), phases["browser"]["unit"],
        config["linuxNode"]["sha256"], str(config["linuxNode"]["bytes"]),
    ]
    return {"schema": "vivary.05b-gui-containment/v1",
            "phases": phases, "profile": PROFILE, "transport": TRANSPORT,
            "sourceTransfer": {"maximumFiles": MAX_FILES, "maximumBytes": MAX_SOURCE_BYTES,
                               "maximumFileBytes": MAX_SOURCE_FILE_BYTES, "readOnlyProjection": True},
            "browser": {"sandbox": True, "freshProfile": True, "debug": "pw:browser",
                        "evidenceDirectoryMustNotExist": True, "bindAddress": "127.0.0.1",
                        "controlPath": "/_proof/control", "controlTokenBytes": 32}}


def write_json_exclusive(path: Path, value: Any) -> None:
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(value, sort_keys=True, indent=2) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def host_resources(root: Path) -> dict[str, int]:
    require(sys.platform == "win32", "host resource observation requires Windows")

    class Memory(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [
            (name, ctypes.c_ulonglong) for name in ("total", "available", "pageTotal", "pageAvailable",
                                                  "virtualTotal", "virtualAvailable", "extended")]

    value = Memory()
    value.length = ctypes.sizeof(value)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(value)):
        raise OSError("Windows memory observation failed")
    return {"ram": value.available, "commit": value.pageAvailable, "disk": shutil.disk_usage(root).free}


class WindowsJob:
    """Contain this controller and every inherited Windows child in one CPU."""

    def __init__(self):
        from ctypes import wintypes as w

        class Basic(ctypes.Structure):
            _fields_ = [("processTime", ctypes.c_longlong), ("jobTime", ctypes.c_longlong),
                        ("flags", w.DWORD), ("minimum", ctypes.c_size_t), ("maximum", ctypes.c_size_t),
                        ("active", w.DWORD), ("affinity", ctypes.c_size_t),
                        ("priority", w.DWORD), ("scheduling", w.DWORD)]

        class Extended(ctypes.Structure):
            _fields_ = [("basic", Basic), ("io", ctypes.c_ulonglong * 6),
                        ("processMemory", ctypes.c_size_t), ("jobMemory", ctypes.c_size_t),
                        ("peakProcess", ctypes.c_size_t), ("peakJob", ctypes.c_size_t)]

        self.Extended = Extended
        self.api = ctypes.WinDLL("kernel32", use_last_error=True)
        self.api.CreateJobObjectW.argtypes = [w.LPVOID, w.LPCWSTR]
        self.api.CreateJobObjectW.restype = w.HANDLE
        self.api.GetCurrentProcess.restype = w.HANDLE
        self.api.SetInformationJobObject.argtypes = [w.HANDLE, w.INT, w.LPVOID, w.DWORD]
        self.api.QueryInformationJobObject.argtypes = [w.HANDLE, w.INT, w.LPVOID, w.DWORD, w.LPVOID]
        self.api.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
        self.api.GetProcessAffinityMask.argtypes = [w.HANDLE, w.LPVOID, w.LPVOID]
        current = ctypes.c_size_t()
        system = ctypes.c_size_t()
        require(bool(self.api.GetProcessAffinityMask(self.api.GetCurrentProcess(), ctypes.byref(current),
                                                    ctypes.byref(system))) and current.value > 0,
                "Windows CPU affinity observation failed")
        self.affinity = current.value & -current.value
        self.handle = self.api.CreateJobObjectW(None, None)
        require(bool(self.handle), "Windows Job creation failed")
        self.phase = None
        self.set_phase("build")
        require(bool(self.api.AssignProcessToJobObject(self.handle, self.api.GetCurrentProcess())),
                "Windows controller Job assignment failed")

    def set_phase(self, phase: str) -> dict[str, Any]:
        require(phase in ("build", "browser"), "unknown Windows Job phase")
        if self.phase is not None:
            require(self.phase == "build" and phase == "browser", "Windows Job phase retried")
            require(self.process_ids() == {os.getpid()}, "Windows children remain before phase transition")
        limits = self.Extended()
        limits.basic.flags = 0x2000 | 0x200 | 0x10
        limits.basic.affinity = self.affinity
        limits.jobMemory = PROFILE[phase + "WindowsMiB"] * MIB
        require(bool(self.api.SetInformationJobObject(self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits))),
                "Windows Job limits could not be set")
        actual = self.Extended()
        require(bool(self.api.QueryInformationJobObject(self.handle, 9, ctypes.byref(actual),
                                                       ctypes.sizeof(actual), None)), "Windows Job limits unavailable")
        require(actual.basic.flags == limits.basic.flags and actual.basic.affinity == self.affinity
                and actual.jobMemory == limits.jobMemory, "Windows Job limits differ")
        self.phase = phase
        return {"phase": phase, "aggregateMemoryBytes": actual.jobMemory,
                "cpuAffinity": actual.basic.affinity, "killOnClose": True, "controllerIncluded": True}

    def process_ids(self) -> set[int]:
        data = (ctypes.c_size_t * 1026)()
        require(bool(self.api.QueryInformationJobObject(self.handle, 3, ctypes.byref(data), ctypes.sizeof(data), None)),
                "Windows Job process inventory failed")
        header = ctypes.cast(ctypes.byref(data), ctypes.POINTER(ctypes.c_ulong))
        require(header[0] == header[1] and header[1] <= 1024, "Windows Job process inventory is incomplete")
        offset = 2 * ctypes.sizeof(ctypes.c_ulong)
        values = ctypes.cast(ctypes.addressof(data) + offset, ctypes.POINTER(ctypes.c_size_t))
        return {values[index] for index in range(header[1])}

    def terminate_children(self, seconds=5):
        from ctypes import wintypes as w
        self.api.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
        self.api.OpenProcess.restype = w.HANDLE
        self.api.IsProcessInJob.argtypes = [w.HANDLE, w.HANDLE, ctypes.POINTER(w.BOOL)]
        self.api.TerminateProcess.argtypes = [w.HANDLE, w.UINT]
        self.api.CloseHandle.argtypes = [w.HANDLE]
        deadline = time.monotonic() + max(0, seconds)
        for identity in self.process_ids() - {os.getpid()}:
            handle = self.api.OpenProcess(0x0001 | 0x1000 | 0x00100000, False, identity)
            if not handle:
                require(ctypes.get_last_error() == 87, "owned Windows child could not be opened")
                continue
            try:
                member = w.BOOL()
                require(bool(self.api.IsProcessInJob(handle, self.handle, ctypes.byref(member))) and member.value,
                        "Windows child no longer belongs to this Job")
                require(bool(self.api.TerminateProcess(handle, 91)), "owned Windows child termination failed")
            finally:
                self.api.CloseHandle(handle)
        while self.process_ids() != {os.getpid()} and time.monotonic() < deadline:
            time.sleep(0.01)
        require(self.process_ids() == {os.getpid()}, "owned Windows children remain after bounded termination")


class Journal:
    def __init__(self, root: Path, name: str):
        self.path = checked_path(root, name, missing_leaf=True)
        self.lock_path = checked_path(root, name + ".lock", missing_leaf=True)
        self.lock = None

    def __enter__(self):
        import msvcrt
        self.lock = self.lock_path.open("a+b")
        if self.lock.seek(0, os.SEEK_END) == 0:
            self.lock.write(b"0")
            self.lock.flush()
        self.lock.seek(0)
        msvcrt.locking(self.lock.fileno(), msvcrt.LK_NBLCK, 1)
        raw = read_regular(self.path, MAX_LEDGER_BYTES) if self.path.exists() else b""
        require(not ledger_state(raw)["started"], "the GUI allocation is already consumed")
        return self

    def append(self, value: dict[str, Any]) -> None:
        require(self.lock is not None, "GUI journal is not locked")
        old = read_regular(self.path, MAX_LEDGER_BYTES) if self.path.exists() else b""
        raw = json.dumps(value, sort_keys=True).encode() + b"\n"
        ledger_state(old + raw)
        with self.path.open("ab") as stream:
            require(stream.tell() == len(old), "GUI journal changed outside its owner")
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())

    def __exit__(self, *ignored):
        if self.lock is not None:
            import msvcrt
            self.lock.seek(0)
            msvcrt.locking(self.lock.fileno(), msvcrt.LK_UNLCK, 1)
            self.lock.close()


def preserved_inputs(root: Path, config: dict[str, Any]) -> str:
    raw = read_regular(checked_path(root, config["preservedBinding"]), MAX_BINDING_BYTES)
    value = exact(parse_json(raw), {"schema", "files", "exhausted20jLedger", "unused06eDecisionRecord"}, "preserved inputs")
    require(value["schema"] == "vivary.05b-gui-preserved-binding/v1" and isinstance(value["files"], dict),
            "preserved binding schema differs")
    required = {config["endpointLedger"], ".tmp/05b/attempt-1.json",
                f"{FIXTURE}/run_habitat.py", "docs/product/multi-project/fixtures/20j/run_habitat.py"}
    require(relative_name(value["exhausted20jLedger"], "exhausted ledger").startswith(".tmp/20j/"),
            "preserved exhausted ledger owner differs")
    require(value["unused06eDecisionRecord"] == "docs/product/multi-project/packets/06e-project-selection.md",
            "preserved decision record owner differs")
    required.update((value["exhausted20jLedger"], value["unused06eDecisionRecord"]))
    require(set(value["files"]) == required, "preserved budget bindings are incomplete")
    for name, expected in value["files"].items():
        require(stream_digest(checked_path(root, name)) == digest(expected, name), "a preserved budget or guard changed")
    endpoint = read_regular(checked_path(root, config["endpointLedger"]), MAX_LEDGER_BYTES)
    rows = [parse_json(line) for line in endpoint.splitlines() if line]
    require(len(rows) == 1 and rows[0]["attempt"] == 1 and rows[0]["allocatedSeconds"] == 60,
            "endpoint allocation no longer matches the retained proof")
    receipt = parse_json(read_regular(checked_path(root, ".tmp/05b/attempt-1.json"), MAX_BINDING_BYTES))
    require(receipt["exit"] == 0 and receipt["cleanupAccepted"] is True
            and round(receipt["elapsed"], 3) == 20.322, "retained endpoint receipt differs")
    return hashlib.sha256(raw).hexdigest()


def runtime_authority(root, config, expected, bindings):
    raw = read_regular(checked_path(root, config["runtimeAuthority"]), MAX_CONFIG_BYTES)
    require(hashlib.sha256(raw).hexdigest() == digest(expected, "runtime authority digest"), "runtime authority changed")
    value = exact(parse_json(raw), {"schema", "approvedBy", "decisionReference", "approved", "cleanup",
                   "createdUnixSeconds", "expiresUnixSeconds", "configSha256", "sourceBindingSha256",
                   "toolchainBindingSha256", "preservedBindingSha256"}, "runtime authority")
    require(value["schema"] == "vivary.05b-gui-runtime-authority/v1" and value["approvedBy"] == "Jeff"
            and value["approved"] is True and value["cleanup"] == "process-stop-and-export-only",
            "GUI authority does not cover this non-destructive controller")
    require(isinstance(value["decisionReference"], str) and 0 < len(value["decisionReference"]) <= 4096,
            "GUI authority has no explicit decision reference")
    now = time.time()
    require(type(value["createdUnixSeconds"]) in (int, float) and type(value["expiresUnixSeconds"]) in (int, float)
            and value["createdUnixSeconds"] <= now < value["expiresUnixSeconds"], "GUI authority is not current")
    for key, expected_hash in bindings.items():
        require(value[key] == expected_hash, "runtime authority binds different inputs")
    return raw


def admission(root, config, authority_hash):
    value = parse_json(read_regular(checked_path(root, config["admission"]), MAX_CONFIG_BYTES))
    exact(value, {"schema", "capturedUnixSeconds", "authoritySha256", "fiveHourUsedPercent",
                  "weeklyUsedPercent", "usageEvidence", "activeHeavyJobs"}, "resource admission")
    require(value["schema"] == "vivary.05b-gui-admission/v1"
            and value["authoritySha256"] == authority_hash, "admission binding differs")
    require(type(value["capturedUnixSeconds"]) in (int, float)
            and 0 <= time.time() - value["capturedUnixSeconds"] <= 30, "admission is stale")
    require(value["activeHeavyJobs"] == [] and isinstance(value["usageEvidence"], str)
            and value["usageEvidence"], "heavy-job or usage evidence is missing")
    windows = [value["fiveHourUsedPercent"], value["weeklyUsedPercent"]]
    require(any(item is not None for item in windows), "included usage is unknown")
    for item in windows:
        require(item is None or type(item) in (int, float) and math.isfinite(item) and 0 <= item < 95,
                "included usage blocks dispatch")
    reading = host_resources(root)
    require(reading["ram"] >= 4096 * MIB and reading["commit"] >= 4096 * MIB
            and reading["disk"] >= 10 * 1024 * MIB, "fresh build admission refused")
    return {"usage": value, "host": reading}


class BoundedRpc:
    """Exchange bounded frames with an already contained backend process."""

    def __init__(self, process, check, diagnostic, fail):
        self.process = process
        self.check = check
        self.diagnostic = diagnostic
        self.fail = fail
        self.lock = threading.Lock()
        self.outgoing = queue.Queue(maxsize=TRANSPORT["maximumPendingRequests"])
        self.pending = {0: {"event": threading.Event(), "reply": None}}
        self.total_bytes = 0
        self.ordinal = 0
        self.closed = False
        self.records = []
        self.reader = threading.Thread(target=self.read_replies, daemon=True)
        self.errors = threading.Thread(target=self.read_diagnostics, daemon=True)
        self.writer = threading.Thread(target=self.write_frames, daemon=True)
        self.reader.start()
        self.errors.start()
        self.writer.start()

    def account(self, size):
        with self.lock:
            self.total_bytes += size
            require(self.total_bytes <= TRANSPORT["maximumTotalTransportBytes"], "RPC aggregate byte cap exceeded")

    def read_replies(self):
        try:
            while True:
                raw = self.process.stdout.readline(TRANSPORT["maximumFrameBytes"] + 1)
                if not raw:
                    require(self.closed, "backend stdout closed before acknowledgement")
                    return
                require(raw.endswith(b"\n") and len(raw) <= TRANSPORT["maximumFrameBytes"], "invalid RPC frame size")
                self.account(len(raw))
                reply = parse_json(raw)
                require(isinstance(reply, dict) and type(reply.get("id")) is int, "RPC response identity is missing")
                with self.lock:
                    waiter = self.pending.get(reply["id"])
                    require(waiter is not None and waiter["reply"] is None, "unsolicited or duplicate RPC response")
                    waiter["reply"] = reply
                    if reply.get("closing") is True:
                        self.closed = True
                    waiter["event"].set()
        except BaseException as error:
            self.fail("backend RPC: " + str(error))

    def read_diagnostics(self):
        try:
            while chunk := self.process.stderr.read(65536):
                self.diagnostic(chunk)
        except BaseException as error:
            self.fail("backend diagnostics: " + str(error))

    def write_frames(self):
        try:
            while True:
                raw = self.outgoing.get()
                if raw is None:
                    self.process.stdin.close()
                    return
                self.process.stdin.write(raw)
                self.process.stdin.flush()
        except BaseException as error:
            self.fail("backend stdin: " + str(error))

    def wait(self, identity, timeout):
        deadline = time.monotonic() + timeout
        with self.lock:
            waiter = self.pending[identity]
        while not waiter["event"].wait(0.05):
            self.check()
            require(time.monotonic() < deadline, "RPC response deadline exceeded")
        with self.lock:
            self.pending.pop(identity)
        reply = waiter["reply"]
        require("error" not in reply, "backend refused an RPC request")
        return reply

    def ready(self, expected_unit):
        reply = self.wait(0, 30)
        require(reply.get("ready") is True and reply.get("limits") == {
            "frameBytes": TRANSPORT["maximumFrameBytes"], "requestBodyBytes": TRANSPORT["maximumRequestBodyBytes"],
            "responseBodyBytes": TRANSPORT["maximumResponseBodyBytes"], "assetBytes": TRANSPORT["maximumAssetBytes"],
        }, "backend transport limits differ")
        boundary = reply.get("boundary", {})
        require(boundary.get("cgroupMembership") == "0::/system.slice/" + expected_unit
                and boundary.get("networkInterfaces") == ["lo"]
                and boundary.get("cgroupBoundary") == {"cpu.max": "100000 100000", "memory.max": str(512 * MIB),
                                                       "memory.swap.max": "0", "pids.max": "64"},
                "backend boundary report differs")
        return reply

    def call(self, message, timeout=15):
        self.check()
        require(isinstance(message, dict) and "id" not in message, "caller cannot supply an RPC identity")
        with self.lock:
            require(not self.closed and len(self.pending) < TRANSPORT["maximumPendingRequests"], "RPC concurrency cap exceeded")
            self.ordinal += 1
            require(self.ordinal <= TRANSPORT["maximumRequests"], "RPC request cap exceeded")
            identity = self.ordinal
            self.pending[identity] = {"event": threading.Event(), "reply": None}
        raw = json.dumps({"id": identity, **message}, separators=(",", ":")).encode() + b"\n"
        require(len(raw) <= TRANSPORT["maximumFrameBytes"], "outgoing RPC frame exceeds its cap")
        self.account(len(raw))
        self.outgoing.put_nowait(raw)
        reply = self.wait(identity, timeout)
        self.records.append({"id": identity, "action": message.get("action"), "requestBytes": len(raw),
                             "requestSha256": hashlib.sha256(raw).hexdigest()})
        return reply

    def close(self):
        reply = self.call({"action": "close"})
        require(reply.get("closing") is True, "backend close was not acknowledged")
        self.outgoing.put_nowait(None)
        self.reader.join(timeout=5)
        self.errors.join(timeout=5)
        self.writer.join(timeout=5)
        require(not self.reader.is_alive() and not self.errors.is_alive() and not self.writer.is_alive(),
                "backend streams remain after close")
        return reply


class LoopbackProxy:
    """Expose the isolated backend only through bounded, token-checked transport."""

    def __init__(self, rpc, check, fail, launch_verified):
        self.rpc = rpc
        self.check = check
        self.fail = fail
        self.launch_verified = launch_verified
        self.token = secrets.token_hex(32)
        self.slots = threading.BoundedSemaphore(TRANSPORT["maximumPendingRequests"])
        self.requests = 0
        self.lock = threading.Lock()
        proxy = self

        class Server(ThreadingHTTPServer):
            daemon_threads = True
            request_queue_size = TRANSPORT["maximumPendingRequests"]

            def __init__(self, *arguments):
                self.socket_slots = threading.BoundedSemaphore(TRANSPORT["maximumPendingRequests"])
                self.connection_lock = threading.Lock()
                self.connections = set()
                self.workers = set()
                super().__init__(*arguments)

            def process_request(self, request, client_address):
                if not self.socket_slots.acquire(blocking=False):
                    proxy.fail("HTTP connection worker cap exceeded")
                    self.shutdown_request(request)
                    return
                with self.connection_lock:
                    self.connections.add(request)
                try:
                    request.settimeout(15)
                    super().process_request(request, client_address)
                except BaseException:
                    with self.connection_lock:
                        self.connections.discard(request)
                    self.socket_slots.release()
                    self.shutdown_request(request)
                    raise

            def process_request_thread(self, request, client_address):
                with self.connection_lock:
                    self.workers.add(threading.current_thread())
                try:
                    super().process_request_thread(request, client_address)
                finally:
                    with self.connection_lock:
                        self.connections.discard(request)
                        self.workers.discard(threading.current_thread())
                    self.socket_slots.release()

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.0"

            def log_message(self, *ignored):
                pass

            def handle_one_request(self):
                self.connection.settimeout(15)
                super().handle_one_request()

            def respond(self, status, body, headers=None):
                require(100 <= status <= 599 and len(body) <= TRANSPORT["maximumResponseBodyBytes"], "HTTP response cap exceeded")
                self.send_response(status)
                for name, value in (headers or {}).items():
                    require(isinstance(name, str) and isinstance(value, str)
                            and re.fullmatch(r"[A-Za-z0-9-]+", name) is not None
                            and "\r" not in value and "\n" not in value, "unsafe upstream response header")
                    if name.lower() not in {"connection", "content-length", "transfer-encoding", "upgrade"}:
                        self.send_header(name, value)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Connection", "close")
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)

            def dispatch(self):
                if not proxy.slots.acquire(blocking=False):
                    proxy.fail("HTTP proof concurrency cap exceeded")
                    self.respond(503, b"Proof concurrency cap exceeded")
                    return
                try:
                    proxy.check()
                    with proxy.lock:
                        proxy.requests += 1
                        require(proxy.requests <= TRANSPORT["maximumRequests"], "HTTP request cap exceeded")
                    require(self.client_address[0] == "127.0.0.1", "non-loopback client refused")
                    require(self.headers.get_all("Host") == [proxy.authority], "unexpected HTTP authority")
                    require(self.headers.get("Origin") in (None, proxy.base_url), "external HTTP origin refused")
                    require(self.headers.get("Transfer-Encoding") is None, "chunked request bodies are not accepted")
                    require(sum(len(name) + len(value) for name, value in self.headers.items()) <= 32768, "HTTP header cap exceeded")
                    lengths = self.headers.get_all("Content-Length") or ["0"]
                    require(len(lengths) == 1 and re.fullmatch(r"[0-9]+", lengths[0]) is not None, "invalid request body length")
                    length = int(lengths[0])
                    require(length <= TRANSPORT["maximumRequestBodyBytes"], "HTTP body cap exceeded")
                    body = self.rfile.read(length)
                    require(len(body) == length, "truncated HTTP body")
                    url = urlsplit(self.path)
                    decoded = unquote(url.path)
                    require(not url.scheme and not url.netloc and not url.fragment and self.path.startswith("/")
                            and not self.path.startswith("//") and "\\" not in decoded
                            and ".." not in decoded.split("/") and all(ord(c) >= 32 for c in self.path + decoded),
                            "external or unsafe HTTP path refused")
                    if url.path == "/_proof/control":
                        require(self.command == "POST" and not url.query, "invalid proof control request")
                        require(hmac.compare_digest(self.headers.get("x-vivary-proof-token", ""), proxy.token), "invalid proof control token")
                        require(proxy.launch_verified(), "actual Chromium sandbox flags are not verified")
                        message = parse_json(body)
                        require(isinstance(message, dict) and message.get("action") in {
                            "identities", "delays", "title-mode", "expect", "snapshot"}, "unsupported proof control action")
                        reply = proxy.rpc.call(message)
                        encoded = json.dumps({key: value for key, value in reply.items() if key != "id"}).encode()
                        self.respond(200, encoded, {"Content-Type": "application/json"})
                    else:
                        require(url.path in {"/", "/chat", "/workbench", "/favicon.ico"}
                                or url.path.startswith(("/assets/", "/_agent-native/")), "unexpected proof destination")
                        require(self.command in {"GET", "HEAD", "POST", "PUT"}, "unsupported proof method")
                        require(self.command not in {"GET", "HEAD"} or length == 0, "read request has a body")
                        headers = {name.lower(): value for name, value in self.headers.items()
                                   if name.lower() not in {"host", "connection", "content-length", "transfer-encoding", "upgrade"}}
                        reply = proxy.rpc.call({"action": "request", "url": proxy.base_url + self.path,
                                                "method": self.command, "headers": headers,
                                                "body": base64.b64encode(body).decode("ascii")})
                        require(type(reply.get("status")) is int and isinstance(reply.get("headers"), dict)
                                and isinstance(reply.get("body"), str), "invalid backend HTTP response")
                        require(sum(len(str(key)) + len(str(value)) for key, value in reply["headers"].items()) <= 32768,
                                "upstream header cap exceeded")
                        self.respond(reply["status"], base64.b64decode(reply["body"], validate=True), reply["headers"])
                except BaseException as error:
                    proxy.fail("loopback proxy: " + str(error))
                    try:
                        self.respond(502, b"Bounded proof transport refused the request")
                    except OSError:
                        pass
                finally:
                    proxy.slots.release()

            do_GET = dispatch
            do_HEAD = dispatch
            do_POST = dispatch
            do_PUT = dispatch

        self.server = Server(("127.0.0.1", 0), Handler)
        self.authority = "127.0.0.1:" + str(self.server.server_address[1])
        self.base_url = "http://" + self.authority
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)

    def start(self):
        self.thread.start()

    def close(self):
        self.server.shutdown()
        with self.server.connection_lock:
            connections = list(self.server.connections)
            workers = list(self.server.workers)
        for connection in connections:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            connection.close()
        self.server.server_close()
        deadline = time.monotonic() + 5
        for worker in [self.thread, *workers]:
            worker.join(timeout=max(0, deadline - time.monotonic()))
        require(not self.thread.is_alive() and all(not worker.is_alive() for worker in workers),
                "loopback proxy did not stop")
        with self.server.connection_lock:
            require(not self.server.connections and not self.server.workers, "an admitted HTTP worker remains")




class Observer:
    def __init__(self, root: Path, scratch: Path, deadline_seconds: int = 1200):
        self.root = root
        self.scratch = scratch
        self.started = time.monotonic()
        self.deadline = self.started + deadline_seconds
        self.failure = None
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.samples = []
        self.diagnostic_bytes = 0
        self.phase = None
        self.phase_started = None
        self.phase_elapsed = 0.0
        self.heartbeat = scratch / "heartbeat-dir/heartbeat"
        self.heartbeat.parent.mkdir()
        self.tick()
        self.thread = threading.Thread(target=self.observe, daemon=True)
        self.thread.start()

    def fail(self, message):
        with self.lock:
            if self.failure is None:
                self.failure = str(message)[:4096]

    def check(self):
        require(self.failure is None, "GUI observer refused: " + str(self.failure))
        require(time.monotonic() < self.deadline, "aggregate GUI deadline exceeded")

    def tick(self):
        temporary = self.heartbeat.with_suffix(".next")
        with temporary.open("w", encoding="ascii") as stream:
            stream.write(str(time.time()) + "\n")
            stream.flush()
        os.replace(temporary, self.heartbeat)

    def observe(self):
        previous = time.monotonic()
        while not self.stop.wait(0.25):
            try:
                now = time.monotonic()
                require(self.failure is None, "the owner has already failed")
                require(now - previous <= 1, "Windows observation gap exceeded")
                reading = host_resources(self.root)
                require(reading["ram"] >= 1536 * MIB, "host reserve breached")
                require(now < self.deadline, "aggregate GUI deadline exceeded")
                active_elapsed = now - self.phase_started if self.phase_started is not None else 0
                overhead = now - self.started - self.phase_elapsed - active_elapsed
                require(overhead <= 300, "binding, transfer, export, and cleanup allocation exceeded")
                if self.phase is not None:
                    require(active_elapsed <= PROFILE[self.phase + "Seconds"], "GUI phase deadline exceeded")
                require(len(self.samples) < 5000, "resource observation sample cap exceeded")
                self.samples.append({"elapsedSeconds": now - self.started, "phase": self.phase, **reading})
                self.tick()
                previous = now
            except BaseException as error:
                self.fail(error)
                return

    def begin(self, phase):
        self.check()
        require(self.phase is None, "GUI phases overlap")
        reading = host_resources(self.root)
        require(reading["ram"] >= PROFILE[phase + "WarmRamMiB"] * MIB
                and reading["commit"] >= 4096 * MIB and reading["disk"] >= 10 * 1024 * MIB,
                "fresh phase admission refused")
        self.phase_started = time.monotonic()
        self.phase = phase
        return reading

    def end(self):
        if self.phase_started is not None:
            self.phase_elapsed += time.monotonic() - self.phase_started
        self.phase = None
        self.phase_started = None

    def diagnostics(self, chunk):
        with self.lock:
            self.diagnostic_bytes += len(chunk)
            require(self.diagnostic_bytes <= MIB, "command diagnostics exceeded one MiB")

    def finish(self):
        stop = getattr(self, "stop", None)
        if stop is not None:
            stop.set()
        thread = getattr(self, "thread", None)
        if thread is not None and thread.ident is not None:
            thread.join(timeout=1)
            require(not thread.is_alive(), "resource observer did not stop")


class ProcessOwner:
    def __init__(self, observer=None):
        self.observer = observer
        self.processes = []
        self.sequence = 0
        self.stderr_hook = None

    def spawn(self, command, *, environment=None):
        if self.observer:
            self.observer.check()
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   env=environment, creationflags=0x08000000)
        self.processes.append(process)
        if self.observer:
            with (self.observer.scratch / "owned-processes.jsonl").open("ab") as journal:
                journal.write(json.dumps({"pid": process.pid, "command": command, "startedUnixSeconds": time.time()}).encode() + b"\n")
                journal.flush()
                os.fsync(journal.fileno())
        return process

    def run(self, command, *, data=None, timeout=30, cap=MIB, destination=None, cleanup=False, environment=None):
        if cleanup:
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       env=environment, creationflags=0x08000000)
            self.processes.append(process)
        else:
            process = self.spawn(command, environment=environment)
        output = bytearray()
        errors = []
        diagnostics = bytearray()
        output_bytes = [0]
        self.sequence += 1

        def read_stdout():
            stream = destination.open("xb") if destination is not None else None
            try:
                while chunk := process.stdout.read(65536):
                    output_bytes[0] += len(chunk)
                    require(output_bytes[0] <= cap, "owned command output exceeded its cap")
                    if stream:
                        stream.write(chunk)
                    else:
                        output.extend(chunk)
            except BaseException as error:
                errors.append(str(error))
            finally:
                if stream:
                    stream.close()

        def read_stderr():
            try:
                while chunk := process.stderr.read1(65536):
                    require(len(diagnostics) + len(chunk) <= MIB, "owned command stderr exceeded one MiB")
                    diagnostics.extend(chunk)
                    if self.stderr_hook is not None:
                        self.stderr_hook(chunk)
                    if self.observer and not cleanup:
                        self.observer.diagnostics(chunk)
            except BaseException as error:
                errors.append(str(error))

        def write_stdin():
            try:
                if data is not None:
                    process.stdin.write(data)
                    process.stdin.flush()
            except BaseException as error:
                errors.append(str(error))
            finally:
                process.stdin.close()

        threads = [threading.Thread(target=target, daemon=True)
                   for target in (read_stdout, read_stderr, write_stdin)]
        for thread in threads:
            thread.start()
        deadline = time.monotonic() + timeout
        try:
            while process.poll() is None:
                if self.observer and not cleanup:
                    self.observer.check()
                require(not errors and time.monotonic() < deadline, "owned command failed its output or time bound")
                time.sleep(0.05)
            for thread in threads:
                thread.join(timeout=1)
            require(not errors and all(not thread.is_alive() for thread in threads), "owned command streams did not settle")
            require(process.returncode == 0, "owned command failed: " + diagnostics.decode("utf-8", "replace")[-4096:])
            return bytes(output)
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=1)
            if self.observer:
                with (self.observer.scratch / f"command-{self.sequence}-stderr.log").open("xb") as log:
                    log.write(diagnostics[:MIB])

    def stop_children(self, job=None, seconds=5):
        deadline = time.monotonic() + max(0, seconds)
        for process in self.processes:
            if process.poll() is None:
                process.terminate()
        for process in self.processes:
            if process.poll() is None:
                try:
                    process.wait(timeout=max(0.01, min(1, deadline - time.monotonic())))
                except subprocess.TimeoutExpired:
                    process.kill()
        if job is not None:
            job.terminate_children(max(0, deadline - time.monotonic()))
        for process in self.processes:
            if process.poll() is None:
                process.wait(timeout=max(0.01, deadline - time.monotonic()))
        require(all(process.poll() is not None for process in self.processes), "owned Windows child remains")


def wsl_command(script, *arguments):
    executable = Path(os.environ["SystemRoot"]) / "System32/wsl.exe"
    return [str(executable), "-d", "habitat", "-u", "root", "--exec", "sh", "-lc", script, "05b", *map(str, arguments)]


def linux_name(owner, windows_path):
    raw = owner.run(wsl_command('exec /usr/bin/wslpath -a -u "$1"', windows_path), timeout=10, cap=4096)
    value = raw.decode("utf-8").strip()
    require(value.startswith("/mnt/") and "\n" not in value and "\r" not in value, "Windows path translation differs")
    return value


def source_helper(owner, root, config_name, config_hash, mode, *arguments, expected_sources, data=None, destination=None, cap=MIB):
    helper = checked_path(root, f"{FIXTURE}/gui_proof_linux.py")
    controller = checked_path(root, f"{FIXTURE}/gui_proof_controller.py")
    helper_hash = digest(expected_sources[f"{FIXTURE}/gui_proof_linux.py"]["sha256"], "reviewed Linux helper")
    controller_hash = digest(expected_sources[f"{FIXTURE}/gui_proof_controller.py"]["sha256"], "reviewed controller")
    require(stream_digest(helper) == helper_hash and stream_digest(controller) == controller_hash,
            "reviewed elevated helper source changed")
    linux_helper = linux_name(owner, helper)
    linux_controller = linux_name(owner, controller)
    linux_config = linux_name(owner, checked_path(root, config_name))
    script = ('test "$(sha256sum -- "$1" | cut -d " " -f1)" = "$2" || exit 71; '
              'test "$(sha256sum -- "$3" | cut -d " " -f1)" = "$4" || exit 72; '
              'helper="$1"; shift 4; exec /usr/bin/python3 -I -B "$helper" "$@"')
    command = wsl_command(script, linux_helper, helper_hash, linux_controller, controller_hash,
                          mode, linux_config, config_hash, *arguments)
    return owner.run(command, data=data, timeout=90, destination=destination, cap=cap)


def windows_toolchains(config):
    runtime = config["windowsRuntime"]
    for name, expected_key in (("node", "nodeSha256"), ("playwrightPackageJson", "playwrightPackageJsonSha256"),
                               ("playwrightCorePackageJson", "playwrightCorePackageJsonSha256"), ("chromium", "chromiumSha256")):
        path = Path(runtime[name])
        require(path.is_absolute() and path == path.resolve(), "Windows toolchain path is not canonical")
        require(stream_digest(path) == runtime[expected_key], "Windows toolchain file changed")
    for name in ("playwrightPackageJson", "playwrightCorePackageJson"):
        package = parse_json(read_regular(Path(runtime[name]), MAX_CONFIG_BYTES))
        require(package["version"] == "1.62.1", "Playwright package version changed")
    return {name: tree_summary(Path(runtime[key]).parent) for name, key in (
        ("nodeDirectory", "node"), ("playwright", "playwrightPackageJson"),
        ("playwrightCore", "playwrightCorePackageJson"), ("chromium", "chromium"))}


def freeze_bindings(root, config_name, config, config_hash):
    """Read installed tools and write new bindings. This never grants runtime authority."""
    require(sys.platform == "win32", "binding preparation requires Windows")
    sources = source_inventory(root)
    owner = ProcessOwner()
    try:
        linux = parse_json(source_helper(owner, root, config_name, config_hash, "inspect", expected_sources=sources))
        windows = windows_toolchains(config)
        require(source_inventory(root) == sources, "source changed during binding preparation")
        source_path = checked_path(root, config["sourceBinding"], missing_leaf=True)
        toolchain_path = checked_path(root, config["toolchainBinding"], missing_leaf=True)
        require(not source_path.exists() and not toolchain_path.exists(), "reviewed bindings already exist")
        write_json_exclusive(source_path, proposed_binding(config, config_hash, sources))
        write_json_exclusive(toolchain_path, {"schema": "vivary.05b-gui-toolchain-binding/v1",
                             "configSha256": config_hash, "linux": linux, "windows": windows})
        return {"sourceBindingSha256": stream_digest(source_path), "toolchainBindingSha256": stream_digest(toolchain_path),
                "runtimeAuthorized": False}
    finally:
        owner.stop_children()


class BrowserLaunchEvidence:
    def __init__(self, config, scratch, job):
        self.config = config
        self.scratch = scratch
        self.job = job
        self.buffer = ""
        self.launch = None
        self.pid = None

    def receive(self, chunk):
        self.buffer += chunk.decode("utf-8", "replace")
        require(len(self.buffer) <= MIB, "Chromium diagnostic line exceeds its cap")
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            line = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", line)
            if "<launching>" in line:
                require(self.launch is None, "a second Chromium launch was attempted")
                expected = self.config["windowsRuntime"]["chromium"].replace("\\", "/").lower()
                require(expected in line.replace("\\", "/").lower(), "Chromium executable differs")
                for flag in ("--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu-sandbox", "--no-zygote-sandbox"):
                    require(flag not in line, "Chromium launched without its sandbox")
                require("--disable-background-networking" in line, "Chromium background networking was not disabled")
                match = re.search(r"--user-data-dir=(.*?)(?= --[a-zA-Z-]+(?:[= ]|$))", line)
                require(match is not None, "Chromium profile flag was not observed")
                profile = Path(match.group(1).strip('"'))
                allowed = self.scratch / "browser-temp"
                require(profile.is_absolute() and profile.resolve().is_relative_to(allowed.resolve())
                        and profile.resolve() != allowed.resolve(), "Chromium profile escaped owned scratch")
                no_link(profile)
                self.launch = {"command": line, "profile": str(profile), "sandboxEnabled": True}
            if "<launched>" in line:
                match = re.search(r"\bpid=(\d+)\b", line)
                require(match is not None and self.pid is None, "Chromium PID report differs")
                self.pid = int(match.group(1))

    def verified(self):
        return self.launch is not None and self.pid is not None and self.pid in self.job.process_ids()


class ProofOwner:
    def __init__(self, root, config_name, config, config_hash, authority_hash, run_id):
        self.root = root
        self.config_name = config_name
        self.config = config
        self.config_hash = config_hash
        self.authority_hash = authority_hash
        self.run_id = run_id
        require(re.fullmatch(r"[a-f0-9]{12}", run_id) is not None, "invalid GUI run identity")
        self.plan = containment_plan(config, run_id)
        self.scratch = checked_path(root, config["scratchWindows"], missing_leaf=True)
        self.export_path = checked_path(root, config["export"], missing_leaf=True)
        self.result_path = checked_path(root, config["runtimeRecord"], missing_leaf=True)
        for path in (self.scratch, self.export_path, self.result_path):
            require(not path.exists() and not path.is_symlink(), "owned output already exists")
        self.binding_path = checked_path(root, config["sourceBinding"])
        self.binding_raw = read_regular(self.binding_path, MAX_BINDING_BYTES)
        self.binding_hash = hashlib.sha256(self.binding_raw).hexdigest()
        self.binding = parse_json(self.binding_raw)
        self.toolchain_raw = read_regular(checked_path(root, config["toolchainBinding"]), MAX_BINDING_BYTES)
        self.toolchain_hash = hashlib.sha256(self.toolchain_raw).hexdigest()
        self.toolchain = exact(parse_json(self.toolchain_raw), {"schema", "configSha256", "linux", "windows"}, "toolchain binding")
        require(self.toolchain["schema"] == "vivary.05b-gui-toolchain-binding/v1"
                and self.toolchain["configSha256"] == config_hash, "toolchain configuration differs")
        self.preserved_hash = preserved_inputs(root, config)
        self.authority_raw = runtime_authority(root, config, authority_hash, {
            "configSha256": config_hash, "sourceBindingSha256": self.binding_hash,
            "toolchainBindingSha256": self.toolchain_hash, "preservedBindingSha256": self.preserved_hash,
        })
        self.observer = None
        self.processes = None
        self.job = None
        self.rpc = None
        self.proxy = None
        self.staged = False
        self.claimed_units = set()
        self.runtime_hash = None
        self.runtime = None
        self.result = {"schema": "vivary.05b-gui-result/v1", "runId": run_id,
                       "verificationPassed": False, "processCleanupAccepted": False,
                       "filesystemCleanupAccepted": False, "filesystemDeletionAvailable": False,
                       "errors": [], "phases": [], "units": [item["unit"] for item in self.plan["phases"].values()]}

    def bound_inputs(self):
        require(stream_digest(checked_path(self.root, self.config_name)) == self.config_hash, "configuration changed")
        require(proposed_binding(self.config, self.config_hash, source_inventory(self.root)) == self.binding,
                "reviewed source changed")
        require(stream_digest(self.binding_path) == self.binding_hash, "source binding changed")
        require(stream_digest(checked_path(self.root, self.config["toolchainBinding"])) == self.toolchain_hash,
                "toolchain binding changed")
        require(preserved_inputs(self.root, self.config) == self.preserved_hash, "a preserved guard or budget changed")
        runtime_authority(self.root, self.config, self.authority_hash, {
            "configSha256": self.config_hash, "sourceBindingSha256": self.binding_hash,
            "toolchainBindingSha256": self.toolchain_hash, "preservedBindingSha256": self.preserved_hash,
        })

    def linux_operation(self, mode, *, data=None, destination=None, cleanup=False, timeout=90, cap=MIB):
        helper = str(PurePosixPath(self.config["scratchLinux"]) / "harness/gui_proof_linux.py")
        command = wsl_command('exec /usr/bin/python3 -I -B "$@"', helper, mode,
                              self.config["scratchLinux"], self.run_id, self.runtime_hash)
        remaining = self.observer.deadline - time.monotonic()
        require(remaining > 0, "no cumulative time remains for evidence bookkeeping")
        return self.processes.run(command, data=data, destination=destination, cleanup=cleanup,
                                  timeout=min(timeout, remaining), cap=cap)

    def transfer(self, config_raw):
        buffer = io.BytesIO()
        controls = {".control/config.json": config_raw, ".control/source-binding.json": self.binding_raw,
                    ".control/runtime.json": (json.dumps(self.runtime, sort_keys=True, indent=2) + "\n").encode(),
                    ".control/authority.json": self.authority_raw}
        with tarfile.open(fileobj=buffer, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for name, expected in self.binding["sources"].items():
                self.observer.check()
                raw = read_regular(checked_path(self.root, name), MAX_SOURCE_FILE_BYTES)
                require(len(raw) == expected["bytes"] and hashlib.sha256(raw).hexdigest() == expected["sha256"],
                        "source changed before transfer")
                if name.startswith(APP + "/"):
                    projected = "app/" + name[len(APP) + 1:]
                else:
                    require(name.startswith(FIXTURE + "/"), "unexpected source transfer owner")
                    projected = "harness/" + name[len(FIXTURE) + 1:]
                controls[projected] = raw
            for name, raw in controls.items():
                item = tarfile.TarInfo(name)
                item.size = len(raw)
                item.mode = 0o444
                archive.addfile(item, io.BytesIO(raw))
        raw = buffer.getvalue()
        require(len(raw) <= 40 * MIB, "source transfer archive exceeds its cap")
        response = source_helper(self.processes, self.root, self.config_name, self.config_hash,
                                 "stage", self.run_id, self.runtime_hash, expected_sources=self.binding["sources"], data=raw)
        require(parse_json(response).get("staged") is True, "projection staging failed")
        self.staged = True
        self.result["transfer"] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}

    def service(self, phase):
        plan = self.plan["phases"][phase]
        properties = dict(plan["properties"])
        properties["Description"] = "Vivary 05b GUI proof " + plan["unit"]
        properties["WorkingDirectory"] = plan["cwd"]
        properties["BindReadOnlyPaths"] = [*properties["BindReadOnlyPaths"],
            self.runtime["heartbeatSourceLinux"] + ":" + self.config["scratchLinux"] + "/.control/heartbeat-dir"]
        if plan["privateWritableBindMounts"]:
            properties["BindPaths"] = [item["source"] + ":" + item["destination"]
                                      for item in plan["privateWritableBindMounts"]]
        command = ["/usr/bin/systemd-run", "--unit=" + plan["unit"], "--wait", "--pipe", "--collect",
                   "--quiet", "--service-type=exec", "--uid=1000", "--gid=1000"]
        for name, value in properties.items():
            if isinstance(value, list):
                value = " ".join('"' + part.replace("\\", "\\\\").replace('"', '\\"') + '"' for part in value)
            command.extend(["-p", name + "=" + value])
        helper = str(PurePosixPath(self.config["scratchLinux"]) / "harness/gui_proof_linux.py")
        command.extend(["/usr/bin/python3", "-I", "-B", helper, "inside", self.config["scratchLinux"],
                        self.run_id, self.runtime_hash, phase])
        self.claimed_units.add(plan["unit"])
        return wsl_command('exec "$@"', *command)

    def absent_before_start(self):
        units = [item["unit"] for item in self.plan["phases"].values()]
        script = ('for unit in "$@"; do '
                  'test "$(systemctl show "$unit" -p LoadState --value)" = not-found || exit 74; '
                  'test "$(systemctl show "$unit" -p ActiveState --value)" = inactive || exit 75; '
                  'test "$(systemctl show "$unit" -p MainPID --value)" = 0 || exit 76; '
                  'test ! -e "/sys/fs/cgroup/system.slice/$unit" || exit 77; done')
        self.processes.run(wsl_command(script, *units), timeout=10, cap=8192)

    def stop_units(self):
        if not self.claimed_units:
            return
        script = ('for unit in "$@"; do '
                  'load=$(systemctl show "$unit" -p LoadState --value) || exit 78; '
                  'if [ "$load" != not-found ]; then '
                  'test "$(systemctl show "$unit" -p Description --value)" = "Vivary 05b GUI proof $unit" || exit 79; '
                  'systemctl stop --no-block "$unit" || exit 80; fi; done; '
                  'deadline=$(( $(date +%s) + 5 )); '
                  'while :; do present=0; for unit in "$@"; do '
                  'test ! -e "/sys/fs/cgroup/system.slice/$unit" || present=1; '
                  'test "$(systemctl show "$unit" -p LoadState --value)" = not-found || present=1; '
                  'test "$(systemctl show "$unit" -p MainPID --value)" = 0 || present=1; done; '
                  'test "$present" = 1 || break; test "$(date +%s)" -lt "$deadline" || exit 81; sleep 0.1; done')
        self.processes.run(wsl_command(script, *sorted(self.claimed_units)), timeout=5, cap=8192, cleanup=True)

    def phase_start(self, journal, phase):
        self.bound_inputs()
        before = self.observer.begin(phase)
        journal.append({"event": "phase-start", "atUnixSeconds": time.time(), "phase": phase,
                        "allocatedSeconds": PROFILE[phase + "Seconds"]})
        self.result["phases"].append({"phase": phase, "before": before, "started": time.time()})

    def phase_finish(self, journal, phase):
        absent = parse_json(self.linux_operation("absent", timeout=5, cap=8192))
        require(absent.get("absent") is True, "phase process or mount cleanup is unknown")
        self.observer.end()
        require(self.job.process_ids() == {os.getpid()}, "a Windows descendant remains after the phase")
        require(parse_json(self.linux_operation("toolchains")) == self.toolchain["linux"], "Linux dependencies changed")
        require(windows_toolchains(self.config) == self.toolchain["windows"], "Windows tools changed")
        self.bound_inputs()
        journal.append({"event": "phase-finish", "atUnixSeconds": time.time(), "phase": phase,
                        "exit": 0, "cleanupAccepted": True})
        self.result["phases"][-1].update({"exit": 0, "processCleanupAccepted": True, "finished": time.time()})

    def browser_environment(self):
        for name in ("browser-temp", "browser-home", "browser-data"):
            (self.scratch / name).mkdir()
        return {"SystemRoot": os.environ["SystemRoot"], "WINDIR": os.environ["SystemRoot"],
                "PATH": str(Path(self.config["windowsRuntime"]["node"]).parent),
                "TEMP": str(self.scratch / "browser-temp"), "TMP": str(self.scratch / "browser-temp"),
                "TMPDIR": str(self.scratch / "browser-temp"), "HOME": str(self.scratch / "browser-home"),
                "USERPROFILE": str(self.scratch / "browser-home"), "LOCALAPPDATA": str(self.scratch / "browser-data"),
                "APPDATA": str(self.scratch / "browser-data"), "DEBUG": "pw:browser",
                "NODE_OPTIONS": "--max-old-space-size=512"}

    def browser(self):
        process = self.processes.spawn(self.service("browser"))
        self.backend_log = (self.scratch / "backend-stderr.log").open("xb")
        def diagnostic(chunk):
            self.observer.diagnostics(chunk)
            self.backend_log.write(chunk)
            self.backend_log.flush()
        self.rpc = BoundedRpc(process, self.observer.check, diagnostic, self.observer.fail)
        self.result["backendReady"] = self.rpc.ready(self.plan["phases"]["browser"]["unit"])
        launch = BrowserLaunchEvidence(self.config, self.scratch, self.job)
        self.proxy = LoopbackProxy(self.rpc, self.observer.check, self.observer.fail, launch.verified)
        self.proxy.start()
        browser_input = self.scratch / "browser-input.json"
        write_json_exclusive(browser_input, {"schema": "vivary.05b-gui-browser-input/v1",
            "baseUrl": self.proxy.base_url, "proofToken": self.proxy.token,
            "chromiumExecutable": self.config["windowsRuntime"]["chromium"],
            "playwrightPackageJson": self.config["windowsRuntime"]["playwrightPackageJson"],
            "evidenceRoot": str(self.scratch / "browser-evidence")})
        self.processes.stderr_hook = launch.receive
        environment = self.browser_environment()
        node = self.config["windowsRuntime"]["node"]
        try:
            version = self.processes.run([node, "--version"], environment=environment, timeout=5, cap=1024)
            require(version.decode().strip() == "v24.19.0", "Windows Node version differs")
            self.processes.run([node, str(checked_path(self.root, FIXTURE + "/gui_browser.mjs")), str(browser_input)],
                               environment=environment, timeout=300)
            require(launch.launch is not None and launch.pid is not None, "Chromium launch evidence is incomplete")
            browser_result = parse_json(read_regular(self.scratch / "browser-evidence/browser-result.json", MIB))
            require(browser_result.get("passed") is True, "browser acceptance failed")
            self.result["browser"] = browser_result
            self.result["chromium"] = {**launch.launch, "pid": launch.pid}
            self.proxy.close()
            self.proxy = None
            self.result["backendClose"] = self.rpc.close()
            process.wait(timeout=5)
            require(process.returncode == 0, "contained backend command failed")
            self.rpc = None
        finally:
            self.processes.stderr_hook = None
            if self.rpc is None:
                self.backend_log.close()

    def evidence_export(self):
        linux_archive = self.scratch / "linux-evidence.tar"
        self.linux_operation("export", destination=linux_archive, cap=64 * MIB, cleanup=True)
        linux_hash = stream_digest(linux_archive, 64 * MIB)
        require(stream_digest(linux_archive, 64 * MIB) == linux_hash, "Linux archive readback differs")
        with tarfile.open(linux_archive, mode="r:") as archive:
            members = archive.getmembers()
            require(len(members) <= 20000 and sum(item.size for item in members) <= 64 * MIB, "Linux archive inventory exceeds its cap")
            for member in members:
                relative_name(member.name, "Linux evidence member")
                require(member.isfile() and not member.issparse() and member.name.startswith("evidence/"), "unsafe Linux evidence member")
        write_json_exclusive(self.scratch / "owner-observations.json", {
            "result": self.result, "samples": self.observer.samples,
            "ownedWindowsPids": [process.pid for process in self.processes.processes],
            "configSha256": self.config_hash, "sourceBindingSha256": self.binding_hash,
            "toolchainBindingSha256": self.toolchain_hash, "authoritySha256": self.authority_hash})
        retained = [linux_archive, self.scratch / "owner-observations.json", self.binding_path,
                    checked_path(self.root, self.config["toolchainBinding"])]
        retained += list(self.scratch.glob("*-stderr.log"))
        if (self.scratch / "browser-evidence").exists():
            for path in (self.scratch / "browser-evidence").iterdir():
                require(stat.S_ISREG(no_link(path).st_mode), "unexpected browser evidence member")
                retained.append(path)
        require(len(retained) <= 256 and sum(path.stat().st_size for path in retained) <= 96 * MIB, "final evidence cap exceeded")
        member_hashes = {}
        with tarfile.open(self.export_path, mode="x", format=tarfile.USTAR_FORMAT) as archive:
            for ordinal, path in enumerate(retained):
                name = f"evidence/{ordinal:03d}-{path.name}"
                member_hashes[name] = stream_digest(path, 64 * MIB)
                archive.add(path, arcname=name, recursive=False)
        archive_hash = stream_digest(self.export_path, 128 * MIB)
        with tarfile.open(self.export_path, mode="r:") as archive:
            members = archive.getmembers()
            require({member.name for member in members} == set(member_hashes), "final evidence inventory differs")
            for member in members:
                stream = archive.extractfile(member)
                require(stream is not None and member.isfile(), "final evidence is not regular")
                digest_value = hashlib.sha256()
                while chunk := stream.read(MIB):
                    digest_value.update(chunk)
                require(digest_value.hexdigest() == member_hashes[member.name], "final member readback differs")
        require(stream_digest(self.export_path, 128 * MIB) == archive_hash, "final archive readback differs")
        acknowledgement = json.dumps({"runId": self.run_id, "linuxArchiveSha256": linux_hash,
                                      "finalArchiveSha256": archive_hash}).encode()
        cleanup_plan = parse_json(self.linux_operation("cleanup-plan", data=acknowledgement, cleanup=True))
        require(cleanup_plan.get("filesystemDeletionAvailable") is False, "cleanup unexpectedly offers deletion")
        self.result["export"] = {"path": str(self.export_path), "sha256": archive_hash,
                                 "bytes": self.export_path.stat().st_size, "members": member_hashes}
        self.result["retainedCleanupPlan"] = {"linux": cleanup_plan,
            "windows": {"scratch": str(self.scratch), "tree": tree_summary(self.scratch, maximum_bytes=256 * MIB),
                        "filesystemDeletionAvailable": False}}

    def execute(self):
        require(sys.platform == "win32", "the GUI owner requires Windows")
        with Journal(self.root, self.config["attemptLedger"]) as journal:
            before = admission(self.root, self.config, self.authority_hash)
            self.job = WindowsJob()
            started_unix = time.time()
            journal.append({"event": "run-start", "runId": self.run_id, "startedUnixSeconds": started_unix,
                            "deadlineUnixSeconds": started_unix + 1200, "allocatedSeconds": 1200,
                            "configSha256": self.config_hash, "sourceBindingSha256": self.binding_hash,
                            "authoritySha256": self.authority_hash})
            try:
                self.result["admission"] = before
                self.result["startedUnixSeconds"] = started_unix
                self.scratch.mkdir()
                self.observer = Observer.__new__(Observer)
                self.observer.__init__(self.root, self.scratch)
                self.observer.deadline = self.observer.started + max(0, started_unix + 1200 - time.time())
                self.processes = ProcessOwner(self.observer)
                self.bound_inputs()
                head = self.processes.run(["git", "--no-optional-locks", "-C", str(self.root), "rev-parse", "HEAD"], timeout=5, cap=1024)
                branch = self.processes.run(["git", "--no-optional-locks", "-C", str(self.root), "branch", "--show-current"], timeout=5, cap=1024)
                require(head.decode().strip() == self.config["candidateHead"]
                        and branch.decode().strip() == "docs/context-compaction-policy", "candidate checkout changed")
                require(windows_toolchains(self.config) == self.toolchain["windows"], "Windows toolchains changed")
                linux = parse_json(source_helper(self.processes, self.root, self.config_name, self.config_hash, "inspect",
                                                expected_sources=self.binding["sources"]))
                require(linux == self.toolchain["linux"], "Linux toolchains changed")
                self.absent_before_start()
                heartbeat = linux_name(self.processes, self.scratch / "heartbeat-dir")
                self.runtime = {"runId": self.run_id, "configSha256": self.config_hash,
                    "sourceBindingSha256": self.binding_hash, "toolchainBindingSha256": self.toolchain_hash,
                    "authoritySha256": self.authority_hash, "startedUnixSeconds": started_unix,
                    "deadlineUnixSeconds": started_unix + 1200, "heartbeatSourceLinux": heartbeat}
                runtime_raw = (json.dumps(self.runtime, sort_keys=True, indent=2) + "\n").encode()
                self.runtime_hash = hashlib.sha256(runtime_raw).hexdigest()
                self.transfer(read_regular(checked_path(self.root, self.config_name), MAX_CONFIG_BYTES))
                self.phase_start(journal, "build")
                self.processes.run(self.service("build"), timeout=600)
                self.phase_finish(journal, "build")
                self.job.set_phase("browser")
                self.phase_start(journal, "browser")
                self.browser()
                self.phase_finish(journal, "browser")
                self.observer.check()
                self.result["verificationPassed"] = True
            except BaseException as error:
                self.result["errors"].append({"step": "proof", "type": type(error).__name__, "message": str(error)[:4096]})
                if self.observer is not None and hasattr(self.observer, "lock"):
                    self.observer.fail(error)
            finally:
                cleanup_started = time.monotonic()
                cleanup_failures = []
                try:
                    if self.claimed_units:
                        require(self.processes is not None, "claimed units have no process owner")
                        self.stop_units()
                except BaseException as error:
                    cleanup_failures.append(str(error))
                try:
                    remaining = max(0, 5 - (time.monotonic() - cleanup_started))
                    if self.processes is not None:
                        self.processes.stop_children(self.job, seconds=remaining)
                    elif self.job is not None:
                        self.job.terminate_children(seconds=remaining)
                except BaseException as error:
                    cleanup_failures.append(str(error))
                try:
                    if self.proxy is not None:
                        self.proxy.close()
                        self.proxy = None
                except BaseException as error:
                    cleanup_failures.append("proxy: " + str(error))
                try:
                    if self.job is not None:
                        require(self.job.process_ids() == {os.getpid()}, "owned Windows descendants remain")
                except BaseException as error:
                    cleanup_failures.append("Windows absence: " + str(error))
                try:
                    if self.staged:
                        require(parse_json(self.linux_operation("absent", cleanup=True, timeout=5)).get("absent") is True,
                                "owned Linux unit or mount remains")
                except BaseException as error:
                    cleanup_failures.append("Linux absence: " + str(error))
                try:
                    require(not cleanup_failures and time.monotonic() - cleanup_started <= 5,
                            "owned process cleanup exceeded its bound: " + "; ".join(cleanup_failures))
                    self.result["processCleanupAccepted"] = True
                except BaseException as error:
                    self.result["errors"].append({"step": "process-cleanup", "type": type(error).__name__, "message": str(error)[:4096]})
                try:
                    if self.observer is not None and hasattr(self.observer, "phase_started"):
                        self.observer.end()
                except BaseException as error:
                    self.result["processCleanupAccepted"] = False
                    self.result["errors"].append({"step": "observer-phase-close", "message": str(error)[:4096]})
                if self.rpc is not None:
                    try:
                        self.rpc.outgoing.put_nowait(None)
                    except queue.Full:
                        pass
                    for thread in (self.rpc.reader, self.rpc.errors, self.rpc.writer):
                        thread.join(timeout=0.1)
                    if any(thread.is_alive() for thread in (self.rpc.reader, self.rpc.errors, self.rpc.writer)):
                        self.result["processCleanupAccepted"] = False
                        self.result["errors"].append({"step": "RPC-close", "message": "owned transport thread remains"})
                    if not self.rpc.errors.is_alive() and hasattr(self, "backend_log"):
                        self.backend_log.close()
                if (self.staged and self.result["processCleanupAccepted"] and self.observer is not None
                        and time.monotonic() < getattr(self.observer, "deadline", 0)):
                    try:
                        self.evidence_export()
                    except BaseException as error:
                        self.result["errors"].append({"step": "export", "type": type(error).__name__, "message": str(error)[:4096]})
                try:
                    if self.observer is not None:
                        self.observer.finish()
                except BaseException as error:
                    self.result["processCleanupAccepted"] = False
                    self.result["errors"].append({"step": "observer-close", "message": str(error)[:4096]})
                self.result["elapsedSeconds"] = time.time() - started_unix
                self.result["observerFailure"] = getattr(self.observer, "failure", None)
                self.result["samples"] = getattr(self.observer, "samples", [])
                self.result["retainedWindowsScratch"] = str(self.scratch)
                self.result["retainedLinuxScratch"] = self.config["scratchLinux"] if self.staged else "stage not acknowledged; inspect exact configured path"
                self.result["complete"] = False
                self.result["nextGate"] = "Review exact retained scratch cleanup. Filesystem deletion is unavailable."
                if self.result.get("export") and time.time() <= started_unix + 1200:
                    state = ledger_state(read_regular(journal.path, MAX_LEDGER_BYTES))
                    if state.get("activePhase") is None:
                        journal.append({"event": "run-finish", "atUnixSeconds": time.time(),
                                        "exportSha256": self.result["export"]["sha256"], "cleanupAccepted": False})
                write_json_exclusive(self.result_path, self.result)
        return self.result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="private repository-relative configuration path")
    parser.add_argument("--config-sha256", required=True)
    parser.add_argument("--run-id", required=True, help="proposed 12-digit lowercase hexadecimal identity")
    parser.add_argument("--require-binding", action="store_true")
    parser.add_argument("--freeze-bindings", action="store_true")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--authority-sha256")
    args = parser.parse_args()
    root = Path(__file__).absolute().parents[5]
    require(root.resolve() == root, "repository root resolves through an alias")
    config, config_hash = load_config(root, args.config, args.config_sha256)
    require(not (args.run and args.freeze_bindings), "binding preparation and runtime are separate operations")
    if args.freeze_bindings:
        print(json.dumps(freeze_bindings(root, args.config, config, config_hash), sort_keys=True))
        return
    if args.run:
        require(args.authority_sha256 is not None, "runtime authority digest is required")
        result = ProofOwner(root, args.config, config, config_hash, args.authority_sha256, args.run_id).execute()
        print(json.dumps({"verificationPassed": result["verificationPassed"], "processCleanupAccepted": result["processCleanupAccepted"],
                          "complete": result["complete"], "result": config["runtimeRecord"]}, sort_keys=True))
        raise SystemExit(0 if result["verificationPassed"] and result["processCleanupAccepted"]
                         and not result["errors"] and result.get("export") else 1)
    sources = source_inventory(root)
    binding = proposed_binding(config, config_hash, sources)
    binding_hash = verify_binding(root, config, binding) if args.require_binding else None
    ledger_path = checked_path(root, config["attemptLedger"], missing_leaf=True)
    ledger = ledger_state(read_regular(ledger_path, MAX_LEDGER_BYTES) if ledger_path.exists() else b"")
    output = {"rootDispatchAvailable": False, "filesystemDeletionAvailable": False,
              "sourceBindingProposal": binding, "reviewedBindingSha256": binding_hash,
              "ledger": ledger, "containment": containment_plan(config, args.run_id)}
    print(json.dumps(output, sort_keys=True, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (Refusal, OSError, ValueError, KeyError, TypeError) as error:
        print(f"05b GUI source inspection refused: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(2)
