// The site audit fails on every high or critical advisory that no current exception covers.
// Each exception names one advisory, why it cannot reach a site visitor, and the first day it no
// longer applies. An expired exception fails the audit even after the advisory is gone, so it
// cannot outlive its review.
export const allowedAdvisories = [
  {
    id: 'GHSA-ch52-4w7c-c8xp',
    reason:
      'http-cache-semantics has no patched release, and Astro uses it only to cache remote images during the static build, which has no shared cache that serves several users.',
    expires: '2026-11-02',
  },
];

const blockingSeverities = new Set(['high', 'critical']);

const advisoryId = (advisory) =>
  /\/(GHSA(?:-[0-9a-z]{4}){3})$/i.exec(advisory.url ?? '')?.[1] ??
  advisory.url ??
  `npm advisory ${advisory.source}`;

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

// `today` is a UTC date in YYYY-MM-DD form, so comparing it with an expiry string orders the dates.
export const auditFailures = (report, allowlist, today) => {
  if (report?.auditReportVersion !== 2) {
    return [`npm audit did not return a version 2 report: ${JSON.stringify(report).slice(0, 500)}`];
  }
  const failures = [];
  const allowed = new Set();
  for (const entry of allowlist) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) {
      failures.push(`${entry.id} exception needs an expiry date in YYYY-MM-DD form, not ${entry.expires}.`);
    } else if (today < entry.expires) {
      allowed.add(entry.id);
    } else {
      failures.push(`${entry.id} exception expired on ${entry.expires}. Fix the advisory, or review the exception and set a new date.`);
    }
  }
  for (const advisory of reportedAdvisories(report)) {
    if (blockingSeverities.has(advisory.severity) && !allowed.has(advisory.id)) failures.push(advisory.summary);
  }
  return failures;
};
