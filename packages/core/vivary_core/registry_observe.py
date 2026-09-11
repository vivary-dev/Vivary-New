"""Private, lifetime-bound read observations for registry inspection.

The injected resolver owns authentication, grants and the complete relevant
locator inventory. This module stores none of those facts durably. Its immutable
inspection view is for a trusted in-process reader, never a public action result
or a persisted registry binding. All mutation requests are refused.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re
import threading
from types import MappingProxyType
from typing import Callable, Mapping

from vivary_core.physical_observe import (
    CaptureLimits, ObservationFailure, PhysicalCapture, PhysicalRootObserver,
)


_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_CAPABILITIES = {"register": "register-project", "rebind": "rebind-project"}


@dataclass(frozen=True)
class ResolvedReadScope:
    """One immutable snapshot from an existing trusted policy/connection owner.

    ``locations`` includes every relevant binding, including other actors and
    collections, with authority to inspect each path. ``readable_locations``
    separately names the request actor's grants. Completeness is a resolver
    assertion; a client cannot create this snapshot or assert that inventory.
    """

    actor_id: str
    collection_id: str
    device_id: str
    policy_revision: int
    member: bool
    capabilities: frozenset[str]
    scope: Path = field(repr=False)
    locations: tuple[tuple[str, Path], ...] = field(repr=False)
    readable_locations: frozenset[str]
    inventory_complete: bool

    def __post_init__(self):
        if any(not isinstance(value, str) or not _ID.fullmatch(value)
               for value in (self.actor_id, self.collection_id, self.device_id)):
            raise ValueError("resolver scope requires bound ASCII identities")
        if (type(self.policy_revision) is not int
                or not 1 <= self.policy_revision <= 2**53 - 1
                or type(self.member) is not bool
                or type(self.inventory_complete) is not bool):
            raise ValueError("resolver policy facts must have exact types")
        if (type(self.capabilities) is not frozenset
                or any(not isinstance(value, str) for value in self.capabilities)
                or type(self.readable_locations) is not frozenset
                or type(self.locations) is not tuple or not self.locations):
            raise ValueError("resolver collections must be immutable")
        if not isinstance(self.scope, Path) or not self.scope.is_absolute() or ".." in self.scope.parts:
            raise ValueError("resolver scope must be an absolute path")
        names = []
        for entry in self.locations:
            if type(entry) is not tuple or len(entry) != 2:
                raise ValueError("resolver locations must be immutable pairs")
            name, path = entry
            if (not isinstance(name, str) or not _ID.fullmatch(name)
                    or not isinstance(path, Path) or not path.is_absolute()
                    or ".." in path.parts):
                raise ValueError("resolver locator is invalid")
            names.append(name)
        if len(set(names)) != len(names) or not self.readable_locations <= set(names):
            raise ValueError("resolver locator grants are inconsistent")


class ReadObservation:
    """Opaque issued handle. Serialization cannot preserve its authority."""

    __slots__ = ()

    def __reduce_ex__(self, protocol):
        raise TypeError("read observation is private and cannot be persisted")


@dataclass(frozen=True)
class _IssuedRead:
    capture: PhysicalCapture
    authority: ResolvedReadScope
    operation: str


class RegistryReadObserver:
    """Compose policy snapshots and the existing held-descriptor observer.

    Only ``location_ref``, operation and expected policy revision come from a
    request. The resolver is installed by the trusted local service, not passed
    per request. Production connection composition remains a separate owner.
    """

    def __init__(self, resolver: Callable[[], ResolvedReadScope | ObservationFailure],
                 *, limits: CaptureLimits = CaptureLimits()):
        if not callable(resolver):
            raise TypeError("a trusted scope resolver is required")
        self._resolve = resolver
        self._limits = limits
        self._observer: PhysicalRootObserver | None = None
        self._issued: dict[ReadObservation, _IssuedRead] = {}
        self._closed = False
        self._lock = threading.RLock()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def close(self):
        with self._lock:
            self._closed = True
            self._issued.clear()
            if self._observer is not None:
                self._observer.close()

    def _authorize(self, location_ref, operation, expected_policy_revision):
        if not isinstance(operation, str) or operation not in _CAPABILITIES:
            return ObservationFailure("denied", "read-observer-mutation-unsupported")
        if (not isinstance(location_ref, str) or not _ID.fullmatch(location_ref)
                or type(expected_policy_revision) is not int
                or not 1 <= expected_policy_revision <= 2**53 - 1):
            return ObservationFailure("invalid-input", "invalid-read-request")
        if self._closed:
            return ObservationFailure("identity-unverified", "observer-continuity-lost")
        authority = self._resolve()
        if isinstance(authority, ObservationFailure):
            return authority
        if type(authority) is not ResolvedReadScope:
            return ObservationFailure("denied", "resolver-authority-unverified")
        if not authority.member or _CAPABILITIES[operation] not in authority.capabilities:
            return ObservationFailure("denied", "read-operation-not-authorized")
        if authority.policy_revision != expected_policy_revision:
            return ObservationFailure("stale-policy", "policy-revision-changed")
        if location_ref not in authority.readable_locations:
            return ObservationFailure("denied", "locator-read-grant-missing")
        if not authority.inventory_complete:
            return ObservationFailure("ambiguous-ownership", "binding-inventory-incomplete")
        return authority

    def _prepare(self, authority):
        if len(authority.locations) > self._limits.max_roots:
            return ObservationFailure("identity-unverified", "resolver-root-limit")
        if self._observer is None:
            self._observer = PhysicalRootObserver(
                device_id=authority.device_id, scope=authority.scope,
                locations=dict(authority.locations), limits=self._limits)
        elif (self._observer.device_id != authority.device_id
              or self._observer.scope != authority.scope):
            return ObservationFailure("identity-unverified", "observer-scope-changed")
        else:
            self._observer.update_locations(dict(authority.locations))
        return None

    def _still_authorized(self, authority, location_ref, operation):
        current = self._authorize(location_ref, operation, authority.policy_revision)
        if isinstance(current, ObservationFailure):
            return current
        if current != authority:
            return ObservationFailure("denied", "resolver-snapshot-changed")
        return None

    def observe(self, *, location_ref: str, operation: str,
                expected_policy_revision: int) -> ReadObservation | ObservationFailure:
        with self._lock:
            authority = self._authorize(location_ref, operation, expected_policy_revision)
            if isinstance(authority, ObservationFailure):
                return authority
            if len(self._issued) >= self._limits.max_entries:
                return ObservationFailure("identity-unverified", "read-observation-limit")
            failure = self._prepare(authority)
            if failure is not None:
                return failure
            capture = self._observer.observe()[location_ref]
            failure = self._still_authorized(authority, location_ref, operation)
            if failure is not None:
                return failure
            if isinstance(capture, ObservationFailure):
                return capture
            handle = ReadObservation()
            self._issued[handle] = _IssuedRead(capture, authority, operation)
            return handle

    def inspect(self, handle: ReadObservation) -> Mapping | ObservationFailure:
        """Revalidate and return an immutable, non-JSON inspection projection.

        The view contains private lifetime IDs. It may feed an in-memory decision
        oracle. It cannot establish a durable binding or authorize a file effect.
        The observer and policy remain independent of that later consumer.
        """
        with self._lock:
            issued = self._issued.get(handle) if type(handle) is ReadObservation else None
            if issued is None:
                return ObservationFailure("identity-unverified", "read-observation-not-issued")
            capture, authority = issued.capture, issued.authority
            failure = self._still_authorized(authority, capture.location_ref, issued.operation)
            if failure is not None:
                return failure
            current = self._observer.revalidate(capture)
            failure = self._still_authorized(authority, capture.location_ref, issued.operation)
            if failure is not None:
                return failure
            if isinstance(current, ObservationFailure):
                return current
            if current.layout not in {"none", "git", "git-linked-worktree", "git-nested-project"}:
                return ObservationFailure("identity-unverified", "registry-layout-unverified")
            vcs = MappingProxyType({
                "kind": "none" if current.layout == "none" else "git",
                "repositoryId": current.repository_id, "checkoutId": current.checkout_id,
                "mutationOwner": current.mutation_owner,
            })
            root = MappingProxyType({
                "rootId": current.root_id, "locationRef": current.location_ref,
                "exists": True, "isDirectory": True, "identityVerified": True,
                "contentRevision": current.content_revision, "vcs": vcs,
            })
            return MappingProxyType({
                "code": "observed", "root": root, "rootAccess": (current.root_id,),
                "overlapSafe": True,
                "resourceKeys": tuple(":".join(key) for key in current.resource_keys),
                "mutationEligibility": "read-only", "reason": "effect-enforcement-unavailable",
                "diagnostics": MappingProxyType({
                    "layout": current.layout, "headState": current.head_state,
                    "dirtyState": current.dirty_state, "jjRepositoryEvidence": None,
                }),
            })
