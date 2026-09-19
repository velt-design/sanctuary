import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/enquiry', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
});

test('desktop review wins over stale mobile progress after rotating', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => localStorage.setItem('sanctuary.mobile-journey.v1', 'shape'));
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('button', { name: '3 Review', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step', 'review');
  await expect(page.getByRole('region', { name: 'Your pergola review' })).toContainText('5.4 × 3.0');
});

test('enquiry edit overlay returns to the one existing form with details intact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-enquiry');
  await page.locator('#contact-name').fill('Synthetic returning customer');
  await page.getByRole('link', { name: /Edit my design/ }).click();
  for (const name of ['Set your size', 'Add sides & lighting', 'Review your design']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Design your pergola' })).not.toBeVisible();
  await expect(page.locator('#contact-name')).toHaveCount(1);
  await expect(page.locator('#contact-name')).toHaveValue('Synthetic returning customer');
  await page.locator('label[for="contact-name"]').click();
  await expect(page.locator('#contact-name')).toBeFocused();
});
