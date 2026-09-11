"""Reviewed child-only composition for the 07f duplex bridge proof."""
from __future__ import annotations

from contextlib import contextmanager, redirect_stderr, redirect_stdout
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
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
    CreationNamespaceIdentity,
    ThinWorkspaceOptions,
)
from vivary_core.creation_provider_stdio import CreationProviderComposition, serve

if sys.platform == "linux":
    import fcntl


def _json_hash(value):
    data = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(data).hexdigest()


class Operations(ShippedWorkspaceOperations):
    """The actual thin scaffolder, Doctor, and Tropo under fixture-owned paths."""

    def __init__(self, recovery_parent, behavior):
        super().__init__(recovery_parent=recovery_parent)
        self.behavior = behavior

    def plan(self, target, options):
        if self.behavior == "exit-before-effect":
            os._exit(71)
        if self.behavior == "hang-before-effect":
            time.sleep(600)
        return super().plan(target, options)

    def scaffold(self, target, options):
        if self.behavior == "exit-during-effect":
            target.mkdir()
            (target / "partial.txt").write_text("partial", encoding="utf-8")
            os._exit(72)
        if self.behavior == "hang-during-effect":
            time.sleep(600)
        return super().scaffold(target, options)

    def tropo(self, target):
        output = io.StringIO()
        # Tropo's content check is real. Its optional Git date enrichment is
        # disabled so this reviewed child-only fixture never forks descendants.
        git_dates = tropo._git_dates
        tropo._git_dates = lambda _path: (None, None)
        try:
            with redirect_stdout(output), redirect_stderr(output):
                return tropo.main(["check", "--root", str(target)])
        finally:
            tropo._git_dates = git_dates


class HeldNamespace:
    def __init__(self, owner, stage_parent, parent_fd, stage_fd):
        self._owner = owner
        self.identity = owner.identity
        self.parent_path = owner.parent
        self.stage_parent_path = stage_parent
        self.parent_fd = parent_fd
        self.stage_parent_fd = stage_fd

    def revalidate(self):
        return self._owner.identity


class Namespace:
    """One real writer lock around fixture-owned parent and staging directories."""

    def __init__(self, parent, private_root):
        self.parent = parent
        self.private_root = private_root
        self.lock_path = private_root / "writer.lock"
        self.identity = CreationNamespaceIdentity(
            "fixture-namespace", "fixture-child", "fixture-stage", "fixture-continuity"
        )

    @contextmanager
    def hold(self, binding):
        stage_parent = self.private_root / ("stage-" + binding.operation_id)
        stage_parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        lock_fd = os.open(self.lock_path, os.O_RDWR | os.O_CREAT | os.O_CLOEXEC, 0o600)
        parent_fd = stage_fd = None
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
            flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
            parent_fd = os.open(self.parent, flags)
            stage_fd = os.open(stage_parent, flags)
            yield HeldNamespace(self, stage_parent, parent_fd, stage_fd)
        finally:
            if stage_fd is not None:
                os.close(stage_fd)
            if parent_fd is not None:
                os.close(parent_fd)
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)


class ControlledOutput:
    """Inject reviewed loss boundaries around preparation or publication."""

    def __init__(self, stream, behavior):
        self.stream = stream
        self.behavior = behavior
        self.completions = 0

    def write(self, data):
        is_completion = b'"kind":"effect-complete"' in data
        ordinal = self.completions + 1 if is_completion else None
        before = {
            "exit-after-preparation-effect-before-completion": 1,
            "exit-after-publication-effect-before-completion": 2,
        }
        after = {
            "exit-after-preparation-completion-before-reply": 1,
            "exit-after-publication-completion-before-reply": 2,
        }
        if is_completion and before.get(self.behavior) == ordinal:
            os._exit(72 + ordinal)
        written = self.stream.write(data)
        if is_completion:
            self.completions = ordinal
        if is_completion and after.get(self.behavior) == ordinal:
            self.stream.flush()
            os._exit(74 + ordinal)
        return written

    def flush(self):
        self.stream.flush()


def composition():
    if sys.platform != "linux":
        raise ValueError("Linux fixture required")
    raw_root = os.environ.get("VIVARY_CREATION_FIXTURE_ROOT")
    if not raw_root:
        raise ValueError("fixture root missing")
    scope = Path(raw_root)
    if not scope.is_absolute() or scope.resolve(strict=True) != scope:
        raise ValueError("fixture root must be resolved")
    behavior = os.environ.get("VIVARY_CREATION_FIXTURE_BEHAVIOR", "normal")
    allowed = {
        "normal", "exit-before-effect", "hang-before-effect", "exit-during-effect",
        "hang-during-effect", "exit-after-preparation-effect-before-completion",
        "exit-after-preparation-completion-before-reply",
        "exit-after-publication-effect-before-completion",
        "exit-after-publication-completion-before-reply",
    }
    if behavior not in allowed:
        raise ValueError("invalid fixture behavior")
    parent = scope / "parent"
    private = scope / "private"
    preview = scope / "preview"
    for directory in (parent, private, preview):
        directory.mkdir(mode=0o700, exist_ok=True)
    operations = Operations(preview, behavior)
    plan = operations.plan(parent / "example", ThinWorkspaceOptions()) \
        if behavior not in {"exit-before-effect", "hang-before-effect"} else \
        cv.plan_thin_workspace(parent / "example", preset="coding", adapters=(), active_context=None)
    (scope / "accepted-plan.json").write_text(json.dumps({
        "acceptedPlanSha256": plan["plan_sha256"],
    }, separators=(",", ":")), encoding="utf-8")
    return CreationProviderComposition(
        parents={"fixture-parent": parent}, namespace=Namespace(parent, private),
        operations=operations,
    )


if __name__ == "__main__":
    try:
        selected = composition()
        behavior = os.environ.get("VIVARY_CREATION_FIXTURE_BEHAVIOR", "normal")
        output = ControlledOutput(sys.stdout.buffer, behavior)
        raise SystemExit(serve(sys.stdin.buffer, output, selected))
    except Exception:
        raise SystemExit(1)
