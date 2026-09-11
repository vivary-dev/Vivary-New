"""Read-only creation authority and Linux parent-custody behavior.

All physical fixtures are synthetic, test-owned parents. These checks neither
exercise apply nor establish that an arbitrary host folder is service-controlled.
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError, replace
import json
import os
from pathlib import Path
import pickle
import signal
import threading
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vivary_core.creation_authority import (
    CreationAuthority, CreationBinding, CreationLease, CreationLimits,
    ResolvedCreationAuthority,
)
from vivary_core.physical_observe import ObservationFailure


MODULE = "vivary_core.creation_authority"
PLAN = "sha256:" + "a" * 64


def authority():
    return ResolvedCreationAuthority(
        actor_id="actor-a", collection_id="collection-a", device_id="device-a",
        policy_revision=1, member=True, capabilities=frozenset({"create-child"}),
        creatable_parents=frozenset({"parent-a"}),
    )


def request(**changes):
    result = dict(operation_id="operation-a", parent_ref="parent-a", child_name="example",
                  accepted_plan_sha256=PLAN, expected_policy_revision=1)
    result.update(changes)
    return result


class CreationBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.resolver = Mock(return_value=authority())
        self.service = CreationAuthority(
            self.resolver, parents={"parent-a": Path(__file__).resolve().parent})
        self.addCleanup(self.service.close)

    def test_invalid_requests_never_resolve_or_open(self):
        invalid = [
            {"child_name": value} for value in
            ("", ".", "..", "../escape", "a/b", "a\\b", "/tmp", "C:target",
             "trailing.", "name\x00", "a" * 129, {}, None)
        ] + [
            {"accepted_plan_sha256": value} for value in
            ("", "a" * 64, "sha256:" + "A" * 64, PLAN + "\n", None)
        ] + [
            {"expected_policy_revision": value} for value in
            (True, 0, 2**53, "1", None)
        ] + [{"operation_id": {}}, {"parent_ref": "../host-path"}]
        with patch(MODULE + ".os.open") as opened:
            for changes in invalid:
                with self.subTest(changes=changes):
                    result = self.service.acquire(**request(**changes))
                    self.assertEqual(result.code, "invalid-input")
            opened.assert_not_called()
        self.resolver.assert_not_called()

    def test_request_cannot_install_a_path_or_authority(self):
        with self.assertRaises(TypeError):
            self.service.acquire(**request(), parent_path="/arbitrary")
        with self.assertRaises(TypeError):
            self.service.acquire(**request(), grant=authority())
        self.assertEqual(self.service.inspect({}).reason, "creation-lease-not-issued")
        self.resolver.assert_not_called()

    def test_linux_only_refuses_before_resolver_or_open(self):
        for platform in ("win32", "darwin"):
            with self.subTest(platform=platform), patch(MODULE + ".sys.platform", platform), \
                    patch(MODULE + ".os.open") as opened:
                result = self.service.acquire(**request())
                self.assertEqual(result.reason, "platform-unsupported")
                opened.assert_not_called()
        self.resolver.assert_not_called()

    def test_grants_require_immutable_exact_fields(self):
        for changes in (
            {"member": 1}, {"policy_revision": True}, {"actor_id": ""},
            {"capabilities": {"create-child"}}, {"creatable_parents": {"parent-a"}},
            {"creatable_parents": frozenset({"../escape"})},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                replace(authority(), **changes)

    def test_configuration_and_capacity_are_bounded(self):
        root = Path(__file__).resolve().parent
        for parents in ({}, {"bad/ref": root}, {"parent-a": Path("relative")},
                        {"parent-a": root / ".."}, {"parent-a": Path(root.anchor)}):
            with self.subTest(parents=parents), self.assertRaises(ValueError):
                CreationAuthority(self.resolver, parents=parents)
        with self.assertRaises(ValueError):
            CreationAuthority(self.resolver, parents={"a": root, "b": root},
                              limits=CreationLimits(max_parents=1))
        for limit in (0, True, 2**21):
            with self.assertRaises(ValueError):
                CreationLimits(max_operations=limit)

    def test_handle_is_not_serializable(self):
        handle = CreationLease()
        with self.assertRaises(TypeError):
            pickle.dumps(handle)
        with self.assertRaises(TypeError):
            json.dumps(handle)


@unittest.skipUnless(sys.platform == "linux", "Linux parent custody only")
class CreationPhysicalTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="vivary-07b-")
        self.addCleanup(self.temporary.cleanup)
        self.scope = Path(self.temporary.name).resolve()
        self.parent = self.scope / "service-owned-parent"
        self.parent.mkdir(mode=0o700)
        self.current = authority()
        self.resolver = Mock(side_effect=lambda: self.current)
        self.service = self.new_service()

    def new_service(self, **options):
        service = CreationAuthority(self.resolver,
                                    parents={"parent-a": self.parent}, **options)
        self.addCleanup(service.close)
        return service

    def acquire(self, **changes):
        return self.service.acquire(**request(**changes))

    def accepted(self):
        handle = self.acquire()
        self.assertIsInstance(handle, CreationLease, handle)
        self.assertIsInstance(self.service.inspect(handle), CreationBinding)
        return handle

    def fd_count(self):
        return len(os.listdir("/proc/self/fd"))

    def test_binding_is_readonly_and_does_not_inspect_or_change_child(self):
        child = self.parent / "example"
        child.mkdir()
        (child / "user.txt").write_bytes(b"user-owned\n")
        before = self.fd_count()
        real_open = os.open
        def readonly_open(path, flags, *args, **kwargs):
            self.assertEqual(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT
                                     | os.O_TRUNC | os.O_APPEND), 0)
            self.assertNotEqual(path, "example")
            return real_open(path, flags, *args, **kwargs)
        with patch(MODULE + ".os.open", side_effect=readonly_open):
            handle = self.accepted()
            binding = self.service.inspect(handle)
            self.assertIs(self.acquire(), handle)
        self.assertEqual(self.fd_count(), before + 1)
        self.assertEqual(binding.accepted_plan_sha256, PLAN)
        self.assertEqual(binding.operation_id, "operation-a")
        self.assertEqual(binding.filesystem_effects, "unsupported")
        self.assertFalse(binding.restart_continuity)
        self.assertFalse(binding.cross_process_reservation)
        self.assertFalse(binding.pathname_containment)
        with self.assertRaises(FrozenInstanceError):
            binding.child_name = "other"
        self.assertNotIn(str(self.parent), repr(binding))
        self.assertEqual(list(child.iterdir()), [child / "user.txt"])
        self.assertEqual((child / "user.txt").read_bytes(), b"user-owned\n")
        self.assertEqual(list(self.parent.iterdir()), [child])
        self.service.close()
        self.assertEqual(self.fd_count(), before)

    def test_registry_membership_or_parent_reference_is_not_a_create_grant(self):
        variants = (
            replace(authority(), member=False),
            replace(authority(), capabilities=frozenset({"register-project"})),
            replace(authority(), creatable_parents=frozenset()),
            replace(authority(), policy_revision=2),
            {"member": True, "capabilities": ["create-child"]},
            ObservationFailure("denied", "host-refused"),
        )
        with patch(MODULE + ".os.open") as opened:
            for current in variants:
                self.current = current
                self.assertIsInstance(self.acquire(), ObservationFailure)
            self.current = authority()
            self.assertEqual(self.acquire(parent_ref="unconfigured").reason,
                             "creation-parent-not-configured")
            opened.assert_not_called()

    def test_revocation_on_replay_retires_and_releases_custody(self):
        before = self.fd_count()
        handle = self.accepted()
        self.current = replace(self.current, creatable_parents=frozenset())
        self.assertEqual(self.acquire().reason, "create-child-parent-grant-missing")
        self.assertEqual(self.fd_count(), before)
        self.current = authority()
        self.assertEqual(self.acquire().reason, "creation-lease-not-issued")
        self.assertEqual(self.service.inspect(handle).reason, "creation-lease-not-issued")

    def test_changed_policy_or_identity_cannot_reuse_lease(self):
        for changes in ({"policy_revision": 2}, {"actor_id": "actor-b"},
                        {"collection_id": "collection-b"}, {"device_id": "device-b"},
                        {"creatable_parents": frozenset({"parent-a", "parent-b"})}):
            with self.subTest(changes=changes):
                self.current = authority()
                service = self.new_service()
                handle = service.acquire(**request())
                self.assertIsInstance(handle, CreationLease)
                self.current = replace(self.current, **changes)
                self.assertIsInstance(service.inspect(handle), ObservationFailure)
                service.close()

    def test_changed_request_does_not_rebind_a_replayed_operation(self):
        handle = self.accepted()
        for changes in ({"child_name": "different"}, {"parent_ref": "different"},
                        {"accepted_plan_sha256": "sha256:" + "b" * 64},
                        {"expected_policy_revision": 2}):
            with self.subTest(changes=changes):
                self.assertEqual(self.acquire(**changes).code, "operation-conflict")
        self.assertIsInstance(self.service.inspect(handle), CreationBinding)

    def test_changed_mapping_does_not_redirect_configured_parent(self):
        mapping = {"parent-a": self.parent}
        service = CreationAuthority(self.resolver, parents=mapping)
        self.addCleanup(service.close)
        mapping["parent-a"] = self.scope / "missing"
        handle = service.acquire(**request())
        self.assertIsInstance(handle, CreationLease)
        self.assertIsInstance(service.inspect(handle), CreationBinding)

    def test_parent_replacement_refuses_even_when_names_and_bytes_match(self):
        before = self.fd_count()
        handle = self.accepted()
        moved = self.scope / "original"
        self.parent.rename(moved)
        self.parent.mkdir(mode=0o700)
        self.assertEqual(self.service.inspect(handle).reason, "creation-parent-changed")
        self.assertEqual(self.fd_count(), before)
        self.parent.rmdir()
        moved.rename(self.parent)
        self.assertEqual(self.acquire().reason, "creation-lease-not-issued")

    def test_removed_parent_and_changed_ancestor_refuse(self):
        handle = self.accepted()
        self.parent.rmdir()
        self.assertEqual(self.service.inspect(handle).reason, "creation-parent-changed")
        container = self.scope / "container"
        container.mkdir()
        parent = container / "parent"
        parent.mkdir()
        service = CreationAuthority(self.resolver, parents={"parent-a": parent})
        self.addCleanup(service.close)
        handle = service.acquire(**request())
        moved = self.scope / "moved-container"
        container.rename(moved)
        container.symlink_to(moved, target_is_directory=True)
        self.assertEqual(service.inspect(handle).reason, "creation-parent-changed")

    def test_symlink_parent_refuses_before_issuing_custody(self):
        alias = self.scope / "alias"
        alias.symlink_to(self.parent, target_is_directory=True)
        service = CreationAuthority(self.resolver, parents={"parent-a": alias})
        self.addCleanup(service.close)
        before = self.fd_count()
        self.assertEqual(service.acquire(**request()).reason, "creation-parent-unavailable")
        self.assertEqual(self.fd_count(), before)

    def test_grant_change_during_open_closes_new_descriptor(self):
        real_open = os.open
        def revoke_during_open(path, *args, **kwargs):
            fd = real_open(path, *args, **kwargs)
            if path == self.parent.name:
                self.current = replace(self.current, member=False)
            return fd
        before = self.fd_count()
        with patch(MODULE + ".os.open", side_effect=revoke_during_open):
            self.assertEqual(self.acquire().reason, "create-child-not-authorized")
        self.assertEqual(self.fd_count(), before)

    def test_resolver_failure_retires_lease_without_leaking_descriptor(self):
        before = self.fd_count()
        handle = self.accepted()
        self.resolver.side_effect = RuntimeError("host-unavailable")
        self.assertEqual(self.service.inspect(handle).reason, "creation-resolver-unavailable")
        self.assertEqual(self.fd_count(), before)

    def test_last_policy_check_retires_on_change(self):
        before = self.fd_count()
        handle = self.accepted()
        self.resolver.side_effect = [self.current, replace(self.current, actor_id="actor-b")]
        self.assertEqual(self.service.inspect(handle).reason, "creation-authority-changed")
        self.assertEqual(self.fd_count(), before)

    def test_owner_closed_by_resolver_cannot_issue_or_revalidate(self):
        before = self.fd_count()
        handle = self.accepted()
        def close_owner():
            self.service.close()
            return self.current
        self.resolver.side_effect = close_owner
        self.assertEqual(self.service.inspect(handle).reason, "creation-owner-closed")
        self.assertEqual(self.fd_count(), before)
        self.assertEqual(self.acquire().reason, "creation-owner-closed")

    def test_closed_cross_instance_and_forged_handles_refuse(self):
        before = self.fd_count()
        handle = self.accepted()
        other = self.new_service()
        self.assertEqual(other.inspect(handle).reason, "creation-lease-not-issued")
        self.assertEqual(self.service.inspect(CreationLease()).reason, "creation-lease-not-issued")
        self.service.close()
        self.service.close()
        self.assertEqual(self.fd_count(), before)
        self.assertEqual(self.service.inspect(handle).reason, "creation-owner-closed")
        self.assertEqual(self.acquire().reason, "creation-owner-closed")

    def test_forked_owner_refuses_before_inherited_lock_and_closes_child_fds(self):
        handle = self.accepted()
        locked, release = threading.Event(), threading.Event()

        def hold_parent_lock():
            with self.service._lock:
                locked.set()
                release.wait(5)

        thread = threading.Thread(target=hold_parent_lock)
        thread.start()
        self.assertTrue(locked.wait(2))
        read_fd, write_fd = os.pipe()
        try:
            child = os.fork()
            if child == 0:
                os.close(read_fd)
                signal.alarm(3)
                before = self.fd_count()
                result = self.service.inspect(handle)
                reply = {"reason": getattr(result, "reason", None),
                         "inherited_fd_closed": self.fd_count() == before - 1,
                         "acquire_reason": getattr(self.acquire(), "reason", None)}
                os.write(write_fd, json.dumps(reply).encode())
                os._exit(0)
            os.close(write_fd)
            write_fd = None
            data = os.read(read_fd, 4096)
            _, status = os.waitpid(child, 0)
        finally:
            os.close(read_fd)
            if write_fd is not None:
                os.close(write_fd)
            release.set()
            thread.join(2)
        self.assertFalse(thread.is_alive())
        self.assertEqual(status, 0, "forked owner blocked on its inherited lock")
        reply = json.loads(data)
        self.assertEqual(reply["reason"], "creation-owner-process-changed")
        self.assertEqual(reply["acquire_reason"], "creation-owner-process-changed")
        self.assertTrue(reply["inherited_fd_closed"])
        self.assertIsInstance(self.service.inspect(handle), CreationBinding)

    def test_configured_operation_capacity_retains_replay_and_releases_on_close(self):
        service = self.new_service(limits=CreationLimits(max_operations=1))
        first = service.acquire(**request())
        self.assertIsInstance(first, CreationLease)
        self.assertIs(service.acquire(**request()), first)
        self.assertEqual(service.acquire(**request(operation_id="operation-b")).reason,
                         "creation-operation-limit")


if __name__ == "__main__":
    unittest.main()
