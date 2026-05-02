import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/portal-staff.json';

setup('authenticate portal admin session', async ({ page }) => {
  const email = process.env.PORTAL_TEST_EMAIL?.trim();
  const password = process.env.PORTAL_TEST_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error(
      'PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD must be set before capturing portal auth state. Run npm run portal:auth-env for the credential preflight.'
    );
  }

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
  } catch (error) {
    throw new Error(
      `Portal auth setup did not leave /login after submitting staff test credentials. Check PORTAL_TEST_EMAIL, PORTAL_TEST_PASSWORD, and the portal auth backend. Original error: ${String(error)}`
    );
  }

  if (page.url().includes('/access-status')) {
    throw new Error(
      'Portal auth setup reached /access-status instead of an authenticated staff page. Confirm the test account has an active staff or admin portal role and schedule access is ready.'
    );
  }

  await page.context().storageState({ path: authFile });
});
