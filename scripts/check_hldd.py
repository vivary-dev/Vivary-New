"""Require the canonical design document to travel with relevant changes."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
DOCUMENT = "docs/ARCHITECTURE.md"
HEADINGS = (
    "Purpose and owner intent",
    "Success criteria",
    "System structure",
    "Runtime flows",
    "Data and trust boundaries",
    "Delivery and known gaps",
    "Maintaining this document",
    "Last change review",
)


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", *args], cwd=ROOT, input=None, capture_output=True, check=check,
        env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
    )


def text_at(revision: str | None) -> str:
    if revision is None:
        return ""
    target = f"{revision}:{DOCUMENT}" if revision != ":" else f":{DOCUMENT}"
    result = git("show", target, check=False)
    if result.returncode:
        raise ValueError(f"Cannot read {DOCUMENT} from {revision}. Restore the canonical HLDD.")
    return result.stdout.decode("utf-8")


def relevant(path: str) -> bool:
    if not path or path == DOCUMENT:
        return False
    if path.startswith("site/src/content/docs/") or path in {
        "site/public/llms.txt", "site/public/llms-full.txt",
    }:
        return False  # Generated from canonical docs and checked by site sync.
    parts = Path(path).parts
    if any(part in {"tests", "__tests__", "__snapshots__", "fixtures"} for part in parts):
        return False
    return True


def substantive(text: str) -> str:
    # Dates, whitespace, and comments alone do not document a design review.
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?\b", "", text)
    return re.sub(r"\s+", "", text)


def validate_document(text: str) -> None:
    sections = re.split(r"(?m)^## ", text)
    found = {}
    for section in sections[1:]:
        title, _, body = section.partition("\n")
        if title in found:
            raise ValueError(f"Duplicate HLDD section: {title}")
        found[title] = body
    for heading in HEADINGS:
        if not substantive(found.get(heading, "")):
            raise ValueError(f"HLDD needs a nonempty '## {heading}' section.")


def check_change(before: str | None, after: str, *, staged: bool = False) -> None:
    args = ["diff", "--name-only", "--no-renames", "-z"]
    if staged:
        args.append("--cached")
        if before:
            args.append(before)
    elif before:
        args.extend([before, after])
    else:
        args = ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", after]
    changed = git(*args).stdout.decode("utf-8").split("\0")
    current = text_at(":" if staged else after)
    validate_document(current)
    impact = [path for path in changed if relevant(path)]
    if not impact:
        return
    previous = text_at(before) if before else ""
    if substantive(current) == substantive(previous):
        sample = ", ".join(impact[:4])
        raise ValueError(
            f"HLDD review missing for {sample}. Update {DOCUMENT} in the same commit. "
            "If the design is unchanged, explain the concrete change and why the existing "
            "description still holds in Last change review. Stage that update. "
            "Read .agents/skills/maintain-hldd/SKILL.md."
        )


def commit(ref: str) -> str:
    return git("rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}").stdout.decode().strip()


def has_gate(revision: str) -> bool:
    return git("cat-file", "-e", f"{revision}:scripts/check_hldd.py", check=False).returncode == 0


def has_gate(revision: str) -> bool:
    return git("cat-file", "-e", f"{revision}:scripts/check_hldd.py", check=False).returncode == 0


def check_range(base: str, head: str) -> int:
    end = commit(head)
    if not base or set(base) == {"0"}:
        raise ValueError("A nonzero base commit is required. Supply the reviewed branch baseline.")
    start = commit(base)
    ancestor = git("merge-base", start, end).stdout.decode().strip()
    revisions = git("rev-list", "--reverse", "--topo-order", f"{ancestor}..{end}")
    validate_document(text_at(end))
    if not has_gate(end):
        raise ValueError("The candidate removes the HLDD checker. Restore the maintenance gate.")
    checked = 0
    for revision in revisions.stdout.decode().splitlines():
        parents = git("rev-list", "--parents", "-n", "1", revision).stdout.decode().split()[1:]
        if not has_gate(revision):
            if any(has_gate(parent) for parent in parents):
                raise ValueError(f"{revision[:12]} removes the HLDD checker.")
            continue  # Historical commits before adoption are not retroactively gated.
        try:
            check_change(parents[0] if parents else None, revision)
        except ValueError as error:
            raise ValueError(f"{revision[:12]}: {error}") from error
        checked += 1
    return checked


def install_hook() -> None:
    configured = git("config", "--get", "core.hooksPath", check=False)
    if configured.returncode == 0 and configured.stdout.strip():
        raise ValueError(
            "core.hooksPath is already managed. Add 'python scripts/check_hldd.py --staged' "
            "to its pre-commit chain instead of replacing that hook manager."
        )
    hooks = Path(git("rev-parse", "--git-path", "hooks").stdout.decode().strip())
    if not hooks.is_absolute():
        hooks = ROOT / hooks
    destination = hooks / "pre-commit"
    source = ROOT / "scripts/pre-commit-hldd.sh"
    content = source.read_bytes()
    if destination.is_symlink():
        raise ValueError("Existing pre-commit is a symlink. Preserve it and integrate the check manually.")
    if destination.exists() and destination.read_bytes() != content:
        raise ValueError("Existing pre-commit differs. Preserve it and add the HLDD check to its chain.")
    hooks.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copyfile(source, destination)
    destination.chmod(destination.stat().st_mode | 0o111)
    print(f"HLDD hook installed at {destination}. Other hooks are unchanged.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--staged", action="store_true")
    mode.add_argument("--base", metavar="REF")
    mode.add_argument("--install-hook", action="store_true")
    parser.add_argument("--head", default="HEAD")
    args = parser.parse_args()
    try:
        if args.install_hook:
            install_hook()
        elif args.staged:
            result = git("rev-parse", "--verify", "HEAD", check=False)
            before = result.stdout.decode().strip() if result.returncode == 0 else None
            check_change(before, ":", staged=True)
            print("HLDD staged review passed.")
        else:
            count = check_range(args.base, args.head)
            print(f"HLDD review passed for {count} introduced commit(s).")
    except (ValueError, OSError, UnicodeError, subprocess.CalledProcessError) as error:
        detail = error.stderr.decode(errors="replace").strip() if isinstance(error, subprocess.CalledProcessError) else str(error)
        print(f"HLDD check failed: {detail}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
