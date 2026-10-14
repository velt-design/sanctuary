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
  { name: '430x932', width: 430, height: 932 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', intercepted => {
    if (new URL(intercepted.request().url()).origin !== new URL(baseURL!).origin) return intercepted.fulfill({ status: 200, body: '' });
    return intercepted.continue();
  });
  await page.route('**/api/enquiry', intercepted => intercepted.fulfill({ status: 503, json: { ok: false } }));
});

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
    await expect(page.getByRole('heading', { level: 1, name: 'Keep the light. Make room outside.' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('header.site')).toBeVisible();
    await expect(page.locator('footer')).toBeAttached();
    await expect(page.getByLabel('Phone', { exact: false })).toHaveAttribute('required', '');
    await expect(page.locator('#acrylic-enquiry-type')).toHaveValue('residential');
    await expect(page.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(page.locator('#acrylic-enquiry-roof')).toHaveValue('');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Acrylic Roof Pergolas for Auckland Homes');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    if (viewport.width <= 900) {
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(page.locator('header.site .desktop-nav')).toBeHidden();
    } else {
      await expect(
        page.locator('header.site').getByRole('link', { name: 'Start your project' }),
      ).toBeVisible();
    }

    await expect(page.locator('.acrylic-sticky-cta')).toHaveCount(0);

    if (capturePhase) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-top.png`) });
      await page.locator('#compare-tints').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-tints.png`) });
      const projectImages = page.locator('[data-acrylic-project] img');
      await expect(projectImages).toHaveCount(3);
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
  })).toEqual({ backgroundColor: 'rgb(238, 238, 233)', opacity: '1', zIndex: '4100' });
  if (capturePhase) {
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-390x844-menu.png`) });
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);

  const message = page.locator('#acrylic-enquiry-message');
  await message.fill('A covered deck that keeps daylight in the kitchen.');
  expect(await message.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.getByRole('button', { name: 'Send project brief' }).click();
  const errorSummary = page.locator('#acrylic-enquiry-error-summary');
  await expect(errorSummary).toBeFocused();
  await expect(errorSummary).toContainText('Enter your name.');
  await errorSummary.getByRole('link', { name: 'Enter your name.' }).click();
  await expect(page.locator('#acrylic-enquiry-name')).toBeFocused();
  await expect(message).toHaveValue('A covered deck that keeps daylight in the kitchen.');

  const faq = page.locator('details').filter({ hasText: 'Which acrylic tint should I choose?' });
  await expect(faq).toHaveCount(1);
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
  await expect(faq.getByText(
    'Consider the site, sun path, adjoining rooms, roof area and intended use alongside the sample colour.',
  )).toBeVisible();
});

test('acrylic landing route remains listed in the public sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText('/acrylic-roof-pergolas-auckland');
});

for (const width of [320, 390, 1440]) test(`native tint comparison stays stable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await preparePage(page);
  await page.goto(route);
  await page.getByRole('link', { name: 'Explore acrylic tints' }).click();
  const section = page.locator('#acrylic-options');
  await page.evaluate(() => document.fonts.ready);
  const geometry = () => section.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, controls: element.querySelector('fieldset')!.getBoundingClientRect().top - rect.top };
  });
  const baseline = await geometry();
  for (const tint of ['Light grey', 'Dark grey', 'Opal', 'Clear']) {
    await section.getByRole('radio', { name: tint, exact: true }).check();
    await expect(section.getByRole('heading', { name: `${tint} acrylic`, exact: true })).toBeVisible();
    const current = await geometry();
    expect(Math.abs(current.height - baseline.height)).toBeLessThan(1);
    expect(Math.abs(current.controls - baseline.controls)).toBeLessThan(1);
  }
  await section.getByRole('radio', { name: 'Clear', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(section.getByRole('radio', { name: 'Light grey', exact: true })).toBeChecked();
  await expect(section.getByRole('heading', { name: 'Light grey acrylic', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('tints and canonical enquiry fallback remain useful without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}${route}`);
  await page.getByRole('radio', { name: 'Opal', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Opal acrylic', exact: true })).toBeVisible();
  const form = page.getByRole('form', { name: 'Tell us about your project.' });
  await expect(form).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(form.locator('input[name="page"]')).toHaveValue(route);
  await expect(form.getByRole('button', { name: 'Send project brief' })).toBeEnabled();
  await expect(form.getByLabel('Photos, plans or sketches')).toBeDisabled();
  await context.close();
});

for (const marketing of [false, true]) test(`acrylic enquiry retries safely with marketing consent ${marketing}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(allowed => localStorage.setItem('sp_consent_v1', JSON.stringify({ version: 1, analytics: allowed, marketing: allowed, updatedAt: new Date().toISOString() })), marketing);
  await page.goto(`${route}?utm_source=facebook&utm_medium=paid_social&utm_campaign=acrylic_test&fbclid=synthetic-acrylic`);
  await page.getByRole('link', { name: 'Tell us about your space' }).click();
  const form = page.getByRole('form', { name: 'Tell us about your project.' });
  await form.getByLabel('Name Required', { exact: true }).fill('Synthetic Acrylic Test');
  await form.getByLabel('Phone Required', { exact: true }).fill('0210000000');
  await form.getByLabel('Email Required', { exact: true }).fill('synthetic@example.test');
  await form.getByLabel('Project suburb').fill('Auckland');
  await form.locator('summary').click();
  await form.locator('#acrylic-enquiry-roof').selectOption('Opal');
  const payloads: Array<Record<string, any>> = [];
  await page.route('**/api/enquiry', intercepted => {
    payloads.push(intercepted.request().postDataJSON());
    return intercepted.fulfill({ status: payloads.length === 1 ? 503 : 200, json: { ok: payloads.length > 1 } });
  });
  await form.getByRole('button', { name: 'Send project brief' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry was not sent.' })).toBeVisible();
  await expect(form.getByLabel('Name Required', { exact: true })).toHaveValue('Synthetic Acrylic Test');
  await expect(form.locator('#acrylic-enquiry-roof')).toHaveValue('Opal');
  await form.getByRole('button', { name: 'Send project brief' }).click();
  await expect(page.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
  expect(payloads[1].submissionId).toBe(payloads[0].submissionId);
  expect(payloads[1].enquiryContext).toMatchObject({ source_path: route, enquiry_type: 'residential', source_component: 'embedded_form' });
  expect(payloads[1].roofMaterials).toEqual(['acrylic']);
  expect(payloads[1].projectDetails.acrylicOption).toBe('Opal');
  expect(payloads[1].attribution.utm).toEqual(marketing ? { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'acrylic_test' } : {});
  if (marketing) expect(payloads[1].attribution.meta.fbc).toContain('synthetic-acrylic');
  else expect(payloads[1].attribution.meta).toBeUndefined();
});
