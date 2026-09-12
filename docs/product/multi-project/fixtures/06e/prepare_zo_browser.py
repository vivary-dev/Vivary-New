#!/usr/bin/env python3
"""Prepare and attest immutable inputs for the bounded 06e C5 browser proof."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / ".tmp/06e/zo-browser-r2"
PRIOR_BASE = ROOT / ".tmp/06e/zo-browser"
PRIOR_LEDGER = PRIOR_BASE / "budget.json"
PRIOR_RESULT = PRIOR_BASE / "browser-01/result.json"
PRIOR_ARCHIVE = ROOT / ".tmp/06e/browser-01-failed-evidence.zip"
APP = ROOT / ".tmp/05b/zo-runtime/app"
BUILD_INPUTS = ROOT / ".tmp/05b/zo-runtime/build-04-inputs.json"
ACCEPTED_CANDIDATE = ROOT / ".tmp/05b/zo-runtime/source/candidate.json"
BROWSER = (
    ROOT
    / ".tmp/05b/zo-runtime/chromium-02/work/browsers/"
    "chromium-1243/chrome-linux64"
)
FIXTURE = ROOT / "docs/product/multi-project/fixtures/06e"
SHARED_FIXTURE = ROOT / "docs/product/multi-project/fixtures/05b"
CORE = ROOT / "packages/core/vivary_core"
EVALUATOR = ROOT / "scripts/registry_contract_model.mjs"

EXPECTED_PRIOR_LEDGER_SHA256 = (
    "f7e5d3dddb92a5453947e8f508ce18d0a63bb661546e0baa75462750691bbc55"
)
EXPECTED_PRIOR_RESULT_SHA256 = (
    "39a2280c5b1040fe884691a583e5f12b55188f9c1761ef99443e2c6ec26dbf9f"
)
EXPECTED_PRIOR_ARCHIVE_SHA256 = (
    "3d6be2d7a802a3d0551222b04d6d83e090ca5861251249f7107a6399720f8fc4"
)
PRIOR_CHARGED_SECONDS = 37.09076154699869
ORIGINAL_TOTAL_SECONDS = 365
RETRY_EXECUTION_SECONDS = 322
RETRY_CLEANUP_SECONDS = 5
RETRY_TOTAL_SECONDS = 327

EXPECTED_BUILD_INPUTS_SHA256 = (
    "3904745d7a73c805b3662ac51c8da795d9f618d90daa4ee77ad60f1d9a565da1"
)
EXPECTED_CANDIDATE_SHA256 = (
    "b45a06cdadcb1a852025ad3abc80efe6af9190aaaeb6e189980d2422257f6ab0"
)
EXPECTED_APP_INPUTS = 80
EXPECTED_BUILD_OUTPUTS = 212
EXPECTED_CORE_FILES = 43
EXPECTED_CORE_BYTES = 662654
EXPECTED_NODE_SHA256 = (
    "d1de76d8edf2fededf6f8b30d244e2c0529ac607923a018283b77e9c74bd932c"
)
EXPECTED_CHROMIUM_SHA256 = (
    "8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e"
)
PLAYWRIGHT = (
    APP
    / "node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/package.json"
)
PLAYWRIGHT_SANDBOX = (
    "/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/package.json"
)
TOOLS = {
    "/usr/bin/node": EXPECTED_NODE_SHA256,
    "/usr/bin/nohup": "d290c0aae67eee4b37a86893cb0f4036f9bf1abe8ed19ecc6a529e7c681390f3",
    "/usr/bin/bwrap": "85580dd52ed366ece8844e90fa75ac7c4de8802963071344e123221fb9f6f11e",
    "/usr/bin/unshare": "9fb85770a4a0b5cb2bff8e64c2934dd1b0674eaaae18fd550dea2520c69a45d9",
    "/usr/bin/setpriv": "d5839b20edb0d77222b1e11be7d155c7122d381dbfad40876b0def7dd710f5bd",
    "/usr/bin/python3.11": "a83c0370d91532c96d4060a0e7c107d1f2889dad8a98e03395e86ef0373fd467",
    "/usr/bin/Xvfb": "c50687113cd5232844b8fa3a49276a48a022fa7fc4275b983ae8f88158efed72",
    "/usr/bin/xauth": "d5d3c556e7acc1a224a2847095bd5551a81b2418e2de827193119a028b0d0058",
    "/usr/bin/xkbcomp": "eca6986af7d15277394b8476b8ad85229ee1a1a879d43d2a526f106af3761550",
}
SOURCE_FILES = (
    FIXTURE / "c5_browser_backend.mjs",
    FIXTURE / "c5_browser.mjs",
    FIXTURE / "c5_browser_runner.mjs",
    FIXTURE / "prepare_zo_browser.py",
    FIXTURE / "zo_browser_supervisor.py",
    SHARED_FIXTURE / "gui_display.mjs",
    SHARED_FIXTURE / "gui_zo_runner.mjs",
    EVALUATOR,
)
PROFILE_LIMITS = {
    "memoryStopBytes": 8 * 1024**3,
    "taskStopCount": 256,
    "sampleMilliseconds": 250,
    "cpuCount": 4,
    "swapTotalBytes": 0,
    "maxObserverGapSeconds": 1,
    "outputStopBytes": 8 * 1024**2,
    "hostReserveBytes": 1536 * 1024**2,
}
ROUTE_GETS = ["/", "/.data", "/chat", "/chat.data", "/workbench", "/workbench.data"]
SHELL_GETS = sorted(
    [
        "/_agent-native/actions/get-localization-preference",
        "/_agent-native/application-state?keys=__set_url__",
        (
            "/_agent-native/application-state?keys=agent-chat-context,"
            "voice-input-preference,navigation,selection,pending-selection-context,__url__"
        ),
        (
            "/_agent-native/application-state?keys=agent-chat-context,"
            "voice-input-preference,navigation,selection,pending-selection-context,"
            "__url__,guided-questions"
        ),
        "/_agent-native/application-state?keys=voice-input-preference",
        "/_agent-native/auth/session",
        "/_agent-native/onboarding/first-run/status",
        "/_agent-native/org/me",
        "/_agent-native/ping?configuration=1",
        "/_agent-native/webmcp/manifest",
    ]
)
CHAT_GETS = sorted(
    [
        "/_agent-native/agent-chat/mode",
        (
            "/_agent-native/agent-chat/threads?scopeType=workspace-app&"
            "scopeId=vivary-workbench-chat-v1%3Ac5-browser-org"
        ),
    ]
)
BOOTSTRAP_MUTATIONS = [
    {
        "method": "PUT",
        "path": "/_agent-native/application-state/localization",
        "body": {"locale": "en-US", "preference": "system", "dir": "ltr"},
        "headers": {
            "content-type": "application/json",
            "x-request-source": "localization",
        },
        "maxPerWindow": 1,
        "windows": ["c5-root", "c5-workbench", "chat"],
    }
]
CHAT_MUTATIONS = [
    {
        "method": "PUT",
        "path": "/_agent-native/application-state/__url__",
        "body": {"pathname": "/chat", "search": "", "hash": "", "searchParams": {}},
        "headers": {"content-type": "application/json"},
        "maxPerWindow": 1,
        "windows": ["chat"],
    },
    {
        "method": "POST",
        "path": "/_agent-native/actions/manage-agent-engine",
        "body": {"action": "list"},
        "headers": {"content-type": "application/json"},
        "maxPerWindow": 1,
        "windows": ["chat"],
    },
]


def canonical_bytes(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def regular_identity(path: Path, sandbox_path: str) -> dict:
    assert path.is_file() and not path.is_symlink(), f"regular file required: {path}"
    info = path.stat()
    assert info.st_nlink == 1, f"single-link file required: {path}"
    size = info.st_size
    assert 0 < size <= 512 * 1024 * 1024, f"file size out of bounds: {path}"
    return {"path": sandbox_path, "sha256": sha(path), "bytes": size}


def tree_digest(root: Path) -> dict:
    assert root.is_dir() and not root.is_symlink()
    digest = hashlib.sha256()
    files = links = directories = total_bytes = 0
    entries = sorted(
        root.rglob("*"),
        key=lambda item: item.relative_to(root).as_posix().encode(),
    )
    for path in entries:
        relative = path.relative_to(root).as_posix().encode()
        if path.is_symlink():
            resolved = path.resolve(strict=True)
            assert resolved == root or resolved.is_relative_to(root), (
                f"tree symlink escapes root: {path} -> {resolved}"
            )
            assert resolved.is_file() or resolved.is_dir(), (
                f"tree symlink resolves to unsupported entry: {path}"
            )
            links += 1
            digest.update(b"L\0" + relative + b"\0" + os.readlink(path).encode() + b"\0")
        elif path.is_dir():
            directories += 1
            digest.update(b"D\0" + relative + b"\0")
        elif path.is_file():
            files += 1
            size = path.stat().st_size
            total_bytes += size
            digest.update(b"F\0" + relative + b"\0" + str(size).encode() + b"\0")
            with path.open("rb") as stream:
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
            digest.update(b"\0")
        else:
            raise AssertionError(f"unsupported tree entry: {path}")
    return {
        "sha256": digest.hexdigest(),
        "files": files,
        "links": links,
        "directories": directories,
        "bytes": total_bytes,
    }


def write_atomic(path: Path, data: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".new")
    with temporary.open("xb") as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def manifest(schema: str, files: list[dict]) -> dict:
    ordered = sorted(files, key=lambda item: item["path"])
    assert len({item["path"] for item in ordered}) == len(ordered)
    return {
        "schema": schema,
        "files": ordered,
        "bindingSha256": hashlib.sha256(canonical_bytes(ordered)).hexdigest(),
    }


def verify_build_inputs() -> list[dict]:
    assert sha(BUILD_INPUTS) == EXPECTED_BUILD_INPUTS_SHA256
    value = json.loads(BUILD_INPUTS.read_text())
    assert set(value) >= {"files"}
    entries = value["files"]
    assert len(entries) == EXPECTED_APP_INPUTS
    assert len({entry["path"] for entry in entries}) == len(entries)
    for entry in entries:
        assert set(entry) == {"path", "sha256", "bytes"}
        path = APP / entry["path"]
        assert path.is_file() and not path.is_symlink()
        assert path.stat().st_size == entry["bytes"]
        assert sha(path) == entry["sha256"]
    return entries


def prior_budget_authority() -> dict:
    assert sha(PRIOR_LEDGER) == EXPECTED_PRIOR_LEDGER_SHA256
    assert sha(PRIOR_RESULT) == EXPECTED_PRIOR_RESULT_SHA256
    assert sha(PRIOR_ARCHIVE) == EXPECTED_PRIOR_ARCHIVE_SHA256
    ledger = json.loads(PRIOR_LEDGER.read_text())
    assert isinstance(ledger, list) and len(ledger) == 1
    entry = ledger[0]
    assert entry["name"] == "browser-01"
    assert entry["status"] == "finished"
    assert entry["chargedSeconds"] == PRIOR_CHARGED_SECONDS
    assert entry["resultFailure"] == "child-failed"
    assert entry["resultSha256"] == EXPECTED_PRIOR_RESULT_SHA256
    result = json.loads(PRIOR_RESULT.read_text())
    assert result["schema"] == "vivary.06e-c5-browser-supervisor-result/v1"
    assert result["name"] == "browser-01"
    assert result["failure"] == "child-failed"
    assert result["elapsedSecondsIncludingDispatchAndCleanup"] == PRIOR_CHARGED_SECONDS
    assert result["cleanupAbsent"] is True
    assert result["remainingPids"] == []
    assert result["supervisorTermSignaledPids"] == []
    assert result["supervisorKillSignaledPids"] == []
    assert result["passingRunSupervisorEscalation"] is False
    assert result["chromiumLaunches"] == []
    assert result["runnerResultSha256"] is None
    assert PRIOR_CHARGED_SECONDS + RETRY_TOTAL_SECONDS <= ORIGINAL_TOTAL_SECONDS
    return {
        "schema": "vivary.06e-c5-browser-budget-authority/v1",
        "originalTotalSeconds": ORIGINAL_TOTAL_SECONDS,
        "prior": {
            "name": "browser-01",
            "chargedSeconds": PRIOR_CHARGED_SECONDS,
            "failure": "child-failed",
            "cleanupAbsent": True,
            "browserStarted": False,
            "ledger": {
                "path": "/source/.tmp/06e/zo-browser/budget.json",
                "sha256": EXPECTED_PRIOR_LEDGER_SHA256,
                "bytes": PRIOR_LEDGER.stat().st_size,
            },
            "result": {
                "path": "/source/.tmp/06e/zo-browser/browser-01/result.json",
                "sha256": EXPECTED_PRIOR_RESULT_SHA256,
                "bytes": PRIOR_RESULT.stat().st_size,
            },
            "archive": {
                "path": "/source/.tmp/06e/browser-01-failed-evidence.zip",
                "sha256": EXPECTED_PRIOR_ARCHIVE_SHA256,
                "bytes": PRIOR_ARCHIVE.stat().st_size,
            },
        },
        "retry": {
            "name": "browser-02",
            "executionSeconds": RETRY_EXECUTION_SECONDS,
            "cleanupSeconds": RETRY_CLEANUP_SECONDS,
            "totalSeconds": RETRY_TOTAL_SECONDS,
        },
        "maximumCombinedChargeSeconds": (
            PRIOR_CHARGED_SECONDS + RETRY_TOTAL_SECONDS
        ),
        "remainingUnallocatedSeconds": (
            ORIGINAL_TOTAL_SECONDS - PRIOR_CHARGED_SECONDS - RETRY_TOTAL_SECONDS
        ),
    }


def collect_source_entries(
    dependency_record: dict | None,
    browser_record: dict | None,
    budget_record: dict,
) -> tuple[list[dict], dict]:
    app_inputs = verify_build_inputs()
    entries = [
        {
            "path": "/app/" + entry["path"],
            "sha256": entry["sha256"],
            "bytes": entry["bytes"],
        }
        for entry in app_inputs
    ]

    assert sha(ACCEPTED_CANDIDATE) == EXPECTED_CANDIDATE_SHA256
    accepted = json.loads(ACCEPTED_CANDIDATE.read_text())
    assert accepted["schema"] == "vivary.05b-zo-source/v1"
    output_entries = [
        entry for entry in accepted["files"]
        if entry["path"].startswith("/app/build/")
    ]
    assert len(output_entries) == EXPECTED_BUILD_OUTPUTS
    accepted_output_paths = {entry["path"] for entry in output_entries}
    assert len(accepted_output_paths) == len(output_entries)
    actual_output_paths = {
        "/app/" + path.relative_to(APP).as_posix()
        for path in (APP / "build").rglob("*")
        if path.is_file()
    }
    assert actual_output_paths == accepted_output_paths
    for entry in output_entries:
        assert set(entry) == {"path", "sha256", "bytes"}
        path = APP / entry["path"].removeprefix("/app/")
        assert regular_identity(path, entry["path"]) == entry
    entries.extend(output_entries)

    core_files = sorted(CORE.rglob("*.py"), key=lambda item: item.relative_to(ROOT).as_posix())
    assert len(core_files) == EXPECTED_CORE_FILES
    assert sum(path.stat().st_size for path in core_files) == EXPECTED_CORE_BYTES
    entries.extend(
        regular_identity(path, "/source/" + path.relative_to(ROOT).as_posix())
        for path in core_files
    )
    entries.extend(
        regular_identity(path, "/source/" + path.relative_to(ROOT).as_posix())
        for path in SOURCE_FILES
    )

    if dependency_record is not None:
        raw = json.dumps(dependency_record, indent=2).encode() + b"\n"
        entries.append(
            {
                "path": "/source/.tmp/06e/zo-browser-r2/dependency-tree.json",
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            }
        )
    if browser_record is not None:
        raw = json.dumps(browser_record, indent=2).encode() + b"\n"
        entries.append(
            {
                "path": "/source/.tmp/06e/zo-browser-r2/browser-tree.json",
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            }
        )

    budget_raw = json.dumps(budget_record, indent=2).encode() + b"\n"
    entries.append({
        "path": "/source/.tmp/06e/zo-browser-r2/budget-authority.json",
        "sha256": hashlib.sha256(budget_raw).hexdigest(),
        "bytes": len(budget_raw),
    })
    for path, sandbox_path in (
        (PRIOR_LEDGER, "/source/.tmp/06e/zo-browser/budget.json"),
        (PRIOR_RESULT, "/source/.tmp/06e/zo-browser/browser-01/result.json"),
        (PRIOR_ARCHIVE, "/source/.tmp/06e/browser-01-failed-evidence.zip"),
    ):
        entries.append(regular_identity(path, sandbox_path))

    summary = {
        "appInputs": len(app_inputs),
        "buildOutputs": len(output_entries),
        "corePythonFiles": len(core_files),
        "corePythonBytes": sum(path.stat().st_size for path in core_files),
        "proofAndEvaluatorFiles": len(SOURCE_FILES),
        "sourceManifestFiles": len(entries),
    }
    return entries, summary


def collect_tool_entries() -> list[dict]:
    entries = []
    for sandbox_path, expected in TOOLS.items():
        host = Path(sandbox_path)
        assert host.resolve() == host
        identity = regular_identity(host, sandbox_path)
        assert identity["sha256"] == expected
        assert os.access(host, os.X_OK)
        entries.append(identity)
    chromium = regular_identity(BROWSER / "chrome", "/browser/chrome")
    assert chromium["sha256"] == EXPECTED_CHROMIUM_SHA256
    assert os.access(BROWSER / "chrome", os.X_OK)
    entries.append(chromium)
    entries.append(regular_identity(PLAYWRIGHT, PLAYWRIGHT_SANDBOX))
    assert Path("/usr/bin/python3").resolve() == Path("/usr/bin/python3.11")
    return entries


def traffic_manifest() -> dict:
    assets = sorted(
        "/assets/" + path.relative_to(APP / "build/client/assets").as_posix()
        for path in (APP / "build/client/assets").rglob("*")
        if path.is_file()
    )
    assert assets and len(assets) == len(set(assets))
    value = {
        "schema": "vivary.06e-c5-traffic/v1",
        "routeGets": ROUTE_GETS,
        "assetGets": assets,
        "shellGets": SHELL_GETS,
        "chatGets": CHAT_GETS,
        "bootstrapMutations": BOOTSTRAP_MUTATIONS,
        "chatMutations": CHAT_MUTATIONS,
    }
    for key in ("routeGets", "assetGets", "shellGets", "chatGets"):
        assert value[key] == sorted(value[key])
        assert all(isinstance(item, str) and item for item in value[key])
    assert len(value["bootstrapMutations"]) == 1
    assert len(value["chatMutations"]) == 2
    return value


def inspect() -> dict:
    budget_record = prior_budget_authority()
    source_entries, summary = collect_source_entries(None, None, budget_record)
    tools = collect_tool_entries()
    traffic = traffic_manifest()
    assert len(source_entries) == 80 + 212 + 43 + len(SOURCE_FILES) + 4
    return {
        "schema": "vivary.06e-c5-browser-inspection/v1",
        **summary,
        "toolFiles": len(tools),
        "assetGets": len(traffic["assetGets"]),
        "dependencyTreeRead": False,
        "browserTreeRead": False,
        "namespaceExists": BASE.exists(),
        "priorChargedSeconds": budget_record["prior"]["chargedSeconds"],
        "retryTotalSeconds": budget_record["retry"]["totalSeconds"],
        "maximumCombinedChargeSeconds": budget_record["maximumCombinedChargeSeconds"],
    }


def prepare() -> dict:
    assert not BASE.exists(), f"proof namespace already exists: {BASE}"
    budget_record = prior_budget_authority()
    dependency_record = {
        "schema": "vivary.06e-c5-dependency-tree/v1",
        "root": "/app/node_modules",
        **tree_digest(APP / "node_modules"),
    }
    browser_record = {
        "schema": "vivary.06e-c5-browser-tree/v1",
        "root": "/browser",
        **tree_digest(BROWSER),
    }
    source_entries, summary = collect_source_entries(
        dependency_record, browser_record, budget_record
    )
    source = manifest("vivary.06e-c5-source/v1", source_entries)
    tools = manifest("vivary.06e-c5-tools/v1", collect_tool_entries())
    traffic = traffic_manifest()

    budget_raw = json.dumps(budget_record, indent=2).encode() + b"\n"
    dependency_raw = json.dumps(dependency_record, indent=2).encode() + b"\n"
    browser_raw = json.dumps(browser_record, indent=2).encode() + b"\n"
    source_raw = json.dumps(source, indent=2).encode() + b"\n"
    tools_raw = json.dumps(tools, indent=2).encode() + b"\n"
    traffic_raw = json.dumps(traffic, indent=2).encode() + b"\n"
    profile = {
        "schema": "vivary.06e-c5-browser-profile/v1",
        "sourceBindingSha256": source["bindingSha256"],
        "sandbox": {
            "uid": 1000,
            "gid": 1000,
            "pidNamespace": True,
            "network": "loopback-only",
            "filesystem": "private-ro-source",
            "capabilities": "none",
            "noNewPrivileges": True,
        },
        "supervision": {
            "kind": "external-observer",
            "enforcement": "monitored-stop",
            **PROFILE_LIMITS,
        },
        "trafficManifestSha256": hashlib.sha256(traffic_raw).hexdigest(),
    }
    profile_raw = json.dumps(profile, indent=2).encode() + b"\n"

    BASE.mkdir(parents=True, mode=0o700)
    write_atomic(BASE / "budget-authority.json", budget_raw)
    write_atomic(BASE / "dependency-tree.json", dependency_raw)
    write_atomic(BASE / "browser-tree.json", browser_raw)
    write_atomic(BASE / "source-manifest.json", source_raw)
    write_atomic(BASE / "tool-manifest.json", tools_raw)
    write_atomic(BASE / "traffic-manifest.json", traffic_raw)
    write_atomic(BASE / "profile.json", profile_raw)
    write_atomic(BASE / "budget.json", b"[]\n")
    (BASE / "budget.lock").touch(mode=0o600, exist_ok=False)

    receipt = {
        "schema": "vivary.06e-c5-browser-preparation/v1",
        **summary,
        "dependencyTree": dependency_record,
        "browserTree": browser_record,
        "budgetAuthoritySha256": hashlib.sha256(budget_raw).hexdigest(),
        "budgetAuthority": budget_record,
        "sourceManifestSha256": hashlib.sha256(source_raw).hexdigest(),
        "sourceBindingSha256": source["bindingSha256"],
        "toolManifestSha256": hashlib.sha256(tools_raw).hexdigest(),
        "trafficManifestSha256": hashlib.sha256(traffic_raw).hexdigest(),
        "profileSha256": hashlib.sha256(profile_raw).hexdigest(),
        "proofTokenGenerated": False,
        "runtimeStarted": False,
    }
    write_atomic(BASE / "preparation.json", json.dumps(receipt, indent=2).encode() + b"\n")
    return receipt


def validate_tree_record(value: dict, schema: str, root: str) -> None:
    assert set(value) == {
        "schema", "root", "sha256", "files", "links", "directories", "bytes"
    }
    assert value["schema"] == schema
    assert value["root"] == root
    assert len(value["sha256"]) == 64
    assert all(
        isinstance(value[key], int) and not isinstance(value[key], bool) and value[key] >= 0
        for key in ("files", "links", "directories", "bytes")
    )


def verify_boundary(config_path: Path) -> None:
    assert Path("/source").is_dir() and Path("/app").is_dir() and Path("/browser").is_dir()
    config = json.loads(config_path.read_text())
    assert config["schema"] == "vivary.06e-c5-browser-input/v1"
    assert config["deadlineSeconds"] == RETRY_EXECUTION_SECONDS
    assert config["sourceManifestPath"] == "/source/.tmp/06e/zo-browser-r2/source-manifest.json"
    dependency_path = Path("/source/.tmp/06e/zo-browser-r2/dependency-tree.json")
    browser_path = Path("/source/.tmp/06e/zo-browser-r2/browser-tree.json")
    dependency = json.loads(dependency_path.read_text())
    browser = json.loads(browser_path.read_text())
    validate_tree_record(dependency, "vivary.06e-c5-dependency-tree/v1", "/app/node_modules")
    validate_tree_record(browser, "vivary.06e-c5-browser-tree/v1", "/browser")

    source_manifest = json.loads(Path(config["sourceManifestPath"]).read_text())
    listed = {entry["path"]: entry for entry in source_manifest["files"]}
    budget_path = Path("/source/.tmp/06e/zo-browser-r2/budget-authority.json")
    assert prior_budget_authority() == json.loads(budget_path.read_text())
    for path in (dependency_path, browser_path, budget_path, PRIOR_LEDGER, PRIOR_RESULT, PRIOR_ARCHIVE):
        identity = regular_identity(path, str(path))
        assert listed[str(path)] == identity

    assert tree_digest(Path("/app/node_modules")) == {
        key: dependency[key] for key in ("sha256", "files", "links", "directories", "bytes")
    }
    assert tree_digest(Path("/browser")) == {
        key: browser[key] for key in ("sha256", "files", "links", "directories", "bytes")
    }

    runner = "/source/docs/product/multi-project/fixtures/06e/c5_browser_runner.mjs"
    environment = {
        key: value
        for key, value in os.environ.items()
        if key in {
            "PATH", "HOME", "TMPDIR", "LANG", "CI", "NODE_ENV", "AGENT_MODE",
            "AGENT_NATIVE_DISABLE_RECURRING_JOBS",
            "AGENT_NATIVE_DISABLE_INPROCESS_SWEEPS",
        }
    }
    os.execve("/usr/bin/node", ["/usr/bin/node", runner, str(config_path)], environment)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "operation",
        choices=("inspect", "prepare", "verify-boundary"),
    )
    parser.add_argument("config", nargs="?")
    args = parser.parse_args()
    if args.operation == "inspect":
        assert args.config is None
        result = inspect()
    elif args.operation == "prepare":
        assert args.config is None
        result = prepare()
    else:
        assert args.config is not None
        verify_boundary(Path(args.config))
        raise AssertionError("execve returned")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
