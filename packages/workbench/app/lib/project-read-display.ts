import type { Omission } from "./project-read-schema";

// The Tropo omissions that make a check or find incomplete, by kind and reason
// as its public facade writes them. Deliberate exclusions have no sentence here.
const INCOMPLETE: Record<string, string> = {
  "result/budget_limit": "The token budget cut the results short, so more context may exist.",
  "filesystem/directory_unavailable": "Some folders could not be read.",
  "filesystem/entry_unavailable": "Some files could not be read.",
  "config/unavailable": "The workspace settings could not be read.",
  "document/analysis_unavailable": "Some notes could not be analyzed.",
  "edge/edge_limit_or_unsafe": "Some links between notes were left out.",
};
// Tropo writes most private exclusions as `privacy_excluded`, and some under
// another kind with one of these reasons, such as a Git-ignored config file.
const PRIVATE_REASONS = new Set(["git_ignored", "sensitive_name", "sensitive_content"]);
const isPrivate = (omission: Omission) => omission.kind === "privacy_excluded" || PRIVATE_REASONS.has(omission.reason);

/** "3 private files excluded", or null when nothing private was left out. */
export function privateExcluded(omissions: Omission[]): string | null {
  const count = omissions.filter(isPrivate).reduce((sum, omission) => sum + omission.count, 0);
  return count > 0 ? `${count} private file${count === 1 ? "" : "s"} excluded` : null;
}

/**
 * Why an incomplete report did not read everything, or null when private
 * exclusions, which the panel counts apart, are the only cause. Any other
 * cause is a read failure.
 */
export function incompleteNote(omissions: Omission[]): string | null {
  const others = omissions.filter(omission => !isPrivate(omission));
  const reasons = new Set(others.map(omission => INCOMPLETE[`${omission.kind}/${omission.reason}`])
    .filter((sentence): sentence is string => sentence !== undefined));
  if (reasons.size > 0) return [...reasons].join(" ");
  return others.length > 0 || omissions.length === 0 ? "Some files could not be read." : null;
}
