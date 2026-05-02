import { spawnSync } from 'node:child_process';

const CHECKS = [
  { label: 'File decomposition pressure', script: 'files:changed' },
  { label: 'Root compatibility growth', script: 'root:compat:changed' },
  { label: 'Browser Supabase access', script: 'browser:supabase:changed' },
  { label: 'Service-role Supabase access', script: 'service-role:changed' },
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function printSection(label, script) {
  console.log('');
  console.log(`== ${label} ==`);
  console.log(`$ npm run ${script}`);
  console.log('');
}

function runCheck(check) {
  printSection(check.label, check.script);
  const result =
    process.platform === 'win32'
      ? spawnSync(`npm run ${check.script}`, {
          cwd: process.cwd(),
          shell: true,
          stdio: 'inherit',
        })
      : spawnSync(npmCommand, ['run', check.script], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });

  if (result.error) {
    console.error('');
    console.error(`architecture-changed-report: failed to run npm run ${check.script}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal) {
    console.error('');
    console.error(`architecture-changed-report: npm run ${check.script} terminated with ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('');
    console.error(`architecture-changed-report: npm run ${check.script} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  console.log('architecture-changed-report: changed-file architecture handoff sweep');
  console.log('This aggregate is advisory and is not part of npm run lint.');

  for (const check of CHECKS) {
    runCheck(check);
  }

  console.log('');
  console.log('architecture-changed-report: clean');
}

main();
