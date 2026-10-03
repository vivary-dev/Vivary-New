// Runs npm audit on the site's lockfile and applies the policy in audit-policy.mjs. audit.mjs is the
// command CI runs.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allowedAdvisories, auditFailures, reportedAdvisories, utcDate } from './audit-policy.mjs';

// Each flag outranks the same setting from any .npmrc file, npm_config_* variable, or NODE_ENV.
// --offline=false keeps npm from printing an empty report that passes. --registry keeps the
// advisory request on the public registry. The --include flags keep dev, optional, and peer
// dependencies in the request whatever omit says.
export const npmAuditArgs = [
  'audit',
  '--json',
  '--offline=false',
  '--registry=https://registry.npmjs.org/',
  '--include=dev',
  '--include=optional',
  '--include=peer',
];

const runNpmAudit = () => {
  const options = {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  };
  // Windows starts npm through its npm.cmd shim, which needs a shell. The arguments are constants.
  const audit =
    process.platform === 'win32'
      ? spawnSync(`npm ${npmAuditArgs.join(' ')}`, { ...options, shell: true })
      : spawnSync('npm', npmAuditArgs, options);
  if (audit.error) throw audit.error;
  return audit;
};

// Returns the exit code and the text to print. Tests pass a fixed `now`, their own allowlist, and a
// recorded npm result. audit.mjs passes nothing, so CI always audits with the real clock and list.
export const auditSite = ({ now = new Date(), allowlist = allowedAdvisories, npmAudit = runNpmAudit } = {}) => {
  // npm reads a project .npmrc from site/, and the flags above don't cover every setting it can hold.
  if (existsSync(new URL('../.npmrc', import.meta.url))) {
    return {
      exitCode: 1,
      output:
        "site/.npmrc exists. The audit's flags override offline, registry, and include, not every " +
        'setting an .npmrc file can hold, such as a proxy or a certificate authority. Remove the file, ' +
        'or change the audit command after review.',
    };
  }
  const audit = npmAudit();
  // npm audit exits 1 whenever it finds an advisory, so the report decides the result, not the exit code.
  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    report = { stderr: audit.stderr };
  }
  const failures = auditFailures(report, allowlist, utcDate(now));
  if (failures.length) {
    return { exitCode: 1, output: `${failures.length} site audit failure(s):\n${failures.join('\n')}` };
  }
  const lines = [
    ...reportedAdvisories(report).map(({ summary }) => `Found ${summary}`),
    ...allowlist.map(
      ({ id, package: packageName, severity, expires, reason }) =>
        `Allowed in ${packageName} at ${severity}, expires ${expires} (UTC): ${id}. ${reason}`,
    ),
    'No other high or critical advisory.',
  ];
  return { exitCode: 0, output: lines.join('\n') };
};
