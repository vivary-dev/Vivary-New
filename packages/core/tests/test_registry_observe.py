"""Read boundary checks and physical observation-to-registry inspection proof."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import replace
import json
import os
from pathlib import Path
import pickle
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vivary_core.physical_observe import CaptureLimits, ObservationFailure
from vivary_core.registry_observe import ReadObservation, RegistryReadObserver, ResolvedReadScope
from test_physical_observe import tree_state


def scope_for(root):
    return ResolvedReadScope(
        actor_id="actor-a", collection_id="collection-a", device_id="device-a",
        policy_revision=1, member=True,
        capabilities=frozenset({"register-project", "rebind-project"}),
        scope=root.parent, locations=(("location-a", root),),
        readable_locations=frozenset({"location-a"}), inventory_complete=True,
    )


def thaw(value):
    """Test-only conversion for piping synthetic private facts to the Node oracle."""
    if isinstance(value, Mapping):
        return {key: thaw(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [thaw(item) for item in value]
    return value


class ReadBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.authority = scope_for(Path(__file__).resolve().parent)
        self.resolver = Mock(return_value=self.authority)
        self.service = RegistryReadObserver(self.resolver)
        self.addCleanup(self.service.close)

    def read(self, **changes):
        request = dict(location_ref="location-a", operation="register", expected_policy_revision=1)
        request.update(changes)
        return self.service.observe(**request)

    def test_mutations_refuse_before_resolver_or_filesystem(self):
        for operation in ("admit-mutation", "authorize-write-back", "export", "unknown", {}):
            self.assertEqual(self.read(operation=operation).code, "denied")
        self.resolver.assert_not_called()

    def test_caller_cannot_supply_authority_or_observation(self):
        with self.assertRaises(TypeError):
            self.read(root_id="caller-root")
        self.assertEqual(self.read(location_ref={"rootId": "caller-root"}).code, "invalid-input")
        self.assertEqual(self.service.inspect({"rootId": "caller-root"}).code, "identity-unverified")
        self.resolver.assert_not_called()

    def test_exact_request_revision_types(self):
        for revision in (True, 0, 2**53, "1", None):
            self.assertEqual(self.read(expected_policy_revision=revision).code, "invalid-input")
        self.resolver.assert_not_called()

    def test_unverified_resolver_output_is_not_authority(self):
        self.resolver.return_value = {"member": True, "inventory_complete": True}
        self.assertEqual(self.read().reason, "resolver-authority-unverified")

    def test_policy_membership_capability_and_grant_refuse_before_probe(self):
        variants = [
            (replace(self.authority, member=False), "denied"),
            (replace(self.authority, capabilities=frozenset()), "denied"),
            (replace(self.authority, readable_locations=frozenset()), "denied"),
            (replace(self.authority, policy_revision=2), "stale-policy"),
            (replace(self.authority, inventory_complete=False), "ambiguous-ownership"),
        ]
        with patch("vivary_core.registry_observe.PhysicalRootObserver") as physical:
            for authority, code in variants:
                self.resolver.return_value = authority
                self.assertEqual(self.read().code, code)
            physical.assert_not_called()

    def test_resolver_snapshot_requires_immutable_exact_fields(self):
        for changes in ({"locations": list(self.authority.locations)},
                        {"member": 1}, {"policy_revision": True},
                        {"capabilities": {"register-project"}},
                        {"readable_locations": frozenset({"unknown"})},
                        {"locations": self.authority.locations * 2}):
            with self.assertRaises(ValueError):
                replace(self.authority, **changes)

    def test_windows_refusal_remains_explicit(self):
        with patch("vivary_core.physical_observe.sys.platform", "win32"):
            self.assertEqual(self.read().reason, "platform-unsupported")

    def test_unissued_and_closed_handles_cannot_be_reopened(self):
        self.assertEqual(self.service.inspect(ReadObservation()).reason, "read-observation-not-issued")
        self.service.close()
        self.assertEqual(self.read().reason, "observer-continuity-lost")

    def test_handle_cannot_be_serialized_as_authority(self):
        handle = ReadObservation()
        with self.assertRaises(TypeError):
            pickle.dumps(handle)
        with self.assertRaises(TypeError):
            json.dumps(handle)


@unittest.skipUnless(sys.platform == "linux", "Linux physical composition proof only")
class RegistryPhysicalTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="vivary-12c-")
        self.scope = Path(self.temporary.name).resolve()
        self.root = self.scope / "root"
        self.root.mkdir()
        (self.root / "file.txt").write_text("baseline\n", encoding="utf-8")
        self.authority = scope_for(self.root)
        self.resolver = Mock(side_effect=lambda: self.authority)
        self.service = RegistryReadObserver(self.resolver)
        self.services = [self.service]

    def tearDown(self):
        for service in self.services:
            service.close()
        self.temporary.cleanup()

    def read(self, operation="register", location="location-a"):
        before = tree_state(self.scope)
        result = self.service.observe(location_ref=location, operation=operation,
                                      expected_policy_revision=1)
        self.assertEqual(tree_state(self.scope), before)
        return result

    def view(self, handle):
        before = tree_state(self.scope)
        result = self.service.inspect(handle)
        self.assertEqual(tree_state(self.scope), before)
        return result

    def accepted(self, operation="register", location="location-a"):
        handle = self.read(operation, location)
        self.assertIsInstance(handle, ReadObservation, handle)
        view = self.view(handle)
        self.assertIsInstance(view, Mapping, view)
        self.assertEqual(view["mutationEligibility"], "read-only")
        return handle, view

    def git(self, cwd, *args):
        env = {key: value for key, value in os.environ.items() if not key.upper().startswith("GIT_")}
        env.update({"GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
                    "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0"})
        result = subprocess.run(["git", "-C", str(cwd), *args], env=env,
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)

    def repository(self):
        self.assertIsNotNone(shutil.which("git"), "Habitat Git prerequisite is missing")
        self.git(self.root, "init", "-b", "main")
        self.git(self.root, "config", "user.name", "Fixture")
        self.git(self.root, "config", "user.email", "fixture@example.invalid")
        self.git(self.root, "add", ".")
        self.git(self.root, "commit", "-m", "fixture")

    def oracle(self, view, operation="register", configure=None):
        repo = Path(__file__).resolve().parents[3]
        fixture = json.loads((repo / "docs/product/multi-project/fixtures/project-registry.json").read_text())
        payload = fixture["inputs"][operation]
        payload["request"]["locationRef"] = view["root"]["locationRef"]
        payload["trusted"].update(root=thaw(view["root"]), rootAccess=list(view["rootAccess"]),
                                  overlapSafe=view["overlapSafe"])
        if configure:
            configure(payload)
        self.assertIsNotNone(shutil.which("node"), "Habitat Node prerequisite is missing")
        code = ("import {evaluateRegistryOperation} from './scripts/registry_contract_model.mjs';"
                "let s='';for await(const c of process.stdin)s+=c;"
                "process.stdout.write(JSON.stringify(evaluateRegistryOperation(JSON.parse(s))));")
        result = subprocess.run(["node", "--input-type=module", "-e", code], cwd=repo,
                                input=json.dumps(payload), capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_real_no_vcs_projection_and_oracle_registration(self):
        handle, view = self.accepted()
        self.assertEqual(view["root"]["vcs"]["kind"], "none")
        self.assertEqual(view["resourceKeys"], ("device-a:root:" + view["root"]["rootId"],))
        result = self.oracle(view)
        self.assertEqual(result["output"]["code"], "registered")
        self.assertEqual(result["effects"], ["registry"])
        with self.assertRaises(TypeError):
            view["root"]["rootId"] = "forged"
        with self.assertRaises(TypeError):
            json.dumps(view)
        self.assertNotIn(str(self.root), repr(view))
        self.assertNotIn(view["root"]["rootId"], repr(handle))

    def test_alias_converges_and_registry_detects_duplicate(self):
        alias = self.scope / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        self.authority = replace(self.authority,
            locations=self.authority.locations + (("location-alias", alias),),
            readable_locations=frozenset({"location-a", "location-alias"}))
        _, first = self.accepted()
        _, other = self.accepted(location="location-alias")
        self.assertEqual(first["root"]["rootId"], other["root"]["rootId"])
        registered = self.oracle(first)
        def existing(payload):
            payload["trusted"]["existingRootBindings"] = [registered["recordChanges"]["insertBinding"]]
        duplicate = self.oracle(other, configure=existing)
        self.assertEqual(duplicate["output"]["code"], "already-registered")

    def test_readonly_rebind_view_of_renamed_root_uses_same_lifetime_id(self):
        _, old = self.accepted()
        registered = self.oracle(old)
        moved = self.scope / "moved"
        self.root.rename(moved)
        self.authority = replace(self.authority, locations=(("location-moved", moved),),
                                 readable_locations=frozenset({"location-moved"}))
        _, current = self.accepted(operation="rebind", location="location-moved")
        self.assertEqual(current["root"]["rootId"], old["root"]["rootId"])
        def existing(payload):
            binding = registered["recordChanges"]["insertBinding"]
            payload["request"].update(bindingId=binding["bindingId"], expectedBindingRevision=1)
            payload["trusted"].update(binding=binding, portable=registered["recordChanges"]["insertPortable"],
                                      existingRootBindings=[])
        self.assertEqual(self.oracle(current, "rebind", existing)["output"]["code"], "rebound")

    def test_git_projection_and_oracle_registration(self):
        self.repository()
        _, view = self.accepted()
        self.assertEqual(view["root"]["vcs"]["kind"], "git")
        self.assertEqual(view["root"]["vcs"]["mutationOwner"], "git")
        self.assertEqual(len(view["resourceKeys"]), 2)
        self.assertEqual(self.oracle(view)["output"]["code"], "registered")

    def test_linked_worktrees_share_repository_but_not_checkout(self):
        self.repository()
        linked = self.scope / "linked"
        self.git(self.root, "worktree", "add", "-b", "linked", str(linked))
        self.authority = replace(self.authority,
            locations=self.authority.locations + (("location-linked", linked),),
            readable_locations=frozenset({"location-a", "location-linked"}))
        _, first = self.accepted()
        _, other = self.accepted(location="location-linked")
        self.assertEqual(first["root"]["vcs"]["repositoryId"], other["root"]["vcs"]["repositoryId"])
        self.assertNotEqual(first["root"]["vcs"]["checkoutId"], other["root"]["vcs"]["checkoutId"])

    def test_changed_content_and_recreated_root_refuse_stale_inspection(self):
        handle, _ = self.accepted()
        (self.root / "file.txt").write_text("changed\n", encoding="utf-8")
        self.assertEqual(self.view(handle).code, "content-conflict")
        fresh, _ = self.accepted()
        self.root.rename(self.scope / "old")
        self.root.mkdir()
        self.assertEqual(self.view(fresh).code, "root-replaced")

    def test_changed_or_revoked_policy_refuses_prior_handle(self):
        handle, _ = self.accepted()
        original = self.authority
        self.authority = replace(original, policy_revision=2)
        self.assertEqual(self.view(handle).code, "stale-policy")
        self.authority = replace(original, readable_locations=frozenset())
        self.assertEqual(self.view(handle).code, "denied")

    def test_policy_change_during_capture_discards_observation(self):
        original = self.authority
        self.resolver.side_effect = [original, replace(original, policy_revision=2)]
        self.assertEqual(self.read().code, "stale-policy")

    def test_other_actor_topology_is_inspected_without_granting_request_access(self):
        child = self.root / "child"
        child.mkdir()
        self.authority = replace(self.authority,
            locations=self.authority.locations + (("foreign-root", child),))
        self.assertEqual(self.read(location="foreign-root").code, "denied")
        self.assertEqual(self.read().code, "ambiguous-ownership")

    def test_foreign_failed_scan_and_unsupported_vcs_refuse_projection(self):
        self.authority = replace(self.authority,
            locations=self.authority.locations + (("foreign-root", self.scope / "absent"),))
        self.assertEqual(self.read().reason, "overlap-unverified")
        self.authority = scope_for(self.root)
        (self.root / ".jj").mkdir()
        self.assertEqual(self.read().code, "identity-unverified")

    def test_restart_and_scope_change_never_adopt_previous_identity(self):
        handle, _ = self.accepted()
        other = RegistryReadObserver(self.resolver)
        self.services.append(other)
        self.assertEqual(other.inspect(handle).reason, "read-observation-not-issued")
        self.authority = replace(self.authority, device_id="other-device")
        self.assertEqual(self.read().reason, "observer-scope-changed")
        self.assertEqual(self.view(handle).reason, "resolver-snapshot-changed")
        self.service.close()
        self.assertEqual(self.view(handle).reason, "read-observation-not-issued")

    def test_root_inventory_bound_refuses_without_partial_projection(self):
        self.service.close()
        self.service = RegistryReadObserver(self.resolver, limits=CaptureLimits(max_roots=1))
        self.services.append(self.service)
        other = self.scope / "other"
        other.mkdir()
        self.authority = replace(self.authority, locations=self.authority.locations + (("other", other),))
        self.assertEqual(self.read().reason, "resolver-root-limit")


if __name__ == "__main__":
    unittest.main()
