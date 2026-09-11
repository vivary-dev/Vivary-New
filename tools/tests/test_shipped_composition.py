"""20j regressions against real disposable thin workspaces, without model calls."""
from contextlib import redirect_stdout
import importlib
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / p) for p in (
    "packages/create-vivary", "packages/tropo", "packages/core",
    "packages/workbench/server", "tools", "tools/tests",
)]
import create_vivary as cv
import tropo
import test_hoh_loop as base
from vivary_core.creation_apply import ThinWorkspaceOptions


class ShippedCompositionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=os.environ["VIVARY_20J_SCRATCH"])
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def test_creation_adapter_matches_shipped_init_and_doctor(self):
        module = importlib.import_module("creation_workspace")
        recovery = self.root / "recovery"
        recovery.mkdir()
        ops = module.ShippedWorkspaceOperations(recovery_parent=recovery)
        target = self.root / "workbench" / "example"
        reference = self.root / "shipped" / "example"
        target.parent.mkdir()
        reference.parent.mkdir()
        options = ThinWorkspaceOptions()
        plan = ops.plan(target, options)
        ops.scaffold(target, options)
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(cv.main(["init", str(reference), "--json", "--no-wizard"]), 0)
        actual = {p.relative_to(target).as_posix(): p.read_bytes()
                  for p in target.rglob("*") if p.is_file()}
        expected = {p.relative_to(reference).as_posix(): p.read_bytes()
                    for p in reference.rglob("*") if p.is_file()}
        self.assertEqual(len(actual), 5)
        self.assertEqual(actual, expected)
        self.assertEqual(ops.recovery_plan(target, options), plan)
        self.assertTrue(ops.doctor(target)["ok"])
        self.assertEqual(ops.tropo(target), 0)

    def test_planner_receives_capsule_and_receipt_binds_fingerprint(self):
        project = self.root / "project"
        cv.scaffold_thin_workspace(project, repo_root=ROOT)
        shutil.copytree(ROOT / "docs/product/multi-project/fixtures/hoh-loop", project,
                        dirs_exist_ok=True)
        (project / "linkcheck.py").write_text(base.DeterministicRoleAdapter._source_for_iteration(3))
        prompts = []

        class InspectAdapter(base.DeterministicRoleAdapter):
            def invoke(inner, request, prompt, view, deadline):
                if request["role"] == "planner":
                    prompts.append(prompt)
                    self.assertFalse((view.root / "specification").exists())
                    capsule = json.loads(view.read_text(f"context/iteration-{request['iteration']}-task-capsule.json"))
                    self.assertEqual(capsule["schema"], "vivary.task-capsule/v0")
                    self.assertIn(capsule["fingerprint"], prompt)
                    self.assertNotIn(project.joinpath("spec.md").read_text(), prompt)
                return super().invoke(request, prompt, view, deadline)

        loop = base.make_test_loop(
            project=project, receipt_dir=self.root / "receipts",
            prompt_dir=ROOT / "tools/hoh/prompts", run_id="shipped-proof",
            iterations=2, iteration_timeout_seconds=60, reported_token_budget=1000,
            usage_ledger=self.root / "usage.json", adapter=InspectAdapter(completed_developer=True),
        )
        self.assertEqual(loop.run()["status"], "complete")
        records = [json.loads(p.read_text())["payload"] for p in loop.receipts.details.glob("*.json")]
        planners = [r for r in records if r["stage"] == "planner" and r["status"] == "complete"]
        self.assertEqual(sorted(r["iteration"] for r in planners), [1, 2])
        for planner in planners:
            capsule = json.loads((loop.documents / f"iteration-{planner['iteration']}-task-capsule.json").read_text())
            self.assertEqual(planner["details"]["context_capsule_fingerprint"], capsule["fingerprint"])
        self.assertEqual(len(prompts), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
