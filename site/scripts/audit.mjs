// CI runs this from site/ to audit the locked dependencies. The policy and its exceptions live in
// audit-policy.mjs.
import { spawnSync } from 'node:child_process';
import { allowedAdvisories, auditFailures, reportedAdvisories } from './audit-policy.mjs';

// npm audit exits 1 whenever it finds an advisory, so the report decides the result, not the exit code.
const audit = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  report = { stderr: audit.stderr };
}

const failures = auditFailures(report, allowedAdvisories, new Date().toISOString().slice(0, 10));
if (failures.length) {
  console.error(`${failures.length} site audit failure(s):\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  for (const { summary } of reportedAdvisories(report)) console.log(`Found ${summary}`);
  for (const { id, expires, reason } of allowedAdvisories) {
    console.log(`Allowed until ${expires}: ${id}. ${reason}`);
  }
  console.log('No other high or critical advisory.');
}
