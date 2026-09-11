"""Retrieve planner context through shipped Tropo using the loop's process owner."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/core"))
from vivary_core.capsule_compile import verify_task_capsule_integrity


class ContextRetrievalError(RuntimeError):
    def __init__(self, reason, evidence):
        super().__init__(reason)
        self.evidence = evidence


def retrieve_planner_context(project, deadline, run_process):
    command = [sys.executable, "-B", str(ROOT / "packages/tropo/tropo.py"),
               "find", "Plan the next development priorities from project requirements and preserve verified behavior.",
               "--governed", "--json", "--root", str(project)]
    environment = {key: os.environ[key] for key in
                   ("PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot") if key in os.environ}
    environment["PYTHONPATH"] = str(ROOT / "packages/core")
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    result = run_process(command, cwd=project, deadline=deadline,
                         environment=environment, max_output_bytes=1024 * 1024)
    evidence = {"command": command, "exit_code": result["returncode"],
                "cleanup_confirmed": result["cleanup_confirmed"],
                "timed_out": result["timed_out"],
                "deadline_error": result.get("deadline_error"),
                "orphaned_descendants": result.get("orphaned_descendants")}
    if result["returncode"] != 0 or result["timed_out"] or not result["cleanup_confirmed"]:
        raise ContextRetrievalError("governed planner retrieval failed", evidence)
    try:
        capsule = json.loads(result["stdout"])
    except (ValueError, TypeError) as exc:
        raise ContextRetrievalError("governed planner retrieval returned invalid JSON", evidence) from exc
    if (not verify_task_capsule_integrity(capsule)
            or capsule["task"]["scope"] != [str(project.resolve())]):
        raise ContextRetrievalError("governed planner capsule binding failed", evidence)
    return capsule, evidence
