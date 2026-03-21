# Portal Browser Harness

This folder contains the minimal Playwright setup for authenticated portal smoke checks.

Required environment variables:

- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`

Optional environment variables:

- `PORTAL_BASE_URL` if the portal is already running somewhere other than `http://127.0.0.1:3001`
- `PORTAL_DRAWING_URL` to point the smoke test at a known project/design page instead of discovering one from `/staff/projects`

Default run:

```powershell
$env:PORTAL_TEST_EMAIL='staff@example.com'
$env:PORTAL_TEST_PASSWORD='super-secret'
npm run test:portal:browser
```

The auth setup project logs in once and saves local auth state to `playwright/.auth/portal-staff.json`, which is gitignored.

Useful commands:

```powershell
# refresh local auth state only
$env:PORTAL_TEST_EMAIL='staff@example.com'
$env:PORTAL_TEST_PASSWORD='super-secret'
npm run test:portal:browser:auth

# run the drawing workbench smoke in a headed browser
$env:PORTAL_TEST_EMAIL='staff@example.com'
$env:PORTAL_TEST_PASSWORD='super-secret'
npm run test:portal:browser:headed
```
