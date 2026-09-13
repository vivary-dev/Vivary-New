"""Public-seam tests for thin-v0.3 greenfield init."""

import contextlib
import io
import json
import shutil
import sys
import tomllib
import unittest
import uuid
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[3]
PKG = ROOT / "packages" / "create-vivary"
sys.path.insert(0, str(PKG))

import create_vivary  # noqa: E402


def temp_target() -> Path:
    return ROOT / "sandboxes" / f"test-init-thin-{uuid.uuid4().hex}"


def run_cli(argv: list[str]) -> tuple[int, str]:
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        rc = create_vivary.main(argv)
    return rc, output.getvalue()


VIVARY_METADATA_HEADER = '[workspace.vivary]\nversion = 1\n'
DEFAULT_ROLES = {
    "law": ["AGENTS.md", ".vivary/context.md"],
    "map": [".vivary/context.md"],
    "record": [],
    "memory": [],
    "boundary": [".gitignore", ".vivary/private", ".vivary/runtime"],
}


def replace_role_metadata(config: str, metadata: str) -> str:
    """Replace the generated Vivary metadata tables. An empty string removes them."""
    before, remaining = config.split("\n# Optional Vivary metadata.", 1)
    _generated, after = remaining.split("\n[base]\n", 1)
    return before + "\n" + metadata + "\n[base]\n" + after


class ThinInitTests(unittest.TestCase):
    def test_public_init_help_does_not_advertise_legacy_obsidian_scaffolding(self):
        parser = create_vivary.build_parser()
        init = parser._subparsers._group_actions[0].choices["init"]

        self.assertNotIn("--obsidian", init.format_help())

    def test_dry_run_is_read_only_and_default_plan_is_exactly_five_files(self):
        target = temp_target()
        try:
            planned = create_vivary.scaffold_thin_workspace(
                target,
                preset="coding",
                repo_root=ROOT,
                dry_run=True,
            )

            self.assertFalse(target.exists())
            self.assertEqual(
                [path.relative_to(target).as_posix() for path in planned],
                [
                    ".gitignore",
                    ".vivary/context.md",
                    ".vivary/workspace.toml",
                    "AGENTS.md",
                    "STATE.md",
                ],
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_cli_init_creates_only_thin_contract_and_is_immediately_healthy(self):
        target = temp_target()
        try:
            rc, out = run_cli(
                [
                    "init",
                    str(target),
                    "--preset",
                    "coding",
                    "--no-wizard",
                    "--repo-root",
                    str(ROOT),
                    "--json",
                ]
            )

            self.assertEqual(rc, 0, out)
            payload = json.loads(out)
            self.assertEqual(payload["contract"], "thin-v0.3")
            self.assertEqual(payload["files"], 5)
            files = {
                path.relative_to(target).as_posix()
                for path in target.rglob("*")
                if path.is_file()
            }
            self.assertEqual(
                files,
                {
                    ".gitignore",
                    ".vivary/context.md",
                    ".vivary/workspace.toml",
                    "AGENTS.md",
                    "STATE.md",
                },
            )
            self.assertFalse((target / ".vivary" / "records").exists())
            self.assertFalse((target / "templates").exists())
            self.assertFalse((target / "tropo.toml").exists())
            doctor = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertTrue(doctor["ok"], doctor["errors"])
            self.assertEqual(
                doctor["compatibility"]["workspace_contract"],
                "thin-v0.3",
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_interactive_defaults_create_five_file_seed_without_provider_install(self):
        target = temp_target()
        try:
            with mock.patch.object(
                create_vivary.sys.stdin, "isatty", return_value=True
            ), mock.patch.object(
                create_vivary.sys.stdin,
                "readline",
                side_effect=["\n", "\n", "\n"],
            ), mock.patch.object(
                create_vivary, "_ensure_backend_installed", return_value=[]
            ) as installer:
                rc, out = run_cli(
                    [
                        "init",
                        str(target),
                        "--preset",
                        "coding",
                        "--repo-root",
                        str(ROOT),
                        "--json",
                    ]
                )

            self.assertEqual(rc, 0, out)
            installer.assert_not_called()
            payload = json.loads(out)
            self.assertEqual(payload["storage"], "file")
            self.assertEqual(payload["files"], 5)
            self.assertEqual(
                {
                    path.relative_to(target).as_posix()
                    for path in target.rglob("*")
                    if path.is_file()
                },
                {
                    ".gitignore",
                    ".vivary/context.md",
                    ".vivary/workspace.toml",
                    "AGENTS.md",
                    "STATE.md",
                },
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_auto_defaults_create_five_file_seed_without_provider_install(self):
        target = temp_target()
        try:
            with mock.patch.object(
                create_vivary, "_ensure_backend_installed", return_value=[]
            ) as installer:
                rc, out = run_cli(
                    [
                        "init",
                        str(target),
                        "--preset",
                        "coding",
                        "--auto",
                        "--repo-root",
                        str(ROOT),
                        "--json",
                    ]
                )

            self.assertEqual(rc, 0, out)
            installer.assert_not_called()
            payload = json.loads(out)
            self.assertEqual(payload["storage"], "file")
            self.assertEqual(payload["files"], 5)
            self.assertFalse((target / ".vivary" / "storage.toml").exists())
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_every_core_preset_is_the_same_five_file_seed_with_lazy_modes_and_runtime_routes(self):
        for preset in create_vivary.PRESETS:
            with self.subTest(preset=preset):
                target = temp_target()
                try:
                    paths = create_vivary.scaffold_thin_workspace(
                        target,
                        preset=preset,
                        repo_root=ROOT,
                    )
                    self.assertEqual(len(paths), 5)
                    self.assertFalse((target / ".vivary" / "records").exists())
                    self.assertFalse((target / "templates").exists())
                    self.assertFalse((target / ".agents").exists())
                    context = (target / ".vivary" / "context.md").read_text(
                        encoding="utf-8"
                    )
                    self.assertIn("vivary-mcp --workspace project .", context)
                    self.assertIn("create-vivary record", context)
                    self.assertIn("separately installed", context)
                    report = create_vivary.doctor_workspace(target, repo_root=ROOT)
                    self.assertTrue(report["ok"], report["errors"])
                    expected_roles = {"patterns": ["thin-context"], "roles": DEFAULT_ROLES}
                    self.assertEqual(report["workspace_roles"], expected_roles)
                    config = target / ".vivary" / "workspace.toml"
                    # The public one-argument call must match Doctor's metadata.
                    tropo = create_vivary._load_tropo(ROOT)
                    workspace_table = tomllib.loads(config.read_text())["workspace"]
                    self.assertEqual(
                        tropo.resolve_workspace_roles({})["roles"]["boundary"], [".gitignore"]
                    )
                    self.assertEqual(
                        tropo.resolve_workspace_roles(workspace_table), expected_roles
                    )
                    state_before = (target / "STATE.md").read_bytes()
                    config.write_text(replace_role_metadata(config.read_text(), ""))
                    legacy = create_vivary.doctor_workspace(target, repo_root=ROOT)
                    self.assertTrue(legacy["ok"], legacy["errors"])
                    self.assertEqual(legacy["workspace_roles"], expected_roles)
                    self.assertEqual((target / "STATE.md").read_bytes(), state_before)
                finally:
                    if target.exists():
                        shutil.rmtree(target)

    def test_workspaces_without_vivary_metadata_keep_ignoring_unrelated_workspace_values(self):
        # Before [workspace.vivary] existed, thin-v0.3 ignored these extension keys.
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, repo_root=ROOT)
            config = target / ".vivary" / "workspace.toml"
            original = config.read_text()
            tropo = create_vivary._load_tropo(ROOT)
            expected = {"patterns": ["thin-context"], "roles": DEFAULT_ROLES}
            unrecognized = {
                "unknown pattern and role": (
                    'patterns = ["custom"]\n[workspace.roles]\nstate = "STATE.md"\n'
                ),
                "unknown pattern without roles": 'patterns = ["custom"]\n',
                "unknown role without patterns": '[workspace.roles]\nstate = "STATE.md"\n',
                "patterns type": 'patterns = "thin-context"\n[workspace.roles]\nlaw = []\n',
                "roles type": 'patterns = []\nroles = []\n',
                "path list": 'patterns = []\n[workspace.roles]\nlaw = "handbook.md"\n',
                "escape": 'patterns = []\n[workspace.roles]\nmemory = ["../outside.md"]\n',
                "glob": 'patterns = []\n[workspace.roles]\nmemory = ["notes/*.md"]\n',
            }
            for name, values in unrecognized.items():
                with self.subTest(name=name):
                    written = replace_role_metadata(original, values)
                    config.write_text(written)
                    report = create_vivary.doctor_workspace(target, repo_root=ROOT)
                    self.assertTrue(report["ok"], report["errors"])
                    self.assertEqual(report["workspace_roles"], expected)
                    resolver = tropo.ConfigResolver(str(target), str(Path(tropo.__file__).parent))
                    self.assertEqual(resolver.base.workspace_roles, expected)
                    self.assertEqual(config.read_text(), written)
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_legacy_workspace_roles_without_vivary_metadata_are_retained_not_migrated(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, repo_root=ROOT)
            config = target / ".vivary" / "workspace.toml"
            original = config.read_text()
            tropo = create_vivary._load_tropo(ROOT)
            empty_roles = {role: [] for role in DEFAULT_ROLES}
            cases = [
                (
                    'patterns = []\n[workspace.roles]\nlaw = ["handbook.md"]\n',
                    {"patterns": [], "roles": {**empty_roles, "law": ["handbook.md"]}},
                ),
                (
                    'patterns = ["thin-context"]\n[workspace.roles]\nmemory = ["notes/log.md"]\n',
                    {"patterns": ["thin-context"], "roles": {**DEFAULT_ROLES, "memory": ["notes/log.md"]}},
                ),
                ('patterns = []\n', {"patterns": [], "roles": empty_roles}),
                (
                    '[workspace.roles]\nlaw = ["handbook.md"]\n',
                    {"patterns": ["thin-context"], "roles": {**DEFAULT_ROLES, "law": ["handbook.md"]}},
                ),
            ]
            for metadata, expected in cases:
                with self.subTest(metadata=metadata):
                    legacy = replace_role_metadata(original, metadata).encode("utf-8")
                    config.write_bytes(legacy)
                    report = create_vivary.doctor_workspace(target, repo_root=ROOT)
                    self.assertTrue(report["ok"], report["errors"])
                    self.assertEqual(report["workspace_roles"], expected)
                    resolver = tropo.ConfigResolver(str(target), str(Path(tropo.__file__).parent))
                    self.assertEqual(resolver.base.workspace_roles, expected)
                    self.assertEqual(config.read_bytes(), legacy)
                    self.assertFalse((target / "handbook.md").exists())

            config.write_text(config.read_text().replace(
                'exclude = [".git", ".agents", ".vivary/private", ".vivary/runtime"]',
                'exclude = [".git", ".agents", ".vivary/runtime"]',
            ))
            with self.assertRaisesRegex(tropo.ConfigError, "exclude must protect"):
                tropo.ConfigResolver(str(target), str(Path(tropo.__file__).parent))
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_doctor_reports_roles_and_metadata_errors_alongside_unrelated_failures(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, repo_root=ROOT)
            config = target / ".vivary" / "workspace.toml"
            original = config.read_text()
            (target / "STATE.md").unlink()
            report = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(report["ok"])
            self.assertIn("missing required file: STATE.md", report["errors"])
            self.assertEqual(
                report["workspace_roles"], {"patterns": ["thin-context"], "roles": DEFAULT_ROLES}
            )
            self.assertEqual(report["graph"], {"nodes": 0, "edges": 0, "broken": 0})

            config.write_text(replace_role_metadata(original, (
                VIVARY_METADATA_HEADER + '[workspace.vivary.roles]\nlaw = "AGENTS.md"\n'
            )))
            invalid = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertIsNone(invalid["workspace_roles"])
            self.assertIn("missing required file: STATE.md", invalid["errors"])
            self.assertTrue(
                any(
                    "workspace.vivary.roles.law must be a list" in error
                    for error in invalid["errors"]
                ),
                invalid["errors"],
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_roles_remain_visible_while_adoption_recovery_is_required(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, repo_root=ROOT)
            journal = target / ".vivary" / "runtime" / "adopt-journal.json"
            journal.parent.mkdir(parents=True)
            journal.write_text("{}")
            report = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(report["ok"])
            self.assertTrue(any("unfinished adoption journal" in error for error in report["errors"]))
            self.assertEqual(report["workspace_roles"]["roles"], DEFAULT_ROLES)
            self.assertEqual(report["graph"], {"nodes": 0, "edges": 0, "broken": 0})
            self.assertEqual(journal.read_text(), "{}")

            journal.unlink()
            gitignore = target / ".gitignore"
            before = gitignore.read_text() + "# vivary-adopt-prejournal invalid\n"
            gitignore.write_text(before)
            report = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(report["ok"])
            self.assertIn("malformed pre-journal adoption marker exists in .gitignore", report["errors"])
            self.assertEqual(report["workspace_roles"]["roles"], DEFAULT_ROLES)
            self.assertEqual(gitignore.read_text(), before)
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_adoption_preserves_custom_roles_unknown_config_and_authored_state(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, preset="writing", repo_root=ROOT)
            config = target / ".vivary" / "workspace.toml"
            custom = replace_role_metadata(config.read_text(), (
                VIVARY_METADATA_HEADER + 'patterns = ["thin-context"]\n'
                '[workspace.vivary.roles]\n'
                'law = ["handbook.md"]\n'
                'map = []\n'
                'memory = ["notes/[Q3] review.md"]\n'
            )) + '\n[user_options]\nkeep = "unchanged"\n'
            config.write_text(custom)
            state = target / "STATE.md"
            state.write_bytes(b"# My state\n\nNext: keep the user's plan.\n")
            state_before = state.read_bytes()
            plan = create_vivary.adopt_workspace(target, preset="writing", repo_root=ROOT)
            self.assertEqual(plan["conflicts"], [])
            applied = create_vivary.adopt_workspace(
                target, preset="writing", repo_root=ROOT,
                yes=True, plan_hash=plan["plan_hash"],
            )
            self.assertTrue(applied["applied"])
            report = applied["doctor"]
            self.assertTrue(report["ok"], report["errors"])
            self.assertEqual(report["workspace_roles"]["roles"]["law"], ["handbook.md"])
            self.assertEqual(report["workspace_roles"]["roles"]["map"], [])
            self.assertEqual(report["workspace_roles"]["roles"]["memory"], ["notes/[Q3] review.md"])
            self.assertEqual(report["workspace_roles"]["roles"]["record"], [])
            self.assertEqual(config.read_text(), custom)
            self.assertEqual(state.read_bytes(), state_before)
            self.assertFalse((target / "handbook.md").exists())
            self.assertFalse((target / "notes").exists())
            self.assertFalse((target / ".vivary" / "records").exists())
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_role_metadata_is_validated_by_the_existing_config_reader(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, repo_root=ROOT)
            config = target / ".vivary" / "workspace.toml"
            original = config.read_text()
            tropo = create_vivary._load_tropo(ROOT)
            invalid = {
                "metadata type": 'vivary = []\n',
                "missing version": '[workspace.vivary]\npatterns = ["thin-context"]\n',
                "wrong version": '[workspace.vivary]\nversion = 2\n',
                "bool version": '[workspace.vivary]\nversion = true\n',
                "patterns type": 'patterns = "thin-context"\n',
                "unsupported pattern": 'patterns = ["memory-maintenance"]\n',
                "repeated pattern": 'patterns = ["thin-context", "thin-context"]\n',
                "roles type": 'roles = []\n',
                "unknown role": '[workspace.vivary.roles]\nstate = []\n',
                "path list": '[workspace.vivary.roles]\nlaw = "AGENTS.md"\n',
                "escape": '[workspace.vivary.roles]\nmemory = ["../outside.md"]\n',
                "absolute": '[workspace.vivary.roles]\nmemory = ["/outside.md"]\n',
                "drive": "[workspace.vivary.roles]\nmemory = ['C:\\outside.md']\n",
                "glob": '[workspace.vivary.roles]\nmemory = ["notes/*.md"]\n',
                "duplicate": '[workspace.vivary.roles]\nlaw = ["AGENTS.md", "AGENTS.md"]\n',
            }
            for name, metadata in invalid.items():
                with self.subTest(name=name):
                    if "version" not in name and name != "metadata type":
                        metadata = VIVARY_METADATA_HEADER + metadata
                    config.write_text(replace_role_metadata(original, metadata))
                    with self.assertRaises(tropo.ConfigError):
                        tropo.ConfigResolver(str(target), str(Path(tropo.__file__).parent))
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_empty_assignments_never_disable_privacy_or_required_thin_files(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(target, repo_root=ROOT)
            config = target / ".vivary" / "workspace.toml"
            empty = replace_role_metadata(config.read_text(), (
                VIVARY_METADATA_HEADER + 'patterns = []\n[workspace.vivary.roles]\nboundary = []\n'
            ))
            config.write_text(empty)
            report = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertTrue(report["ok"], report["errors"])
            self.assertEqual(report["workspace_roles"], {
                "patterns": [], "roles": {role: [] for role in ("law", "map", "record", "memory", "boundary")},
            })
            tropo = create_vivary._load_tropo(ROOT)
            config.write_text(empty.replace(
                'exclude = [".git", ".agents", ".vivary/private", ".vivary/runtime"]',
                'exclude = [".git", ".agents", ".vivary/runtime"]',
            ))
            with self.assertRaisesRegex(tropo.ConfigError, "exclude must protect"):
                tropo.ConfigResolver(str(target), str(Path(tropo.__file__).parent))
            config.write_text(empty)
            (target / "STATE.md").unlink()
            self.assertFalse(create_vivary.doctor_workspace(target, repo_root=ROOT)["ok"])
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_selected_adapter_is_one_bounded_declared_projection(self):
        target = temp_target()
        try:
            paths = create_vivary.scaffold_thin_workspace(
                target,
                preset="writing",
                adapters=("agents",),
                repo_root=ROOT,
            )

            self.assertEqual(len(paths), 6)
            adapter = target / ".agents" / "skills" / "vivary" / "SKILL.md"
            self.assertTrue(adapter.is_file())
            self.assertLessEqual(len(adapter.read_bytes()), 1200)
            workspace = (target / ".vivary" / "workspace.toml").read_text(
                encoding="utf-8"
            )
            self.assertIn('adapters = ["agents"]', workspace)
            self.assertTrue(
                create_vivary.doctor_workspace(target, repo_root=ROOT)["ok"]
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_active_context_is_config_only_and_keeps_the_five_file_seed(self):
        target = temp_target()
        try:
            paths = create_vivary.scaffold_thin_workspace(
                target,
                preset="coding",
                active_context="cocoindex-code",
                repo_root=ROOT,
            )

            self.assertEqual(len(paths), 5)
            self.assertFalse((target / "docs" / "active-context.md").exists())
            self.assertFalse((target / ".agents").exists())
            self.assertIn(
                ".cocoindex_code/",
                (target / ".gitignore").read_text(encoding="utf-8"),
            )
            self.assertIn(
                '".cocoindex_code"',
                (target / ".vivary" / "workspace.toml").read_text(encoding="utf-8"),
            )
            healthy = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertTrue(healthy["ok"], healthy["errors"])
            expected_boundary = [
                ".gitignore", ".vivary/private", ".vivary/runtime", ".cocoindex_code",
            ]
            self.assertEqual(healthy["workspace_roles"]["roles"]["boundary"], expected_boundary)
            config = target / ".vivary" / "workspace.toml"
            tropo = create_vivary._load_tropo(ROOT)
            workspace_table = tomllib.loads(config.read_text())["workspace"]
            self.assertEqual(
                tropo.resolve_workspace_roles(workspace_table), healthy["workspace_roles"]
            )
            duplicate_capabilities = ["cocoindex-code", "cocoindex-code"]
            with self.assertRaisesRegex(tropo.ConfigError, "capabilities may contain"):
                tropo.resolve_workspace_roles({
                    **workspace_table, "capabilities": duplicate_capabilities,
                })
            generated_config = config.read_text()
            config.write_text(generated_config.replace(
                'capabilities = ["cocoindex-code"]',
                'capabilities = ["cocoindex-code", "cocoindex-code"]',
            ))
            invalid = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(invalid["ok"])
            self.assertTrue(any("capabilities may contain" in error for error in invalid["errors"]))
            config.write_text(replace_role_metadata(generated_config, ""))
            legacy = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertTrue(legacy["ok"], legacy["errors"])
            self.assertEqual(legacy["workspace_roles"]["roles"]["boundary"], expected_boundary)

            gitignore = target / ".gitignore"
            generated_gitignore = gitignore.read_text(encoding="utf-8")
            gitignore.write_text(
                generated_gitignore.replace(
                    ".cocoindex_code/\n",
                    "",
                ),
                encoding="utf-8",
            )
            report = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(report["ok"])
            self.assertIn(
                "privacy ignore missing: .cocoindex_code/",
                report["errors"],
            )
            self.assertEqual(report["workspace_roles"]["roles"]["boundary"], expected_boundary)

            gitignore.write_text(
                generated_gitignore + "!.cocoindex_code/\n",
                encoding="utf-8",
            )
            negated = create_vivary.doctor_workspace(target, repo_root=ROOT)
            self.assertFalse(negated["ok"])
            self.assertIn(
                "privacy ignore missing: .cocoindex_code/",
                negated["errors"],
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_nonempty_target_is_redirected_to_governed_adopt(self):
        target = temp_target()
        try:
            target.mkdir(parents=True)
            (target / "README.md").write_text("# Existing\n", encoding="utf-8")
            with self.assertRaisesRegex(create_vivary.ScaffoldError, "use create-vivary adopt"):
                create_vivary.scaffold_thin_workspace(
                    target,
                    preset="coding",
                    repo_root=ROOT,
                )
            self.assertEqual(
                (target / "README.md").read_text(encoding="utf-8"),
                "# Existing\n",
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_force_does_not_replace_user_edits_in_an_existing_thin_workspace(self):
        target = temp_target()
        try:
            create_vivary.scaffold_thin_workspace(
                target,
                preset="coding",
                repo_root=ROOT,
            )
            agents = target / "AGENTS.md"
            state = target / "STATE.md"
            agents.write_text(
                agents.read_text(encoding="utf-8") + "\nUser-owned rule.\n",
                encoding="utf-8",
            )
            state.write_text(
                state.read_text(encoding="utf-8") + "\nUser-owned state.\n",
                encoding="utf-8",
            )
            before = {
                path.relative_to(target).as_posix(): path.read_bytes()
                for path in target.rglob("*")
                if path.is_file()
            }

            with self.assertRaisesRegex(
                create_vivary.ScaffoldError,
                "use create-vivary adopt",
            ):
                create_vivary.scaffold_thin_workspace(
                    target,
                    preset="coding",
                    force=True,
                    repo_root=ROOT,
                )

            self.assertEqual(
                {
                    path.relative_to(target).as_posix(): path.read_bytes()
                    for path in target.rglob("*")
                    if path.is_file()
                },
                before,
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_force_cannot_replace_a_file_created_after_the_empty_target_check(self):
        target = temp_target()
        real_write = create_vivary._write_bytes_no_follow
        injected = {"done": False}

        def create_competing_file(target_root, destination, data, **kwargs):
            if not injected["done"]:
                injected["done"] = True
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text("user-created during init\n", encoding="utf-8")
            return real_write(target_root, destination, data, **kwargs)

        try:
            with mock.patch.object(
                create_vivary,
                "_write_bytes_no_follow",
                side_effect=create_competing_file,
            ):
                with self.assertRaises(create_vivary.ScaffoldError):
                    create_vivary.scaffold_thin_workspace(
                        target,
                        preset="coding",
                        force=True,
                        repo_root=ROOT,
                    )

            self.assertTrue(injected["done"])
            self.assertEqual(
                (target / ".gitignore").read_text(encoding="utf-8"),
                "user-created during init\n",
            )
        finally:
            if target.exists():
                shutil.rmtree(target)

    def test_parent_swap_cannot_redirect_a_seed_write_outside_the_workspace(self):
        target = temp_target()
        outside = target.with_name(target.name + "-outside")
        moved = target.with_name(target.name + "-moved-workspace")
        (outside / ".vivary").mkdir(parents=True)
        sentinel = outside / "sentinel.txt"
        sentinel.write_text("outside stays unchanged\n", encoding="utf-8")
        real_replace = create_vivary.os.replace
        real_link = create_vivary.os.link
        real_windows_rename = getattr(create_vivary, "_windows_rename_open_file", None)
        attack = {"attempted": False, "blocked": False}

        def swap_destination_parent():
            attack["attempted"] = True
            try:
                real_replace(target, moved)
                target.symlink_to(
                    outside,
                    target_is_directory=True,
                )
            except OSError:
                attack["blocked"] = True

        def attempt_posix_parent_swap(src, dst, *args, **kwargs):
            if not attack["attempted"] and Path(dst).name == "context.md":
                swap_destination_parent()
            return real_link(src, dst, *args, **kwargs)

        def attempt_windows_parent_swap(file_handle, parent_handle, name, **kwargs):
            if not attack["attempted"] and name == "context.md":
                swap_destination_parent()
            return real_windows_rename(file_handle, parent_handle, name, **kwargs)

        failed_closed = False
        try:
            patcher = (
                mock.patch.object(
                    create_vivary,
                    "_windows_rename_open_file",
                    side_effect=attempt_windows_parent_swap,
                )
                if create_vivary.os.name == "nt"
                else mock.patch.object(
                    create_vivary.os,
                    "link",
                    side_effect=attempt_posix_parent_swap,
                )
            )
            with patcher:
                try:
                    create_vivary.scaffold_thin_workspace(
                        target,
                        preset="coding",
                        repo_root=ROOT,
                    )
                except create_vivary.ScaffoldError:
                    failed_closed = True

            self.assertTrue(attack["attempted"])
            self.assertTrue(attack["blocked"] or failed_closed)
            if not attack["blocked"]:
                self.assertTrue(failed_closed)
            self.assertEqual(
                sentinel.read_text(encoding="utf-8"),
                "outside stays unchanged\n",
            )
            self.assertFalse((outside / ".vivary" / "context.md").exists())
        finally:
            for path in (target, moved, outside):
                if path.exists() or path.is_symlink():
                    if path.is_symlink():
                        path.unlink()
                    else:
                        shutil.rmtree(path)

    def test_cli_rejects_brownfield_before_wizard_or_backend_install(self):
        target = temp_target()
        try:
            target.mkdir(parents=True)
            (target / "README.md").write_text("# Existing\n", encoding="utf-8")

            with mock.patch.object(create_vivary, "_run_wizard") as wizard, mock.patch.object(
                create_vivary, "_ensure_backend_installed"
            ) as installer:
                rc, out = run_cli(
                    [
                        "init",
                        str(target),
                        "--storage",
                        "embedded",
                        "--yes",
                        "--repo-root",
                        str(ROOT),
                        "--json",
                    ]
                )

            self.assertEqual(rc, 1, out)
            wizard.assert_not_called()
            installer.assert_not_called()
            self.assertEqual(
                (target / "README.md").read_text(encoding="utf-8"),
                "# Existing\n",
            )
        finally:
            if target.exists():
                shutil.rmtree(target)


if __name__ == "__main__":
    unittest.main()
