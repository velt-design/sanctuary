import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'compact desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`standalone foundation is complete and fluid at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/__foundation/marketing');

    await expect(page.getByRole('heading', { level: 1, name: 'Architectural Editorial UI Foundation' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('header.site')).toBeHidden();
    await expect(page.getByText('Transparent / over hero')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Architectural pergolas tailored to Kiwi homes.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start your project' }).first()).toHaveCSS('background-color', 'rgb(79, 87, 72)');
    await expect(page.getByRole('heading', { name: 'Warkworth Outdoor Room' }).first()).toBeVisible();
    await expect(page.getByText('Responsive composition')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Enquiry progress' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByText('Thank you. We’ll be in touch shortly.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test(`public homepage retains its established implementation at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Architectural pergolas tailored to Kiwi homes.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quick Estimate' }).first()).toHaveAttribute('href', '/contact');
    await expect(page.getByRole('heading', { name: 'The Sanctuary Process' })).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('foundation mobile navigation and FAQ preserve keyboard behavior and focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/__foundation/marketing');

  const menuButton = page.getByRole('button', { name: /Menu/ });
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/foundation-menu-open/);
  await expect(page.getByRole('navigation', { name: 'Foundation mobile sections' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Foundation' }).last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/foundation-menu-open/);
  expect(await menuButton.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');

  const faq = page.getByText('How early can I get an estimate?');
  await faq.click();
  await expect(page.getByText('Share photos and rough dimensions with the team')).toBeVisible();
});

test('foundation route is excluded from the public sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('__foundation');
});
