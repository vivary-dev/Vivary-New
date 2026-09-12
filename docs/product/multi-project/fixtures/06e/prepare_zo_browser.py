#!/usr/bin/env python3
"""Prepare and attest immutable inputs for the bounded 06e C5 browser proof."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / ".tmp/06e/zo-browser-r8"
R1_BASE = ROOT / ".tmp/06e/zo-browser"
R1_LEDGER = R1_BASE / "budget.json"
R1_RESULT = R1_BASE / "browser-01/result.json"
R1_ARCHIVE = ROOT / ".tmp/06e/browser-01-failed-evidence.zip"
R2_BASE = ROOT / ".tmp/06e/zo-browser-r2"
R2_LEDGER = R2_BASE / "budget.json"
R2_RESULT = R2_BASE / "browser-02/result.json"
R2_ARCHIVE = ROOT / ".tmp/06e/browser-02-failed-evidence.zip"
R3_BASE = ROOT / ".tmp/06e/zo-browser-r3"
R3_LEDGER = R3_BASE / "budget.json"
R3_RESULT = R3_BASE / "browser-03/result.json"
R3_ARCHIVE = ROOT / ".tmp/06e/browser-03-failed-evidence.zip"
R4_BASE = ROOT / ".tmp/06e/zo-browser-r4"
R4_LEDGER = R4_BASE / "budget.json"
R4_RESULT = R4_BASE / "browser-04/result.json"
R4_ARCHIVE = ROOT / ".tmp/06e/browser-04-failed-evidence.zip"
R5_BASE = ROOT / ".tmp/06e/zo-browser-r5"
R5_LEDGER = R5_BASE / "budget.json"
R5_RESULT = R5_BASE / "browser-05/result.json"
R5_ARCHIVE = ROOT / ".tmp/06e/browser-05-failed-evidence.zip"
R6_BASE = ROOT / ".tmp/06e/zo-browser-r6"
R6_LEDGER = R6_BASE / "budget.json"
R6_RESULT = R6_BASE / "browser-06/result.json"
R6_ARCHIVE = ROOT / ".tmp/06e/browser-06-failed-evidence.zip"
R7_BASE = ROOT / ".tmp/06e/zo-browser-r7"
R7_LEDGER = R7_BASE / "budget.json"
R7_RESULT = R7_BASE / "browser-07/result.json"
R7_ARCHIVE = ROOT / ".tmp/06e/browser-07-failed-evidence.zip"
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
CORE_DIST = (
    APP
    / "node_modules/.pnpm/@agent-native+core@0.176.5_bf18bb7e1a4fb93368c4bdb4b1346da4/"
    "node_modules/@agent-native/core/dist"
)

EXPECTED_R1_LEDGER_SHA256 = (
    "f7e5d3dddb92a5453947e8f508ce18d0a63bb661546e0baa75462750691bbc55"
)
EXPECTED_R1_RESULT_SHA256 = (
    "39a2280c5b1040fe884691a583e5f12b55188f9c1761ef99443e2c6ec26dbf9f"
)
EXPECTED_R1_ARCHIVE_SHA256 = (
    "3d6be2d7a802a3d0551222b04d6d83e090ca5861251249f7107a6399720f8fc4"
)
EXPECTED_R2_LEDGER_SHA256 = (
    "ed8df562b0de4c3c18632cc0e38b5ec93157f621aec6eb48487f6695a44d8c1d"
)
EXPECTED_R2_RESULT_SHA256 = (
    "ed654f8090101b21fe140a2c72fe157a36cdc20b3908b00cfb5c8c595cca24f2"
)
EXPECTED_R2_ARCHIVE_SHA256 = (
    "866c7f989fc5230714104464785b7bcde730730e087c09ab15a9518f99172d36"
)
EXPECTED_R3_LEDGER_SHA256 = (
    "0187e8028ff6f12a0cfcf749c1b0ae299415323ec0b6aeb33b05b99e3c0629b6"
)
EXPECTED_R3_RESULT_SHA256 = (
    "ac7929e7653b27f6854308a1856f06f9e724ef89b407ac82e621eed52501c0c3"
)
EXPECTED_R3_ARCHIVE_SHA256 = (
    "b1b45eb1c7864c1bd48267041c6cc39881ffbf7e7cdec74104a6b9c4b9ccde65"
)
EXPECTED_R4_LEDGER_SHA256 = (
    "7638309ae90a2ce1a4771b7c0cdf2612941f628c4dd83840e11080794dd99a27"
)
EXPECTED_R4_RESULT_SHA256 = (
    "117d047b25e1e5bb303811d9df6564f20d889632cdaa1172c72679a2bd0ae73c"
)
EXPECTED_R4_ARCHIVE_SHA256 = (
    "bc184bea2d34514f176809b36fb1c20c7a0120a3444c33d1dc0e600ab2c897a7"
)
EXPECTED_R5_LEDGER_SHA256 = (
    "ae91b12707ce018d3abb12b650b93d87f31684f3fe6b57b8b427eec63c1d16e8"
)
EXPECTED_R5_RESULT_SHA256 = (
    "c280f80048ecbff311256dff6bb8216dc7d2136a94ddead01062edbfe9beba32"
)
EXPECTED_R5_ARCHIVE_SHA256 = (
    "57654ac65f21a509ba70f4c50e9bfc46ada3672f6f1a257673b921d9ae56d466"
)
EXPECTED_R6_LEDGER_SHA256 = (
    "208eb657469509646468a0edc1c2b9cb12946d8b985c97651d308b914fb1a6e5"
)
EXPECTED_R6_RESULT_SHA256 = (
    "69468c85dedf132781609d85f93a35acddef0ad2295ebeff63b7c913d48af1e8"
)
EXPECTED_R6_ARCHIVE_SHA256 = (
    "b74a65e0d1cb8e5269979d15b71d2e47d964d4e8bf729b42e5621ffb6d43fa17"
)
EXPECTED_R7_LEDGER_SHA256 = (
    "164b1c3182b8ebd6d2214762504fc11b1c12d66655ce82736897cd48d0d03902"
)
EXPECTED_R7_RESULT_SHA256 = (
    "f93cb2ba26950808950e3194e8cec9b6d636f13ae04c0f3534adac8ec48d0cec"
)
EXPECTED_R7_ARCHIVE_SHA256 = (
    "e2ded5d50b91becace4c7cb615f81f98a86c9314e52593324d16f28b67c3104b"
)
R1_CHARGED_SECONDS = 37.09076154699869
R2_CHARGED_SECONDS = 36.77261576199817
R3_CHARGED_SECONDS = 45.64586168799724
R4_CHARGED_SECONDS = 39.821340925002005
R5_CHARGED_SECONDS = 69.6513385480066
R6_CHARGED_SECONDS = 70.05210709999665
R7_CHARGED_SECONDS = 47.22683318899999
PRIOR_CHARGED_SECONDS = (
    R1_CHARGED_SECONDS + R2_CHARGED_SECONDS + R3_CHARGED_SECONDS
    + R4_CHARGED_SECONDS + R5_CHARGED_SECONDS + R6_CHARGED_SECONDS
    + R7_CHARGED_SECONDS
)
ORIGINAL_TOTAL_SECONDS = 365
SUPPLEMENTAL_ALLOCATION = {
    "seconds": 120,
    "attempts": 1,
    "sourceAuthority": (
        "docs/product/multi-project/design.md"
        "#c5-supplemental-browser-allocation-2026-09-12"
    ),
}
RETRY_EXECUTION_SECONDS = 115
RETRY_CLEANUP_SECONDS = 5
RETRY_TOTAL_SECONDS = 120

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
INITIALIZER_SOURCE_SHA256 = {
    CORE_DIST / "integrations/pending-tasks-retry-job.js": (
        "232da2b9ad1ce049af91e732763c6a92c82cdf83729e1aa089f5a685cc1e5c80"
    ),
    CORE_DIST / "integrations/a2a-continuation-processor.js": (
        "9bf4b54ada66dbcdd2a662f6c02c2e41eedd67b6b4bb9443599624e40af4f82b"
    ),
    CORE_DIST / "integrations/remote-retry-job.js": (
        "f9fab770d899dce7d6433bad8409fb59dc3a853ce276d3b78be4758acb0cf6bf"
    ),
    CORE_DIST / "integrations/remote-push-delivery.js": (
        "2b762005974e289fb8e1116b922702fb5dba711414a89ca310a0aef874be0e8e"
    ),
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
    *INITIALIZER_SOURCE_SHA256,
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
    specs = (
        {
            "name": "browser-01",
            "charge": R1_CHARGED_SECONDS,
            "ledgerPath": R1_LEDGER,
            "ledgerSha256": EXPECTED_R1_LEDGER_SHA256,
            "resultPath": R1_RESULT,
            "resultSha256": EXPECTED_R1_RESULT_SHA256,
            "archivePath": R1_ARCHIVE,
            "archiveSha256": EXPECTED_R1_ARCHIVE_SHA256,
            "expectedPriorCharge": None,
            "browserStarted": False,
        },
        {
            "name": "browser-02",
            "charge": R2_CHARGED_SECONDS,
            "ledgerPath": R2_LEDGER,
            "ledgerSha256": EXPECTED_R2_LEDGER_SHA256,
            "resultPath": R2_RESULT,
            "resultSha256": EXPECTED_R2_RESULT_SHA256,
            "archivePath": R2_ARCHIVE,
            "archiveSha256": EXPECTED_R2_ARCHIVE_SHA256,
            "expectedPriorCharge": R1_CHARGED_SECONDS,
            "browserStarted": False,
        },
        {
            "name": "browser-03",
            "charge": R3_CHARGED_SECONDS,
            "ledgerPath": R3_LEDGER,
            "ledgerSha256": EXPECTED_R3_LEDGER_SHA256,
            "resultPath": R3_RESULT,
            "resultSha256": EXPECTED_R3_RESULT_SHA256,
            "archivePath": R3_ARCHIVE,
            "archiveSha256": EXPECTED_R3_ARCHIVE_SHA256,
            "expectedPriorCharge": R1_CHARGED_SECONDS + R2_CHARGED_SECONDS,
            "browserStarted": True,
        },
        {
            "name": "browser-04",
            "charge": R4_CHARGED_SECONDS,
            "ledgerPath": R4_LEDGER,
            "ledgerSha256": EXPECTED_R4_LEDGER_SHA256,
            "resultPath": R4_RESULT,
            "resultSha256": EXPECTED_R4_RESULT_SHA256,
            "archivePath": R4_ARCHIVE,
            "archiveSha256": EXPECTED_R4_ARCHIVE_SHA256,
            "expectedPriorCharge": (
                R1_CHARGED_SECONDS + R2_CHARGED_SECONDS + R3_CHARGED_SECONDS
            ),
            "browserStarted": True,
        },
        {
            "name": "browser-05",
            "charge": R5_CHARGED_SECONDS,
            "ledgerPath": R5_LEDGER,
            "ledgerSha256": EXPECTED_R5_LEDGER_SHA256,
            "resultPath": R5_RESULT,
            "resultSha256": EXPECTED_R5_RESULT_SHA256,
            "archivePath": R5_ARCHIVE,
            "archiveSha256": EXPECTED_R5_ARCHIVE_SHA256,
            "expectedPriorCharge": (
                R1_CHARGED_SECONDS + R2_CHARGED_SECONDS + R3_CHARGED_SECONDS
                + R4_CHARGED_SECONDS
            ),
            "browserStarted": True,
        },
        {
            "name": "browser-06",
            "charge": R6_CHARGED_SECONDS,
            "ledgerPath": R6_LEDGER,
            "ledgerSha256": EXPECTED_R6_LEDGER_SHA256,
            "resultPath": R6_RESULT,
            "resultSha256": EXPECTED_R6_RESULT_SHA256,
            "archivePath": R6_ARCHIVE,
            "archiveSha256": EXPECTED_R6_ARCHIVE_SHA256,
            "expectedPriorCharge": (
                R1_CHARGED_SECONDS + R2_CHARGED_SECONDS + R3_CHARGED_SECONDS
                + R4_CHARGED_SECONDS + R5_CHARGED_SECONDS
            ),
            "browserStarted": True,
        },
        {
            "name": "browser-07",
            "charge": R7_CHARGED_SECONDS,
            "ledgerPath": R7_LEDGER,
            "ledgerSha256": EXPECTED_R7_LEDGER_SHA256,
            "resultPath": R7_RESULT,
            "resultSha256": EXPECTED_R7_RESULT_SHA256,
            "archivePath": R7_ARCHIVE,
            "archiveSha256": EXPECTED_R7_ARCHIVE_SHA256,
            "expectedPriorCharge": (
                R1_CHARGED_SECONDS + R2_CHARGED_SECONDS + R3_CHARGED_SECONDS
                + R4_CHARGED_SECONDS + R5_CHARGED_SECONDS + R6_CHARGED_SECONDS
            ),
            "browserStarted": True,
        },
    )
    attempts = []
    observed_charges = []
    for spec in specs:
        assert sha(spec["ledgerPath"]) == spec["ledgerSha256"]
        assert sha(spec["resultPath"]) == spec["resultSha256"]
        assert sha(spec["archivePath"]) == spec["archiveSha256"]
        ledger = json.loads(spec["ledgerPath"].read_text())
        assert isinstance(ledger, list) and len(ledger) == 1
        entry = ledger[0]
        assert entry["name"] == spec["name"]
        assert entry["status"] == "finished"
        assert entry["chargedSeconds"] == spec["charge"]
        assert entry["resultFailure"] == "child-failed"
        assert entry["resultSha256"] == spec["resultSha256"]
        result = json.loads(spec["resultPath"].read_text())
        assert result["schema"] == "vivary.06e-c5-browser-supervisor-result/v1"
        assert result["name"] == spec["name"]
        assert result["returncode"] == 1
        assert result["failure"] == "child-failed"
        assert result["refusal"] is None
        assert result["elapsedSecondsIncludingDispatchAndCleanup"] == spec["charge"]
        assert result["cleanupAbsent"] is True
        assert result["remainingPids"] == []
        assert result["supervisorTermSignaledPids"] == []
        assert result["supervisorKillSignaledPids"] == []
        assert result["passingRunSupervisorEscalation"] is False
        assert bool(result["chromiumLaunches"]) is spec["browserStarted"]
        assert result["runnerResultSha256"] is None
        if spec["expectedPriorCharge"] is not None:
            assert entry["priorChargedSeconds"] == spec["expectedPriorCharge"]
            assert entry["combinedChargedSeconds"] == sum(observed_charges) + spec["charge"]
            assert result["priorChargedSeconds"] == spec["expectedPriorCharge"]
            assert result["currentChargedSeconds"] == spec["charge"]
            assert result["combinedChargedSeconds"] == sum(observed_charges) + spec["charge"]
            assert result["originalBudgetOverrun"] is False
        observed_charges.append(spec["charge"])
        attempts.append({
            "name": spec["name"],
            "chargedSeconds": spec["charge"],
            "failure": "child-failed",
            "refusal": None,
            "cleanupAbsent": True,
            "browserStarted": spec["browserStarted"],
            "ledger": {
                "path": "/source/" + spec["ledgerPath"].relative_to(ROOT).as_posix(),
                "sha256": spec["ledgerSha256"],
                "bytes": spec["ledgerPath"].stat().st_size,
            },
            "result": {
                "path": "/source/" + spec["resultPath"].relative_to(ROOT).as_posix(),
                "sha256": spec["resultSha256"],
                "bytes": spec["resultPath"].stat().st_size,
            },
            "archive": {
                "path": "/source/" + spec["archivePath"].relative_to(ROOT).as_posix(),
                "sha256": spec["archiveSha256"],
                "bytes": spec["archivePath"].stat().st_size,
            },
        })
    prior_total = sum(observed_charges)
    assert prior_total == PRIOR_CHARGED_SECONDS
    assert prior_total <= ORIGINAL_TOTAL_SECONDS
    assert RETRY_TOTAL_SECONDS == SUPPLEMENTAL_ALLOCATION["seconds"]
    assert RETRY_TOTAL_SECONDS == RETRY_EXECUTION_SECONDS + RETRY_CLEANUP_SECONDS
    return {
        "schema": "vivary.06e-c5-browser-budget-authority/v3",
        "originalTotalSeconds": ORIGINAL_TOTAL_SECONDS,
        "originalChargedSeconds": prior_total,
        "originalRemainingSeconds": ORIGINAL_TOTAL_SECONDS - prior_total,
        "priorAttempts": attempts,
        "priorChargedSeconds": prior_total,
        "supplementalAllocation": SUPPLEMENTAL_ALLOCATION,
        "retry": {
            "name": "browser-08",
            "allocation": "supplemental",
            "executionSeconds": RETRY_EXECUTION_SECONDS,
            "cleanupSeconds": RETRY_CLEANUP_SECONDS,
            "totalSeconds": RETRY_TOTAL_SECONDS,
            "originalRemainingAvailableSeconds": 0,
        },
        "totalAllocatedSeconds": ORIGINAL_TOTAL_SECONDS + RETRY_TOTAL_SECONDS,
        "maximumCombinedChargeSeconds": prior_total + RETRY_TOTAL_SECONDS,
        "remainingUnallocatedSeconds": ORIGINAL_TOTAL_SECONDS - prior_total,
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
    for path, expected in INITIALIZER_SOURCE_SHA256.items():
        assert sha(path) == expected
    entries.extend(
        regular_identity(path, "/source/" + path.relative_to(ROOT).as_posix())
        for path in SOURCE_FILES
    )

    if dependency_record is not None:
        raw = json.dumps(dependency_record, indent=2).encode() + b"\n"
        entries.append(
            {
                "path": "/source/.tmp/06e/zo-browser-r8/dependency-tree.json",
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            }
        )
    if browser_record is not None:
        raw = json.dumps(browser_record, indent=2).encode() + b"\n"
        entries.append(
            {
                "path": "/source/.tmp/06e/zo-browser-r8/browser-tree.json",
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            }
        )

    budget_raw = json.dumps(budget_record, indent=2).encode() + b"\n"
    entries.append({
        "path": "/source/.tmp/06e/zo-browser-r8/budget-authority.json",
        "sha256": hashlib.sha256(budget_raw).hexdigest(),
        "bytes": len(budget_raw),
    })
    for attempt in budget_record["priorAttempts"]:
        for kind in ("ledger", "result", "archive"):
            identity = attempt[kind]
            host = ROOT / identity["path"].removeprefix("/source/")
            assert regular_identity(host, identity["path"]) == identity
            entries.append(identity)

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
    assert len(source_entries) == 80 + 212 + 43 + len(SOURCE_FILES) + 22
    return {
        "schema": "vivary.06e-c5-browser-inspection/v1",
        **summary,
        "toolFiles": len(tools),
        "assetGets": len(traffic["assetGets"]),
        "dependencyTreeRead": False,
        "browserTreeRead": False,
        "namespaceExists": BASE.exists(),
        "priorAttempts": len(budget_record["priorAttempts"]),
        "priorChargedSeconds": budget_record["priorChargedSeconds"],
        "retryTotalSeconds": budget_record["retry"]["totalSeconds"],
        "originalRemainingSeconds": budget_record["originalRemainingSeconds"],
        "supplementalAllocation": budget_record["supplementalAllocation"],
        "totalAllocatedSeconds": budget_record["totalAllocatedSeconds"],
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
    assert config["sourceManifestPath"] == "/source/.tmp/06e/zo-browser-r8/source-manifest.json"
    dependency_path = Path("/source/.tmp/06e/zo-browser-r8/dependency-tree.json")
    browser_path = Path("/source/.tmp/06e/zo-browser-r8/browser-tree.json")
    dependency = json.loads(dependency_path.read_text())
    browser = json.loads(browser_path.read_text())
    validate_tree_record(dependency, "vivary.06e-c5-dependency-tree/v1", "/app/node_modules")
    validate_tree_record(browser, "vivary.06e-c5-browser-tree/v1", "/browser")

    source_manifest = json.loads(Path(config["sourceManifestPath"]).read_text())
    listed = {entry["path"]: entry for entry in source_manifest["files"]}
    budget_path = Path("/source/.tmp/06e/zo-browser-r8/budget-authority.json")
    assert prior_budget_authority() == json.loads(budget_path.read_text())
    prior_paths = [
        ROOT / identity["path"].removeprefix("/source/")
        for attempt in json.loads(budget_path.read_text())["priorAttempts"]
        for identity in (attempt["ledger"], attempt["result"], attempt["archive"])
    ]
    for path in (dependency_path, browser_path, budget_path, *prior_paths):
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
