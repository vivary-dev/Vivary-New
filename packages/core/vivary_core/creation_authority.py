"""Read-only creation grants bound to Linux parent-directory custody.

The host installs an authenticated resolver and fixed, service-controlled parent
paths. This module cannot establish that the host controls their namespace. It
never accepts a GUI path, inspects a child, or writes project or registry state.

A lease binds a request and current create-child grant to a held parent object.
It provides neither pathname containment between checks, cross-process exclusion,
nor identity after restart. Successful inspection does not authorize an effect;
an apply owner still needs its own verified write and recovery boundary.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path
import re
import sys
import threading
from types import MappingProxyType
from typing import Callable, Mapping

from vivary_core.physical_observe import ObservationFailure


_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _matches(pattern: re.Pattern, value: object) -> bool:
    return type(value) is str and pattern.fullmatch(value) is not None


@dataclass(frozen=True)
class CreationLimits:
    """Host-selected operational capacity, not limits on a user's projects."""

    max_parents: int = 16
    max_operations: int = 32
    max_parent_depth: int = 64

    def __post_init__(self):
        if any(type(value) is not int or not 1 <= value <= 2**20
               for value in vars(self).values()):
            raise ValueError("creation capacity must be a bounded positive integer")


@dataclass(frozen=True)
class ResolvedCreationAuthority:
    """Current facts from the trusted host, never from request JSON.

    Parent grants are explicit create-child grants within the fixed configuration.
    Membership or a registry capability alone cannot satisfy them. The host owns
    authentication, policy revision changes, and service-controlled parent setup.
    """

    actor_id: str
    collection_id: str
    device_id: str
    policy_revision: int
    member: bool
    capabilities: frozenset[str]
    creatable_parents: frozenset[str]

    def __post_init__(self):
        if any(not _matches(_ID, value) for value in
               (self.actor_id, self.collection_id, self.device_id)):
            raise ValueError("creation authority requires bound identities")
        if (type(self.policy_revision) is not int
                or not 1 <= self.policy_revision <= 2**53 - 1
                or type(self.member) is not bool):
            raise ValueError("creation policy facts require exact types")
        if (type(self.capabilities) is not frozenset
                or any(not _matches(_ID, item) for item in self.capabilities)
                or type(self.creatable_parents) is not frozenset
                or any(not _matches(_ID, item) for item in self.creatable_parents)):
            raise ValueError("creation grants must be immutable identifiers")


class CreationLease:
    """Opaque process-local handle; only its issuing owner can inspect it."""

    __slots__ = ()

    def __reduce_ex__(self, protocol):
        raise TypeError("creation leases cannot be persisted")


@dataclass(frozen=True)
class CreationBinding:
    """Read-only facts at inspection time, not a portable grant or write token.

    The digest is a request binding only: this owner does not validate plan bytes.
    Parent custody is object custody; the child remains entirely unobserved.
    """

    actor_id: str
    collection_id: str
    device_id: str
    policy_revision: int
    operation_id: str
    parent_ref: str
    child_name: str
    accepted_plan_sha256: str
    filesystem_effects: str = field(default="unsupported", init=False)
    restart_continuity: bool = field(default=False, init=False)
    cross_process_reservation: bool = field(default=False, init=False)
    pathname_containment: bool = field(default=False, init=False)


@dataclass(frozen=True)
class _Request:
    operation_id: str
    parent_ref: str
    child_name: str
    accepted_plan_sha256: str
    expected_policy_revision: int


@dataclass(frozen=True)
class _Held:
    request: _Request
    authority: ResolvedCreationAuthority
    fd: int
    identity: tuple[int, int]


def _open_parent(path: Path) -> int:
    """Open each configured component relative to its already-open parent."""
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    fd = os.open("/", flags)
    try:
        for part in path.parts[1:]:
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


class CreationAuthority:
    """Observe explicit grants and parent custody without performing creation.

    ``parents`` is bounded trusted configuration, copied at construction. It must
    name service-controlled directories, not arbitrary user-selected folders.
    Configuration changes require a new owner. No directory descriptor escapes.
    Operation identity and tombstones last only until this owner closes.
    """

    def __init__(self, resolver: Callable[[], ResolvedCreationAuthority | ObservationFailure],
                 *, parents: Mapping[str, Path], limits: CreationLimits = CreationLimits()):
        if not callable(resolver) or not isinstance(parents, Mapping):
            raise TypeError("a trusted resolver and fixed parent mapping are required")
        if type(limits) is not CreationLimits:
            raise TypeError("creation limits require a validated capacity configuration")
        configured = dict(parents)
        if not 1 <= len(configured) <= limits.max_parents:
            raise ValueError("creation parent count exceeds configured capacity")
        for name, path in configured.items():
            if (not _matches(_ID, name) or not isinstance(path, Path)
                    or not path.is_absolute() or ".." in path.parts
                    or len(path.parts) > limits.max_parent_depth or path == Path(path.anchor)):
                raise ValueError("creation parent must be a bounded absolute non-root path")
        self._resolve = resolver
        self._parents = MappingProxyType(configured)
        self._limits = limits
        self._issued: dict[CreationLease, _Held] = {}
        self._operations: dict[str, tuple[_Request, CreationLease]] = {}
        self._closed = False
        self._owner_pid = os.getpid()
        self._lock = threading.RLock()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def _check_process(self) -> ObservationFailure | None:
        if os.getpid() == self._owner_pid:
            return None
        # A fork can inherit a lock held by a thread absent from the child.
        # Never acquire it. Only the child's descriptor copies are closed here.
        self._lock = threading.RLock()
        self._closed = True
        for handle in tuple(self._issued):
            self._retire(handle)
        self._operations.clear()
        return ObservationFailure("identity-unverified", "creation-owner-process-changed")

    def close(self):
        if self._check_process() is not None:
            return
        with self._lock:
            self._closed = True
            for handle in tuple(self._issued):
                self._retire(handle)
            self._operations.clear()

    def _retire(self, handle: CreationLease):
        held = self._issued.pop(handle, None)
        if held is not None:
            os.close(held.fd)

    def _authorize(self, request: _Request) -> ResolvedCreationAuthority | ObservationFailure:
        process_failure = self._check_process()
        if process_failure is not None:
            return process_failure
        if self._closed:
            return ObservationFailure("identity-unverified", "creation-owner-closed")
        if sys.platform != "linux":
            return ObservationFailure("identity-unverified", "platform-unsupported")
        if request.parent_ref not in self._parents:
            return ObservationFailure("denied", "creation-parent-not-configured")
        try:
            authority = self._resolve()
        except Exception:
            return ObservationFailure("denied", "creation-resolver-unavailable")
        process_failure = self._check_process()
        if process_failure is not None:
            return process_failure
        if self._closed:
            return ObservationFailure("identity-unverified", "creation-owner-closed")
        if isinstance(authority, ObservationFailure):
            return authority
        if type(authority) is not ResolvedCreationAuthority:
            return ObservationFailure("denied", "creation-resolver-unverified")
        if not authority.member or "create-child" not in authority.capabilities:
            return ObservationFailure("denied", "create-child-not-authorized")
        if request.parent_ref not in authority.creatable_parents:
            return ObservationFailure("denied", "create-child-parent-grant-missing")
        if authority.policy_revision != request.expected_policy_revision:
            return ObservationFailure("stale-policy", "creation-policy-changed")
        return authority

    def acquire(self, *, operation_id: str, parent_ref: str, child_name: str,
                accepted_plan_sha256: str, expected_policy_revision: int
                ) -> CreationLease | ObservationFailure:
        """Bind one request; repeated identical requests revalidate the same lease."""
        process_failure = self._check_process()
        if process_failure is not None:
            return process_failure
        with self._lock:
            if (not _matches(_ID, operation_id) or not _matches(_ID, parent_ref)
                    or not _matches(_NAME, child_name) or child_name.endswith(".")
                    or not _matches(_DIGEST, accepted_plan_sha256)
                    or type(expected_policy_revision) is not int
                    or not 1 <= expected_policy_revision <= 2**53 - 1):
                return ObservationFailure("invalid-input", "invalid-creation-request")
            request = _Request(operation_id, parent_ref, child_name,
                               accepted_plan_sha256, expected_policy_revision)
            if self._closed:
                return ObservationFailure("identity-unverified", "creation-owner-closed")
            existing = self._operations.get(operation_id)
            if existing is not None:
                previous, handle = existing
                if previous != request:
                    return ObservationFailure("operation-conflict", "creation-request-changed")
                result = self.inspect(handle)
                return result if isinstance(result, ObservationFailure) else handle
            authority = self._authorize(request)
            if isinstance(authority, ObservationFailure):
                return authority
            if len(self._operations) >= self._limits.max_operations:
                return ObservationFailure("identity-unverified", "creation-operation-limit")
            try:
                fd = _open_parent(self._parents[parent_ref])
            except OSError:
                return ObservationFailure("identity-unverified", "creation-parent-unavailable")
            handle = CreationLease()
            try:
                info = os.fstat(fd)
                self._issued[handle] = _Held(request, authority, fd, (info.st_dev, info.st_ino))
            except OSError:
                os.close(fd)
                return ObservationFailure("identity-unverified", "creation-parent-unavailable")
            except BaseException:
                os.close(fd)
                raise
            self._operations[operation_id] = request, handle
            result = self.inspect(handle)
            return result if isinstance(result, ObservationFailure) else handle

    def inspect(self, handle: CreationLease) -> CreationBinding | ObservationFailure:
        """Recheck grant and pathname-to-held-object match; failure retires custody."""
        process_failure = self._check_process()
        if process_failure is not None:
            return process_failure
        with self._lock:
            if self._closed:
                return ObservationFailure("identity-unverified", "creation-owner-closed")
            if type(handle) is not CreationLease or handle not in self._issued:
                return ObservationFailure("identity-unverified", "creation-lease-not-issued")
            held = self._issued[handle]
            authority = self._authorize(held.request)
            if isinstance(authority, ObservationFailure):
                self._retire(handle)
                return authority
            if authority != held.authority:
                self._retire(handle)
                return ObservationFailure("denied", "creation-authority-changed")
            try:
                current_fd = _open_parent(self._parents[held.request.parent_ref])
                try:
                    current, pinned = os.fstat(current_fd), os.fstat(held.fd)
                    unchanged = (current.st_dev, current.st_ino) == held.identity
                    unchanged = unchanged and (pinned.st_dev, pinned.st_ino) == held.identity
                    unchanged = unchanged and current.st_nlink > 0 and pinned.st_nlink > 0
                finally:
                    os.close(current_fd)
            except OSError:
                unchanged = False
            if not unchanged:
                self._retire(handle)
                return ObservationFailure("identity-unverified", "creation-parent-changed")
            current_authority = self._authorize(held.request)
            if current_authority != authority:
                self._retire(handle)
                return (current_authority if isinstance(current_authority, ObservationFailure)
                        else ObservationFailure("denied", "creation-authority-changed"))
            request = held.request
            return CreationBinding(
                authority.actor_id, authority.collection_id, authority.device_id,
                authority.policy_revision, request.operation_id, request.parent_ref,
                request.child_name, request.accepted_plan_sha256,
            )
