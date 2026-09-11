"""Minimal MCP file tools and Unix-socket transport for a credential-free worker.

The wire protocol is MCP 2025-06-18 over newline-delimited JSON-RPC. No model,
shell, environment, process, sampling, or background-task methods are exposed.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import selectors
import signal
import socket
import sys
import time


MAX_MESSAGE_BYTES = 1_048_576
PROTOCOL_VERSIONS = {"2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"}


def decode_message(raw: bytes) -> dict:
    def unique(items):
        value = {}
        for key, item in items:
            if key in value:
                raise ValueError("duplicate JSON key")
            value[key] = item
        return value
    if len(raw) > MAX_MESSAGE_BYTES:
        raise ValueError("MCP message exceeds transport limit")
    value = json.loads(raw, object_pairs_hook=unique,
                       parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
    if not isinstance(value, dict) or value.get("jsonrpc") != "2.0":
        raise ValueError("expected JSON-RPC object")
    return value


class RoleTools:
    """Compose the existing RoleView path and write-authority checks."""

    def __init__(self, view):
        if view.role not in {"planner", "developer", "qa"}:
            raise ValueError("unknown role")
        if view.writable_root is not None and (view.role != "developer" or view.writable_root != "candidate"):
            raise PermissionError("only the developer candidate can be writable")
        self.view = view
        self.initialized = False

    def tools(self):
        path = {"type": "string", "description": "Relative file path inside the declared role projection."}
        tools = [
            {"name": "list_files", "description": "List the files available to this role.",
             "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
            {"name": "read_text", "description": "Read one UTF-8 file from this role's projection.",
             "inputSchema": {"type": "object", "properties": {"path": path}, "required": ["path"], "additionalProperties": False}},
        ]
        if self.view.writable_root is not None:
            tools.append({"name": "write_text", "description": "Replace the developer candidate file.",
                          "inputSchema": {"type": "object", "properties": {"path": path, "text": {"type": "string"}},
                                          "required": ["path", "text"], "additionalProperties": False}})
        return tools

    def call(self, name, arguments):
        if not isinstance(arguments, dict):
            raise ValueError("tool arguments must be an object")
        if name == "list_files" and not arguments:
            files = []
            for path in sorted(self.view.root.rglob("*")):
                relative = path.relative_to(self.view.root).as_posix()
                resolved = self.view._resolve(relative)
                if resolved.is_file():
                    files.append(relative)
                if len(files) > 512:
                    raise ValueError("role file count exceeds fixture allowance")
            return "\n".join(files)
        if name == "read_text" and set(arguments) == {"path"} and isinstance(arguments["path"], str):
            path = self.view._resolve(arguments["path"])
            if not path.is_file() or path.stat().st_size > MAX_MESSAGE_BYTES // 2:
                raise ValueError("role file is not a bounded regular file")
            return self.view.read_text(arguments["path"])
        if name == "write_text" and self.view.writable_root is not None and set(arguments) == {"path", "text"}:
            if arguments["path"] != "candidate/linkcheck.py" or not isinstance(arguments["text"], str):
                raise PermissionError("write requires the declared candidate file and text")
            if len(arguments["text"].encode()) > MAX_MESSAGE_BYTES // 2:
                raise ValueError("candidate exceeds fixture allowance")
            self.view.write_text(arguments["path"], arguments["text"])
            return "Updated candidate/linkcheck.py."
        raise PermissionError("tool or arguments are outside role authority")

    def respond(self, message):
        request_id = message.get("id")
        method, params = message.get("method"), message.get("params", {})
        if request_id is None:
            if method in {"notifications/initialized", "notifications/cancelled"}:
                return None
            raise ValueError("unsupported notification")
        try:
            if type(request_id) not in (str, int) or not isinstance(params, dict):
                raise ValueError("invalid request identity or parameters")
            # MCP reserves _meta for client metadata. It never supplies tool
            # arguments, filesystem paths, role identity, or write authority.
            if "_meta" in params:
                if not isinstance(params["_meta"], dict):
                    raise ValueError("MCP request metadata must be an object")
                params = {key: value for key, value in params.items() if key != "_meta"}
            if method == "initialize":
                if self.initialized:
                    raise ValueError("duplicate initialization")
                self.initialized = True
                version = params.get("protocolVersion")
                result = {"protocolVersion": version if version in PROTOCOL_VERSIONS else "2025-06-18",
                          "capabilities": {"tools": {"listChanged": False}},
                          "serverInfo": {"name": "vivary_role", "version": "1"}}
            elif not self.initialized:
                raise ValueError("initialize before using role tools")
            elif method == "ping":
                result = {}
            elif method == "tools/list" and not params:
                result = {"tools": self.tools()}
            elif method == "tools/call" and "name" in params and not set(params) - {"name", "arguments"}:
                try:
                    text = self.call(params["name"], params.get("arguments", {}))
                    result = {"content": [{"type": "text", "text": text}], "isError": False}
                except (OSError, ValueError, TypeError) as error:
                    result = {"content": [{"type": "text", "text": str(error)}], "isError": True}
            else:
                raise ValueError("unsupported MCP method or parameters")
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except (ValueError, TypeError) as error:
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32602, "message": str(error)}}


def remaining(expires_unix_ns, started_monotonic, duration_seconds):
    return min((expires_unix_ns - time.time_ns()) / 1_000_000_000,
               duration_seconds - (time.monotonic() - started_monotonic))


class GuardianDeadline:
    """An absolute launch binding with an atomic, bounded local clock audit."""

    def __init__(self, binding, evidence_path):
        from hoh import protocol
        self.binding = protocol.validate_clock_binding(binding)
        self.evidence_path = Path(evidence_path)
        if self.evidence_path.exists() or self.evidence_path.is_symlink():
            raise protocol.ClockError("guardian clock evidence already exists")
        elapsed = protocol.boottime_ns()
        now = protocol.IterationDeadline._wall_clock(None)
        boot = protocol.IterationDeadline._boot_identity(None)
        if boot != binding["boot_id"]:
            raise protocol.ClockError("guardian launch crosses a boot")
        if elapsed >= binding["expires_boottime_ns"] or now >= binding["expires_unix_ns"]:
            raise protocol.DeadlineError("guardian started after its original deadline")
        self.clock = protocol.new_boottime_clock(now, elapsed, boot, binding["expires_boottime_ns"] - elapsed,
            wall_cap=binding["expires_unix_ns"], elapsed_cap=binding["expires_boottime_ns"])
        # Keep the immutable wall bound; elapsed expiry was already capped above.
        self.clock["expires_unix_ns"] = binding["expires_unix_ns"]
        self.stopped = None
        self.persist()

    def persist(self):
        from hoh.protocol import _atomic_json_write
        _atomic_json_write(self.evidence_path, {"schema": "vivary.hoh-guardian-clock/v1",
            "binding": self.binding, "clock": self.clock, "stop": self.stopped})

    def remaining(self):
        from hoh import protocol
        if self.stopped is not None:
            raise protocol.DeadlineError("guardian has stopped")
        try:
            elapsed = protocol.boottime_ns()
            now = protocol.IterationDeadline._wall_clock(None)
            boot = protocol.IterationDeadline._boot_identity(None)
            seconds = protocol.advance_boottime_clock(self.clock, now, elapsed, boot)
            if seconds <= 0:
                raise protocol.DeadlineError("guardian absolute BOOTTIME deadline expired")
        except protocol.DeadlineError as error:
            self.stopped = str(error)
            self.persist()
            raise
        self.persist()
        return seconds


def _serve_boottime(server, view, guardian, read_log_path):
    """Recheck the original deadline before consuming bytes after a process pause."""
    from hoh.protocol import _atomic_json_write
    server.setblocking(False)
    with selectors.DefaultSelector() as selector:
        selector.register(server, selectors.EVENT_READ)
        while True:
            events = selector.select(min(.05, guardian.remaining()))
            guardian.remaining()
            if events:
                connection, _ = server.accept()
                break
    with connection, selectors.DefaultSelector() as selector:
        connection.setblocking(False)
        selector.register(connection, selectors.EVENT_READ)
        pending = bytearray()
        tools = RoleTools(view)
        while True:
            events = selector.select(min(.05, guardian.remaining()))
            guardian.remaining()
            if not events:
                continue
            raw = connection.recv(65536)
            if not raw:
                return
            pending.extend(raw)
            while b"\n" in pending:
                line, _, tail = pending.partition(b"\n")
                pending = bytearray(tail)
                if len(line) > MAX_MESSAGE_BYTES:
                    raise ValueError("MCP message exceeds transport allowance")
                guardian.remaining()
                response = tools.respond(decode_message(line))
                guardian.remaining()
                _atomic_json_write(read_log_path, {"role": view.role, "files": list(view.read_log)})
                if response is not None:
                    output = memoryview((json.dumps(response, separators=(",", ":")) + "\n").encode())
                    selector.modify(connection, selectors.EVENT_WRITE)
                    while output:
                        events = selector.select(min(.05, guardian.remaining()))
                        guardian.remaining()
                        if events:
                            output = output[connection.send(output):]
                    selector.modify(connection, selectors.EVENT_READ)
            if len(pending) > MAX_MESSAGE_BYTES:
                raise ValueError("MCP message exceeds transport allowance")


def serve(socket_path: Path, view, *, expires_unix_ns: int, duration_seconds: int | None, guardian=None):
    if socket_path.exists() or socket_path.is_symlink():
        raise ValueError("refuse existing worker socket")
    started = time.monotonic()
    from hoh.protocol import _atomic_json_write
    read_log_path = socket_path.with_name("tool-reads.json")
    if read_log_path.exists() or read_log_path.is_symlink():
        raise ValueError("refuse existing tool read log")
    _atomic_json_write(read_log_path, {"role": view.role, "files": []})
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as server:
        server.bind(str(socket_path))
        socket_path.chmod(0o600)
        server.listen(1)
        try:
            if guardian is not None:
                return _serve_boottime(server, view, guardian, read_log_path)
            server.settimeout(max(0.001, remaining(expires_unix_ns, started, duration_seconds)))
            connection, _ = server.accept()
            with connection:
                connection.settimeout(max(0.001, remaining(expires_unix_ns, started, duration_seconds)))
                with connection.makefile("rwb") as stream:
                    tools = RoleTools(view)
                    while remaining(expires_unix_ns, started, duration_seconds) > 0:
                        connection.settimeout(max(0.001, remaining(expires_unix_ns, started, duration_seconds)))
                        raw = stream.readline(MAX_MESSAGE_BYTES + 1)
                        if not raw:
                            return
                        response = tools.respond(decode_message(raw))
                        _atomic_json_write(read_log_path, {"role": view.role, "files": list(view.read_log)})
                        if response is not None:
                            stream.write((json.dumps(response, separators=(",", ":")) + "\n").encode())
                            stream.flush()
        finally:
            socket_path.unlink(missing_ok=True)


def bridge(socket_path: Path):
    """Copy stdio bytes to the fixed worker socket; no path-selected dispatch."""
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.connect(str(socket_path))
        with selectors.DefaultSelector() as selector:
            selector.register(sys.stdin.buffer, selectors.EVENT_READ, "stdin")
            selector.register(connection, selectors.EVENT_READ, "worker")
            while True:
                for key, _ in selector.select():
                    data = os.read(key.fileobj.fileno(), 65536)
                    if not data:
                        return
                    if key.data == "stdin":
                        connection.sendall(data)
                    else:
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("serve", "bridge", "hold"))
    parser.add_argument("--socket", type=Path, default=Path("/ipc/role.sock"))
    parser.add_argument("--role", choices=("planner", "developer", "qa"))
    parser.add_argument("--write-root")
    parser.add_argument("--expires-unix-ns", type=int)
    parser.add_argument("--duration-seconds", type=int)
    parser.add_argument("--clock-policy")
    parser.add_argument("--boot-id")
    parser.add_argument("--expires-boottime-ns", type=int)
    parser.add_argument("--clock-evidence-path", type=Path)
    args = parser.parse_args()
    if args.mode == "bridge":
        bridge(args.socket)
        return
    # Docker sends TERM to PID 1. Python must handle it explicitly there.
    def stopped(_signal, _frame):
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, stopped)
    if any(value is not None for value in (args.clock_policy, args.boot_id, args.expires_boottime_ns, args.clock_evidence_path)):
        if args.duration_seconds is not None or args.clock_evidence_path is None:
            raise ValueError("absolute guardian requires clock evidence and forbids a new duration")
        binding = {"clock_policy": args.clock_policy, "boot_id": args.boot_id,
                   "expires_unix_ns": args.expires_unix_ns, "expires_boottime_ns": args.expires_boottime_ns}
        guardian = GuardianDeadline(binding, args.clock_evidence_path)
        try:
            if args.mode == "hold":
                while True:
                    time.sleep(min(.05, guardian.remaining()))
            else:
                from hoh_loop import RoleView
                serve(args.socket, RoleView(Path("/role"), args.role, args.write_root),
                      expires_unix_ns=args.expires_unix_ns, duration_seconds=None, guardian=guardian)
        finally:
            if guardian.stopped is None:
                guardian.stopped = "guardian exited"
                guardian.persist()
        return
    if not args.expires_unix_ns or not args.duration_seconds or args.duration_seconds < 1:
        raise ValueError("container watchdog requires bounded absolute and monotonic deadlines")
    if args.mode == "hold":
        started = time.monotonic()
        while remaining(args.expires_unix_ns, started, args.duration_seconds) > 0:
            time.sleep(0.1)
        return
    from hoh_loop import RoleView
    serve(args.socket, RoleView(Path("/role"), args.role, args.write_root),
          expires_unix_ns=args.expires_unix_ns, duration_seconds=args.duration_seconds)


if __name__ == "__main__":
    main()
