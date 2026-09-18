// Turns one `vivary doctor --json` run, as returned by the
// `vivary-original-command` action, into what the Details panel shows.
// The action returns the child's raw stdout; Doctor exits 1 whenever it
// reports an error, so the exit code alone does not distinguish a failed
// report from an unreadable one.

export type OriginalCommandOutput = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type ProjectHealthReport = {
  kind: "report";
  ok: boolean;
  nodes: number;
  edges: number;
  broken: number;
  warnings: string[];
  errors: string[];
};

export type ProjectHealth =
  | ProjectHealthReport
  | { kind: "unreadable"; message: string };

// Keep the panel bounded however long Doctor's lists grow.
const MAX_FINDINGS = 50;
const MAX_FINDING_CHARS = 400;

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function findings(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(entry => typeof entry === "string")) return null;
  return value.slice(0, MAX_FINDINGS).map(entry => entry.length > MAX_FINDING_CHARS
    ? entry.slice(0, MAX_FINDING_CHARS - 1) + "…" : entry);
}

export function summarizeDoctorOutput(output: OriginalCommandOutput): ProjectHealth {
  let parsed: unknown;
  try { parsed = JSON.parse(output.stdout); } catch { parsed = undefined; }
  const report = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  const graph = report?.graph && typeof report.graph === "object" ? report.graph as Record<string, unknown> : null;
  const nodes = count(graph?.nodes), edges = count(graph?.edges), broken = count(graph?.broken);
  const warnings = findings(report?.warnings), errors = findings(report?.errors);
  if (!report || typeof report.ok !== "boolean" || nodes === null || edges === null || broken === null
    || warnings === null || errors === null) {
    const detail = output.stderr.trim().split(/\r?\n/).find(line => line.trim()) ?? "";
    return { kind: "unreadable", message: detail
      ? `Doctor did not return a readable report: ${detail.slice(0, MAX_FINDING_CHARS)}`
      : "Doctor did not return a readable report. Check the local runtime and try again." };
  }
  return { kind: "report", ok: report.ok, nodes, edges, broken, warnings, errors };
}
