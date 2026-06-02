import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = cleaned.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.agent.local'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const requiredEnv = ['PORTAL_TEST_EMAIL', 'PORTAL_TEST_PASSWORD'];

const missing = requiredEnv.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error('Authenticated portal browser gates require staff test credentials.');
  console.error(`Missing required env: ${missing.join(', ')}`);
  console.error(
    'Set PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD before running npm run portal:auth-runtime, npm run test:portal:browser:auth, npm run test:portal:smoke, npm run test:portal:performance, or npm run portal:doctor.'
  );
  console.error(
    'The no-auth drawing fixture gate remains available separately with npm run test:portal:browser.'
  );
  process.exit(1);
}

console.log('portal-auth-env: ok (PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are set)');
