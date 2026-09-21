"""Public-seam tests for thin-v0.3 brownfield adoption."""

import contextlib
import errno
import hashlib
import io
import json
import os
import queue
import subprocess
import threading
import shutil
import sys
import unittest
import uuid
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
PKG = ROOT / "packages" / "create-vivary"

sys.path.insert(0, str(PKG))

import create_vivary  # noqa: E402


def temp_dir() -> Path:
    path = ROOT / "sandboxes" / f"test-adopt-{uuid.uuid4().hex}"
    path.mkdir(parents=True)
    return path


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def snapshot(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in root.rglob("*")
        if path.is_file()
    }


def run_cli(argv: list[str]) -> tuple[int, str]:
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        rc = create_vivary.main(argv)
    return rc, output.getvalue()


class ThinAdoptPlanTests(unittest.TestCase):
    def test_content_preview_matches_applied_bytes_and_retained_binary(self):
        target = temp_dir()
        try:
            originals = {"AGENTS.md": b"\xef\xbb\xbf# Host\r\n", ".gitignore": b"host-cache/"}
            for name, content in originals.items():
                (target / name).write_bytes(content)
            retained = b"\xff\x00host state"
            (target / "STATE.md").write_bytes(retained)
            before = snapshot(target)
            rc, output = run_cli(["adopt", str(target), "--preset", "coding", "--adapter", "agents", "--json"])
            self.assertEqual(rc, 0, output)
            self.assertEqual(snapshot(target), before)
            report = json.loads(output)
            content_plan = report["content_plan"]
            self.assertEqual(content_plan["schema"], "vivary.adopt-content-plan.v1")
            files = content_plan["files"]
            self.assertEqual([row["path"] for row in files], sorted(row["path"] for row in files))
            by_path = {row["path"]: row for row in files}
            self.assertEqual(set(by_path), {"AGENTS.md", ".gitignore", ".vivary/context.md", ".vivary/workspace.toml", ".agents/skills/vivary/SKILL.md"})
            for name, original in originals.items():
                row = by_path[name]
                block = create_vivary._thin_agents_block() if name == "AGENTS.md" else create_vivary._thin_gitignore_block(active_context=None)
                separator = b"\n" if original.endswith(b"\n") else b"\n\n"
                self.assertEqual(row["content"].encode("utf-8"), original + separator + block.encode("utf-8"))
                self.assertEqual(row["operation"], "patch")
                self.assertEqual(row["before_hash"], "sha256:" + hashlib.sha256(original).hexdigest())
            self.assertEqual(content_plan["kept"], [{"path": "STATE.md", "content_hash": "sha256:" + hashlib.sha256(retained).hexdigest()}])
            plan = create_vivary.plan_adopt(target, preset="coding", adapters=("agents",))
            self.assertEqual(report["plan_hash"], plan["plan_hash"])
            self.assertEqual(plan["plan_hash"], create_vivary._thin_approval_hash(plan["approval_payload"]))
            applied = create_vivary.adopt_workspace(target, preset="coding", adapters=("agents",), yes=True, plan_hash=report["plan_hash"])
            for row in files:
                expected = row["content"].encode("utf-8")
                self.assertEqual((target / row["path"]).read_bytes(), expected)
                self.assertEqual(row["bytes"], len(expected))
                self.assertEqual(row["content_hash"], "sha256:" + hashlib.sha256(expected).hexdigest())
                if row["operation"] == "create":
                    self.assertNotIn("before_hash", row)
            self.assertEqual((target / "STATE.md").read_bytes(), retained)
            for mode in ("applied", "recovered", "recovery-dry-run"):
                self.assertNotIn("content_plan", create_vivary._adopt_report_to_json(applied, mode=mode))
        finally:
            shutil.rmtree(target)

    def test_content_preview_serializes_snapshot_without_rereading(self):
        target = temp_dir()
        try:
            write(target / "AGENTS.md", "host guidance")
            plan = create_vivary.plan_adopt(target, preset="coding")
            first = create_vivary._adopt_report_to_json(plan, mode="dry-run")
            self.assertIn("content_plan", first)
            write(target / "AGENTS.md", "changed after planning")
            with mock.patch.object(Path, "read_bytes", side_effect=AssertionError("report reread")), mock.patch.object(Path, "read_text", side_effect=AssertionError("report reread")):
                second = create_vivary._adopt_report_to_json(plan, mode="dry-run")
            self.assertEqual(first, second)
            self.assertIn("host guidance", next(row["content"] for row in second["content_plan"]["files"] if row["path"] == "AGENTS.md"))
        finally:
            shutil.rmtree(target)

    def test_content_preview_keeps_invalid_utf8_as_a_conflict(self):
        target = temp_dir()
        try:
            (target / "AGENTS.md").write_bytes(b"\xff")
            before = snapshot(target)
            rc, output = run_cli(["adopt", str(target), "--preset", "coding", "--json"])
            self.assertEqual(rc, 1)
            report = json.loads(output)
            self.assertEqual(report["conflicts"], [{"path": "AGENTS.md", "reason": "AGENTS.md is not UTF-8"}])
            self.assertNotIn("AGENTS.md", [row["path"] for row in report["content_plan"]["files"]])
            self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)

    def test_default_dry_run_has_the_exact_thin_footprint_for_host_file_matrix(self):
        cases = {
            "all-host-files": {
                "host_files": ("AGENTS.md", ".gitignore", "STATE.md"),
                "creates": (".vivary/context.md", ".vivary/workspace.toml"),
                "patches": (".gitignore", "AGENTS.md"),
            },
            "state-missing": {
                "host_files": ("AGENTS.md", ".gitignore"),
                "creates": (".vivary/context.md", ".vivary/workspace.toml", "STATE.md"),
                "patches": (".gitignore", "AGENTS.md"),
            },
            "agents-missing": {
                "host_files": (".gitignore",),
                "creates": (
                    ".vivary/context.md",
                    ".vivary/workspace.toml",
                    "AGENTS.md",
                    "STATE.md",
                ),
                "patches": (".gitignore",),
            },
            "startup-and-privacy-missing": {
                "host_files": (),
                "creates": (
                    ".gitignore",
                    ".vivary/context.md",
                    ".vivary/workspace.toml",
                    "AGENTS.md",
                    "STATE.md",
                ),
                "patches": (),
            },
        }
        prohibited_roots = {
            ".agents",
            ".claude",
            "changes",
            "decisions",
            "gates",
            "heartbeat-reports",
            "memory",
            "modules",
            "templates",
            "verification",
        }
        prohibited_files = {
            "MEMORY.md",
            "SOUL.md",
            "STRATO.md",
            "USER.md",
            "bug-risk-playbook.md",
            "tropo.toml",
        }

        for name, case in cases.items():
            with self.subTest(name=name):
                target = temp_dir()
                try:
                    for host_file in case["host_files"]:
                        write(target / host_file, f"existing {host_file}\n")
                    before = snapshot(target)

                    rc, out = run_cli(
                        [
                            "adopt",
                            str(target),
                            "--preset",
                            "coding",
                            "--repo-root",
                            str(ROOT),
                            "--json",
                        ]
                    )

                    self.assertEqual(rc, 0)
                    self.assertEqual(snapshot(target), before, "dry-run must be read-only")
                    payload = json.loads(out)
                    self.assertEqual(payload["contract"], "thin-v0.3")
                    self.assertEqual(tuple(payload["creates"]), case["creates"])
                    self.assertEqual(
                        tuple(patch["path"] for patch in payload["patches"]),
                        case["patches"],
                    )
                    self.assertRegex(payload["plan_hash"], r"^sha256:[0-9a-f]{64}$")

                    planned_paths = set(payload["creates"]) | {
                        patch["path"] for patch in payload["patches"]
                    }
                    self.assertTrue(prohibited_files.isdisjoint(planned_paths))
                    self.assertTrue(
                        prohibited_roots.isdisjoint(
                            {path.split("/", 1)[0] for path in planned_paths}
                        )
                    )
                finally:
                    shutil.rmtree(target)

    def test_optional_adapters_are_closed_bounded_projections_not_default_payload(self):
        target = temp_dir()
        try:
            before = snapshot(target)

            rc, out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--preset",
                    "coding",
                    "--adapter",
                    "agents",
                    "--adapter",
                    "claude",
                    "--repo-root",
                    str(ROOT),
                    "--json",
                ]
            )

            self.assertEqual(rc, 0)
            self.assertEqual(snapshot(target), before)
            payload = json.loads(out)
            self.assertEqual(
                [item["path"] for item in payload["optional_projections"]],
                [".agents/skills/vivary/SKILL.md", ".claude/skills/vivary/SKILL.md"],
            )
            self.assertNotIn(".agents/skills/vivary/SKILL.md", payload["creates"])
            self.assertNotIn(".claude/skills/vivary/SKILL.md", payload["creates"])
            for projection in payload["optional_projections"]:
                self.assertLessEqual(projection["bytes"], 1200)
                self.assertRegex(projection["source_hash"], r"^sha256:[0-9a-f]{64}$")
                self.assertRegex(projection["content_hash"], r"^sha256:[0-9a-f]{64}$")
        finally:
            shutil.rmtree(target)

    def test_nested_gitignore_negation_is_a_read_only_privacy_conflict(self):
        target = temp_dir()
        try:
            write(target / ".gitignore", "node_modules/\n")
            write(
                target / ".vivary" / ".gitignore",
                "!private/\n!private/secret.md\n",
            )
            before = snapshot(target)

            rc, out = run_cli(
                ["adopt", str(target), "--preset", "coding", "--json"]
            )

            self.assertEqual(rc, 1)
            self.assertEqual(snapshot(target), before)
            payload = json.loads(out)
            self.assertEqual(payload["privacy"]["status"], "conflict")
            self.assertIn(
                ".vivary/.gitignore",
                [conflict["path"] for conflict in payload["conflicts"]],
            )
            self.assertTrue(
                any(
                    "private/runtime" in conflict["reason"]
                    for conflict in payload["conflicts"]
                )
            )
        finally:
            shutil.rmtree(target)

    def test_plan_hash_is_bound_to_the_exact_workspace_root(self):
        parent_a = temp_dir()
        parent_b = temp_dir()
        target_a = parent_a / "project"
        target_b = parent_b / "project"
        try:
            for target in (target_a, target_b):
                target.mkdir()
                write(target / "AGENTS.md", "# Existing agent rules\n")
                write(target / ".gitignore", "node_modules/\n")
                write(target / "STATE.md", "# Existing state\n")

            plan_a = create_vivary.plan_adopt(target_a, preset="coding")
            plan_b = create_vivary.plan_adopt(target_b, preset="coding")

            self.assertNotEqual(plan_a["plan_hash"], plan_b["plan_hash"])
        finally:
            shutil.rmtree(parent_a)
            shutil.rmtree(parent_b)


class ThinAdoptApplyTests(unittest.TestCase):
    def test_apply_requires_the_exact_approved_plan_hash_before_any_write(self):
        target = temp_dir()
        try:
            write(target / "README.md", "# Existing project\n")
            before = snapshot(target)

            rc, out = run_cli(
                ["adopt", str(target), "--preset", "coding", "--yes", "--json"]
            )

            self.assertEqual(rc, 1)
            self.assertEqual(snapshot(target), before)
            payload = json.loads(out)
            self.assertIn("--plan", payload["error"])
        finally:
            shutil.rmtree(target)

    def test_apply_uses_the_approved_creates_and_bounded_host_patches(self):
        target = temp_dir()
        try:
            write(target / "AGENTS.md", "# Existing agent rules\n")
            write(target / ".gitignore", "node_modules/\n")
            write(target / "STATE.md", "# User state\n")
            original = {
                path: (target / path).read_bytes()
                for path in ("AGENTS.md", ".gitignore", "STATE.md")
            }
            dry_rc, dry_out = run_cli(
                ["adopt", str(target), "--preset", "coding", "--json"]
            )
            self.assertEqual(dry_rc, 0)
            dry = json.loads(dry_out)

            rc, out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--preset",
                    "coding",
                    "--yes",
                    "--plan",
                    dry["plan_hash"],
                    "--json",
                ]
            )

            self.assertEqual(rc, 0, out)
            payload = json.loads(out)
            self.assertTrue(payload["doctor"]["ok"], payload["doctor"]["errors"])
            self.assertEqual((target / "STATE.md").read_bytes(), original["STATE.md"])
            self.assertIn(
                ".vivary/context.md",
                (target / "AGENTS.md").read_text(encoding="utf-8"),
            )
            for patch in dry["patches"]:
                path = target / patch["path"]
                self.assertEqual(path.read_bytes(), original[patch["path"]] + patch["inserted_text"].encode())
            self.assertTrue((target / ".vivary" / "context.md").is_file())
            self.assertTrue((target / ".vivary" / "workspace.toml").is_file())
            self.assertFalse((target / ".vivary" / "runtime" / "adopt-journal.json").exists())
            self.assertFalse((target / "tropo.toml").exists())
            self.assertFalse((target / "templates").exists())
            self.assertFalse((target / "modules").exists())
            self.assertFalse((target / ".vivary" / "records").exists())

            applied_snapshot = snapshot(target)
            second_plan = create_vivary.plan_adopt(target, preset="coding")
            self.assertFalse(second_plan["creates"])
            self.assertFalse(second_plan["patches"])
            self.assertFalse(second_plan["conflicts"])
            second = create_vivary.adopt_workspace(
                target,
                preset="coding",
                yes=True,
                plan_hash=second_plan["plan_hash"],
            )
            self.assertTrue(second["doctor"]["ok"])
            self.assertEqual(snapshot(target), applied_snapshot)
        finally:
            shutil.rmtree(target)

    def test_plan_is_clean_for_generated_active_context_workspace(self):
        target = temp_dir()
        try:
            create_vivary.scaffold_thin_workspace(
                target,
                preset="coding",
                active_context="cocoindex-code",
                repo_root=ROOT,
            )
            before = snapshot(target)

            plan = create_vivary.plan_adopt(
                target,
                preset="coding",
                repo_root=ROOT,
            )

            self.assertFalse(plan["creates"])
            self.assertFalse(plan["patches"])
            self.assertFalse(plan["conflicts"])
            self.assertIn(target / ".gitignore", plan["kept"])
            self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)

    def test_apply_restores_active_context_privacy_for_missing_or_host_gitignore(self):
        for initial in (None, "node_modules/\n"):
            with self.subTest(initial=initial):
                target = temp_dir()
                try:
                    create_vivary.scaffold_thin_workspace(
                        target,
                        preset="coding",
                        active_context="cocoindex-code",
                        repo_root=ROOT,
                    )
                    gitignore = target / ".gitignore"
                    if initial is None:
                        gitignore.unlink()
                    else:
                        gitignore.write_text(initial, encoding="utf-8")

                    plan = create_vivary.plan_adopt(
                        target,
                        preset="coding",
                        repo_root=ROOT,
                    )

                    self.assertFalse(plan["conflicts"])
                    self.assertEqual(plan["capabilities"], ["cocoindex-code"])
                    self.assertIn(
                        ".cocoindex_code/",
                        plan["privacy"]["rules"],
                    )
                    applied = create_vivary.adopt_workspace(
                        target,
                        preset="coding",
                        repo_root=ROOT,
                        yes=True,
                        plan_hash=plan["plan_hash"],
                    )
                    self.assertTrue(
                        applied["doctor"]["ok"],
                        applied["doctor"]["errors"],
                    )
                    text = gitignore.read_text(encoding="utf-8")
                    if initial is not None:
                        self.assertTrue(text.startswith(initial))
                    self.assertIn(".cocoindex_code/", text)
                finally:
                    shutil.rmtree(target)

    def test_ordinary_failure_rolls_back_exact_bytes_and_created_files(self):
        probe = temp_dir()
        try:
            write(probe / "AGENTS.md", "# Existing agent rules\r\n")
            write(probe / ".gitignore", "node_modules/\r\n")
            write(probe / "STATE.md", "# Existing state\r\n")
            boundaries = len(
                create_vivary._adopt_actions(
                    create_vivary.plan_adopt(probe, preset="coding")
                )
            )
        finally:
            shutil.rmtree(probe)

        for boundary in range(1, boundaries + 1):
            with self.subTest(boundary=boundary):
                target = temp_dir()
                try:
                    write(target / "AGENTS.md", "# Existing agent rules\r\n")
                    write(target / ".gitignore", "node_modules/\r\n")
                    write(target / "STATE.md", "# Existing state\r\n")
                    before = snapshot(target)
                    plan = create_vivary.plan_adopt(target, preset="coding")

                    with self.assertRaisesRegex(
                        create_vivary.ScaffoldError, "injected failure"
                    ):
                        create_vivary.adopt_workspace(
                            target,
                            preset="coding",
                            yes=True,
                            plan_hash=plan["plan_hash"],
                            _fault_after=boundary,
                        )

                    self.assertEqual(snapshot(target), before)
                    self.assertFalse(
                        (target / ".vivary" / "runtime" / "adopt-journal.json").exists()
                    )
                finally:
                    shutil.rmtree(target)

    def test_process_crash_requires_explicit_plan_bound_recovery(self):
        probe = temp_dir()
        try:
            write(probe / "AGENTS.md", "# Existing agent rules\n")
            write(probe / ".gitignore", "node_modules/\n")
            write(probe / "STATE.md", "# Existing state\n")
            boundaries = len(
                create_vivary._adopt_actions(
                    create_vivary.plan_adopt(probe, preset="coding")
                )
            )
        finally:
            shutil.rmtree(probe)

        for boundary in range(1, boundaries + 1):
            with self.subTest(boundary=boundary):
                target = temp_dir()
                try:
                    write(target / "AGENTS.md", "# Existing agent rules\n")
                    write(target / ".gitignore", "node_modules/\n")
                    write(target / "STATE.md", "# Existing state\n")
                    before = snapshot(target)
                    plan = create_vivary.plan_adopt(target, preset="coding")

                    with self.assertRaises(KeyboardInterrupt):
                        create_vivary.adopt_workspace(
                            target,
                            preset="coding",
                            yes=True,
                            plan_hash=plan["plan_hash"],
                            _crash_after=boundary,
                        )

                    journal = target / ".vivary" / "runtime" / "adopt-journal.json"
                    self.assertTrue(journal.is_file())
                    interrupted_doctor = create_vivary.doctor_workspace(
                        target, repo_root=ROOT
                    )
                    self.assertFalse(interrupted_doctor["ok"])
                    self.assertTrue(
                        any(
                            "adoption journal" in error
                            for error in interrupted_doctor["errors"]
                        )
                    )
                    interrupted = snapshot(target)

                    rc, out = run_cli(
                        [
                            "adopt",
                            str(target),
                            "--recover",
                            plan["plan_hash"],
                            "--json",
                        ]
                    )

                    self.assertEqual(rc, 0, out)
                    payload = json.loads(out)
                    self.assertEqual(payload["mode"], "recovery-dry-run")
                    self.assertFalse(payload["recovered"])
                    self.assertRegex(
                        payload["recovery_plan_hash"],
                        r"^sha256:[0-9a-f]{64}$",
                    )
                    self.assertEqual(snapshot(target), interrupted)

                    apply_rc, apply_out = run_cli(
                        [
                            "adopt",
                            str(target),
                            "--recover",
                            plan["plan_hash"],
                            "--yes",
                            "--plan",
                            payload["recovery_plan_hash"],
                            "--json",
                        ]
                    )

                    self.assertEqual(apply_rc, 0, apply_out)
                    self.assertEqual(snapshot(target), before)
                    applied = json.loads(apply_out)
                    self.assertEqual(applied["mode"], "recovered")
                    self.assertTrue(applied["recovered"])
                finally:
                    shutil.rmtree(target)

    def test_crash_after_privacy_before_journal_has_exact_plan_bound_recovery(self):
        target = temp_dir()
        try:
            write(target / "AGENTS.md", "# Existing agent rules\r\n")
            write(target / ".gitignore", "node_modules/\r\n")
            write(target / "STATE.md", "# Existing state\r\n")
            before = snapshot(target)
            plan = create_vivary.plan_adopt(target, preset="coding")

            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(
                    target,
                    preset="coding",
                    yes=True,
                    plan_hash=plan["plan_hash"],
                    _crash_before_journal=True,
                )

            journal = target / ".vivary" / "runtime" / "adopt-journal.json"
            self.assertFalse(journal.exists())
            self.assertIn(
                "vivary-adopt-prejournal",
                (target / ".gitignore").read_text(encoding="utf-8"),
            )
            interrupted_doctor = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(interrupted_doctor["ok"])
            self.assertTrue(
                any("pre-journal" in error for error in interrupted_doctor["errors"])
            )
            interrupted = snapshot(target)

            rc, out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    plan["plan_hash"],
                    "--json",
                ]
            )

            self.assertEqual(rc, 0, out)
            payload = json.loads(out)
            self.assertEqual(payload["mode"], "recovery-dry-run")
            self.assertFalse(payload["recovered"])
            self.assertEqual(snapshot(target), interrupted)

            apply_rc, apply_out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    plan["plan_hash"],
                    "--yes",
                    "--plan",
                    payload["recovery_plan_hash"],
                    "--json",
                ]
            )

            self.assertEqual(apply_rc, 0, apply_out)
            self.assertEqual(snapshot(target), before)
            self.assertTrue(json.loads(apply_out)["recovered"])
        finally:
            shutil.rmtree(target)

    def test_active_context_prejournal_recovery_uses_capability_privacy_block(self):
        target = temp_dir()
        try:
            create_vivary.scaffold_thin_workspace(
                target,
                preset="coding",
                active_context="cocoindex-code",
                repo_root=ROOT,
            )
            gitignore = target / ".gitignore"
            gitignore.write_text("node_modules/\n", encoding="utf-8")
            before = snapshot(target)
            plan = create_vivary.plan_adopt(
                target,
                preset="coding",
                repo_root=ROOT,
            )

            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(
                    target,
                    preset="coding",
                    repo_root=ROOT,
                    yes=True,
                    plan_hash=plan["plan_hash"],
                    _crash_before_journal=True,
                )

            self.assertIn(
                ".cocoindex_code/",
                gitignore.read_text(encoding="utf-8"),
            )
            rc, out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    plan["plan_hash"],
                    "--json",
                ]
            )
            self.assertEqual(rc, 0, out)
            recovery = json.loads(out)
            apply_rc, apply_out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    plan["plan_hash"],
                    "--yes",
                    "--plan",
                    recovery["recovery_plan_hash"],
                    "--json",
                ]
            )
            self.assertEqual(apply_rc, 0, apply_out)
            self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)

    def test_active_context_journal_recovery_validates_capability_privacy_block(self):
        target = temp_dir()
        try:
            create_vivary.scaffold_thin_workspace(
                target,
                preset="coding",
                active_context="cocoindex-code",
                repo_root=ROOT,
            )
            (target / ".gitignore").write_text(
                "node_modules/\n",
                encoding="utf-8",
            )
            before = snapshot(target)
            plan = create_vivary.plan_adopt(
                target,
                preset="coding",
                repo_root=ROOT,
            )

            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(
                    target,
                    preset="coding",
                    repo_root=ROOT,
                    yes=True,
                    plan_hash=plan["plan_hash"],
                    _crash_after=1,
                )

            journal = target / ".vivary" / "runtime" / "adopt-journal.json"
            self.assertTrue(journal.is_file())
            payload = json.loads(journal.read_text(encoding="utf-8"))
            self.assertEqual(
                payload["approval"]["capabilities"],
                ["cocoindex-code"],
            )
            rc, out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    plan["plan_hash"],
                    "--json",
                ]
            )
            self.assertEqual(rc, 0, out)
            recovery = json.loads(out)
            apply_rc, apply_out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    plan["plan_hash"],
                    "--yes",
                    "--plan",
                    recovery["recovery_plan_hash"],
                    "--json",
                ]
            )
            self.assertEqual(apply_rc, 0, apply_out)
            self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)

    def test_workspace_controlled_journal_cannot_delete_an_arbitrary_file(self):
        target = temp_dir()
        try:
            victim = target / "README.md"
            write(victim, "# User-owned project\n")
            transaction_hash = "sha256:" + "a" * 64
            journal = target / ".vivary" / "runtime" / "adopt-journal.json"
            forged = {
                "schema": create_vivary._ADOPT_JOURNAL_SCHEMA,
                "plan_hash": transaction_hash,
                "phase": "applying",
                "completed": 1,
                "actions": [
                    {
                        "path": "README.md",
                        "kind": "create",
                        "existed": False,
                        "before": None,
                        "before_hash": None,
                        "after_hash": create_vivary._sha256_prefixed(victim.read_bytes()),
                        "transient_after_hash": None,
                    }
                ],
            }
            write(journal, json.dumps(forged))

            rc, out = run_cli(
                [
                    "adopt",
                    str(target),
                    "--recover",
                    transaction_hash,
                    "--json",
                ]
            )

            self.assertEqual(rc, 1, out)
            self.assertEqual(victim.read_text(encoding="utf-8"), "# User-owned project\n")
        finally:
            shutil.rmtree(target)

    def test_rollback_delete_cannot_follow_a_swapped_parent(self):
        target = temp_dir()
        outside = target.with_name(target.name + "-outside")
        moved = target.with_name(target.name + "-moved-vivary")
        (outside / ".vivary").mkdir(parents=True)
        victim = outside / ".vivary" / "context.md"
        write(victim, "outside stays unchanged\n")
        generated = target / ".vivary" / "context.md"
        generated_bytes = b"generated context\n"
        generated.parent.mkdir(parents=True)
        generated.write_bytes(generated_bytes)
        action = {
            "path": generated,
            "after": generated_bytes,
            "after_hash": create_vivary._sha256_prefixed(generated_bytes),
        }
        attack = {"attempted": False, "blocked": False}
        real_replace = create_vivary.os.replace

        def swap_parent():
            attack["attempted"] = True
            try:
                real_replace(target / ".vivary", moved)
                (target / ".vivary").symlink_to(outside / ".vivary", target_is_directory=True)
            except OSError:
                attack["blocked"] = True

        if create_vivary.os.name == "nt":
            real_delete = create_vivary._windows_delete_open_file

            def attempt_windows_swap(file_handle):
                if not attack["attempted"]:
                    swap_parent()
                return real_delete(file_handle)

            patcher = mock.patch.object(
                create_vivary,
                "_windows_delete_open_file",
                side_effect=attempt_windows_swap,
            )
        else:
            real_unlink = create_vivary.os.unlink

            def attempt_posix_swap(path, *args, **kwargs):
                if not attack["attempted"] and Path(path).name == "context.md":
                    swap_parent()
                return real_unlink(path, *args, **kwargs)

            patcher = mock.patch.object(
                create_vivary.os,
                "unlink",
                side_effect=attempt_posix_swap,
            )

        try:
            with patcher:
                try:
                    create_vivary._rollback_adopt(
                        target,
                        [action],
                        {generated: None},
                        cleanup_journal=False,
                    )
                except create_vivary.ScaffoldError:
                    pass

            self.assertTrue(attack["attempted"])
            if attack["blocked"]:
                self.assertFalse(generated.exists())
            else:
                self.assertFalse((moved / "context.md").exists())
            self.assertEqual(victim.read_text(encoding="utf-8"), "outside stays unchanged\n")
        finally:
            link = target / ".vivary"
            if link.is_symlink():
                link.unlink()
            for path in (target, moved, outside):
                if path.exists():
                    shutil.rmtree(path)

    def test_empty_directory_cleanup_does_not_use_pathname_rmdir(self):
        target = temp_dir()
        try:
            (target / ".vivary" / "runtime").mkdir(parents=True)

            with mock.patch.object(Path, "rmdir") as unsafe_rmdir:
                create_vivary._remove_empty_adopt_dirs(target)

            unsafe_rmdir.assert_not_called()
            create_vivary._remove_empty_adopt_dirs(target)
            self.assertFalse((target / ".vivary").exists())
        finally:
            shutil.rmtree(target)

    def test_stale_known_generated_adapter_replacement_is_in_the_approved_plan(self):
        target = temp_dir()
        try:
            current, _, _ = create_vivary._thin_adapter_doc("agents")
            stale = current.replace(
                f"create-vivary {create_vivary.__version__}",
                "create-vivary 0.3.3",
                1,
            )
            adapter = target / ".agents" / "skills" / "vivary" / "SKILL.md"
            write(adapter, stale)

            plan = create_vivary.plan_adopt(
                target,
                preset="coding",
                adapters=("agents",),
            )

            self.assertFalse(plan["conflicts"])
            self.assertEqual(plan["optional_projections"][0]["status"], "replace")
            self.assertEqual(
                [item["path"] for item in plan["adapter_replacements"]],
                [adapter],
            )
            create_vivary.adopt_workspace(
                target,
                preset="coding",
                adapters=("agents",),
                yes=True,
                plan_hash=plan["plan_hash"],
            )
            self.assertEqual(adapter.read_text(encoding="utf-8"), current)
            projection = create_vivary._adopt_report_to_json(plan, mode="dry-run")["content_plan"]
            row = next(row for row in projection["files"] if row["path"] == ".agents/skills/vivary/SKILL.md")
            self.assertEqual(row["operation"], "replace")
            self.assertEqual(row["content"].encode("utf-8"), adapter.read_bytes())
            self.assertEqual(row["before_hash"], "sha256:" + hashlib.sha256(stale.encode("utf-8")).hexdigest())
            self.assertEqual(row["bytes"], len(adapter.read_bytes()))
            self.assertEqual(row["content_hash"], "sha256:" + hashlib.sha256(adapter.read_bytes()).hexdigest())

            future = current.replace(
                f"create-vivary {create_vivary.__version__}",
                "create-vivary 999.0.0",
                1,
            )
            write(adapter, future)
            future_plan = create_vivary.plan_adopt(
                target,
                preset="coding",
                adapters=("agents",),
            )
            self.assertEqual(future_plan["optional_projections"][0]["status"], "conflict")
            self.assertEqual(
                [item["path"] for item in future_plan["conflicts"]],
                [adapter],
            )
        finally:
            shutil.rmtree(target)

    def test_host_mutation_after_approval_is_revalidated_before_vivary_writes(self):
        target = temp_dir()
        try:
            write(target / "AGENTS.md", "# Existing agent rules\n")
            write(target / ".gitignore", "node_modules/\n")
            write(target / "STATE.md", "# Existing state\n")
            plan = create_vivary.plan_adopt(target, preset="coding")
            agents_before = (target / "AGENTS.md").read_bytes()
            gitignore_before = (target / ".gitignore").read_bytes()

            def mutate_kept_input() -> None:
                write(target / "STATE.md", "# Externally changed state\n")

            with self.assertRaisesRegex(create_vivary.ScaffoldError, "input changed"):
                create_vivary.adopt_workspace(
                    target,
                    preset="coding",
                    yes=True,
                    plan_hash=plan["plan_hash"],
                    _before_apply=mutate_kept_input,
                )

            self.assertEqual((target / "AGENTS.md").read_bytes(), agents_before)
            self.assertEqual((target / ".gitignore").read_bytes(), gitignore_before)
            self.assertEqual(
                (target / "STATE.md").read_text(encoding="utf-8"),
                "# Externally changed state\n",
            )
            self.assertFalse((target / ".vivary" / "context.md").exists())
            self.assertFalse(
                (target / ".vivary" / "runtime" / "adopt-journal.json").exists()
            )
        finally:
            shutil.rmtree(target)

    def test_existing_noncontract_capsule_is_a_read_only_conflict(self):
        target = temp_dir()
        try:
            write(target / ".vivary" / "context.md", "# user-owned context\n")
            write(target / "STATE.md", "# Existing state\n")
            before = snapshot(target)

            rc, out = run_cli(
                ["adopt", str(target), "--preset", "coding", "--json"]
            )

            self.assertEqual(rc, 1)
            self.assertEqual(snapshot(target), before)
            payload = json.loads(out)
            self.assertFalse(payload["ok"])
            self.assertEqual(
                [conflict["path"] for conflict in payload["conflicts"]],
                [".vivary/context.md"],
            )
            self.assertIn("STATE.md", payload["kept"])
        finally:
            shutil.rmtree(target)

    def test_valid_user_extended_v03_capsule_and_config_are_kept_byte_for_byte(self):
        target = temp_dir()
        try:
            initial = create_vivary.plan_adopt(
                target,
                preset="coding",
                repo_root=ROOT,
            )
            create_vivary.adopt_workspace(
                target,
                preset="coding",
                repo_root=ROOT,
                yes=True,
                plan_hash=initial["plan_hash"],
            )
            context = target / ".vivary" / "context.md"
            workspace = target / ".vivary" / "workspace.toml"
            context.write_text(
                context.read_text(encoding="utf-8")
                + "\n## Project-specific route\n\nRead `docs/architecture.md` when structure matters.\n",
                encoding="utf-8",
            )
            workspace.write_text(
                workspace.read_text(encoding="utf-8")
                + '\n[types.note]\nfolder = "notes"\noptional = { source = "string" }\n',
                encoding="utf-8",
            )
            before = snapshot(target)

            plan = create_vivary.plan_adopt(
                target,
                preset="coding",
                repo_root=ROOT,
            )

            self.assertFalse(plan["conflicts"])
            self.assertFalse(plan["creates"])
            self.assertFalse(plan["patches"])
            self.assertIn(context, plan["kept"])
            self.assertIn(workspace, plan["kept"])
            applied = create_vivary.adopt_workspace(
                target,
                preset="coding",
                repo_root=ROOT,
                yes=True,
                plan_hash=plan["plan_hash"],
            )
            self.assertTrue(applied["doctor"]["ok"])
            self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)


@contextlib.contextmanager
def held_adoption(target: Path, recover_hash: str | None = None):
    script = """
import sys
sys.path.insert(0, sys.argv[1])
import create_vivary

def wait_before_apply():
    print("ready", flush=True)
    sys.stdin.read(1)

if sys.argv[3]:
    plan = create_vivary.adopt_workspace(sys.argv[2], recover_hash=sys.argv[3])
    rollback = create_vivary._rollback_adopt
    def wait_then_rollback(*args, **kwargs):
        wait_before_apply()
        return rollback(*args, **kwargs)
    create_vivary._rollback_adopt = wait_then_rollback
    create_vivary.adopt_workspace(sys.argv[2], yes=True, recover_hash=sys.argv[3],
                                  plan_hash=plan["recovery_plan_hash"])
else:
    plan = create_vivary.adopt_workspace(sys.argv[2])
    create_vivary.adopt_workspace(sys.argv[2], yes=True, plan_hash=plan["plan_hash"],
                                  _before_apply=wait_before_apply)
"""
    child = subprocess.Popen(
        [sys.executable, "-I", "-B", "-c", script, str(PKG), str(target), recover_hash or ""],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    ready = queue.Queue()
    threading.Thread(target=lambda: ready.put(child.stdout.readline()), daemon=True).start()
    try:
        if ready.get(timeout=5) != "ready\n":
            raise AssertionError("adoption holder did not reach the apply boundary")
        yield child
    finally:
        if child.poll() is None:
            child.kill()
        child.communicate(timeout=5)


class AdoptionJournalSizeTests(unittest.TestCase):
    def test_oversized_backup_refuses_before_even_the_privacy_write(self):
        for original in ("x" * (800 * 1024), "雪" * (280 * 1024)):
            with self.subTest(utf8_bytes=len(original.encode("utf-8"))):
                target = temp_dir()
                try:
                    write(target / "AGENTS.md", original)
                    before = snapshot(target)
                    plan = create_vivary.adopt_workspace(target, preset="coding")
                    self.assertFalse(plan["conflicts"])
                    self.assertEqual(snapshot(target), before)
                    with self.assertRaisesRegex(
                        create_vivary.ScaffoldError, "journal exceeds the recovery size limit"
                    ):
                        create_vivary.adopt_workspace(
                            target, preset="coding", yes=True,
                            plan_hash=plan["plan_hash"], _crash_before_journal=True,
                        )
                    self.assertEqual(snapshot(target), before)
                    self.assertEqual(sorted(p.name for p in target.iterdir()), ["AGENTS.md"])
                    rc, output = run_cli([
                        "adopt", str(target), "--preset", "coding", "--yes",
                        "--plan", plan["plan_hash"], "--json",
                    ])
                    self.assertNotEqual(rc, 0, output)
                    self.assertIn("journal exceeds the recovery size limit", output)
                    self.assertEqual(snapshot(target), before)
                    self.assertEqual(sorted(p.name for p in target.iterdir()), ["AGENTS.md"])
                finally:
                    shutil.rmtree(target)

    def test_near_limit_interrupted_patch_recovers_original_bytes(self):
        target = temp_dir()
        try:
            original = b"# Host rules\r\n" + b"x" * (760 * 1024)
            (target / "AGENTS.md").write_bytes(original)
            before = snapshot(target)
            plan = create_vivary.adopt_workspace(target, preset="coding")
            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(
                    target, preset="coding", yes=True,
                    plan_hash=plan["plan_hash"], _crash_after=4,
                )
            journal = target / ".vivary/runtime/adopt-journal.json"
            self.assertGreater(journal.stat().st_size, 1000 * 1024)
            self.assertLessEqual(journal.stat().st_size, 1024 * 1024)
            self.assertNotEqual((target / "AGENTS.md").read_bytes(), original)
            interrupted = snapshot(target)
            recovery = create_vivary.adopt_workspace(target, recover_hash=plan["plan_hash"])
            self.assertEqual(snapshot(target), interrupted)
            result = create_vivary.adopt_workspace(
                target, recover_hash=plan["plan_hash"], yes=True,
                plan_hash=recovery["recovery_plan_hash"],
            )
            self.assertTrue(result["recovered"])
            self.assertEqual((target / "AGENTS.md").read_bytes(), original)
            self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)

    def test_preflight_reserves_the_extra_byte_for_applying_phase(self):
        target = temp_dir()
        try:
            write(target / "AGENTS.md", "# Host rules\n")
            before = snapshot(target)
            plan = create_vivary.adopt_workspace(target, preset="coding")
            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(
                    target, preset="coding", yes=True,
                    plan_hash=plan["plan_hash"], _crash_after=1,
                )
            applying_size = (target / ".vivary/runtime/adopt-journal.json").stat().st_size
            recovery = create_vivary.adopt_workspace(target, recover_hash=plan["plan_hash"])
            create_vivary.adopt_workspace(
                target, recover_hash=plan["plan_hash"], yes=True,
                plan_hash=recovery["recovery_plan_hash"],
            )
            self.assertEqual(snapshot(target), before)
            # The planned journal fits here; changing its phase adds one byte.
            with mock.patch.object(create_vivary, "_ADOPT_JOURNAL_MAX_BYTES", applying_size - 1):
                with self.assertRaisesRegex(
                    create_vivary.ScaffoldError, "journal exceeds the recovery size limit"
                ):
                    create_vivary.adopt_workspace(
                        target, preset="coding", yes=True,
                        plan_hash=plan["plan_hash"], _crash_before_journal=True,
                    )
            self.assertEqual(snapshot(target), before)
            self.assertEqual(sorted(p.name for p in target.iterdir()), ["AGENTS.md"])
        finally:
            shutil.rmtree(target)


class AdoptionExclusionTests(unittest.TestCase):
    def test_second_process_apply_refuses_before_any_project_write(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            before = snapshot(target)
            with held_adoption(target):
                with self.assertRaisesRegex(create_vivary.ScaffoldError, "already running"):
                    create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
                self.assertEqual(snapshot(target), before)
        finally:
            shutil.rmtree(target)

    def test_missing_or_file_target_remains_a_structured_cli_refusal(self):
        parent = temp_dir()
        try:
            file_target = parent / "file"
            file_target.write_bytes(b"keep this file")
            for target, reason in ((parent / "missing", "does not exist"), (file_target, "not a directory")):
                with self.subTest(reason=reason):
                    rc, output = run_cli(["adopt", str(target), "--yes", "--plan", "sha256:" + "0" * 64, "--json"])
                    self.assertEqual(rc, 1, output)
                    self.assertIn(reason, json.loads(output)["error"])
            self.assertEqual(list(parent.iterdir()), [file_target])
            self.assertEqual(file_target.read_bytes(), b"keep this file")
        finally:
            shutil.rmtree(parent)

    def test_preview_and_other_target_proceed_while_apply_is_held(self):
        target, other = temp_dir(), temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            with held_adoption(target):
                self.assertEqual(create_vivary.adopt_workspace(target)["plan_hash"], plan["plan_hash"])
                self.assertEqual(list(target.iterdir()), [])
                other_plan = create_vivary.adopt_workspace(other)
                result = create_vivary.adopt_workspace(other, yes=True, plan_hash=other_plan["plan_hash"])
                self.assertTrue(result["doctor"]["ok"])
                self.assertEqual(list(target.iterdir()), [])
        finally:
            shutil.rmtree(target)
            shutil.rmtree(other)

    def test_killed_apply_holder_releases_exclusion_and_leaves_no_metadata(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            with held_adoption(target):
                self.assertEqual(list(target.iterdir()), [])
            result = create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
            self.assertTrue(result["doctor"]["ok"])
            unchanged = snapshot(target)
            no_op = create_vivary.adopt_workspace(target)
            self.assertEqual(no_op["writes"], [])
            create_vivary.adopt_workspace(target, yes=True, plan_hash=no_op["plan_hash"])
            self.assertEqual(snapshot(target), unchanged)
        finally:
            shutil.rmtree(target)

    def test_apply_and_recovery_contenders_leave_interrupted_state_unchanged(self):
        target = temp_dir()
        try:
            original = snapshot(target)
            plan = create_vivary.adopt_workspace(target)
            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"], _crash_after=1)
            interrupted = snapshot(target)
            recovery = create_vivary.adopt_workspace(target, recover_hash=plan["plan_hash"])
            with held_adoption(target, plan["plan_hash"]):
                for request in (
                    {"plan_hash": plan["plan_hash"]},
                    {"recover_hash": plan["plan_hash"], "plan_hash": recovery["recovery_plan_hash"]},
                ):
                    with self.assertRaisesRegex(create_vivary.ScaffoldError, "already running"):
                        create_vivary.adopt_workspace(target, yes=True, **request)
                    self.assertEqual(snapshot(target), interrupted)
                preview = create_vivary.adopt_workspace(target, recover_hash=plan["plan_hash"])
                self.assertEqual(preview["recovery_plan_hash"], recovery["recovery_plan_hash"])
                self.assertEqual(snapshot(target), interrupted)
            result = create_vivary.adopt_workspace(target, yes=True, recover_hash=plan["plan_hash"],
                                                   plan_hash=recovery["recovery_plan_hash"])
            self.assertTrue(result["recovered"])
            self.assertEqual(snapshot(target), original)
        finally:
            shutil.rmtree(target)

    def test_recovery_refuses_while_ordinary_apply_is_held(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            with held_adoption(target):
                with self.assertRaisesRegex(create_vivary.ScaffoldError, "already running"):
                    create_vivary.adopt_workspace(target, yes=True, recover_hash=plan["plan_hash"],
                                                   plan_hash=plan["plan_hash"])
                self.assertEqual(list(target.iterdir()), [])
        finally:
            shutil.rmtree(target)

    def test_reentrant_apply_refuses_without_disturbing_the_outer_apply(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            def nested_apply():
                with self.assertRaisesRegex(create_vivary.ScaffoldError, "already running"):
                    create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
                self.assertEqual(list(target.iterdir()), [])
            result = create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"],
                                                   _before_apply=nested_apply)
            self.assertTrue(result["doctor"]["ok"])
        finally:
            shutil.rmtree(target)

    def test_cli_cannot_bypass_an_apply_holder_with_an_equivalent_target_path(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            alias = str(target.parent) + os.sep + "." + os.sep + target.name
            with held_adoption(target):
                rc, output = run_cli(["adopt", alias, "--yes", "--plan", plan["plan_hash"], "--json"])
                self.assertEqual(rc, 1, output)
                self.assertIn("already running", json.loads(output)["error"])
                self.assertEqual(list(target.iterdir()), [])
        finally:
            shutil.rmtree(target)

    @unittest.skipUnless(os.name == "posix", "requires unprivileged symlink creation")
    def test_unrelated_placeholder_symlink_is_not_an_adoption_destination(self):
        target, outside = temp_dir(), temp_dir()
        try:
            source = outside / "host.txt"
            source.write_bytes(b"untouched host content")
            link = target / ".adopt-placeholder"
            link.symlink_to(source)
            plan = create_vivary.adopt_workspace(target)
            self.assertEqual(plan["conflicts"], [])
            result = create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
            self.assertTrue(result["doctor"]["ok"])
            self.assertTrue(link.is_symlink())
            self.assertEqual(link.readlink(), source)
            self.assertEqual(source.read_bytes(), b"untouched host content")
        finally:
            shutil.rmtree(target)
            shutil.rmtree(outside)

    @unittest.skipUnless(os.name == "posix", "requires POSIX flock")
    def test_unsupported_lock_refuses_without_effects_and_releases_local_claim(self):
        import fcntl
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            with mock.patch.object(fcntl, "flock", side_effect=OSError(errno.EOPNOTSUPP, "unsupported")):
                with self.assertRaisesRegex(create_vivary.ScaffoldError, "cannot exclude concurrent adoption"):
                    create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
            self.assertEqual(list(target.iterdir()), [])
            self.assertTrue(create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])["applied"])
        finally:
            shutil.rmtree(target)

    @unittest.skipUnless(os.name == "nt", "requires Windows mutex")
    def test_windows_mutex_failures_refuse_without_effects_and_release_handles(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            with mock.patch.object(create_vivary, "_WINDOWS_CREATE_MUTEX", return_value=None) as denied:
                with self.assertRaisesRegex(create_vivary.ScaffoldError, "cannot acquire global adoption exclusion"):
                    create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
                self.assertTrue(denied.call_args.args[2].startswith("Global\\VivaryAdoptV1_"))
                self.assertEqual(list(target.iterdir()), [])
            for status, message in ((0xFFFFFFFF, "cannot acquire"), (0x102, "already running")):
                with self.subTest(status=status):
                    with mock.patch.object(create_vivary, "_WINDOWS_WAIT_OBJECT", return_value=status), \
                            mock.patch.object(create_vivary, "_WINDOWS_RELEASE_MUTEX") as release:
                        with self.assertRaisesRegex(create_vivary.ScaffoldError, message):
                            create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
                        release.assert_not_called()
                    self.assertEqual(list(target.iterdir()), [])
            # A failed wait must not leak the in-process claim or acquire ownership.
            self.assertTrue(create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])["applied"])
        finally:
            shutil.rmtree(target)

    @unittest.skipUnless(os.name == "nt", "requires Windows mutex")
    def test_windows_abandoned_ownership_still_uses_existing_recovery_checks(self):
        target = temp_dir()
        try:
            plan = create_vivary.adopt_workspace(target)
            with self.assertRaises(KeyboardInterrupt):
                create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"], _crash_after=1)
            interrupted = snapshot(target)
            wait = create_vivary._WINDOWS_WAIT_OBJECT
            def abandoned(handle, timeout):
                self.assertEqual(wait(handle, timeout), 0)
                return 0x80
            with mock.patch.object(create_vivary, "_WINDOWS_WAIT_OBJECT", side_effect=abandoned):
                with self.assertRaises(create_vivary.ScaffoldError):
                    create_vivary.adopt_workspace(target, yes=True, plan_hash=plan["plan_hash"])
            self.assertEqual(snapshot(target), interrupted)
            recovery = create_vivary.adopt_workspace(target, recover_hash=plan["plan_hash"])
            result = create_vivary.adopt_workspace(target, yes=True, recover_hash=plan["plan_hash"],
                                                   plan_hash=recovery["recovery_plan_hash"])
            self.assertTrue(result["recovered"])
        finally:
            shutil.rmtree(target)


if __name__ == "__main__":
    unittest.main()
