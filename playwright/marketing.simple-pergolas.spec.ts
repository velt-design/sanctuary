import { expect, test, type Browser, type Page } from '@playwright/test';

const route = '/simple-pergolas-auckland';
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x720', width: 320, height: 720 },
] as const;

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  });
}

for (const viewport of viewports) {
  test(`simple pergola conversion page is production-ready at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);

    await expect(page).toHaveTitle('Simple Acrylic Pergolas | Sanctuary Pergolas');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /follow/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${publicOrigin}${route}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Cover the space without losing light.',
    })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request an initial estimate' }).first()).toBeVisible();
    await expect(page.getByText('Blinds can belong in the Simple cover brief.')).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Dairy Flat Estate' })).toBeAttached();
    await expect(page.locator('#acrylic-enquiry-type')).toHaveValue('residential');
    await expect(page.getByRole('button', { name: 'Request my initial estimate' })).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const priorityImage = page.locator('section').first().locator('img').first();
    await expect.poll(() => priorityImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });
}

test('homepage priorities continue into the page, project evidence and embedded enquiry', async ({ page }) => {
  await preparePage(page);
  await page.goto(`${route}?project=cover&priorities=daylight%2Ceveryday-use`);

  const context = page.locator('[data-project-finder-journey-context]');
  await expect(context).toHaveAttribute('data-project-direction', 'cover');
  await expect(context).toHaveAttribute('data-project-priorities', 'daylight,everyday-use');
  await expect(context.getByText('A simple cover designed to preserve natural light and make the space work every day.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Refine your brief' })).toHaveAttribute(
    'href',
    '/?project=cover&priorities=daylight%2Ceveryday-use',
  );
  await expect(page.getByRole('link', { name: 'View project' }).first()).toHaveAttribute(
    'href',
    '/projects/dairy-flat-estate?project=cover&priorities=daylight%2Ceveryday-use&reference=dairy-flat-estate',
  );

  const formContext = page.locator('input[name="enquiryContext"]');
  await expect(formContext).toHaveValue(/"source_experience":"project-finder-home-v1"/);
  await expect(formContext).toHaveValue(/"project_direction":"cover"/);
  await expect(formContext).toHaveValue(/"project_priorities":\["daylight","everyday-use"\]/);
  await expect(page.locator('input[name="page"]')).toHaveValue(route);
});

test('simple pergola enquiry keeps optional side protection and accessible validation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);

  await page.locator('#initial-estimate').scrollIntoViewIfNeeded();
  await page.getByText('Add optional project details').click();
  await expect(page.getByLabel('Side protection', { exact: false })).toContainText('Roof with one side blind');
  await expect(page.getByText('Outdoor blinds', { exact: true })).toBeVisible();

  await page.locator('#acrylic-enquiry-message').fill('Cover the deck and plan a blind for the western side.');
  await page.getByRole('button', { name: 'Request my initial estimate' }).click();
  const errorSummary = page.locator('#acrylic-enquiry-error-summary');
  await expect(errorSummary).toBeFocused();
  await expect(errorSummary).toContainText('Enter your name.');
  await expect(page.locator('#acrylic-enquiry-message')).toHaveValue(
    'Cover the deck and plan a blind for the western side.',
  );
});

test('the conversion page remains accessible without JavaScript', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(route);

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Cover the space without losing light.',
  })).toBeVisible();
  await expect(page.getByText('Blinds can belong in the Simple cover brief.')).toBeVisible();
  const form = page.locator('form[action="/api/enquiry/fallback"]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="page"]')).toHaveValue(route);
  await expect(page.getByText('File upload needs JavaScript.')).toBeVisible();
  await context.close();
});

test('the noindex conversion page is excluded from the sitemap while the acrylic SEO owner remains listed', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('/simple-pergolas-auckland');
  await expect(page.locator('body')).toContainText('/acrylic-roof-pergolas-auckland');

  await page.goto('/acrylic-roof-pergolas-auckland?project=cover&priorities=daylight%2Ceveryday-use');
  const legacyHeaderCta = page.locator('header.site').getByRole('link', {
    name: 'Start your project',
  });
  await expect(legacyHeaderCta).toHaveAttribute('href', /project_direction=cover/);
  await expect(legacyHeaderCta).toHaveAttribute(
    'href',
    /project_priorities=daylight%2Ceveryday-use/,
  );
});
