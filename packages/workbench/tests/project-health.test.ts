import assert from "node:assert/strict";
import test from "node:test";

import { heading, summarizeDoctorOutput } from "../app/lib/project-health.ts";

const report = (fields: Record<string, unknown>) => JSON.stringify({
  ok: true, root: "/project", errors: [], warnings: [], graph: { nodes: 6, edges: 1, broken: 0 },
  backend: "file", memory: { status: "disabled" }, compatibility: {}, capabilities: {}, ...fields,
});

test("a healthy report keeps Doctor's warnings as warnings", () => {
  const warning = "tropo finding: .vivary/context.md:4: warning W202: unknown field 'author' for type 'project'";
  const health = summarizeDoctorOutput({ exitCode: 0, stdout: report({ warnings: [warning] }), stderr: "" });
  assert.deepEqual(health, { kind: "report", ok: true, nodes: 6, edges: 1, broken: 0,
    warnings: [warning], warningTotal: 1, errors: [], errorTotal: 0 });
});

test("a failed report lists Doctor's errors even though the command exited 1", () => {
  const error = "tropo finding: changes/bad.md:1: error E101: missing required field 'slice' for type 'change'";
  const health = summarizeDoctorOutput({
    exitCode: 1, stderr: "",
    stdout: report({ ok: false, errors: [error, "graph has 1 broken edge(s)"], graph: { nodes: 8, edges: 2, broken: 1 } }),
  });
  assert.equal(health.kind, "report");
  if (health.kind !== "report") return;
  assert.equal(health.ok, false);
  assert.deepEqual(health.errors, [error, "graph has 1 broken edge(s)"]);
  assert.deepEqual([health.nodes, health.edges, health.broken], [8, 2, 1]);
});

test("output that is not a Doctor report is reported as unreadable with the first stderr line", () => {
  const health = summarizeDoctorOutput({ exitCode: 2, stdout: "", stderr: "\nvivary doctor: create-vivary is not installed.\nmore\n" });
  assert.deepEqual(health, { kind: "unreadable", message: "Doctor did not return a readable report: vivary doctor: create-vivary is not installed." });
  for (const stdout of ["not json", "[]", JSON.stringify({ ok: "yes" }), report({ graph: { nodes: -1, edges: 0, broken: 0 } }), report({ errors: [1] })]) {
    assert.equal(summarizeDoctorOutput({ exitCode: 0, stdout, stderr: "" }).kind, "unreadable", stdout);
  }
});

test("long finding lists stay bounded and the omitted remainder is disclosed", () => {
  const warnings = Array.from({ length: 80 }, (_, index) => `warning ${index} ` + "x".repeat(500));
  const health = summarizeDoctorOutput({ exitCode: 0, stdout: report({ warnings }), stderr: "" });
  assert.equal(health.kind, "report");
  if (health.kind !== "report") return;
  assert.equal(health.warnings.length, 50);
  assert.equal(health.warningTotal, 80);
  assert.ok(health.warnings.every(entry => entry.length <= 400));
  assert.ok(health.warnings[0].endsWith("…"));
  assert.equal(heading("warning", health.warnings.length, health.warningTotal), "Showing 50 of 80 warnings");
  assert.equal(heading("error", 2, 2), "Errors");
});
