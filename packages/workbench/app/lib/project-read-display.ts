import type { Omission } from "./project-read-schema";

const INCOMPLETE: Record<string, string> = {
  budget_limit: "The search stopped at its token budget.",
  candidate_limit: "The search stopped at its candidate limit.",
  file_size_limit: "Some files were too large to read.",
  directory_unavailable: "Some folders could not be read.",
  entry_unavailable: "Some files could not be read.",
  analysis_unavailable: "Some notes could not be analyzed.",
};

/** "3 private files excluded", or null when nothing private was left out. */
export function privateExcluded(omissions: Omission[]): string | null {
  const count = omissions.filter(omission => omission.kind === "privacy_excluded")
    .reduce((sum, omission) => sum + omission.count, 0);
  return count > 0 ? `${count} private file${count === 1 ? "" : "s"} excluded` : null;
}

/** Why a report did not read everything, from its own omissions. Private files are reported apart. */
export function incompleteNote(omissions: Omission[]): string {
  const reasons = new Set(omissions.filter(omission => omission.kind !== "privacy_excluded")
    .map(omission => INCOMPLETE[omission.kind] ?? "Some files were left out."));
  return reasons.size > 0 ? [...reasons].join(" ") : "Some files were not read.";
}
