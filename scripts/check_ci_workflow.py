import importlib.util
import re
from pathlib import Path

try:
    import yaml
except ImportError as error:
    raise SystemExit(
        "scripts/check_ci_workflow.py needs PyYAML. Install it as the tests + checks job does: "
        "python -m pip install pyyaml==6.0.3"
    ) from error


WORKFLOW = Path(".github/workflows/ci.yml")
ARTIFACT_CHECKER = Path("scripts/check_release_artifacts.py")

# The tests + checks job installs the parser in the step right before the contract.
PARSER_INSTALL = "python -m pip install pyyaml==6.0.3"
PARSER_STEP = (
    "      - name: install CI workflow parser\n"
    f"        run: {PARSER_INSTALL}\n"
    "      - name: CI workflow contract\n"
    "        run: python scripts/check_ci_workflow.py\n"
)

# PyYAML reads YAML 1.1, where a bare `on` key is the boolean True.
WORKFLOW_KEYS = ["name", True, "permissions", "jobs"]

# The changes job decides whether the site job runs, and the site job runs the audit. Both are
# pinned as parsed data: every key, every value, and every step in order. A comment line, a quoted
# key, or an added step changes the parsed value, so it fails the contract.
CHANGES_JOB = (
    {'name': 'changed paths',
     'runs-on': 'ubuntu-latest',
     'outputs': {'site': '${{ steps.scope.outputs.site }}'},
     'steps': [{'uses': 'actions/checkout@v7.0.1', 'with': {'fetch-depth': 0}},
               {'name': 'validate dispatched pull request',
                'if': "github.event_name == 'workflow_dispatch'",
                'shell': 'bash',
                'env': {'GH_TOKEN': '${{ github.token }}',
                        'HEAD_SHA': '${{ inputs.head_sha }}',
                        'BASE_SHA': '${{ inputs.base_sha }}',
                        'PR_NUMBER': '${{ inputs.pull_request_number }}'},
                'run': '[[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]]\n'
                       '[[ "$BASE_SHA" =~ ^[0-9a-f]{40}$ ]]\n'
                       '[[ "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]]\n'
                       'test "$GITHUB_SHA" = "$HEAD_SHA"\n'
                       'LIVE_HEAD=$(gh pr view "$PR_NUMBER" --json headRefOid --jq .headRefOid)\n'
                       'LIVE_BASE=$(gh pr view "$PR_NUMBER" --json baseRefOid --jq .baseRefOid)\n'
                       'test "$LIVE_HEAD" = "$HEAD_SHA"\n'
                       'test "$LIVE_BASE" = "$BASE_SHA"\n'},
               {'name': 'detect site inputs',
                'id': 'scope',
                'shell': 'bash',
                'env': {'BASE_SHA': '${{ inputs.base_sha || github.event.pull_request.base.sha || '
                                    'github.event.before }}',
                        'HEAD_SHA': '${{ inputs.head_sha || github.event.pull_request.head.sha || '
                                    'github.sha }}'},
                'run': 'if [ -z "$BASE_SHA" ] || [[ "$BASE_SHA" =~ ^0+$ ]]; then\n'
                       '  echo "site=true" >> "$GITHUB_OUTPUT"\n'
                       '  exit 0\n'
                       'fi\n'
                       '\n'
                       'if ! changed="$(git diff --name-only "$BASE_SHA...$HEAD_SHA")"; then\n'
                       '  echo "site=true" >> "$GITHUB_OUTPUT"\n'
                       '  exit 0\n'
                       'fi\n'
                       '\n'
                       'if printf \'%s\\n\' "$changed" | grep -Eq \\\n'
                       '  '
                       "'^(site/|docs/|README\\.md$|CHANGELOG\\.md$|\\.github/workflows/ci\\.yml$)'; "
                       'then\n'
                       '  echo "site=true" >> "$GITHUB_OUTPUT"\n'
                       'else\n'
                       '  echo "site=false" >> "$GITHUB_OUTPUT"\n'
                       'fi\n'}]}
)
SITE_JOB = (
    {'name': 'site build',
     'needs': 'changes',
     'if': "needs.changes.outputs.site == 'true'",
     'runs-on': 'ubuntu-latest',
     'timeout-minutes': 10,
     'steps': [{'uses': 'actions/checkout@v7.0.1'},
               {'uses': 'actions/setup-node@v7',
                'with': {'node-version': '22',
                         'cache': 'npm',
                         'cache-dependency-path': 'site/package-lock.json'}},
               {'name': 'install', 'run': 'npm ci', 'working-directory': 'site'},
               {'name': 'audit high and critical site dependencies',
                'run': 'node scripts/audit.mjs',
                'working-directory': 'site'},
               {'name': 'site behavior and information architecture tests',
                'run': 'npm run test:site',
                'working-directory': 'site'},
               {'name': 'build (re-syncs docs, then astro build)',
                'run': 'npm run build',
                'working-directory': 'site'},
               {'name': 'verify generated docs are committed',
                'run': 'git diff --exit-code -- \\\n'
                       '  site/src/content/docs \\\n'
                       '  site/public/llms.txt \\\n'
                       '  site/public/llms-full.txt\n'
                       'untracked="$(git ls-files --others --exclude-standard -- \\\n'
                       '  site/src/content/docs \\\n'
                       '  site/public/llms.txt \\\n'
                       '  site/public/llms-full.txt)"\n'
                       'if [ -n "$untracked" ]; then\n'
                       '  echo "Generated documentation contains untracked files:"\n'
                       '  printf \'%s\\n\' "$untracked"\n'
                       '  exit 1\n'
                       'fi\n'},
               {'name': 'check built links and anchors',
                'run': 'npm run test:links',
                'working-directory': 'site'}]}
)

def release_build_commands() -> tuple[str, ...]:
    """One `uv build` line per Python distribution the release checker verifies."""
    spec = importlib.util.spec_from_file_location("release_artifacts", ARTIFACT_CHECKER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(
        f'uv build --out-dir "$artifacts" packages/{package}'
        for package, _ in module.PYTHON_CANDIDATES
    )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"{WORKFLOW}: {message}")


def job_block(text: str, name: str) -> str:
    """Return one top-level job without accepting commands from later jobs."""
    jobs_marker = "\njobs:\n"
    require(jobs_marker in text, "workflow must declare jobs")
    jobs = text[text.index(jobs_marker) + len(jobs_marker) :]
    headers = list(re.finditer(r"(?m)^  ([A-Za-z0-9_-]+):\s*$", jobs))
    matches = [index for index, match in enumerate(headers) if match.group(1) == name]
    require(len(matches) == 1, f"workflow must declare exactly one {name} job")

    index = matches[0]
    start = headers[index].start()
    end = headers[index + 1].start() if index + 1 < len(headers) else len(jobs)
    return jobs[start:end]


class UniqueKeyLoader(yaml.SafeLoader):
    """Read YAML safely, and refuse a mapping that repeats a key, which PyYAML reads as its last value."""

    def construct_mapping(self, node, deep=False):
        keys = [self.construct_object(key, deep=deep) for key, _ in node.value]
        repeated = sorted({str(key) for key in keys if keys.count(key) > 1})
        require(not repeated, f"workflow repeats the mapping key {', '.join(repeated)}")
        return super().construct_mapping(node, deep=deep)


def key_names(mapping) -> str:
    return ", ".join("on" if key is True else str(key) for key in mapping)


def check_parsed(text: str) -> None:
    """Compare the parsed top-level keys and the changes and site jobs with their pins."""
    # Each comparison uses repr, which keeps types and order, so 1 and true, 0 and false, or a
    # reordered mapping differ.
    try:
        workflow = yaml.load(text, Loader=UniqueKeyLoader)
    except yaml.YAMLError as error:
        raise SystemExit(f"{WORKFLOW}: workflow is not valid YAML: {error}") from error
    require(
        isinstance(workflow, dict) and repr(list(workflow)) == repr(WORKFLOW_KEYS),
        "workflow top-level keys must be exactly name, on, permissions, jobs, "
        f"not {key_names(workflow) if isinstance(workflow, dict) else workflow!r}",
    )
    jobs = workflow["jobs"]
    require(isinstance(jobs, dict), "workflow jobs must be a mapping")
    for name, pinned in (("changes", CHANGES_JOB), ("site", SITE_JOB)):
        job = jobs.get(name)
        require(
            isinstance(job, dict) and repr(list(job)) == repr(list(pinned)),
            f"{name} job keys must be exactly {key_names(pinned)}, "
            f"not {key_names(job) if isinstance(job, dict) else job!r}",
        )
        for key, value in pinned.items():
            if key != "steps":
                require(repr(job[key]) == repr(value), f"{name} job {key} must be {value!r}")
        steps = job["steps"]
        require(isinstance(steps, list), f"{name} job steps must be a list")
        for number, (step, pinned_step) in enumerate(zip(steps, pinned["steps"]), start=1):
            require(repr(step) == repr(pinned_step), f"{name} job step {number} must be {pinned_step!r}")
        require(
            len(steps) == len(pinned["steps"]),
            f"{name} job must have exactly {len(pinned['steps'])} steps",
        )


def main() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    changes_job = job_block(text, "changes")
    test_job = job_block(text, "test")
    workbench_job = job_block(text, "workbench")
    workbench_maintained_job = job_block(text, "workbench-maintained")
    governed_job = job_block(text, "governed-platform-proof")
    orientation_job = job_block(text, "orientation-proof")
    review_job = job_block(text, "review")
    site_job = job_block(text, "site")

    require("python scripts/tests/test_hldd.py" in test_job,
            "tests job must exercise the HLDD gate")
    require('python scripts/check_hldd.py --base "$BASE_SHA" --head "$HEAD_SHA"' in test_job,
            "tests job must enforce HLDD review on the explicit commit range")
    require("HEAD_SHA: ${{ inputs.head_sha || github.event.pull_request.head.sha || github.sha }}" in test_job,
            "HLDD review must use the actual PR head, not the synthetic merge")

    runner_install = "python -m pip install pytest packaging"
    first_pytest = "python -m pytest"
    contract_tests = "python scripts/tests/test_ci_workflow.py"
    source_navigation_check = "python -B scripts/check-source-navigation.py --check"
    source_navigation_tests = "python -B scripts/tests/test-source-navigation.py"
    automation_guard = "python scripts/check_repository_automation.py"
    automation_tests = "python scripts/tests/test_repository_automation.py"
    automation_behavior = (
        "python -m pytest scripts/tests/test_update_stats.py "
        "scripts/tests/test_steward_health.py -q"
    )
    artifact_test = "python scripts/tests/test_release_artifacts.py"
    artifact_check = (
        'python scripts/check_release_artifacts.py --repository . --artifacts "$artifacts"'
    )
    parity_tests = "python scripts/tests/test_installed_route_parity.py"
    parity_check = (
        'python scripts/check_installed_route_parity.py "$smoke/venv/bin"'
    )
    parity_characterize = (
        "python scripts/check_installed_route_parity.py --characterize"
        ' "$smoke/venv/bin"'
    )
    windows_parity_check = "python scripts/check_installed_route_parity.py $scripts"
    windows_parity_characterize = (
        "python scripts/check_installed_route_parity.py --characterize $scripts"
    )
    strato_pin = 'assert version("vivary-strato") == "0.1.3"'
    dispatched_base = (
        "${{ inputs.base_sha || github.event.pull_request.base.sha || "
        "github.event.before }}"
    )

    require("workflow_dispatch:" in text, "workflow must accept trusted dispatches")
    for input_name in ("head_sha", "base_sha", "pull_request_number"):
        input_pattern = rf"(?m)^      {input_name}:\s*$[\s\S]*?^        required: true\s*$"
        require(
            re.search(input_pattern, text) is not None,
            f"workflow_dispatch must require {input_name}",
        )
    require(
        "  pull-requests: read" in text,
        "workflow must grant read-only pull-request validation access",
    )
    require(
        'test "$GITHUB_SHA" = "$HEAD_SHA"' in changes_job,
        "dispatch must bind github.sha to inputs.head_sha",
    )
    for validation in (
        'LIVE_HEAD=$(gh pr view "$PR_NUMBER" --json headRefOid --jq .headRefOid)',
        'LIVE_BASE=$(gh pr view "$PR_NUMBER" --json baseRefOid --jq .baseRefOid)',
        'test "$LIVE_HEAD" = "$HEAD_SHA"',
        'test "$LIVE_BASE" = "$BASE_SHA"',
    ):
        require(validation in changes_job, f"dispatch validation must include {validation}")
    for input_name in ("head_sha", "base_sha", "pull_request_number"):
        require(
            f"${{{{ inputs.{input_name} }}}}" in changes_job,
            f"changes job must consume inputs.{input_name}",
        )
    require(
        dispatched_base in changes_job,
        "changed-path detection must use inputs.base_sha for dispatch",
    )
    require(
        dispatched_base in test_job,
        "diff hygiene must use inputs.base_sha for dispatch",
    )
    for name, block in (
        ("test", test_job),
        ("workbench", workbench_job),
        ("workbench-maintained", workbench_maintained_job),
        ("governed-platform-proof", governed_job),
        ("orientation-proof", orientation_job),
        ("review", review_job),
        ("site", site_job),
    ):
        require(
            "    needs: changes" in block,
            f"{name} job must wait for dispatch validation",
        )
    for name, block in (
        ("test", test_job),
        ("workbench", workbench_job),
        ("workbench-maintained", workbench_maintained_job),
    ):
        require(
            "    if: ${{ always() }}" in block,
            f"required {name} job must run even when dispatch validation fails",
        )
        require(
            "if: needs.changes.result != 'success'" in block
            and "run: exit 1" in block,
            f"required {name} job must fail closed when dispatch validation fails",
        )
    maintained_checks = "pnpm --dir packages/workbench test:maintained"
    require(
        text.count(maintained_checks) == 1
        and maintained_checks in workbench_maintained_job,
        f"{maintained_checks} must run exactly once, in the workbench-maintained job",
    )
    require(
        "github.event_name == 'pull_request' || "
        "github.event_name == 'workflow_dispatch'" in review_job,
        "graph review gate must run for pull requests and trusted workflow_dispatch",
    )

    require(runner_install in test_job, "tests job must install pytest and packaging")
    require(first_pytest in test_job, "tests job must run a pytest suite")
    require(
        test_job.index(runner_install) < test_job.index(first_pytest),
        "shared test runner install must precede the first pytest suite",
    )
    require(
        test_job.count(runner_install) == 1,
        "tests job must install the shared test runner exactly once",
    )
    require(
        "python scripts/check_ci_workflow.py" in test_job,
        "tests job must run the CI workflow contract guard",
    )
    require(
        test_job.count(PARSER_STEP) == 1,
        f"tests job must run {PARSER_INSTALL} in the step right before the CI workflow contract",
    )
    require(
        contract_tests in test_job,
        f"tests job must run {contract_tests}",
    )
    require(
        test_job.count(contract_tests) == 1,
        "tests job must run the CI workflow contract regression suite exactly once",
    )
    for command in (source_navigation_check, source_navigation_tests):
        require(command in test_job, f"tests job must run {command}")
        require(
            test_job.count(command) == 1,
            f"tests job must run {command} exactly once",
        )
        require(
            command in governed_job,
            f"governed-platform-proof job must run {command}",
        )
        require(
            governed_job.count(command) == 1,
            f"governed-platform-proof job must run {command} exactly once",
        )
    for command in (automation_guard, automation_tests, automation_behavior):
        require(command in test_job, f"tests job must run {command}")
        require(
            test_job.count(command) == 1,
            f"tests job must run {command} exactly once",
        )
    for command in (
        "python -m pip install uv==0.11.21",
        artifact_test,
        *release_build_commands(),
        'npm pack packages/create-vivary/npm --pack-destination "$artifacts"',
        artifact_check,
    ):
        require(command in test_job, f"tests job must run {command}")
        require(test_job.count(command) == 1, f"tests job must run {command} exactly once")
    require(
        test_job.index(artifact_test) < test_job.index(artifact_check),
        "artifact contract tests must precede the real archive check",
    )
    for command in (parity_tests, parity_check, parity_characterize):
        require(command in test_job, f"tests job must run {command}")
        require(test_job.count(command) == 1, f"tests job must run {command} exactly once")
    require(
        test_job.index(parity_check) < test_job.index(parity_characterize),
        "route parity must precede the installed command surface replay",
    )
    require(
        strato_pin in test_job,
        f"wheelhouse smoke must pin the installed strato version with {strato_pin}",
    )
    for command in (windows_parity_check, windows_parity_characterize):
        require(
            command in governed_job,
            f"governed-platform-proof job must run {command}",
        )
        require(
            governed_job.count(command) == 1,
            f"governed-platform-proof job must run {command} exactly once",
        )
    require(
        governed_job.index(windows_parity_check)
        < governed_job.index(windows_parity_characterize),
        "Windows route parity must precede the installed command surface replay",
    )
    check_parsed(text)

    print(f"{WORKFLOW}: CI workflow contract passed")


if __name__ == "__main__":
    main()
