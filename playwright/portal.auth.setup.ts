import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authFile = 'playwright/.auth/portal-staff.json';

function loadEnvFile(filePath: string) {
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

function loadPortalAgentEnv() {
  loadEnvFile(path.resolve(process.cwd(), '.env.agent.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));
}

setup('authenticate portal admin session', async ({ page }) => {
  loadPortalAgentEnv();

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
    await page.getByRole('textbox', { name: 'Password' }).fill('').catch(() => {});
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
