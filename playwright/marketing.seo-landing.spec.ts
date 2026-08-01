import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { faqItems } from '../apps/marketing/app/pergolas-auckland/content';

const route = '/pergolas-auckland';
const title = 'Pergolas Auckland | Design, Build & Installation';
const description = 'Plan an Auckland pergola around the home, outdoor area and intended use. Compare roof forms, materials and project scope, then share the site for an initial assessment.';
const capturePhase = process.env.MARKETING_SEO_CAPTURE_PHASE?.trim();
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-seo-landing', 'pergolas-auckland');
const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '430x932', width: 430, height: 932 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
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

function wordShingles(text: string, size = 10): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return new Set(words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(' ')));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / (left.size + right.size - intersection || 1);
}

async function getEditorialCopy(main: Locator) {
  return main.evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('#project-details, form, script').forEach((node) => {
      node.remove();
    });
    return copy.textContent ?? '';
  });
}

for (const viewport of viewports) {
  test(`Pergolas Auckland is publish-ready at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);
    const main = page.locator('main[data-seo-landing="pergolas-auckland"]:visible');

    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.getByRole('heading', { level: 1, name: 'Custom pergolas for Auckland homes.' })).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(page.locator('header.site')).toBeVisible();
    await expect(page.locator('footer')).toBeAttached();
    await expect(page.getByLabel('Phone', { exact: false })).toHaveAttribute('required', '');
    await expect(page.getByLabel('Email', { exact: false })).toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(main.locator('#acrylic-enquiry-roof')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Send project brief' })).toBeVisible();
    await expect(main.locator('.acrylic-project-card img')).toHaveCount(3);
    await expect(main.locator('.acrylic-faq-list > details')).toHaveCount(
      faqItems.length,
    );
    await expect(
      main.getByRole('navigation', { name: 'Pergola guide progression' }),
    ).toHaveCount(0);
    await expect(
      main.locator('a[href="/pergola-cost-auckland"]'),
    ).not.toHaveCount(0);
    await expect(main.locator('.seo-landing__project-facts')).toHaveCount(3);

    const publicCopy = await main.innerText();
    expect(publicCopy).not.toContain('—');
    expect(publicCopy).not.toContain('[[VERIFY:');
    expect(publicCopy.toLowerCase()).not.toContain('best in auckland');
    expect(publicCopy.toLowerCase()).not.toContain('transform your outdoor living');
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
      await page.locator('#design-brief').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-fit.png`) });
      await page.locator('#project-evidence').scrollIntoViewIfNeeded();
      await page.locator('.acrylic-project-card img').first().scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.acrylic-project-card img').first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-proof.png`) });
      await page.locator('#investment-drivers').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-investment.png`) });
      await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-form.png`) });
    }
  });
}

test('Pergolas Auckland keeps its narrative distinct from the acrylic landing page', async ({ page }) => {
  await preparePage(page);
  await page.goto(route);
  const broadMain = page.locator('main[data-seo-landing="pergolas-auckland"]:visible');
  const broadCopy = await getEditorialCopy(broadMain);
  const broadH1 = await broadMain.locator('h1').innerText();

  await page.goto('/acrylic-roof-pergolas-auckland');
  const acrylicMain = page.locator('main[data-seo-landing="acrylic-roof-pergolas-auckland"]:visible');
  const acrylicCopy = await getEditorialCopy(acrylicMain);
  const acrylicH1 = await acrylicMain.locator('h1').innerText();

  expect(broadH1).not.toBe(acrylicH1);
  expect(jaccardSimilarity(wordShingles(broadCopy), wordShingles(acrylicCopy))).toBeLessThan(0.14);
});

test('Pergolas Auckland enquiry preserves validation, generic roof preference and attribution', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  let submittedBody: Record<string, unknown> | undefined;
  await page.route('**/api/enquiry', async (routeHandler) => {
    submittedBody = routeHandler.request().postDataJSON() as Record<string, unknown>;
    await routeHandler.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto(route);

  const broadMain = page.locator('main[data-seo-landing="pergolas-auckland"]:visible');
  const broadMessage = broadMain.locator('#acrylic-enquiry-message');
  await broadMain.getByText('Add optional project details', { exact: true }).click();
  await expect(broadMessage).toHaveCount(1);
  await broadMessage.fill('We need a sheltered dining area but want to keep the kitchen bright.');
  await page.getByRole('button', { name: 'Send project brief' }).click();
  await expect(broadMain.locator('#acrylic-enquiry-type')).toHaveValue('residential');
  await expect(broadMain.locator('#acrylic-enquiry-name-error')).toHaveText('Enter your name.');

  await broadMain.locator('#acrylic-enquiry-name').fill('Test Person');
  await broadMain.locator('#acrylic-enquiry-phone').fill('021 000 0000');
  await broadMain.locator('#acrylic-enquiry-email').fill('test@example.com');
  await broadMain.locator('#acrylic-enquiry-suburb').fill('Auckland');
  await broadMain.locator('#acrylic-enquiry-roof').selectOption('Combination roofing');
  await page.getByRole('button', { name: 'Send project brief' }).click();

  await expect(broadMain.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
  expect(submittedBody).toMatchObject({
    page: route,
    source: 'website',
    roofMaterials: ['acrylic', 'timber'],
    projectDetails: { roofPreference: 'Combination roofing' },
  });
  expect(submittedBody?.submissionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('embedded enquiry keeps a rejected attachment blocking until it is corrected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  let requestCount = 0;
  await page.route('**/api/enquiry', async (routeHandler) => {
    requestCount += 1;
    await routeHandler.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto(route);

  const main = page.locator('main[data-seo-landing="pergolas-auckland"]:visible');
  const form = main.locator('form.acrylic-form');
  await expect(form).toHaveAttribute('method', 'post');
  await expect(form).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(form.locator('input[name="page"]')).toHaveValue(route);
  await expect(form.locator('input[name="enquiryContext"]')).toHaveValue(
    JSON.stringify({
      enquiry_type: 'residential',
      source_path: route,
      source_component: 'embedded_form',
    }),
  );
  await main.locator('#acrylic-enquiry-name').fill('Attachment Test');
  await main.locator('#acrylic-enquiry-phone').fill('+61 2 9374 4000');
  await main.locator('#acrylic-enquiry-email').fill('attachment@example.com');

  const files = main.locator('#acrylic-enquiry-files');
  await files.setInputFiles({
    name: 'payload.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('invalid'),
  });
  await expect(main.locator('#acrylic-enquiry-files-error')).toHaveText(
    'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
  );

  await main.getByRole('button', { name: 'Send project brief' }).click();
  expect(requestCount).toBe(0);
  await expect(main.locator('#acrylic-enquiry-error-summary')).toBeFocused();
  await expect(main.locator('#acrylic-enquiry-files-error')).toBeVisible();

  await files.setInputFiles({
    name: 'plan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-test'),
  });
  await expect(main.locator('#acrylic-enquiry-files-error')).toHaveCount(0);
  await expect(main.getByRole('list', { name: 'Selected files' })).toContainText('plan.pdf');
});

test('Pergolas Auckland sitemap, internal links and page schema match the service role', async ({ page, request }) => {
  await preparePage(page);
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText(route);

  await page.goto(route);
  const main = page.locator('main[data-seo-landing="pergolas-auckland"]:visible');
  await expect(main).toHaveCount(1);
  const internalLinks = await main.locator('a[href^="/"]').evaluateAll((links) => (
    [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href) && !href.startsWith('#') && !href.includes('#')))]
  ));
  for (const href of internalLinks) {
    const response = await request.get(href);
    expect(response.status(), `${href} should resolve`).toBeLessThan(400);
  }

  const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const jsonLdNodes = jsonLdScripts.flatMap((script) => {
    const parsed = JSON.parse(script) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  }) as Array<{ '@type'?: string; dateModified?: string; reviewedBy?: { name?: string }; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
  const serviceSchema = jsonLdNodes.find((node) => node['@type'] === 'Service');

  expect(serviceSchema).toBeDefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'FAQPage')).toBeUndefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'BreadcrumbList')).toBeDefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'WebPage')).toMatchObject({ dateModified: '2026-07-22', reviewedBy: { name: 'Sanctuary Pergolas' } });
});

const customRoute = '/custom-pergolas-auckland';
const customTitle = 'Custom Pergolas Auckland | Bespoke Design & Installation';
const customDescription = 'Plan a custom pergola for an Auckland home or site that needs more than a standard answer. See how Sanctuary resolves use, geometry, light, structure and scope.';
const customEvidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-seo-landing', 'custom-pergolas-auckland');

for (const viewport of viewports) {
  test(`Custom Pergolas Auckland is publish-ready at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(customRoute);
    const main = page.locator('main[data-seo-landing="custom-pergolas-auckland"]:visible');

    await expect(page).toHaveTitle(customTitle);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${customRoute}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', customDescription);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.getByRole('heading', { level: 1, name: 'Custom pergolas for difficult sites.' })).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.locator('.acrylic-project-card img')).toHaveCount(3);
    await expect(main.locator('.acrylic-faq-list > details')).toHaveCount(5);
    await expect(
      main.getByRole('navigation', { name: 'Pergola guide progression' }),
    ).toHaveCount(0);
    await expect(main.locator('.seo-landing__project-facts')).toHaveCount(3);
    const optionalProjectDetails = main.locator('details.acrylic-form__optional');
    if ((await optionalProjectDetails.getAttribute('open')) === null) {
      await optionalProjectDetails.locator(':scope > summary').click();
    }
    await expect(main.locator('#acrylic-enquiry-knownConstraints')).toBeVisible();
    await expect(main.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(main.locator('#acrylic-enquiry-roof')).toHaveValue('');

    const publicCopy = await main.innerText();
    expect(publicCopy).not.toContain('—');
    expect(publicCopy).not.toContain('[[VERIFY:');
    expect(publicCopy.toLowerCase()).not.toContain('bring your dream to life');
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
      await mkdir(customEvidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-top.png`) });
      await page.locator('#custom-meaning').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-fit.png`) });
      await page.locator('#custom-project-evidence').scrollIntoViewIfNeeded();
      await page.locator('.acrylic-project-card img').first().scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.acrylic-project-card img').first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-proof.png`) });
      await page.locator('#custom-conditions-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-decisions.png`) });
      await page.locator('#custom-process').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-process.png`) });
      await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-form.png`) });
    }
  });
}

test('Custom Pergolas Auckland is materially distinct from the broad pergola page', async ({ page }) => {
  await preparePage(page);
  await page.goto(customRoute);
  const customMain = page.locator('main[data-seo-landing="custom-pergolas-auckland"]:visible');
  const customCopy = await getEditorialCopy(customMain);
  const customH1 = await customMain.locator('h1').innerText();
  await page.goto(route);
  const broadMain = page.locator('main[data-seo-landing="pergolas-auckland"]:visible');
  const broadCopy = await getEditorialCopy(broadMain);
  const broadH1 = await broadMain.locator('h1').innerText();

  expect(customH1).not.toBe(broadH1);
  expect(jaccardSimilarity(wordShingles(customCopy), wordShingles(broadCopy))).toBeLessThan(0.14);
});

test('Custom Pergolas Auckland enquiry preserves its route and custom brief', async ({ page }) => {
  await preparePage(page);
  let submittedBody: Record<string, unknown> | undefined;
  await page.route('**/api/enquiry', async (routeHandler) => {
    submittedBody = routeHandler.request().postDataJSON() as Record<string, unknown>;
    await routeHandler.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto(customRoute);
  const customMain = page.locator('main[data-seo-landing="custom-pergolas-auckland"]:visible');
  const customEnquiryType = customMain.locator('#acrylic-enquiry-type');
  await expect(customEnquiryType).toHaveCount(1);
  await expect(customEnquiryType).toHaveValue('residential');
  await customMain.locator('#acrylic-enquiry-name').fill('Test Person');
  await customMain.locator('#acrylic-enquiry-phone').fill('021 000 0000');
  await customMain.locator('#acrylic-enquiry-email').fill('test@example.com');
  await customMain.locator('#acrylic-enquiry-suburb').fill('Auckland');
  await customMain.locator('#acrylic-enquiry-message').fill('The existing roofline and corner doors make a standard cover difficult.');
  await customMain.getByText('Add optional project details', { exact: true }).click();
  await customMain.locator('#acrylic-enquiry-knownConstraints').fill('No post can sit across the corner door and the deck changes level.');
  await customMain.locator('#acrylic-enquiry-roof').selectOption('Acrylic roofing');
  await page.getByRole('button', { name: 'Send project brief' }).click();
  await expect(customMain.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
  expect(submittedBody).toMatchObject({ page: customRoute, source: 'website', roofMaterials: ['acrylic'], projectDetails: { roofPreference: 'Acrylic roofing', knownConstraints: 'No post can sit across the corner door and the deck changes level.' } });
});

test('Custom Pergolas Auckland sitemap, links and page schema match the service role', async ({ page, request }) => {
  await preparePage(page);
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText(customRoute);
  await page.goto(customRoute);
  const main = page.locator('main[data-seo-landing="custom-pergolas-auckland"]:visible');
  await expect(main).toHaveCount(1);
  const internalLinks = await main.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href) && !href.includes('#')))]);
  expect(internalLinks).toEqual(expect.arrayContaining([
    '/pergolas-auckland',
    '/pergola-cost-auckland',
    '/outdoor-rooms-auckland',
    '/products',
  ]));
  for (const href of internalLinks) expect((await request.get(href)).status(), `${href} should resolve`).toBeLessThan(400);

  const jsonLdNodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((script) => { const parsed = JSON.parse(script) as unknown; return Array.isArray(parsed) ? parsed : [parsed]; }) as Array<{ '@type'?: string; dateModified?: string; reviewedBy?: { name?: string }; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
  expect(jsonLdNodes.find((node) => node['@type'] === 'Service')).toBeDefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'FAQPage')).toBeUndefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'BreadcrumbList')).toBeDefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'WebPage')).toMatchObject({ dateModified: '2026-07-22', reviewedBy: { name: 'Sanctuary Pergolas' } });
});
