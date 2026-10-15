import { expect, test } from '@playwright/test';
const routes = ['/acrylic-roof-pergolas-auckland', '/auckland-outdoor-living'];
const key = 'sanctuary.configurator-preview.v1';
test.use({ actionTimeout: 15000 });

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', r => new URL(r.request().url()).origin === new URL(baseURL!).origin ? r.continue() : r.abort());
  await page.route('**/api/*price*', r => r.fulfill({ json: { status: 'unavailable' } }));
  await page.route('**/api/enquiry**', r => r.abort());
  await page.route('**/api/tracking-region', r => r.fulfill({ json: { policy: 'consent_required' } }));
});

for (const route of routes) test(`${route}: existing local draft, modal close and browser Back preserve selections`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route);
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('radio', { name: 'Acrylic', exact: true }).check();
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await page.evaluate(k => {
    const draft = JSON.parse(sessionStorage.getItem(k)!);
    draft.input.widthMm = 5400;
    draft.roof.acrylicTint = 'opal';
    draft.roof.infills = true;
    localStorage.setItem(k, JSON.stringify(draft));
    sessionStorage.removeItem(k);
  }, key);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.4');
  await expect(page.getByText('Your selected design is included', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.5');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  const open = page.getByRole('link', { name: 'Explore your design in 3D', exact: true });
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await expect(dialog.getByRole('checkbox', { name: 'Gable infills', exact: true })).toBeChecked();
  await expect(dialog.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  const selected = await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key);
  expect(selected).toMatchObject({ input: { widthMm: 5500 }, roof: { acrylicTint: 'opal', infills: true } });
  await page.goto('/privacy');
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.5');
  expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key)).toEqual(selected);
  await open.click();
  await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
  await dialog.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${route}#project-details$`));
  await expect(page.locator('form[data-inline-enquiry] [name=page]')).toHaveValue(route);
  await page.reload();
  expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key)).toEqual(selected);
});
