// Audits the site's locked dependencies from any working directory. The policy and its exceptions
// live in audit-policy.mjs.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allowedAdvisories, auditFailures, reportedAdvisories, utcDate } from './audit-policy.mjs';

// --offline=false outranks an offline setting in any .npmrc file or npm_config_offline, which would
// make npm print an empty report that passes. npm audit exits 1 whenever it finds an advisory, so
// the report decides the result, not the exit code.
const args = ['audit', '--json', '--offline=false'];
const options = {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
};
// Windows starts npm through its npm.cmd shim, which needs a shell. The arguments are constants.
const audit =
  process.platform === 'win32'
    ? spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true })
    : spawnSync('npm', args, options);
if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  report = { stderr: audit.stderr };
}

const failures = auditFailures(report, allowedAdvisories, utcDate(new Date()));
if (failures.length) {
  console.error(`${failures.length} site audit failure(s):\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  for (const { summary } of reportedAdvisories(report)) console.log(`Found ${summary}`);
  for (const { id, package: packageName, severity, expires, reason } of allowedAdvisories) {
    console.log(`Allowed in ${packageName} at ${severity} until ${expires}: ${id}. ${reason}`);
  }
  console.log('No other high or critical advisory.');
}
