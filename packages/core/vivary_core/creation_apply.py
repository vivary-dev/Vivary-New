"""Linux staged creation with injected namespace and receipt authority.

Core does not import create-vivary or a Native database.  A host supplies the
thin-workspace callbacks, a durable receipt port, and exclusive namespace
custody.  The safe namespace default refuses every operation.
"""

from __future__ import annotations

import ctypes
from dataclasses import dataclass
import errno
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
from contextlib import contextmanager
from typing import Callable, ContextManager, Mapping, Protocol, TypeVar

from vivary_core.creation_authority import (
    CreationAuthority,
    CreationBinding,
    CreationLease,
)
from vivary_core.physical_observe import ObservationFailure


_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
_PHASES = frozenset({"preparing", "prepared", "publishing", "published"})
_TRANSITIONS = {
    ("preparing", "prepared"),
    ("prepared", "publishing"),
    ("publishing", "published"),
}
_RENAME_NOREPLACE = 1


def _exact_id(value: object) -> bool:
    return type(value) is str and _ID.fullmatch(value) is not None


def _exact_digest(value: object) -> bool:
    return type(value) is str and _DIGEST.fullmatch(value) is not None


@dataclass(frozen=True)
class CreationApplyLimits:
    max_files: int = 16
    max_bytes: int = 2 * 1024 * 1024
    max_depth: int = 16

    def __post_init__(self):
        if any(type(value) is not int or not 1 <= value <= 2**24
               for value in vars(self).values()):
            raise ValueError("creation apply limits must be bounded positive integers")


@dataclass(frozen=True)
class ThinWorkspaceOptions:
    preset: str = "coding"
    adapters: tuple[str, ...] = ()
    active_context: str | None = None

    def __post_init__(self):
        if (not _exact_id(self.preset)
                or type(self.adapters) is not tuple
                or len(self.adapters) > 16
                or any(not _exact_id(item) for item in self.adapters)
                or len(set(self.adapters)) != len(self.adapters)
                or (self.active_context is not None
                    and not _exact_id(self.active_context))):
            raise ValueError("thin workspace options require bounded identifiers")
        object.__setattr__(self, "adapters", tuple(sorted(self.adapters)))


@dataclass(frozen=True)
class CreationNamespaceIdentity:
    """Private host identity retained across the declared restart boundary."""

    namespace_key: str
    child_key: str
    stage_id: str
    continuity_id: str

    def __post_init__(self):
        if any(not _exact_id(value) for value in vars(self).values()):
            raise ValueError("creation namespace identity requires bounded identifiers")


@dataclass(frozen=True)
class CreationReceiptSnapshot:
    """Trusted internal receipt state.  It is not a public replay response."""

    binding: CreationBinding
    phase: str
    namespace: CreationNamespaceIdentity

    def __post_init__(self):
        if type(self.binding) is not CreationBinding or self.phase not in _PHASES:
            raise ValueError("creation receipt snapshot is invalid")
        if type(self.namespace) is not CreationNamespaceIdentity:
            raise ValueError("creation receipt namespace is invalid")


@dataclass(frozen=True)
class CreationApplyFailure:
    code: str
    reason: str
    phase: str | None = None


@dataclass(frozen=True)
class CreationApplyResult:
    code: str
    operation_id: str
    phase: str
    replayed: bool
    target_present: bool
    registered: bool = False


class HeldCreationNamespace(Protocol):
    """Custody held under one host-owned cross-process writer lock.

    Implementations attest exclusive control of the parent, staging directory,
    and their ancestors.  Paths, descriptors, inode matches, and permission bits
    do not establish that claim by themselves.
    """

    identity: CreationNamespaceIdentity
    parent_path: Path
    stage_parent_path: Path
    parent_fd: int
    stage_parent_fd: int

    def revalidate(self) -> CreationNamespaceIdentity | CreationApplyFailure:
        """Return the unchanged identity while custody and the writer lock hold."""


class CreationNamespace(Protocol):
    def hold(
        self, binding: CreationBinding
    ) -> ContextManager[HeldCreationNamespace | CreationApplyFailure]: ...


class RefusingCreationNamespace:
    """Safe production default until a host proves exclusive namespace custody."""

    @contextmanager
    def hold(self, binding: CreationBinding):
        del binding
        yield CreationApplyFailure(
            "recovery-required", "creation-namespace-unconfigured"
        )


T = TypeVar("T")


class CreationReceiptPort(Protocol):
    """Durable receipt seam owned by the existing Native receipt database.

    ``admit_and_execute`` must admit exactly one synchronous effect under current
    creation authority, the expected phase, and unchanged namespace continuity.
    It must order disconnection and revocation before returning control.  Public
    historical read/replay methods are deliberately absent from this effect port.
    """

    def load(
        self, binding: CreationBinding, namespace: CreationNamespaceIdentity
    ) -> CreationReceiptSnapshot | CreationApplyFailure | None: ...

    def prepare(
        self, binding: CreationBinding, namespace: CreationNamespaceIdentity
    ) -> CreationReceiptSnapshot | CreationApplyFailure: ...

    def admit_and_execute(
        self,
        binding: CreationBinding,
        snapshot: CreationReceiptSnapshot,
        namespace: CreationNamespaceIdentity,
        effect: str,
        execute: Callable[[], T],
    ) -> T | CreationApplyFailure: ...

    def transition(
        self,
        binding: CreationBinding,
        snapshot: CreationReceiptSnapshot,
        namespace: CreationNamespaceIdentity,
        expected_phase: str,
        next_phase: str,
    ) -> CreationReceiptSnapshot | CreationApplyFailure: ...


class ThinWorkspaceOperations(Protocol):
    """Injected create-vivary and Tropo operations; Core has no package edge."""

    def plan(self, target: Path, options: ThinWorkspaceOptions) -> Mapping: ...

    def recovery_plan(self, target: Path, options: ThinWorkspaceOptions) -> Mapping: ...

    def scaffold(self, target: Path, options: ThinWorkspaceOptions) -> object: ...

    def doctor(self, target: Path) -> Mapping: ...

    def tropo(self, target: Path) -> bool | int | Mapping: ...


class _ApplyRefused(Exception):
    def __init__(self, failure: CreationApplyFailure):
        self.failure = failure
        super().__init__(failure.reason)


def _failure(code: str, reason: str, phase: str | None = None) -> CreationApplyFailure:
    return CreationApplyFailure(code, reason, phase)


def _sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _plan_hash(value: Mapping) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return _sha256(encoded)


def _relative_file(value: object, limits: CreationApplyLimits) -> str | None:
    if type(value) is not str or not value or "\\" in value:
        return None
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ("", ".", "..") for part in path.parts):
        return None
    if len(path.parts) > limits.max_depth or path.as_posix() != value:
        return None
    return value


def _validate_plan(
    value: object,
    target: Path,
    options: ThinWorkspaceOptions,
    accepted_digest: str,
    limits: CreationApplyLimits,
) -> tuple[dict, dict[str, bytes]] | CreationApplyFailure:
    fields = {
        "schema", "target", "preset", "adapters", "active_context", "files",
        "content_sha256", "plan_sha256",
    }
    if type(value) is not dict or set(value) != fields:
        return _failure("invalid-preview", "creation-preview-shape-invalid")
    if (value["schema"] != "vivary.thin-init-plan/v1"
            or value["target"] != str(target)
            or value["preset"] != options.preset
            or value["adapters"] != list(options.adapters)
            or value["active_context"] != options.active_context
            or type(value["files"]) is not list
            or not 1 <= len(value["files"]) <= limits.max_files
            or not _exact_digest(value["content_sha256"])
            or not _exact_digest(value["plan_sha256"])):
        return _failure("invalid-preview", "creation-preview-binding-invalid")

    expected: dict[str, bytes] = {}
    total = 0
    for row in value["files"]:
        if type(row) is not dict or set(row) != {"path", "content", "bytes", "sha256"}:
            return _failure("invalid-preview", "creation-preview-file-invalid")
        relative = _relative_file(row["path"], limits)
        if relative is None or relative in expected or type(row["content"]) is not str:
            return _failure("invalid-preview", "creation-preview-file-invalid")
        data = row["content"].encode("utf-8")
        if (type(row["bytes"]) is not int or row["bytes"] != len(data)
                or row["sha256"] != _sha256(data)):
            return _failure("invalid-preview", "creation-preview-bytes-invalid")
        total += len(data)
        if total > limits.max_bytes:
            return _failure("invalid-preview", "creation-preview-limit")
        expected[relative] = data

    if value["content_sha256"] != _plan_hash({"files": value["files"]}):
        return _failure("invalid-preview", "creation-content-digest-invalid")
    unsigned = {key: value[key] for key in value if key != "plan_sha256"}
    if value["plan_sha256"] != _plan_hash(unsigned):
        return _failure("invalid-preview", "creation-plan-digest-invalid")
    if value["plan_sha256"] != accepted_digest:
        return _failure("plan-mismatch", "accepted-creation-plan-changed")
    return value, expected


def _path_kind(path: Path) -> str:
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return "missing"
    except OSError:
        return "unknown"
    if stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode):
        return "directory"
    return "other"


def _canonical_link_free_directory(path: object) -> Path | None:
    if not isinstance(path, Path) or not path.is_absolute() or ".." in path.parts:
        return None
    try:
        resolved = path.resolve(strict=True)
        if resolved != path or len(path.parts) <= 1:
            return None
        current = Path(path.anchor)
        for part in path.parts[1:]:
            current = current / part
            info = os.lstat(current)
            if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
                return None
    except OSError:
        return None
    return resolved


def _paths_overlap(left: Path, right: Path) -> bool:
    return left == right or left in right.parents or right in left.parents


def _compare_tree(
    root: Path, expected: Mapping[str, bytes], limits: CreationApplyLimits
) -> CreationApplyFailure | None:
    if _path_kind(root) != "directory":
        return _failure("recovery-required", "creation-tree-unavailable")
    expected_dirs = {
        parent.as_posix()
        for name in expected
        for parent in PurePosixPath(name).parents
        if parent.as_posix() != "."
    }
    seen_files: set[str] = set()
    seen_dirs: set[str] = set()
    count = 0
    total = 0
    try:
        for directory, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
            base = Path(directory)
            dirnames.sort()
            filenames.sort()
            for name in tuple(dirnames):
                child = base / name
                info = os.lstat(child)
                if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
                    return _failure("recovery-required", "creation-tree-not-exact")
                relative = child.relative_to(root).as_posix()
                if len(PurePosixPath(relative).parts) > limits.max_depth:
                    return _failure("recovery-required", "creation-tree-limit")
                seen_dirs.add(relative)
            for name in filenames:
                child = base / name
                info = os.lstat(child)
                if (not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)
                        or info.st_nlink != 1):
                    return _failure("recovery-required", "creation-tree-not-exact")
                relative = child.relative_to(root).as_posix()
                count += 1
                total += info.st_size
                if count > limits.max_files or total > limits.max_bytes:
                    return _failure("recovery-required", "creation-tree-limit")
                if relative not in expected or child.read_bytes() != expected[relative]:
                    return _failure("recovery-required", "creation-tree-not-exact")
                seen_files.add(relative)
    except OSError:
        return _failure("recovery-required", "creation-tree-unavailable")
    if seen_files != set(expected) or seen_dirs != expected_dirs:
        return _failure("recovery-required", "creation-tree-not-exact")
    return None


def _sync_tree(root: Path) -> None:
    directories: list[Path] = []
    flags = (os.O_RDONLY | os.O_CLOEXEC | getattr(os, "O_NOFOLLOW", 0)
             | getattr(os, "O_NONBLOCK", 0))
    for directory, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        base = Path(directory)
        directories.append(base)
        for name in dirnames:
            info = os.lstat(base / name)
            if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
                raise OSError(errno.ELOOP, "non-directory in staged tree")
        for name in filenames:
            path = base / name
            fd = os.open(path, flags)
            try:
                info = os.fstat(fd)
                if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                    raise OSError(errno.EINVAL, "non-file in staged tree")
                os.fsync(fd)
            finally:
                os.close(fd)
    directory_flags = flags | os.O_DIRECTORY
    for path in reversed(directories):
        fd = os.open(path, directory_flags)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def _rename_noreplace(source_fd: int, target_fd: int, child_name: str) -> None:
    if sys.platform != "linux":
        raise OSError(errno.ENOSYS, "renameat2 is Linux-only")
    libc = ctypes.CDLL(None, use_errno=True)
    renameat2 = getattr(libc, "renameat2", None)
    if renameat2 is None:
        raise OSError(errno.ENOSYS, "renameat2 is unavailable")
    renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p,
                          ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    renameat2.restype = ctypes.c_int
    name = os.fsencode(child_name)
    if renameat2(source_fd, name, target_fd, name, _RENAME_NOREPLACE) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error), child_name)


def _doctor_ok(value: object) -> bool:
    return isinstance(value, Mapping) and value.get("ok") is True


def _tropo_ok(value: object) -> bool:
    return (value is True
            or (type(value) is int and value == 0)
            or (isinstance(value, Mapping) and value.get("ok") is True))


class CreationApply:
    """Apply one accepted thin plan and recover its persisted phase protocol."""

    def __init__(
        self,
        authority: CreationAuthority,
        receipts: CreationReceiptPort,
        operations: ThinWorkspaceOperations,
        *,
        namespace: CreationNamespace | None = None,
        limits: CreationApplyLimits = CreationApplyLimits(),
    ):
        if type(authority) is not CreationAuthority:
            raise TypeError("creation apply requires CreationAuthority")
        if namespace is not None and not callable(getattr(namespace, "hold", None)):
            raise TypeError("creation namespace must provide held custody")
        for name in ("load", "prepare", "admit_and_execute", "transition"):
            if not callable(getattr(receipts, name, None)):
                raise TypeError("creation apply requires a typed receipt port")
        for name in ("plan", "recovery_plan", "scaffold", "doctor", "tropo"):
            if not callable(getattr(operations, name, None)):
                raise TypeError("creation apply requires thin workspace operations")
        if type(limits) is not CreationApplyLimits:
            raise TypeError("creation apply limits require exact configuration")
        self._authority = authority
        self._receipts = receipts
        self._operations = operations
        self._namespace = namespace or RefusingCreationNamespace()
        self._limits = limits

    def _current_binding(
        self, lease: CreationLease, expected: CreationBinding | None = None
    ) -> CreationBinding:
        current = self._authority.inspect(lease)
        if isinstance(current, ObservationFailure):
            raise _ApplyRefused(_failure(current.code, current.reason))
        if type(current) is not CreationBinding or (expected is not None and current != expected):
            raise _ApplyRefused(_failure("denied", "creation-binding-changed"))
        return current

    @staticmethod
    def _current_namespace(
        custody: HeldCreationNamespace, expected: CreationNamespaceIdentity
    ) -> None:
        try:
            current = custody.revalidate()
        except Exception as exc:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-continuity-unavailable"
            )) from exc
        if isinstance(current, CreationApplyFailure):
            raise _ApplyRefused(current)
        if current != expected:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-continuity-lost"
            ))

    def _validate_custody(
        self, custody: HeldCreationNamespace, binding: CreationBinding
    ) -> tuple[Path, Path, CreationNamespaceIdentity]:
        try:
            identity = custody.identity
            parent = custody.parent_path
            stage_parent = custody.stage_parent_path
            parent_fd = custody.parent_fd
            stage_parent_fd = custody.stage_parent_fd
        except Exception as exc:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-custody-invalid"
            )) from exc
        parent = _canonical_link_free_directory(parent)
        stage_parent = _canonical_link_free_directory(stage_parent)
        if (type(identity) is not CreationNamespaceIdentity
                or parent is None or stage_parent is None
                or type(parent_fd) is not int or type(stage_parent_fd) is not int):
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-custody-invalid"
            ))
        try:
            parent_info = os.fstat(parent_fd)
            stage_info = os.fstat(stage_parent_fd)
            parent_path_info = os.stat(parent, follow_symlinks=False)
            stage_path_info = os.stat(stage_parent, follow_symlinks=False)
        except OSError as exc:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-custody-unavailable"
            )) from exc
        if (not all(stat.S_ISDIR(item.st_mode) for item in
                    (parent_info, stage_info, parent_path_info, stage_path_info))
                or (parent_info.st_dev, parent_info.st_ino)
                    != (parent_path_info.st_dev, parent_path_info.st_ino)
                or (stage_info.st_dev, stage_info.st_ino)
                    != (stage_path_info.st_dev, stage_path_info.st_ino)
                or parent_info.st_dev != stage_info.st_dev
                or (parent_info.st_dev, parent_info.st_ino)
                    == (stage_info.st_dev, stage_info.st_ino)):
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-custody-invalid"
            ))
        target = parent / binding.child_name
        stage = stage_parent / binding.child_name
        if any(_paths_overlap(left, right)
               for left in (parent, target)
               for right in (stage_parent, stage)):
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-staging-overlaps-target"
            ))
        self._current_namespace(custody, identity)
        return target, stage, identity

    def _snapshot(
        self,
        value: object,
        binding: CreationBinding,
        identity: CreationNamespaceIdentity,
    ) -> CreationReceiptSnapshot:
        if isinstance(value, CreationApplyFailure):
            raise _ApplyRefused(value)
        if (type(value) is not CreationReceiptSnapshot
                or value.binding != binding or value.namespace != identity):
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-receipt-invalid"
            ))
        return value

    def _transition(
        self,
        lease: CreationLease,
        binding: CreationBinding,
        custody: HeldCreationNamespace,
        snapshot: CreationReceiptSnapshot,
        next_phase: str,
    ) -> CreationReceiptSnapshot:
        if (snapshot.phase, next_phase) not in _TRANSITIONS:
            raise _ApplyRefused(_failure("stale-phase", "creation-phase-invalid"))
        self._current_binding(lease, binding)
        self._current_namespace(custody, snapshot.namespace)
        try:
            value = self._receipts.transition(
                binding, snapshot, snapshot.namespace, snapshot.phase, next_phase
            )
        except Exception as exc:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-receipt-unavailable", snapshot.phase
            )) from exc
        updated = self._snapshot(value, binding, snapshot.namespace)
        if updated.phase != next_phase:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-receipt-transition-invalid",
                snapshot.phase,
            ))
        return updated

    def _effect(
        self,
        lease: CreationLease,
        binding: CreationBinding,
        custody: HeldCreationNamespace,
        snapshot: CreationReceiptSnapshot,
        effect_name: str,
        action: Callable[[], None],
    ) -> None:
        self._current_binding(lease, binding)
        self._current_namespace(custody, snapshot.namespace)
        completed = object()
        called = False
        active = True

        def once():
            nonlocal called
            if not active:
                raise RuntimeError("creation effect admission is no longer active")
            if called:
                raise RuntimeError("creation effect callback called more than once")
            called = True
            self._current_binding(lease, binding)
            self._current_namespace(custody, snapshot.namespace)
            action()
            return completed

        try:
            result = self._receipts.admit_and_execute(
                binding, snapshot, snapshot.namespace, effect_name, once
            )
        except _ApplyRefused:
            raise
        except Exception as exc:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-effect-uncertain", snapshot.phase
            )) from exc
        finally:
            active = False
        if isinstance(result, CreationApplyFailure):
            raise _ApplyRefused(result)
        if result is not completed or not called:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-admission-incomplete", snapshot.phase
            ))

    def _plan(
        self,
        target: Path,
        options: ThinWorkspaceOptions,
        binding: CreationBinding,
        *,
        recovery: bool,
    ) -> tuple[dict, dict[str, bytes]]:
        callback = (self._operations.recovery_plan if recovery
                    else self._operations.plan)
        try:
            value = callback(target, options)
        except Exception as exc:
            raise _ApplyRefused(_failure(
                "recovery-required" if recovery else "invalid-preview",
                "creation-preview-unavailable",
            )) from exc
        checked = _validate_plan(
            value, target, options, binding.accepted_plan_sha256, self._limits
        )
        if isinstance(checked, CreationApplyFailure):
            raise _ApplyRefused(checked)
        return checked

    def _verify_workspace(self, path: Path, expected: Mapping[str, bytes]) -> None:
        mismatch = _compare_tree(path, expected, self._limits)
        if mismatch is not None:
            raise _ApplyRefused(mismatch)
        try:
            doctor = self._operations.doctor(path)
            tropo = self._operations.tropo(path)
        except Exception as exc:
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-verification-unavailable"
            )) from exc
        if not _doctor_ok(doctor):
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-doctor-refused"
            ))
        if not _tropo_ok(tropo):
            raise _ApplyRefused(_failure(
                "recovery-required", "creation-tropo-refused"
            ))

    @staticmethod
    def _result(
        binding: CreationBinding, *, replayed: bool, target_present: bool
    ) -> CreationApplyResult:
        return CreationApplyResult(
            "created-unregistered", binding.operation_id, "published",
            replayed, target_present,
        )

    def apply(
        self,
        lease: CreationLease,
        *,
        preset: str = "coding",
        adapters: tuple[str, ...] = (),
        active_context: str | None = None,
    ) -> CreationApplyResult | CreationApplyFailure:
        """Converge one operation while holding trusted namespace custody."""
        if sys.platform != "linux":
            return _failure("identity-unverified", "platform-unsupported")
        try:
            options = ThinWorkspaceOptions(preset, adapters, active_context)
        except (TypeError, ValueError):
            return _failure("invalid-input", "invalid-thin-workspace-options")

        try:
            binding = self._current_binding(lease)
            with self._namespace.hold(binding) as held:
                if isinstance(held, CreationApplyFailure):
                    raise _ApplyRefused(held)
                target, stage, identity = self._validate_custody(held, binding)
                try:
                    loaded = self._receipts.load(binding, identity)
                except Exception as exc:
                    raise _ApplyRefused(_failure(
                        "recovery-required", "creation-receipt-unavailable"
                    )) from exc
                snapshot = None if loaded is None else self._snapshot(
                    loaded, binding, identity
                )
                replayed = snapshot is not None

                target_kind = _path_kind(target)
                stage_kind = _path_kind(stage)

                if snapshot is not None and snapshot.phase == "published":
                    if stage_kind != "missing" or target_kind == "unknown":
                        raise _ApplyRefused(_failure(
                            "recovery-required", "published-creation-state-unclear",
                            "published",
                        ))
                    return self._result(
                        binding, replayed=True, target_present=target_kind != "missing"
                    )

                if snapshot is not None and snapshot.phase == "publishing":
                    if stage_kind == "missing" and target_kind == "directory":
                        _plan, expected = self._plan(
                            target, options, binding, recovery=True
                        )
                        self._verify_workspace(target, expected)

                        def finish_sync():
                            _sync_tree(target)
                            os.fsync(held.stage_parent_fd)
                            os.fsync(held.parent_fd)

                        self._effect(
                            lease, binding, held, snapshot,
                            "recover-publication", finish_sync,
                        )
                        snapshot = self._transition(
                            lease, binding, held, snapshot, "published"
                        )
                        return self._result(
                            binding, replayed=True, target_present=True
                        )
                    if stage_kind != "directory" or target_kind != "missing":
                        raise _ApplyRefused(_failure(
                            "recovery-required", "publishing-state-unclear",
                            "publishing",
                        ))
                    _plan, expected = self._plan(
                        target, options, binding, recovery=False
                    )
                    self._verify_workspace(stage, expected)

                if snapshot is None or snapshot.phase == "preparing":
                    if target_kind != "missing":
                        raise _ApplyRefused(_failure(
                            "target-occupied", "creation-target-occupied",
                            snapshot.phase if snapshot else None,
                        ))
                    if snapshot is None and stage_kind != "missing":
                        raise _ApplyRefused(_failure(
                            "recovery-required", "unrecorded-creation-stage-present"
                        ))
                    _plan, expected = self._plan(
                        target, options, binding, recovery=False
                    )
                    if snapshot is None:
                        try:
                            prepared = self._receipts.prepare(binding, identity)
                        except Exception as exc:
                            raise _ApplyRefused(_failure(
                                "recovery-required", "creation-receipt-unavailable"
                            )) from exc
                        snapshot = self._snapshot(prepared, binding, identity)
                        if snapshot.phase != "preparing":
                            raise _ApplyRefused(_failure(
                                "recovery-required", "creation-receipt-phase-invalid"
                            ))

                    def build_stage():
                        kind = _path_kind(stage)
                        if kind == "directory":
                            shutil.rmtree(stage)
                        elif kind != "missing":
                            raise OSError(errno.EEXIST, "staging target is not a directory")
                        self._operations.scaffold(stage, options)
                        mismatch = _compare_tree(stage, expected, self._limits)
                        if mismatch is not None:
                            raise _ApplyRefused(mismatch)
                        _sync_tree(stage)
                        os.fsync(held.stage_parent_fd)

                    self._effect(
                        lease, binding, held, snapshot, "prepare-stage", build_stage
                    )
                    self._verify_workspace(stage, expected)
                    snapshot = self._transition(
                        lease, binding, held, snapshot, "prepared"
                    )
                    stage_kind = "directory"

                if snapshot.phase == "prepared":
                    if _path_kind(target) != "missing" or _path_kind(stage) != "directory":
                        raise _ApplyRefused(_failure(
                            "recovery-required", "prepared-state-unclear", "prepared"
                        ))
                    _plan, expected = self._plan(
                        target, options, binding, recovery=False
                    )
                    self._verify_workspace(stage, expected)
                    snapshot = self._transition(
                        lease, binding, held, snapshot, "publishing"
                    )

                if snapshot.phase != "publishing":
                    raise _ApplyRefused(_failure(
                        "recovery-required", "creation-receipt-phase-invalid"
                    ))

                def publish():
                    _sync_tree(stage)
                    os.fsync(held.stage_parent_fd)
                    _rename_noreplace(
                        held.stage_parent_fd, held.parent_fd, binding.child_name
                    )
                    os.fsync(held.stage_parent_fd)
                    os.fsync(held.parent_fd)

                self._effect(
                    lease, binding, held, snapshot, "publish", publish
                )
                snapshot = self._transition(
                    lease, binding, held, snapshot, "published"
                )
                return self._result(
                    binding, replayed=replayed, target_present=True
                )
        except _ApplyRefused as exc:
            return exc.failure
        except Exception:
            return _failure("recovery-required", "creation-state-uncertain")
