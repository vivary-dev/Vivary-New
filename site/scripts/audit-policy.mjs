// The site audit fails on every high or critical advisory that no current exception covers.
// Each exception names one advisory, the severity it was reviewed at, why it cannot reach a site
// visitor, the date it was added, and the first day it no longer applies, at most 30 days later.
// An exception that breaks these rules or has expired fails the audit even after the advisory is
// gone, so it cannot outlive its review.
export const allowedAdvisories = [
  {
    id: 'GHSA-ch52-4w7c-c8xp',
    severity: 'high',
    reason:
      'http-cache-semantics has no patched release, and Astro uses it only to cache remote images during the static build, which has no shared cache that serves several users.',
    added: '2026-10-03',
    expires: '2026-11-02',
  },
];

const maxExceptionDays = 30;

// Ordered from least to most severe.
const blockingSeverities = ['high', 'critical'];

const advisoryId = (advisory) =>
  /\/(GHSA(?:-[0-9a-z]{4}){3})$/i.exec(advisory.url ?? '')?.[1] ??
  advisory.url ??
  `npm advisory ${advisory.source}`;

// Days since 1970-01-01 for a real YYYY-MM-DD calendar date, else undefined. The round trip refuses
// dates such as 2026-02-30, which Date.parse rolls into the next month.
const dayNumber = (value) => {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value) ? time / 86_400_000 : undefined;
};

const exceptionProblem = (entry, today) => {
  const added = dayNumber(entry.added);
  const expires = dayNumber(entry.expires);
  if (added === undefined || expires === undefined) {
    return `needs added and expiry dates in YYYY-MM-DD form, not ${entry.added} and ${entry.expires}`;
  }
  if (!blockingSeverities.includes(entry.severity)) {
    return `needs the severity it was reviewed at, high or critical, not ${entry.severity}`;
  }
  if (added > today) return `was added on ${entry.added}, which is in the future`;
  if (expires - added > maxExceptionDays) {
    return `expires ${expires - added} days after it was added, more than ${maxExceptionDays}`;
  }
  if (today >= expires) {
    return `expired on ${entry.expires}. Fix the advisory, or review the exception and set new dates`;
  }
  return undefined;
};

// `report` is parsed version 2 `npm audit --json` output. A string in `via` names another
// vulnerable package, and that package's entry carries the advisory.
export const reportedAdvisories = (report) =>
  Object.values(report.vulnerabilities).flatMap(({ via }) =>
    via
      .filter((advisory) => typeof advisory === 'object')
      .map((advisory) => {
        const id = advisoryId(advisory);
        const summary = `${advisory.severity} ${id} in ${advisory.name} ${advisory.range}: ${advisory.title}`;
        return { id, severity: advisory.severity, summary };
      }),
  );

// `today` is a UTC date in YYYY-MM-DD form.
export const auditFailures = (report, allowlist, today) => {
  if (report?.auditReportVersion !== 2) {
    return [`npm audit did not return a version 2 report: ${JSON.stringify(report).slice(0, 500)}`];
  }
  const failures = [];
  const reviewedSeverity = new Map();
  for (const entry of allowlist) {
    const problem = exceptionProblem(entry, dayNumber(today));
    if (problem) failures.push(`${entry.id} exception ${problem}.`);
    else reviewedSeverity.set(entry.id, entry.severity);
  }
  for (const advisory of reportedAdvisories(report)) {
    const rank = blockingSeverities.indexOf(advisory.severity);
    if (rank === -1) continue;
    const reviewed = reviewedSeverity.get(advisory.id);
    if (reviewed === undefined) failures.push(advisory.summary);
    else if (rank > blockingSeverities.indexOf(reviewed)) {
      failures.push(`${advisory.summary} (severity rose past the reviewed ${reviewed})`);
    }
  }
  return failures;
};
