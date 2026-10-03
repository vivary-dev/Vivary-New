// The site audit fails on every high or critical advisory that no current exception covers.
// Each exception names one GHSA advisory, the package it covers, the severity it was reviewed at,
// why it cannot reach a site visitor, the date it was added, and the first day it no longer
// applies, at most 30 days later. Dates are UTC calendar dates. An exception that breaks these
// rules or has expired fails the audit even after the advisory is gone, so it cannot outlive its
// review.
export const allowedAdvisories = [
  {
    id: 'GHSA-ch52-4w7c-c8xp',
    package: 'http-cache-semantics',
    severity: 'high',
    reason:
      'http-cache-semantics has no patched release, and Astro uses it only to cache remote images during the static build, which has no shared cache that serves several users.',
    added: '2026-10-03',
    expires: '2026-11-02',
  },
];

const maxExceptionDays = 30;

// npm's severities from least to most severe. The last two block the audit.
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const blockingSeverities = severities.slice(3);
const rank = (severity) => severities.indexOf(severity);

const ghsaId = /^GHSA(?:-[0-9a-z]{4}){3}$/i;

// The GHSA id that ends an advisory's URL. A URL in any other form, or none, stands in as the id,
// so it matches no exception.
const advisoryId = (advisory) =>
  /\/(GHSA(?:-[0-9a-z]{4}){3})$/i.exec(advisory.url ?? '')?.[1] ??
  advisory.url ??
  `npm advisory ${advisory.source}`;

// An exception covers one advisory in one package. GHSA ids match in any letter case.
const exceptionKey = (packageName, id) => `${packageName} ${id.toLowerCase()}`;

// The UTC calendar date of an instant, in YYYY-MM-DD form.
export const utcDate = (instant) => instant.toISOString().slice(0, 10);

// Days since 1970-01-01 for a real YYYY-MM-DD calendar date, else undefined. The round trip refuses
// dates such as 2026-02-30, which Date.parse rolls into the next month.
const dayNumber = (value) => {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN;
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value) ? time / 86_400_000 : undefined;
};

const isText = (value) => typeof value === 'string' && value.trim() !== '';

const exceptionProblem = (entry, today) => {
  if (!ghsaId.test(entry.id)) return 'needs a GHSA id';
  if (!isText(entry.package)) return 'needs the package it covers';
  if (!isText(entry.reason)) return 'needs a reason';
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

// Refuses npm output the audit cannot account for, so a changed or partial report fails instead of
// passing with nothing found. In a version 2 report a string in `via` names another vulnerable
// package, and that package's entry carries the advisory.
const reportProblem = (report) => {
  if (report?.auditReportVersion !== 2) return 'is not a version 2 report';
  if (!(report.metadata?.dependencies?.total > 0)) return 'audited no dependencies';
  const entries = report.vulnerabilities;
  if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) {
    return 'has no vulnerabilities object';
  }
  for (const [name, entry] of Object.entries(entries)) {
    if (!Array.isArray(entry?.via)) return `has no via list for ${name}`;
    const sources = entry.via.map((via) => (typeof via === 'string' ? entries[via]?.severity : via?.severity));
    if ([entry.severity, ...sources].some((severity) => rank(severity) === -1)) {
      return `has an unknown severity for ${name} or its advisories`;
    }
    if (!sources.some((severity) => rank(severity) >= rank(entry.severity))) {
      return `cannot trace the ${entry.severity} severity of ${name} to an advisory`;
    }
  }
  for (const severity of blockingSeverities) {
    const counted = report.metadata.vulnerabilities?.[severity];
    const listed = Object.values(entries).filter((entry) => entry.severity === severity).length;
    if (counted !== listed) return `counts ${counted} ${severity} packages but lists ${listed}`;
  }
  return undefined;
};

// `report` is parsed `npm audit --json` output that `reportProblem` accepted.
export const reportedAdvisories = (report) =>
  Object.values(report.vulnerabilities).flatMap(({ via }) =>
    via
      .filter((advisory) => typeof advisory === 'object')
      .map((advisory) => {
        const id = advisoryId(advisory);
        const summary = `${advisory.severity} ${id} in ${advisory.name} ${advisory.range}: ${advisory.title}`;
        return { id, package: advisory.name, severity: advisory.severity, summary };
      }),
  );

// `today` is a UTC date in YYYY-MM-DD form.
export const auditFailures = (report, allowlist, today) => {
  const problem = reportProblem(report);
  if (problem) return [`npm audit output ${problem}: ${JSON.stringify(report).slice(0, 500)}`];
  const now = dayNumber(today);
  if (now === undefined) return [`today must be a UTC date in YYYY-MM-DD form, not ${today}`];
  const failures = [];
  const reviewedSeverity = new Map();
  for (const entry of allowlist) {
    const entryProblem = exceptionProblem(entry, now);
    if (entryProblem) failures.push(`${entry.id} exception ${entryProblem}.`);
    else reviewedSeverity.set(exceptionKey(entry.package, entry.id), entry.severity);
  }
  for (const advisory of reportedAdvisories(report)) {
    if (!blockingSeverities.includes(advisory.severity)) continue;
    const reviewed = reviewedSeverity.get(exceptionKey(advisory.package, advisory.id));
    if (reviewed === undefined) failures.push(advisory.summary);
    else if (rank(advisory.severity) > rank(reviewed)) {
      failures.push(`${advisory.summary} (severity rose past the reviewed ${reviewed})`);
    }
  }
  return failures;
};
