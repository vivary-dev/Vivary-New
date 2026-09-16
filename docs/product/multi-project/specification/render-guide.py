#!/usr/bin/env python3
"""Build the offline specification reader from the owned Markdown and JSON."""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import os
from pathlib import Path
import re
from urllib.parse import quote, unquote, urlsplit
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent
SOURCE_REVISION = "3d3a6c50c32284ebf2c7def311f6e3e80deb8bb5"
WORKBENCH_REVISION = "dev"
BUNDLED_RUNTIME_REVISION = "dev"
SHARED_PLAN_REVISION = "dev"
RECONNECTION_REVISION = "dev"
RECONNECTION_REVIEW_REVISION = "dev"
CURRENT_IMPLEMENTATION_CHAPTERS = {"overview", "modules", "operating-manual", "unified-workspace"}
CURRENT_IMPLEMENTATION_DOCS = {BASE / "receipts/04a-project-chat-sessions.md"}
RECONNECTION_REVIEW_PATHS = {
    Path("packages/workbench/app/components/projects/ProjectContext.tsx"),
    Path("packages/workbench/app/components/projects/ProjectNavigation.tsx"),
    Path("packages/workbench/app/components/projects/ReconnectProjectForm.tsx"),
    Path("packages/workbench/app/lib/project-catalog-schema.ts"),
    Path("packages/workbench/server/local-root-provider.mjs"),
    Path("packages/workbench/server/managed-project-reconnection.mjs"),
    Path("packages/workbench/server/project-catalog.mjs"),
    Path("packages/workbench/server/project-services.mjs"),
    Path("packages/workbench/shared/managed-project-reconnection.ts"),
}
RECONNECTION_PATHS = {
    Path("packages/workbench/actions/vivary-preview-managed-project-reconnection.ts"),
    Path("packages/workbench/actions/vivary-confirm-managed-project-reconnection.ts"),
    Path("packages/workbench/app/components/projects/ProjectContext.tsx"),
    Path("packages/workbench/app/components/projects/ProjectNavigation.tsx"),
    Path("packages/workbench/app/components/projects/ReconnectProjectForm.tsx"),
    Path("packages/workbench/server/local-code-agent.ts"),
    Path("packages/workbench/server/local-root-provider.mjs"),
    Path("packages/workbench/server/managed-project-reconnection.mjs"),
    Path("packages/workbench/server/managed-projects.mjs"),
    Path("packages/workbench/server/project-services.mjs"),
    Path("packages/workbench/shared/managed-project-reconnection.ts"),
}
SHARED_PLAN_PATHS = {
    Path("packages/create-vivary"),
    Path("packages/workbench/server/managed_project_workspace.py"),
}
BUNDLED_RUNTIME_PATHS = {
    Path("docs/product/multi-project/receipts/23a-bundled-original-runtime.md"),
    Path("packages/desktop"),
    Path("packages/workbench/actions/vivary-original-command.ts"),
    Path("packages/workbench/server/managed-projects.mjs"),
    Path("packages/workbench/server/managed_project_workspace.py"),
    Path("packages/workbench/server/original-runtime-location.d.mts"),
    Path("packages/workbench/server/original-runtime-location.mjs"),
    Path("packages/workbench/server/original-runtime.ts"),
}
MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.min.js"
MERMAID_SHA256 = "07e37dfa97b337ccc85365d57eddf99b9706f09db3b59b260d0333b23b343c4b"
DIAGRAMS = HERE / "guide-diagrams"
MANIFEST = DIAGRAMS / "manifest.json"
MERMAID_BLOCK = re.compile(r"^```mermaid\s*\n(.*?)^```\s*$", re.M | re.S)
CHAPTERS = [
    ("guided-review", "The design review", HERE / "guided-review.md"),
    ("overview", "Specification overview", HERE / "README.md"),
    ("guide-source", "Walkthrough content source", HERE / "guide-content.json"),
    ("system", "The whole system", HERE / "system.md"),
    ("modules", "Module contracts", HERE / "modules.md"),
    ("actions", "Action contracts", HERE / "actions.md"),
    ("harness-adapters", "Harness integrations", HERE / "harness-adapters.md"),
    ("journeys", "Journeys and recovery", HERE / "journeys.md"),
    ("coverage", "Coverage and delivery", HERE / "coverage.md"),
    ("operating-manual", "Working with an LLM", HERE / "operating-manual.md"),
    ("vocabulary", "Shared vocabulary", BASE / "CONTEXT.md"),
    ("unified-workspace", "The workspace interface", BASE / "unified-workspace.md"),
    ("research", "Research behind the design", BASE / "research/agent-workspace-ergonomics.md"),
]
CHAPTERS += [
    ("outcome-" + path.stem[:2], "Outcome " + path.stem[:2] + ": " +
     re.search(r"^#\s+(.+)", path.read_text(), re.M)[1], path)
    for path in sorted((BASE / "tickets").glob("[0-9][0-9]-*.md"))
]


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def source_diagrams():
    for slug, _, path in CHAPTERS:
        for index, match in enumerate(MERMAID_BLOCK.finditer(path.read_text())):
            yield slug + "-" + str(index), match[1].strip()


def refresh_diagrams():
    """Authoring only: render the pinned engine, then keep SVGs offline."""
    from playwright.sync_api import sync_playwright

    with urlopen(MERMAID_URL, timeout=30) as response:
        renderer = response.read(20_000_001)
    if digest(renderer) != MERMAID_SHA256:
        raise ValueError("Diagram renderer integrity mismatch; nothing was executed.")
    records = {}
    DIAGRAMS.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        options = {"headless": True}
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if executable:
            options["executable_path"] = executable
        browser = playwright.chromium.launch(**options)
        try:
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.set_content("<!doctype html><html lang='en'><body></body></html>")
            page.add_script_tag(content=renderer.decode())
            page.evaluate("mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral'})")
            for name, source in source_diagrams():
                svg = page.evaluate(
                    "async ({name,source}) => (await mermaid.render('guide-'+name,source)).svg",
                    {"name": name, "source": source},
                )
                (DIAGRAMS / (name + ".svg")).write_text(svg + "\n")
                records[name] = {"source": digest(source.encode()), "svg": digest((svg + "\n").encode())}
        finally:
            browser.close()
    MANIFEST.write_text(json.dumps({"renderer": MERMAID_URL, "sha256": MERMAID_SHA256, "diagrams": records}, indent=2) + "\n")


def load_diagrams():
    manifest = json.loads(MANIFEST.read_text())
    if manifest["renderer"] != MERMAID_URL or manifest.get("sha256") != MERMAID_SHA256:
        raise ValueError("Diagram renderer changed; use --refresh-diagrams.")
    result = {}
    expected = set()
    for name, source in source_diagrams():
        expected.add(name)
        record = manifest["diagrams"].get(name)
        svg = (DIAGRAMS / (name + ".svg")).read_bytes()
        if not record or record != {"source": digest(source.encode()), "svg": digest(svg)}:
            raise ValueError(name + " changed; use --refresh-diagrams.")
        result[name] = base64.b64encode(svg).decode()
    if set(manifest["diagrams"]) != expected:
        raise ValueError("Diagram inventory changed; use --refresh-diagrams.")
    return result


def build():
    import markdown
    from bs4 import BeautifulSoup

    diagrams = load_diagrams()
    chapter_paths = {path.resolve(): slug for slug, _, path in CHAPTERS}
    chapters = []
    fingerprint = hashlib.sha256()
    for file in [HERE / "guide-content.json", HERE / "feature-map.json", HERE / "guide.template.html",
                 Path(__file__), MANIFEST, *[p for _, _, p in CHAPTERS]]:
        fingerprint.update(str(file.relative_to(ROOT)).encode())
        fingerprint.update(file.read_bytes())

    for slug, title, path in CHAPTERS:
        count = 0

        def replace_diagram(match):
            nonlocal count
            name = slug + "-" + str(count)
            count += 1
            caption = title + " — diagram " + str(count)
            return "\n\n" + (
                '<figure class="diagram"><img loading="lazy" alt="' + html.escape(caption) +
                '" src="data:image/svg+xml;base64,' + diagrams[name] + '"><figcaption>' +
                '<span>' + html.escape(caption) + '</span><button type="button" data-diagram ' +
                'data-diagram-title="' + html.escape(caption) + '">Enlarge diagram</button>' +
                '</figcaption></figure><details class="diagram-source"><summary>Read diagram source</summary>' +
                '<pre><code>' + html.escape(match[1].strip()) + '</code></pre></details>\n\n'
            )

        raw = MERMAID_BLOCK.sub(replace_diagram, path.read_text())
        if path.suffix == ".json":
            raw = "# " + title + "\n\n```json\n" + raw + "\n```"
        rendered = markdown.markdown(raw, extensions=["extra", "toc"])
        soup = BeautifulSoup(rendered, "html.parser")
        # Markdown is repository authored. Still prevent active embeds in the reader.
        for tag in soup.find_all(["script", "style", "iframe", "object", "embed", "form", "input"]):
            tag.decompose()
        for tag in soup.find_all(True):
            for attr in list(tag.attrs):
                if attr.lower().startswith("on") or attr.lower() in {"srcdoc", "style"}:
                    del tag[attr]
            if tag.get("id"):
                tag["id"] = slug + "--" + tag["id"]
            for attr in ["href", "src"]:
                value = tag.get(attr)
                if not value:
                    continue
                url = urlsplit(value)
                if url.scheme:
                    allowed = url.scheme in {"https", "http", "mailto"} if attr == "href" else value.startswith("data:image/svg+xml;base64,")
                    if not allowed:
                        del tag[attr]
                    elif attr == "href":
                        tag["target"] = "_blank"
                        tag["rel"] = "noopener noreferrer"
                    continue
                if attr == "src":
                    # No implicit network fetches or local file disclosure.
                    del tag[attr]
                    continue
                target = (path.parent / unquote(url.path)).resolve() if url.path else path.resolve()
                if target in chapter_paths:
                    tag[attr] = "#doc/" + chapter_paths[target] + ("/" + quote(unquote(url.fragment), safe="") if url.fragment else "")
                elif target == HERE / "guide.html":
                    tag[attr] = "#start"
                elif target == HERE / "atlas.html":
                    tag[attr] = "#modules"
                else:
                    try:
                        relative = target.relative_to(ROOT)
                    except ValueError:
                        del tag[attr]
                        continue
                    if not target.exists():
                        raise ValueError(str(path.relative_to(ROOT)) + ": missing target " + value)
                    kind = "tree" if target.is_dir() else "blob"
                    revision = SOURCE_REVISION if relative.parts[:4] == ("docs", "product", "multi-project", "research") else "dev"
                    if slug in CURRENT_IMPLEMENTATION_CHAPTERS:
                        if any(relative == prefix or prefix in relative.parents
                               for prefix in RECONNECTION_REVIEW_PATHS):
                            revision = RECONNECTION_REVIEW_REVISION
                        elif any(relative == prefix or prefix in relative.parents
                                 for prefix in RECONNECTION_PATHS):
                            revision = RECONNECTION_REVISION
                        elif any(relative == prefix or prefix in relative.parents
                                 for prefix in SHARED_PLAN_PATHS):
                            revision = SHARED_PLAN_REVISION
                        elif any(relative == prefix or prefix in relative.parents
                                 for prefix in BUNDLED_RUNTIME_PATHS):
                            revision = BUNDLED_RUNTIME_REVISION
                        elif (relative.parts[:2] == ("packages", "workbench")
                              or target in CURRENT_IMPLEMENTATION_DOCS):
                            revision = WORKBENCH_REVISION
                    tag[attr] = "https://github.com/vivary-dev/Vivary-New/" + kind + "/" + revision + "/" + quote(relative.as_posix()) + ("#" + url.fragment if url.fragment else "")
                    tag["target"] = "_blank"
                    tag["rel"] = "noopener noreferrer"
        for table in soup.find_all("table"):
            wrapper = soup.new_tag("div", attrs={"class": "table-wrap", "tabindex": "0", "role": "region", "aria-label": "Scrollable reference table"})
            table.wrap(wrapper)
        chapters.append({"slug": slug, "title": title, "source": path.relative_to(ROOT).as_posix(),
                         "outcome": slug.startswith("outcome-"), "html": str(soup)})

    # Fail on broken embedded routes instead of silently dropping readers at a chapter top.
    by_slug = {chapter["slug"]: chapter for chapter in chapters}
    ids = {key: {tag["id"] for tag in BeautifulSoup(chapter["html"], "html.parser").find_all(id=True)}
           for key, chapter in by_slug.items()}
    for chapter in chapters:
        for link in BeautifulSoup(chapter["html"], "html.parser").select('a[href^="#doc/"]'):
            parts = link["href"].split("/", 2)
            if parts[1] not in by_slug or (len(parts) == 3 and parts[1] + "--" + unquote(parts[2]) not in ids[parts[1]]):
                raise ValueError(chapter["slug"] + ": unresolved " + link["href"])

    data = {"fingerprint": fingerprint.hexdigest()[:16],
            "content": json.loads((HERE / "guide-content.json").read_text()),
            "map": json.loads((HERE / "feature-map.json").read_text()), "chapters": chapters}
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    template = (HERE / "guide.template.html").read_text()
    if template.count("__GUIDE_DATA__") != 1:
        raise ValueError("Expected one guide data placeholder.")
    return template.replace("__GUIDE_DATA__", payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check without changing files")
    parser.add_argument("--refresh-diagrams", action="store_true", help="Render changed diagrams using the pinned engine")
    args = parser.parse_args()
    if args.check and args.refresh_diagrams:
        parser.error("--check cannot refresh diagrams")
    if args.refresh_diagrams:
        refresh_diagrams()
    result = build()
    destination = HERE / "guide.html"
    if args.check:
        if not destination.exists() or destination.read_text() != result:
            raise SystemExit("guide.html is stale; run render-guide.py")
    else:
        destination.write_text(result)
    print(f"Guide {'checked' if args.check else 'built'}: {len(CHAPTERS)} chapters, {len(list(source_diagrams()))} diagrams, {len(result.encode()):,} bytes")


if __name__ == "__main__":
    main()
