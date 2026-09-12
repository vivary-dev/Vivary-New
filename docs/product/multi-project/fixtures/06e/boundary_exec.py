#!/usr/bin/env python3
"""Attest the 06e sandbox and execute one fixed C5 test command."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys

EXPECTED_TOOLS = {
    "/usr/bin/node": "d1de76d8edf2fededf6f8b30d244e2c0529ac607923a018283b77e9c74bd932c",
    "/usr/bin/bwrap": "85580dd52ed366ece8844e90fa75ac7c4de8802963071344e123221fb9f6f11e",
    "/usr/bin/unshare": "9fb85770a4a0b5cb2bff8e64c2934dd1b0674eaaae18fd550dea2520c69a45d9",
    "/usr/bin/setpriv": "d5839b20edb0d77222b1e11be7d155c7122d381dbfad40876b0def7dd710f5bd",
    "/usr/bin/python3": "a83c0370d91532c96d4060a0e7c107d1f2889dad8a98e03395e86ef0373fd467",
}
CORE = "/app/node_modules/.pnpm/@agent-native+core@0.176.5_bf18bb7e1a4fb93368c4bdb4b1346da4/node_modules/@agent-native/core/package.json"
ESBUILD = "/app/node_modules/.pnpm/@esbuild+linux-x64@0.28.2/node_modules/@esbuild/linux-x64/bin/esbuild"
ESBUILD_SHA256 = "e1698a3d5c6c0798fee4fd3b5cc816651f460c63d390a7a26ea4beb0b1884100"
COMPONENT = "/app/tests/runtime-activity-component.test.mjs"
CONVERSATION = "/app/app/components/workbench/Conversation.tsx"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


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


def status_fields() -> dict[str, str]:
    fields = {}
    for line in Path("/proc/self/status").read_text().splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key] = value.strip()
    return fields


def mount_options(target: str) -> dict:
    matches = []
    for line in Path("/proc/self/mountinfo").read_text().splitlines():
        left, right = line.split(" - ", 1)
        fields = left.split()
        if fields[4].replace("\\040", " ") == target:
            matches.append({"options": fields[5].split(","), "filesystem": right.split()[0]})
    assert len(matches) == 1, f"expected one mount for {target}: {matches}"
    return matches[0]


def namespace(name: str) -> str:
    return os.readlink(f"/proc/self/ns/{name}")


def attest(mode: str) -> dict:
    assert mode in {"activity", "component", "mutant"}
    freeze = json.loads(Path("/proof/source-freeze.json").read_text())
    assert freeze["schemaVersion"] == 1
    assert freeze["namespace"] == "06e-zo-c5-focused-tests"
    dependency_tree = freeze["dependencyTree"]
    assert set(dependency_tree) == {"sha256", "files", "links", "directories", "bytes"}
    assert re.fullmatch(r"[0-9a-f]{64}", dependency_tree["sha256"])
    assert all(isinstance(dependency_tree[key], int) and dependency_tree[key] >= 0
               for key in ("files", "links", "directories", "bytes"))
    manifest = json.loads(Path("/proof/component-dependencies.json").read_text())
    assert manifest["schemaVersion"] == 1
    assert sorted(manifest) == ["packages", "schemaVersion"]
    assert sorted(manifest["packages"]) == [
        "esbuild", "esbuildNative", "linkedom", "react", "reactDom", "reactQuery", "zod",
    ]

    status = status_fields()
    assert os.getuid() == os.geteuid() == 1000
    assert os.getgid() == os.getegid() == 1000
    assert status["NoNewPrivs"] == "1"
    capabilities = {
        name: int(status[name], 16)
        for name in ("CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb")
    }
    assert capabilities == {name: 0 for name in capabilities}
    namespaces = {name: namespace(name) for name in ("user", "pid", "net", "mnt")}
    for name, value in namespaces.items():
        assert value != os.environ[f"VIVARY_HOST_{name.upper()}_NS"]
    affinity = sorted(os.sched_getaffinity(0))
    expected_affinity = [int(value) for value in os.environ["VIVARY_EXPECTED_AFFINITY"].split(",")]
    assert affinity == expected_affinity
    interfaces = [
        line.split(":", 1)[0].strip()
        for line in Path("/proc/net/dev").read_text().splitlines()[2:]
        if ":" in line
    ]
    assert interfaces == ["lo"]

    mounts = {
        "/app": mount_options("/app"),
        "/work": mount_options("/work"),
        "/proof/boundary_exec.py": mount_options("/proof/boundary_exec.py"),
    }
    assert "ro" in mounts["/app"]["options"]
    assert "rw" in mounts["/work"]["options"]
    assert "ro" in mounts["/proof/boundary_exec.py"]["options"]
    mounts["/proof/assert_runtime_activity_mutant.mjs"] = mount_options(
        "/proof/assert_runtime_activity_mutant.mjs"
    )
    assert "ro" in mounts["/proof/assert_runtime_activity_mutant.mjs"]["options"]
    for proof_input in ("/proof/source-freeze.json", "/proof/component-dependencies.json",
                        "/proof/build-04-inputs.json"):
        mounts[proof_input] = mount_options(proof_input)
        assert "ro" in mounts[proof_input]["options"]
    proof_tools = freeze["proofTools"]
    assert sha(Path("/proof/boundary_exec.py")) == proof_tools[
        "docs/product/multi-project/fixtures/06e/boundary_exec.py"
    ]
    assert sha(Path("/proof/assert_runtime_activity_mutant.mjs")) == proof_tools[
        "docs/product/multi-project/fixtures/06e/assert_runtime_activity_mutant.mjs"
    ]
    if mode in {"component", "mutant"}:
        mounts[COMPONENT] = mount_options(COMPONENT)
        assert "ro" in mounts[COMPONENT]["options"]
    if mode == "mutant":
        mounts[CONVERSATION] = mount_options(CONVERSATION)
        assert "ro" in mounts[CONVERSATION]["options"]

    for path, expected in EXPECTED_TOOLS.items():
        assert sha(Path(path)) == expected
    assert sha(Path(ESBUILD)) == ESBUILD_SHA256
    assert os.access(ESBUILD, os.X_OK)
    assert tree_digest(Path("/app/node_modules")) == freeze["dependencyTree"]

    build_inputs_path = Path("/proof/build-04-inputs.json")
    assert sha(build_inputs_path) == freeze["reusedBuildInputs"]["sha256"]
    build_inputs = json.loads(build_inputs_path.read_text())
    assert len(build_inputs["files"]) == freeze["reusedBuildInputs"]["files"] == 80
    for entry in build_inputs["files"]:
        expected_hash = entry["sha256"]
        expected_bytes = entry["bytes"]
        if mode in {"component", "mutant"} and entry["path"] == "tests/runtime-activity-component.test.mjs":
            expected_hash = freeze["testOnlyDelta"]["portableSha256"]
            expected_bytes = freeze["testOnlyDelta"]["portableBytes"]
        if mode == "mutant" and entry["path"] == "app/components/workbench/Conversation.tsx":
            expected_hash = freeze["mutant"]["sha256"]
            expected_bytes = freeze["mutant"]["bytes"]
        candidate = Path("/app") / entry["path"]
        assert candidate.is_file()
        assert candidate.stat().st_size == expected_bytes
        assert sha(candidate) == expected_hash

    package_evidence = freeze["dependencies"]
    for key, sandbox_path in manifest["packages"].items():
        package = json.loads(Path(sandbox_path).read_text())
        evidence = package_evidence[key]
        assert sandbox_path == evidence["path"]
        assert sha(Path(sandbox_path)) == evidence["sha256"]
        assert {"name": package["name"], "version": package["version"]} == {
            "name": evidence["name"], "version": evidence["version"],
        }
    core = json.loads(Path(CORE).read_text())
    assert sha(Path(CORE)) == freeze["core"]["sha256"]
    assert {"name": core["name"], "version": core["version"]} == {
        "name": "@agent-native/core", "version": "0.176.5",
    }

    result = {
        "schemaVersion": 1, "accepted": True, "mode": mode,
        "uid": os.getuid(), "gid": os.getgid(), "status": {
            "NoNewPrivs": status["NoNewPrivs"], **{key: status[key] for key in capabilities},
        },
        "namespaces": namespaces, "affinity": affinity, "interfaces": interfaces,
        "mounts": mounts, "dependencyTree": freeze["dependencyTree"],
    }
    destination = Path("/work/boundary.json")
    temporary = destination.with_suffix(".new")
    with temporary.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(destination)
    descriptor = os.open("/work", os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    return result


def execute(mode: str) -> None:
    result = attest(mode)
    print("BOUNDARY_ATTESTATION " + json.dumps(result, sort_keys=True), flush=True)
    environment = {
        "PATH": "/usr/bin:/bin", "HOME": "/home/test", "TMPDIR": "/tmp",
        "LANG": "C.UTF-8", "CI": "true", "NODE_ENV": "test",
        "VIVARY_TEST_CORE_PACKAGE_JSON": CORE,
    }
    if mode == "activity":
        environment.update(
            VIVARY_REGISTRY_PROOF_ROOT="/work/proof",
            AGENT_NATIVE_DISABLED_PLUGINS="agent-chat,auth,context-xray,core-routes,integrations,observational-memory,onboarding,org,resources,sentry,terminal",
        )
        command = ["/usr/bin/node", "--test", "--test-reporter=tap",
                   "/app/tests/project-runtime-activity.test.mjs"]
    elif mode == "component":
        environment["VIVARY_TEST_COMPONENT_DEPENDENCY_MANIFEST"] = "/proof/component-dependencies.json"
        command = ["/usr/bin/node", "--test", "--test-reporter=tap", COMPONENT]
    else:
        environment["VIVARY_TEST_COMPONENT_DEPENDENCY_MANIFEST"] = "/proof/component-dependencies.json"
        command = ["/usr/bin/node", "/proof/assert_runtime_activity_mutant.mjs"]
    os.execve(command[0], command, environment)


if __name__ == "__main__":
    assert len(sys.argv) == 2
    execute(sys.argv[1])
