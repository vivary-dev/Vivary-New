import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import projectSearchAction from "../actions/vivary-project-search.ts";
import { createProjectSearchService } from "../server/project-search.ts";
import { projectSearchInputSchema } from "../app/lib/project-search-schema.ts";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

type Limits = Parameters<typeof createProjectSearchService>[1];

async function fixture(limits?: Limits) {
  const root = await mkdtemp(path.join(os.tmpdir(), "vivary-project-search-"));
  roots.push(root);
  let revision = 1;
  let available = true;
  const workspace = () => ({ root, label: "Example", projectId: "project_a", bindingId: "binding_a",
    rootId: "root_a", bindingRevision: revision, policyRevision: 1 });
  const service = createProjectSearchService(async (_context, projectId) => {
    if (!available || projectId !== "project_a") throw new Error("Project unavailable");
    return workspace();
  }, limits);
  const search = (query: string, mode: "filename" | "text" | "regex" = "text", after?: string) =>
    service.search(undefined, { projectId: "project_a", query, mode, after });
  const write = async (relative: string, content: string | Buffer) => {
    const absolute = path.join(root, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  };
  return { root, service, search, write, revoke: () => { available = false; }, rebind: () => { revision += 1; } };
}

describe("project search input", () => {
  it("accepts a bounded query with a default mode and rejects empty, short, or overlong queries", () => {
    const parsed = projectSearchInputSchema.safeParse({ projectId: "project_a", query: "  todo " });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.deepEqual(parsed.data, { projectId: "project_a", query: "todo", mode: "text" });
    for (const query of ["", " ", "a", "x".repeat(201)]) {
      assert.equal(projectSearchInputSchema.safeParse({ projectId: "project_a", query }).success, false, JSON.stringify(query));
    }
    assert.equal(projectSearchInputSchema.safeParse({ projectId: "project_a", query: "ok", extra: 1 }).success, false);
    assert.equal(projectSearchInputSchema.safeParse({ projectId: "project_a", query: "ok", mode: "fuzzy" }).success, false);
  });
});

describe("project search action", () => {
  it("is a read-only authenticated GET action hidden from tool catalogs", () => {
    assert.equal(projectSearchAction.readOnly, true);
    assert.equal(projectSearchAction.requiresAuth, true);
    assert.deepEqual(projectSearchAction.http, { method: "GET" });
    for (const flag of ["agentTool", "mcpTool", "toolCallable"] as const) {
      assert.equal(projectSearchAction[flag], false, flag);
    }
    assert.equal(projectSearchAction.schema.safeParse({ projectId: "project_a", query: "needle", mode: "regex" }).success, true);
    assert.equal(projectSearchAction.schema.safeParse({ projectId: "project_a", query: "n" }).success, false);
  });
});

describe("project search", () => {
  it("finds filenames case-insensitively while hiding secret and dependency trees", async () => {
    const f = await fixture();
    await f.write("src/Widget.ts", "export const widget = 1;\n");
    await f.write("docs/widgets.md", "# Widgets\n");
    await f.write("node_modules/widget/index.js", "hidden\n");
    await f.write(".env", "WIDGET_SECRET=1\n");
    await f.write("widget-credentials.json", "{}\n");
    await f.write("image.png", Buffer.from([0, 1, 2]));

    const result = await f.search("widget", "filename");
    assert.equal(result.code, "results");
    if (result.code !== "results") return;
    assert.deepEqual(result.files.map(file => file.path), ["docs/widgets.md", "src/Widget.ts"]);
    assert.deepEqual(result.matches, []);
    assert.equal(result.truncated, null);
    assert.equal(result.continueAfter, null);
    assert.equal(result.project.projectId, "project_a");
    assert.equal(result.query, "widget");
    assert.equal(result.mode, "filename");
  });

  it("finds exact text with line, column and excerpt and skips binary and oversized files", async () => {
    const f = await fixture();
    await f.write("notes/plan.md", "# Plan\n\nWe need a search box.\nsearch happens here too\n");
    await f.write("src/index.ts", "const label = \"Search\";\n");
    await f.write("blob.bin", Buffer.concat([Buffer.from("search "), Buffer.from([0]), Buffer.from("inside")]));
    await f.write("big.txt", "search\n".repeat(60_000));

    const result = await f.search("search");
    assert.equal(result.code, "results");
    if (result.code !== "results") return;
    assert.deepEqual(result.matches.map(match => [match.path, match.line, match.column]), [
      ["notes/plan.md", 3, 11],
      ["notes/plan.md", 4, 1],
      ["src/index.ts", 1, 16],
    ]);
    assert.equal(result.matches[0]?.excerpt, "We need a search box.");
    assert.deepEqual(result.files, []);
    assert.equal(result.truncated, null);
    assert.ok(result.readFiles >= 2);
  });

  it("matches regular expressions per line and reports invalid patterns without scanning", async () => {
    const f = await fixture();
    await f.write("a.ts", "const answer = 42;\nconst other = 7;\n");
    const result = await f.search("answer\\s*=\\s*\\d+", "regex");
    assert.equal(result.code, "results");
    if (result.code === "results") {
      assert.deepEqual(result.matches.map(match => [match.path, match.line, match.column]), [["a.ts", 1, 7]]);
    }
    const invalid = await f.search("answer(", "regex");
    assert.equal(invalid.code, "invalid-pattern");
    if (invalid.code === "invalid-pattern") assert.match(invalid.reason, /Invalid regular expression/);
  });

  it("skips a file whose pattern exceeds the regex time limit instead of hanging", async () => {
    const f = await fixture({ regexTimeoutMs: 50 });
    await f.write("slow.md", "a".repeat(40) + "b\n");
    await f.write("fast.md", "aab\n");
    const started = Date.now();
    const result = await f.search("(a+)+$", "regex");
    assert.ok(Date.now() - started < 2_000, "returned promptly");
    assert.equal(result.code, "results");
    if (result.code !== "results") return;
    assert.equal(result.regexTimeouts, 1);
    assert.deepEqual(result.matches, []);
    assert.equal(result.truncated, null);
  });

  it("refuses symlinked directories and multiply linked files", async () => {
    const f = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "vivary-project-search-outside-"));
    roots.push(outside);
    await writeFile(path.join(outside, "leak.md"), "needle outside\n");
    await symlink(outside, path.join(f.root, "linked-dir"), "dir");
    await f.write("inside.md", "needle inside\n");
    await link(path.join(f.root, "inside.md"), path.join(f.root, "twin.md"));

    const result = await f.search("needle");
    assert.equal(result.code, "results");
    if (result.code !== "results") return;
    assert.deepEqual(result.matches.map(match => match.path), []);
    const names = await f.search("leak", "filename");
    if (names.code === "results") assert.deepEqual(names.files, []);
  });

  it("handles Unicode and spaced paths in both modes", async () => {
    const f = await fixture();
    await f.write("réunion notes/plan été.md", "café\n");
    const byName = await f.search("plan été", "filename");
    if (byName.code === "results") assert.deepEqual(byName.files.map(file => file.path), ["réunion notes/plan été.md"]);
    const byText = await f.search("café");
    if (byText.code === "results") assert.deepEqual(byText.matches.map(match => [match.path, match.line, match.column]), [["réunion notes/plan été.md", 1, 1]]);
  });

  it("caps matches and continues from the returned cursor without repeating or skipping", async () => {
    const f = await fixture({ maxMatches: 3 });
    for (const name of ["a", "b", "c", "d", "e"]) await f.write(`${name}.md`, `hit ${name}\n`);
    const seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const result = await f.search("hit", "text", after);
      assert.equal(result.code, "results");
      if (result.code !== "results") return;
      seen.push(...result.matches.map(match => match.path));
      if (!result.continueAfter) { assert.equal(result.truncated, null); break; }
      assert.equal(result.truncated, "matches");
      after = result.continueAfter;
    }
    assert.deepEqual(seen, ["a.md", "b.md", "c.md", "d.md", "e.md"]);
  });

  it("visits directories at their sorted position so pages never skip or repeat", async () => {
    const f = await fixture({ maxMatches: 1 });
    await f.write("a/hit.md", "hit a\n");
    await f.write("b.md", "hit b\n");
    await f.write("b/deep/hit.md", "hit deep\n");
    await f.write("z.md", "hit z\n");
    const seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 8; page += 1) {
      const result = await f.search("hit", "text", after);
      if (result.code !== "results") return;
      seen.push(...result.matches.map(match => match.path));
      if (!result.continueAfter) break;
      after = result.continueAfter;
    }
    assert.deepEqual(seen, ["a/hit.md", "b/deep/hit.md", "b.md", "z.md"]);
  });

  it("makes progress under a tiny entry budget without repeating files", async () => {
    const f = await fixture({ maxScannedEntries: 2 });
    for (const name of ["a", "b", "c", "d", "e"]) await f.write(`${name}.md`, `hit ${name}\n`);
    await f.write("dir/inner.md", "hit inner\n");
    const seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 12; page += 1) {
      const result = await f.search("hit", "text", after);
      if (result.code !== "results") return;
      seen.push(...result.matches.map(match => match.path));
      if (!result.continueAfter) break;
      after = result.continueAfter;
    }
    assert.deepEqual(seen, ["a.md", "b.md", "c.md", "d.md", "dir/inner.md", "e.md"]);
  });

  it("enforces the page match cap exactly and defers a file that would overflow it", async () => {
    const f = await fixture({ maxMatches: 5 });
    await f.write("a.md", "hit\nhit\nhit\nhit\n");
    await f.write("b.md", "hit\nhit\nhit\n");
    const first = await f.search("hit");
    assert.equal(first.code, "results");
    if (first.code !== "results") return;
    assert.equal(first.matches.length, 4);
    assert.equal(first.truncated, "matches");
    assert.equal(first.continueAfter, "a.md");
    const second = await f.search("hit", "text", first.continueAfter ?? undefined);
    if (second.code !== "results") return;
    assert.deepEqual(second.matches.map(match => [match.path, match.line]), [["b.md", 1], ["b.md", 2], ["b.md", 3]]);
    assert.equal(second.truncated, null);
  });

  it("caps matches per file and marks the last one when more remain", async () => {
    const f = await fixture({ maxFileMatches: 3 });
    await f.write("many.md", "hit\n".repeat(7));
    await f.write("one.md", "hit\n");
    const result = await f.search("hit");
    if (result.code !== "results") return;
    const many = result.matches.filter(match => match.path === "many.md");
    assert.equal(many.length, 3);
    assert.equal(many.at(-1)?.more, true);
    assert.equal(many[0]?.more, undefined);
    assert.equal(result.matches.filter(match => match.path === "one.md")[0]?.more, undefined);
  });

  it("reports literal columns in the original line even when case folding changes length", async () => {
    const f = await fixture();
    await f.write("turkish.md", "\u0130 needle\n");
    const result = await f.search("NEEDLE");
    if (result.code !== "results") return;
    assert.deepEqual(result.matches.map(match => [match.line, match.column]), [[1, 3]]);
  });

  it("stops at the time budget and names the truncation", async () => {
    const f = await fixture({ timeBudgetMs: 0 });
    await f.write("first.md", "hit\n");
    await f.write("second.md", "hit\n");
    const result = await f.search("hit");
    assert.equal(result.code, "results");
    if (result.code !== "results") return;
    assert.equal(result.truncated, "time");
    assert.equal(result.continueAfter, "first.md");
    assert.deepEqual(result.matches.map(match => match.path), ["first.md"]);
  });

  it("bounds scanned entries and read files", async () => {
    const f = await fixture({ maxScannedEntries: 3 });
    for (const name of ["a", "b", "c", "d", "e"]) await f.write(`${name}.md`, `hit ${name}\n`);
    const scanned = await f.search("hit");
    if (scanned.code === "results") {
      assert.equal(scanned.truncated, "entries");
      assert.ok(scanned.continueAfter);
    }
    const g = await fixture({ maxReadFiles: 2 });
    for (const name of ["a", "b", "c"]) await g.write(`${name}.md`, `hit ${name}\n`);
    const read = await g.search("hit");
    if (read.code === "results") {
      assert.equal(read.truncated, "files");
      assert.equal(read.readFiles, 2);
      assert.equal(read.continueAfter, "b.md");
    }
  });

  it("returns nothing for an empty project and refuses revoked or rebound projects", async () => {
    const f = await fixture();
    const empty = await f.search("anything");
    assert.equal(empty.code, "results");
    if (empty.code === "results") { assert.deepEqual(empty.matches, []); assert.equal(empty.scannedEntries, 0); }
    f.rebind();
    await f.write("x.md", "anything\n");
    const g = await fixture();
    g.revoke();
    await assert.rejects(g.search("anything"), /unavailable/);
  });

  it("honors a cancellation signal before and during the walk", async () => {
    const f = await fixture();
    await f.write("a.md", "needle\n");
    await f.write("b.md", "needle\n");
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(f.service.search(undefined, { projectId: "project_a", query: "needle", mode: "text" }, cancelled.signal),
      { name: "AbortError" });
    const midway = new AbortController();
    const service = createProjectSearchService(async () => {
      // Abort once the walk is about to start; nothing should be read after.
      queueMicrotask(() => midway.abort());
      return { root: f.root, label: "Example", projectId: "project_a", bindingId: "binding_a", rootId: "root_a",
        bindingRevision: 1, policyRevision: 1 };
    });
    await assert.rejects(service.search(undefined, { projectId: "project_a", query: "needle", mode: "text" }, midway.signal),
      { name: "AbortError" });
  });

  it("rejects results when the project binding changes during the search", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vivary-project-search-"));
    roots.push(root);
    await writeFile(path.join(root, "x.md"), "needle\n");
    let calls = 0;
    const service = createProjectSearchService(async () => {
      calls += 1;
      return { root, label: "Example", projectId: "project_a", bindingId: "binding_a", rootId: "root_a",
        bindingRevision: calls === 1 ? 1 : 2, policyRevision: 1 };
    });
    await assert.rejects(service.search(undefined, { projectId: "project_a", query: "needle", mode: "text" }), /changed/);
  });
});
