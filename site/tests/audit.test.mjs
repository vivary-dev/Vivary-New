import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { allowedAdvisories, auditFailures } from '../scripts/audit-policy.mjs';

// `npm audit --json` output recorded with npm 12.0.2 on 2026-10-03. `site` is this site's lockfile.
// `other-high` and `moderate` are lockfiles that pin http-cache-semantics 4.2.0 beside braces 3.0.2
// or word-wrap 1.2.3. `no-lockfile` is the error npm prints in a folder without a lockfile.
const report = (name) =>
  JSON.parse(readFileSync(new URL(`fixtures/audit/${name}.json`, import.meta.url), 'utf8'));
const lastAllowedDay = '2026-11-01';

test('the allowed advisory alone passes', () => {
  const site = report('site');
  assert.match(auditFailures(site, [], lastAllowedDay).join('\n'), /GHSA-ch52-4w7c-c8xp/);
  assert.deepEqual(auditFailures(site, allowedAdvisories, lastAllowedDay), []);
});

test('another high advisory fails', () => {
  const failures = auditFailures(report('other-high'), allowedAdvisories, lastAllowedDay);
  assert.deepEqual(
    failures.map((line) => line.split(' ').slice(0, 4).join(' ')).sort(),
    ['high GHSA-grv7-fg5c-xmjg in braces', 'high GHSA-vfj7-8cjw-p6xm in braces'],
  );
});

test('an expired exception fails', () => {
  const failures = auditFailures(report('site'), allowedAdvisories, '2026-11-02');
  assert.match(failures[0], /^GHSA-ch52-4w7c-c8xp exception expired on 2026-11-02\./);
});

test('a moderate advisory passes', () => {
  const moderate = report('moderate');
  assert.ok(moderate.metadata.vulnerabilities.moderate > 0);
  assert.deepEqual(auditFailures(moderate, allowedAdvisories, lastAllowedDay), []);
});

test('an npm error fails closed', () => {
  const failures = auditFailures(report('no-lockfile'), allowedAdvisories, lastAllowedDay);
  assert.match(failures[0], /^npm audit did not return a version 2 report/);
});
