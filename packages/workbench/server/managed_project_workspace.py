"""Bounded server bridge to create-vivary's exact thin workspace operations."""
import hashlib
import json
import os
import stat
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "create-vivary"))
import create_vivary


def _bind_plan_target(plan, target):
    rebound = {**plan, "target": str(target)}
    body = {key: value for key, value in rebound.items() if key != "plan_sha256"}
    raw = json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
    return {**rebound, "plan_sha256": "sha256:" + hashlib.sha256(raw).hexdigest()}


def _matches_exact_inventory(target, files):
    expected_files = {row["path"] for row in files}
    expected_dirs = {
        str(parent).replace(os.sep, "/")
        for path in expected_files
        for parent in Path(path).parents
        if str(parent) != "."
    }
    observed_files = set()
    observed_dirs = set()
    pending = [(target, Path())]
    while pending:
        directory, relative = pending.pop()
        with os.scandir(directory) as entries:
            for entry in entries:
                child = relative / entry.name
                portable = child.as_posix()
                info = entry.stat(follow_symlinks=False)
                mode = info.st_mode
                if stat.S_ISLNK(mode):
                    return False
                if stat.S_ISDIR(mode):
                    if portable not in expected_dirs:
                        return False
                    observed_dirs.add(portable)
                    pending.append((Path(entry.path), child))
                elif stat.S_ISREG(mode):
                    if portable not in expected_files or info.st_nlink != 1:
                        return False
                    observed_files.add(portable)
                else:
                    return False
    if observed_files != expected_files or observed_dirs != expected_dirs:
        return False
    return all(
        (target / row["path"]).read_bytes() == row["content"].encode("utf-8")
        for row in files
    )


def managed_request(payload):
    target = Path(payload["target"])
    operation = payload["operation"]
    options = dict(preset="coding", adapters=(), active_context=None)
    try:
        plan = create_vivary.plan_thin_workspace(target, **options)
    except create_vivary.ScaffoldError:
        if operation != "apply" or not target.is_dir():
            raise
        with tempfile.TemporaryDirectory(prefix="vivary-managed-retry-") as temporary:
            expected = Path(temporary) / target.name
            plan = _bind_plan_target(
                create_vivary.plan_thin_workspace(expected, **options), target
            )
    if operation == "plan":
        return {"code": "preview", "plan": plan}
    if operation != "apply":
        raise ValueError("unknown operation")
    if payload.get("acceptedPlanSha256") != plan["plan_sha256"]:
        return {"code": "plan-changed"}
    exact = target.is_dir() and _matches_exact_inventory(target, plan["files"])
    if exact:
        return {"code": "already-created", "target": str(target),
                "planSha256": plan["plan_sha256"]}
    create_vivary.scaffold_thin_workspace(target, repo_root=ROOT, **options)
    return {"code": "created", "target": str(target),
            "planSha256": plan["plan_sha256"]}


if __name__ == "__main__":
    try:
        request = json.loads(sys.stdin.read())
        if set(request) - {"operation", "target", "acceptedPlanSha256"}:
            raise ValueError("unexpected request field")
        print(json.dumps(managed_request(request), separators=(",", ":")))
    except (KeyError, TypeError, ValueError, create_vivary.ScaffoldError) as exc:
        print(json.dumps({"code": "refused", "message": str(exc)}, separators=(",", ":")))
        raise SystemExit(2)
