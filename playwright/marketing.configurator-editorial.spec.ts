import { expect, test } from '@playwright/test';

for (const width of [1024, 1280, 1440]) {
  test(`desktop editorial journey retains choices and reachable actions at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
    await page.route('**/api/enquiry', route => route.abort());
    await page.goto('/configurator-preview?open=1');
    const dialog = page.getByRole('dialog', { name: 'Design your pergola', exact: true });
    await expect(dialog).toBeVisible();
    await page.getByRole('radio', { name: 'Gable', exact: true }).check();
    const size = page.getByRole('textbox', { name: 'Width in metres' });
    await size.fill('5.6');
    await size.press('Enter');
    const viewer = page.getByRole('region', { name: 'Pergola views' });
    const initial = (await viewer.boundingBox())!;
    await page.getByRole('button', { name: 'Personalise your pergola', exact: false }).click();
    await page.getByRole('button', { name: /^Roof & ceiling/ }).click();
    await page.getByRole('button', { name: 'Back to Personalise', exact: true }).click();
    await page.getByRole('button', { name: 'Review my design', exact: false }).click();
    const review = page.getByRole('region', { name: 'Review your design' });
    await expect(review).toContainText('5.6 × 3.0 m');
    await expect(review).toContainText('Gable');
    await expect(page.getByRole('link', { name: /Enquire/ })).toBeInViewport();
    await page.getByRole('button', { name: 'Edit Size & structure', exact: true }).click();
    await expect(size).toHaveValue('5.6');
    const after = (await viewer.boundingBox())!;
    expect(after.y).toBeCloseTo(initial.y, 0);
    expect(after.height).toBeCloseTo(initial.height, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.reload();
    await expect(size).toHaveValue('5.6');
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Night', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('group', { name: /Pergola plan/ })).toBeVisible();
    await page.screenshot({ path: `artifacts/marketing-foundation-evolution/configurator-desktop-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
}

test('homepage designer has the same compact action area as the direct preview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: '2026-09-18T00:00:00.000Z', version: 1 })));
  await page.goto('/configurator-preview?open=1');
  const action = page.getByLabel('Continue your design', { exact: true });
  const directHeight = (await action.boundingBox())!.height;
  await page.getByRole('button', { name: '3 Review', exact: true }).click();
  const directReviewHeight = (await action.boundingBox())!.height;
  await page.goto('/');
  await page.getByRole('radio', { name: /Design your pergola/ }).click();
  await expect(page.getByRole('dialog', { name: 'Design your pergola' })).toBeVisible();
  await page.getByRole('button', { name: '1 Your pergola', exact: true }).click();
  expect((await action.boundingBox())!.height).toBeCloseTo(directHeight, 0);
  await expect(page.getByRole('button', { name: 'Personalise your pergola', exact: false })).toBeInViewport();
  await page.getByRole('button', { name: 'Personalise your pergola', exact: false }).click();
  expect((await action.boundingBox())!.height).toBeCloseTo(directHeight, 0);
  await page.screenshot({ path: 'artifacts/marketing-foundation-evolution/configurator-home-entry.png' });
  await page.getByRole('button', { name: 'Review my design', exact: false }).click();
  expect((await action.boundingBox())!.height).toBeCloseTo(directReviewHeight, 0);
  await expect(page.getByRole('link', { name: /Enquire/ })).toBeInViewport();
});
