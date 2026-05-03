import { spawnSync } from 'node:child_process';
import {
  changedModeDescription,
  HAS_ARCHITECTURE_COMPARE,
} from './changed-file-utils.mjs';

const STRICT = process.argv.includes('--strict');
const CHECKS = [
  { label: 'Worktree ownership', advisoryScript: 'worktree:changed' },
  { label: 'Dead-code pressure', advisoryScript: 'dead-code:changed' },
  { label: 'File decomposition pressure', advisoryScript: 'files:changed', strictScript: 'files:changed:strict' },
  { label: 'Root compatibility growth', advisoryScript: 'root:compat:changed', strictScript: 'root:compat:changed:strict' },
  { label: 'Browser Supabase access', advisoryScript: 'browser:supabase:changed', strictScript: 'browser:supabase:changed:strict' },
  { label: 'Service-role Supabase access', advisoryScript: 'service-role:changed', strictScript: 'service-role:changed:strict' },
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function printSection(label, script) {
  console.log('');
  console.log(`== ${label} ==`);
  console.log(`$ npm run ${script}`);
  console.log('');
}

function runCheck(check) {
  if (STRICT && !check.strictScript) return;
  const script = STRICT ? check.strictScript : check.advisoryScript;
  printSection(check.label, script);
  const result =
    process.platform === 'win32'
      ? spawnSync(`npm run ${script}`, {
          cwd: process.cwd(),
          shell: true,
          stdio: 'inherit',
        })
      : spawnSync(npmCommand, ['run', script], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });

  if (result.error) {
    console.error('');
    console.error(`architecture-changed-report: failed to run npm run ${script}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal) {
    console.error('');
    console.error(`architecture-changed-report: npm run ${script} terminated with ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('');
    console.error(`architecture-changed-report: npm run ${script} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  console.log('architecture-changed-report: changed-file architecture handoff sweep');
  console.log(STRICT ? 'Strict mode: enabled for selective new-growth checks.' : 'This aggregate is advisory and is not part of npm run lint.');
  console.log(`Changed source: ${changedModeDescription()}`);
  if (HAS_ARCHITECTURE_COMPARE) {
    console.log('Base/head comparison mode is enabled by ARCHITECTURE_CHANGED_BASE and ARCHITECTURE_CHANGED_HEAD.');
  }

  for (const check of CHECKS) {
    runCheck(check);
  }

  console.log('');
  console.log('architecture-changed-report: clean');
}

main();
