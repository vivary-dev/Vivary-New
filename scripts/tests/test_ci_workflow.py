"""Behavior tests for the repository CI workflow contract guard."""

import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GUARD = ROOT / "scripts" / "check_ci_workflow.py"
REAL_WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"


def _load():
    spec = importlib.util.spec_from_file_location("ci_workflow_contract", GUARD)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.WORKFLOW = REAL_WORKFLOW
    return module


def _run(workflow_text=None):
    module = _load()
    if workflow_text is None:
        try:
            module.main()
        except SystemExit as exc:
            return str(exc)
        return None

    with tempfile.TemporaryDirectory() as tmp:
        workflow = Path(tmp) / "ci.yml"
        workflow.write_text(workflow_text, encoding="utf-8")
        module.WORKFLOW = workflow
        try:
            module.main()
        except SystemExit as exc:
            return str(exc)
    return None


RELEASE_BUILD_COMMANDS = _load().release_build_commands()
REAL_TEXT = REAL_WORKFLOW.read_text(encoding="utf-8")
CHANGES_JOB_TEXT = _load().job_block(REAL_TEXT, "changes")
SITE_JOB_TEXT = _load().job_block(REAL_TEXT, "site")


def _workflow(site_job: str = SITE_JOB_TEXT, trailing_job: str = "") -> str:
    return (
        "name: ci\n"
        "on:\n"
        "  workflow_dispatch:\n"
        "    inputs:\n"
        "      head_sha:\n"
        "        required: true\n"
        "      base_sha:\n"
        "        required: true\n"
        "      pull_request_number:\n"
        "        required: true\n"
        "permissions:\n"
        "  contents: read\n"
        "  pull-requests: read\n"
        "jobs:\n"
        f"{CHANGES_JOB_TEXT}"
        "  test:\n"
        "    needs: changes\n"
        "    if: ${{ always() }}\n"
        "    steps:\n"
        "      - name: require changed-path and dispatch validation\n"
        "        if: needs.changes.result != 'success'\n"
        "        run: exit 1\n"
        "      - name: high-level design review\n"
        "        env:\n"
        "          BASE_SHA: ${{ inputs.base_sha || github.event.pull_request.base.sha || github.event.before }}\n"
        "          HEAD_SHA: ${{ inputs.head_sha || github.event.pull_request.head.sha || github.sha }}\n"
        "        run: |\n"
        "          python scripts/tests/test_hldd.py\n"
        "          python scripts/check_hldd.py --base \"$BASE_SHA\" --head \"$HEAD_SHA\"\n"
        "      - name: install Python test runner\n"
        "        run: python -m pip install pytest packaging\n"
        "      - name: install CI workflow parser\n"
        "        run: python -m pip install pyyaml==6.0.3\n"
        "      - name: CI workflow contract\n"
        "        run: python scripts/check_ci_workflow.py\n"
        "      - name: CI workflow contract tests\n"
        "        run: python scripts/tests/test_ci_workflow.py\n"
        "      - name: source navigation contract\n"
        "        run: python -B scripts/check-source-navigation.py --check\n"
        "      - name: source navigation contract tests\n"
        "        run: python -B scripts/tests/test-source-navigation.py\n"
        "      - name: repository automation contract\n"
        "        run: python scripts/check_repository_automation.py\n"
        "      - name: repository automation contract tests\n"
        "        run: python scripts/tests/test_repository_automation.py\n"
        "      - name: repository automation behavior tests\n"
        "        run: python -m pytest scripts/tests/test_update_stats.py scripts/tests/test_steward_health.py -q\n"
        "      - name: install release build frontend\n"
        "        run: python -m pip install uv==0.11.21\n"
        "      - name: release artifact contract tests\n"
        "        run: python scripts/tests/test_release_artifacts.py\n"
        "      - name: release artifact license contract\n"
        "        run: |\n"
        "          artifacts=\"$(mktemp -d)\"\n"
        + "".join(f"          {command}\n" for command in RELEASE_BUILD_COMMANDS)
        + "          npm pack packages/create-vivary/npm --pack-destination \"$artifacts\"\n"
        "          python scripts/check_release_artifacts.py --repository . --artifacts \"$artifacts\"\n"
        "      - name: installed route parity contract tests\n"
        "        run: python scripts/tests/test_installed_route_parity.py\n"
        "      - name: core\n"
        "        run: python -m pytest packages/core/tests/ -q\n"
        "      - name: wheelhouse smoke\n"
        "        run: |\n"
        "          assert version(\"vivary-strato\") == \"0.1.3\"\n"
        "      - name: packaged front door smoke\n"
        "        run: python scripts/check_installed_route_parity.py \"$smoke/venv/bin\"\n"
        "      - name: installed command surface\n"
        "        run: python scripts/check_installed_route_parity.py --characterize \"$smoke/venv/bin\"\n"
        "      - name: diff hygiene\n"
        "        env:\n"
        "          BASE_SHA: ${{ inputs.base_sha || github.event.pull_request.base.sha || github.event.before }}\n"
        "        run: git diff --check \"$BASE_SHA...HEAD\"\n"
        "\n"
        "  workbench:\n"
        "    needs: changes\n"
        "    if: ${{ always() }}\n"
        "    steps:\n"
        "      - name: require changed-path and dispatch validation\n"
        "        if: needs.changes.result != 'success'\n"
        "        run: exit 1\n"
        "\n"
        "  workbench-maintained:\n"
        "    needs: changes\n"
        "    if: ${{ always() }}\n"
        "    steps:\n"
        "      - name: require changed-path and dispatch validation\n"
        "        if: needs.changes.result != 'success'\n"
        "        run: exit 1\n"
        "      - name: maintained workbench checks\n"
        f"        run: {MAINTAINED_CHECKS_COMMAND}\n"
        "\n"
        "  governed-platform-proof:\n"
        "    needs: changes\n"
        "    steps:\n"
        "      - name: source navigation contract on Windows\n"
        f"        run: {SOURCE_NAVIGATION_CHECK_COMMAND}\n"
        "      - name: source navigation contract tests on Windows\n"
        f"        run: {SOURCE_NAVIGATION_TEST_COMMAND}\n"
        "      - name: installed-wheel capability surface\n"
        "        shell: pwsh\n"
        "        run: |\n"
        f"          {WINDOWS_PARITY_CHECK_COMMAND}\n"
        "          if ($LASTEXITCODE -ne 0) { throw \"installed route parity failed\" }\n"
        f"          {WINDOWS_PARITY_CHARACTERIZE_COMMAND}\n"
        "          if ($LASTEXITCODE -ne 0) { throw \"installed command surface failed\" }\n"
        "\n"
        "  orientation-proof:\n"
        "    needs: changes\n"
        "    steps: []\n"
        "\n"
        "  review:\n"
        "    needs: changes\n"
        "    if: github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'\n"
        "    steps: []\n"
        "\n"
        f"{site_job}"
        f"{trailing_job}"
    )


INSTALL_STEP = (
    "      - name: install\n"
    "        run: npm ci\n"
    "        working-directory: site\n"
)
AUDIT_STEP = (
    "      - name: audit high and critical site dependencies\n"
    "        run: node scripts/audit.mjs\n"
    "        working-directory: site\n"
)
SITE_TESTS_STEP = (
    "      - name: site behavior and information architecture tests\n"
    "        run: npm run test:site\n"
    "        working-directory: site\n"
)
CONTRACT_TEST_COMMAND = "python scripts/tests/test_ci_workflow.py"
SOURCE_NAVIGATION_CHECK_COMMAND = "python -B scripts/check-source-navigation.py --check"
SOURCE_NAVIGATION_TEST_COMMAND = "python -B scripts/tests/test-source-navigation.py"
AUTOMATION_GUARD_COMMAND = "python scripts/check_repository_automation.py"
AUTOMATION_TEST_COMMAND = "python scripts/tests/test_repository_automation.py"
AUTOMATION_BEHAVIOR_COMMAND = (
    "python -m pytest scripts/tests/test_update_stats.py "
    "scripts/tests/test_steward_health.py -q"
)
ARTIFACT_TEST_COMMAND = "python scripts/tests/test_release_artifacts.py"
ARTIFACT_CHECK_COMMAND = (
    'python scripts/check_release_artifacts.py --repository . --artifacts "$artifacts"'
)
PARITY_TEST_COMMAND = "python scripts/tests/test_installed_route_parity.py"
PARITY_CHECK_COMMAND = (
    'python scripts/check_installed_route_parity.py "$smoke/venv/bin"'
)
PARITY_CHARACTERIZE_COMMAND = (
    'python scripts/check_installed_route_parity.py --characterize "$smoke/venv/bin"'
)
WINDOWS_PARITY_CHECK_COMMAND = "python scripts/check_installed_route_parity.py $scripts"
WINDOWS_PARITY_CHARACTERIZE_COMMAND = (
    "python scripts/check_installed_route_parity.py --characterize $scripts"
)
STRATO_PIN = 'assert version("vivary-strato") == "0.1.3"'
MAINTAINED_CHECKS_COMMAND = "pnpm --dir packages/workbench test:maintained"


def test_real_workflow_passes_and_is_not_modified():
    before = REAL_WORKFLOW.read_bytes()
    assert _run() is None
    assert REAL_WORKFLOW.read_bytes() == before


def test_ci_contract_regression_suite_must_run():
    workflow = _workflow().replace(
        CONTRACT_TEST_COMMAND,
        "echo contract tests skipped",
    )
    message = _run(workflow)
    assert message, "CI must execute the contract's negative regression suite"
    assert CONTRACT_TEST_COMMAND in message


def test_source_navigation_contract_must_run():
    workflow = _workflow().replace(
        SOURCE_NAVIGATION_CHECK_COMMAND,
        "echo source navigation check skipped",
        1,
    )
    message = _run(workflow)
    assert message, "CI must execute the source-navigation checker"
    assert SOURCE_NAVIGATION_CHECK_COMMAND in message


def test_source_navigation_regressions_must_run():
    workflow = _workflow().replace(
        SOURCE_NAVIGATION_TEST_COMMAND,
        "echo source navigation tests skipped",
        1,
    )
    message = _run(workflow)
    assert message, "CI must execute the source-navigation regression suite"
    assert SOURCE_NAVIGATION_TEST_COMMAND in message


def _without_governed_command(workflow: str, command: str) -> str:
    marker = "  governed-platform-proof:\n"
    before, governed_and_later = workflow.split(marker, 1)
    return before + marker + governed_and_later.replace(command, "echo skipped", 1)


def test_windows_governed_job_must_run_source_navigation_contract():
    workflow = _without_governed_command(
        _workflow(),
        SOURCE_NAVIGATION_CHECK_COMMAND,
    )
    message = _run(workflow)
    assert message, "the Windows job must execute the source-navigation checker"
    assert SOURCE_NAVIGATION_CHECK_COMMAND in message


def test_windows_governed_job_must_run_source_navigation_regressions():
    workflow = _without_governed_command(
        _workflow(),
        SOURCE_NAVIGATION_TEST_COMMAND,
    )
    message = _run(workflow)
    assert message, "the Windows job must execute the source-navigation regression suite"
    assert SOURCE_NAVIGATION_TEST_COMMAND in message


def test_repository_automation_guard_and_regressions_must_run():
    for command in (AUTOMATION_GUARD_COMMAND, AUTOMATION_TEST_COMMAND):
        workflow = _workflow().replace(command, "echo skipped")
        message = _run(workflow)
        assert message, f"CI must execute {command}"
        assert command in message


def test_repository_automation_behavior_tests_must_run():
    workflow = _workflow().replace(
        AUTOMATION_BEHAVIOR_COMMAND,
        "echo behavior tests skipped",
    )
    message = _run(workflow)
    assert message
    assert "test_update_stats.py" in message


def test_release_artifact_contract_and_real_archives_must_run():
    workflow = _workflow()
    for command in (
        "python -m pip install uv==0.11.21",
        ARTIFACT_TEST_COMMAND,
        *RELEASE_BUILD_COMMANDS,
        'npm pack packages/create-vivary/npm --pack-destination "$artifacts"',
        ARTIFACT_CHECK_COMMAND,
    ):
        message = _run(workflow.replace(command, "echo artifact proof skipped", 1))
        assert message, f"CI must execute {command}"
        assert command in message


def test_installed_route_parity_proofs_must_run():
    workflow = _workflow()
    for command in (
        PARITY_TEST_COMMAND,
        PARITY_CHECK_COMMAND,
        PARITY_CHARACTERIZE_COMMAND,
    ):
        message = _run(workflow.replace(command, "echo parity proof skipped", 1))
        assert message, f"CI must execute {command}"
        assert command in message


def test_installed_command_surface_must_follow_route_parity():
    reordered = _workflow().replace(
        "      - name: packaged front door smoke\n"
        f"        run: {PARITY_CHECK_COMMAND}\n"
        "      - name: installed command surface\n"
        f"        run: {PARITY_CHARACTERIZE_COMMAND}\n",
        "      - name: installed command surface\n"
        f"        run: {PARITY_CHARACTERIZE_COMMAND}\n"
        "      - name: packaged front door smoke\n"
        f"        run: {PARITY_CHECK_COMMAND}\n",
        1,
    )
    message = _run(reordered)
    assert message, "replaying the surface before proving route parity must fail"
    assert "must precede" in message


def test_windows_governed_job_must_prove_installed_route_parity():
    workflow = _workflow()
    for command in (
        WINDOWS_PARITY_CHECK_COMMAND,
        WINDOWS_PARITY_CHARACTERIZE_COMMAND,
    ):
        message = _run(workflow.replace(command, "echo windows proof skipped", 1))
        assert message, f"the Windows job must execute {command}"
        assert command in message


def test_windows_command_surface_must_follow_route_parity():
    reordered = _workflow().replace(
        f"          {WINDOWS_PARITY_CHECK_COMMAND}\n"
        "          if ($LASTEXITCODE -ne 0) { throw \"installed route parity failed\" }\n"
        f"          {WINDOWS_PARITY_CHARACTERIZE_COMMAND}\n",
        f"          {WINDOWS_PARITY_CHARACTERIZE_COMMAND}\n"
        "          if ($LASTEXITCODE -ne 0) { throw \"installed route parity failed\" }\n"
        f"          {WINDOWS_PARITY_CHECK_COMMAND}\n",
        1,
    )
    message = _run(reordered)
    assert message, "replaying the Windows surface before proving parity must fail"
    assert "must precede" in message


def test_wheelhouse_smoke_must_pin_the_installed_strato_version():
    workflow = _workflow().replace(STRATO_PIN, "assert True", 1)
    message = _run(workflow)
    assert message, "the wheelhouse smoke must pin every routed component version"
    assert "vivary-strato" in message


def _site_job_with(old: str, new: str) -> str:
    """Return the real site job with one exact edit."""
    assert SITE_JOB_TEXT.count(old) == 1, old
    return SITE_JOB_TEXT.replace(old, new, 1)


def test_missing_site_audit_gate_fails():
    message = _run(_workflow(_site_job_with(AUDIT_STEP, "")))
    assert message, "a workflow without the blocking audit must fail"
    assert "site job step 3" in message and "node scripts/audit.mjs" in message


def test_site_audit_must_precede_install():
    message = _run(_workflow(_site_job_with(AUDIT_STEP + INSTALL_STEP, INSTALL_STEP + AUDIT_STEP)))
    assert message, "auditing after npm ci lets install scripts run first, so it must fail"
    assert "site job step 3" in message and "node scripts/audit.mjs" in message


def test_site_audit_must_run_in_site_directory():
    wrong_directory = AUDIT_STEP.replace("working-directory: site", "working-directory: .")
    message = _run(_workflow(_site_job_with(AUDIT_STEP, wrong_directory)))
    assert message, "auditing the repository root must fail"
    assert "site job step 3" in message and "'working-directory': 'site'" in message


def test_site_audit_in_later_job_does_not_satisfy_contract():
    later_job = "\n  release:\n    steps:\n" + AUDIT_STEP
    message = _run(_workflow(_site_job_with(AUDIT_STEP, ""), later_job))
    assert message, "an audit in another job must not satisfy the site contract"
    assert "node scripts/audit.mjs" in message


def test_dispatch_requires_all_exact_context_inputs():
    workflow = _workflow().replace(
        "      head_sha:\n        required: true\n",
        "",
    )
    message = _run(workflow)
    assert message, "dispatch must bind a required head SHA"
    assert "head_sha" in message


def test_dispatch_must_validate_live_pr_head_and_base():
    workflow = _workflow().replace(
        'LIVE_HEAD=$(gh pr view "$PR_NUMBER" --json headRefOid --jq .headRefOid)',
        'echo "validation skipped"',
    )
    message = _run(workflow)
    assert message, "dispatch must validate the named PR against live GitHub state"
    assert "headRefOid" in message


def test_dispatch_must_compare_live_head_and_base_to_inputs():
    workflow = _workflow()
    for comparison in (
        'test "$LIVE_HEAD" = "$HEAD_SHA"',
        'test "$LIVE_BASE" = "$BASE_SHA"',
    ):
        message = _run(workflow.replace(comparison, "echo comparison skipped", 1))
        assert message, "reading live PR metadata without comparing it is not validation"
        assert comparison in message


def test_required_check_must_fail_closed_when_dispatch_validation_fails():
    workflow = _workflow()
    for contract in (
        "    if: ${{ always() }}\n",
        "        if: needs.changes.result != 'success'\n",
        "        run: exit 1\n",
    ):
        message = _run(workflow.replace(contract, "", 1))
        assert message, "a validation failure must reach a required failing check"
        assert "must" in message.lower()


def test_dispatch_base_sha_must_reach_diff_hygiene():
    workflow = _workflow().replace(
        "${{ inputs.base_sha || github.event.pull_request.base.sha || github.event.before }}",
        "${{ github.event.pull_request.base.sha || github.event.before }}",
    )
    message = _run(workflow)
    assert message, "dispatch must check the exact PR base range"
    assert "inputs.base_sha" in message


def test_dispatch_must_run_graph_review_gate():
    workflow = _workflow().replace(
        "github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'",
        "github.event_name == 'pull_request'",
    )
    message = _run(workflow)
    assert message, "validated dispatches must retain the graph review gate"
    assert "workflow_dispatch" in message


def test_workbench_jobs_must_wait_for_dispatch_validation():
    for job in ("workbench", "workbench-maintained"):
        workflow = _workflow().replace(
            f"  {job}:\n    needs: changes\n",
            f"  {job}:\n",
            1,
        )
        message = _run(workflow)
        assert message, f"the {job} job must wait for dispatch validation"
        assert f"{job} job must wait" in message


def test_maintained_workbench_checks_must_run_once_in_their_own_job():
    workflow = _workflow()
    step = (
        "      - name: maintained workbench checks\n"
        f"        run: {MAINTAINED_CHECKS_COMMAND}\n"
    )
    duplicated_in_tests = workflow.replace(
        "      - name: diff hygiene\n",
        step + "      - name: diff hygiene\n",
        1,
    )
    in_workbench_job = workflow.replace(step, "").replace(
        "\n  workbench-maintained:\n",
        step + "\n  workbench-maintained:\n",
        1,
    )
    skipped = workflow.replace(MAINTAINED_CHECKS_COMMAND, "echo skipped")
    for variant in (duplicated_in_tests, in_workbench_job, skipped):
        message = _run(variant)
        assert message, "maintained checks must run once, in their own job"
        assert MAINTAINED_CHECKS_COMMAND in message


def test_hldd_gate_and_regressions_must_run():
    workflow = _workflow()
    for command in (
        "python scripts/tests/test_hldd.py",
        'python scripts/check_hldd.py --base "$BASE_SHA" --head "$HEAD_SHA"',
    ):
        message = _run(workflow.replace(command, "echo skipped", 1))
        assert message and "HLDD" in message


def test_hldd_must_use_the_actual_pr_head():
    workflow = _workflow().replace(
        "HEAD_SHA: ${{ inputs.head_sha || github.event.pull_request.head.sha || github.sha }}",
        "HEAD_SHA: ${{ github.sha }}",
    )
    message = _run(workflow)
    assert message and "actual PR head" in message


def test_minimal_workflow_passes():
    assert _run(_workflow()) is None


def test_site_audit_step_must_have_no_other_keys():
    for changed in (
        AUDIT_STEP + "        continue-on-error: true\n",
        AUDIT_STEP.replace("        run:", "        if: false\n        run:", 1),
        AUDIT_STEP + "        shell: true {0}\n",
        AUDIT_STEP + "        env:\n          NODE_OPTIONS: --import ./skip.mjs\n",
        AUDIT_STEP.replace("node scripts/audit.mjs", "node scripts/audit.mjs || true", 1),
        AUDIT_STEP + "      # triage pending\n        if: ${{ false }}\n",
        AUDIT_STEP + '        "if": false\n',
    ):
        message = _run(_workflow(_site_job_with(AUDIT_STEP, changed)))
        assert message, f"a changed audit step must fail: {changed!r}"
        assert "site job step 3" in message


def test_site_job_must_not_continue_on_error():
    for job in (
        _site_job_with("    timeout-minutes: 10\n", "    timeout-minutes: 10\n    continue-on-error: true\n"),
        SITE_JOB_TEXT + '    "continue\\x2Don-error": true\n',
    ):
        message = _run(_workflow(job))
        assert message, "a site job that continues on error must fail"
        assert "site job keys" in message


def test_site_tests_step_must_run():
    for job in (
        _site_job_with(SITE_TESTS_STEP, ""),
        _site_job_with(SITE_TESTS_STEP, SITE_TESTS_STEP + "        if: false\n"),
    ):
        message = _run(_workflow(job))
        assert message, "a site job without its site test step must fail"
        assert "site job step 5" in message


def test_site_job_header_must_stay_pinned():
    for old, new in (
        ("    if: needs.changes.outputs.site == 'true'\n", "    if: false\n"),
        ("    runs-on: ubuntu-latest\n", "    runs-on: self-hosted\n"),
        ("    timeout-minutes: 10\n", "    timeout-minutes: 10.0\n"),
        ("    needs: changes\n", "    needs: [changes, review]\n"),
        ("    timeout-minutes: 10\n", "    timeout-minutes: 10\n    env:\n      NODE_OPTIONS: --import ./x.mjs\n"),
        ("    timeout-minutes: 10\n", "    timeout-minutes: 10\n    defaults:\n      run:\n        shell: true {0}\n"),
        ("    timeout-minutes: 10\n", "    timeout-minutes: 10\n    container: node:22\n"),
        ("    timeout-minutes: 10\n", "    timeout-minutes: 10\n    services:\n      cache:\n        image: redis\n"),
    ):
        message = _run(_workflow(_site_job_with(old, new)))
        assert message, f"a changed site job header must fail: {new!r}"
        assert "site job" in message


def test_site_job_must_not_add_keys_after_its_steps():
    for trailing in (
        "    env:\n      NODE_OPTIONS: --import ./x.mjs\n",
        '    "env":\n      NODE_OPTIONS: --import ./x.mjs\n',
        "    env :\n      NODE_OPTIONS: --import ./x.mjs\n",
    ):
        message = _run(_workflow(SITE_JOB_TEXT + trailing))
        assert message, f"a site job key after its steps must fail: {trailing!r}"
        assert "site job keys" in message


def test_site_job_must_not_gain_a_step():
    prepare = '      - name: prepare\n        run: echo "NODE_OPTIONS=--import ./x.mjs" >> "$GITHUB_ENV"\n'
    for job, expected in (
        (_site_job_with(AUDIT_STEP, prepare + AUDIT_STEP), "site job step 3"),
        (SITE_JOB_TEXT + prepare, "site job must have exactly 8 steps"),
    ):
        message = _run(_workflow(job))
        assert message, "an added site step must fail"
        assert expected in message


def test_site_path_filter_must_stay_pinned():
    for old, new, expected in (
        ("'^(site/|docs/|", "'^(site/|", "changes job step 3"),
        ("        id: scope\n", "        id: other\n", "changes job step 3"),
        ("      site: ${{ steps.scope.outputs.site }}\n", "      site: 'false'\n", "changes job outputs"),
        (
            "      - name: detect site inputs\n",
            '      - name: prepare\n        run: echo /tmp/fake >> "$GITHUB_PATH"\n      - name: detect site inputs\n',
            "changes job step 3",
        ),
        (
            '            echo "site=false" >> "$GITHUB_OUTPUT"\n          fi\n',
            '            echo "site=false" >> "$GITHUB_OUTPUT"\n          fi\n      # skip\n        if: false\n',
            "changes job step 3",
        ),
    ):
        workflow = _workflow()
        assert workflow.count(old) == 1, old
        message = _run(workflow.replace(old, new, 1))
        assert message, f"a changed site path filter must fail: {new!r}"
        assert expected in message


def test_workflow_top_level_keys_must_stay_pinned():
    for workflow in (
        _workflow().replace("jobs:\n", "env:\n  NODE_OPTIONS: --import ./x.mjs\njobs:\n", 1),
        _workflow().replace("jobs:\n", '"env":\n  NODE_OPTIONS: --import ./x.mjs\njobs:\n', 1),
        _workflow(trailing_job="env:\n  NODE_OPTIONS: --import ./x.mjs\n"),
        _workflow(trailing_job="defaults:\n  run:\n    shell: bash\n"),
    ):
        message = _run(workflow)
        assert message, "a top-level env or defaults block must fail"
        assert "top-level keys" in message


def test_workflow_must_not_repeat_a_key():
    for trailing, key in (
        ("permissions:\n  contents: write\n", "permissions"),
        ("    if: false\n", "if"),
    ):
        message = _run(_workflow(trailing_job=trailing))
        assert message, f"a repeated {key} key must fail"
        assert f"repeats the mapping key {key}" in message


def test_workflow_parser_install_must_precede_the_contract():
    workflow = _workflow()
    parser = "      - name: install CI workflow parser\n        run: python -m pip install pyyaml==6.0.3\n"
    assert workflow.count(parser) == 1
    for changed in (
        workflow.replace(parser, "", 1),
        workflow.replace(parser, parser.replace("pyyaml==6.0.3", "pyyaml"), 1),
        workflow.replace(parser, "", 1).replace(
            "      - name: CI workflow contract tests\n",
            parser + "      - name: CI workflow contract tests\n",
            1,
        ),
    ):
        message = _run(changed)
        assert message, "the contract must follow the pinned parser install"
        assert "python -m pip install pyyaml==6.0.3" in message


def test_contract_without_its_parser_names_the_pinned_install():
    probe = "import runpy, sys\nsys.modules['yaml'] = None\nrunpy.run_path(sys.argv[1], run_name='__main__')\n"
    result = subprocess.run(
        [sys.executable, "-c", probe, str(GUARD)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "python -m pip install pyyaml==6.0.3" in result.stderr


def test_invalid_yaml_fails_closed():
    message = _run(_workflow(trailing_job="  broken: [unclosed\n"))
    assert message, "a workflow that does not parse must fail"
    assert "not valid YAML" in message


def test_merge_keys_fail_closed():
    for workflow in (
        _workflow(_site_job_with(AUDIT_STEP, AUDIT_STEP + "        <<: {shell: 'true {0}'}\n")),
        _workflow(SITE_JOB_TEXT + "    <<: {}\n"),
        _workflow().replace("permissions:\n", "<<: {env: {NODE_OPTIONS: x}}\npermissions:\n", 1),
    ):
        message = _run(workflow)
        assert message, "a merge key must fail"
        assert "must not use a YAML merge key" in message


def test_pinned_actions_accept_only_a_release_bump():
    bumps = (
        ("actions/checkout@v7.0.1", "actions/checkout@v7.0.2"),
        ("actions/setup-node@v7", "actions/setup-node@v7.1.0"),
        ("actions/checkout@v7.0.1", "actions/checkout@" + "0123456789abcdef" * 2 + "01234567"),
    )
    for old, new in bumps:
        assert REAL_TEXT.count(old) > 1, old
        assert _run(REAL_TEXT.replace(old, new)) is None, f"a Dependabot bump to {new} must pass"
    for old, new in (
        ("actions/checkout@v7.0.1", "actions/checkout@main"),
        ("actions/checkout@v7.0.1", "someone/checkout@v7.0.1"),
        ("actions/setup-node@v7", "actions/checkout@v7.0.2"),
        ("actions/setup-node@v7", "actions/setup-node@v8"),
        ("actions/checkout@v7.0.1", "actions/checkout@v7.0.2\n        with:\n          ref: main"),
    ):
        message = _run(_workflow(_site_job_with(f"uses: {old}\n", f"uses: {new}\n")))
        assert message, f"{new!r} must fail"
        assert "site job step" in message

if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    passed = 0
    for test in tests:
        try:
            test()
            print(f"  ok  {test.__name__}")
            passed += 1
        except Exception as exc:
            print(f"FAIL  {test.__name__}: {exc}")
    print(f"\n{passed}/{len(tests)} passed")
    sys.exit(0 if passed == len(tests) else 1)
