"""Exercise HLDD enforcement with real disposable Git indexes and commits."""

from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2]
HEADINGS = (
    "Purpose and owner intent", "Success criteria", "System structure",
    "Runtime flows", "Data and trust boundaries", "Delivery and known gaps",
    "Maintaining this document", "Last change review",
)
DOC = "# Vivary high-level design\n\n" + "\n\n".join(
    f"## {heading}\n\nExisting description of {heading.lower()}." for heading in HEADINGS
)


class HlddGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="vivary-hldd-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull}
        for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"):
            self.env.pop(name, None)
        self.git("init", "-q")
        self.git("config", "user.name", "HLDD test")
        self.git("config", "user.email", "hldd@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        for filename in ("check_hldd.py", "pre-commit-hldd.sh"):
            self.write("scripts/" + filename, (SOURCE / "scripts" / filename).read_text())
        self.write("docs/ARCHITECTURE.md", "# Original CLI design\n")
        self.write("packages/example/app.py", "value = 0\n")
        self.git("add", "docs/ARCHITECTURE.md", "packages/example/app.py")
        self.git("commit", "-qm", "legacy baseline")
        self.legacy = self.git("rev-parse", "HEAD").stdout.strip()
        self.write("packages/example/app.py", "value = 1\n")
        self.git("add", "packages/example/app.py")
        self.git("commit", "-qm", "historical source change before gate adoption")
        self.write("docs/ARCHITECTURE.md", DOC)
        self.git("add", ".")
        self.git("commit", "-qm", "initial")
        self.base = self.git("rev-parse", "HEAD").stdout.strip()

    def run_command(self, *args):
        return subprocess.run(args, cwd=self.root, env=self.env, capture_output=True, text=True)

    def git(self, *args):
        result = self.run_command("git", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def gate(self, *args, success=True):
        result = self.run_command(sys.executable, "scripts/check_hldd.py", *args)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8", newline="\n")

    def stage_code(self):
        self.write("packages/example/app.py", "value = 2\n")
        self.git("add", "packages/example/app.py")

    def test_code_requires_staged_design_review(self):
        self.stage_code()
        self.gate("--staged", success=False)
        self.write("docs/ARCHITECTURE.md", DOC + "\nThe app now uses value two.\n")
        self.gate("--staged", success=False)
        self.git("add", "docs/ARCHITECTURE.md")
        self.gate("--staged")

    def test_whitespace_comments_and_date_only_changes_do_not_count(self):
        self.stage_code()
        self.write("docs/ARCHITECTURE.md", DOC + "\n\n2026-09-25\n<!-- reviewed -->\n")
        self.git("add", "docs/ARCHITECTURE.md")
        self.gate("--staged", success=False)

    def test_markdown_wrappers_do_not_make_date_only_reviews_substantive(self):
        self.stage_code()
        for update in ("- 2026-09-25", "**2026-09-25**", "_2026-09-25_", "`2026-09-25`", "> 2026-09-25"):
            with self.subTest(update=update):
                self.write("docs/ARCHITECTURE.md", DOC + "\n" + update + "\n")
                self.git("add", "docs/ARCHITECTURE.md")
                self.gate("--staged", success=False)
        self.git("commit", "-qm", "date-only review bypassing local hook")
        self.gate("--base", self.base, success=False)

    def test_required_headings_in_comments_or_fences_do_not_count(self):
        section = "## Data and trust boundaries\n\nExisting description of data and trust boundaries."
        for opening, closing in (("<!--", "-->"), ("```markdown", "```"), ("~~~markdown", "~~~")):
            with self.subTest(opening=opening):
                replacement = opening + "\n" + section + "\n" + closing
                self.write("docs/ARCHITECTURE.md", DOC.replace(section, replacement))
                self.git("add", "docs/ARCHITECTURE.md")
                self.gate("--staged", success=False)

    def test_test_only_change_does_not_require_design_churn(self):
        self.write("packages/example/tests/test_app.py", "assert True\n")
        self.git("add", "packages/example/tests/test_app.py")
        self.gate("--staged")

    def test_missing_required_section_is_rejected(self):
        self.write("docs/ARCHITECTURE.md", DOC.replace("## Data and trust boundaries", "## Notes"))
        self.git("add", "docs/ARCHITECTURE.md")
        self.gate("--staged", success=False)

    def test_deleting_source_requires_review(self):
        self.git("rm", "packages/example/app.py")
        self.gate("--staged", success=False)

    def test_ci_catches_undocumented_later_commit_after_documented_change(self):
        self.stage_code()
        self.write("docs/ARCHITECTURE.md", DOC + "\nThe app now uses value two.\n")
        self.git("add", "docs/ARCHITECTURE.md")
        self.git("commit", "-qm", "documented change")
        self.gate("--base", self.base, "--head", "HEAD")
        self.write("packages/example/app.py", "value = 3\n")
        self.git("add", "packages/example/app.py")
        self.git("commit", "-qm", "undocumented follow-up")
        self.gate("--base", self.base, "--head", "HEAD", success=False)

    def test_invalid_base_fails_instead_of_skipping(self):
        self.gate("--base", "missing-ref", success=False)

    def test_hook_install_is_idempotent_and_preserves_entire_hook(self):
        hooks = self.root / ".git/hooks"
        sentinel = hooks / "commit-msg"
        sentinel.write_bytes(b"#!/bin/sh\n# existing Entire hook\nexit 0\n")
        self.gate("--install-hook")
        original = (hooks / "pre-commit").read_bytes()
        self.gate("--install-hook")
        self.assertEqual(original, (hooks / "pre-commit").read_bytes())
        self.assertEqual(sentinel.read_bytes(), b"#!/bin/sh\n# existing Entire hook\nexit 0\n")
        self.stage_code()
        result = self.run_command("git", "commit", "-qm", "must fail")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("HLDD review missing", result.stderr)
        self.write("docs/ARCHITECTURE.md", DOC + "\nThe app now uses value two.\n")
        self.git("add", "docs/ARCHITECTURE.md")
        self.git("commit", "-qm", "documented change")
        self.gate("--base", self.base)

    def test_historical_commits_before_gate_adoption_remain_promotable(self):
        self.gate("--base", self.legacy)

    def test_ci_inspects_commits_merged_from_a_side_branch(self):
        self.git("switch", "-qc", "side")
        self.stage_code()
        self.git("commit", "-qm", "undocumented side change")
        self.write("docs/ARCHITECTURE.md", DOC + "\nThe app now uses value two.\n")
        self.git("add", "docs/ARCHITECTURE.md")
        self.git("commit", "-qm", "late design update")
        self.git("switch", "-qc", "integration", self.base)
        self.git("merge", "--no-ff", "side", "-m", "merge side branch")
        self.gate("--base", self.base, success=False)

    def test_site_tools_and_root_documents_require_review(self):
        for filename in ("tools/hoh/workflow.py", "site/astro.config.mjs", "README.md", "SECURITY.md"):
            with self.subTest(filename=filename):
                self.write(filename, "Changed maintained source or contract.\n")
                self.git("add", filename)
                self.gate("--staged", success=False)
                self.git("reset", "-q", "HEAD", "--", filename)

    def test_removing_checker_does_not_disable_ci(self):
        original = (self.root / "scripts/check_hldd.py").read_text()
        self.git("rm", "scripts/check_hldd.py")
        self.write("docs/ARCHITECTURE.md", DOC + "\nAttempted maintenance removal.\n")
        self.git("add", "docs/ARCHITECTURE.md")
        self.git("commit", "-qm", "remove checker")
        self.write("scripts/check_hldd.py", original)
        self.gate("--base", self.base, success=False)

    def test_existing_hook_or_hook_manager_is_not_replaced(self):
        hook = self.root / ".git/hooks/pre-commit"
        hook.write_bytes(b"#!/bin/sh\nexit 42\n")
        self.gate("--install-hook", success=False)
        self.assertEqual(hook.read_bytes(), b"#!/bin/sh\nexit 42\n")
        self.git("config", "core.hooksPath", "custom-hooks")
        self.gate("--install-hook", success=False)
        self.assertFalse((self.root / "custom-hooks").exists())


if __name__ == "__main__":
    unittest.main()
