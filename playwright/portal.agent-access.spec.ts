import { test } from '@playwright/test';

import {
  attachPortalBrowserEvidence,
  expectVisiblePortalProject,
  installPortalBrowserEvidence,
  openPortalPage,
} from './support/portalAgent';

test.describe.configure({ mode: 'serial' });

test('agent can open core authenticated portal pages', async ({ page }, testInfo) => {
  const evidence = installPortalBrowserEvidence(page);

  try {
    await openPortalPage(page, '/dashboard', { heading: 'Dashboard' });

    await openPortalPage(page, '/staff/projects', { heading: 'Projects' });
    await expectVisiblePortalProject(page);

    await openPortalPage(page, '/staff/contacts', { heading: 'Contacts' });
    await openPortalPage(page, '/staff/schedule', { heading: 'Schedule' });
  } finally {
    await attachPortalBrowserEvidence(testInfo, page, evidence);
  }
});
