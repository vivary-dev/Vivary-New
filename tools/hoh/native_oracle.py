"""Run the fixed product oracle inside a credential-free Habitat container."""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import time

from hoh.native_host import HabitatNativeHost, HostGate, IMAGE, PYTHON, verify_container_inspection
from hoh.protocol import clock_binding_args, validate_clock_binding


FIXTURE_FILES = frozenset({'spec.md', 'linkcheck.py', 'tests/test_links.py'})
MAX_FIXTURE_FILE_BYTES = 1_048_576
ORACLE_COMMAND = [PYTHON, '-I', '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v']


def _absolute_unlinked(path: Path) -> Path:
    if not path.is_absolute() or '..' in path.parts or any(item.is_symlink() for item in (path, *path.parents)):
        raise HostGate('oracle paths must be absolute and link-free')
    return path


def fixture_manifest(project: Path) -> dict[str, str]:
    _absolute_unlinked(project)
    if not project.is_dir():
        raise HostGate('oracle project is not an existing frozen directory')
    files = {}
    for path in project.rglob('*'):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise HostGate('oracle fixture contains a link or special file')
        if path.is_file():
            relative = path.relative_to(project).as_posix()
            if relative not in FIXTURE_FILES or path.stat().st_size > MAX_FIXTURE_FILE_BYTES:
                raise HostGate('oracle fixture has an undeclared or oversized file')
            files[relative] = 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest()
    if set(files) != FIXTURE_FILES:
        raise HostGate('oracle requires the complete fixed three-file fixture')
    return files


class HabitatOracleExecutor:
    """Compose existing Habitat supervision; never run candidate code on WSL."""

    def __init__(self, task_root: Path, source_root: Path):
        self.task_root = _absolute_unlinked(task_root)
        self.source_root = _absolute_unlinked(source_root).resolve(strict=True)
        self.host = HabitatNativeHost(self.task_root, self.source_root)

    def plan(self, project: Path, *, deadline, invocation_id: str) -> dict:
        if not isinstance(invocation_id, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,95}', invocation_id):
            raise HostGate('oracle invocation identity is invalid')
        manifest = fixture_manifest(project)
        remaining = deadline.remaining()
        root = self.task_root / invocation_id
        binding = deadline.clock_binding() if callable(getattr(deadline, 'clock_binding', None)) else None
        name = 'vivary20a-' + hashlib.sha256(('oracle:' + invocation_id).encode()).hexdigest()[:20] + '-worker'
        container = {'kind': 'worker', 'name': name, 'network': 'none',
            'mounts': [
                {'type': 'bind', 'source': str(root / 'runtime'), 'target': '/opt/vivary-role', 'writable': False},
                {'type': 'bind', 'source': str(project), 'target': '/role', 'writable': False}],
            'entry_args': ['-B', '/opt/vivary-role/hoh/role_mcp.py', 'hold',
                '--expires-unix-ns', str(deadline.expires_unix_ns), '--duration-seconds', str(max(1, math.ceil(remaining)))]}
        if binding is not None:
            binding = validate_clock_binding(binding)
            container['mounts'].append({'type': 'bind', 'source': str(root / 'ipc'), 'target': '/ipc', 'writable': True})
            container['entry_args'] = ['-B', '/opt/vivary-role/hoh/role_mcp.py', 'hold', *clock_binding_args(binding),
                                      '--clock-evidence-path', '/ipc/hold-clock.json']
        return {'root': root, 'project': project, 'manifest': manifest, 'container': container,
                **({'clock_binding': binding} if binding is not None else {})}

    def _cleanup_container(self, name: str, *, grace_seconds: float, expires_monotonic=None, expires_boottime_ns=None):
        expires = time.monotonic() + grace_seconds
        if expires_monotonic is not None:
            expires = min(expires, expires_monotonic)
        remaining = expires - time.monotonic()
        if expires_boottime_ns is not None:
            from hoh.protocol import boottime_ns
            remaining = min(remaining, (expires_boottime_ns - boottime_ns()) / 1_000_000_000)
        if remaining <= 0:
            raise HostGate('oracle cleanup exceeded the original stop grace')
        inspected = self.host._control(['inspect', name], check=False, timeout=remaining)
        if inspected.returncode == 0:
            self.host._cleanup_names([name], grace_seconds=grace_seconds, expires_monotonic=expires,
                **({'expires_boottime_ns': expires_boottime_ns} if expires_boottime_ns is not None else {}))
        elif 'no such object' not in inspected.stderr.lower():
            raise HostGate('oracle container absence is unconfirmed')

    def run(self, project: Path, *, deadline, invocation_id: str) -> dict:
        if os.name != 'posix' or os.getuid() != 1000:
            raise HostGate('oracle execution requires the verified Habitat UID')
        plan = self.plan(project, deadline=deadline, invocation_id=invocation_id)
        root, container = plan['root'], plan['container']
        if root.exists() or root.is_symlink():
            raise HostGate('existing oracle resources require reconciliation')
        if self.host._control(['inspect', container['name']], check=False).returncode == 0:
            raise HostGate('an existing oracle container requires reconciliation')
        guardian = self.source_root / 'tools/hoh/role_mcp.py'
        _absolute_unlinked(guardian)
        if not guardian.is_file():
            raise HostGate('existing role deadline guardian is unavailable')
        target = root / 'runtime/hoh/role_mcp.py'
        target.parent.mkdir(parents=True)
        shutil.copyfile(guardian, target)
        if 'clock_binding' in plan:
            (root / 'ipc').mkdir()
            shutil.copyfile(self.source_root / 'tools/hoh/protocol.py', root / 'runtime/hoh/protocol.py')
        evidence_path = root / 'isolation.json'
        evidence = {'schema': 'vivary.habitat-oracle/v1', 'fixture': plan['manifest'],
                    'guardian_sha256': 'sha256:' + hashlib.sha256(target.read_bytes()).hexdigest(),
                    'image': IMAGE, 'model_calls': 0, 'cleanup_confirmed': False}
        if 'clock_binding' in plan:
            evidence['clock_binding'] = plan['clock_binding']
            evidence['clock_protocol_sha256'] = 'sha256:' + hashlib.sha256((root / 'runtime/hoh/protocol.py').read_bytes()).hexdigest()
        attempted = False
        stop_started = False
        container_cleaned = False

        def stop_container(*, expires_monotonic, expires_boottime_ns=None):
            nonlocal stop_started, container_cleaned
            if stop_started:
                raise HostGate('oracle stop callback repeated')
            stop_started = True
            self._cleanup_container(container['name'], grace_seconds=deadline.stop_grace_seconds,
                                    expires_monotonic=expires_monotonic,
                                    **({'expires_boottime_ns': expires_boottime_ns} if expires_boottime_ns is not None else {}))
            container_cleaned = True

        try:
            deadline.remaining()
            attempted = True
            self.host._control(self.host.create_command(container))
            actual = self.host._json(['inspect', container['name']])[0]
            evidence['container'] = verify_container_inspection(actual, container, running=False)
            self.host._control(['start', container['name']])
            verify_container_inspection(self.host._json(['inspect', actual['Id']])[0], container, running=True)
            evidence['process_boundary'] = self.host._verify_process_boundary(container)
            evidence_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + '\n')
            deadline.remaining()
            from hoh_loop import run_owned_process
            process = run_owned_process(['docker', 'exec', '--workdir', '/role', actual['Id'], *ORACLE_COMMAND],
                cwd=root, deadline=deadline, on_stop=stop_container, max_output_bytes=4 * 1024 * 1024)
        finally:
            if attempted and not stop_started:
                self._cleanup_container(container['name'], grace_seconds=deadline.stop_grace_seconds,
                    **self.host._cleanup_timing({**plan, 'stop_grace_seconds': deadline.stop_grace_seconds}))
                container_cleaned = True
            elif stop_started and not container_cleaned:
                raise HostGate('oracle cleanup is unconfirmed; retain resources for reconciliation')
            self.host._cleanup_files({'root': root, **({'clock_binding': plan['clock_binding']} if 'clock_binding' in plan else {})})
            evidence['cleanup_confirmed'] = container_cleaned or not attempted
            evidence_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + '\n')
        if fixture_manifest(project) != plan['manifest']:
            raise HostGate('the frozen oracle fixture changed during execution')
        return {**process, 'cleanup_confirmed': process['cleanup_confirmed'] and container_cleaned,
                'isolation_evidence_ref': str(evidence_path)}
