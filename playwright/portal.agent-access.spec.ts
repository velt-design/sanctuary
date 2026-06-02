import { test } from '@playwright/test';

import {
  attachPortalBrowserEvidence,
  expectVisiblePortalProject,
  installPortalBrowserEvidence,
  openPortalPage,
} from './support/portalAgent';
import { agentAccessSmokeRoutes } from './support/portalRouteCatalog';

test.describe.configure({ mode: 'serial' });

test('agent can open core authenticated portal pages', async ({ page }, testInfo) => {
  const evidence = installPortalBrowserEvidence(page);

  try {
    for (const route of agentAccessSmokeRoutes) {
      await openPortalPage(page, route.runnableRoute, { heading: route.expectedHeading });

      if (route.dataRequirement === 'visible_project') {
        await expectVisiblePortalProject(page);
      }
    }
  } finally {
    await attachPortalBrowserEvidence(testInfo, page, evidence);
  }
});
