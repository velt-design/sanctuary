const requiredEnv = ['PORTAL_TEST_EMAIL', 'PORTAL_TEST_PASSWORD'];

const missing = requiredEnv.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error('Authenticated portal browser gates require staff test credentials.');
  console.error(`Missing required env: ${missing.join(', ')}`);
  console.error(
    'Set PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD before running npm run test:portal:browser:auth, npm run test:portal:smoke, npm run test:portal:performance, or npm run portal:doctor.'
  );
  console.error(
    'The no-auth drawing fixture gate remains available separately with npm run test:portal:browser.'
  );
  process.exit(1);
}

console.log('portal-auth-env: ok (PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are set)');
