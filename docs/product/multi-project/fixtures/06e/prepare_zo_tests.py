#!/usr/bin/env python3
"""Prepare and verify immutable inputs for the bounded 06e Zo C5 tests."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / ".tmp/06e/zo-test"
APP = ROOT / ".tmp/05b/zo-runtime/app"
BUILD_INPUTS = ROOT / ".tmp/05b/zo-runtime/build-04-inputs.json"
CURRENT_COMPONENT = ROOT / "packages/workbench/tests/runtime-activity-component.test.mjs"
CURRENT_CONVERSATION = ROOT / "packages/workbench/app/components/workbench/Conversation.tsx"

EXPECTED_BUILD_INPUTS_SHA256 = "3904745d7a73c805b3662ac51c8da795d9f618d90daa4ee77ad60f1d9a565da1"
EXPECTED_SOURCES = {
    "server/project-runtime-activity.mjs": "f76c8c35763db81411198ca4843351ab97a71f8e11afd446a916a89d1439147d",
    "app/lib/runtime-activity-schema.ts": "6006871c28ce80125c1b2b4ea537cabd4705e4c1fe597303824f8a1a31ecea2d",
    "app/components/workbench/Conversation.tsx": "95c473972df8dfae3c1ce704a0668700e03fed37186846c572829b8da61567b8",
    "tests/project-runtime-activity.test.mjs": "004bd7a8684734147f54e9c3c0064a0cee52a186e616826ad993e82acd7cb124",
}
EXPECTED_COMPONENT_PREIMAGE = "8165ff26c60b7c813e73bb1203479c02736965cabdabc700972dc79bb15848dc"
EXPECTED_COMPONENT_PORTABLE = "4bd477ea9fa90722215edacbbb72844f1a4ba4d80964af2dd873f79c0d24b4c4"
EXPECTED_TOOLS = {
    "/usr/bin/node": "d1de76d8edf2fededf6f8b30d244e2c0529ac607923a018283b77e9c74bd932c",
    "/usr/bin/bwrap": "85580dd52ed366ece8844e90fa75ac7c4de8802963071344e123221fb9f6f11e",
    "/usr/bin/unshare": "9fb85770a4a0b5cb2bff8e64c2934dd1b0674eaaae18fd550dea2520c69a45d9",
    "/usr/bin/setpriv": "d5839b20edb0d77222b1e11be7d155c7122d381dbfad40876b0def7dd710f5bd",
    "/usr/bin/python3": "a83c0370d91532c96d4060a0e7c107d1f2889dad8a98e03395e86ef0373fd467",
}
PACKAGE_INPUTS = {
    "esbuild": ("/app/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/package.json", "esbuild", "0.28.2"),
    "esbuildNative": ("/app/node_modules/.pnpm/@esbuild+linux-x64@0.28.2/node_modules/@esbuild/linux-x64/package.json", "@esbuild/linux-x64", "0.28.2"),
    "linkedom": ("/app/node_modules/.pnpm/linkedom@0.18.12/node_modules/linkedom/package.json", "linkedom", "0.18.12"),
    "react": ("/app/node_modules/.pnpm/react@19.2.8/node_modules/react/package.json", "react", "19.2.8"),
    "reactDom": ("/app/node_modules/.pnpm/react-dom@19.2.8_react@19.2.8/node_modules/react-dom/package.json", "react-dom", "19.2.8"),
    "reactQuery": ("/app/node_modules/.pnpm/@tanstack+react-query@5.102.8_react@19.2.8/node_modules/@tanstack/react-query/package.json", "@tanstack/react-query", "5.102.8"),
    "zod": ("/app/node_modules/.pnpm/zod@4.5.4/node_modules/zod/package.json", "zod", "4.5.4"),
}
CORE_SANDBOX = "/app/node_modules/.pnpm/@agent-native+core@0.176.5_bf18bb7e1a4fb93368c4bdb4b1346da4/node_modules/@agent-native/core/package.json"
ESBUILD_SANDBOX = "/app/node_modules/.pnpm/@esbuild+linux-x64@0.28.2/node_modules/@esbuild/linux-x64/bin/esbuild"
ESBUILD_SHA256 = "e1698a3d5c6c0798fee4fd3b5cc816651f460c63d390a7a26ea4beb0b1884100"
MUTANT_NEEDLE = b" key={rendererKey}"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def host_path(sandbox_path: str) -> Path:
    assert sandbox_path.startswith("/app/")
    return APP / sandbox_path.removeprefix("/app/")


def tree_digest(root: Path) -> dict:
    digest = hashlib.sha256()
    files = links = directories = total_bytes = 0
    entries = sorted(root.rglob("*"), key=lambda path: path.relative_to(root).as_posix().encode())
    for path in entries:
        relative = path.relative_to(root).as_posix().encode()
        if path.is_symlink():
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
            raise AssertionError(f"unsupported dependency entry: {relative!r}")
    return {
        "sha256": digest.hexdigest(), "files": files, "links": links,
        "directories": directories, "bytes": total_bytes,
    }


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".new")
    with temporary.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def verify_build_snapshot() -> dict:
    assert sha(BUILD_INPUTS) == EXPECTED_BUILD_INPUTS_SHA256
    manifest = json.loads(BUILD_INPUTS.read_text())
    entries = manifest["files"]
    assert len(entries) == 80
    for entry in entries:
        candidate = APP / entry["path"]
        assert candidate.is_file()
        assert sha(candidate) == entry["sha256"]
        assert candidate.stat().st_size == entry["bytes"]
    return manifest


def collect(dependency_tree: dict | None = None) -> dict:
    build_manifest = verify_build_snapshot()
    if dependency_tree is None:
        dependency_tree = tree_digest(APP / "node_modules")
    copied = {}
    for relative, expected in EXPECTED_SOURCES.items():
        canonical = ROOT / "packages/workbench" / relative
        snapshot = APP / relative
        assert sha(canonical) == expected
        assert sha(snapshot) == expected
        copied[relative] = expected
    assert sha(CURRENT_COMPONENT) == EXPECTED_COMPONENT_PORTABLE
    snapshot_component = APP / "tests/runtime-activity-component.test.mjs"
    assert sha(snapshot_component) == EXPECTED_COMPONENT_PREIMAGE

    packages = {}
    package_evidence = {}
    for key, (sandbox_path, name, version) in PACKAGE_INPUTS.items():
        path = host_path(sandbox_path)
        manifest = json.loads(path.read_text())
        assert {"name": manifest["name"], "version": manifest["version"]} == {"name": name, "version": version}
        packages[key] = sandbox_path
        package_evidence[key] = {"path": sandbox_path, "sha256": sha(path), "name": name, "version": version}

    core_path = host_path(CORE_SANDBOX)
    core = json.loads(core_path.read_text())
    assert {"name": core["name"], "version": core["version"]} == {"name": "@agent-native/core", "version": "0.176.5"}
    esbuild_path = host_path(ESBUILD_SANDBOX)
    assert sha(esbuild_path) == ESBUILD_SHA256
    assert os.access(esbuild_path, os.X_OK)
    for path, expected in EXPECTED_TOOLS.items():
        assert sha(Path(path)) == expected

    original = CURRENT_CONVERSATION.read_bytes()
    assert original.count(MUTANT_NEEDLE) == 1
    mutant = original.replace(MUTANT_NEEDLE, b"", 1)
    return {
        "build": build_manifest,
        "buildInputs": BUILD_INPUTS.read_bytes(),
        "component": CURRENT_COMPONENT.read_bytes(),
        "mutant": mutant,
        "mutantWrapper": Path(__file__).with_name("assert_runtime_activity_mutant.mjs").read_bytes(),
        "boundary": Path(__file__).with_name("boundary_exec.py").read_bytes(),
        "manifest": {"schemaVersion": 1, "packages": packages},
        "freeze": {
            "schemaVersion": 1,
            "namespace": "06e-zo-c5-focused-tests",
            "reusedBuildInputs": {"path": str(BUILD_INPUTS.relative_to(ROOT)), "sha256": EXPECTED_BUILD_INPUTS_SHA256, "files": 80},
            "copiedCurrentSources": copied,
            "testOnlyDelta": {
                "path": "packages/workbench/tests/runtime-activity-component.test.mjs",
                "preimageSha256": EXPECTED_COMPONENT_PREIMAGE,
                "portableSha256": EXPECTED_COMPONENT_PORTABLE,
                "portableBytes": CURRENT_COMPONENT.stat().st_size,
            },
            "mutant": {
                "sourceSha256": EXPECTED_SOURCES["app/components/workbench/Conversation.tsx"],
                "sha256": hashlib.sha256(mutant).hexdigest(),
                "bytes": len(mutant),
                "replacementCount": 1,
                "removed": MUTANT_NEEDLE.decode(),
            },
            "dependencies": package_evidence,
            "core": {"path": CORE_SANDBOX, "sha256": sha(core_path), "name": core["name"], "version": core["version"]},
            "esbuildBinary": {"path": ESBUILD_SANDBOX, "sha256": ESBUILD_SHA256},
            "dependencyTree": dependency_tree,
            "tools": EXPECTED_TOOLS,
            "proofTools": {
                str(path.relative_to(ROOT)): sha(path)
                for path in (Path(__file__), Path(__file__).with_name("zo_test_supervisor.py"),
                             Path(__file__).with_name("boundary_exec.py"),
                             Path(__file__).with_name("assert_runtime_activity_mutant.mjs"))
            },
        },
    }


def prepare() -> None:
    assert not BASE.exists(), f"proof namespace already exists: {BASE}"
    values = collect()
    BASE.mkdir(parents=True)
    write_atomic(BASE / "build-04-inputs.json", values["buildInputs"])
    write_atomic(BASE / "component-dependencies.json", (json.dumps(values["manifest"], indent=2) + "\n").encode())
    write_atomic(BASE / "runtime-activity-component.test.mjs", values["component"])
    write_atomic(BASE / "Conversation.missing-key.tsx", values["mutant"])
    write_atomic(BASE / "assert_runtime_activity_mutant.mjs", values["mutantWrapper"])
    write_atomic(BASE / "boundary_exec.py", values["boundary"])
    write_atomic(BASE / "source-freeze.json", (json.dumps(values["freeze"], indent=2) + "\n").encode())
    write_atomic(BASE / "budget.json", b"[]\n")
    (BASE / "budget.lock").touch(exist_ok=False)


def check() -> None:
    assert BASE.is_dir()
    retained_freeze = json.loads((BASE / "source-freeze.json").read_text())
    dependency_tree = retained_freeze["dependencyTree"]
    assert set(dependency_tree) == {"sha256", "files", "links", "directories", "bytes"}
    assert re.fullmatch(r"[0-9a-f]{64}", dependency_tree["sha256"])
    assert all(isinstance(dependency_tree[key], int) and dependency_tree[key] >= 0
               for key in ("files", "links", "directories", "bytes"))
    values = collect(dependency_tree)
    expected = {
        "build-04-inputs.json": values["buildInputs"],
        "component-dependencies.json": (json.dumps(values["manifest"], indent=2) + "\n").encode(),
        "runtime-activity-component.test.mjs": values["component"],
        "Conversation.missing-key.tsx": values["mutant"],
        "assert_runtime_activity_mutant.mjs": values["mutantWrapper"],
        "boundary_exec.py": values["boundary"],
        "source-freeze.json": (json.dumps(values["freeze"], indent=2) + "\n").encode(),
    }
    for name, content in expected.items():
        path = BASE / name
        assert path.is_file()
        assert path.read_bytes() == content
    ledger = json.loads((BASE / "budget.json").read_text())
    assert isinstance(ledger, list)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("prepare", "check"))
    args = parser.parse_args()
    prepare() if args.operation == "prepare" else check()
    print(json.dumps({"operation": args.operation, "status": "ok"}, sort_keys=True))
