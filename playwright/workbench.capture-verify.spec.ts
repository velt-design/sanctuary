import { expect, test } from '@playwright/test';

import { openPortalPage } from './support/portalAgent';
import {
  attachWorkbenchCaptureVerification,
  readAndVerifyWorkbenchMultiHouseRoofFailureCapture,
} from './support/workbenchCaptureVerifier';

const DEFAULT_WORKBENCH_CAPTURE_ROUTE =
  '/staff/projects/proj_76a726e3-b0a3-4c17-9a29-613482645a8f/design-workbench';

test('captures a verified multi-house roof failure payload from the real workbench', async ({
  page,
}, testInfo) => {
  const target = process.env.WORKBENCH_CAPTURE_URL?.trim() || DEFAULT_WORKBENCH_CAPTURE_ROUTE;

  await openPortalPage(page, target, { timeout: 90_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const { payload, verification } = await readAndVerifyWorkbenchMultiHouseRoofFailureCapture(page);
  await attachWorkbenchCaptureVerification(testInfo, payload, verification, {
    routeId: 'workbench.capture-verify',
    route: target,
    pageId: 'design-workbench',
  });

  expect(verification.ok, verification.message).toBe(true);
});
