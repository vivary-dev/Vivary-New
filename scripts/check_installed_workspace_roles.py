"""Check the role API and Doctor result using installed packages, outside a checkout."""

from importlib.metadata import requires
from pathlib import Path
from tempfile import TemporaryDirectory

import create_vivary
import tropo


assert "vivary-tropo>=0.5.5" in (requires("create-vivary") or [])
assert callable(tropo.resolve_workspace_roles)

with TemporaryDirectory(prefix="vivary-installed-roles-") as temporary:
    workspace = Path(temporary) / "workspace"
    create_vivary.scaffold_thin_workspace(
        workspace, preset="coding", active_context="cocoindex-code"
    )
    report = create_vivary.doctor_workspace(workspace)
    assert report["ok"], report["errors"]
    assert ".cocoindex_code" in report["workspace_roles"]["roles"]["boundary"]

print("Installed creator dependency, Tropo role API, and Doctor boundary passed.")
