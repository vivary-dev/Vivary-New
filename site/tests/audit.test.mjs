import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { allowedAdvisories, auditFailures, utcDate } from '../scripts/audit-policy.mjs';

// `npm audit --json` output recorded with npm 12.0.2 on 2026-10-03. `site` is this site's lockfile,
// and `offline` is the same lockfile audited with `--offline`. `other-high` and `moderate` are
// lockfiles that pin http-cache-semantics 4.2.0 beside braces 3.0.2 or word-wrap 1.2.3.
// `no-lockfile` is the error npm prints in a folder without a lockfile.
const fixturePath = (name) => fileURLToPath(new URL(`fixtures/audit/${name}.json`, import.meta.url));
const report = (name) => JSON.parse(readFileSync(fixturePath(name), 'utf8'));
const lastAllowedDay = '2026-11-01';
const exception = allowedAdvisories[0];

// Audits the site report with the allowed entry changed as given.
const withEntry = (change, today = '2026-10-10') =>
  auditFailures(report('site'), [{ ...exception, ...change }], today);

// Audits the site report after `change` edits it.
const withSiteReport = (change, today = lastAllowedDay) => {
  const site = report('site');
  change(site);
  return auditFailures(site, allowedAdvisories, today);
};
const allowedAdvisory = (site) => site.vulnerabilities['http-cache-semantics'].via[0];

// The stub is a POSIX shell script, and CI runs these tests on Ubuntu only.
const posixOnly = { skip: process.platform === 'win32' && 'the npm stub is a POSIX shell script' };

// Runs the audit command with an `npm` stub first on PATH. The stub prints the fixture, or nothing,
// only for an online audit. Otherwise it prints the empty report an offline npm config produces.
const runAudit = (fixture) => {
  const bin = mkdtempSync(path.join(tmpdir(), 'site-audit-npm-'));
  try {
    const stub = path.join(bin, 'npm');
    const online = fixture ? `cat '${fixturePath(fixture)}'` : 'exit 1';
    writeFileSync(
      stub,
      `#!/bin/sh\ncase "$*" in\n  *--offline=false*) ${online} ;;\n  *) cat '${fixturePath('offline')}' ;;\nesac\n`,
    );
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
  assert.deepEqual(failures.sort(), [
    'high GHSA-grv7-fg5c-xmjg in braces <3.0.3: Uncontrolled resource consumption in braces',
    'high GHSA-vfj7-8cjw-p6xm in braces <=3.0.3: braces vulnerable to stack-exhaustion denial of service through deeply nested patterns',
  ]);
});

test('a critical advisory fails', () => {
  const failures = withSiteReport((site) => {
    Object.assign(allowedAdvisory(site), {
      severity: 'critical',
      url: 'https://github.com/advisories/GHSA-2222-3333-4444',
    });
    site.vulnerabilities['http-cache-semantics'].severity = 'critical';
    site.metadata.vulnerabilities.high -= 1;
    site.metadata.vulnerabilities.critical += 1;
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^critical GHSA-2222-3333-4444 in http-cache-semantics /);
});

test('the allowed advisory fails once its severity rises past the reviewed one', () => {
  const failures = withSiteReport((site) => {
    allowedAdvisory(site).severity = 'critical';
    site.vulnerabilities['http-cache-semantics'].severity = 'critical';
    site.metadata.vulnerabilities.high -= 1;
    site.metadata.vulnerabilities.critical += 1;
  });
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /^critical GHSA-ch52-4w7c-c8xp in http-cache-semantics .*\(severity rose past the reviewed high\)$/,
  );
});

test('the allowed advisory fails in another package', () => {
  const failures = withSiteReport((site) => {
    allowedAdvisory(site).name = 'other-package';
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^high GHSA-ch52-4w7c-c8xp in other-package /);
});

test('advisory ids match in any letter case', () => {
  const lowercaseUrl = withSiteReport((site) => {
    allowedAdvisory(site).url = 'https://github.com/advisories/ghsa-CH52-4w7c-c8xp';
  });
  assert.deepEqual(lowercaseUrl, []);
  assert.deepEqual(withEntry({ id: 'ghsa-ch52-4w7c-c8xp' }), []);
});

test('an advisory URL in another form, or none, fails closed', () => {
  const trailingSlash = withSiteReport((site) => {
    allowedAdvisory(site).url = 'https://github.com/advisories/GHSA-ch52-4w7c-c8xp/';
  });
  assert.deepEqual(trailingSlash, [
    'high https://github.com/advisories/GHSA-ch52-4w7c-c8xp/ in http-cache-semantics <=4.2.0: http-cache-semantics max-stale handling can disclose cross-user cached responses',
  ]);
  const noUrl = withSiteReport((site) => {
    delete allowedAdvisory(site).url;
  });
  assert.equal(noUrl.length, 1);
  assert.match(noUrl[0], /^high npm advisory 1240991 in http-cache-semantics /);
});

test('an expired exception fails, even after its advisory is gone', () => {
  const failures = auditFailures(report('site'), allowedAdvisories, '2026-11-02');
  assert.match(failures[0], /^GHSA-ch52-4w7c-c8xp exception expired on 2026-11-02\./);
  const clean = report('offline');
  assert.deepEqual(auditFailures(clean, allowedAdvisories, '2026-11-02'), [failures[0]]);
});

test('an exception added in the future fails', () => {
  assert.deepEqual(auditFailures(report('site'), allowedAdvisories, '2026-10-03'), []);
  assert.match(
    auditFailures(report('site'), allowedAdvisories, '2026-10-02')[0],
    /^GHSA-ch52-4w7c-c8xp exception was added on 2026-10-03, which is in the future\./,
  );
  assert.match(
    withEntry({ added: '2026-10-11' })[0],
    /^GHSA-ch52-4w7c-c8xp exception was added on 2026-10-11, which is in the future\./,
  );
});

test('an exception that expires more than 30 days after it was added fails', () => {
  assert.deepEqual(withEntry({ added: '2026-10-03', expires: '2026-11-02' }), []);
  assert.match(
    withEntry({ added: '2026-10-02' })[0],
    /^GHSA-ch52-4w7c-c8xp exception expires 31 days after it was added, more than 30\./,
  );
});

test('exception dates outside YYYY-MM-DD form fail', () => {
  for (const change of [
    { expires: '2026-11-2' },
    { expires: '2026-11' },
    { added: '2026/10/03' },
    { added: '2026-02-30' },
    { expires: undefined },
  ]) {
    assert.match(
      withEntry(change)[0],
      /^GHSA-ch52-4w7c-c8xp exception needs added and expiry dates in YYYY-MM-DD form/,
      JSON.stringify(change),
    );
  }
});

test('an exception without a reviewed high or critical severity fails', () => {
  for (const severity of [undefined, 'moderate']) {
    assert.match(
      withEntry({ severity })[0],
      /^GHSA-ch52-4w7c-c8xp exception needs the severity it was reviewed at/,
      String(severity),
    );
  }
});

test('an exception without a GHSA id, a package, or a reason fails', () => {
  for (const [change, message] of [
    [{ id: 'GHSA-ch52-4w7c' }, /^GHSA-ch52-4w7c exception needs a GHSA id\.$/],
    [{ id: 'CVE-2026-0001' }, /^CVE-2026-0001 exception needs a GHSA id\.$/],
    [{ package: undefined }, /^GHSA-ch52-4w7c-c8xp exception needs the package it covers\.$/],
    [{ package: ' ' }, /^GHSA-ch52-4w7c-c8xp exception needs the package it covers\.$/],
    [{ reason: undefined }, /^GHSA-ch52-4w7c-c8xp exception needs a reason\.$/],
    [{ reason: '' }, /^GHSA-ch52-4w7c-c8xp exception needs a reason\.$/],
  ]) {
    assert.match(withEntry(change)[0], message, JSON.stringify(change));
  }
});

test('a date that is not a UTC calendar date cannot serve as today', () => {
  for (const today of ['2026-10-3', undefined, 'Sat Oct 03 2026']) {
    assert.deepEqual(auditFailures(report('site'), allowedAdvisories, today), [
      `today must be a UTC date in YYYY-MM-DD form, not ${today}`,
    ]);
  }
});

test('utcDate gives the UTC calendar date of an instant', () => {
  assert.equal(utcDate(new Date('2026-11-01T23:30:00-05:00')), '2026-11-02');
  assert.equal(utcDate(new Date('2026-11-01T23:59:59Z')), '2026-11-01');
  assert.equal(utcDate(new Date('2026-11-02T00:00:00+01:00')), '2026-11-01');
});

test('a moderate advisory passes', () => {
  const moderate = report('moderate');
  assert.ok(moderate.metadata.vulnerabilities.moderate > 0);
  assert.deepEqual(auditFailures(moderate, allowedAdvisories, lastAllowedDay), []);
});

test('npm output the audit cannot account for fails closed', () => {
  const cases = [
    [() => report('no-lockfile'), /is not a version 2 report/],
    [() => ({ ...report('offline'), metadata: { vulnerabilities: {}, dependencies: { total: 0 } } }), /audited no dependencies/],
    [() => { const site = report('site'); delete site.vulnerabilities; return site; }, /has no vulnerabilities object/],
    [() => { const site = report('site'); delete site.vulnerabilities.astro.via; return site; }, /has no via list for astro/],
    [() => { const site = report('site'); allowedAdvisory(site).severity = 'High'; return site; }, /has an unknown severity for http-cache-semantics/],
    [() => { const site = report('site'); site.vulnerabilities.astro.severity = 'severe'; return site; }, /has an unknown severity for /],
    [() => { const site = report('site'); site.vulnerabilities.astro.via = ['missing-package']; return site; }, /has an unknown severity for astro/],
    [() => { const site = report('site'); site.vulnerabilities.astro.severity = 'critical'; return site; }, /cannot trace the critical severity of astro to an advisory/],
    [() => { const site = report('site'); site.metadata.vulnerabilities.high = 6; return site; }, /counts 6 high packages but lists 5/],
    [() => { const site = report('site'); site.metadata.vulnerabilities.critical = 1; return site; }, /counts 1 critical packages but lists 0/],
  ];
  for (const [build, message] of cases) {
    const failures = auditFailures(build(), allowedAdvisories, lastAllowedDay);
    assert.equal(failures.length, 1, String(message));
    assert.match(failures[0], new RegExp(`^npm audit output ${message.source}`));
  }
});

test('the audit command exits 1 on a blocking advisory, an npm error, or no output', posixOnly, () => {
  for (const fixture of ['other-high', 'no-lockfile', null]) {
    const result = runAudit(fixture);
    assert.equal(result.status, 1, `${fixture ?? 'no output'}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /site audit failure/);
  }
});

test('the audit command passes the site report until the exception expires', posixOnly, () => {
  const result = runAudit('site');
  if (utcDate(new Date()) < exception.expires) {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Found high GHSA-ch52-4w7c-c8xp in http-cache-semantics /m);
    assert.match(result.stdout, /^Allowed in http-cache-semantics at high until 2026-11-02: GHSA-ch52-4w7c-c8xp\./m);
  } else {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GHSA-ch52-4w7c-c8xp exception expired on 2026-11-02/);
  }
});
