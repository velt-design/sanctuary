import { test } from '@playwright/test';

import {
  expectVisiblePortalProject,
  openPortalPage,
  withPortalBrowserEvidence,
} from './support/portalAgent';
import { agentAccessSmokeRoutes } from './support/portalRouteCatalog';

test.describe.configure({ mode: 'serial' });

test('agent can open core authenticated portal pages', async ({ page }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { phase: 'agent-access' }, async () => {
    for (const route of agentAccessSmokeRoutes) {
      await openPortalPage(page, route.runnableRoute, { heading: route.expectedHeading });

      if (route.dataRequirement === 'visible_project') {
        await expectVisiblePortalProject(page);
      }
    }
  });
});
