# Portal Browser Harness

This folder contains the minimal Playwright setup for authenticated portal smoke checks.

Required environment variables:

- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`

Optional environment variables:

- `PORTAL_BASE_URL` if the portal is already running somewhere other than `http://127.0.0.1:3001`
- `PORTAL_DRAWING_URL` to point the smoke test at a known project/design page instead of discovering one from `/staff/projects`

Fixture route:

- `/staff/projects/fixture-roof/design-workbench?fixture=mono-standard` opens the standard Mono drawing workbench fixture used by the Draw Outline browser smoke.
- `playwright/portal.drawing-workbench.spec.ts` uses `openFixtureDrawingWorkbench(page, 'mono-standard')` so the test can skip cleanly when fixture routes are unavailable in an environment.
- The Draw Outline smoke enters Model Space Plan, switches `House footprint mode` to `Draw outline`, verifies landing-marker diagnostics, checks drag-to-pan does not place a point, creates a three-point draft, verifies the close-hover target, and stops before polygon commit. Persistence coverage belongs in later outline interaction specs.

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
