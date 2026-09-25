"""Bounded server bridge to create-vivary's exact thin workspace operations."""
import json
from pathlib import Path
import sys

# A checkout owns development; the staged bridge uses its installed wheel.
ROOT = Path(__file__).resolve().parents[3]
source = ROOT / "packages" / "create-vivary"
if (source / "create_vivary.py").is_file():
    sys.path.insert(0, str(source))
else:
    ROOT = None
import create_vivary


def managed_request(payload):
    operation = payload["operation"]
    if operation == "catalog":
        return {"code": "catalog", "patterns": create_vivary.builtin_pattern_catalog()}
    target = Path(payload["target"])
    if operation == "context":
        # Read-only. The Workbench admitted this root before calling. An
        # invalid config comes back as data so the owner can see the reason.
        return {"code": "context", "context": create_vivary.workspace_context(target, repo_root=ROOT)}
    options = dict(preset=payload.get("preset", "coding"), adapters=(), active_context=None,
                   pattern_choices=payload.get("patternChoices", ()))
    if operation == "plan":
        return {"code": "preview", "plan": create_vivary.plan_thin_workspace(
            target, **options
        )}
    if operation != "apply":
        raise ValueError("unknown operation")
    result = create_vivary.apply_thin_workspace(
        target, payload.get("acceptedPlanSha256"),
        repo_root=ROOT, **options,
    )
    if result["code"] == "plan-changed":
        return {"code": "plan-changed"}
    return {"code": result["code"], "target": result["target"],
            "planSha256": result["plan_sha256"]}



if __name__ == "__main__":
    try:
        request = json.loads(sys.stdin.read())
        if set(request) - {"operation", "target", "acceptedPlanSha256", "patternChoices", "preset"}:
            raise ValueError("unexpected request field")
        print(json.dumps(managed_request(request), separators=(",", ":")))
    except (KeyError, TypeError, ValueError, create_vivary.ScaffoldError) as exc:
        print(json.dumps({"code": "refused", "message": str(exc)}, separators=(",", ":")))
        raise SystemExit(2)
