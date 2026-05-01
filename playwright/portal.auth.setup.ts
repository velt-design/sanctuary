import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/portal-staff.json';

setup('authenticate portal admin session', async ({ page }) => {
  const email = process.env.PORTAL_TEST_EMAIL?.trim();
  const password = process.env.PORTAL_TEST_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error('PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD must be set to capture portal auth state.');
  }

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
  await page.context().storageState({ path: authFile });
});
