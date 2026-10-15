import { expect, test } from '@playwright/test';
const routes = ['/acrylic-roof-pergolas-auckland', '/auckland-outdoor-living'];
test.use({ actionTimeout: 15000 });
const key = 'sanctuary.configurator-preview.v1';
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', r => new URL(r.request().url()).origin === new URL(baseURL!).origin ? r.continue() : r.abort());
  await page.route('**/api/*price', r => r.fulfill({ json: { status: 'unavailable' } }));
  await page.route('**/api/enquiry**', r => r.abort());

});
for (const route of routes) for (const width of [390, 1440]) test(`${route} full design, edit and return at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route);
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  const hero = page.getByRole('link', { name: 'Design your pergola', exact: true }).first();
  await hero.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await expect(dialog).toBeVisible();
  const initial = await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key);
  expect(initial.roof.family).toBe('gable');
  expect(initial.roof.finish.material).toBe(route === routes[0] ? 'acrylic' : 'solid');
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(hero).toBeFocused();
  await hero.click();
  if (width < 720) {
    await dialog.getByRole('radio', { name: 'Combination', exact: true }).check();
    await dialog.getByRole('button', { name: 'Set your size', exact: true }).click();
  }
  await dialog.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await dialog.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  if (width < 720) {
    await dialog.getByRole('button', { name: 'Add sides & lighting', exact: true }).click();
    await dialog.getByRole('button', { name: 'Next side configuration', exact: true }).click();
    await dialog.getByRole('button', { name: 'Review your design', exact: true }).click();
  } else {
    await dialog.getByRole('checkbox', { name: 'Gable infills', exact: true }).check();
    await dialog.getByRole('button', { name: 'Plan', exact: true }).click();
    await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
  }
  await page.screenshot({ path: info.outputPath('selected-design.png') });
  const selected = await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key);
  expect(selected.input.widthMm).toBe(5400);
  if (width < 720) { expect(selected.roof.finish.material).toBe('combination'); expect(selected.roof.blinds.length).toBeGreaterThan(0); }
  else expect(selected.roof.infills).toBe(true);
  if (width < 720) {
    await dialog.getByRole('button', { name: 'Enquire', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Your details', exact: true })).toBeVisible();
    await dialog.locator('#contact-name').fill('Synthetic draft only');
    await dialog.getByRole('button', { name: 'Edit design', exact: true }).click();
    await dialog.getByRole('button', { name: 'Edit Size & structure', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Width in metres' }).fill('5.5');
    await dialog.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
    await dialog.getByRole('button', { name: 'Return to review', exact: true }).click();
    await expect(dialog.locator('#contact-name')).toHaveValue('Synthetic draft only');
    await dialog.locator('#contact-email').fill('synthetic@example.test');
    await dialog.locator('#contact-suburb').fill('Auckland');
    let payload: Record<string, any> | undefined;
    await page.route('**/api/enquiry', r => { payload = r.request().postDataJSON(); return r.fulfill({status:503,json:{ok:false}}); });
    await dialog.getByRole('button', { name: 'Enquire about this design', exact: true }).click();
    await expect.poll(() => payload).toBeTruthy();
    expect(payload!.enquiryContext.source_path).toBe(route);
    expect(payload!.enquiryContext.source_component).toBe('hero');
    expect(payload!.attribution.utm).toEqual({});
    await expect(dialog.locator('#contact-name')).toHaveValue('Synthetic draft only');
    selected.input.widthMm = 5500;
    await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await hero.click();
    expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key)).toEqual(selected);
    await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
    return;
  }
  await dialog.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/design-enquiry\\?.*source_path=${encodeURIComponent(route)}`));
  await expect(page.getByRole('link', { name: 'Back to website' })).toHaveAttribute('href', route);
  await page.reload();
  expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key)).toEqual(selected);
  await page.locator('#contact-name').fill('Synthetic draft only');
  await page.getByRole('link', { name: 'Edit my design' }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(page.locator('#contact-name')).toHaveValue('Synthetic draft only');
  await page.getByRole('link', { name: 'Back to website' }).click();
  await expect(page).toHaveURL(new RegExp(`${route}$`));
  await page.locator('#design-your-pergola').getByRole('link', { name: 'Design your pergola', exact: true }).click();
  expect(await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!), key)).toEqual(selected);
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/design-enquiry/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${route}$`));
});
