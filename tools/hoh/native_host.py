"""Trusted Habitat supervisor for isolated Claude hosts and credential-free tools.

Construction is inert. Container creation happens only through launch_verifier,
after the owner's included-allowance authority is bound to actual native auth.
The allowance is user-reported. This does not claim that a provider account's
extra-usage setting was inspected or disabled.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import time

from hoh.claude import ClaudePreflightError, READ_TOOLS, WRITE_TOOL, SUPPORTED_VERSION, _strict_json


IMAGE = "sha256:ffdba5d54dd6f91875fa60fc15103b6b30bb23ecaaf2d8ed65559d3cdff05bee"
PYTHON = "/home/ubuntu/.local/share/mise/installs/python/3.11.16/bin/python3"
CLAUDE = "/home/ubuntu/.local/share/pnpm/bin/claude"
RUNTIME_FILES = ("hoh_loop.py", "hoh/__init__.py", "hoh/protocol.py", "hoh/workflow.py", "hoh/role_mcp.py")
PROXY = "http://proxy:3128"
MAX_NATIVE_TRANSPORT_BYTES = 16 * 1024 * 1024


class HostGate(ClaudePreflightError):
    """An actual isolation or account prerequisite is missing."""


def digest(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def json_digest(value: object) -> str:
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def verify_included_access(evidence: object, auth_status: object) -> None:
    """Bind the owner's scoped included-allowance confirmation to native auth."""
    if not isinstance(auth_status, dict) or (auth_status.get("loggedIn") is not True
            or auth_status.get("authMethod") != "claude.ai" or auth_status.get("apiProvider") != "firstParty"
            or auth_status.get("subscriptionType") not in {"max", "pro"}):
        raise HostGate("native included subscription authentication is not established")
    required = {"schema", "auth_status_sha256", "observation", "source", "authority_ref"}
    if not isinstance(evidence, dict) or set(evidence) != required:
        raise HostGate("scoped owner confirmation of included allowance is missing")
    if (evidence["schema"] != "vivary.included-access-evidence/v1"
            or evidence["auth_status_sha256"] != json_digest(auth_status)
            or evidence["source"] != "user-reported-included-allowance"
            or evidence["observation"] != "sufficient-included-allowance-for-this-experiment"
            or not isinstance(evidence["authority_ref"], str) or not evidence["authority_ref"].strip()):
        raise HostGate("included allowance authority is not bound to this native account")


def verify_container_inspection(inspect: object, plan: dict, *, running: bool) -> dict:
    """Derive isolation from Docker inspection, checking every configured mount."""
    if not isinstance(inspect, dict):
        raise HostGate("container inspection is missing")
    host, config, state = (inspect.get(key, {}) for key in ("HostConfig", "Config", "State"))
    if (inspect.get("Image") != IMAGE or config.get("User") != "1000:1000"
            or state.get("Running") is not running or inspect.get("Name") != "/" + plan["name"]):
        raise HostGate("container image, user, lifecycle, or identity differs")
    if (host.get("NetworkMode") != plan["network"] or host.get("Privileged") is not False
            or host.get("ReadonlyRootfs") is not True or host.get("CapDrop") != ["ALL"]
            or host.get("CapAdd") not in (None, []) or "no-new-privileges" not in host.get("SecurityOpt", [])
            or host.get("NanoCpus") != 2_000_000_000 or host.get("Memory") != 1_073_741_824
            or host.get("PidsLimit") != 128 or host.get("PidMode") not in (None, "")
            or host.get("IpcMode") not in ("private", "") or host.get("Devices") not in (None, [])
            or host.get("Binds") not in (None, []) or host.get("PortBindings") not in (None, {})
            or host.get("Tmpfs") != {"/tmp": "rw,nosuid,nodev,size=64m"}
            or host.get("RestartPolicy", {}).get("Name") not in ("", "no")
            or config.get("Labels", {}).get("vivary.invocation") != plan["name"]):
        raise HostGate("container isolation or resource limits differ")
    if running and set(inspect.get("NetworkSettings", {}).get("Networks", {})) != {plan["network"]}:
        raise HostGate("container is connected to an undeclared network")
    mounted = inspect.get("Mounts")
    if not isinstance(mounted, list):
        raise HostGate("container mount inspection differs")
    tmpfs = [item for item in mounted if item.get("Type") == "tmpfs"]
    if any(item.get("Destination") != "/tmp" or item.get("RW") is not True for item in tmpfs) or len(tmpfs) > 1:
        raise HostGate("container has undeclared temporary mounts")
    mounted = [item for item in mounted if item.get("Type") != "tmpfs"]
    if len(mounted) != len(plan["mounts"]):
        raise HostGate("container has undeclared mounts")
    expected = {item["target"]: item for item in plan["mounts"]}
    for mount in mounted:
        target = mount.get("Destination")
        wanted = expected.pop(target, None)
        if wanted is None or mount.get("Type") != wanted["type"] or mount.get("RW") is not wanted["writable"]:
            raise HostGate("container mount type or authority differs")
        source = mount.get("Name") if wanted["type"] == "volume" else mount.get("Source")
        if source != wanted["source"]:
            raise HostGate("container mount source differs")
    env = {}
    for item in config.get("Env", []):
        key, _, value = item.partition("=")
        if re.search(r"TOKEN|SECRET|API_KEY|^AWS_|^OPENAI_|^ANTHROPIC_", key):
            raise HostGate("container inherited credential or provider environment")
        env[key] = value
    if plan["kind"] == "worker" and any("PROXY" in key.upper() and value for key, value in env.items()):
        raise HostGate("worker inherited proxy configuration")
    if plan["kind"] == "host" and any(env.get(key) != PROXY for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")):
        raise HostGate("native host does not use the verified proxy")
    if config.get("Entrypoint") != [PYTHON] or config.get("Cmd") != plan["entry_args"]:
        raise HostGate("container deadline guardian or worker command differs")
    return {"container_id": inspect["Id"], "name": plan["name"], "image": IMAGE,
            "network": plan["network"], "mounts": plan["mounts"], "limits": {"cpus": 2, "memory": 1_073_741_824, "pids": 128}}


CLAUDE_EXECUTABLE_SHA256 = "sha256:ea934f47b4408fabe3c48a0d7e99f9aad7d77626af89ed8804f92adcd52aa3b7"


def _fixed_docker_json(arguments):
    # This path has no caller-supplied verifier or command runner.
    result = subprocess.run(["docker", *arguments], capture_output=True, text=True,
                            timeout=15, check=False)
    if result.returncode:
        raise HostGate("fixed Habitat executable inspection failed")
    try:
        return json.loads(result.stdout)
    except ValueError as error:
        raise HostGate("fixed Habitat inspection output is invalid") from error


def _fixed_native_file_probe(container_id):
    probe = ("import hashlib,json,os,pathlib,stat,subprocess; "
             f"p=pathlib.Path({CLAUDE!r}); "
             "print(json.dumps({'path':str(p),'regular':stat.S_ISREG(p.lstat().st_mode),"
             "'symlink':p.is_symlink(),'executable':os.access(p,os.X_OK),"
             "'sha256':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest(),"
             "'version':subprocess.check_output([str(p),'--version'],text=True,timeout=10).strip()}))")
    actual = _fixed_docker_json(["exec", container_id, PYTHON, "-c", probe])
    expected = {"path": CLAUDE, "regular": True, "symlink": False, "executable": True,
                "sha256": CLAUDE_EXECUTABLE_SHA256, "version": f"{SUPPORTED_VERSION} (Claude Code)"}
    if actual != expected:
        raise HostGate("actual Habitat executable file, checksum, or native version changed")
    return actual


def verify_habitat_reference_executable(executable):
    if str(executable) != CLAUDE:
        raise HostGate("unsupported Habitat executable path")
    reference = _fixed_docker_json(["inspect", "habitat-vivary-dev-1"])[0]
    if reference.get("Image") != IMAGE or reference.get("State", {}).get("Running") is not True:
        raise HostGate("the installed Habitat reference image changed or stopped")
    return _fixed_native_file_probe(reference["Id"])


def verify_habitat_execution(executable, execution, *, call_id):
    expected_name = "vivary20a-" + hashlib.sha256(call_id.encode()).hexdigest()[:20] + "-host"
    fields = {"container_id", "container_name", "image", "path", "sha256", "native_version"}
    if (str(executable) != CLAUDE or not isinstance(execution, dict) or set(execution) != fields
            or execution["container_name"] != expected_name or execution["image"] != IMAGE
            or execution["path"] != CLAUDE or execution["sha256"] != CLAUDE_EXECUTABLE_SHA256
            or execution["native_version"] != SUPPORTED_VERSION
            or not isinstance(execution["container_id"], str)
            or not re.fullmatch(r"[0-9a-f]{64}", execution["container_id"])):
        raise HostGate("declared Habitat execution identity differs")
    actual = _fixed_docker_json(["inspect", execution["container_id"]])[0]
    config, host = actual.get("Config", {}), actual.get("HostConfig", {})
    if (actual.get("Id") != execution["container_id"] or actual.get("Name") != "/" + expected_name
            or actual.get("Image") != IMAGE or actual.get("State", {}).get("Running") is not True
            or config.get("User") != "1000:1000" or config.get("Labels", {}).get("vivary.invocation") != expected_name
            or host.get("ReadonlyRootfs") is not True or host.get("Privileged") is not False
            or host.get("CapDrop") != ["ALL"] or host.get("CapAdd") not in (None, [])
            or "no-new-privileges" not in host.get("SecurityOpt", [])
            or host.get("PidMode") not in (None, "")):
        raise HostGate("actual Habitat execution container differs or is mutable")
    from pathlib import PurePosixPath
    native_path = PurePosixPath(CLAUDE)
    for mount in actual.get("Mounts", []):
        destination = PurePosixPath(mount["Destination"])
        if destination == native_path or destination in native_path.parents:
            raise HostGate("a mount replaces the verified executable or its parent")
    return _fixed_native_file_probe(execution["container_id"])


def verified_habitat_owner(runner, launch_verifier):
    owner = getattr(runner, "__self__", None)
    if (type(owner) is not HabitatNativeHost or getattr(launch_verifier, "__self__", None) is not owner
            or getattr(runner, "__func__", None) is not HabitatNativeHost.runner
            or getattr(launch_verifier, "__func__", None) is not HabitatNativeHost.launch_verifier
            or owner.control_runner is not subprocess.run or owner.owned_runner is not None
            or set(owner.__dict__) != {"task_root", "source_root", "included_access_evidence", "network",
                                      "auth_volume", "reference_container", "control_runner", "owned_runner", "active"}):
        raise HostGate("remote dispatch requires the same unmodified HabitatNativeHost owner")
    return owner


class HabitatNativeHost:
    def __init__(self, task_root: Path, source_root: Path, *, included_access_evidence: Path | None = None,
                 network="habitat-vivary_sandbox", auth_volume="habitat-vivary_claude-home",
                 reference_container="habitat-vivary-dev-1", control_runner=subprocess.run, owned_runner=None):
        self.task_root = task_root.resolve()
        self.source_root = source_root.resolve(strict=True)
        self.included_access_evidence = included_access_evidence
        self.network, self.auth_volume = network, auth_volume
        self.reference_container = reference_container
        self.control_runner, self.owned_runner = control_runner, owned_runner
        self.active = {}

    def _control(self, args, *, check=True, timeout=15):
        result = self.control_runner(["docker", *args], capture_output=True, text=True, timeout=timeout, check=False)
        if check and result.returncode:
            raise HostGate(f"Docker control command failed: {args[0]}")
        return result

    def _json(self, args):
        try:
            return json.loads(self._control(args).stdout)
        except (ValueError, TypeError) as error:
            raise HostGate("Docker control output is not valid JSON") from error

    def verify_executable(self, executable: Path) -> None:
        if str(executable) != CLAUDE:
            raise HostGate("native executable differs from installed Habitat path")
        inspection = self._json(["inspect", self.reference_container])[0]
        if inspection.get("Image") != IMAGE:
            raise HostGate("reference Habitat image changed")
        version = self._control(["exec", self.reference_container, CLAUDE, "--version"]).stdout.strip()
        if version != f"{SUPPORTED_VERSION} (Claude Code)":
            raise HostGate("installed Claude version changed")

    def plan(self, *, request: dict, view, call_id: str, policy: dict, deadline=None) -> dict:
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", call_id):
            raise HostGate("invalid invocation identity")
        name = "vivary20a-" + hashlib.sha256(call_id.encode()).hexdigest()[:20]
        root = self.task_root / call_id
        runtime, ipc = root / "runtime", root / "ipc"
        common = [{"type": "bind", "source": str(runtime), "target": "/opt/vivary-role", "writable": False},
                  {"type": "bind", "source": str(ipc), "target": "/ipc", "writable": True}]
        from hoh.protocol import uses_boottime, validate_clock_binding, clock_binding_args
        clock_binding = None
        if uses_boottime(policy):
            if deadline is None or not callable(getattr(deadline, "clock_binding", None)):
                raise HostGate("new clock policy requires the admitted absolute deadline")
            deadline.remaining()
            clock_binding = validate_clock_binding(deadline.clock_binding())
            if clock_binding["expires_unix_ns"] != request["deadline_unix_ns"]:
                raise HostGate("absolute deadline differs from the role request")
            deadline_args = clock_binding_args(clock_binding)
        else:
            duration = min(policy["invocation_seconds"], max(1, (request["deadline_unix_ns"] - time.time_ns()) // 1_000_000_000))
            deadline_args = ["--expires-unix-ns", str(request["deadline_unix_ns"]), "--duration-seconds", str(duration)]
        worker_mounts = [*common, {"type": "bind", "source": str(view.root), "target": "/role", "writable": False}]
        if view.writable_root is not None:
            if view.role != "developer" or view.writable_root != "candidate":
                raise HostGate("undeclared writable role root")
            worker_mounts.append({"type": "bind", "source": str(view.root / "candidate"), "target": "/role/candidate", "writable": True})
        worker_args = ["-B", "/opt/vivary-role/hoh/role_mcp.py", "serve", "--role", view.role, *deadline_args]
        host_args = ["-B", "/opt/vivary-role/hoh/role_mcp.py", "hold", *deadline_args]
        if clock_binding is not None:
            worker_args += ["--clock-evidence-path", "/ipc/serve-clock.json"]
            host_args += ["--clock-evidence-path", "/ipc/hold-clock.json"]
        if view.writable_root is not None:
            worker_args += ["--write-root", view.writable_root]
        host_mounts = [*common, {"type": "volume", "source": self.auth_volume, "target": "/home/ubuntu/.claude", "writable": True},
                       {"type": "bind", "source": str(root / "native-config.json"), "target": "/home/ubuntu/.claude.json", "writable": True},
                       {"type": "bind", "source": str(root / "mcp.json"), "target": "/run/vivary-mcp.json", "writable": False}]
        return {"root": root, "runtime": runtime, "ipc": ipc, "stop_grace_seconds": policy["stop_grace_seconds"],
                **({"clock_binding": clock_binding} if clock_binding is not None else {}),
                "worker": {"kind": "worker", "name": name + "-worker", "network": "none", "mounts": worker_mounts, "entry_args": worker_args},
                "host": {"kind": "host", "name": name + "-host", "network": self.network, "mounts": host_mounts,
                         "entry_args": host_args}}

    @staticmethod
    def create_command(plan):
        args = ["create", "--pull", "never", "--name", plan["name"], "--label", "vivary.invocation=" + plan["name"], "--network", plan["network"],
                "--read-only", "--user", "1000:1000", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                "--cpus", "2", "--memory", "1g", "--pids-limit", "128", "--ipc", "private",
                "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--env", "PYTHONPATH=/opt/vivary-role",
                "--workdir", "/tmp", "--entrypoint", PYTHON]
        if plan["kind"] == "host":
            for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
                args += ["--env", key + "=" + PROXY]
        else:
            for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
                args += ["--env", key + "="]
        for mount in plan["mounts"]:
            args += ["--mount", f"type={mount['type']},src={mount['source']},dst={mount['target']}" + ("" if mount["writable"] else ",readonly")]
        return [*args, IMAGE, *plan["entry_args"]]

    def launch_verifier(self, *, executable, request, view, call_id, policy, deadline=None):
        if os.name != "posix":
            raise HostGate("the trusted native supervisor must run in Habitat WSL")
        if os.getuid() != 1000:
            raise HostGate("prepared IPC and native state require the verified ubuntu UID 1000")
        self.verify_executable(executable)
        auth = self._json(["exec", self.reference_container, CLAUDE, "auth", "status", "--json"])
        evidence = None
        if self.included_access_evidence is not None:
            evidence = json.loads(self.included_access_evidence.read_text())
        verify_included_access(evidence, auth)
        network = self._json(["network", "inspect", self.network])[0]
        if network.get("Internal") is not True or network.get("Driver") != "bridge":
            raise HostGate("the native host network is not the existing internal proxy network")
        plan = self.plan(request=request, view=view, call_id=call_id, policy=policy, deadline=deadline)
        root = plan["root"]
        if root.exists() or root.is_symlink():
            raise HostGate("existing invocation host resources require reconciliation")
        created = []
        try:
            manifest = self._prepare_files(plan)
            receipts, probes = self._create_pair(plan, created)
            native_file = self.inspect_native_executable(plan["host"]["name"])
            plan["execution"] = {"container_id": receipts[1]["container_id"], "container_name": plan["host"]["name"],
                                 "image": IMAGE, "path": CLAUDE, "sha256": native_file["sha256"], "native_version": SUPPORTED_VERSION}
            (root / "isolation.json").write_text(json.dumps({"containers": receipts, "network_id": network["Id"],
                "probes": probes, "runtime_manifest": manifest, "included_allowance_authority_ref": evidence["authority_ref"],
                "allowance_evidence_kind": evidence["source"],
                **({"clock_binding": plan["clock_binding"]} if "clock_binding" in plan else {})}, sort_keys=True))
            self.active[call_id] = plan
        except BaseException:
            self._cleanup_names(created, grace_seconds=policy["stop_grace_seconds"], **self._cleanup_timing(plan))
            if root.exists():
                self._cleanup_files(plan)
            raise
        return {"mcp_config": "/run/vivary-mcp.json", "allowed_tools": sorted(READ_TOOLS | ({WRITE_TOOL} if view.writable_root else set())),
                "session_mode": "create" if request["attempt"] == 1 else "resume",
                "evidence_ref": str(root / "isolation.json"), "execution": plan["execution"]}

    def _create_pair(self, plan, created):
        receipts = []
        for kind in ("worker", "host"):
            container = plan[kind]
            if self._control(["inspect", container["name"]], check=False).returncode == 0:
                raise HostGate("an existing invocation container requires reconciliation")
            self._control(self.create_command(container))
            created.append(container["name"])
            receipts.append(verify_container_inspection(self._json(["inspect", container["name"]])[0], container, running=False))
            self._control(["start", container["name"]])
            verify_container_inspection(self._json(["inspect", container["name"]])[0], container, running=True)
        socket_path = plan["ipc"] / "role.sock"
        stop_at = time.monotonic() + 5
        while not socket_path.exists() and time.monotonic() < stop_at:
            time.sleep(0.05)
        if not socket_path.is_socket() or socket_path.stat().st_uid != 1000:
            raise HostGate("credential-free worker did not establish the owned IPC socket")
        probes = {kind: self._verify_process_boundary(plan[kind]) for kind in ("worker", "host")}
        self._verify_customizations(plan["host"]["name"])
        return receipts, probes

    def inspect_native_executable(self, container_name):
        """Return actual native file facts; this does not replace the adapter guard."""
        probe = ("import hashlib,json,os,pathlib,stat,subprocess; "
                 f"p=pathlib.Path({CLAUDE!r}); "
                 "print(json.dumps({'path':str(p),'regular':stat.S_ISREG(p.lstat().st_mode),"
                 "'symlink':p.is_symlink(),'executable':os.access(p,os.X_OK),"
                 "'sha256':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest(),"
                 "'version':subprocess.check_output([str(p),'--version'],text=True,timeout=10).strip()}))")
        observed = self._json(["exec", container_name, PYTHON, "-c", probe])
        if (not isinstance(observed, dict) or observed.get("path") != CLAUDE
                or observed.get("regular") is not True or observed.get("symlink") is not False
                or observed.get("executable") is not True or observed.get("version") != f"{SUPPORTED_VERSION} (Claude Code)"
                or not re.fullmatch(r"sha256:[0-9a-f]{64}", observed.get("sha256", ""))):
            raise HostGate("actual native executable path, mode, checksum, or version differs")
        return observed

    def _collect_read_log(self, plan, view):
        path = plan["ipc"] / "tool-reads.json"
        if path.is_symlink() or not path.is_file():
            raise HostGate("actual tool read log is missing or linked")
        record = json.loads(path.read_text())
        if (not isinstance(record, dict) or set(record) != {"role", "files"} or record["role"] != view.role
                or not isinstance(record["files"], list) or any(not isinstance(item, str) for item in record["files"])):
            raise HostGate("actual tool read log differs from its role")
        for relative in record["files"]:
            view._resolve(relative)
        view.read_log.extend(record["files"])
        destination = plan["root"] / "tool-reads.json"
        destination.write_text(json.dumps(record, sort_keys=True))
        return {"files": record["files"], "sha256": digest(destination.read_bytes())}

    def prove_isolation(self, *, view, call_id, policy):
        """Run fixed non-model probes and MCP canary requests, then remove the pair."""
        if os.name != "posix" or os.getuid() != 1000:
            raise HostGate("the offline isolation proof requires the verified Habitat UID")
        self.verify_executable(Path(CLAUDE))
        network = self._json(["network", "inspect", self.network])[0]
        if network.get("Internal") is not True or network.get("Driver") != "bridge":
            raise HostGate("offline proof requires the existing internal proxy network")
        request = {"deadline_unix_ns": time.time_ns() + policy["invocation_seconds"] * 1_000_000_000}
        plan = self.plan(request=request, view=view, call_id=call_id, policy=policy)
        if plan["root"].exists():
            raise HostGate("refuse existing offline proof root")
        created = []
        try:
            manifest = self._prepare_files(plan)
            # The synthetic canary is host-only; no actual credential is read.
            canary = plan["root"] / "synthetic-canary.txt"
            canary.write_text("VIVARY-SYNTHETIC-NOT-A-CREDENTIAL")
            plan["host"]["mounts"].append({"type": "bind", "source": str(canary), "target": "/run/vivary-canary", "writable": False})
            receipts, probes = self._create_pair(plan, created)
            executable = self.inspect_native_executable(plan["host"]["name"])
            replies = []
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.connect(str(plan["ipc"] / "role.sock"))
                client.settimeout(5)
                with client.makefile("rwb") as stream:
                    def exchange(method, params):
                        message = {"jsonrpc": "2.0", "id": len(replies) + 1, "method": method, "params": params}
                        stream.write((json.dumps(message) + "\n").encode())
                        stream.flush()
                        result = json.loads(stream.readline())
                        replies.append({"request": message, "response": result})
                        return result
                    exchange("initialize", {"protocolVersion": "2025-06-18"})
                    tools = exchange("tools/list", {})["result"]["tools"]
                    if {item["name"] for item in tools} != ({"list_files", "read_text", "write_text"} if view.writable_root else {"list_files", "read_text"}):
                        raise HostGate("actual worker tool set differs")
                    listed = exchange("tools/call", {"name": "list_files", "arguments": {}})
                    if listed.get("result", {}).get("isError") is not False:
                        raise HostGate("actual worker cannot list its projection")
                    relative = next(path.relative_to(view.root).as_posix() for path in sorted(view.root.rglob("*")) if path.is_file())
                    read = exchange("tools/call", {"name": "read_text", "arguments": {"path": relative}})
                    if read.get("result", {}).get("isError") is not False:
                        raise HostGate("actual worker cannot read its projection")
                    for path in ("/run/vivary-canary", "../synthetic-canary.txt", "/proc/self/environ", "/home/ubuntu/.claude/.credentials.json"):
                        denied = exchange("tools/call", {"name": "read_text", "arguments": {"path": path}})
                        if denied.get("result", {}).get("isError") is not True:
                            raise HostGate("actual worker allowed an out-of-projection read")
                    for name in ("shell", "environment", "call_agent"):
                        denied = exchange("tools/call", {"name": name, "arguments": {}})
                        if denied.get("result", {}).get("isError") is not True:
                            raise HostGate("actual worker allowed an undeclared tool")
                    denied = exchange("tools/call", {"name": "write_text", "arguments": {"path": "/run/vivary-canary", "text": "denied"}})
                    if denied.get("result", {}).get("isError") is not True:
                        raise HostGate("actual worker allowed a canary write")
                    if view.writable_root:
                        candidate = view.root / "candidate" / "linkcheck.py"
                        original = candidate.read_text()
                        written = exchange("tools/call", {"name": "write_text", "arguments": {"path": "candidate/linkcheck.py", "text": original}})
                        if written.get("result", {}).get("isError") is not False or candidate.read_text() != original:
                            raise HostGate("actual developer worker could not perform its scoped candidate write")
            read_log = self._collect_read_log(plan, view)
            evidence = {"kind": "observed-offline-container-and-mcp", "model_calls": 0,
                        "containers": receipts, "probes": probes, "native_executable": executable,
                        "network_id": network["Id"], "runtime_manifest": manifest, "mcp": replies, "tool_reads": read_log}
            (plan["root"] / "isolation.json").write_text(json.dumps(evidence, indent=2, sort_keys=True))
        finally:
            self._cleanup_names(created, grace_seconds=policy["stop_grace_seconds"])
            if plan["root"].exists():
                self._cleanup_files(plan)
        return evidence

    def _prepare_files(self, plan):
        root = plan["root"]
        root.mkdir(parents=True)
        plan["runtime"].mkdir()
        plan["ipc"].mkdir(mode=0o700)
        manifest = {}
        for relative in RUNTIME_FILES:
            source = self.source_root / "tools" / relative
            if source.is_symlink() or not source.is_file():
                raise HostGate("minimal worker runtime source is missing or linked")
            source.resolve(strict=True).relative_to(self.source_root)
            target = plan["runtime"] / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            manifest[relative] = digest(target.read_bytes())
        (root / "native-config.json").write_text("{}\n")
        (root / "mcp.json").write_text(json.dumps({"mcpServers": {"vivary_role": {
            "command": PYTHON, "args": ["-B", "/opt/vivary-role/hoh/role_mcp.py", "bridge"]}}}))
        return manifest

    def _verify_customizations(self, name):
        probe = ("import json,pathlib; paths=[pathlib.Path('/home/ubuntu/.claude/settings.json'),"
                 "pathlib.Path('/home/ubuntu/.claude/settings.local.json'),pathlib.Path('/etc/claude-code/managed-settings.json')]; "
                 "bad={str(p):sorted(set(json.loads(p.read_text())) & {'hooks','enabledPlugins','mcpServers','env','agents'}) for p in paths if p.exists()}; "
                 "print(json.dumps(bad))")
        observation = self._json(["exec", name, PYTHON, "-c", probe])
        if not isinstance(observation, dict) or any(observation.values()):
            raise HostGate("native customizations may add hooks, plugins, tools, agents, or environment")

    def _verify_process_boundary(self, plan):
        probe = ("import json,os,pathlib,socket; "
                 "s=socket.socket(); s.settimeout(1); "
                 "outside=s.connect_ex(('1.1.1.1',443)); s.close(); "
                 "print(json.dumps({'uid':os.getuid(),'external_connect':outside,"
                 "'docker_socket':pathlib.Path('/var/run/docker.sock').exists(),"
                 "'auth_directory':pathlib.Path('/home/ubuntu/.claude').is_mount(),"
                 "'role_directory':pathlib.Path('/role').is_mount()}))")
        result = self._json(["exec", plan["name"], PYTHON, "-c", probe])
        if (not isinstance(result, dict) or result.get("uid") != 1000
                or type(result.get("external_connect")) is not int or result["external_connect"] == 0
                or result.get("docker_socket") is not False
                or result.get("auth_directory") is not (plan["kind"] == "host")
                or result.get("role_directory") is not (plan["kind"] == "worker")):
            raise HostGate("actual container filesystem or egress probe differs")
        return result

    def _cleanup_names(self, names, *, grace_seconds=5, expires_monotonic=None, expires_boottime_ns=None):
        errors = []
        expires = time.monotonic() + grace_seconds
        if expires_monotonic is not None:
            expires = min(expires, expires_monotonic)
        def control(args, *, check=True):
            left = expires - time.monotonic()
            if expires_boottime_ns is not None:
                from hoh.protocol import boottime_ns
                left = min(left, (expires_boottime_ns - boottime_ns()) / 1_000_000_000)
            if left <= 0:
                raise HostGate("owned container cleanup exceeded stop grace")
            result = self._control(args, check=check, timeout=left)
            if expires_boottime_ns is not None and boottime_ns() >= expires_boottime_ns:
                raise HostGate("owned container cleanup exceeded absolute stop grace")
            return result
        for name in reversed(names):
            if not re.fullmatch(r"vivary20a-[0-9a-f]{20}-(?:host|worker)", name):
                raise HostGate("refuse cleanup of an unowned container")
            inspected = json.loads(control(["inspect", name]).stdout)[0]
            if (inspected.get("Image") != IMAGE or inspected.get("Name") != "/" + name
                    or inspected.get("Config", {}).get("Labels", {}).get("vivary.invocation") != name):
                raise HostGate("refuse cleanup without exact invocation ownership evidence")
            control(["kill", "--signal", "TERM", name], check=False)
            inspected = json.loads(control(["inspect", name]).stdout)[0]
            if inspected.get("State", {}).get("Running") is True:
                control(["kill", name], check=False)
                inspected = json.loads(control(["inspect", name]).stdout)[0]
            if inspected.get("State", {}).get("Running") is not False:
                errors.append(name)
                continue
            control(["rm", name])
            if control(["inspect", name], check=False).returncode == 0:
                errors.append(name)
        if errors:
            raise HostGate("owned container cleanup remains unconfirmed: " + ", ".join(errors))

    @staticmethod
    def _cleanup_timing(plan):
        if "clock_binding" not in plan:
            return {}
        from hoh.protocol import boottime_ns
        return {"expires_boottime_ns": boottime_ns() + int(plan["stop_grace_seconds"] * 1_000_000_000)}

    @staticmethod
    def _cleanup_files(plan):
        root = plan["root"].resolve(strict=True)
        from hoh.protocol import _atomic_json_write, validate_boottime_clock, validate_clock_binding
        for name in ("serve-clock.json", "hold-clock.json"):
            source = root / "ipc" / name
            if source.is_symlink():
                raise HostGate("refuse linked guardian clock evidence")
            if source.exists():
                if source.stat().st_size > 8192:
                    raise HostGate("guardian clock evidence exceeds its bound")
                value = json.loads(source.read_text())
                if (not isinstance(value, dict) or set(value) != {"schema", "binding", "clock", "stop"}
                        or value["schema"] != "vivary.hoh-guardian-clock/v1"):
                    raise HostGate("guardian clock evidence shape differs")
                validate_clock_binding(value["binding"])
                validate_boottime_clock(value["clock"])
                if "clock_binding" in plan and value["binding"] != plan["clock_binding"]:
                    raise HostGate("guardian clock evidence binding changed")
                target = root / name
                if target.exists() or target.is_symlink():
                    raise HostGate("guardian clock evidence already archived")
                _atomic_json_write(target, value)
                source.unlink()
        for relative in (*("runtime/" + item for item in RUNTIME_FILES), "mcp.json", "native-config.json", "synthetic-canary.txt", "ipc/role.sock", "ipc/tool-reads.json"):
            target = root / relative
            if target.is_symlink():
                raise HostGate("refuse changed task cleanup path")
            target.resolve().relative_to(root)
            target.unlink(missing_ok=True)
        for relative in ("runtime/hoh", "runtime", "ipc"):
            target = root / relative
            if target.exists():
                target.rmdir()

    def abort_unstarted(self, call_id):
        plan = self.active.get(call_id)
        if plan is None:
            return
        prefix = "vivary20a-" + hashlib.sha256(call_id.encode()).hexdigest()[:20]
        if (plan["root"] != self.task_root / call_id or plan["root"].resolve().parent != self.task_root
                or plan["worker"]["name"] != prefix + "-worker" or plan["host"]["name"] != prefix + "-host"):
            raise HostGate("refuse abort of changed invocation ownership")
        self._cleanup_names([prefix + "-worker", prefix + "-host"], grace_seconds=plan["stop_grace_seconds"],
                            **self._cleanup_timing(plan))
        self._cleanup_files(plan)
        self.active.pop(call_id, None)

    @staticmethod
    def _record_transport(plan, process, *, complete):
        remaining = MAX_NATIVE_TRANSPORT_BYTES
        files = {}
        for name in ('stdout', 'stderr'):
            text = process.get(name)
            raw = text.encode('utf-8') if isinstance(text, str) else b''
            retained = raw[:remaining]
            remaining -= len(retained)
            path = plan['root'] / f'native-{name}.txt'
            if path.exists() or path.is_symlink():
                raise HostGate('native transport evidence already exists')
            path.write_bytes(retained)
            files[name] = {'file': path.name, 'bytes': len(retained), 'sha256': digest(retained),
                           'available': isinstance(text, str), 'truncated': len(retained) != len(raw)}
        record = {'schema': 'vivary.native-transport/v1', 'encoding': 'decoded-utf8',
                  'complete': complete and all(item['available'] and not item['truncated'] for item in files.values()),
                  'files': files, 'process_cleanup_confirmed': process.get('cleanup_confirmed') is True}
        (plan['root'] / 'native-transport.json').write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')

    def runner(self, command, *, stdin_text, request, view, deadline, on_event, launch):
        call_id = f"{request['run_id']}-{request['iteration']}-{request['role']}-{request['attempt']}"
        plan = self.active.get(call_id)
        if plan is None:
            raise HostGate("native runner has no verified invocation host")
        stop_started = False
        containers_cleaned = False
        def stop_containers(*, expires_monotonic, expires_boottime_ns=None):
            nonlocal stop_started, containers_cleaned
            if stop_started:
                raise HostGate("native stop callback was invoked more than once")
            stop_started = True
            self._cleanup_names([plan["worker"]["name"], plan["host"]["name"]],
                                grace_seconds=plan["stop_grace_seconds"], expires_monotonic=expires_monotonic,
                                **({"expires_boottime_ns": expires_boottime_ns} if expires_boottime_ns is not None else {}))
            containers_cleaned = True
        try:
            if launch.get("evidence_ref") != str(plan["root"] / "isolation.json"):
                raise HostGate("native runner evidence differs from verified invocation")
            if not isinstance(command, list) or not command or command[0] != CLAUDE:
                raise HostGate("native runner executable differs from the verified CLI")
            if self.owned_runner is None:
                from hoh_loop import run_owned_process
                owned_runner = run_owned_process
            else:
                owned_runner = self.owned_runner
            for kind in ("worker", "host"):
                verify_container_inspection(self._json(["inspect", plan[kind]["name"]])[0], plan[kind], running=True)
            if launch.get("execution") != plan["execution"]:
                raise HostGate("native invocation execution binding changed")
            verify_habitat_execution(Path(command[0]), plan["execution"], call_id=call_id)
            try:
                result = owned_runner(["docker", "exec", "-i", plan["execution"]["container_id"], *command],
                                      cwd=plan["root"], deadline=deadline, stdin_text=stdin_text,
                                      on_stdout_line=lambda line: on_event(_strict_json(line)), on_stop=stop_containers,
                                      max_output_bytes=MAX_NATIVE_TRANSPORT_BYTES)
            except BaseException as error:
                self._record_transport(plan, getattr(error, 'process_evidence', {}), complete=False)
                raise
            self._record_transport(plan, result, complete=True)
            self._collect_read_log(plan, view)
        finally:
            if not stop_started:
                self._cleanup_names([plan["worker"]["name"], plan["host"]["name"]], grace_seconds=plan["stop_grace_seconds"],
                                    **self._cleanup_timing(plan))
            elif not containers_cleaned:
                raise HostGate("native stop cleanup remains unconfirmed; retain invocation for reconciliation")
            self._cleanup_files(plan)
            self.active.pop(call_id, None)
        return {**result, "command_complete": result["accepted"], "cleanup_confirmed": result.get("cleanup_confirmed") is True}
