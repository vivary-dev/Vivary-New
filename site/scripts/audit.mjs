// CI runs this from site/. It audits the site's locked dependencies with the real clock and the
// allowlist in audit-policy.mjs.
import { auditSite } from './audit-command.mjs';

const { exitCode, output } = auditSite();
if (exitCode) console.error(output);
else console.log(output);
process.exitCode = exitCode;
