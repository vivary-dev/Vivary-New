import type { Omission } from "./project-read-schema";

// Tropo's public facade does not yet say which omissions made a report
// incomplete, so the panel claims only what the rows state outright. PR #90
// records the facade change that would make these counts explicit.

/** "3 private files excluded" from Git and workspace privacy, or null. */
export function privateExcluded(omissions: Omission[]): string | null {
  const count = omissions.filter(omission => omission.kind === "privacy_excluded")
    .reduce((sum, omission) => sum + omission.count, 0);
  return count > 0 ? `${count} private file${count === 1 ? "" : "s"} excluded` : null;
}

/** Files and folders Tropo skipped because a name or the content looks sensitive, or null. */
export function sensitiveExcluded(omissions: Omission[]): string | null {
  const sensitive = omissions.filter(omission => omission.reason === "sensitive_name" || omission.reason === "sensitive_content");
  const total = (rows: Omission[]) => rows.reduce((sum, omission) => sum + omission.count, 0);
  const folders = total(sensitive.filter(omission => omission.kind === "filesystem"));
  const files = total(sensitive.filter(omission => omission.kind !== "filesystem"));
  const parts = [files && `${files} file${files === 1 ? "" : "s"}`, folders && `${folders} folder${folders === 1 ? "" : "s"}`]
    .filter(Boolean);
  if (parts.length === 0) return null;
  return `${parts.join(" and ")} left out because ${files + folders === 1 ? "its" : "their"} name or content looks sensitive`;
}

/** The note for a report whose `complete` is false. It names a cause only when the rows state it. */
export function incompleteNote(omissions: Omission[]): string {
  const budget = omissions.some(omission => omission.kind === "result" && omission.reason === "budget_limit");
  return budget ? "This report is incomplete. The token budget cut the results short, so more context may exist."
    : "This report is incomplete.";
}
