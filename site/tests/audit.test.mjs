import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { allowedAdvisories, auditFailures } from '../scripts/audit-policy.mjs';

// `npm audit --json` output recorded with npm 12.0.2 on 2026-10-03. `site` is this site's lockfile.
// `other-high` and `moderate` are lockfiles that pin http-cache-semantics 4.2.0 beside braces 3.0.2
// or word-wrap 1.2.3. `no-lockfile` is the error npm prints in a folder without a lockfile.
const fixturePath = (name) => fileURLToPath(new URL(`fixtures/audit/${name}.json`, import.meta.url));
const report = (name) => JSON.parse(readFileSync(fixturePath(name), 'utf8'));
const lastAllowedDay = '2026-11-01';

// Runs the audit command with an `npm` stub first on PATH that prints a fixture, or nothing.
const runAudit = (fixture) => {
  const bin = mkdtempSync(path.join(tmpdir(), 'site-audit-npm-'));
  try {
    const stub = path.join(bin, 'npm');
    writeFileSync(stub, `#!/bin/sh\n${fixture ? `cat '${fixturePath(fixture)}'` : 'exit 1'}\n`);
    chmodSync(stub, 0o755);
    return spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/audit.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
};

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

test('a critical advisory fails', () => {
  const site = report('site');
  Object.assign(site.vulnerabilities['http-cache-semantics'].via[0], {
    severity: 'critical',
    url: 'https://github.com/advisories/GHSA-2222-3333-4444',
  });
  const failures = auditFailures(site, allowedAdvisories, lastAllowedDay);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^critical GHSA-2222-3333-4444 in http-cache-semantics /);
});

test('an expired exception fails, even after its advisory is gone', () => {
  const failures = auditFailures(report('site'), allowedAdvisories, '2026-11-02');
  assert.match(failures[0], /^GHSA-ch52-4w7c-c8xp exception expired on 2026-11-02\./);
  const clean = { auditReportVersion: 2, vulnerabilities: {} };
  assert.deepEqual(auditFailures(clean, allowedAdvisories, '2026-11-02'), [failures[0]]);
});

test('an expiry date in another form fails', () => {
  const misdated = [{ ...allowedAdvisories[0], expires: '2026-11-2' }];
  const failures = auditFailures(report('site'), misdated, '2026-11-15');
  assert.match(failures[0], /^GHSA-ch52-4w7c-c8xp exception needs an expiry date in YYYY-MM-DD form/);
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

test('the audit command exits 1 on a blocking advisory, an npm error, or no output', () => {
  for (const fixture of ['other-high', 'no-lockfile', null]) {
    const result = runAudit(fixture);
    assert.equal(result.status, 1, `${fixture ?? 'no output'}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /site audit failure/);
  }
});
