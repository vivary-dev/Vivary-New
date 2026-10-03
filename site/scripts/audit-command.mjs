// Runs npm audit on the site's lockfile and applies the policy in audit-policy.mjs. audit.mjs is the
// command CI runs.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

// npm reads its project config from site/.npmrc. When a root package.json lists site/ in its
// workspaces, npm treats the repository root as the project and reads the root .npmrc and lockfile
// instead. The flags above don't cover every setting an .npmrc file can hold, so an .npmrc in either
// place stops the audit. Workspace entries can be globs, so any root workspaces field stops it too.
const npmrcNote =
  "The audit's flags override offline, registry, and include, not every setting an .npmrc file can " +
  'hold, such as a proxy or a certificate authority. Remove the file, or change the audit command after review.';

const npmConfigProblem = () => {
  if (existsSync(new URL('../.npmrc', import.meta.url))) return `site/.npmrc exists. ${npmrcNote}`;
  if (existsSync(new URL('../../.npmrc', import.meta.url))) return `The repository root .npmrc exists. ${npmrcNote}`;
  const rootPackage = new URL('../../package.json', import.meta.url);
  if (!existsSync(rootPackage)) return undefined;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(rootPackage, 'utf8'));
  } catch {
    return 'The repository root package.json is not valid JSON, so the audit cannot tell whether npm reads site/ as a workspace.';
  }
  if (manifest?.workspaces === undefined) return undefined;
  return (
    'The repository root package.json declares workspaces, so npm could read the root .npmrc and ' +
    'lockfile in place of site/. Remove the workspaces field, or change the audit command after review.'
  );
};

// Returns the exit code and the text to print. Tests pass a fixed `now`, their own allowlist, and a
// recorded npm result. audit.mjs passes nothing, so CI always audits with the real clock and list.
export const auditSite = ({ now = new Date(), allowlist = allowedAdvisories, npmAudit = runNpmAudit } = {}) => {
  const configProblem = npmConfigProblem();
  if (configProblem) return { exitCode: 1, output: configProblem };
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
