import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const route = '/acrylic-roof-pergolas-auckland';
const capturePhase = process.env.MARKETING_CAPTURE_PHASE?.trim();
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-acrylic-foundation');
const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

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
  test(`acrylic landing page uses the marketing foundation at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);

    await expect(page).toHaveTitle('Acrylic Roof Pergolas Auckland | Sanctuary Pergolas');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Acrylic roof pergolas for Auckland homes, designed to keep the light' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('header.site')).toBeVisible();
    await expect(page.locator('footer')).toBeAttached();
    await expect(page.getByLabel('Phone', { exact: false })).toHaveAttribute('required', '');
    await expect(page.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(page.locator('#acrylic-enquiry-roof')).toHaveValue('');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Acrylic Roof Pergolas for Auckland Homes');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    if (viewport.width <= 900) {
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(page.locator('header.site .desktop-nav')).toBeHidden();
    } else {
      await expect(page.getByRole('link', { name: 'Quick Estimate' })).toBeVisible();
    }

    if (viewport.width <= 720) {
      await expect(page.getByRole('link', { name: 'Request an estimate', exact: true })).toBeVisible();
    }

    if (capturePhase) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-top.png`) });
      await page.locator('#compare-tints').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-tints.png`) });
      const projectImages = page.locator('.acrylic-project-card img');
      await expect(projectImages).toHaveCount(4);
      await projectImages.first().scrollIntoViewIfNeeded();
      await expect(projectImages.first()).toBeVisible();
      await expect.poll(() => projectImages.first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-projects.png`) });
      await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-form.png`) });
    }
  });
}

test('acrylic landing interactions remain accessible and preserve form input on validation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/mobile-menu-open/);
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(mobileNavigation).toBeVisible();
  await expect.poll(() => mobileNavigation.evaluate((navigation) => getComputedStyle(navigation.parentElement!).opacity)).toBe('1');
  expect(await mobileNavigation.evaluate((navigation) => {
    const menuStyles = getComputedStyle(navigation.parentElement!);
    return {
      backgroundColor: menuStyles.backgroundColor,
      opacity: menuStyles.opacity,
      zIndex: menuStyles.zIndex,
    };
  })).toEqual({ backgroundColor: 'rgb(248, 248, 245)', opacity: '1', zIndex: '3500' });
  if (capturePhase) {
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-390x844-menu.png`) });
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);

  const message = page.locator('#acrylic-enquiry-message');
  await message.fill('A covered deck that keeps daylight in the kitchen.');
  expect(await message.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.getByRole('button', { name: 'Request my initial estimate' }).click();
  await expect(page.getByText('Choose an enquiry type.')).toBeVisible();
  await expect(message).toHaveValue('A covered deck that keeps daylight in the kitchen.');

  const faq = page.locator('details').filter({ hasText: 'Which acrylic tint should I choose?' });
  await expect(faq).toHaveCount(1);
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
  await expect(faq.getByText('Clear prioritises daylight and sky views.')).toBeVisible();
});

test('acrylic landing route remains listed in the public sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText('/acrylic-roof-pergolas-auckland');
});
