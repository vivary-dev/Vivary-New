"""07d staged-creation contract over synthetic, fixture-owned namespaces.

The receipt implementations below are labeled test doubles.  They are not a
product database or a claim that arbitrary host directories are controlled.
"""

from __future__ import annotations

from contextlib import contextmanager, redirect_stderr, redirect_stdout
from dataclasses import asdict, replace
import hashlib
import io
import json
import multiprocessing
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [
    str(ROOT / "packages/core"),
    str(ROOT / "packages/create-vivary"),
    str(ROOT / "packages/tropo"),
    str(ROOT / "packages/workbench/server"),
]

import create_vivary as cv
import tropo
from creation_workspace import ShippedWorkspaceOperations
from vivary_core.creation_apply import (
    CreationApply,
    CreationApplyFailure,
    CreationApplyResult,
    CreationNamespaceIdentity,
    CreationReceiptSnapshot,
    ThinWorkspaceOptions,
)
from vivary_core.creation_authority import (
    CreationAuthority,
    CreationLease,
    ResolvedCreationAuthority,
)

if sys.platform == "linux":
    import fcntl


def _authority(**changes):
    values = dict(
        actor_id="fixture-actor",
        collection_id="fixture-collection",
        device_id="fixture-device",
        policy_revision=7,
        member=True,
        capabilities=frozenset({"create-child"}),
        creatable_parents=frozenset({"fixture-parent"}),
    )
    values.update(changes)
    return ResolvedCreationAuthority(**values)


def _json_hash(value):
    data = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(data).hexdigest()


class ActualThinOperations(ShippedWorkspaceOperations):
    """Fixture adapter over the real 07a generator, Doctor, and Tropo."""

    def __init__(self, recovery_parent: Path):
        super().__init__(recovery_parent=recovery_parent)
        self.plan_calls = 0
        self.recovery_plan_calls = 0
        self.scaffold_calls = 0
        self.after_scaffold = None
        self.crash_during_scaffold = False

    @staticmethod
    def _keywords(options):
        return dict(
            preset=options.preset,
            adapters=options.adapters,
            active_context=options.active_context,
        )

    def plan(self, target, options):
        self.plan_calls += 1
        return super().plan(target, options)

    def recovery_plan(self, target, options):
        """Render expected bytes away from an occupied fixture target."""
        self.recovery_plan_calls += 1
        return super().recovery_plan(target, options)

    def scaffold(self, target, options):
        self.scaffold_calls += 1
        if self.crash_during_scaffold:
            plan = cv.plan_thin_workspace(target, **self._keywords(options))
            first = plan["files"][0]
            target.mkdir()
            path = target / first["path"]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(first["content"].encode("utf-8"))
            os._exit(70)
        result = super().scaffold(target, options)
        if self.after_scaffold is not None:
            self.after_scaffold()
        return result

class FixtureCustodySupervisor:
    """Synthetic custody facts retained by the fixture's parent process."""

    def __init__(self, context=None):
        self.identity = CreationNamespaceIdentity(
            "fixture-namespace", "fixture-child", "fixture-stage",
            "fixture-continuity",
        )
        if context is None:
            self._available = 1
            self._generation = 0
        else:
            self._available = context.Value("i", 1)
            self._generation = context.Value("i", 0)

    @staticmethod
    def _read(value):
        return value if type(value) is int else value.value

    @staticmethod
    def _write(holder, value):
        if type(holder) is int:
            return value
        holder.value = value
        return holder

    @property
    def available(self):
        return self._read(self._available) == 1

    @available.setter
    def available(self, value):
        replacement = 1 if value else 0
        self._available = self._write(self._available, replacement)

    @property
    def current_identity(self):
        generation = self._read(self._generation)
        if generation == 0:
            return self.identity
        return replace(
            self.identity, continuity_id=f"fixture-continuity-lost-{generation}"
        )

    @current_identity.setter
    def current_identity(self, value):
        generation = 0 if value == self.identity else 1
        self._generation = self._write(self._generation, generation)

    def observe(self):
        if not self.available:
            return CreationApplyFailure(
                "recovery-required", "creation-continuity-unavailable"
            )
        return self.current_identity


class FixtureHeldNamespace:
    def __init__(self, owner, stage_parent, parent_fd, stage_parent_fd):
        self._owner = owner
        self.identity = owner.identity
        self.parent_path = owner.parent
        self.stage_parent_path = stage_parent
        self.parent_fd = parent_fd
        self.stage_parent_fd = stage_parent_fd

    def revalidate(self):
        return self._owner.supervisor.observe()


class FixtureNamespace:
    """Synthetic supervisor custody with a real process writer lock."""

    def __init__(
        self, parent: Path, private_root: Path, *, supervisor=None,
        stage_parent_override=None,
    ):
        self.parent = parent
        self.private_root = private_root
        self.private_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.lock_path = self.private_root / "fixture-writer.lock"
        self.supervisor = supervisor or FixtureCustodySupervisor()
        self.identity = self.supervisor.identity
        self.stage_parent_override = stage_parent_override

    @property
    def current_identity(self):
        return self.supervisor.current_identity

    @current_identity.setter
    def current_identity(self, value):
        self.supervisor.current_identity = value

    @property
    def available(self):
        return self.supervisor.available

    @available.setter
    def available(self, value):
        self.supervisor.available = value

    def stage_parent(self, operation_id="operation-a"):
        if self.stage_parent_override is not None:
            return self.stage_parent_override
        return self.private_root / ("stage-" + operation_id)

    def stage_path(self, operation_id="operation-a", child_name="example"):
        return self.stage_parent(operation_id) / child_name

    @contextmanager
    def hold(self, binding):
        stage_parent = self.stage_parent(binding.operation_id)
        stage_parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        lock_fd = os.open(self.lock_path, os.O_RDWR | os.O_CREAT | os.O_CLOEXEC, 0o600)
        parent_fd = stage_fd = None
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
            flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
            parent_fd = os.open(self.parent, flags)
            stage_fd = os.open(stage_parent, flags)
            yield FixtureHeldNamespace(self, stage_parent, parent_fd, stage_fd)
        finally:
            if stage_fd is not None:
                os.close(stage_fd)
            if parent_fd is not None:
                os.close(parent_fd)
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)


class FixtureReceiptPort:
    """In-memory 07d fixture state, never a product persistence owner."""

    def __init__(self, current_authority):
        self.current_authority = current_authority
        self.snapshots = {}
        self.reservations = {}
        self.effects = []
        self.disconnected = False
        self.fail_transition_before = None
        self.fail_transition_after = None
        self.before_execute = None
        self.retain_callback = False
        self.duplicate_callback = False
        self.retained_callback = None

    def _authorize(self, binding):
        current = self.current_authority()
        valid = (
            type(current) is ResolvedCreationAuthority
            and current.member
            and "create-child" in current.capabilities
            and binding.parent_ref in current.creatable_parents
            and current.policy_revision == binding.policy_revision
            and current.actor_id == binding.actor_id
            and current.collection_id == binding.collection_id
            and current.device_id == binding.device_id
        )
        return valid

    @staticmethod
    def _same(snapshot, binding, namespace):
        return snapshot.binding == binding and snapshot.namespace == namespace

    def load(self, binding, namespace):
        snapshot = self.snapshots.get(binding.operation_id)
        if snapshot is None:
            return None
        if not self._same(snapshot, binding, namespace):
            return CreationApplyFailure(
                "recovery-required", "creation-receipt-invalid"
            )
        return snapshot

    def prepare(self, binding, namespace):
        if not self._authorize(binding):
            return CreationApplyFailure("denied", "creation-effect-not-authorized")
        existing = self.snapshots.get(binding.operation_id)
        if existing is not None:
            return existing
        key = (binding.collection_id, binding.device_id,
               namespace.namespace_key, namespace.child_key)
        if key in self.reservations:
            return CreationApplyFailure("target-reserved", "creation-target-reserved")
        snapshot = CreationReceiptSnapshot(binding, "preparing", namespace)
        self.snapshots[binding.operation_id] = snapshot
        self.reservations[key] = binding.operation_id
        return snapshot

    def admit_and_execute(self, binding, snapshot, namespace, effect, execute):
        expected = {
            "prepare-stage": "preparing",
            "publish": "publishing",
            "recover-publication": "publishing",
        }.get(effect)
        current = self.snapshots.get(binding.operation_id)
        if self.disconnected:
            return CreationApplyFailure(
                "recovery-required", "creation-admission-disconnected", snapshot.phase
            )
        if (not self._authorize(binding) or current != snapshot
                or not self._same(snapshot, binding, namespace)
                or snapshot.phase != expected):
            return CreationApplyFailure(
                "denied", "creation-effect-not-authorized", snapshot.phase
            )
        self.effects.append(effect)
        if self.before_execute is not None:
            self.before_execute(effect)
        if self.retain_callback:
            self.retained_callback = execute
            return CreationApplyFailure(
                "recovery-required", "fixture-admission-stopped", snapshot.phase
            )
        result = execute()
        if self.duplicate_callback:
            execute()
        return result

    def transition(
        self, binding, snapshot, namespace, expected_phase, next_phase
    ):
        key = (expected_phase, next_phase)
        if self.fail_transition_before == key:
            raise OSError("fixture transport stopped before transition")
        if not self._authorize(binding):
            return CreationApplyFailure("denied", "creation-effect-not-authorized")
        current = self.snapshots.get(binding.operation_id)
        if current != snapshot or not self._same(snapshot, binding, namespace):
            return CreationApplyFailure("stale-phase", "creation-phase-changed")
        updated = replace(snapshot, phase=next_phase)
        self.snapshots[binding.operation_id] = updated
        if self.fail_transition_after == key:
            raise OSError("fixture transport stopped after transition")
        return updated


@unittest.skipUnless(sys.platform == "linux", "Linux staged effects only")
class CreationApplyLinuxTests(unittest.TestCase):
    def setUp(self):
        proof_root = os.environ.get("VIVARY_CREATION_PROOF_ROOT")
        if proof_root:
            base = Path(proof_root).resolve()
            if not base.is_dir():
                self.fail("VIVARY_CREATION_PROOF_ROOT must be an existing directory")
            self.temporary = tempfile.TemporaryDirectory(prefix="case-", dir=base)
        else:
            self.temporary = tempfile.TemporaryDirectory(prefix="vivary-07d-")
        self.addCleanup(self.temporary.cleanup)
        self.scope = Path(self.temporary.name).resolve()
        self.parent = self.scope / "fixture-parent"
        self.parent.mkdir(mode=0o700)
        self.current = _authority()
        self.resolver = lambda: self.current
        self.authority = CreationAuthority(
            self.resolver, parents={"fixture-parent": self.parent}
        )
        self.addCleanup(self.authority.close)
        self.namespace = FixtureNamespace(
            self.parent, self.scope / "fixture-private"
        )
        preview_root = self.scope / "fixture-preview"
        preview_root.mkdir(mode=0o700)
        self.operations = ActualThinOperations(preview_root)
        self.receipts = FixtureReceiptPort(self.resolver)

    def target(self, name="example"):
        return self.parent / name

    def preview(self, name="example", **options):
        return cv.plan_thin_workspace(self.target(name), **options)

    def lease(self, *, operation_id="operation-a", child_name="example", plan=None):
        plan = plan or self.preview(child_name)
        result = self.authority.acquire(
            operation_id=operation_id,
            parent_ref="fixture-parent",
            child_name=child_name,
            accepted_plan_sha256=plan["plan_sha256"],
            expected_policy_revision=7,
        )
        self.assertIsInstance(result, CreationLease, result)
        return result

    def engine(self):
        return CreationApply(
            self.authority, self.receipts, self.operations,
            namespace=self.namespace,
        )

    def assert_created(self, result, *, replayed=False):
        self.assertIsInstance(result, CreationApplyResult, result)
        self.assertEqual(result.code, "created-unregistered")
        self.assertEqual(result.phase, "published")
        self.assertEqual(result.replayed, replayed)
        self.assertTrue(result.target_present)
        self.assertFalse(result.registered)

    def test_default_namespace_refuses_before_receipt_or_filesystem_effect(self):
        lease = self.lease()
        receipts = Mock()
        result = CreationApply(self.authority, receipts, self.operations).apply(lease)
        self.assertEqual(result.reason, "creation-namespace-unconfigured")
        receipts.load.assert_not_called()
        self.assertFalse(self.target().exists())

    def test_admission_callback_expires_and_cannot_be_called_late(self):
        lease = self.lease()
        self.receipts.retain_callback = True
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "fixture-admission-stopped")
        self.assertFalse(self.namespace.stage_path().exists())
        with self.assertRaisesRegex(RuntimeError, "no longer active"):
            self.receipts.retained_callback()
        self.assertEqual(self.operations.scaffold_calls, 0)

    def test_admission_callback_is_one_shot(self):
        lease = self.lease()
        self.receipts.duplicate_callback = True
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "creation-effect-uncertain")
        self.assertEqual(self.operations.scaffold_calls, 1)
        self.assertEqual(self.receipts.snapshots["operation-a"].phase, "preparing")
        self.assertTrue(self.namespace.stage_path().is_dir())

    def test_revocation_at_admission_edge_prevents_callback_effect(self):
        lease = self.lease()

        def revoke(effect):
            if effect == "prepare-stage":
                self.current = replace(self.current, member=False)

        self.receipts.before_execute = revoke
        result = self.engine().apply(lease)
        self.assertEqual(result.code, "denied")
        self.assertEqual(self.operations.scaffold_calls, 0)
        self.assertFalse(self.namespace.stage_path().exists())

    def test_disconnected_admission_never_calls_effect(self):
        lease = self.lease()
        self.receipts.disconnected = True
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "creation-admission-disconnected")
        self.assertEqual(self.operations.scaffold_calls, 0)
        self.assertFalse(self.namespace.stage_path().exists())

    def test_exact_preview_creates_once_and_published_replay_is_historical(self):
        lease = self.lease()
        engine = self.engine()
        result = engine.apply(lease)
        self.assert_created(result)
        target = self.target()
        expected = self.preview_bytes(self.preview_after_creation(target))
        self.assertEqual(self.tree_bytes(target), expected)
        calls = self.operations.plan_calls
        effects = list(self.receipts.effects)
        replay = engine.apply(lease)
        self.assert_created(replay, replayed=True)
        self.assertEqual(self.operations.plan_calls, calls)
        self.assertEqual(self.receipts.effects, effects)
        self.assertEqual(self.tree_bytes(target), expected)

    def preview_after_creation(self, target):
        return self.operations.recovery_plan(
            target, ThinWorkspaceOptions()
        )

    @staticmethod
    def preview_bytes(plan):
        return {row["path"]: row["content"].encode() for row in plan["files"]}

    @staticmethod
    def tree_bytes(root):
        return {
            path.relative_to(root).as_posix(): path.read_bytes()
            for path in root.rglob("*") if path.is_file()
        }

    def test_published_missing_target_never_recreates_it_or_calls_planner(self):
        lease = self.lease()
        engine = self.engine()
        self.assert_created(engine.apply(lease))
        target = self.target()
        for path in sorted(target.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            path.unlink() if path.is_file() else path.rmdir()
        target.rmdir()
        before = self.operations.plan_calls
        result = engine.apply(lease)
        self.assertIsInstance(result, CreationApplyResult)
        self.assertTrue(result.replayed)
        self.assertFalse(result.target_present)
        self.assertFalse(target.exists())
        self.assertEqual(self.operations.plan_calls, before)

    def test_every_occupied_target_refuses_without_stage_writes(self):
        for kind in ("empty-directory", "file", "symlink"):
            with self.subTest(kind=kind):
                name = "occupied-" + kind
                plan = self.preview(name)
                target = self.target(name)
                if kind == "empty-directory":
                    target.mkdir()
                elif kind == "file":
                    target.write_bytes(b"user bytes\n")
                else:
                    outside = self.scope / ("outside-" + kind)
                    outside.mkdir()
                    target.symlink_to(outside, target_is_directory=True)
                lease = self.lease(
                    operation_id="operation-" + kind,
                    child_name=name,
                    plan=plan,
                )
                result = self.engine().apply(lease)
                self.assertEqual(result.code, "target-occupied")
                self.assertNotIn("prepare-stage", self.receipts.effects)

    def test_changed_options_and_tampered_preview_refuse_before_intent(self):
        lease = self.lease()
        result = self.engine().apply(lease, preset="writing")
        self.assertEqual(result.code, "plan-mismatch")
        self.assertEqual(self.receipts.snapshots, {})
        real_plan = self.operations.plan

        def tampered(target, options):
            plan = real_plan(target, options)
            plan["files"][0]["content"] += "tampered"
            return plan

        self.operations.plan = tampered
        result = self.engine().apply(lease)
        self.assertEqual(result.code, "invalid-preview")
        self.assertEqual(self.receipts.snapshots, {})

    def test_partial_preparing_stage_is_rebuilt_only_in_private_namespace(self):
        plan = self.preview()
        lease = self.lease(plan=plan)
        binding = self.authority.inspect(lease)
        snapshot = self.receipts.prepare(binding, self.namespace.identity)
        stage = self.namespace.stage_path()
        stage.mkdir(parents=True)
        (stage / "partial-user-looking-file").write_bytes(b"fixture only")
        result = self.engine().apply(lease)
        self.assert_created(result, replayed=True)
        self.assertFalse(stage.exists())
        self.assertFalse((self.parent / "partial-user-looking-file").exists())
        self.assertEqual(snapshot.phase, "preparing")

    def test_unrecorded_stage_is_never_removed_or_adopted(self):
        lease = self.lease()
        stage = self.namespace.stage_path()
        stage.mkdir(parents=True)
        evidence = stage / "unknown-owner.txt"
        evidence.write_bytes(b"preserve fixture bytes\n")
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "unrecorded-creation-stage-present")
        self.assertEqual(evidence.read_bytes(), b"preserve fixture bytes\n")
        self.assertEqual(self.receipts.snapshots, {})
        self.assertFalse(self.target().exists())

    def test_cross_overlapping_and_link_bearing_custody_preserve_sentinels(self):
        digest = "sha256:" + "a" * 64
        overlap_private = self.scope / "overlap-private"
        overlap_stage = overlap_private / "example"
        overlap_parent = overlap_stage / "parent"
        overlap_parent.mkdir(parents=True)
        overlap_sentinel = overlap_stage / "preserve.txt"
        overlap_sentinel.write_bytes(b"overlap sentinel\n")
        overlap_authority = CreationAuthority(
            self.resolver, parents={"fixture-parent": overlap_parent}
        )
        self.addCleanup(overlap_authority.close)
        overlap_lease = overlap_authority.acquire(
            operation_id="operation-overlap", parent_ref="fixture-parent",
            child_name="example", accepted_plan_sha256=digest,
            expected_policy_revision=7,
        )
        overlap_namespace = FixtureNamespace(
            overlap_parent, overlap_private,
            stage_parent_override=overlap_private,
        )
        result = CreationApply(
            overlap_authority, FixtureReceiptPort(self.resolver), self.operations,
            namespace=overlap_namespace,
        ).apply(overlap_lease)
        self.assertEqual(result.reason, "creation-staging-overlaps-target")
        self.assertEqual(overlap_sentinel.read_bytes(), b"overlap sentinel\n")

        real_private = self.scope / "real-private"
        real_private.mkdir()
        link_sentinel = real_private / "preserve.txt"
        link_sentinel.write_bytes(b"link sentinel\n")
        alias = self.scope / "private-alias"
        alias.symlink_to(real_private, target_is_directory=True)
        link_namespace = FixtureNamespace(self.parent, alias)
        link_lease = self.lease(operation_id="operation-link", plan=self.preview())
        linked = CreationApply(
            self.authority, FixtureReceiptPort(self.resolver), self.operations,
            namespace=link_namespace,
        ).apply(link_lease)
        self.assertEqual(linked.reason, "creation-custody-invalid")
        self.assertEqual(link_sentinel.read_bytes(), b"link sentinel\n")
        self.assertFalse(self.target().exists())

    def test_prepared_hardlink_alias_refuses_and_preserves_external_file(self):
        plan = self.preview()
        lease = self.lease(plan=plan)
        binding = self.authority.inspect(lease)
        stage = self.namespace.stage_path()
        with self.namespace.hold(binding):
            pass
        cv.scaffold_thin_workspace(stage, repo_root=ROOT)
        self.receipts.snapshots["operation-a"] = CreationReceiptSnapshot(
            binding, "prepared", self.namespace.identity
        )
        source = stage / "STATE.md"
        outside = self.scope / "outside-hardlink.md"
        os.link(source, outside)
        before = outside.read_bytes()
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "creation-tree-not-exact")
        self.assertEqual(outside.read_bytes(), before)
        self.assertEqual(source.read_bytes(), before)
        self.assertFalse(self.target().exists())
        self.assertEqual(self.receipts.snapshots["operation-a"].phase, "prepared")

    def test_atomic_noreplace_preserves_target_created_after_initial_check(self):
        lease = self.lease()
        sentinel = b"late target belongs to another writer\n"

        def occupy(effect):
            if effect == "publish":
                self.target().mkdir()
                (self.target() / "sentinel.txt").write_bytes(sentinel)

        self.receipts.before_execute = occupy
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "creation-effect-uncertain")
        self.assertEqual((self.target() / "sentinel.txt").read_bytes(), sentinel)
        self.assertTrue(self.namespace.stage_path().is_dir())
        self.assertEqual(self.receipts.snapshots["operation-a"].phase, "publishing")

    def test_revocation_after_scaffold_prevents_phase_or_publication(self):
        lease = self.lease()
        self.operations.after_scaffold = lambda: setattr(
            self, "current", replace(self.current, member=False)
        )
        result = self.engine().apply(lease)
        self.assertEqual(result.code, "denied")
        self.assertFalse(self.target().exists())
        snapshot = self.receipts.snapshots["operation-a"]
        self.assertEqual(snapshot.phase, "preparing")
        self.assertTrue(self.namespace.stage_path().is_dir())

    def test_competing_operation_cannot_share_reserved_child(self):
        first_plan = self.preview()
        first = self.lease(plan=first_plan)
        first_binding = self.authority.inspect(first)
        self.receipts.prepare(first_binding, self.namespace.identity)
        second = self.lease(operation_id="operation-b", plan=first_plan)
        result = self.engine().apply(second)
        self.assertEqual(result.code, "target-reserved")
        self.assertFalse(self.target().exists())

    def test_prepared_and_publishing_stage_replays_finish(self):
        for phase in ("prepared", "publishing"):
            with self.subTest(phase=phase):
                operation = "operation-" + phase
                name = "project-" + phase
                plan = self.preview(name)
                lease = self.lease(
                    operation_id=operation, child_name=name, plan=plan
                )
                binding = self.authority.inspect(lease)
                with self.namespace.hold(binding):
                    pass
                stage = self.namespace.stage_path(operation, name)
                cv.scaffold_thin_workspace(stage, repo_root=ROOT)
                snapshot = CreationReceiptSnapshot(
                    binding, phase, self.namespace.identity
                )
                self.receipts.snapshots[operation] = snapshot
                result = self.engine().apply(lease)
                self.assert_created(result, replayed=True)
                self.assertTrue(self.target(name).is_dir())

    def test_both_present_or_both_absent_in_publishing_require_recovery(self):
        for state in ("both-present", "both-absent"):
            with self.subTest(state=state):
                operation = "operation-" + state
                name = "project-" + state
                plan = self.preview(name)
                lease = self.lease(
                    operation_id=operation, child_name=name, plan=plan
                )
                binding = self.authority.inspect(lease)
                self.receipts.snapshots[operation] = CreationReceiptSnapshot(
                    binding, "publishing", self.namespace.identity
                )
                if state == "both-present":
                    with self.namespace.hold(binding):
                        pass
                    cv.scaffold_thin_workspace(
                        self.namespace.stage_path(operation, name), repo_root=ROOT
                    )
                    cv.scaffold_thin_workspace(self.target(name), repo_root=ROOT)
                result = self.engine().apply(lease)
                self.assertEqual(result.reason, "publishing-state-unclear")
                if state == "both-present":
                    self.assertTrue(self.target(name).is_dir())

    def test_failure_after_rename_keeps_publishing_then_recovers_exact_target(self):
        lease = self.lease()
        self.receipts.fail_transition_before = ("publishing", "published")
        result = self.engine().apply(lease)
        self.assertEqual(result.reason, "creation-receipt-unavailable")
        self.assertEqual(result.phase, "publishing")
        self.assertTrue(self.target().is_dir())
        self.assertFalse(self.namespace.stage_path().exists())
        self.assertEqual(self.receipts.snapshots["operation-a"].phase, "publishing")
        self.receipts.fail_transition_before = None
        recovered = self.engine().apply(lease)
        self.assert_created(recovered, replayed=True)
        self.assertEqual(self.operations.recovery_plan_calls, 1)

    def test_postrename_sync_ambiguity_never_deletes_target(self):
        lease = self.lease()
        real_fsync = os.fsync
        parent_info = os.stat(self.parent, follow_symlinks=False)

        def fail_destination_sync(fd):
            if self.target().exists():
                info = os.fstat(fd)
                if (info.st_dev, info.st_ino) == (parent_info.st_dev, parent_info.st_ino):
                    raise OSError("fixture postrename sync failure")
            return real_fsync(fd)

        with patch("vivary_core.creation_apply.os.fsync", side_effect=fail_destination_sync):
            result = self.engine().apply(lease)
        self.assertEqual(result.reason, "creation-effect-uncertain")
        self.assertTrue(self.target().is_dir())
        self.assertEqual(self.receipts.snapshots["operation-a"].phase, "publishing")

    def test_lost_continuity_and_unavailable_renameat2_refuse(self):
        lease = self.lease()
        self.namespace.current_identity = replace(
            self.namespace.identity, continuity_id="fixture-continuity-lost"
        )
        lost = self.engine().apply(lease)
        self.assertEqual(lost.reason, "creation-continuity-lost")
        self.assertEqual(self.receipts.snapshots, {})
        self.namespace.current_identity = self.namespace.identity
        self.namespace.available = False
        unavailable = self.engine().apply(lease)
        self.assertEqual(unavailable.reason, "creation-continuity-unavailable")
        self.assertEqual(self.receipts.snapshots, {})
        self.namespace.available = True
        self.namespace.current_identity = self.namespace.identity
        with patch(
            "vivary_core.creation_apply._rename_noreplace",
            side_effect=OSError("renameat2 unavailable"),
        ):
            unsupported = self.engine().apply(lease)
        self.assertEqual(unsupported.reason, "creation-effect-uncertain")
        self.assertFalse(self.target().exists())
        self.assertTrue(self.namespace.stage_path().is_dir())
        self.assertEqual(self.receipts.snapshots["operation-a"].phase, "publishing")


class SharedFixtureReceiptPort:
    """Supervisor-owned anonymous shared state for the fresh-process proof."""

    _PHASES = [None, "preparing", "prepared", "publishing", "published"]

    _CRASH_CODES = {
        "after-preparing": 71,
        "after-prepared": 72,
        "after-publishing": 73,
        "after-rename": 79,
    }

    def __init__(self, phase, *, crash_point=None):
        self.phase = phase
        self.crash_point = crash_point

    def _snapshot(self, binding, namespace):
        with self.phase.get_lock():
            number = self.phase.value
        return None if number == 0 else CreationReceiptSnapshot(
            binding, self._PHASES[number], namespace
        )

    def load(self, binding, namespace):
        return self._snapshot(binding, namespace)

    def prepare(self, binding, namespace):
        with self.phase.get_lock():
            if self.phase.value == 0:
                self.phase.value = 1
        if self.crash_point == "after-preparing":
            os._exit(self._CRASH_CODES[self.crash_point])
        return self._snapshot(binding, namespace)

    def admit_and_execute(self, binding, snapshot, namespace, effect, execute):
        current = self._snapshot(binding, namespace)
        if current != snapshot:
            return CreationApplyFailure("stale-phase", "fixture-phase-changed")
        return execute()

    def transition(
        self, binding, snapshot, namespace, expected_phase, next_phase
    ):
        if self.crash_point == "after-rename" and next_phase == "published":
            os._exit(self._CRASH_CODES[self.crash_point])
        with self.phase.get_lock():
            if self._PHASES[self.phase.value] != expected_phase:
                return CreationApplyFailure("stale-phase", "fixture-phase-changed")
            self.phase.value = self._PHASES.index(next_phase)
        point = {
            "prepared": "after-prepared",
            "publishing": "after-publishing",
        }.get(next_phase)
        if point is not None and self.crash_point == point:
            os._exit(self._CRASH_CODES[self.crash_point])
        return self._snapshot(binding, namespace)


def _fresh_process_worker(
    scope_text, plan_digest, phase, custody_supervisor, crash_point, write_fd
):
    """Actual worker; the test process remains the labeled fixture supervisor."""
    scope = Path(scope_text)
    parent = scope / "fixture-parent"
    authority = CreationAuthority(
        _authority, parents={"fixture-parent": parent}
    )
    try:
        lease = authority.acquire(
            operation_id="operation-fresh",
            parent_ref="fixture-parent",
            child_name="example",
            accepted_plan_sha256=plan_digest,
            expected_policy_revision=7,
        )
        namespace = FixtureNamespace(
            parent, scope / "fixture-private", supervisor=custody_supervisor
        )
        operations = ActualThinOperations(scope / "fixture-preview")
        operations.crash_during_scaffold = crash_point == "partial-staging"
        receipts = SharedFixtureReceiptPort(phase, crash_point=crash_point)
        result = CreationApply(
            authority, receipts, operations, namespace=namespace
        ).apply(lease)
        os.write(write_fd, json.dumps(asdict(result)).encode())
    finally:
        authority.close()
        os.close(write_fd)


@unittest.skipUnless(sys.platform == "linux", "Linux fresh-process proof only")
class CreationApplyFreshProcessTests(unittest.TestCase):
    def proof_base(self):
        proof_root = os.environ.get("VIVARY_CREATION_PROOF_ROOT")
        base = Path(proof_root).resolve() if proof_root else None
        if base is not None and not base.is_dir():
            self.fail("VIVARY_CREATION_PROOF_ROOT must be an existing directory")
        return base

    def run_worker(
        self, context, scope, plan_digest, phase, supervisor, crash_point
    ):
        read_fd, write_fd = os.pipe()
        process = context.Process(
            target=_fresh_process_worker,
            args=(str(scope), plan_digest, phase, supervisor, crash_point, write_fd),
        )
        started = False
        timed_out = False
        try:
            process.start()
            started = True
            os.close(write_fd)
            write_fd = None
            process.join(20)
            if process.is_alive():
                timed_out = True
                process.terminate()
                process.join(5)
            if process.is_alive():
                process.kill()
                process.join(5)
            if process.is_alive():
                self.fail("fixture worker resisted termination")
            exitcode = process.exitcode
            data = os.read(read_fd, 65536)
            if timed_out:
                self.fail("fixture worker exceeded its 20 second deadline")
            if exitcode is None:
                self.fail("fixture worker produced no exit status")
            return exitcode, data
        finally:
            if write_fd is not None:
                os.close(write_fd)
            os.close(read_fd)
            if started:
                if process.is_alive():
                    process.kill()
                    process.join(5)
                process.close()

    def provision_case(self, scope, context):
        parent = scope / "fixture-parent"
        parent.mkdir(mode=0o700)
        (scope / "fixture-private").mkdir(mode=0o700)
        (scope / "fixture-preview").mkdir(mode=0o700)
        plan = cv.plan_thin_workspace(parent / "example")
        return parent, plan, context.Value("i", 0), FixtureCustodySupervisor(context)

    def test_supervisor_recovers_actual_worker_exit_at_each_phase(self):
        context = multiprocessing.get_context("fork")
        crash_codes = {
            "partial-staging": 70,
            **SharedFixtureReceiptPort._CRASH_CODES,
        }
        with tempfile.TemporaryDirectory(
            prefix="fresh-process-", dir=self.proof_base()
        ) as temporary:
            scope = Path(temporary).resolve()
            for point, expected_code in crash_codes.items():
                with self.subTest(point=point):
                    case = scope / point
                    case.mkdir()
                    parent, plan, phase, supervisor = self.provision_case(case, context)
                    first_code, first_data = self.run_worker(
                        context, case, plan["plan_sha256"], phase, supervisor, point
                    )
                    self.assertEqual(first_code, expected_code)
                    self.assertEqual(first_data, b"")
                    second_code, second_data = self.run_worker(
                        context, case, plan["plan_sha256"], phase, supervisor, None
                    )
                    self.assertEqual(second_code, 0)
                    result = json.loads(second_data)
                    self.assertEqual(result["code"], "created-unregistered")
                    self.assertTrue(result["replayed"])
                    self.assertEqual(phase.value, 4)
                    self.assertTrue((parent / "example").is_dir())

    def test_supervisor_loss_refuses_postrename_reconciliation(self):
        context = multiprocessing.get_context("fork")
        with tempfile.TemporaryDirectory(
            prefix="lost-supervisor-", dir=self.proof_base()
        ) as temporary:
            scope = Path(temporary).resolve()
            parent, plan, phase, supervisor = self.provision_case(scope, context)
            first_code, first_data = self.run_worker(
                context, scope, plan["plan_sha256"], phase, supervisor,
                "after-rename",
            )
            self.assertEqual(first_code, 79)
            self.assertEqual(first_data, b"")
            self.assertEqual(phase.value, 3)
            self.assertTrue((parent / "example").is_dir())
            supervisor.available = False
            second_code, second_data = self.run_worker(
                context, scope, plan["plan_sha256"], phase, supervisor, None
            )
            self.assertEqual(second_code, 0)
            failure = json.loads(second_data)
            self.assertEqual(failure["code"], "recovery-required")
            self.assertEqual(failure["reason"], "creation-continuity-unavailable")
            self.assertEqual(phase.value, 3)
            self.assertTrue((parent / "example").is_dir())


if __name__ == "__main__":
    unittest.main()
